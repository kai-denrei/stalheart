// boss-bait-shake.mjs — Isao's flight is a body's (owner, 2026-10-10: "often when Isao is too close to the enemy, his camera shakes violently, like the 3d
// model is stuck repeatedly on a wrong path ... it breaks the immersion by looking like physically impossible motion"; src/domain/boss-bait.js HIS FLIGHT IS A
// BODY'S, .superpowers/sdd/isao-shake-report.md). The trace had the panic's point straight away from the NEAREST low arm, swinging between two arms nearly as
// near frame by frame, and the mover setting his velocity to the wanted one at once: a zigzag at 32 m/s. Checked here: the panic's hysteresis and dwell (an arm
// at the ring no longer flickers it), the way out continuous when two arms trade places, his velocity changing by no more than `accel` cruising and hopping and
// `panicAccel` fleeing an arm or a ring or escaping from under the creature, in every mode, a hop's vertical speed by no more than `climbAccel`, and a constraint dropping only the velocity that pushed into it.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T_FIGHT } from '../src/content/boss-fight.js';
import { makeBait, planBait, moveBait, stepBait, hopBait, startHop, constrainBait } from '../src/domain/boss-bait.js';

const E = T_FIGHT.bait, DT = 1 / 60, dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const T = { ...T_FIGHT, bait: { ...E, hopChance: 0 } };
const SLACK = 1e-6;          // m/s2: frame arithmetic
const WAY_SWING = 5;         // degrees: the most the panic's way out may turn in a frame while two arms trade places (the nearest-arm rule turned 90)
const SHARE = 0.99;          // of the frames of a mixed run, at least this share within the limits (only a ring's hold may break them)
const RUN = 60;              // seconds of each mixed run
const SEEDS = [1, 2, 3, 4, 5];
const lone = (arm) => ({ centre: [0, -200], velocity: [0, 0], radius: 15, contacts: [arm] });   // a creature far off with one arm reaching to `arm`

// the numbers: finite limits, the panic's at least the cruise's, the hysteresis and the dwell above zero
assert.ok(E.panicExit > 0 && E.panicDwell > 0 && Number.isFinite(E.panicAccel) && E.panicAccel >= E.accel && Number.isFinite(E.climbAccel) && E.climbAccel > 0,
  `the body's numbers (panicExit ${E.panicExit}, panicDwell ${E.panicDwell}, panicAccel ${E.panicAccel}, accel ${E.accel}, climbAccel ${E.climbAccel})`);

// THE HYSTERESIS AND THE DWELL: in at `panic`, out only beyond `panic + panicExit` and after `panicDwell` s
{
  const b = makeBait([0, 0], T), at = (d) => lone([0, -d]);
  const plan = (d) => { const w = planBait(b, at(d), T); moveBait(b, DT, w, T); b.pos[0] = 0; b.pos[1] = 0; return b.fleeing; };   // held on the spot
  assert.ok(!plan(E.panic + 1), 'an arm a metre outside the panic ring does not start it');
  assert.ok(plan(E.panic - 0.5), 'an arm inside the ring starts it at once');
  let t = DT, flee = true;
  while (t < E.panicDwell - 2 * DT) { flee = plan(E.panic + E.panicExit + 1) && flee; t += DT; }
  assert.ok(flee, `beyond the exit ring it still flees until it has lasted ${E.panicDwell} s`);
  for (let i = 0; i < 4; i++) plan(E.panic + E.panicExit + 1);
  assert.ok(!b.fleeing, `beyond ${E.panic + E.panicExit} m after the dwell it ends`);
  plan(E.panic - 0.5);
  let held = true;
  for (let i = 0; i < 120; i++) held = plan(E.panic + E.panicExit / 2) && held;
  assert.ok(held, `an arm between ${E.panic} and ${E.panic + E.panicExit} m keeps a panic going (hysteresis)`);
  // an arm flickering across the ring every frame: one start, no flicker
  const c = makeBait([0, 0], T); let toggles = 0, was = false;
  for (let i = 0; i < 180; i++) { const w = planBait(c, at(E.panic + (i % 2 ? 0.5 : -0.5)), T); moveBait(c, DT, w, T); c.pos = [0, 0]; if (c.fleeing !== was) toggles++; was = c.fleeing; }
  assert.equal(toggles, 1, `an arm flickering across the ring every frame starts one panic and it holds (${toggles} toggles in 3 s)`);
}

