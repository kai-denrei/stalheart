import assert from 'node:assert/strict';
import {makeShield,SHIELD_TUNE,stepShieldFrame,deploy,towerOffline} from '../src/domain/shield.js';
for(const hz of [10,30,60,144]){
 const st=makeShield(),dt=1/hz;let drops=0;
 for(let i=1;i<=hz*8;i++)drops+=stepShieldFrame(st,dt,i*dt,{relays:[4]});
 assert.equal(drops,0);assert(Math.abs(st.t-4)<1e-6); // 1.5 in, 1 out per second
 assert.equal(st.rack,2);assert.equal(deploy(st,8),'up');
 assert(towerOffline(st,4,12.99));
 for(let i=1;i<=hz*5;i++)drops+=stepShieldFrame(st,dt,8+i*dt);
 assert.equal(drops,1);assert(!towerOffline(st,4,13));
 assert.equal(deploy(st,st.coolUntil-.001),'cooling');
 assert.equal(deploy(st,st.coolUntil),'ok');
}
const low=makeShield();let drops=0;
for(let i=1;i<600;i++)drops+=stepShieldFrame(low,1/60,i/60,{relays:[4]},{...SHIELD_TUNE,tapRate:.25});
assert.equal(low.t,0);assert.equal(drops,0);assert.equal(low.coolUntil,-Infinity);
const pad=makeShield();pad.stationLeft=.001;
assert.equal(stepShieldFrame(pad,1/60,1,{station:true}),false);
assert.equal(stepShieldFrame(pad,1/60,2,{station:true}),false);
assert.equal(pad.coolUntil,-Infinity);
console.log('Continuous Relay charging, frame-rate independence, one drop, cooldown recovery and weak-source stability pass.');
