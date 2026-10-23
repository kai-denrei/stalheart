// feids-heat.mjs — the drop's look (owner, 2026-10-23; spec docs/superpowers/specs/2026-10-23-drop-fx-design.md), the pure parts of src/fx/feids-heat.js:
// the capsule's spindle (the demo's PROFILE, AXIAL_STRETCH 1.4) the flame trails follow, and the rock chunks' flight at a touchdown: thrown from a ring
// round the feet 6..11 m/s out and 4..8 m/s up, ballistic under 9.8 m/s2, resting on the ground after their flight and staying there, the same
// picture for the same clock (no history).
import assert from 'node:assert/strict';
import { PROFILE, radiusAt, chunkAt } from '../src/fx/feids-heat.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
// the spindle: 11 stations from -10.08 to 10.08 m, 3.75 m at the waist, the tips 0.04 m; radiusAt interpolates and is 0.08 beyond the shield
assert.equal(PROFILE.length, 11); assert.ok(near(PROFILE[0][0], -10.08) && near(PROFILE.at(-1)[0], 10.08));
assert.ok(near(radiusAt(0), 3.75)); assert.ok(near(radiusAt(-10.08), 0.04)); assert.equal(radiusAt(11), 0.08);
assert.ok(near(radiusAt(1.008), (3.75 + 3.6) / 2), 'halfway between two stations');
// the chunks: at the touchdown on the ring, rising, then down and resting where they fell, for every chunk of every mech
for (let index = 0; index < 4; index++) for (let i = 0; i < 24; i++) {
  const c0 = chunkAt(i, index, 0); assert.ok(near(Math.hypot(c0.x, c0.z), 0.8) && c0.y === 0 && !c0.resting, 'on the ring at the touchdown');
  const up = chunkAt(i, index, 0.2); assert.ok(up.y > 0 && Math.hypot(up.x, up.z) > 0.8, 'thrown out and up');
  const rest = chunkAt(i, index, 3), later = chunkAt(i, index, 20);
  assert.ok(rest.resting && rest.y === 0, 'resting on the ground after its flight (the longest is 16/9.8 s)');
  assert.deepEqual(later, rest, 'and staying there');
  const d = Math.hypot(rest.x, rest.z); assert.ok(d > 0.8 + 6 * (2 * 4 / 9.8) - 1e-9 && d < 0.8 + 11 * (2 * 8 / 9.8) + 1e-9, `chunk ${i} of ${index} lands ${d.toFixed(2)} m out`);
  for (let tau = 0; tau <= 3; tau += 0.05) assert.ok(chunkAt(i, index, tau).y >= 0, 'never under the ground');
  assert.deepEqual(chunkAt(i, index, 0.7), chunkAt(i, index, 0.7), 'a function of the clock');
}
console.log('feids-heat: the spindle the trails follow; 96 chunks thrown, landing 5..19 m out, resting and staying');
