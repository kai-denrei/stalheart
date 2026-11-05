// THE PETS STAND ON THE SLABS (owner, 2026-11-05, round 8 note 2: "cheetah and other pets clip through the ground, at least through the base
// under the Stalheart, they should be above"). Pure: an island's slab is a flat plate on the tangent plane at its centre (src/domain/base-plan.js
// `top: 0`; the kit's foundation_slab.glb tops out at y 0, its 0.28 m plate and 1.2 m skirt hang below), and the sphere falls away under it
// toward its edges, so a body drawn on the bare sphere sinks into the plate by the sag there (on the 753 m story planet, by the geometry:
// 0.54 m at the 57 m Stålheart slab's side, 1.06 m at its corner). This is the factor that lifts a point on the sphere, along its own radius,
// onto the highest plate whose rectangle holds it; 1 off every plate. The scene builds the plates from the islands it drew (src/fx/story-base.js).
//   plateFloor(p, plates) -> k >= 1: p (any length; its direction is used) times k lies on the plate's top, k = 1 elsewhere
//   plates: [{ o: [x, y, z] the plate's centre on its top, n: unit up, ax: unit right, az: unit forward, hw, hd: half width / depth (the same units as o) }]

export function plateFloor(p, plates) {
  const l = Math.hypot(p[0], p[1], p[2]) || 1, ux = p[0] / l, uy = p[1] / l, uz = p[2] / l;
  let best = 1;
  for (const q of plates) {
    const { o, n, ax, az } = q, den = ux * n[0] + uy * n[1] + uz * n[2];
    if (den <= 1e-9) continue;   // the plate faces away from this radius
    const k = (o[0] * n[0] + o[1] * n[1] + o[2] * n[2]) / den, dx = ux * k - o[0], dy = uy * k - o[1], dz = uz * k - o[2];
    if (Math.abs(dx * ax[0] + dy * ax[1] + dz * ax[2]) > q.hw || Math.abs(dx * az[0] + dy * az[1] + dz * az[2]) > q.hd) continue;
    if (k > best) best = k;
  }
  return best;
}
