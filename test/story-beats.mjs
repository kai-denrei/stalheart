import assert from 'node:assert/strict';
import { makeStoryBeats } from '../src/domain/story-beats.js';
// a fake game: records everything; a tower stands N seconds after the order; fodder reaches the gate M seconds after the first spawn
function fakeGame({ printSeconds = 6, cost = 45, walk = 3 } = {}) {
  const log = []; let orderedAt = null, clock = 0, alive = 0, firstSpawn = null, killed = 0, sealed = false;
  const g = { log, talking: true, screenUp: true, tick: (dt) => { clock += dt; }, kill: (n) => { alive = Math.max(0, alive - n); killed += n; }, seal: () => { sealed = true; }, api: {
    cost: () => cost, isao: () => true, enemies: () => alive, kills: () => killed,
    grant: (n) => { log.push(['grant', n]); },
    order: (key, ci) => { log.push(['order', key, ci]); orderedAt = clock; return true; },
    built: () => orderedAt !== null && clock - orderedAt >= printSeconds,
    brief: (id) => { log.push(['brief', id]); },
    tremor: (ci) => { log.push(['tremor', ci]); },
    breach: (ci) => { log.push(['breach', ci]); sealed = false; },
    near: () => firstSpawn !== null && clock - firstSpawn >= walk,
    pilot: (ci, lane) => { log.push(['pilot', ci, lane]); },
    unlock: (what) => { log.push(['unlock', what]); },
    screen: (id) => { log.push(['screen', id]); },
    sourceAlive: () => sealed === false,
    spawn: (type, ci, o) => { log.push(o ? ['spawn', type, ci, o] : ['spawn', type, ci]); alive++; if (firstSpawn === null) firstSpawn = clock; },
    closeup: (who) => { log.push(['closeup', who]); }, briefing: () => g.talking, screenOpen: () => g.screenUp,
    sites: () => { log.push(['sites']); }, planetView: () => { log.push(['planetView']); },
  } };
  return g;
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
  assert.ok(kinds(g, 'spawn').every((l) => l[1] === 'amoeba' && l[2] === 4300));
  assert.equal(kinds(g, 'pilot').length, 1, 'control taken once');
  // the fifth kill: the comms study; and with the five-strong wave spent and nothing standing, the wave is cleared: Isao's line, the views unlock, once
  g.kill(1); run(beats, g, 0.5); assert.ok(!kinds(g, 'brief').some((l) => l[1] === 'alien_comms'), 'five kills first'); assert.equal(beats.state().phase, 'piloting', 'one still standing');
  g.kill(1); run(beats, g, 0.5); assert.deepEqual(kinds(g, 'brief').slice(-2).map((l) => l[1]), ['alien_comms', 'wave_cleared']); assert.equal(beats.state().phase, 'cleared'); assert.deepEqual(kinds(g, 'unlock'), [['unlock', 'views']]);
  run(beats, g, 5); assert.equal(kinds(g, 'brief').filter((l) => l[1] === 'wave_cleared').length, 1, 'said once'); assert.equal(kinds(g, 'unlock').length, 1); assert.ok(!kinds(g, 'brief').some((l) => l[1] === 'harvest_biomass'), 'no tenth kill in a five-strong wave');
}
// a longer wave: the tenth kill brings the biomass line, said once, and the wave is not cleared while any of it stands
{
  const quiver = { key: 'quiver', delay: 0.6, hardcore: 'barbed', secondDelay: 9, studyDelay: 2, missile: {} };
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  run(beats, g, 17); assert.equal(beats.state().phase, 'piloting');
  for (let k = 0; k < 10; k++) { g.kill(1); run(beats, g, 1); }
  assert.equal(kinds(g, 'brief').filter((l) => l[1] === 'harvest_biomass').length, 1, 'the tenth kill, once'); assert.equal(beats.state().phase, 'piloting', 'two of twelve still to come');
  g.kill(2); run(beats, g, 0.5); assert.equal(beats.state().phase, 'cleared'); assert.equal(kinds(g, 'brief').at(-1)[1], 'wave_cleared');
  // THE QUIVER: printed across the lane while the wave was fought (ordered the moment the gate stood, 2026-09-24), so the moment the wave
  // is down a hard core rises and the optic is handed over at once; a second hard core later; settled once both are down
  assert.deepEqual(kinds(g, 'order').at(-1), ['order', 'quiver', 4244], 'the Quiver went on the book with the gate, before the wave');
  const spawns = kinds(g, 'spawn').length, breaches = kinds(g, 'breach').length, pilots = kinds(g, 'pilot').length;
  g.seal();   // the player filled the sinkhole with an orbital strike after the wave
  run(beats, g, 1); assert.equal(beats.state().phase, 'quiver-piloting', 'almost immediate: no printing wait, no walk to the gate');
  assert.equal(kinds(g, 'breach').length, breaches + 1, 'the sinkhole is opened again for the hard cores'); assert.deepEqual(kinds(g, 'spawn').at(-1), ['spawn', 'barbed', 4300]); assert.equal(kinds(g, 'spawn').length, spawns + 1);
  assert.deepEqual(kinds(g, 'pilot').at(-1), ['pilot', 4244, 4243]); assert.equal(kinds(g, 'pilot').length, pilots + 1); assert.equal(kinds(g, 'brief').at(-1)[1], 'quiver_override');
  run(beats, g, 7); assert.equal(kinds(g, 'spawn').length, spawns + 1, 'the second waits its delay'); run(beats, g, 2.5); assert.equal(kinds(g, 'spawn').length, spawns + 2, 'then the second hard core');
  g.kill(1); run(beats, g, 1); assert.equal(beats.state().phase, 'quiver-piloting', 'one still standing');
  g.kill(1); run(beats, g, 1); assert.equal(beats.state().phase, 'settled'); assert.equal(kinds(g, 'brief').at(-1)[1], 'quiver_cleared'); assert.deepEqual(kinds(g, 'unlock'), [['unlock', 'views'], ['unlock', 'views']]);
  run(beats, g, 0.5); assert.equal(beats.state().phase, 'settled', 'the screen waits its delay'); assert.equal(kinds(g, 'screen').length, 0);
  run(beats, g, 1); assert.equal(beats.state().phase, 'study-talk', 'a close-up of Isao first'); assert.deepEqual(kinds(g, 'closeup'), [['closeup', 'isao']]); assert.equal(kinds(g, 'brief').at(-1)[1], 'vibration_study'); assert.equal(kinds(g, 'screen').length, 0, 'the screen waits for his lines');
  g.talking = false; run(beats, g, 1); assert.equal(beats.state().phase, 'study'); assert.deepEqual(kinds(g, 'screen'), [['screen', 'synthetic']]);
  run(beats, g, 1); assert.equal(beats.state().phase, 'study', 'the screen stays up until it is closed');
  g.screenUp = false; run(beats, g, 0.5); assert.equal(beats.state().phase, 'expedition'); assert.equal(kinds(g, 'brief').at(-1)[1], 'rocket_sites'); assert.equal(kinds(g, 'sites').length, 1); assert.equal(kinds(g, 'planetView').length, 1, 'the planet pulled back, the landing sites marked');
  run(beats, g, 5); assert.equal(kinds(g, 'spawn').length, spawns + 2, 'nothing more comes'); assert.equal(kinds(g, 'screen').length, 1, 'shown once');
}
// ungated world (no gate yet): straight to control, no fodder
{
  const beats = makeStoryBeats({ socket: 7, lane: 8, fodder: -1, gate: -1, rotorDelay: 0, controlDelay: 1 });
  const g = fakeGame();
  run(beats, g, 8); assert.equal(beats.state().phase, 'piloting'); assert.equal(kinds(g, 'spawn').length, 0); assert.equal(kinds(g, 'tremor').length, 0);
}
// a growing base: the Rotor stands before the gate does, and the tremor waits for the gate, then its own delay
{
  let gateUp = false;
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 0, tremorDelay: 1.5, faceDelays: [0, 0], gateReady: () => gateUp });
  const g = fakeGame({ printSeconds: 1 });
  run(beats, g, 2.5); assert.equal(beats.state().phase, 'rotor-ready');
  run(beats, g, 12); assert.equal(beats.state().phase, 'rotor-ready', 'no tremor while the gate is unprinted'); assert.equal(kinds(g, 'tremor').length, 0); assert.equal(beats.state().gateAt, null);
  gateUp = true; run(beats, g, 1.2); assert.equal(beats.state().phase, 'rotor-ready', 'the tremor keeps its delay after the gate stands'); assert.ok(beats.state().gateAt > 14);
  run(beats, g, 0.6); assert.equal(beats.state().phase, 'tremor'); assert.deepEqual(kinds(g, 'tremor'), [['tremor', 4300]]);
}
// an order that fails is retried next tick, not forgotten
{
  const beats2 = makeStoryBeats({ socket: 7, rotorDelay: 0, key: 'rotor' });
  let attempts = 0; const api2 = { cost: () => 45, isao: () => true, grant() {}, order() { attempts++; return attempts >= 3; }, built: () => false, enemies: () => 0 };
  for (let i = 0; i < 5; i++) beats2.tick(0.5, api2);
  assert.equal(attempts, 3, 'retries until the order is accepted');
}
console.log('Story beats: faces, Rotor print, tremor, breach, approach, override, control, capped fodder.');

