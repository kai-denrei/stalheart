// hull-body-contact.mjs — src/fx/hull-contact.js (not src/domain/hull-contact.js, the rock's faces: test/hull-contact.mjs), the tank's hull against the Pearl bodies, moved out of src/fx/creature-enemies.js unchanged (2026-10-14, the
// refactor review's finding 2; the swarm lab's lane uses it too): the hull's box from the drawn mesh, the pushes taken once along each way, the `again`
// gate (a light tier's brush every time, a contact booked once), the speed share a soft body takes as drag and run-up scrub, a cored body's full stop,
// the step shortened by the drag, the ground put back after every move, the settle pass, nothing booked there.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createHullContact, onUnitSphere } from '../src/fx/hull-contact.js';
import { PEARL_IMPACT } from '../src/content/pearl-enemies.js';
import { contactLoss, stepDrag } from '../src/domain/hull-bodies.js';

const close = (a, b, eps, what) => assert(Math.abs(a - b) <= eps, `${what}: ${a} vs ${b}`);
const Kc = PEARL_IMPACT.contact;
const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4)), hw = 1, hl = 2;   // half width 1, half length 2 in the mesh's units
let script = () => {}, clock = 0, grounds = 0;
const brushed = [], hits = [];
const make = (k = 3, ground = (p) => { grounds++; }) => createHullContact({ tune: PEARL_IMPACT, mesh: () => mesh, heading: () => [0, 0, 1], metres: () => k,
  hull: (tank, drive, sink) => { script(tank, drive, sink); return 1; }, ground, now: () => clock, brush: (who, tier) => brushed.push([who.id, tier]), hit: (who, cored, r, tier) => hits.push([who.id, cored, tier]) });

// the box: the mesh's footprint x its scale x metres a unit, never under minHalf
{
  const hc = make(3), t = hc.hullAt([0, 0, 0]);
  close(t.hl, Math.max(Kc.minHalf, hl * 3), 1e-9, 'half length'); close(t.hw, Math.max(Kc.minHalf, hw * 3), 1e-9, 'half width'); assert.deepEqual(t.dir, [0, 0, 1]);
  const tiny = make(0.1).hullAt([0, 0, 0]); assert.equal(tiny.hl, Kc.minHalf); assert.equal(tiny.hw, Kc.minHalf);
  assert.equal(createHullContact({ tune: PEARL_IMPACT, mesh: () => mesh, heading: () => [0, 0, 1], metres: () => null, hull() {}, now: () => 0 }).hullAt([0, 0, 0]), null, 'no bodies, no hull');
  assert.equal(createHullContact({ tune: PEARL_IMPACT, mesh: () => mesh, heading: () => null, metres: () => 1, hull() {}, now: () => 0 }).hullAt([0, 0, 0]), null, 'no tank, no hull');
}
console.log('PASS the box: the drawn hull\'s footprint in metres, at least minHalf; none without bodies or a tank');

// the pushes: two bodies pushing the same way move the tank once, crossing ways add, nothing booked on a push
{
  const hc = make(1), p = [0, 0, 0];
  script = (tank, drive, sink) => { sink.push(1, 0, 0); sink.push(1, 0, 0); sink.push(0.5, 0, 0); sink.push(0, 0, 2); };
  grounds = 0; hc.bodyContact([0, 0, 0], p, 1 / 60, null);
  close(p[0], 1, 1e-12, 'the same way taken once'); close(p[2], 2, 1e-12, 'a crossing way adds'); close(hc.lastPush(), Math.hypot(1, 2), 1e-12, 'the push in metres');
  assert.equal(grounds, 1, 'the ground put back once, after the push'); assert.equal(hc.drag(), 0, 'pushes alone are no drag');
}
console.log('PASS the pushes: each body\'s taken only beyond what the others moved it along its own way, then the ground');

// the touch: a light tier's brush every time; a contact booked once in `again` s; a soft body's speed share is the drag and the scrub; a cored one stops it
{
  const hc = make(1), who = { id: 'a' }, scrubs = [];
  brushed.length = 0; hits.length = 0; clock = 10;
  script = (tank, drive, sink) => { if (drive) sink.touch(who, false, 2.8, 'white'); };
  const p = [0, 0, 1];
  hc.bodyContact([0, 0, 0], p, 1 / 60, (k) => scrubs.push(k));
  const loss = contactLoss(2.8, Kc) * (PEARL_IMPACT.tiers.white.mass ?? 1);
  assert.deepEqual(hits, [['a', false, 'white']]); assert.deepEqual(brushed, [['a', 'white']]);
  close(hc.drag(), loss, 1e-12, 'the drag is the body\'s share'); assert.deepEqual(scrubs, [loss], 'and the run-up scrubbed by it');
  clock += Kc.again / 2; hc.bodyContact([0, 0, 0], [0, 0, 1], 1 / 60, (k) => scrubs.push(k));
  assert.equal(hits.length, 1, 'not booked again within `again`'); assert.equal(brushed.length, 2, 'brushed again');
  assert.equal(who.hullAt, clock, 'the gate moves with every touch');
  clock += Kc.again * 1.01; hc.bodyContact([0, 0, 0], [0, 0, 1], 1 / 60, null); assert.equal(hits.length, 2, 'booked again after `again`');
  // the drag shortens the next step (recovering by stepDrag first)
  const d0 = hc.drag(); script = () => {};
  const q = [0, 0, 1]; hc.bodyContact([0, 0, 0], q, 1 / 60, null);
  close(q[2], 1 - stepDrag(d0, 1 / 60, Kc), 1e-12, 'the step that much shorter');
  // a cored body: the full stop's drag and a whole scrub
  const hc2 = make(1), s2 = []; clock = 100;
  script = (tank, drive, sink) => { if (drive) sink.touch({ id: 'c' }, true, 4, 'brown'); };
  hc2.bodyContact([0, 0, 0], [0, 0, 1], 1 / 60, (k) => s2.push(k));
  assert(hc2.drag() >= Kc.cored, 'a cored body takes the hull\'s speed'); assert.deepEqual(s2, [1], 'and the whole run-up');
}
console.log('PASS the touch: the brush every time, a contact booked once in `again`, the soft share as drag and scrub, the shortened step, the cored stop');

// the settle: after the bodies step, a body in the hull pushes it out, nothing booked; on the unit sphere the point stays on it
{
  hits.length = 0;
  const hc = createHullContact({ tune: PEARL_IMPACT, mesh: () => mesh, heading: () => [0, 1, 0], metres: () => 1, now: () => 0, ground: onUnitSphere,
    hull: (tank, drive, sink) => { assert.equal(drive, false); sink.push(0.01, 0, 0); sink.touch({ id: 's' }, true, 3, 'black'); return 1; }, hit: () => hits.push(1) });
  const pos = [0, 0, 1]; hc.settle(pos);
  assert(pos[0] > 0, 'pushed out'); close(Math.hypot(...pos), 1, 1e-12, 'on the unit sphere'); assert.equal(hits.length, 0, 'nothing booked in the settle');
  const v = [3, 4, 0]; onUnitSphere(v); assert.deepEqual(v, [0.6, 0.8, 0]);
}
console.log('PASS the settle: a body in the hull pushes it out where it stands, nothing booked; the unit sphere\'s ground');
