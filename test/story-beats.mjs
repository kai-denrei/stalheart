import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
// a fake game: records grants, orders, control and spawns; reports a tower built N seconds after the order
function fakeGame({ printSeconds = 6, cost = 45 } = {}) {
  const log = []; let orderedAt = null, clock = 0, alive = 0;
  return { log, tick: (dt) => { clock += dt; }, kill: (n) => { alive = Math.max(0, alive - n); }, api: {
    cost: () => cost, isao: () => true, enemies: () => alive,
    grant: (n) => { log.push(['grant', n]); },
    order: (key, ci) => { log.push(['order', key, ci]); orderedAt = clock; return true; },
    built: () => orderedAt !== null && clock - orderedAt >= printSeconds,
    pilot: (ci, lane) => { log.push(['pilot', ci, lane]); },
    spawn: (type, ci) => { log.push(['spawn', type, ci]); alive++; },
  } };
}
const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, rotorDelay: 2, key: 'rotor', fodderEvery: 2, fodderAlive: 3, fodderTotal: 5, controlDelay: 1 });
const g = fakeGame();
assert.equal(beats.state().phase, 'landed');
for (let t = 0; t < 1.5; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.deepEqual(g.log, [], 'Isao waits before the first order');
for (let t = 0; t < 1; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.deepEqual(g.log, [['grant', 45], ['order', 'rotor', 4242]], 'the Rotor is paid for and ordered once');
assert.equal(beats.state().phase, 'printing');
for (let t = 0; t < 5.6; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.equal(beats.state().phase, 'rotor-ready');
for (let t = 0; t < 1.2; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.equal(beats.state().phase, 'piloting');
assert.deepEqual(g.log[2], ['pilot', 4242, 4243], 'control is taken once the Rotor stands');
// fodder: one every two seconds, never more than three alive, five in total
for (let t = 0; t < 7; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.equal(g.log.filter((l) => l[0] === 'spawn').length, 3, 'cap on living fodder holds');
g.kill(3);
for (let t = 0; t < 10; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); }
assert.equal(g.log.filter((l) => l[0] === 'spawn').length, 5, 'total cap holds');
assert.ok(g.log.filter((l) => l[0] === 'spawn').every((l) => l[1] === 'phage' && l[2] === 4300), 'fodder is phage at the lane cell');
assert.equal(g.log.filter((l) => l[0] === 'pilot').length, 1, 'control taken once');
// an order that fails is retried next tick, not forgotten
const beats2 = makeStoryBeats({ socket: 7, rotorDelay: 0, key: 'rotor' });
let attempts = 0; const api2 = { cost: () => 45, isao: () => true, grant() {}, order() { attempts++; return attempts >= 3; }, built: () => false, enemies: () => 0 };
for (let i = 0; i < 5; i++) beats2.tick(0.5, api2);
assert.equal(attempts, 3, 'retries until the order is accepted');
console.log('Story beats: wait, grant, order the Rotor once, take control, spawn capped fodder down the lane.');
