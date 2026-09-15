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
