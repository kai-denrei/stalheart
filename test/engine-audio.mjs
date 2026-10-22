// engine-audio.mjs — the hull's engine (src/fx/engine-audio.js, moved out of src/td-tab.js in refactor round 2) over a recording
// sfx: a moving hull spools up once and the thruster bed follows the smoothed level; stillness past ENGINE_STOP (0.10 s) fades the
// bed and plays the spool-down once with the feel's landing; a quiet stop plays nothing; a zero dt and a missing hull are ignored;
// the bed is retried every frame until its buffer has decoded.
import assert from 'node:assert/strict';
import { makeTankFeel } from '../src/tankfeel.js';
import { createEngineAudio } from '../src/fx/engine-audio.js';

const log = [];
const take = () => log.splice(0);
let decoded = false;
const sfx = {
  play: (n) => log.push(['play', n]),
  loop: (n, o) => { log.push(['loop', n, o.gain, o.rate]); return decoded ? { stop: (f) => log.push(['stop', f]), set: (g, r) => log.push(['set', +g.toFixed(4), +r.toFixed(4)]) } : null; },
};
const S = { mesh: {}, paused: false };
const feel = makeTankFeel(), player = { pos: [0, 0, 1], won: false };
const engine = createEngineAudio({
  sfx, feel, player, params: { speed: 1 }, steerEase: { rate: 0 },
  playerMesh: () => S.mesh, cellSide: () => 0.08, paused: () => S.paused, kick: () => ({ roll: 0 }),
});
assert.deepEqual(Object.keys(engine).sort(), ['stop', 'update'], 'the surface is stop and update');
const drive = (dt, step) => { player.pos = [player.pos[0] + step, player.pos[1], player.pos[2]]; engine.update(dt); };

// ---- the first frame only takes the position; a zero dt and a missing hull do nothing
engine.update(1 / 60);
engine.update(0); S.mesh = null; drive(1 / 60, 0.05); S.mesh = {};
assert.deepEqual(take(), [], 'no sound before there is a previous position, at dt 0, or without a hull');

// ---- moving: the spool-up once; the bed asked for every frame until it decodes, then set from the level
drive(1 / 60, 0.01);
assert.deepEqual(take(), [['play', 'tank_spool_up'], ['loop', 'tank_thruster', 0.001, 0.92]], 'hydraulics lift it, the bed is asked for (not decoded yet)');
drive(1 / 60, 0.01);
assert.deepEqual(take(), [['loop', 'tank_thruster', 0.001, 0.92]], 'no second spool-up; the bed retried');
decoded = true;
drive(1 / 60, 0.01);
let got = take();
assert.equal(got.length, 2); assert.equal(got[0][0], 'loop'); assert.equal(got[1][0], 'set', 'the decoded bed takes the level at once');
const lv = (g) => (g - 0.34) / 0.66;
const l1 = lv(got[1][1]);
assert.ok(l1 > 0 && l1 <= 1, 'gain 0.34..1 over the level');
assert.equal(got[1][2], +(0.92 + 0.22 * l1).toFixed(4), 'pitch 0.92..1.14 on the same level');
drive(1 / 60, 0.01);
got = take();
assert.deepEqual(got.map((x) => x[0]), ['set'], 'a running bed is only set');
assert.ok(lv(got[0][1]) > l1, 'the level spins up while the hull moves');
assert.ok(feel.t > 0, 'the hull\'s feel is stepped by the engine\'s frame');

// ---- stillness: the level falls; past ENGINE_STOP the bed fades and the spool-down plays once, with the landing
let frames = 0;
while (!log.some((x) => x[0] === 'stop') && frames < 600) { drive(1 / 60, 0); frames++; }
got = take();
assert.ok(frames > 6, 'the bed outlasts the first still frames (the level spools down slowly)');
const stop = got.findIndex((x) => x[0] === 'stop');
assert.deepEqual(got.slice(stop), [['stop', 0.1], ['play', 'tank_spool_down']], 'the bed fades over ENGINE_STOP and the hydraulics set it down');
assert.equal(feel.settleT, 0, 'the landing rocks the hull');
drive(1 / 60, 0); assert.deepEqual(take(), [], 'stopped stays quiet');

// ---- paused: the level does not count as moving
S.paused = true; drive(1 / 60, 0.02); assert.deepEqual(take(), [], 'no spool-up while paused');
S.paused = false;

// ---- a quiet stop (leaving the tab, a new deploy) fades the bed and plays nothing
drive(1 / 60, 0.02); drive(1 / 60, 0.02); take();
feel.settleT = 5;
engine.stop(0.1, true);
assert.deepEqual(take(), [['stop', 0.1]], 'quiet: the bed fades, no spool-down');
assert.equal(feel.settleT, 5, 'and no landing');
engine.stop(); assert.deepEqual(take(), [], 'nothing running, nothing to stop');
console.log('Engine audio: spool-up once, the bed follows the level, stillness fades it with one spool-down and a landing, quiet stops are silent.');
