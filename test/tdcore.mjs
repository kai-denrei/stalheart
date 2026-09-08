// tdcore.mjs — invariants for the TD M0 extraction: enemyspec (shared
// roster data), towers (configs + upgrade + targeting math), economy
// (biomass/streak math). All pure modules; no DOM, no three.js.

import { ENEMY_SPEC, INTROS, typesByWave, computeWavePlan, CREATURE_TINTS,
  SAFE_HUES, ALARM_HUES, isSafeHue, isAlarmHue, accentFor, hueLuma, DARK_LUMA, ACCENT_ALARM }
  from '../src/enemyspec.js';
import { useRoster, TOWERS, TOWER_BY_KEY, MAX_TIER, upgradeCost, effectiveStats, pickTarget, shotInterval, unlockedTowerKeys, towerUnlockWave, TOWER_ORDER, HACK_GATED } from '../src/towers.js';
import { shotOf } from '../src/sentryfx.js';
import { makeEconomy, sellRefund, waveClearBonus, earlyCallBonus, START_BIOMASS, RAM_PREMIUM, STREAK_CAP } from '../src/economy.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

// --- enemyspec -----------------------------------------------------------
console.log('enemyspec:');
check('every intro type has a spec', INTROS.every((iv) => ENEMY_SPEC[iv.type]));
// a spec is either in the programme or explicitly SHELVED. The two checks
// below are one rule read from both ends, so a shelved unit cannot quietly
// become a forgotten one: shelving costs a flag, and the flag is asserted.
check('every unshelved spec type has an intro',
  Object.keys(ENEMY_SPEC).every((t) => ENEMY_SPEC[t].shelved || INTROS.some((iv) => iv.type === t)));
check('a shelved spec is NOT in the programme',
  Object.keys(ENEMY_SPEC).every((t) => !ENEMY_SPEC[t].shelved || !INTROS.some((iv) => iv.type === t)));
check('intro waves are 1..12 in order',
  INTROS.every((iv, i) => iv.wave === i + 1));
check('every intro type has spec and tint',
  INTROS.every((iv) => ENEMY_SPEC[iv.type] && CREATURE_TINTS[iv.type] !== undefined));
check('boss is not rammable',
  Object.values(ENEMY_SPEC).every((s) => !(s.boss && s.rammable)));
check('bounties positive everywhere',
  Object.values(ENEMY_SPEC).every((s) => s.bounty > 0));
check('hp and speed sane',
  Object.values(ENEMY_SPEC).every((s) => s.hp >= 1 && s.speed > 0 && s.size > 0));

// --- towers --------------------------------------------------------------
// THIS BLOCK IS ABOUT THE CAMPAIGN'S ECONOMY — the 40/70/80/90/100/110/130/220
// ladder, its unlock order and its hack gate — so it names the roster instead
// of inheriting whichever one happens to be the default. It used to inherit,
// and the day the default moved to the sentry board it stopped testing
// anything and started throwing on `TOWER_BY_KEY.lancer`. A test that depends
// on an implicit default is a test that silently changes subject.
useRoster(2);
console.log('towers:');
check('8 towers', TOWERS.length === 8);
check('keys unique + lookup', new Set(TOWERS.map((t) => t.key)).size === 8
  && TOWER_BY_KEY.lancer.cost === 130);
check('Heptapod is the capstone cost', Math.max(...TOWERS.map((t) => t.cost)) === TOWER_BY_KEY.heptapod.cost);
// TEMPO MOVED, the assertion did not. projSpeed lives in sentryfx.js now —
// towers.js keeps what a weapon does, sentryfx.js how it looks — so this reads
// through shotOf. The relationships are the point and they are unchanged: a
// sniper's round outruns a single's, and a mortar's is slower than a homing.
check('every projectile tower has its own tempo',
  TOWERS.filter((t) => !['beam', 'slowfield'].includes(t.attack))
    .every((t) => shotOf(t).projSpeed > 0)
  && shotOf(TOWER_BY_KEY.lancer).projSpeed > shotOf(TOWER_BY_KEY.rotor).projSpeed
  && shotOf(TOWER_BY_KEY.mortar).projSpeed < shotOf(TOWER_BY_KEY.quiver).projSpeed);
