// THE DOME CITY ON ISAO'S PROGRAMME (the owner's note of 2026-11-07: "the base should not be built yet. Isao comes out and starts a base from
// scratch"; spec docs/superpowers/specs/2026-11-07-base-from-scratch-design.md section 2.A): the six domes are board steps, bought between
// sectors and printed at their sector gates; the four bridges follow their domes on their own (`when.stand`), not for sale; each bridge's
// print plot is its own frame strip (src/fx/base-print.js plotOf `frame`); the host answers `standing(id)` to the programme and the board.
import assert from 'node:assert/strict';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { DOME_ISLANDS, DOME_STRUCTURES, DOME_SCALE, BRIDGE_PLOT } from '../src/content/dome-city.js';
import { makeBuildProgramme, due, buy, finish, snapshot } from '../src/domain/build-programme.js';
import { BRIEFS } from '../src/isaobriefs.js';
import { STORY_RECIPE, STORY_CLEARING } from '../src/content/story-defaults.js';
import { ISLANDS, STRUCTURES, KIT, STAGES, withBaseLayout } from '../src/content/base-layout.js';
import { buildStoryPlanet } from '../src/domain/story-planet.js';
import { planBase } from '../src/domain/base-plan.js';
import { createBasePrint } from '../src/fx/base-print.js';

const step = (id) => BASE_PROGRAMME.find((s) => s.id === id);
const DOMES = ['dome-nw', 'dome-w', 'dome-sw', 'dome-ne', 'dome-e', 'dome-se'];
const BRIDGES = ['bridge-w1', 'bridge-w2', 'bridge-e1', 'bridge-e2'];
const domeOf = (id) => DOME_STRUCTURES.find((s) => s.id === id);

// the six dome steps: one island and its module each, bought on the board, printed at their sector gate between waves
{
  const gate = { 'dome-nw': 1, 'dome-ne': 1, 'dome-w': 2, 'dome-e': 2, 'dome-sw': 3, 'dome-se': 3 };
  for (const id of DOMES) {
    const s = step(id);
    assert.ok(s, `${id}: a step on the programme`);
    assert.deepEqual({ islands: s.islands, structures: s.structures, board: s.board, when: s.when, seconds: s.seconds, metres: s.metres, brief: s.brief, perk: s.perk },
      { islands: [id], structures: [id], board: true, when: { sector: gate[id], idle: true }, seconds: 18, metres: 10, brief: 'build_dome', perk: null }, `${id}: the step's shape`);
    assert.ok(DOME_ISLANDS.some((i) => i.id === id) && domeOf(id), `${id}: its island and its module are the dome city's`);
  }
  // the mouth's side from sector 1, the middle pair from 2, the far pair from 3 (the spec's gates)
  assert.deepEqual(DOMES.filter((id) => step(id).when.sector === 1).sort(), ['dome-ne', 'dome-nw']);
  assert.deepEqual(DOMES.filter((id) => step(id).when.sector === 2).sort(), ['dome-e', 'dome-w']);
  assert.deepEqual(DOMES.filter((id) => step(id).when.sector === 3).sort(), ['dome-se', 'dome-sw']);
}

// the board's prices, by the dome's module, and an effect line that names the dome; every board step has its price; structuresMax stays 4
{
  const price = { habitat: 2400, biosphere: 3000, fabrication: 2800, logistics: 2400 };
  for (const s of BASE_PROGRAMME.filter((x) => x.board)) assert.ok(BUILD_BOARD.structures[s.id]?.price > 0 && BUILD_BOARD.structures[s.id].effect, `${s.id}: a board step has a price and an effect`);
  for (const id of DOMES) {
    const card = BUILD_BOARD.structures[id], module = domeOf(id).module;
    assert.equal(card.price, price[module], `${id}: a ${module} dome costs ${price[module]} kg`);
    assert.ok(card.effect.includes(module) && card.effect.includes('dome'), `${id}: the effect line names the dome (${card.effect})`);
  }
  assert.equal(BUILD_BOARD.structuresMax, 4, 'a board never fills with domes');
  // the colony's own cards come first in the board's priority (src/domain/build-board.js takes the first structuresMax in programme order):
  // a dome has no mechanical effect yet, so the domes stand after the fourth Bio-Pearl
  const at = (id) => BASE_PROGRAMME.findIndex((s) => s.id === id);
  assert.ok(DOMES.every((id) => at(id) > at('pearl')), 'every dome after the fourth Bio-Pearl');
}

