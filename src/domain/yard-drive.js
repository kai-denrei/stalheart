// Flat-yard driving, isolated from the sphere game's movement/balance rules.
export function stepYardDrive(state,input,dt,boxes,radius=5){
 dt=Math.max(0,Math.min(.05,dt));state.yaw+=input.turn*1.25*dt;
 const desired=input.throttle*(input.throttle<0?5:11),rate=input.throttle?14:18;
 state.speed+=Math.max(-rate*dt,Math.min(rate*dt,desired-state.speed));
 const x=state.x+Math.sin(state.yaw)*state.speed*dt,z=state.z+Math.cos(state.yaw)*state.speed*dt;
 const blocked=boxes.some(b=>{const px=Math.max(b.min[0],Math.min(b.max[0],x)),pz=Math.max(b.min[1],Math.min(b.max[1],z));return Math.hypot(x-px,z-pz)<radius;})||Math.hypot(x,z)>265;
 if(blocked)state.speed=0;else{state.x=x;state.z=z;}state.blocked=blocked;return state;
}
