// THE NIH-DAIRIA MECH'S POSE (owner, 2026-11-05, round 6 note 1b: after THE ARENA's kill Isao prints himself a pet, "a Nih-Dairia mech about the
// tank's size"). The asset has NO baked clips: its motion is the workshop's runtime pose script (assets/models/nih-dairia-mech/runtime.js,
// applyPose(root, time, mode, reachScale)), a planar kinematic study in metres. This is that script's arithmetic as a pure function: the rig's
// numbers come in (src/content/companions.js, the mech's `rig`), the joint values go out; src/fx/mech-pose.js writes them onto the GLB's bones.
// test/mech-pose.mjs holds it to runtime.js frame for frame.
//   mechPose(rig, t, mode, reachScale) -> { body: [x, y, z] (BODY_HEAVE's position), legs: [{ id, yaw, hip, knee, slide, ankle: [x, y, z, w], claw
//       (the pads' tilt, radians), lift, stance, stroke, target: [x, y, z] (the foot centre in the root's metres) }], contacts, extension, advance }
//       mode: 'idle' (Observation_Idle) | 'walk' (Tripod_Walk_Cycle, in place: the caller moves the body at rig.walk.mps x the rate) | 'extend'
//       (Reach_Cycle) | 'anchor' (Anchor_Deploy, a one-shot that holds; BODY_HEAVE carries the advance, never the caller)
//   mechRate(rig, speed) -> the walk's playback rate for a ground speed (m/s): speed over the authored 0.30 m/s, capped at rig.rateCap
//   mechTop(rig) -> the fastest ground speed the capped walk carries without its feet sliding (m/s)
//   motionOf(rig, name) -> the mode a motion name plays ('Anchor_Deploy' -> 'anchor'), or null
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };

export const mechRate = (rig, speed) => clamp(speed / rig.walk.mps, 0, rig.rateCap);
export const mechTop = (rig) => rig.walk.mps * rig.rateCap;
export const motionOf = (rig, name) => Object.keys(rig.motions).find((k) => rig.motions[k].name === name) ?? null;

export function mechPose(rig, time = 0, mode = 'idle', reachScale = 1) {
  const spec = rig.motions[mode] ?? rig.motions.idle, d = spec.secs, R = rig.reach, W = rig.walk, T = R.times;
  const t = spec.loop ? ((time % d) + d) % d : clamp(time, 0, d), scale = clamp(reachScale, 0.35, 1);
  let height = rig.height, advance = 0, reach = 0, pairLift = 0;
  if (mode === 'idle') height += rig.heave * Math.sin(t * Math.PI / 3);
  if (mode === 'walk') height += rig.heave * Math.cos(t * Math.PI * 4 / 3);
  const pairMode = mode === 'extend' || mode === 'anchor';
  if (pairMode) {
    const retract = mode === 'extend' ? smooth((t - T.retract[0]) / T.retract[1]) : 0;
    reach = smooth((t - T.reach[0]) / T.reach[1]) * (1 - retract) * scale;
    const lower = mode === 'extend' ? smooth((t - T.lowerExtend[0]) / T.lowerExtend[1]) : smooth((t - T.lowerAnchor[0]) / T.lowerAnchor[1]);
    pairLift = R.lift * smooth(t / T.lift) * (1 - lower);
    if (mode === 'anchor') { const pull = smooth((t - T.pull[0]) / T.pull[1]); advance = R.advance * scale * pull; height -= R.drop * pull; }
  }
  const legs = []; let contacts = 0, extension = 0;
  for (let i = 0; i < 6; i++) {
    const id = String(i + 1).padStart(2, '0'), angle = i * Math.PI / 3, tripod = i % 2, active = R.pair.includes(id), sa = Math.sin(angle), ca = Math.cos(angle);
    let fx = sa * rig.footRadius, fz = ca * rig.footRadius, lift = 0, stance = true, stroke = 0;
    if (pairMode && active) { fz += R.distance * reach; lift = pairLift; stance = pairLift < 1e-8; stroke = rig.stroke * reach; }
    if (mode === 'walk') {
      const p = (t / W.secs + tripod * 0.5) % 1, duty = W.duty, stride = W.mps * W.secs * duty;
      if (p < duty) fz += stride * (0.5 - p / duty);
      else { stance = false; const u = (p - duty) / (1 - duty); fz += stride * (-0.5 + smooth(u)); lift = W.lift * Math.sin(Math.PI * u) ** 2; }
    }
    // the targets are world-fixed through support and through the anchor's body pull
    const mx = sa * rig.hipRing, mz = ca * rig.hipRing + advance;
    const dx = fx - rig.footOffset * sa - mx, dz = fz - rig.footOffset * ca - mz, r = Math.hypot(dx, dz), dy = rig.contactY + lift - height, dd = Math.hypot(r, dy);
    // a supporting leg takes the body's travel in its telescope, not by sliding its foot
    const lowerLen = Math.min(rig.lower[1], Math.max(rig.lower[0] + stroke, dd - rig.upper + rig.slack)); stroke = lowerLen - rig.lower[0];
    const q = Math.atan2(dy, r) + Math.acos(clamp((rig.upper * rig.upper + dd * dd - lowerLen * lowerLen) / (2 * rig.upper * dd), -1, 1));
    const beta = Math.atan2(dy - rig.upper * Math.sin(q), r - rig.upper * Math.cos(q));
    const yaw = Math.atan2(-dz, dx);
    // the ankle cancels pitch and yaw so all three pads keep their world orientation while the body moves between the feet
    const sz = Math.sin(-beta / 2), cz = Math.cos(-beta / 2), sy = Math.sin((angle - Math.PI / 2 - yaw) / 2), cy = Math.cos((angle - Math.PI / 2 - yaw) / 2);
    if (stance) contacts++;
    extension = Math.max(extension, stroke / rig.stroke);
    legs.push({ id, yaw, hip: q, knee: beta - q, slide: lowerLen - rig.slideBase, ankle: [-sz * sy, cz * sy, sz * cy, cz * cy], claw: rig.clawTilt * clamp(lift / W.lift), lift, stance, stroke, target: [fx, lift, fz] });
  }
  return { body: [0, height, advance], legs, contacts, extension, advance, reach: R.distance * reach };
}
