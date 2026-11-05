// THE MECH'S POSER (owner, 2026-11-05, round 6 note 1b: the Nih-Dairia mech, Isao's own pet, has NO baked clips). The companions host
// (src/fx/companions.js) hands a `pose: 'mech'` unit's game tier to this instead of an AnimationMixer: each frame it asks the pure solver
// (src/domain/mech-pose.js, the workshop's runtime.js ported) for the joint values of the motion the body is in and writes them onto the GLB's
// control bones (BODY_HEAVE; LEG_01..06 _YAW _HIP _KNEE _SLIDE _ANKLE _CLAW_1..3), the way runtime.js's applyPose does.
//   the motion: a one-shot the play names (its sit: Anchor_Deploy -> 'anchor'; a trick: Reach_Cycle -> 'extend'), else 'walk' while the body
//   moves (its own phase clock advanced at mechRate: the ground speed over the authored 0.30 m/s, capped at rig.rateCap, so a stance foot never
//   slides), held on 'walk' at rate 0 for rig.stopS after the body stops (the feet stay where they are), then 'idle' (Observation_Idle)
//   a change of motion eases from the last pose over rig.blend seconds (runtime.js has no transitions: idle <-> walk moved six feet in a frame)
//   createMechPoser(root, rig) -> { step(dt, { speed, oneShot }), reset(), state() } or null when the root has no BODY_HEAVE (the static far tier)
import * as THREE from '../../vendor/three.module.js';
import { mechPose, mechRate, motionOf } from '../domain/mech-pose.js';

const SUFFIX = ['_YAW', '_HIP', '_KNEE', '_SLIDE', '_ANKLE', '_CLAW_1', '_CLAW_2', '_CLAW_3'];
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function createMechPoser(root, rig) {
  const n = {}; root?.traverse((o) => { n[o.name] ??= o; });
  const body = n.BODY_HEAVE; if (!body || n.DISTANCE_GEOMETRY) return null;
  const legs = Array.from({ length: 6 }, (_, i) => { const p = `LEG_0${i + 1}`; return SUFFIX.map((s) => n[p + s]); });
  if (legs.some((l) => l.some((o) => !o))) return null;
  const nodes = [body, ...legs.flat()], from = nodes.map(() => ({ p: new THREE.Vector3(), q: new THREE.Quaternion() }));
  let mode = 'idle', t = 0, phase = 0, rate = 0, still = 0, blendT = Infinity, last = null;
  function apply(P) {
    body.position.set(P.body[0], P.body[1], P.body[2]);
    P.legs.forEach((L, i) => {
      const [yaw, hip, knee, slide, ankle, ...claws] = legs[i];
      yaw.rotation.set(0, L.yaw, 0); hip.rotation.set(0, 0, L.hip); knee.rotation.set(0, 0, L.knee); slide.position.x = L.slide;
      ankle.quaternion.set(L.ankle[0], L.ankle[1], L.ankle[2], L.ankle[3]);
      claws.forEach((c, j) => c.rotation.set(0, j * Math.PI * 2 / 3, L.claw));
    });
  }
  function switchTo(m) {
    if (m === mode) return;
    nodes.forEach((o, k) => { from[k].p.copy(o.position); from[k].q.copy(o.quaternion); });
    mode = m; t = 0; blendT = 0; if (m === 'walk') phase = 0;
  }
  function step(dt, { speed = 0, oneShot = null } = {}) {
    const shot = oneShot ? motionOf(rig, oneShot) : null;
    still = speed > 1e-3 ? 0 : still + dt;
    switchTo(shot && shot !== 'idle' && shot !== 'walk' ? shot : speed > 1e-3 || (mode === 'walk' && still < rig.stopS) ? 'walk' : 'idle');
    rate = mode === 'walk' ? mechRate(rig, speed) : 1;
    if (mode === 'walk') phase += dt * rate; else t += dt;
    last = mechPose(rig, mode === 'walk' ? phase : t, mode, 1);
    apply(last);
    if (blendT < rig.blend) {
      blendT += dt; const k = smooth(blendT / rig.blend);
      nodes.forEach((o, j) => { o.position.lerpVectors(from[j].p, o.position, k); o.quaternion.slerpQuaternions(from[j].q, o.quaternion.clone(), k); });
    }
  }
  return {
    step,
    reset() { mode = 'idle'; t = 0; phase = 0; still = 0; blendT = Infinity; last = mechPose(rig, 0, 'idle', 1); apply(last); },
    state: () => ({ mode, rate: +rate.toFixed(2), phase: +phase.toFixed(2), t: +t.toFixed(2), contacts: last?.contacts ?? 6, blending: blendT < rig.blend }),
  };
}
