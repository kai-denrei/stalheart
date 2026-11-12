// THE ROVER'S RUN (round 8 note 7, src/domain/rover-run.js): out to the flare, the piles nearest first, home, into the pearls; a full pearl holds it.
import assert from 'node:assert/strict';
import { createRoverRun, dispatch, stepRover, roverWord, settleBreak, bite, roverCell } from '../src/domain/rover-run.js';
import { createField } from '../src/domain/biomass-field.js';
import { createPearls } from '../src/domain/bio-pearls.js';
import { ROVER } from '../src/content/rover.js';

// a line of cells 10 m apart: cell n stands at x = 10 n; the home is cell 0, the bearing of a step is 0 east and pi west
const line = (a, b) => { const out = []; for (let c = a; c !== b; c += Math.sign(b - a)) out.push(c); out.push(b); return out; };
function world({ capacity = 1000, room = 1e9, wall = null } = {}) {
  const field = createField({ seep: null, maxPiles: 100 }), pearls = createPearls({ count: 1, capacity: room }), live = new Set();
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
// THE BREAK: mid-trip at the sector's end the hold and the flagged ground come home at once, under the cap; the unflagged ground stays and seeps.
// The round-8 rule (breakShare 1: all the flagged ground) first, then the economy design's half (2026-11-12, ROVER.breakShare 0.5)
assert.equal(ROVER.breakShare, 0.5, 'the break banks half the flagged ground');
{ const w = world({ room: 1000 }); w.run.tune = { ...w.run.tune, breakShare: 1 }; w.field.drop(20, 300, 0); w.field.drop(21, 200, 0); w.field.drop(40, 700, 0); w.field.drop(60, 900, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 20 });
  w.step(25); assert.equal(w.run.mode, 'harvest'); w.step(1.5); assert.ok(w.run.cargo > 0 && w.run.cargo < 500, `raking (${w.run.cargo})`);
  const breakHost = (flares) => ({ ...w.host, flares, room: () => w.pearls.room() });
  const aboard = w.run.cargo, out = settleBreak(w.run, w.now(), breakHost([{ id: 'f', cell: 20 }, { id: 'g', cell: 41 }]));
  assert.equal(out.cargo, aboard, 'the hold first'); assert.equal(out.field, 1000 - aboard, 'then the flagged ground, up to the cap');
  assert.equal(w.pearls.stored(), 1000); assert.equal(out.kept, 0);
  assert.ok(w.field.piles().some((p) => p.cell === 60 && p.kg === 900), 'the unflagged pile stays on the ground');
  assert.equal(w.field.total(), 1100, 'what did not fit stays on the ground (2,100 laid, 1,000 home)');
  assert.equal(w.run.mode, 'idle'); assert.equal(w.run.cell, 0, 'home'); assert.equal(w.run.order, null); assert.equal(w.run.path, null); assert.equal(w.run.trips, 1); }
{ const w = world({ room: 1e6 }); w.field.drop(20, 300, 0); w.field.drop(21, 201, 0); w.field.drop(40, 700, 0); w.field.drop(60, 900, 0);
  const out = settleBreak(w.run, 0, { ...w.host, flares: [{ id: 'f', cell: 20 }, { id: 'g', cell: 41 }], room: () => w.pearls.room() });
  assert.equal(out.field, 150 + 100 + 350, 'half of each flagged pile, whole kilos (300, 201, 700 -> 150, 100, 350)');
  assert.deepEqual(w.field.piles().map((p) => [p.cell, p.kg]), [[20, 150], [21, 101], [40, 350], [60, 900]], 'the other half stays on the ground, the unflagged pile whole'); }
{ const w = world({ room: 100 }); w.field.drop(5, 400, 0); w.live.add('f'); dispatch(w.run, { id: 'f', cell: 5 }); w.step(10); assert.ok(w.run.cargo > 100, `aboard (${w.run.cargo})`);
  const aboard = w.run.cargo, out = settleBreak(w.run, w.now(), { ...w.host, flares: [], room: () => w.pearls.room() });
  assert.equal(out.cargo, 100); assert.equal(out.kept, aboard - 100, 'the cargo that does not fit stays aboard'); assert.equal(w.run.mode, 'full', 'home, STORAGE FULL'); assert.equal(w.run.cell, 0); }
{ const w = world(); w.field.drop(5, 400, 0); const out = settleBreak(w.run, 0, { ...w.host, flares: [], room: () => w.pearls.room() });
  assert.deepEqual(out, { cargo: 0, field: 0, kept: 0 }, 'nothing flagged, nothing banked: not automatic'); assert.equal(w.field.total(), 400); assert.equal(w.run.trips, 0); }
