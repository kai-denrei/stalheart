// mech-pose.mjs — THE NIH-DAIRIA MECH'S POSE (owner, 2026-11-05, round 6 note 1b): the asset has no baked clips, its motion is the workshop's
// runtime.js (kept unchanged beside the model). The port (src/domain/mech-pose.js) against runtime.js on the same bones, every motion over its
// whole span and past it, three reach scales: the same numbers; the rig in content is runtime.js's own; the walk's alternating tripods half a
// cycle apart, at least three feet down at every instant, the stance feet fixed in the world at any rate with the body at 0.30 m/s x the rate (no
// skate), the feet at the 3.28 m radius at rest; the anchor's 0.55 m body advance with its four supporting feet still; the rate cap where the
// step still reads (the swing at least 20 frames at 60 fps, the pad's step at most 0.075 m a frame) and the unit's top at the capped walk; the fx
// poser (src/fx/mech-pose.js) walking, stopping, anchoring and easing between them, and refusing the static far tier.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import * as RT from '../assets/models/nih-dairia-mech/runtime.js';
import { mechPose, mechRate, mechTop, motionOf } from '../src/domain/mech-pose.js';
import { createMechPoser } from '../src/fx/mech-pose.js';
import { COMPANIONS } from '../src/content/companions.js';

const unit = COMPANIONS.units.find((u) => u.pose === 'mech'), rig = unit.rig;
const SUFFIX = ['_YAW', '_HIP', '_KNEE', '_SLIDE', '_ANKLE', '_CLAW_1', '_CLAW_2', '_CLAW_3'];
function rigRoot(extra = []) {   // the GLB's control bones as plain Object3Ds under a root (names only: what runtime.js and the poser look up)
  const root = new THREE.Group(), body = new THREE.Object3D(); body.name = 'BODY_HEAVE'; root.add(body);
  for (let i = 1; i <= 6; i++) for (const s of SUFFIX) { const o = new THREE.Object3D(); o.name = `LEG_0${i}${s}`; body.add(o); }
  for (const name of extra) { const o = new THREE.Object3D(); o.name = name; root.add(o); }
  return root;
}
const byName = (root) => { const n = {}; root.traverse((o) => { n[o.name] = o; }); return n; };

// 1. the rig is runtime.js's
assert.equal(rig.upper, RT.UPPER); assert.deepEqual(rig.lower, [RT.BASE_LOWER, RT.MAX_LOWER]); assert.equal(rig.footOffset, RT.FOOT_OFFSET); assert.equal(rig.footRadius, RT.FOOT_RADIUS);
assert.deepEqual(rig.reach.pair, RT.REACH_PAIR); assert.equal(rig.reach.distance, RT.REACH_DISTANCE); assert.equal(rig.reach.advance, RT.BODY_ADVANCE);
for (const [k, m] of Object.entries(RT.motions)) { assert.equal(rig.motions[k].name, m.name, `${k}'s name`); assert.equal(rig.motions[k].secs, m.duration_s, `${k}'s length`); assert.equal(rig.motions[k].loop, m.loop, `${k} loops as runtime.js`); }
assert.equal(rig.walk.mps, RT.motions.walk.speed_m_s, 'the walk\'s translation contract');
assert.equal(motionOf(rig, unit.sit), 'anchor'); assert.equal(motionOf(rig, unit.tricks[0]), 'extend'); assert.equal(motionOf(rig, unit.idle), 'idle');

