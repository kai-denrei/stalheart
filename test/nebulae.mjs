// THE OWNER'S NEBULAE (2026-10-07; src/fx/nebulae.js): his two twirling-lights pages as one-shot shaders hung in the game's sky as
// additive planes (src/fx/accretion.js skyGlowPlane), the veil the exact opposite side of the sky from the hole on the horizon, the
// bloom a quarter turn round and high (galaxyseed.js SKY_VEIL / SKY_BLOOM), both turned with the hole once the base stands
import assert from 'node:assert/strict';
const { NEBULAE, NEBULA_SIZE, nebulaShader } = await import('../src/fx/nebulae.js');
const { skyGlowPlane, aimSkyPlanes, turnSkyDirection, accretionSkyPlanes } = await import('../src/fx/accretion.js');
const { SKY_HOLE, SKY_VEIL, SKY_BLOOM } = await import('../src/galaxyseed.js');
const THREE = await import('../vendor/three.module.js');

// the shaders: the pages' settings verbatim, the volume pass with the circular fade and an alpha, no stars of their own
assert.deepEqual([NEBULAE.veil.colorA, NEBULAE.veil.colorB, NEBULAE.veil.morph, NEBULAE.veil.exposure], ['#15c99b', '#bcffb8', 2, 0.2], 'the veil page\'s Jade ribbons as saved');
assert.deepEqual([NEBULAE.bloom.colorA, NEBULAE.bloom.colorB, NEBULAE.bloom.zoom, NEBULAE.bloom.density], ['#b7f5ff', '#4055e8', 0.5, 0.3], 'the bloom page\'s Blue iris as saved');
for (const kind of ['veil', 'bloom']) {
  const src = nebulaShader(kind);
  for (const w of ['uniform vec2 R', 'uniform float T', 'uniform vec2 C', 'uniform float Exposure', 'uniform vec3 ColorA', 'uniform float Morph', 'vec4 scene(vec3 p)', '#define STEPS 64', 'length(lens())', 'gl_FragColor=vec4(col,clamp(']) assert.ok(src.includes(w), `${kind}: the shader carries ${w}`);
  assert.ok(!src.includes('StarGain') && !src.includes('stars('), `${kind}: the page's own stars are left out, the sky has its own`);
}
assert.ok(nebulaShader('veil').includes('#define DIST 10.0') && nebulaShader('bloom').includes('#define RB 5.5'), 'each page\'s eye distance and volume bound');
assert.ok(nebulaShader('veil').includes('float radius=2.7+') && nebulaShader('bloom').includes('float arms='), 'the veil\'s torn shell, the bloom\'s spiral petals');
assert.throws(() => nebulaShader('comet'), 'no such page');
assert.ok(NEBULA_SIZE <= 1024, 'a small still');

// the plane: additive, facing the origin, where it hangs noted; the hole built on it keeps its shadow
const g = skyGlowPlane(new THREE.Texture(), { dir: [0, 0, 1], dist: 46, across: 12, glow: 1.4 });
g.updateMatrixWorld(true);
assert.equal(g.children.length, 1, 'one plane, no shadow');
assert.ok(g.position.z === 46 && new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion).z < -0.999, 'forty-six out, facing the origin');
assert.ok(g.children[0].material.blending === THREE.AdditiveBlending && g.children[0].material.color.r === 1.4 && !g.children[0].material.toneMapped, 'the picture added, lifted, never tone-mapped twice');
assert.deepEqual(g.userData.sky, { dir: [0, 0, 1], dist: 46, across: 12 }, 'where it hangs');
aimSkyPlanes(g, [1, 0, 0]);
assert.ok(Math.abs(g.position.x - 46) < 1e-9 && g.userData.sky.dir[0] === 1, 're-aimed at its own distance, the note following');
const hole = accretionSkyPlanes(new THREE.Texture(), { cx: 0.5, cy: 0.5, r: 0.1 }, { dir: [0, 1, 0], dist: 40, across: 28 });
assert.ok(hole.children.length === 2 && hole.userData.hole.shadow.r === 0.1 && hole.userData.sky.dist === 40, 'the hole: the plane and its shadow');

// the turn: the veil's compass point is the hole's exact opposite at its own elevation; the bloom a quarter turn round
const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const heart = [0, 1, 0], holeDir = [0.6, 0.02, 0.8];
const veil = turnSkyDirection(heart, holeDir, Math.PI, 0.1), bloom = turnSkyDirection(heart, holeDir, Math.PI / 2, 0.5);
assert.ok(Math.abs(Math.hypot(...veil) - 1) < 1e-9 && Math.abs(veil[1] - Math.sin(0.1)) < 1e-9, 'a unit direction a tenth of a radian up');
assert.ok(veil[0] / Math.hypot(veil[0], veil[2]) < -0.59 && veil[2] / Math.hypot(veil[0], veil[2]) < -0.79, 'the opposite compass point from the hole');
assert.ok(Math.abs(bloom[0] * holeDir[0] + bloom[2] * holeDir[2]) < 1e-9 && Math.abs(bloom[1] - Math.sin(0.5)) < 1e-9, 'a quarter turn round, half a radian up');
assert.ok(near(turnSkyDirection(heart, holeDir, 0, 0), [0.6, 0, 0.8]), 'no turn, no lift: the hole\'s own compass point');
assert.deepEqual(turnSkyDirection(heart, [0, 1, 0], Math.PI, 0.1), [0, 1, 0], 'no compass point to turn from: straight up');
const tilted = turnSkyDirection([1, 1, 0], [0, 0, 1], Math.PI, 0.2);
assert.ok(Math.abs(Math.hypot(...tilted) - 1) < 1e-9 && Math.abs((tilted[0] + tilted[1]) / Math.SQRT2 - Math.sin(0.2)) < 1e-9 && tilted[2] < -0.9, 'about any zenith');

// the placements: opposite and on the horizon, small; the bloom high and a quarter turn round; both within the camera's far plane
assert.ok(SKY_VEIL.turn === Math.PI && SKY_VEIL.elevation > 0 && SKY_VEIL.elevation < 0.2, 'the veil the exact opposite side, on the horizon');
const deg = (k) => 2 * Math.atan(k.across / 2 / k.dist) * 180 / Math.PI;
assert.ok(deg(SKY_VEIL) > 8 && deg(SKY_VEIL) < 20, `the veil small (${deg(SKY_VEIL).toFixed(0)} degrees)`);
assert.ok(Math.abs(SKY_BLOOM.turn) === Math.PI / 2 && SKY_BLOOM.elevation > 0.3 && deg(SKY_BLOOM) < 30, `the bloom elsewhere, high, modest (${deg(SKY_BLOOM).toFixed(0)} degrees)`);
for (const k of [SKY_HOLE, SKY_VEIL, SKY_BLOOM]) assert.ok(k.dist < 50, 'inside the camera\'s far plane (a plane facing the eye sits at its distance)');
assert.ok(SKY_VEIL.kind === 'veil' && SKY_BLOOM.kind === 'bloom' && NEBULAE[SKY_VEIL.kind] && NEBULAE[SKY_BLOOM.kind], 'each names its page');
console.log('Nebulae: the veil opposite the hole on the horizon, the bloom a quarter turn round and high, both the owner\'s pages rendered once.');