assert.equal(roverWord(createRoverRun(ROVER, 0)), 'HOME');
// THE ROVER BITTEN (the economy design 2.6, 2026-11-12): a jab takes up to ROVER.threat.bite off the hold, lost; never below empty; no hit points
{ const r = createRoverRun(ROVER, 7); assert.equal(ROVER.threat.bite, 100); assert.equal(bite(r, 100), 0, 'an empty hold loses nothing'); r.cargo = 250;
  assert.equal(bite(r, ROVER.threat.bite, 3), 100); assert.equal(bite(r, 100), 100); assert.equal(bite(r, 100), 50, 'what is left'); assert.equal(r.cargo, 0); assert.equal(r.bitten, 250);
  assert.equal(r.events.filter((e) => e.ev === 'bitten').length, 3); assert.equal(roverCell(r), 7, 'at home its cell is home'); }
console.log('Rover run: a full trip, the hold full and back, the queue, STORAGE FULL and no road hold.');

// TOO MANY ENEMIES (owner, 2026-11-10): six bodies round the rover send it home with what it has; a standing flare's order waits until its ground is clear
{ const w = world(); let bodies = 0; w.host.threat = () => bodies; w.run.tune = { ...w.run.tune, retreat: { bodies: 6, cells: 4, clear: 2 } };
  w.field.drop(20, 900, 0); w.live.add('f1'); dispatch(w.run, { id: 'f1', cell: 20 });
  w.step(Math.PI + 20.3); assert.equal(w.run.mode, 'harvest'); w.step(2); assert.ok(w.run.cargo > 100 && w.run.cargo < 300, `raking: ${w.run.cargo}`);
  bodies = 5; w.step(0.5); assert.equal(w.run.mode, 'harvest', 'five is not too many');
  bodies = 6; const had = w.run.cargo; w.step(0.1); assert.equal(w.run.mode, 'home', 'six: it turns for home'); assert.equal(roverWord(w.run), 'RETREATING'); assert.ok(Math.abs(w.run.cargo - had) < 11, 'with what it has');
  w.step(Math.PI + 20.3 + 2); assert.equal(w.run.mode, 'idle', 'home and unloaded'); assert.ok(w.pearls.list()[0].stored > 100, 'the hold banked');
  w.step(1); assert.equal(w.run.mode, 'idle', 'the flare stands over the rest, but its ground is not clear'); assert.equal(roverWord(w.run), 'HOLDING · ENEMIES');
  bodies = 3; w.step(1); assert.equal(w.run.mode, 'idle', 'three is above the clear bar of two');
  bodies = 2; w.step(0.1); assert.equal(w.run.mode, 'out', 'clear: back out for the rest'); assert.equal(roverWord(w.run), 'OUT');
  // on the road out, half way: it turns round from where it is, not from the road's first cell
  w.step(Math.PI + 10); bodies = 9; w.step(0.05); assert.equal(w.run.mode, 'home'); assert.ok(w.run.cell >= 8 && w.run.cell <= 12, `turned round mid-road at cell ${w.run.cell}`);
  // home from a road retreat: the flare's ground may be clear, the ground it turned round on must be too (no yo-yo)
  { const fled = w.run.fled; assert.ok(fled >= 8 && fled <= 12); w.host.threat = (c) => (c === fled || c == null ? 9 : 0); w.step(Math.PI + 12); assert.equal(w.run.mode, 'idle'); assert.equal(roverWord(w.run), 'HOLDING · ENEMIES', 'the road is still held');
    w.host.threat = () => 0; w.step(0.1); assert.equal(w.run.mode, 'out', 'the road clear: out again'); assert.equal(w.run.fled, null); }
  // a queued order is held too, and goes once clear
  const q = world(); let n = 9; q.host.threat = () => n; q.run.tune = { ...q.run.tune, retreat: { bodies: 6, cells: 4, clear: 2 } };
  q.field.drop(5, 100, 0); q.live.add('f2'); dispatch(q.run, { id: 'f2', cell: 5 }); q.step(1); assert.equal(q.run.mode, 'idle'); assert.equal(q.run.queued?.id, 'f2', 'the order kept');
  n = 0; q.step(0.1); assert.equal(q.run.mode, 'out');
  // no host.threat: the rover of round 8
  const o = world(); o.run.tune = { ...o.run.tune, retreat: { bodies: 6, cells: 4, clear: 2 } }; o.field.drop(5, 100, 0); o.live.add('f3'); dispatch(o.run, { id: 'f3', cell: 5 }); o.step(0.1); assert.equal(o.run.mode, 'out');
}

