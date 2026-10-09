// temperament.js — the boss lab's temperament in the bait mode (wave B, 2026-10-09; owner: "chase speed we need basic speed and a measure of sudden
// accelerations once in a while, the threatening look comes from the tentacles lengthening/reaching, and from sudden bursts of speed"). The rule is
// src/domain/boss-temperament.js; this file is the one layer that writes the creature's live motion settings while it is on: each frame, before the
// creature's update, it steps the schedule with the fear's running flight (./fear.js `step`) and writes the blend of the BASE (`base()`, the panel's
// motion knobs, which stay the owner's) with the lunge and the flight into the kit's settings, within the kit's panel ranges. A due lunge waits for the
// kit's pursuit to be in its pull, where the chase speed moves the body. Off (the tank mode), it writes nothing; turned off it puts the base back once.
import { makeTemperament, stepTemperament, liveMotion, TEMPERAMENT_KEYS } from '../../domain/boss-temperament.js';
import { MOTION_CONTROLS } from '../../fx/nih-dairia/motion-settings.js';

const LIMITS = Object.fromEntries(MOTION_CONTROLS.map((c) => [c.key, [c.min, c.max]]));

// `tune()` the fight's live numbers (`.temperament`), `kit()` the creature (or null), `base()` the mode's working motion, `on()` whether the layer runs
export function createTemperament({ tune, kit, base, on }) {
  let s = makeTemperament(tune(), 1), live = null, wrote = false;
  const write = (values) => { const k = kit(); if (k) for (const key of TEMPERAMENT_KEYS) k.settings[key] = values[key]; };
  return {
    // each frame before the creature's update; `flight` the fear's running flight or null
    step(dt, flight = null) {
      const k = kit();
      if (!k) return;
      if (!on()) { if (wrote) { write(base()); wrote = false; live = null; } return; }
      stepTemperament(s, dt, tune(), { flight, ready: k.motion.pursuit?.phase === 'pull' });
      live = liveMotion(base(), s, tune(), LIMITS);
      write(live); wrote = true;
    },
    // a new round: the schedule from `seed`, the base written back
    reset(seed = 1) { s = makeTemperament(tune(), seed); if (wrote) write(base()); live = null; },
    // the handle's: the phase ('base' | 'lunge' | 'easing' | the flight's level), the lunges so far, the weights and the live settings written
    state: () => ({ phase: s.phase, lunges: s.lunges, lunge: !!s.lunge, next: s.next - s.t, weights: { lunge: s.wl, fear: s.wf }, live: live ? { ...live } : null }),
  };
}
