// Simulation time advances only when the caller advances motion. Wall-clock
// scheduling belongs to an adapter; generation invalidates work from old runs.
export function createRunContext() {
  let generation = 0, time = 0, disposed = false;
  function assertLive() {
    if (disposed) throw new Error('Run context is disposed');
  }
  return Object.freeze({
    get generation() { return generation; },
    get time() { return time; },
    get disposed() { return disposed; },
    begin() { assertLive(); generation++; },
    resetClock() { assertLive(); time = 0; },
    advance(dt) {
      assertLive();
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Run delta must be finite and non-negative');
      time += dt;
    },
    guard(callback) {
      assertLive();
      const owner = generation;
      return (...args) => { if (!disposed && owner === generation) return callback(...args); };
    },
    dispose() { disposed = true; },
  });
}
