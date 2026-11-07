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
assert.ok(LANDING_GAME.approach.overrideAt < STORY_ARRIVAL_MANUAL.landing.descent, "the story lab's rehearsed override comes before its sequence would have touched down");
assert.ok(!('deployAltitude' in LANDING_GAME.approach), 'the approach no longer sets the legs (spec 14 C: no approach on a flown landing)');
assert.equal(STORY_ARRIVAL_MANUAL.landing.deployAltitude, STORY_ARRIVAL.landing.deployAltitude, "the resumed sequence's legs are the base's");
assert.ok(LANDING_GAME.override.aimWait > 0 && LANDING_GAME.override.seconds === 1.5, 'the hand-over in motion: a bounded wait for the aim, the 1.5 s burn');
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
assert.deepEqual(LANDING_GAME.signature, { seconds: 8, hold: 3, yEnd: -1048576, blend: 3 }, "the 2D game's opening: 8 s, a 3 s hold, black at the end; its last 3 s the cross-fade (spec 15 B)");
assert.ok(LANDING_GAME.signature.blend < LANDING_GAME.signature.seconds - LANDING_GAME.signature.hold, 'the blend falls in the ramp, after the hold');
assert.ok(LANDING_GAME.signature.blend > LANDING_GAME.override.seconds, 'the override beat runs under the blend: MANUAL comes before the side view holds');
assert.deepEqual(LANDING_GAME.camera.intro, { back: 22, up: -6, fov: 40, hold: 1 }, 'spec 15 B (pulled out from 6 / -2, then 16, 2026-11-07): the engine shot 22 m off the engines, 6 m under, a 40 degree lens, held 1 s');
assert.ok(LANDING_GAME.camera.intro.hold < LANDING_GAME.signature.blend, 'the hold leaves a pull-back'); assert.ok(LANDING_GAME.override.seconds > LANDING_GAME.camera.intro.hold, 'MANUAL comes mid-pull-back, after the hold');
assert.ok(Object.isFrozen(LANDING_GAME.camera.intro)); assert.ok(LANDING_GAME.camera.intro.fov < LANDING_GAME.camera.fov, 'the engine shot narrower than the side view');
assert.ok(Object.isFrozen(LANDING_GAME.signature));
assert.equal(LANDING_GAME.input.burnKey, ' ', 'Space is the burn');
assert.deepEqual(LANDING_GAME.input, { skipKey: 'Escape', burnKey: ' ' }, 'spec 14 B: Space, A/D and L are keys of the host; the tune holds the skip and the burn only');
assert.equal(LANDING_GAME.input.step, undefined, 'no stepped throttle');
assert.deepEqual(LANDING_GAME.override.glare, { seconds: 1.2 }, 'the override is a plain fade: the shader is the signature');
// spec 14 B: the entry retuned so a miss is the player's doing; the override beat 1.5 s
assert.deepEqual(LANDING_GAME.entry.drift, [4, 7], 'drift 4-7 m/s'); assert.deepEqual(LANDING_GAME.entry.tilt, [0.15, 0.25], 'tilt 0.15-0.25 rad');
assert.deepEqual(LANDING_GAME.entry.altitude, [300, 400], 'the altitude as before'); assert.deepEqual(LANDING_GAME.entry.sink, [30, 40], 'the sink as before');
assert.equal(LANDING_GAME.override.seconds, 1.5, 'the override beat 1.5 s');
console.log('landing-game: signature and entry ok');
