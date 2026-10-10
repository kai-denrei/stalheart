// boss-bait-nuke.mjs — Isao keeps out of a falling MK-9's ring (owner, 2026-10-10: "Have Isao more actively avoid where the Nuke will fall. A user mistake
// leading to friendly fire is fine, but Isao actively changing direction to enter the radius of the incoming nuke feels wrong"): src/domain/boss-bait.js takes
// a list of DANGER ZONES `[{ at, radius, until }]`; each is kept out to radius + bait.nukeMargin. Bounds are named; one summary line.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T_FIGHT } from '../src/content/boss-fight.js';
import { makeBait, planBait, moveBait, stepBait, hopBait, startHop } from '../src/domain/boss-bait.js';

const DT = 1 / 60, E = T_FIGHT.bait, RADIUS = T_FIGHT.nuke.radius, MARGIN = E.nukeMargin, RING = RADIUS + MARGIN;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const feet = [[-7.7, -12.9], [-6.5, -11.7], [6, -12.9], [7.3, -11.6], [13.6, -0.3], [14.8, 1], [-14.1, -0.4], [-12.9, 1], [-6.6, 11], [7.4, 11], [-7.8, 12.2], [6, 12.2], [8.6, 13.7]];
const bodyAt = (x, z) => ({ centre: [x, z], velocity: [0, 0], radius: 15, contacts: feet.map((p) => [p[0] + x, p[1] + z]) });
const tuneOf = (erratic) => ({ ...T_FIGHT, bait: { ...E, erratic } });
const zone = (x, z, until = 4.2) => ({ at: [x, z], radius: RADIUS, until });
const SLACK = 1e-6;
const log = {};

assert.ok(MARGIN === 10 && RADIUS === 55 && RING === 65, `the margin is 10 m beyond the MK-9's ${RADIUS} m ring`);
assert.ok(E.flee * T_FIGHT.nuke.travel > RING, 'the flee speed covers a whole ring within an MK-9\'s fall');

// NO ZONES: the flight is the one before, bit for bit: null, an empty list and a zone far from the whole run all fly the recorded positions
{
  const run = (zones) => {
    const out = [];
    for (const erratic of [0, 1]) {
      const T = tuneOf(erratic), bait = makeBait([0, 60], T, 5); let alt = 4;
      for (let i = 0; i < 60 * 60; i++) {
        const body = bodyAt(Math.sin(i / 300) * 30, 0), r = hopBait(bait, DT, body, T, { bound: { at: [0, 0], radius: 120, inset: 10 }, alt, base: 4, ...(zones === undefined ? {} : { zones }) });
        if (r) alt = r.alt; else { alt = 4; stepBait(bait, DT, body, T, zones); }
        out.push(bait.pos[0], bait.pos[1], bait.heading, bait.flight.speed);
      }
    }
    return out;
  };
  const base = run(undefined);
  assert.deepEqual(run(null), base, 'null zones fly the same run');
  assert.deepEqual(run([]), base, 'an empty list flies the same run');
  assert.deepEqual(run([zone(3000, 3000)]), base, 'a zone far off flies the same run');
  log.same = base.length / 4;
}

// (1) A ZONE BETWEEN HIM AND WHERE HE IS GOING: straight at a point across the ring, jinks on or off, his path never enters the ring (radius + margin), and
// he gets there
let minPath = Infinity;
for (const erratic of [0, 1]) for (const seed of [1, 2, 3, 4]) for (const off of [0, 12, -30]) {
  const T = tuneOf(erratic), bait = makeBait([-110, off], T, seed), z = [zone(0, 0)], goal = [110, off / 2];
  let at = null;
  for (let i = 0; i < 40 * 60 && !at; i++) {
    moveBait(bait, DT, goal, T, z);
    minPath = Math.min(minPath, dist(bait.pos, z[0].at));
    if (dist(bait.pos, goal) < 3) at = i * DT;
  }
  assert.ok(at !== null, `erratic ${erratic} seed ${seed} offset ${off}: he gets round the ring to the far point (${dist(bait.pos, goal).toFixed(1)} m left)`);
}
{
  const T = tuneOf(0), bait = makeBait([-110, 0], T); let through = Infinity;
  for (let i = 0; i < 20 * 60; i++) { moveBait(bait, DT, [110, 0], T); through = Math.min(through, dist(bait.pos, [0, 0])); }
  assert.ok(through < 1, `without the ring the same flight crosses its centre (${through.toFixed(1)} m), so the test bites`);
}
assert.ok(minPath >= RING - SLACK, `across a ring his path never enters it: nearest ${minPath.toFixed(2)} m to its centre (ring ${RING})`);
log.path = minPath;

