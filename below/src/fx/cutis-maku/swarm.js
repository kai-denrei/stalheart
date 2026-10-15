// Ported from Jelly-Baby src/cutis/swarm/controller.ts (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), types stripped; the hop cycle, the probes and the anchor choice are unchanged.
// Changes from the kit: per-instance state (target, pace, hold, active, life, a planted next anchor) replaces the one shared target and the fixed 300 instances; step(dt) uses each instance's own target;
// every absolute length scales by config.r0 / KIT_R0 (the kit was tuned at 0.2 m); reset(count) now leaves instances INACTIVE and populate(count) is the kit's old reset; shift() re-anchors the frame; advance() runs the kit's 1/120 s stepping.
// 3a985e1 (the hard cores, owner 2026-10-13): getCoreContact(i), the rigid core's centre and radius on the SHARED transfer path (the same curve the
// membrane shader's uHardRadius block pads its shell round: never interpolate the core on its own, the handoff's escape bug), contactDamageAt, and a
// cored body's position() is its core's centre. The kit's mixed eight-tier preview (configFor / setMixed / speedFor) is the lab's and is not ported:
// the game keeps one swarm per tier, so every instance's config is the swarm's.
import { cycleTiming, phaseState, transferProgress, easeShare, coreContact, KIT_R0 } from './config.js';

