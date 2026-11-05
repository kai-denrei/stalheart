// Stabilized quadcopter: yaw-relative horizontal thrust, independent altitude,
// acceleration limits, drag, automatic hover and a visible tilt from the keyed command.
// THE QUADCOPTER BACK (Stålheart round 6, owner 2026-11-05, note 5: "the mouse makes the entire Isao flip sideways"): the body tilts from the keys alone, like a
// drone's angle mode: nose down on W, back on S, level in a hover. A turn (the mouse's x, A/D) banks nothing: the tilt used to come from the world-frame
// acceleration, so a turn while moving rolled the body up to TILT.limit. The chase camera's orbit pitch is CHASE's (main.js chasePitch): it swung to ±1.565 rad,
// under or over ISAO, where the view turned over.
export const TILT=Object.freeze({limit:.32,rate:5});
// the chase camera's orbit pitch (rad; negative lifts the camera above ISAO, looking down; positive lowers it, looking up), measured in frames on 2026-11-05
export const CHASE=Object.freeze({above:-.75,below:.3});
export const chasePitch=(p)=>Math.max(CHASE.above,Math.min(CHASE.below,p));
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
  const k=1-Math.exp(-dt*TILT.rate);
  f.pitch+=(-TILT.limit*forward-f.pitch)*k;f.roll+=(-TILT.limit*right-f.roll)*k;   // the command, never the yaw (right is 0 in the game: no strafe since 2026-10-16)
}
