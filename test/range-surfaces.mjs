import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { RANGE_SURFACES, makeRangeSurface, surfaceNormal } from '../src/labs/range-surfaces.js';
for (const kind of Object.keys(RANGE_SURFACES)) {
  const object = makeRangeSurface(kind, 3, 35);
  object.position.set(0, 1, 12); object.updateMatrixWorld(true);
  const normal = new THREE.Vector3().fromArray(surfaceNormal(object, [0, 1, 0]));
  assert(Math.abs(normal.length() - 1) < 1e-6);
  assert(normal.z < 0 && normal.x < 0);
  // The aim point actually lies on the material face at an oblique incidence.
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1));
  const hit = ray.intersectObject(object, true).find(h => h.object.isMesh);
  assert(hit && hit.point.distanceTo(object.position) < 1e-5, kind);
}
console.log('Wall, armour and hull targets keep contact points on their angled surfaces.');
