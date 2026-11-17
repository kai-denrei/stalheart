// Geometry adapted from the pinned lab-crystals kit (docs/lab-crystals.lock.json).
// Only its imports change: the game keeps its one Three.js and convex builder.
import * as THREE from '../../vendor/three.module.js';
import { ConvexGeometry } from './cutis-maku/convex.js';
import { vertexShader, fragmentShader } from '../../assets/models/crystals/shaders.js';
import { MINERALS } from '../content/minerals.js';

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

// The kit's nine-quartz amethyst cluster and spectral glass. A tiny procedural
// environment supplies reflections without a transmission render of the world.
export function createAmethyst(seed = 7, height = MINERALS.crystal.heightM) {
  const C = MINERALS.crystal, group = new THREE.Group(), owned = [], meshes = [];
  group.name = 'amethyst cluster';
  const data = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4, light = 0.22 + 0.38 * y / 31 + 0.4 * Math.exp(-((x - 42) ** 2 + (y - 23) ** 2) / 20);
    data[i] = light * 205; data[i + 1] = light * 218; data[i + 2] = light * 255; data[i + 3] = 255;
  }
  const env = new THREE.DataTexture(data, 64, 32); env.needsUpdate = true; env.magFilter = env.minFilter = THREE.LinearFilter; env.wrapS = THREE.RepeatWrapping; owned.push(env);
  const rng = random(seed);
  for (let i = 0; i < 9; i++) {
    const geo = crystalGeometry('quartz', C.sides, C.aspect, seed + i), planes = geo.userData.planes;
    const uniforms = { uPlanes: { value: Array.from({ length: 40 }, (_, k) => planes[k] ?? new THREE.Vector4()) }, uPlaneCount: { value: planes.length },
      uEnvironment: { value: env }, uColor: { value: new THREE.Color(C.colour) }, uIor: { value: C.ior }, uDispersion: { value: C.dispersion },
      uRoughness: { value: C.roughness }, uAbsorption: { value: C.absorption }, uTime: { value: 0 }, uEnergy: { value: 0 }, uMode: { value: 0 },
      uBounces: { value: 3 }, uWorldRotation: { value: new THREE.Matrix3() } };
    const mat = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms }), mesh = new THREE.Mesh(geo, mat);
    const scale = height / (2.8 * C.aspect) * (i ? 0.42 + rng() * 0.3 : 1), a = i / 8 * Math.PI * 2;
    mesh.scale.setScalar(scale);
    mesh.position.set(i ? Math.cos(a) * height * 0.27 : 0, 1.1 * C.aspect * scale, i ? Math.sin(a) * height * 0.27 : 0);
    if (i) { mesh.rotation.x = Math.sin(a) * 0.35; mesh.rotation.z = -Math.cos(a) * 0.35; }
    mesh.onBeforeRender = () => { uniforms.uWorldRotation.value.setFromMatrix4(mesh.matrixWorld); const e = uniforms.uWorldRotation.value.elements; for (let k = 0; k < 9; k += 3) { const l = Math.hypot(e[k], e[k + 1], e[k + 2]) || 1; e[k] /= l; e[k + 1] /= l; e[k + 2] /= l; } };
    group.add(mesh); meshes.push(mesh); owned.push(geo, mat);
  }
  return { group, meshes, dispose() { group.removeFromParent(); owned.forEach((o) => o.dispose()); } };
}
