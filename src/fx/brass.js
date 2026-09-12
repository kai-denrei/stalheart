// Ejected brass: the Rotor's spent cases, instanced. One tiny case mesh from
// the ammunition library, one InstancedMesh, a small pool of cases each with
// a position, a velocity and a spin; gravity is toward the planet's centre,
// a case stops on the rock roof it landed on and fades out. Nothing here is
// a bullet: the rounds are tracers, the brass is what falls out of the gun.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
export const BRASS_CASE = 'assets/models/ammunition/rotor_light_case_game.glb';
export function createBrass(scene, { metres, capacity = 48, life = 3.2, sizeMul = 2.5, gravity = 9.8, url = BRASS_CASE } = {}) {
  const cases = [], mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), up = new THREE.Vector3(), tmp = new THREE.Vector3(), axis = new THREE.Vector3();
  let mesh = null, next = 0;
  if (typeof document !== 'undefined') new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then((gltf) => {
    let src = null; gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o; }); if (!src) return;
    mesh = new THREE.InstancedMesh(src.geometry, src.material, capacity); mesh.name = 'brass'; mesh.frustumCulled = false; mesh.castShadow = false;
    for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0)); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(mesh);
  }).catch(() => {});
  return {
    ready: () => !!mesh,
    live: () => cases.filter((c) => c.t < life).length,
    // eject from a node's world position, sideways along its +X (or -X), a touch upward; floorR is the radius of the roof under the mount
    eject(node, { side = 1, floorR = 1, speed = 3.2, lift = 2.2 } = {}) {
      if (!mesh) return false;
      node.getWorldPosition(pos); node.getWorldQuaternion(q); up.copy(pos).normalize();
      const right = tmp.set(side, 0, 0).applyQuaternion(q).addScaledVector(up, -tmp.dot(up)).normalize();
      const v = new THREE.Vector3().copy(right).multiplyScalar(speed * (0.8 + Math.random() * 0.4)).addScaledVector(up, lift * (0.8 + Math.random() * 0.4)).multiplyScalar(metres);
      const c = cases[next] ?? (cases[next] = {}); next = (next + 1) % capacity;
      Object.assign(c, { p: pos.clone().addScaledVector(right, 0.25 * metres), v, t: 0, floorR, rest: false, spin: new THREE.Quaternion().setFromAxisAngle(axis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), (2 + Math.random() * 6) * 0.016), rot: new THREE.Quaternion().copy(q) });
      return true;
    },
    tick(dt) {
      if (!mesh) return;
      cases.forEach((c, i) => {
        if (c.t >= life) { mesh.setMatrixAt(i, mat4.makeScale(0, 0, 0)); return; }
        c.t += dt;
        if (!c.rest) {
          up.copy(c.p).normalize(); c.v.addScaledVector(up, -gravity * metres * dt); c.p.addScaledVector(c.v, dt); c.rot.multiply(c.spin);
          if (c.p.length() <= c.floorR) { c.p.setLength(c.floorR); c.rest = true; }   // on the roof: it stays where it fell
        }
        const s = metres * sizeMul * (c.t > life - 0.6 ? Math.max(0, (life - c.t) / 0.6) : 1);   // the last 0.6 s shrink it away rather than pop
        mesh.setMatrixAt(i, mat4.compose(c.p, c.rot, tmp.set(s, s, s)));
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { if (mesh) { scene.remove(mesh); mesh.dispose(); } },
  };
}
