import {parseCage} from './fx/reed/physics/cage-model.js';
import {SoftBody} from './fx/reed/physics/soft-body.js';
import {PHYS} from './fx/reed/physics/constants.js';
import {MonsterBehavior} from './fx/reed/monster/behavior.js';

// Renderer-independent Creature Lab actor. The host supplies the cave surface frame.
export function createReedActor(buffer,manifest,index=0){
  const body=new SoftBody({...parseCage(buffer,manifest),variant:'reed'});
  const motion=new MonsterBehavior(body);motion.feeding.enabled=false;
  let accumulator=0,direction=index%2?-1:1;
  function target(){motion.target.set(index%2?.012:-.012,.012,direction*.18);motion.stimulus=1;}
  function reset(){
    motion.reset();motion.feeding.enabled=false;motion.active=false;accumulator=0;direction=index%2?-1:1;
    for(let i=0;i<100;i++){motion.step(PHYS.step);body.step(PHYS.step);}
    motion.active=true;target();
    for(let i=0;i<index*24;i++){motion.step(PHYS.step);body.step(PHYS.step);}
    body.updateSurface();
  }
  function update(dt){
    accumulator+=Math.min(.05,Math.max(0,dt));let steps=0;
    while(accumulator>=PHYS.step){
      if(direction*motion.torsoCenter.z>.12){direction*=-1;target();}
      motion.step(PHYS.step);body.step(PHYS.step);accumulator-=PHYS.step;steps++;
    }
    if(steps){if(!body.isFinite())throw Error('Reed physics became non-finite');body.updateSurface();}
    return steps;
  }
  reset();
  return {body,motion,update,reset,stats:()=>({phase:motion.pursuit.phase,reach:motion.pursuit.reach,burst:motion.pursuit.burst,center:body.center.toArray(),surfaceRevision:body.surfaceRevision})};
}
