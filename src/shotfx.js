// shotfx.js — WHAT A SHOT LOOKS LIKE IN FLIGHT, in one place.
//
// Operator: "as the default for each sentry we want how they are in the game.
// Then we tweak the visual in our lab... if the baseline is not what is
// currently in the game it is useless."
//
// That is the whole argument for this file. The board's shot drawing lived
// inside td-tab's closure — makeTracer, spawnLightning, the seeker cone, the
// plasma links — so the shooting lab could only ever REIMPLEMENT them, and a
// reimplementation is a guess that drifts. The Mortar flew straight in the lab
// and arced in the game; the Relay drew nothing at all; the Plasma looked
// like a different weapon. None of those were tuning problems.
//
// So these are the builders, and both the board and the lab call them. They
// take explicit sizes rather than reading a cell, because the board works on
// a unit sphere with cellSide 0.08 and the lab works in metres — the same
// object at two scales, not two objects.
//
// They BUILD and return; they never add to a scene or push onto a list. The
// caller owns the lifetime, which is the one thing the two really do differ
// about.
import * as THREE from '../vendor/three.module.js';
import { createBeam } from './beamfx.js';
import { BOARD_PRESET, BEAM_PEAK } from './beamdraw.js';

// --- the looks the board already settled on -------------------------------
// Repeated from nowhere: these WERE td-tab's private constants, and moving
// them here is what lets the lab show the same weapon. A lance is thin,
// straight and jitter-free; a throw is wide, jittery and made of matter.
export const LANCE_LOOK = {
  width: 0.2, jitter: 0,
  noiseAmount: 0.08, flicker: 0.06, scrollSpeed: -1.2,
};
export const THROW_LOOK = { width: 1, jitter: 1 };

