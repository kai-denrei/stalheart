// THE WAVE CLOCK (moved out of src/td-tab.js, refactor round 2, 2026-10-13): six controller lets (waveIn, waveCharge, warnBeat,
// interClock, waveAge, waveActive) as one state, each transition a statement the frame used to make inline, called by the frame
// in its own order. The frame still interleaves them with spawnWave() (which writes the state through the enemy-step host's
// setters in the same frame, so the active branch runs on the new state), the warn rings, the score and the sitrep.
//
// Pure: `warn` is the controller's WAVE_WARN (seconds of charge before the wave lands), passed in.
export function createWaveClock({ warn }) {
  const s = {
    // >= 0 means a wave is ARMED and counting down. Every route to spawnWave
    // goes through this, so a wave cannot arrive without its lead-in.
    in: -1,
    charge: 0,
    beat: 0,         // seconds until the next shock ring
    inter: 0,        // anticipation countdown between waves
    age: 0,          // seconds since the current wave spawned (safety cap)
    active: false,   // a wave's enemies are live/uncleared
  };
  return {
    state: () => ({ ...s }),
    // reads (the hosts' getters)
    in: () => s.in,
    charge: () => s.charge,
    inter: () => s.inter,
    age: () => s.age,
    active: () => s.active,
    // writes (the hosts' setters: enemy-step's armWave/spawnWave/reset, expandRound, the acceptance adapter), returning the value
    setIn: (v) => (s.in = v),
    setCharge: (v) => (s.charge = v),
    setBeat: (v) => (s.beat = v),
    setInter: (v) => (s.inter = v),
    setAge: (v) => (s.age = v),
    setActive: (v) => (s.active = v),
    // the frame's armed branch: count down, fill the charge; true when a shock ring is due this frame
    countdown(dt) {
      s.in -= dt;
      s.charge = Math.max(0, Math.min(1, 1 - s.in / warn));
      s.beat -= dt;
      if (s.beat <= 0) {
        // beats accelerate from ~0.7s apart to ~0.18s: the cadence IS the countdown, and it is legible without reading anything
        s.beat = 0.72 - 0.54 * s.charge;
        return true;
      }
      return false;
    },
    due: () => s.in <= 0,          // the countdown reached zero: the frame disarms and spawns
    disarm: () => { s.in = -1; },
    // the active branch
    grow: (dt) => { s.age += dt; },
    clear: () => { s.active = false; s.inter = 0; s.charge = 0; },   // the field is cleared (expandRound does the first two itself)
    stalled: (cap) => s.age >= cap,
    // between waves: arm early enough that the countdown consumes the last `warn` of the gap
    wait: (dt) => { s.inter += dt; },
    readyToArm: (gap) => s.inter >= gap - warn,
    idle: () => { s.charge = 0; },
    // HOW LONG UNTIL THE NEXT WAVE (the controller's secsToWave): Infinity while one is running, the countdown while armed,
    // Infinity again while the board has no live gate (`alive()`, asked only then), else what is left of the gap
    secsToWave: (gap, alive) => (s.active ? Infinity : s.in >= 0 ? s.in : !alive() ? Infinity : gap - s.inter),
  };
}
