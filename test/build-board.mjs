// THE BUILD BOARD (round 6, note 2): the pool by sector and standing structures, six at most, no duplicates, the spine never offered,
// affordability and the pick of two, the bought set gating the programme's `due`, the jump's purchases.
import assert from 'node:assert/strict';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { boardOffers, firstOffers, pickable, toggle, totalOf, jumpBought, emptiestLaneSite } from '../src/domain/build-board.js';
import { makeBuildProgramme, due, begin, finish, buy, snapshot } from '../src/domain/build-programme.js';
import { DOME_STRUCTURES } from '../src/content/dome-city.js';

const COLONY_STEPS = ['board', 'garage', 'armory', 'farm', 'chips', 'launcher', 'pearl'];   // round 8 note 7: the fourth Bio-Pearl
// THE DOME CITY ON THE BOARD (the owner's note of 2026-11-07: the base from scratch): the six domes are board steps after the colony's own
const DOME_STEPS = ['dome-nw', 'dome-w', 'dome-sw', 'dome-ne', 'dome-e', 'dome-se'];
const FIRST_STEPS = ['landing', 'foundry', 'solar'];   // THE SETTLING (2026-11-08): the opening's steps, bought at the first orders
const BOARD_STEPS = [...FIRST_STEPS, ...COLONY_STEPS, ...DOME_STEPS];
// the programme a CLASSIC plan holds (src/platform/story-world.js keeps only the steps whose pieces the plan has: no dome, no bridge), which the
// colony's cards below were written against; the dome city's own pool is its block after them
const CITY = new Set(DOME_STRUCTURES.map((s) => s.id)), CLASSIC = BASE_PROGRAMME.filter((s) => !s.structures.some((id) => CITY.has(id)));
const SENTRIES = [{ key: 'rotor', name: 'Rotor', cost: 45 }, { key: 'quiver', name: 'Quiver', cost: 90 }, { key: 'mortar', name: 'Mortar', cost: 110 }];
const world = (over = {}) => ({ steps: CLASSIC, done: new Set(FIRST_STEPS), bought: new Set(), ctx: { phase: 'expedition', sector: 2, back: null, manned: 0 }, bank: 300, sentryRoom: true, sentries: SENTRIES,
  upgrade: { ci: 7, name: 'Rotor', tier: 0, cost: 31 }, hull: { dents: 4, max: 4, hulls: 3, maxHulls: 3 }, shield: { rack: 4, cap: 4 }, pets: [], ...over });

// the content: exactly the six non-spine steps are the board's, each priced; the spine stays automatic
{
  assert.deepEqual(BASE_PROGRAMME.filter((s) => s.board).map((s) => s.id), BOARD_STEPS, 'the three first steps, the seven colony structures, then the six domes');
  assert.deepEqual(CLASSIC.filter((s) => s.board).map((s) => s.id), [...FIRST_STEPS, ...COLONY_STEPS], 'a classic plan holds the three and the seven');
  for (const id of [...COLONY_STEPS, ...DOME_STEPS]) assert.ok(BUILD_BOARD.structures[id]?.price > 0 && BUILD_BOARD.structures[id].effect, `${id}: a price and an effect`);
  for (const id of FIRST_STEPS) { assert.ok(BUILD_BOARD.first.structures[id]?.price > 0 && BUILD_BOARD.first.structures[id].effect, `${id}: a first price and an effect`); assert.equal(BUILD_BOARD.structures[id], undefined, `${id}: never on a sector board`); }
  assert.equal(BUILD_BOARD.offers, 6); assert.equal(BUILD_BOARD.picks, 2);
}

