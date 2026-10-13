// The colony's tick (src/fx/colony-tick.js) over a recording host. Its collaborators (the moment reel, the lapse, the pads, the
// scoreboards, the beacons, the orbital ring, the arc launch, the gust, the paint shop, Isao's voice, the garage arm) are replaced by
// recording stubs through a module loader hook, so every call the tick makes is a named line in one log; the domain rules
// (build-programme, orbital-works, dyes, story-shots) and the content tables are the real ones. The tick's three parts and the harness read:
// open (the reel, the lapse), perks (sector start, chips, armory, paint, gust, boards, beacons), works (the paint, the ring, the launch,
// the calibration), colony.
import assert from 'node:assert/strict';
import { register } from 'node:module';

const EXPORTS = {
  'moment-reel': ['createMomentReel'], 'colony-lapse': ['createColonyLapse'], 'armory-pad': ['createArmoryPad'], 'paint-pad': ['createPaintPad'],
  scoreboard: ['createScoreboard'], 'site-beacons': ['createSiteBeacons'], 'orbital-ring': ['createOrbitalRing'], 'arc-launch': ['createArcLaunch'],
  'ambient-gust': ['createAmbientGust'], 'paint-shop': ['openPaintShop', 'applyLivery'], 'isao-voice': ['isaoSpeak'], runtime: ['applyGarage'],
};
register('data:text/javascript,' + encodeURIComponent(`
const EXPORTS = ${JSON.stringify(EXPORTS)};
export async function resolve(spec, ctx, next) {
  const r = await next(spec, ctx);
  const m = /\\/colony-tick\\.js/.test(ctx.parentURL ?? '') && /\\/([^/]+)\\.js$/.exec(r.url);
  return m && EXPORTS[m[1]] ? { url: 'stub:' + m[1], shortCircuit: true } : r;
}
export async function load(url, ctx, next) {
  if (!url.startsWith('stub:')) return next(url, ctx);
  return { format: 'module', shortCircuit: true, source: EXPORTS[url.slice(5)].map((n) => 'export const ' + n + ' = (...a) => globalThis.__stubs.' + n + '(...a);').join('\\n') };
}`));

const log = [];
const note = (...a) => log.push(a);
const take = () => log.splice(0);
const tk = () => take().filter((x) => x[0] !== 'createAmbientGust' && x[0] !== 'gust.tick');   // the wind ticks in every perks() and is asserted on its own below
const mk = (name, methods = {}, extra = {}) => Object.assign({}, ...Object.entries(methods).map(([k, v]) => ({ [k]: (...a) => { note(`${name}.${k}`, ...a); return typeof v === 'function' ? v(...a) : v; } })), extra);
const W = { framed: false, padHits: 0, paintHit: false, shop: null, launchOpts: null, beaconOpts: null, livery: 7 };
globalThis.__stubs = {
  createMomentReel: (r) => { note('createMomentReel', r.name); return mk('reel', { watch: null }); },
  createColonyLapse: (r, sc) => { note('createColonyLapse', r.name, sc.name); return mk('lapse', { framed: () => W.framed, frame: () => { W.framed = true; }, shoot: null }); },
  createArmoryPad: (sc, o) => { note('createArmoryPad', sc.name, o); return mk('armoryRing', { stand: null, tick: () => W.padHits }); },
  createPaintPad: (sc, o) => { note('createPaintPad', sc.name, o); return mk('paintRing', { stand: null, tick: () => W.paintHit, state: () => ({ ring: 'state' }) }); },
  createScoreboard: (sc, o) => { note('createScoreboard', sc.name, o); return mk(`board:${o.title}`, { update: null, tick: null, state: () => ({ board: o.title }) }); },
  createSiteBeacons: (sc, items, o) => { note('createSiteBeacons', sc.name, items.map((x) => ({ id: x.id, ci: x.ci, point: x.point, start: x.start, model: x.model() })), o.metres); W.beaconOpts = o; return mk('beacons', { tick: null, drop: null, ids: () => ['b'], state: () => 'pulsing' }); },
  createOrbitalRing: (sc, tune) => { note('createOrbitalRing', sc.name, tune.capacity); return mk('ring', { set: null, tick: null, state: () => 'ringstate' }); },
  createArcLaunch: (o) => { note('createArcLaunch', o.launcher, o.now(), o.sfx.name); W.launchOpts = o; return mk('launch', { tick: null, state: () => 'launching' }); },
  createAmbientGust: (sfx) => { note('createAmbientGust', sfx?.name); return mk('gust', { tick: null }, { gusts: 3 }); },
  openPaintShop: (o) => { note('openPaintShop', o.root.name, o.title, o.lines.length > 0, typeof o.hull, typeof o.save); W.shop = o; return { shop: true }; },
  applyLivery: (hull, book) => { note('applyLivery', hull.name, Object.keys(book).length > 0); return Promise.resolve(W.livery); },
  isaoSpeak: (id) => note('isaoSpeak', id),
  applyGarage: (near, secs, k) => { note('applyGarage', near, secs, k); if (W.garageThrows) throw new Error('no arm'); },
};
const { createColonyTick } = await import('../src/fx/colony-tick.js');
const { BASE_PERKS } = await import('../src/content/base-programme.js');
const { BRIEFS } = await import('../src/isaobriefs.js');

