// THE BUILD BOARD (owner, 2026-11-05, round 6 note 2: "after each round ISAO proposes 6 choices of things he can build and the user chooses 2,
// given enough biomass"). The sector loop's break (src/fx/sector-run.js next(), the `interlude` seam the paint shop once used) opens it on the
// debrief's CONTINUE, from the break before sector 2 on: a card over the paused game, Isao's line, six tiles (name, price, effect), up to two
// picks within the bank, ORDER pays and places them, SKIP (or Escape) takes none, then the next sector begins. KEEP HOLDING and an acceptance
// run's own continue ('hold', 'harness') pass it by. The rules are src/domain/build-board.js, the numbers src/content/build-board.js.
// What a pick does: a structure is bought on the programme (src/domain/build-programme.js buy: Isao prints it at its own gate); a sentry is
// Isao's order on the emptiest lane's socket (orderTower, the radial's price); an upgrade is his order on the weakest sentry (orderUpgrade);
// the hull's dents mended now, a spare hull, the shield rack full; a companion printed now (its unit's `offer`, stream A).
// THE FIRST ORDERS (2026-11-08, THE SETTLING, spec 2.B): first(go) opens the same card once at the landing with the first pool (src/domain/build-board.js
// firstOffers: the Rotor on the plan's own socket, the opening's `first` steps at the salvage's prices) and BUILD_BOARD.first's words; src/fx/first-orders.js opens it
//   createBuildBoard(c) -> { interlude(go, { n, via }), first(go), state(), test: { toggle(id), confirm(), skip() } }
//   c: root, endShot(), eco(), story(), towers(), orders, placeError(ci), graph(), cellSide(), orderTower(key, ci, opts), orderUpgrade(tower),
//      hull() -> { dents, max, hulls, maxHulls }, mendHull(), addHull(), shield() -> { rack, cap }, fillRack(), petLife(i) (a companion's life:
//      'unborn' may be offered), printPet(i), callout(text, cls), sentryKeys(), manned() (SOL's manned passes: the launcher's gate),
//      spriteShot(key, build), towerLook() (the cards' wireframe thumbnails, round 7: src/fx/board-thumbs.js; none without spriteShot)
import { BUILD_BOARD } from '../content/build-board.js';
import { TOWER_BY_KEY, upgradeCost } from '../towers.js';
import { boardOffers, firstOffers, toggle as togglePick, totalOf, emptiestLaneSite } from '../domain/build-board.js';
import { buy, hasPerk, kindOf } from '../domain/build-programme.js';
import { colonyOffers, cellStates } from '../domain/colony.js';
import { COLONY } from '../content/colony.js';
import { priceIndex } from '../domain/build-board.js';
import { COMPANIONS } from '../content/companions.js';
import { createBoardThumbs } from './board-thumbs.js';

