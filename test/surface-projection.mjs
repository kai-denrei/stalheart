import assert from 'node:assert/strict';
import { surfaceFrame, toPlane, fromPlane, planeDistance } from '../src/domain/surface-projection.js';
// THE SURFACE FRAME AND ITS PLANE (src/domain/surface-projection.js): a right-handed tangent frame, the azimuthal-equidistant
// projection round its origin (arc distance kept exactly), its inverse, and the kit's own bend (src/fx/cutis-maku/geometry.js) lands on it
const close = (a, b, eps = 1e-9, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} ${a} vs ${b}`);
const unit = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
for (const o of [[0, 1, 0], [1, 0, 0], unit([0.3, -0.8, 0.5]), unit([-0.95, 0.1, 0.2])]) {
  const f = surfaceFrame(o);
  close(Math.hypot(...f.ex), 1); close(Math.hypot(...f.ez), 1); close(dot(f.ex, f.ey), 0); close(dot(f.ez, f.ey), 0); close(dot(f.ex, f.ez), 0);
  const c = [f.ex[1] * f.ey[2] - f.ex[2] * f.ey[1], f.ex[2] * f.ey[0] - f.ex[0] * f.ey[2], f.ex[0] * f.ey[1] - f.ex[1] * f.ey[0]];
  for (let k = 0; k < 3; k++) close(c[k], f.ez[k], 1e-9, 'ex x ey = ez');
  assert.deepEqual(toPlane(f, f.origin, 753).map((v) => +v.toFixed(9)), [0, 0], 'the origin is the plane origin');
  const R = 753;
  for (const [x, z] of [[10, 0], [0, -25], [120, 80], [-400, 300], [900, -1200]]) {
    const p = fromPlane(f, x, z, R), back = toPlane(f, p, R);
    close(Math.hypot(...p), 1, 1e-12, 'a sphere point');
    close(back[0], x, 1e-6, 'x round trip'); close(back[1], z, 1e-6, 'z round trip');
    close(Math.acos(Math.max(-1, Math.min(1, dot(p, f.ey)))) * R, Math.hypot(x, z), 1e-6, 'the arc from the origin is the plane distance');
    // the kit's bend: local (x, 0, z) -> (x R sin t / d, R cos t - R, z R sin t / d) in the frame scaled by 1 / R, offset by the origin
    const d = Math.hypot(x, z), t = d / R, s = R * Math.sin(t) / d, local = [x * s, R * Math.cos(t) - R, z * s];
    const world = [0, 1, 2].map((k) => f.origin[k] + (f.ex[k] * local[0] + f.ey[k] * local[1] + f.ez[k] * local[2]) / R);
    for (let k = 0; k < 3; k++) close(world[k], p[k], 1e-9, 'the shader lands on the projection');
  }
}
close(planeDistance([0, 0], [3, 4]), 5);
console.log('Surface projection: a right-handed frame, the azimuthal-equidistant plane round it both ways, and the Cutis kit\'s bend lands on it.');
