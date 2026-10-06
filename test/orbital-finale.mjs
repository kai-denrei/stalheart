// The orbital constellation's choreography (src/fx/orbital-finale.js constellationState, after A6's First Light timeline): from 50 s
// to 100 s the HEL-01 heads go up one by one and all 48 are on their rings by the end, never inside the planet, the camera pulling back.
import assert from 'node:assert/strict';
const { constellationState, mirrorOrbit } = await import('../src/fx/orbital-finale.js');
let last = -1;
for (let t = 50; t <= 100; t += 0.5) { const s = constellationState(t); assert.ok(s.deployed >= last, `deployments never go back (${t} s)`); last = s.deployed; }
assert.equal(constellationState(50).deployed, 0, 'none up at the start of the chapter');
assert.equal(constellationState(100).deployed, 48, 'all forty-eight by the end');
const C = [0, -195, 0], d = (p) => Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]);
for (let i = 0; i < 48; i++) for (const t of [60, 80, 100]) assert.ok(d(mirrorOrbit(i, t)) > 195 * 1.5, 'a ring is well clear of the planet');
const a = constellationState(60).camera, b = constellationState(95).camera;
assert.ok(Math.hypot(...b) > Math.hypot(...a) * 2, 'the camera pulls back to the whole constellation');
console.log(`Orbital finale: 48 heads up between 52.4 s and ${(52.4 + 47 * 0.65 + 5).toFixed(1)} s; camera ${Math.hypot(...a).toFixed(0)} -> ${Math.hypot(...b).toFixed(0)}.`);
