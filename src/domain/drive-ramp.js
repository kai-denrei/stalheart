// THE LONG PULL. A hull held forward keeps gaining pace for seconds, so crossing the planet is a run-up rather than a crawl; a wall,
// a stop or hard steering spends what was built. Pure: the controller owns the clock and the collision, this owns the curve.
export const makeDriveRamp = () => ({ t: 0 });
// the pace multiplier after `t` seconds of forward drive: `base` at once, easing toward `top` with time constant `tau`
export const rampMultiplier = (t, tune) => tune.base + (tune.top - tune.base) * (1 - Math.exp(-Math.max(0, t) / tune.tau));
// advance by dt: forward drive builds, reverse or idle bleeds at `stop` seconds per second, steering at `turn`; returns the multiplier
export function stepDriveRamp(ramp, dt, drive, turning, tune) {
  dt = Math.max(0, dt);
  if (drive > 0) ramp.t += dt * drive - (turning ? dt * tune.turn : 0);
  else ramp.t -= dt * tune.stop;
  ramp.t = Math.max(0, Math.min(ramp.t, tune.tau * 6));
  return drive > 0 ? rampMultiplier(ramp.t, tune) : tune.base;
}
// a wall contact keeps `keep` of the run-up on a grazing touch and none of it head-on (headOn: 0 grazing .. 1 square)
export function scrubDriveRamp(ramp, headOn, tune) {
  ramp.t *= 1 - Math.max(0, Math.min(1, headOn)) * (1 - tune.keep);
  return ramp;
}
