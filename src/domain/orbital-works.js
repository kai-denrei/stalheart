// THE ORBITAL WORKS' RULES (docs/superpowers/specs/2026-10-02-orbital-works-design.md). Pure. The host owns the launch beat and the
// ring; this says when the next collector goes up and what the ones in orbit are worth.
export const makeWorks = () => ({ collectors: 0, launching: false, lastSector: 0, routineAt: null, routines: 0 });

// a launch is due at the start of sector `sector` when the works are online (SOL-88 up, the launcher standing), the sector before it
// was secured, nothing is on the sled, and this sector has not had its launch
export function launchDue(st, { sector, online, secured, standing = true }) {
  if (!online || !standing || st.launching || !secured) return false;
  if (!(sector > st.lastSector)) return false;
  return true;
}
export function beginLaunch(st, sector) { st.launching = true; st.lastSector = sector; }
export function collectorUp(st) { st.launching = false; st.collectors++; return st.collectors; }

// A ROUTINE LAUNCH (owner, 2026-10-15, ORBITAL_WORKS.routine): with the works online and nothing on the sled, a plain satellite is due `first` s
// after the clock first finds the works online, then every `every` s (a span: r in [0, 1) draws within it); `st.routineAt` the clock of the next
export function routineDue(st, { t, online, standing = true, tune }) {
  if (!online || !standing || st.launching) return false;
  if (st.routineAt == null) { st.routineAt = t + tune.first; return false; }
  return t >= st.routineAt;
}
export function beginRoutine(st, t, tune, r = 0.5) { st.launching = true; st.routines++; st.routineAt = t + tune.every[0] + (tune.every[1] - tune.every[0]) * Math.min(1, Math.max(0, r)); }
export function routineUp(st) { st.launching = false; }

// seconds of beam the collectors add to a pass
export const energyBonus = (n, tune) => Math.min(tune.energyCap, Math.max(0, n) * tune.energyPerCollector);