// TWO ARMS TRADING PLACES (the trace): him between two arms at right angles, their distances swapping every frame; the way out turns a little, his velocity
// changes within `panicAccel`
let waySwing = 0, twoAccel = 0;
{
  const b = makeBait([0, 0], T); let lastWay = null, lastV = b.vel.slice();
  for (let i = 0; i < 120; i++) {
    const s = i % 2 ? 0.3 : -0.3, body = { centre: [-20, -20], velocity: [0, 0], radius: 15, contacts: [[b.pos[0] - 8 - s, b.pos[1]], [b.pos[0], b.pos[1] - 8 + s]] };
    const w = planBait(b, body, T), way = Math.atan2(w[1] - b.pos[1], w[0] - b.pos[0]);
    if (lastWay !== null) { let d = way - lastWay; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI; waySwing = Math.max(waySwing, Math.abs(d) * 180 / Math.PI); }
    lastWay = way;
    moveBait(b, DT, w, T);
    twoAccel = Math.max(twoAccel, dist(b.vel, lastV) / DT); lastV = b.vel.slice();
    assert.ok(b.fleeing, 'two arms within the ring: he flees');
  }
  assert.ok(waySwing < WAY_SWING, `the way out turns at most ${waySwing.toFixed(2)} degrees a frame as two arms trade places (bound ${WAY_SWING}; the nearest arm's rule turned 90)`);
  assert.ok(twoAccel <= E.panicAccel + SLACK, `and his velocity changes by at most ${twoAccel.toFixed(2)} m/s2 (panicAccel ${E.panicAccel})`);
}

// EVERY MODE WITHIN THE LIMITS: 60 s round a walking creature whose six arms sweep out to 45 m and down to the ground, the random hop on, an MK-9's ring
// falling on his path for 10 s of each run: cruising, panicking, hopping (`accel`; out from under it `panicAccel`), fleeing the ring, his ground velocity changes
// by no more than the mode's limit and his
// vertical speed in a hop by no more than `climbAccel` on every frame but a ring's hold
const hopping = { ...T_FIGHT, bait: { ...E, hopChance: 0.3 } }, bound = { at: [0, 0], radius: 120, inset: 10 };
const armsAt = (t) => {
  const c = [Math.sin(t * 0.2) * 25, Math.cos(t * 0.15) * 20], nodes = [];
  for (let k = 0; k < 6; k++) {
    const a = t * 0.6 + k * Math.PI / 3, reach = 25 + 20 * Math.max(0, Math.sin(t * 0.9 + k));
    for (let s = 1; s <= 4; s++) nodes.push([c[0] + Math.cos(a) * reach * s / 4, c[1] + Math.sin(a) * reach * s / 4, 6 - s * 1.5]);
  }
  return { centre: c, velocity: [0, 0], radius: 15, contacts: nodes.filter((p) => p[2] < 1).map((p) => [p[0], p[1]]), nodes };
};
const runs = [];
let lastMode = 'keep', lastWhy = null;
for (const seed of SEEDS) {
  const b = makeBait([0, 70], hopping, seed); let alt = 4, lastV = [0, 0], lastVy = 0, frames = 0, within = 0, worst = 0, modes = { keep: 0, panic: 0, hop: 0, ring: 0 }, held = 0;
  for (let i = 0; i < RUN * 60; i++) {
    const t = i * DT, body = armsAt(t), zones = t > 20 && t < 30 ? [{ at: [Math.sin(seed) * 40, 40], radius: 30, until: 30 }] : [];
    const r = hopBait(b, DT, body, hopping, { bound, alt, base: 4, zones }), why = b.hop?.why ?? lastWhy;
    let mode;
    if (r) { alt = r.alt; mode = why === 'under' || b.zoneFlee ? 'hop-flee' : 'hop'; } else { alt = 4; stepBait(b, DT, body, hopping, zones); mode = b.zoneFlee ? 'ring' : b.fleeing ? 'panic' : 'keep'; }
    modes[mode === 'hop-flee' ? 'hop' : mode]++; lastWhy = b.hop?.why ?? null;
    const limitOf = (m) => (m === 'keep' || m === 'hop' ? E.accel : E.panicAccel);
    const a = dist(b.vel, lastV) / DT, vy = r ? r.vy : 0, ay = Math.abs(vy - lastVy) / DT, limit = limitOf(mode);
    const inRing = zones.some((z) => Math.abs(dist(b.pos, z.at) - z.radius - E.nukeMargin) < 1e-6);
    if (inRing) held++;
    frames++;
    if (a <= Math.max(limit, limitOf(lastMode)) + SLACK && ay <= E.climbAccel + SLACK) within++;
    else if (!inRing) assert.fail(`seed ${seed} at ${t.toFixed(2)} s (${mode}): |dv|/dt ${a.toFixed(2)} m/s2, vertical ${ay.toFixed(2)} m/s2 off a ring's hold`);
    worst = Math.max(worst, inRing ? 0 : a);
    lastV = b.vel.slice(); lastVy = vy; lastMode = mode;
  }
  runs.push({ seed, share: within / frames, worst, modes, held });
  assert.ok(within / frames >= SHARE, `seed ${seed}: ${(100 * within / frames).toFixed(2)} % of the frames within the limits (bound ${100 * SHARE} %)`);
}
{ const all = (k) => runs.reduce((n, r) => n + r.modes[k], 0);
  assert.ok(all('keep') > 0 && all('panic') > 0 && all('hop') > 0 && all('ring') > 0, `the runs keep, panic, hop and flee a ring (${['keep', 'panic', 'hop', 'ring'].map((k) => `${k} ${all(k)}`).join(', ')} frames)`); }

