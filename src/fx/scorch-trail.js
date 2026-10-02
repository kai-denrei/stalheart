// A SCORCH ON THE GROUND (moved out of src/fx/orbital-laser.js, 2026-10-02, so the Lancer's beam can burn rock the same way):
// a capped instanced ribbon of soft stamps, oldest recycled first. Each stamp's age and seed live in instanced attributes and the
// shader does the rest: a noisy round edge so overlapping stamps read as one continuous burn, not a chain of squares; char that
// darkens the ground (premultiplied, so it occludes); and embers — a hot glow cooling from warm to ember red over `hot` seconds,
// with a speckle of coals that smoulders on long after (owner, 2026-09-15). `stack` divides the glow by how many stamps overlap
// along a path, so dense stamping does not white out. `size` is a stamp's side in scene units, `lift` how far off the ground.
import * as THREE from '../../vendor/three.module.js';
import { EXPLOSION_PALETTE } from '../content/explosions.js';

const Y = new THREE.Vector3(0, 1, 0);

export function createScorchTrail(group, { cap, life, hot, stack = 1, size, lift, name = 'scorch' }) {
  const CAP = cap;
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  quadGeo.rotateX(-Math.PI / 2);
  const ages = new Float32Array(CAP).fill(life);
  const ageAttr = new THREE.InstancedBufferAttribute(ages, 1);
  ageAttr.setUsage(THREE.DynamicDrawUsage);   /* every stamp ages every frame */
  quadGeo.setAttribute('aAge', ageAttr);
  const seeds = new Float32Array(CAP);
  const seedAttr = new THREE.InstancedBufferAttribute(seeds, 1);
  quadGeo.setAttribute('aSeed', seedAttr);
  const quadMat = new THREE.ShaderMaterial({
    uniforms: {
      uLife: { value: life },
      uHot: { value: hot },
      uStack: { value: stack },
      uChar: { value: new THREE.Color(0x14110f) },
      uEmber: { value: new THREE.Color(EXPLOSION_PALETTE.ember) },
      uWarm: { value: new THREE.Color(EXPLOSION_PALETTE.warm) },
    },
    vertexShader: `attribute float aAge;
attribute float aSeed;
varying float vAge, vSeed;
varying vec2 vP;
void main(){
  vAge = aAge;
  vSeed = aSeed;
  vP = position.xz;
  vec4 p = vec4(position, 1.0);
  #ifdef USE_INSTANCING
  p = instanceMatrix * p;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: `#include <common>
uniform float uLife, uHot, uStack;
uniform vec3 uChar, uEmber, uWarm;
varying float vAge, vSeed;
varying vec2 vP;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main(){
  vec2 q = vP * 2.0;
  vec2 o = vec2(vSeed * 37.0, vSeed * 91.0);
  float n = vn(q * 2.2 + o) * 0.65 + vn(q * 5.1 + o) * 0.35;
  float edge = 1.0 - smoothstep(0.3, 1.0, length(q) + (n - 0.5) * 0.6);
  if (edge <= 0.0) discard;
  float fade = clamp(1.0 - vAge / uLife, 0.0, 1.0);
  float charA = edge * 0.5 * fade;
  float heat = exp(-vAge / uHot);
  float coals = smoothstep(0.62, 0.9, vn(q * 7.0 + o * 1.3 + vAge * 0.25));
  float glow = edge * (heat * (0.45 + 0.55 * coals) + coals * 0.35 * exp(-vAge / (uHot * 5.0))) * uStack;
  gl_FragColor = vec4(uChar * charA + mix(uEmber, uWarm, heat) * glow * 2.0, charA);
  #include <tonemapping_fragment>
}`,
    transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
  });
  const mesh = new THREE.InstancedMesh(quadGeo, quadMat, CAP);
  mesh.name = name;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  group.add(mesh);
  const dummy = new THREE.Object3D();
  let next = 0, written = 0;
  return {
    mesh,
    // a stamp at `point` facing `normal`, `scale` times the stamp size
    stamp(point, normal, scale = 1) {
      dummy.position.copy(point).addScaledVector(normal, lift);
      dummy.quaternion.setFromUnitVectors(Y, normal);
      dummy.rotateY(Math.random() * Math.PI * 2);
      const k = size * scale * (0.8 + Math.random() * 0.4);
      dummy.scale.set(k, 1, k);
      dummy.updateMatrix();
      mesh.setMatrixAt(next, dummy.matrix);
      ages[next] = 0;
      seeds[next] = Math.random();
      next = (next + 1) % CAP;
      written = Math.min(CAP, written + 1);
      mesh.count = written;
      mesh.instanceMatrix.needsUpdate = true;
      ageAttr.needsUpdate = true;
      seedAttr.needsUpdate = true;
    },
    tick(dt) { if (!written) return; for (let i = 0; i < written; i++) ages[i] += dt; ageAttr.needsUpdate = true; },
    clear() { ages.fill(life); ageAttr.needsUpdate = true; mesh.count = written = next = 0; },
    dispose() { quadGeo.dispose(); quadMat.dispose(); mesh.dispose(); group.remove(mesh); },
  };
}
