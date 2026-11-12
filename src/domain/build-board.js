// THE BUILD BOARD'S RULES (owner, 2026-11-05, round 6 note 2: "after each round ISAO proposes 6 choices of things he can build and the user
// chooses 2, given enough biomass"). Pure: the host reads the world into plain values, these say what the board offers and what may be picked.
// The prices and words are src/content/build-board.js; the card is src/fx/build-board.js.
//   boardOffers(w, tune) -> [{ id, kind, label, price, effect, ... }] at most tune.offers, in priority, never two of one id:
//     (i) the board's structures (programme steps marked `board`) not standing and not bought whose `when` would hold in the coming sector
//         (the idle gate aside: the board is between waves), at most tune.structuresMax; (ii) sentries: the cheapest unlocked kind and the
//         dearest the bank can buy (tune.sentryKinds), when the book has room; (iii) an upgrade of the weakest standing sentry; (iv) the hull:
//         its dents mended, a spare hull, the shield rack full; (v) a companion with an `offer`, from its sector; then, still short of six, the
//         other sentry kinds and the next weakest sentry's upgrade (w.upgrades, weakest first). A short pool shows what it has.
//   firstOffers(w, tune) -> the first orders' pool (2026-11-08): the Rotor on w.rotorCell at the radial's price unless it stands or is on the book (then, 2026-11-12,
//     the SECOND ROTOR on w.secondCell when there is one), then the steps marked `first` not standing and not bought at tune.first.structures' prices
//   pickable(offers, picked, id, bank) -> can `id` join the picks: affordable after the others picked are paid, and picks below tune.picks
//   toggle(offers, picked, id, bank, max) -> the new picks (a refused pick leaves them as they were)
//   jumpBought(steps, sector) -> the board steps a jump to `sector` stands in for having bought (the history a skipped run implies)
import { whenHolds } from './build-programme.js';

// THE PRICE INDEX: the board's own cards (structures, the hull's) cost their base price times the index of the coming sector (the last index
// holds after the table), rounded to 10 kg; the sentry and upgrade cards are the radial's prices, unchanged
export function priceIndex(tune, sector) {
  const ix = tune.index ?? [];
  if (!ix.length) return 1;
  return ix[Math.max(0, Math.min(ix.length - 1, (sector ?? 2) - 2))];
}
const scaled = (base, k) => Math.max(10, Math.round((base * k) / 10) * 10);

export function boardOffers(w, tune) {
  const out = [], has = (id) => out.some((o) => o.id === id), push = (o) => { if (out.length < tune.offers && !has(o.id)) out.push(o); };
  const ctx = { ...w.ctx, waveActive: false }, k = priceIndex(tune, w.ctx.sector);
  const structs = (w.steps ?? []).filter((s) => s.board && !w.done.has(s.id) && !w.bought.has(s.id) && tune.structures[s.id] && whenHolds({ ...(s.when ?? {}), idle: false }, ctx));
  for (const s of structs.slice(0, tune.structuresMax)) push({ id: `build:${s.id}`, kind: 'structure', step: s.id, label: String(s.label).toUpperCase(), price: scaled(tune.structures[s.id].price, k), effect: tune.structures[s.id].effect });
  const kinds = w.sentryRoom ? (w.sentries ?? []).slice().sort((a, b) => a.cost - b.cost) : [];
  const sentry = (k) => push({ id: `sentry:${k.key}`, kind: 'sentry', key: k.key, label: String(k.name).toUpperCase(), price: k.cost, effect: tune.words.sentry(k.name) });
  const ups = w.upgrades ?? (w.upgrade ? [w.upgrade] : []);
  const upgrade = (u) => push({ id: `upgrade:${u.ci}`, kind: 'upgrade', ci: u.ci, label: `${String(u.name).toUpperCase()} +1`, price: u.cost, effect: tune.words.upgrade(u.name, u.tier + 2) });
  const dear = kinds.filter((k) => k.cost <= w.bank).at(-1) ?? kinds.at(-1);
  for (const k of [kinds[0], dear].filter(Boolean).slice(0, tune.sentryKinds)) sentry(k);
  if (ups[0]) upgrade(ups[0]);
  const hull = w.hull ?? {};
  if (hull.dents < hull.max) push({ id: 'repair', kind: 'repair', label: tune.repair.label, price: scaled(tune.repair.price, k), effect: tune.repair.effect });
  if (hull.hulls < hull.maxHulls) push({ id: 'spare', kind: 'spare', label: tune.spare.label, price: scaled(tune.spare.price, k), effect: tune.spare.effect });
  if (w.shield && w.shield.rack < w.shield.cap) push({ id: 'shield', kind: 'shield', label: tune.shield.label, price: scaled(tune.shield.price, k), effect: tune.shield.effect });
  for (const p of w.pets ?? []) if ((w.ctx.sector ?? 0) >= (p.fromSector ?? tune.pet.fromSector)) push({ id: `pet:${p.id}`, kind: 'pet', index: p.index, label: String(p.label).toUpperCase(), price: scaled(p.price ?? tune.pet.price, k), effect: p.effect ?? '' });
  // a board still short of six fills with the other unlocked sentry kinds (dearest first) and the next weakest sentry's upgrade
  for (const k of kinds.slice().reverse()) sentry(k);
  for (const u of ups.slice(1)) upgrade(u);
  return out;
}

