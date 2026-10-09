// The bait mode's gunship pattern (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 1): the platform
// flies a slow circle round the arena's centre so the player corrects drift but never meets a camera cut. Pure: time in seconds
// and the tune in, plain objects out; positions are local metres on the frame's plane [x, z] (the same plane as the bait and the
// arena). The altitude is the game's and stays with the lab.
//
// Direction: the angle atan2(z, x) round the centre grows with time, the way the bait circles the creature (called counter-clockwise
// in this plane's own handedness). It starts at angle 0, on +x. The heading is the direction of travel in the bait's convention,
// atan2(dz, dx), and is returned unwrapped (it gains 2 pi a lap), so a consumer easing toward it never meets a jump.
// The bank is the constant `orbit.bank`, radians, rolled toward the centre (the inside wing down).

export function orbitAt(t, tune) {
  const O = tune.orbit, angle = (2 * Math.PI * t) / O.lap;
  return { pos: [O.radius * Math.cos(angle), O.radius * Math.sin(angle)], heading: angle + Math.PI / 2, bank: O.bank };
}
