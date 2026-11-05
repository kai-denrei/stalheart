// THE CARCASS'S TUBES from its chain (moved from src/labs/boss/carcass.js `build`, owner 2026-11-05, round 5 notes 7 and 10; ./geometry.js makes the chain from a
// body's nodes). A centripetal Catmull-Rom curve through each limb's points and a tube of `chain.radial` sides along it, smooth shaded, its radius the measured
// spread under a taper from the root's to `tip` of it (`taper` its power), cut into `chain.segments` pieces of `chain.sub` rings, each capped at both ends; a core
// ellipsoid on the torso; the cracked core's chunks when asked. One merged geometry, native units. Plain numbers in, Three.js only: BELOW (kai-denrei/stalheart-cave)
// vendors this file as src/stalheart/carcass-tube.js, its one import pointed at its own three.js (test/descent-handoff.mjs checks the copy), and builds the same
// body over the hole's lip from the descent's handoff.
import * as THREE from '../../vendor/three.module.js';   // the one line changed from Stålheart's src/fx/boss-carcass/tube.js

const CORE = new THREE.SphereGeometry(1, 10, 8);   // the core's low sphere, scaled to the torso
const CHUNK = new THREE.IcosahedronGeometry(1, 0);  // a cracked core's chunk (the boss's, ./remains.js), jagged

