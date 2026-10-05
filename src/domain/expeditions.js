// EXPEDITIONS (owner, 2026-09-14): each landing site holds the part for one tower, guarded by a nest. A site moves
// hidden → guarded → cleared → carried → delivered; the tank carries one part at a time, a lost hull drops it back at
// its site, and a delivered part lets Isao print that tower. Later sites reveal after enough deliveries. Pure.
const siteOf = (st, id) => st.sites.find((s) => s.id === id);

export function makeExpeditions(sites) {
  return { sites: sites.map((s) => ({ id: s.id, tower: s.tower, part: s.part, reveal: s.reveal ?? null, state: 'hidden' })), carrying: null };
}

export function reveal(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'hidden') return false;
  s.state = 'guarded';
  return true;
}

export function guardsCleared(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'guarded') return false;
  s.state = 'cleared';
  return true;
}

export function reach(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state !== 'cleared' || st.carrying) return false;
  s.state = 'carried'; st.carrying = id;
  return true;
}

export function deliver(st) {
  const s = st.carrying ? siteOf(st, st.carrying) : null;
  if (!s) return null;
  s.state = 'delivered'; st.carrying = null;
  return s.tower;
}

// WHERE THE HULL FELL (owner, 2026-10-05: "what happens if a MORK dies while carrying a package? It should be left on the ground there
// for the player to go get back"): `at`, the cell it died on, is where the part now waits (s.at); without it, back at its site as before
export function hullLost(st, at = null) {
  const s = st.carrying ? siteOf(st, st.carrying) : null;
  if (!s) return false;
  s.state = 'cleared'; st.carrying = null;
  if (Number.isInteger(at) && at >= 0) s.at = at;
  return true;
}

// A RUN THAT STARTS PAST THE TUTORIAL (the SKIP TUTORIAL entry, 2026-09-16): a site whose part is already home, without
// walking the states. Nothing else may reach 'delivered' this way — the tank still has to drive for every other part.
export function deliverAtOnce(st, id) {
  const s = siteOf(st, id);
  if (!s || s.state === 'delivered' || st.carrying === id) return null;
  s.state = 'delivered';
  return s.tower;
}

export const siteState = (st, id) => siteOf(st, id)?.state ?? null;

export function unlockedTowers(st, base) {
  return [...base, ...st.sites.filter((s) => s.state === 'delivered').map((s) => s.tower)];
}

export function nextReveals(st) {
  const home = st.sites.filter((s) => s.state === 'delivered').length;
  return st.sites.filter((s) => s.state === 'hidden' && s.reveal && home >= s.reveal.after).map((s) => s.id);
}
