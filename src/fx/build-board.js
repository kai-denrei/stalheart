// THE BUILD BOARD (owner, 2026-11-05, round 6 note 2: "after each round ISAO proposes 6 choices of things he can build and the user chooses 2,
// given enough biomass"). The sector loop's break (src/fx/sector-run.js next(), the `interlude` seam the paint shop once used) opens it on the
// debrief's CONTINUE, from the break before sector 2 on: a card over the paused game, Isao's line, six tiles (name, price, effect), up to two
// picks within the bank, ORDER pays and places them, SKIP (or Escape) takes none, then the next sector begins. KEEP HOLDING and an acceptance
// run's own continue ('hold', 'harness') pass it by. The rules are src/domain/build-board.js, the numbers src/content/build-board.js.
// What a pick does: a structure is bought on the programme (src/domain/build-programme.js buy: Isao prints it at its own gate); a sentry is
// Isao's order on the emptiest lane's socket (orderTower, the radial's price); an upgrade is his order on the weakest sentry (orderUpgrade);
// the hull's dents mended now, a spare hull, the shield rack full; a companion printed now (its unit's `offer`, stream A).
//   createBuildBoard(c) -> { interlude(go, { n, via }), state(), test: { toggle(id), confirm(), skip() } }
//   c: root, endShot(), eco(), story(), towers(), orders, placeError(ci), graph(), cellSide(), orderTower(key, ci, opts), orderUpgrade(tower),
//      hull() -> { dents, max, hulls, maxHulls }, mendHull(), addHull(), shield() -> { rack, cap }, fillRack(), petLife(i) (a companion's life:
//      'unborn' may be offered), printPet(i), callout(text, cls), sentryKeys(), manned() (SOL's manned passes: the launcher's gate)
import { BUILD_BOARD } from '../content/build-board.js';
import { TOWER_BY_KEY, upgradeCost } from '../towers.js';
import { boardOffers, toggle as togglePick, totalOf, emptiestLaneSite } from '../domain/build-board.js';
import { buy, hasPerk } from '../domain/build-programme.js';
import { COMPANIONS } from '../content/companions.js';

