import { makeLock, stepLock } from './lockon.js';

export const missileGroundDistance = (from, target) => Math.hypot(target[0] - from[0], target[2] - from[2]);
// Acos/arc conversions can land a few ulps beyond an inclusive endpoint.
export const missileDistanceInRange = (distance, config) => Number.isFinite(distance)
  && distance >= config.minRange - 1e-9 && distance <= config.maxRange + 1e-9;
const labAlive = target => target.up && target.hp > 0;
// Context adapters supply ground metres, life state and optional target policy.
// The sphere adapter must use arc distance, never a chord or fitted mesh scale.
export function missileTargetInRange(target, from, limits, distance = missileGroundDistance, eligible = labAlive) {
  if (!target || !eligible(target)) return false;
  const d = distance(from, target.pos);
  return missileDistanceInRange(d, limits);
}
export function pickMissileTarget(targets, from, keepId, limits, distance = missileGroundDistance, eligible = labAlive) {
  const valid = target => missileTargetInRange(target, from, limits, distance, eligible);
  const kept = targets.findIndex(target => target.id === keepId && valid(target));
  if (kept !== -1) return kept;
  let best = -1, nearest = Infinity;
  for (let i = 0; i < targets.length; i++) {
    if (!valid(targets[i])) continue;
    const d = distance(from, targets[i].pos);
    if (d < nearest) { best = i; nearest = d; }
  }
  return best;
}
export const missileLimits = (config, rangeMultiplier = 1) => ({ ...config, maxRange: config.maxRange * rangeMultiplier });
export function stepMissileLock(lock, dt, target, distance, aimError, config) {
  const valid = target && missileDistanceInRange(distance, config);
  // No inherited progress after loss, death, range exit or a change of enemy.
  if (!valid || lock.id !== target.id) Object.assign(lock, makeLock());
  stepLock(lock, Math.max(0, dt), valid ? { id: target.id, range: Math.max(config.minRange, Math.min(config.maxRange, distance)), off: aimError } : null, {
    gateMrad: config.lockGate, lockTime: config.lockTime, breakMrad: config.lockBreak,
    drain: 1.6, minRange: config.minRange, maxRange: config.maxRange,
  });
  return lock;
}
export function missileCanFire(lock, target, distance, aimError, config, cooldown = 0, ready = true) {
  return !!(ready && target && lock.locked && lock.id === target.id && cooldown <= 0
    && missileDistanceInRange(distance, config)
    && Number.isFinite(aimError) && aimError <= config.aimTolerance);
}
