import assert from 'node:assert/strict';
import { frameAt, toWorld, toLocal, reanchor, sagitta } from '../src/domain/surface-frame.js';
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const R = 750, S = 170;
const len = (v) => Math.hypot(...v), norm = (v) => v.map((x) => x / len(v)), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
for (let n = 0; n < 50; n++) {
  const dir = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), yaw = rnd() * Math.PI * 2;
  const f = frameAt(dir, R, yaw);
  assert.ok(Math.abs(len(f.up) - 1) < 1e-12 && Math.abs(len(f.east) - 1) < 1e-12 && Math.abs(len(f.north) - 1) < 1e-12, 'unit basis');
  assert.ok(Math.abs(dot(f.up, f.east)) < 1e-12 && Math.abs(dot(f.up, f.north)) < 1e-12 && Math.abs(dot(f.east, f.north)) < 1e-12, 'orthogonal basis');
  assert.ok(Math.abs(len(f.origin) - R) < 1e-9, 'the origin on the sphere');
  cross(f.east, f.up).forEach((c, k) => assert.ok(Math.abs(c - f.north[k]) < 1e-12, 'right-handed: east x up = north'));
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
for (const pole of [[0, 1, 0], [0, -1, 0]]) {
  const g = frameAt(pole, R, 0.7);
  assert.ok([g.up, g.east, g.north].every((v) => Math.abs(len(v) - 1) < 1e-12), 'pole: unit basis');
  assert.ok(Math.abs(dot(g.up, g.east)) < 1e-12 && Math.abs(dot(g.up, g.north)) < 1e-12 && Math.abs(dot(g.east, g.north)) < 1e-12, 'pole: orthogonal basis');
  cross(g.east, g.up).forEach((c, k) => assert.ok(Math.abs(c - g.north[k]) < 1e-12, 'pole: right-handed'));
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
{ // continuity. norm([0.3, 0.89, 0.1]) already has y = 0.942 (the normalising lifts it), so the start is norm([0.45, 0.89, 0.1]),
  // y = 0.888, just under the band; 25 m along local x lowers y, so the offset is 25 m along local -z (south), which lands at y = 0.9016 (asserted).
  const f0 = frameAt(norm([0.45, 0.89, 0.1]), R, 0.4), p = [0, 0, -25 / S];
  const r = reanchor(f0, p, R, S, 20), g = r.frame;
  assert.ok(Math.abs(f0.up[1]) < 0.9 && Math.abs(g.up[1]) >= 0.9, `the re-anchor crosses the helper band (${f0.up[1]} -> ${g.up[1]})`);
  assert.ok(Math.acos(Math.min(1, dot(f0.east, g.east))) < 3 * Math.PI / 180, 'east carried across the band');
  assert.ok([g.up, g.east, g.north].every((v) => Math.abs(len(v) - 1) < 1e-12), 're-anchored: unit basis');
  assert.ok(Math.abs(dot(g.up, g.east)) < 1e-12 && Math.abs(dot(g.up, g.north)) < 1e-12 && Math.abs(dot(g.east, g.north)) < 1e-12, 're-anchored: orthogonal');
  cross(g.east, g.up).forEach((c, k) => assert.ok(Math.abs(c - g.north[k]) < 1e-12, 're-anchored: right-handed'));
  assert.equal(g.yaw, 0.4, 'yaw kept after the band');
  // p sits on the old tangent plane (y = 0): a point lifted by y tilts with the up axes, shifting x and z by about y * angle, so
  // the exact x/z identity holds on the plane and the y difference is the sagitta.
  const w = toWorld(f0, p, S), q = toLocal(g, w, S);   // round trip: same world point, local = p + shift
  assert.ok(Math.abs(q[0] - (p[0] + r.shift[0])) < 1e-6 && Math.abs(q[2] - (p[2] + r.shift[2])) < 1e-6, 'x and z survive the re-anchor');
  assert.ok(Math.abs(q[1] - p[1]) < 0.01, 'y differs by the sagitta only');
}
console.log('Surface frame: orthonormal, invertible, re-anchors along the surface, keeps yaw.');
