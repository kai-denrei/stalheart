import { sample, profiles } from '../core/a6-missile-flight.js';

// Flat-range adapter. The launch frame stays fixed; terminal correction follows
// the target without dragging the opening around when the turret turns.
export function missileFrame(from, target, launchDirection) {
  const horizontal = Math.hypot(launchDirection[0], launchDirection[2]);
  const forward = horizontal > 1e-6
    ? [launchDirection[0] / horizontal, 0, launchDirection[2] / horizontal]
    : (()=>{const x=target[0]-from[0],z=target[2]-from[2],n=Math.hypot(x,z);return n>1e-6?[x/n,0,z/n]:[0,0,1];})();
  const norm=Math.hypot(...launchDirection)||1;
  return { from: from.slice(), target: target.slice(), forward, launchDirection:launchDirection.map(v=>v/norm),
    right: [forward[2], 0, -forward[0]],
    distance: Math.max(.1, Math.hypot(target[0] - from[0], target[2] - from[2])) };
}
export function sampleMissile(frame, u, profile, target = frame.target) {
  const s = sample(u, profile), end = 24 * profiles[profile].range;
  const scale = frame.distance / end, fraction = s.position[2] / end;
  const correction = fraction * fraction * (3 - 2 * fraction);
  const baseEnd = frame.from.map((v, i) => v + frame.forward[i] * frame.distance);
  const position = frame.from.map((v, i) => v + frame.forward[i] * s.position[2] * scale
    + frame.right[i] * s.position[0] * scale + (i === 1 ? s.position[1] * scale : 0)
    + (target[i] - baseEnd[i]) * correction);
  // Preserve the authored nose-up attitude independently of falling travel.
  const authored = frame.forward.map((v, i) => v * s.direction[2]
    + frame.right[i] * s.direction[0] + (i === 1 ? s.direction[1] : 0));
  const t=Math.max(0,Math.min(1,(u-.355)/.12)),blend=t*t*(3-2*t);
  const nose=frame.launchDirection.map((v,i)=>v*(1-blend)+authored[i]*blend);
  const norm=Math.hypot(...nose)||1;
  return { ...s, position, direction:nose.map(v=>v/norm) };
}
