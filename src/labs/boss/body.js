// body.js — the boss lab's body rules (spec section 0, 2026-10-08): everything the lab decides from the creature's body nodes,
// moved out of boss-tab.js so the fear and the arena have room to grow beside it. The creature simulates in its own native units and
// the lab's rules are in local metres on the frame's plane, so every rule reads the creature and the display scale through getters
// (a creature reload or a size change is seen at once).
//
// THE BODY IS A BLOCKER: every body node in the hull's height band (under 3 m scaled), projected to the plane in local metres,
// listed once a frame by project(); within the hull's radius of the nearest one the tank is pushed straight away from it by what it
// overlaps, `blocker(x, z) -> null | { nx, nz, depth }`. circleInput(radius) is the heading controller the harness's circle() runs;
// shellHit(x, z) is the cannon's test of a shell against the body; shove(x, z) is the shell's push on the nodes around a hit.
const DRIVE_R = 4.2;         // the hull's radius against the creature's body (the blocker)
const BAND_M = 3;
// a shell meets the body within HIT_M (the blast's half) of a body node under HIT_BAND_M (the hull's band plus 3 m, so a shell at
// 1.2 m meets the raised torso's underside); the shove is radial from the hit, in native units: the strength capped, its radius, the lift
const HIT_M = 2, HIT_BAND_M = 6;
const SHOVE = { strength: 0.08, radius: 0.04, lift: 0.02 };
// circle(): the heading controller's gain (turn per radian of error) and the radial correction's weight per metre of error
const CIRCLE = { gain: 2.5, radial: 0.08 };

export function createBodyRules({ getCreature, getScale, drive, tune = {} } = {}) {
  const T = { DRIVE_R, BAND_M, HIT_M, HIT_BAND_M, SHOVE, CIRCLE, ...tune };
  let bandNodes = new Float64Array(0), bandCount = 0;

  // circle(): orbit the creature's centre at `radius` metres, counter-clockwise, with the drive's own turn and throttle: the
  // wanted heading is the tangent bent toward the circle by the radial error, the turn proportional to the heading error
  function circleInput(radius) {
    const creature = getCreature(), scale = getScale();
    const c = creature.motion.center, rx = drive.x - c.x * scale, rz = drive.z - c.z * scale, d = Math.hypot(rx, rz) || 1;
    const ux = rx / d, uz = rz / d, pull = Math.max(-1, Math.min(1, (d - radius) * T.CIRCLE.radial));
    const hx = -uz - ux * pull, hz = ux - uz * pull;
    let err = Math.atan2(hx, hz) - drive.yaw;
    err = Math.atan2(Math.sin(err), Math.cos(err));
    return { throttle: 1, turn: Math.max(-1, Math.min(1, err * T.CIRCLE.gain)), cruiseTap: false };
  }
  function project() {
    bandCount = 0;
    const creature = getCreature(), scale = getScale();
    if (!creature) return;
    const b = creature.body, n = b.x.length / 3;
    if (bandNodes.length < n * 2) bandNodes = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      if (b.x[i * 3 + 1] * scale >= T.BAND_M) continue;
      bandNodes[bandCount * 2] = b.x[i * 3] * scale; bandNodes[bandCount * 2 + 1] = b.x[i * 3 + 2] * scale; bandCount++;
    }
  }
  function blocker(x, z) {
    const creature = getCreature(), scale = getScale();
    let best = Infinity, bx = 0, bz = 0;
    for (let i = 0; i < bandCount; i++) {
      const px = bandNodes[i * 2], pz = bandNodes[i * 2 + 1], d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; bx = px; bz = pz; }
    }
    if (!(best < T.DRIVE_R)) return null;
    let nx, nz;
    if (best > 1e-6) { nx = (x - bx) / best; nz = (z - bz) / best; }
    else {
      const m = creature.motion.center; nx = x - m.x * scale; nz = z - m.z * scale;
      const l = Math.hypot(nx, nz);
      if (l > 1e-9) { nx /= l; nz /= l; } else { nx = 1; nz = 0; }
    }
    return { nx, nz, depth: T.DRIVE_R - best };
  }
  // the nearest body node under the band within HIT_M of the shell, in local metres; the hit point is that node
  function shellHit(x, z) {
    const creature = getCreature(), scale = getScale();
    if (!creature) return null;
    const b = creature.body, n = b.x.length / 3;
    let best = T.HIT_M, hit = null;
    for (let i = 0; i < n; i++) {
      if (b.x[i * 3 + 1] * scale >= T.HIT_BAND_M) continue;
      const px = b.x[i * 3] * scale, pz = b.x[i * 3 + 2] * scale, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; hit = { x: px, z: pz }; }
    }
    return hit;
  }
  // the shell shoves the body away from the hit (local metres in, native velocities out)
  function shove(x, z) {
    const creature = getCreature(), scale = getScale();
    if (!creature) return;
    const b = creature.body, v = b.velocity, n = b.x.length / 3, hx = x / scale, hz = z / scale;
    b.wake?.();
    for (let i = 0; i < n; i++) {
      const dx = b.x[i * 3] - hx, dz = b.x[i * 3 + 2] - hz, d = Math.hypot(dx, dz);
      if (d >= T.SHOVE.radius) continue;
      const f = 1 - d / T.SHOVE.radius, push = T.SHOVE.strength * f;
      if (d > 1e-9) { v[i * 3] += dx / d * push; v[i * 3 + 2] += dz / d * push; }
      v[i * 3 + 1] += T.SHOVE.lift * f;
    }
  }
  return { project, blocker, circleInput, shellHit, shove };
}