// the pool by sector: before sector 2 the board, the garage and the armory (sector 1 and 2 gates), the farm only from sector 3, the chips from 4
{
  const ids = (w) => boardOffers(world(w), BUILD_BOARD).map((o) => o.id);
  const s2 = ids({});
  assert.deepEqual(s2.filter((id) => id.startsWith('build:')), ['build:board', 'build:garage', 'build:armory'], 'sector 2: the structures whose gate holds');
  assert.ok(s2.length <= 6 && new Set(s2).size === s2.length, 'six at most, no duplicates');
  assert.ok(!s2.some((id) => /build:(gate|stalheart|landing|foundry|solar|bays|hugin|radar|assembly|backgate)$/.test(id)), 'the spine is never offered');
  const s4 = ids({ ctx: { phase: 'expedition', sector: 4, back: null, manned: 0 } });
  assert.deepEqual(s4.filter((id) => id.startsWith('build:')), ['build:board', 'build:garage', 'build:armory', 'build:farm'], 'at most four structures; the launcher waits for SOL\'s two manned passes');
  const s4m = ids({ ctx: { phase: 'expedition', sector: 4, back: null, manned: 2 }, done: new Set(['board', 'garage']) });
  assert.deepEqual(s4m.filter((id) => id.startsWith('build:')), ['build:armory', 'build:farm', 'build:chips', 'build:launcher'], 'a standing structure is not offered; the launcher once SOL is calibrated');
  const bought = ids({ bought: new Set(['board']) });
  assert.ok(!bought.includes('build:board'), 'a bought structure is not offered again');
  // the rest of the six: two sentry kinds (the cheapest, the dearest the bank buys), the weakest sentry's upgrade, the hull's cards only when they do something
  // the price index: the board's own cards scale with the coming sector, the radial's sentries do not
  {
    const at = (n) => boardOffers(world({ ctx: { phase: 'expedition', sector: n, back: null, manned: 0 } }), BUILD_BOARD);
    const armory = (n) => at(n).find((o) => o.id === 'build:armory').price, rotor = (n) => at(n).find((o) => o.id === 'sentry:rotor').price;
    assert.equal(armory(2), BUILD_BOARD.structures.armory.price, 'index 1 before sector 2');
    assert.equal(armory(3), Math.round(BUILD_BOARD.structures.armory.price * BUILD_BOARD.index[1] / 10) * 10, 'the index of the coming sector');
    assert.equal(armory(30), Math.round(BUILD_BOARD.structures.armory.price * BUILD_BOARD.index.at(-1) / 10) * 10, 'the last index holds');
    assert.equal(rotor(5), 45, 'a sentry card is the radial\'s price');
    assert.ok(BUILD_BOARD.index.every((k, i, a) => i === 0 || k >= a[i - 1]), 'the index never falls');
  }
  const full = boardOffers(world({ done: new Set(BOARD_STEPS), bank: 100 }), BUILD_BOARD);
  assert.deepEqual(full.map((o) => o.id), ['sentry:rotor', 'sentry:quiver', 'upgrade:7', 'sentry:mortar'], 'nothing to mend, a full rack, every hull: the other sentry kind fills in');
  const two = boardOffers(world({ done: new Set(BOARD_STEPS), upgrade: null, upgrades: [{ ci: 7, name: 'Rotor', tier: 0, cost: 31 }, { ci: 9, name: 'Quiver', tier: 1, cost: 108 }] }), BUILD_BOARD);
  assert.deepEqual(two.map((o) => o.id), ['sentry:rotor', 'sentry:mortar', 'upgrade:7', 'sentry:quiver', 'upgrade:9'], 'the fill: the other kinds, dearest first, then the next weakest sentry\'s upgrade');
  const hurt = boardOffers(world({ done: new Set(BOARD_STEPS), hull: { dents: 1, max: 4, hulls: 2, maxHulls: 3 }, shield: { rack: 1, cap: 4 } }), BUILD_BOARD);
  assert.deepEqual(hurt.map((o) => o.id), ['sentry:rotor', 'sentry:mortar', 'upgrade:7', 'repair', 'spare', 'shield']);
  const noRoom = boardOffers(world({ sentryRoom: false, done: new Set(BOARD_STEPS) }), BUILD_BOARD);
  assert.ok(!noRoom.some((o) => o.kind === 'sentry'), 'a full sentry book offers no sentry');
  const pets = boardOffers(world({ done: new Set(BOARD_STEPS), pets: [{ id: 'k0', index: 2, label: 'K0-TECH' }] }), BUILD_BOARD);
  assert.equal(pets.find((o) => o.kind === 'pet')?.price, BUILD_BOARD.pet.price, 'a companion with an offer is a card at the pet price');
  assert.ok(!boardOffers(world({ ctx: { phase: 'expedition', sector: 1 }, pets: [{ id: 'k0', index: 2, label: 'K0' }] }), BUILD_BOARD).some((o) => o.kind === 'pet'), '...not before its sector');
}

