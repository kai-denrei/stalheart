import assert from 'node:assert/strict';
import { createProgrammeHost } from '../src/fx/programme-host.js';
import { createHullIssue } from '../src/fx/hull-issue.js';
import { makeBuildProgramme, snapshot } from '../src/domain/build-programme.js';
import { BASE_PROGRAMME, BASE_REPAIR } from '../src/content/base-programme.js';
import { BLOCKED, PATH } from '../src/dungeon.js';

const step = (id) => BASE_PROGRAMME.find((s) => s.id === id);
const upTo = (id) => (s) => BASE_PROGRAMME.indexOf(s) < BASE_PROGRAMME.indexOf(step(id));
// a recording controller: the host's values, getters and setters over one state object `s`
function controller(o = {}) {
  const log = [], rec = (k) => (...a) => log.push([k, ...a]);
  const s = {
    story: {
      programme: makeBuildProgramme(BASE_PROGRAMME, { standing: upTo(o.at ?? 'gate') }), sectorN: 0, hull: null, grow: true, backOpen: false,
      beats: { phase: () => o.phase ?? 'rotor-ready' }, wallCells: [4, 5], gateCell: 9, gateCellOf: (id) => (id === 'back' ? 11 : 9), socketToward: {},
      print: { cellOf: (st) => ({ gate: 3, stalheart: 6, backgate: 12 })[st.id] ?? 8, bed: (st) => `bed:${st.id}`, repairBed: (r, tune) => `repair:${r.kind}:${tune.seconds}`, finish: rec('finish') },
    },
    playerHP: 3, waveActive: false, pilotMode: false, briefQ: null, pilot: null, deploy: null, t: 40, berths: [], playerDown: true,
    sectorRun: { gates: () => o.gates ?? [], doorsQuiet: () => true, backOpenBreaches: () => !!o.backOpen, repairGate: rec('repairGate'), note: rec('note') },
    dungeon: { tags: Array(16).fill(PATH) }, tdFullTags: Array(16).fill(PATH), storyBase: { restoreWall: rec('restoreWall') },
    storyViews: { tank: rec('tank'), active: rec('active') },
  };
  const orders = [], breachQueue = [], breachedCells = new Set([5]);
  const c = {
    PLAYER_MAX: 3, orders, breachQueue, breachedCells, gunshipRig: { forgetWalls: rec('forgetWalls') }, showBrief: rec('brief'), spawnIsao: rec('spawnIsao'), updateHud: rec('hud'),
    syncLifeContainers: rec('lives'), rebuildAfterBreach: rec('rebuild'), recomputePortalDist: rec('portalDist'), adoptBays: rec('adoptBays'),
    laserStation: { seated: () => false }, shotId: () => null, deployStart: (n) => { log.push(['deployStart', n]); s.deploy = { n }; }, deployStep: () => { s.deploy = null; },
    leavePilot: rec('leavePilot'), camera: null, startShot: rec('shot'), deployFramePoseFor: rec('frame'), camA: {}, setView: rec('view'),
    setPlayerHP: (v) => { s.playerHP = v; }, setBerths: (v) => { s.berths = v; }, setPlayerDown: (v) => { s.playerDown = v; }, setDeploy: (v) => { s.deploy = v; },
  };
  for (const k of ['story', 'playerHP', 'sectorRun', 'waveActive', 'dungeon', 'tdFullTags', 'storyBase', 'pilotMode', 'briefQ', 'pilot', 'deploy', 't', 'storyViews']) c[k] = () => s[k];
  return { s, c, log, orders, breachQueue, breachedCells, api: createProgrammeHost(c) };
}

