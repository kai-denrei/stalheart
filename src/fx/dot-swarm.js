// dot-swarm.js — a whole crowd of dot creatures in ONE draw call.
//
// Measured in the swarm lab, one Points object per body: 250 alive costs 306
// draw calls and drops 0.1% of frames; 1000 costs 1,056 and drops 19.6%. The
// dots themselves are not the problem — 494,000 of them render fine — the
// per-body draw call is.
//
// So the geometry is uploaded ONCE and instanced. Each body contributes three
// numbers a frame (its offset) and one at build time (its phase), which is
// 14 KB a frame for 1,200 bodies against the megabytes a merged non-instanced
// cloud would re-upload. The wobble is the same vertex shader the single
// bodies use, from the same constants in content/dot-wobble.js, so a merged
// crowd and a lone creature cannot move differently.
//
// WHAT IT GIVES UP. A single body carries its own material, and the game
// writes to that material every frame — `material.color.setHex` for the slow
// field, `material.opacity` for the emerge and death fades. One material
// cannot say two things at once, so anything per-body has to become a
// per-instance ATTRIBUTE before this is usable in gameplay. Here the crowd is
// uniform, so it is not yet paid for.
import * as THREE from '../../vendor/three.module.js';
import { wobbleGlsl } from '../content/dot-wobble.js';

export function createDotSwarm(basePoints, capacity, { size = 2.1, wobble = true,
  color = 0xffffff, highlight = 0xffffff, opacity = 0.95 } = {}) {
  const per = basePoints.length;
  const geo = new THREE.InstancedBufferGeometry();

  // the body, once
  const pos = new Float32Array(per * 3);
  const col = new Float32Array(per * 3);
  const cBody = new THREE.Color(color), cHi = new THREE.Color(highlight);
  for (let i = 0; i < per; i++) {
    const p = basePoints[i];
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    const c = p[3] === 1 ? cHi : cBody;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  // and one entry per body
  const offs = new Float32Array(capacity * 3);
  const phase = new Float32Array(capacity);
  const scale = new Float32Array(capacity);
  for (let i = 0; i < capacity; i++) {
    // the golden angle again: a crowd pulsing in lockstep reads as one animal
    phase[i] = (i * 2.39996) % 6.28318;
    scale[i] = 1;
  }
  const aOff = new THREE.InstancedBufferAttribute(offs, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aOff', aOff);
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  const aScale = new THREE.InstancedBufferAttribute(scale, 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aScale', aScale);
  geo.instanceCount = 0;

  const uniforms = { uT: { value: 0 }, uSize: { value: size }, uOpacity: { value: opacity } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uT, uSize;
      attribute vec3 color; attribute vec3 aOff; attribute float aPhase, aScale;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec3 p = position;
        float uPhase = aPhase;
        ${wobble ? wobbleGlsl() : ''}
        vec4 mv = modelViewMatrix * vec4(p * aScale + aOff, 1.0);
        gl_Position = projectionMatrix * mv;
        // a dead instance is parked at scale 0; drop its point off-screen so
        // it costs no fragments rather than collapsing into a bright speck
        gl_PointSize = aScale > 0.0 ? uSize : 0.0;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying vec3 vColor;
      void main() { gl_FragColor = vec4(vColor, uOpacity); }`,
  });

  const mesh = new THREE.Points(geo, mat);
  mesh.frustumCulled = false;   // the crowd's bounds are the lane, not the body
  return {
    mesh,
    capacity,
    dots: per,
    // The host writes positions for the live bodies each frame and says how
    // many there are; everything past `count` is simply not drawn.
    update(count, write) {
      const n = Math.min(count, capacity);
      write(offs, scale, n);
      geo.instanceCount = n;
      aOff.needsUpdate = true; aScale.needsUpdate = true;
    },
    setTime(t) { uniforms.uT.value = t; },
    set opacity(v) { uniforms.uOpacity.value = v; },
    get opacity() { return uniforms.uOpacity.value; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
