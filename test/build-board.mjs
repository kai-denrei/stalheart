// THE BUILD BOARD (round 6, note 2): the pool by sector and standing structures, six at most, no duplicates, the spine never offered,
// affordability and the pick of two, the bought set gating the programme's `due`, the jump's purchases.
import assert from 'node:assert/strict';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { BUILD_BOARD } from '../src/content/build-board.js';
import { boardOffers, pickable, toggle, totalOf, jumpBought, emptiestLaneSite } from '../src/domain/build-board.js';
import { makeBuildProgramme, due, begin, finish, buy, snapshot } from '../src/domain/build-programme.js';

const BOARD_STEPS = ['board', 'garage', 'armory', 'farm', 'chips', 'launcher', 'pearl'];   // round 8 note 7: the fourth Bio-Pearl
const SENTRIES = [{ key: 'rotor', name: 'Rotor', cost: 45 }, { key: 'quiver', name: 'Quiver', cost: 90 }, { key: 'mortar', name: 'Mortar', cost: 110 }];
const world = (over = {}) => ({ steps: BASE_PROGRAMME, done: new Set(), bought: new Set(), ctx: { phase: 'expedition', sector: 2, back: null, manned: 0 }, bank: 300, sentryRoom: true, sentries: SENTRIES,
  upgrade: { ci: 7, name: 'Rotor', tier: 0, cost: 31 }, hull: { dents: 4, max: 4, hulls: 3, maxHulls: 3 }, shield: { rack: 4, cap: 4 }, pets: [], ...over });

// the content: exactly the six non-spine steps are the board's, each priced; the spine stays automatic
{
  assert.deepEqual(BASE_PROGRAMME.filter((s) => s.board).map((s) => s.id), BOARD_STEPS, 'the seven structures that left the automatic programme');
  for (const id of BOARD_STEPS) assert.ok(BUILD_BOARD.structures[id]?.price > 0 && BUILD_BOARD.structures[id].effect, `${id}: a price and an effect`);
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
  assert.deepEqual(jumpBought(BASE_PROGRAMME, 1), ['board', 'garage']);
  assert.deepEqual(jumpBought(BASE_PROGRAMME, 4), BOARD_STEPS);
  assert.deepEqual(jumpBought(BASE_PROGRAMME, 3), ['board', 'garage', 'armory', 'farm', 'pearl']);   // the fourth pearl's gate is sector 3 (round 8)
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
  const programme = makeBuildProgramme(BASE_PROGRAMME, { standing: (st) => !st.board });
  const story = { programme, gateCell: 0, socketToward: { 2: [0, 1], 3: [0, 1] }, beats: { phase: () => 'expedition' }, expeditions: null };
  const towers = [{ ci: 3, tier: 0, def: { key: 'rotor', name: 'Rotor', cost: 45, upgradeCost: [31, 54] } }];
  const bb = createBuildBoard({ root, endShot: () => log.push(['endShot']), eco: () => eco, story: () => story, towers: () => towers, orders: [], placeError: (ci) => (ci === 3 ? 'occupied' : null), graph: () => ({ centers: [[0, 0, 0], [5, 0, 0], [1, 0, 0], [2, 0, 0]] }), cellSide: () => 1,
    orderTower: (k, ci) => { log.push(['order', k, ci]); return eco.spend(45, { category: 'sentry' }); }, orderUpgrade: () => true, callout: (x) => log.push(['callout', x]), manned: () => 0, petLife: () => null, printPet: () => {},
    hull: () => ({ dents: armour, max: 4, hulls: 3, maxHulls: 3 }), mendHull: () => { armour = 4; log.push(['mend']); }, addHull: () => {}, shield: () => ({ rack: 4, cap: 4 }), fillRack: () => {}, sentryKeys: () => ['rotor', 'quiver'] });
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
}
console.log('Build board: six offers in priority, two picks within the bank, the bought set gates the programme.');
