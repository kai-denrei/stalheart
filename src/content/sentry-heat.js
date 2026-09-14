// Barrel heat for the sentries that stream rounds. Heat rises per shot and
// radiates away faster the hotter the barrels are; at 1.0 the mount locks
// out until it has cooled back under `resume`. Tuned generous but honest,
// against the measured piloted cadence of about 15 rounds/s: the Rotor runs
// about twenty seconds flat out before it locks (owner, 2026-09-14: twice the
// old ten, more time to play), then needs about five to come back under
// `resume`, and the next burst runs about twelve. perShot and cool are halved
// together so the lock stays as far from the never-locks edge as before (a
// lone perShot cut left 14 rounds/s never locking); resume rises so the
// recovery does not double with them. An auto Rotor at its slower cadence
// still settles and never locks.
export const SENTRY_HEAT = Object.freeze({
  rotor: Object.freeze({ perShot: 0.008, cool: 0.08, ambient: 0.25, resume: 0.6 }),
});
