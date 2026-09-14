import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createThermalHeat, HEAT } from '../src/fx/thermal-heat.js';

const basic = new THREE.MeshBasicMaterial({ color: 0x223344 });
const lambert = new THREE.MeshLambertMaterial({ color: 0x556677, emissive: 0x000000 });
const shared = new THREE.MeshBasicMaterial({ color: 0x101010 });
const hull = new THREE.Group(); hull.add(new THREE.Mesh(new THREE.BoxGeometry(), basic), new THREE.Mesh(new THREE.BoxGeometry(), shared));
const stalheart = new THREE.Group(); stalheart.add(new THREE.Mesh(new THREE.BoxGeometry(), lambert), new THREE.Mesh(new THREE.BoxGeometry(), shared));
const heat = createThermalHeat(() => ({ warm: [hull, null], hot: [stalheart] }), { every: 1e9 });

heat.set(true);
const warmTarget = new THREE.Color(0x223344).lerp(new THREE.Color(1, 1, 1), HEAT.warm);
assert.ok(Math.abs(basic.color.r - warmTarget.r) < 1e-6, 'a warm part goes part way to white');
assert.ok(lambert.emissive.r > 0.99 && lambert.emissiveIntensity >= 1, 'a hot lit part glows white');
assert.ok(shared.color.r > 0.99, 'a material in both lists takes the hot level');
assert.equal(heat.heated(), 3);
heat.set(true);
assert.ok(Math.abs(basic.color.r - warmTarget.r) < 1e-6, 'applying twice does not compound');

heat.set(false);
assert.equal(basic.color.getHex(), 0x223344, 'off restores the colour');
assert.equal(lambert.emissive.getHex(), 0x000000, 'and the glow');
assert.equal(shared.color.getHex(), 0x101010);
assert.equal(heat.heated(), 0);
heat.dispose();
console.log('Thermal heat: warm and hot parts brighten, shared materials take the hotter level, off restores them.');
