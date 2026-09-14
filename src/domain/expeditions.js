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

export function hullLost(st) {
  const s = st.carrying ? siteOf(st, st.carrying) : null;
  if (!s) return false;
  s.state = 'cleared'; st.carrying = null;
  return true;
}

export const siteState = (st, id) => siteOf(st, id)?.state ?? null;

export function unlockedTowers(st, base) {
  return [...base, ...st.sites.filter((s) => s.state === 'delivered').map((s) => s.tower)];
}

export function nextReveals(st) {
  const home = st.sites.filter((s) => s.state === 'delivered').length;
  return st.sites.filter((s) => s.state === 'hidden' && s.reveal && home >= s.reveal.after).map((s) => s.id);
}