// THE TANK'S GROUND (owner, 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."): on a 12 x 8 grid of 10 m cells
// with a wall, the road ahead is looked at every recheck s; a wall built across it sends the rover round (REROUTE), no way round holds it where it
// stands (NO ROAD, no jump) until the way opens; a pile on a blocked cell is raked from the open cell beside it; a door still opening holds it in place
{ const { bfsPath } = await import('../src/dungeon.js');
  const W = 12, H = 8, id = (x, y) => y * W + x, xy = (c) => [c % W, Math.floor(c / W)];
  const adj = Array.from({ length: W * H }, (_, c) => { const [x, y] = xy(c); return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [x + a, y + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < W && b < H).map(([a, b]) => id(a, b)); });
  const grid = () => {
    const shut = new Set(), field = createField({ seep: null, maxPiles: 100 }), pearls = createPearls({ count: 1, capacity: 1e9 }), live = new Set(); let now = 0, waiting = false;
    const open = (c) => !shut.has(c);
    const host = {
      path: (a, b, within = 1) => bfsPath(adj, a, open(b) ? (c) => c === b : (c) => { const [ax, ay] = xy(c), [bx, by] = xy(b); return c !== b && open(c) && Math.hypot(ax - bx, ay - by) <= within; }, { has: (c) => !open(c) }),
      length: (cells) => (cells.length - 1) * 10, bearing: (a, b) => { const [ax, ay] = xy(a), [bx, by] = xy(b); return Math.atan2(bx - ax, by - ay); },
      near: (cell, reach) => field.near(cell, reach, (p, q) => { const [ax, ay] = xy(p), [bx, by] = xy(q); return Math.hypot(ax - bx, ay - by); }),
      take: (cell, kg) => field.take(cell, kg, now), deposit: (kg) => pearls.fill(kg), live: (o) => live.has(o.id), open, wait: () => waiting,
    };
    const run = createRoverRun({ ...ROVER, capacity: 1000, speed: 10, turn: 100, reach: 1, harvestRate: 1000, unloadRate: 1000, recheck: 0.5 }, id(0, 4), Math.PI / 2);
    const step = (secs, dt = 0.05) => { for (let k = 0; k < Math.round(secs / dt); k++) { now += dt; stepRover(run, dt, now, host); } };
    return { shut, field, live, run, step, host, setWait: (v) => { waiting = v; } };
  };
  // a wall built across the road mid-trip: round it, never through it
  { const g = grid(); g.field.drop(id(11, 4), 300, 0); g.live.add('f'); dispatch(g.run, { id: 'f', cell: id(11, 4) });
    g.step(0.1); assert.equal(g.run.mode, 'out'); assert.equal(g.run.path.length, 12, 'straight along row 4');
    g.step(3); const was = g.run.path; for (let y = 2; y <= 6; y++) g.shut.add(id(7, y));   // a wall at x 7, rows 2-6, ahead of it
    g.step(0.6); assert.notEqual(g.run.path, was, 'a new road'); assert.ok(g.run.events.some((e) => e.ev === 'reroute'), 'REROUTE noted');
    assert.ok(g.run.path.every((c) => !g.shut.has(c)), 'the new road never crosses the wall'); assert.equal(g.run.path.at(-1), id(11, 4), 'to the same flare');
    const seen = new Set(); for (let k = 0; k < 400 && g.run.mode === 'out'; k++) { g.step(0.05); seen.add(g.run.path ? g.run.path[g.run.k] : g.run.cell); }
    assert.equal(g.run.mode, "harvest", `it got there ${JSON.stringify(g.run.events)}`); assert.ok([...seen].every((c) => !g.shut.has(c)), 'every cell it stood on open'); }
  // no way round: it holds where it stands with NO ROAD, never jumps; the wall gone, it goes on
  { const g = grid(); g.live.add('f'); g.field.drop(id(11, 4), 300, 0); dispatch(g.run, { id: 'f', cell: id(11, 4) }); g.step(0.1); g.step(3);
    for (let y = 0; y < H; y++) g.shut.add(id(7, y));
    g.step(0.6); const at = g.run.cell; assert.equal(g.run.stuck, true); assert.equal(roverWord(g.run), 'NO ROAD'); assert.equal(g.run.path, null);
    assert.ok(xy(at)[0] >= 2 && xy(at)[0] <= 4, `held where it stood (cell x ${xy(at)[0]})`); g.step(5); assert.equal(g.run.cell, at, 'no jump'); assert.equal(g.run.mode, 'out');
    assert.equal(g.run.events.filter((e) => e.ev === 'stuck').length, 1, 'noted once');
    for (let y = 0; y < H; y++) g.shut.delete(id(7, y)); g.step(0.6); assert.equal(g.run.stuck, false); assert.equal(roverWord(g.run), 'OUT'); assert.ok(g.run.events.some((e) => e.ev === 'road'));
    g.step(10); assert.ok(g.run.events.some((e) => e.ev === 'arrive'), 'it got there'); }
  // no road home: NO ROAD HOME, held, asked again every recheck
  { const g = grid(); g.run.cell = id(10, 4); g.run.mode = 'harvest'; g.run.order = null; for (let y = 0; y < H; y++) g.shut.add(id(5, y));
    g.step(0.1); assert.equal(g.run.mode, 'home'); assert.equal(roverWord(g.run), 'NO ROAD HOME'); g.step(3); assert.equal(g.run.cell, id(10, 4), 'held');
    g.shut.clear(); g.step(0.6); assert.equal(g.run.stuck, false); g.step(12); assert.equal(g.run.mode, 'idle', 'home'); }
  // a pile on a blocked cell: raked from the open cell beside it
  { const g = grid(); g.shut.add(id(6, 4)); g.field.drop(id(6, 4), 300, 0); g.live.add('f'); dispatch(g.run, { id: 'f', cell: id(5, 4) });
    g.step(0.1); g.step(7); assert.equal(g.run.events.find((e) => e.ev === 'arrive')?.cell, id(5, 4)); assert.ok(g.run.harvested >= 299, `raked from beside: ${g.run.harvested}`); assert.ok(!g.run.skip.has(id(6, 4)), 'not skipped'); }
  // a door still opening ahead: it holds its place on the road
  { const g = grid(); g.live.add('f'); g.field.drop(id(11, 4), 300, 0); dispatch(g.run, { id: 'f', cell: id(11, 4) }); g.step(0.1); g.step(2); const s = g.run.s;
    g.setWait(true); g.step(2); assert.equal(g.run.s, s, 'held'); assert.equal(g.run.wait, true); g.setWait(false); g.step(1); assert.ok(g.run.s > s + 9, 'on again'); }
  console.log('Rover run on the tank\'s ground: round a new wall, held without a road (no jump), raked from beside a blocked pile, held at a door.');
}
