// structure-print.mjs — a base structure prints as the sentries do (owner, 2026-11-05, round 5 notes 4 + 5; src/fx/structure-print.js): on the
// first tick of its print the shown tier's wire ghost (one shared wireframe material in the print colour, clipped) stands in the holder at full
// size, the solid tiers hidden, the plane at k of the tier's height; at k = 1 the shown tier comes back cut by its own rising plane while the wire
// fades over `skin` seconds; then the ghost is gone, the solid's own materials back. A piece set straight to 1 has no ghost; k = 0 hides it; the
// far tier's visibility is put back as the LOD left it.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createStructurePrints, printSpan } from '../src/fx/structure-print.js';
import { KIT } from '../src/content/base-layout.js';
import { ANTENNA_CLOSEUP, BASE_PROGRAMME } from '../src/content/base-programme.js';

const P = KIT.print;
assert.deepEqual({ colour: P.colour, opacity: P.opacity, skin: P.skin }, { colour: 0xbfe6ff, opacity: 0.85, skin: 0.8 }, 'the print beam\'s blue, the sentries\' opacity and skin');
// the radar's close-up holds past the skin: the cut's tail after the print's end is longer than the skin (src/fx/antenna-print.js dur)
assert.ok(ANTENNA_CLOSEUP.tail >= P.skin, `the close-up's tail ${ANTENNA_CLOSEUP.tail} s holds the ${P.skin} s skin`);

// a tier: a few boxes from y 0 to 12 in its own frame, offset in the holder as story-base mounts it
function tier(name, mat) { const g = new THREE.Group(); g.name = name; g.position.set(10.5, 0, 0); for (const y of [1, 6, 11]) { const m = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat); m.position.y = y; g.add(m); } return g; }
const solidMat = new THREE.MeshStandardMaterial({ color: 0x808080 });
function rec(withFar = true) {
  const holder = new THREE.Group(); holder.matrixAutoUpdate = false; holder.userData.placed = new THREE.Matrix4().makeScale(2, 2, 2); holder.matrix.copy(holder.userData.placed);
  const far = withFar ? tier('far', solidMat) : null, near = tier('near', solidMat);
  if (far) holder.add(far); holder.add(near); near.visible = !withFar;
  return { holder, far, near: withFar ? null : near, shown: 'far', spare: near };
}
let wall = 0; const lifts = [];
const lift = (holder, k) => { lifts.push(k); holder.visible = k > 0; holder.matrix.copy(holder.userData.placed).multiply(new THREE.Matrix4().makeScale(1, Math.max(0.02, Math.min(1, k)), 1)); };
const prints = createStructurePrints({ lift, print: { ...P, now: () => wall } });
const meshes = (o) => { const l = []; o.traverse((x) => { if (x.isMesh) l.push(x); }); return l; };

