// pearl-motion.mjs — round four of the Pearl set (owner, 2026-10-13: "the moving animations are too jerky, they should feel slower and more organic ...
// slower and organic feeling is a must. Let's reduce the waves at first, to get the animation right"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md,
// "Round 4"): the gait's pieces (the eased transfer and its shader lines, the stage shares, the heading turned through the coil with the stalks on their
// caps, the two-stalk caps at the fork, the frame's own step), the paced records (every tier at most its radii a second), the record waiting for its body,
// and the motion audit (src/fx/pearl-motion.js) over bodies following walking records: the round-three follow pops, the gait does not; the waves thinned.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { PEARL_TIERS, PEARL_FOLLOW, PEARL_PACE, PEARL_IMPACT, PEARL_GAIT, PEARL_WAVES } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { pearlWait, pearlCatch, pearlSpeed } from '../src/domain/pearl-bodies.js';
import { CutisSwarm, STEP } from '../src/fx/cutis-maku/swarm.js';
import { DEFAULT_CONFIG, cycleTiming, transferProgress, easeShare, capAngles } from '../src/fx/cutis-maku/config.js';
import { MEMBRANE_VERT } from '../src/fx/cutis-maku/shaders.js';
import { footprintDirs } from '../src/fx/cutis-maku/deform.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { createCreatureEnemies, PEARL_BODIES, pearlSpec } from '../src/fx/creature-enemies.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';
import { SOFT_HUNT } from '../src/content/soft-hunt.js';
import { createSoftHunt } from '../src/fx/soft-hunt.js';
import { bfsDist } from '../src/dungeon.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);

// ---- the eased transfer, the shares, the shader ----
{
  for (const acc of [1.8, 2.5]) {
    assert.equal(transferProgress(0, acc, 1), 0); assert.equal(transferProgress(1, acc, 1), 1);
    const h = 1e-4, v0 = transferProgress(h, acc, 1) / h, v1 = (1 - transferProgress(1 - h, acc, 1)) / h, kit1 = (1 - transferProgress(1 - h, acc, 0)) / h;
    assert(v0 < 1e-2 && v1 < 1e-2, `the eased transfer starts and ends at rest (${v0}, ${v1})`);
    assert(kit1 > 1.5, `the kit's ends at its fastest (${kit1})`);
    close(transferProgress(0.3, acc, 0), Math.pow(0.3, acc), 1e-12, 'ease 0 is the kit\'s');
  }
  assert.equal(easeShare(0.5, 0), 0.5); close(easeShare(0.25, 1), 0.25 * 0.25 * 2.5, 1e-12, 'a point\'s share smoothstepped');
  assert.equal(easeShare(-1, 1), 0); assert.equal(easeShare(2, 1), 1);
  const T = PEARL_GAIT.config.timing, sum = T.coil + T.extend + T.anchor + T.transfer + T.settle;
  close(sum, 1, 1e-9, 'the shares make the cycle');
  const t = cycleTiming(3, T); close(t.transfer, 3 * T.transfer, 1e-12, 'a share of the cycle'); assert(T.transfer >= 0.45, 'the body moves for about half its cycle');
  const kit = cycleTiming(3); assert(kit.transfer / 3 < 0.25, 'the kit\'s moves for under a quarter');
  for (const line of ['uniform float uEase;', 'if(uEase>0.)accelerated=mix(accelerated,transfer*transfer*transfer*(transfer*(transfer*6.-15.)+10.),uEase);',
    'if(uEase>0.)u=mix(u,u*u*(3.-2.*u),uEase);', 'if(uEase>0.)bodyU=mix(bodyU,bodyU*bodyU*(3.-2.*bodyU),uEase);']) assert(MEMBRANE_VERT.includes(line), `the shader: ${line}`);
}
console.log('PASS the eased transfer (at rest at both ends, the kit\'s without it), the stage shares, the shader\'s uEase lines');

