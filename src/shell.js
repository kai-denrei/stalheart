import * as THREE from '../vendor/three.module.js';
import { SHELL_GEOMETRY } from './content/shell-geometry.js';
// Synchronous, owned geometry: no old projectile fallback while a GLB loads.
export function makeOrdnanceShell(length=1,axis='z'){
 const geometry=new THREE.BufferGeometry();
 for(const [key,values] of Object.entries(SHELL_GEOMETRY))geometry.setAttribute(key==='positions'?'position':key==='normals'?'normal':'color',new THREE.Float32BufferAttribute(values,3));
 geometry.scale(length,length,length);if(axis==='y')geometry.rotateX(-Math.PI/2);
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.4}));
 mesh.name='OLIVE_SHELL';mesh.userData.ordnance='olive-shell';return mesh;
}