export function createBuildBoard(c) {
  const W = BUILD_BOARD.words;
  let card = null, offers = [], picked = [], open = null, last = null, row = [], cellOf = {}, map = [];
  const CW = COLONY.words, ROW_KEYS = ['q', 'w', 'e', 'r', 't', 'y'];
  const all = () => [...offers, ...row];
  const history = [];
  const thumbs = c.spriteShot ? createBoardThumbs({ spriteShot: c.spriteShot, towerLook: c.towerLook, towers: c.towers }) : null;
  const bank = () => Math.round(c.eco().biomass);
  // the socket Isao would print a sentry on (the plan's mounts, story.socketToward): the door whose lane holds the fewest sentries, its nearest free one
  function site() {
    const s = c.story(), g = c.graph(); if (!s || !g) return -1;
    const doors = [s.gateCell, s.programme && hasPerk(s.programme, 'backgate') ? s.gateCellOf?.('back') : -1].filter((x) => Number.isInteger(x) && x >= 0);
    const taken = [...c.towers().map((t) => t.ci), ...c.orders.filter((o) => o.kind === 'tower').map((o) => o.ci)];
    return emptiestLaneSite({ candidates: Object.keys(s.socketToward ?? {}).map(Number).filter((ci) => !c.placeError(ci)), doors, taken, centers: g.centers, cellSide: c.cellSide() });
  }
  // THE SECOND ROTOR'S CELL (the economy design 2.7, 2026-11-12): the gate's two sockets are the Rotor's and the Quiver's (Isao prints the Quiver there
  // after the card), so the second Rotor goes on the free wall cell nearest the first Rotor's socket, off both sockets (-1: none free)
  function secondSite(rotorCell) {
    const s = c.story(), g = c.graph(); if (!s || !g || rotorCell < 0) return -1;
    const sockets = new Set(Object.keys(s.socketToward ?? {}).map(Number)), p = g.centers[rotorCell], d = (ci) => Math.hypot(...g.centers[ci].map((v, k) => v - p[k]));
    return (s.wallCells ?? []).filter((ci) => !sockets.has(ci) && !c.placeError(ci)).sort((a, b) => d(a) - d(b))[0] ?? -1;
  }
  // the standing sentries Isao could upgrade, weakest first (the lowest level, then the cheapest step)
  const weakest = () => c.towers().filter((t) => !c.orders.some((o) => o.ci === t.ci)).map((t) => ({ t, cost: upgradeCost(t.def, t.tier) })).filter((x) => x.cost !== null).sort((a, b) => a.t.tier - b.t.tier || a.cost - b.cost)
    .slice(0, 2).map(({ t, cost }) => ({ ci: t.ci, name: t.def.name, tier: t.tier, cost }));
  // a companion is a card when its unit carries an `offer` ({ price, fromSector, effect }: stream A's field) and it is not born yet
  const pets = () => (COMPANIONS.units ?? []).map((u, index) => ({ u, index })).filter(({ u, index }) => u.offer && c.petLife(index) === 'unborn').map(({ u, index }) => ({ ...u.offer, id: u.id, index, label: u.name }));
  function world(n) {
    const s = c.story(), pg = s.programme;
    const rotorCell = s.beats?.state?.().socket ?? -1;   // the first orders' Rotor goes on the plan's own socket (the beats'), not the emptiest lane
    const sentries = c.sentryKeys().map((k) => TOWER_BY_KEY[k]).filter(Boolean).map((d) => ({ key: d.key, name: d.name, cost: d.cost }));
    return { w: { steps: pg.steps, done: pg.done, bought: pg.bought ?? new Set(), ctx: { phase: s.beats?.phase?.() ?? null, sector: n, back: s.backOpen ? 'held' : null, manned: c.manned(), standing: s.stands },   // standing: `when.stand` (2026-11-07)
      bank: bank(), sentryRoom: site() >= 0, sentries, upgrades: weakest(), hull: c.hull(), shield: c.shield(), pets: pets(),
      rotor: TOWER_BY_KEY.rotor ? { key: 'rotor', name: TOWER_BY_KEY.rotor.name, cost: TOWER_BY_KEY.rotor.cost } : null, rotorCell, rotorBuilt: c.towers().some((t) => t.ci === rotorCell), rotorPending: c.orders.some((o) => o.ci === rotorCell), secondCell: n === 'first' ? secondSite(rotorCell) : -1 } };
  }
  // THE COLONY'S ROW (2026-11-12 night; src/domain/colony.js): the cells this story's plan holds, which are taken (a dome bought or standing), which
  // stand (the corner rule), the kinds held, and the board's price index for the coming sector
  function colonyWorld(n) {
    const s = c.story(), pg = s?.programme, cells = s?.colony?.cells ?? [];
    if (!pg || !cells.length || typeof n !== 'number') return null;
    const stepOf = (cell) => pg.steps.find((x) => x.cell === cell), mine = (st) => st && (pg.bought.has(st.id) || pg.done.has(st.id));
    const taken = new Set(cells.filter((x) => mine(stepOf(x.id))).map((x) => x.id)), held = Object.fromEntries([...taken].map((cell) => [cell, kindOf(pg, stepOf(cell)).kind]));
    return { cells, taken, held, standing: (cell) => !!s.stands?.(`dome-${cell}`), index: priceIndex(BUILD_BOARD, n) };
  }
  const div = (cls, text, tag = 'div') => { const el = document.createElement(tag); el.className = cls; if (text != null) el.textContent = text; return el; };
  function render() {
    if (!card) return;
    const b = bank(), paid = totalOf(all(), picked);
    card.querySelector('.bb-bank').textContent = `${b - paid} kg left of ${b} kg`;
    card.querySelectorAll('.bb-tile').forEach((el, i) => {
      const o = all()[i], on = picked.includes(o.id), base = o.kind === 'dome' ? picked.filter((p) => !p.startsWith('dome:')) : picked, can = on || togglePick(all(), base, o.id, b, BUILD_BOARD.picks) !== base;
      el.classList.toggle('bb-on', on); el.classList.toggle('bb-short', o.price > b - (on ? paid - o.price : paid)); el.disabled = !can;
      el.querySelector('.bb-price').textContent = `${o.price} kg${o.price > b ? ` ${W.short}` : ''}`;
    });
    // the dome tiles name the cell each would go on; the map rings the picked dome's cell
    card.querySelectorAll('.bb-tile.bb-dome .bb-cell').forEach((el) => { el.textContent = `→ ${CW.cell(cellOf[el.dataset.offer])}`; });
    const dome = picked.find((id) => id.startsWith('dome:')), at = dome ? cellOf[dome] : null;
    card.querySelectorAll('.bb-map [data-cell]').forEach((el) => { el.classList.toggle('bb-at', el.dataset.cell === at); });
    card.querySelector('.bb-go').textContent = picked.length ? `${W.go} · ${paid} kg` : W.go;
    card.querySelector('.bb-go').disabled = !picked.length;
  }
  // ONE DOME A BOARD: picking a second dome kind takes the place of the first
  function pick(id) {
    const swap = id.startsWith('dome:') && !picked.includes(id) ? picked.filter((p) => !p.startsWith('dome:')) : picked;
    const b = togglePick(all(), swap, id, bank(), BUILD_BOARD.picks); if (b === swap) return false;
    picked = b; render(); return true;
  }
  // the cell the picked dome goes on: a free one on the map (a click, or Tab for the next); with no dome picked a click picks Isao's suggestion there
  function chooseCell(cell) {
    if (!map.some((m) => m.id === cell && m.state === 'free')) return false;
    let dome = picked.find((id) => id.startsWith('dome:'));
    if (!dome) { const o = row.find((x) => x.suggested) ?? row[0]; if (!o || !pick(o.id)) return false; dome = o.id; }
    cellOf[dome] = cell; render(); return true;
  }
  function nextCell() {
    const dome = picked.find((id) => id.startsWith('dome:')); if (!dome) return false;
    const free = map.filter((m) => m.state === 'free').map((m) => m.id); if (!free.length) return false;
    return chooseCell(free[(free.indexOf(cellOf[dome]) + 1) % free.length]);
  }
  function apply(o) {
    const s = c.story(), e = c.eco();
    if (o.kind === 'sentry') { const ci = o.site ?? site(); return ci >= 0 && c.orderTower(o.key, ci, { quiet: true }); }
    if (o.kind === 'upgrade') { const t = c.towers().find((x) => x.ci === o.ci); return !!t && c.orderUpgrade(t); }
    if (!e.spend(o.price, { category: 'board' })) return false;
    if (o.kind === 'structure') buy(s.programme, o.step);
    else if (o.kind === 'dome') { const cell = cellOf[o.id]; buy(s.programme, `dome-${cell}`, { kind: o.dome, perk: o.perk }); s.colony?.assign(cell, o.dome); }
    else if (o.kind === 'repair') c.mendHull();
    else if (o.kind === 'spare') c.addHull();
    else if (o.kind === 'shield') c.fillRack();
    else if (o.kind === 'pet') c.printPet(o.index);
    return true;
  }
  function close(took, labels = []) {
    const go = open?.go;
    globalThis.removeEventListener?.('keydown', onKey, true); card?.remove(); card = null; thumbs?.close();
    last = { n: open?.n ?? null, bank: open?.bank ?? 0, offers: all().map((o) => `${o.id}:${o.price}`), took, cells: Object.fromEntries(took.filter((id) => id.startsWith('dome:')).map((id) => [id, cellOf[id]])), after: bank() }; history.push(last); open = null; offers = []; row = []; map = []; cellOf = {}; picked = [];
    c.callout?.(took.length ? `${W.ordered} · ${labels.join(' + ')}` : W.none, 'co-victory-sub');
    go?.();
  }
  function confirm() {
    if (!card) return false;
    const took = [], labels = [];
    for (const id of picked) { const o = all().find((x) => x.id === id); if (o && apply(o)) { took.push(id); labels.push(o.kind === 'dome' ? `${o.label} ${String(cellOf[id]).toUpperCase()}` : o.label); } }
    close(took, labels);
    return true;
  }
  function skip() { if (!card) return false; close([]); return true; }
  // the board owns the keyboard while it is up (the game's P and Escape would pause or unpause under it); the browser's own chords pass
  function onKey(ev) {
    if (!card || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key;
    ev.stopPropagation();
    if (/^[1-6]$/.test(k)) { const o = offers[+k - 1]; if (o) pick(o.id); }
    else if (ROW_KEYS.includes(k.toLowerCase()) && row.length) { const o = row[ROW_KEYS.indexOf(k.toLowerCase())]; if (o) pick(o.id); }
    else if (k === 'Tab' && row.length) nextCell();
    else if (k === 'Enter') { if (picked.length) confirm(); }
    else if (k === 'Escape') skip();
    else return;
    ev.preventDefault();
  }
  function show(n, go, { pool = (w) => boardOffers(w, BUILD_BOARD), words = W } = {}) {
    const { w } = world(n), cw = colonyWorld(n);
    offers = pool(w); picked = [];
    row = cw ? colonyOffers(cw, COLONY) : []; map = cw ? cellStates(cw.cells, { taken: cw.taken, standing: cw.standing }) : [];
    cellOf = Object.fromEntries(row.map((o) => [o.id, o.cell]));
    if (!offers.length && !row.length) return false;
    open = { n, go, bank: bank() };
    c.endShot();   // a live cut (a print close-up begun before the debrief) would take the board's keys and taps: it ends, as its skip would
    card = div('build-board'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'assertive'); card.dataset.sector = String(n);
    const head = div('bb-head'); head.append(div('bb-who', W.who), div('bb-title', words.title ?? W.title), div('bb-line', words.line ?? W.line), div('bb-bank', ''));
    const grid = div('bb-grid');
    offers.forEach((o, i) => {
      const t = div(`bb-tile bb-${o.kind}`, null, 'button'); t.type = 'button'; t.dataset.offer = o.id;
      const img = div('bb-thumb', null, 'img'); img.alt = '';
      t.append(div('bb-key', String(i + 1)), img, div('bb-name', o.label), div('bb-price', ''), div('bb-effect', o.effect));
      t.addEventListener('click', () => pick(o.id)); grid.appendChild(t);
    });
    // THE COLONY (2026-11-12 night): a card a dome kind left, keyed Q-Y, and the grid seen from above, the mouth at the top: the free cells to click,
    // the taken ones, the locked ones with the corner rule's reason, the plaza and the entry
    const colony = row.length ? div('bb-colony') : null;
    if (colony) {
      const tiles = div('bb-grid bb-grid--colony');
      row.forEach((o, i) => {
        const t = div('bb-tile bb-dome', null, 'button'); t.type = 'button'; t.dataset.offer = o.id; if (o.suggested) t.className += ' bb-suggested';
        const img = div('bb-thumb', null, 'img'); img.alt = '';
        const cl = div('bb-cell', ''); cl.dataset.offer = o.id;
        t.append(div('bb-key', ROW_KEYS[i].toUpperCase()), img, div('bb-name', o.label), div('bb-price', ''), div('bb-effect', o.effect), cl, ...(o.suggested ? [div('bb-isao', CW.suggested)] : []));
        t.addEventListener('click', () => pick(o.id)); tiles.appendChild(t);
      });
      const grid3 = div('bb-map'); grid3.setAttribute('role', 'group');
      for (const r of [-1, 0, 1]) for (const cc of [-1, 0, 1]) {
        const cell = (c.story()?.colony?.cells ?? []).find((x) => x.col === cc && x.row === r), m = cell ? map.find((x) => x.id === cell.id) : null;
        const b = div(`bb-c bb-c--${m ? m.state : r === 0 && cc === 0 ? 'plaza' : 'entry'}`, m ? cell.id.toUpperCase() : r === 0 && cc === 0 ? 'STÅLHEART' : r < 0 && cc === 0 ? 'ENTRY' : '', 'button'); b.type = 'button';
        if (m) { b.dataset.cell = m.id; b.disabled = m.state !== 'free'; b.title = m.state === 'locked' ? CW.locked : m.state === 'taken' ? CW.taken : CW.cell(m.id); if (m.state === 'free') b.addEventListener('click', () => chooseCell(m.id)); }
        else b.disabled = true;
        grid3.appendChild(b);
      }
      const why = map.some((m) => m.state === 'locked') ? div('bb-why', `${map.filter((m) => m.state === 'locked').map((m) => m.id.toUpperCase()).join(', ')}: ${CW.locked}`) : null;
      const side = div('bb-mapbox'); side.append(grid3, ...(why ? [why] : []));
      colony.append(div('bb-rowtitle', CW.row), tiles, side);
    }
    const bar = div('bb-row');
    const sk = div('sdb-btn bb-skip', W.skip, 'button'); sk.type = 'button'; sk.addEventListener('click', skip);
    const ok = div('sdb-btn sdb-btn--go bb-go', W.go, 'button'); ok.type = 'button'; ok.addEventListener('click', confirm);
    bar.append(sk, ok);
    card.append(head, grid, ...(colony ? [colony] : []), div('bb-hint', colony ? `${W.hint} · ${CW.hint}` : W.hint), bar); c.root.appendChild(card);
    if (thumbs) card.querySelectorAll('.bb-tile').forEach((el, i) => thumbs.fill(all()[i], el.querySelector('.bb-thumb')));   // a GLB's thumbnail lands later
    globalThis.addEventListener?.('keydown', onKey, true);
    render();
    return true;
  }
  return {
    // the sector loop's break: true when the board took it (it calls `go` when the player is done), false to go straight on
    interlude: (go, { n = 0, via = 'continue' } = {}) => {
      if (via !== 'continue' || n < 2 || !c.story()?.programme) return false;
      return show(n, go);
    },
    // THE FIRST ORDERS (2026-11-08, THE SETTLING, spec 2.B): the card once at the landing with the first pool and words (src/fx/first-orders.js opens it)
    first: (go) => !card && !!c.story()?.programme && show('first', go, { pool: (w) => firstOffers(w, BUILD_BOARD), words: BUILD_BOARD.first.words }),
    state: () => ({ open: !!card, n: open?.n ?? null, first: open?.n === 'first', bank: bank(), thumbs: card ? [...card.querySelectorAll('.bb-thumb')].filter((im) => im.src).length : 0, offers: offers.map((o) => ({ id: o.id, kind: o.kind, label: o.label, price: o.price })), picked: picked.slice(), last, boards: history.length,
      colony: row.map((o) => ({ id: o.id, kind: o.dome, label: o.label, price: o.price, cell: cellOf[o.id], suggested: o.suggested })), cells: map.map((m) => ({ id: m.id, state: m.state })),
      bought: [...(c.story()?.programme?.bought ?? [])] }),
    // test.dome(cell, kind): a dome bought on the programme as the board's pick does, unpaid, with its kind's module (the harness's colony, 2026-11-12 night)
    test: { toggle: (id) => pick(id), confirm, skip, cell: (id) => chooseCell(id),
      dome: (cell, kind) => { const s = c.story(), k = COLONY.kinds[kind]; if (!s?.programme || !k) return false; const ok = buy(s.programme, `dome-${cell}`, { kind, perk: k.perk ?? null }); if (ok) s.colony?.assign(cell, kind); return ok; } },
  };
}