const renderer = { name: 'renderer' }, scene = { name: 'scene' }, sfx = { name: 'sfx', play: (...a) => note('sfx.play', ...a) };
const centers = Array.from({ length: 12 }, (_, i) => [i, 0, 0]);
const perksOf = (...p) => new Set(p);
// the host the controller builds (src/td-tab.js colonyTick): values for the fixed objects, getters for what it rebinds, writers
function host(o = {}) {
  const S = { t: 10, hp: 2, ammo: 4, pilot: false, brief: null, shotId: null, story: o.story ?? {}, ...o.state };
  const c = {
    PLAYER_MAX: 3, showBrief: (id) => note('showBrief', id), updateHud: () => note('updateHud'), syncLifeContainers: () => note('lives'),
    story: () => S.story, t: () => S.t, graph: () => ({ centers }), dungeon: () => ({ heart: 2 }), cellSide: () => 0.5,
    playerHP: () => S.hp, playerPos: () => [9, 9, 9], storyBase: () => null, sectorRun: () => null, pilotMode: () => S.pilot, briefQ: () => S.brief, shotId: () => S.shotId,
    setPlayerHP: (v) => { note('setPlayerHP', v); S.hp = v; }, ...o.members,
  };
  if (!o.bare) Object.assign(c, { scene, renderer, sfx, ammoMax: 6, ammo: () => S.ammo, kills: () => ({ strike: 5 }), combo: () => 8, rank: () => 3, hands: () => 11, hull: () => S.hull, setAmmo: (v) => { note('setAmmo', v); S.ammo = v; }, pause: (on) => note('pause', on), root: { name: 'root' }, ...o.members });
  return { S, c, tick: createColonyTick(c) };
}
const withDocument = (on) => { if (on) globalThis.document = { body: { name: 'body' } }; else delete globalThis.document; };

// ---- open(): the reel and the lapse, only with a renderer and a document; the lapse framed once on the heart and the farthest wall cell
{
  withDocument(false);
  const { tick } = host({ story: { programme: { id: 'pg' }, sectorN: 4 } });
  assert.deepEqual(tick.open(), { pg: { id: 'pg' }, sector: 4 }, 'open() returns the programme and the sector');
  assert.deepEqual(take(), [], 'no document: no reel, no lapse');
  withDocument(true);
  const noRenderer = host({ story: {}, members: { renderer: null } });
  assert.deepEqual(noRenderer.tick.open(), { pg: undefined, sector: 0 }, 'no story sector: sector 0');
  assert.deepEqual(take(), [], 'no renderer: no reel, no lapse');
  const s = { programme: null, nukes: [1, 2], wallCells: [7, 1] }, h = host({ story: s });
  h.tick.open();
  assert.deepEqual(take(), [
    ['createMomentReel', 'renderer'], ['reel.watch', 10, { combo: 8, nukes: 2, strikeKills: 5, sector: 0 }],
    ['createColonyLapse', 'renderer', 'scene'], ['lapse.framed'], ['lapse.frame', [2, 0, 0], 5], ['lapse.shoot', 'THE LANDING'],
  ], 'first tick: the reel built and watching, the lapse built, framed on the heart (cell 2) at the farthest wall cell (7 cells away: 5 > 8 cells x 0.5 = 4), shot once');
  h.S.t = 10.5; h.tick.open();
  assert.deepEqual(take(), [['reel.watch', 10.5, { combo: 8, nukes: 2, strikeKills: 5, sector: 0 }], ['lapse.framed']], 'later ticks: the reel watches again, the lapse is already framed and left alone');
  // the members absent: combo 0, no kills, no nukes; no wall cells: the 8-cell floor
  const bare = host({ story: { programme: null }, members: { combo: undefined, kills: undefined } });
  W.framed = false; bare.tick.open();
  assert.deepEqual(take().filter((x) => x[0] !== 'createMomentReel' && x[0] !== 'createColonyLapse'), [
    ['reel.watch', 10, { combo: 0, nukes: 0, strikeKills: 0, sector: 0 }], ['lapse.framed'], ['lapse.frame', [2, 0, 0], 4], ['lapse.shoot', 'THE LANDING'],
  ], 'combo and kills absent read as 0; no wall cells: the frame is 8 cells across');
  // no scene: the reel runs, the lapse does not exist
  const noScene = host({ story: { programme: null }, members: { scene: null } }); W.framed = false; noScene.tick.open();
  assert.deepEqual(take().map((x) => x[0]), ['createMomentReel', 'reel.watch'], 'no scene: the reel, not the lapse');
  withDocument(false);
}