check('upgrade costs HK-exact (70%/120%, then maxed)',
  upgradeCost(TOWER_BY_KEY.rotor, 0) === 31
  && upgradeCost(TOWER_BY_KEY.rotor, 1) === 54
  && upgradeCost(TOWER_BY_KEY.rotor, MAX_TIER) === null);
{
  const t0 = effectiveStats(TOWER_BY_KEY.rotor, 0);
  const t1 = effectiveStats(TOWER_BY_KEY.rotor, 1);
  check('tier growth: +55% dmg, +8% range, +10% rate',
    Math.abs(t1.dmg / t0.dmg - 1.55) < 1e-9
    && Math.abs(t1.range / t0.range - 1.08) < 1e-9
    && Math.abs(t1.rate / t0.rate - 1.10) < 1e-9);
}
{
  const mortar2 = effectiveStats(TOWER_BY_KEY.mortar, 2);
  const beam2 = effectiveStats(TOWER_BY_KEY.plasma, 2);
  const rotor2 = effectiveStats(TOWER_BY_KEY.rotor, 2);
  check('tier-2 splash, beam range and rotary cadence bonuses',
    mortar2.splash / TOWER_BY_KEY.mortar.splash > 1.39
    && Math.abs(beam2.range / (TOWER_BY_KEY.plasma.range * 1.16) - 1.3) < 1e-9
    && Math.abs(rotor2.rate / (effectiveStats(TOWER_BY_KEY.rotor,0).rate * 1.2) - 1.2) < 1e-9);
}
{
  // targeting: nearest alive in range, injected metric
  const dist = (a, b) => Math.abs(a - b); // 1-D world for the test
  const enemies = [
    { alive: true, pos: 9 },
    { alive: true, pos: 3 },
    { alive: false, pos: 1 },  // dead and nearest — must be skipped
    { alive: true, pos: 20 },  // out of range
  ];
  const hit = pickTarget(0, 10, enemies, dist);
  check('targeting picks nearest ALIVE within range', hit && hit.pos === 3);
  check('targeting null when field empty',
    pickTarget(0, 10, [{ alive: true, pos: 99 }], dist) === null);
  check('shot interval = 1/rate', Math.abs(shotInterval(2) - 0.5) < 1e-12);
}

// --- the colour safety rule ----------------------------------------------
// Colour tells the player whether a contact goes under the treads, before
// they have parsed its shape. If a hue ever crosses sides the game is lying
// about something that costs a hull, so it is asserted, not trusted.
console.log('enemy colour rule:');
{
  let safeOk = true, alarmOk = true, covered = true;
  for (const [key, spec] of Object.entries(ENEMY_SPEC)) {
    const hex = CREATURE_TINTS[key];
    if (hex === undefined) { covered = false; continue; }
    if (spec.rammable && !isSafeHue(hex)) { safeOk = false; console.error(`    ${key} is rammable but not a safe hue`); }
    if (!spec.rammable && !isAlarmHue(hex)) { alarmOk = false; console.error(`    ${key} is solid but not an alarm hue`); }
  }
  check('every enemy has a tint', covered);
  check('rammable enemies wear a SAFE hue (grey/white/blue/yellow)', safeOk);
  check('solid enemies wear an ALARM hue (orange/green/brown/purple/dark red)', alarmOk);
  check('the two palettes never overlap',
    !Object.values(SAFE_HUES).some((h) => Object.values(ALARM_HUES).includes(h)));
  // A DARK dangerous body may not highlight in white: white is a safe belt,
  // and a white-flecked near-black cloud inside a crowd of white-belt phage
  // reads as one of the phage. That was the operator's report, and this is
  // the rule that stops the next dark unit repeating it.
  let accentOk = true;
  for (const [key, spec] of Object.entries(ENEMY_SPEC)) {
    const hex = CREATURE_TINTS[key];
    if (spec.rammable || hueLuma(hex) >= DARK_LUMA) continue;
    if (!ACCENT_ALARM.includes(accentFor(key))) {
      accentOk = false;
      console.error(`    ${key} is dark and solid but accents in a non-alarm hue`);
    }
  }
  check('dark solid enemies accent from the ALARM palette, never white', accentOk);
  check('bright enemies keep the plain white highlight',
    accentFor('phage') === 0xffffff && accentFor('drifter') === 0xffffff);
}

// --- economy -------------------------------------------------------------
console.log('economy:');
{
  const eco = makeEconomy();
  check('starts at START_BIOMASS', eco.biomass === START_BIOMASS);
  const first = eco.award(10); // streak 1 → ×1.05
  check('first kill pays bounty × 1.05', first === Math.round(10 * 1.05));
  eco.leak();
  check('leak resets the streak', eco.streak === 0 && eco.multiplier() === 1);
  for (let i = 0; i < 200; i++) eco.award(1);
  check(`multiplier caps at x${STREAK_CAP}`, eco.multiplier() === STREAK_CAP);
  const ramPay = makeEconomy().award(10, { ram: true });
  check(`ram premium x${RAM_PREMIUM}`, ramPay === Math.round(10 * RAM_PREMIUM * 1.05));
  const eco2 = makeEconomy({ startBiomass: 50 });
  check('spend guards affordability',
    eco2.spend(60) === false && eco2.spend(50) === true && eco2.biomass === 0);
  check('sell refund = 75% of spent', sellRefund(100) === 75);
  check('wave-clear bonus grows', waveClearBonus(5) === 40 && waveClearBonus(1) === 24);
  check('early-call bonus caps', earlyCallBonus(120) === 40 && earlyCallBonus(12) === 12);
}

