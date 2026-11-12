// THE COLONY ON ISAO'S PROGRAMME (the owner's note of 2026-11-07: "the base should not be built yet"; the grid since 2026-11-12 night, spec
// docs/superpowers/specs/2026-11-12-colony-layout-design.md): the seven cells are board steps bought as kinds and printed by the gantry when it is
// home; the six bridges follow their domes on their own (`when.stand`, `when.home`), not for sale; each bridge's
// print plot is its own frame strip (src/fx/base-print.js plotOf `frame`); the host answers `standing(id)` to the programme and the board.
import assert from 'node:assert/strict';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { DOME_ISLANDS, DOME_STRUCTURES, BRIDGE_PLOT, DOME_GRID, COLONY_CELLS, COLONY_BRIDGES, COLONY_DEFAULT, COLONY_GANTRY } from '../src/content/dome-city.js';
import { COLONY } from '../src/content/colony.js';
import { makeBuildProgramme, due, buy, finish, snapshot } from '../src/domain/build-programme.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES, withBaseLayout } from '../src/content/base-layout.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { createBasePrint } from '../src/fx/base-print.js';

const step = (id) => BASE_PROGRAMME.find((s) => s.id === id);
const DOMES = COLONY_CELLS.map((c) => `dome-${c.id}`);
const BRIDGES = COLONY_BRIDGES.map(([a, b]) => `bridge-${a}-${b}`);
const domeOf = (id) => DOME_STRUCTURES.find((s) => s.id === id);

// THE COLONY ON THE GRID (2026-11-12 night): seven dome steps, one a cell of the table, each its island and its dome, bought on the board as a kind
// (the default city's kind and its perk on the step), printed by the gantry (`gantry`) between waves once it is home; passable
{
  assert.deepEqual(DOMES, ['dome-nw', 'dome-ne', 'dome-w', 'dome-e', 'dome-sw', 'dome-s', 'dome-se']);
  for (const id of DOMES) {
    const s = step(id), cell = id.slice(5), kind = COLONY_DEFAULT[cell];
    const behind = { w: ['dome-nw', 'dome-sw'], e: ['dome-ne', 'dome-se'] }[cell];   // the corner rule: a column's middle after its corners stand
    assert.deepEqual({ ...s, label: null }, { id, label: null, cell, kind, islands: [id], structures: [id], board: true, gantry: true, when: { sector: 1, idle: true, home: true, ...(behind ? { stand: behind } : {}) }, passable: true,
      seconds: COLONY_GANTRY.seconds, metres: COLONY_GANTRY.top, brief: 'build_dome', perk: COLONY.kinds[kind].perk }, `${id}: the step's shape`);
    assert.ok(DOME_ISLANDS.some((i) => i.id === id) && domeOf(id), `${id}: its island and its dome are the grid's`);
    assert.equal(BUILD_BOARD.structures[id], undefined, `${id}: not a structure card (THE COLONY's row deals the kinds, src/domain/colony.js)`);
  }
  const at = (id) => BASE_PROGRAMME.findIndex((s) => s.id === id);
  assert.ok(DOMES.every((id) => at(id) > at('pearl')), 'every dome after the fourth Bio-Pearl');
}

// the six bridges: not for sale, each due once its two domes stand and the gantry is home, printed on its own frame strip, passed over until then
{
  for (const id of BRIDGES) {
    const s = step(id), b = domeOf(id);
    assert.deepEqual({ islands: s.islands, structures: s.structures, frame: s.frame, plot: s.plot, seconds: s.seconds, metres: s.metres, brief: s.brief, perk: s.perk, board: !!s.board, passable: s.passable },
      { islands: [], structures: [id], frame: true, plot: BRIDGE_PLOT, seconds: 8, metres: 6, brief: 'build_bridge', perk: null, board: false, passable: true }, `${id}: the step's shape`);
    // the two domes it names stand a grid step either side of it along its length
    const linked = DOME_ISLANDS.filter((i) => Math.abs(Math.hypot(i.x - b.x, i.z - b.z) - DOME_GRID / 2) < 1e-6 && (b.heading[0] ? i.x === b.x : i.z === b.z));
    assert.deepEqual(linked.map((i) => i.id).sort(), [...s.when.stand].sort(), `${id}: its two domes`);
    assert.deepEqual(Object.keys(s.when), ['stand', 'home'], `${id}: no gate but its domes and the gantry home`);
    assert.ok(s.when.stand.every((d) => at(d) < BASE_PROGRAMME.indexOf(s)), `${id}: after its domes on the programme`);
  }
  assert.deepEqual(BASE_PROGRAMME.slice(-BRIDGES.length).map((s) => s.id), BRIDGES, 'the bridges last: nothing waits behind a bridge');
}
function at(id) { return BASE_PROGRAMME.findIndex((s) => s.id === id); }

