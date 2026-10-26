import {tunnelClearance,chamberClearance,surfaceHeight,SINKHOLE_THROAT} from './mission.js';

// THE FLARES STICK (owner, 2026-10-26, note 6: "Flares must stick to the surface they have been dropped to, but not float in the air. They are subject to
// gravity, but if they hit a wall, they stick to it. Otherwise we cannot identify the long vents"). A flare falls under gravity (9.8 m/s2, up to a terminal
// speed) and tests the rock every step; the first contact stops it for good: frozen at the contact point pushed `stand` along the surface normal, the
// normal kept (flares.js lays the stick on the surface and lifts its light off it). A wall hit stays on the wall (no slide), a floor hit lies on the floor;
// one that touches nothing keeps falling until it does. Replaces the grip of 2026-10-16/18 (bounce, friction, a rest angle of 50 degrees, sliding down
// anything steeper).
export const FLARE_FALL=Object.freeze({gravity:9.8,terminal:40,radius:.15,stand:.05});   // m/s2, m/s, m (the flare's contact radius), m (off the face)
// THE ROCK, as the player's collision sees it (mission.js confine): the clearance to the nearest wall, positive inside. Below the throat the passages'
// and the chamber's own clearances (what isTunnelInterior and inChamber threshold); above it the height over the bowl and the ground. Contact is a
// clearance under the flare's radius; the normal is the clearance's gradient. confine's push-out is not used for the normal: by the blind branch's
// plug it moves a point to the side wall, not off the plug (a flare stuck there read a normal into open air)
export function caveClearance(p){
  if(p.y>=SINKHOLE_THROAT+.4){const h=surfaceHeight(p.x,p.z);return h===-Infinity?Infinity:p.y-h;}   // over the hole's open throat: air
  return Math.max(tunnelClearance(p),chamberClearance(p));
}
export function createFlareBody(position,heading=0){
  return {position:{x:position.x,y:position.y-.45,z:position.z},velocity:{x:Math.cos(heading)*.8,y:-.4,z:-Math.sin(heading)*.8},resting:false,normal:null};
}
const H=.1;   // the gradient's half-step (m): the passages' walls are bumpy at the scale of centimetres
function gradient(clearance,p){
  const at=(dx,dy,dz)=>clearance({x:p.x+dx,y:p.y+dy,z:p.z+dz});
  const g={x:at(H,0,0)-at(-H,0,0),y:at(0,H,0)-at(0,-H,0),z:at(0,0,H)-at(0,0,-H)},l=Math.hypot(g.x,g.y,g.z);
  return Number.isFinite(l)&&l>1e-9?{x:g.x/l,y:g.y/l,z:g.z/l}:{x:0,y:1,z:0};
}
// `clearance` is the rock (caveClearance); the tests pass planes at exact angles
export function stepFlare(body,seconds,clearance=caveClearance){
  if(body.resting)return;
  const {gravity,terminal,radius,stand}=FLARE_FALL;
  for(let remaining=seconds;remaining>1e-8;){
    const p=body.position,v=body.velocity;
    // small steps (1/120 s: a third of a metre at the terminal speed) keep a fast flare inside the passage it is in
    const dt=Math.min(remaining,1/120);remaining-=dt;
    v.y-=gravity*dt;
    const s=Math.hypot(v.x,v.y,v.z);if(s>terminal){const k=terminal/s;v.x*=k;v.y*=k;v.z*=k;}
    const next={x:p.x+v.x*dt,y:p.y+v.y*dt,z:p.z+v.z*dt};
    if(!(clearance(next)<radius)){Object.assign(p,next);continue;}
    // the first touch along the step (halving it), then the face's normal there; the flare is put `stand` off the face along it
    let a=0,b=1;const at=(k)=>({x:p.x+(next.x-p.x)*k,y:p.y+(next.y-p.y)*k,z:p.z+(next.z-p.z)*k});
    if(clearance(p)>=radius)for(let i=0;i<20;i++){const m=(a+b)/2;if(clearance(at(m))<radius)b=m;else a=m;}else b=0;
    const c=at(b),speed=Math.hypot(v.x,v.y,v.z)||1,back={x:-v.x/speed,y:-v.y/speed,z:-v.z/speed};
    let n=gradient(clearance,c),at2=settle(clearance,c,n,radius,stand);
    if(!at2){n=back;at2=settle(clearance,c,n,radius,stand)??c;}   // no face along the gradient (a bump): the face it flew into, against its velocity
    Object.assign(p,at2);
    v.x=v.y=v.z=0;body.normal=n;body.resting=true;return;
  }
}
function settle(clearance,c,n,radius,stand){
  const off=(k)=>({x:c.x-n.x*k,y:c.y-n.y*k,z:c.z-n.z*k});
  // along the normal to `stand` off the face: the crossing (open to rock, going in) nearest the contact within three radii either way, then halved.
  // The clearance is not a true distance everywhere (the walls' bumps, and thin rock between two bends of the maze), so it is searched, not stepped
  const W=radius*3,D=.015;let best=null;
  for(let k=-W;k<W;k+=D)if(clearance(off(k))>=stand&&clearance(off(k+D))<stand&&(best===null||Math.abs(k)<Math.abs(best)))best=k;
  if(best===null)return null;
  let lo=best,hi=best+D;for(let i=0;i<16;i++){const m=(lo+hi)/2;if(clearance(off(m))<stand)hi=m;else lo=m;}
  return off(lo);
}
