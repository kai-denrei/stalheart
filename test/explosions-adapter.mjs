import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createExplosions } from '../src/fx/explosions.js';

const cellSide = 10 / 753;   // the story planet: 753 m, 10 m a cell
const scene = new THREE.Scene();
const fx = createExplosions(scene);

assert.equal(fx.spawn('gunship.bofors', [0, 1, 0], [0, 1, 0], cellSide), true);
const obj = scene.children.at(-1);
assert.deepEqual(obj.position.toArray(), [0, 1, 0]);
assert.equal(obj.scale.x, 1, 'no object scale: it would not reach the puff quads');
for (const layer of obj.children) {
  assert.ok(Math.abs(layer.material.uniforms.uScale.value - 0.45 * cellSide / 10) < 1e-12, 'metres become scene units in the shader');
  assert.ok(Math.abs(layer.material.uniforms.uPlanetR.value - 1) < 1e-12, 'the bend radius is the impact distance in scene units');
}
fx.spawn('tank.shell', [1, 0, 0], [1, 0, 0], cellSide);
{
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(scene.children.at(-1).quaternion);
  assert.ok(up.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9, 'local +Y stands on the surface normal');
}
assert.equal(fx.spawn('no.such.use', [0, 1, 0], [0, 1, 0], cellSide), false);
for (let i = 0; i < 25; i++) fx.spawn('gunship.rotary', [0, 1, 0], [0, 1, 0], cellSide);
assert.equal(scene.children.filter((o) => o.name === 'rotary-pop').length, 20, 'the small cap holds');
assert.deepEqual(fx.state().spawned, { 'gunship.bofors': 1, 'tank.shell': 1, 'gunship.rotary': 25 });
fx.tick(0.5);
assert.equal(scene.children.filter((o) => o.name === 'rotary-pop').length, 0, 'smalls reaped after 0.4 s');
fx.tick(1);
assert.equal(fx.state().live, 0, 'mediums reaped after 1.2 s');
fx.clear();
assert.equal(scene.children.length, 0);

let reported = null;
const broken = createExplosions(new THREE.Scene(), {
  modules: { 'bofors-burst': { meta: { size: 'medium' }, createExplosion() { throw Error('no GL'); } } },
  onError: (error) => { reported = error.message; },
});
assert.equal(broken.spawn('tank.shell', [0, 1, 0], [0, 1, 0], cellSide), false);
assert.equal(broken.available, false);
assert.equal(reported, 'no GL');

const unwarmed = createExplosions(new THREE.Scene(), { onError: () => {} });
assert.equal(unwarmed.prewarm({ compile() { throw Error('lost context'); } }, new THREE.PerspectiveCamera()), false);
assert.equal(unwarmed.spawn('tank.shell', [0, 1, 0], [0, 1, 0], cellSide), false, 'no explosions after a failed prewarm');
console.log('Explosions adapter: placement, metres to units, caps, reaping and fallback hold.');
