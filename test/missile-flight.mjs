import assert from 'node:assert/strict';
import { sample, profiles } from '../src/core/a6-missile-flight.js';
import { missileFrame, sampleMissile } from '../src/domain/missile-flight.js';
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
assert.equal(MISSILE_DEFAULTS.quiver.duration,1.35);
assert.equal(MISSILE_DEFAULTS.heptapod.duration,2.7);
assert(MISSILE_DEFAULTS.quiver.length<MISSILE_DEFAULTS.heptapod.length);
console.log('Pinned missile motion: falling nose-up, ignition, finite frames and moving-target arrival pass.');
