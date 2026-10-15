import {parseCage} from './fx/reed/physics/cage-model.js';
import {SoftBody} from './fx/reed/physics/soft-body.js';
import {PHYS} from './fx/reed/physics/constants.js';
import {MonsterBehavior} from './fx/reed/monster/behavior.js';
import {DEFAULT_MOTION} from './fx/reed/monster/motion-settings.js';

// Ovum shares Nih-Dairia's six-limb body plan. Run its native physical gait on
// a slow clock: sensor arms reach, support legs plant, then the abdomen follows.
export function createQueenActor(buffer,manifest){
  const body=new SoftBody({...parseCage(buffer,manifest),variant:'ovum'});
  const motion=new MonsterBehavior(body,{...DEFAULT_MOTION,speed:.65,reachTime:1.3,pullTime:1.5,pauseTime:.8,erratic:.2,stretch:1.25,spread:1.2,stepDuration:.35,stepSpacing:.12});
  let accumulator=0;
  function reset(){
    motion.reset();motion.feeding.enabled=false;motion.active=false;accumulator=0;
    for(let i=0;i<100;i++){motion.step(PHYS.step);body.step(PHYS.step);}
    motion.active=true;motion.target.set(.04,.012,.12);motion.stimulus=1;body.updateSurface();
  }
  function update(dt){
    accumulator+=Math.min(.05,Math.max(0,dt))*.2;let steps=0;
    while(accumulator>=PHYS.step){
      const angle=motion.time*.12;motion.target.set(motion.torsoCenter.x+Math.sin(angle)*.1,.012,motion.torsoCenter.z+Math.cos(angle)*.12);motion.stimulus=1;
      motion.step(PHYS.step);body.step(PHYS.step);accumulator-=PHYS.step;steps++;
    }
    if(steps){if(!body.isFinite())throw Error('Queen physics became non-finite');body.updateSurface();}
    return steps;
  }
  reset();return {body,motion,update,reset,stats:()=>({phase:motion.pursuit.phase,burst:motion.pursuit.burst,surfaceRevision:body.surfaceRevision,clockScale:.2})};
}
