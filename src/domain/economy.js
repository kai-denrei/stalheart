// economy.js — the BIOMASS system. HokorobiTawaa's credit math, verbatim;
// only the substance changed. Pure module: no DOM, Node-testable. The TD
// tab renders the numbers; this owns them.
//
// Biomass is alien tissue rendered down — the one thing the Construction
// Drone can print structures out of. Loop: kill → bounty × streak-multiplier
// → biomass. Streak grows 5% per consecutive kill, caps at ×5, and resets
// when an enemy LEAKS (reaches the Heart). Spending: tower/unit purchase,
// upgrades; selling reclaims 75% of everything rendered into the piece.
//
// Naming note: the module keeps the name `economy` — the economy is the
// system, biomass is the currency inside it.

export const START_BIOMASS = 190;
export const STREAK_STEP = 0.05;
// FIRST CUT, 2026-09-02, from the sim rather than by feel: on the ram policy
// a run EARNED 2009 and SPENT 618 — a 1561kg surplus, the purse able to
// afford the cheapest tower 80% of the run — while the build-heavy policy on
// the same seed spent 98% and was short half the time. So the excess is the
// ram loop specifically: KILL_PAY.tank 1.0 x RAM_PREMIUM 1.5 x a streak that
// capped at 5, or 7.5x bounty on a chain. Cap 5 -> 3 and premium 1.5 -> 1.25
// bring that ceiling to 3.75x. Measured again after the change; see DEVLOG.
export const STREAK_CAP = 3;
// 60 % since the economy design of 2026-11-12 (2.5; was 75 %): selling is a way out, not a free swap
export const REFUND_FRACTION = 0.6;

// operator ruling: ramming pays a premium — personal risk towers never take
export const RAM_PREMIUM = 1.25;

export function sellRefund(spent) {
  return Math.round(spent * REFUND_FRACTION);
}

// wave-clear drip (adapted from HK's fraying grant 130+8·wave — steadier
// small payments suit shorter rounds)
export function waveClearBonus(wave) {
  return 20 + 4 * wave;
}

// early-call bonus: biomass proportional to downtime skipped, capped
export function earlyCallBonus(secondsSaved, cap = 40) {
  return Math.min(cap, Math.max(0, Math.round(secondsSaved)));
}

export function makeEconomy(opts = {}) {
  const startBiomass = opts.startBiomass ?? START_BIOMASS;
  let biomass = startBiomass;
  // THE PEARLS ARE THE BANK (owner, 2026-11-05, round 8 note 7: the Yushi045 Bio-Pearls are "where the biomass is stored"; src/domain/bio-pearls.js):
  // `cap` is their capacity, Infinity until a depot stands. A credit that does not fit is lost (ledger.lost); the rover's deposit only takes
  // what fits and keeps the rest aboard. KILLS LEAVE BIOMASS ON THE GROUND: award(..., { hold: true }) books the kill (the streak, the score,
  // `earned` by source) without banking it; the kg go to the field (src/domain/biomass-field.js) and come in through deposit() when the
  // rover unloads them (ledger.field: kg laid on the ground, ledger.harvested: kg the rover brought home)
  let cap = opts.cap ?? Infinity;
  let streak = 0;
  let score = 0; // cumulative, never spent
  // LEDGER (2026-09-02): what came in and what went out, so the sim can
  // measure the economy instead of the operator feeling it. `earned` is
  // kills and bonuses; `spent` is every successful spend.
  let earned = 0, spent = 0, peak = biomass;

  const ledger = { bounty: 0, grants: 0, refunds: 0, breachGrants: 0, field: 0, harvested: 0, lost: 0 };
  // a credit into the capped bank: what fits, the rest lost
  const bank = (n) => { const fit = Math.max(0, Math.min(n, cap - biomass)); biomass += fit; ledger.lost += n - fit; if (biomass > peak) peak = biomass; return fit; };
  // THE LEDGER BY SOURCE (round 6, the build board's measure, 2026-11-05): kill pay by who killed (`src`: tank, tower, strike, ram, ...),
  // credits by category (sector-held, farm, grant, breach-grant, refund) and spends by kind (sentry, upgrade, board, plasma, ...)
  const bySource = {}, byCategory = {}, spentBy = {};
  const tally = (o, k, n) => { o[k] = (o[k] ?? 0) + n; };
  const multiplier = () =>
    Math.min(STREAK_CAP, 1 + STREAK_STEP * streak);

  return {
    get biomass() { return biomass; },
    get starting() { return startBiomass; },
    get ledger() { return { ...ledger, bySource: { ...bySource }, byCategory: { ...byCategory }, spentBy: { ...spentBy } }; },
    get streak() { return streak; },
    get cap() { return cap; },
    setCap(n) { cap = Number.isFinite(n) && n >= 0 ? n : Infinity; },
    get score() { return score; },
    multiplier,
    // a kill: streak grows FIRST, then bounty scales by the multiplier —
    // HK's onKill order exactly (award includes the kill's own streak step)
    award(bounty, { ram = false, src = null, hold = false } = {}) {
      streak++;
      const amount = Math.round(bounty * (ram ? RAM_PREMIUM : 1) * multiplier());
      tally(bySource, ram ? 'ram' : src ?? 'other', amount);
      if (hold) ledger.field += amount; else bank(amount);
      score += amount;
      earned += amount; ledger.bounty += amount;
      return amount;
    },
    // the rover unloads: what fits in the pearls, returned (the rest stays aboard)
    deposit(n) {
      if (!Number.isFinite(n) || n <= 0) return 0;
      const fit = Math.max(0, Math.min(n, cap - biomass));
      biomass += fit; ledger.harvested += fit; if (biomass > peak) peak = biomass;
      return fit;
    },
    // an enemy reached the Heart: the streak dies with the moment
    leak() { streak = 0; },
    canAfford(cost) { return Number.isFinite(cost) && cost >= 0 && biomass >= cost; },
    spend(cost, { category = 'other' } = {}) {
      if (!Number.isFinite(cost) || cost < 0 || biomass < cost) return false;
      biomass -= cost;
      spent += cost; tally(spentBy, category, cost);
      return true;
    },
    addBiomass(n, { category = 'grant' } = {}) {
      if (!Number.isFinite(n) || n < 0) throw new Error('Biomass credit must be finite and nonnegative');
      bank(n); tally(byCategory, category, n);
      if (category === 'refund') ledger.refunds += n;
      else {
        earned += n; score += n;
        if (category === 'breach-grant') ledger.breachGrants += n; else ledger.grants += n;
      }
    },
    get earned() { return earned; },
    get spent() { return spent; },
    get peak() { return peak; },
  };
}