// ---- perks(): the sector start
{
  const pg = { perks: perksOf('rebuild', 'farm', 'chips'), sector: 0 };
  const eco = { addBiomass: (...a) => note('biomass', ...a) };
  const laserStation = { setPeriodScale: (v) => note('setPeriodScale', v) };
  const s = { programme: pg, lapse: mk('lapse', { shoot: null }) };
  const h = host({ story: s, members: { eco: () => eco, laserStation, scene: null } });
  h.tick.perks({ pg, sector: 1 });
  const got = tk();
  assert.deepEqual(got.slice(0, 6), [
    ['lapse.shoot', 'SECTOR 01'], ['setPlayerHP', 3], ['lives'], ['updateHud'], ['biomass', BASE_PERKS.farmKg, { category: 'farm' }], ['updateHud'],
  ], 'a new sector: the lapse shoots, the assembly line rebuilds one hull point, the farm pays its biomass');
  assert.deepEqual(got[6], ['setPeriodScale', BASE_PERKS.chipsPeriod], 'the chip plant closes the passes');
  h.tick.perks({ pg, sector: 1 });
  assert.ok(!tk().some((x) => x[0] === 'lapse.shoot' || x[0] === 'biomass'), 'the same sector again: nothing at its start');
  // sector 0 never feeds the farm; a full hull is not rebuilt; no chips: scale 1; no lapse, no eco, no laser station: nothing breaks
  const pg2 = { perks: perksOf('rebuild', 'farm'), sector: -1 };
  const h2 = host({ story: { programme: pg2 }, state: { hp: 3 }, members: { eco: () => null, scene: null } });
  h2.tick.perks({ pg: pg2, sector: 0 });
  assert.deepEqual(tk(), [], 'sector 0 with a full hull: no rebuild, no farm, and a missing lapse, station and eco are skipped');
  const pg3 = { perks: perksOf('farm'), sector: 0 };
  const h3 = host({ story: { programme: pg3 }, members: { eco: () => null, laserStation: { setPeriodScale: (v) => note('setPeriodScale', v) }, scene: null } });
  h3.tick.perks({ pg: pg3, sector: 2 });
  assert.deepEqual(tk(), [['updateHud'], ['setPeriodScale', 1]], 'sector 2 with the farm but no eco: no payment (the hud refreshes anyway); the passes at their full period');
  const pg4 = { perks: perksOf('farm'), sector: 0 };
  const h4 = host({ story: { programme: pg4 }, members: { eco: () => eco, laserStation: {}, scene: null } });
  h4.tick.perks({ pg: pg4, sector: 2 });
  assert.deepEqual(tk(), [['biomass', 40, { category: 'farm' }], ['updateHud']], 'a station without setPeriodScale is tolerated; the farm pays');
  const pgR = { perks: perksOf('rebuild'), sector: 0 }, hR = host({ story: { programme: pgR }, state: { hp: 1 }, members: { scene: null } });
  hR.tick.perks({ pg: pgR, sector: 1 });
  assert.deepEqual(tk().slice(0, 2), [['setPlayerHP', 2], ['lives']], 'the rebuild adds rebuildHulls to the hull, capped at PLAYER_MAX');
}

