import assert from 'node:assert/strict';
import { breachPoint,breachNormal } from '../src/core/breach-surface.js';
import { makeBreachWaves,stepBreachWaves,emergence,MAX_BREACH_ENEMIES } from '../src/domain/breach-waves.js';
for(const radius of [10,14,28])for(const [x,y,z] of [[0,0,0],[3,0,4],[8,0,0],[2,-1,3],[5,2,4]]){
 const p=breachPoint([x,y,z],radius),n=breachNormal([x,y,z],radius);
 assert(Math.abs(Math.hypot(p[0],p[1]+radius,p[2])-(radius+y))<1e-9);
 assert(Math.abs(Math.hypot(...n)-1)<1e-9);
 if(y===0)assert(Math.abs(Math.acos(Math.max(-1,Math.min(1,(p[1]+radius)/radius)))*radius-Math.hypot(x,z))<1e-7);
}
assert.deepEqual(breachPoint([2,3,4],0),[2,3,4]);
const cfg={waves:3,count:8,spacing:.45,gap:3,delay:2};
let reference;
for(const hz of [30,60,144]){
 const s=makeBreachWaves(),events=[];for(let i=0;i<hz*25;i++)events.push(...stepBreachWaves(s,1/hz,cfg));
 assert.equal(events.length,24);assert.equal(events[0].at,2);assert.equal(s.wave,3);assert(s.done);
 if(reference)assert.deepEqual(events,reference);else reference=events;
}
const bounded=makeBreachWaves();assert.equal(stepBreachWaves(bounded,1000,{...cfg,waves:100,count:100}).length,MAX_BREACH_ENEMIES);
assert.deepEqual(emergence(0,1),{opacity:0,scale:.08,rise:0});assert.deepEqual(emergence(1,1),{opacity:1,scale:1,rise:1});
assert(emergence(.5,1).opacity>0&&emergence(.5,1).opacity<1);
console.log('Arc-preserving curved surface, radial normals, bounded waves and emergence pass.');