// ---- the heading through the coil, the stalks on their caps ----
{
  const cfg = { ...DEFAULT_CONFIG, ...PEARL_TIERS.find((x) => x.id === 'blue').values, ...PEARL_GAIT.config, reach: PEARL_GAIT.hop, r0: 2 };
  assert.deepEqual(capAngles(cfg), [-PEARL_GAIT.config.forkAngle, PEARL_GAIT.config.forkAngle], 'a two-stalk swarm\'s caps at its fork');
  assert.deepEqual(capAngles({ ...cfg, seekCount: 3 }), [-1.2, 0, 1.2]); assert.deepEqual(capAngles(DEFAULT_CONFIG), [-1.2, 0, 1.2], 'the kit\'s caps without the gait');
  const dirs = footprintDirs(capAngles(cfg)), f = PEARL_GAIT.config.forkAngle;
  assert(dirs.some((d) => Math.abs(d[0] - Math.sin(f)) < 1e-9 && Math.abs(d[2] - Math.cos(f)) < 1e-9), 'the audit\'s directions carry the fork\'s cap axes');
  const sw = new CutisSwarm(cfg, { capacity: 2 });
  sw.reset(1); sw.setTarget(0, 0, 0); sw.place(0, 0, 0, 0);
  let turns = 0, coilSeen = 0, worstStep = 0;
  for (let n = 0; n < 4000; n++) {
    if (n % 500 === 0) { const a = n / 300; sw.setTarget(0, sw.offset[0] + Math.cos(a) * 30, sw.offset[2] + Math.sin(a) * 30); }
    const h0 = Math.atan2(sw.heading[2], sw.heading[0]);
    // the stalks' world directions over a step inside the coil do not change while the heading turns
    const dir0 = Math.atan2(sw.heading[2], sw.heading[0]) - sw.probe0[0], ph = sw.phase[0];
    sw.step(STEP);
    const h1 = Math.atan2(sw.heading[2], sw.heading[0]); let dh = Math.abs(h1 - h0); if (dh > Math.PI) dh = 2 * Math.PI - dh;
    if (sw.phase[0] > ph && sw.phase[0] < 0.1) { coilSeen++; const dir1 = h1 - sw.probe0[0]; let d = Math.abs(dir1 - dir0) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; assert(d < 1e-5, `a stalk keeps its world direction through the coil's turn (${d})`); if (dh > 1e-5) turns++; }
    if (sw.phase[0] > ph) worstStep = Math.max(worstStep, dh);
    if (sw.phase[0] >= 0.1 && sw.phase[0] < 0.62) {
      assert.equal(sw.turnNow[0], 0, 'past the coil the turn is done');
      close(sw.heading[0], sw.goal[0], 1e-6, 'the heading is the plan\'s'); close(sw.heading[2], sw.goal[1], 1e-6, 'the heading is the plan\'s');
    }
  }
  assert(coilSeen > 50 && turns > 10, `the heading turns through the coil (${turns} steps of ${coilSeen})`);
  assert(worstStep < 0.08, `never more than a small turn a step (${worstStep} rad in 1/120 s)`);
}
console.log('PASS the heading turned through the coil (the stalks keep their world directions, on their caps after it), a two-stalk swarm\'s caps at its fork');