// A HOP LANDS MOVING: coming down onto the far point he flies off round the creature at the cruise, so the autopilot does not set off from a hover
let landSpeed = null;
{
  const body = { centre: [0, 0], velocity: [0, 0], radius: 15, contacts: [[10, 0], [-10, 0], [0, 10], [0, -10]] }, b = makeBait([0, 50], T);
  startHop(b, body, T, 'forced', 4);
  let alt = 4;
  for (let i = 0; i < 20 * 60; i++) { const r = hopBait(b, DT, body, T, { alt, base: 4 }); if (!r) break; alt = r.alt; if (r.ended) { landSpeed = Math.hypot(...b.vel); break; } }
  assert.ok(landSpeed !== null && landSpeed >= 0.8 * E.speed, `a forced hop lands at ${landSpeed?.toFixed(1)} m/s (at least 0.8 of the cruise ${E.speed})`);
}

// THE BOUND IS A WALL, NOT A STOP: his wanted point held on the bound (the lab's clamp) is a carrot sliding along it; flying out at it at 20 m/s with the
// keep pulling him outward, he brakes his speed out to stop on the wall and keeps his speed along it (braking onto the held point had him crawl, pinned)
let wallOut = 0, wallSpeed = null;
{
  const wall = { at: [0, 0], radius: 100 }, b = makeBait([0, 85], T); b.vel = [0, 20];   // 15 m in: room to stop from 20 m/s at accel (6.7 m)
  const held = (p) => { const d = Math.hypot(...p); return d > wall.radius ? [p[0] * wall.radius / d, p[1] * wall.radius / d] : p; };
  for (let i = 0; i < 3 * 60; i++) {
    const r = Math.hypot(...b.pos), u = [b.pos[0] / r, b.pos[1] / r], carrot = [b.pos[0] - u[1] * 7 + u[0] * 24, b.pos[1] + u[0] * 7 + u[1] * 24];
    moveBait(b, DT, held(carrot), T, null, false, wall);
    wallOut = Math.max(wallOut, Math.hypot(...b.pos) - wall.radius);
  }
  wallSpeed = Math.hypot(...b.vel);
  assert.ok(wallOut < 0.05 && wallSpeed > 0.9 * E.speed, `against the wall he stops on it (${wallOut.toFixed(3)} m past) and flies along it at ${wallSpeed.toFixed(1)} m/s (cruise ${E.speed})`);
}

// A CONSTRAINT drops only what pushed into it: pressing into a wall to his east while sliding north, the push east goes, the slide stays
{
  const b = makeBait([10, 0], T); b.vel = [12, 5];
  constrainBait(b, [9, 0]);
  assert.deepEqual([b.pos, b.vel], [[9, 0], [0, 5]], 'the push into the correction goes, the slide along it stays');
  const c = makeBait([10, 0], T); c.vel = [-12, 5];
  constrainBait(c, [9, 0]);
  assert.deepEqual(c.vel, [-12, 5], 'a velocity already leaving the constraint is kept');
}

const share = Math.min(...runs.map((r) => r.share)), worstA = Math.max(...runs.map((r) => r.worst));
console.log(`Boss bait shake: the panic starts at ${E.panic} m, ends beyond ${E.panic + E.panicExit} m after ${E.panicDwell} s (one start for an arm flickering at the ring); two arms trading places turn the way out ${waySwing.toFixed(2)} degrees a frame at most (bound ${WAY_SWING}) and his velocity ${twoAccel.toFixed(1)} m/s2; ${SEEDS.length} mixed runs of ${RUN} s (keep, panic, hops, an MK-9's ring): at least ${(100 * share).toFixed(2)} % of the frames within ${E.accel} / ${E.panicAccel} m/s2 and ${E.climbAccel} m/s2 vertical, worst off a ring's hold ${worstA.toFixed(1)} m/s2; a hop lands at ${landSpeed.toFixed(1)} m/s; against the bound's wall ${wallOut.toFixed(3)} m past it at ${wallSpeed.toFixed(1)} m/s along it (${runs.map((r) => `${r.seed}: ${r.modes.keep}/${r.modes.panic}/${r.modes.hop}/${r.modes.ring}`).join(', ')} keep/panic/hop/ring frames).`);
