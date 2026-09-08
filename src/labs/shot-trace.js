import * as THREE from '../../vendor/three.module.js';
import { makeTracerMesh } from '../shotfx.js';

// Scope assistance only: samples the simulated shot, never changes its flight.
export function createShotTrace(){
  const group=new THREE.Group(),capacity=512,points=new Float32Array(capacity*3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(points,3));geometry.setDrawRange(0,0);
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xe8f6ff,transparent:true,opacity:.8,depthWrite:false}));
  const head=makeTracerMesh(0xffffff,14,0);group.add(line,head);
  let count=0;
  return {group,
    sample(p){
      if(count===capacity){points.copyWithin(0,3);count--;}
      points.set(p,count++*3);geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;
      geometry.computeBoundingSphere();head.geometry.attributes.position.setXYZ(0,...p);
      head.geometry.attributes.position.needsUpdate=true;head.geometry.computeBoundingSphere();
    },
    fade(value){line.material.opacity=.8*value;head.material.opacity=.95*value;},
    state:()=>({samples:count,end:Array.from(points.slice(Math.max(0,count-1)*3,count*3))}),
  };
}
