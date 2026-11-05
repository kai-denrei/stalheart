// THE BIO-PEARLS' FILL (owner, 2026-11-05, round 8 note 7: the Yushi045 Bio-Pearls are "where the biomass is stored"; src/domain/bio-pearls.js).
// The vessels are structures on the depot island (src/content/base-layout.js pearl-a..d; the story base mounts and swaps their tiers); this
// drives each tier's capacity shader through the author's adapter (assets/models/yushi045/runtime.js createYushiController, handed the game's
// Three): the eight shoulder segments and the sight chamber's olive level at the vessel's share of its capacity, `filling` while the rover's
// hose runs into it, `ready` when it holds anything, `empty` when not. THE _YUSHI ATTRIBUTE must survive the build (scripts/build.mjs copies
// these GLBs unpacked); a tier without it is counted in errors and left as it is.
// A PRINT SWAPS MATERIALS (Isao's wire then skin, src/fx/structure-print.js; round 7 found the restore undoing a per-mesh split): a controller is
// fitted only to a tier that stands printed, and fitted again whenever the body's material is no longer the one it set.
//   createBioPearlScene(base, ids) -> { tick(now, vessels, filling), socket(id, name) -> [x,y,z] | null, state() }
import * as THREE from '../../vendor/three.module.js';
import { createYushiController } from '../../assets/models/yushi045/runtime.js';

export function createBioPearlScene(base, ids) {
  const fitted = new Map(), errors = [];   // tier root -> { ctl, body, mat }
  function fit(root, fill, state) {
    let f = fitted.get(root);
    const body = root.getObjectByName('YUSHI_BODY');
    if (f && body && body.material === f.mat) return f.ctl;
    if (f) { f.ctl.dispose(); fitted.delete(root); }
    try {
      const ctl = createYushiController(THREE, root, { fill, state });
      fitted.set(root, { ctl, body, mat: body?.material });
      return ctl;
    } catch (e) { if (errors.length < 8) errors.push(String(e)); fitted.set(root, { ctl: { setFill() {}, setState() {}, update() {}, dispose() {} }, body, mat: body?.material }); return null; }
  }
  return {
    tick(now, vessels, filling = -1) {
      vessels.forEach((v, i) => {
        const id = ids[i], st = id && base?.structure?.(id); if (!st) return;
        const ps = base.printState?.(id); if (ps?.ghost) return;   // mid-print: the wire and the skin own the materials
        const fill = v.capacity > 0 ? v.stored / v.capacity : 0, state = i === filling ? 'filling' : v.stored > 0 ? 'ready' : 'empty';
        for (const root of [st.near, st.far]) {
          if (!root) continue;
          const ctl = fit(root, fill, state); if (!ctl) continue;
          ctl.setFill(fill); if (ctl.state !== state) ctl.setState(state); ctl.update(now);
        }
      });
    },
    socket(id, name) {
      const st = base?.structure?.(id), root = st?.near ?? st?.far, n = root?.getObjectByName(name);
      if (!n) return null;
      st.holder.updateMatrixWorld(true);
      return n.getWorldPosition(new THREE.Vector3()).toArray();
    },
    state: () => ({ fitted: [...fitted.values()].filter((f) => f.mat).length, errors: errors.slice() }),
  };
}
