import { launch,step,STEP } from './ballistics.js';
// Solve against the ground from the actual mounted muzzle, using the flight integrator.
export function mortarGroundAngle(range,height,tune,time=0,yaw=0){
 if(!(range>0)||!(tune.gravity>0))return NaN;
 function landing(angle){
  const s=launch(angle,yaw,tune,time);s.p[1]=height;
  for(let i=0;i<15000;i++){
   const before=s.p.slice();step(s,STEP,tune,s.wind);
   if(s.p[1]<=0){const f=before[1]/(before[1]-s.p[1]);return (before[0]+(s.p[0]-before[0])*f)*Math.sin(yaw)+(before[2]+(s.p[2]-before[2])*f)*Math.cos(yaw);}
  }return NaN;
 }
 let lo=Math.PI/4,hi=Math.PI/2-.0001;
 if(!(landing(lo)>=range)||!(landing(hi)<=range))return NaN;
 for(let i=0;i<20;i++){const mid=(lo+hi)/2;if(landing(mid)>range)lo=mid;else hi=mid;}
 return (lo+hi)/2;
}
