import assert from 'node:assert/strict';
import { sample, profiles } from '../src/core/a6-missile-flight.js';
import { missileFrame, sampleMissile, OPENING_METRES } from '../src/domain/missile-flight.js';
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
assert.equal(MISSILE_DEFAULTS.quiver.duration,1.35);
assert.equal(MISSILE_DEFAULTS.heptapod.duration,2.7);
assert(MISSILE_DEFAULTS.quiver.length<MISSILE_DEFAULTS.heptapod.length);
console.log('Pinned missile motion: falling nose-up, ignition, finite frames and moving-target arrival pass.');
