// THE NEXT SEAT, HIGHLIGHTED (owner, 2026-10-02: "switch from Rotor to Quiver should zoom out of the Rotor, highlight the Quiver, and obviously
// enter its POV"). A bright ring pulsing round the mount the hand-over is going to, for the length of the hand-over shot.
import * as THREE from '../../vendor/three.module.js';

// at: the mount's perch (scene units), up: its normal, size: a cell; returns dispose()
export function highlightSeat(scene, at, up, size, color = 0x6fe6ff) {
  const n = new THREE.Vector3(...up).normalize(), g = new THREE.Group();
  g.position.fromArray(at); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.5, size * 0.56, 48), mat); ring.rotation.x = -Math.PI / 2;   // a thin ring at the mount's foot: up close a column filled the frame
  g.add(ring); scene.add(g);
  const t0 = performance.now();
  ring.onBeforeRender = () => { const t = (performance.now() - t0) / 1000, k = 1 + 0.3 * Math.sin(t * 7); ring.scale.set(k, k, k); mat.opacity = 0.35 + 0.45 * Math.abs(Math.sin(t * 7)); };
  return () => { scene.remove(g); g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); };
}
