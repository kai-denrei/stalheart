import assert from 'node:assert/strict';
import { LANDING_DEFAULTS } from '../src/content/story-defaults.js';
import { makeLandingSequence } from '../src/domain/landing-sequence.js';
const seq = makeLandingSequence(LANDING_DEFAULTS);
const T = LANDING_DEFAULTS, touchdown = T.orbit + T.descent;
assert.equal(seq.touchdown, touchdown);
assert.equal(seq.duration, touchdown + T.shock + T.settle + T.door + T.isao + T.isaoHold);
// orbit is a camera beat: the rocket is already burning and falling when it opens
const s0 = seq.stateAt(1);
assert.equal(s0.phase, 'orbit'); assert.ok(s0.altitude < T.startAltitude && s0.altitude > 0, 'already descending'); assert.ok(s0.plume > 0.9, 'thrusters lit from the first frame');
assert.equal(seq.stateAt(0).plume > 0, true);
// descent: altitude falls monotonically to zero, plume on
let prev = Infinity;
for (let t = 0; t <= touchdown; t += 0.05) { const s = seq.stateAt(t); assert.ok(s.altitude <= prev + 1e-9, `altitude falls at ${t}`); prev = s.altitude; }
assert.equal(seq.stateAt(touchdown).altitude, 0);
assert.ok(seq.stateAt(T.orbit + 2).plume > 0.5, 'plume burns during descent');
assert.equal(seq.stateAt(touchdown + 0.01).plume, 0, 'plume cut at touchdown');
// legs: deploy starts when altitude reaches deployAltitude and completes before touchdown
assert.ok(seq.legsStart > 0 && seq.legsStart + T.legsDeploy <= touchdown, `legs deploy ${seq.legsStart} finishes before ${touchdown}`);
assert.ok(Math.abs(seq.stateAt(seq.legsStart).altitude - T.deployAltitude) < 0.5, 'deploy begins at the deploy altitude');
assert.equal(seq.stateAt(seq.legsStart - 0.01).clips.Legs_Deploy, null);
assert.equal(seq.stateAt(touchdown).clips.Legs_Deploy, T.legsDeploy, 'deploy clip held at its end');
// touchdown: shock starts, dust only in the touchdown window, scorch from touchdown on
assert.equal(seq.stateAt(touchdown - 0.01).clips.Landing_Shock, null);
assert.ok(Math.abs(seq.stateAt(touchdown + 1).clips.Landing_Shock - 1) < 1e-9);
assert.equal(seq.stateAt(touchdown + T.shock + 5).clips.Landing_Shock, T.shock, 'shock held at its end');
assert.equal(seq.stateAt(touchdown - 0.01).dust, false); assert.equal(seq.stateAt(touchdown + 0.5).dust, true); assert.equal(seq.stateAt(touchdown + T.dustSeconds + 0.1).dust, false);
assert.equal(seq.stateAt(touchdown - 0.01).scorch, false); assert.equal(seq.stateAt(touchdown).scorch, true);
// door after settle, Isao after door
const doorAt = touchdown + T.shock + T.settle;
assert.equal(seq.stateAt(doorAt - 0.01).clips.Top_Door_Open, null);
assert.ok(Math.abs(seq.stateAt(doorAt + 0.9).clips.Top_Door_Open - 0.9) < 1e-9);
assert.equal(seq.stateAt(doorAt + T.door - 0.01).isaoRise, 0, 'Isao waits for the door');
assert.ok(seq.stateAt(doorAt + T.door + T.isao / 2).isaoRise > 0.3);
// end and skip agree
const end = seq.stateAt(seq.duration + 10);
assert.equal(end.phase, 'done'); assert.equal(end.isaoRise, 1); assert.equal(end.clips.Top_Door_Open, T.door); assert.equal(end.altitude, 0);
assert.deepEqual(seq.skip(), seq.stateAt(seq.duration));
// phases in order
const phases = [1, 5, 12.5, 15, 16.5, 19, 28, 40].map(t => seq.stateAt(t).phase);
assert.deepEqual(phases, ['orbit', 'descent', 'touchdown', 'settle', 'door', 'isao', 'hold', 'done']);
assert.equal(seq.stateAt(28).isaoRise, 1, 'he stays out through the hold');
console.log('Landing sequence: legs deploy before touchdown, plume cut, dust window, door then Isao, skip equals end.');