// THE FOUNDRY PAYS: with a foundry tune the Rotor is ordered only once the first barrel has landed, funded by that barrel and nothing conjured
{
  const tune = { deployDelay: 1, firstCycle: 4, cycleSeconds: 6, feedstockPerBarrel: 60, sections: ['A', 'B', 'C'], targets: ['tA', 'tB', 'tC'], events: { arcOn: 0.5, arcOff: 1, scrap: 2, barrel: 3 } };
  const g = fakeGame({ printSeconds: 2 }); g.api.foundry = (ev, d) => { g.log.push(['foundry', ev, d?.section ?? null]); };
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: -1, gate: -1, rotorDelay: 2, faceDelays: [0.5, 1], foundry: tune });
  run(beats, g, 2.5);
  assert.equal(beats.state().phase, 'foundry', 'the foundry beat sits between landed and printing');
  assert.deepEqual(kinds(g, 'order'), [], 'no order before the first barrel');
  assert.deepEqual(kinds(g, 'grant'), [], 'nothing conjured');
  assert.deepEqual(kinds(g, 'foundry').map((l) => l[1]), ['deploy'], 'the deploy went to the host');
  run(beats, g, 5);
  assert.deepEqual(kinds(g, 'grant'), [['grant', 60]], 'one barrel, one grant');
  assert.equal(kinds(g, 'order').length, 1, 'the Rotor is ordered after the first barrel');
  assert.deepEqual(kinds(g, 'foundry').map((l) => l[1]), ['deploy', 'cycle', 'arc-on', 'arc-off', 'scrap', 'barrel'], 'the cycle\'s cues reached the host in order');
  assert.equal(kinds(g, 'foundry').find((l) => l[1] === 'scrap')[2], 'A', 'the first section named');
  assert.equal(beats.state().foundry.barrels, 1);
  run(beats, g, 20);
  assert.equal(beats.state().foundry.phase, 'spent', 'three barrels and the rocket is spent');
  assert.equal(kinds(g, 'grant').length, 3, 'three grants in all, one per barrel');
}
// THE ARRIVAL (owner, 2026-09-25: "bring back the landing ... Isao comes out, close up on his face; he's the narrator"). With
// `arrival` the game plays the landing itself (src/fx/arrival.js) and its three lines are its own: `landed` says nothing and deploys
// nothing however long the landing takes, and deploy(api) deploys the AFR-01 in that very call (the swap happens on the cut to his
// face), says no foundry line, works once and only from `landed`; the opening then runs as before. Without the option nothing
// changes: the two faces, then the timed deploy, which is the one that says 'foundry_deploy'.
{
  const tune = { deployDelay: 1, firstCycle: 4, cycleSeconds: 6, feedstockPerBarrel: 60, sections: ['A', 'B', 'C'], targets: ['tA', 'tB', 'tC'], events: { arcOn: 0.5, arcOff: 1, scrap: 2, barrel: 3 } };
  const g = fakeGame({ printSeconds: 2 }); g.api.foundry = (ev, d) => { g.log.push(['foundry', ev, d?.section ?? null]); };
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: -1, gate: -1, rotorDelay: 2, faceDelays: [0.5, 1], foundry: tune, arrival: true });
  run(beats, g, 30);
  assert.equal(beats.phase(), 'landed', 'the landing holds the beats however long it plays');
  assert.deepEqual(g.log, [], 'no landing line, no deploy, no grant and no order of their own');
  assert.equal(beats.deploy(g.api), true, 'the cut releases them');
  assert.equal(beats.phase(), 'foundry', 'the AFR-01 deploys in that very call');
  assert.deepEqual(g.log, [['foundry', 'deploy', null]], 'the deploy went to the host, and nothing was said');
  assert.equal(beats.deploy(g.api), false, 'once');
  run(beats, g, 5.5);
  assert.deepEqual(kinds(g, 'grant'), [['grant', 60]]); assert.equal(kinds(g, 'order').length, 1, 'then the opening runs as before: the first barrel pays for the Rotor');
  assert.deepEqual(kinds(g, 'brief'), [], 'the old landing lines and the foundry line never come');
  const g2 = fakeGame({ printSeconds: 2 }); g2.api.foundry = (ev) => { g2.log.push(['foundry', ev]); };
  const old = makeStoryBeats({ socket: 4242, lane: 4243, fodder: -1, gate: -1, rotorDelay: 2, faceDelays: [0.5, 1], foundry: tune });
  run(old, g2, 2.5);
  assert.deepEqual(g2.log, [['brief', 'rough_landing'], ['brief', 'so_much_to_build'], ['foundry', 'deploy'], ['brief', 'foundry_deploy']], 'without an arrival: the two faces, then the deploy and its line');
  assert.equal(old.deploy(g2.api), false, 'deploy() is the arrival\'s alone: beats that were never held do not deploy again');
  run(old, g2, 5); assert.equal(kinds(g2, 'foundry').filter((l) => l[1] === 'deploy').length, 1, 'one deploy');
  const late = makeStoryBeats({ socket: 1, startPhase: 'expedition', arrival: true });
  assert.equal(late.deploy(fakeGame().api), false, 'past the landing there is nothing to release'); assert.equal(late.phase(), 'expedition');
  // no foundry tune: the Rotor's grant and order wait for the cut too
  const g3 = fakeGame({ printSeconds: 2 }), bare = makeStoryBeats({ socket: 4242, lane: 4243, fodder: -1, gate: -1, rotorDelay: 2, arrival: true });
  run(bare, g3, 10); assert.deepEqual(g3.log, [], 'held without a foundry as well');
  bare.deploy(g3.api); run(bare, g3, 2.1); assert.deepEqual(g3.log, [['grant', 45], ['order', 'rotor', 4242]], 'released: the Rotor is paid for and ordered');
}
console.log('story-beats: the arrival holds the landing and deploys on its cut');
{
  // A JUMP PAST THE HANDOVER: the beats start at a later phase, offer the views once, replay no landing faces,
  // and — because a late start never crossed the study beat — open the first-wave sites here, exactly once
  const g = fakeGame();
  const unlocks = [];
  let begun = 0;
  g.api.unlock = (what) => { unlocks.push(what); };
  g.api.expeditionsBegin = () => { begun++; };
  const beats = makeStoryBeats({ socket: 1, startPhase: 'expedition' });
  assert.equal(beats.phase(), 'expedition');
  beats.tick(0.5, g.api); beats.tick(0.5, g.api);
  assert.equal(beats.phase(), 'expedition', 'nothing moves it back');
  assert.deepEqual(unlocks, ['views'], 'the views strip is offered once on a late start');
  assert.equal(begun, 1, `a late start at 'expedition' opens the first sites exactly once, got ${begun}`);
  assert.ok(!g.log.some((l) => l[0] === 'brief' && (l[1] === 'rough_landing' || l[1] === 'so_much_to_build')), 'no landing faces on a late start');
}
{
  // A LATER JUMP STILL: starting at 'settled' the sites are already behind the player, so nothing opens them again
  const g = fakeGame();
  const unlocks = [];
  let begun = 0;
  g.api.unlock = (what) => { unlocks.push(what); };
  g.api.expeditionsBegin = () => { begun++; };
  const beats = makeStoryBeats({ socket: 1, startPhase: 'settled' });
  assert.equal(beats.phase(), 'settled');
  for (let k = 0; k < 6; k++) beats.tick(0.5, g.api);
  assert.equal(begun, 0, `a late start at 'settled' must not reopen the expedition sites, got ${begun}`);
  assert.deepEqual(unlocks, ['views'], 'the views strip is still offered once');
  assert.equal(beats.phase(), 'settled', 'nothing moves it back');
}
{
  // THE HANDOVER ORDER: the Quiver's wave clears into `settled` BEFORE the views are offered again, so the strip sees the automated phase
  const src = (await import('node:fs')).readFileSync(new URL('../src/domain/story-beats.js', import.meta.url), 'utf8');
  assert.match(src, /enter\('settled'\);\s*api\.unlock\?\.\('views'\)/, 'settled is entered before the views are offered');
}
{
  // THE HANDOVER ORDER, BEHAVIOURALLY: the regex above checks source text; this drives the beats through the
  // same Quiver wave (two hard cores down, enemies() back to 0) and checks the views unlock actually lands on settled
  const quiver = { key: 'quiver', delay: 0.6, hardcore: 'barbed', secondDelay: 9, studyDelay: 2, missile: {} };
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  const seen = [];
  g.api.unlock = (what) => { if (what === 'views') seen.push(beats.phase()); };
  run(beats, g, 17); // piloting
  for (let k = 0; k < 10; k++) { g.kill(1); run(beats, g, 1); }
  g.kill(2); run(beats, g, 0.5); // the twelve-strong wave is spent: cleared, first views unlock
  g.seal(); // the sinkhole is filled after the wave, as the earlier block does
  run(beats, g, 1); // the first hard core rises: quiver-piloting
  run(beats, g, 7); run(beats, g, 2.5); // the second hard core, after its delay
  g.kill(1); run(beats, g, 1); // one hard core down, one still standing
  g.kill(1); run(beats, g, 1); // the second hard core: enemies() is 0, the wave should settle
  const limit = 200;
  let iterations = 0;
  while (beats.phase() !== 'settled' && iterations < limit) { beats.tick(0.1, g.api); iterations++; }
  assert.equal(beats.phase(), 'settled', `expected 'settled' within ${limit} bounded extra ticks, stuck at '${beats.phase()}'`);
  assert.equal(seen.at(-1), 'settled', 'the last phase recorded at a views unlock must be settled, not an earlier phase');
}
{
  const src = (await import('node:fs')).readFileSync(new URL('../src/domain/story-beats.js', import.meta.url), 'utf8');
  assert.match(src, /api\.sites\?\.\(\);\s*api\.expeditionsBegin\?\.\(\);/, 'the expedition beat reveals the first sites');
}
{
  // THE EXPEDITION BEAT, BEHAVIOURALLY: the regex above checks source text; this drives the beats through the
  // Quiver wave and the study to the expedition phase, and checks expeditionsBegin is really called, once, after the sites
  const quiver = { key: 'quiver', delay: 0.6, hardcore: 'barbed', secondDelay: 9, studyDelay: 2, missile: {} };
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  const calls = [];
  g.api.sites = () => { calls.push('sites'); };
  g.api.expeditionsBegin = () => { calls.push('begin'); };
  run(beats, g, 17); // piloting
  for (let k = 0; k < 10; k++) { g.kill(1); run(beats, g, 1); }
  g.kill(2); run(beats, g, 0.5); // the twelve-strong wave is spent: cleared
  g.seal(); // the sinkhole is filled after the wave, as the earlier blocks do
  run(beats, g, 1); // the first hard core rises: quiver-piloting
  run(beats, g, 7); run(beats, g, 2.5); // the second hard core, after its delay
  g.kill(1); run(beats, g, 1); g.kill(1); run(beats, g, 1); // both hard cores down: settled
  g.talking = false; g.screenUp = false; // his lines are over and the study screen is closed, so the study beat can hand over
  const limit = 400;
  let iterations = 0;
  while (beats.phase() !== 'expedition' && iterations < limit) { beats.tick(0.1, g.api); iterations++; }
  assert.equal(beats.phase(), 'expedition', `expected 'expedition' within ${limit} bounded extra ticks, stuck at '${beats.phase()}'`);
  assert.equal(calls.filter((c) => c === 'begin').length, 1, `expeditionsBegin must run exactly once on the expedition beat, got ${JSON.stringify(calls)}`);
  assert.deepEqual(calls, ['sites', 'begin'], `the sites are marked before the expeditions begin, got ${JSON.stringify(calls)}`);
}

