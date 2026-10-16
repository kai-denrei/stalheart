// hull-bodies.mjs — round four of the Pearl set (owner, 2026-10-13: "Cutis collision with Tank; though they are mostly membrane, the tank should never be
// able to 'go through' the enemy, they are still made of mass. more precise collision is needed"; spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md,
// "Round 4"): the hull's box against a body's outline (src/domain/hull-bodies.js), the speed a body's mass takes, and the family's contact pass
// (src/fx/creature-pearl.js hullContact): a hull driven into a soft body shoves it clear, into a cored one is pushed back, and is never inside either.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { boxContact, contactLoss, stepDrag } from '../src/domain/hull-bodies.js';
import { PEARL_TIERS, PEARL_FOLLOW, PEARL_PACE, PEARL_IMPACT, PEARL_GAIT } from '../src/content/pearl-enemies.js';
import { CREATURE_FOLLOW, CREATURE_DEATH } from '../src/content/creature-enemies.js';
import { createPearlFamily } from '../src/fx/creature-pearl.js';
import { PEARL_BODIES } from '../src/fx/creature-enemies.js';

let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const disc = (cx, cz, r, n = 64) => { const xs = new Float64Array(n), zs = new Float64Array(n); for (let k = 0; k < n; k++) { xs[k] = cx + r * Math.cos((k * 2 * Math.PI) / n); zs[k] = cz + r * Math.sin((k * 2 * Math.PI) / n); } return [xs, zs, n]; };
// the exact depth of a disc in a box: the disc's radius less the centre's distance from the box (outside), more its distance to the nearest face (inside)
const exact = (box, cx, cz, r) => { const dx = cx - box.x, dz = cz - box.z, u = dx * box.ux + dz * box.uz, v = -dx * box.uz + dz * box.ux, ou = Math.abs(u) - box.hl, ov = Math.abs(v) - box.hw;
  if (ou <= 0 && ov <= 0) return r - Math.max(ou, ov); return r - Math.hypot(Math.max(0, ou), Math.max(0, ov)); };

// ---- the box against an outline ----
{
  const out = [0, 0, 0];
  for (const a of [0, 0.4, 1.3, 2.7]) {
    const box = { x: 1, z: -2, ux: Math.cos(a), uz: Math.sin(a), hl: 3.5, hw: 2 };
    let seen = 0;
    for (let n = 0; n < 400; n++) {
      const cx = box.x + (rnd() - 0.5) * 16, cz = box.z + (rnd() - 0.5) * 16, r = 1 + rnd() * 3, want = exact(box, cx, cz, r);
      boxContact(box, ...disc(cx, cz, r), out);
      if (want <= 0) { assert(out[0] <= 0.02 * r + 1e-9, `apart: no depth (${out[0]} for ${want})`); continue; }
      seen++;
      assert(out[0] >= want - 0.03 * r - 1e-9 && out[0] <= want + 0.03 * r + 0.35 * r * (out[0] > box.hw ? 1 : 0.2), `the depth (${out[0]} against ${want})`);
      // moved by the answer, the disc is clear of the box
      assert(exact(box, cx + out[1] * out[0], cz + out[2] * out[0], r) <= 0.03 * r + 1e-6, 'the move clears it');
    }
    assert(seen > 50);
  }
  // head-on along the box's axis: the move is straight ahead
  const box = { x: 0, z: 0, ux: 1, uz: 0, hl: 3, hw: 2 };
  boxContact(box, ...disc(4.5, 0, 2), out); close(out[0], 0.5, 0.02, 'head-on depth'); close(out[1], 1, 1e-9, 'pushed ahead'); close(out[2], 0, 1e-9, 'not aside');
  boxContact(box, ...disc(4, 2.8, 2), out); assert(out[0] > 0 && out[1] > 0.5 && out[2] > 0.5, 'off the corner: the move is aside as well as ahead');
}
console.log('PASS boxContact: the box against a body\'s outline, the depth within 3 % of exact, the move clears it, head-on straight ahead');

// ---- the speed a body takes ----
{
  const K = PEARL_IMPACT.contact;
  close(contactLoss(K.refRadius, K), K.loss, 1e-12, 'a reference body'); close(contactLoss(K.refRadius * 2, K), Math.min(K.maxLoss, K.loss * 4), 1e-12, 'mass as the radius squared');
  assert.equal(contactLoss(K.refRadius * 10, K), K.maxLoss, 'capped');
  close(stepDrag(0.5, K.recover, K), 0.5 / Math.E, 1e-12, 'recovering'); assert.equal(stepDrag(0.5, 0, K), 0.5);
}
console.log('PASS the speed a body\'s mass takes, recovering');

