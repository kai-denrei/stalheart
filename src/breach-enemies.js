import * as THREE from '../vendor/three.module.js';
import { makeDotEnemy } from './units.js';
import { ENEMY_SPEC,CREATURE_TINTS,accentFor } from './enemyspec.js';
import { makeBreachWaves,stepBreachWaves,emergence } from './domain/breach-waves.js';
import { breachPoint,breachNormal } from './core/breach-surface.js';
import { rimRadius,bowlHeight,SINKHOLE_INNER } from './core/sinkhole-shape.js';
export const BREACH_ENEMY_TYPES=Object.keys(ENEMY_SPEC).filter(k=>!ENEMY_SPEC[k].shelved);
export function createBreachEnemies(scene){
 const group=new THREE.Group();group.name='Breach creatures';scene.add(group);
 let sequence=makeBreachWaves(),actors=[],time=0;
 const normal=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),basis=new THREE.Matrix4();
 function reset(){for(const a of actors){a.body.geometry.dispose();a.body.material.dispose();}group.clear();actors=[];sequence=makeBreachWaves();time=0;}
 function spawn(event,config){
  const key=config.kind==='mixed'?BREACH_ENEMY_TYPES[(event.wave-1+event.index)%BREACH_ENEMY_TYPES.length]:config.kind;
  const spec=ENEMY_SPEC[key];if(!spec)return;
  const body=makeDotEnemy(key,{walker:CREATURE_TINTS[key],walkerHi:accentFor(key)}),root=new THREE.Group();
  body.geometry.computeBoundingBox();body.material.depthWrite=false;body.userData.breachWorld=true;root.add(body);group.add(root);
  actors.push({key,spec,body,root,born:event.at,id:event.id,angle:1+Math.sin(event.id*2.4)*.19,size:Math.max(.3,Math.min(.8,spec.size||.5)),arc:0,fade:0});
 }
 return {group,reset,
  update(dt,config,hole,radius,absoluteTime){
   time+=dt;for(const event of stepBreachWaves(sequence,dt,config))spawn(event,config);
   for(const a of actors){
    const age=time-a.born,e=emergence(age,config.emerge),travel=Math.max(0,age-config.emerge)*config.speed*(a.spec.speed||1);
    const rim=hole*rimRadius(a.angle),arc=rim*SINKHOLE_INNER+travel;
    const r=Math.min(1,Math.max(SINKHOLE_INNER,arc/rim)),floor=bowlHeight(a.angle,r)*hole;
    const local=[Math.cos(a.angle)*arc,floor-a.body.geometry.boundingBox.min.y*a.size*e.scale-(1-e.rise)*(a.size*2+.2),Math.sin(a.angle)*arc];
    a.root.position.fromArray(breachPoint(local,radius));normal.fromArray(breachNormal(local,radius));
    const next=breachPoint([local[0]+Math.cos(a.angle)*.02,local[1],local[2]+Math.sin(a.angle)*.02],radius);
    forward.fromArray(next).sub(a.root.position).normalize();right.crossVectors(normal,forward).normalize();forward.crossVectors(right,normal).normalize();basis.makeBasis(right,normal,forward);a.root.quaternion.setFromRotationMatrix(basis);
    a.body.userData.tick?.(absoluteTime);a.root.scale.setScalar(a.size*e.scale);a.body.material.opacity=.95*e.opacity;
    a.arc=arc;a.fade=e.opacity;
    // Preview lifetime is bounded; no accumulation around the far side.
    a.root.visible=age<35; if(age>33)a.body.material.opacity*=Math.max(0,(35-age)/2);
   }
  },
  state:()=>({wave:sequence.wave,spawned:sequence.spawned,done:sequence.done,live:actors.filter(a=>a.root.visible).length,actors:actors.slice(0,12).map(a=>({kind:a.key,opacity:a.fade,fullSize:a.size,scale:a.root.scale.x,arc:a.arc,position:a.root.position.toArray()}))}),
  dispose(){reset();group.removeFromParent();},
 };
}
