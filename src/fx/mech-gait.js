// THE HEAVY GAIT (owner, 2026-10-23, the drop's second test: "the Mechs style glide too much in their locomotion, the
// https://jelaludo.github.io/SentryTowers_A6/ridgeback-mech/ default animation does it better; no gliding, feeling of heaviness"; spec
// docs/superpowers/specs/2026-10-23-drop-round-2-design.md decision 2). The in-place Walk_Cycle clip played at a rate the pace asked for slid
// its claws; this is the demo's procedural gait ported instead (SentryTowers_A6 assets/ridgeback-mech/runtime.js: LEGS, STANCE_DUTY, UPPER,
// LOWER, DURATION, policy(0), walkSpeed, poseLeg, solveHydraulics and applyMech's body and legs, NOT its gun lines: the squad aims the guns)
// with the demo's heaviness rule (ridgeback-mech/behavior.js pose()): a stance foot is held at the world point where it landed and the leg
// aims at that anchor, so a planted claw never slides whatever the body does; a swing foot leaves its anchor over (1-q)^2. The phase runs
// in the demo's seconds (one cycle is DURATION at rate 1) at `rate` = ground speed / (walkSpeed(0) x the model's scale).
// Beyond the demo: STANDING STILL is its park pose (six feet planted at leg.fx/leg.fz, the body at bodyY), reached without a slide: when the
// body stops the gait steps in place (stride 0) until every leg has swung once and all six are down, then the phase holds; a parked body that
// turns steps in place the same way; the body's bob fades in and out over BOB_EASE. A claw keeps its world orientation through its stance
// (the demo's `ankle * root^-1`, on the planet: the frame's orientation when it landed) and turns back to the body's over its swing.
// Pure part (no Three): LEGS ... gaitPose, createGait, stepGait, anchorFeet; the rig part (Three): rigOf, poseLeg, solveHydraulics, applyGait.
import * as THREE from '../../vendor/three.module.js';

export const DURATION = 4, STANCE_DUTY = 0.72, UPPER = 1.15, LOWER = 1.65;
export const LEGS = [
  { id: 'FL', side: -1, z: 1.48, fx: -2.48, fz: 2.24, phase: 0 },
  { id: 'ML', side: -1, z: 0, fx: -2.95, fz: 0, phase: 0.5 },
  { id: 'RL', side: -1, z: -1.48, fx: -2.48, fz: -2.24, phase: 0 },
  { id: 'FR', side: 1, z: 1.48, fx: 2.48, fz: 2.24, phase: 0.5 },
  { id: 'MR', side: 1, z: 0, fx: 2.95, fz: 0, phase: 0 },
  { id: 'RR', side: 1, z: -1.48, fx: 2.48, fz: -2.24, phase: 0.5 },
];
const STEP_RATE = 3, BOB_EASE = 0.4;   // the rate of a step in place (settling, a parked turn), and the bob's fade in seconds
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const policy = (d) => ({ stride: d === 3 ? 0 : d === 2 ? 0.36 : 0.8, lift: d === 3 ? 0 : d === 2 ? 0.2 : 0.42, bodyY: d === 3 ? 1.16 : 1.9, enabled: d < 3, rate: d === 2 ? 0.45 : d === 3 ? 0 : 1 });
export const walkSpeed = (d) => policy(d).stride / (STANCE_DUTY * DURATION);   // 0.2778 m/s at d 0, scale 1
export const gaitRate = (groundSpeed, scale) => groundSpeed / (walkSpeed(0) * scale);
const hermite = (a, b, va, vb, u, duration) => (2 * u ** 3 - 3 * u * u + 1) * a + (u ** 3 - 2 * u * u + u) * va * duration + (-2 * u ** 3 + 3 * u * u) * b + (u ** 3 - u * u) * vb * duration;
export const legU = (phase, leg) => (((phase / DURATION + leg.phase) % 1) + 1) % 1;

