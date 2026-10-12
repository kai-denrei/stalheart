// cutis-hits.mjs — the Cutis-Maku's hittable shape and the phase's damage (owner, 2026-10-12: "the reach is its weak spot"; src/domain/cutis-hits.js).
// The multiplier at every phase and its boundaries, the shape (stalk and cup only in EXTEND and ANCHOR, the tip by the shader's seeking), the distance to it, a landing
// and a stream by the multiplier, the absorbed flag, the floor contacts (the cup only while gripping) and the reach nodes.
import assert from 'node:assert/strict';
import { phaseMultiplier, shapeOf, hitDistance, cutisDamage, contactsOf, reachNodes } from '../src/domain/cutis-hits.js';
import { splashDamage } from '../src/domain/gunship.js';
import { CUTIS_HITS } from '../src/content/cutis-maku.js';

const M = { reach: 1, rest: 0.5, transfer: 0 };
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);
const view = (phase, o = {}) => ({ centre: [0, 0], radius: 2, phase, idle: false, from: [0, 0], anchor: [20, 0], ...o });

// the multipliers: COIL, EXTEND, ANCHOR full; TRANSFER none; SETTLE and REST half; the boundaries belong to the phase they start
for (const p of [0, 0.05, 0.0999, 0.1, 0.3, 0.5499, 0.55, 0.6, 0.6199]) assert.equal(phaseMultiplier(p, false, M), 1, `reach at ${p}`);
for (const p of [0.62, 0.7, 0.8499]) assert.equal(phaseMultiplier(p, false, M), 0, `transfer at ${p}`);
for (const p of [0.85, 0.9, 0.9999, 1]) assert.equal(phaseMultiplier(p, false, M), 0.5, `settle at ${p}`);
for (const p of [0, 0.3, 0.7, 0.95]) assert.equal(phaseMultiplier(p, true, M), 0.5, `rest (idle) at ${p}`);
assert.equal(phaseMultiplier(0.7, false, { reach: 3, rest: 7, transfer: 5 }), 5, 'the knobs are read');
assert.equal(phaseMultiplier(0.2, false, { reach: 3, rest: 7, transfer: 5 }), 3);
assert.equal(phaseMultiplier(0.9, false, { reach: 3, rest: 7, transfer: 5 }), 7);
assert.deepEqual([phaseMultiplier(0.2, false, CUTIS_HITS), phaseMultiplier(0.7, false, CUTIS_HITS), phaseMultiplier(0.9, false, CUTIS_HITS)], [1, 0, 0.5], 'the content is the owner\'s rule');

// the shape: no stalk and no cup in COIL, TRANSFER, SETTLE or at REST; both in EXTEND and ANCHOR
for (const [p, idle] of [[0, false], [0.0999, false], [0.62, false], [0.7, false], [0.85, false], [0.99, false], [0.3, true], [0.58, true]]) {
  const s = shapeOf(view(p, { idle }));
  assert.equal(s.stalk, null, `no stalk at ${p} idle ${idle}`);
  assert.equal(s.cup, null, `no cup at ${p} idle ${idle}`);
  assert.deepEqual(s.centre, [0, 0]); assert.equal(s.radius, 2);
}
// EXTEND: the tip runs from `from` toward the anchor by clamp((phase - .10) / .45); ANCHOR: at the anchor
let s = shapeOf(view(0.1)); assert.deepEqual(s.stalk, { from: [0, 0], to: [0, 0] }); assert.deepEqual(s.cup, [0, 0]);
s = shapeOf(view(0.325)); near(s.cup[0], 10); near(s.cup[1], 0); assert.deepEqual(s.stalk.to, s.cup); assert.deepEqual(s.stalk.from, [0, 0]);
s = shapeOf(view(0.5499)); assert.ok(s.cup[0] > 19.9 && s.cup[0] < 20);
for (const p of [0.55, 0.6, 0.6199]) { s = shapeOf(view(p)); assert.deepEqual(s.cup, [20, 0], `cup at the anchor at ${p}`); assert.deepEqual(s.stalk, { from: [0, 0], to: [20, 0] }); }
s = shapeOf(view(0.325, { from: [5, 5], anchor: [5, 25], centre: [5, 5] })); near(s.cup[0], 5); near(s.cup[1], 15);
// the snapshot is not aliased
const v0 = view(0.6); s = shapeOf(v0); s.cup[0] = 99; s.centre[0] = 99; assert.deepEqual(v0.anchor, [20, 0]); assert.deepEqual(v0.centre, [0, 0]);

