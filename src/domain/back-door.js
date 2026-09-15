// The second front: the sealed clearing mouth behind the base, and the lane cells a breach can open on so its swarm walks
// in through that mouth once it is cracked. Pure graph rules on the story planet (src/domain/story-planet.js); the
// numbers come from the caller (src/content/story-defaults.js STORY_BACK_DOOR).
import { bfsDist, BLOCKED } from '../dungeon.js';

const centroid = (graph, cells) => {
  const c = [0, 0, 0];
  for (const ci of cells) for (let k = 0; k < 3; k++) c[k] += graph.centers[ci][k];
  const l = Math.hypot(c[0], c[1], c[2]) || 1;
  return [c[0] / l, c[1] / l, c[2] / l];
};

// The sealed mouth nearest the frame's +Z axis (the gate's open mouth lies on -Z, so +Z is behind the bays): it must
// touch the clearing, lead out to a real share of the world (reachShare of the best mouth's outward reach) and be at
// most maxCells wide. Returns { cells, beyond, flank, dir, azimuth, frame } or null: `beyond` are the open cells just
// outside it, `flank` up to `flank` rock cells that come down with it (mouthFlank), `dir` its unit direction on the game
// sphere, `azimuth` its bearing from +Z in radians, `frame` its [x, z] metres.
export function findBackMouth(planet, { maxCells = 2, reachShare = 0.5, flank = 4 } = {}) {
  const { graph, clearing, dungeon, radius } = planet;
  const bestReach = Math.max(0, ...clearing.mouths.map((m) => m.reach ?? 0));
  let best = null;
  for (const m of clearing.mouths) {
    if (m.open || !m.touches || m.cells.length > maxCells || (m.reach ?? 0) < bestReach * reachShare) continue;
    const dir = centroid(graph, m.cells);
    const f = planet.worldToFrame([dir[0] * radius, dir[1] * radius - radius, dir[2] * radius]);
    const azimuth = Math.atan2(f[0], f[2]);
    if (!best || Math.abs(azimuth) < Math.abs(best.azimuth)) best = { cells: m.cells.slice(), dir, azimuth, frame: [f[0], f[2]] };
  }
  if (!best) return null;
  const inMouth = new Set(best.cells), beyond = new Set();
  for (const ci of best.cells) for (const nb of graph.adj[ci]) if (!inMouth.has(nb) && !clearing.cells.has(nb) && dungeon.tags[nb] !== BLOCKED) beyond.add(nb);
  best.beyond = [...beyond].sort((a, b) => a - b);
  best.flank = mouthFlank(planet, dungeon.tags, best, flank);
  return best;
}

// Rock cells beside the mouth that can come down with it for the look of a collapse, nearest the mouth first: rock
// neighbours of the mouth, then of the cells just beyond it, never inside the clearing. At most `count`.
export function mouthFlank(planet, tags, mouth, count = 4) {
  const { graph, clearing } = planet, inMouth = new Set(mouth.cells), out = [];
  for (const ring of [mouth.cells, mouth.beyond]) {
    for (const ci of ring) for (const nb of graph.adj[ci]) {
      if (out.length >= count) return out;
      if (tags[nb] === BLOCKED && !inMouth.has(nb) && !clearing.cells.has(nb) && !out.includes(nb)) out.push(nb);
    }
  }
  return out;
}

// Lane cells for a back breach: open ground outside the clearing, hops[0]..hops[1] steps out from the mouth, whose route
// to the heart with the mouth open is at least `margin` hops shorter than through the gate alone, so a swarm raised
// there walks in through the back. The collapse is the mouth and its flank together: `tags` may already have it open,
// the gate-only field closes all of it, the back field opens all of it, so the answer is the same before and after.
// Each entry: { cell, ring (hops out from the mouth), hops (to the heart, mouth open), gateHops (-1: no route) }.
export function backBreachCells(planet, tags, heart, mouth, { hops = [25, 35], margin = 20 } = {}) {
  const { graph, clearing } = planet, inMouth = new Set([...mouth.cells, ...(mouth.flank ?? [])]);
  const open = (i) => tags[i] !== BLOCKED || inMouth.has(i);
  const gate = bfsDist(graph.adj, [heart], (i) => tags[i] !== BLOCKED && !inMouth.has(i));
  const back = bfsDist(graph.adj, [heart], open);
  const out = bfsDist(graph.adj, mouth.cells, (i) => open(i) && !clearing.cells.has(i));
  const cells = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i] < hops[0] || out[i] > hops[1] || clearing.cells.has(i) || tags[i] === BLOCKED || back[i] < 0) continue;
    if (gate[i] >= 0 && back[i] > gate[i] - margin) continue;
    cells.push({ cell: i, ring: out[i], hops: back[i], gateHops: gate[i] });
  }
  return cells.sort((a, b) => a.hops - b.hops || a.cell - b.cell);
}