// applyMech's body and foot targets at the gait's phase (d 0), in the rig's local metres (DROP_ROOT's frame): `walking` false is the park
// pose; `stride` scales the step's travel (0: in place); `bob` the body's walking weight (the demo's 1)
export function gaitPose(phase, { walking = true, stride = 1, bob = 1 } = {}) {
  const p = policy(0), cycle = phase / DURATION * Math.PI * 2, w = bob, S = p.stride * stride, ws = walkSpeed(0) * stride;
  const body = { pos: [0.035 * Math.sin(cycle) * w, p.bodyY + (-0.06 + 0.055 * Math.cos(cycle * 2 + 0.65)) * w, 0.035 * Math.sin(cycle * 2) * w], rot: [0.012 * Math.sin(cycle * 2 + 0.3) * w, 0, 0.018 * Math.sin(cycle) * w] };
  const targets = [], u = [], contact = [];
  for (const leg of LEGS) {
    let travel = 0, lift = 0, reach = 0;
    const uu = walking ? legU(phase, leg) : 0;
    if (walking) {
      if (uu < STANCE_DUTY) travel = S * (0.5 - uu / STANCE_DUTY);
      else {
        const q = (uu - STANCE_DUTY) / (1 - STANCE_DUTY), arc = Math.sin(Math.PI * q) ** 2;   // lift without dragging, reach forward, lower into a locked claw
        travel = hermite(-S / 2, S / 2, -ws, -ws, q, DURATION * (1 - STANCE_DUTY)); lift = p.lift * arc; reach = leg.side * 0.07 * arc;
      }
    }
    targets.push([leg.fx + reach, 0.18 + lift, leg.fz + travel]); u.push(uu); contact.push(!walking || uu < STANCE_DUTY);
  }
  return { body, targets, u, contact, contacts: contact.filter(Boolean).length };
}

// the gait's state for one mech: the phase, the mode (walk, step in place, parked), each leg's anchor (a world point) and its landing's
// claw orientation (set by applyGait)
export function createGait() {
  return { phase: 0, rate: 0, mode: 'parked', bob: 0, swung: null, legs: LEGS.map(() => ({ anchor: null, prev: true, off: null, world: null, qp: null })) };
}
// advance the phase: `moving` the body travels at `rate`; `turning` a parked body turning (it steps in place); neither: the gait settles (steps in
// place until every leg has swung once since the stop and all six are down) and then parks. Returns the pose to anchor
export function stepGait(g, dt, { moving = false, rate = 0, turning = false } = {}) {
  let stride = 1;
  if (moving) { g.mode = 'walk'; g.rate = rate; g.swung = null; }
  else if (turning) { g.mode = 'step'; g.rate = STEP_RATE; stride = 0; g.swung = null; }
  else if (g.mode !== 'parked') {
    if (g.mode !== 'settle') { g.mode = 'settle'; g.swung = LEGS.map(() => false); }
    g.rate = STEP_RATE; stride = 0;
  }
  if (g.mode === 'parked') g.rate = 0;
  g.phase += dt * g.rate;
  g.bob = clamp(g.bob + (moving ? 1 : -1) * dt / BOB_EASE, 0, 1);
  const pose = gaitPose(g.phase, { walking: g.mode !== 'parked', stride, bob: g.bob });
  if (g.mode === 'settle') {
    pose.contact.forEach((c, i) => { if (!c) g.swung[i] = true; });
    if (g.swung.every(Boolean) && pose.contacts === LEGS.length) { g.mode = 'parked'; g.rate = 0; g.swung = null; }
  }
  return pose;
}
// the demo's heaviness rule: a stance foot at the world point where it landed, a swing foot leaving its anchor over (1-q)^2. toWorld / toLocal
// map the rig's local metres to world points and back ([x, y, z] arrays); returns each leg's local target, leg.world its world point
export function anchorFeet(g, pose, toWorld, toLocal) {
  return LEGS.map((leg, i) => {
    const L = g.legs[i], c = pose.contact[i];
    let w = toWorld(pose.targets[i]);
    if (c) { if (!L.prev || !L.anchor) L.anchor = w.slice(); w = L.anchor.slice(); }
    else {
      if (L.prev && L.anchor) L.off = [L.anchor[0] - w[0], L.anchor[1] - w[1], L.anchor[2] - w[2]];
      const q = (pose.u[i] - STANCE_DUTY) / (1 - STANCE_DUTY), k = (1 - q) ** 2;
      if (L.off) w = [w[0] + L.off[0] * k, w[1] + L.off[1] * k, w[2] + L.off[2] * k];
    }
    L.prev = c; L.world = w;
    return toLocal(w);
  });
}

