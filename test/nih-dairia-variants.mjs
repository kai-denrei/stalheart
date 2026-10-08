// The kit's scripts/verify-variants.mjs as of the export's commit f2a4f89 (lab-creatures, kai-denrei;
// derived from Jelly Baby by scottstts; GPL-3.0, see src/fx/nih-dairia/LICENSE), pointed at the port.
// Changes from the kit's script: imports go to src/fx/nih-dairia; the models load from
// assets/creatures/nih-dairia relative to this file; the per-variant console.log lines are folded into
// the one summary line at the end. Nothing is dropped. Added: one check that the ported
// CREATURE_VARIANTS names the same four body plans and limb counts the script walks.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { MonsterBehavior } from '../src/fx/nih-dairia/behavior.js';
import { CREATURE_VARIANTS } from '../src/fx/nih-dairia/variants.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
const plans=[['nih-dairia',6],['brood',6],['reed',4],['crown',8]];
assert.deepEqual(CREATURE_VARIANTS.map(v=>[v.id,v.limbs]),plans,'the variants list names the four exported body plans');
const summary=[];
for(const [name,count] of [['nih-dairia',6],['brood',6],['reed',4],['crown',8]]){
 const bytes=readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`,import.meta.url)),metadata=JSON.parse(readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`,import.meta.url),'utf8'));
 const body=new SoftBody(parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),metadata)),rig=new MonsterBehavior(body);
 assert.equal(rig.gait.feet.length,count);assert.equal(rig.pursuit.count,count);
 const tick=()=>{rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12,`${name}: valid tetrahedra`);};
 rig.active=false;for(let i=0;i<360;i++)tick();
 assert(body.contact.some(v=>v>0),`${name}: supported stance`);
 const start=rig.center.x;rig.active=true;rig.feeding.enabled=false;rig.target.set(.22,.012,0);rig.stimulus=1;
 for(let i=0;i<960;i++)tick();assert(rig.center.x>start+.01,`${name}: pursues prey`);
 rig.reset();rig.active=false;rig.feeding.enabled=true;
 for(let i=0;i<240;i++)tick();
 rig.target.set(rig.torsoCenter.x+.06,.012,rig.torsoCenter.z);rig.active=true;
 const phases=new Set();let lastGap=Infinity,wrapped=false;
 for(let i=0;i<3000&&rig.feeding.meals===0;i++){
  tick();phases.add(rig.feeding.phase);
  if(rig.feeding.phase==='cradling'){lastGap=rig.cradle.minimumGap;wrapped=true;}
 }
 summary.push(`${name} ${count} limbs, gap ${lastGap.toFixed(4)} m`);
 assert(wrapped&&phases.has('covering')&&rig.feeding.meals===1,`${name}: cradle and feeding complete`);
 assert(lastGap>=-.0005,`${name}: sampled membrane clears prey before covering`);
 assert(body.volumeRatio()>.75&&body.volumeRatio()<1.25);
 body.surface.geometry.dispose();body.cage.opticalSurface.geometry.dispose();
}
console.log(`Nih-Dairia variants: ${summary.join('; ')}; each stands, pursues, cradles and feeds, as the kit verifies them.`);
