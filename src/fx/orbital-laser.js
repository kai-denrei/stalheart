// THE ORBITAL LASER'S LOOK. A near-vertical column from a sky anchor down to the contact point, a monochrome
// footprint ring on the ground, and a scorch trail of dark glassy quads laid every couple of metres of travel and
// fading over a minute. Local to whatever scene it is given: the caller hands it world points and a surface normal,
// so this file knows nothing about planets or frames.
//
// Widths in the preset are METRES. cellSide / metresPerCell is the host's scene units per metre, so a lab drawing in
// metres passes 10 / 10 and a board drawing in cells passes its own cell side.
import * as THREE from '../../vendor/three.module.js';
import { createBeam } from '../beamfx.js';
import { LASER_PRESET, LASER_BEAM, LASER_TRAIL, LASER_TRAIL_SMOKE, LASER_SKY_METRES } from '../content/orbital-laser.js';
import { EXPLOSION_PALETTE } from '../content/explosions.js';
import { template as puffTemplate, buildPuffGeometry } from './explosions/common.js';

const Y = new THREE.Vector3(0, 1, 0);
/* the preset keys measured in metres: scaled by scene units per metre at build and in tune() */
const WIDTH_KEYS = new Set(['coreWidth', 'glowWidth', 'jitterAmount']);
/* the column ends this far UNDER the contact, so its last sliver of taper is inside the ground and it meets the surface
   at full width */
const BURY_METRES = 1;
/* the column's last metres fade to nothing where it meets the ground */
const GROUND_FADE_METRES = 6;
/* the contact glow's radius as a multiple of the column's glow width: it spreads a little where it lands */
const DISC_SPREAD = 1.3;

