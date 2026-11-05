// THE ROVER'S RUN (round 8 note 7, src/domain/rover-run.js): out to the flare, the piles nearest first, home, into the pearls; a full pearl holds it.
import assert from 'node:assert/strict';
import { createRoverRun, dispatch, stepRover, roverWord, settleBreak } from '../src/domain/rover-run.js';
import { createField } from '../src/domain/biomass-field.js';
import { createPearls } from '../src/domain/bio-pearls.js';
import { ROVER } from '../src/content/rover.js';

// a line of cells 10 m apart: cell n stands at x = 10 n; the home is cell 0, the bearing of a step is 0 east and pi west
const line = (a, b) => { const out = []; for (let c = a; c !== b; c += Math.sign(b - a)) out.push(c); out.push(b); return out; };
function world({ capacity = 1000, room = 1e9, wall = null } = {}) {
  const field = createField({ decaySeconds: 1e9, maxPiles: 100 }), pearls = createPearls({ count: 1, capacity: room }), live = new Set();
  let now = 0;
  const host = {
    path: (a, b) => (wall != null && Math.min(a, b) < wall && Math.max(a, b) > wall ? null : line(a, b)),
    length: (cells) => (cells.length - 1) * 10, bearing: (a, b) => (b > a ? 0 : Math.PI),
    near: (cell, reach) => field.near(cell, reach, (x, y) => Math.abs(x - y)),
    take: (cell, kg) => field.take(cell, kg, now), deposit: (kg) => pearls.fill(kg), live: (o) => live.has(o.id),
  };
  const run = createRoverRun({ ...ROVER, capacity, speed: 10, turn: 1, reach: 3, harvestRate: 100, unloadRate: 200 }, 0, Math.PI);
  const step = (secs, dt = 0.05) => { for (let k = 0; k < secs / dt; k++) { now += dt; stepRover(run, dt, now, host); } };
  return { field, pearls, live, run, step, host, now: () => now };
}
// a full trip: 600 kg on three cells round a flare at cell 20, capacity 1000
{ const w = world(); w.field.drop(19, 200, 0); w.field.drop(20, 300, 0); w.field.drop(22, 100, 0); w.field.drop(30, 999, 0);
  w.live.add('f1'); assert.equal(dispatch(w.run, { id: 'f1', cell: 20 }), 'now');
  w.step(0.05); assert.equal(w.run.mode, 'out', 'it leaves on the next step'); assert.ok(w.run.turn && Math.abs(w.run.turn.total - Math.PI) < 1e-9, 'a half turn on the spot first (it faced west)');
  w.step(Math.PI + 0.1); assert.equal(w.run.turn, null, 'the turn done'); assert.equal(w.run.mode, 'out');
  w.step(20.1); assert.equal(w.run.mode, 'harvest', '200 m at 10 m/s, after the turn'); assert.equal(w.run.cell, 20);
  w.step(3.1); assert.equal(w.field.piles().some((p) => p.cell === 20), false, 'the flare\'s own cell first: 300 kg at 100 kg/s'); assert.ok(Math.abs(w.run.cargo - 300) < 1);
  w.step(15); assert.ok(Math.abs(w.run.cargo - 600) < 1, `then 19 and 22, not 30 (out of reach): ${w.run.cargo}`); assert.ok(w.field.piles().every((p) => p.cell === 30));
  assert.ok(['home', 'unload', 'idle'].includes(w.run.mode), 'the ground bare, home');
  w.step(30); assert.equal(w.run.mode, 'idle'); assert.equal(w.run.cell, 0); assert.equal(w.run.cargo, 0); assert.ok(Math.abs(w.pearls.stored() - 600) < 1, 'unloaded into the pearl');
  assert.equal(w.run.trips, 1); assert.equal(w.run.delivered, 600, 'whole kilos: the bank is an integer'); assert.ok(Number.isInteger(w.pearls.stored())); assert.ok(w.run.events.map((e) => e.ev).join(' ').startsWith('out arrive home dock unloaded'), w.run.events.map((e) => e.ev).join(' '));
  w.step(2); assert.equal(w.run.mode, 'idle', 'a standing flare with nothing left within reach is no order'); }
// the hold fills: home with the capacity, then back out for the rest while the flare stands
{ const w = world({ capacity: 250 }); w.field.drop(20, 400, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 20 });
  w.step(56); assert.equal(w.run.trips, 1, "one trip of 250 (turn, 200 m, harvest, turn, 200 m, unload)"); assert.ok(['out', 'harvest'].includes(w.run.mode) || w.run.trips === 2, `back out for the rest (${w.run.mode})`);
  w.step(80); assert.equal(w.run.trips, 2); assert.ok(Math.abs(w.pearls.stored() - 400) < 1); assert.equal(w.field.total(), 0); }