export const STEP=1/120;
const TIPS=new Float64Array(14);
// round two: the most projection hubs a swarm draws round (src/domain/surface-hubs.js: the icosahedron's twelve)
export const HUBS=12;
// round two: a stalk's cup in body radii (the shader's pad, .58 r) kept clear of the rock, and the turns tried when the way ahead is blocked
export const REACH_MARGIN=.6;
// round three (owner, 2026-10-13: "there is still some clipping of the Cutis-Pearl through the walls"): the open ground a body needs round its origin and
// each anchor, in radii (its rest membrane reaches ~1.2 r with the lumps, the settle's recoil .12 r more); the stalk's sideways sweep at its tip (the
// shader's seekSweep x ~1.3), at its middle (the bow .85 r and half the sweep) and at its base (the bow on the body's rim past 1.2 r), in radii, for
// the damping; a hop's way needs this much room (radii) all along it (the transferring body is ~1.2 r wide), or SQUEEZE_RADII through a passage narrower
// than that, the body squeezed
export const BODY_RADII=1.35,SWEEP_TIP=1.15,SWEEP_MID=1.45,SWEEP_BASE=.6,TRANSFER_RADII=1.2,SQUEEZE_RADII=.8;
const TURNS=[.45,-.45,.9,-.9,1.35,-1.35];
// ROUND FOUR of the Pearl set (owner, 2026-10-13: "the moving animations are too jerky, they should feel slower and more organic"): optional config
// keys, the kit unchanged without them. `forkAngle` a two-stalk body's stalks off its heading (rad; the kit's 1.2: it zigzags 69 degrees either
// side of its way at every hop; ./geometry.js builds that swarm's hull with its caps there, a stalk being drawn from its cap's rings); `timing` the
// stages' shares of the cycle (./config.js cycleTiming); `transferEase` 0..1 the transfer eased in and out (./config.js transferProgress, easeShare;
// the shader's uEase); `turnInCoil` a new hop's heading is not taken at once (the body's lumps, oriented by it, turned in one frame: a shape pop)
// but turned to through the coil (no stalk is out then), its stalks' angles off it turned back as much meanwhile, so each stalk is on its cap once
// it reaches; `maxTurn` rad, the most a hop turns the heading (a blocked way may turn it further); `headingJitter` the hop's random turn (the kit's
// .65 rad wide); `frameStep` the swarm steps with the frame's own time (in steps of at most 1/60 s) instead of the kit's fixed 1/120 s with a
// remainder (two steps one frame and three the next at 45 fps: a body's animation stuttering with the frame rate).
const STALK_ANGLES=(count,fork)=>count===1?[0]:count===2?[-fork,fork]:[-1.2,0,1.2];
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
    // 1 = stepped and drawn; [lift m (the origin's depth, negative = below ground), deflate 0..1 (round two: signed, an impact's rebound below 0), opacity 0..1, ice tint 0..1 (round two: the slow)]; the planted next anchor [x,z,flag]
    this.target=new Float32Array(cap*2);this.pace=new Float32Array(cap).fill(1);this.hold=new Uint8Array(cap);this.active=new Uint8Array(cap);
    this.life=new Float32Array(cap*4);this.plant=new Float32Array(cap*3);
    this.forced=new Uint8Array(cap);
    // round four: the heading a hop turns toward ([x, z] unit; the drawn heading turns to it at config.turnRate)
    this.goal=new Float32Array(cap*2);
    // round four: how many times each slot was put down (place): the motion audit drops a body's history across one
    this.placed=new Uint16Array(cap);this.turnFrom=new Float32Array(cap);this.turnNow=new Float32Array(cap);
    // round two (the Pearl set's hubs, src/fx/creature-bodies.js): each instance's projection hub (0..11) and the hubs' turns about the planet's centre,
    // [x, y, z, w] each (the shader's uHubs; packed with the probes in iState.w, so the kit's vertex attributes stay within WebGL's sixteen); instances
    // of different hubs are in different planes and are never each other's neighbours
    this.hub=new Uint8Array(cap);this.hubTable=new Float32Array(HUBS*4);for(let k=0;k<HUBS;k++)this.hubTable[k*4+3]=1;
    // round two (owner, 2026-10-13: "the cutis animation clips through walls"): the host's free reach, (i, x, z, dx, dz, max) -> metres clear along the
    // unit direction (dx, dz) from (x, z) (src/domain/body-reach.js against the board's ROCK and WALL); null is the kit's open plane. See plan().
    this.reachLimit=null;
    // round three: the host's clearance, (i, x, z, rho, out) -> out [dx, dz, room, ax, az, clear, first]: the move that puts rho metres of open ground
    // round plane point (x, z), the radius that fits there (< rho in a corridor narrower than the body), the axis across it, the clearance where the move
    // ends and where it began (src/domain/body-reach.js clearOf against the board's ROCK and WALL); null is the open plane. Per instance: `room` the open ground round the body
    // over its footprint (BODY_RADII r), 0 = not measured (the shader squeezes the body along `roomAxis`, an angle in the plane, when it is under 1, its
    // puddle and squash spread counted), and `roomAcross` the room square to that axis (0: not measured; where the room is under 1, a bend or a corner
    // may close in that way too); `sweepDamp` 0..1 how much of the stalks' sideways sweep and bow is held back (the shader). See clearProbes.
    this.clearLimit=null;this.room=new Float32Array(cap);this.roomAxis=new Float32Array(cap);this.roomAcross=new Float32Array(cap);this.sweepDamp=new Float32Array(cap);this.scratchClear=new Float64Array(7);this.scratchPath=new Float64Array(7);this.scratchPos=[0,0,0];this.pathFail=1;this.pathMin=Infinity;this.pathAX=1;this.pathAZ=0;this.pathX=0;this.pathZ=0;
    this.scratchCore={center:{x:0,y:0,z:0},radius:0,u:0};
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
      this.heading[k]=1;this.heading[k+1]=0;this.heading[k+2]=0;this.goal[i*2]=1;this.goal[i*2+1]=0;this.turnFrom[i]=0;this.turnNow[i]=0;
      this.phase[i]=0;this.cycles[i]=0;this.idle[i]=0;this.pace[i]=1;this.hold[i]=0;this.active[i]=0;this.forced[i]=0;
      this.hub[i]=0;this.room[i]=0;this.roomAxis[i]=0;this.roomAcross[i]=0;this.sweepDamp[i]=0;
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
    this.count=Math.max(this.count,i+1);this.placed[i]++;
    // round three: a body put down (a new one, one re-placed on its leash, a squad's member off its record's line) stands clear of the rock
    if(this.clearLimit){const C=this.clearLimit(i,x,z,this.config.r0*this.scale[i]*BODY_RADII,this.scratchClear);x+=C[0];z+=C[1];}
    this.offset[k]=x;this.offset[k+1]=0;this.offset[k+2]=z;
    this.heading[k]=Math.cos(angle);this.heading[k+1]=0;this.heading[k+2]=Math.sin(angle);this.goal[i*2]=this.heading[k];this.goal[i*2+1]=this.heading[k+2];this.turnFrom[i]=this.turnNow[i]=0;
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
    const c=this.config,s=this.lengthScale,k=i*3,x=this.offset[k],z=this.offset[k+2],dx=tx-x,dz=tz-z,distance=Math.hypot(dx,dz),radius=c.r0*this.scale[i],h0x=this.heading[k],h0z=this.heading[k+2],fork=c.forkAngle??1.2;
    // a target on the spot has no direction; keep the heading rather than collapse it to zero
    let hx=distance>1e-4*s?dx/distance:this.heading[k],hz=distance>1e-4*s?dz/distance:this.heading[k+2],sx=0,sz=0,ax=0,az=0,cx=0,cz=0,n=0;
    const near=2.25*s*s,tiny=1e-5*s*s;
    if(neighbors&&this.count>1)for(let j=0;j<this.count;j++)if(i!==j&&this.active[j]&&this.hub[j]===this.hub[i]){const q=j*3,ex=x-this.occupied[q],ez=z-this.occupied[q+2],d2=ex*ex+ez*ez;if(d2<near&&d2>tiny){const w=Math.max(0,1-Math.sqrt(d2)/(radius*3));sx+=ex/d2*w*s;sz+=ez/d2*w*s;ax+=this.heading[q];az+=this.heading[q+2];cx-=ex;cz-=ez;n++;}}
    hx+=sx*c.separation*.35;hz+=sz*c.separation*.35;
    if(n){hx+=ax/n*c.alignment*.3+cx/n*c.cohesion/s;hz+=az/n*c.alignment*.3+cz/n*c.cohesion/s;}
    const erratic=(hash(i*19+this.cycles[i]*7)-.5)*(c.headingJitter??.65),cos=Math.cos(erratic),sin=Math.sin(erratic),length=Math.hypot(hx,hz)||1;
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
      if(this.clearLimit)this.clearProbes(i,x,z,0,radius);
    } else {
      this.forced[i]=0;
      this.heading[k]=(hx*cos-hz*sin)/length;this.heading[k+2]=(hx*sin+hz*cos)/length;
      // round four: a hop turns the heading by at most maxTurn
      if(c.maxTurn>0&&Math.hypot(h0x,h0z)>.5){const nx=this.heading[k],nz=this.heading[k+2],d=Math.atan2(nz*h0x-nx*h0z,nx*h0x+nz*h0z);if(Math.abs(d)>c.maxTurn){const a=Math.atan2(h0z,h0x)+Math.sign(d)*c.maxTurn;this.heading[k]=Math.cos(a);this.heading[k+2]=Math.sin(a);}}
      const reach=Math.min(c.reach*radius*(1+.18*hunt),Math.max(0,distance-radius*.55));
      const count=Math.max(1,Math.min(3,Math.round(c.seekCount)));
      this.probeCount[i]=count;
      if(this.reachLimit)this.clearHeading(i,x,z,reach+radius*REACH_MARGIN,count,distance>1e-4*s?dx/distance:hx/length,distance>1e-4*s?dz/distance:hz/length);
      for(let j=0;j<3;j++){
        const probe=j===0?this.probe0:j===1?this.probe1:this.probe2;
        probe[k]=count===1?0:(j-(count-1)/2)*(count===2?2*fork:1.2);
        probe[k+1]=reach*(count===1?1:.58+.42*hash(i*29+this.cycles[i]*13+j*41+5));
        probe[k+2]=j*2.17+hash(i*7+j*19)*1.4;
        if(this.reachLimit&&j<count)probe[k+1]=this.clearReach(i,x,z,probe[k],probe[k+1],radius);
      }
      if(this.clearLimit)this.clearProbes(i,x,z,count,radius);
      this.selectProbe(i,tx,tz);
    }
    /* Selected reach is written by selectProbe. */this.params[i*4+1]=c.cubenessPeak;this.params[i*4+2]=c.pulseSpeed;this.params[i*4+3]=c.wobble;
    // Telegraph stays >=120ms even at maximum urgency. Candidate directions lock now; multiple probes choose the anchor after seeking.
    const jitter=.8+hash(i*43+this.cycles[i]*17)*.4;
    const base=c.cycleDuration*(1-.3*hunt),duration=base*(jitter*(1-.35*hunt)+.35*hunt);
    const beat=Math.ceil((this.time+duration)/base)*base-this.time;
    this.duration[i]=duration+(beat-duration)*.18*hunt;
    this.idle[i]=!planted&&distance<radius*.7?1:0;
    if(c.turnInCoil)this.easeHeading(i,h0x,h0z);
  }
  /** Round four: the planned heading becomes the goal, the drawn heading stays (h0x, h0z) and every probe's angle off it is turned by as much, so the
   * stalks reach where the plan put them (a stalk's world direction is the heading's angle minus its own). turnHeadings brings the heading round. */
  easeHeading(i,h0x,h0z) {
    const k=i*3,gx=this.heading[k],gz=this.heading[k+2];
    this.goal[i*2]=gx;this.goal[i*2+1]=gz;this.turnFrom[i]=this.turnNow[i]=0;
    if(!(Math.hypot(h0x,h0z)>.5))return;
    const d=Math.atan2(gx*h0z-gz*h0x,gx*h0x+gz*h0z);   // the drawn heading's angle minus the goal's
    if(Math.abs(d)<1e-6)return;
    this.heading[k]=h0x;this.heading[k+2]=h0z;this.turnFrom[i]=this.turnNow[i]=d;
    for(const probe of [this.probe0,this.probe1,this.probe2])probe[k]+=d;
  }
  /** Round four: each turning instance's heading brought to its goal through the coil (eased: smoothstep of the coil's progress), its probes' angles with it. */
  turnHeadings() {
    for(let i=0;i<this.count;i++){
      const now=this.turnNow[i];
      if(now===0||!this.active[i])continue;
      const ph=this.phase[i],x=Math.min(1,ph/.1),want=ph>=.1?0:this.turnFrom[i]*(1-x*x*(3-2*x)),t=now-want;
      if(t===0)continue;
      const k=i*3,hx=this.heading[k],hz=this.heading[k+2],cs=Math.cos(t),sn=Math.sin(t);
      // the heading's angle goes down by t (toward the goal), and so does every probe's off it
      this.heading[k]=hx*cs+hz*sn;this.heading[k+2]=hz*cs-hx*sn;
      this.probe0[k]-=t;this.probe1[k]-=t;this.probe2[k]-=t;this.turnNow[i]=want;
      if(want===0){this.heading[k]=this.goal[i*2];this.heading[k+2]=this.goal[i*2+1];}
    }
  }
  /** Round two: the heading turned toward clear ground when the rock or a wall stops every one of its `count` stalks (their fixed angles off the
   * heading, as plan lays them) within 3/4 of `want`: of the turns up to 1.35 rad either side, the one whose best stalk makes the most clear way
   * toward the target (unit (ux, uz)). Only with a host's reachLimit. */
  clearHeading(i,x,z,want,count,ux,uz) {
    const k=i*3,hx=this.heading[k],hz=this.heading[k+2],angles=STALK_ANGLES(count,this.config.forkAngle??1.2);
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
  /** Round three: the body's footprint held off the rock and the walls (with a host's clearLimit). Each of the `count` seeking stalks' tips (the anchor
   * it may become) is moved to where BODY_RADII r of open ground is round it (the body settles there), re-aimed and re-measured, and is shortened
   * (then dropped) while the straight way to it is not clear (the stalk's ray, round two's cup margin) or its middle has under TRANSFER_RADII r (the
   * body passes there in its transfer). Then the instance's room (the least round its origin and its tips, over BODY_RADII r: under 1 the shader
   * squeezes it across the nearest wall) and its sweep damping (the stalks' sideways sweep and bow fitted into the room beside the tips and middles). */
  clearProbes(i,x,z,count,radius) {
    const k=i*3,hx=this.heading[k],hz=this.heading[k+2],rho=radius*BODY_RADII,C=this.scratchClear;
    this.clearLimit(i,x,z,rho,C,1);
    const origin=C[6],need=Math.min(radius*TRANSFER_RADII,.8*Math.max(0,origin)),squeezed=Math.min(need,radius*SQUEEZE_RADII);
    let room=Math.min(origin,rho),axis=Math.atan2(C[4],C[3]),axisAt=room,lateral=(origin-radius*1.2)/(radius*SWEEP_BASE),tips=0;
    TIPS[tips++]=x;TIPS[tips++]=z;
    for(let j=0;j<count;j++){
      const probe=j===0?this.probe0:j===1?this.probe1:this.probe2,a=probe[k],c=Math.cos(a),s=Math.sin(a),ux0=hx*c+hz*s,uz0=hz*c-hx*s;
      let d=probe[k+1],ok=false,vx=0,vz=0,nd=0,tipRoom=0,tipClear=0,tipAxis=0,way=0;
      for(let tries=0;tries<3&&d>radius*.5;tries++,d=Math.min(d*.6,this.pathFail*nd-radius*.5)){
        this.clearLimit(i,x+ux0*d,z+uz0*d,rho,C);
        vx=ux0*d+C[0];vz=uz0*d+C[1];nd=Math.hypot(vx,vz);tipRoom=Math.min(C[2],C[5]);tipClear=C[5];tipAxis=Math.atan2(C[4],C[3]);
        if(nd<radius*.5)break;
        // the way to it wide enough for the stalk, its cup and the body's transfer: every point of the segment `need` from the rock; or, where a
        // passage ahead is narrower than that, wide enough for the body squeezed through it (SQUEEZE_RADII), the room then the passage's
        this.pathFail=1;this.pathMin=Infinity;way=this.clearPath(i,x,z,origin,x+vx,z+vz,tipClear,need,4,0,1);
        if(way>=need){ok=true;break;}
        if(squeezed<need){this.pathFail=1;this.pathMin=Infinity;way=this.clearPath(i,x,z,origin,x+vx,z+vz,tipClear,squeezed,4,0,1);if(way>=squeezed){ok=true;break;}}
      }
      if(!ok){probe[k+1]=0;continue;}
      if(tipRoom<rho&&tips<TIPS.length){TIPS[tips++]=x+vx;TIPS[tips++]=z+vz;}
      if(tipRoom<axisAt){axisAt=tipRoom;axis=tipAxis;}
      if(way<need&&this.pathMin<Infinity){if(way<axisAt){axisAt=way;axis=Math.atan2(this.pathAZ,this.pathAX);}if(tips<TIPS.length){TIPS[tips++]=this.pathX;TIPS[tips++]=this.pathZ;}}
      room=Math.min(room,tipRoom,way);lateral=Math.min(lateral,(tipClear-radius*REACH_MARGIN)/(radius*SWEEP_TIP),(way-radius*.5)/(radius*SWEEP_MID));
      probe[k]=Math.atan2(hz*vx-hx*vz,vx*hx+vz*hz);probe[k+1]=nd;
    }
    this.room[i]=Math.max(.05,Math.min(4,room/rho));this.roomAxis[i]=axis;
    // under its footprint somewhere on the hop: the room square to the axis too (at the origin, each tight tip and a squeezed way's narrows)
    let across=4;
    if(room<rho)for(let t=0;t<tips;t+=2)across=Math.min(across,this.acrossAt(i,TIPS[t],TIPS[t+1],axis,rho));
    this.roomAcross[i]=across;
    this.sweepDamp[i]=lateral>=1?0:1-Math.max(0,lateral);
  }
  /** Round three: the open ground square to the squeeze's axis at (x, z), both ways, over rho (at most 4). */
  acrossAt(i,x,z,axis,rho) {
    if(!this.reachLimit)return 4;
    const px=-Math.sin(axis),pz=Math.cos(axis);
    return Math.max(.05,Math.min(this.reachLimit(i,x,z,px,pz,rho),this.reachLimit(i,x,z,-px,-pz,rho))/rho);
  }
  /** Round three: a lower bound of the clearance all along the segment from (ax, az) (clearance ca) to (bx, bz) (clearance cb): the rock is outside both
   * ends' discs, so no nearer than sqrt(min(ca, cb)^2 - (len / 2)^2) to the segment; while that is under `need` the middle is measured and both halves
   * looked at, `depth` times at most (a corridor's straight way takes a few). Under `need`: the way is not clear, and this.pathFail is the share of
   * the way (from a) where it was first found short, so the next try reaches no further than that. */
  clearPath(i,ax,az,ca,bx,bz,cb,need,depth,t0,t1) {
    const len=Math.hypot(bx-ax,bz-az),c=Math.min(ca,cb),g=c*c-len*len/4>0?Math.sqrt(c*c-len*len/4):0;
    if(g>=need)return g;
    if(depth<=0){this.pathFail=Math.min(this.pathFail,t0);return g;}
    const mx=(ax+bx)/2,mz=(az+bz)/2,tm=(t0+t1)/2,P=this.clearLimit(i,mx,mz,need,this.scratchPath,1),cm=P[6];
    if(cm<this.pathMin){this.pathMin=cm;this.pathAX=P[3];this.pathAZ=P[4];this.pathX=mx;this.pathZ=mz;}
    if(cm<need){this.pathFail=Math.min(this.pathFail,tm);return cm;}
    const g1=this.clearPath(i,ax,az,ca,mx,mz,cm,need,depth-1,t0,tm);
    return g1<need?g1:Math.min(g1,this.clearPath(i,mx,mz,cm,bx,bz,cb,need,depth-1,tm,t1));
  }
  /** Round three: a body at rest moved off the rock (an impact's knock carried it there) and its room measured; with `push` false only measured (a
   * dying body is not moved: its puddle is squeezed instead). */
  clearBody(i,push=true) {
    if(!this.clearLimit)return;
    const k=i*3,radius=this.config.r0*this.scale[i],rho=radius*BODY_RADII,at=push?null:this.positionInto(i,this.scratchPos),C=this.clearLimit(i,at?at[0]:this.offset[k],at?at[2]:this.offset[k+2],rho,this.scratchClear);
    if(push)for(const a of [this.offset,this.anchor,this.occupied]){a[k]+=C[0];a[k+2]+=C[1];}
    this.room[i]=Math.max(.05,Math.min(4,(push?C[5]:C[6])/rho));this.roomAxis[i]=Math.atan2(C[4],C[3]);
    this.roomAcross[i]=this.room[i]<1?this.acrossAt(i,at?at[0]:this.offset[k],at?at[2]:this.offset[k+2],this.roomAxis[i],rho):4;
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
        for(let i=0;i<this.count;i++){if(!this.active[i])continue;const k=i*3,t=this.phase[i]<.62?0:transferProgress((this.phase[i]-.62)/.23,c.transferAcceleration,c.transferEase);this.occupied[k]=this.offset[k]+(this.anchor[k]-this.offset[k])*t;this.occupied[k+2]=this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*t;}
    for(let i=0;i<this.count;i++){
      if(!this.active[i]||this.hold[i])continue;
      const k=i*3,tx=tgt[i*2],tz=tgt[i*2+1];
      if(this.idle[i]){if(this.plant[k+2]===1||Math.hypot(tx-this.offset[k],tz-this.offset[k+2])>c.r0*this.scale[i]){this.cycles[i]++;this.plan(i,tx,tz);this.phase[i]=0;}continue;}
      if(this.phase[i]===0)this.plan(i,tx,tz);
      const pace=this.pace[i]>0?this.pace[i]:1,timing=cycleTiming(this.duration[i]*pace,c.timing),phase=this.phase[i];
      const rate=phase<.1?.1/timing.coil:phase<.55?.45/timing.extend:phase<.62?.07/timing.anchor:phase<.85?.23/timing.transfer:.15/timing.settle;
      this.phase[i]+=dt*rate;
      if(this.plant[k+2]===2&&this.phase[i]>0)this.plant[k+2]=0;
      if(phase<.55&&this.phase[i]>=.55&&this.probeCount[i]>1)this.selectProbe(i,tx,tz);
      if(this.phase[i]>=1){this.offset[k]=this.anchor[k];this.offset[k+2]=this.anchor[k+2];this.cycles[i]++;this.plan(i,tx,tz);this.phase[i]=0;}
      this.params[i*4+1]=c.cubenessPeak;this.params[i*4+2]=c.pulseSpeed;this.params[i*4+3]=c.wobble;
    }
    if(c.turnInCoil)this.turnHeadings();
  }
  /** The kit's 1/120 s stepping: add real time (at most 50 ms), take whole steps, keep the remainder. Returns the steps taken. */
  advance(dt) {
    if(!(dt>0))return 0;
    if(this.config.frameStep){const d=Math.min(.05,dt),n=Math.max(1,Math.ceil(d*60-1e-6));for(let k=0;k<n;k++)this.step(d/n);return n;}
    this.clock+=Math.min(.05,dt);let n=0;
    while(this.clock>=STEP){this.step(STEP);this.clock-=STEP;n++;}
    return n;
  }
  position(i) { return this.positionInto(i,[0,0,0]); }
  /** Round two (the fable review: no per-frame garbage): position(i) written into `out` [x, 0, z]. */
  positionInto(i,out) { if((this.config.coreShape??0)>0){const {center}=this.coreContactInto(i,this.scratchCore);out[0]=center.x;out[1]=0;out[2]=center.z;return out;}const k=i*3,t=this.phase[i]<.62?0:transferProgress((this.phase[i]-.62)/.23,this.config.transferAcceleration,this.config.transferEase);out[0]=this.offset[k]+(this.anchor[k]-this.offset[k])*t;out[1]=0;out[2]=this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*t;return out; }
  /** The core on the shared transfer path: the body's centre as the membrane shader's uHardRadius block computes it (one transfer clock, delay uDelay/2), lifted clear of the ground; its radius rigid (coreSize x r). Plane metres, y up, before the shader's ground clamp, deflate, lift and planet bend. */
  getCoreContact(i) { const c=this.coreContactInto(i,{center:{x:0,y:0,z:0},radius:0,u:0});return {...coreContact(this.config),center:c.center,radius:c.radius,u:c.u}; }
  /** Round two (the fable review: getCoreContact rebuilt coreContact(config) and three objects a call, twice a cored body a frame): the centre, radius and
   * transfer share written into `out` { center: { x, y, z }, radius, u }, nothing allocated; getCoreContact is this plus the tier's contact spec. */
  coreContactInto(i,out) {
    const config=this.config,k=i*3,r=config.r0*this.scale[i],phase=this.phase[i],s=this.lengthScale,delay=config.delaySpread,center=out.center;
    const transfer=transferProgress((phase-.62)/.23,config.transferAcceleration,config.transferEase);
    const u=easeShare((transfer-delay*.5)/Math.max(.02,1-delay),config.transferEase);
    const travel=2*u-u*u,height=r*.78*((1-u)**2+u*u)+2*(1-u)*u*.014*s;
    center.x=this.offset[k]+(this.anchor[k]-this.offset[k])*travel;center.y=height;center.z=this.offset[k+2]+(this.anchor[k+2]-this.offset[k+2])*travel;
    if(phase>=.85){const settle=(phase-.85)/.15,recoil=Math.exp(-6*settle)*Math.sin(settle*22)*r*.12*config.wobble;center.x=this.anchor[k]+this.heading[k]*recoil;center.z=this.anchor[k+2]+this.heading[k+2]*recoil;center.y=r*.78;}
    // coreContact's collisionRadius (r0 x coreSize for a hard core, 0 for a soft body) x the instance's scale
    const radius=(config.coreShape??0)>=1?config.r0*(config.coreSize??.28)*this.scale[i]:0;if(radius>0)center.y=Math.max(center.y,radius*1.3+.018*s);
    out.radius=radius;out.u=u;return out;
  }
  contactDamageAt(i,point,unitRadius,dt) { const c=this.getCoreContact(i);return !c.rammable&&Math.hypot(point.x-c.center.x,point.y-c.center.y,point.z-c.center.z)<=c.radius+Math.max(0,unitRadius)?c.contactDamagePerSecond*Math.max(0,dt):0; }
  getState(i) { return this.idle[i]?'REST':phaseState(this.phase[i]); }
  getAnchor(i) { return {x:this.anchor[i*3],y:this.anchor[i*3+1],z:this.anchor[i*3+2]}; }
  getStretchSegment(i) { const k=i*3;return {from:{x:this.offset[k],y:this.config.r0*this.scale[i],z:this.offset[k+2]},to:this.getAnchor(i),vulnerable:this.phase[i]>=.1&&this.phase[i]<.62,intangible:this.phase[i]>=.62&&this.phase[i]<.85}; }
  scrub(phase) { this.frozen=true;this.idle[0]=0;this.phase[0]=Math.max(0,Math.min(.9999,phase)); }
}
