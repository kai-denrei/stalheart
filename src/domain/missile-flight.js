import { sample, profiles } from '../core/a6-missile-flight.js';

// THE POP-OUT HAS A HEIGHT IN METRES (owner, 2026-09-16: the Quiver's rocket must never leave the frame during the pop-out, hover, drop
// and ignite). The authored opening scaled with range like the rest of the flight, so a 235 m shot popped 25 m over its launcher. Its
// rise is capped at OPENING_METRES whatever the range; short shots, every range the labs fire, keep the authored scale untouched. The
// cap holds through the ignition catch and hands back to the range scale over the powered climb, so position stays continuous and
// arrival exact. `metre` is one metre in the frame's units: 1 on a flat range, the sphere adapter passes the planet's.
export const OPENING_METRES = 8;
const APEX = 2.4, HOLD_END = .355, CLIMB_END = .58;   // the authored opening's apex (raw units, times the profile height); the catch; the climb that hands back
export function missileFrame(from, target, launchDirection, { metre = 1 } = {}) {
  const horizontal = Math.hypot(launchDirection[0], launchDirection[2]);
  const forward = horizontal > 1e-6
    ? [launchDirection[0] / horizontal, 0, launchDirection[2] / horizontal]
    : (()=>{const x=target[0]-from[0],z=target[2]-from[2],n=Math.hypot(x,z);return n>1e-6?[x/n,0,z/n]:[0,0,1];})();
  const norm=Math.hypot(...launchDirection)||1;
  return { from: from.slice(), target: target.slice(), forward, launchDirection:launchDirection.map(v=>v/norm),
    right: [forward[2], 0, -forward[0]], metre,
    distance: Math.max(.1, Math.hypot(target[0] - from[0], target[2] - from[2])) };
}
// the vertical scale at u: capped through the opening, eased back to the range scale by the end of the climb
export function liftScale(frame, u, profile) {
  const scale = frame.distance / (24 * profiles[profile].range);
  const capped = Math.min(scale, (frame.metre ?? 1) * OPENING_METRES / (APEX * profiles[profile].height));
  const t = Math.max(0, Math.min(1, (u - HOLD_END) / (CLIMB_END - HOLD_END))), blend = t * t * (3 - 2 * t);
  return capped + (scale - capped) * blend;
}
export function sampleMissile(frame, u, profile, target = frame.target) {
  const s = sample(u, profile), end = 24 * profiles[profile].range;
  const scale = frame.distance / end, fraction = s.position[2] / end, lift = liftScale(frame, u, profile);
  const correction = fraction * fraction * (3 - 2 * fraction);
  const baseEnd = frame.from.map((v, i) => v + frame.forward[i] * frame.distance);
  const position = frame.from.map((v, i) => v + frame.forward[i] * s.position[2] * scale
    + frame.right[i] * s.position[0] * scale + (i === 1 ? s.position[1] * lift : 0)
    + (target[i] - baseEnd[i]) * correction);
  // Preserve the authored nose-up attitude independently of falling travel.
  const authored = frame.forward.map((v, i) => v * s.direction[2]
    + frame.right[i] * s.direction[0] + (i === 1 ? s.direction[1] : 0));
  const t=Math.max(0,Math.min(1,(u-.355)/.12)),blend=t*t*(3-2*t);
  const nose=frame.launchDirection.map((v,i)=>v*(1-blend)+authored[i]*blend);
  const norm=Math.hypot(...nose)||1;
  return { ...s, position, direction:nose.map(v=>v/norm) };
}

// THE DROP PROFILE (owner, 2026-09-16: the gunship's weapon 3 "drops, then it ignites after 2 seconds and heads down"). This is the
// eject/coast/fall/ignite shape above, inverted: a release from altitude instead of a pop-up. It reuses this module's frame
// (missileFrame's forward/right/metre, so `metre` still means one metre in the scene's units) and the sampler's contract —
// { position, direction, ignition, phase }, which is what src/missile-presentation.js poses a pooled round from and what drives
// the exhaust — and replaces only the curve. The authored parabola is a stylised local-unit arc; a round let go 340 m up has to
// fall REAL metres for a real two seconds, so the unpowered leg is ballistics and the powered leg a Hermite that enters at the
// fall's own velocity (no kink at ignition) and arrives faster than it started. Every number is a parameter: src/content/gunship.js
// owns freeFall, drive, gravity and arrivalLead; the domain layer never reads content.
export const DROP_PHASES = Object.freeze(['Release', 'Fall', 'Ignite', 'Dive']);
export function dropFrame(from, target, velocity, { freeFall = 2, drive = 1.8, gravity = 9.81, arrivalLead = 1.5, metre = 1, up = [0, 1, 0] } = {}) {
  const un = Math.hypot(...up) || 1, u = up.map((v) => v / un);
  const vel = velocity && velocity.length === 3 ? velocity.slice() : [0, 0, 0];
  const lead = Math.hypot(...vel) > 1e-9 ? vel : u.map((v) => -v);   // the nose at release: the aircraft's own velocity, else straight down
  const fall = Math.max(0, freeFall), burn = Math.max(1e-3, drive);
  return { ...missileFrame(from, target, lead, { metre }), up: u, velocity: vel, freeFall: fall, drive: burn, gravity, arrivalLead,
    duration: fall + burn, ignitionAt: fall / (fall + burn) };
}
// `t` is SECONDS since release, not a normalised u: the two seconds of fall are the owner's number and must not stretch with range.
export function sampleDrop(frame, t, target = frame.target) {
  const g = frame.gravity * (frame.metre ?? 1), clamped = Math.max(0, Math.min(frame.duration, t));
  const at = (s) => frame.from.map((v, i) => v + frame.velocity[i] * s - frame.up[i] * .5 * g * s * s);
  const speed = (s) => frame.velocity.map((v, i) => v - frame.up[i] * g * s);
  if (clamped <= frame.freeFall) {
    const d = speed(clamped), n = Math.hypot(...d) || 1;
    return { position: at(clamped), direction: d.map((v) => v / n), ignition: false, u: clamped / frame.duration,
      phase: clamped < frame.freeFall * .2 ? 'Release' : 'Fall' };
  }
  const p0 = at(frame.freeFall), v0 = speed(frame.freeFall).map((v) => v * frame.drive);   // tangents are per unit of s, so the entry one carries the drive
  const left = Math.hypot(...target.map((v, i) => v - p0[i]));
  const v1 = frame.up.map((v) => -v * left * frame.arrivalLead);   // straight down and faster than it came in: the motor drives it onto the point
  const s = Math.min(1, (clamped - frame.freeFall) / frame.drive), s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  const position = p0.map((v, i) => h00 * v + h10 * v0[i] + h01 * target[i] + h11 * v1[i]);
  const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
  const tangent = p0.map((v, i) => d00 * v + d10 * v0[i] + d01 * target[i] + d11 * v1[i]);
  const n = Math.hypot(...tangent) || 1;
  return { position, direction: tangent.map((v) => v / n), ignition: clamped < frame.duration, u: clamped / frame.duration,
    phase: s < .25 ? 'Ignite' : 'Dive' };
}