// THROUGH due(), as the programme host asks: the west column bought and printed, the bridge between NW and W comes due only once the host says both
// stand and the gantry is home; an unbought east column holds nothing up, and no standing() from the host means no bridge
{
  const before = new Set(BASE_PROGRAMME.slice(0, at('dome-nw')).map((s) => s.id));
  const pg = makeBuildProgramme(BASE_PROGRAMME, { standing: (s) => before.has(s.id) }), stands = new Set(), standing = (id) => stands.has(id);
  const ctx = { phase: 'expedition', sector: 2, waveActive: false, back: 'held', manned: 2 };
  assert.equal(due(pg, ctx), null, 'nothing bought: the colony waits');
  assert.equal(buy(pg, 'dome-nw', { kind: 'habitat', perk: null }), true); assert.equal(buy(pg, 'dome-w'), true); assert.equal(buy(pg, 'dome-sw'), true);
  assert.equal(due(pg, { ...ctx, waveActive: true }), null, 'a dome prints between waves');
  assert.equal(due(pg, { ...ctx, home: false }), null, 'a dome waits for the gantry to be home');
  assert.equal(due(pg, ctx)?.id, 'dome-nw'); assert.equal(finish(pg, step('dome-nw')), null, 'bought as a habitat: no perk');
  assert.equal(due(pg, { ...ctx, standing })?.id, 'dome-sw', 'W waits for its corners to stand: SW first, though bought after');
  assert.equal(finish(pg, step('dome-sw')), null, 'a habitat');
  stands.add('dome-nw'); stands.add('dome-sw');
  assert.equal(due(pg, { ...ctx, standing })?.id, 'dome-w', 'both corners stand: W'); assert.equal(finish(pg, step('dome-w')), 'farm', 'bought as itself: the default kind\'s perk');
  stands.clear();
  assert.deepEqual(snapshot(pg).kinds, { nw: 'habitat', w: 'biosphere', sw: 'habitat' }, 'the kinds the cells hold');
  assert.equal(due(pg, ctx), null, 'no standing() from the host: the bridge waits');
  stands.add('dome-nw');
  assert.equal(due(pg, { ...ctx, standing }), null, 'one dome standing: the bridge waits');
  stands.add('dome-w');
  assert.equal(due(pg, { ...ctx, standing, home: false }), null, 'the gantry out: the bridge waits');
  assert.equal(due(pg, { ...ctx, standing })?.id, 'bridge-nw-w', 'both stand: the bridge is due');
  assert.equal(due(pg, { ...ctx, waveActive: true, standing })?.id, 'bridge-nw-w', 'a bridge has no idle gate');
  finish(pg, step('bridge-nw-w'));
  assert.equal(due(pg, { ...ctx, standing }), null, 'dome-sw not standing: its bridge stays passed over, and the east column\'s too');
  assert.ok(!snapshot(pg).owed.some((id) => BRIDGES.includes(id)), 'a passed-over bridge is not owed');
}

// THE FRAME PLOT (src/fx/base-print.js): a bridge stands on natural ground at its own frame x, z, no island under it (src/content/dome-city.js),
// so the step's plot is the plan's structure: its x, z, heading and cell; BRIDGE_PLOT is the strip the placement rule reads (4.4 m in x, 54 m
// in z), so with heading [-1, 0] the 54 m runs across the heading and the 4.4 m along it
{
  const placer = { toWorld: (p) => ({ toArray: () => p.slice() }) };
  const grows = [], base = { growIsland: (id, k) => grows.push(['island', id, k]), grow: (id, k) => grows.push(['structure', id, k]), growGate() {}, growWall() {} };
  const bridge = { id: 'bridge-nw-w', anchor: 'frame', x: -80, z: -35.1, y: 0, heading: [-1, 0], cell: 17, pending: true };
  const plan = { islands: [{ id: 'dome-nw', x: -80, z: -70.2, w: 20, d: 20, heading: [0, 1], cell: 3 }], structures: [bridge], walls: [], gates: [] };
  const print = createBasePrint({ base, plan, placer }), s = step('bridge-nw-w');
  assert.equal(print.cellOf(s), 17, 'Isao flies to the bridge\'s own cell');
  const bed = print.bed(s), near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(bed(0, 0, 0), [-80, 0, -35.1]), `the plot's centre is the bridge's frame point (${bed(0, 0, 0)})`);
  assert.ok(near(bed(1, 0, 1), [-80, 6, -35.1 + 27]) && near(bed(-1, 0, 1), [-80, 6, -35.1 - 27]), `the deck's 54 m along z (${bed(1, 0, 1)})`);
  assert.ok(near(bed(0, 1, 0.5), [-80 - 2.2, 3, -35.1]) && near(bed(0, -1, 0.5), [-80 + 2.2, 3, -35.1]), `its 4.4 m width along x (${bed(0, 1, 0.5)})`);
  // a frame structure turned [0, 1] reads the plot straight: half its first number across, half its second along
  const flat = { ...bridge, id: 'flat', heading: [0, 1], x: 5, z: 7, cell: 4 };
  const fp = createBasePrint({ base, plan: { ...plan, structures: [flat] }, placer }), fs = { id: 'f', islands: [], structures: ['flat'], frame: true, plot: [4, 10], metres: 2 };
  assert.ok(near(fp.bed(fs)(1, 1, 1), [5 + 2, 2, 7 + 5]), `heading [0, 1]: hw plot[0] / 2, hd plot[1] / 2 (${fp.bed(fs)(1, 1, 1)})`);
  assert.equal(createBasePrint({ base, plan: { ...plan, structures: [] }, placer }).cellOf(s), -1, 'a plan without the bridge: no plot');
  print.progress(s, 0.5); print.finish(s);
  assert.deepEqual(grows, [['structure', 'bridge-nw-w', 0.5], ['structure', 'bridge-nw-w', 1]], 'no slab: the whole print is the bridge, from its first second');
}

