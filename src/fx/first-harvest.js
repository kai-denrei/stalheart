// THE FIRST HARVEST (owner, 2026-11-10: "test dispatching the industrial rover to gather the biomass"; spec
// docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 1 beat 10, 2.D): on the dog's opening the depot prints at the beats' `harvest`
// (src/content/base-programme.js OPENING_PROGRAMME). The first wave fell before it stood, so its kills paid the bank at once and left nothing on the
// ground: once the rover is live, DOG_SCOUT.harvest.kg of the bodies are laid in `piles` piles on the open ground just outside the gate, and Isao's
// flare goes on them (the rover's own order, src/fx/rover-glue.js); the harvest is done when the rover has brought its first load home.
//   host: rover() (the glue's state: built, scene, trips), lay(cell, kg), flareAt(cell), story() (gateCell, inside(ci)), graph(), dungeon()
//   createFirstHarvest(host) -> { ready(), flare(), done(), state() }   (the beats' api.harvest(), src/domain/story-beats.js)
import { DOG_SCOUT } from '../content/dog-scout.js';
import { BLOCKED } from '../dungeon.js';

export function createFirstHarvest(h) {
  let flared = null, trips0 = 0;
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
  return {
    ready: () => { const r = h.rover(); return !!r?.built && r.scene?.ready !== false; },
    flare() {
      if (flared) return true;
      const H = DOG_SCOUT.harvest, cells = outside(H.piles); if (!cells.length) return false;
      for (const ci of cells) h.lay(ci, H.kg / cells.length);
      trips0 = h.rover()?.trips ?? 0; flared = { cell: cells[0], cells, kg: H.kg };
      h.flareAt(cells[0]);
      return true;
    },
    done: () => !!flared && (h.rover()?.trips ?? 0) > trips0,
    state: () => ({ flared, trips: h.rover()?.trips ?? null }),
  };
}