// THE DOME CITY'S POOL (the owner's note of 2026-11-07): on the dome city's programme the domes join the pool at their sector gates, after the
// colony's cards (the first structuresMax in programme order), so a board never fills with domes; a standing or bought dome is not offered
{
  const ids = (w) => boardOffers(world({ steps: BASE_PROGRAMME, ...w }), BUILD_BOARD).map((o) => o.id).filter((id) => id.startsWith('build:'));
  const at = (n, w = {}) => ids({ ctx: { phase: 'expedition', sector: n, back: null, manned: 0 }, ...w });
  assert.deepEqual(at(2), ['build:board', 'build:garage', 'build:armory', 'build:dome-nw'], 'before sector 2: the colony\'s three, then the first dome');
  const colony = new Set(COLONY_STEPS);
  assert.deepEqual(at(1, { done: colony }), ['build:dome-nw', 'build:dome-ne'], 'sector 1: the two domes on the mouth\'s side');
  assert.deepEqual(at(2, { done: colony }), ['build:dome-nw', 'build:dome-w', 'build:dome-ne', 'build:dome-e'], 'sector 2: the middle pair too, four at most');
  assert.deepEqual(at(3, { done: colony, bought: new Set(['dome-nw', 'dome-w']) }), ['build:dome-sw', 'build:dome-ne', 'build:dome-e', 'build:dome-se'], 'sector 3: the far pair; bought domes are not offered again');
  assert.ok(!at(9, { done: colony }).some((id) => /build:bridge-/.test(id)), 'a bridge is never on the board');
  const card = boardOffers(world({ steps: BASE_PROGRAMME, done: colony }), BUILD_BOARD).find((o) => o.id === 'build:dome-w');
  assert.deepEqual([card.kind, card.step, card.label, card.price], ['structure', 'dome-w', BASE_PROGRAMME.find((s) => s.id === 'dome-w').label.toUpperCase(), BUILD_BOARD.structures['dome-w'].price], 'a dome card: its step, its label, its price at index 1');
}

// the pick: up to two, affordable after the first is paid; a toggle takes a pick back
{
  const offers = [{ id: 'a', price: 100 }, { id: 'b', price: 150 }, { id: 'c', price: 60 }, { id: 'd', price: 400 }];
  assert.equal(pickable(offers, [], 'd', 300), false, 'an unaffordable card cannot be picked');
  let p = toggle(offers, [], 'b', 300); assert.deepEqual(p, ['b']);
  assert.equal(pickable(offers, p, 'a', 300), true, '150 + 100 within 300');
  assert.equal(pickable(offers, p, 'b', 300), false, 'never the same card twice');
  p = toggle(offers, p, 'a', 300); assert.deepEqual(p, ['b', 'a']); assert.equal(totalOf(offers, p), 250);
  assert.deepEqual(toggle(offers, p, 'c', 300), p, 'a third pick is refused');
  assert.deepEqual(toggle(offers, ['b'], 'd', 1000), ['b', 'd']);
  assert.deepEqual(toggle(offers, ['b'], 'b', 300), [], 'a second press takes it back');
  assert.equal(pickable(offers, ['b'], 'a', 240), false, 'the second pick re-checks the bank after the first');
  assert.equal(pickable(offers, [], 'zz', 1e6), false, 'only offered cards');
}

