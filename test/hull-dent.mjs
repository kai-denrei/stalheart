// hull-dent.mjs — a dent you cannot miss (owner, 2026-11-02, round 4, note 7; src/fx/hull-dent.js, src/tankfeel.js applyTankHealth's gauge on the
// armour, HULL_DENT in src/content/tank.js): the dent shoves, kicks the jolt as a cored touch, flashes the tab root, calls HULL DAMAGE and sounds the
// alarm; the gauge paints the running lights' wire twins and mixes the armour's parts toward its colour by the armour lost, in both looks.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createHullDent } from '../src/fx/hull-dent.js';
import { applyTankHealth, healthColor } from '../src/tankfeel.js';
import { setWireframe } from '../src/fx/model-fixture.js';
import { HULL_DENT } from '../src/content/tank.js';

{
  const log = [], classes = new Set();
  const container = { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) }, offsetWidth: 1 };
  const d = createHullDent({ container, sfx: { play: (k, o) => log.push(['sfx', k, o.gain]) }, jolt: { kick: (o) => log.push(['kick', o.radius, o.solid]) },
    playerMesh: () => null, health: () => 0.5, bump: (k) => log.push(['bump', k]), callout: (x, c) => log.push(['callout', x, c]) });
  d.dent();
  assert.deepEqual(log, [['bump', HULL_DENT.bump], ['kick', HULL_DENT.jolt, true], ['callout', 'HULL DAMAGE', 'co-dent'], ['sfx', 'danger_alert', 0.5]]);
  assert(classes.has('hull-dent'), 'the flash class on the tab root');
  assert(HULL_DENT.bump > 0.6, 'a harder shove than the 0.6 it was');
  d.dent(); assert.equal(d.state().dents, 2);
}
console.log('PASS the dent: the shove, a cored kick, the flash, HULL DAMAGE, the alarm');

const hull = () => {
  const lift = new THREE.MeshStandardMaterial({ name: 'Lift field / cyan', color: 0x02b8ff, emissive: 0x02b8ff });
  const armour = new THREE.MeshStandardMaterial({ name: 'Mork armor / midnight petrol', color: 0x0d1a1f });
  const frame = new THREE.MeshStandardMaterial({ name: 'Structural frame / blue steel', color: 0x293b42 });
  const root = new THREE.Group(), g = new THREE.BoxGeometry(1, 1, 1);
  const [l, a, f] = [lift, armour, frame].map((m) => { const o = new THREE.Mesh(g, m); root.add(o); return o; });
  root.userData.healthBeam = [lift];
  return { root, l, a, f, armour, frame };
};
const rgb = (c) => [c.r, c.g, c.b];
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
{
  // the wire look (the default): the lift field's wire IS the gauge now, the armour's wire mixes toward it, the frame's is left alone
  const h = hull(); setWireframe(h.root, true, { tint: true });
  const frame0 = rgb(h.f.material.color), armour0 = rgb(h.a.material.color);
  applyTankHealth(h.root, 1);
  assert(dist(rgb(h.a.material.color), armour0) < 1e-9, 'whole armour: the plates as drawn');
  applyTankHealth(h.root, 0.25);
  const red = healthColor(0.25), lit = red.map((v) => v + (1 - v) * 0.3);
  assert(dist(rgb(h.l.material.color), lit) < 1e-6, 'the lift field\'s wire takes the gauge (it stayed cyan before)');
  assert(dist(rgb(h.a.material.color), lit) < dist(armour0, lit) * (1 - HULL_DENT.gauge.share) + 1e-6, 'three dents down, the plates mostly the gauge\'s red');
  assert(dist(rgb(h.f.material.color), frame0) < 1e-9, 'the frame is not armour');
  applyTankHealth(h.root, 1);
  assert(dist(rgb(h.a.material.color), armour0) < 1e-9, 'repaired: the plates back to their own colour (the base kept)');
  // the solid look: the armour's emissive glows a share of the gauge, the wire twin is not the drawn material any more
  setWireframe(h.root, false); applyTankHealth(h.root, 0.25);
  const e = rgb(h.armour.emissive); assert(e[0] > 0.3 && e[0] > e[2] * 3, `the solid plates glow red (${e.map((v) => v.toFixed(2))})`);
  applyTankHealth(h.root, 1); assert(dist(rgb(h.armour.emissive), [0, 0, 0]) < 1e-9, 'and go dark again when whole');
}
{
  // a basic-material part (no emissive) and a unit with no gauge are safe
  const h = hull(); h.a.material = new THREE.MeshBasicMaterial({ name: 'Mork armor', color: 0x101010 }); h.root.userData.gaugeParts = undefined;
  applyTankHealth(h.root, 0.5); applyTankHealth(new THREE.Group(), 0.5); applyTankHealth(null, 0.5);
}
console.log('PASS the gauge on the hull: the lift field\'s wire is the gauge, the armour mixes toward it by the armour lost (wire and solid), the rest untouched');
