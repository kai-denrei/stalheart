// THE ARMORY'S PAD (owner, 2026-10-01: "a spot for the tank to replenish its shells"). The solar array's charging pad is the model
// (src/fx/shield-array.js): a ring of dots on the ground at the island's centre, breathing while the armory stands, pulsing while the
// hull sits on it and the rack is short. Shells come one at a time at BASE_PERKS.armory.shellsPerSecond; until now they came only
// from triads on the ground. Presentation and the pad's own clock; the controller's rack is the host's to add to.
import { makePadRing, glowPadRing } from './shield-array.js';
import { metresToArc } from '../core/stage-units.js';

const arcBetween = (a, b) => { const l = Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]) || 1; return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / l))); };

// pos: the island centre on the unit sphere; cellSide: a 10 m cell in scene units; tune: BASE_PERKS.armory
export function createArmoryPad(scene, { pos, cellSide, tune }) {
  const reach = metresToArc(tune.radiusMetres, cellSide);
  const ring = makePadRing(pos, reach, 1 + metresToArc(tune.lift ?? 0.6, cellSide), { color: 0xffc24a, rings: [1, 0.55] });
  ring.visible = false; scene.add(ring);
  let fill = 0, standing = false, near = false;
  return {
    stand(on) { standing = !!on; },
    // dt seconds; tankPos on the unit sphere (or null); ammo and max the rack: returns the shells to add this tick (0 or more)
    tick(dt, tankPos, ammo, max, time) {
      near = standing && !!tankPos && arcBetween(tankPos, pos) < reach;
      const short = ammo < max;
      glowPadRing(ring, standing ? (near && short ? 'charging' : 'idle') : null, time);
      if (!near || !short) { fill = 0; return 0; }
      fill += dt * tune.shellsPerSecond;
      const n = Math.floor(fill); fill -= n;
      return Math.min(n, max - ammo);
    },
    state: () => ({ standing, near, visible: ring.visible }),
    dispose() { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); },
  };
}
