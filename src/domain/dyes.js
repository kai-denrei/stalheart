// THE DYE BOOK (src/content/dyes.js). Pure: per-belt kills processed (cumulative across runs), the dyes extracted, the ones already
// offered at a paint shop, and the hull's livery. The caller persists it as JSON.
export function makeDyeBook(saved = null, dyes = []) {
  const b = { kills: {}, unlocked: [], offered: [], livery: { armour: 'factory', edge: 'factory' } };
  if (saved && typeof saved === 'object') {
    for (const d of dyes) if (Number.isFinite(saved.kills?.[d.id])) b.kills[d.id] = Math.max(0, saved.kills[d.id]);
    const known = new Set(dyes.map((d) => d.id));
    b.unlocked = (saved.unlocked ?? []).filter((id) => known.has(id));
    b.offered = (saved.offered ?? []).filter((id) => b.unlocked.includes(id));
    for (const slot of ['armour', 'edge']) { const v = saved.livery?.[slot]; if (v === 'factory' || b.unlocked.includes(v)) b.livery[slot] = v; }
  }
  return b;
}

// kills of a belt processed: returns the dyes extracted by them (usually none)
export function processKills(b, belt, n, dyes) {
  if (!(n > 0)) return [];
  b.kills[belt] = (b.kills[belt] ?? 0) + n;
  const out = [];
  for (const d of dyes) if (d.id === belt && !b.unlocked.includes(d.id) && b.kills[belt] >= d.kills) { b.unlocked.push(d.id); out.push(d.id); }
  return out;
}

// dyes extracted but never offered: the paint shop opens when there are any
export const unoffered = (b) => b.unlocked.filter((id) => !b.offered.includes(id));
export function markOffered(b) { b.offered = [...b.unlocked]; }

// paint a slot: only with a dye the book has, or the factory paint
export function paint(b, slot, id) {
  if (!(slot in b.livery)) return false;
  if (id !== 'factory' && !b.unlocked.includes(id)) return false;
  b.livery[slot] = id; return true;
}

// how far each locked dye is, for the shop's locked swatches
export const progress = (b, dyes) => dyes.map((d) => ({ id: d.id, unlocked: b.unlocked.includes(d.id), have: Math.min(d.kills, b.kills[d.id] ?? 0), need: d.kills }));