export function createOrbitalLaser(scene, { cellSide = 10, metresPerCell = 10 } = {}) {
  const unit = cellSide / metresPerCell;          /* scene units per metre */
  const group = new THREE.Group();
  group.name = 'Orbital laser';
  scene.add(group);

  /* --- the column ------------------------------------------------------- */
  const sky = new THREE.Vector3(), at = new THREE.Vector3(), up = new THREE.Vector3(), end = new THREE.Vector3();
  const beam = createBeam(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), {
    ...LASER_PRESET,
    coreWidth: LASER_PRESET.coreWidth * unit,
    glowWidth: LASER_PRESET.glowWidth * unit,
    jitterAmount: LASER_PRESET.jitterAmount * unit,
  });
  /* THE COLUMN'S SIDES FADE OUT. beamfx's glow is pow(1 - across, falloff), which at the owner's glow intensity (12) is
     still bright at the ribbon's edge and cut the column with a straight line down each side (owner, 2026-09-15). This
     laser's material alone gets a window that takes the glow to zero from 55 % of the half-width to the edge; the
     shared beamfx and every other beam are untouched, and the changed source is its own program. */
  const GLOW_LINE = 'float glow = pow(max(0.0, 1.0 - avT), uGlowFalloff);';
  if (beam.mesh.material.fragmentShader.includes(GLOW_LINE)) {
    beam.mesh.material.fragmentShader = beam.mesh.material.fragmentShader.replace(GLOW_LINE,
      'float glow = pow(max(0.0, 1.0 - avT), uGlowFalloff) * (1.0 - smoothstep(0.55, 1.0, avT));');
  }
  /* THE COLUMN FADES INTO THE GROUND. Where a flat camera-facing ribbon meets terrain the depth test cuts it with a hard
     line whatever its width (owner, 2026-09-15: "this effect is still showing"). The last GROUND_FADE_METRES fade to
     nothing, so the ground only ever meets an invisible sliver; the contact glow disc carries the landing. */
  const material = beam.mesh.material;
  material.uniforms.uGroundFade = { value: 0.02 };
  const ALPHA_DECL = 'uniform float uAlpha;', COLOUR_OUT = 'col *= lenMask * flick * uAlpha;';
  if (material.fragmentShader.includes(ALPHA_DECL) && material.fragmentShader.includes(COLOUR_OUT)) {
    material.fragmentShader = material.fragmentShader
      .replace(ALPHA_DECL, `${ALPHA_DECL}\nuniform float uGroundFade;`)
      .replace(COLOUR_OUT, `${COLOUR_OUT}\n  col *= smoothstep(0.0, 1.0, (1.0 - vU) / max(uGroundFade, 1e-4));`);
  }
  beam.mesh.visible = false;
  group.add(beam.mesh);

  /* --- the footprint ring ----------------------------------------------- */
  const ringGeo = new THREE.RingGeometry(LASER_BEAM.radius * unit * 0.9, LASER_BEAM.radius * unit, 72);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xdfe8ee, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.renderOrder = 9;
  ring.visible = false;
  group.add(ring);

  /* --- the aiming pointer ---------------------------------------------- */
  // A thin red line from the sky to where the column WILL land and a small red ring there: a silent, harmless pointer
  // before the destructive beam begins (owner, 2026-09-15). It shows only while the column does not.
  const POINTER_RED = 0xff2a1a;
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
  const guideMat = new THREE.LineBasicMaterial({ color: POINTER_RED, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false });
  const guide = new THREE.Line(guideGeo, guideMat);
  guide.name = 'Laser pointer';
  guide.frustumCulled = false;
  guide.visible = false;
  guide.renderOrder = 12;
  const dotGeo = new THREE.RingGeometry(0.25, 0.7, 24);
  dotGeo.rotateX(-Math.PI / 2);
  const dotMat = new THREE.MeshBasicMaterial({ color: POINTER_RED, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const dot = new THREE.Mesh(dotGeo, dotMat);
  dot.name = 'Laser pointer dot';
  dot.visible = false;
  dot.renderOrder = 12;
  dot.scale.setScalar(unit);
  group.add(guide, dot);

  /* --- the contact glow ------------------------------------------------ */
  // Where the column meets the ground it spreads into a disc of its own width: a white core the core's share of it and
  // a glow falling off to the edge. Seen from the side the column alone ends in a line on the ground; this is the
  // width the owner expects to see land (2026-09-15).
  const look = { coreWidth: LASER_PRESET.coreWidth, glowWidth: LASER_PRESET.glowWidth };
  const discGeo = new THREE.CircleGeometry(1, 48);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.ShaderMaterial({
    uniforms: {
      uCoreColor: { value: new THREE.Color(LASER_PRESET.coreColor) },
      uGlowColor: { value: new THREE.Color(LASER_PRESET.glowColor) },
      uCore: { value: Math.min(1, LASER_PRESET.coreWidth / LASER_PRESET.glowWidth) },
      uCoreIntensity: { value: LASER_PRESET.coreIntensity },
      uGlowIntensity: { value: LASER_PRESET.glowIntensity },
      uAlpha: { value: 0 },
    },
    vertexShader: 'varying vec2 vP;\nvoid main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `#include <common>
uniform vec3 uCoreColor, uGlowColor;
uniform float uCore, uCoreIntensity, uGlowIntensity, uAlpha;
varying vec2 vP;
void main(){
  float r = length(vP);
  float core = 1.0 - smoothstep(uCore * 0.5, uCore, r);
  float glow = pow(max(0.0, 1.0 - r), 2.2);
  gl_FragColor = vec4((uCoreColor * core * uCoreIntensity + uGlowColor * glow * uGlowIntensity * 0.6) * uAlpha, 1.0);
  #include <tonemapping_fragment>
}`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.name = 'Laser contact glow';
  disc.renderOrder = 9;
  disc.visible = false;
  disc.scale.setScalar(LASER_PRESET.glowWidth * DISC_SPREAD * unit);
  group.add(disc);

  /* --- the scorch trail -------------------------------------------------- */
  // A capped instanced ribbon of soft stamps, oldest recycled first. Each stamp's age and seed live in instanced
  // attributes and the shader does the rest: a noisy round edge so overlapping stamps read as one continuous burn, not a
  // chain of squares; char that darkens the ground (premultiplied, so it occludes); and embers — a hot glow cooling from
  // warm to ember red over LASER_TRAIL.hot seconds, with a speckle of coals that smoulders on long after (owner,
  // 2026-09-15). uStack divides the glow by how many stamps overlap along the path, so dense stamping does not white out.
  const CAP = LASER_TRAIL.quads;
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  quadGeo.rotateX(-Math.PI / 2);
  const ages = new Float32Array(CAP).fill(LASER_TRAIL.seconds);
  const ageAttr = new THREE.InstancedBufferAttribute(ages, 1);
  ageAttr.setUsage(THREE.DynamicDrawUsage);   /* every stamp ages every frame */
  quadGeo.setAttribute('aAge', ageAttr);
  const seeds = new Float32Array(CAP);
  const seedAttr = new THREE.InstancedBufferAttribute(seeds, 1);
  quadGeo.setAttribute('aSeed', seedAttr);
  const quadSize = LASER_BEAM.radius * unit * 1.5;
  const quadMat = new THREE.ShaderMaterial({
    uniforms: {
      uLife: { value: LASER_TRAIL.seconds },
      uHot: { value: LASER_TRAIL.hot },
      uStack: { value: Math.min(1, (LASER_TRAIL.every * 1.5) / (LASER_BEAM.radius * 1.5)) },
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
  const trail = new THREE.InstancedMesh(quadGeo, quadMat, CAP);
  trail.name = 'Laser scorch';
  trail.count = 0;
  trail.frustumCulled = false;
  trail.renderOrder = 8;
  group.add(trail);

  const dummy = new THREE.Object3D();
  const last = new THREE.Vector3();
  let next = 0, written = 0, laid = false, clock = 0, sinceStamp = 0;

  function stamp(point, normal) {
    dummy.position.copy(point).addScaledVector(normal, 0.04 * unit);
    dummy.quaternion.setFromUnitVectors(Y, normal);
    dummy.rotateY(Math.random() * Math.PI * 2);
    const size = quadSize * (0.8 + Math.random() * 0.4);
    dummy.scale.set(size, 1, size);
    dummy.updateMatrix();
    trail.setMatrixAt(next, dummy.matrix);
    ages[next] = 0;
    seeds[next] = Math.random();
    next = (next + 1) % CAP;
    written = Math.min(CAP, written + 1);
    trail.count = written;
    trail.instanceMatrix.needsUpdate = true;
    ageAttr.needsUpdate = true;
    seedAttr.needsUpdate = true;
    last.copy(point);
    sinceStamp = 0;
  }

  /* --- the smoke over the path ------------------------------------------- */
  // The pinned explosion kit's puff layer (src/fx/explosions/common.js) used as a ring buffer: every puff is an instance
  // written once when the path lays it, then aged in the shader from uTime, so the smoke keeps rising along the line
  // after the beam has moved on or lifted. One draw, on the program the explosions already compiled (a template clone).
  const SMOKE = LASER_TRAIL_SMOKE;
  const smokeGeo = buildPuffGeometry(Array.from({ length: SMOKE.capacity }, () => ({ o: [0, 0, 0], v: [0, 0, 0], delay: 1e9, life: 1 })));
  const smokeMat = puffTemplate('puff').clone();
  smokeMat.uniforms.uScale.value = unit;
  smokeMat.uniforms.uOpacity.value = SMOKE.opacity;
  for (const [key, hex] of Object.entries(EXPLOSION_PALETTE)) smokeMat.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`]?.value.set(hex);
  const smoke = new THREE.Mesh(smokeGeo, smokeMat);
  smoke.name = 'Laser path smoke';
  smoke.frustumCulled = false;
  smoke.renderOrder = 11;
  group.add(smoke);
  const puffAttr = (name) => smokeGeo.getAttribute(name);
  const [sOrigin, sVel, sMotion, sSize, sTime] = ['aOrigin', 'aVel', 'aMotion', 'aSize', 'aTime'].map(puffAttr);
  const smokeLast = new THREE.Vector3();
  let smokeNext = 0, sinceSmoke = 0, puffed = 0;

  function puff(point, normal) {
    const i = smokeNext;
    smokeNext = (smokeNext + 1) % SMOKE.capacity;
    puffed = Math.min(SMOKE.capacity, puffed + 1);
    const j = (m) => (Math.random() - 0.5) * m;
    /* metres: the puff shader multiplies by uScale; it rises along the ground's normal and drifts a little */
    sOrigin.setXYZ(i, point.x / unit + j(3), point.y / unit + 0.5, point.z / unit + j(3));
    sVel.setXYZ(i, normal.x * 2.5 + j(1.2), normal.y * 2.5, normal.z * 2.5 + j(1.2));
    sMotion.setXYZW(i, 0.35, 0.6, 0, 0);
    sSize.setXYZW(i, 2.5, 8 + Math.random() * 5, 1.8, Math.random());
    sTime.setXYZW(i, clock, SMOKE.life * (0.8 + Math.random() * 0.4), 0.9, 0.6);
    for (const attr of [sOrigin, sVel, sMotion, sSize, sTime]) attr.needsUpdate = true;
    smokeLast.copy(point);
    sinceSmoke = 0;
  }

  function place(contact, normal) {
    at.copy(contact);
    up.copy(normal).normalize();
    sky.copy(at).addScaledVector(up, LASER_SKY_METRES * unit);
    beam.setEndpoints(sky, end.copy(at).addScaledVector(up, -BURY_METRES * unit));
    material.uniforms.uGroundFade.value = ((GROUND_FADE_METRES + BURY_METRES) * unit) / sky.distanceTo(end);
    ring.position.copy(at).addScaledVector(up, 0.08 * unit);
    ring.quaternion.setFromUnitVectors(Y, up);
    disc.position.copy(at).addScaledVector(up, 0.12 * unit);
    disc.quaternion.setFromUnitVectors(Y, up);
  }

  return {
    trail,

    // the beam comes down here: show it, and start the ribbon at this point
    lay(contact, normal) {
      place(contact, normal);
      beam.mesh.visible = true;
      ring.visible = true;
      disc.visible = true;
      laid = true;
      stamp(at, up);
      puff(at, up);
    },

    // the contact has moved: follow it, and fill the gap with quads every LASER_TRAIL.every metres
    aim(contact, normal) {
      place(contact, normal);
      if (!laid) return;
      if (smokeLast.distanceTo(at) >= SMOKE.every * unit) puff(at, up);
      const step = LASER_TRAIL.every * unit;
      let gap = last.distanceTo(at);
      if (gap < step) return;
      const dir = at.clone().sub(last).normalize();
      const point = new THREE.Vector3();
      let walked = 0;
      while (gap - walked >= step) {
        walked += step;
        point.copy(last).addScaledVector(dir, walked);
        stamp(point, up);
        gap = last.distanceTo(at) + walked;   /* `last` moved to `point`: recompute the remaining run */
        walked = 0;
        if (last.distanceTo(at) < step) break;
      }
    },

    // the silent pointer: where the column will land, drawn only while the column is not; strength dims it (away)
    guideAt(point, normal, strength = 1) {
      const top = point.clone().addScaledVector(normal, LASER_SKY_METRES * unit);
      guideGeo.attributes.position.array.set([top.x, top.y, top.z, point.x, point.y, point.z]);
      guideGeo.attributes.position.needsUpdate = true;
      dot.position.copy(point).addScaledVector(normal, 0.1 * unit);
      dot.quaternion.setFromUnitVectors(Y, normal);
      const s = Math.max(0, Math.min(1, strength));
      guideMat.opacity = 0.7 * s;
      dotMat.opacity = 0.9 * s * (0.8 + 0.2 * Math.sin(clock * 6));
      guide.visible = dot.visible = !laid;
    },

    hideGuide() { guide.visible = dot.visible = false; },

    // the player let go, or the energy ran out: the column goes, the scorch stays
    lift() {
      beam.mesh.visible = false;
      ring.visible = false;
      disc.visible = false;
      laid = false;
    },

    // A NEW RUN OWES NOTHING TO THE OLD ONE'S BURN: the column lifts, every stamp in the ribbon is retired and every
    // puff in the ring buffer is pushed back before the clock, so the ground under the next run is clean. The buffers
    // and the compiled programs stay; only their contents go.
    clear() {
      this.lift();
      this.hideGuide();
      ages.fill(LASER_TRAIL.seconds);
      ageAttr.needsUpdate = true;
      trail.count = written = next = 0;
      sinceStamp = 0;
      for (let i = 0; i < SMOKE.capacity; i++) sTime.setX(i, 1e9);
      sTime.needsUpdate = true;
      smokeNext = puffed = 0;
      sinceSmoke = 0;
      smokeLast.set(0, 0, 0);
    },

    // what is on the ground right now: stamps in the ribbon and puffs written into the smoke ring
    state: () => ({ stamps: written, puffs: puffed }),

    // THE LIVE LOOK. The column's preset keys are shader uniforms (src/beamfx.js turns every key into u<Key>), so a
    // slider can write them while the beam burns. Widths are METRES and take the same scene-units-per-metre as the
    // build; `radius` resizes the footprint ring against the radius it was built at. Unknown keys are ignored.
    tune(look = {}) {
      const uniforms = beam.mesh.material.uniforms;
      for (const [key, value] of Object.entries(look)) {
        if (!Number.isFinite(value)) continue;
        if (key === 'radius') { ring.scale.setScalar(value / LASER_BEAM.radius); continue; }
        const u = uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`];
        if (u) u.value = WIDTH_KEYS.has(key) ? value * unit : value;
        if (key in look) look[key] = value;
        if (key === 'coreIntensity') discMat.uniforms.uCoreIntensity.value = value;
        if (key === 'glowIntensity') discMat.uniforms.uGlowIntensity.value = value;
      }
      disc.scale.setScalar(look.glowWidth * DISC_SPREAD * unit);
      discMat.uniforms.uCore.value = Math.min(1, look.coreWidth / Math.max(look.glowWidth, 1e-4));
    },

    // what the column is drawing with right now, in scene units: a check reads this to see a slider reached the shader
    look() {
      const u = beam.mesh.material.uniforms;
      return {
        coreWidth: u.uCoreWidth.value, glowWidth: u.uGlowWidth.value, coreIntensity: u.uCoreIntensity.value,
        glowIntensity: u.uGlowIntensity.value, noiseAmount: u.uNoiseAmount.value, ringScale: ring.scale.x,
        discRadius: disc.scale.x,
      };
    },

    tick(dt, energy01 = 1) {
      clock += dt;
      beam.update(clock);
      /* update() writes the burst envelope into uAlpha, so the energy fade has to come after it */
      beam.setAlpha(laid ? 0.35 + 0.65 * Math.max(0, Math.min(1, energy01)) : 0);
      discMat.uniforms.uAlpha.value = laid ? (0.35 + 0.65 * Math.max(0, Math.min(1, energy01))) * (0.85 + 0.15 * Math.sin(clock * 23)) : 0;
      ringMat.opacity = laid ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 9)) : 0;
      smokeMat.uniforms.uTime.value = clock;
      if (laid) {
        /* a contact that holds still keeps burning in: fresh embers under it, and smoke rising at a steady rate */
        sinceStamp += dt;
        if (sinceStamp >= LASER_TRAIL.restamp) stamp(at, up);
        sinceSmoke += dt;
        if (sinceSmoke >= 1 / SMOKE.rate) puff(at, up);
      }
      if (!written) return;
      for (let i = 0; i < written; i++) ages[i] += dt;
      ageAttr.needsUpdate = true;
    },

    dispose() {
      beam.mesh.geometry.dispose();
      beam.mesh.material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      discGeo.dispose();
      discMat.dispose();
      guideGeo.dispose();
      guideMat.dispose();
      dotGeo.dispose();
      dotMat.dispose();
      quadGeo.dispose();
      quadMat.dispose();
      smokeGeo.dispose();
      smokeMat.dispose();   /* a clone: the kit's puff template stays alive for the explosions */
      trail.dispose();
      scene.remove(group);
    },
  };
}
