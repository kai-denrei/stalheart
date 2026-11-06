import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';

export function random(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function crystalGeometry(shape, sides, aspect, seed) {
  const rng = random(seed), points = [];
  const ring = (y, r, n, turn = 0) => { for(let i=0;i<n;i++){ const a=i/n*Math.PI*2+turn; points.push(new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)); } };
  if(shape==='gem') { ring(-.62,.03,sides); ring(.06,1,sides); ring(.22,1,sides); ring(.64,.5,sides); }
  else if(shape==='octahedron') { ring(0,1,4,Math.PI/4); points.push(new THREE.Vector3(0,1.35,0),new THREE.Vector3(0,-1.35,0)); }
  else { ring(-1,.65,sides); ring(.67,.72,sides); points.push(new THREE.Vector3(.16+(rng()-.5)*.18,1.48,.07)); points.push(new THREE.Vector3(-.12,-1.32,0)); }
  points.forEach(p=>{p.y*=aspect; if(shape==='blade'){p.x*=.68;p.z*=.3;} });
  const geometry = new ConvexGeometry(points), pos=geometry.attributes.position;
  const planes=[];
  for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);const n=b.clone().sub(a).cross(c.clone().sub(a)).normalize(),d=-n.dot(a);if(!planes.some(p=>Math.abs(p.w-d)<1e-4&&new THREE.Vector3(p.x,p.y,p.z).distanceTo(n)<1e-4))planes.push(new THREE.Vector4(n.x,n.y,n.z,d));}
  geometry.userData.planes=planes;
  return geometry;
}
