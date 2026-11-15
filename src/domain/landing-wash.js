// THE LANDING WASH's rules (owner, 2026-11-15: "when the rocket lands, the thrusters touching the surface should create effects of smoke and
// particles flying ... like in the reference images of spacex boosters re-entry. perhaps we can re-use some of the nuclear strike effects after the
// explosion, just the smoke"). Pure: how hard the exhaust is washing the ground, where it meets it, how many puffs a frame. The picture is
// src/fx/landing-wash.js, the knobs src/content/story-defaults.js LANDING_WASH.

const clamp01 = (v) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const smooth01 = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };

// How hard the plume washes the ground, 0..1: nothing while its tips (`reach` metres under the feet) are off the ground, rising as the rocket sinks
// into it, full once the feet are `full` of the reach above the ground; times the engines' own `plume` (0..1, what the sheets are lit at)
export function washStrength({ plume = 0, altitude = Infinity, reach = 1, full = 0.3 } = {}) {
  if (!(plume > 0) || !(reach > 0) || altitude >= reach) return 0;
  const span = Math.max(1e-6, reach * (1 - full));
  return clamp01(plume) * smooth01((reach - Math.max(0, altitude)) / span);
}

// The planet's ground under (x, z), metres under the landing island's tangent plane (the same sphere as src/fx/arrival.js floorAt), `R` its radius in metres
export const sagAt = (x, z, R) => (R > 0 ? (x * x + z * z) / (2 * R) : 0);

// Where the exhaust meets the ground: down the hull's axis from its feet to the plane y = `ground` (island metres). A hull lying past
// `maxTilt` (cos of it, against straight up) meets nothing along its axis in reach: the point straight under the feet instead
export function groundHit(feet, axis, ground, maxTilt = 0.3) {
  const [fx, fy, fz] = feet, [ax, ay, az] = axis, drop = fy - ground;
  if (!(ay > maxTilt) || drop <= 0) return [fx, ground, fz];
  const t = drop / ay;
  return [fx - ax * t, ground, fz - az * t];
}

// Puffs due this frame at `rate` a second, the fraction carried to the next; `cap` at most in one frame (a long frame does not dump a cloud at once)
export function emitDue(carry, rate, dt, cap = 24) {
  const due = Math.max(0, carry) + Math.max(0, rate) * Math.max(0, dt);
  const n = Math.min(cap, Math.floor(due));
  return { n, carry: n === cap ? 0 : due - n };
}

// The cut at the ground: the engines were washing it (`was` over `min`) and are out now, with the feet within `near` metres of it (a touchdown,
// a wreck); not an engine cut high up (no ground to throw)
export const cutAtGround = ({ was = 0, now = 0, altitude = Infinity, min = 0.2, near = 4 } = {}) => was > min && now <= 0 && altitude <= near;
