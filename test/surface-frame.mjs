import assert from 'node:assert/strict';
import { frameAt, toWorld, toLocal, reanchor, sagitta } from '../src/domain/surface-frame.js';
const R = 750, S = 170;
const len = (v) => Math.hypot(...v), norm = (v) => v.map((x) => x / len(v)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (let n = 0; n < 50; n++) {
  const dir = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), yaw = rnd() * Math.PI * 2;
  const f = frameAt(dir, R, yaw);
  assert.ok(Math.abs(len(f.up) - 1) < 1e-12 && Math.abs(len(f.east) - 1) < 1e-12 && Math.abs(len(f.north) - 1) < 1e-12, 'unit basis');
  assert.ok(Math.abs(dot(f.up, f.east)) < 1e-12 && Math.abs(dot(f.up, f.north)) < 1e-12 && Math.abs(dot(f.east, f.north)) < 1e-12, 'orthogonal basis');
  assert.ok(Math.abs(len(f.origin) - R) < 1e-9, 'the origin on the sphere');
  const local = [(rnd() - 0.5) * 0.2, 0.012, (rnd() - 0.5) * 0.2];
  const world = toWorld(f, local, S), back = toLocal(f, world, S);
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(back[k] - local[k]) < 1e-9, 'toLocal inverts toWorld');
  const d = Math.hypot(local[0], local[2]) * S, along = R * Math.acos(Math.max(-1, Math.min(1, dot(norm(world), dir))));
  // the point floats h = 2.04 m above the tangent plane, so the exact angle is atan(d / (R + h)); against the flat d the
  // relative error is h / R (0.27%) plus (d / R)^2 / 3 (sagitta, second order), hence the loose bound.
  const exact = R * Math.atan2(d, R + local[1] * S);
  assert.ok(Math.abs(along - exact) < 1e-6, `distance along the surface ${along} vs the exact ${exact}`);
  assert.ok(Math.abs(along - d) / d < 4e-3, `distance along the surface ${along} vs ${d}`);
}
const f = frameAt([0, 1, 0], R, 0.3);
const far = reanchor(f, [25 / S, 0.03, 0], R, S, 20);
assert.ok(Math.abs(len(far.frame.origin) - R) < 1e-9, 're-anchored origin on the sphere');
assert.ok(Math.abs(dot(norm(far.frame.origin), norm(toWorld(f, [25 / S, 0, 0], S))) - 1) < 1e-9, 'the new origin is the surface point under the centre');
assert.deepEqual(far.shift, [-25 / S, 0, 0]);
assert.equal(far.frame.yaw, 0.3, 'yaw kept');
const near = reanchor(f, [5 / S, 0.03, 0], R, S, 20);
assert.equal(near.frame, f); assert.deepEqual(near.shift, [0, 0, 0]);
assert.ok(Math.abs(sagitta(15, 750) - 0.15) < 0.001);
console.log('Surface frame: orthonormal, invertible, re-anchors along the surface, keeps yaw.');
