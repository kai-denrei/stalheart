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
  const islands = layout.islands.filter((i) => i.stage <= stage).map((i) => ({
    ...i, top: 0, sag: drop(Math.hypot(i.w, i.d) / 2, radius), heading: [0, 1], cell: nearestCell(i.x, i.z),
  }));
  // every island's lattice cell, whether or not its slab is placed yet: the beats need them from the landing on
  const cells = Object.fromEntries(layout.islands.map((i) => [i.id, nearestCell(i.x, i.z)]));
  const islandById = new Map(layout.islands.map((i) => [i.id, i]));
  const structures = layout.structures.filter((s) => s.stage <= stage).map((s) => {
    const i = islandById.get(s.island);
    // a hair above the slab so coplanar floors do not z-fight; the rocket stands on natural ground
    return { ...s, x: i.x, z: i.z, y: s.stage >= i.stage ? 0.06 : 0, heading: [0, 1] };
  });
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
  return { stage, islands, structures, walls, gate, cells };
}
