// The gunship as rules: an orbit the player cannot touch, a mount that is
// only offered while the platform is overhead, gun cadence under the game
// clock, the aim ray onto the sphere, splash falloff, and the danger report
// that never blocks a shot. No DOM, no Three.js. The 105 is not here: it is
// src/strike.js, called by the host.
// Configuration is explicit: `orbit` is src/content/gunship.js GUNSHIP_ORBIT
// ({ pass, station } seconds) and `guns` its GUNSHIP_GUNS; the domain layer
// never imports content.

export function makeGunship(orbit, { station = false } = {}) {
  return {
    phase: station ? 'station' : 'pass',   // pass: counting down to the overhead pass; station: overhead
    left: station ? orbit.station : orbit.pass,
    mounted: false,
    gun: 'rotary',
    accum: 0,          // fractional rounds owed by the cadence
    passes: 0,         // overhead passes so far
  };
}

// The only clock mutator. Returns 'arrive' on the frame the station phase
// opens, 'depart' on the frame it closes; nothing else moves the schedule.
export function stepGunship(st, dt, orbit) {
  if (!(dt > 0)) return null;
  st.left -= dt;
  if (st.left > 0) return null;
  const over = -st.left;
  if (st.phase === 'pass') { st.phase = 'station'; st.left = Math.max(1e-6, orbit.station - over); st.passes++; return 'arrive'; }
  st.phase = 'pass'; st.left = Math.max(1e-6, orbit.pass - over); st.mounted = false; st.accum = 0;
  return 'depart';
}

export const onStation = (st) => st.phase === 'station';
export const phaseLeft = (st) => Math.max(0, st.left);
// 0..1 across the station phase while overhead; 0 otherwise. The platform's ground
// track is a function of this and nothing else.
export function passProgress(st, orbit) {
  if (st.phase !== 'station') return 0;
  return Math.min(1, Math.max(0, 1 - st.left / Math.max(1e-6, orbit.station)));
}

// The seat is offered only while the platform is overhead. Departure
// (stepGunship) takes it back; nothing else does.
export function mountGunship(st) {
  if (st.phase !== 'station') return 'refused';
  st.mounted = true; st.accum = 0;
  return 'mounted';
}
export function dismountGunship(st) { st.mounted = false; st.accum = 0; }

export function selectGun(st, key, guns) {
  if (!guns[key]) return false;
  st.gun = key; st.accum = 0;
  return true;
}

// Rounds owed this tick. A fractional rate accumulates; releasing the
// trigger forfeits the fraction so a tap cannot bank a burst.
export function stepGun(st, dt, held, guns) {
  const gun = guns[st.gun];
  if (!held || !st.mounted || st.phase !== 'station' || !gun || !(gun.rate > 0) || !(dt > 0)) { st.accum = 0; return 0; }
  st.accum += gun.rate * dt;
  const n = Math.floor(st.accum);
  st.accum -= n;
  return n;
}

// Where a ray from the platform meets the planet: the nearer root of
// |eye + t·dir| = r, or null when it looks past the world.
export function aimOnSphere(eye, dir, r = 1) {
  const b = 2 * (eye[0] * dir[0] + eye[1] * dir[1] + eye[2] * dir[2]);
  const c = eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2] - r * r;
  const disc = b * b - 4 * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / 2;
  if (t <= 0) return null;
  return [eye[0] + dir[0] * t, eye[1] + dir[1] * t, eye[2] + dir[2] * t];
}

// The strike's fat-middle falloff, 1 - (d/r)^2: it holds 75% at half radius
// and reaches zero exactly at the ring, so what stands inside the ring is hit.
export function splashDamage(dist, radius, dmg) {
  if (dist >= radius || radius <= 0) return 0;
  const u = dist / radius;
  return dmg * (1 - u * u);
}

// The readout. Bodies are { kind: 'wall'|'tower'|'tank'|'isao', pos }; the
// report says what stands inside the ring and nothing more. It has no verb
// on purpose: collateral is the player's to see, never the module's to refuse.
export function dangerReport(point, radius, bodies) {
  const inside = [];
  for (const b of bodies) {
    const dx = b.pos[0] - point[0], dy = b.pos[1] - point[1], dz = b.pos[2] - point[2];
    if (dx * dx + dy * dy + dz * dz < radius * radius) inside.push(b);
  }
  return {
    walls: inside.filter((b) => b.kind === 'wall').length,
    towers: inside.filter((b) => b.kind === 'tower').length,
    tank: inside.some((b) => b.kind === 'tank'),
    isao: inside.some((b) => b.kind === 'isao'),
    inside,
  };
}
