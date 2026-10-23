// mech-gait.mjs — the heavy gait (owner, 2026-10-23: "no gliding, feeling of heaviness"; spec docs/superpowers/specs/2026-10-23-drop-round-2-design.md
// decision 2), the pure part of src/fx/mech-gait.js on a flat ground: the demo's tripod schedule (three feet down at every instant of the cycle), the
// anchor rule (over 10 s of walking at rate 3.8 every stance foot's world point is constant to 1e-9 while the body advances ~8 m, and each swing foot
// lands at the body's new target, no snap between its last swing frame and its anchor), the stop (the gait steps in place until it parks with the six
// feet at the park pose, none sliding), and a parked turn (it steps in place, none sliding).
import assert from 'node:assert/strict';
import { LEGS, STANCE_DUTY, DURATION, walkSpeed, gaitRate, gaitPose, createGait, stepGait, anchorFeet } from '../src/fx/mech-gait.js';

const SCALE = 0.75, DT = 1 / 60, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
assert.ok(Math.abs(walkSpeed(0) - 0.27778) < 1e-4, 'the demo walks 0.2778 m/s at rate 1');
assert.ok(Math.abs(gaitRate(0.8, SCALE) - 0.8 / (0.27778 * 0.75)) < 1e-3, 'rate = ground speed / (walkSpeed x scale)');

// the tripod: FL, RL, MR at phase 0 and ML, FR, RR at 0.5 with a 0.72 duty, so one tripod is always down
for (let k = 0; k < 4000; k++) {
  const p = gaitPose(k / 4000 * DURATION);
  assert.ok(p.contacts >= 3, `three feet down at phase ${k / 4000}`);
  for (const tri of [[0, 2, 4], [1, 3, 5]]) if (tri.some((i) => p.contact[i])) assert.ok(tri.every((i) => p.contact[i] === p.contact[tri[0]]), 'a tripod moves together');
}

// a body on a flat ground: its origin at (bx, 0, bz), turned by yaw about +Y, the rig in metres times SCALE
function bodyFrame() {
  const b = { x: 0, z: 0, yaw: 0 };
  b.toWorld = (p) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw), x = p[0] * SCALE, z = p[2] * SCALE; return [b.x + c * x + s * z, p[1] * SCALE, b.z - s * x + c * z]; };
  b.toLocal = (w) => { const c = Math.cos(b.yaw), s = Math.sin(b.yaw), x = w[0] - b.x, z = w[2] - b.z; return [(c * x - s * z) / SCALE, w[1] / SCALE, (s * x + c * z) / SCALE]; };
  return b;
}
// one frame; returns the feet's world points and contacts, checking every foot down in both frames stayed put
function frame(g, b, opts, prev) {
  const pose = stepGait(g, DT, opts), local = anchorFeet(g, pose, b.toWorld, b.toLocal), world = local.map(b.toWorld);
  world.forEach((w, i) => assert.ok(dist(w, g.legs[i].world) < 1e-9, 'the local target maps back to the foot'));
  if (prev) pose.contact.forEach((c, i) => { if (c && prev.contact[i]) assert.ok(dist(world[i], prev.world[i]) < 1e-9, `${LEGS[i].id} planted: ${dist(world[i], prev.world[i])} m`); });
  return { world, contact: pose.contact, contacts: pose.contacts, pose };
}

// 10 s of walking at rate 3.8 in a straight line
{
  const g = createGait(), b = bodyFrame(), rate = 3.8, speed = walkSpeed(0) * SCALE * rate;
  let prev = null, landings = 0, worst = 0;
  for (let k = 0; k < 600; k++) {
    b.z += speed * DT;
    const f = frame(g, b, { moving: true, rate }, prev);
    assert.ok(f.contacts >= 3, 'three feet down while walking');
    if (prev) f.contact.forEach((c, i) => {
      if (c && !prev.contact[i]) {   // a landing: the anchor is the body's target now, and the foot's last swing point is beside it
        landings++;
        const leg = LEGS[i], aim = b.toWorld([leg.fx, 0.18, leg.fz + 0.4]);   // the front of the stride (stride 0.8 / 2), the body's new target
        assert.ok(dist(f.world[i], aim) < speed * DT * 2 + 1e-9, `${leg.id} lands at the body's new target (${dist(f.world[i], aim)} m off)`);
        worst = Math.max(worst, dist(f.world[i], prev.world[i]));
      }
    });
    prev = f;
  }
  assert.ok(b.z > 7.8 && b.z < 8.1, `the body advanced ${b.z.toFixed(2)} m`);
  assert.ok(landings >= 6 * 9, `every leg landed each cycle (${landings})`);
  assert.ok(worst < 0.02, `no snap at a landing (the largest last-swing-to-anchor step ${worst.toFixed(4)} m)`);
  // the stop: it steps in place, then parks with the six feet at the park pose, none sliding
  let t = 0;
  while (g.mode !== 'parked' && t < 4) { prev = frame(g, b, {}, prev); t += DT; }
  assert.equal(g.mode, 'parked', 'parked after the stop'); assert.ok(t < 2, `settled in ${t.toFixed(2)} s`);
  LEGS.forEach((leg, i) => assert.ok(dist(prev.world[i], b.toWorld([leg.fx, 0.18, leg.fz])) < 1e-9, `${leg.id} at the park pose`));
  const held = prev.world.map((w) => w.slice()); for (let k = 0; k < 60; k++) prev = frame(g, b, {}, prev);
  held.forEach((w, i) => assert.ok(dist(w, prev.world[i]) < 1e-9, 'parked feet stay'));
  // a parked turn: the body turns 0.8 rad/s for 2 s; it steps in place and no planted foot slides; then parks square to its new heading
  for (let k = 0; k < 120; k++) { b.yaw += 0.8 * DT; prev = frame(g, b, { turning: true }, prev); assert.ok(prev.contacts >= 3); }
  t = 0; while (g.mode !== 'parked' && t < 4) { prev = frame(g, b, {}, prev); t += DT; }
  LEGS.forEach((leg, i) => assert.ok(dist(prev.world[i], b.toWorld([leg.fx, 0.18, leg.fz])) < 1e-9, `${leg.id} square to the turned body`));
  // a walk resumed from the park: the feet down keep their anchors
  b.z += speed * DT; frame(g, b, { moving: true, rate }, prev);
  console.log(`mech-gait: 10 s at rate ${rate}: the body ${b.z.toFixed(2)} m on, ${landings} landings, every planted claw constant to 1e-9, the largest landing step ${(worst * 1000).toFixed(1)} mm; parks in ${t.toFixed(2)} s`);
}
assert.ok(STANCE_DUTY > 0.5);
