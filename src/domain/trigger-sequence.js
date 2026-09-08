export const makeSequence=()=>({left:0,gap:0});
export function beginSequence(state,profile){if(state.left>0)return false;state.left=profile.duration;state.gap=profile.spinUp||0;return true;}
export function stepSequence(state,dt,interval){
  if(dt<=0||state.left<=0)return 0;
  const elapsed=Math.min(dt,state.left);state.left=Math.max(0,state.left-dt);state.gap-=elapsed;
  let shots=0;while((state.gap < -1e-9 || (state.gap<=0 && state.left>1e-9)) && shots<64){shots++;state.gap+=interval;}
  return shots;
}
