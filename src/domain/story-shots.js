// THE STORY'S CAMERA SHOTS, their poses: Isao face on (storyApi.closeup), the sites from orbit (storyApi.planetView) and the
// board's band reveal. The controller flies them through its startShot and turns each pose into a camera (the quaternion step
// stays there, with its scratch camera); takeControl's pose is src/platform/story-world.js takeControlPose.
//
// Pure arithmetic, like src/domain/showcase-shot.js: every function returns an eye, a look point and an up. Moved out of the
// game controller unchanged.
import { add3, sub3, scale3, dot3, norm3, cross3 } from '../vec3.js';

// FACE ON: Isao's body at `bp` standing on `dir`, facing `fw` (his model's world direction, flattened onto the ground), `size`
// his scale. The eye closes from 1.9 to 1.4 of his size in front of his face over the shot (u 0..1), a little above it.
export function isaoFace(bp, dir, fw, size, u) {
  const n = norm3(dir), f = norm3(sub3(fw, scale3(n, dot3(fw, n)))), face = add3(bp, scale3(n, size * 0.35)), eye = add3(add3(face, scale3(f, size * (1.9 - 0.5 * u))), scale3(n, size * 0.12));
  return { eye, look: face, up: n };
}

// THE PLANET FROM ORBIT: the eye `radius` out along `d`, looking at the centre, up any tangent there
export function orbitFrame(d, radius) {
  const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], up = norm3(cross3(d, ref));
  return { eye: scale3(d, radius), look: [0, 0, 0], up };
}
// the sites' mean direction, and the climb from 1.6 to 3.3 planet radii in the first 62.5% of the shot
export const sitesDir = (points) => norm3(points.reduce((a, c) => add3(a, c), [0, 0, 0]));
export const sitesRadius = (u) => 1.6 + 1.7 * Math.min(1, u * 1.6);