// every piece a grown dome-city base leaves pending is printed by exactly one step: no dome or bridge is left unprinted
{
  const planet = buildStoryPlanet({ ...STORY_RECIPE, points: 800, rooms: 24, extraCorridors: 12 }, STORY_CLEARING);
  const { islands, structures } = withBaseLayout(ISLANDS, STRUCTURES, 'dome');
  const plan = planBase(planet, { islands, structures, kit: KIT, stages: STAGES }, 1, { reach: STAGES.length - 1 });
  const count = (id, key) => BASE_PROGRAMME.filter((s) => s[key].includes(id)).length;
  for (const id of DOMES) assert.ok(plan.islands.find((i) => i.id === id)?.pending, `${id}: pending on a growing base`);
  for (const i of plan.islands.filter((x) => x.pending)) assert.equal(count(i.id, 'islands'), 1, `island ${i.id} is printed once`);
  for (const s of plan.structures.filter((x) => x.pending && x.id !== 'rotor')) assert.equal(count(s.id, 'structures'), 1, `structure ${s.id} is printed once`);
  for (const id of BRIDGES) assert.ok(plan.structures.find((x) => x.id === id).cell >= 0, `${id}: the plan gives the bridge a cell to fly to`);
}

// Isao's lines (captions until recorded)
{
  assert.deepEqual(BRIEFS.build_dome && { face: BRIEFS.build_dome.face, title: BRIEFS.build_dome.title, lines: BRIEFS.build_dome.lines }, { face: 'glee', title: 'ISAO · THE DOMES', lines: ['A dome for the colony. Everyone wants a window.'] });
  assert.deepEqual(BRIEFS.build_bridge?.lines, ['And a bridge between them. No helmets indoors.']);
  assert.ok(!BRIEFS.build_dome.once && !BRIEFS.build_bridge.once, 'said at every dome and bridge, not once a browser');
}
// THE SETTLING (2026-11-08, spec 2.B, 2.C): the gate and the Stålheart print from the deploy; the pad, the recycler's work and the array are the first
// orders' steps, printed as bought, the recycler's work paying a barrel
{
  const by = Object.fromEntries(BASE_PROGRAMME.map((s) => [s.id, s]));
  assert.deepEqual(by.gate.when, { phase: 'foundry' }); assert.deepEqual(by.stalheart.when, { phase: 'foundry' });
  for (const id of ['landing', 'foundry', 'solar']) { assert.equal(by[id].board, true, `${id} on the board`); assert.equal(by[id].first, true, `${id} a first order`); assert.deepEqual(by[id].when, { phase: 'foundry' }, `${id} prints as bought`); }
  assert.equal(by.foundry.pays, 600, 'Isao\'s work on the AFR-01 pays a barrel'); assert.equal(by.landing.pays, undefined); assert.equal(by.solar.perk, 'station');
  assert.deepEqual(BASE_PROGRAMME.filter((s) => s.first).map((s) => s.id), ['landing', 'foundry', 'solar'], 'the three, in the programme\'s order');
}
console.log('Base programme: seven colony cells bought as kinds and printed by the gantry when home, six bridges after their two domes on their own frame strip, every pending piece of the grid printed once, Isao\'s two lines.');
