// Engine-driven planar locomotion study. Metres, +Y up, +Z forward.
export const UPPER=1.15, BASE_LOWER=1.85, MAX_LOWER=2.43;
export const FOOT_OFFSET=.38,FOOT_RADIUS=2.90+FOOT_OFFSET;
export const REACH_PAIR=['02','06'],REACH_DISTANCE=1.15,BODY_ADVANCE=.55;
export const legs=Array.from({length:6},(_,i)=>({id:String(i+1).padStart(2,'0'),angle:i*Math.PI/3,tripod:i%2}));
export const motions={
  idle:{name:'Observation_Idle',duration_s:6,loop:true},
  walk:{name:'Tripod_Walk_Cycle',duration_s:3,loop:true,speed_m_s:.30},
  extend:{name:'Reach_Cycle',duration_s:8,loop:true},
  anchor:{name:'Anchor_Deploy',duration_s:8,loop:false}
};
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const refs=new WeakMap();
function nodes(root){if(!refs.has(root)){const map={};root.traverse(o=>map[o.name]=o);refs.set(root,map);}return refs.get(root);}
export function applyPose(root,time=0,mode='idle',reachScale=1){
  const n=nodes(root),body=n.BODY_HEAVE;
  if(!body||root.getObjectByName('DISTANCE_GEOMETRY'))return {phase:'Static observation pose',contacts:6,extension:0,body_advance_m:0};
  const spec=motions[mode]||motions.idle,t=spec.loop?((time%spec.duration_s)+spec.duration_s)%spec.duration_s:clamp(time,0,spec.duration_s),scale=clamp(reachScale,.35,1);
  let height=1.42,advance=0,reach=0,pairLift=0,anchor=0;
  if(mode==='idle')height+=.018*Math.sin(t*Math.PI/3);
  if(mode==='walk')height+=.018*Math.cos(t*Math.PI*4/3);
  if(mode==='extend'||mode==='anchor'){
    const retract=mode==='extend'?smooth((t-4)/2):0;
    reach=smooth((t-.8)/2)*(1-retract)*scale;
    const lower=mode==='extend'?smooth((t-6)/1.2):smooth((t-2.8)/1.4);
    pairLift=.68*smooth(t/.8)*(1-lower);
    if(mode==='anchor'){anchor=smooth((t-2.8)/1.4);advance=BODY_ADVANCE*scale*smooth((t-4.2)/2.6);height-=.10*smooth((t-4.2)/2.6);}
  }
  body.position.set(0,height,advance);
  let contacts=0,maxExtension=0;const feet=[];
  for(const leg of legs){
    const pre='LEG_'+leg.id,active=REACH_PAIR.includes(leg.id),pairMode=mode==='extend'||mode==='anchor';
    let fx=Math.sin(leg.angle)*FOOT_RADIUS,fz=Math.cos(leg.angle)*FOOT_RADIUS,lift=0,stance=true,stroke=0;
    if(pairMode&&active){fz+=REACH_DISTANCE*reach;lift=pairLift;stance=pairLift<1e-8;stroke=.58*reach;}
    if(mode==='walk'){
      const p=(t/3+leg.tripod*.5)%1,duty=.65,stride=.30*3*duty;
      if(p<duty)fz+=stride*(.5-p/duty);
      else{stance=false;const u=(p-duty)/(1-duty);fz+=stride*(-.5+smooth(u));lift=.34*Math.sin(Math.PI*u)**2;}
    }
    // Targets are world-fixed during support and the anchor's body pull.
    const mx=Math.sin(leg.angle)*.62,mz=Math.cos(leg.angle)*.62+advance;
    const dx=fx-FOOT_OFFSET*Math.sin(leg.angle)-mx,dz=fz-FOOT_OFFSET*Math.cos(leg.angle)-mz,r=Math.hypot(dx,dz),dy=.16+lift-height,d=Math.hypot(r,dy);
    // Supporting legs accommodate body travel without sliding their feet.
    const lower=Math.min(MAX_LOWER,Math.max(BASE_LOWER+stroke,d-UPPER+.12));stroke=lower-BASE_LOWER;
    const q=Math.atan2(dy,r)+Math.acos(clamp((UPPER*UPPER+d*d-lower*lower)/(2*UPPER*d),-1,1));
    const beta=Math.atan2(dy-UPPER*Math.sin(q),r-UPPER*Math.cos(q));
    const yaw=Math.atan2(-dz,dx);n[pre+'_YAW'].rotation.set(0,yaw,0);
    n[pre+'_HIP'].rotation.set(0,0,q);n[pre+'_KNEE'].rotation.set(0,0,beta-q);
    n[pre+'_SLIDE'].position.x=lower-.35;
    // Cancel pitch and yaw so all three pad contacts, not only the foot centre,
    // retain their world orientation while the body advances between the feet.
    const sz=Math.sin(-beta/2),cz=Math.cos(-beta/2),sy=Math.sin((leg.angle-Math.PI/2-yaw)/2),cy=Math.cos((leg.angle-Math.PI/2-yaw)/2);
    n[pre+'_ANKLE'].quaternion.set(-sz*sy,cz*sy,sz*cy,cz*cy);
    // Historical CLAW names now drive the three reused ivory pads.
    for(let j=0;j<3;j++)n[pre+'_CLAW_'+(j+1)].rotation.set(0,j*Math.PI*2/3,.20*clamp(lift/.34));
    if(stance)contacts++;maxExtension=Math.max(maxExtension,stroke/.58);
    feet.push({id:leg.id,active:pairMode&&active,lift,stroke_m:stroke,stance,target:[fx,lift,fz]});
  }
  root.updateMatrixWorld(true);
  const phase=mode==='anchor'?(t<.8?'Lift pair 02 + 06 / four supporting legs':t<2.8?'Reach forward / pair 02 + 06':t<4.2?'Plant the two anchors ahead':t<6.8?'Pull body forward / anchors fixed':'Forward step complete / six-point hold'):mode==='extend'?(t<.8?'Lift pair 02 + 06':t<2.8?'Reach forward / four legs stay planted':t<4?'Hold the pair aloft':t<6?'Retract the reaching pair':t<7.2?'Return pair to ground':'Six-point support'):mode==='walk'?'Alternating tripod / 0.30 m/s':'Observation / pressure regulation';
  return {phase,contacts,extension:maxExtension,anchor,feet,body_advance_m:advance,reach_distance_m:REACH_DISTANCE*reach,active_pair:(mode==='extend'||mode==='anchor')?REACH_PAIR:[]};
}
