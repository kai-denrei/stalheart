// THE FIRST HARVEST (owner, 2026-11-10: "test dispatching the industrial rover to gather the biomass"; spec
// docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 1 beat 10, 2.D): on the dog's opening the depot prints at the beats' `harvest`
// (src/content/base-programme.js OPENING_PROGRAMME). Once the rover is live Isao's flare goes on the richest ground (the rover's own order,
// src/fx/rover-glue.js); the harvest is done when the rover is home from that first run (a load poured, or back with nothing).
// THE FIRST WAVE'S OWN BODIES (the economy design 2.6, 2026-11-12: kills lie on the ground from the story's first kill, so the first harvest is the
// Rotor fight's bodies, what the seepage left of them): the flare on the field's richest ground. Only when the wave left nothing (the field bare)
// are DOG_SCOUT.harvest.kg laid in `piles` piles on the open ground just outside the gate first (the fallback of the seeded harvest it replaced).
//   host: rover() (the glue's state: built, scene, trips, field, events), lay(cell, kg), flareAt(cell), richest() ({ cell, kg } | null), story()
//   (gateCell, inside(ci)), graph(), dungeon()
//   createFirstHarvest(host) -> { ready(), flare(), done(), state() }   (the beats' api.harvest(), src/domain/story-beats.js)
import { DOG_SCOUT } from '../content/dog-scout.js';
import { BLOCKED } from '../dungeon.js';

export function createFirstHarvest(h) {
  let flared = null, trips0 = 0, seen0 = 0;
  // the open cells just outside the gate, nearest first (a walk out of the gate's cell over open ground off the clearing)
  function outside(n) {
    const st = h.story(), g = h.graph(), d = h.dungeon(), gate = st?.gateCell ?? -1; if (gate < 0) return [];
    const seen = new Set([gate]), out = []; let front = [gate];
    while (front.length && out.length < n) {
      const next = [];
      for (const ci of front) for (const nb of g.adj[ci]) if (!seen.has(nb) && d.tags[nb] !== BLOCKED && !st.inside?.(nb)) { seen.add(nb); next.push(nb); out.push(nb); }
      front = next;
    }
    return out.slice(0, n);
  }
  // the rover's events since the flare: it is home from the first run when it poured a load or parked empty
  const back = () => (h.rover()?.events ?? []).filter((e) => e.t > seen0 && (e.ev === 'unloaded' || e.ev === 'parked')).length > 0;
  return {
    ready: () => { const r = h.rover(); return !!r?.built && r.scene?.ready !== false; },
    flare() {
      if (flared) return true;
      const r = h.rover(), rich = h.richest?.() ?? null;
      seen0 = (r?.events ?? []).at(-1)?.t ?? -1; trips0 = r?.trips ?? 0;
      if (rich && rich.kg >= 1) { flared = { cell: rich.cell, kg: Math.round(rich.kg), ground: r?.field ?? null, seeded: false }; h.flareAt(rich.cell); return true; }
      const H = DOG_SCOUT.harvest, cells = outside(H.piles); if (!cells.length) return false;
      for (const ci of cells) h.lay(ci, H.kg / cells.length);
      flared = { cell: cells[0], cells, kg: H.kg, ground: 0, seeded: true };
      h.flareAt(cells[0]);
      return true;
    },
    done: () => !!flared && ((h.rover()?.trips ?? 0) > trips0 || back()),
    state: () => ({ flared, trips: h.rover()?.trips ?? null }),
  };
}
