// landing-game.mjs — the tune's shape: every grade's salvage is a foundry configuration the beats can take
import assert from 'node:assert/strict';
import { LANDING_GAME } from '../src/content/landing-game.js';
import { FOUNDRY_TUNE } from '../src/content/foundry.js';

assert.ok(Object.isFrozen(LANDING_GAME), 'the tune is frozen');
for (const grade of ['CLEAN', 'HARD', 'WRECK']) {
  const s = LANDING_GAME.salvage[grade];
  assert.ok(s, `salvage for ${grade}`);
  assert.ok(s.sections >= 1 && s.sections <= FOUNDRY_TUNE.sections.length, `${grade}: sections within the foundry's`);
  assert.ok(s.feedstockPerBarrel > 0 && s.bonus >= 0, `${grade}: a barrel's worth and a bonus count`);
}
assert.ok(LANDING_GAME.vehicle.thrust > LANDING_GAME.sim.gravity, 'full thrust beats gravity (a hoverslam is possible)');
assert.ok(LANDING_GAME.vehicle.minThrottle * LANDING_GAME.vehicle.thrust < LANDING_GAME.sim.gravity, 'idle thrust does not hover (the brief: the rocket cannot hover)');
assert.ok(LANDING_GAME.flare.altitude > 0 && LANDING_GAME.flare.sink > LANDING_GAME.verdict.clean.sink, 'the flare corridor is wider than CLEAN');
console.log('landing-game: ok');
import { STORY_ARRIVAL, STORY_ARRIVAL_MANUAL } from '../src/content/story-defaults.js';
assert.equal(STORY_ARRIVAL_MANUAL.landing.descent, LANDING_GAME.approach.descent);
assert.equal(STORY_ARRIVAL_MANUAL.landing.startAltitude, LANDING_GAME.approach.startAltitude);
const shift = LANDING_GAME.approach.descent - STORY_ARRIVAL.landing.descent;
const oldDown = STORY_ARRIVAL.landing.orbit + STORY_ARRIVAL.landing.descent;
for (const k of STORY_ARRIVAL.rail) { const m = STORY_ARRIVAL_MANUAL.rail.find((x) => x.pos === k.pos); assert.ok(m); assert.equal(m.t, k.t >= oldDown ? k.t + shift : k.t, 'rail keys after the touchdown move with it'); }
assert.ok(LANDING_GAME.approach.overrideAt < STORY_ARRIVAL_MANUAL.landing.descent, 'the override comes before the sequence would have touched down');
console.log('landing-game: arrival tune ok');
