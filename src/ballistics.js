// ballistics.js — THE SNIPER'S PHYSICS: flight, drop, wind, sway, zero, and
// the firing solution. Pure: no DOM, no three.js, Node-tested in
// test/ballistics.mjs. sniper-tab.js owns the scope, the reticle and the rifle.
//
// ONE INTEGRATOR, USED FOR EVERYTHING. The bullet that flies, the drop the
// HUD prints, the hold the reticle marks and the angle the zero solves for
// all come out of `step`. This is the project's standing rule — values that
// must agree with each other are DERIVED from one source, never computed
// twice — and it matters more here than anywhere else it has come up: a
// sniper mechanic is a promise that the number on the screen is the number
// the bullet obeys. Two implementations of "where does it land" is a scope
// that lies, and a scope that lies is not difficult, it is broken.
//
// Coordinates: the shooter is at the origin looking down +Z, +Y is up, +X is
// right. Metres and seconds throughout.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';

export const BALLISTICS_TUNE = {
  muzzleVel: 700,     // m/s
  gravity: 9.81,      // m/s² — a knob, because this is not Earth
  drag: 0.0009,       // per metre of travel, velocity-proportional. Small,
                      // but it is what makes the far shots disproportionately
                      // hard rather than merely further
  zero: 400,          // m — where the scope's line of sight meets the arc
  // ALIEN WINDS (the brief). Strong enough to be the dominant correction at
  // distance, and gusting, so a shot held too long is a different shot.
  wind: 12,           // m/s mean
  windDir: 90,        // degrees; 90 = full value from the left
  gust: 0.45,         // ±fraction of the mean, breathing over gustPeriod
  gustPeriod: 7.0,    // s
  // THE SWAY. Two circles at incommensurate rates, so the reticle never
  // repeats a path the player can learn — plus a slow drift, because a rifle
  // that wobbles around a fixed centre is a rifle you can average out.
  swayFast: 0.55,     // milliradians
  swaySlow: 1.30,
  swayRateFast: 1.9,  // rad/s
  swayRateSlow: 0.61,
  hold: 0.18,         // sway multiplier while the breath is held
  holdSecs: 6.0,      // ...for this long
  holdRecover: 9.0,   // and this long to get it back
  // --- the pop-up plate ---------------------------------------------------
  // A hit knocks the plate down and another comes up NEARBY but not in the
  // same place, which is the whole exercise: the hold you just dialled is
  // wrong again, by a little, and you have to read the new range rather than
  // repeat the last answer. Small enough that it is a correction and not a
  // new problem; large enough that repeating the last answer misses.
  plateStep: 55,      // m — the most the range may change
  plateMin: 12,       // ...and the least, so it always MOVES
  plateSpread: 9,     // mrad — how far it may shift across the field
};

// The integrator's own settings, NOT player knobs — which is why they are
// constants rather than tune fields: a value in the tune with no knob is a
// value the knob table cannot check, and `knobProblems` says so.
export const STEP = 0.004;    // s per tick
export const MAX_T = 6.0;     // s before a round is written off