let dotTex = null;
// A Points vertex is a SQUARE unless told otherwise, and at twelve pixels the
// corners read. One shared radial sprite, built on first use.
export function roundDot() {
  if (dotTex || typeof document === 'undefined') return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

// --- the tracer -----------------------------------------------------------
// A head dragging `trailN` ghost points that dim toward the tail. The caller
// moves it and writes the trail's positions; this only builds the object.
export function makeTracerMesh(colorHex, px, trailN) {
  const n = Math.max(1, Math.round(trailN) + 1);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const c = new THREE.Color(colorHex);
  for (let i = 0; i < n; i++) {
    const f = 1 - i / n;             // head bright, tail fading to black
    col[i * 3] = c.r * f; col[i * 3 + 1] = c.g * f; col[i * 3 + 2] = c.b * f;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: px, sizeAttenuation: false, vertexColors: true,
    map: roundDot(), alphaTest: 0.3,
    transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

// --- the slow field's lightning -------------------------------------------
// The Relay does not fire — nothing leaves it — but it is not idle either,
// and a sentry that shows nothing at all reads as broken rather than as a
// field weapon. This is the bolt the board already draws.
//
// `radialLift` is the board's: it pushes each point out from the sphere's
// centre so the bolt rides above the wall tops. A flat stage passes 0.
export function makeLightningMesh(a, b, colorHex, {
  seg = 7, ampFrac = 0.18, t = 0, up = null, radialLift = 0,
} = {}) {
  const pos = new Float32Array((seg + 1) * 3);
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dl = Math.hypot(d[0], d[1], d[2]) || 1;
  // the axis the jag swings about: the caller's `up` on a flat stage, or the
  // midpoint's own outward direction on a sphere
  let u = up;
  if (!u) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const ml = Math.hypot(mid[0], mid[1], mid[2]) || 1;
    u = [mid[0] / ml, mid[1] / ml, mid[2] / ml];
  }
  let side = [u[1] * d[2] - u[2] * d[1], u[2] * d[0] - u[0] * d[2], u[0] * d[1] - u[1] * d[0]];
  const sl = Math.hypot(side[0], side[1], side[2]);
  side = sl > 1e-9 ? [side[0] / sl, side[1] / sl, side[2] / sl] : [0, 1, 0];
  const amp = dl * ampFrac;
  for (let i = 0; i <= seg; i++) {
    const f = i / seg;
    // the ends are PINNED: a bolt whose ends wander is not attached to
    // anything, and the eye reads that instantly
    const jag = (i === 0 || i === seg) ? 0
      : Math.sin(i * 12.9898 + t * 57.7) * amp * Math.sin(Math.PI * f);
    let p = [a[0] + d[0] * f, a[1] + d[1] * f, a[2] + d[2] * f];
    if (radialLift) p = p.map((v) => v * (1 + radialLift));
    pos[i * 3] = p[0] + side[0] * jag;
    pos[i * 3 + 1] = p[1] + side[1] * jag;
    pos[i * 3 + 2] = p[2] + side[2] * jag;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

// --- the seeker -----------------------------------------------------------
// A CONE pointed along its velocity, not a dot cloud: the board tried the
// cloud first and a Javelin climbing into the air read as "half-dotted".
// `len` is the missile's length in the caller's units; the radius follows it,
// so one number sizes the same object on a sphere or in a lab.
export function makeSeekerMesh(colorHex, len) {
  return new THREE.Mesh(
    new THREE.ConeGeometry(len * 0.185, len, 7),
    new THREE.MeshLambertMaterial({
      color: colorHex,
      emissive: new THREE.Color(colorHex).multiplyScalar(0.5),
    }));
}

// Point a built seeker along its heading. The cone's own axis is +Y, so this
// is the one place the rotation is derived — three call sites deriving it is
// three chances to pick a different convention.
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
export function aimSeeker(mesh, dir) {
  _dir.set(dir[0], dir[1], dir[2]);
  if (_dir.lengthSq() < 1e-12) return;
  _dir.normalize();
  mesh.quaternion.setFromUnitVectors(_up, _dir);
}

// --- the ballistic arc ----------------------------------------------------
// A LOB DOES NOT FLY WHERE THE TUBE POINTS. The board's mortars take their
// ground bearing from the boresight and add the parabola to the DRAWING only,
// so the picture cannot change the accuracy. This is that parabola: `u` is
// the fraction of the way along, `h` the peak height, and it is added to the
// straight path rather than replacing it.
export const arcLift = (u, h) => 4 * u * (1 - u) * h;

// --- the held beam: a lance or a plasma throw -----------------------------
// The board draws both with beamfx's shader and the board preset, split into
// links so the ribbon can taper at the muzzle, open down the throw, and cap
// only at its two real ends. That construction lived in td-tab's closure, so
// the sentry range wrote its own — a doubled THREE.Line for the lance and a
// spray of Points for the throw — after concluding that createBeam "renders
// nothing in this scene". It does render there; what did not was a beam built
// at the BOARD's widths.
//
// Which is the reason `glowWidth` is an explicit argument in WORLD units and
// not a cell count. The board views a 0.08 cell from about six cells away and
// the range views its whole yard from roughly fifty, so a width that reads as
// a lance on the board is a sub-pixel thread here — geometry, uniforms and
// draw calls all perfectly valid, and nothing on the screen. What has to be
// shared between the two is the weapon's IDENTITY: thin and steady versus
// wide and unstable, the noise, the flicker, the cap taper, the colour. The
// size belongs to the scene, same rule as every other builder in this file.
//
// Builds and returns; the caller adds it, fades it and disposes it.
export function makeBeamShot(from, to, colorHex, kind = 'lance', opts = {}) {
  const look = kind === 'lance' ? LANCE_LOOK : THROW_LOOK;
  const links = Math.max(1, Math.round(opts.links ?? 5));
  // one number sizes the whole beam; the rest keep the board's proportions
  const gw = opts.glowWidth ?? 0.1;
  const cw = gw * (BOARD_PRESET.coreWidth * 1.6) / (BOARD_PRESET.glowWidth * 0.55);
  const jit = gw * (BOARD_PRESET.jitterAmount * 0.55) / (BOARD_PRESET.glowWidth * 0.55);
  const hex = `#${(colorHex >>> 0).toString(16).padStart(6, '0')}`;
  const grp = new THREE.Group();
  const beams = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  // narrow at the muzzle, opening along the beam — the board's own curve,
  // normalised so `glowWidth` means the beam's WIDEST point rather than a
  // number the taper then quietly scales
  const taper = (k) => 0.35 + 0.65 * Math.pow((k + 0.5) / links, 0.7);
  const wMax = taper(links - 1);
  for (let k = 0; k < links; k++) {
    const w = taper(k) / wMax;
    const bm = createBeam(new THREE.Vector3(), new THREE.Vector3(), {
      ...BOARD_PRESET,
      ...(look.noiseAmount !== undefined ? { noiseAmount: look.noiseAmount } : {}),
      ...(look.flicker !== undefined ? { flicker: look.flicker } : {}),
      ...(look.scrollSpeed !== undefined ? { scrollSpeed: look.scrollSpeed } : {}),
      glowColor: hex,
      coreWidth: cw * look.width * w,
      glowWidth: gw * look.width * w,
      jitterAmount: jit * look.jitter * w,
      // only the two real ends taper; an interior cap would pinch the beam
      // into a string of beads
      capStart: k === 0 ? BOARD_PRESET.capStart : 0,
      capEnd: k === links - 1 ? BOARD_PRESET.capEnd : 0,
      glowIntensity: BEAM_PEAK * 0.55 * w,
    });
    const f0 = k / links, f1 = (k + 1) / links;
    a.lerpVectors(from, to, f0); b.lerpVectors(from, to, f1);
    bm.setEndpoints(a, b);
    bm.mesh.renderOrder = 10;
    grp.add(bm.mesh);
    beams.push(bm);
  }
  grp.userData.setEndpoints=(from,to)=>{
    for(let k=0;k<links;k++){a.lerpVectors(from,to,k/links);b.lerpVectors(from,to,(k+1)/links);beams[k].setEndpoints(a,b);}
  };
  // The fade is a UNIFORM, not `material.opacity`. A ShaderMaterial has an
  // `opacity` property and writing it does exactly nothing, which is how a
  // beam survives its own fade-out and vanishes only when it is removed.
  // and it is re-applied AFTER update(), because beamfx's own update writes
  // uAlpha from its burst envelope — a fade set before it is overwritten by it
  let fade = 1;
  grp.userData.setFade = (u) => { fade = u; for (const bm of beams) bm.setAlpha(u); };
  grp.userData.update = (t) => {
    for (const bm of beams) { bm.update(t); bm.setAlpha(fade); }
  };
  return grp;
}
