// The boss lab's temperament in the bait mode as a pure rule (wave B, 2026-10-09; owner: "chase speed we need basic speed and a measure of sudden
// accelerations once in a while, the threatening look comes from the tentacles lengthening/reaching, and from sudden bursts of speed"). One layer owns
// the creature's live motion settings over time: the BASE is the mode's working motion (the owner's knobs); LUNGES come every `everyMin`..`everyMax`
// seconds (from the start of one to the next), drawn from a seeded sequence, each `forMin`..`forMax` seconds long, at chase speed `lungeSpeed` with the
// arms' reach duration, stretch and spread times `reach`; THE FEAR's flight (src/domain/boss-fear.js `flightNow`) writes through the same layer and wins
// over a lunge (a lunge running when a flight starts ends; one due in a flight is skipped). Both ease in and out over `ease` seconds (a smoothstep on
// a weight that slews at 1 / ease a second) and back to the base. A flight runs at `speed` times the base chase speed with the reach duration and the
// pause between bursts divided by it (the kit only pushes the body in its pull phase: the surges come that much more often) and the erratic motion
// up by its `erratic`. A due lunge waits for `ready` (the lab: the kit's pursuit in its pull, where the speed shows).
// Imports nothing; `tune.temperament` is the numbers, `limits` ({ key: [min, max] }, the kit's panel ranges) is the caller's.

const KEYS = ['speed', 'reachTime', 'pauseTime', 'stretch', 'spread', 'erratic'];
export const TEMPERAMENT_KEYS = Object.freeze(KEYS);

// a small seeded generator (mulberry32) on `s.rng`; each draw is a number in [0, 1)
function draw(s) {
  s.rng = (s.rng + 0x6D2B79F5) >>> 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (s, lo, hi) => lo + (hi - lo) * draw(s);
const smooth = (w) => w * w * (3 - 2 * w);
const toward = (w, goal, step) => (w < goal ? Math.min(goal, w + step) : Math.max(goal, w - step));

// a calm temperament: the first lunge due `everyMin`..`everyMax` seconds in
export function makeTemperament(tune, seed = 1) {
  const T = tune.temperament, s = { rng: Math.imul(seed >>> 0, 0x85EBCA6B) >>> 0, t: 0, next: 0, lunge: null, lunges: 0, wl: 0, wf: 0, fear: null, phase: 'base' };
  s.next = between(s, T.everyMin, T.everyMax);
  return s;
}

// one frame: `flight` the fear's running flight ({ level, speed, erratic } or null), `ready` whether a due lunge may start now. Returns the phase:
// the flight's level, 'lunge', 'easing' (on the way back to the base) or 'base'
export function stepTemperament(s, dt, tune, { flight = null, ready = true } = {}) {
  const T = tune.temperament;
  s.t += dt;
  if (flight) {
    s.fear = { level: flight.level, speed: flight.speed, erratic: flight.erratic };
    if (s.lunge) { s.lunge = null; s.next = s.t + between(s, T.everyMin, T.everyMax); }
    else if (s.t >= s.next) s.next = s.t + between(s, T.everyMin, T.everyMax);   // due in the flight: skipped
  } else if (s.lunge && s.t >= s.lunge.until) s.lunge = null;
  if (!flight && !s.lunge && s.t >= s.next && ready && T.lunges !== false) {
    s.lunge = { since: s.t, until: s.t + between(s, T.forMin, T.forMax) }; s.lunges++;
    s.next = s.t + between(s, T.everyMin, T.everyMax);
  }
  if (T.lunges === false && s.lunge) s.lunge = null;
  const step = dt / Math.max(1e-6, T.ease);
  s.wl = toward(s.wl, s.lunge ? 1 : 0, step);
  s.wf = toward(s.wf, flight ? 1 : 0, step);
  if (s.wf <= 0) s.fear = null;   // eased back: the flight's numbers go
  s.phase = flight ? flight.level : s.lunge ? 'lunge' : s.wl > 0 || s.wf > 0 ? 'easing' : 'base';
  return s.phase;
}

// the live settings now from `base` (the mode's motion): the lunge's blend, then the flight's over it, each clamped to `limits`
export function liveMotion(base, s, tune, limits = {}) {
  const T = tune.temperament, l = smooth(s.wl), f = smooth(s.wf), out = {};
  for (const k of KEYS) out[k] = base[k];
  out.speed += (T.lungeSpeed - base.speed) * l;
  for (const k of ['reachTime', 'stretch', 'spread']) out[k] += base[k] * (T.reach - 1) * l;
  if (s.fear && f > 0) {
    const k = Math.max(1e-6, s.fear.speed);
    out.speed += (base.speed * k - out.speed) * f;
    out.reachTime += (base.reachTime / k - out.reachTime) * f;
    out.pauseTime += (base.pauseTime / k - out.pauseTime) * f;
    out.stretch += (base.stretch - out.stretch) * f;
    out.spread += (base.spread - out.spread) * f;
    out.erratic += s.fear.erratic * f;
  }
  for (const k of KEYS) { const r = limits[k]; if (r) out[k] = Math.min(r[1], Math.max(r[0], out[k])); }
  return out;
}