// the distance: 0 inside the disc (and on its rim), the gap outside it
const body = shapeOf(view(0.9));
assert.equal(hitDistance(body, [0, 0]), 0); assert.equal(hitDistance(body, [1.5, 0]), 0); assert.equal(hitDistance(body, [2, 0]), 0);
near(hitDistance(body, [5, 0]), 3); near(hitDistance(body, [0, -7]), 5); near(hitDistance(body, [3, 4]), 3);
assert.equal(hitDistance(body, [20, 0]), 3 + 15, 'no cup at SETTLE: the anchor is 18 m from the rim');
// on the stalk (ANCHOR: the segment 0..20 along x): a point beside it is its perpendicular distance, past its end the distance to the cup's disc
const grip = shapeOf(view(0.6));
near(hitDistance(grip, [10, 3]), 3, 1e-9);
assert.equal(hitDistance(grip, [10, 0]), 0, 'on the stalk');
near(hitDistance(grip, [10, -4]), 4);
// at the cup: a disc of 0.6 x radius (1.2 m) round the anchor; 0 inside it, the gap outside
assert.equal(hitDistance(grip, [20, 0]), 0); assert.equal(hitDistance(grip, [20, 1]), 0);
near(hitDistance(grip, [21.2 + 2, 0]), 2);
// 5 m off the anchor: the segment ends there, so the cup's disc edge (5 - 1.2 = 3.8 m) is the nearer
near(hitDistance(grip, [20, 5]), 3.8);
// during EXTEND the cup sits partway: the anchor itself is out of reach
const ext = shapeOf(view(0.325));
near(hitDistance(ext, [10, 0]), 0); assert.ok(hitDistance(ext, [20, 0]) > 8);
// a zero-length stalk (phase .1) does not break
assert.equal(hitDistance(shapeOf(view(0.1)), [5, 0]), 3);

// damage: a landing is splashDamage x m, in every phase
const land = { at: [3, 0], radius: 10, damage: 40, moving: false };
const d0 = splashDamage(hitDistance(shapeOf(view(0.2)), land.at), land.radius, land.damage);
assert.ok(d0 > 0);
for (const [p, idle, m] of [[0.05, false, 1], [0.3, false, 1], [0.58, false, 1], [0.7, false, 0], [0.9, false, 0.5], [0.3, true, 0.5]]) {
  const v = view(p, { idle }), r = cutisDamage(land, 0.016, v, M);
  near(r.damage, splashDamage(hitDistance(shapeOf(v), land.at), land.radius, land.damage) * m, 1e-9);
}
near(cutisDamage(land, 0.016, view(0.9), M).damage, splashDamage(1, 10, 40) * 0.5, 1e-9);   // SETTLE: the body's rim is 1 m from the landing
// a landing outside the ring does nothing, and is not "absorbed" either
let r = cutisDamage({ at: [100, 0], radius: 10, damage: 40, moving: false }, 0.016, view(0.7), M); assert.deepEqual(r, { damage: 0, absorbed: false });
// the reach: a landing at the cup hurts at ANCHOR, but at the same spot in SETTLE (no cup) it is far from the body
const atCup = { at: [20, 0], radius: 5, damage: 30, moving: false };
near(cutisDamage(atCup, 0, view(0.6), M).damage, 30); assert.equal(cutisDamage(atCup, 0, view(0.9), M).damage, 0);
// a stream: damage x dt while the shape is inside the ring, times m
const stream = { at: [5, 0], radius: 4, damage: 6.6, moving: true };
near(cutisDamage(stream, 0.5, view(0.2), M).damage, 3.3);
near(cutisDamage(stream, 0.5, view(0.9), M).damage, 1.65);
assert.deepEqual(cutisDamage(stream, 0.5, view(0.7), M), { damage: 0, absorbed: true });
assert.equal(cutisDamage({ ...stream, at: [30, 0] }, 0.5, view(0.2), M).damage, 0, 'outside the ring');
assert.equal(cutisDamage({ ...stream, at: [30, 0] }, 0.5, view(0.7), M).absorbed, false, 'out of reach in TRANSFER is not absorbed');
// the ring's edge: d = radius is outside (strict), as the fight's burn
assert.equal(cutisDamage({ at: [6, 0], radius: 4, damage: 6.6, moving: true }, 1, view(0.9), M).damage, 0);

