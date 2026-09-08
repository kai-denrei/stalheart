import assert from 'node:assert/strict';
import { manualWeapon } from '../src/domain/manual-weapon.js';
import { TOWERS, effectiveStats } from '../src/towers.js';
import { baselinePreset } from '../src/content/preset.js';
import { METRES_PER_CELL } from '../src/core/stage-units.js';
import { A6_TUNE } from '../src/domain/heptapod.js';
const content=baselinePreset();
for(const def of TOWERS)for(const tier of [0,1,2]){
 const stats=effectiveStats(def,tier),fx=content.weapons[def.key];
 const w=manualWeapon(def,stats,fx,content.missiles[def.key],METRES_PER_CELL);
 assert.equal(w.label,def.label);assert.equal(w.sound,def.fire);assert.equal(w.model,def.model);
 assert.equal(w.pierce,!!def.pierce);assert.equal(w.damage,stats.dmg);assert.equal(w.kind,fx.shot.kind);
 assert.equal(w.cooldown,def.attack==='walker'?A6_TUNE.salvoGap:1/stats.rate);
 assert.equal(w.field,def.key==='relay');assert.equal(w.homing,!!content.missiles[def.key]);
 assert.equal(w.hitscan,['lancer','plasma'].includes(def.key));
 assert.equal(w.loft,['mortar'].includes(def.key));
 assert.equal(w.splash,(stats.splash||0)*METRES_PER_CELL);
 if(w.homing){assert.equal(w.minRange,3);assert.equal(w.range,30*(stats.range/def.range));}
 else assert.equal(w.range,stats.range*METRES_PER_CELL);
}
const def=TOWERS.find(d=>d.key==='quiver'),stats=effectiveStats(def,0);
const custom={...content.missiles.quiver,minRange:9,maxRange:40};
assert.equal(manualWeapon(def,stats,content.weapons.quiver,custom,10).range,40);
assert.equal(content.missiles.quiver.maxRange,30);
console.log('Manual Sentries derive identity, weapon kind, cadence, damage, range and sound from shared owners.');
