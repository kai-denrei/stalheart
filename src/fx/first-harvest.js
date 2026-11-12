// THE FIRST HARVEST (owner, 2026-11-10: "test dispatching the industrial rover to gather the biomass"; spec
// docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md 1 beat 10, 2.D): on the dog's opening the depot prints at the beats' `harvest`
// (src/content/base-programme.js OPENING_PROGRAMME). Once the rover is live Isao's flare goes on the richest ground (the rover's own order,
// src/fx/rover-glue.js); the harvest is done when the rover is home from that first run (a load poured, or back with nothing).
// THE FIRST WAVE'S OWN BODIES (the economy design 2.6, 2026-11-12: kills lie on the ground from the story's first kill, so the first harvest is the
// Rotor fight's bodies, what the seepage left of them): the flare on the field's richest ground. Only when the wave left nothing (the field bare)
// are DOG_SCOUT.harvest.kg laid in `piles` piles on the open ground just outside the gate first (the fallback of the seeded harvest it replaced).
//   host: rover() (the glue's state: built, scene, trips, field, events), lay(cell, kg), flareAt(cell), richest() ({ cell, kg } | null), story()
//   (gateCell, inside(ci)), graph(), dungeon()
// THE RUN WATCHED (flow fixes, 2026-11-13, docs/FLOW.md 3): with `watch` hands (camera, startShot, endShot, shotId, leaveSeat, metres, root) the flare lets the
// player out of the Rotor's seat into a live shot of the rover's run (DOG_SCOUT.harvest.watch), ended as the rover is home or by any key
//   createFirstHarvest(host) -> { ready(), flare(), done(), state() }   (the beats' api.harvest(), src/domain/story-beats.js)
import { DOG_SCOUT } from '../content/dog-scout.js';
import { BLOCKED } from '../dungeon.js';
import * as THREE from '../../vendor/three.module.js';
import { showOrder } from './order-callout.js';

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
  // the live shot of the rover's run: from beyond it (away from the base) and over it, looking at it; eased in from where the camera stands
  let watching = false;
  function watch() {
    const W = DOG_SCOUT.harvest.watch, w = h.watch, pt = () => h.rover()?.scene?.point ?? null;
    if (!W || !w || !pt() || w.shotId()) return false;
    const base = new THREE.Vector3(...h.graph().centers[h.dungeon().heart]), p = new THREE.Vector3(), up = new THREE.Vector3(), out = new THREE.Vector3(), at = new THREE.Vector3(), m4 = new THREE.Matrix4();
    w.leaveSeat();
    w.startShot({ id: 'roverWatch', dur: DOG_SCOUT.harvest.maxS, skippable: true, from: w.camera ? { pos: w.camera.position, quat: w.camera.quaternion } : null, easeIn: W.ease, poseAt(u, o) {
      const q = pt(); if (!q) return; p.set(q[0], q[1], q[2]); const r = p.length(); up.copy(p).normalize(); const m = w.metres() * r;
      out.copy(p).sub(base); out.addScaledVector(up, -out.dot(up)); if (out.lengthSq() < 1e-14) out.set(0, 0, 1).cross(up); out.normalize();
      o.pos.copy(p).addScaledVector(out, W.back * m).addScaledVector(up, W.up * m); at.copy(p).addScaledVector(up, W.lookUp * m);
      m4.lookAt(o.pos, at, up); o.quat.setFromRotationMatrix(m4);
    }, onEnd: () => { watching = false; } });
    if (w.shotId() !== 'roverWatch') return false;
    watching = true; showOrder(w.root, W.order, W.keys, 6000);
    return true;
  }
  const back = () => (h.rover()?.events ?? []).filter((e) => e.t > seen0 && (e.ev === 'unloaded' || e.ev === 'parked')).length > 0;
  return {
    ready: () => { const r = h.rover(); return !!r?.built && r.scene?.ready !== false; },
    flare() {
      if (flared) return true;
      const r = h.rover(), rich = h.richest?.() ?? null;
      seen0 = (r?.events ?? []).at(-1)?.t ?? -1; trips0 = r?.trips ?? 0;
      if (rich && rich.kg >= 1) { flared = { cell: rich.cell, kg: Math.round(rich.kg), ground: r?.field ?? null, seeded: false }; h.flareAt(rich.cell); flared.watched = watch(); return true; }
      const H = DOG_SCOUT.harvest, cells = outside(H.piles); if (!cells.length) return false;
      for (const ci of cells) h.lay(ci, H.kg / cells.length);
      flared = { cell: cells[0], cells, kg: H.kg, ground: 0, seeded: true };
      h.flareAt(cells[0]); flared.watched = watch();
      return true;
    },
    done: () => { const d = !!flared && ((h.rover()?.trips ?? 0) > trips0 || back()); if (d && watching && h.watch?.shotId() === 'roverWatch') { watching = false; h.watch.endShot(); } return d; },
    state: () => ({ flared, trips: h.rover()?.trips ?? null, watching }),
  };
}
