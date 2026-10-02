// THE ROCKETS THAT CAME DOWN OFF COURSE (owner, 2026-10-02: "first beat, after the player gets control of the camera; we highlight on the
// planet where other rockets have mislanded, it gives a sense of side-mission"). A tall pulsing light column and a ground ring over each
// landing site the player has not been to yet, readable from the orbit camera the landing hands over, gone once its site is visited.
import * as THREE from '../../vendor/three.module.js';

// sites: [{ id, point: unit vector }]; metres: scene units per metre
export function createSiteBeacons(scene, sites, { metres, color = 0xffb347, height = 140, radius = 2.2 } = {}) {
  const group = new THREE.Group(); group.name = 'site beacons'; scene.add(group);
  const beams = new Map();
  for (const s of sites) {
    const n = new THREE.Vector3(...s.point).normalize();
    const holder = new THREE.Group(); holder.position.copy(n); holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.35 * metres, radius * metres, height * metres, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = height * metres * 0.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 3 * metres, radius * 3.6 * metres, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4 * metres;
    holder.add(beam, ring); group.add(holder); beams.set(s.id, { holder, beam, ring });
  }
  let time = 0;
  return {
    tick(dt) { time += dt; for (const b of beams.values()) { b.beam.material.opacity = 0.28 + 0.18 * Math.sin(time * 2.4); const k = 1 + 0.25 * Math.sin(time * 2.4); b.ring.scale.set(k, k, k); } },
    // a site visited: its beacon goes
    drop(id) { const b = beams.get(id); if (!b) return; group.remove(b.holder); b.holder.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); beams.delete(id); },
    ids: () => [...beams.keys()],
    dispose() { for (const id of [...beams.keys()]) this.drop(id); scene.remove(group); },
  };
}
