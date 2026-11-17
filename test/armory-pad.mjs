import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import {createArmoryPad} from '../src/fx/armory-pad.js';
import {BASE_PERKS} from '../src/content/base-programme.js';
const scene=new THREE.Scene(),pad=createArmoryPad(scene,{pos:[0,1,0],cellSide:.01,tune:BASE_PERKS.armory});
assert.equal(pad.state().crates,0);pad.stand(true);assert.equal(pad.state().crates,2);assert.equal(pad.state().warheads,13);
assert.equal(pad.tick(1,[0,1,0],0,12,1),2);assert.equal(pad.tick(1,[1,0,0],0,12,2),0);
pad.stand(false);assert.equal(pad.state().warheads,0);pad.dispose();assert.equal(scene.children.length,0);
console.log('Shell works: two warhead crates, conveyor, real refill rate and cleanup.');
