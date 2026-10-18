// THE SOFT HUNT (owner, 2026-10-18, round three, note 2: "the weaker units (white and yellows) need to be faster and more aggressive towards a)
// priority 1 the Tank, they flank and surround and try to attack it although they cannot, or b) the gates, whichever is closer"; SOFT_HUNT in
// src/content/soft-hunt.js, the walk src/fx/soft-hunt.js). Pure: which goal a soft body takes, where its spot on the ring round the hull is, when it
// decides again, the jab's reach and the step toward a moving spot. Ring geometry is in the hull's tangent plane, in cells ([x, y] from its centre).
//   isSoftHunter(tier, tune)                     a tier that hunts (tune.tiers)
//   huntGoal({ hullDist, gateDist }, tune)       'hull' while the hull's walking distance is at most the gate's + tune.bias, else 'gate'; 'gate'
//                                                when the hull cannot be reached (hullDist < 0 or not a number); a gate unknown (< 0) leaves the hull
//   huntPace(tier, tune, goal)                   the walk's multiplier: tune.pace[tier] toward the hull, 1 toward the gate
//   firstDecision(id, now, every)                a new body's first decision, staggered over one `every` by its id (the golden ratio's spread)
//   huntDue(hunt, now)                           its decision is due
//   ringBearing(id, slots)                       its own bearing: its slot of the circle (id mod slots), and each later round of ids (id / slots)
//                                                a share of a slot further on (the golden ratio's), so a crowd fills the circle, not eight files
//   ringLayer(id, slots, tune)                   its ring's radius: tune.ring, one tune.layer further out for each later round, tune.layers deep
//   ringPoint(bearing, radius)                   [x, y] cells from the hull's centre
//   findRingSpot({ bearing, radius, open, tune }) the nearest open spot to its own: its bearing, then half a slot either side up to tune.search,
//                                                at the full ring and then at tune.minRing of it; null when none is open (it stands where it is)
//   jabAt(t, phase, ring, jab)                   { radius, deep }: the ring's radius, or on the jab the lunge in to jab.depth and back (a sine over
//                                                jab.seconds, every jab.every s, offset by phase 0..1); deep in the jab's second quarter
//   jabPeaked(t0, t1, phase, jab)                the jab's deepest moment fell in (t0, t1]
//   stepToward(at, to, max)                      [x, y] moved toward `to` by at most `max`
//   stepRound(at, to, max)                       [x, y] moved toward `to` by at most `max` in polar terms round the hull (the radius and the bearing
//                                                closed together, the bearing the short way round): a body whose spot is on the far side walks round
//                                                the hull to it, a flank, never through the hull's centre
export const isSoftHunter = (tier, tune) => !!tier && !!tune?.tiers?.includes(tier);

export function huntGoal({ hullDist, gateDist }, tune) {
  if (!(hullDist >= 0)) return 'gate';
  if (!(gateDist >= 0)) return 'hull';
  return hullDist <= gateDist + (tune?.bias ?? 0) ? 'hull' : 'gate';
}

export const huntPace = (tier, tune, goal) => (goal === 'hull' ? tune?.pace?.[tier] ?? 1 : 1);

const PHI = 0.6180339887498949;
export const firstDecision = (id, now, every) => now + (((id * PHI) % 1) + 1) % 1 * every;
export const huntDue = (hunt, now) => !hunt || now >= hunt.at;

export const ringBearing = (id, slots) => { const n = Math.max(1, slots), k = ((id % n) + n) % n, round = Math.floor(Math.max(0, id) / n); return ((k + ((round * PHI) % 1)) / n) * Math.PI * 2; };
export const ringLayer = (id, slots, tune) => tune.ring + (Math.floor(Math.max(0, id) / Math.max(1, slots)) % Math.max(1, tune.layers ?? 1)) * (tune.layer ?? 0);
export const ringPoint = (bearing, radius) => [Math.cos(bearing) * radius, Math.sin(bearing) * radius];

export function findRingSpot({ bearing, radius, open, tune }) {
  const half = Math.PI / Math.max(1, tune.slots), search = tune.search ?? 0;
  for (const r of [radius, radius * (tune.minRing ?? 1)]) {
    for (let k = 0; k <= search; k++) {
      for (const s of k ? [1, -1] : [1]) {
        const b = bearing + s * k * half;
        if (open(ringPoint(b, r))) return { bearing: b, radius: r };
      }
    }
  }
  return null;
}

const local = (t, phase, jab) => { const e = jab.every; return (((t + phase * e) % e) + e) % e; };
export function jabAt(t, phase, ring, jab) {
  const u = local(t, phase, jab);
  if (!jab || u >= jab.seconds) return { radius: ring, deep: false };
  const f = u / jab.seconds;
  return { radius: ring - (ring - Math.min(ring, jab.depth)) * Math.sin(Math.PI * f), deep: f >= 0.25 && f < 0.75 };
}
export function jabPeaked(t0, t1, phase, jab) {
  if (!jab || !(t1 > t0)) return false;
  if (t1 - t0 >= jab.every) return true;
  const mid = jab.seconds / 2, a = local(t0, phase, jab), b = local(t1, phase, jab);
  return b >= a ? a < mid && mid <= b : a < mid || mid <= b;
}

export function stepToward(at, to, max) {
  const dx = to[0] - at[0], dy = to[1] - at[1], d = Math.hypot(dx, dy);
  if (d <= max || d < 1e-12) return [to[0], to[1]];
  return [at[0] + (dx / d) * max, at[1] + (dy / d) * max];
}

export function stepRound(at, to, max) {
  const r = Math.hypot(at[0], at[1]), R = Math.hypot(to[0], to[1]);
  if (r < 1e-9 || R < 1e-9) return stepToward(at, to, max);
  let dt = Math.atan2(to[1], to[0]) - Math.atan2(at[1], at[0]);
  dt -= Math.round(dt / (Math.PI * 2)) * Math.PI * 2;
  const dr = R - r, arc = dt * Math.max(r, R) , d = Math.hypot(dr, arc);
  if (d <= max || d < 1e-12) return [to[0], to[1]];
  const f = max / d, nr = r + dr * f, nb = Math.atan2(at[1], at[0]) + dt * f;
  return [Math.cos(nb) * nr, Math.sin(nb) * nr];
}
