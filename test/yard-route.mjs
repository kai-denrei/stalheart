import assert from 'node:assert/strict';
import {yardRoute,clearYardSegment} from '../src/domain/yard-route.js';
const obstacles=[{min:[-3,-3],max:[3,3]},{min:[4,2],max:[8,8]}];
const path=yardRoute([-10,0],[12,4],obstacles);assert(path.length>2);assert.deepEqual(path[0],[-10,0]);assert.deepEqual(path.at(-1),[12,4]);
for(let i=1;i<path.length;i++)assert(clearYardSegment(path[i-1],path[i],obstacles));
assert.deepEqual(yardRoute([-10,-10],[10,-10],obstacles),[[-10,-10],[10,-10]]);
assert.deepEqual(yardRoute([0,0],[12,4],obstacles),[]);
console.log('Yard routes clear prop footprints and fail closed when trapped.');
