import * as THREE from '../vendor/three.module.js';

// All sealed holes share one draw call. Matrices change only when a cap is added.
export function createBreachRubble(scene){
 const rocksPerCap=24,geometry=new THREE.DodecahedronGeometry(1,0),material=new THREE.MeshBasicMaterial({color:0x82919c,vertexColors:true});
 // Bake facet contrast once, so rocks remain legible on the unlit TRON side.
 const normals=geometry.attributes.normal,colors=new Float32Array(normals.count*3);
 for(let i=0;i<normals.count;i++){const shade=.28+.48*Math.max(0,normals.getX(i)*.4+normals.getY(i)*.8+normals.getZ(i)*.3);colors.fill(shade,i*3,i*3+3);}
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 let capacity=96,mesh=new THREE.InstancedMesh(geometry,material,capacity),caps=0;
 mesh.name='Sealed breach rubble';mesh.count=0;scene.add(mesh);
 const dummy=new THREE.Object3D(),local=new THREE.Vector3(),frame=new THREE.Matrix4(),matrix=new THREE.Matrix4();
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
    dummy.scale.set(size*1.5,size*.65,size).multiplyScalar(source.scale.x);dummy.updateMatrix();mesh.setMatrixAt(mesh.count++,dummy.matrix);
   }
   caps++;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  },
  state:()=>({caps,rocks:mesh.count,drawCalls:mesh.count?1:0,triangles:mesh.count*geometry.attributes.position.count/3}),
  reset(){caps=0;mesh.count=0;},
  dispose(){scene.remove(mesh);mesh.dispose();geometry.dispose();material.dispose();},
 };
}
