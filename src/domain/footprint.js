// A STRUCTURE'S FOOTPRINT FROM ITS GEOMETRY (owner, 2026-10-07: "the solar array should be impossible for the tank to go through:
// collision ON, but not so much that its entire perimeter becomes an invisible wall; same with the landing rocket"). The base used to
// keep one box round a building's near-ground bulk (src/fx/story-base.js solidAt): a lander's box walled the lane beside it, the solar
// complex's would have covered its own charging pad. Now the triangles near the ground are rasterised onto a grid of `cell`-sized
// cells in the structure's own frame, and a point is solid where its cell holds geometry: panels block and the pad between them stays
// open; a body blocks and the lane past its legs stays open. Pure: numbers in, a grid out.
//   xz: a flat array, six numbers a triangle (x0, z0, x1, z1, x2, z2) in the caller's units; cell: the grid's pitch in those units
//   hit(x, z, pad = 0): the point, or any cell within `pad` of it, holds geometry

// a triangle against an axis-aligned square (separating axes: the square's two, the triangle's three edge normals)
function overlaps(ax, az, bx, bz, cx, cz, x0, z0, x1, z1) {
  const tri = [[ax, az], [bx, bz], [cx, cz]], box = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const axes = [[1, 0], [0, 1]];
  for (let i = 0; i < 3; i++) { const [px, pz] = tri[i], [qx, qz] = tri[(i + 1) % 3]; axes.push([-(qz - pz), qx - px]); }
  for (const [nx, nz] of axes) {
    let tMin = Infinity, tMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const [x, z] of tri) { const d = x * nx + z * nz; if (d < tMin) tMin = d; if (d > tMax) tMax = d; }
    for (const [x, z] of box) { const d = x * nx + z * nz; if (d < bMin) bMin = d; if (d > bMax) bMax = d; }
    if (tMax <= bMin + 1e-9 || bMax <= tMin + 1e-9) return false;   // touching is not overlapping: an edge on a cell boundary does not take the cell beyond
  }
  return true;
}

export function rasterFootprint(xz, cell) {
  const n = Math.floor(xz.length / 6);
  if (!n || !(cell > 0)) return { cell, minX: 0, minZ: 0, w: 0, h: 0, count: 0, bits: new Uint8Array(0), hit: () => false };
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n * 6; i += 2) { const x = xz[i], z = xz[i + 1]; if (x < minX) minX = x; if (x > maxX) maxX = x; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z; }
  minX -= cell; minZ -= cell;   // a clear margin round the geometry, so a pad never runs off the grid's edge into "solid"
  const w = Math.ceil((maxX - minX) / cell) + 2, h = Math.ceil((maxZ - minZ) / cell) + 2, bits = new Uint8Array(w * h);
  let count = 0;
  for (let t = 0; t < n; t++) {
    const k = t * 6, ax = xz[k], az = xz[k + 1], bx = xz[k + 2], bz = xz[k + 3], cx = xz[k + 4], cz = xz[k + 5];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell)), i1 = Math.min(w - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cell));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell)), j1 = Math.min(h - 1, Math.floor((Math.max(az, bz, cz) - minZ) / cell));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const at = j * w + i; if (bits[at]) continue;
      const x0 = minX + i * cell, z0 = minZ + j * cell;
      if (overlaps(ax, az, bx, bz, cx, cz, x0, z0, x0 + cell, z0 + cell)) { bits[at] = 1; count++; }
    }
  }
  const hit = (x, z, pad = 0) => {
    const i0 = Math.floor((x - pad - minX) / cell), i1 = Math.floor((x + pad - minX) / cell), j0 = Math.floor((z - pad - minZ) / cell), j1 = Math.floor((z + pad - minZ) / cell);
    for (let j = Math.max(0, j0); j <= Math.min(h - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(w - 1, i1); i++) if (bits[j * w + i]) return true;
    return false;
  };
  return { cell, minX, minZ, w, h, count, bits, hit };
}
