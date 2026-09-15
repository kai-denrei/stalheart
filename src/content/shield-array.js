// The array station: the solar complex's island is the tank's shield charging
// pad (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3).
// Rules in src/domain/shield.js (arrayDraw); first numbers, fun first.
export const SHIELD_ARRAY = Object.freeze({
  island: 'solar',     // the base-layout island that carries the pad
  radiusMetres: 12,    // the hull's centre within this arc of the island centre
  rate: 2,             // seconds of shield per second parked
  reserve: 30,         // seconds the array holds; refilled only by refillArrays (each sector start)
  maxSpeed: 3,         // metres per second; any faster and the pad does not take
  lift: 1.5,           // metres the ring floats above the ground (presentation)
  ring: Object.freeze({ size: 4, rings: Object.freeze([1, 0.93]) }),
  cues: Object.freeze({ start: 'tank_spool_up', charge: 'tank_pickup', dry: 'tank_spool_down' }),
});
