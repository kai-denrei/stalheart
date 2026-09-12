import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
// a fake game: records everything; a tower stands N seconds after the order; fodder reaches the gate M seconds after the first spawn
function fakeGame({ printSeconds = 6, cost = 45, walk = 3 } = {}) {
  const log = []; let orderedAt = null, clock = 0, alive = 0, firstSpawn = null, killed = 0;
  return { log, tick: (dt) => { clock += dt; }, kill: (n) => { alive = Math.max(0, alive - n); killed += n; }, api: {
    cost: () => cost, isao: () => true, enemies: () => alive, kills: () => killed,
    grant: (n) => { log.push(['grant', n]); },
    order: (key, ci) => { log.push(['order', key, ci]); orderedAt = clock; return true; },
    built: () => orderedAt !== null && clock - orderedAt >= printSeconds,
    brief: (id) => { log.push(['brief', id]); },
    tremor: (ci) => { log.push(['tremor', ci]); },
    breach: (ci) => { log.push(['breach', ci]); },
    near: () => firstSpawn !== null && clock - firstSpawn >= walk,
    pilot: (ci, lane) => { log.push(['pilot', ci, lane]); },
    unlock: (what) => { log.push(['unlock', what]); },
    spawn: (type, ci) => { log.push(['spawn', type, ci]); alive++; if (firstSpawn === null) firstSpawn = clock; },
  } };
}
const run = (beats, g, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) { g.tick(0.1); beats.tick(0.1, g.api); } };
const kinds = (g, k) => g.log.filter((l) => l[0] === k);

// gated world: tremor, breach, approach, override, then control; fodder capped
{
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 2, fodderAlive: 3, fodderTotal: 5, tremorDelay: 1, breachDelay: 2, overrideDelay: 1 });
  const g = fakeGame({ walk: 3 });
  assert.equal(beats.state().phase, 'landed'); assert.equal(beats.state().gated, true);
  run(beats, g, 1.5); assert.deepEqual(g.log, [['brief', 'rough_landing']], 'the angry face first, nothing ordered yet');
  run(beats, g, 1.0); assert.deepEqual(g.log.slice(1), [['grant', 45], ['order', 'rotor', 4242]]); assert.equal(beats.state().phase, 'printing');
  run(beats, g, 2.0); assert.deepEqual(kinds(g, 'brief').map((l) => l[1]), ['rough_landing', 'so_much_to_build'], 'then the happy face');
  run(beats, g, 4.0); assert.equal(beats.state().phase, 'rotor-ready');
  run(beats, g, 1.1); assert.equal(beats.state().phase, 'tremor'); assert.deepEqual(kinds(g, 'tremor'), [['tremor', 4300]]); assert.equal(kinds(g, 'brief').at(-1)[1], 'tremor');
  assert.equal(kinds(g, 'pilot').length, 0, 'no control before the enemies are at the gate');
  run(beats, g, 2.1); assert.equal(beats.state().phase, 'breach'); assert.deepEqual(kinds(g, 'breach'), [['breach', 4300]]); assert.deepEqual(kinds(g, 'tremor').at(-1), ['tremor', -1], 'the radar contact clears when the ground opens');
  run(beats, g, 1.2); assert.equal(beats.state().phase, 'approach'); assert.equal(kinds(g, 'spawn').length, 1, 'fodder emerges from the breach');
  run(beats, g, 3.0); assert.equal(beats.state().phase, 'override'); assert.equal(kinds(g, 'brief').at(-1)[1], 'manual_override');
  run(beats, g, 1.1); assert.equal(beats.state().phase, 'piloting'); assert.deepEqual(kinds(g, 'pilot'), [['pilot', 4242, 4243]]);
  run(beats, g, 6); assert.equal(kinds(g, 'spawn').length, 3, 'cap on living fodder holds');
  g.kill(3); run(beats, g, 10); assert.equal(kinds(g, 'spawn').length, 5, 'total cap holds');
  assert.ok(kinds(g, 'spawn').every((l) => l[1] === 'phage' && l[2] === 4300));
  assert.equal(kinds(g, 'pilot').length, 1, 'control taken once');
  // the fifth kill: the comms study; and with the five-strong wave spent and nothing standing, the wave is cleared: Isao's line, the views unlock, once
  g.kill(1); run(beats, g, 0.5); assert.ok(!kinds(g, 'brief').some((l) => l[1] === 'alien_comms'), 'five kills first'); assert.equal(beats.state().phase, 'piloting', 'one still standing');
  g.kill(1); run(beats, g, 0.5); assert.deepEqual(kinds(g, 'brief').slice(-2).map((l) => l[1]), ['alien_comms', 'wave_cleared']); assert.equal(beats.state().phase, 'cleared'); assert.deepEqual(kinds(g, 'unlock'), [['unlock', 'views']]);
  run(beats, g, 5); assert.equal(kinds(g, 'brief').filter((l) => l[1] === 'wave_cleared').length, 1, 'said once'); assert.equal(kinds(g, 'unlock').length, 1); assert.ok(!kinds(g, 'brief').some((l) => l[1] === 'harvest_biomass'), 'no tenth kill in a five-strong wave');
}
// a longer wave: the tenth kill brings the biomass line, said once, and the wave is not cleared while any of it stands
{
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1 });
  const g = fakeGame({ walk: 3 });
  run(beats, g, 17); assert.equal(beats.state().phase, 'piloting');
  for (let k = 0; k < 10; k++) { g.kill(1); run(beats, g, 1); }
  assert.equal(kinds(g, 'brief').filter((l) => l[1] === 'harvest_biomass').length, 1, 'the tenth kill, once'); assert.equal(beats.state().phase, 'piloting', 'two of twelve still to come');
  g.kill(2); run(beats, g, 3); assert.equal(beats.state().phase, 'cleared'); assert.equal(kinds(g, 'brief').at(-1)[1], 'wave_cleared');
}
// ungated world (no gate yet): straight to control, no fodder
{
  const beats = makeStoryBeats({ socket: 7, lane: 8, fodder: -1, gate: -1, rotorDelay: 0, controlDelay: 1 });
  const g = fakeGame();
  run(beats, g, 8); assert.equal(beats.state().phase, 'piloting'); assert.equal(kinds(g, 'spawn').length, 0); assert.equal(kinds(g, 'tremor').length, 0);
}
// an order that fails is retried next tick, not forgotten
{
  const beats2 = makeStoryBeats({ socket: 7, rotorDelay: 0, key: 'rotor' });
  let attempts = 0; const api2 = { cost: () => 45, isao: () => true, grant() {}, order() { attempts++; return attempts >= 3; }, built: () => false, enemies: () => 0 };
  for (let i = 0; i < 5; i++) beats2.tick(0.5, api2);
  assert.equal(attempts, 3, 'retries until the order is accepted');
}
console.log('Story beats: faces, Rotor print, tremor, breach, approach, override, control, capped fodder.');
