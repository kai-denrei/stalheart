// Ported from lab-creatures src/monster/prey.ts (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.
// This is the file's logic half (the prey shapes, their geometry and membrane profiles); the mesh half, createPrey, is prey.js.
import * as THREE from '../../../vendor/three.module.js';

export const PREY_SHAPES=['sphere','cube','prism','dodecahedron'];
export function preyGeometry(shape){
  switch(shape){
    case 'sphere':return new THREE.SphereGeometry(.011,24,16);
    case 'cube':return new THREE.BoxGeometry(.022,.022,.022);
    case 'prism':return new THREE.CylinderGeometry(.013,.013,.022,3);
    case 'dodecahedron':return new THREE.DodecahedronGeometry(.013);
  }
}
// Convex face planes let the physical membrane follow the same outline as
// the rendered prey, including the prism corners and polyhedron facets.
const profiles=new Map();
function planes(shape){
  if(profiles.has(shape))return profiles.get(shape);
  const geometry=preyGeometry(shape),p=geometry.getAttribute('position'),indices=geometry.index;
  const result=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<(indices?.count??p.count);i+=3){
    a.fromBufferAttribute(p,indices?indices.getX(i):i);b.fromBufferAttribute(p,indices?indices.getX(i+1):i+1);c.fromBufferAttribute(p,indices?indices.getX(i+2):i+2);
    const plane=new THREE.Plane().setFromCoplanarPoints(a,b,c);
    if(plane.constant>0)plane.negate();
    if(!result.some(other=>other.normal.distanceToSquared(plane.normal)<1e-8&&Math.abs(other.constant-plane.constant)<1e-6))result.push(plane);
  }
  geometry.dispose();profiles.set(shape,result);return result;
}
export function preyImprint(shape,x,z){
  if(shape==='sphere')return Math.pow(Math.max(0,1-(Math.hypot(x,z)/.020)**2),1.3);
  x/=1.3;z/=1.3;
  let lower=-Infinity,upper=Infinity;
  for(const {normal:n,constant} of planes(shape)){
    const offset=-constant-n.x*x-n.z*z;
    if(Math.abs(n.y)<1e-6){if(offset<0)return 0;}
    else if(n.y>0)upper=Math.min(upper,offset/n.y);
    else lower=Math.max(lower,offset/n.y);
  }
  if(upper<lower)return 0;
  return .7*Math.max(0,Math.min(1,(upper+.011)/.022));
}
/** Conservative rounded convex clearance; the outward normal drives contact. */
export function preyClearance(shape,x,y,z,normal){
  if(shape==='sphere'){
    const length=Math.hypot(x,y,z);normal.set(x,y,z).divideScalar(length||1);if(length<1e-8)normal.set(0,1,0);
    return length-.011;
  }
  let distance=-Infinity;
  for(const plane of planes(shape)){
    const d=plane.normal.x*x+plane.normal.y*y+plane.normal.z*z+plane.constant;
    if(d>distance){distance=d;normal.copy(plane.normal);}
  }
  return distance;
}
