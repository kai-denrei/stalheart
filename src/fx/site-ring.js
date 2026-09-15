// The site marker (moved out of src/td-tab.js): a ring of points on the wall top, in the tower's own colour, that says "something is
// coming here". It is the ONLY thing an ordered-but-unbuilt cell shows until Isao arrives; the tower itself grows out of the ground
// while he prints it, which is a better progress bar than a progress bar. Unit-sphere host coordinates.
import * as THREE from '../../vendor/three.module.js';

const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function makeSiteRing(scene, center, normal, cellSide, wallHeight, color) {
  const theta = cellSide * 0.42, c = norm(center);
  const ref = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm(cross(normal, ref)), t2 = cross(normal, t1), pos = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    const d = [0, 1, 2].map((k) => t1[k] * ca + t2[k] * sa);
    const p = norm([0, 1, 2].map((k) => c[k] * Math.cos(theta) + d[k] * Math.sin(theta))), r = 1 + wallHeight * 1.02;
    pos.push(p[0] * r, p[1] * r, p[2] * r);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const ring = new THREE.Points(geo, new THREE.PointsMaterial({ size: 3.0, sizeAttenuation: false, color, transparent: true, opacity: 0.9 }));
  scene.add(ring);
  return ring;
}

export function disposeSiteRing(scene, ring) {
  scene.remove(ring);
  ring.geometry.dispose();
  ring.material.dispose();
}
