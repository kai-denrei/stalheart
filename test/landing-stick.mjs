// landing-stick.mjs — the floating stick's rates (src/fx/landing-stick.js stickRates): the dead zone, the full throw, the clamp, the axes' signs
import assert from 'node:assert/strict';
import { stickRates, createStick } from '../src/fx/landing-stick.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
const S = LANDING_GAME.input.stick, r = (dx, dy) => stickRates(dx, dy, S);
assert.deepEqual(r(0, 0), { tiltRate: 0, bankRate: 0 });
assert.deepEqual(r(4, -4), { tiltRate: 0, bankRate: 0 }, 'inside the dead zone');
assert.ok(Math.abs(r(48, 0).bankRate - 1) < 1e-12 && r(48, 0).tiltRate === 0, 'a full throw right is bank +1');
assert.ok(Math.abs(r(-48, 0).bankRate + 1) < 1e-12, 'left is -1');
assert.ok(Math.abs(r(0, -48).tiltRate - 1) < 1e-12, 'a drag UP is the nose forward, +1');
assert.ok(Math.abs(r(0, 48).tiltRate + 1) < 1e-12, 'down is back');
assert.ok(Math.abs(r(200, 0).bankRate - 1) < 1e-12, 'clamped past the full throw');
assert.ok(Math.abs(r(26.5, 0).bankRate - 0.5) < 1e-9, 'linear past the dead zone: (26.5 - 5) / 43');
// no DOM (node, or a missing root): an inert stick, its rates 0, reset and dispose no-ops
for (const root of [null, undefined, {}]) {
  const k = createStick(root, { ...S, enabled: () => true });
  assert.deepEqual([k.tiltRate, k.bankRate], [0, 0]); k.reset(); k.dispose();
}
console.log('landing-stick: ok');
