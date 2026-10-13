// Ported from Jelly-Baby src/cutis/creature/hard-core.ts (the owner's own project, commit 3a985e1; GPL-3.0, see ./LICENSE), types stripped: the rigid cores of the
// hard-core and Pearl lineages. "Rigid geometry never inherits membrane vertex stretching": one instanced mesh, each instance placed every frame from the swarm's
// getCoreContact(i), the core's centre on the SHARED transfer path the membrane shader pads its shell round (uHardRadius), never interpolated on its own.
// Changes from the kit: only the Pearl (shape 3, the sphere: MeshPhysicalMaterial at roughness .17, clearcoat 1) is ported, the dodecahedron and the
// inverted pyramids are not used by the game (owner, 2026-10-13: the Pearl set); the colour is the material's (coreTint: one swarm is one tier here, not the
// kit's mixed preview); and the core follows what the membrane shader does to its body AFTER the hard-core block, in the same order (./shaders.js):
// the ground clamp, the deflate (the death's puddle: the core sinks with the flattening body), the lift (iLife.x: the emergence's depth and the death's
// sink, weighted as the body's own vertices are: all of it before the transfer, (1 - u)^2 through it, none in the settle) and the planet bend (bendPoint,
// PLANET_BEND term for term), so the shell and the core never part on the sphere. The opacity (iLife.z: the death's fade, the phantom's cloak) fades the
// core per instance (an iFade attribute patched into the material's alpha).
import * as THREE from '../../../vendor/three.module.js';
import { transferProgress } from './config.js';
import { bendPoint, hubPoint } from './shaders.js';

/** The core's centre (plane metres, y up, bent onto the sphere of radius `planetR`; 0 = flat) and radius for instance i, as drawn; `out` [x, y, z, radius]. */
export function corePose(swarm, i, planetR = 0, out = [0, 0, 0, 0]) {
  const c = swarm.coreContactInto(i, swarm.scratchCore), L = swarm.life, k = i * 3, s = swarm.lengthScale, phase = swarm.phase[i];
  const lift = L[i * 4], squash = L[i * 4 + 1];
  let { x, y, z } = c.center;
  y = Math.max(.009 * s, y);
  if (squash !== 0) {   // round two: signed, an impact's rebound below zero (./shaders.js)
    const a = phase < .62 ? 0 : phase < .85 ? transferProgress((phase - .62) / .23, swarm.config.transferAcceleration) : 1;
    const cx = swarm.offset[k] + (swarm.anchor[k] - swarm.offset[k]) * a, cz = swarm.offset[k + 2] + (swarm.anchor[k + 2] - swarm.offset[k + 2]) * a;
    x = cx + (x - cx) * (1 + .6 * squash); z = cz + (z - cz) * (1 + .6 * squash);
    y = .009 * s + (y - .009 * s) * (1 - .92 * squash);
  }
  y += phase >= .85 ? 0 : phase >= .62 ? lift * (1 - c.u) * (1 - c.u) : lift;
  bendPoint(x, y, z, planetR, out);
  if (planetR > 0 && swarm.hubQuat && swarm.hubQuat[i * 4 + 3] !== 1) hubPoint(out[0], out[1], out[2], planetR, swarm.hubQuat, i * 4, out);   // round two: its hub (./shaders.js HUB_TURN)
  out[3] = c.radius;
  return out;
}

