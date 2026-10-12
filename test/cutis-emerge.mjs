// cutis-emerge.mjs — coming up out of the sinkhole (owner, 2026-10-12: "start with wave 1 of 20 or so smaller one, and then a larger boss emerges";
// src/domain/cutis-emerge.js): the fan directions a golden angle apart as boss-wave.js emergePlan, the first anchor on the hole's lip, the origin below the ground,
// emerged once the first hop committed.
import assert from 'node:assert/strict';
import { lipPoint, emergeDepth, hasEmerged, fanAngle } from '../src/domain/cutis-emerge.js';
import { emergePlan } from '../src/domain/boss-wave.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';
import { CUTIS_EMERGE, CUTIS_WAVE, CUTIS_BOSS } from '../src/content/cutis-maku.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

// the fan directions are emergePlan's: the same angle, so the same direction from the centre
const plan = emergePlan(30, BOSS_FIGHT, [0, 0], 0.4);
for (let i = 0; i < 30; i++) {
  const a = fanAngle(i, 0.4), want = plan[i].fan, len = Math.hypot(...want);
  near(Math.cos(a) * len, want[0], 1e-9); near(Math.sin(a) * len, want[1], 1e-9);
}
near(fanAngle(0), 0); near(fanAngle(1), Math.PI * (3 - Math.sqrt(5))); near(fanAngle(3, 1) - fanAngle(2, 1), fanAngle(1));
// spread: twenty directions, none the same
const dirs = Array.from({ length: 20 }, (_, i) => [Math.cos(fanAngle(i)), Math.sin(fanAngle(i))]);
for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) assert.ok(Math.hypot(dirs[i][0] - dirs[j][0], dirs[i][1] - dirs[j][1]) > 0.05, `${i} and ${j} apart`);

// the lip point: holeRadius + out x r from the centre, in the fan direction
for (const [centre, hole, a, r, out] of [[[0, 0], 5, 0, 1.5, undefined], [[10, -4], 10, 1.2, 6, undefined], [[-3, 2], 5, 4, 1.5, 1], [[0, 0], 0, 2, 3, 0.25]]) {
  const p = lipPoint(centre, hole, a, r, out), want = hole + (out ?? 0.6) * r;
  near(Math.hypot(p[0] - centre[0], p[1] - centre[1]), want);
  near(Math.atan2(p[1] - centre[1], p[0] - centre[0]), Math.atan2(Math.sin(a), Math.cos(a)));
}
assert.deepEqual(lipPoint([0, 0], 5, 0, 1.5), [5.9, 0]);
near(lipPoint([2, 3], 10, Math.PI / 2, 6)[0], 2); near(lipPoint([2, 3], 10, Math.PI / 2, 6)[1], 3 + 13.6);
assert.ok(lipPoint([0, 0], 5, 1, 1.5, 0.6).every(Number.isFinite));
assert.ok(Math.hypot(...lipPoint([0, 0], 5, 1, 1.5)) > 5, 'beyond the hole, so the cup grips ground');

// the depth: negative metres, deeper for a bigger body or more radii
assert.ok(emergeDepth(1.5, 4) < 0); assert.ok(emergeDepth(6, 4) < 0);
near(emergeDepth(1.5, 4), -6); near(emergeDepth(6, 4), -24);
assert.ok(emergeDepth(6, 4) < emergeDepth(1.5, 4)); assert.ok(emergeDepth(1.5, 5) < emergeDepth(1.5, 4));

// emerged once its first hop committed
assert.equal(hasEmerged(0), false); assert.equal(hasEmerged(1), true); assert.equal(hasEmerged(7), true);

// the content's numbers through them: the boss's hole (twice the Reeds', 20 m) with the boss's radius
const E = CUTIS_EMERGE, p = lipPoint([0, 0], 10, 0.7, CUTIS_BOSS.config.r0, E.lipOut);
near(Math.hypot(...p), 10 + E.lipOut * 6); assert.ok(emergeDepth(CUTIS_WAVE.config.r0, E.depthRadii) < 0);
console.log('cutis-emerge: fan directions as emergePlan, the lip point, the depth, hasEmerged ok');