// THE OPENING'S BEAT CLOCK (2026-09-18): the override asks how close the swarm is, the breach's first body comes after
// `spawnDelay`, and the swarm carries its own march pace out to the host.
{
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 0, faceDelays: [0, 0], tremorDelay: 0.5, breachDelay: 0.5, overrideDelay: 0.5, spawnDelay: 0.4, overrideCells: 10, fodderEvery: 1, fodderAlive: 4, fodderTotal: 6, fodderEmerge: { harmless: true, spread: 0.8, stagger: 1.2, pace: 1.7 } });
  const asked = [];
  const g = fakeGame({ printSeconds: 1, walk: 1e9 });
  g.api.near = (ci, cells) => { asked.push([ci, cells]); return asked.length > 3; };
  run(beats, g, 1.2); assert.equal(beats.state().phase, 'rotor-ready');
  run(beats, g, 0.6); assert.equal(beats.state().phase, 'tremor', 'the tremor comes after tremorDelay');
  run(beats, g, 0.6); assert.equal(beats.state().phase, 'breach', 'and the ground opens after breachDelay');
  assert.equal(kinds(g, 'spawn').length, 0, 'nothing has risen yet: the first body waits out spawnDelay');
  run(beats, g, 0.5); assert.equal(kinds(g, 'spawn').length, 1, 'the first body rises after spawnDelay, not a full second');
  assert.deepEqual(kinds(g, 'spawn')[0][3], { harmless: true, spread: 0.8, pace: 1.7, delay: 0 }, 'the swarm carries its own march pace');
  run(beats, g, 0.5); assert.equal(beats.state().phase, 'override');
  assert.deepEqual(asked[0], [4250, 10], 'the override asks for the swarm within overrideCells of the gate, not the default 2.2');
}
// the default is the old reach, so a caller that names no distance is unchanged
{
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 0, faceDelays: [0, 0], tremorDelay: 0.5, breachDelay: 0.5, fodderTotal: 3 });
  const seen = []; const g = fakeGame({ printSeconds: 1 });
  g.api.near = (ci, cells) => { seen.push(cells); return false; };
  run(beats, g, 5); assert.equal(seen[0], 2.2, 'the unnamed default reach is unchanged');
}

