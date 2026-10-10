// A dead Reed's carcass as a pure rule (owner, 2026-10-10: "the low-poly reeds carcasses are too low poly, they look blocky. can we have them more simple
// renditions of tentacles? barebone tentacles, and they disintegrate with further explosions or time"). The lab (src/labs/boss/carcass.js) draws each limb as a
// tapered tube in `segments` pieces along a curve through the limb's node rings, with a core blob where the limbs join; these rules say which nodes make which
// ring, when each piece crumbles with time, which pieces an impact breaks and how a broken piece flies.
//
// `limbRings` sorts a body's rest nodes as the kit's own limb rule does (src/fx/nih-dairia/limb-separation.js: the torso within `torso` of the axis, a limb's
// nodes `root` or more out, its sector the nearest of `count` directions round the axis), then each limb's nodes into `bins` equal bands of their rest distance
// from the axis (root to tip; an empty band is left out). `crumbleTimes`: the tips go first, every limb's pieces from its tip inward at seeded times between
// `from` and `to` of the decay, never one before the piece beyond it; the core goes with the carcass. `blastBreaks`: the pieces still whole whose centre is within
// the impact's radius on the plane, nearest first, at most `cap` (0: every one). `flingOf` / `flingPose`: a broken piece thrown outward and up from the impact,
// falling and tumbling, whole a while and then shrinking to nothing by `fling.time` s. `carcassLook`: the whole carcass by its age, darkened, sunk and cooled over `decay` s, then gone.
// THE BOSS'S CARCASS (owner, 2026-10-10: "after the boss is dead, the user should still be able to shoot at its carcass, what would it take to create 'stages of
// destruction' for the dead boss? limbs getting cut, parts disappearing in explosion, etc."; option A: the Reeds' carcass scaled up, with a severing rule and
// multi-hit stages; the lab src/labs/boss/remains.js). `carcassDamage`: what a round does to it (`bossCarcass.damage[kind]`: a radius, a cap and hit points a
// target, 0 the destroying MK-9). `blastBreaks` with `reach` (each target's own radius on the plane: the core is metres wide) gives the targets a round reaches.
// `severance`: a limb's segments root to tip, some breaking now: every segment still whole beyond the first break is cut off, in runs (a whole segment between two
// breaks is its own piece). `hopOf` / `hopPose`: a severed piece (or a chunk of the cracked core) hops and slides away from the cut and settles where it lands,
// turned about the up axis and rocked on the way. `coreChunks`: the cracked core's chunks (3-5, seeded). `severedCrumble`: a severed piece's segments crumble
// tip first across `crumble.span` s. `charOf`: a hurt target's share toward char. `carcassStage` / `stageLabel`: the carcass's stage, INTACT, LIMBS SEVERED
// n/N, CORE CRACKED, SCORCHED, never going back.
// Local metres on the frame's plane [x, z] for the impacts and the centres; the rest positions are the kit's native units. Imports nothing.

