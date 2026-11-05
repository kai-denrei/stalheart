// scorch-trail.mjs — THE MARKS LIE ON THE GROUND (owner, 2026-11-05: "the burned marks that remain for a few seconds should be on the
// ground level; currently they hover at the higher level of where the rocks used to be"). src/fx/scorch-trail.js reseat: a stamp laid
// on a rock top (radius 1.03 on a unit sphere) goes down to the floor (1.0) when the caller's ground says floor; a stamp on the floor
// keeps its matrix; the turn and size of a moved stamp, and every age and seed, are untouched; a retired stamp is left alone.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createScorchTrail } from '../src/fx/scorch-trail.js';

const LIFT = 0.001, LIFE = 60;
const group = new THREE.Group();
const trail = createScorchTrail(group, { cap: 8, life: LIFE, hot: 4, size: 0.01, lift: LIFT });
const at = (r, dir) => new THREE.Vector3(...dir).normalize().multiplyScalar(r);
const ROCK = [0, 0, 1], FLOOR = [0, 1, 0];
const rockN = new THREE.Vector3(...ROCK), floorN = new THREE.Vector3(...FLOOR);
trail.stamp(at(1.03, ROCK), rockN);   // slot 0: on the rock's top
trail.stamp(at(1.0, FLOOR), floorN);  // slot 1: on the floor
trail.tick(1.5);
const radius = (i) => { const m = new THREE.Matrix4(); trail.mesh.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixPosition(m).length(); };
const matrix = (i) => { const m = new THREE.Matrix4(); trail.mesh.getMatrixAt(i, m); return m.toArray(); };
const ages = () => [...trail.mesh.geometry.getAttribute('aAge').array.slice(0, 2)];
const seeds = () => [...trail.mesh.geometry.getAttribute('aSeed').array.slice(0, 2)];
assert.ok(Math.abs(radius(0) - (1.03 + LIFT)) < 1e-6, `laid at the rock top plus the lift (${radius(0)})`);
const floorBefore = matrix(1), rockBefore = matrix(0), agesBefore = ages(), seedsBefore = seeds();

// the ground everywhere is the floor now: the rock burned
const floorGround = (p) => { const l = Math.hypot(...p); return p.map((v) => v / l); };
assert.equal(trail.reseat(floorGround), 1, 'one stamp moved: the one on the rock');
assert.ok(Math.abs(radius(0) - (1 + LIFT)) < 1e-6, `the rock's stamp lies on the floor plus the lift (${radius(0)})`);
assert.deepEqual(matrix(1), floorBefore, 'the floor stamp keeps its matrix');
const after = matrix(0);
for (let k = 0; k < 12; k++) assert.ok(Math.abs(after[k] - rockBefore[k]) < 1e-12, `only the translation moved (element ${k})`);
assert.deepEqual(ages(), agesBefore, 'the ages are untouched');
assert.deepEqual(seeds(), seedsBefore, 'the seeds are untouched');
assert.equal(trail.reseat(floorGround), 0, 'a second reseat on the same ground moves nothing');

// a retired stamp (past its life) is not laid again
const old = createScorchTrail(group, { cap: 4, life: LIFE, hot: 4, size: 0.01, lift: LIFT });
old.stamp(at(1.03, ROCK), rockN);
old.tick(LIFE + 1);
assert.equal(old.reseat(floorGround), 0, 'a stamp past its life stays where it was');
// a ground that answers nothing (off the board) leaves the stamp alone
const fresh = createScorchTrail(group, { cap: 4, life: LIFE, hot: 4, size: 0.01, lift: LIFT });
fresh.stamp(at(1.03, ROCK), rockN);
assert.equal(fresh.reseat(() => null), 0, 'no ground answer: no move');
console.log('scorch-trail: a rock-top stamp re-seats to the floor, a floor stamp keeps its matrix, ages and seeds untouched');