// ROUND TWO (owner, 2026-10-13, "fps wise we maybe cannot afford them as is"): `levelOf` (./geometry.js, each instance's level this frame) picks the
// pearl's resolution: the kit's sphere (24 x 16) under a high-hull body, a 10 x 7 one under the others, none under a culled one. Without it every
// pearl is drawn at the kit's resolution, as before. And (the fable review): a pearl fading (the phantom's cloak, the death) is drawn by a twin mesh whose
// material writes no depth, so a faint core cannot cut the membrane behind it out of the picture; the colour is per instance (instanceColor over a white
// material: the tier's coreTint, toward the slow tower's ice by the body's tint, iLife.w), as the dot clouds' solid cores turn ice when slowed.
export const ICE = 0x8fd4ff;
export function createHardCores(swarm, { planetR = 0, levelOf = null } = {}) {
  // [fine, coarse] x [opaque, fading]: four meshes, two spheres, two materials
  const spheres = [new THREE.SphereGeometry(1, 24, 16), new THREE.SphereGeometry(1, 10, 7)];
  const fade = [0, 1, 2, 3].map(() => new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity), 1).setUsage(THREE.DynamicDrawUsage));
  const geometries = fade.map((f, k) => { const g = new THREE.BufferGeometry(), src = spheres[k % 2]; g.setIndex(src.index); for (const n of ['position', 'normal', 'uv']) g.setAttribute(n, src.getAttribute(n)); g.setAttribute('iFade', f); return g; });
  const patch = (material, key) => {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute float iFade;\nvarying float vFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = iFade;');
      shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= vFade;');
    };
    material.customProgramCacheKey = () => key;
    return material;
  };
  const material = patch(new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: .17, clearcoat: 1, clearcoatRoughness: .12, emissive: 0x000000, transparent: true }), 'cutis-hard-core');
  const faint = patch(material.clone(), 'cutis-hard-core'); faint.depthWrite = false;
  const meshes = geometries.map((g, k) => {
    const m = new THREE.InstancedMesh(g, k < 2 ? material : faint, swarm.capacity);
    m.frustumCulled = false; m.renderOrder = 1; m.count = 0; m.visible = false; m.name = 'Rigid hard cores';
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    return m;
  });
  const mesh = meshes[0];
  const group = new THREE.Group(); group.name = 'Rigid hard cores'; group.add(...meshes);
  const pose = new THREE.Object3D(), at = [0, 0, 0, 0], counts = [0, 0, 0, 0], tint = new THREE.Color(), ice = new THREE.Color(ICE), base = new THREE.Color();
  let planet = planetR > 0 ? planetR : 0;
  /** Place every active, visible instance's core (a config without a core shape draws none). */
  function update() {
    counts.fill(0);
    if ((swarm.config.coreShape ?? 0) >= 1) {
      base.setHex(swarm.config.coreTint ?? 0xff242c);
      for (let i = 0; i < swarm.count; i++) {
        if (!swarm.active[i]) continue;
        const level = levelOf ? levelOf[i] : 0;
        if (level > 2) continue;
        const o = swarm.life[i * 4 + 2], k = (level === 0 ? 0 : 1) + (o < .995 ? 2 : 0), n = counts[k]++;
        corePose(swarm, i, planet, at);
        pose.position.set(at[0], at[1], at[2]); pose.scale.setScalar(at[3]); pose.rotation.set(.2, swarm.seed[i] + swarm.time * .18, .16); pose.updateMatrix();
        meshes[k].setMatrixAt(n, pose.matrix); fade[k].array[n] = o;
        meshes[k].setColorAt(n, tint.copy(base).lerp(ice, Math.max(0, Math.min(1, swarm.life[i * 4 + 3]))));
      }
    }
    meshes.forEach((m, k) => {
      m.count = counts[k]; m.visible = counts[k] > 0;
      if (!counts[k]) return;
      m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; fade[k].clearUpdateRanges(); fade[k].addUpdateRange(0, counts[k]); fade[k].needsUpdate = true;
    });
  }
  return { group, mesh, meshes, update, get count() { return counts[0] + counts[1] + counts[2] + counts[3]; }, setPlanetR: (R) => { planet = R > 0 ? R : 0; }, get planetR() { return planet; },
    dispose: () => { spheres.forEach((g) => g.dispose()); geometries.forEach((g) => g.dispose()); material.dispose(); faint.dispose(); meshes.forEach((m) => m.dispose()); } };
}
