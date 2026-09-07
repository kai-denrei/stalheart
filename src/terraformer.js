// Opt-in Sentry Workshop asset adapter. Articulated clips stay authored; the host
// still owns the tangent transform, heart rules, pedestal footprint and clock.
import * as THREE from '../vendor/three.module.js';
import { loadGlbWithClips, fitModel, mergeByMaterial } from './glbmodels.js';
import { record } from './diagnostics.js';
const states = new Map();
const pending = new Map();
export const terraformerState = hp => hp <= 0 ? 3 : hp <= 0.3 ? 2 : hp <= 0.65 ? 1 : 0;
export function prepareTerraformer(scene, clips, reference = null) {
  const excluded = [];
  scene.traverse(o => { if (/^(COLLIDER|COLLISION|SOCKET)_/i.test(o.name)) excluded.push(o.name); });
  const pivots = [...new Set(clips.flatMap(c => c.tracks.map(t => THREE.PropertyBinding.parseTrackName(t.name).nodeName)))];
  // Keep Workshop's palette readable under the board's dim lighting, while
  // retaining authored luminous telemetry. Materials are shared only within
  // this cached prototype, never mutated in the original loader cache.
  const materials = new Map();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const dress = m => {
      if (!materials.has(m)) {
        const copy = m.clone();
        copy.color?.multiplyScalar(1.35);
        if (copy.emissive && copy.emissiveIntensity * copy.emissive.getHex() === 0) {
          copy.emissive.copy(copy.color).multiplyScalar(0.07);
          copy.emissiveIntensity = 1;
        }
        materials.set(m, copy);
      }
      return materials.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(dress) : dress(o.material);
  });
  mergeByMaterial(scene, pivots, excluded);
  let model;
  if (reference) {
    // All damage states share the intact ground origin and scale. Fitting a
    // collapsed model independently would enlarge it when it loses height.
    scene.scale.copy(reference.scale); scene.position.copy(reference.position);
    model = new THREE.Group(); model.add(scene);
  } else model = fitModel(scene, { height: 1, maxSpan: 2 });
  return { model, clips, pivots, fit: { scale: scene.scale.clone(), position: scene.position.clone() } };
}
export async function preloadSentryTerraformer(state=0) {
  if (states.has(state)) return true;
  if (pending.has(state)) return pending.get(state);
  const promise = (async () => {
    const data = await loadGlbWithClips(`assets/models/sentry-terraformer/terraformer_3000_d${state}.glb`);
    if (!data) { record('asset.failed', { asset:'terraformer', state }); return false; }
    const prepared = prepareTerraformer(data.scene, data.clips, state ? states.get(0)?.fit : null);
    states.set(state, prepared);
    let meshes=0, triangles=0;
    prepared.model.traverse(o => { if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count || o.geometry.attributes.position.count)/3;} });
    record('asset.ready', { asset:'terraformer', state, meshes, triangles, clips:data.clips.map(c=>c.name) });
    console.log(`SENTRY_TERRAFORMER state=${state} meshes=${meshes} triangles=${triangles} clips=${data.clips.length}`);
    return true;
  })();
  pending.set(state,promise);
  return promise;
}
export function makeSentryTerraformer() {
  if(!states.has(0)){void preloadSentryTerraformer();return null;}
  const root = new THREE.Group();
  const rig = new THREE.Group();root.add(rig);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.12,1.08,.13,40), new THREE.MeshStandardMaterial({color:0x333e42,roughness:.85}));
  pad.position.y=-.065;rig.add(pad);
  let model, mixer, current=-1, wanted=0, time=0, disposed=false;
  function apply(state) {
    const item=states.get(state);if(!item || current===state || disposed)return;
    if(mixer){mixer.stopAllAction();mixer.uncacheRoot(model);}
    if(model)rig.remove(model);
    model=item.model.clone(true);rig.add(model);current=state;
    mixer=new THREE.AnimationMixer(model);
    for(const clip of item.clips)mixer.clipAction(clip).play();
    mixer.setTime(time);
    root.userData.assetState=state;
  }
  apply(0);
  root.userData.padR=1.12;root.userData.sizeScale=1;root.userData.working=0;
  root.userData.asset='sentry-terraformer';
  root.userData.setHealth=fraction=>{
    const state=terraformerState(fraction);if(state===wanted)return;wanted=state;
    if(states.has(state))apply(state);
    else void preloadSentryTerraformer(state).then(ok=>{if(ok && state===wanted)apply(state);});
  };
  root.userData.hit=()=>{}; // authored damage states carry the damage read
  root.userData.tick=t=>{time=t;root.scale.setScalar(root.userData.sizeScale);mixer?.setTime(t);};
  root.userData.dispose=()=>{disposed=true;mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);pad.geometry.dispose();pad.material.dispose();};
  return root;
}
