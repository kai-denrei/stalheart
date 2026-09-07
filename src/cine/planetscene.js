// cine/planetscene.js — THE PLANET. A 12-second cinematic (plan phase 2):
// the wire world under the galaxy sky — wide, then close, then a graze
// over the cells, then back out to the silhouette THE GATE lands on.
//
// Draws the game's own things: the sphere pipeline at the board's default
// point count (planet.js → grid.js), the tronColors look's edges and body,
// the galaxy bake as sky. What the game lacks and this adds: an
// atmosphere, as two fresnel shells — a rim on the limb and a haze past
// it — which is the cheap thing that reads (plan §2.10's first option).
// The planet is 7.8 m in radius, THE GATE's measured number, so the two
// cinematics share one scale and the last beat here is the last beat
// there, minus the ring.
//
// Every time-dependent thing is SET from t. A capture seeks.
import * as THREE from '../../vendor/three.module.js';
import { bakeGalaxyCube } from '../galaxybake.js';
import { SKY_PRESET } from '../galaxyseed.js';
import { LOOKS } from '../looks.js';
import { compileRail } from './rail.js';
import { makeWirePlanet, widenWire } from './planet.js';

export const PLANET_LEN = 12;
export const PLANET_R = 7.8;          // THE GATE's measured radius: one scale, two cinematics

// The rail (ruling D, 2026-09-04). Beat 4 is THE GATE's landing pose moved
// by the planet's centre (the gate scene has the ring at the origin and the
// planet 11.9 m under it), so the disc sits in the same part of the frame
// at the same size: a rhyme, not a coincidence.
export const PLANET_RAIL = [
  { t: 0.0, pos: [0.0, 6.0, 30.0], look: [0, 0, 0], fov: 40 },      // wide orbital
  { t: 3.0, pos: [4.0, 5.0, 26.0], look: [0, 0, 0] },
  { t: 7.0, pos: [9.0, 4.0, 14.0], look: [2, 0, 0] },                // push in
  { t: 10.0, pos: [8.4, 2.6, 4.2], look: [1.5, 1.2, -4.5] },         // the graze
  { t: 12.0, pos: [-4.5, 15.5, 22.0], look: [0, 9.7, 0] },           // the gate's silhouette
];

const ATMO_VERT = `
varying vec3 vN; varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const ATMO_FRAG = `
uniform vec3 uColor; uniform float uPower; uniform float uIntensity;
varying vec3 vN; varying vec3 vW;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  float f = pow(1.0 - clamp(dot(normalize(vN), v), 0.0, 1.0), uPower);
  gl_FragColor = vec4(uColor * f * uIntensity, f * uIntensity);
}`;

function fresnelShell(radius, { color, power, intensity, side }) {
  const m = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uIntensity: { value: intensity } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), m);
}

export function createPlanet({ renderer, scene, camera, tier = {} }) {
  const q = new URLSearchParams(location.search);
  const look = LOOKS.tronColors;
  const rail = compileRail(PLANET_RAIL, { fov: 40 });

  // THE SKY, as in the gate: the game's bake at a cinema face size
  const sky = bakeGalaxyCube(renderer, { ...SKY_PRESET, seed: 4414, face: tier.skyFace ?? 1024, galaxies: 2 });
  scene.background = sky.texture;

  // light only matters for the body (the wire and the shells are unlit);
  // the look's own hemi and sun, so the body is the board's black
  scene.add(new THREE.HemisphereLight(look.hemi[0], look.hemi[1], look.hemi[2] * 0.6));
  const sun = new THREE.DirectionalLight(look.sun[0], look.sun[1] * 2);
  sun.position.set(20, 30, 10);
  scene.add(sun);

  const root = new THREE.Group();
  scene.add(root);

  // THE PLANET at the game's default resolution (600 points, 80 relax iters)
  const n = parseInt(q.get('points')) || 600;
  const planet = makeWirePlanet({ seed: 4414, n, relaxIters: 80, edges: look.edges, body: look.bg });
  planet.scale.setScalar(PLANET_R);
  root.add(planet);
  // THE WIDE WIRE (plan §2.10), on by default: width follows the frame
  // height — 3 px at 1080p, 6 at 4K, 2 at 720p — so the planet's identity
  // survives at any size. ?wide=N overrides, ?wide=0 is the 1-px line.
  const wide = q.get('wide') != null ? parseFloat(q.get('wide')) : Math.max(1.5, renderer.domElement.height / 360);
  let wideReady = !(wide > 0);
  if (wide > 0) {
    widenWire(planet, { width: wide, resolution: [renderer.domElement.width, renderer.domElement.height] }).then(() => { wideReady = true; });
  }

  // THE ATMOSPHERE: a rim just off the surface and a haze past the limb.
  // ?atmo=0 removes both (the ruling's second cut).
  const shells = [];
  if (q.get('atmo') !== '0') {
    // judged wide at t=1.5: 0.9 / 0.55 made a solid band past the limb; a
    // thinner rim and a haze that fades reads as air, not a shell
    const rim = fresnelShell(PLANET_R * 1.02, { color: 0x2ad8ff, power: 3.6, intensity: 0.7, side: THREE.FrontSide });
    const haze = fresnelShell(PLANET_R * 1.09, { color: 0x1a86b0, power: 6.5, intensity: 0.38, side: THREE.BackSide });
    root.add(rim, haze);
    shells.push(rim, haze);
  }
  console.log(`PLANET scene: ${planet.userData.mesh.quads.length} quads, cell ${(planet.userData.cellSide * PLANET_R).toFixed(2)} m, atmo=${shells.length}`);

  const tmp = new THREE.Vector3();
  function update(t) {
    // a slow turn under the camera, SET from t
    planet.rotation.y = t * 0.05;
    // a wide line's width is in pixels of ITS resolution uniform, which the
    // first probe read off an unsized canvas (300x150 for a 1280x720 frame):
    // set from the drawing buffer at every draw, so a capture at any size
    // and a live resize both get the width they asked for
    const wm = planet.userData.wire && planet.userData.wire.material;
    if (wm && wm.resolution) wm.resolution.set(renderer.domElement.width, renderer.domElement.height);
    const p = rail.poseAt(t);
    camera.position.set(p.pos[0], p.pos[1], p.pos[2]);
    camera.up.set(p.up[0], p.up[1], p.up[2]);
    camera.lookAt(tmp.set(p.look[0], p.look[1], p.look[2]));
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
  }

  return {
    name: 'planet', duration: PLANET_LEN, update,
    ready: () => wideReady,
    wormhole: null,                   // nothing for the governor to size
    dispose() { sky.dispose(); },
  };
}