// absorbed: true only when the multiplier is 0 and the round would have hit
for (const p of [0, 0.3, 0.6, 0.9, 1]) for (const idle of [false, true]) assert.equal(cutisDamage(land, 0.016, view(p, { idle }), M).absorbed, false, `not absorbed at ${p} idle ${idle}`);
for (const p of [0.62, 0.75, 0.8499]) { r = cutisDamage(land, 0.016, view(p), M); assert.deepEqual(r, { damage: 0, absorbed: true }, `absorbed at ${p}`); }
assert.equal(cutisDamage(land, 0.016, view(0.75), { reach: 1, rest: 0.5, transfer: 0.25 }).absorbed, false, 'a transfer knob above 0 absorbs nothing');
near(cutisDamage(land, 0.016, view(0.75), { reach: 1, rest: 0.5, transfer: 0.25 }).damage, splashDamage(1, 10, 40) * 0.25);
assert.equal(cutisDamage(land, 0.016, view(0.2), { reach: 0, rest: 0.5, transfer: 0 }).absorbed, true, 'any zero multiplier absorbs');

// the contacts: n rim points on the radius round the centre; the cup only while gripping (ANCHOR and TRANSFER)
const ring = (cs, c, rad) => cs.every((p) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - rad) < 1e-9);
let cs = contactsOf(view(0.9, { centre: [3, -4] })); assert.equal(cs.length, 8); assert.ok(ring(cs, [3, -4], 2));
assert.equal(contactsOf(view(0.9), 5).length, 5); assert.equal(contactsOf(view(0.9), 16).length, 16);
for (const [p, idle, n] of [[0, false, 8], [0.3, false, 8], [0.5499, false, 8], [0.55, false, 9], [0.6, false, 9], [0.7, false, 9], [0.8499, false, 9], [0.85, false, 8], [0.95, false, 8], [0.7, true, 8]]) {
  cs = contactsOf(view(p, { idle })); assert.equal(cs.length, n, `contacts at ${p} idle ${idle}`);
  if (n === 9) assert.deepEqual(cs[8], [20, 0], 'the cup point is the anchor');
}
// distinct rim points
assert.equal(new Set(contactsOf(view(0.9)).map((p) => p.join())).size, 8);

// the reach nodes: the centre at the height of its radius, then n points on the ring of `reach` at height 0
let ns = reachNodes(view(0.3, { centre: [1, 2] }), 22);
assert.equal(ns.length, 13); assert.deepEqual(ns[0], [1, 2, 2]);
for (const p of ns.slice(1)) { near(Math.hypot(p[0] - 1, p[1] - 2), 22); assert.equal(p[2], 0); }
assert.equal(reachNodes(view(0.3), 10, 6).length, 7);
assert.equal(new Set(ns.map((p) => p.join())).size, 13);

console.log('cutis-hits: the phase multipliers, the shape, the distance, landings and streams, absorbed, contacts and nodes ok');
