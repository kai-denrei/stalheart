// THE GUNSHIP IS CALLED, NOT SCHEDULED (owner, 2026-09-14): after the handover a meter fills from the biomass kills
// earn (streak included) and from each cleared wave; when it is full the player calls the pass at the moment they
// choose; the meter restarts empty when the pass leaves. Refunds and grants never reach it. Pure.
export function makeGunshipCall(cfg) {
  return { fill: 0, threshold: cfg.firstThreshold, calls: 0, overhead: false };
}

export function fillFromKill(st, biomass, cfg) {
  if (st.overhead || !(biomass > 0)) return st.fill;
  st.fill = Math.min(st.threshold, st.fill + biomass * cfg.perBiomass);
  return st.fill;
}

export function fillFromWaveClear(st, cfg) {
  if (st.overhead) return st.fill;
  st.fill = Math.min(st.threshold, st.fill + cfg.perWaveClear);
  return st.fill;
}

export const isFull = (st) => !st.overhead && st.fill >= st.threshold;

export function callGunship(st) {
  if (!isFull(st)) return false;
  st.overhead = true; st.calls++;
  return true;
}

export function passEnded(st, cfg) {
  if (!st.overhead) return false;
  st.overhead = false; st.fill = 0; st.threshold = cfg.threshold;
  return true;
}

export const callProgress = (st) => (st.overhead ? 1 : Math.min(1, st.fill / st.threshold));
