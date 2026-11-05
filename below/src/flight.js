// Stabilized quadcopter: yaw-relative horizontal thrust, independent altitude,
// acceleration limits, drag, automatic hover and a visible tilt from the keyed command.
// THE QUADCOPTER BACK (Stålheart round 6, owner 2026-11-05, note 5: "the mouse makes the entire Isao flip sideways"): the body tilts from the keys alone, like a
// drone's angle mode: nose down on W, back on S, level in a hover. A turn (the mouse's x, A/D) banks nothing: the tilt used to come from the world-frame
// acceleration, so a turn while moving rolled the body up to TILT.limit. The chase camera's orbit pitch is CHASE's (main.js chasePitch): it swung to ±1.565 rad,
// under or over ISAO, where the view turned over.
export const TILT=Object.freeze({limit:.32,rate:5});
// the chase camera's orbit pitch (rad; negative lifts the camera above ISAO, looking down; positive lowers it, looking up), measured in frames on 2026-11-05
// THE CAMERA NEVER LEAVES ISAO'S BACK (Stålheart round 7, note 9, owner 2026-11-05: "both moving the mouse or A or D makes the cave flip around, none of
// that should be happening"): the chase camera's azimuth follows ISAO's heading with a lag (`follow` /s, a turn swings the view over ~0.4 s), and where the
// boom meets the wall it shortens (to `minBoom` m) and rises (`rise` m per metre lost) but never moves round ISAO; it used to jump to the best of five azimuths
// (heading +0, ±0.8, ±1.6 rad) whenever the wall cut the boom under 1.8 m, so in a tunnel a turn swung the camera to ISAO's side: 1.19 rad in one frame, measured.
// Now the view's heading trails his by 0.21 rad at most on a held turn and moves 0.02 rad a frame (isao.js update: the boom on its own ray, the view along its yaw).
export const CHASE=Object.freeze({above:-.75,below:.3,follow:6,boom:4.9,minBoom:1.2,rise:.4});
export const chasePitch=(p)=>Math.max(CHASE.above,Math.min(CHASE.below,p));
const wrap=(a)=>Math.atan2(Math.sin(a),Math.cos(a));
// the camera's yaw eased toward the heading over dt (the short way round): never past it, never more than follow*dt of the gap in one step
export function chaseYaw(camYaw,heading,dt,follow=CHASE.follow){return camYaw+wrap(heading-camYaw)*(1-Math.exp(-Math.max(0,dt)*follow));}
// the boom for the clearance behind ISAO (m, along the camera's own azimuth): its length (boom down to minBoom) and how far it rises for the metres lost
export function boomFor(clearance,{boom=CHASE.boom,minBoom=CHASE.minBoom,rise=CHASE.rise}=CHASE){const length=Math.max(minBoom,Math.min(boom,clearance));return {length,lift:(boom-length)*rise};}
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