// 2. the port against runtime.js, bone for bone
let worst = 0, samples = 0;
for (const mode of ['idle', 'walk', 'extend', 'anchor']) for (let t = -1; t < 13; t += 0.043) for (const rs of [1, 0.6, 0.2]) {
  const root = rigRoot(), n = byName(root), ref = RT.applyPose(root, t, mode, rs), me = mechPose(rig, t, mode, rs), d = (a, b) => { worst = Math.max(worst, Math.abs(a - b)); };
  d(n.BODY_HEAVE.position.y, me.body[1]); d(n.BODY_HEAVE.position.z, me.body[2]);
  me.legs.forEach((L) => { const p = `LEG_${L.id}`; d(n[p + '_YAW'].rotation.y, L.yaw); d(n[p + '_HIP'].rotation.z, L.hip); d(n[p + '_KNEE'].rotation.z, L.knee); d(n[p + '_SLIDE'].position.x, L.slide);
    const q = n[p + '_ANKLE'].quaternion; d(q.x, L.ankle[0]); d(q.y, L.ankle[1]); d(q.z, L.ankle[2]); d(q.w, L.ankle[3]); for (let j = 1; j <= 3; j++) d(n[`${p}_CLAW_${j}`].rotation.z, L.claw); });
  d(ref.contacts, me.contacts); d(ref.extension, me.extension); d(ref.body_advance_m, me.advance); ref.feet.forEach((f, k) => f.target.forEach((v, j) => d(v, me.legs[k].target[j]))); samples++;
}
assert(worst < 1e-12, `the port is runtime.js (worst ${worst} over ${samples} poses)`);

// 3. the walk: tripods, contacts, no skate at any rate up to the cap; the feet on their radius at rest
const rest = mechPose(rig, 0, 'idle'); rest.legs.forEach((L) => assert(Math.abs(Math.hypot(L.target[0], L.target[2]) - rig.footRadius) < 1e-9, `leg ${L.id} at the foot radius at rest`));
let minContacts = 6;
for (let t = 0; t < 3; t += 0.01) { const P = mechPose(rig, t, 'walk'); minContacts = Math.min(minContacts, P.contacts); const sw = P.legs.filter((L) => !L.stance).map((L) => +L.id % 2); assert(sw.every((x) => x === sw[0]), `one tripod swings at a time (t ${t.toFixed(2)})`); }
assert(minContacts >= 3, `at least three feet down (${minContacts})`);
function walkAt(r) {   // wall-time sample at 600 Hz over two cycles: stance drift, the swing's peak speed and duration
  const dt = 1 / 600; let prev = null, drift = 0, peak = 0;
  for (let tw = 0; tw <= 2 * rig.walk.secs / r; tw += dt) {
    const P = mechPose(rig, tw * r, 'walk'), bz = rig.walk.mps * r * tw, feet = P.legs.map((L) => [L.target[0], L.target[1], L.target[2] + bz]);
    if (prev) P.legs.forEach((L, i) => { const v = Math.hypot(...feet[i].map((x, j) => x - prev.feet[i][j])) / dt; if (L.stance && prev.P.legs[i].stance) drift = Math.max(drift, v); else peak = Math.max(peak, v); });
    prev = { P, feet };
  }
  return { drift, peak, swing: (1 - rig.walk.duty) * rig.walk.secs / r };
}
for (const r of [0.5, 1, 2, rig.rateCap]) { const w = walkAt(r); assert(w.drift < 1e-9, `rate ${r}: the stance feet stay put (${w.drift.toExponential(1)} m/s)`); }
const cap = walkAt(rig.rateCap), past = walkAt(rig.rateCap + 0.5);
assert(cap.swing * 60 >= 20 && cap.peak / 60 <= 0.075, `at the cap the step reads: swing ${(cap.swing * 60).toFixed(1)} frames, the pad ${(cap.peak / 60).toFixed(3)} m a frame at 60 fps`);
assert(past.swing * 60 < 20, `half a step past it does not (${(past.swing * 60).toFixed(1)} frames)`);
assert.equal(mechRate(rig, 0.3), 1); assert.equal(mechRate(rig, 99), rig.rateCap, 'the rate capped'); assert.equal(mechRate(rig, -1), 0);
assert(Math.abs(mechTop(rig) - unit.top) < 1e-9, `the unit's top is the capped walk (${unit.top} m/s)`);
for (const g of unit.gaits) assert(g.max <= mechTop(rig) + 1e-9 && g.mps === rig.walk.mps, 'its one gait is the walk, within the cap');
assert(unit.trot <= unit.top && unit.wander[1] <= unit.top, 'its trot and wander inside its top: the rate never caps under the play (no skate)');

