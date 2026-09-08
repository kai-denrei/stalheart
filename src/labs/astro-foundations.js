import * as THREE from '../../vendor/three.module.js';
// Shared authored 4 m fortification tiles, two across for a vehicle-width spine.
export function createAstroFoundations(source,stops){
 const group=new THREE.Group(),tiles=new Map();
 function strip(a,b){
  const ax=Math.round(a[0]/4)*4,az=Math.round(a[1]/4)*4,bx=Math.round(b[0]/4)*4,bz=Math.round(b[1]/4)*4,vertical=ax===bx;
  const minX=Math.min(ax,bx)-(vertical?4:0),maxX=Math.max(ax,bx)+(vertical?4:4),minZ=Math.min(az,bz)-(vertical?0:4),maxZ=Math.max(az,bz)+(vertical?4:4);
  for(let x=minX+2;x<maxX;x+=4)for(let z=minZ+2;z<maxZ;z+=4)tiles.set(`${x},${z}`,[x,z]);
 }

 // One spine, with branches ending outside the machinery's collision footprint.
 const minZ=Math.min(-12,...stops.map(p=>p[1])),maxZ=Math.max(16,...stops.map(p=>p[1]));strip([0,minZ],[0,maxZ]);for(const p of stops)strip([0,p[1]],p);
 source.updateMatrixWorld(true);source.traverse(o=>{if(!o.isMesh)return;const mesh=new THREE.InstancedMesh(o.geometry,o.material,tiles.size),matrix=new THREE.Matrix4();let i=0;for(const [x,z] of tiles.values()){matrix.makeTranslation(x,.025,z).multiply(o.matrixWorld);mesh.setMatrixAt(i++,matrix);}mesh.castShadow=false;mesh.receiveShadow=true;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();group.add(mesh);});
 group.userData.tiles=tiles.size;group.userData.dispose=()=>group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});return group;
}
