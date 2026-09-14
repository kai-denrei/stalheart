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
    clock: 0,          // seconds of station time, the flight clock for rounds
    rounds: [],        // rounds in the air: { gun, point, at } arriving at `at` on the clock
    heat: 0, overheated: false,   // the rotary
    mag: -1, reloadUntil: 0,      // the Bofors: rounds left in the magazine (-1: full, not yet counted), reloading until
    heavyPaint: null, heavyReadyAt: 0, heavyFalling: null,   // the 105: the painted cell, when the next shell is ready, the shell in the air
  };
}

// The only clock mutator. Returns 'arrive' on the frame the station phase
// opens, 'depart' on the frame it closes; nothing else moves the schedule.
export function stepGunship(st, dt, orbit) {
  if (!(dt > 0)) return null;
  st.clock += dt;
  st.left -= dt;
  if (st.left > 0) return null;
  const over = -st.left;
  if (st.phase === 'pass') { st.phase = 'station'; st.left = Math.max(1e-6, orbit.station - over); st.passes++; return 'arrive'; }
  st.phase = 'pass'; st.left = Math.max(1e-6, orbit.pass - over); st.mounted = false; st.accum = 0;
  return 'depart';
}

// A round leaves now and lands where the gunner aimed, `travel` seconds later: what stands there THEN takes the hit,
// so a moving swarm has to be led. Rounds are dropped with the seat.
export function fireRound(st, gun, point, travel) { st.rounds.push({ gun, point: [point[0], point[1], point[2]], at: st.clock + travel, from: st.clock }); }
export function stepRounds(st) { const landed = []; st.rounds = st.rounds.filter((r) => { if (r.at <= st.clock) { landed.push(r); return false; } return true; }); return landed; }

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
export function dismountGunship(st) { st.mounted = false; st.accum = 0; st.rounds = []; st.heavyPaint = null; }

export function selectGun(st, key, guns) {
  if (!guns[key]) return false;
  st.gun = key; st.accum = 0;
  return true;
}

// Rounds owed this tick. A fractional rate accumulates; releasing the
// trigger forfeits the fraction so a tap cannot bank a burst.
export function stepGun(st, dt, held, guns) {
  const gun = guns[st.gun];
  if (!(dt > 0)) return 0;
  // downtime runs whether or not the trigger is down: heat cools, a magazine reloads
  for (const g of Object.values(guns)) {
    if (g.heatSeconds && (!held || st.gun !== g.key || st.overheated)) { st.heat = Math.max(0, st.heat - dt / g.coolSeconds); if (st.overheated && st.heat <= 0) st.overheated = false; }
    if (g.magazine && st.mag === 0 && st.clock >= st.reloadUntil) st.mag = g.magazine;
  }
  if (!held || !st.mounted || st.phase !== 'station' || !gun || !(gun.rate > 0)) { st.accum = 0; st.wasHeld = false; return 0; }
  if (gun.heatSeconds && st.overheated) { st.accum = 0; return 0; }
  if (gun.magazine && (st.mag === 0 || st.clock < st.reloadUntil)) { st.accum = 0; return 0; }
  if (!st.wasHeld) st.accum = Math.max(st.accum, 1);   // a fresh press fires at once: a click is a shot, not a fraction of one (owner, 2026-09-14)
  st.wasHeld = true;
  st.accum += gun.rate * dt;
  let n = Math.floor(st.accum);
  st.accum -= n;
  if (gun.heatSeconds) { st.heat = Math.min(1, st.heat + dt / gun.heatSeconds); if (st.heat >= 1) { st.overheated = true; st.accum = 0; } }   // heat rises for every moment the trigger is down
  if (gun.magazine) { if (st.mag < 0) st.mag = gun.magazine; n = Math.min(n, st.mag); st.mag -= n; if (st.mag === 0) st.reloadUntil = st.clock + gun.reload; }
  return n;
}

// THE GUNSHIP'S OWN 105 (owner, 2026-09-14): a one-two. Paint a cell, then launch: the shell falls `travel` seconds and
// lands on the painted cell (the host applies the blast); the gun reloads for `reload` seconds. Ammo is unlimited.
export function paintHeavy(st, ci, guns) { if (!st.mounted || st.phase !== 'station' || ci < 0 || st.heavyFalling || st.clock < st.heavyReadyAt) return false; st.heavyPaint = ci; return true; }
export function launchHeavy(st, guns) {
  const gun = guns.heavy; if (!st.mounted || st.phase !== 'station' || st.heavyPaint == null || st.heavyFalling || st.clock < st.heavyReadyAt) return -1;
  const ci = st.heavyPaint; st.heavyPaint = null; st.heavyFalling = { ci, at: st.clock + gun.travel, from: st.clock }; st.heavyReadyAt = st.clock + gun.travel + gun.reload;
  return ci;
}
// one nudge while it falls: the shell is steered onto another cell, once
export function nudgeHeavy(st, ci) { if (!st.heavyFalling || st.heavyFalling.nudged || ci < 0 || ci === st.heavyFalling.ci) return false; st.heavyFalling.ci = ci; st.heavyFalling.nudged = true; return true; }
// returns the cell the shell lands on this tick, or -1
export function stepHeavy(st) { if (st.heavyFalling && st.clock >= st.heavyFalling.at) { const ci = st.heavyFalling.ci; st.heavyFalling = null; return ci; } return -1; }
export function heavyState(st, guns) {
  if (st.heavyFalling) return { phase: 'falling', left: st.heavyFalling.at - st.clock, ci: st.heavyFalling.ci, nudged: !!st.heavyFalling.nudged };
  if (st.clock < st.heavyReadyAt) return { phase: 'reloading', left: st.heavyReadyAt - st.clock, total: guns.heavy.reload };
  return st.heavyPaint != null ? { phase: 'painted', ci: st.heavyPaint } : { phase: 'ready' };
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
