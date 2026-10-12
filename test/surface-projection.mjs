import assert from 'node:assert/strict';
import { surfaceFrame, carryFrame, toPlane, fromPlane, planeDistance } from '../src/domain/surface-projection.js';
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
// carryFrame: a frame moved to a point near it keeps its heading (a body walking 30 m east still faces east), right-handed, and a short
// walk east and back west returns the frame it started with
for (const o of [[0, 1, 0], unit([0.3, -0.8, 0.5]), unit([0.999, 0.01, 0.04])]) {
  const R = 753, f = surfaceFrame(o), p = fromPlane(f, 30, 0, R), g = carryFrame(f, p);
  close(Math.hypot(...g.ex), 1); close(dot(g.ex, g.ey), 0); close(dot(g.ez, g.ey), 0); close(dot(g.ex, g.ez), 0);
  for (let k = 0; k < 3; k++) close(g.ey[k], p[k], 1e-12, 'its origin is the point');
  const c = [g.ex[1] * g.ey[2] - g.ex[2] * g.ey[1], g.ex[2] * g.ey[0] - g.ex[0] * g.ey[2], g.ex[0] * g.ey[1] - g.ex[1] * g.ey[0]];
  for (let k = 0; k < 3; k++) close(c[k], g.ez[k], 1e-9, 'ex x ey = ez');
  // the point 30 m further east in the new frame is 60 m east in the old (the heading carried along the great circle)
  const q = toPlane(f, fromPlane(g, 30, 0, R), R); close(q[0], 60, 1e-6, 'east stays east'); close(q[1], 0, 1e-6, 'no turn');
  // a point 10 m north of p in the old frame is 10 m north in the new one, within the projection's stretch
  const n = toPlane(g, fromPlane(f, 30, 10, R), R); close(n[0], 0, 0.01); close(n[1], 10, 0.01);
  const back = carryFrame(g, o); for (let k = 0; k < 3; k++) close(back.ex[k], f.ex[k], 1e-9, 'there and back');
}
{ const f = surfaceFrame([0, 1, 0]), g = carryFrame(f, f.ex); assert.ok(Math.abs(dot(g.ex, g.ey)) < 1e-9, 'the degenerate quarter-planet carry falls back'); }
console.log('Surface projection: a right-handed frame, the azimuthal-equidistant plane round it both ways, a frame carried to a nearby point keeps its heading, and the Cutis kit\'s bend lands on it.');
