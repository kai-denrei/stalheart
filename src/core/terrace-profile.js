// Terrace profile for a flat base cut into a sphere. Distances are arc metres
// from the pole; heights are metres in the pole's tangent frame (y up).
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// How far the sphere falls below the tangent plane at arc distance d.
export function drop(d, radius) {
  const a = Math.min(Math.PI / 2, Math.abs(d) / radius);
  return radius * (1 - Math.cos(a));
}

// Band index: 0 inside the pad, k >= 1 for successive 2 m bands outward.
export function terraceLevel(d, { radius, padRadius, step }) {
  if (d < padRadius) return 0;
  return 1 + Math.floor((drop(d, radius) - drop(padRadius, radius)) / step);
}

// Floor height of the terrace that contains d. Cut and fill are centred, so a
// band's floor sits half a step below its inner edge and half above its outer.
export function terraceFloor(d, opts) {
  const { radius, padRadius, step } = opts;
  const padDrop = drop(padRadius, radius);
  const level = terraceLevel(d, opts);
  if (level === 0) return -padDrop / 2;
  return -(padDrop + (level - 0.5) * step);
}

// Radial offset applied to a lattice vertex at arc distance d: the terrace
// floor relative to the natural surface, faded to zero past the clearing.
export function terraceAltitude(d, opts) {
  const { radius, clearRadius, blend } = opts;
  if (d >= clearRadius + blend) return 0;
  const raw = drop(d, radius) + terraceFloor(d, opts);
  return raw * (1 - smoothstep(clearRadius, clearRadius + blend, d));
}
