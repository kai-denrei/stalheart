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
import { bendPoint } from './shaders.js';

/** The core's centre (plane metres, y up, bent onto the sphere of radius `planetR`; 0 = flat) and radius for instance i, as drawn; `out` [x, y, z, radius]. */
export function corePose(swarm, i, planetR = 0, out = [0, 0, 0, 0]) {
  const c = swarm.getCoreContact(i), L = swarm.life, k = i * 3, s = swarm.lengthScale, phase = swarm.phase[i];
  const lift = L[i * 4], squash = L[i * 4 + 1];
  let { x, y, z } = c.center;
  y = Math.max(.009 * s, y);
  if (squash > 0) {
    const a = phase < .62 ? 0 : phase < .85 ? transferProgress((phase - .62) / .23, swarm.config.transferAcceleration) : 1;
    const cx = swarm.offset[k] + (swarm.anchor[k] - swarm.offset[k]) * a, cz = swarm.offset[k + 2] + (swarm.anchor[k + 2] - swarm.offset[k + 2]) * a;
    x = cx + (x - cx) * (1 + .6 * squash); z = cz + (z - cz) * (1 + .6 * squash);
    y = .009 * s + (y - .009 * s) * (1 - .92 * squash);
  }
  y += phase >= .85 ? 0 : phase >= .62 ? lift * (1 - c.u) * (1 - c.u) : lift;
  bendPoint(x, y, z, planetR, out);
  out[3] = c.radius;
  return out;
}

export function createHardCores(swarm, { planetR = 0 } = {}) {
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const fade = new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity), 1).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('iFade', fade);
  const material = new THREE.MeshPhysicalMaterial({ color: swarm.config.coreTint ?? 0xff242c, metalness: 0, roughness: .17, clearcoat: 1, clearcoatRoughness: .12, emissive: 0x000000, transparent: true });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute float iFade;\nvarying float vFade;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vFade = iFade;');
    shader.fragmentShader = 'varying float vFade;\n' + shader.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= vFade;');
  };
  material.customProgramCacheKey = () => 'cutis-hard-core';
  const mesh = new THREE.InstancedMesh(geometry, material, swarm.capacity);
  mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.count = 0; mesh.visible = false; mesh.name = 'Rigid hard cores';
  const group = new THREE.Group(); group.name = 'Rigid hard cores'; group.add(mesh);
  const pose = new THREE.Object3D(), at = [0, 0, 0, 0];
  let planet = planetR > 0 ? planetR : 0;
  /** Place every active instance's core (a config without a core shape draws none). */
  function update() {
    let count = 0;
    if ((swarm.config.coreShape ?? 0) >= 1) {
      for (let i = 0; i < swarm.count; i++) {
        if (!swarm.active[i]) continue;
        corePose(swarm, i, planet, at);
        pose.position.set(at[0], at[1], at[2]); pose.scale.setScalar(at[3]); pose.rotation.set(.2, swarm.seed[i] + swarm.time * .18, .16); pose.updateMatrix();
        mesh.setMatrixAt(count, pose.matrix); fade.array[count] = swarm.life[i * 4 + 2]; count++;
      }
    }
    mesh.count = count; mesh.visible = count > 0; mesh.instanceMatrix.needsUpdate = true;
    fade.clearUpdateRanges(); fade.addUpdateRange(0, count); fade.needsUpdate = true;
  }
  return { group, mesh, update, setPlanetR: (R) => { planet = R > 0 ? R : 0; }, get planetR() { return planet; }, dispose: () => { geometry.dispose(); material.dispose(); mesh.dispose(); } };
}
