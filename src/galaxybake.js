// galaxybake.js — THE SKY, DRAWN ONCE.
//
// Measured 2026-09-03 (research.md): galaxy-forge live costs 3–5 ms a frame
// whatever the resolution, because it is 350k point sprites; the same sky
// baked into a cubemap and drawn as scene.background costs +0.23 ms at 1x
// and +1.25 ms at Retina. So it is baked. Six faces from a CubeCamera at the
// origin, the galaxy set off to one side so the planet sits in a system
// rather than inside a galaxy, the field stars on a far shell all round.
//
// The demo's star and dust shaders, with two edits: three's matrices in
// place of the demo's uVP/uOff, and the ignite pinned past its end — the
// intro is the demo's, not the board's. No bloom, no composite: a faint sky
// wants neither, and the board's own chain blacks the background out of its
// weighted pass anyway (postfx.js: "the sky must not bloom").
import * as THREE from '../vendor/three.module.js';
import {
  GALAXY_PALETTES, buildFieldStars, buildGalaxyDust, buildGalaxyStars, galaxyLayout, galaxyParams,
} from './galaxyseed.js';

const STAR_VERT = /* glsl */ `
attribute vec4 d0; attribute vec4 d1; attribute float pp;
uniform float uSpin, uArms, uTwist, uArmStr, uBar, uCore, uTempG, uPt, uMode, uGain;
uniform vec3 uC0, uC1, uC2;
varying vec3 vCol; varying float vA;
float armOff(float N, float pa, float lga, float env, out float crest) {
  crest = 0.0;
  if (N < 0.5) return 0.0;
  float ph = N * pa + uTwist * lga;
  crest = cos(ph) * env;
  return -(uArmStr / N) * sin(ph) * env;
}
void main() {
  float a = d0.x, th0 = d0.y, ecc = d0.z, peri = d0.w;
  float tmp = d1.x, sz = d1.y, seed = d1.z, zk = d1.w;
  float theta = th0 + 0.045 / (a + 0.08) * uSpin;
  float pa = theta - 0.055 * uSpin + (fract(seed * 13.73) - 0.5) * 0.34;
  float lga = log(max(a, 0.02));
  float env = smoothstep(uCore * 0.5, uCore * 1.6, a) * exp(-a * 1.15);
  float crest;
  float dth = armOff(uArms, pa, lga, env, crest);
  float barEnv = exp(-a / (uCore * 0.9 + 0.06));
  dth -= uBar * 0.5 * sin(2.0 * pa) * barEnv;
  float r = a * (1.0 + ecc * cos(theta - peri));
  r *= 1.0 + uBar * 0.24 * cos(2.0 * pa) * barEnv + 0.10 * crest;
  float thf = theta + dth;
  vec3 pos;
  if (pp > 0.5) {
    float br = a * uCore * 2.3;
    float pr = br * sqrt(max(0.0, 1.0 - zk * zk));
    pos = vec3(pr * cos(thf), pr * sin(thf), br * zk * 0.8);
  } else {
    float h = 0.011 + 0.05 * exp(-a * 2.4);
    pos = vec3(r * cos(thf), r * sin(thf), zk * h);
  }
  pos *= 10.0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 clip = projectionMatrix * mv;
  gl_Position = clip;
  float w = max(clip.w, 0.5);
  float ps = sz * uPt / w;
  float psc = clamp(ps, 1.25, 46.0);
  float att = min(ps / psc, 1.5); att *= att;
  gl_PointSize = min(psc, 50.0);
  if (uMode > 0.5) {
    float occ = smoothstep(0.03, 0.22, crest) * (1.0 - smoothstep(0.85, 1.0, a));
    vA = occ * tmp * att;
    vCol = uC0 * 0.05;
  } else {
    float twk = 0.82 + 0.3 * sin(seed * 41.0);
    float tf = clamp(tmp + max(crest, 0.0) * 1.5 * uTempG - exp(-a * 4.5) * 0.4 * uTempG, 0.0, 1.0);
    vec3 col = tf < 0.5 ? mix(uC0, uC1, tf * 2.0) : mix(uC1, uC2, tf * 2.0 - 1.0);
    float b = (0.22 + sz * 6.0) * (1.0 + max(crest, 0.0) * 1.2) * twk * att;
    vCol = col * b * uGain;
    vA = 1.0;
  }
}`;

const STAR_FRAG = /* glsl */ `
precision mediump float;
varying vec3 vCol; varying float vA;
uniform highp float uMode;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 4.2);
  if (uMode > 1.5) gl_FragColor = vec4(vCol * g * vA, 1.0);
  else if (uMode > 0.5) gl_FragColor = vec4(0.0, 0.0, 0.0, g * vA);
  else gl_FragColor = vec4(vCol * g, 1.0);
}`;

const FIELD_VERT = /* glsl */ `
attribute vec4 p0; attribute vec2 p1;
uniform float uPt;
varying vec2 vP1;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(p0.xyz, 1.0);
  gl_Position = clip;
  gl_PointSize = clamp(p0.w * uPt / max(clip.w, 1.0), 0.75, 260.0);
  vP1 = p1;
}`;

const FIELD_FRAG = /* glsl */ `
precision mediump float;
varying vec2 vP1;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 4.5) * 0.85;
  vec3 c = mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.86, 0.7), fract(vP1.x * 5.7));
  gl_FragColor = vec4(c * g * 0.8 * vP1.y, 1.0);
}`;

