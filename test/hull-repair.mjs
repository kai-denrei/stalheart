// THE HULL MENDS UNDER THE STÅLHEART (owner, 2026-10-18: "when the Mork is damaged, sitting under the Stalheart should repair it, same repair
// time as the shield recharge"): src/domain/hull-repair.js repairStep over 30 s for four dents, a dent every 7.5 s while under and still.
import assert from 'node:assert/strict';
import { repairStep, repairSpot } from '../src/domain/hull-repair.js';
import { createHullRepair } from '../src/fx/hull-repair.js';
import { HULL_REPAIR, HULL_ARMOUR } from '../src/content/tank.js';
import { SHIELD_ARRAY } from '../src/content/shield-array.js';

const base = { under: true, still: true, hit: false, max: 4, seconds: 30, keep: 5 };
const run = (s, secs, over = {}, dt = 1 / 60) => { for (let t = 0; t < secs - 1e-9; t += dt) s = { ...s, ...repairStep({ ...base, ...s, ...over, dt }) }; return s; };

// the content: the shield array's recharge, the armour's hits, a footprint and a pace
assert.equal(HULL_REPAIR.seconds, SHIELD_ARRAY.reserve, 'a whole hull mends in the array\'s recharge (ARRAY 30s)');
assert.equal(SHIELD_ARRAY.reserve, 30);
assert.equal(HULL_ARMOUR.hits, 4);
assert.ok(HULL_REPAIR.maxSpeed > 0 && HULL_REPAIR.keep === 5);

// a dent every 7.5 s while under and still
{ let s = run({ dents: 1, progress: 0, away: 0 }, 7.4); assert.equal(s.dents, 1, 'no dent before 7.5 s'); assert.ok(s.progress > 0.95 && s.progress < 1);
  s = run(s, 0.2); assert.equal(s.dents, 2, 'a dent back at 7.5 s'); assert.ok(s.progress < 0.05);
  s = run(s, 7.5); assert.equal(s.dents, 3); s = run(s, 7.5); assert.equal(s.dents, 4, 'whole after 22.5 s from one dent'); }
// from empty (the hull with no dent left to take: 0 of 4) to whole in the array's 30 s, and full stops
{ let s = run({ dents: 0, progress: 0, away: 0 }, 29.9); assert.equal(s.dents, 3, 'not whole before 30 s'); s = run(s, 0.2); assert.equal(s.dents, 4, 'whole at 30 s');
  assert.equal(s.progress, 0, 'a whole hull carries no progress'); assert.equal(s.mending, false, 'a whole hull is not mending');
  s = run(s, 60); assert.equal(s.dents, 4, 'full stops: never past max'); assert.equal(s.progress, 0); }
// a large step returns every whole unit it covers, never past max
{ const r = repairStep({ ...base, dents: 1, progress: 0, away: 0, dt: 16 }); assert.equal(r.dents, 3); assert.ok(Math.abs(r.progress - (16 / 7.5 - 2)) < 1e-9);
  assert.equal(repairStep({ ...base, dents: 2, progress: 0.5, away: 0, dt: 100 }).dents, 4); }
// nothing when moving or away
{ const s0 = { dents: 2, progress: 0, away: 0 };
  assert.equal(run(s0, 20, { still: false }).dents, 2, 'a moving hull does not mend'); assert.equal(run(s0, 20, { under: false }).dents, 2, 'a hull away from the Stålheart does not mend');
  assert.equal(repairStep({ ...base, ...s0, dt: 1 }).mending, true, 'under and still and dented: mending');
  assert.equal(repairStep({ ...base, ...s0, still: false, dt: 1 }).mending, false); assert.equal(repairStep({ ...base, ...s0, under: false, dt: 1 }).mending, false); }
// the progress is kept 5 s off the spot, then dropped
{ let s = run({ dents: 2, progress: 0, away: 0 }, 6); const p = s.progress; assert.ok(p > 0.7 && p < 0.85);
  s = run(s, 4.9, { under: false }); assert.equal(s.progress, p, 'kept for 5 s away'); s = run(s, 3); assert.equal(s.dents, 3, 'and the kept progress finishes the dent on return');
  s = run({ dents: 2, progress: 0, away: 0 }, 6); s = run(s, 5.1, { still: false }); assert.equal(s.progress, 0, 'dropped after 5 s on the move');
  s = run(s, 7.4); assert.equal(s.dents, 2, 'the dent starts over'); }
// a hit resets the fractional progress and holds the mend for as long as it is reported
{ let s = run({ dents: 2, progress: 0, away: 0 }, 6); s = run(s, 1, { hit: true }); assert.equal(s.progress, 0, 'a hit resets'); assert.equal(s.dents, 2, 'no mend while hit');
  assert.equal(repairStep({ ...base, dents: 2, progress: 0.5, away: 0, hit: true, dt: 1 }).mending, false); }
// a frozen frame changes nothing
{ const r = repairStep({ ...base, dents: 2, progress: 0.4, away: 2, dt: 0 }); assert.equal(r.dents, 2); assert.equal(r.progress, 0.4); assert.equal(r.away, 2); }
// THE TWO SPOTS (owner, 2026-10-18, third round: "either standing under the stalheart, or the paint-job garage")
{ assert.deepEqual([...HULL_REPAIR.spots], ['stalheart', 'garage'], 'the content names the two landmarks');
  const at = (ids) => (id) => ids.includes(id);
  assert.equal(repairSpot(HULL_REPAIR.spots, at(['stalheart']), [0, 0, 0]), 'stalheart'); assert.equal(repairSpot(HULL_REPAIR.spots, at(['garage']), [0, 0, 0]), 'garage');
  assert.equal(repairSpot(HULL_REPAIR.spots, at(['stalheart', 'garage']), [0, 0, 0]), 'stalheart', 'first match wins');
  assert.equal(repairSpot(HULL_REPAIR.spots, at([]), [0, 0, 0]), null, 'nowhere: null'); assert.equal(repairSpot(undefined, at(['garage']), [0, 0, 0]), null);
  // through the fx module: a hull parked at the garage mends at the same rate and says where; off both spots it does not
  let armour = 2, where = 'garage', done = [];
  const fx = createHullRepair({ pos: () => [0, 0, 0], under: () => where && repairSpot(HULL_REPAIR.spots, (id) => id === where, [0, 0, 0]), armour: () => armour, setArmour: (n) => { armour = n; }, hits: () => 4, metres: () => 1, alive: () => true, callout: (t) => done.push(t) });
  for (let k = 0; k < 74; k++) fx.tick(0.1); assert.equal(armour, 2, 'no dent before 7.5 s at the garage'); assert.equal(fx.state().where, 'garage'); assert.equal(fx.state().under, true); assert.equal(fx.mending(), true);
  for (let k = 0; k < 3; k++) fx.tick(0.1); assert.equal(armour, 3, 'a dent at 7.5 s, as under the Stålheart');
  where = 'stalheart'; fx.tick(0.1); assert.equal(fx.state().where, 'stalheart');
  where = null; fx.tick(0.1); assert.equal(fx.state().where, null); assert.equal(fx.state().under, false); assert.equal(fx.mending(), false); }
console.log('hull-repair: ok');