// ---- the paced records, the wait, the catch-up ----
{
  for (const [type, b] of Object.entries(PEARL_BODIES)) {
    const s = pearlSpec(type), radii = s.speed * PEARL_GAIT.sectorPace * 10 / b.r0;
    if (PEARL_PACE[b.tier].glide) assert(radii > 1.2, `${type} glides past the gait's ceiling (${radii.toFixed(2)} radii a second)`);   // a blob is not held (2026-10-16)
    else assert(radii <= PEARL_PACE[b.tier].radii + 1e-9 && radii <= 1.2, `${type} walks ${radii.toFixed(2)} radii a second`);
    assert.equal(s.erratic, false); assert.equal(s.jink, false);
  }
  assert.equal(pearlSpeed({ speed: 1, r0: 2, sectorPace: 1.5, metresPerCell: 10 }), 1, 'no cap without radii');
  const W = PEARL_GAIT.wait;
  assert.equal(pearlWait(0, 6, W), 1); assert.equal(pearlWait(6 * W.from, 6, W), 1); close(pearlWait(6 * W.to, 6, W), W.min, 1e-12, 'held back two hops behind');
  assert(pearlWait(9, 6, W) < 1 && pearlWait(9, 6, W) > W.min, 'eased between');
  assert.equal(pearlCatch(3, 6, 0.5), 1); close(pearlCatch(12, 6, 0.5), 1.5, 1e-12, 'hurried at most 1 + catchUp');
}
console.log('PASS the paced records (every tier at most its radii a second, no bursts, no jink), the record\'s wait for its body, the catch-up');