// a flare dropped while it works waits; the newest wins; a burned-out one is dropped
{ const w = world(); w.field.drop(10, 100, 0); w.field.drop(-10, 100, 0); w.live.add('a'); w.live.add('b'); w.live.add('c');
  dispatch(w.run, { id: 'a', cell: 10 }); w.step(1); assert.equal(dispatch(w.run, { id: 'b', cell: -20 }), 'queued'); assert.equal(dispatch(w.run, { id: 'c', cell: -10 }), 'queued');
  w.step(40); assert.ok(w.run.trips >= 1); assert.equal(w.run.order?.id ?? 'c', 'c', 'the newest queued order is the next'); w.step(40); assert.equal(w.field.total(), 0, 'both fields home');
  w.live.delete('c'); w.field.drop(-10, 50, 0); dispatch(w.run, { id: 'c', cell: -10 }); w.step(1); assert.equal(w.run.mode, 'idle', 'a burned-out flare is no order'); }
// STORAGE FULL: the pearl takes what fits, the rover waits at home with the rest aboard; room lets it finish
{ const w = world({ room: 150 }); w.field.drop(5, 400, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 5 });
  w.step(30); assert.equal(w.run.mode, 'full'); assert.equal(roverWord(w.run), 'STORAGE FULL'); assert.ok(Math.abs(w.run.cargo - 250) < 1, 'the rest aboard'); assert.equal(w.pearls.stored(), 150);
  w.step(10); assert.equal(w.run.mode, 'full', 'it holds'); assert.equal(w.run.cell, 0, 'at home');
  w.pearls.spend(150); w.step(5); assert.equal(w.run.mode, 'full', 'only 150 more fit'); assert.ok(Math.abs(w.run.cargo - 100) < 1);
  w.pearls.spend(150); w.step(5); assert.equal(w.run.mode, 'idle'); assert.equal(w.run.cargo, 0); assert.equal(w.run.trips, 1); }
// no road: an order it cannot reach is dropped with a word; a pile it cannot reach is skipped
{ const w = world({ wall: 4 }); w.field.drop(8, 10, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 8 }); w.step(0.1);
  assert.equal(w.run.mode, 'idle'); assert.equal(roverWord(w.run), 'NO ROAD'); assert.equal(w.run.order, null); }
{ const w = world({ wall: 4 }); w.field.drop(3, 10, 0); w.field.drop(5, 50, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 2 });
  w.step(30); assert.equal(w.pearls.stored(), 10, 'cell 3 taken, cell 5 behind the wall skipped'); assert.equal(w.run.mode, 'idle'); assert.equal(w.run.trips, 1, 'no second trip for a pile it cannot reach'); }
// THE BREAK: mid-trip at the sector's end the hold and the flagged ground come home at once, under the cap; the unflagged ground stays and rots
{ const w = world({ room: 1000 }); w.field.drop(20, 300, 0); w.field.drop(21, 200, 0); w.field.drop(40, 700, 0); w.field.drop(60, 900, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 20 });
  w.step(25); assert.equal(w.run.mode, 'harvest'); w.step(1.5); assert.ok(w.run.cargo > 0 && w.run.cargo < 500, `raking (${w.run.cargo})`);
  const breakHost = (flares) => ({ ...w.host, flares, room: () => w.pearls.room() });
  const aboard = w.run.cargo, out = settleBreak(w.run, w.now(), breakHost([{ id: 'f', cell: 20 }, { id: 'g', cell: 41 }]));
  assert.equal(out.cargo, aboard, 'the hold first'); assert.equal(out.field, 1000 - aboard, 'then the flagged ground, up to the cap');
  assert.equal(w.pearls.stored(), 1000); assert.equal(out.kept, 0);
  assert.ok(w.field.piles().some((p) => p.cell === 60 && p.kg === 900), 'the unflagged pile stays on the ground');
  assert.equal(w.field.total(), 1100, 'what did not fit stays on the ground (2,100 laid, 1,000 home)');
  assert.equal(w.run.mode, 'idle'); assert.equal(w.run.cell, 0, 'home'); assert.equal(w.run.order, null); assert.equal(w.run.path, null); assert.equal(w.run.trips, 1); }
{ const w = world({ room: 100 }); w.field.drop(5, 400, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 5 }); w.step(10); assert.ok(w.run.cargo > 100, `aboard (${w.run.cargo})`);
  const aboard = w.run.cargo, out = settleBreak(w.run, w.now(), { ...w.host, flares: [], room: () => w.pearls.room() });
  assert.equal(out.cargo, 100); assert.equal(out.kept, aboard - 100, 'the cargo that does not fit stays aboard'); assert.equal(w.run.mode, 'full', 'home, STORAGE FULL'); assert.equal(w.run.cell, 0); }
{ const w = world(); w.field.drop(5, 400, 0); const out = settleBreak(w.run, 0, { ...w.host, flares: [], room: () => w.pearls.room() });
  assert.deepEqual(out, { cargo: 0, field: 0, kept: 0 }, 'nothing flagged, nothing banked: not automatic'); assert.equal(w.field.total(), 400); assert.equal(w.run.trips, 0); }
assert.equal(roverWord(createRoverRun(ROVER, 0)), 'HOME');
console.log('Rover run: a full trip, the hold full and back, the queue, STORAGE FULL and no road hold.');
