// The SH02 arrival in the story lab: rocket, clips, plume, dust, scorch and
// Isao, driven by one timeline state from domain/landing-sequence.js.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { createLaunchPlume } from '../fx/launch-plume.js';
import { makeScorch, makeEmbers, IMPACT_TUNE } from '../impactfx.js';
import { makeIsaoDrone, preloadFabricator } from '../units.js';

const ROCKET_URL = 'assets/models/story/sh_rocket.glb';
const ISAO_METRES = 2.5;          // fits the 3.6 m cargo well
const BELL_HEIGHT = 2.0;          // engine bells above the touchdown plane
const WELL_HEIGHT = 19.0;         // cargo well floor above the touchdown plane

export function createStoryLanding(scene, { padFloor, yaw, dustTint = 0x9a8f7a }) {
  const root = new THREE.Group(); root.name = 'Arrival'; root.rotation.y = yaw; root.position.y = padFloor; scene.add(root);
  const lift = new THREE.Group(); lift.name = 'Descent'; root.add(lift);
  const plume = createLaunchPlume(); plume.position.y = BELL_HEIGHT - 13; lift.add(plume);
  const effects = new THREE.Group(); root.add(effects);
  let rocket = null, mixer = null, actions = {}, isao = null, scorch = null, dust = null, dustAt = -1, error = null;
  const geometries = new Set(), materials = new Set();
  const own = (o) => o.traverse((n) => { if (n.geometry) geometries.add(n.geometry); for (const m of [n.material].flat().filter(Boolean)) materials.add(m); });
  const ready = Promise.all([
    new GLTFLoader().loadAsync(ROCKET_URL).then((gltf) => {
      rocket = gltf.scene; rocket.name = 'SH02'; own(rocket); lift.add(rocket);
      rocket.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      mixer = new THREE.AnimationMixer(rocket);
      for (const clip of gltf.animations) { const a = mixer.clipAction(clip); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; actions[clip.name] = a; }
    }).catch((e) => { error = String(e); }),
    preloadFabricator().then((ok) => {
      if (!ok) return;
      isao = makeIsaoDrone();
      if (!isao) return;
      isao.scale.setScalar(ISAO_METRES / 0.55); isao.name = 'Isao'; isao.visible = false; own(isao); root.add(isao);
    }),
  ]);
  const held = new Map();
  function hold(name, time) {
    const a = actions[name]; if (!a) return;
    if (time === null) { a.stop(); held.delete(name); return; }
    if (!held.has(name)) { a.reset(); a.play(); }
    a.paused = true; a.time = time; held.set(name, time);
  }
  function apply(state, t) {
    lift.position.y = state.altitude;
    plume.userData.setIntensity(state.plume); plume.userData.tick(t);
    if (mixer) {
      // stowed until deploy begins; the shock clip owns the legs after touchdown
      const shockOn = state.clips.Landing_Shock !== null;
      hold('Legs_Deploy', shockOn ? null : (state.clips.Legs_Deploy ?? 0));
      hold('Landing_Shock', state.clips.Landing_Shock);
      hold('Top_Door_Open', state.clips.Top_Door_Open ?? 0);
      hold('Legs_Retract', null); hold('Top_Door_Close', null);
      mixer.update(0);
    }
    if (state.scorch && !scorch) {
      scorch = makeScorch({ ...IMPACT_TUNE, scorchSize: 9, scorchLife: 1e9 }, 0x0a0806);
      scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.02; effects.add(scorch);
    }
    if (!state.scorch && scorch) { effects.remove(scorch); scorch.geometry.dispose(); scorch.material.dispose(); scorch = null; }
    if (state.dust && !dust) {
      dust = makeEmbers({ ...IMPACT_TUNE, emberCount: 420, emberLife: 2.6, emberDrag: 0.985, emberRise: 0.9 }, dustTint, 11);
      dust.scale.setScalar(6); dust.position.y = 0.4; effects.add(dust); dustAt = t;
    }
    if (dust && (!state.dust && t - dustAt > 2.6 || t < dustAt)) { effects.remove(dust); dust.geometry.dispose(); dust.material.dispose(); dust = null; }
    if (isao) {
      isao.visible = state.isaoRise > 0;
      const r = state.isaoRise;
      isao.position.set(7 * r, WELL_HEIGHT + 9 * r - 2 * Math.sin(r * Math.PI), -2 * r);
      isao.userData.spinRotors?.(1 / 60, r);
      isao.userData.setWork?.(r > 0.9 ? 0.6 : 0);
    }
  }
  let lastT = 0;
  return {
    ready,
    apply(state, t) { lastT = t; apply(state, t); },
    tick(dt, camera) {
      plume.userData.face(camera);
      if (dust) { if (!dust.userData.tick(dt)) { effects.remove(dust); dust.geometry.dispose(); dust.material.dispose(); dust = null; } }
      if (isao?.visible) { isao.userData.spinRotors?.(dt, 0.4); isao.userData.tickFace?.(dt); }
    },
    state: () => ({ loaded: !!rocket, error, clips: Object.fromEntries(Object.keys(actions).map((k) => [k, held.has(k) ? +held.get(k).toFixed(3) : null])), altitude: lift.position.y, isao: isao ? { visible: isao.visible, y: +isao.position.y.toFixed(2) } : null, scorch: !!scorch, dust: !!dust, t: lastT }),
    rocketTop: () => WELL_HEIGHT,
    dispose() {
      mixer?.stopAllAction(); if (rocket) mixer?.uncacheRoot(rocket);
      plume.userData.dispose(); for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
      scene.remove(root);
    },
  };
}
