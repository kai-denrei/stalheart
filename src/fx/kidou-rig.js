// THE WHEELED STÅLHEART, PARKED (the owner's note of 2026-11-07, call C of docs/superpowers/specs/2026-11-07-base-from-scratch-design.md; the
// model's facts in docs/a6-kidou-sai93-assets.lock.json). The KIDOU moving gantry has no baked clips: the author's adapter
// (assets/models/stalheart-kidou/runtime.js applyKidou, pinned content, kept verbatim) poses its eight wheels, their trailing arms and dampers,
// the arm and the two feed hoses by name, handed the game's Three and the mounted tier's root (it finds STALHEART_KIDOU_ROOT under it, and never
// moves that root: the story base's holder owns where it stands). This round it only stands parked on the Stålheart's slab, wheels at rest on
// the ground (no terrain callback: the slab is flat in the root's frame, so each wheel's contact stays at the root's y 0). The static far tier
// (LOD2, root extras static: true) is left as it is: the adapter returns { static: true } for it.
// Park ignores time (the carriage, the lift and the joints are fixed, the wheels straight), so the pose is applied on the first tick and held;
// a mode that moves (drive, turn, fabricate: the next round's mobile printing) would pose every tick.
//   createKidouRig(THREE, root, { mode }) -> { tick(t), dispose(), state() }
import { applyKidou } from '../../assets/models/stalheart-kidou/runtime.js';

export function createKidouRig(T, root, { mode = 'park' } = {}) {
  let posed = false, still = false, contactError = null;
  const hoses = () => ['FEED_HOSE_1', 'FEED_HOSE_2'].map((n) => root.getObjectByName(n)).filter((o) => o?.geometry);
  const rig = {
    tick(t = 0) {
      if (still || (posed && mode === 'park')) return;
      const c = applyKidou(T, root, { time: t, mode });
      if (c?.static) { still = true; return; }
      posed = true; contactError = c?.maxContactError ?? null;
    },
    // the hoses' tubes are the adapter's own (it replaces the GLB's TubeGeometry on its first pose), so the rig frees them; the rest is the
    // story base's (its own() of the mounted tier)
    dispose() { if (posed) for (const h of hoses()) h.geometry.dispose(); posed = false; },
    state: () => ({ mode, posed, static: still, contactError }),
  };
  rig.tick(0);   // posed at mount: before the tier is warmed, printed or shown
  return rig;
}
