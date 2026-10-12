// Coming up out of the sinkhole as a pure rule (owner, 2026-10-12: "start with wave 1 of 20 or so smaller one, and then a larger boss emerges", the same flow as the
// Reeds'): a Cutis-Maku waits below the hole; its first hop's cup is planted on the hole's lip toward its fan direction, and the hop's TRANSFER pours the body up through
// it. It is not hittable and not hunting until that hop has committed (`hasEmerged`). Local metres on the frame's plane [x, z]; radians for angles.

const GOLDEN = Math.PI * (3 - Math.sqrt(5));   // as src/domain/boss-wave.js emergePlan: successive directions a golden angle apart spread any count evenly enough

// creature `i`'s fan direction (radians): the first is `phase`, each next a golden angle on
export const fanAngle = (i, phase = 0) => phase + i * GOLDEN;

// the first anchor: on the hole's lip, `holeRadius + out x r` from `centre` toward the direction `fanAngle` (the cup lands a little beyond the rim)
export function lipPoint(centre, holeRadius, fanAngle, r, out = 0.6) {
  const d = holeRadius + out * r;
  return [centre[0] + Math.cos(fanAngle) * d, centre[1] + Math.sin(fanAngle) * d];
}

// the origin's depth below the ground (negative metres): `depthRadii` times the body's radius
export const emergeDepth = (r, depthRadii) => -(r * depthRadii);

// true once its first hop committed (a hop that ends counts a cycle)
export const hasEmerged = (cycles) => cycles >= 1;
