// Pulling out of the ground as a pure rule (owner, 2026-10-10: "both the smaller Reeds and the larger boss emerge as if from an elevator, it looks unnatural. let's
// have them emerge by stretching their limbs, as if they were pulling themselves out from the depth"). A creature waits in the sinkhole below the surface; its arms
// reach up and out first, one after another, over the hole's lip and grip the ground there; then the body hauls itself up in heaves while the tips stay planted; then
// the arms let go and it walks. The lab drives the kit's arm tips toward the points this rule gives (src/labs/boss/pull-out.js) and lifts the drawing by `lift`.
//
// `emergence(age, E)`: the phase by the age on the lab's clock (negative before its turn): 'below' (waiting, unstepped), 'tremor' (`lead` s, stepped, still), 'reach'
// (`reach` s: the arms go up and out), 'haul' (`haul` s: the body comes up, `lift` 0..1 in `heaves` surges of `surge` depth, never going back), 'release' (`release`
// s: the arms let go) and 'up'. `hold` is the arms' grip weight (in over the first `ramp` of the reach, out over the release); `k` the phase's own progress.
// `armReach(k, i, n, E)`: arm `i` of `n` at the reach's progress `k`, the arms `stagger` of the reach apart: `up` (0..1 of the depth climbed), `out` (0..1 of the way
// from its rest radius to its grip) and `over` (the arc above the lip, a share of the body's height). `rimReach(from, dir, hole, radius)`: how far along the unit
// direction `dir` from `from` the circle (`hole`, `radius`) lies ([x, z], any one unit), null when it is not ahead. `gripRadius(rim, rest, E)`: an arm's grip radius,
// `lip` times the rim's, at least just past its rest radius and at most `stretch` times it. Units are the caller's; times are seconds.

const smooth = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };

// the haul's lift at its progress k: eased, in `heaves` surges (a dip of the speed between them `surge` deep, 0 none), 0 at 0, 1 at 1, never going back
export function haulLift(k, E) {
  const s = smooth(k), m = Math.max(1, Math.round(E.heaves || 1)), a = Math.max(0, Math.min(1, E.surge || 0));
  return m > 1 && a > 0 ? s - a * Math.sin(2 * Math.PI * m * s) / (2 * Math.PI * m) : s;
}

export function emergence(age, E) {
  if (!(age >= 0)) return { phase: 'below', k: 0, lift: 0, hold: 0 };
  if (age < E.lead) return { phase: 'tremor', k: age / E.lead, lift: 0, hold: 0 };
  let a = age - E.lead;
  if (a < E.reach) { const k = a / E.reach; return { phase: 'reach', k, lift: 0, hold: smooth(k / E.ramp) }; }
  a -= E.reach;
  if (a < E.haul) { const k = a / E.haul; return { phase: 'haul', k, lift: haulLift(k, E), hold: 1 }; }
  a -= E.haul;
  if (a < E.release) { const k = a / E.release; return { phase: 'release', k, lift: 1, hold: 1 - smooth(k) }; }
  return { phase: 'up', k: 1, lift: 1, hold: 0 };
}

// arm `i` of `n` at the reach's progress `k` (1 once the reach is over): up first, then out over the lip in an arc, then down onto it
export function armReach(k, i, n, E) {
  const lag = n > 1 ? E.stagger * i / (n - 1) : 0, u = Math.max(0, Math.min(1, (k - lag) / (1 - E.stagger)));
  return { up: smooth(u / 0.55), out: smooth((u - 0.25) / 0.6), over: E.over * Math.sin(Math.PI * u) };
}

export function rimReach(from, dir, hole, radius) {
  const fx = from[0] - hole[0], fz = from[1] - hole[1], b = fx * dir[0] + fz * dir[1], c = fx * fx + fz * fz - radius * radius, q = b * b - c;
  if (!(q >= 0)) return null;
  const t = -b + Math.sqrt(q);
  return t > 0 ? t : null;
}

export function gripRadius(rim, rest, E) {
  const lo = rest * 1.05, hi = rest * E.stretch;
  return rim === null ? lo : Math.max(lo, Math.min(hi, rim * E.lip));
}
