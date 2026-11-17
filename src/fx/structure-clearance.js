// Cached local bounds for aerial clearance. Ground movement uses the finer
// triangle footprint instead, preserving lanes under the gantry and bridges.
import * as THREE from '../../vendor/three.module.js';
const cache = new WeakMap(), v = new THREE.Vector3(), inv = new THREE.Matrix4(), matrix = new THREE.Matrix4();
export function invalidateStructureBounds(record) { if(record.near)cache.delete(record.near);if(record.far)cache.delete(record.far); }
export function structureCeiling(record, point, pad) {
  const root=record.near??record.far;if(!root||record.holder.visible===false)return 0;
  record.holder.updateWorldMatrix(true,false);const e=record.holder.matrixWorld.elements;if(point[0]*e[12]+point[1]*e[13]+point[2]*e[14]<0)return 0;inv.copy(record.holder.matrixWorld).invert();
  let box=cache.get(root);
  if(!box){record.holder.updateWorldMatrix(true,true);box=new THREE.Box3();root.traverse(o=>{if(!o.isMesh||!o.geometry)return;for(let a=o;a&&a!==record.holder;a=a.parent)if(a.userData.collisionHidden)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(!b)return;
    matrix.multiplyMatrices(inv,o.matrixWorld);for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])box.expandByPoint(v.set(x,y,z).applyMatrix4(matrix));});cache.set(root,box);}
  if(box.isEmpty())return 0;
  const scale=record.holder.matrixWorld.getMaxScaleOnAxis(),r=pad/scale,q=v.fromArray(point).applyMatrix4(inv);
  if(q.x<box.min.x-r||q.x>box.max.x+r||q.z<box.min.z-r||q.z>box.max.z+r)return 0;
  return Math.max(0,v.set(q.x,box.max.y,q.z).applyMatrix4(record.holder.matrixWorld).length()-1);
}