// a small seeded generator (mulberry32): a function giving numbers in [0, 1)
export function seeded(seed) {
  let a = (Math.round(seed * 2654435761) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a body's rest nodes (flat [x, y, z, ...]) as { torso: [ids], limbs: [[[ids] a ring, root to tip] a limb] } for `count` limbs; `chain` { torso, root, bins }
export function limbRings(rest, count, chain) {
  const n = rest.length / 3, torso = [], limbs = Array.from({ length: count }, () => []), step = 2 * Math.PI / count;
  const far = new Float64Array(count);
  for (let i = 0; i < n; i++) {
    const x = rest[i * 3], z = rest[i * 3 + 2], r = Math.hypot(x, z);
    if (r < chain.torso) { torso.push(i); continue; }
    if (r < chain.root) continue;
    const limb = (Math.round(Math.atan2(z, x) / step) % count + count) % count;
    limbs[limb].push([i, r]);
    if (r > far[limb]) far[limb] = r;
  }
  return {
    torso,
    limbs: limbs.map((nodes, l) => {
      const width = (far[l] - chain.root) / chain.bins || 1, rings = Array.from({ length: chain.bins }, () => []);
      for (const [i, r] of nodes) rings[Math.min(chain.bins - 1, Math.floor((r - chain.root) / width))].push(i);
      return rings.filter((ring) => ring.length);
    }),
  };
}

// when each piece crumbles, seconds after the carcass is laid down: `pieces` [{ limb, j }] (j 0 at the root .. K - 1 at the tip, K `segments`), the core's limb -1
// (never: it goes with the carcass). Each limb's pieces from its tip inward over [`crumble.from`, `crumble.to`] of the decay, the tip first, each one a slot of
// that span with a seeded share `crumble.jitter` of it, so a piece never goes before the one beyond it; each limb its own seeded lead of up to one slot
export function crumbleTimes(pieces, C, seed) {
  const K = C.chain.segments, R = C.crumble, span = (R.to - R.from) * C.decay, slot = span / K, rand = seeded(seed), lead = new Map();
  return pieces.map(({ limb, j }) => {
    if (limb < 0) return Infinity;
    if (!lead.has(limb)) lead.set(limb, rand() * slot * (1 - R.jitter));
    const from = K - 1 - j;   // 0 for the tip
    return R.from * C.decay + from * slot + lead.get(limb) + rand() * slot * R.jitter;
  });
}

// the impact's break for a plan ({ kind, radius }): { radius, cap } from `blast[kind]` (radius 0: the plan's own), null for a kind that breaks nothing
export function blastFor(plan, blast) {
  const b = blast[plan.kind];
  if (!b) return null;
  return { radius: b.radius > 0 ? b.radius : plan.radius, cap: b.cap };
}

// the pieces an impact at `at` breaks: indices of `centres` ([[x, z]] local metres) still `whole` (a predicate on the index) within `radius`, nearest first, at most
// `cap` (0: all); `reach` (optional, metres an index) the target's own radius, so a round on a wide one's edge reaches it
export function blastBreaks(centres, whole, at, radius, cap, reach = null) {
  const hit = [];
  for (let i = 0; i < centres.length; i++) {
    if (!whole(i)) continue;
    const d = Math.hypot(centres[i][0] - at[0], centres[i][1] - at[1]) - (reach ? reach[i] : 0);
    if (d <= radius) hit.push([i, d]);
  }
  hit.sort((a, b) => a[1] - b[1]);
  return (cap > 0 ? hit.slice(0, cap) : hit).map((h) => h[0]);
}

// a broken piece's flight: { v [x, y, z] local m/s (y up), axis (unit), spin rad/s }, thrown away from the impact along the plane (a seeded bearing when it is on
// it) at `fling.speed` (0.6..1 of it, the nearer the faster) and up at `fling.up` (0.7..1.3 of it); `radius` the impact's
export function flingOf(centre, at, radius, F, seed) {
  const rand = seeded(seed), dx = centre[0] - at[0], dz = centre[1] - at[1], d = Math.hypot(dx, dz);
  const a = d > 1e-6 ? Math.atan2(dz, dx) : rand() * 2 * Math.PI, near = 1 - Math.min(1, d / (radius || 1));
  const speed = F.speed * (0.6 + 0.4 * near) * (0.85 + 0.3 * rand()), up = F.up * (0.7 + 0.6 * rand());
  const ax = rand() - 0.5, ay = rand() - 0.5, az = rand() - 0.5, l = Math.hypot(ax, ay, az) || 1;
  return { v: [Math.cos(a) * speed, up, Math.sin(a) * speed], axis: [ax / l, ay / l, az / l], spin: F.spin * (0.5 + rand()) };
}

// a flying piece `t` s after it broke: { offset [x, y, z] local metres, angle (about its axis), scale (1 .. 0), done }: ballistic under `fling.gravity`, whole for
// the first `fling.whole` of its flight (so the throw reads), then shrinking to nothing (smoothstepped) by `fling.time`
export function flingPose(f, t, F) {
  const k = Math.min(1, Math.max(0, (t / F.time - F.whole) / (1 - F.whole)));
  return { offset: [f.v[0] * t, f.v[1] * t - 0.5 * F.gravity * t * t, f.v[2] * t], angle: f.spin * t, scale: 1 - k * k * (3 - 2 * k), done: t >= F.time };
}

// a crumbling piece `t` s after its time came: { scale (1 .. 0), drop (metres it has sagged), done } over `crumble.time` s
export function crumblePose(t, R) {
  const k = Math.min(1, Math.max(0, t / R.time));
  return { scale: 1 - k, drop: R.drop * k * k, done: t >= R.time };
}

// the whole carcass `age` seconds after it was laid down: `k` the decay's share (0..1), `dark` the share it is darkened by, `sink` the share of its height it has
// sunk, `heat` its warmth in the thermal (1 fresh, 0 cold once `cold` of the decay has gone, squared), `gone` at the decay's end
export function carcassLook(age, C) {
  const k = Math.min(1, Math.max(0, age / C.decay)), c = Math.max(0, 1 - k / C.cold);
  return { k, dark: C.dark * k, sink: C.sink * k, heat: c * c, gone: age >= C.decay };
}

// THE BOSS'S CARCASS -------------------------------------------------------------------------------------------------------------------------------------------

// a round's harm to the boss's carcass for a plan ({ kind, radius }): { radius (0 in the table: the plan's own), cap, damage (hit points a target; Infinity for
// the table's 0, the MK-9's: it destroys) }, null for a kind that does nothing to it
export function carcassDamage(plan, table) {
  const d = table[plan.kind];
  if (!d) return null;
  return { radius: d.radius > 0 ? d.radius : plan.radius, cap: d.cap, damage: d.damage > 0 ? d.damage : Infinity };
}

// a limb's segments (`states`, root to tip: 'whole' is still on the body) with the indices in `breaking` breaking now: the runs of segments still whole beyond the
// first one breaking (attached segments only: a severed or a gone one is no longer the limb's), each run its own piece, root side first; [] when nothing is cut off
export function severance(states, breaking) {
  let first = Infinity;
  for (const j of breaking) if (states[j] === 'whole' && j < first) first = j;
  const runs = [];
  let run = null;
  for (let j = first + 1; j < states.length; j++) {
    if (states[j] === 'whole' && !breaking.has(j)) { (run ??= []).push(j); continue; }
    if (run) runs.push(run);
    run = null;
  }
  if (run) runs.push(run);
  return runs;
}

// a piece's hop away from `cut` (the plane point it came off; on its centre: a seeded bearing): { dir [x, z] unit, dist, up, drop, yaw, tilt, time } from the
// hop's numbers H ({ distance, up, time, yaw, tilt }: each seeded 0.75..1.25 of itself, the yaw either way); `drop` metres it ends lower (a chunk falling to the ground)
export function hopOf(cut, centre, H, seed, drop = 0) {
  const rand = seeded(seed), dx = centre[0] - cut[0], dz = centre[1] - cut[1], d = Math.hypot(dx, dz);
  const a = d > 1e-6 ? Math.atan2(dz, dx) + (rand() - 0.5) * 0.5 : rand() * 2 * Math.PI, k = () => 0.75 + 0.5 * rand();
  return { dir: [Math.cos(a), Math.sin(a)], dist: H.distance * k(), up: H.up * k(), drop, yaw: H.yaw * k() * (rand() < 0.5 ? -1 : 1), tilt: H.tilt * k(), time: H.time };
}

// the piece `t` s into its hop: { offset [x, y, z] metres (y up), yaw (about the up axis, kept), tilt (rocked forward about the axis across its way, back to 0 on
// landing), done }: it slides out fast and slows to rest, arcs up and comes down `drop` lower
export function hopPose(h, t) {
  const k = Math.min(1, Math.max(0, t / h.time)), out = 1 - (1 - k) * (1 - k);
  return { offset: [h.dir[0] * h.dist * out, h.up * 4 * k * (1 - k) + h.drop * k * k, h.dir[1] * h.dist * out], yaw: h.yaw * out, tilt: h.tilt * Math.sin(Math.PI * k), done: t >= h.time };
}

// the cracked core's chunks: [{ angle (their bearing out from the core's centre, radians), lift (share of the core's height they sit at, -0.5..0.5) }], between
// `chunks.min` and `chunks.max` of them, evenly round with a seeded wobble
export function coreChunks(P, seed) {
  const rand = seeded(seed), n = P.min + Math.floor(rand() * (P.max - P.min + 1)), a0 = rand() * 2 * Math.PI;
  return Array.from({ length: n }, (_, i) => ({ angle: a0 + (i + (rand() - 0.5) * 0.6) * 2 * Math.PI / n, lift: (rand() - 0.5) }));
}

// when each segment of a severed piece crumbles, seconds after it was cut: `js` its segments' places on the limb, the tip (the highest) first, slots over
// [`from`, 1] of `span` with a seeded share of a slot each
export function severedCrumble(js, R, seed) {
  const rand = seeded(seed), order = [...js].sort((a, b) => b - a), slot = (1 - R.from) * R.span / order.length;
  const at = new Map(order.map((j, i) => [j, R.from * R.span + (i + 0.2 + 0.6 * rand()) * slot]));
  return js.map((j) => at.get(j));
}

// a target's share toward char: none whole, `top` at its last hit point
export function charOf(hp, max, top) {
  return max > 0 ? top * Math.min(1, Math.max(0, 1 - hp / max)) : top;
}

export const STAGES = Object.freeze(['INTACT', 'LIMBS SEVERED', 'CORE CRACKED', 'SCORCHED']);
// the carcass's stage from `f` { cut (limbs cut somewhere), cracked (the core), standing (targets still on the body: attached segments, the core or its chunks) }:
// SCORCHED once nothing stands, CORE CRACKED once the core has cracked, LIMBS SEVERED once a limb is cut, else INTACT; never before `prev` (an index of STAGES)
export function carcassStage(prev, f) {
  const now = f.standing <= 0 ? 3 : f.cracked ? 2 : f.cut > 0 ? 1 : 0;
  return Math.max(prev, now);
}
// the stage as the bar row reads it: LIMBS SEVERED with the limbs cut of all (`f.cut`, `f.limbs`)
export const stageLabel = (stage, f) => (stage === 1 ? `${STAGES[1]} ${f.cut}/${f.limbs}` : STAGES[stage]);