// the autopilot round a creature with a zone on its keep circle: over 40 s, whatever the seed, he never enters the ring (the creature's own panic included)
let minKeep = Infinity;
for (const erratic of [0, 1]) for (const seed of [1, 2, 3, 4, 5, 6]) for (const at of [[45, 0], [-45, 0], [0, -45], [0, 45]]) {
  const T = tuneOf(erratic), z = [zone(at[0], at[1])], bait = makeBait([-at[0] * 35 / 45, -at[1] * 35 / 45], T, seed);   // on his side of the creature, 80 m from the ring's centre
  for (let i = 0; i < 40 * 60; i++) { stepBait(bait, DT, bodyAt(0, 0), T, z); minKeep = Math.min(minKeep, dist(bait.pos, z[0].at)); }
}
assert.ok(minKeep >= RING - SLACK, `round a creature with the ring on his circle he never enters it: nearest ${minKeep.toFixed(2)} m (ring ${RING})`);
log.keep = minKeep;

// (2) INSIDE A RING AT THE RELEASE: straight out at the flee speed, out of the MK-9's ring within (radius - dist) / flee + 0.5 s and of the margin's within
// (ring - dist) / flee + 0.5 s; each frame he goes farther from its centre, at no more than the flee speed, whatever the jink and the creature's panic
let worstOut = 0;
for (const erratic of [0, 1]) for (const d0 of [0, 5, 20, 40, 54]) for (const arm of [null, 'outside', 'inside']) {
  const T = tuneOf(erratic), z = [zone(0, 0)], bait = makeBait([d0, 0], T, 3);
  // the creature's arm on the way out (an arm 6 m outside him: the panic would back him in) or on the inside
  const body = arm === null ? bodyAt(400, 400) : { centre: [400, 400], velocity: [0, 0], radius: 15, contacts: [[d0 + (arm === 'outside' ? 6 : -6), 0]] };
  let cleared = null, ring = null, last = d0, step = 0;
  for (let i = 0; i < 6 * 60 && ring === null; i++) {
    stepBait(bait, DT, body, T, z);
    const d = dist(bait.pos, z[0].at); step = Math.max(step, d - last); last = d;
    if (d >= RADIUS && cleared === null) cleared = (i + 1) * DT;
    if (d >= RING) ring = (i + 1) * DT;
    if (d0 > 0) assert.ok(d >= last - 1e-9 && bait.zoneFlee || d >= RING, `he goes straight out (${d.toFixed(2)})`);
  }
  assert.ok(step <= E.flee * DT + 1e-9, `no faster than the flee speed (${(step / DT).toFixed(1)} m/s)`);
  const bound = (RADIUS - d0) / E.flee + 0.5, boundRing = (RING - d0) / E.flee + 0.5;
  assert.ok(cleared !== null && cleared <= bound, `erratic ${erratic} from ${d0} m (arm ${arm}): out of the ${RADIUS} m ring in ${cleared?.toFixed(2)} s (bound ${bound.toFixed(2)})`);
  assert.ok(ring !== null && ring <= boundRing, `...and of the margin's in ${ring?.toFixed(2)} s (bound ${boundRing.toFixed(2)})`);
  worstOut = Math.max(worstOut, cleared - (RADIUS - d0) / E.flee);
  assert.ok(!bait.zoneFlee || dist(bait.pos, z[0].at) < RING + 1, 'the flag is down once he is clear');
}
log.out = worstOut;

// two overlapping rings: out of both, away from the deeper
{
  const T = tuneOf(1), z = [zone(0, 0), zone(30, 0)], bait = makeBait([10, 5], T, 2);
  for (let i = 0; i < 5 * 60; i++) stepBait(bait, DT, bodyAt(500, 500), T, z);
  assert.ok(z.every((q) => dist(bait.pos, q.at) >= RING - SLACK), 'out of two overlapping rings');
}

