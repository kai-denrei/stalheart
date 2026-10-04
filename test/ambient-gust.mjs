// ambient-gust — the wind only in the quiet: nothing while a one-shot plays (loops aside), one gust after `quiet` seconds of stillness,
// then none for at least the shortest gap.
import assert from 'node:assert/strict';
import { createAmbientGust } from '../src/fx/ambient-gust.js';
let active = [], played = [];
const sfx = { get activeVoices() { return active; }, play: (k) => played.push(k) };
const g = createAmbientGust(sfx, { tune: { key: 'gust', quiet: 5, gap: [30, 30] }, rand: () => 0 });
active = [{ key: 'kinetic_fire', loop: false }];
for (let i = 0; i < 400; i++) g.tick(0.05);
assert.equal(played.length, 0, 'never while a one-shot plays');
active = [{ key: 'tank_engine', loop: true }];
for (let i = 0; i < 99; i++) g.tick(0.05);
assert.equal(played.length, 0, 'not before `quiet` seconds of stillness');
for (let i = 0; i < 3; i++) g.tick(0.05);
assert.deepEqual(played, ['gust'], 'a gust in the quiet, loops notwithstanding');
for (let i = 0; i < 590; i++) g.tick(0.05);
assert.equal(played.length, 1, 'no second gust inside the gap');
for (let i = 0; i < 20; i++) g.tick(0.05);
assert.equal(played.length, 2, 'and the next after it');
assert.equal(createAmbientGust(null).tick(1), undefined, 'no engine, no crash');
console.log('Ambient gust: only in the quiet, then a rest between gusts.');
