import assert from 'node:assert/strict';
import {stepYardDrive} from '../src/domain/yard-drive.js';
const s={x:0,z:0,yaw:0,speed:0},box={min:[-10,20],max:[10,30]};
for(let i=0;i<300;i++)stepYardDrive(s,{throttle:1,turn:0},1/60,[box],5);
assert(s.z>10&&s.z<=15);assert(s.blocked);assert.equal(s.speed,0);
for(let i=0;i<60;i++)stepYardDrive(s,{throttle:-1,turn:0},1/60,[box],5);assert(s.z<12);
const old=s.yaw;stepYardDrive(s,{throttle:0,turn:1},.05,[],5);assert(s.yaw>old);
for(let i=0;i<60;i++)stepYardDrive(s,{throttle:0,turn:0},1/60,[],5);assert.equal(s.speed,0);
console.log('Yard drive accelerates, brakes, reverses and stops at structures.');