export const BALLISTICS_KNOBS = [
  { key: 'muzzleVel', label: 'muzzle velocity (m/s)', group: 'round', min: 120, max: 1400, step: 10 },
  { key: 'gravity', label: 'gravity (m/s²)', group: 'round', min: 0, max: 30, step: 0.1 },
  { key: 'drag', label: 'drag', group: 'round', min: 0, max: 0.01, step: 0.0001 },
  { key: 'zero', label: 'zeroed at (m)', group: 'scope', min: 50, max: 1500, step: 10 },
  { key: 'wind', label: 'wind (m/s)', group: 'wind', min: 0, max: 40, step: 0.5 },
  { key: 'windDir', label: 'wind from (deg)', group: 'wind', min: 0, max: 359, step: 1 },
  { key: 'gust', label: 'gust (±)', group: 'wind', min: 0, max: 1.5, step: 0.05 },
  { key: 'gustPeriod', label: 'gust period (s)', group: 'wind', min: 1, max: 30, step: 0.5 },
  { key: 'swayFast', label: 'sway fast (mrad)', group: 'sway', min: 0, max: 6, step: 0.05 },
  { key: 'swaySlow', label: 'sway slow (mrad)', group: 'sway', min: 0, max: 8, step: 0.05 },
  { key: 'swayRateFast', label: 'sway rate fast', group: 'sway', min: 0.1, max: 8, step: 0.05 },
  { key: 'swayRateSlow', label: 'sway rate slow', group: 'sway', min: 0.05, max: 4, step: 0.01 },
  { key: 'hold', label: 'held-breath sway', group: 'sway', min: 0, max: 1, step: 0.02 },
  { key: 'holdSecs', label: 'breath (s)', group: 'sway', min: 1, max: 20, step: 0.5 },
  { key: 'holdRecover', label: 'recover (s)', group: 'sway', min: 1, max: 30, step: 0.5 },
  { key: 'plateStep', label: 'plate moves up to (m)', group: 'plate', min: 0, max: 400, step: 5 },
  { key: 'plateMin', label: '...and at least (m)', group: 'plate', min: 0, max: 200, step: 1 },
  { key: 'plateSpread', label: 'plate shifts (mrad)', group: 'plate', min: 0, max: 40, step: 0.5 },
];

export const makeBallisticsParams = (src = BALLISTICS_TUNE) => makeParams(BALLISTICS_KNOBS, src);
export const clampBallisticsParams = (p, src) => clampParams(BALLISTICS_KNOBS, p, src);
export const formatBallisticsTune = (p) => formatKnobs('BALLISTICS_TUNE', BALLISTICS_KNOBS, p);
export const ballisticsKnobProblems = () => knobProblems(BALLISTICS_KNOBS, BALLISTICS_TUNE);

export const MRAD = 1000;   // milliradians per radian, for the reticle
export const toMrad = (metres, range) => (range > 0 ? (metres / range) * MRAD : 0);
export const fromMrad = (mrad, range) => (mrad / MRAD) * range;

// The wind vector at time t: mean plus a gust that breathes. `windDir` is the
// bearing the wind comes FROM, so a 90° wind pushes the round to the right.
export function windAt(t, tune = BALLISTICS_TUNE) {
  const g = 1 + tune.gust * Math.sin((t / Math.max(0.01, tune.gustPeriod)) * Math.PI * 2);
  const s = tune.wind * g;
  const a = (tune.windDir * Math.PI) / 180;
  return [Math.sin(a) * s, 0, -Math.cos(a) * s];
}

// ONE STEP of the round. Wind acts on the round's velocity RELATIVE to the
// air, which is why a tail wind barely matters and a cross wind is the whole
// correction: the drag term is what couples them, so a drag of zero gives a
// wind of zero effect, correctly.
export function step(s, dt, tune = BALLISTICS_TUNE, w = null) {
  const air = w || windAt(s.t, tune);
  const rvx = s.v[0] - air[0], rvy = s.v[1] - air[1], rvz = s.v[2] - air[2];
  const rel = Math.hypot(rvx, rvy, rvz);
  const k = tune.drag * rel;
  s.v[0] += (-k * rvx) * dt;
  s.v[1] += (-k * rvy - tune.gravity) * dt;
  s.v[2] += (-k * rvz) * dt;
  s.p[0] += s.v[0] * dt;
  s.p[1] += s.v[1] * dt;
  s.p[2] += s.v[2] * dt;
  s.t += dt;
  return s;
}

// A round leaving at `elev` (radians above the sight line) and `az` (radians
// right of it). `frozenWind` pins the gust for a whole flight, which is what
// a real shot experiences — the gust at the moment of firing, not a new one
// each tick.
export function launch(elev, az, tune = BALLISTICS_TUNE, t0 = 0) {
  const v = tune.muzzleVel;
  return {
    p: [0, 0, 0],
    v: [Math.sin(az) * Math.cos(elev) * v, Math.sin(elev) * v, Math.cos(az) * Math.cos(elev) * v],
    t: 0,
    wind: windAt(t0, tune),
  };
}

