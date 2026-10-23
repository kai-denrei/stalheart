// ROCK CHUNKS (lifted out of src/fx/feids-heat.js, 2026-10-23, spec docs/superpowers/specs/2026-10-23-arena-road-and-blob-design.md decision 3: "add the
// rubble the drop now has ... a second copy is NOT acceptable: reuse"). The drop's touchdown burst (the owner's demo, SentryTowers_A6 ridgeback-drop/
// effects.js): 24 rock chunks thrown from a ring round a point, 6..11 m/s out and 4..8 m/s up, ballistic under 9.8 m/s2, resting where they fall and
// staying as rubble; a function of the burst's clock (no history: a seek, a skip or a slow frame lands on the same picture). In metres, y up; the
// caller's group places and scales them. Used by the FEIDS-26 drop (src/fx/feids-heat.js touchdownFx) and by the Nih-Dairia breaking the surface at
// THE ARENA's lip (src/fx/emerge-blob.js rubble, src/fx/enemy-step.js).
//   chunkAt(i, index, tau, out, ring)  -> chunk i's offset from the centre (metres, y up) and its tumble `tau` s after the burst; `index` varies the set
//                                         (the drop's mech), `ring` the radius it is thrown from (the drop's 0.8 m round the feet; the lip's radius) (pure)
//   chunkSize(i, index)                -> its drawn size in metres (0.14..0.34)
//   createRockChunks({ geometry, material, index, ring, bend }) -> { mesh, update(tau), dispose() }: one InstancedMesh of CHUNKS; `bend` lowers a
//                                         resting chunk by d^2 * bend / 2 (the planet's curve, 1 / its radius in the group's metres; 0 flat)
//   createRockBursts(scene, { capacity, hold }) -> { burst({ center, dir, offset, metre, scale, ring, index, delay }), step(dt), count(), dispose() }:
//                                         a pool of bursts on the unit sphere (`center` the ground's unit point, `offset` metres along the tangent `dir`,
//                                         `metre` world units a metre, `scale` the burst's size over the drop's), each kept `hold` s as rubble
import * as THREE from '../../vendor/three.module.js';

export const CHUNKS = 24, ROCK = 0x515d64, G = 9.8;
const frac = (x) => x - Math.floor(x);

export function chunkAt(i, index, tau, out = { x: 0, y: 0, z: 0, spin: 0, resting: false }, ring = 0.8) {
  const a = i * 2.399 + index * 0.9, speed = 6 + 5 * frac(i * 0.618 + index * 0.31), up = 4 + 4 * frac(i * 0.427 + index * 0.17), flight = 2 * up / G;
  const k = Math.max(0, Math.min(tau, flight)), r = ring + speed * k;
  out.x = Math.cos(a) * r; out.z = Math.sin(a) * r; out.resting = tau >= flight; out.y = out.resting ? 0 : Math.max(0, up * k - 0.5 * G * k * k); out.spin = k * (4 + (i % 5));
  return out;
}
export const chunkSize = (i, index) => 0.14 + 0.2 * frac(i * 0.733 + index * 0.29);

export function createRockChunks({ geometry, material, index = 0, ring = 0.8, bend = 0 }) {
  const mesh = new THREE.InstancedMesh(geometry, material, CHUNKS); mesh.frustumCulled = false; mesh.userData.shared = true;
  const o = new THREE.Object3D(), c = { x: 0, y: 0, z: 0, spin: 0, resting: false }, sizes = Array.from({ length: CHUNKS }, (_, i) => chunkSize(i, index));
  return {
    mesh,
    update(tau) {
      for (let i = 0; i < CHUNKS; i++) {
        chunkAt(i, index, tau, c, ring); const r = sizes[i];
        o.position.set(c.x, c.y + r * 0.45 - (c.x * c.x + c.z * c.z) * bend * 0.5, c.z); o.rotation.set(c.spin, c.spin * 0.7 + i, c.spin * 0.4); o.scale.set(r, r * 0.75, r * 1.1); o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { mesh.dispose(); },
  };
}

export function createRockBursts(scene, { capacity = 2, hold = 60 } = {}) {
  const geometry = new THREE.IcosahedronGeometry(1, 0), material = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 1, flatShading: true });
  const live = [], up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3();
  function burst({ center, dir = null, offset = 0, metre, scale = 1, ring = 0.8 * scale, index = 0, delay = 0 }) {   // ring: metres (the drop's 0.8 m, scaled with the burst)
    if (!center || !(metre > 0)) return false;
    if (live.length >= capacity) drop(0);
    const s = metre * scale, p = dir ? center.map((v, k) => v + dir[k] * offset * metre) : center.slice();
    n.set(p[0], p[1], p[2]).normalize();
    const chunks = createRockChunks({ geometry, material, index, ring: ring / scale, bend: s });   // bend: 1 / the planet's radius in the group's units (the unit sphere is 1 / s of them)
    const group = new THREE.Group(); group.add(chunks.mesh); group.visible = false; group.position.copy(n); group.quaternion.setFromUnitVectors(up, n); group.scale.setScalar(s);
    scene.add(group); live.push({ group, chunks, t: -delay });
    return true;
  }
  function drop(i) { const b = live[i]; scene.remove(b.group); b.chunks.dispose(); live.splice(i, 1); }
  function step(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]; b.t += dt;
      if (b.t >= hold) { drop(i); continue; }
      b.group.visible = b.t >= 0; if (b.t >= 0) b.chunks.update(b.t);
    }
  }
  function dispose() { while (live.length) drop(0); geometry.dispose(); material.dispose(); }
  return { burst, step, count: () => live.length, dispose };
}
