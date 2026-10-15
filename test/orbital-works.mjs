import assert from 'node:assert/strict';
import { makeWorks, launchDue, beginLaunch, collectorUp, energyBonus, routineDue, beginRoutine, routineUp } from '../src/domain/orbital-works.js';
import { ORBITAL_WORKS } from '../src/content/orbital-works.js';
import { BRIEFS } from '../src/isaobriefs.js';

const st = makeWorks();
assert.equal(launchDue(st, { sector: 6, online: false, secured: true }), false, 'nothing before SOL-88 is up');
assert.equal(launchDue(st, { sector: 6, online: true, secured: false }), false, 'a lost sector pays no launch');
assert.equal(launchDue(st, { sector: 6, online: true, secured: true, standing: false }), false, 'a burned launcher launches nothing');
assert.equal(launchDue(st, { sector: 6, online: true, secured: true }), true, 'the first secured sector past SOL-88: a collector goes up');
beginLaunch(st, 6);
assert.equal(launchDue(st, { sector: 6, online: true, secured: true }), false, 'one on the sled at a time');
assert.equal(collectorUp(st), 1);
assert.equal(launchDue(st, { sector: 6, online: true, secured: true }), false, 'one launch a sector');
assert.equal(launchDue(st, { sector: 7, online: true, secured: true }), true, 'the next sector pays the next');
assert.equal(energyBonus(0, ORBITAL_WORKS), 0);
assert.equal(energyBonus(3, ORBITAL_WORKS), 3 * ORBITAL_WORKS.energyPerCollector);
assert.equal(energyBonus(999, ORBITAL_WORKS), ORBITAL_WORKS.energyCap, 'capped');
for (const id of [ORBITAL_WORKS.brief, ORBITAL_WORKS.orbit]) assert.ok(BRIEFS[id], `Isao has the line ${id}`);
// A ROUTINE LAUNCH (owner, 2026-10-15): plain satellites once in a while, never over a collector's launch
{
  const w = makeWorks(), tune = ORBITAL_WORKS.routine;
  assert.equal(routineDue(w, { t: 100, online: false, tune }), false, 'nothing before SOL-88');
  assert.equal(routineDue(w, { t: 100, online: true, tune }), false, 'the first ask arms the clock');
  assert.equal(w.routineAt, 100 + tune.first);
  assert.equal(routineDue(w, { t: 100 + tune.first - 1, online: true, tune }), false);
  assert.equal(routineDue(w, { t: 100 + tune.first, online: true, standing: false, tune }), false, 'a burned launcher launches nothing');
  assert.equal(routineDue(w, { t: 100 + tune.first, online: true, tune }), true, 'due');
  beginRoutine(w, 100 + tune.first, tune, 0);
  assert.equal(w.launching, true); assert.equal(w.routines, 1); assert.equal(w.routineAt, 100 + tune.first + tune.every[0], 'the next at the span\'s start for r 0');
  assert.equal(launchDue(w, { sector: 9, online: true, secured: true }), false, 'a collector waits for the sled');
  assert.equal(routineDue(w, { t: 1e6, online: true, tune }), false, 'one on the sled at a time');
  routineUp(w); assert.equal(w.launching, false);
  beginRoutine(w, 0, tune, 1); assert.equal(w.routineAt, tune.every[1], 'r 1: the span\'s end'); routineUp(w);
  assert.ok(tune.every[0] >= 60 && tune.every[1] > tune.every[0], 'minutes apart');
}
console.log('Orbital works: one collector per secured sector once SOL-88 is up, each worth seconds of beam, capped.');
