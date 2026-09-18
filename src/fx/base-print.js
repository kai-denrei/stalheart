// Isao's print of one step of the base (src/content/base-programme.js) on the story planet: the cell he flies to, the bed his print
// beam rasters (the step's plot at the rising print height) and the pieces rising with the print. Consumes the base plan, the story
// base's grow hands and the host's placer; no controller import. The host drives it from Isao's travel-and-print loop.
export function createBasePrint({ base, plan, placer }) {
  const islandOf = (id) => plan.islands.find((i) => i.id === id);
  const gates = plan.gates ?? (plan.gate ? [plan.gate] : []);
  const gateOf = (step) => (step.gate === true ? plan.gate : gates.find((g) => g.id === step.gate)) ?? null;   // a step's door: the front gate, or one named by id
  const at = { step: null, k: 0 };
  // the plot a step prints, in frame metres: centre, half extents across and along its heading, and the lattice cell at its centre.
  // The gate step's plot runs along the rim over the gate and both runs of walls.
  function plotOf(step) {
    // A STEP THAT WORKS A MACHINE THAT ALREADY STANDS (`over`, the AFR-01 seed foundry): the plot is the machine's own footprint on
    // the island it shares, not the island, so the beam rasters over the thing rather than the field around it. It prints nothing.
    if (step.over) {
      const s = plan.structures.find((x) => x.id === step.over); if (!s) return null;
      const [pw, pd] = step.plot ?? [4, 4];
      return { x: s.x, z: s.z, hw: pw, hd: pd, heading: s.heading ?? [0, 1], cell: islandOf(s.island)?.cell ?? plan.cells?.[s.island] ?? -1 };
    }
    // `gate: true` is the front door with its runs of walls; `gate: '<id>'` is any other door on the plan (the BACK GATE), whose
    // plot is the door's own footprint on the mouth it seals — there are no walls flanking it
    if (step.gate) {
      const g = gateOf(step); if (!g) return null;
      const [hx, hz] = g.heading;
      if (!step.walls) return { x: g.x, z: g.z, hw: (step.plot ?? [7, 4])[0], hd: (step.plot ?? [7, 4])[1], heading: g.heading, cell: g.cell };
      const across = Math.max(6, ...plan.walls.map((w) => Math.abs((w.x - g.x) * hz - (w.z - g.z) * hx) + 2));
      return { x: g.x, z: g.z, hw: across, hd: 4, heading: g.heading, cell: g.cell };
    }
    const i = islandOf(step.islands[0]) ?? plan.islands.find((x) => step.structures.includes(x.id));
    return i ? { x: i.x, z: i.z, hw: i.w / 2, hd: i.d / 2, heading: i.heading, cell: i.cell } : null;
  }
  const clamp = (v) => Math.max(0, Math.min(1, v));
  // the share of a step's time spent on its slabs (or on its gate) before its structures (or walls) rise
  const split = (step) => (step.gate ? (step.walls ? 0.35 : 1) : step.structures.length ? 0.3 : 1);   // a door with no walls behind it takes the whole print
  return {
    cellOf: (step) => plotOf(step)?.cell ?? -1,
    // (ox, oy) in -1..1 across and along the plot, k the print's progress: a host point on the plot at the height the print has reached
    bed(step) {
      const p = plotOf(step), h = step.metres ?? 4; if (!p) return null;
      const [hx, hz] = p.heading;   // right of the heading is [hz, -hx]
      // a print climbs as it lays; work on a machine that already stands holds at that machine's working height from the first frame
      const rise = step.over ? () => 1 : clamp;
      return (ox, oy, k) => { const a = ox * p.hw, b = oy * p.hd; return placer.toWorld([p.x + hz * a + hx * b, h * rise(k), p.z - hx * a + hz * b]).toArray(); };
    },
    // ISAO'S REPAIR IS A PRINT LIKE ANY OTHER (src/domain/repair-orders.js). Until now a repair order carried no bed, so he flew out
    // and rastered a generic cell-sized square on the dirt while the gate mended itself somewhere behind him. This is the `over:`
    // bed the AFR-01 beat uses, pointed at the piece being mended: the door's own footprint, or the segment's, at the rising print
    // height, so the beam is visibly working the thing. `tune` is BASE_REPAIR[kind] — its metres and its plot half extents.
    repairBed(repair, tune = {}) {
      const piece = repair?.kind === 'gate' ? (repair.id ? gates.find((g) => g.id === repair.id) : plan.gate) : plan.walls.find((w) => w.cell === repair?.ci);
      if (!piece) return null;
      const h = tune.metres ?? 4, [pw, pd] = tune.plot ?? [4, 4], [hx, hz] = piece.heading ?? plan.gate?.heading ?? [0, 1];
      return (ox, oy, k) => { const a = ox * pw, b = oy * pd; return placer.toWorld([piece.x + hz * a + hx * b, h * clamp(k), piece.z - hx * a + hz * b]).toArray(); };
    },
    progress(step, k) {
      at.step = step.id; at.k = k;
      const s = split(step), first = clamp(k / s), second = s < 1 ? clamp((k - s) / (1 - s)) : 1;
      for (const id of step.islands) base.growIsland(id, first);
      if (step.gate) base.growGate(Math.min(0.999, first), gateOf(step)?.id ?? null);   // built only when the whole step stands: its walls block the swarm too
      if (step.walls) { const n = plan.walls.length; plan.walls.forEach((w, i) => base.growWall(i, clamp(second * n - i))); }   // one after another
      if (k > 0) for (const id of step.structures) base.grow(id, second);
    },
    finish(step) {
      at.step = step.id; at.k = 1;
      for (const id of step.islands) base.growIsland(id, 1);
      for (const id of step.structures) base.grow(id, 1);
      if (step.walls) plan.walls.forEach((w, i) => base.growWall(i, 1));
      if (step.gate) base.growGate(1, gateOf(step)?.id ?? null);
    },
    state: () => ({ step: at.step, k: +at.k.toFixed(3) }),
  };
}
