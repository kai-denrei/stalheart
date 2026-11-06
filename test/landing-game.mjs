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
import { BRIEFS } from '../src/isaobriefs.js';
for (const id of Object.values(LANDING_GAME.lines)) assert.ok(BRIEFS[id]?.lines?.length, `brief ${id} exists`);
assert.equal(BRIEFS.arrival_talk_clean.lines[0], 'Textbook landing!');
assert.equal(BRIEFS.arrival_talk_wreck.lines.length, 4, 'a wreck adds a fourth caption');
assert.equal(BRIEFS.arrival_talk_wreck.lines[3], "Less to cannibalize than I'd hoped.");
import { decideLanding } from '../src/platform/story-world.js';
const q = (s) => new URLSearchParams(s);
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: false, acceptance: false }), { manual: true, offer: false }, 'the first start flies it');
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: true, acceptance: false }), { manual: false, offer: true }, 'later starts are offered it');
assert.deepEqual(decideLanding({ arrives: true, query: q('landing=1'), flown: true, acceptance: true }), { manual: true, offer: false }, '?landing=1 forces it');
assert.deepEqual(decideLanding({ arrives: true, query: q('landing=offer'), flown: false, acceptance: true }), { manual: false, offer: true }, '?landing=offer: the gate offers it (the harness)');
assert.deepEqual(decideLanding({ arrives: true, query: q('landing=0'), flown: false, acceptance: false }), { manual: false, offer: false }, '?landing=0 never');
assert.deepEqual(decideLanding({ arrives: true, query: q(''), flown: false, acceptance: true }), { manual: false, offer: false }, 'an acceptance run lands itself unless it asks');
assert.deepEqual(decideLanding({ arrives: false, query: q('landing=1'), flown: false, acceptance: false }), { manual: false, offer: false }, 'no arrival, no landing');
console.log('landing-game: lines and switch ok');
