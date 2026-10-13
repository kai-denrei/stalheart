// THE BODIES' PROJECTION HUBS (owner, 2026-10-13, the Pearl set in the story: "there are still a mix of half-dotted and new cutis enemies"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"). A Cutis body is planned and drawn in a flat plane bent onto the planet round a
// hub point (src/domain/surface-projection.js: azimuthal-equidistant, its shapes pressed sideways by theta / sin(theta) at an arc theta from the hub,
// singular at the antipode). One hub at the heart left the canyon's far side to the dot clouds. Twelve hubs on an icosahedron, the first at the heart,
// put every point of the sphere within 0.65 rad of one (a shape pressed at most 7.5 %); a body belongs to its nearest hub and is handed to another as
// it walks, at the same pose. Midway between two hubs both see a point at the same arc, so the hand-over changes its shape by the hysteresis only.
// Pure: unit vectors as [x, y, z] arrays in, numbers out.
//   icosaHubs(frame)                      the twelve hub points (unit) of the icosahedron with a vertex at frame.ey, in frame's axes; [0] is frame.ey
//   hubFrames(frame)                      a surfaceFrame per hub, [0] the given frame itself
//   nearestHub(points, p, cur, margin)    the hub nearest unit point p; `cur` (a hub index, or -1) is kept unless another is `margin` rad nearer
//   remapPlane(fa, fb, x, z, R)           plane point (x, z) of frame fa as a plane point of frame fb (the sphere point it stands for, re-projected)
//   hubTurn(f0, f)                        the quaternion [x, y, z, w] turning f0's axes onto f's (the turn about the planet's centre that carries a
//                                         body bent round f's hub into the plane group of f0, src/fx/cutis-maku/shaders.js HUB_TURN)
import { surfaceFrame, toPlane, fromPlane } from './surface-projection.js';

// the icosahedron's vertices with one at +Y: the poles and two rings of five at latitude +-atan(1/2), the lower ring turned half a step
const RING = 1 / Math.sqrt(5), SPREAD = 2 / Math.sqrt(5);
export const ICOSA = Object.freeze([
  [0, 1, 0], [0, -1, 0],
  ...[0, 1, 2, 3, 4].map((k) => [SPREAD * Math.cos(k * 2 * Math.PI / 5), RING, SPREAD * Math.sin(k * 2 * Math.PI / 5)]),
  ...[0, 1, 2, 3, 4].map((k) => [SPREAD * Math.cos((k + 0.5) * 2 * Math.PI / 5), -RING, SPREAD * Math.sin((k + 0.5) * 2 * Math.PI / 5)]),
].map((v) => Object.freeze(v)));
// the largest arc from any point of the sphere to its nearest vertex (the circumradius of a face, seen from the centre)
export const ICOSA_REACH = Math.acos(Math.sqrt((5 + 2 * Math.sqrt(5)) / 15));

export function icosaHubs(frame) {
  return ICOSA.map(([a, b, c]) => [0, 1, 2].map((k) => frame.ex[k] * a + frame.ey[k] * b + frame.ez[k] * c));
}

export function hubFrames(frame) {
  return icosaHubs(frame).map((p, k) => (k === 0 ? frame : surfaceFrame(p)));
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function nearestHub(points, p, cur = -1, margin = 0) {
  const l = Math.hypot(p[0], p[1], p[2]) || 1;
  let best = 0, bd = -Infinity;
  for (let k = 0; k < points.length; k++) { const d = dot(points[k], p) / l; if (d > bd) { bd = d; best = k; } }
  if (cur < 0 || cur >= points.length || cur === best) return best;
  const keep = Math.acos(Math.max(-1, Math.min(1, dot(points[cur], p) / l))), go = Math.acos(Math.max(-1, Math.min(1, bd)));
  return keep - go > margin ? best : cur;
}

export const remapPlane = (fa, fb, x, z, R) => toPlane(fb, fromPlane(fa, x, z, R), R);

// the rotation matrix M0^T M (columns ex, ey, ez of each frame) as a unit quaternion
export function hubTurn(f0, f) {
  const c = [f.ex, f.ey, f.ez], r = [f0.ex, f0.ey, f0.ez];
  const m = (i, j) => dot(r[i], c[j]);   // row i of M0^T is f0's axis i; column j of M is f's axis j
  const m00 = m(0, 0), m11 = m(1, 1), m22 = m(2, 2), tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); w = 0.25 / s; x = (m(2, 1) - m(1, 2)) * s; y = (m(0, 2) - m(2, 0)) * s; z = (m(1, 0) - m(0, 1)) * s; }
  else if (m00 > m11 && m00 > m22) { const s = 2 * Math.sqrt(1 + m00 - m11 - m22); w = (m(2, 1) - m(1, 2)) / s; x = 0.25 * s; y = (m(0, 1) + m(1, 0)) / s; z = (m(0, 2) + m(2, 0)) / s; }
  else if (m11 > m22) { const s = 2 * Math.sqrt(1 + m11 - m00 - m22); w = (m(0, 2) - m(2, 0)) / s; x = (m(0, 1) + m(1, 0)) / s; y = 0.25 * s; z = (m(1, 2) + m(2, 1)) / s; }
  else { const s = 2 * Math.sqrt(1 + m22 - m00 - m11); w = (m(1, 0) - m(0, 1)) / s; x = (m(0, 2) + m(2, 0)) / s; y = (m(1, 2) + m(2, 1)) / s; z = 0.25 * s; }
  const l = Math.hypot(x, y, z, w) || 1;
  return w < 0 ? [-x / l, -y / l, -z / l, -w / l] : [x / l, y / l, z / l, w / l];
}
