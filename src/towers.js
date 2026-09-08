import { firingFor } from './content/firing-defaults.js';
// Sentry combat rules. Identity, numbering and radial order have one content owner.
import { SENTRIES, SENTRY_ORDER } from './content/sentries.js';
const COMBAT = {
  "rotor": {
    "color": 15397631,
    "cost": 45,
    "dmg": 0.1,
    "range": 3.6,
    "rate": 2.2,
    "attack": "single"
  },
  "plasma": {
    "color": 3139280,
    "cost": 80,
    "dmg": 0.044444444444444446,
    "range": 2.6,
    "rate": 6,
    "attack": "beam"
  },
  "quiver": {
    "color": 5938175,
    "cost": 90,
    "dmg": 0.14444444444444443,
    "range": 3.5,
    "rate": 1.2,
    "attack": "seeker",
    "lock": true
  },
  "relay": {
    "color": 12904191,
    "cost": 100,
    "dmg": 0,
    "range": 3.5,
    "rate": 1,
    "attack": "slowfield",
    "slowFactor": 0.45,
    "slowDur": 1.6
  },
  "mortar": {
    "color": 10470655,
    "cost": 110,
    "dmg": 0.13333333333333333,
    "range": 3.5,
    "rate": 0.9,
    "attack": "mortar",
    "splash": 1.5,
    "arc": true
  },
  "lancer": {
    "color": 16777215,
    "cost": 130,
    "dmg": 0.3333333333333333,
    "range": 7,
    "rate": 0.45,
    "attack": "lance",
    "pierce": true,
    "burst": 3
  },
  "needle": {
    "color": 13102079,
    "cost": 220,
    "dmg": 0.37777777777777777,
    "range": 8,
    "rate": 0.45,
    "attack": "sniper",
    "hitscan": true
  },
  "heptapod": {
    "color": 16757854,
    "cost": 260,
    "dmg": 0.17777777777777778,
    "range": 3.4,
    "rate": 1.8,
    "attack": "walker",
    "hullHp": 9
  }
};
export const TOWERS = SENTRIES.map(s => Object.freeze({ ...COMBAT[s.key], ...s, sound:s.fire }));
export const TOWER_BY_KEY = Object.fromEntries(TOWERS.map(t => [t.key,t]));
export const TOWER_ORDER = SENTRY_ORDER;
export const HACK_GATED = ['mortar'];
const WAVE_LADDER = TOWER_ORDER.filter(k => !HACK_GATED.includes(k));
// Retain the numeric identity for existing result files; retired roster URLs resolve here.
export const DEFAULT_ROSTER_ID = 2;
export const ROSTER = { id:2, label:'Sentries', towers:TOWERS, order:TOWER_ORDER, hackGated:HACK_GATED };
export const ROSTERS = { 2:ROSTER };
export const useRoster = () => ROSTER;
export const starterTower = () => TOWERS[0];
export const towerSound = def => def.sound;

// upgrade economics, HK-exact: tier1 = 70% of purchase, tier2 = 120%,
// two tiers max. Returns null when maxed.
export const MAX_TIER = 2;
export function upgradeCost(def, currentTier) {
  if (currentTier === 0) return Math.round(def.cost * 0.7);
  if (currentTier === 1) return Math.round(def.cost * 1.2);
  return null;
}

// per-tier growth (HK-exact) + tier-2 specials
const UP_DAMAGE = 0.55;
const UP_RANGE = 0.08;
const UP_RATE = 0.1;

// effective stats at a tier: base growth per tier, plus the tier-2
// signature bonus per attack family (HK unit.ts:232-240).
export function effectiveStats(def, tier) {
  const s = {
    dmg: def.dmg * (1 + UP_DAMAGE * tier),
    range: def.range * (1 + UP_RANGE * tier),
    rate: def.rate * (1 + UP_RATE * tier),
    pellets: def.pellets ?? 0,
    splash: def.splash ?? 0,
    slowFactor: def.slowFactor,
    slowDur: def.slowDur,
  };
  if (tier >= 2) {
    if (def.attack === 'mortar') s.splash *= 1.4;
    else if (def.attack === 'spread') s.pellets += 2;
    else if (def.attack === 'beam' || def.attack === 'homing') s.range *= 1.3;
    else if (def.attack === 'single') s.rate *= 1.2;
  }
  const rounds=firingFor(def.key).rounds||1;
  s.rate*=rounds;s.dmg/=rounds;
  return s;
}

// targeting: nearest ALIVE enemy within range (HK stepCombat). The
// distance function is injected so the sphere's chord metric plugs in
// without this module knowing about geometry.
export function pickTarget(towerPos, range, enemies, dist) {
  let best = null;
  let bestD = range;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(towerPos, e.pos);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

// cooldown helper: seconds between shots at a rate
export const shotInterval = (rate) => 1 / rate;

// --- progressive unlock ladder -------------------------------------------
// Towers unlock by WAVE: ONE new tower each wave, cheap → capstone.
// Cumulative: wave N grants the first N towers (capped at the roster).
// TOWER_ORDER / HACK_GATED / WAVE_LADDER are the live roster's, above.
//
// HACK-GATED: never unlocked by the wave clock — the only source is
// winning a protocol at the Antipode Relay. Sim batch 2026-08-30 showed
// the mid-game locking solid once the full kit arrives by timetable; the
// operator's ruling gates the OP half of the slow+aoe combo behind the
// errand. The wave ladder is TOWER_ORDER minus these, so the capstones
// each arrive one wave earlier than before.

export function unlockedTowerKeys(wave, hacks = 0) {
  const n = Math.max(1, Math.min(WAVE_LADDER.length, Math.floor(wave) || 1));
  const out = WAVE_LADDER.slice(0, n);
  // relay wins decrypt the gated kit first, in gate order; wins beyond
  // that push the wave ladder ahead of the clock
  const h = Math.max(0, Math.floor(hacks));
  for (let i = 0; i < Math.min(h, HACK_GATED.length); i++) out.push(HACK_GATED[i]);
  const extra = h - HACK_GATED.length;
  if (extra > 0) {
    const m = Math.min(WAVE_LADDER.length, n + extra);
    for (const k of WAVE_LADDER.slice(n, m)) out.push(k);
  }
  return out;
}

// The wave a key unlocks on — null for hack-gated keys, which have no
// wave at all (the radial shows the relay glyph instead of a W number).
export function towerUnlockWave(key) {
  const i = WAVE_LADDER.indexOf(key);
  return i < 0 ? null : i + 1;
}
