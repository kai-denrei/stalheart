// deploy-path.mjs — the deploy path's pose maths (src/domain/deploy-path.js): a berth's run and heading on the lattice and in
// a story bay, the drive-out's progress on a clip's clock or the distance covered, its ease, and the framing it is watched from.
import assert from 'node:assert/strict';
import { berthRun, berthHeading, deployU, easeDeploy, deployFraming } from '../src/domain/deploy-path.js';
import { norm3, dot3, len3, dist3, sub3 } from '../src/vec3.js';

const centers = [norm3([0, 1, 0]), norm3([0, 1, 0.05]), norm3([0.05, 1, 0.05])], normals = centers;
const lattice = { ci: 0, exit: 1 }, bay = { ci: 0, exit: 1, pos: norm3([0.01, 1, -0.02]), out: norm3([0.01, 1, 0.08]) };
const close = (a, b, eps = 1e-12) => a.every((x, i) => Math.abs(x - b[i]) < eps);

// THE RUN: cell centre to exit on the lattice; the bay's own spot to past its doors
assert.deepEqual(berthRun(lattice, centers), [centers[0], centers[1]]);
assert.deepEqual(berthRun(bay, centers), [bay.pos, bay.out]);
for (const b of [lattice, bay]) {
  const h = berthHeading(b, centers), [f, t] = berthRun(b, centers);
  assert.ok(Math.abs(len3(h) - 1) < 1e-12, 'a unit heading'); assert.ok(Math.abs(dot3(h, norm3(f))) < 1e-12, 'tangent to the ground where the run starts');
  assert.ok(dot3(h, sub3(t, f)) > 0, 'pointing out of the bay');
}
// THE PROGRESS: a drive on the distance covered, an authored clip on its own clock; never past 1
const len = dist3(...berthRun(lattice, centers));
assert.equal(deployU({ travelled: len / 4, clip: 0 }, lattice, centers), 0.25);
assert.equal(deployU({ travelled: len * 3, clip: 0 }, lattice, centers), 1);
assert.equal(deployU({ travelled: 99, age: 1.3, clip: 5.2 }, lattice, centers), 0.25, 'the clip\'s clock, not the distance');
assert.equal(deployU({ travelled: 0, clip: 0 }, { ci: 0, exit: 0 }, centers), 0, 'a run of no length does not divide by zero');
// THE EASE: 0 and 1 held, symmetric about the middle, never backwards
assert.deepEqual([easeDeploy(0), easeDeploy(0.5), easeDeploy(1)], [0, 0.5, 1]);
for (let u = 0; u < 1; u += 0.05) assert.ok(easeDeploy(u + 0.05) >= easeDeploy(u));
// THE FRAMING: above the ground, the berth's normal as up; in front of the doors looking back, or behind the bay looking out
for (const b of [lattice, bay]) for (const behind of [false, true]) {
  const { eye, look, up } = deployFraming(b, centers, normals, behind, 0.004, 0.05), [from] = berthRun(b, centers), h = berthHeading(b, centers);
  assert.equal(up, normals[b.ci]);
  assert.ok(dot3(sub3(eye, from), up) > 0 && dot3(sub3(look, from), up) > 0, 'the eye and the aim point stand off the ground');
  const ahead = dot3(sub3(eye, from), h);
  assert.ok(behind ? ahead < 0 : ahead > 0, behind ? 'an authored roll-out is watched from behind the bay' : 'a drive is watched from where the doors face');
  assert.ok(close(deployFraming(b, centers, normals, behind, 0.004, 0.05).eye, eye), 'the same berth, the same pose');
}
console.log('Deploy path: the berth\'s run and heading, the drive-out\'s progress and ease, and the framing in front of or behind the bay.');
