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
  const islands = layout.islands.filter((i) => i.stage <= stage).map((i) => ({
    ...i, top: 0, sag: drop(Math.hypot(i.w, i.d) / 2, radius), heading: [0, 1],
  }));
  const islandById = new Map(layout.islands.map((i) => [i.id, i]));
  const structures = layout.structures.filter((s) => s.stage <= stage).map((s) => {
    const i = islandById.get(s.island);
    return { ...s, x: i.x, z: i.z, y: 0, heading: [0, 1] };
  });
  let gate = null, walls = [];
  if (stage >= layout.kit.stage && planet.clearing.openMouth) {
    const m = planet.clearing.openMouth;
    const c = m.cells.map((ci) => planet.graph.centers[ci]).reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]).map((v) => v / m.cells.length);
    const f = planet.worldToFrame([c[0] * radius, c[1] * radius - radius, c[2] * radius]);
    const r = Math.hypot(f[0], f[2]), phi0 = Math.atan2(f[0], -f[2]);
    const at = (rr, phi) => [rr * Math.sin(phi), -rr * Math.cos(phi)];
    const inward = (phi) => [-Math.sin(phi), Math.cos(phi)];
    gate = { x: f[0], z: f[2], y: 0, heading: inward(phi0) };
    const rw = r - layout.kit.wallInset;
    for (let side = -1; side <= 1; side += 2) for (let k = 0; k < layout.kit.wallsPerSide; k++) {
      const arc = layout.kit.gatePlot[0] / 2 + layout.kit.wallLength * (k + 0.5) + 0.5;
      const phi = phi0 + side * arc / rw;
      const [x, z] = at(rw, phi);
      walls.push({ x, z, y: 0, heading: inward(phi) });
    }
  }
  return { stage, islands, structures, walls, gate };
}
