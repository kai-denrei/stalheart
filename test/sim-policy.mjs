// sim-policy.mjs — the wave simulator's choice rules (src/domain/sim-policy.js): the trunk is the cells two live portals' greedy
// descents share (every cell of the one route when only one lives); the directive per style; style1 opens with the newest unlock
// until the kit arrives, then asks for two slow fields, two lobbers and the longest reach, saves up for a priority buy it cannot
// afford and upgrades only when there is nowhere to put it; style2 buys the newest affordable sentry; nothing without a trunk.
import assert from 'node:assert/strict';
import { trunkCells, simDirective, simPick } from '../src/domain/sim-policy.js';
import { BLOCKED, PATH } from '../src/dungeon.js';
import { TOWERS, TOWER_BY_KEY, unlockedTowerKeys, upgradeCost } from '../src/towers.js';

// a line 5-4-3-2-1-0 to the heart at 0, a spur 6-3, and a wall cell 7 beside 2 and 4: the only high ground
const graph = { adj: [[1], [0, 2], [1, 3, 7], [2, 4, 6], [3, 5, 7], [4], [3], [2, 4]] };
const dungeon = { distToHeart: [0, 1, 2, 3, 4, 5, 4, -1], tags: [PATH, PATH, PATH, PATH, PATH, PATH, PATH, BLOCKED] };
const portals = (a, b) => [{ ci: 5, alive: a }, { ci: 6, alive: b }];
assert.deepEqual(trunkCells(portals(true, true), dungeon, graph), [3, 2, 1], 'two live portals: the cells both routes cross');
assert.deepEqual(trunkCells(portals(true, false), dungeon, graph), [5, 4, 3, 2, 1], 'one: its whole route');
assert.deepEqual(trunkCells(portals(false, false), dungeon, graph), [], 'none: no trunk');
assert.deepEqual(trunkCells([{ ci: 6, alive: true }], { distToHeart: [0, 1, 2, 3, 4, 5, 4, -1].map((d, i) => (i === 3 ? 4 : d)), tags: dungeon.tags }, graph), [6], 'a plateau ends the descent');

assert.deepEqual(['style1', 'style2', 'style0', null].map(simDirective), ['ram', 'avoid', 'wander', 'wander']);

function world({ wave = 1, have = [], biomass = 500, spots = [7], alive = [true, true] } = {}) {
  const asked = [];
  const eco = { canAfford: (c) => { asked.push(c); return c <= biomass; } };
  let trunks = 0;
  const w = { trunk: () => { trunks++; return trunkCells(portals(...alive), dungeon, graph); }, towers: have.map((key, i) => ({ ci: 10 + i, def: TOWER_BY_KEY[key], tier: 0 })),
    wave, eco, graph, placeError: (ci) => (spots.includes(ci) ? null : 'towers need HIGH GROUND'), roster: TOWERS, byKey: TOWER_BY_KEY, unlocked: unlockedTowerKeys(wave), upgradeCost };
  return { w, asked, trunks: () => trunks };
}
// STYLE1: the opening keeps pace with the waves using the newest unlock, on the first high ground beside the trunk
assert.deepEqual(simPick('style1', world({ wave: 1 }).w), { key: 'rotor', ci: 7 });
assert.deepEqual(simPick('style1', world({ wave: 3, have: ['rotor', 'plasma'] }).w), { key: 'quiver', ci: 7 });
// ...then the shape: the slow field first; none of the kit unlocked yet means the cheapest upgrade
assert.deepEqual(simPick('style1', world({ wave: 4, have: ['rotor', 'plasma', 'quiver', 'rotor'] }).w), { key: 'relay', ci: 7 });
const early = world({ wave: 3, have: ['rotor', 'plasma', 'quiver'] });
assert.deepEqual(simPick('style1', early.w), { tower: early.w.towers[0] }, 'nothing of the kit unlocked: the cheapest affordable upgrade');
// two slow fields and two lobbers built: reach everywhere
assert.deepEqual(simPick('style1', world({ wave: 8, have: ['relay', 'relay', 'mortar', 'mortar'] }).w), { key: 'needle', ci: 7 });
// a priority buy it cannot afford is saved up for: no upgrade either
const poor = world({ wave: 5, have: ['rotor', 'plasma', 'quiver', 'rotor'], biomass: 99 });
assert.equal(simPick('style1', poor.w), null);
assert.deepEqual(poor.asked, [100], 'it asked for the relay and stopped');
// affordable but nowhere to put it: the cheapest upgrade it can pay for
const walled = world({ wave: 5, have: ['plasma', 'rotor', 'quiver', 'rotor'], spots: [] });
assert.deepEqual(simPick('style1', walled.w), { tower: walled.w.towers[1] });
// STYLE2: the newest sentry it can afford
assert.deepEqual(simPick('style2', world({ wave: 3, biomass: 85 }).w), { key: 'plasma', ci: 7 });
assert.deepEqual(simPick('style2', world({ wave: 3, biomass: 20 }).w), null, 'nothing affordable and no towers');
const full = world({ wave: 2, have: ['rotor'], biomass: 40, spots: [] });
assert.deepEqual(simPick('style2', full.w), { tower: full.w.towers[0] }, 'nowhere to build: its upgrade');
// NO TRUNK, NO BUILD: not even an upgrade; style0 never looks
const dead = world({ wave: 3, have: ['rotor'], alive: [false, false] });
assert.equal(simPick('style1', dead.w), null);
assert.equal(simPick('style2', dead.w), null);
const idle = world({ wave: 3 });
assert.equal(simPick('style0', idle.w), null);
assert.equal(idle.trunks(), 0, 'style0 never computes the trunk');
console.log('Sim policy: the trunk two portals share, style1\'s opening and shape, saving up, falling back to upgrades, style2\'s newest buy, nothing without a trunk.');