// ---- THE SOFT HUNT'S WALK, AUDITED (owner, 2026-10-18, round three, note 2: "the weaker units (white and yellows) need to be faster and more aggressive"; src/fx/soft-hunt.js) ----
// The caps re-based for the hunt only, by name. BEFORE: a white's and a yellow's walk was its PEARL_PACE `radii` (5 and 2.8 radii a second at the
// sector's pace; the glide's audit above holds no upper bound since 2026-10-16, only no pop). HUNTING: x SOFT_HUNT.pace (white 1.35, yellow 1.25) at the
// widest pace jitter (1.12), and on the ring the jab's lunge, faster than the walk: HUNT_CAP below. The pop is 0.25 radii in a 60 fps frame (15 radii a
// second). The walk is the real one (createSoftHunt on a grid of 10 m cells), the bodies the real gliding blobs.
// THE CAP IS SET FROM THE MEASUREMENT (review, 2026-10-19: the first cap, 9 / 6, was only checked from a formula, and the measured drawn centre ran
// white 9.3 and yellow 11.2 radii a second, the yellow nearly twice its cap). The formula (nominal r0, the record's walk and the jab's sine peak) gives
// white 7.6 / 8.8 and yellow 3.9 / 5.6 (walk / jab): it misses what the glide's draw adds (a likely cause, not isolated: the blob's own offset across and
// along its record's heading, `glideSpread`, swings when the heading flips at the lunge's deepest point), which is why the measured run is the guard
// and the formula the second test. Measured below (11,442 frames a tier), radii a second: white p99 8.1, worst 9.3; yellow p99 9.2, p99.9 10.6, worst
// 11.2 (the yellow's top steps all on the ring, in a jab). The caps sit just above the worst, 10 and 12 (the pop is 15). The worst is asserted, not the
// 99th percentile: the cap bounds what the motion does, and a pop is one frame. The look is the implementer's (r3-c report: blobs lunging in at the
// parked hull, no pop); the 11.2 was not looked at again alone. BEFORE: 5 / 2.8 (the walk's PEARL_PACE radii; the gliding tiers had no upper cap
// since 2026-10-16); the first hunt cap 9 / 6 (formula only). It runs in the plain `node test/pearl-motion.mjs` (npm test); SOFT_HUNT_AUDIT=1 only prints.
const HUNT_CAP = { white: 10, yellow: 12 };   // radii a second while hunting the hull, walk or jab, measured worst 9.3 / 11.2
{
  for (const [type, b] of Object.entries(PEARL_BODIES)) {
    if (!SOFT_HUNT.tiers.includes(b.tier)) continue;
    const walk = pearlSpec(type).speed * 1.12 * PEARL_GAIT.sectorPace * 10, hunting = (walk * SOFT_HUNT.pace[b.tier]) / b.r0;
    const jab = ((Math.PI * (SOFT_HUNT.ring - SOFT_HUNT.jab.depth)) / SOFT_HUNT.jab.seconds) * 1.15 * 10 / b.r0;
    assert(hunting <= HUNT_CAP[b.tier] && jab <= HUNT_CAP[b.tier], `${type} hunts at ${hunting.toFixed(2)} radii a second, jabs at ${jab.toFixed(2)} (cap ${HUNT_CAP[b.tier]})`);
    assert(HUNT_CAP[b.tier] <= 0.25 * 60 * 0.8, 'the cap under 80 % of a pop a frame (15 radii a second)');
  }
  const N = 61, cs = 0.01, M = 1000, centers = [], adj = [], idx = (i, j) => (i + 30) * N + j + 30;   // 10 m cells (cs x M metres)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = (i - 30) * cs, y = (j - 30) * cs, l = Math.hypot(x, y, 1); centers.push([x / l, y / l, 1 / l]); adj.push([[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].filter(([a, c]) => a >= 0 && c >= 0 && a < N && c < N).map(([a, c]) => a * N + c)); }
  const hull = { cur: idx(0, 0), pos: centers[idx(0, 0)].slice() };
  let field = bfsDist(adj, [hull.cur]);
  const sh = createSoftHunt({ hull: () => hull, field: () => field, graph: () => ({ adj, centers }), cellSide: () => cs, open: () => true, tune: () => null, gateDist: () => 40, enemies: () => recs });
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT, pace: PEARL_PACE, gait: PEARL_GAIT });
  // the audit's own watch skips a gliding blob (it is placed every frame, which the audit books as a re-placement), so the blobs are measured
  // here as the audit measures a centre: the drawn centre's move a frame, scaled to 60 fps, in the body's radii; a pop past 0.25
  const seen = {};
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const recs = [];
  for (const [k, type] of ['amoeba', 'phage', 'ghost', 'scoutufo'].flatMap((t) => [t, t, t]).entries()) {
    const c = idx(4 + (k % 3), -6 + k), p = centers[c];
    const e = { id: k, type, alive: true, cur: c, next: c, prog: 0, pos: p.slice(), dir: [-1, 0, 0], jit: 0.9 + rnd() * 0.22, walkPace: 0 };
    e.h = fam.add(type, { x: p[0] * M, z: p[1] * M, angle: Math.PI, speed: 5 }); recs.push(e);
  }
  let t = 0, frame = 0, ringed = 0;
  while (t < 40) {
    const dt = [1 / 60, 1 / 45, 1 / 50, 1 / 40][frame++ % 4]; t += dt;
    if (t > 30 && t < 34) { const c = idx(Math.round((t - 30) * 0.6), 0); if (c !== hull.cur) { hull.cur = c; hull.pos = centers[c].slice(); field = bfsDist(adj, [c]); } }   // the hull drives off a few cells: they re-aim
    for (const e of recs) {
      let pace = pearlSpec(e.type).speed * e.jit * PEARL_GAIT.sectorPace * sh.pace(e, t);
      const ringPace = pace; if (sh.ringed(e)) pace = 0;
      e.prog += pace * dt; e.walkPace = pace;
      while (e.prog >= 1) { e.prog -= 1; e.cur = e.next; const ex = adj[e.cur].filter((c) => sh.wants(e) && field[c] < field[e.cur]); e.next = ex.length ? ex[e.id % ex.length] : e.cur; }
      const a = centers[e.cur], b = centers[e.next], f = Math.min(1, e.prog), q = [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f), l = Math.hypot(...q);
      e.pos = q.map((v) => v / l);
      if (e.next !== e.cur) { const d = [b[0] - a[0], b[1] - a[1]], dl = Math.hypot(...d); e.dir = [d[0] / dl, d[1] / dl, 0]; }
      sh.place(e, ringPace, dt, t);
      const v = e.walkPace * 10, lead = CREATURE_FOLLOW.lead * v;
      fam.track(e.h, { x: e.pos[0] * M, z: e.pos[1] * M, ax: e.pos[0] * M + e.dir[0] * lead, az: e.pos[1] * M + e.dir[1] * lead, dt, speed: v });
    }
    fam.step(dt, null, 0);
    for (const e of recs) {
      const v = fam.view(e.h), tier = PEARL_BODIES[e.type].tier, o = (seen[tier] ??= { frames: 0, pops: 0, worst: 0, steps: [] });
      if (e.last && e.last.hub === v.hub) { const step = Math.hypot(v.centre[0] - e.last.c[0], v.centre[1] - e.last.c[1]) / v.radius / (dt * 60); o.frames++; o.worst = Math.max(o.worst, step); o.steps.push(step * 60); if (step > 0.25) o.pops++; }
      e.last = { c: v.centre.slice(), hub: v.hub };
    }
    if (t > 20 && t < 30) ringed = Math.max(ringed, sh.state().atHull);
  }
  assert(ringed >= 8, `the blobs reach the ring round the hull (${ringed} of 12 at once)`);
  for (const id of SOFT_HUNT.tiers) {
    const m = seen[id];
    assert(m && m.frames > 3000, `${id}: watched (${JSON.stringify(m)})`);
    assert.equal(m.pops, 0, `${id}: no centre pop on the hunt (${m.pops} of ${m.frames})`);
    // the measured walk against the cap: the worst drawn step a frame, in radii a second (step x 60), under HUNT_CAP and not far under it (the cap is a guard)
    const rs = m.worst * 60, sorted = m.steps.slice().sort((a, b) => a - b), p99 = sorted[Math.floor(sorted.length * 0.99)];
    assert(rs <= HUNT_CAP[id], `${id}: the drawn centre's worst step is ${rs.toFixed(2)} radii a second (99th percentile ${p99.toFixed(2)}), over HUNT_CAP ${HUNT_CAP[id]}`);
    assert(rs >= 0.7 * HUNT_CAP[id], `${id}: HUNT_CAP ${HUNT_CAP[id]} sits far above the measured worst ${rs.toFixed(2)}: lower it to just above`);
    if (process.env.SOFT_HUNT_AUDIT) console.log(`${id}: frames ${m.frames}, p99 ${p99.toFixed(2)}, worst ${rs.toFixed(2)} radii a second (cap ${HUNT_CAP[id]})`);
  }
}
console.log('PASS the soft hunt audited: white and yellow hunting the hull x SOFT_HUNT.pace, flanking round it, circling and jabbing, the drawn centre\'s worst step under HUNT_CAP (measured 9.3 / 11.2, caps 10 / 12; formula check too), no pop');

