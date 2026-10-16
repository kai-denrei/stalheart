// THE TANK SHELL'S BLAST (owner, 2026-10-13: "a stronger AoE and dmg"): which bodies a landing shell hurts and by how much. Pure: the bodies,
// the impact point, the body struck (or null) and the distance function come in; the damage per body goes out, applied by the caller.
// The falloff is the Bofors' (./gunship.js splashDamage): `peak` at the centre, nothing at `radius`; the body struck takes the full peak.
// The tune is src/content/tank.js SHELL_BLAST (radius in cells, scaled here by `cellSide`).
import { splashDamage } from './gunship.js';

export function shellHits(bodies, at, struck, { radius, peak, floor = 0 }, cellSide, dist) {
  const r = radius * cellSide, hits = [];
  for (const e of bodies) {
    if (!e.alive) continue;
    const d = dist(at, e.pos), dmg = e === struck ? peak : d < r ? Math.max(splashDamage(d, r, peak), floor * peak) : 0;   // `floor`: a share of the peak anywhere inside (2026-10-16)
    if (dmg > 0) hits.push({ e, dmg });
  }
  return hits;
}
