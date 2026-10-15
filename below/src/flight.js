// Stabilized quadcopter: yaw-relative horizontal thrust, independent altitude,
// acceleration limits, drag, automatic hover and a visible bank from thrust.
export function createFlight(position){return {position:{...position},velocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0},roll:0,pitch:0};}
export function fly(f,dt,input,yaw,loaded){
  const speed=loaded?6.7:8.6,climb=loaded?6.4:8.0;
  let forward=input.forward||0,right=input.right||0;const n=Math.hypot(forward,right);if(n>1){forward/=n;right/=n;}
  const target={x:(-Math.sin(yaw)*forward+Math.cos(yaw)*right)*speed,y:(input.vertical||0)*climb,z:(-Math.cos(yaw)*forward-Math.sin(yaw)*right)*speed};
  const response=n?2.5:3.6,maxAcceleration=loaded?10:12;
  let ax=(target.x-f.velocity.x)*response,az=(target.z-f.velocity.z)*response;
  const a=Math.hypot(ax,az);if(a>maxAcceleration){ax*=maxAcceleration/a;az*=maxAcceleration/a;}
  const ay=Math.max(-9,Math.min(9,(target.y-f.velocity.y)*3));
  f.acceleration={x:ax,y:ay,z:az};
  f.velocity.x+=ax*dt;f.velocity.y+=ay*dt;f.velocity.z+=az*dt;
  f.position.x+=f.velocity.x*dt;f.position.y+=f.velocity.y*dt;f.position.z+=f.velocity.z*dt;
  const along=-Math.sin(yaw)*ax-Math.cos(yaw)*az,across=Math.cos(yaw)*ax-Math.sin(yaw)*az;
  const tiltLimit=.32,k=1-Math.exp(-dt*5);
  f.pitch+=(Math.max(-tiltLimit,Math.min(tiltLimit,-Math.atan2(along,9.81)))-f.pitch)*k;
  f.roll+=(Math.max(-tiltLimit,Math.min(tiltLimit,-Math.atan2(across,9.81)))-f.roll)*k;
}