{
  const r = rec(), records = new Map([['radar', r]]);
  assert.deepEqual(printSpan(r.far), printSpan(r.far)); const span = printSpan(r.far); assert.ok(Math.abs(span.lo) < 1e-9 && Math.abs(span.hi - 12) < 1e-9, `the tier's height in its own frame (${JSON.stringify(span)})`);
  prints.at('radar', r, 0); assert.equal(r.holder.visible, false, 'k 0: hidden'); assert.equal(prints.holds('radar'), false, 'no ghost at 0');
  prints.at('radar', r, 0.25);
  const st = prints.state('radar', r); assert.deepEqual(st, { ghost: true, skinning: false, solid: false, k: 0.25 }, 'the first tick: a ghost, the solid hidden');
  assert.equal(lifts.at(-1), 1, 'the holder at its full size: no Y rise under the wire');
  const ghost = r.holder.children.find((c) => /print$/.test(c.name)); assert.ok(ghost, 'the ghost is a child of the holder');
  const gm = meshes(ghost), mats = new Set(gm.map((m) => m.material)); assert.equal(gm.length, 3); assert.equal(mats.size, 1, 'one shared material');
  const wire = [...mats][0]; assert.equal(wire.wireframe, true); assert.equal(wire.color.getHex(), P.colour); assert.equal(wire.depthWrite, false); assert.equal(wire.clippingPlanes.length, 1);
  assert.ok(gm.every((m) => m.geometry === r.far.children[gm.indexOf(m)].geometry), 'the ghost shares the tier\'s geometry');
  // the plane at k of the tier's height, in world units (holder scale 2): keeps what is below 0.25 x 12 x 2 = 6
  const plane = wire.clippingPlanes[0]; r.holder.updateMatrixWorld(true);
  assert.ok(Math.abs(plane.distanceToPoint(new THREE.Vector3(0, 6, 0))) < 1e-6 && plane.normal.y < 0, `the plane at 6 m (${plane.normal.toArray()}, ${plane.constant})`);
  prints.at('radar', r, 0.75); r.holder.updateMatrixWorld(true); assert.ok(Math.abs(plane.distanceToPoint(new THREE.Vector3(0, 18, 0))) < 1e-6, 'the plane climbs with the print');
  assert.equal(r.far.visible, false); assert.equal(r.spare.visible, false, 'both tiers stay hidden mid-print');
  // the end: the shown tier skins in, cut by its own plane, the wire fading
  prints.at('radar', r, 1);
  assert.deepEqual(prints.state('radar', r), { ghost: true, skinning: true, solid: true, k: 1 }, 'k 1: the skin');
  const fm = meshes(r.far); assert.ok(fm.every((m) => m.material !== solidMat && m.material.clippingPlanes?.length === 1), 'the solid drawn with clipped copies of its materials');
  prints.at('radar', r, 1); prints.tick(records); assert.equal(prints.holds('radar'), true, 'a second k 1 is harmless; the skin is still rising');
  wall = 0.4; prints.tick(records); assert.ok(wire.opacity < P.opacity && wire.opacity > 0, `the wire fades (${wire.opacity})`);
  wall = 0.81; prints.tick(records);
  assert.equal(prints.holds('radar'), false, 'the skin done: the print gone'); assert.equal(r.holder.children.includes(ghost), false, 'the ghost removed');
  assert.ok(fm.every((m) => m.material === solidMat), 'the solid\'s own materials back'); assert.equal(r.far.visible, true, 'the far tier shown, as the LOD left it'); assert.equal(r.spare.visible, false);
  assert.deepEqual(prints.state('radar', r), { ghost: false, skinning: false, solid: true, k: null });
}
{ // a replay from the floor (the antenna close-up's force()): k 0 drops a ghost mid-skin, puts the solid's materials back, hides the holder
  const r = rec(false), records = new Map([['radar', r]]); wall = 10;
  prints.at('radar', r, 0.5); assert.equal(r.near.visible, false, 'a near-only structure: its one tier hidden under the wire');
  prints.at('radar', r, 1); assert.equal(prints.state('radar', r).skinning, true);
  prints.at('radar', r, 0); assert.equal(prints.holds('radar'), false); assert.equal(r.holder.visible, false);
  assert.ok(meshes(r.near).every((m) => m.material === solidMat), 'the skin cut short: the solid\'s own materials back');
  prints.at('radar', r, 0.3); assert.equal(prints.state('radar', r).ghost, true, 'printed again: a new ghost'); prints.dispose(); assert.equal(prints.holds('radar'), false);
  assert.equal(r.holder.children.some((c) => /print$/.test(c.name)), false, 'dispose takes the ghost');
}
{ // set straight to 1 (a chapter skip, a grown base): no ghost, it just stands
  const r = rec(); lifts.length = 0; prints.at('garage', r, 1); assert.equal(prints.holds('garage'), false); assert.deepEqual(lifts, [1]); assert.equal(r.far.visible, true);
}
// every structure the programme prints has a tier to copy (an asset), so no structure falls back to the Y rise
const { STRUCTURES } = await import('../src/content/base-layout.js');
for (const st of BASE_PROGRAMME.flatMap((s) => s.structures)) assert.ok(STRUCTURES.find((x) => x.id === st)?.asset, `${st} has a model`);
console.log('structure-print: the wire first, clipped up from the plot with the print; the skin over it at the end; no ghost for a skip; a replay starts over');