// the four bridges: not for sale, each due once its two domes stand, printed on its own frame strip, passed over until then
{
  for (const id of BRIDGES) {
    const s = step(id), b = domeOf(id);
    assert.ok(s && b, `${id}: a step and a structure`);
    assert.deepEqual({ islands: s.islands, structures: s.structures, frame: s.frame, plot: s.plot, seconds: s.seconds, metres: s.metres, brief: s.brief, perk: s.perk, board: s.board ?? false, passable: s.passable },
      { islands: [], structures: [id], frame: true, plot: BRIDGE_PLOT, seconds: 8, metres: 6, brief: 'build_bridge', perk: null, board: false, passable: true }, `${id}: the step's shape`);
    assert.ok(!BUILD_BOARD.structures[id], `${id}: never on the board`);
    // the two domes it names are exactly the two at its x, 35.1 m either side of it along z (26 m to the bridge's end, 14 x 0.65 m to the port)
    const span = 26 + 14 * DOME_SCALE, linked = DOME_ISLANDS.filter((i) => i.x === b.x && [b.z - span, b.z + span].some((z) => Math.abs(i.z - z) < 1e-9)).map((i) => i.id);
    assert.equal(linked.length, 2, `${id}: two domes at z ${b.z} +- ${span}`);
    assert.deepEqual(Object.keys(s.when), ['stand'], `${id}: no gate but its domes`);
    assert.deepEqual(s.when.stand.slice().sort(), linked.sort(), `${id}: due when ${linked.join(' and ')} stand`);
    assert.ok(s.when.stand.every((d) => BASE_PROGRAMME.findIndex((x) => x.id === d) < BASE_PROGRAMME.indexOf(s)), `${id}: after its domes on the programme`);
  }
  assert.deepEqual(BASE_PROGRAMME.slice(-BRIDGES.length).map((s) => s.id), BRIDGES, 'the bridges last: nothing waits behind a bridge');
}

// THROUGH due(), as the programme host asks: the west domes bought and printed, the bridge between them comes due only once the host says both
// stand; an unbought east pair holds nothing up (the bridges are passable), and no standing() from the host means no bridge
{
  const before = new Set(BASE_PROGRAMME.slice(0, BASE_PROGRAMME.findIndex((s) => s.id === 'dome-nw')).map((s) => s.id));
  const pg = makeBuildProgramme(BASE_PROGRAMME, { standing: (s) => before.has(s.id) });
  const ctx = { phase: 'expedition', sector: 2, waveActive: false };
  assert.equal(due(pg, ctx), null, 'nothing bought: the dome city waits');
  assert.equal(buy(pg, 'dome-nw'), true); assert.equal(buy(pg, 'dome-w'), true);
  assert.equal(due(pg, { ...ctx, waveActive: true }), null, 'a dome prints between waves');
  assert.equal(due(pg, ctx)?.id, 'dome-nw'); finish(pg, step('dome-nw'));
  assert.equal(due(pg, ctx)?.id, 'dome-w'); finish(pg, step('dome-w'));
  const stands = new Set();
  const standing = (id) => stands.has(id);
  assert.equal(due(pg, ctx), null, 'no standing() from the host: the bridge waits');
  assert.equal(due(pg, { ...ctx, standing }), null, 'printed is not standing: the host says neither dome stands yet (mid-skin)');
  stands.add('dome-nw');
  assert.equal(due(pg, { ...ctx, standing }), null, 'one dome standing: the bridge waits');
  stands.add('dome-w');
  assert.equal(due(pg, { ...ctx, standing })?.id, 'bridge-w1', 'both stand: bridge-w1 is due');
  assert.equal(due(pg, { ...ctx, waveActive: true, standing })?.id, 'bridge-w1', 'a bridge has no idle gate');
  finish(pg, step('bridge-w1'));
  assert.equal(due(pg, { ...ctx, standing }), null, 'dome-sw never bought: bridge-w2 stays passed over, and the east pair\'s too');
  assert.ok(!snapshot(pg).owed.some((id) => BRIDGES.includes(id)), 'a passed-over bridge is not owed');
}

// THE FRAME PLOT (src/fx/base-print.js): a bridge stands on natural ground at its own frame x, z, no island under it (src/content/dome-city.js),
// so the step's plot is the plan's structure: its x, z, heading and cell; BRIDGE_PLOT is the strip the placement rule reads (4.4 m in x, 54 m
// in z), so with heading [-1, 0] the 54 m runs across the heading and the 4.4 m along it
{
  const placer = { toWorld: (p) => ({ toArray: () => p.slice() }) };
  const grows = [], base = { growIsland: (id, k) => grows.push(['island', id, k]), grow: (id, k) => grows.push(['structure', id, k]), growGate() {}, growWall() {} };
  const bridge = { id: 'bridge-w1', anchor: 'frame', x: -80, z: -35.1, y: 0, heading: [-1, 0], cell: 17, pending: true };
  const plan = { islands: [{ id: 'dome-nw', x: -80, z: -70.2, w: 20, d: 20, heading: [0, 1], cell: 3 }], structures: [bridge], walls: [], gates: [] };
  const print = createBasePrint({ base, plan, placer }), s = step('bridge-w1');
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
  assert.deepEqual(grows, [['structure', 'bridge-w1', 0.5], ['structure', 'bridge-w1', 1]], 'no slab: the whole print is the bridge, from its first second');
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
console.log('Base programme: six domes on the board at their sector gates and prices, four bridges after their two domes on their own frame strip, every pending piece of the dome city printed once, Isao\'s two lines.');
