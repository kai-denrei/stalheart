// Barrel heat for the sentries that stream rounds. Heat rises per shot and
// radiates away faster the hotter the barrels are; at 1.0 the mount locks
// out until it has cooled back under `resume`. Tuned generous but honest,
// against the measured piloted cadence of about 15 rounds/s: the Rotor runs
// about ten seconds flat out before it locks, then needs about four and a
// half to come back under `resume`; an auto Rotor at its slower cadence
// settles at a dull red and never locks.
export const SENTRY_HEAT = Object.freeze({
  rotor: Object.freeze({ perShot: 0.016, cool: 0.16, ambient: 0.25, resume: 0.35 }),
});
