// The orbital constellation's choreography (src/fx/orbital-finale.js constellationState, after A6's First Light timeline): from 50 s
// to 100 s the HEL-01 heads go up one by one and all 48 are on their rings by the end, never inside the planet, the camera pulling back.
import assert from 'node:assert/strict';
const { constellationState, mirrorOrbit, heartToPole, ownPlanet } = await import('../src/fx/orbital-finale.js');
let last = -1;
for (let t = 50; t <= 100; t += 0.5) { const s = constellationState(t); assert.ok(s.deployed >= last, `deployments never go back (${t} s)`); last = s.deployed; }
assert.equal(constellationState(50).deployed, 0, 'none up at the start of the chapter');
assert.equal(constellationState(100).deployed, 48, 'all forty-eight by the end');
const C = [0, -195, 0], d = (p) => Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]);
for (let i = 0; i < 48; i++) for (const t of [60, 80, 100]) assert.ok(d(mirrorOrbit(i, t)) > 195 * 1.5, 'a ring is well clear of the planet');
const a = constellationState(60).camera, b = constellationState(95).camera;
assert.ok(Math.hypot(...b) > Math.hypot(...a) * 2, 'the camera pulls back to the whole constellation');
console.log(`Orbital finale: 48 heads up between 52.4 s and ${(52.4 + 47 * 0.65 + 5).toFixed(1)} s; camera ${Math.hypot(...a).toFixed(0)} -> ${Math.hypot(...b).toFixed(0)}.`);

// OUR OWN PLANET (2026-10-06): the board's surface meshes become the small world on the same geometry buffers, scaled to the planet's
// radius and turned so the heart stands at the pole under the pad; a heart already at the pole is left alone
{
  const THREE = await import('../vendor/three.module.js');
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 1, 0, 0, 0, 0, 1], 3));
  const floor = new THREE.Mesh(geo, new THREE.MeshBasicMaterial()), edges = new THREE.LineSegments(geo, new THREE.LineBasicMaterial());
  const heart = [1, 0, 0], g = ownPlanet({ map: [floor, edges, null, { geometry: null }], heart }, 100), world = g.children[0];
  assert.equal(g.userData.meshes, 2, 'a mesh and a line, the empties skipped');
  assert.ok(world.children[0].isMesh && world.children[0].geometry === geo && world.children[1].isLineSegments, 'the same buffers, a mesh and lines');
  assert.ok(world.children.every((o) => o.material !== floor.material && o.material !== edges.material), 'its own materials, lit here');
  const turned = new THREE.Vector3(...heart).applyQuaternion(world.quaternion);
  assert.ok(turned.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6, `the heart turned to the pole (${turned.toArray()})`);
  assert.ok(world.scale.x === 100 && world.scale.y === 100, 'scaled to the planet');
  assert.ok(Math.abs(heartToPole([0, 1, 0]).w - 1) < 1e-9, 'a heart at the pole: no turn');
  assert.ok(Math.abs(heartToPole(null).w - 1) < 1e-9 && heartToPole([0, 0, 0]).w === 1, 'no heart: no turn');
}
console.log('Orbital finale: the game\'s own surface stands in for the planet, heart up.');