console.log('story-beats: the foundry pays');

// SECTOR 0: THE FOUNDATION (owner, 2026-09-24: "the first few waves before the stalheart is ready could be more intense POV
// sentries and Gunship shooting from above to protect the construction of the stalheart. Then with the Stalheart we get the
// first tank"). The Quiver goes on Isao's book the moment the gate stands, ahead of the Stålheart's long print; after its two
// hard cores the beats enter `construction`: the gunship arrives once, a wave rises from the sinkhole every `every` seconds
// (cycling through the table, each body carrying the construction's pace), and `settled` comes only once the host says the
// Stålheart stands (its first hull is out). A Stålheart already standing never stalls the story.
const CONSTRUCTION = { first: 2, every: 5, studyDelay: 5, alive: 7, mopUp: 0, pace: 1.5, spread: 0.9, stagger: 2, harmless: true, waves: [[{ type: 'amoeba', count: 3 }], [{ type: 'amoeba', count: 2 }, { type: 'barbed', count: 1 }]] };
const QUIVER = { key: 'quiver', delay: 0.6, hardcore: 'barbed', secondDelay: 9, studyDelay: 2, missile: {} };
const toQuiverClear = (beats, g) => {
  run(beats, g, 17);   // piloting
  for (let k = 0; k < 10; k++) { g.kill(1); run(beats, g, 1); }
  g.kill(2); run(beats, g, 0.5);   // cleared
  run(beats, g, 1); run(beats, g, 7); run(beats, g, 2.5);   // quiver-piloting, both hard cores up
  g.kill(1); run(beats, g, 1); g.kill(1);   // the second is down: the next tick decides
};
{
  // the Quiver is ordered when the gate stands, before the tremor, and only once
  let gateUp = false;
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 0, faceDelays: [0, 0], tremorDelay: 1.5, breachDelay: 0.5, spawnDelay: 0.2, overrideDelay: 0.5, fodderEvery: 1, fodderAlive: 4, fodderTotal: 4, gateReady: () => gateUp, quiverSocket: 4244, quiver: QUIVER });
  const g = fakeGame({ printSeconds: 1, walk: 1 });
  run(beats, g, 2.5); assert.equal(beats.state().phase, 'rotor-ready');
  assert.equal(kinds(g, 'order').filter((l) => l[1] === 'quiver').length, 0, 'no Quiver while the gate is unprinted');
  gateUp = true; run(beats, g, 0.2);
  assert.equal(beats.state().phase, 'rotor-ready', 'still before the tremor');
  assert.deepEqual(kinds(g, 'order').at(-1), ['order', 'quiver', 4244], 'the Quiver goes on the book the moment the gate stands');
  assert.deepEqual(g.log.at(-2), ['grant', 45], '...paid for by the beats, as at the override before');
  run(beats, g, 8); assert.equal(beats.state().phase, 'piloting');
  assert.equal(kinds(g, 'order').filter((l) => l[1] === 'quiver').length, 1, 'ordered once: the override does not order it again');
}
{
  // construction: the gunship arrives once, waves on a clock from the sinkhole, settled only when the Stålheart stands
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver: QUIVER, construction: CONSTRUCTION });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  let stands = false; g.api.stalheartStands = () => stands; g.api.gunshipArrive = () => { g.log.push(['gunshipArrive']); };
  toQuiverClear(beats, g); run(beats, g, 1);
  assert.equal(beats.state().phase, 'construction', 'the Quiver\'s cores down and the Stålheart still printing: sector 0');
  assert.equal(kinds(g, 'brief').at(-1)[1], 'quiver_cleared'); assert.equal(kinds(g, 'gunshipArrive').length, 1, 'the gunship arrives from orbit');
  const s0 = kinds(g, 'spawn').length, b0 = kinds(g, 'breach').length;
  run(beats, g, 1.2); const w1 = kinds(g, 'spawn').slice(s0);
  assert.deepEqual(w1.map((l) => [l[1], l[2]]), [['amoeba', 4300], ['amoeba', 4300], ['amoeba', 4300]], 'the first construction wave rises from the sinkhole');
  for (const l of w1) { assert.equal(l[3].pace, 1.5); assert.equal(l[3].harmless, true); assert.equal(l[3].spread, 0.9); assert.ok(l[3].delay >= 0 && l[3].delay < 2, 'risen over the stagger'); }
  g.seal();   // a strike filled the sinkhole between waves
  run(beats, g, 5); const w2 = kinds(g, 'spawn').slice(s0 + 3);
  assert.deepEqual(w2.map((l) => l[1]), ['amoeba', 'amoeba', 'barbed'], 'the second wave carries a hard core');
  assert.equal(kinds(g, 'breach').length, b0 + 1, 'the sinkhole is opened again for the wave');
  run(beats, g, 5); assert.deepEqual(kinds(g, 'spawn').slice(s0 + 6).map((l) => l[1]), ['amoeba', 'amoeba', 'amoeba'], 'the table cycles');
  assert.deepEqual(beats.state().construction, { waves: 3, sent: 9 });
  run(beats, g, 6); assert.equal(beats.state().construction.waves, 3, 'nine standing against a cap of seven: the next wave waits');
  g.kill(3); run(beats, g, 0.2); assert.equal(beats.state().construction.waves, 4, '...and rises the moment the field thins');
  assert.equal(beats.state().phase, 'construction', 'the field is not what ends it: the Stålheart is');
  stands = true; run(beats, g, 6);
  assert.equal(beats.state().phase, 'construction', 'the Stålheart stands with sector 0 still on the field: the hull\'s first work'); assert.equal(beats.state().construction.waves, 4, 'no wave after it stands');
  g.kill(8); run(beats, g, 0.2); assert.equal(beats.state().phase, 'construction', 'one still standing');
  g.kill(1); run(beats, g, 0.2);
  assert.equal(beats.state().phase, 'settled', 'the Stålheart stands and the field is clear: the handover'); assert.equal(kinds(g, 'unlock').at(-1)[1], 'views');
  const s1 = kinds(g, 'spawn').length;
  run(beats, g, 3); assert.equal(kinds(g, 'closeup').length, 0, 'the new hull is the player\'s for a few seconds: the study waits the construction\'s own delay, not the Quiver\'s');
  run(beats, g, 2.5); assert.equal(beats.state().phase, 'study-talk');
  run(beats, g, 7); assert.equal(kinds(g, 'spawn').length, s1, 'no construction wave after it');
  assert.equal(kinds(g, 'gunshipArrive').length, 1, 'the gunship arrived once');
}
{
  // a player who drives off instead of mopping up: the handover comes `mopUpSeconds` after the Stålheart stands, whatever is left
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver: QUIVER, construction: { ...CONSTRUCTION, mopUpSeconds: 10 } });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  let stands = false; g.api.stalheartStands = () => stands; g.api.gunshipArrive = () => {};
  toQuiverClear(beats, g); run(beats, g, 4);
  assert.equal(beats.state().phase, 'construction');
  stands = true; run(beats, g, 9);
  assert.equal(beats.state().phase, 'construction', 'the hull has its moment at the leftovers');
  run(beats, g, 1.5);
  assert.equal(beats.state().phase, 'settled', 'and then the handover comes without them');
}
{
  // a Stålheart already standing at the Quiver's clear: straight to settled, no construction, no free pass
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver: QUIVER, construction: CONSTRUCTION });
  const g = fakeGame({ walk: 3, printSeconds: 3 });
  g.api.stalheartStands = () => true; g.api.gunshipArrive = () => { g.log.push(['gunshipArrive']); };
  toQuiverClear(beats, g); run(beats, g, 0.2);
  assert.equal(beats.state().phase, 'settled'); assert.equal(kinds(g, 'gunshipArrive').length, 0); assert.deepEqual(beats.state().construction, { waves: 0, sent: 0 });
}
{
  // a static page (no construction table) settles as before whatever the Stålheart does, and a late start at construction leaves it
  const beats = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, rotorDelay: 2, fodderEvery: 1, fodderAlive: 4, fodderTotal: 12, tremorDelay: 1, breachDelay: 2, overrideDelay: 1, quiverSocket: 4244, quiver: QUIVER });
  const g = fakeGame({ walk: 3, printSeconds: 3 }); g.api.stalheartStands = () => false;
  toQuiverClear(beats, g); run(beats, g, 0.2); assert.equal(beats.state().phase, 'settled');
  const late = makeStoryBeats({ socket: 1, startPhase: 'construction', construction: CONSTRUCTION }), g2 = fakeGame(); g2.api.stalheartStands = () => true;
  late.tick(0.1, g2.api); assert.equal(late.phase(), 'settled', 'a jump into construction with the Stålheart up hands over at once');
}
console.log('story-beats: sector 0, the construction defended');
// A TUTORIAL CHAPTER'S START (owner, 2026-09-25: "Skip tutorial should have 2 options ... skip to next phase"; src/content/story-defaults.js
// STORY_CHAPTERS). A page opened at a chapter starts the beats there; what the beats did on the way in is done once, on the first
// tick, and nothing the chapter's own beats do comes early or twice.
{
  const tune = { deployDelay: 1, firstCycle: 4, cycleSeconds: 6, feedstockPerBarrel: 60, sections: ['A', 'B', 'C'], targets: ['tA', 'tB', 'tC'], events: { arcOn: 0.5, arcOff: 1, scrap: 2, barrel: 3 } };
  const unlocks = (g) => g.log.filter((l) => l[0] === 'unlock');
  // ROTOR: the AFR-01 deployed off camera with nothing cut; its first barrel pays for the Rotor as in the opening; no views yet
  const g = fakeGame({ printSeconds: 2 }); g.api.foundry = (ev) => { g.log.push(['foundry', ev]); };
  const rotor = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, foundry: tune, startPhase: 'foundry', foundryCut: 0, gateReady: () => false });
  run(rotor, g, 1.5); assert.deepEqual(g.log.filter((l) => l[0] !== 'foundry'), [], 'nothing said, granted, ordered or unlocked on the way in');
  run(rotor, g, 4); assert.deepEqual(kinds(g, 'grant'), [['grant', 60]]); assert.deepEqual(kinds(g, 'order'), [['order', 'rotor', 4242]], 'the first barrel orders the Rotor at the end of its cycle');
  assert.equal(rotor.state().foundry.barrels, 1); assert.equal(unlocks(g).length, 0, 'the views strip waits for the first wave\'s clear');
  // FIRST WAVE: the gate stands at the start, so the Quiver goes on the book at once and the tremor follows; two sections already cut
  const g2 = fakeGame({ printSeconds: 99 }); g2.api.foundry = (ev) => { g2.log.push(['foundry', ev]); };
  const wave = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, tremorDelay: 1.5, quiverSocket: 4244, quiver: QUIVER, foundry: tune, startPhase: 'rotor-ready', foundryCut: 2 });
  run(wave, g2, 0.2); assert.deepEqual(kinds(g2, 'order'), [['order', 'quiver', 4244]], 'the Quiver first on Isao\'s book'); assert.equal(unlocks(g2).length, 0, 'no views before the clear');
  assert.deepEqual(wave.state().foundry, { phase: 'waiting', barrels: 2, sections: 1, cycle: 2 }, 'the AFR-01 on its last section');
  run(wave, g2, 1.5); assert.equal(wave.phase(), 'tremor'); assert.deepEqual(kinds(g2, 'tremor'), [['tremor', 4300]]); assert.equal(kinds(g2, 'brief').at(-1)[1], 'tremor');
  // QUIVER: the Quiver already stands, so it is neither introduced nor ordered; its hard core rises after the delay; the views unlock once
  const g3 = fakeGame(); g3.api.built = (ci) => ci === 4244;
  const quiver = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, quiverSocket: 4244, quiver: QUIVER, startPhase: 'cleared' });
  run(quiver, g3, 1); assert.equal(quiver.phase(), 'quiver-piloting'); assert.equal(kinds(g3, 'order').length, 0, 'nothing ordered onto the standing Quiver');
  assert.ok(!kinds(g3, 'brief').some((l) => l[1] === 'quiver_intro'), 'no introduction for a Quiver that stands'); assert.deepEqual(kinds(g3, 'spawn'), [['spawn', 'barbed', 4300]]); assert.deepEqual(kinds(g3, 'pilot'), [['pilot', 4244, 4243]]);
  assert.equal(unlocks(g3).length, 1, 'the views strip, once');
  // STÅLHEART: sector 0 calls the gunship once and its first wave comes after `first`, not on the first frame
  const g4 = fakeGame(); g4.api.stalheartStands = () => false; g4.api.gunshipArrive = () => { g4.log.push(['gunshipArrive']); };
  const sector0 = makeStoryBeats({ socket: 4242, lane: 4243, fodder: 4300, gate: 4250, quiverSocket: 4244, quiver: QUIVER, construction: CONSTRUCTION, startPhase: 'construction' });
  run(sector0, g4, 0.2); assert.equal(kinds(g4, 'gunshipArrive').length, 1, 'the gunship comes from orbit'); assert.equal(kinds(g4, 'spawn').length, 0, 'no wave on the first frame');
  assert.deepEqual(kinds(g4, 'pilot'), [['pilot', 4244, 4243]], 'the player is in the Quiver\'s optic, as the hard cores left them');
  run(sector0, g4, CONSTRUCTION.first); assert.equal(sector0.state().construction.waves, 1, 'the first wave after its delay'); run(sector0, g4, 10); assert.equal(kinds(g4, 'gunshipArrive').length, 1, 'once');
  // EXPEDITION: the new hull has the construction's moment before the study, not the Quiver's
  const g5 = fakeGame();
  const settled = makeStoryBeats({ socket: 4242, quiverSocket: 4244, quiver: QUIVER, construction: CONSTRUCTION, startPhase: 'settled' });
  run(settled, g5, QUIVER.studyDelay + 0.5); assert.equal(settled.phase(), 'settled', 'not the Quiver\'s delay'); run(settled, g5, CONSTRUCTION.studyDelay - QUIVER.studyDelay); assert.equal(settled.phase(), 'study-talk');
}
console.log('story-beats: a tutorial chapter starts where its beats do');
