// A BASE STRUCTURE PRINTED AS THE SENTRIES ARE (owner, 2026-11-05, round 5 notes 4 + 5: "the radar prints as a wireframe first, the texture
// after; anything printed does"). Until now a programme step's structure (the radar, KO-TECH, the garage, the Stålheart, the bays ...) rose as
// a Y-scale of its solid from 2 % to 100 % (src/fx/story-base.js rise()). Now, on the print's first tick, the shown tier is cloned as a
// wireframe ghost in the print beam's colour (src/fx/tower-print.js printGhost, one shared material), a child of the holder beside the solid
// tiers, and cut by a plane that climbs from the tier's floor to its top with the print, so the wire is drawn up from the plot as the beam
// rasters; the solid tiers stay hidden meanwhile and the holder stands at its full size. At the print's end the shown tier's skin rises over the
// wire in `skin` seconds while the wire fades (skinIn, driven by the base's tick so it ends off screen too), then the ghost goes.
// Islands, walls and the gates are instanced pieces shared by every island: they keep their Y rise.
//   createStructurePrint(holder, source, { colour, opacity, skin, now }) -> { ghost, set(k), k(), skin(tier), tick(), skinning(), skinnedTier(), dispose() }
//   source: the tier to copy the wire from (the far tier when there is one: a tenth of the lines)
//   printSpan(root): measures root.userData.printSpan ({ lo, hi } along its own Y, its own frame) once and returns it
//   createStructurePrints({ lift, print }) -> { at(id, rec, k), tick(records), holds(id), state(id, rec), dispose() }: the story base's hand
//     (src/fx/story-base.js grow); rec { holder, far, near, shown } is the base's record, lift(holder, k) its Y rise (now only 0 or 1 for a
//     structure with a tier to copy)
import * as THREE from '../../vendor/three.module.js';
import { printGhost, skinIn } from './tower-print.js';
import { cloneSkinned } from './skinned-clone.js';

const inv = new THREE.Matrix4(), m = new THREE.Matrix4(), b = new THREE.Box3();
export function printSpan(root) {
  if (root.userData.printSpan) return root.userData.printSpan;
  root.updateWorldMatrix(true, true); inv.copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  root.traverse((o) => { if (!o.isMesh || !o.geometry?.attributes.position) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); box.union(b.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld))); });
  root.userData.printSpan = box.isEmpty() ? { lo: 0, hi: 1 } : { lo: box.min.y, hi: box.max.y };
  return root.userData.printSpan;
}

// a clone without the userData: Object3D.copy deep-copies userData through JSON, and a mounted tier carries its AnimationMixer and actions there
// (story-base mount), which are circular: the clone threw in the game on the radar's first print tick (the --antenna-print step, 2026-11-05)
function bareClone(source) {
  const kept = []; source.traverse((o) => { kept.push([o, o.userData]); o.userData = {}; });
  try { return cloneSkinned(source); } finally { for (const [o, ud] of kept) o.userData = ud; }
}

export function createStructurePrint(holder, source, { colour = 0xbfe6ff, opacity = 0.85, skin = 0.8, now } = {}) {
  const ghost = bareClone(source); ghost.name = `${source.name} print`; ghost.visible = true;
  ghost.traverse((o) => { o.visible = true; if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ghost.userData.printSpan = printSpan(source);
  const print = printGhost(ghost, colour, { shared: true, opacity });
  holder.add(ghost);
  let skinCtl = null, skinned = null, done = false, at = 0;
  return {
    ghost,
    set(k) { if (!skinCtl) { at = k; print.set(k); } },
    k: () => at,
    // the shown tier comes back, cut by its own rising plane, the wire fading over it
    skin(tier) {
      if (skinCtl || done) return;
      printSpan(tier); skinned = tier; tier.visible = true;
      at = 1; print.set(1);
      skinCtl = skinIn(tier, ghost, { seconds: skin, driven: true, speak: false, ...(now ? { now } : {}) });
      skinCtl.tick();
    },
    // true once the skin is over and the ghost gone
    tick() { if (done) return true; if (!skinCtl || !skinCtl.tick()) return false; drop(); return true; },
    skinning: () => !!skinCtl && !done,
    skinnedTier: () => skinned,
    dispose: () => drop(),
  };
  function drop() { if (done) return; done = true; skinCtl?.end(); ghost.removeFromParent(); for (const mat of print.mats) mat.dispose(); }
}

// THE BASE'S PRINTS, by structure id. 0 < k < 1: the wire cut at k over the hidden tiers, the holder at its full size; k >= 1 after a wire: the
// shown tier skins in; k <= 0: hidden (a replayed print starts over). A structure set straight to 1 (a chapter skip, a grown base) just stands.
export function createStructurePrints({ lift, print = {} }) {
  const prints = new Map();
  const tiersOf = (r) => [r.far, r.near].filter(Boolean);
  const shownTier = (r) => (r.far ? (r.shown === 'near' && r.near ? r.near : r.far) : r.near);
  const showTiers = (r) => { const t = shownTier(r); for (const x of tiersOf(r)) x.visible = x === t; };
  const unprint = (id, r) => { const p = prints.get(id); if (!p) return; p.dispose(); prints.delete(id); if (r) showTiers(r); };
  function at(id, r, k) {
    let p = prints.get(id);
    if (k <= 0 || (k < 1 && p?.skinning())) { unprint(id, r); p = null; if (k <= 0) { lift(r.holder, 0); return; } }
    const src = r.far ?? r.near;
    if (k < 1 && src) {
      lift(r.holder, 1);
      if (!p) { p = createStructurePrint(r.holder, src, print); prints.set(id, p); }
      for (const x of tiersOf(r)) x.visible = false;
      p.set(k); return;
    }
    lift(r.holder, Math.min(1, k));
    if (p && k >= 1) { const t = shownTier(r); for (const x of tiersOf(r)) x.visible = x === t; p.skin(t); }
  }
  return {
    at,
    tick(records) { for (const [id, p] of prints) if (p.skinning() && p.tick()) { prints.delete(id); const r = records.get(id); if (r) showTiers(r); } },
    holds: (id) => prints.has(id),
    state(id, r) { const p = prints.get(id); return { ghost: !!p, skinning: !!p?.skinning(), solid: !!r && tiersOf(r).some((x) => x.visible), k: p ? +p.k().toFixed(3) : null }; },
    dispose() { for (const p of prints.values()) p.dispose(); prints.clear(); },
  };
}
