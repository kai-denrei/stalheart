import assert from 'node:assert/strict';
import { sample, profiles } from '../src/core/a6-missile-flight.js';
import { missileFrame, sampleMissile, OPENING_METRES, dropFrame, sampleDrop, DROP_PHASES } from '../src/domain/missile-flight.js';
import { MISSILE_DEFAULTS } from '../src/content/missile-defaults.js';
for(const profile of Object.keys(profiles)) {
  const falling=sample(.28,profile),apex=sample(.2,profile);
  assert(falling.position[1]<apex.position[1]);assert(falling.direction[1]>.8);
  assert.equal(falling.ignition,false);assert.equal(sample(.32,profile).ignition,true);
  assert.equal(sample(1,profile).ignition,false);
  for(const [from,target,dir] of [ [[0,2,0],[12,0,0],[1,1,0]],[[3,8,-9],[-4,1,2],[0,1,0]],[[0,0,0],[0,0,0],[0,0,1]] ]) {
    const frame=missileFrame(from,target,dir);
    assert.deepEqual(sampleMissile(frame,0,profile).position,from);
    const moved=target.map((v,i)=>v+(i===0?2:0));
    const end=sampleMissile(frame,1,profile,moved);
    end.position.forEach((v,i)=>assert(Math.abs(v-moved[i])<1e-9));
    for(let i=0;i<=100;i++){
      const pose=sampleMissile(frame,i/100,profile,moved);
      assert(pose.position.every(Number.isFinite));
      assert(Math.abs(Math.hypot(...pose.direction)-1)<1e-9);
    }
  }
}
// THE POP-OUT HAS A HEIGHT IN METRES (2026-09-16): a long shot's opening rises no more than OPENING_METRES over the muzzle through
// the ignition catch, a short one keeps the authored range scale exactly, the flight stays continuous through the hand-back, arrives exactly
{
  const raw=(u,profile,frame)=>sample(u,profile).position[1]*frame.distance/(24*profiles[profile].range);
  for(const profile of Object.keys(profiles)){
    const long=missileFrame([0,0,0],[0,0,235],[0,.83,.56]),short=missileFrame([0,0,0],[0,0,20],[0,.83,.56]);
    let apex=0,prev=null,maxStep=0;
    for(let i=0;i<=2000;i++){
      const u=i/2000,p=sampleMissile(long,u,profile).position;
      if(u<=.355)apex=Math.max(apex,p[1]);
      if(prev)maxStep=Math.max(maxStep,Math.hypot(...p.map((v,j)=>v-prev[j])));prev=p;
      const s=sampleMissile(short,u,profile).position;assert(Math.abs(s[1]-raw(u,profile,short))<1e-9,`${profile}: a short shot keeps the authored lift at u=${u}`);
    }
    assert(apex<=OPENING_METRES+1e-9&&apex>OPENING_METRES*.95,`${profile}: a 235 m shot pops ${apex.toFixed(2)} m, capped at ${OPENING_METRES}`);
    assert(maxStep<235/200,`${profile}: no jump through the hand-back (${maxStep.toFixed(3)} m in a step)`);
    assert(Math.abs(sampleMissile(long,.58,profile).position[1]-raw(.58,profile,long))<1e-9,`${profile}: the range scale is whole again by the end of the climb`);
    // a frame in other units: one metre is 1/753 of a unit, the cap scales with it
    const planet=missileFrame([0,0,0],[0,0,235/753],[0,.83,.56],{metre:1/753});
    assert(Math.abs(sampleMissile(planet,.2,profile).position[1]*753-sampleMissile(long,.2,profile).position[1])<1e-9,`${profile}: metre scales the cap`);
  }
}
// THE DROP PROFILE (2026-09-16: the gunship's MK-9 "drops, then it ignites after 2 seconds and heads down"). The same eject/fall/
// ignite shape, inverted. What is pinned: the free fall is unpowered ballistics for exactly `freeFall` SECONDS whatever the range,
// the motor is cold until then and lit after, nothing kinks at the catch, the nose follows the motion, and it arrives exactly.
{
  const g=9.81,freeFall=2,drive=1.8,from=[0,340,0],target=[60,0,-40],vel=[12,0,0];
  const frame=dropFrame(from,target,vel,{freeFall,drive,gravity:g,up:[0,1,0]});
  assert.equal(frame.duration,freeFall+drive);
  assert.deepEqual(sampleDrop(frame,0).position,from,'it starts at the belly');
  assert.equal(sampleDrop(frame,0).phase,'Release');
  assert(sampleDrop(frame,0).direction[0]>.99,'and leaves with the aircraft\'s own velocity, nose forward');
  for(const t of [0,.5,1,1.99]){const s=sampleDrop(frame,t);
    assert.equal(s.ignition,false,`the motor is cold at ${t} s`);
    assert(Math.abs(s.position[1]-(340-.5*g*t*t))<1e-9,`free fall is real metres at ${t} s`);
    assert(Math.abs(s.position[0]-(12*t))<1e-9,'and carries the release velocity across');}
  assert.equal(sampleDrop(frame,freeFall+.01).ignition,true,'it lights at two seconds');
  assert.equal(sampleDrop(frame,freeFall+.01).phase,'Ignite');
  assert.equal(sampleDrop(frame,freeFall+drive*.9).phase,'Dive');
  assert.equal(sampleDrop(frame,frame.duration).ignition,false,'and is out at arrival');
  sampleDrop(frame,frame.duration).position.forEach((v,i)=>assert(Math.abs(v-target[i])<1e-9,'it arrives exactly on the painted point'));
  // continuous through the ignition catch, and finite and unit-nosed the whole way down
  let prev=null,maxStep=0,before=null,after=null;
  for(let i=0;i<=3800;i++){const t=frame.duration*i/3800,p=sampleDrop(frame,t);
    assert(p.position.every(Number.isFinite));assert(Math.abs(Math.hypot(...p.direction)-1)<1e-9);
    if(prev)maxStep=Math.max(maxStep,Math.hypot(...p.position.map((v,j)=>v-prev[j])));prev=p.position;}
  before=sampleDrop(frame,freeFall-1e-4).position;after=sampleDrop(frame,freeFall+1e-4).position;
  assert(Math.hypot(...after.map((v,i)=>v-before[i]))<1e-2,`no jump at ignition (${maxStep.toFixed(2)} m in a step)`);
  // it goes DOWN under power, and faster than it fell: the whole 320 m in 1.8 s
  const lit=sampleDrop(frame,freeFall).position,late=sampleDrop(frame,freeFall+drive*.75).position;
  assert(late[1]<lit[1]*.5,'the burn drives it down, it does not climb');
  assert(sampleDrop(frame,frame.duration-1e-3).direction[1]<-.9,'and it comes in nose down');
  // a frame in other units: one metre is 1/753 of a unit, so the fall scales with it
  const planet=dropFrame([0,340/753,0],[0,0,0],[0,0,0],{freeFall,drive,gravity:g,metre:1/753,up:[0,1,0]});
  assert(Math.abs(sampleDrop(planet,1).position[1]*753-(340-.5*g))<1e-9,'metre scales the drop');
  // released from a sphere: `up` is the release point's own normal, so down is toward the centre whatever the frame
  const tilted=dropFrame([340,0,0],[1,0,0],[0,0,0],{freeFall,drive,gravity:g,up:[1,0,0]});
  assert(Math.abs(sampleDrop(tilted,1).position[0]-(340-.5*g))<1e-9,'the fall runs down the given up');
  assert.ok(dropFrame([0,1,0],[0,0,0],[0,0,0],{freeFall:2,drive:0}).drive>0,'a zero drive is floored, never divided by');
  assert.deepEqual([...DROP_PHASES],['Release','Fall','Ignite','Dive']);
}
assert.equal(MISSILE_DEFAULTS.quiver.duration,1.35);
assert.equal(MISSILE_DEFAULTS.heptapod.duration,2.7);
assert(MISSILE_DEFAULTS.quiver.length<MISSILE_DEFAULTS.heptapod.length);
console.log('Pinned missile motion: falling nose-up, ignition, finite frames and moving-target arrival pass; the drop profile falls two real seconds, lights, and dives onto the point.');
