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

// THE TOUR OF THE LANDERS (owner, 2026-10-03: "after Isao starts building, there's an awkward dead time ... a) it zooms out to a planetary
// view b) the camera moves one by one quickly to each beacon (landing sites), giving a clear idea of a mission, and c) from there we jump
// into the Rotor Manual Override"). Keyframes: over the base at `high` radii, then each site from `low` radii looking down at it, then the
// base again; between two the eye climbs by `arc` so it sweeps over the planet instead of through it. u 0..1 over the whole tour.
export function tourFrame(u, home, sites, { high = 1.75, low = 1.28, arc = 0.45 } = {}) {
  const keys = [{ d: norm3(home), r: high }, ...sites.map((p) => ({ d: norm3(p), r: low })), { d: norm3(home), r: high }];
  const span = keys.length - 1, x = Math.min(span - 1e-9, Math.max(0, u) * span), i = Math.floor(x), t0 = x - i, t = t0 * t0 * (3 - 2 * t0);
  const a = keys[i], b = keys[i + 1], om = Math.acos(Math.max(-1, Math.min(1, dot3(a.d, b.d))));
  let d;
  if (om < 1e-4) d = a.d; else { const s0 = Math.sin((1 - t) * om) / Math.sin(om), s1 = Math.sin(t * om) / Math.sin(om); d = norm3(add3(scale3(a.d, s0), scale3(b.d, s1))); }
  const r = a.r + (b.r - a.r) * t + Math.sin(Math.PI * t) * arc * Math.min(1, om), eye = scale3(d, r);
  // the look slides from the planet's centre (high) to the ground under the eye (low)
  const w = Math.max(0, Math.min(1, (high - r) / (high - low))), look = scale3(d, w);
  // the frame's up is the way the tour is going, blended across each keyframe (the leg in, the leg out) so a turn swings and never snaps
  const leg = (j) => { if (j < 0 || j >= span) return [0, 0, 0]; const g = sub3(keys[j + 1].d, keys[j].d), q = sub3(g, scale3(d, dot3(g, d))); return dot3(q, q) > 1e-12 ? norm3(q) : [0, 0, 0]; };
  const ramp = (v) => Math.max(0, Math.min(1, 2 * v)), m = add3(leg(i), add3(scale3(leg(i + 1), ramp(t0 - 0.5)), scale3(leg(i - 1), ramp(0.5 - t0))));
  const up = dot3(m, m) > 1e-10 ? norm3(m) : norm3(cross3(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return { eye, look, up };
}

// THE TOUR'S CLOCK (owner, 2026-10-04: "planet view, the beacons lit one by one"): `lead` seconds out of the close-up, then `per` for each
// lander; tourStops are the seconds at which the eye is over each site (tourFrame's keyframes: home, the sites, home), so a site's
// beacon can light as the camera arrives
export const tourSeconds = (n, lead = 2, per = 2.8) => lead + per * n;
export const tourStops = (n, lead, per) => Array.from({ length: n }, (_, i) => tourSeconds(n, lead, per) * (i + 1) / (n + 1));
