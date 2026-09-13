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
  // THE LONG SIGHTLINE (owner, 2026-09-13): a lane that wanders hides the sinkhole from the mounts, and the Quiver's lock means little
  // at twenty metres. When the kit asks for it, a straight lane is cut from the forward cell outward along the mouth's bearing, and the
  // ground opens at its far end; the cells within halfWidth of the line are opened like the ground under a landed rocket
  const sight = [];
  const fodderCell = (() => {
    const line = layout.kit.sightline; if (!line || forwardCell < 0) return walkOut(layout.kit.fodderSteps ?? 6);
    const [fx, fz] = frameOf(forwardCell), l = Math.hypot(fx, fz) || 1, ux = fx / l, uz = fz / l, cells = new Set();
    const cellW = planet.graph.centers.map((c) => [c[0] * radius, c[1] * radius - radius, c[2] * radius]);
    let end = -1;
    for (let d = 0; d <= line.metres + 1e-9; d += 3) {
      const w = planet.frameToWorld([fx + ux * d, 0, fz + uz * d]); let best = -1, bd = Infinity;
      for (let ci = 0; ci < cellW.length; ci++) {
        if (planet.clearing.cells.has(ci)) continue;
        const q = cellW[ci], e = (q[0] - w[0]) ** 2 + (q[1] - w[1]) ** 2 + (q[2] - w[2]) ** 2;
        if (e < line.halfWidth ** 2) cells.add(ci);
        if (e < bd) { bd = e; best = ci; }
      }
      if (best >= 0) { cells.add(best); end = best; }
    }
    sight.push(...cells);
    return end;
  })();
  // the mount stands off the cell centre toward the lane, so the barrels look over the edge rather than into their own rock
  const edge = layout.kit.rotorEdge ?? 0, socketPos = (ci, toward) => { const c = planet.graph.centers[ci], t = planet.graph.centers[toward]; const v = c.map((x, k) => x + (t[k] - x) * edge), l = Math.hypot(...v); return v.map((x) => x / l); };
  // the second socket, for the Quiver: the rock beside the lane cell `quiverSteps` out, on the Rotor's side (the rock across the lane
  // turned out to have no sightline to the gate pile), the farthest to that side that is not the Rotor's own cell
  const quiverLane = walkOut(layout.kit.quiverSteps ?? 1);
  const wallCell2 = (() => {
    if (quiverLane < 0 || wallCell < 0) return -1;
    const side = Math.sign(frameOf(wallCell)[0]) || 1; let best = -1, bx = -Infinity;
    for (const nb of planet.graph.adj[quiverLane]) { if (planet.dungeon.tags[nb] !== 0 || nb === wallCell) continue; const x = frameOf(nb)[0] * side; if (x > bx) { bx = x; best = nb; } }
    return best;
  })();
  const sockets = [[wallCell, rotorLane], [wallCell2, quiverLane]].filter(([c]) => c >= 0).map(([c, lane]) => ({ cell: c, toward: lane, pos: socketPos(c, lane) }));
  // THE QUIVER'S OWN LINE (owner, 2026-09-13: one wall still stood in the way). The mount stands beside the lane, so its line to the sinkhole
  // runs diagonally off the centre cut: measured, a rock cell at 44 m and another at 157 m hid everything past 59 m, which is also why the
  // lock only took once a body was close. A second cut runs from the Quiver's socket to the sinkhole; the mounts' own rock stays
  if (layout.kit.sightline && sockets[1] && fodderCell >= 0) {
    const a = sockets[1].pos, b = planet.graph.centers[fodderCell], keep = new Set([wallCell, wallCell2]), hw = layout.kit.sightline.halfWidth / radius, n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * radius / 3);
    for (let i = 2; i <= n; i++) { const t = i / n, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], l = Math.hypot(...q);
      for (let ci = 0; ci < planet.graph.centers.length; ci++) { if (keep.has(ci) || planet.clearing.cells.has(ci)) continue; const c = planet.graph.centers[ci]; if ((c[0] - q[0] / l) ** 2 + (c[1] - q[1] / l) ** 2 + (c[2] - q[2] / l) ** 2 < hw * hw) sight.push(ci); } }
  }
  // ...and the ROUTE, not just the cut (owner, 2026-09-13; measured twice): a body keeps to the shortest way from the sinkhole to the gate,
  // which may use lane cells beside the cut, and rock at the cut's edge can hide a stretch of it from a mount standing to one side. So:
  // walk that route, open every rock cell on a line from the Quiver to a cell of it, walk the route again (opening rock can shorten it), and
  // stop when a pass opens nothing. Bounded, and it only ever removes rock, so the gate, the sockets and the clearing are untouched
  if (layout.kit.sightline && sockets[1] && fodderCell >= 0 && forwardCell >= 0) {
    const a = sockets[1].pos, keep = new Set([wallCell, wallCell2]), C = planet.graph.centers, adj = planet.graph.adj, opened = new Set(sight);
    const passable = (ci) => planet.dungeon.tags[ci] !== 0 || opened.has(ci);
    const walk = (from, q) => { let ci = from, d = (C[ci][0] - q[0]) ** 2 + (C[ci][1] - q[1]) ** 2 + (C[ci][2] - q[2]) ** 2; for (let moved = true; moved;) { moved = false; for (const nb of adj[ci]) { const e = (C[nb][0] - q[0]) ** 2 + (C[nb][1] - q[1]) ** 2 + (C[nb][2] - q[2]) ** 2; if (e < d) { d = e; ci = nb; moved = true; } } } return ci; };
    const route = () => { const dist = new Map([[forwardCell, 0]]), q = [forwardCell]; for (let h = 0; h < q.length; h++) for (const nb of adj[q[h]]) if (!dist.has(nb) && passable(nb)) { dist.set(nb, dist.get(q[h]) + 1); q.push(nb); }
      const out = []; let cur = fodderCell; if (!dist.has(cur)) return out; while (cur !== forwardCell && out.length < 2000) { out.push(cur); let best = cur; for (const nb of adj[cur]) if (dist.has(nb) && dist.get(nb) < dist.get(best)) best = nb; if (best === cur) break; cur = best; } return out; };
    for (let pass = 0; pass < 8; pass++) {
      let added = 0;
      for (const target of route()) { const b = C[target], n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * radius / 3)); let at = wallCell2 >= 0 ? wallCell2 : forwardCell;
        for (let i = 1; i < n; i++) { const t = i / n, q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], l = Math.hypot(...q); at = walk(at, [q[0] / l, q[1] / l, q[2] / l]);
          if (!keep.has(at) && !opened.has(at) && !planet.clearing.cells.has(at) && planet.dungeon.tags[at] === 0) { opened.add(at); sight.push(at); added++; } } }
      if (!added) break;
    }
  }
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
  cells.forward = forwardCell; cells.rotor = wallCell; cells.quiver = wallCell2; cells.rotorLane = rotorLane; cells.fodder = fodderCell;
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
  // WHEREVER A ROCKET COMES DOWN, standing or broken, the ground under it is open: no rock through a hull (operator, 2026-09-13)
  const open = [...new Set([...sight, ...structures.filter((s) => s.anchor === 'open' && s.cell >= 0).flatMap((s) => { const c = planet.graph.centers[s.cell], reach = (s.clear ?? 0) / radius; return planet.graph.centers.flatMap((p, ci) => ci === s.cell || Math.acos(Math.max(-1, Math.min(1, (p[0] * c[0] + p[1] * c[1] + p[2] * c[2]) / (Math.hypot(...p) * Math.hypot(...c))))) < reach ? [ci] : []); })])];
  return { stage, islands, structures, walls, gate, cells, bays, sockets, open };
}
