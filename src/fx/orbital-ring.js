// THE RING IN THE SKY (docs/superpowers/specs/2026-10-02-orbital-works-design.md): every collector the ARC-01 has put up is a point of
// light on one tilted ring round the planet, `radius` planet radii out. A Points cloud sized for the ring's capacity, its draw range
// the collectors in orbit, so the ring fills in run over run and costs one draw. The scene's unit is the planet's radius.
import * as THREE from '../../vendor/three.module.js';

export function createOrbitalRing(scene, tune) {
  const n = tune.capacity, pos = new Float32Array(n * 3), tilt = (tune.tiltDeg * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 * 0.618 * 7;   // a golden-ish stride round the ring: the first few are spread, not bunched
    const x = Math.cos(a) * tune.radius, z = Math.sin(a) * tune.radius;
    pos[i * 3] = x; pos[i * 3 + 1] = z * Math.sin(tilt); pos[i * 3 + 2] = z * Math.cos(tilt);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: tune.size, sizeAttenuation: false, color: tune.color, transparent: true, opacity: 0.95, depthWrite: false }));
  pts.frustumCulled = false; pts.renderOrder = -1;
  scene.add(pts);
  let count = 0;
  return {
    set(k) { count = Math.max(0, Math.min(n, k | 0)); geo.setDrawRange(0, count); pts.visible = count > 0; },
    tick(time) { pts.material.opacity = 0.75 + 0.2 * Math.sin(time * 1.3); pts.rotation.y = time * 0.004; },   // a slow drift round the planet
    state: () => ({ count, visible: pts.visible }),
    dispose() { scene.remove(pts); geo.dispose(); pts.material.dispose(); },
  };
}
