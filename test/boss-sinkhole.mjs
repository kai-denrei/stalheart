// boss-sinkhole.mjs — the boss lab's emergences out of the game's own sinkhole (owner, 2026-10-10: "the initial Tremor is not just the ground shaking, it is our
// sinkhole animation from the game mode"; src/labs/boss/sinkhole.js over src/game-breaches.js): the breaches live in a group scaled by the planet's radius, so a
// breach opened at a local point stands on the unit sphere under it, one game cell (`cellSide`) times its size; one is open at a time, an earlier one sealed with
// the game's rubble; ready is the adapter's (the opening run to its duration); its quake sounds once, on the opening, at the camera's distance in the game's
// units; the lab's floors and grid lines carry the game's breach ground; a reset takes every breach and cap away. The sinkhole itself is the adapter's test seam.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createLabSinkhole } from '../src/labs/boss/sinkhole.js';

const R = 753, CELL = 10 / R, EPS = 1e-9;
function fakeSinkhole() {
  const group = new THREE.Group(), fx = { loaded: true, triggered: 0, phase: 'idle', disposed: false };
  return Object.assign(fx, { group, tune: { look: 'textured' }, inverseFrame: { value: new THREE.Matrix4() }, hole: { value: 0 }, ready: () => fx.loaded,
    trigger() { fx.triggered++; fx.phase = 'rumbling'; }, update() {}, state: () => ({ phase: fx.phase }), dispose() { fx.disposed = true; } });
}
const made = [];
const sphere = new THREE.Group(), camera = new THREE.PerspectiveCamera(), played = [];
const audio = { play: (name, o) => played.push({ name, ...o }) };
const planet = { radius: R, cellSide: CELL };
// the lab's ground: a local point on the tangent plane at the pole dropped onto the sphere (metres, the planet's centre at the origin)
const ground = (x, z) => { const l = Math.hypot(x, R, z); return [x / l * R, R / l * R, z / l * R]; };
const sink = createLabSinkhole({ sphere, camera, audio, planet: () => planet, ground, north: () => [0, 0, 1], look: () => 'tronColors',
  makeSinkhole: () => { const fx = fakeSinkhole(); made.push(fx); return fx; } });

// the ground patched as td-tab.js patches its own: the floors and their grid lines, not the rock
{
  const mesh = new THREE.Group();
  for (const name of ['floors', 'rock', 'edges']) { const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()); m.name = name; mesh.add(m); }
  assert.deepEqual(sink.patchGround(mesh), ['floors', 'edges']);
  assert.equal(mesh.getObjectByName('floors').material.customProgramCacheKey(), 'game-breach-ground-v1', 'the floors carry the game\'s breach ground');
  assert.notEqual(mesh.getObjectByName('rock').material.customProgramCacheKey(), 'game-breach-ground-v1', 'the rock does not');
  assert.equal(sink.host.scale.x, R, 'the host is the game\'s world: the unit sphere scaled by the radius');
}
// a breach at the arena's centre: on the unit sphere under it, one cell wide, the board's look; not ready until it has opened and run its duration
let reedsHole;
{
  reedsHole = sink.open([0, 0], 1, 'reeds');
  assert.ok(Math.abs(reedsHole.position.y - 1) < EPS && Math.abs(reedsHole.position.x) < EPS, 'at the pole, on the unit sphere');
  assert.ok(Math.abs(reedsHole.scale.x - CELL) < EPS, 'one game cell');
  assert.equal(made.at(-1).tune.look, 'tronColors', 'the board\'s look');
  assert.equal(sink.who(), 'reeds'); assert.equal(sink.ready(), false, 'not ready before it opens');
  camera.position.set(0, 60, 0); camera.updateMatrixWorld(true); sphere.position.set(0, -R, 0); sphere.updateMatrixWorld(true);
  sink.step(0.1);
  assert.equal(made.at(-1).triggered, 1, 'triggered on the first step once its maps are in');
  assert.equal(played.length, 1, 'the quake sounds on the opening'); assert.equal(played[0].name, 'sinkhole_quake');
  assert.ok(Math.abs(played[0].dist - 60 / R) < 1e-6, `at the camera's distance in the game's units (${played[0].dist})`);
  let t = 0.1; while (!sink.ready() && t < 20) { sink.step(0.1); t += 0.1; }
  assert.equal(played.length, 1, 'once');
  assert.ok(sink.ready() && t > 5 && t < 12, `ready once the opening has run its duration (${t.toFixed(1)} s, the adapter's own rule)`);
}
// one at a time: the boss's breach seals the Reeds' with the rubble; two cells wide; a reset clears every breach and cap
{
  const boss = sink.open([3, -4], 2, 'boss'), w = ground(3, -4), l = Math.hypot(...w);
  assert.equal(made.at(-2).disposed, true, 'the Reeds\' breach sealed');
  assert.equal(sink.state().caps, 1, 'with the game\'s rubble cap');
  assert.ok(Math.abs(boss.position.x - w[0] / l) < EPS && Math.abs(boss.position.z - w[2] / l) < EPS, 'under the local point');
  assert.ok(Math.abs(boss.scale.x - 2 * CELL) < EPS, 'two cells');
  assert.equal(sink.who(), 'boss'); assert.equal(sink.state().breaches, 1, 'one open');
  assert.deepEqual(sink.state().opened.map((o) => o.who), ['reeds', 'boss']);
  sink.reset();
  assert.equal(sink.state().open, false); assert.equal(sink.state().caps, 0); assert.equal(sink.state().breaches, 0); assert.equal(made.at(-1).disposed, true, 'reset disposes it');
  assert.equal(sink.ready(), false); assert.equal(sink.who(), null);
}
sink.dispose();
assert.equal(sphere.children.length, 0, 'dispose takes the host away');
console.log(`boss-sinkhole.mjs: the game's sinkhole (src/game-breaches.js) opened at a local point on the unit sphere in a host scaled by ${R} m, one cell (${(CELL * R).toFixed(0)} m) for the Reeds and two for the boss, one at a time (the earlier sealed with the game's rubble), ready by the adapter's own duration, its quake once on the opening at the camera's game-unit distance, the floors and grid lines patched; a reset clears it.`);
