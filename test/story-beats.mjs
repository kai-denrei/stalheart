import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
// a fake game: records grants and orders, reports a tower built N seconds after the order
function fakeGame({ printSeconds = 6, cost = 45 } = {}) {
  const log = []; let orderedAt = null, clock = 0;
  return { log, tick: (dt) => { clock += dt; }, api: {
    cost: () => cost, isao: () => true,
    grant: (n) => { log.push(['grant', n]); },
    order: (key, ci) => { log.push(['order', key, ci]); orderedAt = clock; return true; },
    built: () => orderedAt !== null && clock - orderedAt >= printSeconds,
  } };
}
const beats = makeStoryBeats({ socket: 4242, rotorDelay: 2, key: 'rotor' });
const g = fakeGame();
assert.equal(beats.state().phase, 'landed');
for (let t = 0; t < 1.5; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.deepEqual(g.log, [], 'Isao waits before the first order');
for (let t = 0; t < 1; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.deepEqual(g.log, [['grant', 45], ['order', 'rotor', 4242]], 'the Rotor is paid for and ordered once');
assert.equal(beats.state().phase, 'printing');
for (let t = 0; t < 8; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.equal(beats.state().phase, 'rotor-ready');
assert.equal(g.log.length, 2, 'no repeat orders');
// an order that fails is retried next tick, not forgotten
const beats2 = makeStoryBeats({ socket: 7, rotorDelay: 0, key: 'rotor' });
let attempts = 0; const api2 = { cost: () => 45, isao: () => true, grant() {}, order() { attempts++; return attempts >= 3; }, built: () => false };
for (let i = 0; i < 5; i++) beats2.tick(0.5, api2);
assert.equal(attempts, 3, 'retries until the order is accepted');
assert.equal(beats2.state().phase, 'printing');
console.log('Story beats: wait, grant, order the Rotor once, retry a refused order, notice the print.');
