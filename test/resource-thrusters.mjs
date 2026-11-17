import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createResourceThrusters } from '../src/fx/resource-thrusters.js';
const scene = new THREE.Scene(), holder = new THREE.Group(), model = new THREE.Group();
holder.position.set(0, 1, 0); holder.scale.setScalar(.001); holder.add(model); scene.add(holder);
for (const id of ['FL','FR','RL','RR']) { const s = new THREE.Group(); s.name = `SOCKET_EXHAUST_${id}`; model.add(s); }
const fx = createResourceThrusters({ model, holder, scene, metres: .001 });
holder.position.y = 1.032; fx.tick(.1, 1, 32);
assert.equal(fx.state().sockets, 4); assert.ok(fx.state().intensity > 0); assert.equal(fx.state().wash.emitted, 0);
holder.position.y = 1.002;
for (let i = 0; i < 20; i++) fx.tick(.1, 2 + i / 10, 2);
assert.ok(fx.state().wash.emitted > 0, 'descending engines push smoke along the ground');
const root = scene.getObjectByName('LandingWash'), frame = root.matrix.clone();
holder.position.x = .01; fx.tick(.1, 4, 2);
assert.ok(root.matrix.equals(frame), 'the emitted smoke stays behind');
fx.tick(.1, 4.1, 0); assert.equal(fx.state().intensity, 0, 'landed engines extinguish');
fx.dispose(); assert.equal(scene.children.length, 1); assert.ok(model.children.every(s=>s.children.length===0));
console.log('SAI thrusters: four sockets, flight glow, grounded wash, fixed smoke frame, shutdown and cleanup.');
