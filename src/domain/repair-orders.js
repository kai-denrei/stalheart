// ISAO MENDS WHAT THE SWARM BROKE (owner, 2026-09-16: "Isao should go and build walls/a gate in between waves when a breach of the
// base happened"). The gate already wore down under the pile outside it (src/domain/gate-integrity.js) and wall cells already blew
// out to a strike or a rock breach — but nobody ever went out and put them back, so a sector that cost the colony its door left it
// without one for good. This picks the next thing worth a trip: the GATE first, because it is the lane's only door, then the wall
// segments in the order the caller lists them (the rim's own order).
//
// Only between waves: a repair is a print, and a print in the middle of a wave is Isao hovering over a lane full of bodies. And
// never ahead of the player — an order of theirs on the board outranks the whole programme.
//
// Pure: the caller reports what is broken and whether the lane is quiet, and owns Isao's travel-and-print loop.

// what a repair costs and when the gate is worth one; the caller passes src/content/base-programme.js BASE_REPAIR
const SHARE = (gate) => (gate && gate.max > 0 ? gate.hp / gate.max : 1);

// gate: { hp, max, broken } (null where the world has no gate). walls: cells that should be rock and are not, in the caller's order.
// quiet: no wave is running and the lane is clear. busy: a worker already has an order (the player's, a build step, an earlier repair).
// Returns { kind: 'gate' } | { kind: 'wall', ci } | null.
export function nextRepair(state = {}, tune = {}) {
  const { walls = [], quiet = false, busy = false } = state;
  if (!quiet || busy) return null;
  const g = worstGate(state, tune);
  if (g) return g;
  const ci = walls.find((c) => Number.isInteger(c) && c >= 0);
  return ci === undefined ? null : { kind: 'wall', ci };
}

// TWO DOORS NOW (2026-09-18). `gates` is every gate that stands, each { id, hp, max, broken }; `gate` alone is still the front door
// and still means the same thing. Isao goes to the WORST one first — a broken door before a chewed one, and the lower share before
// the higher — so neither side is left open while he tops the other one up. Ties keep the caller's order, the front door first.
const wanting = (g, tune) => g && (g.broken || SHARE(g) < (tune.gateAt ?? 1));
const rank = (g) => (g.broken ? -1 : SHARE(g));
function gateList({ gate = null, gates = null }) { return (gates ?? (gate ? [gate] : [])).filter(Boolean); }
function worstGate(state, tune) {
  let best = null;
  for (const g of gateList(state)) if (wanting(g, tune) && (!best || rank(g) < rank(best))) best = g;
  return best ? { kind: 'gate', ...(best.id && best.id !== 'gate' ? { id: best.id } : {}) } : null;
}

// everything that wants mending right now, gate first — the HUD's count and the test's ordering check
export function repairsPending(state = {}, tune = {}) {
  const { walls = [] } = state;
  const out = gateList(state).filter((g) => wanting(g, tune)).sort((a, b) => rank(a) - rank(b)).map((g) => ({ kind: 'gate', ...(g.id && g.id !== 'gate' ? { id: g.id } : {}) }));
  for (const ci of walls) if (Number.isInteger(ci) && ci >= 0) out.push({ kind: 'wall', ci });
  return out;
}

// the seconds and metres the print takes, by kind
export const repairCost = (repair, tune) => ({ seconds: tune?.[repair.kind]?.seconds ?? 6, metres: tune?.[repair.kind]?.metres ?? 4 });
