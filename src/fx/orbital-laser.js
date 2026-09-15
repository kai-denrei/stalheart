// THE ORBITAL LASER'S LOOK. A near-vertical column from a sky anchor down to the contact point, a monochrome
// footprint ring on the ground, and a scorch trail of dark glassy quads laid every couple of metres of travel and
// fading over a minute. Local to whatever scene it is given: the caller hands it world points and a surface normal,
// so this file knows nothing about planets or frames.
//
// Widths in the preset are METRES. cellSide / metresPerCell is the host's scene units per metre, so a lab drawing in
// metres passes 10 / 10 and a board drawing in cells passes its own cell side.
import * as THREE from '../../vendor/three.module.js';
import { createBeam } from '../beamfx.js';
import { LASER_PRESET, LASER_BEAM, LASER_TRAIL, LASER_SKY_METRES } from '../content/orbital-laser.js';

const Y = new THREE.Vector3(0, 1, 0);
/* the preset keys measured in metres: scaled by scene units per metre at build and in tune() */
const WIDTH_KEYS = new Set(['coreWidth', 'glowWidth', 'jitterAmount']);

export function createOrbitalLaser(scene, { cellSide = 10, metresPerCell = 10 } = {}) {
  const unit = cellSide / metresPerCell;          /* scene units per metre */
  const group = new THREE.Group();
  group.name = 'Orbital laser';
  scene.add(group);

  /* --- the column ------------------------------------------------------- */
  const sky = new THREE.Vector3(), at = new THREE.Vector3(), up = new THREE.Vector3();
  const beam = createBeam(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), {
    ...LASER_PRESET,
    coreWidth: LASER_PRESET.coreWidth * unit,
    glowWidth: LASER_PRESET.glowWidth * unit,
    jitterAmount: LASER_PRESET.jitterAmount * unit,
  });
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

  /* --- the scorch trail -------------------------------------------------- */
  // A capped instanced quad ribbon. Per-instance age lives in an instanced attribute and fades the alpha in the
  // fragment shader: three.js has no per-instance opacity, and tinting toward a "ground colour" would be a lie on
  // ground that is three different colours. Oldest quad is recycled once the cap is reached.
  const CAP = LASER_TRAIL.quads;
  const quadGeo = new THREE.PlaneGeometry(1, 1);
  quadGeo.rotateX(-Math.PI / 2);
  const ages = new Float32Array(CAP).fill(LASER_TRAIL.seconds);
  const ageAttr = new THREE.InstancedBufferAttribute(ages, 1);
  quadGeo.setAttribute('aAge', ageAttr);
  const quadMat = new THREE.MeshBasicMaterial({
    color: 0x14110f, transparent: true, opacity: 0.92, depthWrite: false,
  });
  quadMat.polygonOffset = true;
  quadMat.polygonOffsetFactor = -2;
  quadMat.polygonOffsetUnits = -4;
  quadMat.onBeforeCompile = (shader) => {
    shader.uniforms.uLife = { value: LASER_TRAIL.seconds };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAge;\nvarying float vAge;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAge = aAge;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uLife;\nvarying float vAge;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= clamp(1.0 - vAge / uLife, 0.0, 1.0);');
  };
  quadMat.customProgramCacheKey = () => 'laser-scorch-age-v1';
  const trail = new THREE.InstancedMesh(quadGeo, quadMat, CAP);
  trail.name = 'Laser scorch';
  trail.count = 0;
  trail.frustumCulled = false;
  trail.renderOrder = 8;
  group.add(trail);

  const dummy = new THREE.Object3D();
  const last = new THREE.Vector3();
  let next = 0, written = 0, laid = false, clock = 0;
  const quadSize = LASER_BEAM.radius * unit * 1.5;

  function stamp(point, normal) {
    dummy.position.copy(point).addScaledVector(normal, 0.04 * unit);
    dummy.quaternion.setFromUnitVectors(Y, normal);
    dummy.scale.set(quadSize, 1, quadSize);
    dummy.updateMatrix();
    trail.setMatrixAt(next, dummy.matrix);
    ages[next] = 0;
    next = (next + 1) % CAP;
    written = Math.min(CAP, written + 1);
    trail.count = written;
    trail.instanceMatrix.needsUpdate = true;
    ageAttr.needsUpdate = true;
    last.copy(point);
  }

  function place(contact, normal) {
    at.copy(contact);
    up.copy(normal).normalize();
    sky.copy(at).addScaledVector(up, LASER_SKY_METRES * unit);
    beam.setEndpoints(sky, at);
    ring.position.copy(at).addScaledVector(up, 0.08 * unit);
    ring.quaternion.setFromUnitVectors(Y, up);
  }

  return {
    trail,

    // the beam comes down here: show it, and start the ribbon at this point
    lay(contact, normal) {
      place(contact, normal);
      beam.mesh.visible = true;
      ring.visible = true;
      laid = true;
      stamp(at, up);
    },

    // the contact has moved: follow it, and fill the gap with quads every LASER_TRAIL.every metres
    aim(contact, normal) {
      place(contact, normal);
      if (!laid) return;
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

    // the player let go, or the energy ran out: the column goes, the scorch stays
    lift() {
      beam.mesh.visible = false;
      ring.visible = false;
      laid = false;
    },

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
      }
    },

    // what the column is drawing with right now, in scene units: a check reads this to see a slider reached the shader
    look() {
      const u = beam.mesh.material.uniforms;
      return {
        coreWidth: u.uCoreWidth.value, glowWidth: u.uGlowWidth.value, coreIntensity: u.uCoreIntensity.value,
        glowIntensity: u.uGlowIntensity.value, noiseAmount: u.uNoiseAmount.value, ringScale: ring.scale.x,
      };
    },

    tick(dt, energy01 = 1) {
      clock += dt;
      beam.update(clock);
      /* update() writes the burst envelope into uAlpha, so the energy fade has to come after it */
      beam.setAlpha(laid ? 0.35 + 0.65 * Math.max(0, Math.min(1, energy01)) : 0);
      ringMat.opacity = laid ? 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 9)) : 0;
      if (!written) return;
      for (let i = 0; i < written; i++) ages[i] += dt;
      ageAttr.needsUpdate = true;
    },

    dispose() {
      beam.mesh.geometry.dispose();
      beam.mesh.material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      quadGeo.dispose();
      quadMat.dispose();
      trail.dispose();
      scene.remove(group);
    },
  };
}
