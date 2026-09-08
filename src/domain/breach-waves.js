export const MAX_BREACH_ENEMIES=96;
export function makeBreachWaves(){return {time:0,spawned:0,wave:0,done:false};}
export function stepBreachWaves(state,dt,config){
 if(dt<=0||state.done)return [];
 state.time+=dt;
 const count=Math.max(1,Math.min(24,Math.round(config.count))),waves=Math.max(1,Math.min(4,Math.round(config.waves)));
 const spacing=Math.max(.1,config.spacing),gap=Math.max(0,config.gap),start=Math.max(0,config.delay);
 const events=[];
 while(state.spawned<Math.min(MAX_BREACH_ENEMIES,count*waves)){
  const wave=Math.floor(state.spawned/count),index=state.spawned%count;
  const at=start+wave*(count*spacing+gap)+index*spacing;
  if(state.time<at)break;
  events.push({id:state.spawned,wave:wave+1,index,at});state.spawned++;state.wave=wave+1;
 }
 state.done=state.spawned===Math.min(MAX_BREACH_ENEMIES,count*waves);
 return events;
}
export function emergence(age,duration){
 const t=Math.max(0,Math.min(1,age/Math.max(.1,duration))),ease=t*t*(3-2*t);
 return {opacity:ease,scale:.08+.92*ease,rise:ease};
}
