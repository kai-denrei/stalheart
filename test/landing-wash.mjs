// THE LANDING WASH (owner, 2026-11-15: "the thrusters touching the surface should create effects of smoke and particles flying"): the pure rules
// (src/domain/landing-wash.js) and the picture's slots (src/fx/landing-wash.js) on real three.js nodes, driven by the automatic landing's own clock
// (src/domain/landing-sequence.js through STORY_ARRIVAL). The picture itself is --landing-wash's.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { washStrength, groundHit, emitDue, cutAtGround, sagAt } from '../src/domain/landing-wash.js';
import { createLandingWash } from '../src/fx/landing-wash.js';
import { makeLandingSequence } from '../src/domain/landing-sequence.js';
import { STORY_ARRIVAL, LANDING_WASH, PLUME_CLUSTER, SH02_WELL } from '../src/content/story-defaults.js';

// the strength: nothing out of reach or with the engines out, rising as it sinks, full from `full` of the reach down, times the engines' light
assert.equal(washStrength({ plume: 1, altitude: 40, reach: 33 }), 0, 'the plume tips off the ground: no wash');
assert.equal(washStrength({ plume: 0, altitude: 2, reach: 33 }), 0, 'the engines out: no wash');
assert.equal(washStrength({ plume: 1, altitude: 33 * 0.3, reach: 33, full: 0.3 }), 1, 'full at `full` of the reach');
assert.equal(washStrength({ plume: 0.5, altitude: 0, reach: 33 }), 0.5, 'times the engines');
let prev = -1;
for (let alt = 33; alt >= 0; alt -= 0.5) { const k = washStrength({ plume: 1, altitude: alt, reach: 33 }); assert.ok(k >= prev - 1e-12, `rises as it sinks (${alt} m)`); prev = k; }
// the ground point: down the axis; straight under the feet past the tilt limit; the sag of a sphere
assert.deepEqual(groundHit([0, 10, 0], [0, 1, 0], 0), [0, 0, 0]);
const leant = groundHit([0, 10, 0], [Math.sin(0.2), Math.cos(0.2), 0], 0);
assert.ok(leant[0] < -1.9 && leant[0] > -2.1 && leant[1] === 0, `a hull leaning +x throws its wash behind it (${leant})`);
assert.deepEqual(groundHit([3, 10, 4], [1, 0, 0], 0), [3, 0, 4], 'lying flat: straight under the feet');
assert.ok(Math.abs(sagAt(30, 40, 753) - 2500 / 1506) < 1e-12);
// the emission count carries its fraction and caps a long frame
let c = 0, total = 0;
for (let i = 0; i < 60; i++) { const e = emitDue(c, 110, 1 / 60); c = e.carry; total += e.n; }
assert.ok(total >= 109 && total <= 110, `110 a second over a second at 60 fps (${total})`);
assert.equal(emitDue(0, 110, 5, 24).n, 24, 'a long frame dumps no cloud');
// the cut at the ground: a touchdown or a wreck, not an engine cut high up
assert.equal(cutAtGround({ was: 0.8, now: 0, altitude: 0 }), true);
assert.equal(cutAtGround({ was: 0.8, now: 0, altitude: 30 }), false);
assert.equal(cutAtGround({ was: 0.1, now: 0, altitude: 0 }), false);

// THE AUTOMATIC LANDING on the wash: the planet's unit sphere, 753 m (as test/arrival.mjs), the hull at its presentation scale 1.5
const METRES = 1 / 753, site = new THREE.Matrix4().makeTranslation(0, 1, 0), parent = new THREE.Group();
const reach = (Math.max(...PLUME_CLUSTER.map((e) => e.height)) - SH02_WELL.bell - 1) * 1.5;
assert.ok(reach > 25 && reach < 40, `the plume reaches ${reach.toFixed(1)} m under the feet`);
const wash = createLandingWash({ parent, frame: site, metres: METRES, planetRadius: 1 });
assert.equal(parent.children.length, 1, 'one group under the base');
const meshes = wash.root.children[0].children;
assert.deepEqual(meshes.map((m) => m.type), ['Mesh', 'LineSegments'], 'two draws: the puffs and the grit');
assert.equal(meshes[0].geometry.instanceCount, LANDING_WASH.puffs.capacity);
const seq = makeLandingSequence(STORY_ARRIVAL.landing), dt = 1 / 60;
let first = null, atTouch = null;
for (let t = 0; t < seq.touchdown + 3; t += dt) {
  const s = seq.stateAt(t);
  wash.tick(dt, { feet: [0, s.altitude, 0], plume: s.plume, reach, pad: 0 });
  const w = wash.state();
  if (first == null && w.emitted > 0) first = { t, altitude: s.altitude };
  if (atTouch == null && t >= seq.touchdown) atTouch = w;
}
const end = wash.state();
assert.ok(first && first.altitude <= reach * LANDING_WASH.reach + 1e-9 && first.altitude > reach * 0.5, `the wash begins as the plume reaches the ground (${JSON.stringify(first)})`);
assert.ok(atTouch.emitted >= 40, `a cloud by the touchdown (${atTouch.emitted} puffs, ${atTouch.thrown} grit)`);
assert.equal(end.bursts, 1, 'one ring thrown at the cut');
assert.equal(end.emitted, atTouch.emitted + LANDING_WASH.burst.count - (atTouch.bursts ? LANDING_WASH.burst.count : 0), 'no puff after the engines are out but the ring');
assert.equal(end.live, true, 'the cloud still rolls out three seconds after the touchdown');
// a slot holds its puff's birth and life, the shader's clock the wash's own
const time = meshes[0].geometry.attributes.aTime.array, uTime = meshes[0].material.uniforms.uTime.value;
assert.ok(Math.abs(uTime - end.t) < 0.006, 'the layers run on the wash clock');
let born = 0; for (let i = 0; i < LANDING_WASH.puffs.capacity; i++) if (time[i * 4 + 1] > 0) { born++; assert.ok(time[i * 4] <= uTime && time[i * 4] >= first.t - 1e-6, 'born on the clock'); }
assert.equal(born, Math.min(end.emitted, LANDING_WASH.puffs.capacity));
// spread out along the ground from the hit, with the rise slow
const vel = meshes[0].geometry.attributes.aVel.array;
for (let i = 0; i < born; i++) { const along = Math.hypot(vel[i * 3], vel[i * 3 + 2]); assert.ok(along > 5 && vel[i * 3 + 1] < along / 2, `a puff runs out along the ground (${along.toFixed(1)}, up ${vel[i * 3 + 1].toFixed(1)})`); }
// a wreck throws the bigger ring
const w2 = createLandingWash({ parent, frame: site, metres: METRES, planetRadius: 1 });
w2.tick(dt, { feet: [0, 2, 0], plume: 1, reach, pad: 0 }); const before = w2.state().emitted;
w2.tick(dt, { feet: [0, 0, 0], plume: 0, reach, pad: 0, wreck: true });
assert.equal(w2.state().emitted - before, Math.round(LANDING_WASH.burst.count * LANDING_WASH.burst.wreck), 'the wreck ring');
// dispose: off the base, the clones' GPU side released, safe twice
wash.dispose(); wash.dispose(); w2.dispose();
assert.equal(parent.children.length, 0);
wash.tick(dt, { feet: [0, 1, 0], plume: 1, reach });
console.log(`Landing wash: from ${first.altitude.toFixed(1)} m (reach ${reach.toFixed(1)} m), ${atTouch.emitted} puffs and ${atTouch.thrown} grit by the touchdown, a ring of ${LANDING_WASH.burst.count} at the cut.`);
