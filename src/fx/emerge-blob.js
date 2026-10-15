// THE BLOB AT THE LIP (owner, 2026-10-16: "a separate fake animation of blob emerging, and then we generate the actual rammable enemies already
// out"; EMERGENCE in src/content/story-defaults.js, the pose src/domain/emerge-climb.js): a pool of dark blobs in the tint of what is coming.
// The enemy loop spawns one per record made at a breach's own cell (src/fx/enemy-step.js): it starts in the hole at the lip, crests it, slides
// out to where the record waits under the ground and fades as the record pops up. Nothing here is a target, a body or a record: it is a picture.
//   createEmergeBlobs(scene, { capacity }) -> { spawn({ center, dir, lip, out, size, tint, delay, climb }), step(dt), count(), dispose() }
//     center: the breach cell's centre (unit sphere), dir: the unit tangent toward the record's start, lip/out: world distances from the centre
//     to the lip and to the record's start, size: the record's drawn scale (world), tint: hex, delay: seconds before it starts, climb: seconds
import * as THREE from '../../vendor/three.module.js';
import { climbPose } from '../domain/emerge-climb.js';

export function createEmergeBlobs(scene, { capacity = 64 } = {}) {
  const geo = new THREE.SphereGeometry(1, 12, 9), free = [], live = [], v = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < capacity; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.frustumCulled = false; scene.add(m); free.push(m);
  }
  function spawn({ center, dir, lip, out, size, tint = 0x303030, delay = 0, climb = 1.1 }) {
    const m = free.pop(); if (!m) return false;
    c.setHex(tint).multiplyScalar(0.55); m.material.color.copy(c);
    live.push({ m, center, dir, lip, out, size, t: -delay, climb });
    return true;
  }
  function step(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const b = live[i]; b.t += dt;
      if (b.t < 0) { b.m.visible = false; continue; }
      const u = b.t / b.climb, p = climbPose(u);
      if (u >= 1) { b.m.visible = false; free.push(b.m); live.splice(i, 1); continue; }
      const r = b.lip + (b.out - b.lip) * p.r;
      v.set(b.center[0] + b.dir[0] * r, b.center[1] + b.dir[1] * r, b.center[2] + b.dir[2] * r).normalize().multiplyScalar(1 + p.h * b.size);
      b.m.position.copy(v); b.m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize());
      b.m.scale.set(b.size * p.scale, b.size * p.scale * 0.6, b.size * p.scale);
      b.m.material.opacity = 0.92 * p.opacity; b.m.visible = true;
    }
  }
  function dispose() { for (const m of [...free, ...live.map((b) => b.m)]) { scene.remove(m); m.material.dispose(); } geo.dispose(); free.length = 0; live.length = 0; }
  return { spawn, step, count: () => live.length, dispose };
}
