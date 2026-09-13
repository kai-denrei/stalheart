// Landmark runtime LOD candidates under review (docs/landmark-tiers-assets.lock.json).
//
// One mapping — withLandmarkTiers — turns a structure's `candidate` tiers into the structure, and both the story lab and
// the game world call it through one parser. These hold that contract, and hold the candidate files to the thing a
// review is actually about: that they still behave like the landmark they would replace.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { STRUCTURES, withLandmarkTiers, landmarkTierMode, LANDMARK_TIER_MODES } from '../src/content/base-layout.js';

const lock = JSON.parse(readFileSync(new URL('../docs/landmark-tiers-assets.lock.json', import.meta.url), 'utf8'));
const pinned = new Set(lock.files.map((f) => f.path));
const parse = async (rel) => {
  const b = readFileSync(new URL(`../${rel}`, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};
const trianglesUnder = (n) => { let t = 0; n?.traverse((o) => { if (o.isMesh) t += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3; }); return t; };
const stalheart = STRUCTURES.find((s) => s.id === 'stalheart');

test('shipped mode hands back the shipped structures untouched', () => {
  assert.equal(withLandmarkTiers(STRUCTURES), STRUCTURES, 'the default is the same array, not a copy');
  assert.equal(withLandmarkTiers(STRUCTURES, 'shipped'), STRUCTURES);
  assert.equal(withLandmarkTiers(STRUCTURES, 'nonsense'), STRUCTURES, 'an unknown mode falls back to what ships');
});

test('candidate mode swaps only the structures that carry candidates', () => {
  const out = withLandmarkTiers(STRUCTURES, 'candidate');
  assert.equal(out.length, STRUCTURES.length);
  STRUCTURES.forEach((s, i) => {
    if (!s.candidate) { assert.equal(out[i], s, `${s.id} is the very same object`); return; }
    assert.equal(out[i].asset, s.candidate.asset, `${s.id} near tier`);
    assert.equal(out[i].far, s.candidate.far, `${s.id} far tier`);
    assert.deepEqual(out[i].clips, s.clips, `${s.id} keeps the clips it plays`);
    assert.deepEqual(out[i].hide, s.hide, `${s.id} keeps the parts it hides`);
  });
});

test('one parser reads the switch', () => {
  assert.deepEqual(LANDMARK_TIER_MODES, ['shipped', 'candidate']);
  assert.equal(landmarkTierMode('?landmarks=candidate'), 'candidate');
  assert.equal(landmarkTierMode('?stage=6&landmarks=candidate'), 'candidate');
  for (const q of ['', '?stage=6', '?landmarks=Candidate', '?landmarks=shipped', '?landmarks=', null, undefined])
    assert.equal(landmarkTierMode(q), 'shipped', `${JSON.stringify(q)} reads as shipped`);
});

test('every candidate file is pinned, and each structure still ships its derived far tier', () => {
  const withCandidates = STRUCTURES.filter((s) => s.candidate);
  assert(withCandidates.length > 0, 'at least one landmark is under review');
  for (const s of withCandidates) {
    assert(pinned.has(s.candidate.asset), `${s.id}: candidate game tier is pinned`);
    assert(pinned.has(s.candidate.far), `${s.id}: candidate distance tier is pinned`);
    // far-tiers.mjs derives only assets/models/far/ paths; a candidate must not displace what ships until reviewed
    if (s.far) assert(s.far.startsWith('assets/models/far/'), `${s.id}: the shipped far tier is still the derived one`);
  }
});

// A KEPT NAME IS NOT A MOVING PART. A clip can keep every node name while those nodes hold no geometry, and then it plays
// and nothing moves. So the candidate is checked for triangles under each animated node, not for the names alone.
test("Stålheart's candidate game tier still moves its nine machine controls, at the shipped size", async () => {
  const [ship, cand] = await Promise.all([parse(stalheart.asset), parse(stalheart.candidate.asset)]);
  const clip = cand.animations.find((c) => c.name === 'Terraforming_Cycle');
  assert(clip, 'the candidate carries the clip the structure plays');
  const nodes = [...new Set(clip.tracks.map((t) => THREE.PropertyBinding.parseTrackName(t.name).nodeName))];
  assert.equal(nodes.length, 9, 'gantry, carriage, tool lift and J1–J6; the forty hose segments are omitted by design');
  for (const n of nodes) assert(trianglesUnder(cand.scene.getObjectByName(n)) > 0, `${n} moves geometry, not just a name`);
  ship.scene.updateMatrixWorld(true); cand.scene.updateMatrixWorld(true);
  const a = new THREE.Box3().setFromObject(ship.scene).getSize(new THREE.Vector3());
  const b = new THREE.Box3().setFromObject(cand.scene).getSize(new THREE.Vector3());
  for (const ax of ['x', 'y', 'z']) assert(Math.abs(b[ax] / a[ax] - 1) < 0.01, `${ax}: ${b[ax].toFixed(2)} against ${a[ax].toFixed(2)}`);
});

test("Stålheart's candidate distance tier is static and one draw", async () => {
  const g = await parse(stalheart.candidate.far);
  assert.equal(g.animations.length, 0, 'a distance tier plays nothing');
  let draws = 0; g.scene.traverse((o) => { if (o.isMesh) draws++; });
  assert.equal(draws, 1);
});

// HELD BACK, ON PURPOSE. HUGIN's runtime LODs at c827eda keep the REUSABLE_BOOSTER node but merge the booster's geometry
// into consolidated static meshes. The node carries 0 triangles in both tiers (6,572 in the shipped model), while 21.9%
// (LOD1) and 24.5% (LOD2) of their triangles sit inside the booster's box — against 1.6% of the shipped model once the
// booster is removed. So base-layout's `hide: ['REUSABLE_BOOSTER']` could no longer remove it, which breaks the hideable-part
// rule in docs/ASSET-COLLABORATION.md and would show a booster the story deliberately hides. Raised with the owner.
//
// When a revision restores the booster as its own hideable geometry: pin it, give HUGIN a `candidate`, replace this test
// with one that measures triangles UNDER REUSABLE_BOOSTER in each tier (a present node is not a hideable part), and remove it.
test('HUGIN carries no candidate until its booster can be hidden again', () => {
  const hugin = STRUCTURES.find((s) => s.id === 'hugin');
  assert(hugin.hide?.includes('REUSABLE_BOOSTER'), 'the story still hides the booster');
  assert.equal(hugin.candidate, undefined, 'read the note above this test before adding one');
});
