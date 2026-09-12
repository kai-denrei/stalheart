import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/meshopt_decoder.module.js';
import { mergeGeometries, deinterleaveGeometry } from '../vendor/BufferGeometryUtils.js';

// One pinned geometry upload, three body batches and one optional exhaust batch.
// Instances share resources. A shot never disposes the pool's geometry/materials.
export async function createMissilePool({ capacity = 64, mesh:variant = 'dart' } = {}) {
  if(!['dart','talon'].includes(variant))throw Error('Unknown missile mesh');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(`assets/models/missile-kit/${variant}.glb`);
  const source = gltf.scene;
  source.getObjectByName('EXHAUST_FX').scale.setScalar(1);
  source.updateMatrixWorld(true);
  const prototype = new THREE.Group(), batches = new Map();
  prototype.name='MISSILE_MOTION';
  source.traverse(node => {
    if (!node.isMesh) return;
    let exhaust = false;
    for (let n = node; n; n = n.parent) if (n.name === 'EXHAUST_FX') exhaust = true;
    const key = `${node.material.uuid}/${exhaust}`;
    if (!batches.has(key)) batches.set(key, { material: node.material, exhaust, geometries: [] });
    const geometry=node.geometry.clone();
    deinterleaveGeometry(geometry);
    geometry.applyMatrix4(node.matrixWorld);
    batches.get(key).geometries.push(geometry);
  });
  let triangles = 0;
  for (const batch of batches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    for (const g of batch.geometries) g.dispose();
    if (!geometry) throw Error('DART material batch could not be merged');
    const mesh = new THREE.Mesh(geometry, batch.material);
    mesh.name = batch.exhaust ? 'EXHAUST_FX' : variant.toUpperCase()+'_BODY';
    if (batch.exhaust) mesh.visible = false;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    prototype.add(mesh);
  }
  for (const name of ['TIP_SOCKET','EXHAUST_SOCKET']) {
    const socket = new THREE.Object3D(); socket.name = name;
    source.getObjectByName(name).getWorldPosition(socket.position); prototype.add(socket);
  }
  const sourceGeometries = new Set(); source.traverse(n => { if(n.geometry)sourceGeometries.add(n.geometry); });
  for (const g of sourceGeometries) g.dispose();
  const live = new Set(), free = [];
  let allocated = 0, disposed = false;
  const axis = new THREE.Vector3(0,0,1), direction = new THREE.Vector3();
  return {
    get available() { return !disposed && (free.length > 0 || allocated < capacity); },
    stats() { return { triangles, batches: batches.size, capacity, allocated, active: live.size, free: free.length }; },
    acquire(length) {
      if (!this.available) return null;
      let mesh = free.pop();
      if (!mesh) { mesh = prototype.clone(true); allocated++; }
      mesh.scale.setScalar(length / 1.49); mesh.visible = true;
      mesh.getObjectByName('EXHAUST_FX').visible = false;
      live.add(mesh); return mesh;
    },
    pose(mesh, pose, exhaust = true) {
      mesh.position.fromArray(pose.position);
      direction.fromArray(pose.direction).normalize();
      mesh.quaternion.setFromUnitVectors(axis, direction);
      mesh.getObjectByName('EXHAUST_FX').visible = exhaust && pose.ignition;
    },
    release(mesh) {
      if (!live.delete(mesh)) return;
      mesh.removeFromParent(); mesh.visible = false; free.push(mesh);
    },
    dispose() {
      if(disposed)return; disposed=true;
      for(const mesh of [...live])this.release(mesh);
      free.length=0;
      const materials=new Set();
      prototype.traverse(n=>{n.geometry?.dispose();if(n.material)materials.add(n.material);});
      for(const material of materials)material.dispose();
    },
  };
}
