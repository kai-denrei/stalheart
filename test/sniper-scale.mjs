import assert from 'node:assert/strict';
import {scaleSniperWeapon} from '../src/domain/sniper-scale.js';
const source=Object.freeze({range:35,minRange:3,muzzleVel:35,damage:.2,cooldown:1});
for(const multiplier of [1,3,5]){
 const w=scaleSniperWeapon(source,multiplier);
 assert.equal(w.range,35*multiplier);assert.equal(w.minRange,3*multiplier);
 assert(Math.abs(w.muzzleVel**2/source.muzzleVel**2-multiplier)<1e-10);
 assert.equal(w.damage,source.damage);assert.equal(w.cooldown,source.cooldown);
}
assert.equal(source.range,35);console.log('Sniper range scale preserves content and ballistic reach.');
