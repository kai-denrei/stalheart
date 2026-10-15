import {confine} from './mission.js';

const GRAVITY=9.81,RADIUS=.12;
export function createFlareBody(position,heading=0){
  return {position:{x:position.x,y:position.y-.45,z:position.z},velocity:{x:Math.cos(heading)*.8,y:-.4,z:-Math.sin(heading)*.8},resting:false};
}
export function stepFlare(body,seconds){
  if(body.resting)return;
  // Small steps keep a fast falling flare inside the same cave passage.
  for(let remaining=seconds;remaining>1e-8;){
    const dt=Math.min(remaining,1/120);remaining-=dt;
    const p=body.position,v=body.velocity;
    v.y-=GRAVITY*dt;
    const next={x:p.x+v.x*dt,y:p.y+v.y*dt,z:p.z+v.z*dt},free={...next};
    if(confine(next,RADIUS)){
      const dx=next.x-free.x,dy=next.y-free.y,dz=next.z-free.z,length=Math.hypot(dx,dy,dz);
      if(length>1e-7){
        const nx=dx/length,ny=dy/length,nz=dz/length,into=v.x*nx+v.y*ny+v.z*nz;
        if(into<0){v.x-=nx*into*1.2;v.y-=ny*into*1.2;v.z-=nz*into*1.2;}
        // Ground friction never cancels the downward motion along a steep wall.
        if(ny>.9){const drag=Math.exp(-12*dt);v.x*=drag;v.z*=drag;
          if(Math.hypot(v.x,v.y,v.z)<.32){v.x=v.y=v.z=0;body.resting=true;}
        }
      }
    }
    Object.assign(p,next);if(body.resting)break;
  }
}
