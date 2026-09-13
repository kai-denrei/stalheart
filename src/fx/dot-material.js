// dot-material.js — a Points material that wobbles on the GPU.
//
// It replaces THREE.PointsMaterial on dot clouds, and it has to be a DROP-IN
// because the game reaches into the material by name every frame:
//
//   e.obj.material.opacity = op;                               (emerge, death)
//   e.obj.material.color.setHex(slowed ? 0x8fd4ff : 0xffffff); (slow field)
//
// td-tab.js is at its line budget, so those call sites cannot change. Hence
// `color` is the Color object living inside the uniform — setHex mutates the
// uniform in place — and `opacity` is a defined property writing its own.
// Get either wrong and the failure is silent: the field tints nothing and the
// dead never fade.
//
// The motion itself is content (content/dot-wobble.js), shared with the CPU
// re-pose in creatures.waveJelly so the two cannot drift.
import * as THREE from '../../vendor/three.module.js';
import { wobbleGlsl, swimGlsl, DOT_SWIM } from '../content/dot-wobble.js';

// The wobble is OPTIONAL. A static cloud still wants this material — the
// alternative is two materials with two sets of compat properties — so the
// snippet is simply omitted and the vertex shader becomes a plain transform.
export function makeDotMaterial({ size = 2.1, wobble = true, phase = 0,
  color = 0xffffff, opacity = 0.95, sizeAttenuation = false, swim = null } = {}) {
  const uniforms = {
    uT: { value: 0 },
    uPhase: { value: phase },
    uSize: { value: size },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
    uAtten: { value: sizeAttenuation ? 1 : 0 },
    // (amp, beat, along, jelly) and (zMin, zMax) — per-creature, so uniforms
    uSwim: { value: new THREE.Vector4(swim?.amp ?? DOT_SWIM.amp, swim?.beat ?? DOT_SWIM.beat,
      swim?.along ?? DOT_SWIM.along, swim?.jelly ?? DOT_SWIM.jelly) },
    uSpan: { value: new THREE.Vector2(swim?.zMin ?? -1, swim?.zMax ?? 1) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform float uT, uPhase, uSize, uAtten;
      uniform vec4 uSwim;
      uniform vec2 uSpan;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec3 p = position;
        ${swim ? swimGlsl() : (wobble ? wobbleGlsl() : '')}
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        // sizeAttenuation the way PointsMaterial does it: shrink with depth,
        // or hold a constant pixel size when the flag is off.
        gl_PointSize = mix(uSize, uSize * (300.0 / max(1e-4, -mv.z)), uAtten);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        // PointsMaterial multiplies the material colour by the vertex colour;
        // the slow field relies on exactly that, tinting the whole cloud blue
        // without touching the per-dot highlight data.
        gl_FragColor = vec4(uColor * vColor, uOpacity);
      }`,
  });
  // THE COMPAT SURFACE. `color` is the live uniform value, so the game's
  // setHex writes straight through with no per-frame sync to forget.
  mat.color = uniforms.uColor.value;
  Object.defineProperty(mat, 'opacity', {
    get: () => uniforms.uOpacity.value,
    set: (v) => { uniforms.uOpacity.value = v; },
    configurable: true,
  });
  mat.userData.setTime = (t) => { uniforms.uT.value = t; };
  mat.userData.wobbles = !!(wobble || swim);
  mat.userData.motion = swim ? 'swim' : wobble ? 'wobble' : 'static';
  return mat;
}

// Points need a `color` attribute even when nothing tints per dot, because the
// shader always reads it. A cloud built without highlights gets white.
export function ensureColorAttribute(geo, count) {
  if (geo.getAttribute('color')) return geo;
  const c = new Float32Array(count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return geo;
}
