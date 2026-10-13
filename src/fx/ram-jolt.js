// THE TANK FEELS WHAT IT HITS (round two of the Pearl set, owner 2026-10-13: "the cutis getting rammed by the tank is not a satisfying animation, we need
// some sense of stagger on the enemy, and bump on the tank"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"). A short pitch of
// the hull (nose up, as it rides over the body), a small roll toward the side it was hit and a camera dip, each a damped spring kicked by a body under
// the treads (the ram) or against the hull (a cored body's touch, sharper), scaled by the body's size. A crowd must rumble, not shake: kicks closer than
// `gap` add only `merge` of themselves, a load each kick fills and that drains scales every kick down, and the pitch is clamped. The tune is
// src/content/pearl-enemies.js PEARL_IMPACT.jolt. Presentation only: the ram's speed dip (td-tab's bumpLeft) and every rule stay as they were.
//   kick({ radius, solid, side })   radius the body's (m), solid a cored body's touch, side -1..1 (left / right of the heading)
//   tick(dt)   hull(mesh)   dip(cellSide) -> the camera's extra drop (scene units, >= 0)   state()
import { PEARL_IMPACT } from '../content/pearl-enemies.js';

export function createRamJolt(tune = PEARL_IMPACT.jolt) {
  const k = (2 * Math.PI * tune.hz) ** 2, c = 2 * tune.damping * Math.sqrt(k);
  let pitch = 0, pv = 0, roll = 0, rv = 0, load = 0, since = Infinity, kicks = 0, peak = 0;
  return {
    kick({ radius = tune.refRadius, solid = false, side = 0 } = {}) {
      const room = Math.max(0, 1 - load / tune.loadCap), merged = since < tune.gap ? tune.merge : 1;
      const a = tune.pitch * (radius / tune.refRadius) * (solid ? tune.solid : 1) * room * merged;
      // a spring's velocity kick that peaks near `a` (the first swing of a lightly damped spring reaches about a/omega of it)
      pv += a * 2 * Math.PI * tune.hz; rv += a * tune.roll * Math.max(-1, Math.min(1, side)) * 2 * Math.PI * tune.hz;
      load += tune.load * merged; since = 0; kicks++;
    },
    tick(dt) {
      if (!(dt > 0)) return;
      since += dt; load = Math.max(0, load - tune.drain * dt);
      for (let n = Math.ceil(dt / (1 / 240)), h = dt / n; n > 0; n--) {   // semi-implicit Euler at 240 Hz: stable at any frame time
        pv += (-k * pitch - c * pv) * h; pitch += pv * h;
        rv += (-k * roll - c * rv) * h; roll += rv * h;
      }
      pitch = Math.max(-tune.maxPitch, Math.min(tune.maxPitch, pitch)); roll = Math.max(-tune.maxPitch, Math.min(tune.maxPitch, roll));
      peak = Math.max(peak, Math.abs(pitch));
    },
    // composed onto the hull after its lookAt (as the recoil's rock is): rotateX/Z compose, an Euler write would replace the facing
    hull(mesh) { if (pitch) mesh.rotateX(-pitch); if (roll) mesh.rotateZ(roll); },
    dip: (cellSide) => Math.max(0, pitch) * tune.dip * cellSide,
    state: () => ({ pitch: +pitch.toFixed(4), roll: +roll.toFixed(4), load: +load.toFixed(3), kicks, peak: +peak.toFixed(4) }),
  };
}