// ---- the motion: bodies following records along cell paths (turns at the corners, a scare now and then), a jittery frame ----
function follow(gait, secs = 12, per = 3) {
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT, pace: PEARL_PACE, gait });
  fam.watch({ perTier: per });
  const recs = [];
  for (const [ti, type] of ['amoeba', 'ghost', 'saucer', 'drifter', 'corona', 'barbed', 'rolling', 'phantom'].entries()) for (let b = 0; b < per; b++) {
    // without the gait, the round-three tree's own records (the type's speed, the first waves' 0.4, the bursts)
    const spec = gait ? pearlSpec(type) : { ...ENEMY_SPEC[type], ...(ti < 2 ? { speed: ENEMY_SPEC[type].speed * 0.4, erratic: false } : {}) }, x = ti * 400 + b * 45, ang = rnd() * 6.28, jit = (0.9 + rnd() * 0.22) * 1.5;
    const r = { spec, x, z: 0, ang, ax: x, az: 0, bx: x + Math.cos(ang) * 10, bz: Math.sin(ang) * 10, prog: 0, jit, ph: rnd(), scare: -9 };
    r.h = fam.add(type, { x, z: 0, angle: ang, speed: spec.speed * jit * 10 }); recs.push(r);
  }
  let t = 0, frame = 0;
  while (t < secs) {
    const dt = [1 / 60, 1 / 45, 1 / 50, 1 / 40][frame++ % 4]; t += dt;
    for (const r of recs) {
      let pace = r.spec.speed * r.jit;
      if (r.spec.erratic) pace *= 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 3.1 + r.ph * 7));
      if (r.spec.jink) pace *= 0.55 + 0.9 * (0.5 + 0.5 * Math.sin(t * 6.3 + r.ph * 11));
      if (rnd() < dt / 20) r.scare = t;
      if (t - r.scare < 0.35) pace = 0; else if (t - r.scare < 1.5) pace *= 1.6;
      r.prog += pace * fam.paceOf(r.h) * dt;
      while (r.prog >= 1) { r.prog -= 1; r.ax = r.bx; r.az = r.bz; r.ang += (rnd() - 0.5) * 1.8; r.bx = r.ax + Math.cos(r.ang) * 10; r.bz = r.az + Math.sin(r.ang) * 10; }
      r.x = r.ax + (r.bx - r.ax) * r.prog; r.z = r.az + (r.bz - r.az) * r.prog;
      const v = r.spec.speed * r.jit * 10, lead = CREATURE_FOLLOW.lead * v;
      fam.track(r.h, { x: r.x, z: r.z, ax: r.x + Math.cos(r.ang) * lead, az: r.z + Math.sin(r.ang) * lead, dt, speed: v });
    }
    fam.step(dt, null, 0);
  }
  return { motion: fam.motion(), stats: fam.stats() };
}
{
  const before = follow(null), after = follow(PEARL_GAIT);
  const sum = (o, k) => Object.values(o.motion).reduce((a, m) => a + m[k], 0);
  assert(sum(before, 'pops') > 100, `the audit sees the round-three follow's jumps (${sum(before, 'pops')} pops)`);
  for (const [id, m] of Object.entries(after.motion)) {
    assert.equal(m.pops, 0, `${id}: no centre pop (${JSON.stringify(m)})`); assert.equal(m.shapePops, 0, `${id}: no shape pop (${JSON.stringify(m)})`);
    if (PEARL_PACE[id].glide) { assert.equal(m.hops, 0, `${id}: a gliding blob hops never (${m.hops})`); continue; }   // the blobs (2026-10-16): no hops, no pops
    assert(m.frames > 300 && m.hops > 3, `${id}: watched (${m.frames} frames, ${m.hops} hops)`);
    assert(m.speed[1] < 9 && m.accel[0] < 80 && m.jerk[0] < 3000, `${id}: slow and smooth (speed p95 ${m.speed[1]} r/s, accel p95 ${m.accel[0]}, jerk p95 ${m.jerk[0]})`);
    assert(m.cycle > 1.5 && m.moving > 0.45, `${id}: long hops, moving half the time (${m.cycle} s, ${m.moving})`);
    assert.equal(after.stats[id].replaced, 0, `${id}: never put back`);
    const b = before.motion[id]; assert(m.jerk[0] < b.jerk[0] / 5, `${id}: jerk p95 ${m.jerk[0]} against ${b.jerk[0]}`);
  }
}
console.log('PASS the motion: the gait\'s bodies follow walking records with no centre or shape pop, no re-placement, long hops moving half the cycle; the round-three follow popped');

