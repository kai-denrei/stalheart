// Presentation of the story base for both the lab and the game: instanced
// island slabs with a shader-drawn 4 m grid, kit walls and gate, and the
// landmark models on their islands. Consumes a base plan and a placer that
// maps frame metres onto whichever sphere the host renders.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { batchStaticAsset } from './asset-batching.js';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();
// no document means Node: the plan is still computed and reported, nothing is fetched
const load = (url) => { if (typeof document === 'undefined') return Promise.resolve(null); if (!cache.has(url)) cache.set(url, loader.loadAsync(url)); return cache.get(url); };

// world basis at a frame point: local +Y is the sphere normal, local +Z the frame heading
export function basisAt(placer, x, z, heading) {
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

// A door swing authored from the model itself: every DOOR/RAMP node of bay `from` turns from its own
// (sealed) pose to the pose of its twin on bay `like`, which stands open. No numbers leave the asset.
export function swingClip(root, from, like, seconds) {
  const tracks = [];
  root.traverse((o) => {
    const m = /^(DOOR|RAMP)_(\d\d)/.exec(o.name); if (!m || m[2] !== from) return;
    const twin = root.getObjectByName(o.name.replace(`_${from}`, `_${like}`)); if (!twin) return;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${o.name}.quaternion`, [0, seconds], [...o.quaternion.toArray(), ...twin.quaternion.toArray()]));
  });
  return new THREE.AnimationClip(`Doors_${from}`, seconds, tracks);
}
// loader names lose their dots (VEHICLE_02.001 becomes VEHICLE_02001): match the authored name as a prefix
export const nodeNamed = (root, name) => { let hit = null; root.traverse((o) => { if (!hit && o.name.startsWith(name)) hit = o; }); return hit; };

export function createStoryBase(scene, { plan, placer, metres = 1, kit, skip = [], sfx = null }) {
  const group = new THREE.Group(); group.name = 'Story base'; scene.add(group);
  const mixers = [], owned = new Set(), errors = [], bays = [], lod = [];
  const own = (root) => root.traverse((o) => { if (o.geometry) owned.add(o.geometry); for (const m of [o.material].flat().filter(Boolean)) owned.add(m); });
  const place = (obj, x, z, y, heading, scale = 1) => {
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(basisAt(placer, x, z, heading)).multiply(new THREE.Matrix4().makeTranslation(0, y * metres, 0)).multiply(new THREE.Matrix4().makeScale(scale * metres, scale * metres, scale * metres));
    obj.matrixWorldNeedsUpdate = true;
  };
  const counts = { islands: plan.islands.length, walls: plan.walls.length, structures: 0, gate: !!plan.gate };
  // the gate opens when something friendly is inside its radius and closes again behind it
  const gate = { mixer: null, action: null, duration: 0, position: null, radius: 0, open: false, want: false, t: 0 };
  function driveGate(dt) {
    if (!gate.action) return;
    const before = gate.t;
    gate.t = Math.max(0, Math.min(gate.duration, gate.t + (gate.want ? dt : -dt)));
    if (gate.want && before === 0 && gate.t > 0) sfx?.play('gate_hydraulics');
    if (!gate.want && before > 0 && gate.t === 0) sfx?.play('gate_slam');
    if (!gate.action.isRunning() && gate.t > 0) { gate.action.play(); }
    gate.action.paused = true; gate.action.time = gate.t; gate.mixer.update(0);
    gate.open = gate.t >= gate.duration - 1e-6;
  }
  const ready = Promise.all([
    plan.islands.length ? load(kit.slab).then((gltf) => {
      if (!gltf) return;
      const src = gltf.scene; src.updateMatrixWorld(true);
      const sizes = new Float32Array(plan.islands.flatMap((i) => [i.w, i.d]));
      src.traverse((o) => {
        if (!o.isMesh) return;
        const geo = o.geometry.clone(); geo.setAttribute('aIsland', new THREE.InstancedBufferAttribute(sizes, 2));
        const mat = o.material.clone(); mat.polygonOffset = true; mat.polygonOffsetFactor = 1; mat.polygonOffsetUnits = 2; if (o.name === 'SLAB') gridShader(mat);
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
      if (!gltf) return;
      const src = gltf.scene; src.updateMatrixWorld(true);
      src.traverse((o) => {
        if (!o.isMesh) return;
        const inst = new THREE.InstancedMesh(o.geometry, o.material, plan.walls.length); inst.name = 'walls';
        plan.walls.forEach((w, k) => inst.setMatrixAt(k, basisAt(placer, w.x, w.z, w.heading).multiply(new THREE.Matrix4().makeTranslation(0, w.y * metres, 0)).multiply(new THREE.Matrix4().makeScale(metres, metres, metres)).multiply(o.matrixWorld)));
        inst.instanceMatrix.needsUpdate = true; inst.computeBoundingSphere(); inst.castShadow = true; group.add(inst);
      });
    }) : null,
    plan.gate ? load(kit.gate).then((gltf) => {
      if (!gltf) return;
      const g = gltf.scene.clone(true); own(g); place(g, plan.gate.x, plan.gate.z, plan.gate.y, plan.gate.heading); g.name = 'gate'; group.add(g);
      const clip = gltf.animations.find((c) => c.name === 'Gate_Open');
      if (clip) { gate.mixer = new THREE.AnimationMixer(g); gate.action = gate.mixer.clipAction(clip); gate.action.setLoop(THREE.LoopOnce, 1); gate.action.clampWhenFinished = true; gate.duration = clip.duration; }
      gate.position = placer.toWorld([plan.gate.x, 0, plan.gate.z]); gate.radius = plan.gate.openRadius * metres;
    }) : null,
    // A LANDMARK WITH A FAR TIER LOADS THAT FIRST and stands on it; the near tier is fetched only once the camera comes within
    // kit.lod.metres, then the two swap by camera distance with hysteresis. Far away (the map, the orbit) the whole base is cheap.
    ...plan.structures.filter((s) => !skip.includes(s.id)).map((s) => load(s.far ?? s.asset).then((gltf) => {
      if (!gltf) return;
      const holder = new THREE.Group(); place(holder, s.x, s.z, s.y, s.heading, s.scale); group.add(holder);
      const root = mount(s, gltf, holder);
      if (s.far) lod.push({ id: s.id, holder, far: root, near: null, loading: false, shown: 'far', at: new THREE.Vector3().setFromMatrixPosition(holder.matrix) });
      counts.structures++;
    }).catch((e) => errors.push(`${s.id}: ${e}`))),
  ]);
  // one tier of a landmark: batched or cloned, offset, hidden nodes, its clips, and for the bays their hooks
  function mount(s, gltf, holder) {
      const root = s.batch ? batchStaticAsset(gltf.scene, gltf.animations) : gltf.scene.clone(true);
      own(root); root.name = s.id;
      for (const name of s.hide ?? []) { const n = root.getObjectByName(name); if (n) n.visible = false; }
      holder.add(root); root.position.set(...s.offset);
      const mixer = s.clips?.length || s.pose || s.bays ? new THREE.AnimationMixer(root) : null, held = {};
      if (mixer) {
        for (const clip of gltf.animations) {
          const at = s.pose?.[clip.name];   // a clip held at a time: the bay's roll-out at 0 keeps every hull inside
          if (!s.clips?.includes(clip.name) && at === undefined) continue;
          const a = mixer.clipAction(clip);
          if (s.hold || at !== undefined) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.time = at ?? clip.duration; a.paused = true; held[clip.name] = a; }
          else a.play();
        }
        mixer.update(0); mixers.push(mixer);
      }
      // the bays hand the game their parked hull (hidden once it has driven out), a one-shot door opening, and
      // for the bay with an authored roll-out its clip length and a scrub: the game's deploy drives the clock
      for (const b of s.bays ?? []) {
        let opened = false;
        const out = b.rollout ? held[b.rollout] : null;
        bays.push({ n: b.n, vehicle: b.vehicle ? nodeNamed(root, b.vehicle) : null, rollout: out ? out.getClip().duration : 0, open() {
          if (opened || !b.doors) return; opened = true;
          const a = mixer.clipAction(swingClip(root, b.doors, b.like, kit.bay?.doorSeconds ?? 2.4)); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play();
        }, roll(t) { if (out) { out.paused = true; out.time = Math.max(0, Math.min(out.getClip().duration, t)); mixer.update(0); } } });
      }
      bays.sort((a, b) => a.n - b.n);
      return root;
  }
  const lodSwitch = (kit.lod?.metres ?? 150) * metres, lodHyst = kit.lod?.hysteresis ?? 1.3;
  function driveLod(eye) {
    if (!eye) return;
    for (const l of lod) {
      const d = l.at.distanceTo(eye);
      if (!l.near && !l.loading && d < lodSwitch * lodHyst) { l.loading = true; const s = plan.structures.find((x) => x.id === l.id); load(s.asset).then((gltf) => { if (!gltf) return; l.near = mount(s, gltf, l.holder); l.near.visible = false; }).catch((e) => errors.push(`${l.id} near: ${e}`)); }
      if (!l.near) continue;
      const near = l.shown === 'near' ? d < lodSwitch * lodHyst : d < lodSwitch;
      l.shown = near ? 'near' : 'far'; l.near.visible = near; l.far.visible = !near;
    }
  }
  return {
    ready, group, counts, errors,
    tick(dt, near = null, force = null, eye = null) {
      for (const m of mixers) m.update(dt);
      driveLod(eye);
      if (gate.position) gate.want = force ?? (Array.isArray(near) && Math.hypot(near[0] - gate.position.x, near[1] - gate.position.y, near[2] - gate.position.z) < gate.radius);
      driveGate(dt);
    },
    gate: () => ({ present: !!gate.action, open: gate.open, want: gate.want, t: +gate.t.toFixed(2) }),
    bays: () => bays,
    lod: () => lod.map((l) => ({ id: l.id, shown: l.shown, nearLoaded: !!l.near })),
    dispose() { for (const m of mixers) m.stopAllAction(); gate.mixer?.stopAllAction(); for (const r of owned) r.dispose(); scene.remove(group); },
  };
}
