// PIMP MY RIDE (owner, 2026-10-03: "just as we have Blue for Shield and Orange for replenishing tank shells, make the pressurized Rover
// Storage the 'Pimp My Ride' station, with a purple circle. Entering it and stopping brings up a modal to change the colors of the
// Mork"). A purple pad ring beside the bays (the solar array's and the armory's pads are the model, src/fx/shield-array.js),
// standing once the bays stand. The hull inside it and still for `settle` seconds opens the paint shop (src/fx/paint-shop.js); it opens
// again only after the hull has left the ring. Presentation and its own clock; the host opens the shop.
import { makePadRing, glowPadRing } from './shield-array.js';
import { metresToArc } from '../core/stage-units.js';

const arcBetween = (a, b) => { const l = Math.hypot(a[0], a[1], a[2]) * Math.hypot(b[0], b[1], b[2]) || 1; return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / l))); };

// pos: the pad's centre on the unit sphere; tune: BASE_PERKS.paint { radiusMetres, lift, settle, still }
export function createPaintPad(scene, { pos, cellSide, tune }) {
  const reach = metresToArc(tune.radiusMetres, cellSide), still = metresToArc(tune.still, cellSide);
  const ring = makePadRing(pos, reach, 1 + metresToArc(tune.lift ?? 0.6, cellSide), { color: 0xb46cff, rings: [1, 0.55] });
  ring.visible = false; scene.add(ring);
  let standing = false, near = false, armed = true, calm = 0, last = null;
  return {
    stand(on) { standing = !!on; },
    // dt seconds; tankPos on the unit sphere or null: true on the tick the shop should open
    tick(dt, tankPos, time) {
      near = standing && !!tankPos && arcBetween(tankPos, pos) < reach;
      const moved = last && tankPos ? arcBetween(last, tankPos) / Math.max(dt, 1e-3) : Infinity; last = tankPos ? tankPos.slice() : null;
      glowPadRing(ring, standing ? (near ? 'charging' : 'idle') : null, time);
      if (!near) { armed = true; calm = 0; return false; }
      calm = moved < still ? calm + dt : 0;
      if (armed && calm >= tune.settle) { armed = false; return true; }
      return false;
    },
    state: () => ({ standing, near, armed, visible: ring.visible, seen: !!last, metres: last ? +(arcBetween(last, pos) / reach * tune.radiusMetres).toFixed(1) : null }),
    dispose() { scene.remove(ring); ring.geometry.dispose(); ring.material.dispose(); },
  };
}