// Fly it to a given DOWNRANGE distance and report where it is when it gets
// there. `drop` is negative when the round is below the sight line.
export function flyTo(range, elev, az = 0, tune = BALLISTICS_TUNE, t0 = 0) {
  const s = launch(elev, az, tune, t0);
  let last = { ...s, p: s.p.slice(), v: s.v.slice() };
  while (s.p[2] < range && s.t < (tune.maxTime ?? MAX_T)) {
    last = { p: s.p.slice(), v: s.v.slice(), t: s.t };
    step(s, (tune.step ?? STEP), tune, s.wind);
  }
  if (s.t >= (tune.maxTime ?? MAX_T)) return { drop: NaN, drift: NaN, time: s.t, reached: false };
  // linear interpolation onto the exact plane, so the answer does not
  // quantise to the integrator's step
  const span = s.p[2] - last.p[2];
  const f = span > 1e-9 ? (range - last.p[2]) / span : 0;
  return {
    drop: last.p[1] + (s.p[1] - last.p[1]) * f,
    drift: last.p[0] + (s.p[0] - last.p[0]) * f,
    time: last.t + (s.t - last.t) * f,
    reached: true,
  };
}

// THE ZERO: the launch angle at which the round crosses the sight line at
// `range`. Bisection on the same integrator the bullet uses — so the rifle is
// zeroed against its own physics rather than against a formula that agrees
// with them only while the drag is nought.
export function zeroAngle(range, tune = BALLISTICS_TUNE, loft = false) {
  // a lobbed weapon has no meaningful "zero" in the flat sense — its sight
  // line is the high arc, so it is solved on that branch
  if (loft) { const a = launchAngleFor(range, tune, true); return Number.isFinite(a) ? a : 0; }
  let lo = 0, hi = 0.15;   // radians; 0.15 is ~8.6°, far past any sane zero
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = flyTo(range, mid, 0, tune, 0);
    if (!r.reached || r.drop < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// THE FIRING SOLUTION, for a rifle zeroed at `tune.zero`: how far ABOVE the
// target the reticle must sit, and how far INTO the wind, both in
// milliradians. This is what a chip prints, and what a good shot works out.
export function solution(range, tune = BALLISTICS_TUNE, t0 = 0, w = null) {
  // A HITSCAN WEAPON HAS NO SOLUTION TO PRINT. It arrives where it is
  // pointed, so the hold is zero and the flight is nothing — and saying so is
  // better than printing a drop the round will not take.
  // ...and NEITHER HAS A HOMING ROUND. It goes where the seeker takes it,
  // not where the barrel pointed, so a printed hold would be a lie about a
  // weapon whose whole promise is that there is nothing to hold.
  if (w && (w.hitscan || w.homing)) {
    return { drop: 0, drift: 0, time: 0, holdUp: 0, holdSide: 0, reached: true };
  }
  if (w && w.loft) {
    // a mortar is aimed on its own arc, not held over a flat zero: the
    // "hold" is the whole launch angle, in mrad — and it must be the angle
    // for the gust the round will ACTUALLY fly through. The memoised solve
    // is done at t0=0; a 25-second flight launched a second later lands ten
    // metres low, so the coarse answer is only a bracket to refine inside.
    let a = refineAngle(range, tune, t0);
    if (!Number.isFinite(a)) return { drop: NaN, drift: NaN, holdUp: NaN, holdSide: NaN, time: NaN, reached: false };
    // A HUNDRED AND SEVENTY MILLIRADIANS IS NOT A SMALL ANGLE, and the two
    // corrections are not independent: swinging the barrel ten degrees off
    // axis lengthens the path to the target's plane, so an elevation solved
    // straight ahead then falls seventy metres short. Solve them TOGETHER —
    // correct the drift, re-solve the arc for that bearing, repeat — rather
    // than correcting one and hoping the other still holds.
    let az = 0, r3 = flyTo(range, a, 0, tune, t0);
    for (let i = 0; i < 2 && r3.reached; i++) {
      az += -r3.drift / range;
      a = refineAngle(range, tune, t0, az);
      if (!Number.isFinite(a)) break;
      r3 = flyTo(range, a, az, tune, t0);
    }
    if (!Number.isFinite(a)) return { drop: NaN, drift: NaN, holdUp: NaN, holdSide: NaN, time: NaN, reached: false };
    return { drop: r3.drop, drift: r3.drift, time: r3.time, reached: r3.reached,
      holdUp: a * MRAD, holdSide: az * MRAD };
  }
  const z = zeroAngle(tune.zero, tune);
  const r = flyTo(range, z, 0, tune, t0);
  if (!r.reached) return { drop: NaN, drift: NaN, holdUp: NaN, holdSide: NaN, time: NaN, reached: false };
  return {
    drop: r.drop, drift: r.drift, time: r.time, reached: true,
    // hold UP by the drop and INTO the drift — the signs are the corrections,
    // not the errors, because that is what a shooter reads off a reticle
    holdUp: toMrad(-r.drop, range),
    holdSide: toMrad(-r.drift, range),
  };
}

// --- the weapons ----------------------------------------------------------
// Four ways to put a round downrange, and each one stresses a different part
// of the physics — which is the reason to have four rather than one with a
// velocity slider:
//
//   LANCER   the baseline. Drop and wind both matter; the whole exercise.
//   LASER    hitscan. No drop, no wind, no lead — so ONLY the sway is left,
//            and it is the weapon that says what your hands are doing.
//   MORTAR   slow and lobbed. The high arc, a flight you wait out, and a
//            splash radius that forgives the lateral error the wind adds.
//   RAILGUN  very fast and very flat, and it has to be CHARGED — the cost is
//            not the drop, it is the second and a half you stand still.
export const WEAPONS = {
  // `maxTime` and `step` are the INTEGRATOR's allowance, per weapon, and the
  // mortar is why they are here: a lobbed round at 79 degrees is in the air
  // for half a minute, so a six-second allowance never reaches the target and
  // the high branch simply does not exist as far as the solver is concerned.
  // A slow round also does not need a 4 ms tick to be accurate.
  lancer: { id: 'lancer', label: 'Lancer', muzzleVel: 700, gravity: 9.81, drag: 0.0009,
    cooldown: 0.0, splash: 0, charge: 0, hitscan: false, loft: false, sound: 'tank_main',
    maxTime: 6, step: 0.004 },
  laser: { id: 'laser', label: 'Laser', muzzleVel: 700, gravity: 9.81, drag: 0.0009,
    cooldown: 0.35, splash: 0, charge: 0, hitscan: true, loft: false, sound: 'tank_beam',
    maxTime: 6, step: 0.004 },
  mortar: { id: 'mortar', label: 'Mortar', muzzleVel: 150, gravity: 9.81, drag: 0.0004,
    cooldown: 2.2, splash: 14, charge: 0, hitscan: false, loft: true, sound: 'blast_fire',
    maxTime: 60, step: 0.02 },
  railgun: { id: 'railgun', label: 'Rail gun', muzzleVel: 2400, gravity: 9.81, drag: 0.0002,
    cooldown: 1.2, splash: 0, charge: 1.6, hitscan: false, loft: false, sound: 'tank_secondary',
    maxTime: 6, step: 0.002 },
};
// THE JAVELIN. Its physics are not here — a homing round is `lockon.js`,
// with its own integrator and its own guidance — but it lives in this table
// because it is a weapon the picker has to offer and the HUD has to name.
// The ballistic fields are what the panel shows and what the shell falls
// back to if the flight ever asks this module a question; the flight does
// not, and `solution()` says so rather than printing a hold for a round
// that ignores it.
WEAPONS.javelin = {
  id: 'javelin', label: 'Javelin', muzzleVel: 40, gravity: 9.81, drag: 0.0016,
  cooldown: 3.2, splash: 6, charge: 0, hitscan: false, loft: false,
  homing: true, lock: true, sound: 'tank_secondary', maxTime: 30, step: 0.008,
};

export const WEAPON_IDS = Object.keys(WEAPONS);

// Fold a weapon's numbers onto a tune. The tune keeps everything the weapon
// does not own — the wind, the sway, the zero, the plate — so switching
// weapons changes the ROUND and nothing else about the range.
export function applyWeapon(tune, id) {
  const w = WEAPONS[id] || WEAPONS.lancer;
  for (const k of ['muzzleVel', 'gravity', 'drag', 'maxTime', 'step']) tune[k] = w[k];
  return w;
}

// EVERY launch angle that puts a round on the sight line at `range`. Scanned
// for sign changes and then bisected, rather than bisected blind: a lobbed
// weapon has TWO answers — the flat one and the high one — and a solver that
// assumes one branch cannot express a mortar at all.
export function solveAngles(range, tune = BALLISTICS_TUNE, hiRad = 1.45, steps = 90) {
  const out = [];
  let prevA = 0, prevD = flyTo(range, 0, 0, tune, 0);
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * hiRad;
    const d = flyTo(range, a, 0, tune, 0);
    const pv = prevD.reached ? prevD.drop : -1e9;
    const cv = d.reached ? d.drop : -1e9;
    if (prevD.reached && d.reached && ((pv <= 0 && cv >= 0) || (pv >= 0 && cv <= 0))) {
      let lo = prevA, hi = a;
      for (let k = 0; k < 32; k++) {
        const mid = (lo + hi) / 2;
        const r = flyTo(range, mid, 0, tune, 0);
        const v = r.reached ? r.drop : -1e9;
        if ((pv <= 0) === (v <= 0)) lo = mid; else hi = mid;
      }
      out.push((lo + hi) / 2);
    }
    prevA = a; prevD = d;
  }
  return out;
}

// The one this weapon would use: the flat answer, or the high one if it lobs.
// MEMOISED, because the HUD asks for it several times a second and a lofted
// solve is ninety flights of a round that stays up for half a minute. The
// function is deterministic in its inputs, so a cache keyed on them is the
// same function with the work done once — and the key rounds the range to two
// metres, which is far finer than any hold a shooter can dial.
const angleMemo = new Map();
export function launchAngleFor(range, tune = BALLISTICS_TUNE, loft = false) {
  const key = `${loft ? 1 : 0}|${tune.muzzleVel}|${tune.gravity}|${tune.drag}|${Math.round(range / 2)}`;
  if (angleMemo.has(key)) return angleMemo.get(key);
  const all = solveAngles(range, tune);
  const a = all.length ? (loft ? all[all.length - 1] : all[0]) : NaN;
  if (angleMemo.size > 800) angleMemo.clear();
  angleMemo.set(key, a);
  return a;
}

// THE LOFTED ANGLE FOR *THIS* MOMENT. `launchAngleFor` is solved at t0=0 and
// memoised on the weapon's physics alone — which is right for a flat round
// that is downrange in a second and a half, and wrong for a mortar whose
// half-minute arc rides a gust that has moved on by the time it lands. Here
// the coarse answer is only a bracket: one bisection on the same integrator,
// with the flight's own launch time, so the hold the HUD prints is the hold
// that zeroes the drop. Cached on a quarter-second of launch time, which is
// finer than the gust changes and keeps the per-frame cost at nothing.
const refineMemo = new Map();
export function refineAngle(range, tune = BALLISTICS_TUNE, t0 = 0, az = 0) {
  const a0 = launchAngleFor(range, tune, true);
  if (!Number.isFinite(a0)) return a0;
  const key = `${tune.muzzleVel}|${tune.gravity}|${tune.drag}|${tune.wind}|${tune.gust}`
    + `|${Math.round(range / 2)}|${Math.round(t0 * 4)}|${Math.round(az * 500)}`;
  if (refineMemo.has(key)) return refineMemo.get(key);
  const dropAt = (a) => { const r = flyTo(range, a, az, tune, t0); return r.reached ? r.drop : NaN; };
  // on the HIGH branch the round falls further short as the barrel goes up,
  // so drop decreases with angle: bracket outward until the sign flips
  let lo = a0, hi = a0, out = a0;
  for (let w2 = 0.02; w2 <= 0.64; w2 *= 2) {
    lo = a0 - w2; hi = a0 + w2;
    const dl = dropAt(lo), dh = dropAt(hi);
    if (Number.isFinite(dl) && Number.isFinite(dh) && dl >= 0 && dh <= 0) {
      for (let i = 0; i < 26; i++) {
        const mid = (lo + hi) / 2;
        const d = dropAt(mid);
        if (!Number.isFinite(d)) break;
        if (d >= 0) lo = mid; else hi = mid;
      }
      out = (lo + hi) / 2;
      break;
    }
  }
  if (refineMemo.size > 800) refineMemo.clear();
  refineMemo.set(key, out);
  return out;
}

// A round landing within `splash` of a target counts, however wide it was.
// The mortar's whole answer to a crosswind it cannot dial out.
export const splashHits = (miss, radius, splash = 0) => miss <= radius + splash;

// --- the pop-up plate -----------------------------------------------------

// WHERE THE NEXT PLATE COMES UP. Near the last one, never ON it: the range
// moves by at least `plateMin` and at most `plateStep`, and the bearing
// shifts within `plateSpread`. A plate that came back up in the same place
// would let a shooter dial once and stop reading, which is the opposite of
// what a calibration string is for.
//
// `bounds` keeps it on the range that was set up — a plate that wandered to
// 2 km because the dice said so is not a re-calibration, it is a new lab.
export function nextPlate(prev, rng, tune = BALLISTICS_TUNE, bounds = null) {
  const lo = bounds ? bounds[0] : 100, hi = bounds ? bounds[1] : 1600;
  const span = Math.max(0, tune.plateStep - tune.plateMin);
  const mag = tune.plateMin + rng() * span;
  // a direction that is not zero, and that stays inside the range's bounds:
  // pushed off the near or far end it simply comes back the other way
  let dir = rng() < 0.5 ? -1 : 1;
  let range = prev.range + dir * mag;
  if (range < lo || range > hi) { dir = -dir; range = prev.range + dir * mag; }
  range = Math.max(lo, Math.min(hi, range));
  const bearing = prev.bearing + (rng() * 2 - 1) * (tune.plateSpread / MRAD);
  return { range, bearing };
}

// --- the shooter ----------------------------------------------------------

export function makeShooter() {
  return { breath: 1, holding: false, shots: 0, hits: 0, best: Infinity };
}

// The breath: holding spends it, letting go recovers it, and it runs out.
// Returns true while the hold is actually steadying anything.
export function stepBreath(sh, dt, want, tune = BALLISTICS_TUNE) {
  const can = want && sh.breath > 0;
  sh.holding = can;
  if (can) { sh.breath = Math.max(0, sh.breath - dt / Math.max(0.01, tune.holdSecs)); return true; }
  // RECOVERY NEEDS A RELEASE. Leaning on the button once the breath is gone
  // must not quietly refill it — otherwise the cost of holding is a stutter
  // in the reticle rather than a decision about when to take the shot, and
  // the honest play becomes "hold it down the whole time".
  if (!want) sh.breath = Math.min(1, sh.breath + dt / Math.max(0.01, tune.holdRecover));
  return false;
}

// WHERE THE RIFLE IS POINTING, relative to where the shooter is aiming it:
// two circles at incommensurate rates so the path never repeats inside a
// shot, in milliradians. A held breath shrinks it but never stops it.
export function sway(t, sh, tune = BALLISTICS_TUNE) {
  const k = sh && sh.holding ? tune.hold : 1;
  const a = t * tune.swayRateFast, b = t * tune.swayRateSlow;
  return [
    (Math.sin(a) * tune.swayFast + Math.cos(b * 1.31) * tune.swaySlow) * k,
    (Math.cos(a * 1.17) * tune.swayFast + Math.sin(b) * tune.swaySlow) * k,
  ];
}

// The rangefinder, as a chip prints it — and as the eye estimates it: a
// target of known height subtending `mrad` in the scope is this far away.
export const rangeFromMrad = (targetHeight, mrad) =>
  (mrad > 1e-6 ? (targetHeight / mrad) * MRAD : Infinity);

// Did it hit? `miss` is the distance from the target's centre in metres.
export const hitsAt = (miss, radius) => miss <= radius;
