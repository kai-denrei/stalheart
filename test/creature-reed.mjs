import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// THE NIH-DAIRIA FAMILY'S BODIES (src/fx/creature-reed.js) on the real kit and cage, in Node: made a batch a frame once the cage is in, a body
// in a frame of its own following its record across re-anchors, drawn on the sphere under it whatever the bodies' root's transform, re-placed
// past the leash, the v1 death (collapse, then sink and fade, then gone), the 120 Hz switch, the budget's slow-down (off for the probe)
const root = new URL('../', import.meta.url);
globalThis.document ??= { baseURI: root.href };
const realFetch = globalThis.fetch;
globalThis.fetch = async (u) => {
  const url = new URL(u);
  if (url.protocol !== 'file:') return realFetch(u);
  const b = readFileSync(url);
  return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), json: async () => JSON.parse(b.toString('utf8')) };
};
const THREE = await import('../vendor/three.module.js');
const { createReedFamily } = await import('../src/fx/creature-reed.js');
const { CREATURE_TIERS, CREATURE_FOLLOW, CREATURE_REED } = await import('../src/content/creature-enemies.js');
const { surfaceFrame, fromPlane, toPlane } = await import('../src/domain/surface-projection.js');

const R = 753, f0 = surfaceFrame([0.3, 0.9, 0.1]), tick = () => new Promise((r) => setTimeout(r, 5));
// the bodies' root as the seam places it: on the heart's point, turned to its frame, one unit a metre
const scene = new THREE.Scene(), parent = new THREE.Group();
scene.add(parent);
parent.position.fromArray(f0.origin);
parent.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f0.ex), new THREE.Vector3(...f0.ey), new THREE.Vector3(...f0.ez)));
parent.scale.setScalar(1 / R);
const tiers = CREATURE_TIERS.reed, fam = createReedFamily({ parent, tiers, follow: CREATURE_FOLLOW, budget: null });
fam.setPlanet(R);
const at = (x, z) => fromPlane(f0, x, z, R);
const near = (v, x, z) => { const c = toPlane(f0, v.point, R); return Math.hypot(c[0] - x, c[1] - z); };

// made a batch a frame, once the cage is in
const recs = [0, 1, 2, 3].map((i) => ({ x: 40 * i, z: 0 }));
const hs = recs.map((r) => fam.add('small', { pos: at(r.x, r.z), apos: at(r.x, r.z + 9), lift: 0 }));
assert.ok(hs.every(Boolean)); assert.equal(fam.view(hs[0]).made, false, 'not made before a frame');
assert.equal(near(fam.view(hs[0]), 0, 0) < 1e-3, true, 'a body being made is its record');
for (let k = 0; k < 40 && !fam.stats().small.made; k++) { fam.step(1 / 60); await tick(); }
await tick();
assert.equal(fam.stats().small.made, CREATURE_REED.batch, `a batch a frame (${JSON.stringify(fam.stats().small)})`);
fam.step(1 / 60); await tick();
assert.equal(fam.stats().small.made, 4); assert.equal(fam.stats().small.live, 4); assert.equal(fam.stats().small.variant, 'reed');

// it follows its record across re-anchors: 6 s at the tier's walk (cells a second x the sector's pace 1.5 x 10 m)
const v = tiers.small.speed * 1.5 * 10;
for (let fr = 0; fr < 360; fr++) {
  recs.forEach((r, i) => { r.z += v / 60; fam.track(hs[i], { pos: at(r.x, r.z), apos: at(r.x, r.z + v * CREATURE_FOLLOW.lead), lift: 0, dt: 1 / 60 }); });
  fam.step(1 / 60);
}
const s1 = fam.stats().small;
assert.ok(s1.reanchors >= 4, `the frames moved under the walking bodies (${s1.reanchors})`); assert.equal(s1.errors, 0, s1.lastError);
for (let i = 0; i < 4; i++) { const d = near(fam.view(hs[i]), recs[i].x, recs[i].z); assert.ok(d < 10, `body ${i} ${d.toFixed(1)} m from its record after ${recs[i].z.toFixed(0)} m`); }
assert.ok(s1.bodyMs > 0 && s1.hz === 240 && s1.budget === null && s1.timeScale === 1);

// drawn on the sphere under its centre: the outer group's world position is the body's unit point, whatever the root's transform
scene.updateMatrixWorld(true);
const outer = fam.roots()[0].children[0], w = new THREE.Vector3().setFromMatrixPosition(outer.matrixWorld), p = fam.view(hs[0]).point;
assert.ok(w.distanceTo(new THREE.Vector3(...p)) < 1e-9, 'the outer group sits on the body\'s sphere point');
assert.ok(Math.abs(w.length() - 1) < 1e-9, 'on the unit sphere');
const sc = new THREE.Vector3().setFromMatrixScale(outer.matrixWorld).x, s = 4 / 0.18;
assert.ok(Math.abs(sc * R / s - 1) < 0.05, `a native unit is ~${s.toFixed(1)} m (${(sc * R).toFixed(1)})`);

