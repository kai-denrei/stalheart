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
// TINTED (owner, 2026-10-26, on the in-game ?wire=1: "various elements with slightly different colors", as a CAD wireframe reads: dim body
// lines, bright lenses and lights, a warm part warm): with `tint` each mesh's lines take their colour from its solid material. A lit part
// (an emissive of some lightness, or a part named for a sensor, a lens, a gun or a light) is an accent: its emissive toward white, opaque;
// armour plates are the dimmest; everything else keeps its own hue nudged toward the wire's cyan at a mid lightness, so dark metal still reads.
const WHITE = new THREE.Color(0xffffff), CYAN = new THREE.Color(WIRE), hsl = { h: 0, s: 0, l: 0 };
const ACCENT = /SENSOR|LENS|OPTIC|MUZZLE|LASER|MINIGUN|MISSILE|LIGHT|LAMP|EMITTER|BEACON|RADAR|ANTENNA/i, PLATE = /ARMOR|ARMOUR|PLATE|SHIELD/i;
const HYDRAULIC = /HYDRAULIC|PISTON|ROD\b|ACTUATOR/i, LIMB = /CLAW|ARM\b|_ARM_|LEG|SHIN|THIGH|KNEE|HIP|FOOT|TRIPOD/i;   // a one-material model (the Ridgeback) gets its variety from its part names
export function wireLook(o, tint) {
  if (!tint) return { color: WIRE, opacity: 0.85 };
  const m = [o.userData.solid ?? o.material].flat()[0];
  const lit = !!m?.emissive && (m.emissiveIntensity ?? 1) >= 1 && m.emissive.getHSL(hsl).l > 0.3;
  if (lit || ACCENT.test(o.name)) return { color: (lit ? m.emissive : CYAN).clone().lerp(WHITE, 0.3), opacity: 1 };
  const c = m?.color ? m.color.clone() : CYAN.clone(); c.getHSL(hsl); const grey = hsl.s < 0.1, n = o.name;
  if (PLATE.test(n)) c.setHSL(grey ? 0.52 : hsl.h, grey ? 0.2 : hsl.s, 0.27);   // armour: the dimmest, a blue-grey
  else if (HYDRAULIC.test(n)) c.setHSL(0.08, 0.45, 0.42);   // hydraulics and rods: copper, as a drawing marks its fittings
  else if (LIMB.test(n)) c.setHSL(grey ? 0.55 : hsl.h, grey ? 0.15 : hsl.s, 0.4);   // limbs: steel
  else { c.lerp(CYAN, 0.3); c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * 1.2), 0.22 + 0.3 * hsl.l); }   // 0.22-0.52: body lines dim enough that the bloom leaves them alone and the accents stand out
  return { color: c, opacity: 0.7 };
}
export function setWireframe(root, on, { tint = false } = {}) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    if (on) {
      if (o.isPoints) { o.userData.solidVisible ??= o.visible; o.visible = false; return; }   // dot clouds have no edges to draw
      o.userData.solid ??= o.material;
      if (!o.userData.wire || o.userData.wire.userData.tint !== tint) { const { color, opacity } = wireLook(o, tint); o.userData.wire?.dispose(); o.userData.wire = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity }); o.userData.wire.userData.tint = tint; }
      o.material = o.userData.wire;
    } else {
      if (o.isPoints) { if (o.userData.solidVisible !== undefined) o.visible = o.userData.solidVisible; return; }
      if (o.userData.solid) o.material = o.userData.solid;
    }
  });
}
