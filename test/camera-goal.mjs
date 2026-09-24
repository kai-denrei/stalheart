// camera-goal.mjs — the gameplay camera's poses as arithmetic (src/domain/camera-goal.js): the strike's fall down the target's
// normal with its shake; riding Isao from behind and above, forward his heading or his job, looking between him and the job; the
// bastion behind its anchor facing the lane; the tank's third person (lower and nearer on the phone shell) and POV, the dip and
// the kick.
import assert from 'node:assert/strict';
import { strikeFallPose, droneRidePose, bastionPose, tankViewPose } from '../src/domain/camera-goal.js';
import { norm3, sub3, dot3, len3, scale3, cross3 } from '../src/vec3.js';

const near = (a, b, eps = 1e-12) => Math.abs(a - b) < eps;
const cellSide = 0.02, wallHeight = 0.006, unitScale = 0.003;
// THE FALL: the eye rides the normal down from 3.6 radii to just over the walls, shaking across it; it looks at the target
{
  const c = norm3([0.2, 0.9, 0.3]), nrm = c;
  const top = strikeFallPose(c, nrm, 0, wallHeight, cellSide, 0), low = strikeFallPose(c, nrm, 1, wallHeight, cellSide, 0);
  assert.ok(near(len3(top.eye), 3.6) && near(dot3(norm3(top.eye), nrm), 1), 'at the start: straight up the normal, no shake at st=0');
  assert.ok(near(len3(low.eye), 1 + wallHeight * 3 + cellSide * 0.8), 'at impact: just over the wall tops');
  assert.equal(top.look, c); assert.ok(near(dot3(top.up, nrm), 0) && near(len3(top.up), 1), 'up a unit tangent');
  const shaken = strikeFallPose(c, nrm, 0.9, wallHeight, cellSide, 12.3);
  assert.ok(len3(sub3(shaken.eye, scale3(nrm, dot3(shaken.eye, nrm)))) > 0, 'the shake moves the eye across the normal');
  assert.deepEqual(strikeFallPose([0, 1, 0], [0, 1, 0], 0.5, wallHeight, cellSide, 1).up, norm3(cross3([0, 1, 0], [1, 0, 0])), 'over a pole the reference axis changes');
}
// RIDING ISAO: behind and above him along his forward; looking just past him toward the job, or down along his drift waiting
{
  const up = norm3([0, 1, 0.1]), bp = scale3(up, 1.02), heading = norm3(sub3([1, 0, 0], scale3(up, dot3([1, 0, 0], up))));
  const centers = [norm3([0.5, 0.8, 0]), norm3([-1, 0.2, 0])];
  const p = droneRidePose({ bp, up, heading, order: { ci: 0 }, centers, loiter: null, cellSide, wallHeight });
  const rel = sub3(p.eye, bp);
  assert.ok(near(dot3(rel, heading), -cellSide * 4.2) && near(dot3(rel, up), cellSide * 1.6), '4.2 cells behind, 1.6 above');
  assert.deepEqual(p.up, up);
  const job = scale3(centers[0], 1 + wallHeight);
  assert.ok(near(len3(sub3(p.look, bp)) / len3(sub3(job, bp)), 0.45), 'aimed 0.45 of the way to the job');
  const drift = droneRidePose({ bp, up, heading, order: null, centers, loiter: up, cellSide, wallHeight });
  assert.ok(dot3(sub3(drift.look, bp), heading) > 0 && dot3(sub3(drift.look, bp), up) < 0, 'waiting: ahead along his drift, tipped down');
  const byJob = droneRidePose({ bp, up, heading: null, order: { ci: 0 }, centers, loiter: null, cellSide, wallHeight });
  assert.ok(dot3(sub3(byJob.look, bp), sub3(centers[0], up)) > 0, 'no heading: forward is toward the job');
  const still = droneRidePose({ bp, up, heading: null, order: null, centers, loiter: up, cellSide, wallHeight });
  assert.ok(still.eye.every(Number.isFinite), 'no heading, no job, loitering where he is: a tangent all the same');
}
// THE BASTION: behind the anchor, up its normal; a tower faces outward from the Heart, the Heart faces its nearest live portal
{
  const centers = [[0, 1, 0], norm3([0.3, 1, 0]), norm3([-0.3, 1, 0]), norm3([0, 1, 0.5]), norm3([0, 1, -0.2])], normals = centers;
  const tower = bastionPose({ centers, normals, anchorCi: 1, heart: 0, spawnCi: 3, portals: [], wallHeight, cellSide });
  const out = norm3(sub3(tower.look, tower.eye));
  assert.ok(dot3(out, sub3(centers[1], centers[0])) > 0, 'a tower looks outward from the Heart'); assert.deepEqual(tower.up, normals[1]);
  const heart = bastionPose({ centers, normals, anchorCi: 0, heart: 0, spawnCi: 3, portals: [{ ci: 2, alive: true }, { ci: 4, alive: false }, { ci: 3, alive: true }], wallHeight, cellSide });
  assert.ok(dot3(sub3(heart.look, heart.eye), [-1, 0, 0]) > 0, 'the Heart faces its nearest live portal (2; 4 is nearer but dead)');
  const none = bastionPose({ centers, normals, anchorCi: 0, heart: 0, spawnCi: 3, portals: [{ ci: 4, alive: false }], wallHeight, cellSide });
  assert.ok(dot3(sub3(none.look, none.eye), [0, 0, 1]) > 0, 'no live portal: the spawn');
}
// THE TANK: third person behind and above, the phone shell lower and looking nearer; POV low in the slot; the dip and the kick
{
  const c = norm3([0.1, 1, 0.2]), h = norm3(sub3([0, 0, 1], scale3(c, dot3([0, 0, 1], c))));
  const base = { c, h, dip: 0, kick: 0, wallHeight, cellSide, unitScale };
  const desk = tankViewPose({ ...base, third: true, mobile: false }), phone = tankViewPose({ ...base, third: true, mobile: true }), pov = tankViewPose({ ...base, third: false, mobile: false });
  const height = (p) => dot3(sub3(p.eye, c), c), ahead = (p) => dot3(sub3(p.look, c), h);
  assert.ok(height(phone) < height(desk) && near(height(phone), height(desk) * 0.78, 1e-15), 'the shell rides lower behind');
  assert.ok(near(ahead(desk), cellSide * 1.4, 1e-15) && near(ahead(phone), cellSide * 0.45, 1e-15), 'and looks nearer the tank');
  assert.ok(dot3(sub3(desk.eye, c), h) < 0 && height(desk) > 0, 'behind and above');
  assert.ok(near(height(pov), wallHeight * 0.62, 1e-15) && near(ahead(pov), cellSide * 2.4, 1e-15), 'the POV below the wall tops, along the slot');
  assert.deepEqual(desk.up, c);
  const dipped = tankViewPose({ ...base, third: true, mobile: false, dip: 0.001, kick: 0.002 });
  assert.ok(near(height(dipped), height(desk) - 0.001, 1e-15) && near(dot3(sub3(dipped.eye, desk.eye), h), -0.002, 1e-15), 'the dip sinks the eye, the kick pulls it back');
}
console.log('Camera goal: the strike\'s fall and shake, riding Isao (his heading, his job, his drift), the bastion on a tower and on the Heart, the tank\'s third person, the shell\'s and the POV, the dip and the kick.');
