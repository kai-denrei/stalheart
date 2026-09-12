// Concrete placements for the story base at a stage: islands with their
// pad heights, structures on them, the gate on the open mouth and the walls
// flanking it. Frame metres; y is height above the pole's tangent plane.
import { drop } from '../core/terrace-profile.js';

// Every placement is tangent to the sphere at its own centre, so y is radial
// altitude above the natural surface there. An island's pad touches the
// ground at its centre and the sphere falls away toward the corners by the
// sag, which the slab's 1.2 m skirt covers.
export function planBase(planet, layout, stage) {
  const { radius } = planet;
  const nearestCell = (x, z) => { const w = planet.frameToWorld([x, 0, z]); let best = -1, bd = Infinity; for (const ci of planet.clearing.cells) { const c = planet.graph.centers[ci]; const d = (c[0] * radius - w[0]) ** 2 + (c[1] * radius - radius - w[1]) ** 2 + (c[2] * radius - w[2]) ** 2; if (d < bd) { bd = d; best = ci; } } return best; };
  // a forward socket: the lane cell one step past the open mouth, outward; islands anchored there follow it
  const forwardCell = (() => {
    const m = planet.clearing.openMouth; if (!m) return -1;
    let best = -1, bestArc = -Infinity;
    for (const ci of m.cells) for (const nb of planet.graph.adj[ci]) {
      if (planet.clearing.cells.has(nb) || m.cells.includes(nb)) continue;
      const c = planet.graph.centers[nb], arc = Math.acos(Math.max(-1, Math.min(1, c[1] / Math.hypot(c[0], c[1], c[2]))));
      if (planet.dungeon.tags[nb] !== 0 && arc > bestArc) { bestArc = arc; best = nb; }
    }
    return best;
  })();
  const frameOf = (ci) => { const c = planet.graph.centers[ci]; const f = planet.worldToFrame([c[0] * radius, c[1] * radius - radius, c[2] * radius]); return [f[0], f[2]]; };
  const arcOf = (ci) => { const c = planet.graph.centers[ci]; return Math.acos(Math.max(-1, Math.min(1, c[1] / Math.hypot(c[0], c[1], c[2])))); };
  // down the lane: the open cell exactly `steps` lane hops out from the forward cell (breadth first over open ground outside the
  // clearing), the farthest from the pole among them. A greedy walk used to stop at the first wiggle in the lane, nine hops out.
  const walkOut = (steps) => {
    if (forwardCell < 0) return -1;
    const hop = new Map([[forwardCell, 0]]); let ring = [forwardCell], best = forwardCell;
    for (let k = 0; k < steps && ring.length; k++) {
      const next = [];
      for (const ci of ring) for (const nb of planet.graph.adj[ci]) if (!hop.has(nb) && planet.dungeon.tags[nb] !== 0 && !planet.clearing.cells.has(nb)) { hop.set(nb, k + 1); next.push(nb); }
      if (next.length) { ring = next; best = ring.reduce((a, b) => (arcOf(b) > arcOf(a) ? b : a)); }
    }
    return best;
  };
  // the wall down the lane: a rock neighbour of the lane cell `rotorSteps` past the forward cell, the one furthest to the side
  const rotorLane = walkOut(layout.kit.rotorSteps ?? 0);
  const wallCell = (() => {
    if (rotorLane < 0) return -1;
    let best = -1, bx = -Infinity;
    for (const nb of planet.graph.adj[rotorLane]) { if (planet.dungeon.tags[nb] !== 0) continue; const x = Math.abs(frameOf(nb)[0]); if (x > bx) { bx = x; best = nb; } }
    return best;
  })();
  const fodderCell = walkOut(layout.kit.fodderSteps ?? 6);
  // the mount stands off the cell centre toward the lane, so the barrels look over the edge rather than into their own rock
  const edge = layout.kit.rotorEdge ?? 0, socketPos = (ci, toward) => { const c = planet.graph.centers[ci], t = planet.graph.centers[toward]; const v = c.map((x, k) => x + (t[k] - x) * edge), l = Math.hypot(...v); return v.map((x) => x / l); };
  const sockets = wallCell >= 0 ? [{ cell: wallCell, toward: rotorLane, pos: socketPos(wallCell, rotorLane) }] : [];
  const anchored = layout.islands.map((i) => (i.anchor === 'forward' && forwardCell >= 0 ? { ...i, x: frameOf(forwardCell)[0], z: frameOf(forwardCell)[1] } : i));
  const islands = anchored.filter((i) => i.stage <= stage).map((i) => ({
    ...i, top: 0, sag: drop(Math.hypot(i.w, i.d) / 2, radius), heading: [0, 1], cell: i.anchor === 'forward' && forwardCell >= 0 ? forwardCell : nearestCell(i.x, i.z),
  }));
  // every island's lattice cell, whether or not its slab is placed yet: the beats need them from the landing on
  const cells = Object.fromEntries(anchored.map((i) => [i.id, i.anchor === 'forward' && forwardCell >= 0 ? forwardCell : nearestCell(i.x, i.z)]));
  const islandById = new Map(anchored.map((i) => [i.id, i]));
  // a field prop snaps to the nearest open cell to its frame point, anywhere on the planet outside the clearing
  const nearestOpen = (x, z) => { const w = planet.frameToWorld([x, 0, z]); let best = -1, bd = Infinity; for (let ci = 0; ci < planet.graph.centers.length; ci++) { if (planet.dungeon.tags[ci] === 0 || planet.clearing.cells.has(ci)) continue; const c = planet.graph.centers[ci]; const d = (c[0] * radius - w[0]) ** 2 + (c[1] * radius - radius - w[1]) ** 2 + (c[2] * radius - w[2]) ** 2; if (d < bd) { bd = d; best = ci; } } return best; };
  const structures = layout.structures.filter((s) => s.stage <= stage).map((s) => {
    if (s.anchor === 'open') { const ci = nearestOpen(s.x, s.z); const [x, z] = frameOf(ci); return { ...s, x, z, y: 0, heading: s.heading ?? [0, 1], cell: ci }; }
    if (s.anchor === 'wall' && wallCell >= 0) { const p = sockets[0].pos, f = planet.worldToFrame([p[0] * radius, p[1] * radius - radius, p[2] * radius]); return { ...s, x: f[0], z: f[2], y: layout.kit.wallMetres ?? 4, heading: [0, 1], cell: wallCell }; }
    const i = islandById.get(s.island);
    // a hair above the slab so coplanar floors do not z-fight; the rocket stands on natural ground
    return { ...s, x: i.x, z: i.z, y: s.stage >= i.stage ? 0.06 : 0, heading: s.heading ?? [0, 1] };
  });
  cells.forward = forwardCell; cells.rotor = wallCell; cells.rotorLane = rotorLane; cells.fodder = fodderCell;
  // THE BERTHS: each bay's centre along the container model's X, its doors along the structure heading, and
  // the straight run a hull drives out of them. Unit-sphere points, so the game can start a hull in the bay
  // itself rather than at the nearest lattice centre, with the lattice cells carried for the board's bookkeeping.
  const unit = (f) => { const w = planet.frameToWorld(f); const v = [w[0] / radius, (w[1] + radius) / radius, w[2] / radius]; const l = Math.hypot(...v); return v.map((c) => c / l); };
  const roll = (layout.kit.bay?.roll ?? 2) * (planet.cellMetres ?? 10);
  const bays = structures.filter((s) => s.bays).flatMap((s) => s.bays.map((b) => {
    const [hx, hz] = s.heading, lx = b.x * s.scale, x = s.x + hz * lx, z = s.z - hx * lx;   // right of the heading is [hz, -hx]
    const run = b.rollout ? (layout.kit.bay?.rollOutMetres ?? 19) * s.scale : roll;   // an authored roll-out ends where its clip ends
    const pos = unit([x, 0, z]), out = unit([x + hx * run, 0, z + hz * run]);
    return { ...b, x, z, heading: s.heading, cell: nearestCell(x, z), exit: nearestCell(x + hx * run, z + hz * run), pos, out };
  })).sort((a, b) => a.n - b.n);
  let gate = null, walls = [];
  if (stage >= layout.kit.stage && planet.clearing.openMouth) {
    const m = planet.clearing.openMouth;
    const c = m.cells.map((ci) => planet.graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]).map((v) => v / m.cells.length);
    const f = planet.worldToFrame([c[0] * radius, c[1] * radius - radius, c[2] * radius]);
    const r = Math.hypot(f[0], f[2]), phi0 = Math.atan2(f[0], -f[2]);
    const at = (rr, phi) => [rr * Math.sin(phi), -rr * Math.cos(phi)];
    const inward = (phi) => [-Math.sin(phi), Math.cos(phi)];
    // nearest lattice cells: walls block them for everyone, the gate cell stays open and the gate itself decides
    const cellAt = (x, z) => { const w = planet.frameToWorld([x, 0, z]); let best = -1, bd = Infinity; for (const ci of candidates) { const c = planet.graph.centers[ci]; const d = (c[0] * radius - w[0]) ** 2 + (c[1] * radius - radius - w[1]) ** 2 + (c[2] * radius - w[2]) ** 2; if (d < bd) { bd = d; best = ci; } } return best; };
    const candidates = [...planet.clearing.cells, ...m.cells];
    gate = { x: f[0], z: f[2], y: 0, heading: inward(phi0), cell: cellAt(f[0], f[2]), openRadius: 22 };
    const rw = r - layout.kit.wallInset;
    for (let side = -1; side <= 1; side += 2) for (let k = 0; k < layout.kit.wallsPerSide; k++) {
      const arc = layout.kit.gatePlot[0] / 2 + layout.kit.wallLength * (k + 0.5) + 0.5;
      const phi = phi0 + side * arc / rw;
      const [x, z] = at(rw, phi);
      walls.push({ x, z, y: 0, heading: inward(phi), cell: cellAt(x, z) });
    }
    // a wall whose nearest cell is the gate's cell is dressing on the gate cell, not a block
    for (const w of walls) if (w.cell === gate.cell) w.cell = -1;
  }
  return { stage, islands, structures, walls, gate, cells, bays, sockets };
}
