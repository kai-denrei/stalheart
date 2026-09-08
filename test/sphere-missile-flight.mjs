import assert from 'node:assert/strict';
import { sphereMissileFrame, sampleSphereMissile } from '../src/domain/sphere-missile-flight.js';
import { missileFrame, sampleMissile } from '../src/domain/missile-flight.js';
import { launchDart, advanceDart } from '../src/missiles.js';
import { MISSILE_DEFAULTS } from '../src/content/missile-defaults.js';
const near=(a,b)=>assert(Math.hypot(...a.map((v,i)=>v-b[i]))<1e-7,`${a} != ${b}`);
for(const from of [[0,1.04,0],[1.04,0,0],[0,0,-1.04]]){
 const target=from[1]?[.2,Math.sqrt(.96),0]:[0,1,0];
 for(const profile of ['swift','hook']){
  const direction=from.map(v=>v/1.04),frame=sphereMissileFrame(from,target,direction);
  near(sampleSphereMissile(frame,0,profile,target).position,from);
  near(sampleSphereMissile(frame,0,profile,target).direction,direction);
  near(sampleSphereMissile(frame,1,profile,target).position,target);
  for(let i=0;i<=100;i++){
   const pose=sampleSphereMissile(frame,i/100,profile,target);
   assert(pose.position.every(Number.isFinite));assert(pose.direction.every(Number.isFinite));
   assert(Math.abs(Math.hypot(...pose.direction)-1)<1e-9);
  }
  const opposite=from.map(v=>-v);near(sampleSphereMissile(frame,1,profile,opposite).position,opposite);
  const moved=[0,.6,.8];near(sampleSphereMissile(frame,1,profile,moved).position,moved);
 }
}
// One timing owner for all consumers, with immutable launch settings and the
// same flat poses the range previously sampled directly.
for(const config of Object.values(MISSILE_DEFAULTS)){
 const pool={acquire:length=>({length}),pose:(mesh,pose)=>{mesh.pose=pose;}};
 const from=[2,3,4],target=[2,0,24],direction=[0,.8,.6];
 const m=launchDart(pool,{config:{...config},from,target,direction,scale:.25});
 assert.equal(m.mesh.length,config.length*.25);
 assert.equal(advanceDart(pool,m,config.duration*.5),false);
 near(m.pose.position,sampleMissile(missileFrame(from,target,direction),.5,config.profile).position);
 assert.equal(advanceDart(pool,m,100),true);assert.equal(m.t,config.duration);near(m.pose.position,target);
}
assert.equal(launchDart({acquire:()=>null},{config:MISSILE_DEFAULTS.quiver}),null);
console.log('Shared DART timing and sphere launch/arrival, moving targets, poles and finite poses pass.');