// ---- the frame's own step ----
{
  const cfg = { ...DEFAULT_CONFIG, ...PEARL_GAIT.config, r0: 2 };
  const a = new CutisSwarm(cfg, { capacity: 1 }), b = new CutisSwarm({ ...cfg, frameStep: false }, { capacity: 1 });
  assert.equal(a.advance(1 / 45), 2, 'a 45 fps frame in two equal steps'); close(a.time, 1 / 45, 1e-12, 'the whole frame, no remainder');
  b.advance(1 / 45); assert(Math.abs(b.time - 1 / 45) > 1e-3, 'the kit keeps a remainder');
}
console.log('PASS the frame\'s own step');

// ---- the waves paced, never thinned (2026-10-15, sector shapes: the count is the sector's row; the climb itself is test/pearl-enemies.mjs) ----
{
  const scene = new THREE.Scene(), heartPoint = [0, 0, 690];
  const host = (flags) => ({ scene, root: null, flags, camera: null, canvasHeight: () => 800, enemies: [], field: () => null, spawn: () => null, heart: () => [heartPoint, 0, 1], ground: () => null, perf: () => null, perfOn() {}, damage() {}, build: () => null });
  const q = (type, n, extra = {}) => Array.from({ length: n }, (_, k) => ({ type, sp: { ci: 1 }, at: k * 0.2, ...extra }));
  const wave = [...q('amoeba', 40), ...q('phage', 20), ...q('amoeba', 3, { squad: 5 }), ...q('knot', 1), ...q('drifter', 2), ...q('ghost', 1, { harmless: true })];
  const ce = createCreatureEnemies(host({ creatures: 'pearl' }));
  const out = ce.replace(wave, 'gate', { released: 0, planned: 4 }), count = (a, f) => a.filter(f).length;
  assert.equal(out.length, wave.length, 'every body of the wave is kept');
  assert.equal(count(out, (e) => e.type === 'amoeba' && !e.squad), 40); assert.equal(count(out, (e) => e.squad), 3, 'the squads kept');
  assert.equal(count(out, (e) => e.type === 'knot'), 1, 'the boss kept'); assert.equal(count(out, (e) => e.harmless), 1, 'harmless entries kept');
  assert(out.every((e, k) => e.at === wave[k].at && Math.abs(e.pace - PEARL_WAVES.pace.first) < 1e-9), 'the entries keep their times and march at the first pace');
  assert.equal(ce.state().waves.last.pace, PEARL_WAVES.pace.first);
  assert.equal(createCreatureEnemies(host({ creatures: 'pearl', waves: 'full' })).replace(wave, 'gate'), wave, '&waves=full keeps the whole wave');
  assert.equal(createCreatureEnemies(host({})).replace(wave, 'gate'), wave, 'without ?creatures=pearl nothing is paced');
  ce.dispose();
}
console.log('PASS the waves paced under ?creatures=pearl: a first wave whole at PEARL_WAVES.pace.first; squads, bosses, harmless kept; &waves=full at its own pace');


