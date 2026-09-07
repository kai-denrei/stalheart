// cine/wormholebg.js — the wormhole as a RENDER TARGET at any size.
//
// The board marches it into one shared 384px target; the bench into a
// square it sizes from a slider. A cinematic wants the same shader at a
// frame-class size (2048² costs ~140 ms on the M4 at the preset — offline
// money, spent gladly). Same fragment, same uniform names, same integrated
// phases (portalfx.js), so a preset copied off the bench is the truth here.
import * as THREE from '../../vendor/three.module.js';
import { WORMHOLE_FRAG } from '../fx/wormhole.frag.js';
import { WORMHOLE_PRESET, WORMHOLE_UNIFORM_DEFAULTS, RING_SPIN, TRAVEL } from '../portalfx.js';

export { RING_SPIN, TRAVEL };

// `width`/`height` for a frame-shaped target (a full-frame pass); `size`
// alone for the square disc. uResolution is the target's own pixels — the
// shader frames its throat in its own aspect.
// `filter: 'nearest'` — THE METAL HANG. Sampling this target through a
// LINEAR filter from a disc that fills a canvas wider than ~1500 px never
// returned on the M4 under ANGLE Metal (headless, real time): 1920x1080,
// 1600x1080 and 2048x1024 all hung; 1280x720 and 1080x1080 rendered; a flat
// colour disc rendered; colour space and mipmaps changed nothing; NEAREST
// rendered in 0.15 s. Bisected 2026-09-03 across ~20 runs. At the cinema
// tier the target (2048) is at least the frame's width, so nearest is
// invisible; the live tier keeps linear, where the disc is small on screen.
const fencePix = new Uint8Array(4);
const FENCE = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('fence') === '0');

export function createWormholeTarget({ size = 1024, width = size, height = size, preset = WORMHOLE_PRESET, filter = 'linear' } = {}) {
  const uniforms = {
    uResolution: { value: new THREE.Vector3(width, height, width / height) },
    uTime: { value: 0 }, uMouse: { value: new THREE.Vector4() },
    uTimeScale: { value: 1 }, uTravel: { value: 0 }, uSpinPhase: { value: 0 },
  };
  for (const [k, v] of Object.entries(WORMHOLE_UNIFORM_DEFAULTS)) uniforms[k] = { value: v };
  for (const [k, v] of Object.entries(preset)) uniforms[k] = { value: v };
  // ?rt=linear|mip|nearest — target-texture variants for bisecting a Metal
  // hang: sampling this target from a disc filling a canvas wider than
  // ~1500 px never returned; a flat-colour disc did
  const rv = (typeof location !== 'undefined' && new URLSearchParams(location.search).get('rt')) || (filter === 'nearest' ? 'nearest' : '');
  const makeRt = (w, h) => {
    const t = new THREE.WebGLRenderTarget(w, h, {
      minFilter: rv === 'mip' ? THREE.LinearMipmapLinearFilter : rv === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter,
      magFilter: rv === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter,
      generateMipmaps: rv === 'mip',
      depthBuffer: false, stencilBuffer: false,
    });
    t.texture.colorSpace = rv === 'linear' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    return t;
  };
  let rt = makeRt(width, height);
  const scene = new THREE.Scene();
  const cam = new THREE.Camera();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: WORMHOLE_FRAG, uniforms, depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(g, mat));
  const api = {
    get rt() { return rt; }, uniforms, size, width, height,
    // THE GOVERNOR'S LEVER: a new target at n². The look is untouched; the
    // pixels soften. Callers read .rt each frame (it is a new object).
    setSize(n) {
      if (n === api.size) return;
      rt.dispose(); rt = makeRt(n, n);
      api.size = api.width = api.height = n;
      uniforms.uResolution.value.set(n, n, 1);
    },
    // CALIBRATE: one march at `size`, timed with the readback stall so the
    // GPU's work is inside the interval (the bench's method). Returns ms.
    // MINIMUM of five. One sample swung 9.8–14.8 ms on the same machine
    // and the median of three still swung 9.9–14.1 (38 vs 27 Gfolds/s —
    // enough to move the pick a size). A capability is the FASTEST the
    // device did it; every slower sample is contention, not capability.
    calibrate(renderer, { size: n = 512, t = 1, samples = 5 } = {}) {
      const keep = api.size;
      api.setSize(n);
      api.render(renderer, t);                     // warm: compile, allocate (fenced)
      const ms = [];
      for (let i = 0; i < samples; i++) {
        const t0 = performance.now();
        api.render(renderer, t + 0.033 * (i + 1));
        ms.push(performance.now() - t0);
      }
      api.setSize(keep);
      return Math.min(...ms);
    },
    // phases are SET from t, never accumulated: a capture seeks
    render(renderer, t, { travelRate = TRAVEL.max, spinRate = 0.15 } = {}) {
      uniforms.uTime.value = t;
      uniforms.uTimeScale.value = preset.uTimeScale ?? 1;
      uniforms.uTravel.value = travelRate * (preset.uTimeScale ?? 1) * t;
      uniforms.uSpinPhase.value = spinRate * (preset.uTimeScale ?? 1) * t;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      // A FENCE. Sampling this target from a disc that fills a wide canvas
      // hung the M4 under ANGLE Metal (headless, real time) — every variant
      // of filter and colour space, at 512 and 2048 — while a flat disc
      // rendered. The one thing they shared: the target written and read in
      // the same submission. A one-pixel readback makes the driver finish
      // the march before anything samples it; it costs a stall the bench
      // already pays for timing, and it is the difference between a frame
      // and no frame. (?fence=0 to see it hang.)
      if (FENCE) renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, fencePix);
      renderer.setRenderTarget(prev);
    },
    dispose() { rt.dispose(); g.dispose(); mat.dispose(); },
  };
  return api;
}
