import assert from 'node:assert/strict';
import { dayFlag, phaseGlyph, sunAngle } from '../src/core/daylight.js';
import { STORY_DAY } from '../src/content/story-defaults.js';

// ?day= (2026-10-18, DAY 42): below 1 a starting phase, 1 or more a day number, the fraction past it the phase into that day
assert.deepEqual(dayFlag(null), { phase: 0, day: 1 });
assert.deepEqual(dayFlag(''), { phase: 0, day: 1 });
assert.deepEqual(dayFlag('0.3'), { phase: 0.3, day: 1 });
assert.deepEqual(dayFlag('42'), { phase: 0, day: 42 });
assert.deepEqual(dayFlag('42.5'), { phase: 0.5, day: 42 });
assert.deepEqual(dayFlag('nonsense'), { phase: 0, day: 1 });
assert.deepEqual(dayFlag('-3'), { phase: 0, day: 1 });

// the glyph: a half-lit disc at dawn, full at noon, half at dusk, dark at midnight; waning from noon to midnight
const { dayShare } = STORY_DAY, near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);
near(phaseGlyph(0, dayShare).lit, 0.5, 'dawn half'); assert.equal(phaseGlyph(0, dayShare).waning, false, 'dawn waxes');
near(phaseGlyph(dayShare / 2, dayShare).lit, 1, 'noon full');
near(phaseGlyph(dayShare, dayShare).lit, 0.5, 'dusk half'); assert.equal(phaseGlyph(dayShare, dayShare).waning, true, 'dusk wanes');
near(phaseGlyph(dayShare + (1 - dayShare) / 2, dayShare).lit, 0, 'midnight dark');
// the terminator's half-width is |1 - 2 lit|, bulging into the dark side when more than half is lit
near(phaseGlyph(dayShare / 2, dayShare).rx, 1, 'noon: the terminator is the rim'); near(phaseGlyph(0, dayShare).rx, 0, 'dawn: a straight terminator');
assert.equal(phaseGlyph(dayShare / 4, dayShare).bulge, 'lit'); assert.equal(phaseGlyph(dayShare + 0.05, dayShare).bulge, 'dark');
// monotone: the lit fraction rises through the morning and falls through the night, never jumping
let prev = phaseGlyph(0, dayShare).lit; for (let i = 1; i <= 1000; i++) { const g = phaseGlyph(i / 1000, dayShare); assert.ok(Math.abs(g.lit - prev) < 0.02, `continuous at ${i}`); if (i / 1000 < dayShare / 2) assert.ok(g.lit >= prev - 1e-12, 'rises to noon'); prev = g.lit; }
// the sun's angle is the source: lit = (1 - cos angle) / 2
near(phaseGlyph(0.17, dayShare).lit, (1 - Math.cos(sunAngle(0.17, dayShare))) / 2, 'from the angle');

// the day is thirty seconds (owner, 2026-10-18: about eighty days in a forty-minute run)
assert.equal(STORY_DAY.seconds, 30);
console.log('daylight-day ok');
