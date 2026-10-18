import assert from 'node:assert/strict';
import { sunAngle, sunDirection, daylightOf } from '../src/core/daylight.js';
import { STORY_DAY } from '../src/content/story-defaults.js';
const { dayShare, tilt } = STORY_DAY;
const elev = (p) => sunDirection(sunAngle(p, dayShare), tilt)[1];
// dawn at phase 0, noon at half the day share, dusk at the day share, full night after
assert.ok(Math.abs(elev(0)) < 1e-9, 'dawn'); assert.ok(Math.abs(elev(dayShare)) < 1e-9, 'dusk');
assert.ok(Math.abs(elev(dayShare / 2) - Math.sin(tilt * Math.PI / 180)) < 1e-9, 'noon reaches sin(tilt)');
assert.ok(elev(dayShare + (1 - dayShare) / 2) < -0.8, 'deep night');
// the sun stays a unit vector and the pole spends dayShare of the period above the horizon
let up = 0; const N = 2000; for (let i = 0; i < N; i++) { const d = sunDirection(sunAngle(i / N, dayShare), tilt); assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9); if (d[1] > 0) up++; }
assert.ok(Math.abs(up / N - dayShare) < 0.01, `day share ${up / N}`);
// gradual: over a whole period the daylight scalar never jumps more than a sliver per step
// per three-hundredth of a day, whatever the day's length (2026-10-18: the day is a knob)
const dt = 1 / 300; let worst = 0, prev = daylightOf(elev(0));
for (let p = dt; p <= 1 + 1e-9; p += dt) { const d = daylightOf(elev(p)); worst = Math.max(worst, Math.abs(d - prev)); prev = d; }
assert.ok(worst < 0.05, `daylight step per three-hundredth of a day ${worst.toFixed(3)}`);
assert.equal(daylightOf(-1), 0); assert.equal(daylightOf(1), 1); assert.ok(daylightOf(0) > 0.05 && daylightOf(0) < 0.5, 'dawn is dim but not dark');
console.log(`Daylight: ${STORY_DAY.seconds} s period, ${Math.round(dayShare * 100)}% day at the pole, noon ${Math.round(Math.asin(elev(dayShare / 2)) * 180 / Math.PI)}° up, worst step ${worst.toFixed(3)} per 1/300 of a day.`);
