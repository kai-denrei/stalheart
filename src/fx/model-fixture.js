// A PINNED MODEL ON THE BENCH (owner, 2026-10-01: "UNITS are not showing all the units; we should see SOL, and the Gunship. also show
// Wireframe for all units"). The Units lab casts its machines through the game's own builders; the satellites and the gunship have no
// builder, only a GLB the briefings and the showcase turn as a wireframe (src/content/showcase.js). This loads such a GLB once and hands
// out clones, and turns any bench object into the briefings' pale cyan wireframe and back. No DOM; the lab owns the buttons.
import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { cloneSkinned } from './skinned-clone.js';

const WIRE = 0xbfe6ea;
const loaded = new Map();   // url -> Promise<THREE.Group>
const ready = new Map();    // url -> the loaded scene, once its promise has settled (a promise is never readable synchronously)
const clips = new Map();    // url -> its AnimationClips (kept here, not on userData: Object3D.clone JSON-copies userData and kills a clip)

export const loadModelFixture = (url) => {
  let p = loaded.get(url);
  if (!p) {
    p = new Promise((res, rej) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, (g) => { clips.set(url, g.animations ?? []); res(g.scene); }, undefined, rej));
    p.then((scene) => ready.set(url, scene), () => {});
    loaded.set(url, p);
  }
  return p;
};

// the clips a loaded model carries (empty until it lands, or when it has none): the bench's ANIMATION plays them on a clone
export const modelClips = (url) => clips.get(url) ?? [];

// a copy of a loaded model that owns its own skeleton: Object3D.clone keeps a skinned mesh bound to the CACHED model's bones, so a moved,
// scaled clone still drew where the cache sits and at its size (SOL-82's bench pass drew a 40 m satellite over the range, 2026-10-02)
export const cloneFixture = (scene) => cloneSkinned(scene);

// the loaded model, or null while its bytes are on the way (`then` runs once, when they land)
export function modelFixture(url, then) {
  const out = ready.get(url) ?? null;
  if (!out) loadModelFixture(url).then(() => then?.(), () => {});
  return out;
}

// every mesh under `root` drawn as the briefings' wireframe (on) or in its own material again (off). The solid material is kept on
// the mesh so the toggle is lossless; a mesh wireframed twice keeps the first solid.
export function setWireframe(root, on) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    if (on) {
      if (o.isPoints) { o.userData.solidVisible ??= o.visible; o.visible = false; return; }   // dot clouds have no edges to draw
      o.userData.solid ??= o.material;
      if (!o.userData.wire) o.userData.wire = new THREE.MeshBasicMaterial({ color: WIRE, wireframe: true, transparent: true, opacity: 0.85 });
      o.material = o.userData.wire;
    } else {
      if (o.isPoints) { if (o.userData.solidVisible !== undefined) o.visible = o.userData.solidVisible; return; }
      if (o.userData.solid) o.material = o.userData.solid;
    }
  });
}
