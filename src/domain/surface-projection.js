// THE SURFACE FRAME AND ITS PLANE (docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md, "Cutis drawing"). A creature
// kit that draws on a flat plane (src/fx/cutis-maku: its shader bends local plane points onto the sphere exactly, azimuthal-equidistant
// round the group's origin) is put on the planet by one frame: the origin a point on the unit sphere, +Y its outward normal, and two
// tangent axes. A point of the sphere maps into that plane by the azimuthal-equidistant projection round the origin: its arc distance
// from the origin (in the caller's unit, the planet's radius `R` of them) along its direction in the tangent basis. The projection is
// exact for positions; shapes are stretched sideways by theta / sin(theta) (~5 % at 30 degrees) and it is singular at the antipode.
// Pure: unit vectors as [x, y, z] arrays in, numbers out.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// the frame at `origin` (any non-zero vector; normalised): `ey` the normal, `ex` and `ez` the tangent axes with ex x ey = ez (a
// right-handed basis, so a Three.js Matrix4.makeBasis(ex, ey, ez) is a pure rotation)
export function surfaceFrame(origin) {
  const ey = unit(origin), ref = Math.abs(ey[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const ex = unit(cross(ref, ey)), ez = cross(ex, ey);
  return { origin: ey, ex, ey, ez };
}

// the frame at unit point `p` with `f`'s heading carried over (a body that draws and simulates in a frame of its own re-anchors to the
// point under it as it walks, src/fx/creature-reed.js): the new ex is f's ex projected onto the tangent plane at p, so the body is not
// turned when its frame moves (surfaceFrame's fixed reference would turn it near that reference's axis). The old ex parallel to p (a
// quarter of the planet away) falls back to surfaceFrame(p).
export function carryFrame(f, p) {
  const ey = unit(p), d = dot(f.ex, ey), t = [f.ex[0] - ey[0] * d, f.ex[1] - ey[1] * d, f.ex[2] - ey[2] * d];
  if (Math.hypot(t[0], t[1], t[2]) < 1e-6) return surfaceFrame(p);
  const ex = unit(t), ez = cross(ex, ey);
  return { origin: ey, ex, ey, ez };
}

// the plane point [x, z] of sphere point `p` (normalised) in frame `f`, for a planet of radius `R` (the plane's unit: R = 753 gives
// metres on the story planet). The origin itself (and its antipode, where the direction is undefined) maps to its arc along +x.
export function toPlane(f, p, R = 1) {
  const q = unit(p), c = Math.max(-1, Math.min(1, dot(q, f.ey))), theta = Math.acos(c);
  const tx = dot(q, f.ex), tz = dot(q, f.ez), s = Math.hypot(tx, tz);
  if (s < 1e-12) return [theta * R, 0];
  const d = theta * R;
  return [d * tx / s, d * tz / s];
}

// the inverse: the unit sphere point of plane point (x, z) in frame `f` (radius `R` in the plane's unit)
export function fromPlane(f, x, z, R = 1) {
  const d = Math.hypot(x, z), theta = d / R;
  if (d < 1e-12) return f.ey.slice();
  const c = Math.cos(theta), s = Math.sin(theta) / d;
  return unit([0, 1, 2].map((k) => f.ey[k] * c + (f.ex[k] * x + f.ez[k] * z) * s));
}

// the plane distance between two plane points: equal to the arc between their sphere points along a ray from the origin, and close to
// it near the origin (the projection keeps distances from the origin exactly, not between two arbitrary points)
export const planeDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
