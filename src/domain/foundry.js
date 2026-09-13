// The foundry's clock. Deployed once, it runs the arm's cycle over each
// remaining section of the rocket and says, as events, what the host should
// show: the cutter arc, the section taken, the barrel filled, and the end.
// Configuration is explicit (src/content/foundry.js FOUNDRY_TUNE); no
// Three.js, no DOM, no content import.
export function makeFoundry(cfg) {
  return { phase: 'stowed', t: 0, cycleAt: -1, cycle: 0, sections: [...cfg.sections], barrels: 0, fired: new Set() };
}

// The only way in. Returns the deploy event for the host.
export function deployFoundry(st) {
  if (st.phase !== 'stowed') return null;
  st.phase = 'deploying'; st.t = 0;
  return 'deploy';
}

// Advance; returns the events of this tick in order. A cycle's cues fire
// once each; a cycle ends at its authored length; the next starts
// cycleSeconds after the previous began while sections remain.
export function stepFoundry(st, dt, cfg) {
  const out = [];
  if (!(dt > 0) || st.phase === 'stowed' || st.phase === 'spent') return out;
  st.t += dt;
  if (st.phase === 'deploying') {
    if (st.t >= cfg.deployDelay) startCycle(st, out);
    return out;
  }
  if (st.phase === 'cycling') {
    const u = st.t - st.cycleAt, section = st.sections[0];
    for (const [name, at, ev] of [['arcOn', cfg.events.arcOn, 'arc-on'], ['arcOff', cfg.events.arcOff, 'arc-off'], ['scrap', cfg.events.scrap, 'scrap'], ['barrel', cfg.events.barrel, 'barrel']]) {
      if (u >= at && !st.fired.has(name)) { st.fired.add(name); out.push(ev === 'scrap' ? { ev, section, index: st.cycle } : ev === 'arc-on' ? { ev, index: st.cycle } : ev); }
    }
    if (u >= cfg.firstCycle) {
      st.barrels++; st.sections.shift(); st.cycle++;
      if (st.sections.length) st.phase = 'waiting'; else { st.phase = 'spent'; out.push('spent'); }
    }
    return out;
  }
  if (st.phase === 'waiting' && st.t - st.cycleAt >= cfg.cycleSeconds) startCycle(st, out);
  return out;
}

function startCycle(st, out) { st.phase = 'cycling'; st.cycleAt = st.t; st.fired = new Set(); out.push('cycle'); }

export const foundryState = (st) => ({ phase: st.phase, barrels: st.barrels, sections: st.sections.length, cycle: st.cycle });