// THE RIG (Three): the nodes the gait poses, looked up once (getObjectByName walks the 149-node tree)
export function rigOf(root) {
  const n = (name) => root.getObjectByName(name), body = n('MECH_BODY');
  if (!body) return null;
  return { root, body, frame: body.parent, drop: n('DROP_ROOT'), legs: LEGS.map((leg) => ({ leg, yaw: n('HIP_YAW_' + leg.id), pitch: n('HIP_PITCH_' + leg.id), knee: n('KNEE_' + leg.id), ankle: n('ANKLE_' + leg.id),
    aim: n('HYDRAULIC_AIM_' + leg.id), rod: n('PISTON_SLIDE_' + leg.id), upper: n('SOCKET_HYDRAULIC_UPPER_' + leg.id), lower: n('SOCKET_HYDRAULIC_LOWER_' + leg.id) })) };
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);
// the demo's two-bone leg: the hip's yaw and pitch and the knee to reach `target` (the body's parent's frame, metres); the ankle cancels the
// chain so the claw sits square to that frame
export function poseLeg(rig, k, target) {
  const { body } = rig, L = rig.legs[k], leg = L.leg;
  const local = _v.set(target[0], target[1], target[2]).sub(body.position).applyQuaternion(_q.copy(body.quaternion).invert());
  const dx = local.x - leg.side * 0.98, dz = local.z - leg.z, dy = local.y;
  const radial = Math.hypot(dx, dz), distance = Math.hypot(radial, dy);
  const a = Math.atan2(dy, radial) + Math.acos(clamp((UPPER * UPPER + distance * distance - LOWER * LOWER) / (2 * UPPER * distance), -1, 1));
  const b = -Math.acos(clamp((distance * distance - UPPER * UPPER - LOWER * LOWER) / (2 * UPPER * LOWER), -1, 1));
  const yaw = Math.atan2(-dz, dx);
  L.yaw.rotation.set(0, yaw, 0); L.pitch.rotation.set(0, 0, a); L.knee.rotation.set(0, 0, b);
  L.ankle.quaternion.setFromAxisAngle(_z, -a - b).multiply(_q2.setFromAxisAngle(_y, -yaw)).multiply(_q.copy(body.quaternion).invert());
  return { distance, reachable: distance < UPPER + LOWER && distance > Math.abs(UPPER - LOWER) };
}
// the demo's pistons: each hydraulic aimed from its upper socket to its lower, the rod slid to the length
export function solveHydraulics(rig) {
  rig.root.updateMatrixWorld(true);
  for (const L of rig.legs) {
    const { aim, rod, upper, lower } = L; if (!aim || !rod || !upper || !lower) continue;
    const a = aim.parent.worldToLocal(upper.getWorldPosition(new THREE.Vector3()));
    const b = aim.parent.worldToLocal(lower.getWorldPosition(new THREE.Vector3()));
    const delta = b.sub(a), length = delta.length();
    aim.position.copy(a); aim.quaternion.setFromUnitVectors(_y, delta.normalize()); rod.position.y = length; aim.userData.length_m = length;
  }
  rig.root.updateMatrixWorld(true);
}

// one frame of the gait on a rig whose ancestors are placed (their world matrices current): the phase stepped, the body bobbed, each foot
// anchored and its leg posed, the claws held, the pistons solved. Returns { contacts }
const _a = new THREE.Vector3(), _fq = new THREE.Quaternion(), _t = new THREE.Quaternion(), _inv = new THREE.Quaternion();
export function applyGait(rig, g, dt, opts) {
  const pose = stepGait(g, dt, opts), { body, frame } = rig;
  if (rig.drop) { rig.drop.position.set(0, 0, 0); rig.drop.rotation.set(0, 0, 0); }
  body.position.fromArray(pose.body.pos); body.rotation.set(pose.body.rot[0], pose.body.rot[1], pose.body.rot[2]);
  frame.updateMatrixWorld(true); frame.getWorldQuaternion(_fq); _inv.copy(_fq).invert();
  const toWorld = (p) => frame.localToWorld(_a.fromArray(p)).toArray(), toLocal = (w) => frame.worldToLocal(_a.fromArray(w)).toArray();
  const local = anchorFeet(g, pose, toWorld, toLocal);
  LEGS.forEach((leg, k) => {
    poseLeg(rig, k, local[k]);
    const L = g.legs[k], c = pose.contact[k];
    if (c) { if (!L.qp || !L.planted) L.qp = _fq.clone(); _t.copy(L.qp); }   // the claw holds the frame's orientation at its landing
    else { const q = clamp((pose.u[k] - STANCE_DUTY) / (1 - STANCE_DUTY), 0, 1); _t.copy(L.qp ?? _fq).slerp(_fq, q * q * (3 - 2 * q)); }   // and turns back to the body's over its swing
    L.planted = c;
    rig.legs[k].ankle.quaternion.multiply(_q.copy(_inv).multiply(_t));
  });
  solveHydraulics(rig);
  return { contacts: pose.contacts, mode: g.mode };
}
