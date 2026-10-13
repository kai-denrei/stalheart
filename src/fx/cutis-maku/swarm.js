// Ported from Jelly-Baby src/cutis/swarm/controller.ts (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), types stripped; the hop cycle, the probes and the anchor choice are unchanged.
// Changes from the kit: per-instance state (target, pace, hold, active, life, a planted next anchor) replaces the one shared target and the fixed 300 instances; step(dt) uses each instance's own target;
// every absolute length scales by config.r0 / KIT_R0 (the kit was tuned at 0.2 m); reset(count) now leaves instances INACTIVE and populate(count) is the kit's old reset; shift() re-anchors the frame; advance() runs the kit's 1/120 s stepping.
// 3a985e1 (the hard cores, owner 2026-10-13): getCoreContact(i), the rigid core's centre and radius on the SHARED transfer path (the same curve the
// membrane shader's uHardRadius block pads its shell round: never interpolate the core on its own, the handoff's escape bug), contactDamageAt, and a
// cored body's position() is its core's centre. The kit's mixed eight-tier preview (configFor / setMixed / speedFor) is the lab's and is not ported:
// the game keeps one swarm per tier, so every instance's config is the swarm's.
import { cycleTiming, phaseState, transferProgress, coreContact, KIT_R0 } from './config.js';

export const STEP=1/120;
// round two: a stalk's cup in body radii (the shader's pad, .58 r) kept clear of the rock, and the turns tried when the way ahead is blocked
export const REACH_MARGIN=.6;
const TURNS=[.45,-.45,.9,-.9,1.35,-1.35],STALKS=[[0],[-1.2,1.2],[-1.2,0,1.2]];
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};

