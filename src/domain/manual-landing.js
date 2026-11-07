// THE LANDING'S FLIGHT MODEL (owner, 2026-11-07; spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md, section 3). Pure,
// fixed-step, deterministic: the same entry and input timeline give the same state. Ported from the owner's 2D game
// (Stalsfar_Landing/landing/lander.js flightStep, evaluateTouchdown, predictImpact) onto the arrival's metres: x and z along the
// ground, y up (the pad at 0), +z toward the pole; the tilt is about x, positive forward (+z); the rocket cannot hover at idle.
// 2026-11-07 (spec 10): a second axis, the bank, about z, positive toward +x, so WASD and a mouse stick can steer both ways; the thrust direction
// is d = (sin bank * cos tilt, cos bank * cos tilt, sin tilt) and the pose that puts the hull's up on it is Rz(-bank) * Rx(tilt).

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
  return { x: 0, y: entry.altitude, z: 0, vx: 0, vy: -entry.sink, vz: entry.drift, tilt: entry.tilt, tiltRate: 0, bank: 0, bankRate: 0, throttle: 0, set: 0, fuel: entry.fuelSeconds, legs: 0, legsDown: false, wind: entry.wind ?? 0, t: 0, phase: 'manual' };
}

// the state at the override, from the sequence's altitude and rate at that instant plus the entry's drift and tilt (spec 2.2)
export function overrideSeed(altitude, rate, entry) {
  return createLanding({ ...entry, altitude, sink: Math.max(0, -rate) });
}

// the total angle of the hull's up from vertical (the verdict's and the flare's tilt); reads the object it is given, so the host's
// { ...s, tilt: corrected against the local ground normal } still works
export const tiltTotal = (s) => Math.acos(clamp(Math.cos(s.bank ?? 0) * Math.cos(s.tilt), -1, 1));

// one fixed step. input: { throttle: the set point 0..1 (null keeps it), tiltRate: -1..1 (back..forward), bankRate: -1..1 (-x..+x), legs: true asks for the legs }
export function step(s, input, dt, tune) {
  const v = tune.vehicle, g = tune.sim.gravity;
  if (input.throttle != null) s.set = clamp(input.throttle, 0, 1);
  s.throttle += clamp(s.set - s.throttle, -v.spool * dt, v.spool * dt);
  if (s.fuel <= 0) { s.throttle = 0; s.set = 0; }
  const lit = s.throttle > 0 ? Math.max(v.minThrottle, s.throttle) : 0;
  s.tiltRate += (clamp(input.tiltRate ?? 0, -1, 1) * v.torque - s.tiltRate * v.damping) * dt;
  s.bankRate += (clamp(input.bankRate ?? 0, -1, 1) * v.torque - s.bankRate * v.damping) * dt;
  s.tilt += s.tiltRate * dt; s.bank += s.bankRate * dt;
  const drag = tune.sim.drag + (s.legs >= 1 ? v.legDrag : 0), T = v.thrust * lit, ct = Math.cos(s.tilt);
  s.vz += (Math.sin(s.tilt) * T - drag * s.vz * Math.abs(s.vz)) * dt;
  s.vx += (Math.sin(s.bank) * ct * T + s.wind - drag * s.vx * Math.abs(s.vx)) * dt;
  s.vy += (Math.cos(s.bank) * ct * T - g - drag * s.vy * Math.abs(s.vy)) * dt;
  s.fuel = Math.max(0, s.fuel - lit * dt);
  if (input.legs || s.legs > 0 || (s.y <= v.autoLegsAltitude)) s.legs = Math.min(1, s.legs + dt / v.legTime);
  s.legsDown = s.legs >= 1;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t += dt;
  return s;
}

// the height a full burn needs to stop the present sink: v² / 2(T − g), recomputed each frame (the brief; mass is not simulated)
export function hStop(s, tune) {
  const v = Math.max(0, -s.vy), a = tune.vehicle.thrust - tune.sim.gravity;
  return a > 0 ? v * v / (2 * a) : Infinity;
}

// where the rocket meets the ground if the throttle stays where it is: the reticle's centre and the ping's clock
export function predictImpact(s, tune, groundY = 0) {
  const p = { ...s }, dt = tune.hud.predictorDt, hold = { throttle: null, tiltRate: 0, bankRate: 0, legs: false };
  for (let t = 0; t < tune.hud.predictorSeconds; t += dt) {
    step(p, hold, dt, tune);
    if (p.y <= groundY) return { x: p.x, z: p.z, t: t + dt, reached: true };
  }
  return { x: p.x, z: p.z, t: tune.hud.predictorSeconds, reached: false };
}

export const touched = (s, groundY = 0) => s.y <= groundY;

// the grade at first contact (spec 3): the worst axis decides and names the reason; legs up, a slope or off the pad are wrecks
// (a CLEAN verdict still names the nearest axis: the one with the greatest value / hard limit)
export function verdict(s, slope, offPad, tune) {
  const sink = Math.max(0, -s.vy), drift = Math.hypot(s.vx, s.vz), tilt = tiltTotal(s), V = tune.verdict;
  const axes = [['sink', sink, V.clean.sink, V.hard.sink], ['drift', drift, V.clean.drift, V.hard.drift], ['tilt', tilt, V.clean.tilt, V.hard.tilt]];
  let worst = 0, reason = 'sink', ratio = -1;
  for (const [name, value, clean, hard] of axes) {
    const grade = value > hard ? 2 : value > clean ? 1 : 0, r = value / hard;
    if (grade > worst || (grade === worst && r > ratio)) { worst = grade; reason = name; ratio = r; }
  }
  if (!s.legsDown) { worst = 2; reason = 'legs'; }
  else if (Math.abs(slope) > V.slope) { worst = 2; reason = 'slope'; }
  else if (offPad) { worst = 2; reason = 'off-pad'; }
  return { grade: ['CLEAN', 'HARD', 'WRECK'][worst], reason, sink, drift, tilt };
}

// the auto-lander takes back under flare.altitude when the state is inside its corridor (spec 2.4)
export function flareDue(s, tune) {
  const f = tune.flare;
  return s.y <= f.altitude && -s.vy <= f.sink && Math.hypot(s.vx, s.vz) <= f.drift && tiltTotal(s) <= f.tilt;
}

// the auto-lander's step: the tilt, the bank and the drift eased out over flare.settle, the sink eased to sinkFinal, the legs down, no fuel spent
export function flareStep(s, dt, tune) {
  const f = tune.flare, k = Math.min(1, dt / f.settle * f.settleGain);
  s.tilt += (0 - s.tilt) * k; s.tiltRate = 0;
  s.bank += (0 - s.bank) * k; s.bankRate = 0;
  s.vx += (0 - s.vx) * k; s.vz += (0 - s.vz) * k;
  s.vy += (-f.sinkFinal - s.vy) * k;
  s.legs = Math.min(1, s.legs + dt / tune.vehicle.legTime); s.legsDown = s.legs >= 1;
  s.throttle = s.set = Math.min(1, tune.sim.gravity / tune.vehicle.thrust + f.plumeMargin);   // the plume at a hover's worth, for the picture
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.t += dt; s.phase = 'flare';
  return s;
}
