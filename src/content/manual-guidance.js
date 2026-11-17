// Manual acquisition only; automated missile locks keep their shared rules.
export const MANUAL_GUIDANCE = Object.freeze({
  quiver: Object.freeze({ speed: 0.65, accelSeconds: 0.18, coastSeconds: 0.26, toleranceDeg: 1.6, start: Object.freeze([0.65, -0.4]) }),
});
