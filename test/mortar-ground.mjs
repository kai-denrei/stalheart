import assert from 'node:assert/strict';
import {mortarGroundAngle} from '../src/domain/mortar-ground.js';
import {BALLISTICS_TUNE,launch,step,STEP} from '../src/domain/ballistics.js';
for(const [range,height,velocity] of [[20,8,35],[150,8,35*Math.sqrt(5)],[300,20,100]]){
 const tune={...BALLISTICS_TUNE,muzzleVel:velocity,wind:0},yaw=.2,angle=mortarGroundAngle(range,height,tune,0,yaw);assert(Number.isFinite(angle));
 const s=launch(angle,yaw,tune,0);s.p[1]=height;let last;
 while(s.p[1]>0&&s.t<60){last=s.p.slice();step(s,STEP,tune,s.wind);}
 const f=last[1]/(last[1]-s.p[1]),x=last[0]+(s.p[0]-last[0])*f,z=last[2]+(s.p[2]-last[2])*f;
 assert(Math.abs(Math.hypot(x,z)-range)<.01);
}
assert(Number.isNaN(mortarGroundAngle(99999,8,BALLISTICS_TUNE)));
console.log('Mounted mortar ground solution matches actual flight.');