// ---- perks(): the armory pad
{
  const pg = { perks: perksOf('armory'), sector: 9 }, pad = { pos: [1, 2, 3], cell: 4 }, s = { programme: pg, armoryPad: pad };
  const h = host({ story: s });
  W.padHits = 0;
  h.tick.perks({ pg, sector: 9 });
  let got = take();
  assert.deepEqual(got.find((x) => x[0] === 'createArmoryPad'), ['createArmoryPad', 'scene', { pos: [1, 2, 3], cellSide: 0.5, tune: BASE_PERKS.armory }], 'the pad ring built once, at the pad, with the armory numbers');
  assert.deepEqual(got.filter((x) => x[0].startsWith('armoryRing')), [['armoryRing.stand', true], ['armoryRing.tick', 0, [9, 9, 9], 4, 6, 10]], 'the first tick: standing, dt 0, the hull at the pad, the shells, the rack size, the clock');
  h.S.t = 10.05; W.padHits = 2; h.tick.perks({ pg, sector: 9 });
  got = take();
  assert.ok(!got.some((x) => x[0] === 'createArmoryPad'), 'the ring is not built twice');
  assert.equal(got.find((x) => x[0] === 'armoryRing.tick')[1].toFixed(2), '0.05', 'dt is the clock since the last tick');
  assert.deepEqual(got.slice(got.findIndex((x) => x[0] === 'setAmmo')).slice(0, 4), [['setAmmo', 6], ['sfx.play', 'tank_shells'], ['isaoSpeak', 'shells_refilled'], ['updateHud']], 'shells delivered: into the rack, the cue, Isao, the hud');
  h.S.t = 30; W.padHits = 0; h.S.hp = 0; h.tick.perks({ pg, sector: 9 });
  got = take();
  assert.equal(got.find((x) => x[0] === 'armoryRing.tick')[1], 0.1, 'dt is capped at a tenth of a second');
  assert.equal(got.find((x) => x[0] === 'armoryRing.tick')[2], null, 'a dead hull is not on the pad');
  assert.ok(!got.some((x) => x[0] === 'setAmmo'), 'no shells, no refill');
  // no ammo/setAmmo/ammoMax/sfx members: 0 shells in, 9 as the rack, and a delivery is tolerated
  const h2 = host({ story: { programme: pg, armoryPad: { pos: [0, 0, 0], ring: mk('ring2', { stand: null, tick: () => 1 }) } }, members: { ammo: undefined, setAmmo: undefined, ammoMax: undefined, sfx: undefined } });
  h2.c.ammo = () => 1;
  assert.doesNotThrow(() => h2.tick.perks({ pg, sector: 9 }));
  got = take();
  assert.deepEqual(got.find((x) => x[0] === 'ring2.tick').slice(2), [[9, 9, 9], 1, 9, 10], 'no ammoMax: the rack is 9');
  // no ammo member: 0 shells in
  const h4 = host({ story: { programme: pg, armoryPad: { pos: [0, 0, 0], ring: mk('ring4', { stand: null, tick: () => 0 }) } }, members: { ammo: undefined } });
  h4.tick.perks({ pg, sector: 9 });
  assert.equal(take().find((x) => x[0] === 'ring4.tick')[3], 0, 'no ammo member: the rack reads empty');
  // no scene: the ring is never built; a pad without ring is skipped
  const h3 = host({ story: { programme: pg, armoryPad: {} }, members: { scene: null } }); h3.tick.perks({ pg, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createArmoryPad'), 'no scene: no ring');
}

// ---- perks(): the paint pad and the garage arm
{
  const pg = { perks: perksOf('garage'), sector: 9 };
  const near = { name: 'near' }, structure = (id) => (id === 'garage' ? { near } : null);
  const s = { programme: pg, paintPad: { cell: 3, pos: [7, 7, 7] } };
  const h = host({ story: s, members: { storyBase: () => ({ structure }), hull: () => ({ name: 'hull' }) } });
  const { DYE_SHOP } = await import('../src/content/dyes.js'), kept = {};
  globalThis.localStorage = { getItem: () => '{not json', setItem: (k, v) => { kept[k] = v; } };   // a corrupt saved book: the dyes start fresh
  withDocument(true); W.paintHit = false;
  h.tick.perks({ pg, sector: 9 });
  let got = take();
  assert.deepEqual(got.find((x) => x[0] === 'createPaintPad'), ['createPaintPad', 'scene', { pos: [3, 0, 0], cellSide: 0.5, tune: BASE_PERKS.paint }], 'the pad is centred on its cell');
  assert.deepEqual(got.filter((x) => x[0] === 'paintRing.stand' || x[0] === 'applyGarage' || x[0] === 'paintRing.tick'), [['paintRing.stand', true], ['applyGarage', near, 0, 1], ['paintRing.tick', 0, [9, 9, 9], 10]], 'standing, the arm parked (shop shut), the hull on the pad');
  // the hull parks: the shop opens, the game pauses, Isao speaks
  W.paintHit = true; h.S.t = 10.05; h.tick.perks({ pg, sector: 9 });
  got = take();
  const i = got.findIndex((x) => x[0] === 'pause');
  assert.deepEqual(got.slice(i, i + 2), [['pause', true], ['isaoSpeak', 'paint_pad']], 'the game holds and Isao speaks as the shop opens');
  assert.deepEqual(got[i + 2], ['openPaintShop', 'root', BRIEFS[BASE_PERKS.paint.brief].title, true, 'function', 'function'], 'the shop opens over the host root with its lines, title, hull getter and save');
  assert.ok(s.dyes && s.shop, 'the dye book made, the shop kept');
  assert.equal(W.shop.hull().name, 'hull', 'its hull getter reads the host hull');
  W.shop.save({ a: 1 }); assert.deepEqual(kept, { [`stalheart:v1:${DYE_SHOP.store}`]: '{"a":1}' }, 'the shop saves the book under the dye store');
  const loop = {}; loop.self = loop; assert.doesNotThrow(() => W.shop.save(loop), 'a book that cannot be written is tolerated: the dyes last this run');
  // while it is open: the arm sprays (seconds since it opened), and the pad cannot reopen it
  h.S.t = 10.1; h.tick.perks({ pg, sector: 9 });
  got = take();
  assert.ok(Math.abs(got.find((x) => x[0] === 'applyGarage')[2]) < 0.5, 'the arm is driven by the shop clock (seconds since it opened, about 0 here) while it is open');
  assert.ok(s.shopWall !== null && !got.some((x) => x[0] === 'openPaintShop'), 'no second shop while one is open');
  W.shop.onClose(); assert.deepEqual(take(), [['pause', false]], 'closing the shop releases the pause');
  assert.equal(s.shop, null);
  h.S.t = 10.15; W.garageThrows = true; W.paintHit = false;
  assert.doesNotThrow(() => h.tick.perks({ pg, sector: 9 }), 'a tier without the arm is tolerated'); W.garageThrows = false;
  assert.equal(s.shopWall, null, 'the shop wall clock is cleared once the shop is shut'); take();
  // pilot mode: the hull is not on the pad; no document: the shop cannot open
  h.S.pilot = true; h.S.t = 10.2; W.paintHit = true; withDocument(false);
  h.tick.perks({ pg, sector: 9 });
  got = take();
  assert.equal(got.find((x) => x[0] === 'paintRing.tick')[2], null, 'a hull in pilot mode is not parked on the pad');
  assert.ok(!got.some((x) => x[0] === 'openPaintShop'), 'no document: no shop');
  // a pad with no cell: its own position; no garage structure: no arm; no root: document.body
  const s2 = { programme: pg, paintPad: { cell: -1, pos: [7, 7, 7] } }, h2 = host({ story: s2, members: { storyBase: () => null, root: undefined } });
  withDocument(true); W.paintHit = true; h2.tick.perks({ pg, sector: 9 });
  got = take();
  assert.deepEqual(got.find((x) => x[0] === 'createPaintPad')[2].pos, [7, 7, 7], 'cell -1: the pad\'s own position');
  assert.ok(!got.some((x) => x[0] === 'applyGarage'), 'no garage structure, no arm');
  assert.equal(got.find((x) => x[0] === 'openPaintShop')[1], 'body', 'no root member: the shop opens over document.body');
  // no scene: no ring
  const h3 = host({ story: { programme: pg, paintPad: { cell: 1 } }, members: { scene: null } }); h3.tick.perks({ pg, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createPaintPad'), 'no scene: no paint pad');
  withDocument(false); delete globalThis.localStorage;   // no store at all: the later dye books start empty
}

// ---- perks(): the launch beat, the gust, dt
{
  const pg = { perks: perksOf(), sector: 9 }, s = { programme: pg, launch: mk('launch', { tick: null }) };
  const h = host({ story: s, members: { scene: null, sfx: { name: 'sfx' } } });
  const f = { pg, sector: 9 };
  h.tick.perks(f);
  assert.deepEqual(take(), [['launch.tick'], ['createAmbientGust', 'sfx'], ['gust.tick', 0]], 'the launch beat ticks; the gust is made once and ticks dt 0 on the first tick');
  assert.equal(f.dt, 0, 'f.dt is the step the fire support shares');
  h.S.t = 10.04; h.tick.perks(f);
  assert.equal(take()[1][1].toFixed(2), '0.04'); assert.equal(f.dt.toFixed(2), '0.04');
  h.S.t = 99; h.tick.perks(f); take(); assert.equal(f.dt, 0.1, 'a long pause is clamped to a tenth');
  h.S.t = 50; h.tick.perks(f); take(); assert.equal(f.dt, 0, 'the clock running back is a step of 0');
  assert.equal(s.gustAt, 50);
}

// ---- perks(): the scoreboards
{
  const pg = { perks: perksOf('board'), sector: 9, steps: [{ id: 'board' }] };
  const bed = (i, y, z) => [i, y, z], print = { bed: (st) => (st.id === 'board' ? bed : null) };
  const eco = { earned: 12.6, spent: 4.4 };
  const s = { programme: pg, print, isaoKills: 0 };
  const h = host({ story: s, members: { eco: () => eco } });
  h.tick.perks({ pg, sector: 9 });
  let got = take();
  const made = got.filter((x) => x[0] === 'createScoreboard');
  assert.deepEqual(made.map((x) => [x[2].title, x[2].at, x[2].facing, x[2].metres, x[2].accent, x[2].flag, x[2].variant]), [
    ['YOU', [0, 0.53, 0], [2, 0, 0], 0.5 / 10 * 2.25, '#ffd27a', true, 'beacon_rivalry'], ['ISAO', [0, -0.53, 0], [2, 0, 0], 0.5 / 10 * 2.25, '#b8f5c6', false, 'splitflap_rivalry'],
  ], 'two plaques end to end along the slab, facing along it, 2.25 metres');
  assert.deepEqual(got.filter((x) => x[0].startsWith('board:')).map((x) => [x[0], ...x.slice(1).map((y) => JSON.parse(JSON.stringify(y)))]), [
    ['board:YOU.update', { rows: [['KILLS', 11], ['GATHERED', 13], ['USED', 0]], rank: 3 }],
    ['board:ISAO.update', { rows: [['KILLS', 0], ['GATHERED', 0], ['USED', 4]] }, { duration: 0.25 }],
    ['board:YOU.tick', 0], ['board:ISAO.tick', 0],
  ], 'the player\'s books and Isao\'s, then both boards tick on dt');
  // Isao's first kill clatters for two seconds, once
  s.isaoKills = 1; h.S.t = 10.05; h.tick.perks({ pg, sector: 9 });
  assert.equal(take().find((x) => x[0] === 'board:ISAO.update')[2].duration, 2, 'his first kill: a two-second clatter');
  assert.equal(s.isaoShown, true);
  h.S.t = 10.1; h.tick.perks({ pg, sector: 9 });
  assert.equal(take().find((x) => x[0] === 'board:ISAO.update')[2].duration, 0.25, 'shown already: the quick refresh');
  // no eco, no hands/rank: zero books
  const h2 = host({ story: { programme: pg, print, boards: [mk('b0', { update: null, tick: null }), mk('b1', { update: null, tick: null })] }, members: { eco: undefined, hands: undefined, rank: undefined } });
  h2.tick.perks({ pg, sector: 9 });
  got = take();
  assert.deepEqual(got.find((x) => x[0] === 'b0.update')[1], { rows: [['KILLS', 0], ['GATHERED', 0], ['USED', 0]], rank: 0 }, 'no books: all zero');
  assert.ok(!got.some((x) => x[0] === 'createScoreboard'), 'boards that exist are not made again');
  // no bed for the step: no boards; no kills member: the block is skipped; no board perk: skipped
  const pgNoBed = { perks: perksOf('board'), sector: 9, steps: [{ id: 'board' }] }, sNo = { programme: pgNoBed, print: { bed: () => null } };
  host({ story: sNo }).tick.perks({ pg: pgNoBed, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createScoreboard') && !sNo.boards, 'no bed: no plaques');
  const pgNoStep = { perks: perksOf('board'), sector: 9, steps: [] }, sNoStep = { programme: pgNoStep, print };
  host({ story: sNoStep }).tick.perks({ pg: pgNoStep, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createScoreboard'), 'no board step: no plaques');
  host({ story: { programme: pg, print }, members: { kills: undefined } }).tick.perks({ pg, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createScoreboard'), 'no kills member: the boards block is skipped');
  const pgOff = { perks: perksOf(), sector: 9, steps: [{ id: 'board' }] };
  host({ story: { programme: pgOff, print } }).tick.perks({ pg: pgOff, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createScoreboard'), 'no board perk: skipped');
}

// ---- perks(): the beacons
{
  const pg = { perks: perksOf(), sector: 9 };
  const storyBase = () => ({ structure: (id) => ({ holder: { name: `holder:${id}` } }) });
  const base = () => ({ programme: pg, sites: [5, 6, 7, 8], beats: { phase: () => 'free' }, expeditions: { sites: [{ id: 'rocket-a', state: 'hidden' }, { id: 'rocket-b', state: 'guarded' }, { id: 'wreck', state: 'open' }] } });
  const s = base(), h = host({ story: s, members: { storyBase } });
  h.tick.perks({ pg, sector: 9 });
  let got = take();
  assert.deepEqual(got.find((x) => x[0] === 'createSiteBeacons'), ['createSiteBeacons', 'scene', [
    { id: 'rocket-a', ci: 5, point: [5, 0, 0], start: undefined, model: { name: 'holder:rocket-a' } },
    { id: 'rocket-b', ci: 6, point: [6, 0, 0], start: undefined, model: { name: 'holder:rocket-b' } },
    { id: 'wreck', ci: 7, point: [7, 0, 0], start: undefined, model: { name: 'holder:wreck' } },
  ], 0.05], 'one beacon per first-wave site, in order; the fourth cell has no site and is dropped');
  assert.deepEqual(got.filter((x) => x[0].startsWith('beacons.')), [['beacons.tick', 0], ['beacons.drop', 'wreck']], 'the beacons tick, and a visited site\'s beacon goes; hidden and guarded ones stay');
  assert.deepEqual(got.filter((x) => x[0] === 'showBrief'), [['showBrief', 'sites_seen']], 'Isao names them once');
  W.beaconOpts.onPulse('rocket-a'); W.beaconOpts.onPulse('rocket-a'); W.beaconOpts.onPulse('wreck');
  assert.deepEqual(take(), [['sfx.play', 'beacon_ping', { dist: 0 }], ['sfx.play', 'beacon_ping', { dist: 0 }]], 'each beacon pings once, on its first pulse');
  h.tick.perks({ pg, sector: 9 });
  assert.ok(!take().some((x) => x[0] === 'createSiteBeacons' || x[0] === 'showBrief'), 'the beacons exist: not made again, Isao silent');
  const sE = base(); delete sE.expeditions; sE.beacons = mk('beaconsE', { tick: null, drop: null }); host({ story: sE }).tick.perks({ pg, sector: 9 });
  assert.deepEqual(tk(), [['beaconsE.tick', 0]], 'beacons with no expedition table: they tick, none dropped');
  // over the landers' tour: each lights as the eye reaches it
  const sT = base(); sT.sites = [5, 6, 7];
  host({ story: sT, state: { shotId: 'sitesTour' }, members: { storyBase } }).tick.perks({ pg, sector: 9 });
  const starts = take().find((x) => x[0] === 'createSiteBeacons')[2].map((x) => x.start);
  assert.equal(starts.length, 3); assert.ok(starts.every((v) => typeof v === 'number' && v >= 0) && starts[0] < starts[1] && starts[1] < starts[2], 'staggered starts across the tour');
  // pilot mode or a queued brief: the beacons rise, Isao is quiet
  const sP = base(); host({ story: sP, state: { pilot: true }, members: { storyBase } }).tick.perks({ pg, sector: 9 });
  got = take(); assert.ok(got.some((x) => x[0] === 'createSiteBeacons') && !got.some((x) => x[0] === 'showBrief'), 'pilot mode: beacons, no brief');
  const sQ = base(); host({ story: sQ, state: { brief: [1] }, members: { storyBase } }).tick.perks({ pg, sector: 9 });
  got = take(); assert.ok(got.some((x) => x[0] === 'createSiteBeacons') && !got.some((x) => x[0] === 'showBrief'), 'a queued brief: beacons, no brief');
  // no beacons: another shot, the landing itself, no sites, no scene; no model without a base
  const none = (st, o = {}) => { const sx = { ...base(), ...st }; host({ story: sx, ...o, members: { storyBase, ...(o.members ?? {}) } }).tick.perks({ pg, sector: 9 }); const g = take(); return g.some((x) => x[0] === 'createSiteBeacons'); };
  assert.equal(none({}, { state: { shotId: 'orbit' } }), false, 'another shot is running: none');
  assert.equal(none({ beats: { phase: () => 'landed' } }), false, 'over the landing itself: none');
  assert.equal(none({ beats: undefined }), true, 'no beats: the beacons rise');
  assert.equal(none({ sites: [] }), false, 'no sites: none');
  assert.equal(none({ sites: undefined }), false, 'sites unset: none');
  assert.equal(none({}, { members: { scene: null } }), false, 'no scene: none');
  const sB = base(); host({ story: sB, members: { storyBase: () => null } }).tick.perks({ pg, sector: 9 });
  assert.equal(take().find((x) => x[0] === 'createSiteBeacons')[2][0].model, undefined, 'no story base: the beacon has no model');
}

// ---- works(): the paint, the ring, the launch, the calibration
{
  withDocument(false);
  const pg = { perks: perksOf('launcher'), sector: 9 };
  const hull = { name: 'hull' };
  const reports = [{ sector: 1, outcome: 'secure' }];
  const sectorRun = { test: { reports: () => reports }, note: (x) => note('sectorRun.note', x) };
  const launcherRoot = { name: 'launcher-root' };
  const laserStation = { manned: () => 0, setEnergyBonus: (v) => note('setEnergyBonus', v) };
  const s = { programme: pg, sol88: true };
  const h = host({ story: s, members: { hull: () => hull, sectorRun: () => sectorRun, laserStation, storyBase: () => ({ structure: (id) => (id === 'launcher' ? { root: launcherRoot } : null) }) } });
  const f = { pg, sector: 2 };
  h.tick.works(f);
  let got = take();
  assert.deepEqual(got.map((x) => x[0]), ['applyLivery', 'createOrbitalRing', 'ring.set', 'ring.tick', 'createArcLaunch', 'showBrief'], 'the hull painted, the ring built and set, the launch begun, Isao says why');
  assert.deepEqual(got[0], ['applyLivery', 'hull', true]); assert.deepEqual(got[2], ['ring.set', 0]); assert.deepEqual(got[3], ['ring.tick', 10]);
  assert.deepEqual(got[4], ['createArcLaunch', launcherRoot, 10, 'sfx'], 'the launch is on the launcher\'s root and the game clock');
  assert.deepEqual(got[5], ['showBrief', 'works_launch']);
  assert.equal(s.works.launching, true, 'the sled is loaded'); assert.equal(s.works.lastSector, 2);
  assert.equal(f.manned, 0, 'f.manned is the count the programme reads');
  await Promise.resolve();
  assert.equal(s.painted, 7, 'the livery\'s count is kept when it lands'); assert.equal(s.paintedHull, hull);
  // the same hull is not painted again; the launch under way is not begun again
  h.tick.works(f); got = take();
  assert.deepEqual(got.map((x) => x[0]), ['ring.tick'], 'same hull, same ring, launch in progress: only the ring ticks');
  // the launch ends: a collector is up, the ring set, the beam bonus, the sector run noted, Isao names the orbit, the hud
  W.launchOpts.onComplete();
  assert.deepEqual(take(), [['ring.set', 1], ['setEnergyBonus', 2], ['sectorRun.note', { type: 'launch', id: 'collector' }], ['showBrief', 'works_orbit'], ['updateHud']], 'onComplete');
  assert.equal(s.launch, null); assert.equal(s.works.collectors, 1);
  // a new hull mesh is painted again
  const hull2 = { name: 'hull2' }; h.c.hull = () => hull2; h.tick.works(f);
  assert.ok(take().some((x) => x[0] === 'applyLivery' && x[1] === 'hull2'), 'a new hull mesh: painted again');
  // not due: sector 0, no sol88, no standing launcher, the sector before not secured, the sector already launched
  const notDue = (st, o = {}) => { const sx = { programme: pg, sol88: true, ...st }; host({ story: sx, members: { hull: () => null, sectorRun: () => sectorRun, ...o.members } }).tick.works({ pg: o.pg ?? pg, sector: o.sector ?? 2 }); return !take().some((x) => x[0] === 'createArcLaunch'); };
  assert.ok(notDue({}, { sector: 0 }), 'sector 0: no launch');
  assert.ok(notDue({ sol88: false }), 'no SOL-88: no launch');
  assert.ok(notDue({}, { pg: { perks: perksOf(), sector: 9 } }), 'no standing launcher: no launch');
  assert.ok(notDue({}, { members: { sectorRun: () => ({ test: { reports: () => [{ sector: 1, outcome: 'lost' }] } }) } }), 'the sector before was not secured: no launch');
  assert.ok(notDue({}, { members: { sectorRun: () => null } }), 'no sector run: no launch');
  assert.ok(notDue({}, { members: { sectorRun: () => ({}) } }), 'no test reports: no launch');
  assert.ok(notDue({ works: { collectors: 1, launching: false, lastSector: 2 } }), 'this sector already had its launch');
  assert.ok(notDue({ launch: {} }), 'a launch already on the sled');
  // a launch with no launcher root, no laser station, pilot mode / a queued brief: the beats are silent
  const sQ = { programme: pg, sol88: true }, hQ = host({ story: sQ, state: { pilot: true }, members: { hull: () => null, sectorRun: () => ({ test: { reports: () => reports }, note: () => {} }), storyBase: () => null, laserStation: undefined } });
  hQ.tick.works({ pg, sector: 2 }); got = take();
  assert.deepEqual(got.find((x) => x[0] === 'createArcLaunch'), ['createArcLaunch', null, 10, 'sfx'], 'no launcher structure: the launch has no root');
  assert.ok(!got.some((x) => x[0] === 'showBrief'), 'pilot mode: Isao is quiet');
  assert.doesNotThrow(() => W.launchOpts.onComplete()); got = take();
  assert.ok(!got.some((x) => x[0] === 'showBrief') && !got.some((x) => x[0] === 'setEnergyBonus') && got.some((x) => x[0] === 'updateHud'), 'onComplete in pilot mode without a station: no brief, no bonus, hud');
  const sQ2 = { programme: pg, sol88: true }; host({ story: sQ2, state: { brief: [1] }, members: { hull: () => null, sectorRun: () => ({ test: { reports: () => reports } }) } }).tick.works({ pg, sector: 2 });
  assert.ok(!take().some((x) => x[0] === 'showBrief'), 'a queued brief: no launch line');
  // no scene: no ring; no hull: no paint
  const sN = { programme: pg }, hN = host({ story: sN, members: { scene: null, hull: undefined } });
  hN.tick.works({ pg, sector: 0 }); got = take();
  assert.deepEqual(got, [], 'no scene, no hull member: nothing is built or painted'); assert.ok(sN.dyes && sN.works && !sN.worksRing, 'the dye book and the works are still made');
}
{
  const pg = { perks: perksOf(), sector: 9 };
  const mannedAt = (n) => ({ manned: () => n });
  const run = (n, st = {}, o = {}) => { const s = { programme: pg, ...st }, f = { pg, sector: 0 }, h = host({ story: s, state: o.state, members: { scene: null, hull: undefined, laserStation: n == null ? undefined : mannedAt(n) } }); h.tick.works(f); return { s, f, got: take() }; };
  let r = run(1); assert.equal(r.f.manned, 1); assert.deepEqual(r.got, []); assert.ok(!r.s.calibrated, 'one manned pass: not yet');
  r = run(2); assert.equal(r.f.manned, 2); assert.equal(r.s.calibrated, true); assert.deepEqual(r.got, [['showBrief', 'laser_calibrated']], 'the second manned pass: SOL is calibrated and Isao says so');
  r = run(3, { calibrated: true }); assert.deepEqual(r.got, [], 'calibrated once only');
  r = run(2, {}, { state: { pilot: true } }); assert.equal(r.s.calibrated, true); assert.deepEqual(r.got, [], 'pilot mode: calibrated, silent');
  r = run(2, {}, { state: { brief: [1] } }); assert.equal(r.s.calibrated, true); assert.deepEqual(r.got, [], 'a queued brief: calibrated, silent');
  r = run(null); assert.equal(r.f.manned, 0, 'no laser station: 0 manned');
}

// ---- colony(): what the harness reads
{
  const empty = host({ story: null, members: { laserStation: undefined } }).tick.colony();
  assert.deepEqual(empty, {
    paintPad: null, shop: false, beacons: null, beaconPulse: null, beaconPings: [], gusts: 0, gunship: { auto: false, manned: 0, fly: null, swell: 1, budget: null },
    board: null, isaoKills: 0, strike: null, dyes: null, painted: 0, boardCell: -1, launch: null, works: null, sol88: false, pad: null, cell: -1, calibrated: false, manned: 0,
  }, 'no story: every field at its rest value');
  const { GUNSHIP_AUTO } = await import('../src/content/gunship.js');
  const s = {
    programme: { steps: [{ id: 'gate' }, { id: 'board' }] }, print: { cellOf: (st) => (st.id === 'board' ? 9 : -5) },
    paintPad: { cell: 4, ring: { state: () => ({ lit: 1 }) } }, shop: {}, beacons: { ids: () => ['a'], state: () => 'p' }, pinged: new Set(['a']), gust: { gusts: 2 },
    gsAuto: true, gsManned: 2, gsFly: { state: () => 'flying' }, boards: [{ state: () => 'b0' }, { state: () => 'b1' }], isaoKills: 3, strike: { state: () => 'live' },
    dyes: { d: 1 }, painted: 6, launch: { state: () => 'going' }, works: { collectors: 2 }, worksRing: { state: () => 'rs' }, sol88: true, armoryPad: { cell: 8, ring: { state: () => 'armed' } }, calibrated: true,
  };
  const got = host({ story: s, members: { laserStation: { manned: () => 2 } } }).tick.colony();
  assert.deepEqual(got, {
    paintPad: { lit: 1, cell: 4 }, shop: true, beacons: ['a'], beaconPulse: 'p', beaconPings: ['a'], gusts: 2,
    gunship: { auto: true, manned: 2, fly: 'flying', swell: GUNSHIP_AUTO.swell, budget: GUNSHIP_AUTO.aliveBudget },
    board: ['b0', 'b1'], isaoKills: 3, strike: 'live', dyes: { d: 1 }, painted: 6, boardCell: 9, launch: 'going', works: { collectors: 2, ring: 'rs' }, sol88: true, pad: 'armed', cell: 8, calibrated: true, manned: 2,
  }, 'the pads, shop, beacons, gunship, boards, strike, dyes, launch, works, calibration and manned count');
  assert.equal(host({ story: { strikeDone: true } }).tick.colony().strike, 'done', 'a finished strike reads done');
  assert.equal(host({ story: { works: { collectors: 0 } } }).tick.colony().works.ring, null, 'works without a ring: ring null');
  assert.equal(host({ story: { programme: { steps: [] } } }).tick.colony().boardCell, -1, 'no board step: -1');
}
console.log('Colony tick: open, perks, works and colony read the host as named; every branch run once.');