// ---- the family's pass: a hull driven through a soft amoeba and into a cored drifter ----
{
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT, pace: PEARL_PACE, gait: PEARL_GAIT });
  const soft = fam.add('amoeba', { x: 12, z: 0.5, angle: Math.PI, speed: 2 }), cored = fam.add('drifter', { x: 60, z: -0.5, angle: Math.PI, speed: 2 });
  for (let f = 0; f < 30; f++) { fam.track(soft, { x: 12, z: 0.5, dt: 1 / 60, speed: 2 }); fam.track(cored, { x: 60, z: -0.5, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  const box = { x: 0, z: 0, ux: 1, uz: 0, hl: 3.6, hw: 2.2 }, boxOf = () => box;
  const touches = [], pushes = [];
  const sink = { push: (hub, dx, dz) => pushes.push([dx, dz]), touch: (h, c, r) => touches.push([h === soft ? 'soft' : 'cored', c, r]), depth: () => {} };
  let worst = 0, stoppedAt = null, softMoved = 0;
  const s0 = fam.view(soft).centre;
  for (let f = 0; f < 600; f++) {
    // the drive: the hull's next position, the contact pass on it, what it pushes back taken; the bodies step; then the settle pass
    box.x += 0.12; pushes.length = 0;
    fam.hullContact(boxOf, true, sink);
    for (const [dx, dz] of pushes) { box.x += dx; box.z += dz; }
    if (pushes.length && stoppedAt === null) stoppedAt = box.x;
    fam.track(soft, { x: 12, z: 0.5, dt: 1 / 60, speed: 2 }); fam.track(cored, { x: 60, z: -0.5, dt: 1 / 60, speed: 2 });
    fam.step(1 / 60);
    fam.hullContact(boxOf, false, sink);
    let deepest = 0; fam.hullContact(boxOf, null, { depth: (h, d) => { deepest = Math.max(deepest, d); } });
    worst = Math.max(worst, deepest);
  }
  softMoved = Math.hypot(fam.view(soft).centre[0] - s0[0], fam.view(soft).centre[1] - s0[1]);
  assert(worst < 0.1, `the hull is never inside a body (${worst} m)`);
  assert(touches.some((t) => t[0] === 'soft' && !t[1]) && touches.some((t) => t[0] === 'cored' && t[1]), `both touched (${JSON.stringify(touches.slice(0, 3))})`);
  assert(softMoved > 1.5, `the soft body was shoved out of the way (${softMoved.toFixed(1)} m)`);   // 1.5 (was 3): a blob keeps a spread of its own off its line (2026-10-16), so it starts partly aside and is shoved less; never inside it stays the rule above
  assert(stoppedAt !== null && box.x < 60, `the cored body stopped the hull (${stoppedAt?.toFixed(1)}, now ${box.x.toFixed(1)})`);
  const cv = fam.view(cored); assert(box.x + box.hl < cv.centre[0], 'the hull stands before the cored body, not through it');
  assert(fam.stats().white.shoved > 0, 'the soft body booked as shoved');
}
console.log('PASS the family\'s contact: a hull driven through a soft amoeba shoves it clear, a cored drifter stops it and pushes it back; never inside either');

// ---- the drive's own pace: a hull at 28 m/s (0.47 m a 60 Hz frame) meeting a cored drifter, in the game's frame order ----
// (--pearl-story, 2026-10-13: the hull's first frames against a cored drifter ended 0.26-0.68 m inside it.) Each frame: the drive's pass at the hull's
// next place, the touch recoiling a cored body as src/fx/creature-enemies.js's sink does (the recoil snaps its hop: the body reshaped after its depth was
// taken), the pushes taken; the bodies step; the pass after the step. The hull is measured after its drive and at the frame's end: never inside.
{
  const K = PEARL_IMPACT.contact;
  let afterDrive = 0, atEnd = 0, met = 0;
  for (let trial = 0; trial < 12; trial++) {
    const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT, pace: PEARL_PACE, gait: PEARL_GAIT });
    const x0 = 20 + trial * 0.37, z0 = ((trial % 5) - 2) * 0.6, d = fam.add('drifter', { x: x0, z: z0, angle: Math.PI, speed: 2 });
    for (let f = 0; f < 30 + trial; f++) { fam.track(d, { x: x0, z: z0, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }   // caught at a different point of its hop
    const box = { x: 0, z: 0, ux: 1, uz: 0, hl: 4.4, hw: 2.19 }, boxOf = () => box, pushes = [];
    const sink = { push: (hub, dx, dz) => pushes.push(dx, dz), touch: (h, cored) => { if (cored && !h.recoiled) { h.recoiled = true; met++; fam.recoil(h, { dx: 1, dz: 0 }); } }, depth: () => {} };
    const take = () => { for (let k = 0; k < pushes.length; k += 2) { box.x += pushes[k]; box.z += pushes[k + 1]; } pushes.length = 0; };
    const inside = () => { let m = 0; fam.hullContact(boxOf, null, { depth: (h, x) => { m = Math.max(m, x); } }); return m; };
    for (let f = 0; f < 90; f++) {
      box.x += 28 / 60;   // W held: the hull presses on at 28 m/s
      fam.hullContact(boxOf, true, sink); take();
      afterDrive = Math.max(afterDrive, inside());
      fam.track(d, { x: x0, z: z0, dt: 1 / 60, speed: 2 }); fam.step(1 / 60);
      fam.hullContact(boxOf, false, sink); take();
      atEnd = Math.max(atEnd, inside());
    }
  }
  assert.equal(met, 12, 'the hull met the drifter every time');
  assert(afterDrive <= K.slop + 0.01, `after the drive's pass the hull is not inside the drifter (${afterDrive.toFixed(3)} m)`);
  assert(atEnd <= K.slop + 0.01, `nor at the frame's end (${atEnd.toFixed(3)} m)`);
}
console.log('PASS a hull at 28 m/s meeting a cored drifter: never inside it, after its drive or at the frame\'s end (the recoil\'s reshaped body shoved on)');

// ---- the light tiers (owner, 2026-10-13: "white and yellow, should feel very easy to run over. The threat starts like more of an annoyance.") ----
{
  const T = PEARL_IMPACT.tiers;
  for (const id of ['white', 'yellow']) { assert(T[id].mass <= 0.1 && T[id].pad > 0 && T[id].ram && T[id].jolt < 0.5, `${id}: light (${JSON.stringify(T[id])})`); assert(contactLoss(2.8, PEARL_IMPACT.contact) * T[id].mass < 0.02, `${id}: the hull loses almost nothing`); }
  for (const id of ['orange', 'green', 'purple', 'brown', 'black']) assert(!T[id], `${id} keeps its weight`);
  assert(PEARL_IMPACT.tiers.white.stagger.squash > PEARL_IMPACT.stagger.squash, 'a deeper squash for a run-over white');
  // a hull just short of a white body (within its pad) books a hit; the same gap to a cored drifter does not
  const fam = createPearlFamily({ parent: new THREE.Group(), tiers: PEARL_BODIES, follow: CREATURE_FOLLOW, death: CREATURE_DEATH, set: PEARL_TIERS, tune: PEARL_FOLLOW, impact: PEARL_IMPACT, pace: PEARL_PACE, gait: PEARL_GAIT });
  const w = fam.add('amoeba', { x: 0, z: 0, angle: 0, speed: 2 }), d = fam.add('drifter', { x: 100, z: 0, angle: 0, speed: 2 });
  for (let f = 0; f < 10; f++) { fam.track(w, { x: 0, z: 0, dt: 1 / 60, speed: 2 }); fam.track(d, { x: 100, z: 0, dt: 1 / 60, speed: 2 }); fam.step(1 / 60); }
  const hits = [], sink = { push() {}, touch: (h, c, r, tier) => hits.push(tier), depth: () => {} };
  // the hull's front just outside each body's outline (found by sliding it in until the measure first reads an overlap, then backing off 0.3 m)
  for (const [h, cx] of [[w, 0], [d, 100]]) {
    const box = { x: cx - 20, z: 0, ux: 1, uz: 0, hl: 3.6, hw: 2.2 };
    let over = 0; while (over <= 0 && box.x < cx) { box.x += 0.05; over = 0; fam.hullContact(() => box, null, { depth: (hh, dd) => { if (hh === h) over = dd; } }); }
    box.x -= 0.3; fam.hullContact(() => box, true, sink);
  }
  assert.deepEqual(hits, ['white'], `a near miss within the pad is a hit for the white tier only (${hits})`);
}
console.log('PASS the light tiers: white and yellow cost the hull almost no speed, a brush within their pad is a hit (the game\'s ram), a light jolt and a deeper squash; the cored tiers keep their weight');
