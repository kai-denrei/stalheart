// THE SINKHOLE IS A HOLE (owner, 2026-11-05, round 5, note 6a: "nothing hovers over it"). Pure: the ground's height under a unit-sphere point over
// the open holes, in world units (the unit sphere; 0 off every hole, below zero in one), from the bowl's own shape (src/core/sinkhole-shape.js, the one
// boundary the floor's discard, the fissures and the bowl mesh share). A body drawn over a hole takes this depth, so it is IN the bowl, sinking as it
// crosses, never floating over the dark (src/fx/enemy-step.js for the record's stand-in, src/fx/creature-bodies.js for a Pearl body).
// A hole: { c: its unit centre, x, z: its frame's unit tangent axes (the sinkhole group's local +X and +Z), s: world units a local unit, open: the
// opened radius in local units (the sinkhole's hole.value; CONTENT.breach.craterRadius once open) } (src/game-breaches.js floors()).
// The throat (r under SINKHOLE_INNER of the rim): the bowl's own function drops 20 radii there (a black well for the floor); a body goes on down the
// well's side, THROAT rim radii a rim radius past the inner ring, so one that crosses the centre sinks out of sight and back, never a cliff.
//   holeFloorLocal(lx, lz, open) -> local height (<= 0)   holeFloor(p, holes) -> world height (the deepest hole under p; 0 off them)
//   lipDepth(holes, centre, dir, rim) -> world height of the bowl's wall `rim` of the way to the rim along the unit tangent `dir` of the hole centred nearest
//   `centre` (the rim's own radius at that bearing: the wavy rim reaches 0.68 of the radius in places), 0 without one: where a body rises (round 5, note 6b)
import { rimRadius, bowlHeight, SINKHOLE_INNER } from '../core/sinkhole-shape.js';

export const THROAT = 4;
const RIM_MAX = 1.33;   // rimRadius's largest value (1 + the waves' amounts): a point past it is off the hole whatever its angle

export function holeFloorLocal(lx, lz, open) {
  if (!(open > 0)) return 0;
  const angle = Math.atan2(lz, lx), r = Math.hypot(lx, lz) / (open * rimRadius(angle));
  if (r >= 1) return 0;
  if (r >= SINKHOLE_INNER) return open * bowlHeight(angle, r);
  return open * (bowlHeight(angle, SINKHOLE_INNER) - THROAT * (SINKHOLE_INNER - r));
}

export function holeFloor(p, holes) {
  let low = 0;
  if (!holes) return low;
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i];
    if (!(h.open > 0) || !(h.s > 0)) continue;
    const q0 = p[0] - h.c[0], q1 = p[1] - h.c[1], q2 = p[2] - h.c[2], reach = h.open * RIM_MAX * h.s;
    if (q0 * q0 + q1 * q1 + q2 * q2 > reach * reach) continue;
    const y = holeFloorLocal((q0 * h.x[0] + q1 * h.x[1] + q2 * h.x[2]) / h.s, (q0 * h.z[0] + q1 * h.z[1] + q2 * h.z[2]) / h.s, h.open) * h.s;
    if (y < low) low = y;
  }
  return low;
}

export function lipDepth(holes, centre, dir, rim) {
  let h = null, best = Infinity;
  for (const k of holes ?? []) { const d = Math.hypot(k.c[0] - centre[0], k.c[1] - centre[1], k.c[2] - centre[2]); if (d < best && d < k.open * k.s) { best = d; h = k; } }
  if (!h || !(h.open > 0)) return 0;
  const angle = Math.atan2(dir[0] * h.z[0] + dir[1] * h.z[1] + dir[2] * h.z[2], dir[0] * h.x[0] + dir[1] * h.x[1] + dir[2] * h.x[2]);
  return h.open * bowlHeight(angle, rim) * h.s;
}
