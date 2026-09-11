// Presentation of the story base for both the lab and the game: instanced
// island slabs with a shader-drawn 4 m grid, kit walls and gate, and the
// landmark models on their islands. Consumes a base plan and a placer that
// maps frame metres onto whichever sphere the host renders.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { batchStaticAsset } from './asset-batching.js';

const loader = new GLTFLoader();
const cache = new Map();
const load = (url) => { if (!cache.has(url)) cache.set(url, loader.loadAsync(url)); return cache.get(url); };

// world basis at a frame point: local +Y is the sphere normal, local +Z the frame heading
function basisAt(placer, x, z, heading) {
  const o = placer.toWorld([x, 0, z]);
  const up = placer.toWorld([x, 1, z]).sub(o).normalize();
  const fwd = placer.toWorld([x + heading[0], 0, z + heading[1]]).sub(o).normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  const f2 = new THREE.Vector3().crossVectors(right, up).normalize();
  return new THREE.Matrix4().makeBasis(right, up, f2).setPosition(o);
}

function gridShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aIsland; varying vec2 vIslandLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvIslandLocal = position.xz * aIsland / 40.0;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vIslandLocal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 g = abs(fract(vIslandLocal / 4.0 + 0.5) - 0.5) * 4.0;
        float line = 1.0 - smoothstep(0.03, 0.09, min(g.x, g.y));
        diffuseColor.rgb *= mix(1.0, 0.62, line);`);
  };
  material.customProgramCacheKey = () => 'story-island-grid';
  return material;
}

export function createStoryBase(scene, { plan, placer, metres = 1, kit, rocket = true }) {
  const group = new THREE.Group(); group.name = 'Story base'; scene.add(group);
  const mixers = [], owned = new Set(), errors = [];
  const own = (root) => root.traverse((o) => { if (o.geometry) owned.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) owned.add(m); });
  const place = (obj, x, z, y, heading, scale = 1) => {
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(basisAt(placer, x, z, heading)).multiply(new THREE.Matrix4().makeTranslation(0, y * metres, 0)).multiply(new THREE.Matrix4().makeScale(scale * metres, scale * metres, scale * metres));
    obj.matrixWorldNeedsUpdate = true;
  };
  const counts = { islands: plan.islands.length, walls: plan.walls.length, structures: 0, gate: !!plan.gate };
  const ready = Promise.all([
    plan.islands.length ? load(kit.slab).then((gltf) => {
      const src = gltf.scene; src.updateMatrixWorld(true);
      const sizes = new Float32Array(plan.islands.flatMap((i) => [i.w, i.d]));
      src.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone(); geo.setAttribute('aIsland', new THREE.InstancedBufferAttribute(sizes, 2));
        const mat = o.material.clone(); if (o.name === 'SLAB') gridShader(mat);
        const inst = new THREE.InstancedMesh(geo, mat, plan.islands.length); inst.name = `island ${o.name}`;
        plan.islands.forEach((i, k) => {
          const m = basisAt(placer, i.x, i.z, i.heading).multiply(new THREE.Matrix4().makeTranslation(0, i.top * metres, 0))
            .multiply(new THREE.Matrix4().makeScale(i.w / kit.slabReference * metres, metres, i.d / kit.slabReference * metres)).multiply(o.matrixWorld);
          inst.setMatrixAt(k, m);
        });
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.receiveShadow = true; owned.add(geo); owned.add(mat); group.add(inst);
      });
    }) : null,
    plan.walls.length ? load(kit.wall).then((gltf) => {
      const src = gltf.scene; src.updateMatrixWorld(true);
      src.traverse((o) => {
        if (!o.isMesh) return;
        const inst = new THREE.InstancedMesh(o.geometry, o.material, plan.walls.length); inst.name = 'walls';
        plan.walls.forEach((w, k) => inst.setMatrixAt(k, basisAt(placer, w.x, w.z, w.heading).multiply(new THREE.Matrix4().makeTranslation(0, w.y * metres, 0)).multiply(new THREE.Matrix4().makeScale(metres, metres, metres)).multiply(o.matrixWorld)));
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.castShadow = true; group.add(inst);
      });
    }) : null,
    plan.gate ? load(kit.gate).then((gltf) => {
      const g = gltf.scene.clone(true); own(g); place(g, plan.gate.x, plan.gate.z, plan.gate.y, plan.gate.heading); g.name = 'gate'; group.add(g);
    }) : null,
    ...plan.structures.filter((s) => rocket || s.id !== 'sh02').map((s) => load(s.asset).then((gltf) => {
      const root = s.batch ? batchStaticAsset(gltf.scene, gltf.animations) : gltf.scene.clone(true);
      own(root); root.name = s.id;
      for (const name of s.hide ?? []) { const n = root.getObjectByName(name); if (n) n.visible = false; }
      const holder = new THREE.Group(); holder.add(root); root.position.set(...s.offset);
      place(holder, s.x, s.z, s.y, s.heading, s.scale); group.add(holder);
      if (s.clips?.length) {
        const mixer = new THREE.AnimationMixer(root);
        for (const clip of gltf.animations) {
          if (!s.clips.includes(clip.name)) continue;
          const a = mixer.clipAction(clip);
          if (s.hold) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.time = clip.duration; a.paused = true; }
          else a.play();
        }
        mixer.update(0); mixers.push(mixer);
      }
      counts.structures++;
    }).catch((e) => errors.push(`${s.id}: ${e}`))),
  ]);
  return {
    ready, group, counts, errors,
    tick(dt) { for (const m of mixers) m.update(dt); },
    dispose() { for (const m of mixers) m.stopAllAction(); for (const r of owned) r.dispose(); scene.remove(group); },
  };
}
