// emerge-climb.mjs — a blob starts in the hole, crests the lip, ends at the record's start on the ground, whole then gone
import assert from 'node:assert/strict';
import { climbPose } from '../src/domain/emerge-climb.js';
const a = climbPose(0), m = climbPose(0.5), z = climbPose(1);
assert.equal(a.r, 0); assert.ok(a.h < 0, 'starts below the lip'); assert.equal(a.opacity, 1); assert.ok(a.scale < 1);
assert.ok(m.r > 0.4 && m.r < 0.6, 'half way out at half the climb'); assert.ok(m.h > 0, 'crests over the lip'); assert.equal(m.scale, 1);
assert.equal(z.r, 1, 'ends where the record starts'); assert.ok(Math.abs(z.h) < 1e-9, 'on the ground'); assert.equal(z.opacity, 0, 'gone');
assert.equal(climbPose(0.65).opacity, 1); assert.ok(climbPose(0.8).opacity > 0 && climbPose(0.8).opacity < 1, 'fades over the last share');
assert.equal(climbPose(0.5, { fadeFrom: 0.2 }).opacity, 0.625);
let last = -1; for (let u = 0; u <= 1; u += 0.05) { const p = climbPose(u); assert.ok(p.r >= last, 'never slides back'); last = p.r; }
assert.deepEqual(climbPose(-1), climbPose(0)); assert.deepEqual(climbPose(2), climbPose(1));
console.log('Emerge climb: from the hole, over the lip, onto the ground.');
