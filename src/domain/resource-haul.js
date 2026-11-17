// One aircraft, one hold, one queued order. Resource type stays attached to the
// current job until its cargo is unloaded; switching never reinterprets cargo.
import { createRoverRun, dispatch, stepRover, settleBreak } from './rover-run.js';
export function createResourceHaul(home, tunes, resources) {
  const run=createRoverRun(tunes.biomass,home), delivered={biomass:0,mineral:0};let kind='biomass';
  const choose=()=>{if(run.mode==='idle'){const next=run.queued&&resources[run.queued.kind].live(run.queued)?run.queued:run.order;if(next)kind=next.kind;}run.tune=tunes[kind];};
  const api={
    run, kind:()=>kind, delivered,
    dispatch(type,order){if(!resources[type])return false;const how=dispatch(run,{...order,kind:type});choose();return how;},
    step(dt,now,route){choose();stepRover(run,dt,now,{...route,
      live:o=>resources[o.kind??kind].live(o),near:(c,r)=>resources[kind].near(c,r),take:(c,n)=>route.grounded===false?0:resources[kind].take(c,n),
      deposit:n=>{const got=route.grounded===false?0:resources[kind].deposit(n);delivered[kind]+=got;return got;}});},
    settle(now,flares,room){const saved=run.tune,cargo=run.cargo;run.tune={...saved,reach:tunes.biomass.reach,breakShare:tunes.biomass.breakShare};
      const out=settleBreak(run,now,{...resources.biomass,flares,room});run.tune=saved;delivered[kind]+=Math.min(cargo,out.cargo);delivered.biomass+=out.field;return out;},
  };return api;
}

// Prefer a ready idle hold, then an aircraft with an empty queue. Printed
// reinforcements do not receive work until their fabrication completes.
export function selectHauler(states) {
 const eligible=states.map((s,index)=>({s,index})).filter(({s})=>s.ready&&!s.printing);
 const load=s=>s.mode==='idle'&&s.queued==null?0:s.queued==null?1:2;
 eligible.sort((a,b)=>load(a.s)-load(b.s)||a.s.trips-b.s.trips||a.index-b.index);
 return eligible[0]?.index??-1;
}