function pointsOf(geomAttrs, material) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr, size] of geomAttrs) g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  // a position attribute is what three counts; the shader reads d0/d1
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geomAttrs[0][1].length / geomAttrs[0][2] * 3), 3));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // never culled
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  return p;
}

/**
 * Bake the sky. Returns { texture, params, dispose } — texture is a cube
 * texture ready for scene.background.
 * @param {THREE.WebGLRenderer} renderer
 * @param {object} opts  seed, face (px per cube face), stars, dust, field,
 *                       scale (1 = the tuned size; it is the demo's zoom, so 2 is twice as
 *                       close and twice as wide), galaxies (1..8; the extras are scattered
 *                       from the seed, each with a seed of its own), coreScale (× the
 *                       seeded core size; 1 is the seed's own, already small)
 */
export function bakeGalaxyCube(renderer, opts = {}) {
  const { seed = 4414, face = 1024, stars = 300000, dust = 24000, field = 2600, scale = 1, galaxies = 1, coreScale = 1 } = opts;
  const uPt = face / 2;   // world → pixel for gl.POINTS at a 90° cube face: h / (2 tan 45°)
  const base = { vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, depthTest: false, depthWrite: false, transparent: true };
  const materials = [];

  // one galaxy: three Points (stars, dust occluders, dust emission) on its own look
  function makeGalaxy(gseed, nStars, nDust) {
    const P = galaxyParams(gseed);
    P.core = Math.max(0.02, Math.min(0.6, P.core * coreScale));
    const pal = GALAXY_PALETTES[P.pal];
    const common = {
      uSpin: 40, uArms: P.arms, uTwist: P.twist, uArmStr: 0.62, uBar: P.bar, uCore: P.core,
      uTempG: P.temp, uPt: uPt, uMode: 0, uGain: 0.6,
      uC0: new THREE.Vector3(...pal.c0), uC1: new THREE.Vector3(...pal.c1), uC2: new THREE.Vector3(...pal.c2),
    };
    const uni = (over) => {
      const u = {};
      for (const [k, v] of Object.entries({ ...common, ...over })) u[k] = { value: v };
      return u;
    };
    // sprite scale: the demo draws at ~915 px-per-unit from 15 units out; a 90° face at
    // 1024 px is 512, so the stars are scaled up to land 1–3 px rather than under one,
    // where the demo's own sub-pixel attenuation (att) would fade the whole disc to nothing
    const starMat = new THREE.ShaderMaterial({ ...base, uniforms: uni({ uMode: 0, uPt: uPt * 1.4, uGain: 1.2 }), blending: THREE.AdditiveBlending });
    // dust lanes: dark occluders (dst *= 1 - a), then a faint warm emission
    const occMat = new THREE.ShaderMaterial({ ...base, uniforms: uni({ uMode: 1 }), blending: THREE.CustomBlending,
      blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation });
    const emitMat = new THREE.ShaderMaterial({ ...base, uniforms: uni({ uMode: 2 }), blending: THREE.AdditiveBlending });
    materials.push(starMat, occMat, emitMat);
    const S = buildGalaxyStars(gseed, nStars), D = buildGalaxyDust(gseed, nDust);
    const g = new THREE.Group();
    g.add(pointsOf([['d0', S.d0, 4], ['d1', S.d1, 4], ['pp', S.pp, 1]], starMat));
    g.add(pointsOf([['d0', D.d0, 4], ['d1', D.d1, 4], ['pp', D.pp, 1]], occMat));
    g.add(pointsOf([['d0', D.d0, 4], ['d1', D.d1, 4], ['pp', D.pp, 1]], emitMat));
    return { group: g, params: { ...P, palette: pal.name } };
  }

  const fieldMat = new THREE.ShaderMaterial({ vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG,
    uniforms: { uPt: { value: uPt } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
  materials.push(fieldMat);
  const F = buildFieldStars(seed, field);
  const scene = new THREE.Scene();
  scene.add(pointsOf([['p0', F.p0, 4], ['p1', F.p1, 2]], fieldMat));

  // the home galaxy off to one side and tilted — a ~20-unit disc ~19.5 out
  // spans ~55° of sky and the planet is not inside it — then the others on
  // the far sky. Size is distance: the demo zooms by moving the eye, and so
  // does this, so a bigger galaxy is also a nearer, brighter one.
  const layout = galaxyLayout(seed, Math.max(1, Math.min(8, Math.round(galaxies))));
  const s = Math.max(0.1, scale);
  let params = null;
  layout.forEach((L, i) => {
    const gal = makeGalaxy(L.seed, i === 0 ? stars : Math.round(stars * 0.4), i === 0 ? dust : Math.round(dust * 0.4));
    const dist = L.dist / s;
    gal.group.position.set(L.dir[0] * dist, L.dir[1] * dist, L.dir[2] * dist);
    gal.group.rotation.set(L.tilt[0], L.tilt[1], L.tilt[2]);
    scene.add(gal.group);
    if (i === 0) params = gal.params;
  });

  const rt = new THREE.WebGLCubeRenderTarget(face, { generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  const cam = new THREE.CubeCamera(0.1, 1000, rt);
  scene.add(cam);
  const prevSort = renderer.sortObjects;
  renderer.sortObjects = false;   // draw order IS the pass order: field, stars, occluders, emission
  cam.update(renderer, scene);
  renderer.sortObjects = prevSort;
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  for (const m of materials) m.dispose();

  return { texture: rt.texture, params, face, scale: s, galaxies: layout.length, coreScale, dispose: () => rt.dispose() };
}
