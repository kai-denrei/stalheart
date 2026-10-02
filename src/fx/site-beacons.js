// THE ROCKETS THAT CAME DOWN OFF COURSE (owner, 2026-10-02: "first beat, after the player gets control of the camera; we highlight on the
// planet where other rockets have mislanded, it gives a sense of side-mission"). Each lander the player has not been to yet sends a
// distress pulse now and then (owner, 2026-10-02, seventh notes: "should not be constant… a light pulse once in a while. Emanating from
// the rocket, not the ground"): a flare at the rocket's own top, a ring of light running out from it and a short streak upward, every
// `period` seconds, the sites out of step with each other. Gone once its site is visited.
import * as THREE from '../../vendor/three.module.js';

const UP = new THREE.Vector3(0, 1, 0), box = new THREE.Box3(), v = new THREE.Vector3();

// the point of a placed model farthest out along `n`: its bounding box's corner furthest up, back on the box's axis. Null while it is empty
function topOf(obj, n) {
  if (!obj) return null;
  box.setFromObject(obj);
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3());
  let h = 0;
  for (let i = 0; i < 8; i++) { v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z); h = Math.max(h, v.sub(c).dot(n)); }
  return c.addScaledVector(n, h);
}

// sites: [{ id, ci?: its lattice cell (the harness), point: unit vector, model?: () => Object3D }]; metres: scene units per metre
export function createSiteBeacons(scene, sites, { metres, color = 0xffb347, period = 5.5, flash = 1.6, reach = 70, streak = 60, fallback = 30 } = {}) {
  const group = new THREE.Group(); group.name = 'site beacons'; scene.add(group);
  const add = (geo) => new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beams = new Map();
  sites.forEach((s, i) => {
    const n = new THREE.Vector3(...s.point).normalize();
    const holder = new THREE.Group(); holder.quaternion.setFromUnitVectors(UP, n);
    holder.position.copy(n).multiplyScalar(1 + fallback * metres);   // until the model is in: a lander's height over the site
    const flare = add(new THREE.SphereGeometry(2.4 * metres, 16, 12));
    const ring = add(new THREE.RingGeometry(0.92, 1, 48)); ring.rotation.x = -Math.PI / 2;
    const ray = add(new THREE.CylinderGeometry(0.15 * metres, 0.9 * metres, 1, 8, 1, true));
    holder.add(flare, ring, ray); holder.visible = false; group.add(holder);
    beams.set(s.id, { ci: s.ci ?? -1, holder, flare, ring, ray, n, model: s.model, placed: false, phase: (i * 0.37 % 1) * period });
  });
  let time = 0, look = 0;
  return {
    tick(dt) {
      time += dt; look -= dt;
      for (const b of beams.values()) {
        if (!b.placed && look <= 0) { const top = topOf(b.model?.(), b.n); if (top) { b.holder.position.copy(top); b.placed = true; } }
        const u = ((time + b.phase) % period) / flash;
        b.holder.visible = u < 1;
        if (u >= 1) continue;
        const fade = (1 - u) * (1 - u), e = 1 - (1 - u) ** 3;
        b.flare.material.opacity = 0.95 * fade; b.flare.scale.setScalar(1 + 2.5 * e);
        const r = reach * metres * e; b.ring.scale.set(r, r, r); b.ring.material.opacity = 0.7 * fade;
        b.ray.scale.set(1, streak * metres * e + 1e-4, 1); b.ray.position.y = streak * metres * e * 0.5; b.ray.material.opacity = 0.6 * fade;
      }
      if (look <= 0) look = 1;   // a model still loading is looked for once a second
    },
    // a site visited: its beacon goes
    drop(id) { const b = beams.get(id); if (!b) return; group.remove(b.holder); b.holder.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); beams.delete(id); },
    ids: () => [...beams.keys()],
    // the harness: where each pulse comes from (on the model's top once it is in) and whether one is lit now
    state: () => [...beams.entries()].map(([id, b]) => ({ id, ci: b.ci, placed: b.placed, lit: b.holder.visible, height: +(b.holder.position.length() - 1).toFixed(4) })),
    dispose() { for (const id of [...beams.keys()]) this.drop(id); scene.remove(group); },
  };
}
