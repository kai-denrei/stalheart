// THE LANDING'S FLIGHT MODEL (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md, section 3). Pure,
// fixed-step, deterministic: the same entry and input timeline give the same state. Ported from the owner's 2D game
// (Stalsfar_Landing/landing/lander.js flightStep, evaluateTouchdown, predictImpact) onto the arrival's metres: x and z along the
// ground, y up (the pad at 0), +z toward the pole; the tilt is about x, positive forward (+z); the rocket cannot hover at idle.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, u) => a + (b - a) * u;

// a small seeded generator (mulberry32 over a string hash), so a planet's entry is its own and repeatable
function rng(seed) {
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = (h >>> 0) || 1;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, [lo, hi]) => lerp(lo, hi, r());

// the problem the override hands over, from this planet's seed
export function seedEntry(seed, tune) {
  const r = rng(seed), e = tune.entry;
  return { altitude: pick(r, e.altitude), sink: pick(r, e.sink), drift: pick(r, e.drift) * (r() < 0.5 ? -1 : 1), tilt: pick(r, e.tilt) * (r() < 0.5 ? -1 : 1), fuelSeconds: pick(r, e.fuelSeconds), wind: e.wind };
}

export function createLanding(entry) {
  return { x: 0, y: entry.altitude, z: 0, vx: 0, vy: -entry.sink, vz: entry.drift, tilt: entry.tilt, tiltRate: 0, throttle: 0, set: 0, fuel: entry.fuelSeconds, legs: 0, legsDown: false, wind: entry.wind ?? 0, t: 0, phase: 'manual' };
}

// the state at the override, from the sequence's altitude and rate at that instant plus the entry's drift and tilt (spec 2.2)
export function overrideSeed(altitude, rate, entry) {
  return createLanding({ ...entry, altitude, sink: Math.max(0, -rate) });
}

// one fixed step. input: { throttle: the set point 0..1 (null keeps it), tiltRate: -1..1 (back..forward), legs: true asks for the legs }
export function step(s, input, dt, tune) {
  const v = tune.vehicle, g = tune.sim.gravity;
  if (input.throttle != null) s.set = clamp(input.throttle, 0, 1);
  s.throttle += clamp(s.set - s.throttle, -v.spool * dt, v.spool * dt);
  if (s.fuel <= 0) { s.throttle = 0; s.set = 0; }
  const lit = s.throttle > 0 ? Math.max(v.minThrottle, s.throttle) : 0;
  s.tiltRate += (clamp(input.tiltRate ?? 0, -1, 1) * v.torque - s.tiltRate * v.damping) * dt;
  s.tilt += s.tiltRate * dt;
  const drag = tune.sim.drag + (s.legs >= 1 ? 0.0009 : 0), T = v.thrust * lit;
  s.vz += (Math.sin(s.tilt) * T - drag * s.vz * Math.abs(s.vz)) * dt;
  s.vx += (s.wind - drag * s.vx * Math.abs(s.vx)) * dt;
  s.vy += (Math.cos(s.tilt) * T - g - drag * s.vy * Math.abs(s.vy)) * dt;
  s.fuel = Math.max(0, s.fuel - lit * dt);
  if (input.legs || s.legs > 0 || (s.y <= v.autoLegsAltitude)) s.legs = Math.min(1, s.legs + dt / v.legTime);
  s.legsDown = s.legs >= 1;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t += dt;
  return s;
}
