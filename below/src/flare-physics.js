import {confine,FLARE_STICK} from './mission.js';

const GRAVITY=9.81,RADIUS=.12;
export function createFlareBody(position,heading=0){
  return {position:{x:position.x,y:position.y-.45,z:position.z},velocity:{x:Math.cos(heading)*.8,y:-.4,z:-Math.sin(heading)*.8},resting:false};
}
const REST_NY=Math.cos(FLARE_STICK.restSlope*Math.PI/180);
// `surface` is the rock (confine: projects a point back inside, true on contact); the tests pass a plane at an exact slope
export function stepFlare(body,seconds,surface=confine){
  if(body.resting)return;
  // Small steps keep a fast falling flare inside the same cave passage.
  for(let remaining=seconds;remaining>1e-8;){
    const dt=Math.min(remaining,1/120);remaining-=dt;
    const p=body.position,v=body.velocity;
    v.y-=GRAVITY*dt;
    const next={x:p.x+v.x*dt,y:p.y+v.y*dt,z:p.z+v.z*dt},free={...next};
    if(surface(next,RADIUS)){
      const dx=next.x-free.x,dy=next.y-free.y,dz=next.z-free.z,length=Math.hypot(dx,dy,dz);
      if(length>1e-7){
        const nx=dx/length,ny=dy/length,nz=dz/length,into=v.x*nx+v.y*ny+v.z*nz;
        if(into<0){v.x-=nx*into*1.05;v.y-=ny*into*1.05;v.z-=nz*into*1.05;}   // 1.05 (was 1.2): a flare barely rebounds (the owner, 2026-10-16: one dropped in the chute landed and bounced back to the same spot)
        // STICKINESS (the owner, 2026-10-16): any contact scrubs the motion along the surface, more the flatter it is; on a slope steeper than 65 degrees a
        // flare still slides. It rests once slow on anything flatter than that.
        // THE GRIP (owner, 2026-10-18, FLARE_STICK): friction against the part of gravity that presses the flare into the rock slows its slide
        // along it; under a ceiling (ny <= 0) nothing presses
        const press=FLARE_STICK.friction*GRAVITY*Math.max(0,ny)*dt;
        if(press>0){const n2=v.x*nx+v.y*ny+v.z*nz,tx=v.x-nx*n2,ty=v.y-ny*n2,tz=v.z-nz*n2,slide=Math.hypot(tx,ty,tz),k=slide>press?(slide-press)/slide:0;
          v.x=nx*n2+tx*k;v.y=ny*n2+ty*k;v.z=nz*n2+tz*k;}
        const flat=Math.max(0,(ny-.42)/.58);
        if(flat>0){const drag=Math.exp(-(4+8*flat)*dt);v.x*=drag;v.z*=drag;v.y*=Math.exp(-3*flat*dt);}
        // a flare slow on rock no steeper than restSlope rests (2026-10-18: 0.9 m/s to 50 degrees, was 0.32-0.72 m/s, so it slid on at 35);
        // between that and 65 degrees the older creeping rule still stops a nearly still one
        const speed=Math.hypot(v.x,v.y,v.z);
        if((ny>=REST_NY&&speed<FLARE_STICK.restSpeed)||(flat>0&&speed<.32+.4*flat)){v.x=v.y=v.z=0;body.resting=true;}
      }
    }
    Object.assign(p,next);if(body.resting)break;
  }
}
