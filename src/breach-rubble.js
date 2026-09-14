import * as THREE from '../vendor/three.module.js';

// All sealed holes share one draw call. Matrices change only while a cap is settling.
// THE ROCKS PILE UP (owner, 2026-09-14): a new cap does not appear whole. Each rock drops in from above the hole and
// grows to size, staggered from the rim inward, so the hole reads as filled in over SETTLE_S; update(dt) drives it and
// takes the game's frozen-aware delta.
export const SETTLE_S = 1.2;
const DROP = 2.2;   // how far above its resting place a rock starts, in crater radii

export function createBreachRubble(scene){
 const rocksPerCap=24,geometry=new THREE.DodecahedronGeometry(1,0),material=new THREE.MeshBasicMaterial({color:0x82919c,vertexColors:true});
 // Bake facet contrast once, so rocks remain legible on the unlit TRON side.
 const normals=geometry.attributes.normal,colors=new Float32Array(normals.count*3);
 for(let i=0;i<normals.count;i++){const shade=.28+.48*Math.max(0,normals.getX(i)*.4+normals.getY(i)*.8+normals.getZ(i)*.3);colors.fill(shade,i*3,i*3+3);}
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 let capacity=96,mesh=new THREE.InstancedMesh(geometry,material,capacity),caps=0;
 mesh.name='Sealed breach rubble';mesh.count=0;scene.add(mesh);
 const dummy=new THREE.Object3D(),local=new THREE.Vector3(),frame=new THREE.Matrix4(),matrix=new THREE.Matrix4();
 const settling=[];   // { index, position, quaternion, scale, up, drop, delay, t }
 function write(r,k){
  // k 0..1: the rock falls along its radial and grows; eased so it lands, not glides
  const e=1-(1-k)**3;
  dummy.position.copy(r.position).addScaledVector(r.up,r.drop*(1-e));dummy.quaternion.copy(r.quaternion);dummy.scale.copy(r.scale).multiplyScalar(Math.max(.001,e));dummy.updateMatrix();mesh.setMatrixAt(r.index,dummy.matrix);
 }
 return {
  add(source,radius){
   if(mesh.count+rocksPerCap>capacity){capacity*=2;const next=new THREE.InstancedMesh(geometry,material,capacity);next.name=mesh.name;next.count=mesh.count;for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);next.setMatrixAt(i,matrix);}scene.remove(mesh);mesh.dispose();mesh=next;scene.add(mesh);}
   source.updateWorldMatrix(true,false);frame.copy(source.matrixWorld);
   for(let i=0;i<rocksPerCap;i++){
    const a=i*2.399963229728653,r=i===0?0:Math.sqrt(i/(rocksPerCap-1))*radius*.98;
    const size=radius*(i===0?.55:.23+.08*(.5+.5*Math.sin(i*7)));
    local.set(Math.cos(a)*r,Math.max(.025,radius*.30*(1-r/radius)),Math.sin(a)*r);
    // Project the footprint to the host unit sphere; keep the mound radial.
    const world=local.clone().setY(0).applyMatrix4(frame).normalize();
    const height=local.y*source.scale.x;
    dummy.position.copy(world).multiplyScalar(1+height);dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),world);dummy.rotateY(a);dummy.rotateZ(Math.sin(i*3)*.3);
    dummy.scale.set(size*1.5,size*.65,size).multiplyScalar(source.scale.x);
    // rim rocks land first, the keystone in the middle last
    const rock={index:mesh.count++,position:dummy.position.clone(),quaternion:dummy.quaternion.clone(),scale:dummy.scale.clone(),up:world.clone(),drop:radius*DROP*source.scale.x,delay:(1-r/radius)*SETTLE_S*.45,t:0};
    settling.push(rock);write(rock,0);
   }
   caps++;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  },
  update(dt){
   if(!(dt>0)||!settling.length)return;
   for(let i=settling.length-1;i>=0;i--){
    const r=settling[i];r.t+=dt;const k=Math.min(1,Math.max(0,(r.t-r.delay)/(SETTLE_S*.55)));write(r,k);
    if(k>=1)settling.splice(i,1);
   }
   mesh.instanceMatrix.needsUpdate=true;
   if(!settling.length)mesh.computeBoundingSphere();
  },
  state:()=>({caps,rocks:mesh.count,settling:settling.length,drawCalls:mesh.count?1:0,triangles:mesh.count*geometry.attributes.position.count/3}),
  reset(){caps=0;mesh.count=0;settling.length=0;},
  dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();},
 };
}
