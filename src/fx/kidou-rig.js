// THE WHEELED STÅLHEART'S POSE (the owner's note of 2026-11-07, call C; driven since 2026-11-12 night, the colony on the grid; the model's facts in
// docs/a6-kidou-sai93-assets.lock.json). The KIDOU moving gantry has no baked clips: the author's adapter (assets/models/stalheart-kidou/runtime.js
// applyKidou, pinned content, kept verbatim) poses its eight wheels, their trailing arms and dampers, the arm and the two feed hoses by name,
// handed the game's Three and the mounted tier's root (it finds STALHEART_KIDOU_ROOT under it, and never moves that root: the story base's holder
// owns where it stands, src/fx/story-base.js move). No terrain callback: the ground is flat in the root's frame, each wheel's contact at y 0.
// The static far tier (LOD2, root extras static: true) is left as it is: the adapter returns { static: true } for it.
// set(pose) is the drive's hand (src/fx/gantry-drive.js): `mode` 'park' | 'drive' | 'turn' | 'fabricate', `distance` the signed metres driven
// (the wheels' roll), `turnAngle` the radians turned in place, `speed` / `omega` the rates (the wheels' steer), `tip` (metres over the ground,
// optional) where the tool's EXTRUSION_TIP is held while printing: the lift slides to put it there, above the layer.
// PARKED WITH THE TOOL UP (2026-11-12 night): the author's park drops the lift to 3.2 m, into a hull parked under the gantry for its repair and
// through DAY 42's ball hung 6.2 m under the tip; parked here is the author's travel pose standing still (the lift at its travel height, the
// tip 11.26 m up, the wheels straight). Park ignores time, so a parked pose is applied once and held; the others pose every tick.
//   createKidouRig(THREE, root, { mode }) -> { tick(t), set(pose), dispose(), state() }
import { applyKidou } from '../../assets/models/stalheart-kidou/runtime.js';

export function createKidouRig(T, root, { mode = 'park' } = {}) {
  let posed = false, still = false, dirty = true, contactError = null, tipAt = null;
  let pose = { mode, distance: 0, turnAngle: 0, speed: 0, omega: 0, tip: null };
  const v = new T.Vector3();
  const hoses = () => ['FEED_HOSE_1', 'FEED_HOSE_2'].map((n) => root.getObjectByName(n)).filter((o) => o?.geometry);
  const adapter = (p, t) => (p.mode === 'park' ? { time: 0, mode: 'drive', vz: 0, distance: p.distance }
    : p.mode === 'turn' ? { time: t, mode: 'turn', omega: p.omega, turnAngle: p.turnAngle }
    : p.mode === 'drive' ? { time: t, mode: 'drive', vz: p.speed, distance: p.distance }
    : { time: t, mode: 'fabricate', distance: p.distance });
  // the lift slid so the tip stands at `tip` metres over the root's ground (the lift is the tool's own slide: TOOL_LIFT_Z)
  function holdTip(tip) {
    const n = root.getObjectByName('EXTRUSION_TIP'), lift = root.getObjectByName('TOOL_LIFT_Z'); if (!n || !lift) return;
    root.updateMatrixWorld(true); const y = root.worldToLocal(n.getWorldPosition(v)).y;
    lift.position.y += tip - y; root.updateMatrixWorld(true); tipAt = tip;
  }
  const rig = {
    tick(t = 0) {
      if (still || (posed && !dirty && pose.mode === 'park')) return;
      const c = applyKidou(T, root, adapter(pose, t));
      if (c?.static) { still = true; return; }
      if (pose.tip != null) holdTip(pose.tip); else tipAt = null;
      posed = true; dirty = false; contactError = c?.maxContactError ?? null;
    },
    set(p) { pose = { ...pose, ...p }; dirty = true; },
    // the hoses' tubes are the adapter's own (it replaces the GLB's TubeGeometry on its first pose), so the rig frees them; the rest is the
    // story base's (its own() of the mounted tier)
    dispose() { if (posed) for (const h of hoses()) h.geometry.dispose(); posed = false; },
    state: () => ({ mode: pose.mode, posed, static: still, contactError, tip: tipAt }),
  };
  rig.tick(0);   // posed at mount: before the tier is warmed, printed or shown
  return rig;
}