export class CutisSwarm {
  constructor(config,{ capacity=300 }={}) {
    const cap=this.capacity=Math.max(1,Math.round(capacity));
    this.config=config;this.count=0;this.time=0;this.frozen=false;this.clock=0;
    this.offset=new Float32Array(cap*3);this.heading=new Float32Array(cap*3);this.anchor=new Float32Array(cap*3);
    this.phase=new Float32Array(cap);this.seed=new Float32Array(cap);this.scale=new Float32Array(cap);this.params=new Float32Array(cap*4);
    this.probe0=new Float32Array(cap*3);this.probe1=new Float32Array(cap*3);this.probe2=new Float32Array(cap*3);
    this.probeCount=new Float32Array(cap);this.chosenProbe=new Float32Array(cap);
    this.duration=new Float32Array(cap);this.idle=new Uint8Array(cap);this.cycles=new Uint32Array(cap);
    // per instance: where it hunts [x,z]; the temperament (multiplies the hop cycle's duration, <1 is faster); 1 = the phase does not advance (the nuke's stun);
    // 1 = stepped and drawn; [lift m (the origin's depth, negative = below ground), deflate 0..1, opacity 0..1, spare]; the planted next anchor [x,z,flag]
    this.target=new Float32Array(cap*2);this.pace=new Float32Array(cap).fill(1);this.hold=new Uint8Array(cap);this.active=new Uint8Array(cap);
    this.life=new Float32Array(cap*4);this.plant=new Float32Array(cap*3);
    this.forced=new Uint8Array(cap);
    // round two (the Pearl set's hubs, src/fx/creature-bodies.js): each instance's projection hub and that hub's turn about the planet's centre
    // [x, y, z, w] (the shader's iHub); instances of different hubs are in different planes and are never each other's neighbours
    this.hub=new Uint8Array(cap);this.hubQuat=new Float32Array(cap*4);for(let i=0;i<cap;i++)this.hubQuat[i*4+3]=1;
    // round two (owner, 2026-10-13: "the cutis animation clips through walls"): the host's free reach, (i, x, z, dx, dz, max) -> metres clear along the
    // unit direction (dx, dz) from (x, z) (src/domain/body-reach.js against the board's ROCK and WALL); null is the kit's open plane. See plan().
    this.reachLimit=null;
    this.occupied=new Float32Array(cap*3);
    for(let i=0;i<cap;i++){this.seed[i]=hash(i+17)*100;this.scale[i]=.85+hash(i+93)*.3;}
    this.reset(0);
  }
  /** Lengths in the kit are tuned at r0 = 0.2 m; this is how much longer than that a metre of this swarm is. */
  get lengthScale() { return this.config.r0/KIT_R0; }
  /** `count` instances, all inactive, phases zeroed; place() brings one in. */
  reset(count=this.count) {
    this.count=Math.max(0,Math.min(this.capacity,Math.round(count)));this.time=0;this.clock=0;
    for(let i=0;i<this.capacity;i++){
      const k=i*3;
      this.offset.fill(0,k,k+3);this.anchor.fill(0,k,k+3);this.occupied.fill(0,k,k+3);
      this.heading[k]=1;this.heading[k+1]=0;this.heading[k+2]=0;
      this.phase[i]=0;this.cycles[i]=0;this.idle[i]=0;this.pace[i]=1;this.hold[i]=0;this.active[i]=0;this.forced[i]=0;
      this.hub[i]=0;this.hubQuat.fill(0,i*4,i*4+3);this.hubQuat[i*4+3]=1;
      this.target[i*2]=0;this.target[i*2+1]=0;this.plant.fill(0,k,k+3);
      this.resetLife(i);
    }
  }
  resetLife(i) { const k=i*4;this.life[k]=0;this.life[k+1]=0;this.life[k+2]=1;this.life[k+3]=0; }
  /** The kit's reset: `count` instances in a spiral, desynchronised phases, all active, all hunting one point near the middle. */
  populate(count) {
    this.reset(count);
    const n=this.count,s=this.lengthScale;
    for(let i=0;i<n;i++){
      const angle=i*2.399963,r=n===1?0:Math.sqrt((i+.5)/n)*Math.max(2.5,Math.sqrt(n)*.39)*s;
      this.setTarget(i,1.3*s,.6*s);
      this.place(i,Math.cos(angle)*r,Math.sin(angle)*r,angle+.8);
      this.phase[i]=n===1?0:hash(i+71);
      this.duration[i]=this.config.cycleDuration*(.8+hash(i+31)*.4);
    }
  }
  /** Put i at (x, z) facing `angle` (radians in the x-z plane), phase 0, active, life reset, hold off; it plans a hop toward its target. Pace and target are left alone. */
  place(i,x,z,angle=0) {
    const k=i*3;
    this.count=Math.max(this.count,i+1);
    this.offset[k]=x;this.offset[k+1]=0;this.offset[k+2]=z;
    this.heading[k]=Math.cos(angle);this.heading[k+1]=0;this.heading[k+2]=Math.sin(angle);
    this.phase[i]=0;this.cycles[i]=0;this.idle[i]=0;this.hold[i]=0;this.active[i]=1;this.forced[i]=0;
    this.plant.fill(0,k,k+3);this.resetLife(i);
    this.plan(i,this.target[i*2],this.target[i*2+1],false);
  }
  setTarget(i,x,z) { this.target[i*2]=x;this.target[i*2+1]=z; }
  /** The next plan of i takes exactly (x, z) as its anchor, one probe, reach = the distance. The plan consumes it (a commit's replan at phase 0 keeps it, so one hop). */
  plantNext(i,x,z) { const k=i*3;this.plant[k]=x;this.plant[k+1]=z;this.plant[k+2]=1; }
  /** Subtract (dx, dz) from every positional array: the lab's frame re-anchor. */
  shift(dx,dz) {
    for(const a of [this.offset,this.anchor,this.occupied])for(let k=0;k<a.length;k+=3){a[k]-=dx;a[k+2]-=dz;}
    for(let k=0;k<this.target.length;k+=2){this.target[k]-=dx;this.target[k+1]-=dz;}
    for(let k=0;k<this.plant.length;k+=3){this.plant[k]-=dx;this.plant[k+1]-=dz;}
  }
  plan(i,tx,tz,neighbors=true) {
    const c=this.config,s=this.lengthScale,k=i*3,x=this.offset[k],z=this.offset[k+2],dx=tx-x,dz=tz-z,distance=Math.hypot(dx,dz),radius=c.r0*this.scale[i];
    // a target on the spot has no direction; keep the heading rather than collapse it to zero
    let hx=distance>1e-4*s?dx/distance:this.heading[k],hz=distance>1e-4*s?dz/distance:this.heading[k+2],sx=0,sz=0,ax=0,az=0,cx=0,cz=0,n=0;
    const near=2.25*s*s,tiny=1e-5*s*s;
    if(neighbors&&this.count>1)for(let j=0;j<this.count;j++)if(i!==j&&this.active[j]&&this.hub[j]===this.hub[i]){const q=j*3,ex=x-this.occupied[q],ez=z-this.occupied[q+2],d2=ex*ex+ez*ez;if(d2<near&&d2>tiny){const w=Math.max(0,1-Math.sqrt(d2)/(radius*3));sx+=ex/d2*w*s;sz+=ez/d2*w*s;ax+=this.heading[q];az+=this.heading[q+2];cx-=ex;cz-=ez;n++;}}
    hx+=sx*c.separation*.35;hz+=sz*c.separation*.35;
    if(n){hx+=ax/n*c.alignment*.3+cx/n*c.cohesion/s;hz+=az/n*c.alignment*.3+cz/n*c.cohesion/s;}
    const erratic=(hash(i*19+this.cycles[i]*7)-.5)*.65,cos=Math.cos(erratic),sin=Math.sin(erratic),length=Math.hypot(hx,hz)||1;
    const hunt=distance<radius*9?c.aggression/(1+c.aggression):0;
    const planted=this.plant[k+2]>0;
    if(planted){
      // the planted anchor: face it, one probe straight ahead whose reach is the distance, the anchor written as given
      const px=this.plant[k],pz=this.plant[k+1],ex=px-x,ez=pz-z,d=Math.hypot(ex,ez);
      if(d>1e-4*s){this.heading[k]=ex/d;this.heading[k+2]=ez/d;}
      this.probeCount[i]=1;this.chosenProbe[i]=0;
      this.probe0[k]=0;this.probe0[k+1]=d;this.probe0[k+2]=hash(i*7)*1.4;
      this.anchor[k]=px;this.anchor[k+1]=.018*s;this.anchor[k+2]=pz;this.params[i*4]=d;
      this.plant[k+2]=2;this.forced[i]=1;
    } else {
      this.forced[i]=0;
      this.heading[k]=(hx*cos-hz*sin)/length;this.heading[k+2]=(hx*sin+hz*cos)/length;
      const reach=Math.min(c.reach*radius*(1+.18*hunt),Math.max(0,distance-radius*.55));
      const count=Math.max(1,Math.min(3,Math.round(c.seekCount)));
      this.probeCount[i]=count;
      if(this.reachLimit)this.clearHeading(i,x,z,reach+radius*REACH_MARGIN,count,distance>1e-4*s?dx/distance:hx/length,distance>1e-4*s?dz/distance:hz/length);
      for(let j=0;j<3;j++){
        const probe=j===0?this.probe0:j===1?this.probe1:this.probe2;
        probe[k]=count===1?0:(j-(count-1)/2)*(count===2?2.4:1.2);
        probe[k+1]=reach*(count===1?1:.58+.42*hash(i*29+this.cycles[i]*13+j*41+5));
        probe[k+2]=j*2.17+hash(i*7+j*19)*1.4;
        if(this.reachLimit&&j<count)probe[k+1]=this.clearReach(i,x,z,probe[k],probe[k+1],radius);
      }
      this.selectProbe(i,tx,tz);
    }
    /* Selected reach is written by selectProbe. */this.params[i*4+1]=c.cubenessPeak;this.params[i*4+2]=c.pulseSpeed;this.params[i*4+3]=c.wobble;
    // Telegraph stays >=120ms even at maximum urgency. Candidate directions lock now; multiple probes choose the anchor after seeking.
    const jitter=.8+hash(i*43+this.cycles[i]*17)*.4;
    const base=c.cycleDuration*(1-.3*hunt),duration=base*(jitter*(1-.35*hunt)+.35*hunt);
    const beat=Math.ceil((this.time+duration)/base)*base-this.time;
    this.duration[i]=duration+(beat-duration)*.18*hunt;
    this.idle[i]=!planted&&distance<radius*.7?1:0;
  }
  /** Round two: the heading turned toward clear ground when the rock or a wall stops every one of its `count` stalks (their fixed angles off the
   * heading, as plan lays them) within 3/4 of `want`: of the turns up to 1.35 rad either side, the one whose best stalk makes the most clear way
   * toward the target (unit (ux, uz)). Only with a host's reachLimit. */
  clearHeading(i,x,z,want,count,ux,uz) {
    const k=i*3,hx=this.heading[k],hz=this.heading[k+2],angles=STALKS[count-1];
    const gain=(dx,dz)=>{let g=-Infinity,clear=0;for(const a of angles){const c=Math.cos(a),s=Math.sin(a),sx=dx*c+dz*s,sz=dz*c-dx*s,f=Math.min(want,this.reachLimit(i,x,z,sx,sz,want));clear=Math.max(clear,f);g=Math.max(g,f*(sx*ux+sz*uz));}return [g,clear];};
    let [best,clear]=gain(hx,hz);
    if(clear>=want*.75)return;
    let bx=hx,bz=hz;
    for(const a of TURNS){const c=Math.cos(a),s=Math.sin(a),dx=hx*c-hz*s,dz=hx*s+hz*c,[g]=gain(dx,dz);if(g>best+1e-6){best=g;bx=dx;bz=dz;}}
    this.heading[k]=bx;this.heading[k+2]=bz;
  }
  /** Round two: a stalk at `angle` off the heading with `reach` metres, held `REACH_MARGIN` radii (its cup) short of the first blocked point along it,
   * so neither the stalk, its cup, the anchor at its end nor the transfer along it enters the rock or a wall. */
  clearReach(i,x,z,angle,reach,radius) {
    const k=i*3,c=Math.cos(angle),s=Math.sin(angle),hx=this.heading[k],hz=this.heading[k+2],margin=radius*REACH_MARGIN;
    const free=this.reachLimit(i,x,z,hx*c+hz*s,hz*c-hx*s,reach+margin);
    return Math.max(0,Math.min(reach,free-margin));
  }
  getSeekingAnchors(i) {
    const k=i*3,y=.018*this.lengthScale;
    return [this.probe0,this.probe1,this.probe2].slice(0,this.probeCount[i]).map((probe,index)=>{
      const a=probe[k],d=probe[k+1],c=Math.cos(a),s=Math.sin(a);
      return {index,x:this.offset[k]+(this.heading[k]*c+this.heading[k+2]*s)*d,y,z:this.offset[k+2]+(this.heading[k+2]*c-this.heading[k]*s)*d,reach:d};
    });
  }
  selectProbe(i,tx,tz) {
    const k=i*3,y=.018*this.lengthScale;let nearest=Infinity;
    for(let j=0;j<this.probeCount[i];j++){
      const probe=j===0?this.probe0:j===1?this.probe1:this.probe2,a=probe[k],d=probe[k+1],c=Math.cos(a),s=Math.sin(a);
      const x=this.offset[k]+(this.heading[k]*c+this.heading[k+2]*s)*d,z=this.offset[k+2]+(this.heading[k+2]*c-this.heading[k]*s)*d;
      const distance=(tx-x)**2+(tz-z)**2;
      if(distance<nearest){nearest=distance;this.chosenProbe[i]=j;this.anchor[k]=x;this.anchor[k+1]=y;this.anchor[k+2]=z;this.params[i*4]=d;}
    }
  }
  /** One step. Each active, un-held instance hunts its own target; the clock runs for all. */
  step(dt) {
    const c=this.config,tgt=this.target,desired=Math.max(1,Math.min(3,Math.round(c.seekCount)));
    for(let i=0;i<this.count;i++)if(this.active[i]&&!this.hold[i]&&!this.forced[i]&&this.probeCount[i]!==desired){
      this.plan(i,tgt[i*2],tgt[i*2+1]);if(!this.frozen)this.phase[i]=0;
    }
    if(this.frozen)return;this.time+=dt;
    for(let i=0;i<this.count;i++){if(!this.active[i])continue;const k=i*3,t=this.phase[i]<.62?0:transferProgress((this.phase[i]-.62)/.23,c.transferAcceleration);this.occupied[k]=this.offset[k]+(this.anchor[k]-this.offset[k])*t;this.occupied[k+2]=this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*t;}
    for(let i=0;i<this.count;i++){
      if(!this.active[i]||this.hold[i])continue;
      const k=i*3,tx=tgt[i*2],tz=tgt[i*2+1];
      if(this.idle[i]){if(this.plant[k+2]===1||Math.hypot(tx-this.offset[k],tz-this.offset[k+2])>c.r0*this.scale[i]){this.cycles[i]++;this.plan(i,tx,tz);this.phase[i]=0;}continue;}
      if(this.phase[i]===0)this.plan(i,tx,tz);
      const pace=this.pace[i]>0?this.pace[i]:1,timing=cycleTiming(this.duration[i]*pace),phase=this.phase[i];
      const rate=phase<.1?.1/timing.coil:phase<.55?.45/timing.extend:phase<.62?.07/timing.anchor:phase<.85?.23/timing.transfer:.15/timing.settle;
      this.phase[i]+=dt*rate;
      if(this.plant[k+2]===2&&this.phase[i]>0)this.plant[k+2]=0;
      if(phase<.55&&this.phase[i]>=.55&&this.probeCount[i]>1)this.selectProbe(i,tx,tz);
      if(this.phase[i]>=1){this.offset[k]=this.anchor[k];this.offset[k+2]=this.anchor[k+2];this.cycles[i]++;this.plan(i,tx,tz);this.phase[i]=0;}
      this.params[i*4+1]=c.cubenessPeak;this.params[i*4+2]=c.pulseSpeed;this.params[i*4+3]=c.wobble;
    }
  }
  /** The kit's 1/120 s stepping: add real time (at most 50 ms), take whole steps, keep the remainder. Returns the steps taken. */
  advance(dt) {
    if(!(dt>0))return 0;
    this.clock+=Math.min(.05,dt);let n=0;
    while(this.clock>=STEP){this.step(STEP);this.clock-=STEP;n++;}
    return n;
  }
  position(i) { if((this.config.coreShape??0)>0){const {center}=this.getCoreContact(i);return [center.x,0,center.z];}const k=i*3,t=this.phase[i]<.62?0:transferProgress((this.phase[i]-.62)/.23,this.config.transferAcceleration);return [this.offset[k]+(this.anchor[k]-this.offset[k])*t,0,this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*t]; }
  /** The core on the shared transfer path: the body's centre as the membrane shader's uHardRadius block computes it (one transfer clock, delay uDelay/2), lifted clear of the ground; its radius rigid (coreSize x r). Plane metres, y up, before the shader's ground clamp, deflate, lift and planet bend. */
  getCoreContact(i) {
    const config=this.config,spec=coreContact(config),k=i*3,r=config.r0*this.scale[i],phase=this.phase[i],s=this.lengthScale,delay=config.delaySpread;
    const transfer=transferProgress((phase-.62)/.23,config.transferAcceleration);
    const u=Math.max(0,Math.min(1,(transfer-delay*.5)/Math.max(.02,1-delay)));
    const travel=2*u-u*u,height=r*.78*((1-u)**2+u*u)+2*(1-u)*u*.014*s;
    const center={x:this.offset[k]+(this.anchor[k]-this.offset[k])*travel,y:height,z:this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*travel};
    if(phase>=.85){const settle=(phase-.85)/.15,recoil=Math.exp(-6*settle)*Math.sin(settle*22)*r*.12*config.wobble;center.x=this.anchor[k]+this.heading[k]*recoil;center.z=this.anchor[k+2]+this.heading[k+2]*recoil;center.y=r*.78;}
    const radius=spec.collisionRadius*this.scale[i];if(radius>0)center.y=Math.max(center.y,radius*1.3+.018*s);
    return {...spec,center,radius,u};
  }
  contactDamageAt(i,point,unitRadius,dt) { const c=this.getCoreContact(i);return !c.rammable&&Math.hypot(point.x-c.center.x,point.y-c.center.y,point.z-c.center.z)<=c.radius+Math.max(0,unitRadius)?c.contactDamagePerSecond*Math.max(0,dt):0; }
  getState(i) { return this.idle[i]?'REST':phaseState(this.phase[i]); }
  getAnchor(i) { return {x:this.anchor[i*3],y:this.anchor[i*3+1],z:this.anchor[i*3+2]}; }
  getStretchSegment(i) { const k=i*3;return {from:{x:this.offset[k],y:this.config.r0*this.scale[i],z:this.offset[k+2]},to:this.getAnchor(i),vulnerable:this.phase[i]>=.1&&this.phase[i]<.62,intangible:this.phase[i]>=.62&&this.phase[i]<.85}; }
  scrub(phase) { this.frozen=true;this.idle[0]=0;this.phase[0]=Math.max(0,Math.min(.9999,phase)); }
}
