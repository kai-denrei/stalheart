import { missileFrame, sampleMissile } from './missile-flight.js';

const dot = (a,b) => a.reduce((s,v,i)=>s+v*b[i],0);
const unit = a => {const n=Math.hypot(...a)||1;return a.map(v=>v/n);};
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// Log/exp maps keep horizontal distances as sphere arcs. Heights stay radial;
// the same authored flat flight can travel anywhere on the unit-sphere board.
function local(frame,p) {
  const n=unit(p),cos=Math.max(-1,Math.min(1,dot(n,frame.up))),angle=Math.acos(cos);
  const projected=n.map((v,i)=>v-frame.up[i]*cos);
  const tangent=Math.hypot(...projected)>1e-10?unit(projected):frame.forward;
  return [angle*dot(tangent,frame.right),Math.hypot(...p)-frame.radius,angle*dot(tangent,frame.forward)];
}
function world(frame,p) {
  const angle=Math.hypot(p[0],p[2]),s=angle>1e-10?Math.sin(angle)/angle:1;
  return frame.up.map((v,i)=>(v*Math.cos(angle)+(frame.right[i]*p[0]+frame.forward[i]*p[2])*s)*(frame.radius+p[1]));
}
export function sphereMissileFrame(from,target,direction) {
  const up=unit(from),ref=Math.abs(up[1])<.9?[0,1,0]:[1,0,0];
  const right=unit(cross(up,ref)),forward=cross(right,up);
  const frame={up,right,forward,radius:Math.hypot(...from)};
  frame.flight=missileFrame([0,0,0],local(frame,target),[dot(direction,right),dot(direction,up),dot(direction,forward)]);
  return frame;
}
export function sampleSphereMissile(frame,u,profile,target) {
  const pose=sampleMissile(frame.flight,u,profile,local(frame,target));
  const position=world(frame,pose.position),h=1e-6;
  const ahead=world(frame,pose.position.map((v,i)=>v+h*pose.direction[i]));
  return {...pose,position,direction:unit(ahead.map((v,i)=>v-position[i]))};
}
