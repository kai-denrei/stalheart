import assert from 'node:assert/strict';
import { rotorVoice, hushRotor } from '../src/fx/rotor-voice.js';

// the Rotor's voices: the spool rides the spin, the fire loop runs while rounds leave the seat's gun, and a mount the frame stops
// stepping falls silent (2026-09-25 playtest: its spin and fire carried into the next seat)
const live = [];
const sfx = { loop: (key) => { const v = { key, stopped: false, gain: 0, set(g) { this.gain = g; }, stop() { this.stopped = true; } }; live.push(v); return v; } };
const playing = () => live.filter((v) => !v.stopped).map((v) => v.key).sort();
const tw = {};
rotorVoice(sfx, tw, { s01: 0.9, att: 1, povFiring: true });
assert.deepEqual(playing(), ['minigun_ready', 'rotor_pov_fire'], 'both voices while it spins and fires');
rotorVoice(sfx, tw, { s01: 0.9, att: 1, povFiring: true });
assert.equal(live.length, 2, 'a voice is started once, then re-levelled');
assert.equal(tw.spool.gain, 0.9);
rotorVoice(sfx, tw, { s01: 0.5, att: 1, povFiring: false });
assert.deepEqual(playing(), ['minigun_ready'], 'the fire stops with the rounds; the spin winds down');
rotorVoice(sfx, tw, { s01: 0.01, att: 1, povFiring: false });
assert.deepEqual(playing(), [], 'and the spin dies as the barrels stop');
rotorVoice(sfx, tw, { s01: 1, att: 1, povFiring: true });
assert.equal(playing().length, 2);
hushRotor(tw);
assert.deepEqual(playing(), [], 'a mount the frame stops stepping is silent at once');
assert.equal(tw.spool, null); assert.equal(tw.povFire, null);
hushRotor({});   // a mount that never spoke
console.log('Rotor voice: the spool rides the spin, the fire rides the rounds, and a mount left behind is hushed.');
