// THE STÅLHEART IS ALWAYS BUILDING (owner, 2026-11-13: "makes it feel like we need to feed it biomass"): src/domain/hungry-build.js.
import assert from 'node:assert/strict';
import { hungerOf, priceOfStep, nextHungry, whoShows } from '../src/domain/hungry-build.js';
import { HUNGRY_BUILD } from '../src/content/dome-city.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { COLONY } from '../src/content/colony.js';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { createGantryDrive } from '../src/fx/gantry-drive.js';
import { COLONY_CELLS, COLONY_GANTRY as T } from '../src/content/dome-city.js';
import { toolShare } from '../src/domain/gantry-route.js';

const cap = HUNGRY_BUILD.cap;
assert(cap > 0 && cap < 1, 'never reads finished before it is paid');
assert.equal(hungerOf(0, 3000, cap), 0, 'a starved bank holds it at nothing');
assert.equal(hungerOf(1500, 3000, cap), cap / 2, 'half the price, half the cap');
assert.equal(hungerOf(9000, 3000, cap), cap, 'a full bank caps it');
assert.equal(hungerOf(-50, 3000, cap), 0);
assert.equal(hungerOf(500, 0, cap), 0, 'no price, nothing shown');
assert(hungerOf(2000, 3000, cap) > hungerOf(1000, 3000, cap), 'feeding biomass advances it');

const tables = { structures: BUILD_BOARD.structures, kinds: COLONY.kinds, index: 1 };
const domes = BASE_PROGRAMME.filter((s) => s.cell);
assert.equal(priceOfStep({ id: 'garage', board: true }, tables), BUILD_BOARD.structures.garage.price);
assert.equal(priceOfStep({ id: 'garage', board: true }, { ...tables, index: 1.33 }), Math.round((BUILD_BOARD.structures.garage.price * 1.33) / 10) * 10);
assert.equal(priceOfStep({ id: 'gate' }, tables), null, 'an automatic step has no price');
if (domes.length) assert.equal(priceOfStep(domes[0], tables), COLONY.kinds[domes[0].kind].price, 'a dome costs its kind');

const steps = [{ id: 'a' }, { id: 'b', board: true }, { id: 'c', board: true, gantry: true, cell: 'x', kind: 'habitat' }, { id: 'd', board: true }];
const price = (s) => priceOfStep(s, { structures: { b: { price: 1000 }, d: { price: 2000 } }, kinds: COLONY.kinds });
const base = { done: new Set(), bought: new Set(), price };
assert.equal(nextHungry(steps, base).step.id, 'b', 'the first board step in order');
assert.equal(nextHungry(steps, { ...base, bought: new Set(['b']) }).step.id, 'c', 'a bought step is the programme\'s, not hungry');
assert.equal(nextHungry(steps, { ...base, done: new Set(['b']), active: 'c' }).step.id, 'd', 'nor a printing one');
assert.equal(nextHungry(steps, { ...base, holds: (s) => s.id !== 'b' }).step.id, 'c', 'one whose when does not hold waits');
assert.equal(nextHungry(steps, { ...base, placed: (s) => s.id === 'd' }).step.id, 'd', 'one with no place on the plan is skipped');
assert.equal(nextHungry(steps, { ...base, done: new Set(['b', 'c', 'd']) }), null, 'the programme finished: idle');
assert.equal(whoShows(steps[2], { ready: true }), 'kidou');
assert.equal(whoShows(steps[2], { ready: false }), 'print', 'before KIDOU stands the fixed Stålheart shows it');
assert.equal(whoShows(steps[1], { ready: true }), 'print', 'no road: the partial rises in place');
// THE HUNGRY JOB on the drive (src/fx/gantry-drive.js hunger): out with something in the bank, held over the cell at the bank's share, stalled,
// taken over by the real job in place, or given up for another one (partial undone, home, out to the bought one)
{
  const poses = [], parts = [], hands = [], prints = [];
  const base = { move: () => true, rig: (id, p) => { poses.push(p); return []; } };
  const tick = (g, s) => { for (let t = 0; t < s; t += 0.1) g.tick(0.1); };
  const g = createGantryDrive({ base, cells: COLONY_CELLS, tune: T, split: () => 0.3 }), share = toolShare(0.3, T);
  const w = { id: 'dome-w', cell: 'w', seconds: 30 }, nw = { id: 'dome-nw', cell: 'nw', seconds: 30 }, partial = (st, k) => parts.push([st.id, k]);
  g.hunger(w, 0, { progress: partial }); assert.equal(g.state().phase, 'home', 'an empty bank: KIDOU stays parked');
  g.hunger(w, 0.5, { progress: partial }); assert.equal(g.state().phase, 'out'); assert.equal(g.home(), true, 'a hungry job never holds the programme');
  tick(g, 25); assert.equal(g.state().phase, 'hold', 'held over W');
  g.hunger(w, 0.5, { progress: partial }); tick(g, 30);
  assert.ok(Math.abs(parts.at(-1)[1] - 0.5 * share) < 1e-9, `the partial at half the tool's share (${parts.at(-1)})`);
  assert.ok(poses.at(-1).mode === 'fabricate' && poses.at(-1).stall === true, 'no longer rising: the beam stalls');
  g.hunger(w, 0.75, { progress: partial }); g.tick(0.1); assert.equal(poses.at(-1).stall, false, 'fed: the beam works again');
  tick(g, 10);
  assert.equal(g.start(w, { progress: (st, k) => prints.push(k), hand: (st, k) => hands.push([st.id, k]) }), true, 'bought: the real job takes it over');
  assert.equal(g.state().phase, 'print'); g.tick(0.1); assert.ok(prints[0] >= 0.75 * share - 1e-6, `printed on from where it stood (${prints[0]})`);
  tick(g, 30); assert.deepEqual(hands, [['dome-w', share]]); tick(g, 30); assert.equal(g.state().phase, 'home'); assert.equal(g.state().trips, 1);
  // given up for another: the partial undone, home, then out to the bought one
  parts.length = 0; g.hunger(w, 0.4, { progress: partial }); tick(g, 40); assert.equal(g.state().phase, 'hold');
  assert.equal(g.start(nw, { progress() {}, hand() {} }), true); assert.deepEqual(parts.at(-1), ['dome-w', 0], 'W\'s partial undone');
  assert.equal(g.state().phase, 'back'); tick(g, 40); assert.equal(g.state().step, 'dome-nw', 'out to the bought one'); assert.equal(g.state().hungry, null);
}
console.log(`hungry-build: cap ${cap}, ${domes.length} domes priced by kind, next/who rules hold`);