// THE FIRST ORDERS (owner, 2026-11-08, THE SETTLING; spec 2026-11-08-the-settling-design.md 2.B): the board's pool at the landing. `w.rotor` is the
// Rotor's kind ({ key, name, cost }, the radial's price) or null, `w.rotorCell` the plan's socket (the card orders there, not on the emptiest lane),
// `w.rotorBuilt` / `w.rotorPending` whether it stands or is on the book. The steps come in the programme's order; the prices are the salvage's scale, no index
export function firstOffers(w, tune) {
  const out = [];
  if (w.rotor && (w.rotorCell ?? -1) >= 0 && !w.rotorBuilt && !w.rotorPending) out.push({ id: `sentry:${w.rotor.key}`, kind: 'sentry', key: w.rotor.key, site: w.rotorCell, label: String(w.rotor.name).toUpperCase(), price: w.rotor.cost, effect: tune.first.words.rotor });
  // THE SECOND ROTOR (the economy design 2.7, 2026-11-12): the dog's opening has Isao's Rotor standing at the card, so the card offers a second one on
  // the wall (w.secondCell: the free wall cell nearest the Rotor's socket, src/fx/build-board.js) at the radial's price
  else if (w.rotor && (w.rotorBuilt || w.rotorPending) && (w.secondCell ?? -1) >= 0 && tune.first.words.second) out.push({ id: `sentry:${w.rotor.key}`, kind: 'sentry', key: w.rotor.key, site: w.secondCell, label: tune.first.words.second, price: w.rotor.cost, effect: tune.first.words.secondEffect ?? '' });
  for (const s of (w.steps ?? []).filter((s) => s.first && !w.done.has(s.id) && !w.bought.has(s.id) && tune.first.structures[s.id])) out.push({ id: `build:${s.id}`, kind: 'structure', step: s.id, label: String(s.label).toUpperCase(), price: tune.first.structures[s.id].price, effect: tune.first.structures[s.id].effect });
  return out.slice(0, tune.offers);
}

const priceOf = (offers, id) => offers.find((o) => o.id === id)?.price ?? Infinity;

export function pickable(offers, picked, id, bank, max = 2) {
  if (picked.includes(id) || picked.length >= max || !offers.some((o) => o.id === id)) return false;
  const paid = picked.reduce((s, p) => s + priceOf(offers, p), 0);
  return priceOf(offers, id) <= bank - paid;
}

export function toggle(offers, picked, id, bank, max = 2) {
  if (picked.includes(id)) return picked.filter((p) => p !== id);
  return pickable(offers, picked, id, bank, max) ? [...picked, id] : picked;
}

export const totalOf = (offers, picked) => picked.reduce((s, p) => s + priceOf(offers, p), 0);

export function jumpBought(steps, sector) {
  return steps.filter((s) => s.board && (s.when?.sector ?? 0) <= sector).map((s) => s.id);
}

// THE EMPTIEST LANE'S SOCKET: the door with the fewest sentries (standing or ordered) within `radius` cells, then the free candidate nearest
// that door. Candidates are the legal sockets; -1 when there is none.
export function emptiestLaneSite({ candidates, doors, taken, centers, cellSide, radius = 8 }) {
  if (!candidates.length) return -1;
  const d = (a, b) => { const p = centers[a], q = centers[b]; return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) / cellSide; };
  if (!doors.length) return candidates[0];
  const load = (door) => taken.filter((ci) => d(ci, door) <= radius).length;
  const door = doors.slice().sort((a, b) => load(a) - load(b))[0];
  return candidates.slice().sort((a, b) => d(a, door) - d(b, door))[0];
}
