import assert from 'node:assert/strict';
import { celebrationPose, hoistBlend, HOOK_LOCAL_OFFSET, PARTY_COLORS, LOOP } from '../src/domain/disco-celebration.js';
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);
// the diorama's 16 s Stalheart_Celebration_Cycle (SentryTowers_A6 assets/stalheart-disco/runtime.js, assets/disco-ball/runtime.js), ported
assert.equal(LOOP, 16); assert.deepEqual([...HOOK_LOCAL_OFFSET], [0, 6.2, 0]); assert.deepEqual([...PARTY_COLORS], [0xff4fd8, 0x48e5ff, 0xffcf48, 0x68ff8a]);
const p0 = celebrationPose(0), p4 = celebrationPose(4), p8 = celebrationPose(8);
near(p0.gantryZ, 0, 'gantry at rest'); near(p4.gantryZ, 3.2, 'gantry out at a quarter'); near(p8.gantryZ, 0, 'gantry back at half');
near(p0.carriageX, 0, 'carriage'); near(celebrationPose(2).carriageX, 2.4, 'carriage at an eighth');
near(p0.liftY, 1.87 + 0.35, 'lift'); near(p4.liftY, 1.87 - 0.35, 'lift at a quarter');
assert.equal(p0.j2Shoulder, -0.5); assert.equal(p0.j3Elbow, 1.05); assert.equal(p0.j5Wrist, -0.55);
near(p4.j1Yaw, 0.25, 'base yaw'); near(p4.sphereSpinY, Math.PI / 2 * 3, 'sphere spin');
for (const t of [0, 1, 5, 9.5, 15.9]) { const p = celebrationPose(t); assert.ok(p.pulse >= 0.3 && p.pulse <= 1, 'pulse in range'); assert.ok(Math.abs(p.pendulumZ) <= 0.24 && Math.abs(p.pendulumX) <= 0.11, 'pendulum bounded'); }
near(celebrationPose(16).gantryZ, celebrationPose(0).gantryZ, 'periodic'); near(celebrationPose(-4).gantryZ, celebrationPose(12).gantryZ, 'negative time wraps');
// the hoist: from the paused Terraforming joints to the celebration's, eased; missing keys take the target
const from = { j2Shoulder: 0.2, j3Elbow: 0 }, to = { j2Shoulder: -0.5, j3Elbow: 1.05, j5Wrist: -0.55 };
assert.deepEqual(hoistBlend(0, from, to), { j2Shoulder: 0.2, j3Elbow: 0, j5Wrist: -0.55 });
assert.deepEqual(hoistBlend(1, from, to), to);
near(hoistBlend(0.5, from, to).j2Shoulder, -0.15, 'halfway'); assert.ok(hoistBlend(0.25, from, to).j3Elbow < 0.25 * 1.05, 'eased in');
console.log('disco-celebration ok');
