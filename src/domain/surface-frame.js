// THE SURFACE FRAME (the Nih-Dairia boss lab, 2026-10-08): a creature that simulates in its own flat metres is placed on the
// planet by a frame: origin on the surface, up along the normal, east/north the tangent basis turned by yaw, one uniform scale.
// Pure: arrays in, arrays out; the planet's centre is the origin (the story planet shifts the scene so the pole sits at y = 0).
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function frameAt(direction, radius, yaw = 0) {
  const up = norm(direction);
  const ref = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];   // a helper axis not parallel to up
  const east = norm(cross(ref, up)), north = cross(up, east);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const e = [east[0] * c + north[0] * s, east[1] * c + north[1] * s, east[2] * c + north[2] * s];
  const n = [north[0] * c - east[0] * s, north[1] * c - east[1] * s, north[2] * c - east[2] * s];
  return { origin: [up[0] * radius, up[1] * radius, up[2] * radius], up, east: e, north: n, yaw };
}
export function toWorld(f, local, scale = 1) {
  const [x, y, z] = local;
  return [0, 1, 2].map((k) => f.origin[k] + (x * f.east[k] + y * f.up[k] + z * f.north[k]) * scale);
}
export function toLocal(f, world, scale = 1) {
  const d = [world[0] - f.origin[0], world[1] - f.origin[1], world[2] - f.origin[2]];
  return [dot(d, f.east) / scale, dot(d, f.up) / scale, dot(d, f.north) / scale];
}
export function sagitta(distance, radius) { return distance * distance / (2 * radius); }
// When the creature's centre has walked past `limit` metres from the origin, the frame slides to the surface point under
// the centre and the caller shifts every local position by `shift` (inside one fixed step, so the solver sees no jump).
export function reanchor(f, localCentre, radius, scale, limit) {
  const [x, , z] = localCentre;
  if (Math.hypot(x, z) * scale <= limit) return { frame: f, shift: [0, 0, 0] };
  const under = toWorld(f, [x, 0, z], scale);
  return { frame: frameAt(under, radius, f.yaw), shift: [0 - x, 0, 0 - z] };
}
