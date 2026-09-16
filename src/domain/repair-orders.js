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
export function nextRepair({ gate = null, walls = [], quiet = false, busy = false } = {}, tune = {}) {
  if (!quiet || busy) return null;
  if (gate && (gate.broken || SHARE(gate) < (tune.gateAt ?? 1))) return { kind: 'gate' };
  const ci = walls.find((c) => Number.isInteger(c) && c >= 0);
  return ci === undefined ? null : { kind: 'wall', ci };
}

// everything that wants mending right now, gate first — the HUD's count and the test's ordering check
export function repairsPending({ gate = null, walls = [] } = {}, tune = {}) {
  const out = gate && (gate.broken || SHARE(gate) < (tune.gateAt ?? 1)) ? [{ kind: 'gate' }] : [];
  for (const ci of walls) if (Number.isInteger(ci) && ci >= 0) out.push({ kind: 'wall', ci });
  return out;
}

// the seconds and metres the print takes, by kind
export const repairCost = (repair, tune) => ({ seconds: tune?.[repair.kind]?.seconds ?? 6, metres: tune?.[repair.kind]?.metres ?? 4 });
