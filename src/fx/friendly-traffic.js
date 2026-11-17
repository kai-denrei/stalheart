// One collision seam for ground friendlies and working aircraft. The existing
// swept tangent boxes own unit contact; story-base owns structure geometry.
import { friendlyTravelBlocked, pushOut } from '../domain/friendly-push.js';
import { FRIENDLY_TRAFFIC as T } from '../content/friendly-traffic.js';
const unit = p => { const l=Math.hypot(...p)||1;return p.map(x=>x/l); };
const arc = (a,b) => Math.acos(Math.max(-1,Math.min(1,a.reduce((s,x,i)=>s+x*b[i],0))));
export function createFriendlyTraffic(h) {
  const bodies = (self, height = 0) => h.bodies().filter(b=>b&&b.id!==self&&Math.abs((Math.hypot(...b.pos)-1)-height)<((b.height??T.groundHeightM)+T.groundHeightM)*h.metres());
  const boxes = self => bodies(self).map(b=>({...b,pos:unit(b.pos),halfLength:b.halfLength*h.metres(),halfWidth:b.halfWidth*h.metres()}));
  const overlaps=(p,b,pad)=>p.reduce((n,x,i)=>n+x*b.pos[i],0)>0&&pushOut(p,b,{...b,pad});
  const solid = (p,pad) => h.base()?.solidAt(p,pad) ?? null;
  return {
    contacts:()=>h.bodies().filter(Boolean).map(b=>({...b,pos:b.pos.slice(),dir:b.dir.slice()})),
    blocked(from,to,pad,self) {
      if(friendlyTravelBlocked(from,to,boxes(self),pad))return true;
      const a=unit(from),b=unit(to),n=Math.max(1,Math.ceil(arc(a,b)/(T.sampleM*h.metres())));
      // Existing structure overlaps can escape; a move cannot enter another structure.
      const start=solid(a,pad);
      for(let i=1;i<=n;i++){const p=unit(a.map((x,k)=>x+(b[k]-x)*i/n));const hit=solid(p,pad);if(hit&&hit!==start)return true;}
      return !!solid(b,pad) && !start;
    },
    resolve(p,pad,self) {
      let out=unit(p);const all=boxes(self);
      for(let pass=0;pass<T.separationPasses;pass++)for(const b of all){if(out.reduce((n,x,i)=>n+x*b.pos[i],0)<=0)continue;const hit=pushOut(out,b,{...b,pad,free:q=>!solid(q,pad)});if(hit&&!solid(hit.pos,pad))out=hit.pos;}
      if(solid(out,pad)){
        const up=out,ref=Math.abs(up[1])<.9?[0,1,0]:[1,0,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],x=unit(cross(up,ref)),z=cross(up,x);
        let found=false;for(let r=T.sampleM*h.metres();r<=pad*4&&!found;r+=T.sampleM*h.metres())for(let i=0;i<16;i++){const a=i*Math.PI/8,q=unit(out.map((v,k)=>v+r*(x[k]*Math.cos(a)+z[k]*Math.sin(a))));if(!solid(q,pad)&&!all.some(b=>overlaps(q,b,pad))){out=q;found=true;break;}}
      }
      return out;
    },
    ceiling(from,to,pad,self) {
      const a=unit(from),b=unit(to),m=h.metres(),n=Math.max(1,Math.ceil(arc(a,b)/Math.max(pad,T.sampleM*m)));let top=0;
      const bs=h.bodies().filter(x=>x&&x.id!==self);
      for(let i=0;i<=n;i++){
        const p=unit(a.map((x,k)=>x+(b[k]-x)*i/n));top=Math.max(top,h.base()?.flightCeiling(p,pad)??0);
        for(const body of bs){const height=Math.max(0,Math.hypot(...body.pos)-1);if(height>T.groundHeightM*m&&body.id>self)continue;
          const b={...body,pos:unit(body.pos),halfLength:body.halfLength*m,halfWidth:body.halfWidth*m};
          if(overlaps(p,b,pad))top=Math.max(top,height+(body.height??T.groundHeightM)*m);
        }
      }
      return top;
    },
    landingClear(p,pad,self,ownPad=false) { return (ownPad||!solid(p,pad))&&!boxes(self).some(b=>overlaps(unit(p),b,pad)); },
  };
}