// ISAO KEEPS BUILDING: the next step becomes one order for him, with its line, and nothing more while it waits for him
{
  const { s, api, log, orders } = controller();
  api.build();
  assert.deepEqual(orders, [{ kind: 'structure', ci: 3, cost: 0, seconds: step('gate').seconds, head: 0, step: step('gate'), bed: 'bed:gate' }]);
  assert.deepEqual(log, [['spawnIsao'], ['brief', 'build_gate'], ['hud']]);
  assert.equal(snapshot(s.story.programme).active, 'gate');
  api.build(); assert.equal(orders.length, 1, 'an order nobody works yet comes first');
  // THE GATE STANDS: its perk, the walls rock to the swarm and the tank in both worlds, the sector books it
  log.length = 0; orders.length = 0; api.printed(step('gate'));
  assert.equal(api.hasPerk('gate'), true); assert.deepEqual([...api.perks()], ['gate']);
  assert.deepEqual([s.dungeon.tags[4], s.dungeon.tags[5], s.tdFullTags[4], s.tdFullTags[5]], [BLOCKED, BLOCKED, BLOCKED, BLOCKED]);
  assert.deepEqual(log, [['finish', step('gate')], ['note', { type: 'print', id: 'gate' }], ['forgetWalls'], ['rebuild'], ['portalDist']]);
}
// A TUTORIAL CHAPTER'S START (src/content/story-defaults.js STORY_CHAPTERS) finds the Stålheart's print under way: its order carries
// the share already done, and only that step's does
{
  const { s, api, orders } = controller({ at: 'stalheart' });
  s.story.chapter = { head: { stalheart: 0.5 } }; s.dungeon.tags[4] = s.dungeon.tags[5] = BLOCKED;   // the walls stand: no repair first
  api.build(); assert.equal(orders[0].step.id, 'stalheart'); assert.equal(orders[0].head, 0.5, 'the print starts half done');
  orders.length = 0; api.printed(step('stalheart')); api.build(); assert.equal(orders[0].step.id, 'landing'); assert.equal(orders[0].head, 0, 'the next one from nothing');
}
// ISAO MENDS WHAT THE SWARM BROKE: between waves a blown wall comes before the next building, and his line waits for a free seat
{
  const { s, api, log, orders, breachQueue, breachedCells } = controller({ at: 'stalheart' });
  s.dungeon.tags[4] = BLOCKED; s.pilotMode = true;
  api.build();
  assert.deepEqual(orders, [{ kind: 'repair', repair: { kind: 'wall', ci: 5 }, ci: 5, cost: 0, seconds: BASE_REPAIR.wall.seconds, bed: `repair:wall:${BASE_REPAIR.wall.seconds}` }]);
  assert.deepEqual(log, [['spawnIsao'], ['hud']], 'no line over a manned seat');
  log.length = 0; api.repaired(orders[0].repair);
  assert.deepEqual([s.dungeon.tags[5], s.tdFullTags[5], breachedCells.has(5), breachQueue], [BLOCKED, BLOCKED, false, [5]]);
  assert.deepEqual(log, [['restoreWall', 5], ['rebuild'], ['portalDist'], ['hud']]);
  // mid-wave: no repair, the next step instead
  orders.length = 0; s.dungeon.tags[5] = PATH; s.waveActive = true; api.build();
  assert.deepEqual(orders.map((x) => [x.kind, x.ci]), [['structure', 6]], 'a wave on: the Stålheart, not the wall');
}
// TWO DOORS: the worst gate first, found by its id; a gate repaired goes back to full through the sector loop
{
  const { api, orders, log } = controller({ at: 'stalheart', gates: [{ id: 'gate', hp: 9, max: 10 }, { id: 'back', hp: 0, max: 10, broken: true }] });
  api.build();
  assert.deepEqual(orders.map((x) => [x.kind, x.ci, x.repair]), [['repair', 11, { kind: 'gate', id: 'back' }]]);
  assert.deepEqual(log.slice(-2), [['brief', BASE_REPAIR.brief], ['hud']]);
  log.length = 0; api.repaired({ kind: 'gate' }); api.repaired({ kind: 'gate', id: 'back' });
  assert.deepEqual(log, [['repairGate', 'gate'], ['hud'], ['repairGate', 'back'], ['hud']]);
}
// THE BACK GATE IS NEVER PRE-BUILT: a static base prints only it, and only once the surprise is held
{
  const make = (backOpen) => { const k = controller({ at: 'backgate', backOpen, phase: 'expedition' }); Object.assign(k.s.story, { grow: false, backOpen: true, sectorN: 2, backSockets: [{ cell: 12, toward: [0, 0, 1] }] }); k.s.dungeon.tags[4] = k.s.dungeon.tags[5] = BLOCKED; return k; };
  const open = make(true); open.api.build(); assert.deepEqual(open.orders, [], 'the back breach still open: nothing');
  const held = make(false); held.api.build();
  assert.deepEqual(held.orders.map((x) => [x.kind, x.ci, x.step.id]), [['structure', 12, 'backgate']]);
  held.log.length = 0; held.api.printed(step('backgate'));
  assert.deepEqual(held.s.story.socketToward, { 12: [0, 0, 1] }, 'its sockets face the back lane');
  assert.deepEqual(held.log, [['finish', step('backgate')], ['portalDist'], ['note', { type: 'print', id: 'backgate' }]]);
}
// THE PERKS IN THE WORLD: the solar pad charges, the bays become the berths
{
  const { s, api, log } = controller({ at: 'bays' });
  Object.assign(s.story, { arrayPad: { standing: false }, bayBerths: ['b1', 'b2', 'b3'] });
  api.printed(step('solar')); assert.equal(s.story.arrayPad.standing, true);
  api.printed(step('bays')); assert.deepEqual([s.berths, s.story.berths], [['b1', 'b2', 'b3'], ['b1', 'b2', 'b3']]);
  assert.deepEqual(log.at(-1), ['adoptBays', s.storyBase]);
}
// THE ASSEMBLY LINE rebuilds one lost hull at a sector's start, once per sector; THE FIRST MÖRK is issued through the same host
{
  const { s, api, log } = controller({ at: 'backgate' });
  Object.assign(s.story, { sectorN: 3, grow: false }); s.playerHP = 1;
  api.build(); assert.equal(s.playerHP, 2); assert.deepEqual(log, [['lives'], ['hud']]);
  api.build(); assert.equal(s.playerHP, 2, 'once per sector');
  const k = controller({ at: 'landing' }), door = { ci: 7, exit: 9 };
  k.s.story.hull = createHullIssue({ held: true, door }); k.s.pilot = { gunship: true };
  k.api.build();
  assert.deepEqual([k.s.story.hull.state().state, k.s.berths, k.s.playerDown], ['rolling', [door, door, door], false], 'set down outside the door under a gunner');
  const host = k.s.story.hullHost; k.api.build(); assert.equal(k.s.story.hullHost, host, 'one hull host per story');
  assert.equal(k.s.story.hull.out(), true);
}
console.log('Programme host: one order at a time with his line, the gate\'s walls in both worlds, repairs between waves (the worst door first), the back gate only once held, the perks in the world, the rebuilt hull, the first hull through the same host.');
