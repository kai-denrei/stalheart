// THE BIOMASS ON THE GROUND (owner, 2026-11-05, round 8 note 7; src/domain/biomass-field.js): every pile of the field is one instance of an olive
// blob (the author's slurry colour, src/content/rover.js PILE_LOOK) on the floor where the bodies fell, its size the cube root of its kg. One
// instanced mesh, capped at the field's maxPiles, redrawn only when the field's version moves. Unit-sphere host coordinates (floor at radius 1).
//   createBiomassPiles(scene, { metres, look, max, centers }) -> { sync(field), count(), dispose() }
import * as THREE from '../../vendor/three.module.js';

export function createBiomassPiles(scene, { metres, look, max, centers }) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  // lumpy: the blob is not a ball
  { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.18 * Math.sin(p.getX(i) * 7.1 + p.getZ(i) * 3.3) * Math.cos(p.getY(i) * 5.7); p.setXYZ(i, p.getX(i) * k, Math.max(-0.35, p.getY(i)) * k, p.getZ(i) * k); } geo.computeVertexNormals(); }
  const mat = new THREE.MeshStandardMaterial({ color: look.colour, roughness: 0.85, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, mat, max); mesh.name = 'biomass piles'; mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
  scene.add(mesh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), spin = new THREE.Quaternion(), up = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), at = new THREE.Vector3();
  let seen = -1;
  return {
    sync(field) {
      if (field.version() === seen) return;
      seen = field.version();
      const piles = field.piles().slice(-max);
      piles.forEach((p, i) => {
        const c = centers()[p.cell]; if (!c) return;
        up.set(c[0], c[1], c[2]).normalize(); at.copy(up);
        q.setFromUnitVectors(Y, up).multiply(spin.setFromAxisAngle(Y, (p.cell * 2.399) % 6.283));
        const r = Math.min(look.maxMetres, look.metres * Math.cbrt(p.kg)) * metres;
        m.compose(at, q, s.set(r, r * look.flat, r)); mesh.setMatrixAt(i, m);
      });
      mesh.count = piles.length; mesh.instanceMatrix.needsUpdate = true;
    },
    count: () => mesh.count,
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); },
  };
}
