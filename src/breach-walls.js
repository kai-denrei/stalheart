import * as THREE from '../vendor/three.module.js';
import { LOOKS } from './looks.js';

// Lab-owned fixtures in surface arc coordinates; the shared surface adapter bends them.
export function createBreachWalls(parent){
 const group=new THREE.Group();group.name='Breach wall fixtures';parent.add(group);
 const geometry=new THREE.BoxGeometry(1.35,1,1.35),edgeGeometry=new THREE.EdgesGeometry(geometry);
 const material=new THREE.MeshBasicMaterial(),edgeMaterial=new THREE.LineBasicMaterial({transparent:true});
 const blocks=[];
 for(let x=-8;x<=8;x+=2)for(let z=-8;z<=8;z+=2){
  const mesh=new THREE.Mesh(geometry,material);mesh.add(new THREE.LineSegments(edgeGeometry,edgeMaterial));group.add(mesh);
  blocks.push({mesh,x,z,distance:Math.hypot(x,z),removed:false});
 }
 let destroyed=0,style='';
 return {update(tune,age){
  group.visible=tune.walls;destroyed=0;
  const look=LOOKS[tune.look];
  if(style!==tune.look){style=tune.look;material.color.copy(look?new THREE.Color(...look.walls.side):new THREE.Color(0x726556));edgeMaterial.color.set(look?.edges.color??0xb2a58b);edgeMaterial.opacity=look?.edges.opacity??.3;edgeMaterial.blending=look?.edges.additive?THREE.AdditiveBlending:THREE.NormalBlending;}
  for(const b of blocks){
   const start=b.distance/Math.max(.1,tune.clearRadius)*.65;
   const progress=age<0||b.distance>tune.clearRadius?0:THREE.MathUtils.clamp((age-start)/.55,0,1);
   b.removed=progress===1;if(b.removed)destroyed++;
   b.mesh.visible=!b.removed;b.mesh.scale.set(1,tune.wallHeight*(1-progress),1);
   b.mesh.position.set(b.x,tune.wallHeight*(1-progress)*.5,b.z);
  }
 },state:()=>({total:blocks.length,destroyed,remaining:blocks.length-destroyed}),
 dispose(){geometry.dispose();edgeGeometry.dispose();material.dispose();edgeMaterial.dispose();group.removeFromParent();}};
}