// past twice the leash at once: re-placed on the record
recs[0].x += 3 * Math.max(CREATURE_FOLLOW.leashRadii * tiers.small.r0, CREATURE_FOLLOW.leashMin);
assert.equal(fam.track(hs[0], { pos: at(recs[0].x, recs[0].z), apos: at(recs[0].x, recs[0].z + 9), lift: 0, dt: 1 / 60 }), true, 're-placed');
assert.ok(near(fam.view(hs[0]), recs[0].x, recs[0].z) < 1, 'on its record');
assert.equal(fam.stats().small.replaced, 1);
// the record's lift lowers the drawing (rising out of a breach)
fam.track(hs[1], { pos: at(recs[1].x, recs[1].z), apos: at(recs[1].x, recs[1].z + 9), lift: -6, dt: 1 / 60 }); fam.step(1 / 60);
assert.ok(fam.roots()[0].children[1].children[0].position.y * s < -5, 'six metres under');

// the v1 death: motion off, the gravity up, collapse; then sink and fade, and gone
fam.kill(hs[2]);
let vw = fam.view(hs[2]); assert.ok(vw.dead && !vw.active && vw.made); assert.equal(fam.stats().small.live, 3); assert.equal(fam.stats().small.deaths, 1);
for (let fr = 0; fr < 60 * CREATURE_REED.collapse + 30; fr++) fam.step(1 / 60);
vw = fam.view(hs[2]); assert.ok(vw.deflate === 1 && vw.opacity < 1 && vw.opacity > 0, `fading ${JSON.stringify(vw)}`);
for (let fr = 0; fr < 60 * CREATURE_REED.fade; fr++) fam.step(1 / 60);
assert.equal(fam.view(hs[2]).gone, true, 'gone after the fade'); assert.equal(fam.stats().small.made, 3);
// free: gone at once; a body still being made killed has nothing to die
fam.free(hs[3]); assert.equal(fam.view(hs[3]).gone, true); assert.equal(fam.stats().small.live, 2);
const late = fam.add('small', { pos: at(0, 0), apos: at(0, 9) }); fam.kill(late);
assert.equal(fam.view(late).gone, true); assert.equal(fam.stats().small.pending, 0);

// the 120 Hz switch above `coarse.above` (the huge tier stays at the kit's 240), and the budget's slow-down outside the probe
const many = Array.from({ length: CREATURE_REED.coarse.above }, (_, i) => fam.add('small', { pos: at(-100, 10 * i), apos: at(-90, 10 * i) }));
for (let k = 0; k < 20 && fam.stats().small.pending; k++) { fam.step(1 / 60); await tick(); }
fam.step(1 / 60);
assert.equal(fam.stats().small.hz, CREATURE_REED.coarse.hz, `${fam.stats().small.made} up`);
const big = fam.add('huge', { pos: at(300, 0), apos: at(300, 20) });
for (let k = 0; k < 40 && !fam.view(big).made; k++) { fam.step(1 / 60); await tick(); }
fam.step(1 / 60);
assert.equal(fam.view(big).variant, 'nih-dairia'); assert.equal(fam.stats().huge.hz, 240, 'the Nih-Dairia at the kit\'s own step');
for (const h of [...many, big, hs[0], hs[1]]) fam.free(h);
fam.dispose(); assert.equal(parent.children.length, 0, 'disposed');

const tight = createReedFamily({ parent, tiers, follow: CREATURE_FOLLOW, budget: 0.5 });
tight.setPlanet(R);
const two = [0, 1].map((i) => tight.add('big', { pos: at(20 * i, 0), apos: at(20 * i, 9) }));
for (let k = 0; k < 40 && tight.stats().big.made < 2; k++) { tight.step(1 / 60); await tick(); }
for (let k = 0; k < 10; k++) tight.step(1 / 60);
assert.ok(tight.stats().big.timeScale < 1 && tight.stats().big.budget === 0.5, `the budget slows the bodies (${tight.stats().big.timeScale})`);
two.forEach((h) => tight.free(h)); tight.dispose();
globalThis.fetch = realFetch;
console.log('Creature Reeds: made a batch a frame, each in a frame of its own following its record across re-anchors, drawn on the sphere, re-placed past the leash, the v1 death, 120 Hz when many, the budget.');
