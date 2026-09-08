import assert from 'node:assert/strict';
import { makeSequence,beginSequence,stepSequence } from '../src/domain/trigger-sequence.js';
import { FIRING } from '../src/content/firing-defaults.js';
import { TOWER_BY_KEY,effectiveStats } from '../src/towers.js';
import { createWeaponVoice } from '../src/weapon-voice.js';
for(const hz of [30,60,144]){
 for(const key of ['rotor','plasma','lancer']){
  const state=makeSequence();assert(beginSequence(state,FIRING[key]));assert(!beginSequence(state,FIRING[key]));
  let shots=0;while(state.left>0)shots+=stepSequence(state,1/hz,key==='lancer'?3:1/effectiveStats(TOWER_BY_KEY[key],0).rate);
  assert.equal(shots,key==='lancer'?1:key==='plasma'?24:50,`${key} at ${hz} Hz`);
 }
}
for(const tier of [0,1,2]){
 const d=TOWER_BY_KEY.rotor,s=effectiveStats(d,tier);
 const expected=d.dmg*(1+.55*tier)*d.rate*(1+.1*tier)*(tier===2?1.2:1);
 assert(Math.abs(s.dmg*s.rate-expected)<1e-9);
}
const calls=[];const voice=createWeaponVoice({play:k=>calls.push(k),loop:k=>{calls.push(k);return{stop:()=>calls.push('stop')}}});
voice.update('rotor',true);voice.update('rotor',true);voice.shot('rotor');voice.update('rotor',false);voice.update('rotor',false);
assert.deepEqual(calls,['minigun_ready','sentry_rotor','minigun_ready']);calls.length=0;
voice.update('lancer',true);voice.update('lancer',true);voice.shot('lancer');voice.dispose();voice.dispose();
assert.deepEqual(calls,['sentry_lancer','stop']);
console.log('Frame-rate-independent trigger counts, preserved Rotor DPS and voice lifetimes pass.');
