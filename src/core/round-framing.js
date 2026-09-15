// THE ROUND STAYS IN FRAME (owner, 2026-09-16: when the Quiver shoots its rocket, the rocket should never get out of frame during the
// initial pop-out, hover, drop and ignite). A piloted guided mount's optic is built from the aim alone and looks through a long lens,
// so the round left the frame 50 ms after launch. While the round is in its opening the view widens toward 1x and follows it with a
// dead zone: the camera does not move while the round sits inside the box, and turns just enough to keep it on the box's edge when it
// would leave. The top edge is in the upper third, so the round rides high with the lane still under it. Through the climb the
// weight falls to zero and the view is the aim again. Pure vector maths over arrays; the pilot owns the camera.
export const ROUND_FRAME = Object.freeze({
  hold: 0.42,      // flight fraction: eject, coast, fall and ignite are framed in full
  release: 0.62,   // by here the view is the aim again
  lens: 1,         // the zoom the opening eases toward
  top: 0.62, bottom: -0.72, side: 0.72,   // the dead zone in normalised screen units (+1 is the top edge)
  steepest: 0.94,  // the most the view may tilt toward straight up (sine of the elevation): lookAt needs a horizon
});

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
const turn = (a, b, angle) => unit([a[0] * Math.cos(angle) + b[0] * Math.sin(angle), a[1] * Math.cos(angle) + b[1] * Math.sin(angle), a[2] * Math.cos(angle) + b[2] * Math.sin(angle)]);

// how much of the framing applies at flight fraction u: all of it to `hold`, eased out to nothing at `release`
export function framingWeight(u, f = ROUND_FRAME) {
  if (!(u >= 0) || u >= f.release) return 0;
  if (u <= f.hold) return 1;
  const t = (u - f.hold) / (f.release - f.hold);
  return 1 - t * t * (3 - 2 * t);
}

// the camera basis a lookAt with `up` builds: x to the right, y up the screen
function basis(look, up) {
  let right = cross(look, up);
  if (Math.hypot(...right) < 1e-9) right = cross(look, Math.abs(look[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1]);
  right = unit(right);
  return { right, screenUp: cross(right, look) };
}

// where a point lands on screen from `eye` looking along `look`: x, y in normalised units (±1 the edges), ahead: in front of the eye
export function screenOf(point, { eye, look, up, fovDeg, aspect }) {
  const v = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]], { right, screenUp } = basis(look, up);
  const along = dot(v, look), tanV = Math.tan((fovDeg * Math.PI) / 360);
  return { x: dot(v, right) / (along * tanV * aspect), y: dot(v, screenUp) / (along * tanV), ahead: along > 0 };
}

// the view direction that keeps `round` inside the dead zone, blended with the aim by `weight`
export function frameRound({ eye, aim, up, round, fovDeg, aspect, weight = 1, f = ROUND_FRAME }) {
  aim = unit(aim); up = unit(up);
  if (!(weight > 0)) return aim;
  const v = [round[0] - eye[0], round[1] - eye[1], round[2] - eye[2]];
  if (Math.hypot(...v) < 1e-12) return aim;
  const tanV = Math.tan((fovDeg * Math.PI) / 360), tanH = tanV * aspect;
  let look = aim;
  for (let pass = 0; pass < 3; pass++) {
    // vertical first: the angle of the round above the view, against the dead zone's top and bottom
    let { right, screenUp } = basis(look, up);
    const el = Math.atan2(dot(v, screenUp), dot(v, look)), hi = Math.atan(f.top * tanV), lo = Math.atan(f.bottom * tanV);
    if (el > hi) look = turn(look, screenUp, el - hi); else if (el < lo) look = turn(look, screenUp, el - lo);
    ({ right } = basis(look, up));
    const az = Math.atan2(dot(v, right), dot(v, look)), side = Math.atan(f.side * tanH);
    if (az > side) look = turn(look, right, az - side); else if (az < -side) look = turn(look, right, az + side);
  }
  // never past the steepest tilt: keep a horizon for the camera's up
  const s = dot(look, up);
  if (Math.abs(s) > f.steepest) { const flat = unit([look[0] - up[0] * s, look[1] - up[1] * s, look[2] - up[2] * s]), c = Math.sqrt(1 - f.steepest * f.steepest), k = Math.sign(s) * f.steepest; look = unit([flat[0] * c + up[0] * k, flat[1] * c + up[1] * k, flat[2] * c + up[2] * k]); }
  if (weight >= 1) return look;
  // slerp from the aim toward the framed view
  const cos = Math.max(-1, Math.min(1, dot(aim, look))), angle = Math.acos(cos);
  if (angle < 1e-9) return look;
  const ortho = unit([look[0] - aim[0] * cos, look[1] - aim[1] * cos, look[2] - aim[2] * cos]);
  return turn(aim, ortho, angle * weight);
}