// the bought set gates `due`: a board step prints only once bought, and an unbought one neither blocks the steps behind it nor is owed
{
  const steps = [
    { id: 's', when: { sector: 1 }, islands: [], structures: [], perk: 'gate' },
    { id: 'x', board: true, when: { sector: 1, idle: true }, islands: [], structures: [], perk: 'board' },
    { id: 'y', board: true, when: { sector: 2, idle: true }, islands: [], structures: [], perk: 'farm' },
  ];
  const st = makeBuildProgramme(steps);
  const s = due(st, { sector: 1 }); assert.equal(s.id, 's'); begin(st, s); finish(st, s);
  assert.equal(due(st, { sector: 5 }), null, 'nothing bought: the board steps never print');
  assert.deepEqual(snapshot(st).owed, [], 'an unbought board step is not owed (the door does not wait for it)');
  assert.equal(buy(st, 'y'), true); assert.equal(buy(st, 'y'), false, 'bought once'); assert.equal(buy(st, 's'), false, 'a spine step is not for sale');
  assert.equal(due(st, { sector: 1 }), null, 'bought, it still waits for its own gate');
  assert.equal(due(st, { sector: 2, waveActive: true }), null, '...and for the idle');
  assert.equal(due(st, { sector: 2 }).id, 'y', 'an unbought step before it does not block it');
  assert.deepEqual(snapshot(st).bought, ['y']); assert.deepEqual(snapshot(st).owed, ['y']);
}

