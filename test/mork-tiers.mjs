// The MÖRK review tiers, pinned at 771e166 (docs/hover-tank-tiers-assets.lock.json).
//
// Deliberately does not import units.js: these hold mork.js's contract with the
// assets themselves, which is what a tier swap would stand on. The shipped hull
// is test/mork.mjs; this is the two tiers that would sit either side of it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { prepareMork, makeMork, prepareMorkProxy, makeMorkProxy, MORK_TIERS, MORK_PROXY } from '../src/mork.js';
import { applyTankFeel } from '../src/tankfeel.js';

// prepare* mutates the scene it is given (merge, fit), so every use parses fresh
const parse = async (rel) => {
  const b = readFileSync(new URL(`../${rel}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const clipNames = (g) => g.animations.map((a) => a.name).sort();

test('the LOW tier prepares through the one prepareMork, to the measured budget', async () => {
  const g = await parse(MORK_TIERS.low);
  const source = prepareMork(g.scene, g.animations);
  // Same scope as test/mork.mjs's 24,196: rendered meshes after merge and fit.
  // A GLB accessor parse reports 5,208 — unique geometry, a different number.
  assert.equal(source.stats.triangles, 6742);
  assert.equal(source.stats.batches, 49);
});

test('LOW drives every clip the shipped hull drives', async () => {
  const [game, low] = await Promise.all([parse(MORK_TIERS.game), parse(MORK_TIERS.low)]);
  assert.deepEqual(clipNames(low), clipNames(game));
  const a = makeMork(prepareMork(low.scene, low.animations));
  for (const clip of low.animations) for (const track of clip.tracks)
    assert(a.getObjectByName(THREE.PropertyBinding.parseTrackName(track.name).nodeName), track.name);
});

test('LOW keeps the rig the game reaches into', async () => {
  const g = await parse(MORK_TIERS.low);
  const a = makeMork(prepareMork(g.scene, g.animations));
  const heat = a.userData.heatSleeve;
  assert(heat?.isMesh && heat.material.isMeshBasicMaterial, 'the heat sleeve survives');
  assert.equal(heat.name, 'Long_cannon_barrel');
  assert.equal(heat.material.color.getHex(), 0x232833);
  assert.equal(a.userData.laserGuns.length, 2);
  assert(a.userData.muzzle.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite));
  assert(a.getObjectByName('AMMO_PORT_LIGHT_08'), 'the ninth ammo lens is there');
  const feel = { t: 0, hoverT: 0, recoil: 0 };
  applyTankFeel(a, { ...feel, t: 2, hoverT: 1 });
  assert(a.getObjectByName('HOVER_RIG').position.y > 0.5, 'it lifts');
  applyTankFeel(a, { ...feel, t: 3, hoverT: 1, recoil: 0.2 });
  applyTankFeel(a, { ...feel, t: 3.1, hoverT: 1, recoil: 0.1 });
  assert(a.getObjectByName('GUN_RECOIL').position.z < -0.7, 'it recoils');
  a.userData.dispose();
});

test('the distance proxy is static and one draw', async () => {
  const g = await parse(MORK_PROXY);
  assert.equal(g.animations.length, 0, 'no clips');
  const p = prepareMorkProxy(g.scene);
  assert.equal(p.stats.batches, 1);
  assert.equal(p.stats.triangles, 1706);
});

// The author's rule is "swap to the articulated tier before combat or visible
// damage". Handing the proxy to the tank builder must fail loudly rather than
// field a hull with no barrel, no clips and a heat gauge hung on nothing.
test('the proxy cannot be driven by accident', async () => {
  const g = await parse(MORK_PROXY);
  assert.throws(() => makeMork(prepareMork(g.scene, g.animations)));
});

// Sizes, in authored metres (measured 2026-09-14). All three tiers share one
// origin — HOVER_RIG at 0,0,0 — and fit to the same scale: the span limit binds
// for each, at k 0.1468 / 0.1470 / 0.1470. So any difference below lives in the
// assets themselves, not in how they are fitted.
const fitted = async (rel, prep) => {
  const g = await parse(rel);
  return new THREE.Box3().setFromObject(prep(g).model).getSize(new THREE.Vector3());
};
const within = (a, b, tol, what) =>
  assert(Math.abs(a / b - 1) < tol, `${what}: ${a.toFixed(4)} vs ${b.toFixed(4)} (${((a / b - 1) * 100).toFixed(2)}%)`);
const articulated = (g) => prepareMork(g.scene, g.animations);

// The one that matters most: LOW would REPLACE the shipped hull, so a size
// difference is a visible jump the first time a player meets the new tank.
test("LOW is the shipped hull's size, so replacing it does not pop", async () => {
  const hull = await fitted(MORK_TIERS.game, articulated);
  const low = await fitted(MORK_TIERS.low, articulated);
  for (const ax of ['x', 'y', 'z']) within(low[ax], hull[ax], 0.01, `LOW ${ax}`);
});

// A swap pops by footprint first: the proxy must occupy the hull's exact ground
// plan, or a bay or an orbital marker visibly jumps when it hands over.
test("the proxy shares the hull's footprint", async () => {
  const hull = await fitted(MORK_TIERS.game, articulated);
  const prox = await fitted(MORK_PROXY, (g) => prepareMorkProxy(g.scene));
  within(prox.x, hull.x, 0.01, 'proxy width');
  within(prox.z, hull.z, 0.01, 'proxy length');
});

// A KNOWN AUTHORED DELTA, PINNED RATHER THAN HIDDEN. In its own metres the proxy
// is 2.819 tall against the hull's 3.016 — 6.6% shorter, base about 2 cm higher
// and top about 18 cm lower — while its footprint matches to 0.1%. That is not a
// fitting error, since the scale is shared, and it may well be deliberate: a
// parked hull settled for a bay. It has been raised with the owner.
//
// The first version of this test asserted height within 5% and failed at 7%.
// Widening that tolerance would have made it pass by hiding a real difference;
// rescaling the proxy's height would have distorted a pose that may be
// intentional. So the measured value is held here instead, and a later revision
// that changes it fails this test and gets looked at.
test('the proxy is authored about 6.5% shorter than the hull — a pinned, known delta', async () => {
  const hull = await fitted(MORK_TIERS.game, articulated);
  const prox = await fitted(MORK_PROXY, (g) => prepareMorkProxy(g.scene));
  const delta = prox.y / hull.y - 1;
  assert(Math.abs(delta + 0.065) < 0.006, `proxy height delta ${(delta * 100).toFixed(2)}%, pinned at about -6.5%`);
});

test('proxy clones share geometry, and releasing one blanks nothing', async () => {
  const g = await parse(MORK_PROXY);
  const source = prepareMorkProxy(g.scene);
  const a = makeMorkProxy(source), b = makeMorkProxy(source);
  assert.equal(a.userData.proxy, true);
  assert.equal(a.userData.modelStats.batches, 1);
  a.userData.dispose();
  let intact = false;
  b.traverse((o) => { if (o.isMesh && o.geometry.attributes.position?.count > 0) intact = true; });
  assert(intact, 'the other proxy still has its geometry');
});

// A PREPARED MESH IS NOT A UNIT. The footprint tests above compare boxes at the
// prepare stage, and they passed while the Units viewer showed the proxy 1.33x
// off the hull. The builders differed in userData, not in geometry: makeMork set
// baseScale 0.75 and makeMorkProxy set nothing, and every consumer sizes a unit
// by that factor. So this compares the BUILT units, sized the way td-tab sizes
// the player hull — unitScale times baseScale.
test('a built proxy carries the hull\'s unit contract and lands on its footprint', async () => {
  const [game, far] = await Promise.all([parse(MORK_TIERS.game), parse(MORK_PROXY)]);
  const hull = makeMork(prepareMork(game.scene, game.animations));
  const prox = makeMorkProxy(prepareMorkProxy(far.scene));
  // compared against each other, not against literals: a second copy of 0.75
  // here would be the drift this contract exists to remove
  for (const k of ['kind', 'asset', 'baseScale', 'lift'])
    assert.equal(prox.userData[k], hull.userData[k], `userData.${k}`);
  assert.equal(prox.userData.proxy, true);
  const unitScale = 3.7;
  const built = (u) => {
    u.scale.setScalar(unitScale * (u.userData.baseScale ?? 1));
    u.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(u).getSize(new THREE.Vector3());
  };
  const h = built(hull), p = built(prox);
  within(p.x, h.x, 0.01, 'built proxy width');
  within(p.z, h.z, 0.01, 'built proxy length');
  hull.userData.dispose();
});
