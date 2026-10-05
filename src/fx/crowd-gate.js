// THE CROWD GATE (src/domain/crowd-cap.js): the spawn queue's door. Each frame it times the real frame and counts the bodies up (a
// site's guards are not the crowd); a queued body waits while the field holds the cap, and rises as the field thins. Guards never wait
import { makeCrowdCap, stepCrowdCap } from '../domain/crowd-cap.js';
import { CROWD_CAP } from '../content/sectors.js';

export const crowdTrace = { cap: null, alive: 0, ema: null, held: 0 };   // the acceptance probe's view (scripts/browser-test.mjs --crowd-probe)
export function createCrowdGate(tune = CROWD_CAP, now = () => performance.now()) {
  const c = makeCrowdCap(tune);
  let last = null, alive = 0;
  return {
    // `timed`: a real frame (the zero-step calls between frames only recount)
    frame(enemies, timed) {
      alive = 0; for (const e of enemies) if (e.alive && !e.guard) alive++;
      if (timed) { const t = now(); if (last != null) stepCrowdCap(c, t - last, alive); last = t; }
      crowdTrace.cap = c.cap; crowdTrace.alive = alive; crowdTrace.ema = c.ema;
    },
    // whether this queued body must wait; one let through is counted at once
    full(entry) { if (entry.guard) return false; if (alive >= c.cap) { crowdTrace.held++; return true; } alive++; return false; },
  };
}