export function createBuildBoard(c) {
  const W = BUILD_BOARD.words;
  let card = null, offers = [], picked = [], open = null, last = null;
  const history = [];
  const bank = () => Math.round(c.eco().biomass);
  // the socket Isao would print a sentry on (the plan's mounts, story.socketToward): the door whose lane holds the fewest sentries, its nearest free one
  function site() {
    const s = c.story(), g = c.graph(); if (!s || !g) return -1;
    const doors = [s.gateCell, s.programme && hasPerk(s.programme, 'backgate') ? s.gateCellOf?.('back') : -1].filter((x) => Number.isInteger(x) && x >= 0);
    const taken = [...c.towers().map((t) => t.ci), ...c.orders.filter((o) => o.kind === 'tower').map((o) => o.ci)];
    return emptiestLaneSite({ candidates: Object.keys(s.socketToward ?? {}).map(Number).filter((ci) => !c.placeError(ci)), doors, taken, centers: g.centers, cellSide: c.cellSide() });
  }
  // the standing sentries Isao could upgrade, weakest first (the lowest level, then the cheapest step)
  const weakest = () => c.towers().filter((t) => !c.orders.some((o) => o.ci === t.ci)).map((t) => ({ t, cost: upgradeCost(t.def, t.tier) })).filter((x) => x.cost !== null).sort((a, b) => a.t.tier - b.t.tier || a.cost - b.cost)
    .slice(0, 2).map(({ t, cost }) => ({ ci: t.ci, name: t.def.name, tier: t.tier, cost }));
  // a companion is a card when its unit carries an `offer` ({ price, fromSector, effect }: stream A's field) and it is not born yet
  const pets = () => (COMPANIONS.units ?? []).map((u, index) => ({ u, index })).filter(({ u, index }) => u.offer && c.petLife(index) === 'unborn').map(({ u, index }) => ({ ...u.offer, id: u.id, index, label: u.name }));
  function world(n) {
    const s = c.story(), pg = s.programme;
    const sentries = c.sentryKeys().map((k) => TOWER_BY_KEY[k]).filter(Boolean).map((d) => ({ key: d.key, name: d.name, cost: d.cost }));
    return { w: { steps: pg.steps, done: pg.done, bought: pg.bought ?? new Set(), ctx: { phase: s.beats?.phase?.() ?? null, sector: n, back: s.backOpen ? 'held' : null, manned: c.manned() },
      bank: bank(), sentryRoom: site() >= 0, sentries, upgrades: weakest(), hull: c.hull(), shield: c.shield(), pets: pets() } };
  }
  const div = (cls, text, tag = 'div') => { const el = document.createElement(tag); el.className = cls; if (text != null) el.textContent = text; return el; };
  function render() {
    if (!card) return;
    const b = bank(), paid = totalOf(offers, picked);
    card.querySelector('.bb-bank').textContent = `${b - paid} kg left of ${b} kg`;
    card.querySelectorAll('.bb-tile').forEach((el, i) => {
      const o = offers[i], on = picked.includes(o.id), can = on || togglePick(offers, picked, o.id, b, BUILD_BOARD.picks) !== picked;
      el.classList.toggle('bb-on', on); el.classList.toggle('bb-short', o.price > b - (on ? paid - o.price : paid)); el.disabled = !can;
      el.querySelector('.bb-price').textContent = `${o.price} kg${o.price > b ? ` ${W.short}` : ''}`;
    });
    card.querySelector('.bb-go').textContent = picked.length ? `${W.go} · ${paid} kg` : W.go;
    card.querySelector('.bb-go').disabled = !picked.length;
  }
  function pick(id) { const b = togglePick(offers, picked, id, bank(), BUILD_BOARD.picks); if (b === picked) return false; picked = b; render(); return true; }
  function apply(o) {
    const s = c.story(), e = c.eco();
    if (o.kind === 'sentry') { const ci = site(); return ci >= 0 && c.orderTower(o.key, ci, { quiet: true }); }
    if (o.kind === 'upgrade') { const t = c.towers().find((x) => x.ci === o.ci); return !!t && c.orderUpgrade(t); }
    if (!e.spend(o.price, { category: 'board' })) return false;
    if (o.kind === 'structure') buy(s.programme, o.step);
    else if (o.kind === 'repair') c.mendHull();
    else if (o.kind === 'spare') c.addHull();
    else if (o.kind === 'shield') c.fillRack();
    else if (o.kind === 'pet') c.printPet(o.index);
    return true;
  }
  function close(took, labels = []) {
    const go = open?.go;
    globalThis.removeEventListener?.('keydown', onKey, true); card?.remove(); card = null;
    last = { n: open?.n ?? null, bank: open?.bank ?? 0, offers: offers.map((o) => `${o.id}:${o.price}`), took, after: bank() }; history.push(last); open = null; offers = []; picked = [];
    c.callout?.(took.length ? `${W.ordered} · ${labels.join(' + ')}` : W.none, 'co-victory-sub');
    go?.();
  }
  function confirm() {
    if (!card) return false;
    const took = [], labels = [];
    for (const id of picked) { const o = offers.find((x) => x.id === id); if (o && apply(o)) { took.push(id); labels.push(o.label); } }
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
    else if (k === 'Enter') { if (picked.length) confirm(); }
    else if (k === 'Escape') skip();
    else return;
    ev.preventDefault();
  }
  function show(n, go) {
    const { w } = world(n);
    offers = boardOffers(w, BUILD_BOARD); picked = [];
    if (!offers.length) return false;
    open = { n, go, bank: bank() };
    c.endShot();   // a live cut (a print close-up begun before the debrief) would take the board's keys and taps: it ends, as its skip would
    card = div('build-board'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-live', 'assertive'); card.dataset.sector = String(n);
    const head = div('bb-head'); head.append(div('bb-who', W.who), div('bb-title', W.title), div('bb-line', W.line), div('bb-bank', ''));
    const grid = div('bb-grid');
    offers.forEach((o, i) => {
      const t = div(`bb-tile bb-${o.kind}`, null, 'button'); t.type = 'button'; t.dataset.offer = o.id;
      t.append(div('bb-key', String(i + 1)), div('bb-name', o.label), div('bb-price', ''), div('bb-effect', o.effect));
      t.addEventListener('click', () => pick(o.id)); grid.appendChild(t);
    });
    const row = div('bb-row');
    const sk = div('sdb-btn bb-skip', W.skip, 'button'); sk.type = 'button'; sk.addEventListener('click', skip);
    const ok = div('sdb-btn sdb-btn--go bb-go', W.go, 'button'); ok.type = 'button'; ok.addEventListener('click', confirm);
    row.append(sk, ok);
    card.append(head, grid, div('bb-hint', W.hint), row); c.root.appendChild(card);
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
    state: () => ({ open: !!card, n: open?.n ?? null, bank: bank(), offers: offers.map((o) => ({ id: o.id, kind: o.kind, label: o.label, price: o.price })), picked: picked.slice(), last, boards: history.length,
      bought: [...(c.story()?.programme?.bought ?? [])] }),
    test: { toggle: (id) => pick(id), confirm, skip },
  };
}
