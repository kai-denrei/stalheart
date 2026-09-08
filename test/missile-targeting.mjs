import assert from 'node:assert/strict';
import { missileGroundDistance, missileTargetInRange, pickMissileTarget } from '../src/domain/missile-targeting.js';
const limits = { minRange: 3, maxRange: 30 };
const from = [10, 7, -5];
const target = (id, distance, extra = {}) => ({ id, pos: [10 + distance, 0, -5], up: true, hp: 2, ...extra });
assert.equal(missileGroundDistance(from, [13, 100, -1]), 5); // Height does not change a ground-distance band.
for (const [distance, expected] of [[0,false],[2.99,false],[3,true],[30,true],[30.01,false]]) {
  assert.equal(missileTargetInRange(target(1,distance),from,limits),expected);
}
const targets = [target(1,1),target(2,20),target(3,8),target(4,40)];
assert.equal(pickMissileTarget(targets,from,-1,limits),2); // A too-close nearest target cannot starve eligible ones.
assert.equal(pickMissileTarget(targets,from,2,limits),1); // Retain a valid acquired target.
targets[1].pos[0] = 12; // Acquired target crosses the minimum.
assert.equal(pickMissileTarget(targets,from,2,limits),2);
targets[2].pos[0] = 41; // Remaining eligible target crosses the maximum.
assert.equal(pickMissileTarget(targets,from,3,limits),-1);
assert.equal(pickMissileTarget([target(1,5,{up:false}),target(2,10,{hp:0})],from,-1,limits),-1);
assert.equal(pickMissileTarget([target(1,8)], [16,0,-5], -1, limits),-1); // Each tower uses its own base.
assert.equal(pickMissileTarget([target(1,8)], from, -1, limits),0);
assert.equal(pickMissileTarget([target(1,8)],from,-1,{minRange:10,maxRange:30}),-1); // Live band edits apply immediately.
console.log('Missile acquisition: per-launcher ground distances, inclusive bounds, retention and out-of-band exclusion pass.');

const { stepMissileLock, missileCanFire, missileLimits } = await import('../src/domain/missile-targeting.js');
const { makeLock } = await import('../src/domain/lockon.js');
const { arc } = await import('../src/heptapod.js');
const { metresToArc, arcToMetres } = await import('../src/core/stage-units.js');
const config={...limits,lockGate:6,lockBreak:18,lockTime:1.1,aimTolerance:2.5};
const cellSide=.1, sphereFrom=[0,1,0];
const sphereTarget=(id,metres,alive=true)=>({id,alive,pos:[Math.sin(metresToArc(metres,cellSide)),Math.cos(metresToArc(metres,cellSide)),0]});
const sphereDistance=(a,b)=>arcToMetres(arc(a,b),cellSide);
for(const distances of [[1,20,8,40],[2,31,32],[4,29,6]]){
 const flat=distances.map((d,i)=>target(i,d)),sphere=distances.map((d,i)=>sphereTarget(i,d));
 for(const keep of [-1,0,1,2])assert.equal(pickMissileTarget(flat,from,keep,config),pickMissileTarget(sphere,sphereFrom,keep,config,sphereDistance,e=>e.alive));
}
assert.equal(missileLimits(config,1.16).maxRange,34.8);
assert.equal(missileLimits(config,1.16).minRange,3);
const lock=makeLock(),a=target(7,10),b=target(8,10);
stepMissileLock(lock,.6,a,10,0,config);const progress=lock.meter;
stepMissileLock(lock,0,a,10,0,config);assert.equal(lock.meter,progress);
stepMissileLock(lock,.2,b,10,0,config);assert(lock.meter<progress);assert.equal(lock.id,b.id);
stepMissileLock(lock,1,b,10,0,config);assert(lock.locked);
assert(missileCanFire(lock,b,10,0,config));
assert(!missileCanFire(lock,a,10,0,config));
assert(!missileCanFire(lock,b,10,0,config,.1));
assert(!missileCanFire(lock,b,10,0,config,0,false));
assert(!missileCanFire(lock,b,10,3,config));
stepMissileLock(lock,.1,b,10,19,config);assert(!lock.locked);
for(const [candidate,d] of [[null,10],[b,2],[b,31]]){
 stepMissileLock(lock,2,b,10,0,config);assert(lock.locked);
 stepMissileLock(lock,0,candidate,d,0,config);assert.equal(lock.id,null);assert.equal(lock.meter,0);assert.equal(lock.locked,false);
}
for(const boundary of [3,30]){
 const edge=sphereTarget(80,boundary),d=sphereDistance(sphereFrom,edge.pos);
 assert.equal(pickMissileTarget([edge],sphereFrom,-1,config,sphereDistance,e=>e.alive),0);
 stepMissileLock(lock,2,edge,d,0,config);assert(missileCanFire(lock,edge,d,0,config));
}
console.log('Shared missile locks: flat/sphere parity, target changes, pause, bounds, cooldown and pool readiness pass.');
