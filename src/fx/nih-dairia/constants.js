// Ported from lab-creatures src/physics/constants.js (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const PHYS = {
  density: 1050, shear: 1200, bulk: 65000, damping: 3,
  gravity: 2.4, step: 1 / 240, iterations: 3,
  staticFriction: .65, dynamicFriction: .42, restitution: .065,
  floor: .00015, maxGrabForce: 2.8,
};
