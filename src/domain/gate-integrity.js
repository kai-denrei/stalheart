// THE GATE UNDER PRESSURE (QA 2026-09-16). The story's closed gate is a wall to the swarm; without a cost to that wall a
// pile outside it waits forever and nothing reaches the heart. So the gate has hit points: bodies pressing on it wear it
// down (a solid core much faster than fodder), at zero it BREAKS and stands open, and Isao mends it while the lane in front
// of it is quiet. A broken gate closes again once it is mended past closeAt of its hp.
//
// Pure. The caller counts who is pressing and who is near, and owns the gate's clip and the pathfinder's gate rule. The
// numbers come in from src/content/sectors.js SECTOR_GATE.

export function makeGateIntegrity(tune) {
  return { hp: tune.hp, max: tune.hp, broken: false, breaks: 0 };
}

// pressing: { soft, cores } bodies within pressCells. Returns 'broke' the frame the gate gives, else null.
export function pressGate(g, pressing, dt, tune) {
  if (g.broken) return null;
  const dmg = ((pressing.soft ?? 0) * tune.softDps + (pressing.cores ?? 0) * tune.coreDps) * dt;
  if (dmg <= 0) return null;
  g.hp = Math.max(0, g.hp - dmg);
  if (g.hp > 0) return null;
  g.broken = true; g.breaks++;
  return 'broke';
}

// quiet: no enemy within quietCells. Returns 'closed' the frame a broken gate is mended enough to close again.
export function mendGate(g, dt, quiet, tune) {
  if (!quiet || g.hp >= g.max) return null;
  g.hp = Math.min(g.max, g.hp + tune.repairPerSecond * dt);
  if (g.broken && g.hp >= g.max * tune.closeAt) { g.broken = false; return 'closed'; }
  return null;
}

export const gateShare = (g) => (g.max > 0 ? g.hp / g.max : 1);
