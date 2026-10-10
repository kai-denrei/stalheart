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

// the pieces an impact at `at` breaks: indices of `centres` ([[x, z]] local metres) still `whole` (a predicate on the index) within `radius`, nearest first, at most `cap` (0: all)
export function blastBreaks(centres, whole, at, radius, cap) {
  const hit = [];
  for (let i = 0; i < centres.length; i++) {
    if (!whole(i)) continue;
    const d = Math.hypot(centres[i][0] - at[0], centres[i][1] - at[1]);
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