// 4. the anchor: the body 0.55 m forward by 6.8 s and held; the four supporting feet never move; the pair reaches
const a0 = mechPose(rig, 0, 'anchor'), a1 = mechPose(rig, 6.8, 'anchor'), a2 = mechPose(rig, 30, 'anchor');
assert(Math.abs(a1.advance - rig.reach.advance) < 1e-9 && Math.abs(a2.advance - rig.reach.advance) < 1e-9, 'the body pulled 0.55 m and held');
for (let t = 0; t <= 8; t += 0.05) { const P = mechPose(rig, t, 'anchor'); P.legs.filter((L) => !rig.reach.pair.includes(L.id)).forEach((L, k) => assert(L.target.every((v, j) => Math.abs(v - a0.legs.filter((x) => !rig.reach.pair.includes(x.id))[k].target[j]) < 1e-12), 'a supporting foot holds')); }
assert(Math.abs(mechPose(rig, 3, 'extend').reach - rig.reach.distance) < 1e-6, 'the reach goes its full 1.15 m');

// 5. the fx poser on a rig of bones
{
  const root = rigRoot(), n = byName(root), ps = createMechPoser(root, rig);
  assert(ps, 'a poser for the game tier'); assert.equal(createMechPoser(rigRoot(['DISTANCE_GEOMETRY']), rig), null, 'none for the static far tier');
  ps.reset(); assert.equal(ps.state().mode, 'idle');
  for (let k = 0; k < 60; k++) ps.step(1 / 60, { speed: 0.6 });
  assert.equal(ps.state().mode, 'walk'); assert.equal(ps.state().rate, 2, 'the rate is the speed over 0.30 m/s'); assert(ps.state().phase > 1.9 && ps.state().phase < 2.1, `its own phase clock (${ps.state().phase})`);
  for (let k = 0; k < 60; k++) ps.step(1 / 60, { speed: 5 }); assert.equal(ps.state().rate, rig.rateCap, 'capped');
  const before = n.LEG_01_HIP.quaternion.clone(); ps.step(1 / 60, { speed: 0 }); assert.equal(ps.state().mode, 'walk', 'held on the walk a moment after it stops');
  assert(n.LEG_01_HIP.quaternion.angleTo(before) < 1e-6, 'the stopped walk keeps its feet');
  for (let k = 0; k < Math.ceil(rig.stopS * 60) + 1; k++) ps.step(1 / 60, { speed: 0 });
  assert.equal(ps.state().mode, 'idle'); assert(ps.state().blending, 'easing into the idle');
  const target = mechPose(rig, 1 / 60, 'idle'); assert(Math.abs(n.LEG_01_HIP.rotation.z - target.legs[0].hip) > 1e-4, 'not snapped to the idle on its first frame');
  for (let k = 0; k < Math.ceil(rig.blend * 60) + 2; k++) ps.step(1 / 60, { speed: 0 }); assert(!ps.state().blending, 'the blend ends');
  ps.step(1 / 60, { oneShot: unit.sit }); assert.equal(ps.state().mode, 'anchor', 'the sit is the anchor');
  for (let k = 0; k < 600; k++) ps.step(1 / 60, { oneShot: unit.sit });
  assert(Math.abs(n.BODY_HEAVE.position.z - rig.reach.advance) < 1e-6, `BODY_HEAVE carries the anchor's advance (${n.BODY_HEAVE.position.z.toFixed(3)})`);
}
console.log(`Mech pose: the port is runtime.js over ${samples} poses (worst ${worst}); walk drift 0 to the cap ${rig.rateCap} (${unit.top} m/s: swing ${(cap.swing * 60).toFixed(0)} frames, pad ${(cap.peak / 60).toFixed(3)} m a frame); anchor 0.55 m; the poser walks, stops, eases, anchors`);