// (3) A HOP: a goal inside a ring is moved out, a crossing is routed round, a hop that is not forced waits for the other side or for good, and in a ring mid-hop
// he flies out
{
  const T = tuneOf(0), body = bodyAt(0, 0), bound = { at: [0, 0], radius: 150, inset: 10 };
  const far = (dir) => [dir[0] * 40, dir[1] * 40];   // the hop's far-side goal: keep (20) beyond the feet (about 20 m): 35 to 40 m out
  // forced from (0, -40): its goal is near (0, 40); a ring there is moved out of, the path round it
  const z = [zone(0, 45)], b = makeBait([0, -40], T);
  startHop(b, body, T, 'forced', 4, bound, z);
  let minZ = Infinity, ended = false, alt = 4;
  for (let i = 0; i < 20 * 60 && !ended; i++) { const r = hopBait(b, DT, body, T, { bound, alt, base: 4, zones: z }); if (!r) break; alt = r.alt; minZ = Math.min(minZ, dist(b.pos, z[0].at)); ended = r.ended; }
  assert.ok(ended && minZ >= RING - SLACK, `a forced hop to a goal in a ring lands outside it and never crosses it: nearest ${minZ.toFixed(2)} m, ended ${ended}`);
  log.hopForced = minZ;
  // 'random' or 'trapped' toward a ring: the other side when it is clear
  const nonForced = makeBait([0, -40], T), r1 = startHop(nonForced, body, T, 'random', 4, null, [zone(0, 45)]);
  assert.ok(r1 && r1.side === 1, `a random hop whose far side is in a ring takes the near side (${r1?.side})`);
  const clearHop = makeBait([0, -40], T);
  assert.equal(startHop(clearHop, body, T, 'random', 4, null, [zone(300, 300)]).side, -1, 'with no ring about it hops to the far side as before');
  // both sides in rings: it waits (null), and a forced one goes on
  const both = [zone(0, 45), zone(0, -45)], w = makeBait([0, -40], T);
  w.zoneSide = 0;
  assert.equal(startHop(w, body, T, 'random', 4, null, [zone(0, 45), zone(0, -45)]), null, 'with a ring on each side a random hop waits');
  assert.equal(w.hop, null, '...and does not start');
  const t0 = makeBait([0, 100], T); t0.hopWait = 0;
  assert.equal(startHop(makeBait([0, -40], T), body, T, 'forced', 4, bound, both).why, 'forced', 'a forced hop goes on with a ring on each side');
  // in a ring in the middle of a hop: straight out at the flee speed
  const m = makeBait([0, 0], T); startHop(m, body, T, 'forced', 4, bound, null);
  const zz = [zone(5, 5)]; let speed = 0, ring = null, a2 = 4;
  for (let i = 0; i < 10 * 60 && ring === null; i++) { const was = m.pos.slice(); const r = hopBait(m, DT, body, T, { bound, alt: a2, base: 4, zones: zz }); if (!r) break; a2 = r.alt; speed = Math.max(speed, dist(m.pos, was) / DT); if (dist(m.pos, zz[0].at) >= RING) ring = i * DT; }
  assert.ok(ring !== null && ring <= RING / E.flee + 0.5 && speed <= E.flee + 1e-6, `in a ring mid-hop he flies out in ${ring?.toFixed(2)} s at most ${speed.toFixed(1)} m/s`);
}

// (4) THE PANIC cannot drive him into a ring: an arm behind him with the ring ahead, he backs off along the nearest way that leaves it clear
{
  const T = tuneOf(0), arm = { centre: [0, -300], velocity: [0, 0], radius: 15, contacts: [[0, -6]] }, z = [zone(0, 72)];
  const bare = makeBait([0, 0], T); let enters = false;
  for (let i = 0; i < 3 * 60; i++) { stepBait(bare, DT, arm, T); enters = enters || dist(bare.pos, z[0].at) < RING; }
  assert.ok(enters, 'without the ring the panic backs him straight into where it will be');
  const b = makeBait([0, 0], T); let min = Infinity, fled = false;
  for (let i = 0; i < 3 * 60; i++) { stepBait(b, DT, arm, T, z); fled = fled || b.fleeing; min = Math.min(min, dist(b.pos, z[0].at)); }
  assert.ok(fled && min >= RING - SLACK, `with it the panic leaves the ring clear: nearest ${min.toFixed(2)} m`);
  const p = planBait(makeBait([0, 0], T), arm, T, z);
  assert.ok(dist(p, z[0].at) >= RING, `...and the planner's panic point is clear of it (${p.map((v) => v.toFixed(1))})`);
  log.panic = min;
}

console.log(`Boss bait nuke zones: no zones, null, empty or far, the same ${log.same} frames bit for bit; across a ring ${RADIUS} + ${MARGIN} m his path never nearer than ${log.path.toFixed(2)} m to its centre (ring ${RING}); round the creature with the ring on his circle ${log.keep.toFixed(2)} m; in a ring at the release he is out of the ${RADIUS} m ring at worst ${log.out.toFixed(2)} s over (radius - dist) / flee (bound 0.5); a forced hop round a ring ${log.hopForced.toFixed(2)} m; the panic ${log.panic.toFixed(2)} m.`);