// a jump stands in for the boards before it: every board step whose sector gate the jump has reached
{
  assert.deepEqual(jumpBought(CLASSIC, 1), [...FIRST_STEPS, 'board', 'garage'], 'the first steps carry no sector gate: every jump has reached them');
  assert.deepEqual(jumpBought(CLASSIC, 4), [...FIRST_STEPS, ...COLONY_STEPS]);
  assert.deepEqual(jumpBought(CLASSIC, 3), [...FIRST_STEPS, 'board', 'garage', 'armory', 'farm', 'pearl']);   // the fourth pearl's gate is sector 3 (round 8)
  // the dome city's programme: the domes whose gate the jump has reached too (a skipped opening is a stage-8 base, where they already stand, so
  // the programme's buy() refuses them and the bought set the --board step reads stays the board and the garage)
  assert.deepEqual(jumpBought(BASE_PROGRAMME, 1), [...FIRST_STEPS, 'board', 'garage', 'dome-nw', 'dome-ne']);
  assert.deepEqual(jumpBought(BASE_PROGRAMME, 4), BOARD_STEPS);
  { const pg = makeBuildProgramme(BASE_PROGRAMME, { standing: (st) => FIRST_STEPS.includes(st.id) || st.id.startsWith('dome-') || st.id.startsWith('bridge-') });   // a skipped opening is a finished base: the first steps stand too
    for (const id of jumpBought(BASE_PROGRAMME, 1)) buy(pg, id);
    assert.deepEqual([...pg.bought].sort(), ['board', 'garage'], 'standing domes are not bought by a jump'); }
}
// Isao's sentry: the door whose lane holds the fewest sentries, its nearest free socket
{
  const centers = [[0, 0, 0], [10, 0, 0], [1, 0, 0], [9, 0, 0], [2, 0, 0], [8, 0, 0]];   // doors 0 and 1; sockets 2..5
  const at = (o) => emptiestLaneSite({ centers, cellSide: 1, radius: 3, ...o });
  assert.equal(at({ candidates: [2, 3, 4, 5], doors: [0, 1], taken: [] }), 2, 'an empty field: the first door\'s nearest socket');
  assert.equal(at({ candidates: [3, 4, 5], doors: [0, 1], taken: [2] }), 3, 'a sentry at the first door: the second door\'s lane');
  assert.equal(at({ candidates: [4, 5], doors: [0, 1], taken: [2, 3, 1] }), 4, 'the fewer sentries win, then the nearest free socket');
  assert.equal(at({ candidates: [], doors: [0], taken: [] }), -1, 'no socket, no sentry');
  assert.equal(at({ candidates: [5, 4], doors: [], taken: [] }), 5, 'no door known: the first legal socket');
}
// THE CARD (src/fx/build-board.js) over a DOM-free fake and a recording host: the break before sector 2 opens it on CONTINUE only, the keys pick,
// ENTER pays and places the picks and lets the sector go; Escape takes none
{
  const all = (el) => [el, ...el.children.flatMap(all)];
  const has = (el, cls) => el.className.split(/\s+/).includes(cls);
  globalThis.document = { createElement: (tag) => { const el = { tag, className: '', textContent: '', dataset: {}, children: [], disabled: false, setAttribute() {}, append(...c) { el.children.push(...c); }, appendChild(c) { el.children.push(c); return c; },
    handlers: {}, addEventListener(t, f) { el.handlers[t] = f; }, remove() { el.removed = true; }, classList: { toggle(c, on) { const k = new Set(el.className.split(/\s+/).filter(Boolean)); if (on) k.add(c); else k.delete(c); el.className = [...k].join(' '); } },
    querySelector: (sel) => all(el).slice(1).find((x) => has(x, sel.slice(1))) ?? null, querySelectorAll: (sel) => all(el).slice(1).filter((x) => has(x, sel.slice(1))) }; return el; } };
  let onKey = null; globalThis.addEventListener = (t, f) => { if (t === 'keydown') onKey = f; }; globalThis.removeEventListener = () => { onKey = null; };
  const { createBuildBoard } = await import('../src/fx/build-board.js');
  const log = [], root = { children: [], appendChild(c) { root.children.push(c); return c; } };
  let biomass = 10000, armour = 2;
  const eco = { get biomass() { return biomass; }, spend(n, o) { if (n > biomass) return false; biomass -= n; log.push(['spend', n, o.category]); return true; } };
  const programme = makeBuildProgramme(CLASSIC, { standing: (st) => !st.board });
  const story = { programme, gateCell: 0, socketToward: { 2: [0, 1], 3: [0, 1] }, beats: { phase: () => 'expedition' }, expeditions: null };
  const towers = [{ ci: 3, tier: 0, def: { key: 'rotor', name: 'Rotor', cost: 45, upgradeCost: [31, 54] } }];
  const cfg = { root, endShot: () => log.push(['endShot']), eco: () => eco, story: () => story, towers: () => towers, orders: [], placeError: (ci) => (ci === 3 ? 'occupied' : null), graph: () => ({ centers: [[0, 0, 0], [5, 0, 0], [1, 0, 0], [2, 0, 0]] }), cellSide: () => 1,
    orderTower: (k, ci) => { log.push(['order', k, ci]); return eco.spend(45, { category: 'sentry' }); }, orderUpgrade: () => true, callout: (x) => log.push(['callout', x]), manned: () => 0, petLife: () => null, printPet: () => {},
    hull: () => ({ dents: armour, max: 4, hulls: 3, maxHulls: 3 }), mendHull: () => { armour = 4; log.push(['mend']); }, addHull: () => {}, shield: () => ({ rack: 4, cap: 4 }), fillRack: () => {}, sentryKeys: () => ['rotor', 'quiver'] };
  const bb = createBuildBoard(cfg);
  let went = 0; const go = () => went++;
  assert.equal(bb.interlude(go, { n: 2, via: 'hold' }), false, 'KEEP HOLDING passes the board by');
  assert.equal(bb.interlude(go, { n: 2, via: 'harness' }), false, 'so does an acceptance run reading on');
  assert.equal(bb.interlude(go, { n: 1, via: 'continue' }), false, 'never before sector 2');
  assert.equal(bb.interlude(go, { n: 2, via: 'continue' }), true, 'CONTINUE before sector 2 opens it');
  const st = bb.state(); assert.equal(st.open, true); assert.equal(went, 0, 'the sector waits');
  assert.deepEqual(st.offers.map((o) => o.id), ['build:board', 'build:garage', 'build:armory', 'sentry:rotor', 'sentry:quiver', 'upgrade:3'], `six tiles (${st.offers.map((o) => o.id)})`);
  const tiles = root.children[0].querySelectorAll('.bb-tile'); assert.equal(tiles.length, 6);
  const key = (k) => onKey({ key: k, preventDefault() {}, stopPropagation() {} });
  key('3'); key('4'); key('1');
  assert.deepEqual(bb.state().picked, ['build:armory', 'sentry:rotor'], 'two picks by their keys, the third refused');
  assert.ok(root.children[0].querySelectorAll('.bb-tile').filter((t) => t.disabled).length >= 4, 'with two picked the rest are disabled');
  key('Enter');
  assert.equal(went, 1, 'ENTER lets the sector go'); assert.equal(bb.state().open, false); assert.equal(root.children[0].removed, true);
  assert.ok(programme.bought.has('armory'), 'the armory is bought on the programme');
  assert.deepEqual(log.filter((l) => l[0] === 'spend').map((l) => l.slice(1)), [[BUILD_BOARD.structures.armory.price, 'board'], [45, 'sentry']], 'paid at the pick');
  assert.deepEqual(log.find((l) => l[0] === 'order'), ['order', 'rotor', 2], 'Isao orders the sentry on the free socket');
  assert.equal(due(programme, { phase: 'expedition', sector: 2 }).id, 'armory', 'the bought armory is due at its gate');
  assert.equal(bb.interlude(go, { n: 3, via: 'continue' }), true); key('Escape');
  assert.equal(went, 2, 'Escape takes none and goes on'); assert.deepEqual(bb.state().last.took, []);
  // THE FIRST ORDERS (2026-11-08): first(go) shows the first pool with its words and orders the Rotor on its own socket (a fresh programme with
  // nothing bought, no sentry standing or on the book, the bank well over the Rotor and the foundry's work)
  {
    const ordered = [], pg2 = makeBuildProgramme(BASE_PROGRAMME);
    const c2 = { ...cfg, towers: () => [], orders: [], orderTower: (key, ci) => { ordered.push([key, ci]); return true; }, story: () => ({ ...cfg.story(), programme: pg2, beats: { state: () => ({ socket: 77 }) } }) };
    const bb2 = createBuildBoard(c2); let went2 = 0;
    assert.equal(bb2.first(() => went2++), true); assert.equal(bb2.state().first, true); assert.equal(bb2.state().n, 'first');
    assert.deepEqual(bb2.state().offers.map((o) => o.id), ['sentry:rotor', 'build:landing', 'build:foundry', 'build:solar']);
    assert.equal(root.children.at(-1).querySelector('.bb-title').textContent, 'THE FIRST ORDERS');
    bb2.test.toggle('sentry:rotor'); bb2.test.toggle('build:foundry'); bb2.test.confirm();
    assert.deepEqual(ordered, [['rotor', 77]], 'the Rotor on the plan\'s socket'); assert.ok(bb2.state().bought.includes('foundry')); assert.equal(went2, 1); assert.equal(bb2.state().last.n, 'first'); assert.equal(bb2.state().first, false);
  }
}
// THE FIRST ORDERS (2026-11-08, THE SETTLING, spec 2.B): the Rotor on its own socket at the radial's price, then the three first steps at their prices; no Rotor card once it stands or is on the book; a bought or standing step is not offered; the pick of two within the salvage
{
  const rotor = { key: 'rotor', name: 'Rotor', cost: 45 };
  const fw = (over = {}) => ({ steps: CLASSIC, done: new Set(), bought: new Set(), rotor, rotorCell: 77, rotorBuilt: false, rotorPending: false, ...over });
  const all = firstOffers(fw(), BUILD_BOARD);
  assert.deepEqual(all.map((o) => o.id), ['sentry:rotor', 'build:landing', 'build:foundry', 'build:solar']);
  assert.deepEqual(all[0], { id: 'sentry:rotor', kind: 'sentry', key: 'rotor', site: 77, label: 'ROTOR', price: 45, effect: BUILD_BOARD.first.words.rotor });
  assert.deepEqual(all.slice(1).map((o) => [o.step, o.price]), [['landing', 60], ['foundry', 40], ['solar', 120]], 'the salvage\'s scale, no index');
  assert.deepEqual(firstOffers(fw({ rotorBuilt: true }), BUILD_BOARD).map((o) => o.id), ['build:landing', 'build:foundry', 'build:solar'], 'a standing Rotor is not a card');
  assert.ok(!firstOffers(fw({ rotorPending: true }), BUILD_BOARD).some((o) => o.id === 'sentry:rotor'), 'nor one on the book');
  assert.ok(!firstOffers(fw({ rotor: null }), BUILD_BOARD).some((o) => o.kind === 'sentry'), 'no Rotor kind, no card');
  assert.deepEqual(firstOffers(fw({ bought: new Set(['landing']), done: new Set(['solar']) }), BUILD_BOARD).map((o) => o.id), ['sentry:rotor', 'build:foundry']);
  // no socket, no Rotor card (the plan has none): rotorCell undefined or -1; a short tune.offers slices the pool (the Rotor and the pad only)
  for (const rotorCell of [undefined, -1]) assert.deepEqual(firstOffers(fw({ rotorCell }), BUILD_BOARD).map((o) => o.id), ['build:landing', 'build:foundry', 'build:solar'], `rotorCell ${rotorCell}: no Rotor card`);
  assert.deepEqual(firstOffers(fw(), { ...BUILD_BOARD, offers: 2 }).map((o) => o.id), ['sentry:rotor', 'build:landing'], 'offers: 2 keeps the Rotor and the pad');
  // the pure rule at the salvage alone (96 / 240): in play the page's 170 kg start bank sits under it (266 / 410 at the card), so every grade affords any pair
  assert.equal(pickable(all, [], 'build:solar', 96), false, 'the pure rule: a bank of 96 kg (a WRECK\'s salvage alone, without the page\'s 170 kg start) cannot buy the array'); assert.deepEqual(toggle(all, ['sentry:rotor'], 'build:foundry', 96), ['sentry:rotor', 'build:foundry'], 'the Rotor and the foundry\'s work fit');
  assert.deepEqual(toggle(all, ['sentry:rotor'], 'build:solar', 240), ['sentry:rotor', 'build:solar'], 'CLEAN buys the Rotor and the array');
  assert.deepEqual(toggle(all, ['sentry:rotor', 'build:solar'], 'build:landing', 240), ['sentry:rotor', 'build:solar'], 'two picks');
}
// A CHAPTER STANDS IN FOR THE FIRST ORDERS (2026-11-08, src/fx/story-entry.js): its start buys the three first steps, and only those
{
  const { openStoryAt } = await import('../src/fx/story-entry.js');
  const programme = makeBuildProgramme(CLASSIC), story = { programme, chapter: { printed: ['foundry'], towers: [] } }, calls = [];
  openStoryAt({}, story, { printed(step, opts) { calls.push([step.id, opts]); }, commitTower() {}, setBerths() {} });
  assert.deepEqual([...programme.bought], FIRST_STEPS, 'the pad, the recycler\'s work and the array are bought');
  assert.equal(snapshot(programme).next, 'gate', 'the programme\'s own next is unchanged');
  // the chapter's printed steps are REPLAYED: a regression here grants the recycler's 60 kg (`pays`) on every chapter start
  assert.equal(calls.length, 1, 'the one printed step, once'); assert.equal(calls[0][0], 'foundry'); assert.equal(calls[0][1]?.replay, true, 'printed(step, { replay: true })');
}
console.log('Build board: six offers in priority, two picks within the bank, the bought set gates the programme.');
