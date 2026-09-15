// Isao's print of one step of the base (src/content/base-programme.js) on the story planet: the cell he flies to, the bed his print
// beam rasters (the step's plot at the rising print height) and the pieces rising with the print. Consumes the base plan, the story
// base's grow hands and the host's placer; no controller import. The host drives it from Isao's travel-and-print loop.
export function createBasePrint({ base, plan, placer }) {
  const islandOf = (id) => plan.islands.find((i) => i.id === id);
  const at = { step: null, k: 0 };
  // the plot a step prints, in frame metres: centre, half extents across and along its heading, and the lattice cell at its centre.
  // The gate step's plot runs along the rim over the gate and both runs of walls.
  function plotOf(step) {
    if (step.gate && plan.gate) {
      const g = plan.gate, [hx, hz] = g.heading;
      const across = Math.max(6, ...plan.walls.map((w) => Math.abs((w.x - g.x) * hz - (w.z - g.z) * hx) + 2));
      return { x: g.x, z: g.z, hw: across, hd: 4, heading: g.heading, cell: g.cell };
    }
    const i = islandOf(step.islands[0]) ?? plan.islands.find((x) => step.structures.includes(x.id));
    return i ? { x: i.x, z: i.z, hw: i.w / 2, hd: i.d / 2, heading: i.heading, cell: i.cell } : null;
  }
  const clamp = (v) => Math.max(0, Math.min(1, v));
  // the share of a step's time spent on its slabs (or on its gate) before its structures (or walls) rise
  const split = (step) => (step.gate ? 0.35 : step.structures.length ? 0.3 : 1);
  return {
    cellOf: (step) => plotOf(step)?.cell ?? -1,
    // (ox, oy) in -1..1 across and along the plot, k the print's progress: a host point on the plot at the height the print has reached
    bed(step) {
      const p = plotOf(step), h = step.metres ?? 4; if (!p) return null;
      const [hx, hz] = p.heading;   // right of the heading is [hz, -hx]
      return (ox, oy, k) => { const a = ox * p.hw, b = oy * p.hd; return placer.toWorld([p.x + hz * a + hx * b, h * clamp(k), p.z - hx * a + hz * b]).toArray(); };
    },
    progress(step, k) {
      at.step = step.id; at.k = k;
      const s = split(step), first = clamp(k / s), second = s < 1 ? clamp((k - s) / (1 - s)) : 1;
      for (const id of step.islands) base.growIsland(id, first);
      if (step.gate) base.growGate(Math.min(0.999, first));   // built only when the whole step stands: its walls block the swarm too
      if (step.walls) { const n = plan.walls.length; plan.walls.forEach((w, i) => base.growWall(i, clamp(second * n - i))); }   // one after another
      if (k > 0) for (const id of step.structures) base.grow(id, second);
    },
    finish(step) {
      at.step = step.id; at.k = 1;
      for (const id of step.islands) base.growIsland(id, 1);
      for (const id of step.structures) base.grow(id, 1);
      if (step.walls) plan.walls.forEach((w, i) => base.growWall(i, 1));
      if (step.gate) base.growGate(1);
    },
    state: () => ({ step: at.step, k: +at.k.toFixed(3) }),
  };
}