// --- tower-unlock ladder -------------------------------------------------
console.log('tower unlocks:');
check('wave 1 unlocks single only', JSON.stringify(unlockedTowerKeys(1)) === JSON.stringify(['rotor']));
check('wave 2 unlocks single+rapid', JSON.stringify(unlockedTowerKeys(2)) === JSON.stringify(['rotor', 'plasma']));
check('unlock clamps below 1', JSON.stringify(unlockedTowerKeys(0)) === JSON.stringify(['rotor'])
  && JSON.stringify(unlockedTowerKeys(-3)) === JSON.stringify(['rotor']));
const LADDER_N = TOWER_ORDER.length - HACK_GATED.length;
check('wave N grants N towers (cumulative, ladder only)',
  Array.from({ length: LADDER_N }, (_, i) => i + 1).every((w) => unlockedTowerKeys(w).length === w));
check('the wave clock NEVER unlocks a gated tower',
  HACK_GATED.every((k) => !unlockedTowerKeys(99).includes(k)));
check('the first relay win decrypts the gate',
  HACK_GATED.every((k) => unlockedTowerKeys(1, 1).includes(k)));
check('wins beyond the gate push the ladder',
  unlockedTowerKeys(2, 2).length === 2 + 1 + 1); // wave 2 + gate + 1 early
check('full kit = ladder by clock + gate by relay',
  unlockedTowerKeys(99, HACK_GATED.length).length === TOWER_ORDER.length);
check('every unlocked key is a real tower', unlockedTowerKeys(99, 9).every((k) => TOWER_BY_KEY[k]));
check('towerUnlockWave: gated keys have NO wave',
  HACK_GATED.every((k) => towerUnlockWave(k) === null)
  && towerUnlockWave('rotor') === 1 && towerUnlockWave('heptapod') === LADDER_N);
check('TOWER_ORDER covers the roster', TOWER_ORDER.length === TOWERS.length && TOWER_ORDER.every((k) => TOWER_BY_KEY[k]));

// --- wave plan -----------------------------------------------------------
check('wave 1 plan is a single type', (() => { const p = computeWavePlan(1, 1, 4); return p.entries.length === 1 && p.headline === 'phage'; })());
check('headline is the newest available type', [2, 5, 9, 12].every((w) => computeWavePlan(w, 1, 4).headline === INTROS[Math.min(w, INTROS.length) - 1].type));
// through wave 8 (the unlock ladder) the shape stays learnable; past it the
// INVASION adds flood entries on top, so the cap only binds the ladder
check('ladder waves = 1 + up to 2 supports', [1, 2, 3, 8].every((w) => { const n = computeWavePlan(w, 1, 4).entries.length; return n >= 1 && n <= 3; }));
check('invasion waves flood past the ladder cap', computeWavePlan(12, 1, 4).entries.length > 3);
check('the flood is rammable fodder', (() => {
  const p = computeWavePlan(12, 1, 4);
  return p.entries.slice(-2).every((e) => ['phage', 'ghost'].includes(e.type) && e.count >= 10);
})());
check('the invasion swells the total hard', (() => {
  const tot = (w) => computeWavePlan(w, 1, 4).entries.reduce((a, e) => a + e.count, 0);
  return tot(9) > tot(8) * 2.5;
})());
check('supports are earlier types, never the headline', [3, 8, 12].every((w) => { const p = computeWavePlan(w, 1, 4); const avail = typesByWave(w); return p.entries.slice(1).every((e) => e.type !== p.headline && avail.includes(e.type)); }));
check('wave plan is deterministic', JSON.stringify(computeWavePlan(7, 2, 4)) === JSON.stringify(computeWavePlan(7, 2, 4)));
check('all wave-plan counts are >= 1', [1, 4, 8, 12, 20].every((w) => computeWavePlan(w, 2, 4).entries.every((e) => e.count >= 1)));
check('typesByWave grows with wave, caps at the roster', typesByWave(1).length === 1 && typesByWave(5).length === 5 && typesByWave(99).length === INTROS.length);

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1); }
console.log('\ntd-core invariants hold');