// THE GEOMETRY of a chain (native units): { geometry, pieces: [{ limb, j, v0, v1, i0, i1, centre, radius }], home, homeNormals, full, core, coreRadii, chain };
// `extra` the boss's (./remains.js): `colors` a vertex colour a vertex (white), `chunks` ({ angle, lift } a chunk, src/domain/boss-carcass.js coreChunks) and
// `chunkSize` (of the core's radii): the cracked core's chunks after the core, faceted, each its own piece (limb -2, j its number; `radius` native)
export function chainGeometry(chain, C, extra = {}) {
  const CH = C.chain, R = CH.radial, S = CH.sub, K = CH.segments;
  const pos = [], nor = [], idx = [], pieces = [];
  const core = new THREE.Vector3(...chain.core), rad = chain.coreRadii.slice();
  const ring = (centre, n, b, r) => { for (let k = 0; k < R; k++) { const a = k / R * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a), nx = n.x * ca + b.x * sa, ny = n.y * ca + b.y * sa, nz = n.z * ca + b.z * sa; pos.push(centre.x + nx * r, centre.y + ny * r, centre.z + nz * r); nor.push(nx, ny, nz); } };
  const cap = (centre, n, b, t, r, sign) => {   // a flat disc across the tube, facing `sign` along it
    const v = pos.length / 3;
    pos.push(centre.x, centre.y, centre.z); nor.push(t.x * sign, t.y * sign, t.z * sign);
    for (let k = 0; k < R; k++) { const a = k / R * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a); pos.push(centre.x + (n.x * ca + b.x * sa) * r, centre.y + (n.y * ca + b.y * sa) * r, centre.z + (n.z * ca + b.z * sa) * r); nor.push(t.x * sign, t.y * sign, t.z * sign); }
    for (let k = 0; k < R; k++) { const p = v + 1 + k, q = v + 1 + (k + 1) % R; if (sign > 0) idx.push(v, p, q); else idx.push(v, q, p); }
  };
  for (const { limb, points, radii: measured } of chain.limbs) {
    const pts = points.map((p) => new THREE.Vector3(...p)), root = measured[0][1];
    const radius = (u) => {   // the measured spread, linearly between the rings, under the taper
      let m = measured[0][1];
      for (let i = 1; i < measured.length; i++) if (u <= measured[i][0]) { const [u0, r0] = measured[i - 1], [u1, r1] = measured[i]; m = r0 + (r1 - r0) * Math.min(1, Math.max(0, (u - u0) / ((u1 - u0) || 1))); break; } else m = measured[i][1];
      return Math.min(m, root * (CH.tip + (1 - CH.tip) * (1 - u) ** CH.taper));
    };
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), n = K * S, frames = curve.computeFrenetFrames(n, false);
    for (let j = 0; j < K; j++) {
      const v0 = pos.length / 3, i0 = idx.length;
      for (let s = 0; s <= S; s++) { const k = j * S + s, u = k / n; ring(curve.getPointAt(u), frames.normals[k], frames.binormals[k], radius(u)); }
      for (let s = 0; s < S; s++) for (let k = 0; k < R; k++) {
        const a = v0 + s * R + k, b = v0 + s * R + (k + 1) % R, c = a + R, d = b + R;
        idx.push(a, b, d, a, d, c);
      }
      const k0 = j * S, k1 = (j + 1) * S;
      cap(curve.getPointAt(k0 / n), frames.normals[k0], frames.binormals[k0], frames.tangents[k0], radius(k0 / n), -1);
      cap(curve.getPointAt(k1 / n), frames.normals[k1], frames.binormals[k1], frames.tangents[k1], radius(k1 / n), 1);
      pieces.push({ limb, j, v0, v1: pos.length / 3, i0, i1: idx.length, centre: curve.getPointAt((j + 0.5) / K), radius: radius((j + 0.5) / K) });
    }
  }
  // the core: the low sphere scaled to the torso's spread on each axis, its normals the ellipsoid's
  const v0 = pos.length / 3, i0 = idx.length, sp = CORE.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const px = sp.getX(i), py = sp.getY(i), pz = sp.getZ(i), nx = px / rad[0], ny = py / rad[1], nz = pz / rad[2], l = Math.hypot(nx, ny, nz) || 1;
    pos.push(core.x + px * rad[0], core.y + py * rad[1], core.z + pz * rad[2]); nor.push(nx / l, ny / l, nz / l);
  }
  for (const i of CORE.index.array) idx.push(v0 + i);
  pieces.push({ limb: -1, j: 0, v0, v1: pos.length / 3, i0, i1: idx.length, centre: core, radius: Math.max(rad[0], rad[2]) });
  // the cracked core's chunks (the boss's): a jagged low icosahedron each, inside the core, flat shaded
  (extra.chunks ?? []).forEach((ch, k) => {
    const cr = rad.map((r) => r * extra.chunkSize), c = new THREE.Vector3(core.x + Math.cos(ch.angle) * rad[0] * 0.45, core.y + ch.lift * rad[1] * 0.5, core.z + Math.sin(ch.angle) * rad[2] * 0.45);
    const ico = CHUNK.attributes.position, w0 = pos.length / 3, j0 = idx.length, a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
    const jag = (i) => 0.75 + 0.5 * Math.abs(Math.sin(i * 12.9898 + k * 78.233));   // the same corner the same jag: the faces stay closed
    const keyOf = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, corner = new Map();
    for (let i = 0; i < ico.count; i += 3) {
      const tri = [0, 1, 2].map((q) => { const x = ico.getX(i + q), y = ico.getY(i + q), z = ico.getZ(i + q), key = keyOf(x, y, z); if (!corner.has(key)) corner.set(key, jag(corner.size)); const f = corner.get(key); return new THREE.Vector3(c.x + x * cr[0] * f, c.y + y * cr[1] * f, c.z + z * cr[2] * f); });
      n.crossVectors(a.subVectors(tri[1], tri[0]), b.subVectors(tri[2], tri[0])).normalize();
      for (const v of tri) { pos.push(v.x, v.y, v.z); nor.push(n.x, n.y, n.z); }
      idx.push(w0 + i, w0 + i + 1, w0 + i + 2);
    }
    pieces.push({ limb: -2, j: k, v0: w0, v1: pos.length / 3, i0: j0, i1: idx.length, centre: c, radius: Math.max(cr[0], cr[2]) });
  });
  const g = new THREE.BufferGeometry(), home = Float32Array.from(pos), homeNormals = Float32Array.from(nor);
  g.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from(nor), 3).setUsage(THREE.DynamicDrawUsage));
  if (extra.colors) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(pos.length).fill(1), 3).setUsage(THREE.DynamicDrawUsage));
  const index = new THREE.BufferAttribute(pos.length / 3 > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx), 1).setUsage(THREE.DynamicDrawUsage);
  g.setIndex(index); g.computeBoundingSphere();
  return { geometry: g, pieces, home, homeNormals, full: index.array.slice(), core, coreRadii: rad, chain };
}
