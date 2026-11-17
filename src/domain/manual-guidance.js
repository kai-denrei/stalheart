// The secondary sight lives in the optical cone, in tangent-angle coordinates.
export function stepGuidance(sight, keys, dt, tune) {
  const x = Number(!!keys.right) - Number(!!keys.left), y = Number(!!keys.down) - Number(!!keys.up);
  const n = Math.max(1, Math.hypot(x, y)), seconds = Math.max(0, dt);
  for (const [axis, input] of [['x', x / n], ['y', y / n]]) {
    const key = axis === 'x' ? 'vx' : 'vy', v0 = sight[key] ?? 0;
    const target = input * tune.speed, tau = input ? tune.accelSeconds : tune.coastSeconds;
    const e = Math.exp(-seconds / tau);
    const next = sight[axis] + target * seconds + (v0 - target) * tau * (1 - e);
    sight[key] = target + (v0 - target) * e;
    sight[axis] = Math.max(-1, Math.min(1, next));
    if (next < -1 || next > 1) sight[key] = 0;
  }
  return sight;
}

export function guidanceAligned(x, y, sight, cone, tolerance) {
  return Math.hypot(x, y) <= Math.min(cone, tolerance) && Math.hypot(x - sight.x * cone, y + sight.y * cone) <= tolerance;
}