// ---- the tune panel keeps an entry's own scale (review of note 8b, 2026-10-19): THE ARENA's small Reeds spawn at x3 (ownSize 3, src/fx/enemy-step.js
// spawnOne), and the panel's size is over it, so an apply at 1.2 reads 3.6, not 1.2; a record without an own scale takes the panel's size as before ----
{
  const ce = createCreatureEnemies({ scene: new THREE.Scene(), root: null, flags: {}, camera: null, canvasHeight: () => 800, enemies: [], field: () => null, spawn: () => null, heart: () => [[0, 0, 690], 0, 1], ground: () => null, perf: () => null, perfOn() {}, damage() {}, build: () => null });
  const reed = { alive: true, size: 3, sizeMul: 3, ownSize: 3, hp: 4, hpMul: 1 }, plain = { alive: true, size: 1, sizeMul: 1, hp: 4, hpMul: 1 };
  ce.retune(reed, { size: 1.2, hp: 1 }); ce.retune(plain, { size: 1.2, hp: 1 });
  close(reed.sizeMul, 3.6, 1e-9, 'the x3 Reed retuned to 1.2 keeps its own scale'); close(reed.size, 3.6, 1e-9, 'and its reach with it'); assert.equal(reed.hp, 4, 'same health');
  close(plain.sizeMul, 1.2, 1e-9, 'a record without an own scale: the panel\'s size'); close(plain.size, 1.2, 1e-9, 'its reach');
  ce.retune(reed, { size: 1, hp: 1 }); close(reed.sizeMul, 3, 1e-9, 'the panel back to 1: back to x3, not 1x');
  ce.dispose();
}
console.log('PASS the tune panel keeps an entry\'s own scale (the arena\'s x3 Reeds)');
