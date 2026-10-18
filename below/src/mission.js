import {rimRadius, bowlHeight, SINKHOLE_INNER, SINKHOLE_DEPTH} from './stalheart/sinkhole-shape.js';

// Metres and seconds. The same geometry contract drives rendering and flight.
// THE ESCAPE CLOCK (owner, 2026-10-18: "the maze is longer now, I think ISAO might need more time to be able to get out"): 65 s was set before the maze's
// bends and the shaft's bow. Measured on the cave's own route autopilot (scripts/browser-test.mjs, queen to p.y > 2 by the main route): 56.6 s turning
// instantly, 74.3 s turning at 2.5 rad/s and only flying once facing the way (a mouse pilot, the reasonable run), 101.9 s on the A/D keys alone (1.3 rad/s).
// 100 s is the reasonable run plus about a third; 65 left it eight seconds on the perfect line and none on the reasonable one
export const FUSE=100, FLARE_COUNT=15, EGG_COUNT=1600, HOLE_SCALE=24;
export const CHAMBER={x:0,y:-208,z:-79,r:90,ry:58,opening:.1};
export const QUEEN={x:0,y:-219,z:-101,scale:620,baseY:-254};
export const START={x:0,y:11,z:23};
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const elbow=12*Math.PI/2, upperStart=8+elbow;
// Arc-length sampling keeps bends and flight speed independent of spline parameter.
function curveRoute(controls){
  const samples=[{s:0,p:controls[0]}];let length=0,last=controls[0];
  for(let i=0;i<controls.length-1;i++)for(let j=1;j<=48;j++){
    const p=catmull(controls[Math.max(0,i-1)],controls[i],controls[i+1],controls[Math.min(controls.length-1,i+2)],j/48);length+=distance(last,p);samples.push({s:length,p});last=p;
  }return {samples,length};
}
function pointOnCurve(route,s){
  s=clamp(s,0,route.length);let lo=0,hi=route.samples.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(route.samples[mid].s<s)lo=mid+1;else hi=mid;}
  const a=route.samples[Math.max(0,lo-1)],c=route.samples[lo],t=(s-a.s)/(c.s-a.s||1);return {x:a.p.x+(c.p.x-a.p.x)*t,y:a.p.y+(c.p.y-a.p.y)*t,z:a.p.z+(c.p.z-a.p.z)*t};
}
const upperRoute=curveRoute([[0,-12],[0,-20],[22,-31],[-20,-49],[0,-59],[0,-67]].map(([x,z])=>({x,y:-HOLE_SCALE*SINKHOLE_DEPTH-20,z})));
export const MAZE_LENGTH=upperRoute.length,MAZE_ADDED_LENGTH=MAZE_LENGTH-55;
const dropTurn=upperStart+MAZE_LENGTH;
export const SHAFT_START=dropTurn+elbow;
export const SHAFT_TOP=-HOLE_SCALE*SINKHOLE_DEPTH-8-24;
export const CHAMBER_LIP=CHAMBER.y+CHAMBER.ry*Math.cos(CHAMBER.opening);
export const ROUTE_END=SHAFT_START+(SHAFT_TOP-CHAMBER_LIP);

// The bowl remains exterior. Darkness starts only after crossing its throat.
export const SINKHOLE_THROAT=-HOLE_SCALE*SINKHOLE_DEPTH;
export function exteriorExposure(y,s=0){return smooth(SINKHOLE_THROAT-38,SINKHOLE_THROAT-1,y)*(1-smooth(4,65,s));}

export function center(s){
  s=clamp(s,0,ROUTE_END);const throat=-HOLE_SCALE*SINKHOLE_DEPTH;
  if(s<=8)return {x:0,y:throat-s,z:0};
  if(s<upperStart){const a=(s-8)/12;return {x:0,y:throat-8-12*Math.sin(a),z:-12*(1-Math.cos(a))};}
  if(s<dropTurn)return pointOnCurve(upperRoute,s-upperStart);
  if(s<SHAFT_START){const a=(s-dropTurn)/12;return {x:0,y:throat-20-12*(1-Math.cos(a)),z:-67-12*Math.sin(a)};}
  // THE SHAFT BOWS (owner, 2026-10-16: 'then the tunnel goes down to the queen, but with a little J curve. Forcing the user to place flares thoughtfully'):
  // the drop to the chamber's lip leaves the vertical by SHAFT_BOW metres at its middle and comes back over the lip, so no flare dropped at the top
  // lights the bottom and the way down has to be lit in two throws. The ends stay where they were: the lip and the drop turn are unmoved
  const d=s-SHAFT_START,L=SHAFT_TOP-CHAMBER_LIP;return {x:SHAFT_BOW*Math.sin(Math.PI*Math.max(0,Math.min(1,d/L))),y:SHAFT_TOP-d,z:-79};
}
export const SHAFT_BOW=14;   // 14 m: more than the shaft's radius, so the top never sees the bottom; at 22 the wall leaned under 65 degrees and a flare stuck to it mid-shaft (flare-physics.js rests on anything flatter)
function normalize(p){const n=Math.hypot(p.x,p.y,p.z)||1;return {x:p.x/n,y:p.y/n,z:p.z/n};}
export function frameAt(s,branch='main'){
  const a=branchCenter(branch,s-.05),b=branchCenter(branch,s+.05),t=normalize({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});
  const u=normalize({x:1-t.x*t.x,y:-t.x*t.y,z:-t.x*t.z});
  const v={x:t.y*u.z-t.z*u.y,y:t.z*u.x-t.x*u.z,z:t.x*u.y-t.y*u.x};
  return {c:branchCenter(branch,s),t,u,v};
}
export function radius(s,branch='main'){if(branch!=='main'){const b=BRANCHES.find(b=>b.id===branch);return b.id==='blind'?9.4-3.5*smooth(b.length-18,b.length,s):8.8;}return HOLE_SCALE*SINKHOLE_INNER+(9.4-HOLE_SCALE*SINKHOLE_INNER)*smooth(0,12,s)+(CHAMBER.r*Math.sin(CHAMBER.opening)-9.4)*smooth(SHAFT_START,ROUTE_END,s);}
export function wallRadius(s,a,branch='main'){
  const noise=.065*Math.sin(a*5+s*.11)+.045*Math.cos(a*9-s*.07)+.045*Math.sin(s*.83+a*7)+.025*Math.cos(s*1.4-a*13);
  const rim=branch==='main'?(rimRadius(a)-1)*(1-smooth(0,8,s)):0;
  return radius(s,branch)*(1+rim+noise*(branch==='main'?smooth(0,8,s)*(1-smooth(ROUTE_END-12,ROUTE_END,s)):1));
}
export function terminalDepth(r,a){return Math.max(0,1-r*r)*(1.15+r*.32*Math.sin(a*7+r*11)+r*.22*Math.cos(a*3-r*17));}
function terminalOverrun(p,b,margin=0){
  const f=b.endFrame||frameAt(b.length,b.id),x=p.x-f.c.x,y=p.y-f.c.y,z=p.z-f.c.z,along=x*f.t.x+y*f.t.y+z*f.t.z;
  const u=x*f.u.x+y*f.u.y+z*f.u.z,v=x*f.v.x+y*f.v.y+z*f.v.z,a=Math.atan2(v,u),r=Math.hypot(u,v)/wallRadius(b.length,a,b.id);
  return {over:along-terminalDepth(r,a)+margin,t:f.t};
}
function startOverrun(p,b,margin=0){const f=b.startFrame||frameAt(0,b.id);return {over:margin-((p.x-f.c.x)*f.t.x+(p.y-f.c.y)*f.t.y+(p.z-f.c.z)*f.t.z),t:f.t};}
export function ringPoint(s,a,inset=0,branch='main'){const f=frameAt(s,branch),r=wallRadius(s,a,branch)-inset;return {x:f.c.x+r*(f.u.x*Math.cos(a)+f.v.x*Math.sin(a)),y:f.c.y+r*(f.u.y*Math.cos(a)+f.v.y*Math.sin(a)),z:f.c.z+r*(f.u.z*Math.cos(a)+f.v.z*Math.sin(a))};}
// The three sub-tunnels share a real junction, with two open routes to the Queen.
export const BRANCHES=[
  {id:'main',toQueen:true,length:ROUTE_END},
  {id:'left',toQueen:true,controls:[center(48),{x:-18,y:-35,z:-36},{x:-54,y:-41,z:-53},{x:-84,y:-65,z:-95},{x:-86,y:-114,z:-115},{x:-88,y:-164,z:-115},{x:-84,y:-193,z:-115},{x:-74,y:-208,z:-115}]},
  {id:'blind',toQueen:false,controls:[center(48),{x:19,y:-34,z:-42},{x:40,y:-40,z:-57},{x:58,y:-52,z:-65},{x:64,y:-65,z:-63}]}
];
function catmull(a,b,c,d,t){return {x:.5*((2*b.x)+(-a.x+c.x)*t+(2*a.x-5*b.x+4*c.x-d.x)*t*t+(-a.x+3*b.x-3*c.x+d.x)*t*t*t),y:.5*((2*b.y)+(-a.y+c.y)*t+(2*a.y-5*b.y+4*c.y-d.y)*t*t+(-a.y+3*b.y-3*c.y+d.y)*t*t*t),z:.5*((2*b.z)+(-a.z+c.z)*t+(2*a.z-5*b.z+4*c.z-d.z)*t*t+(-a.z+3*b.z-3*c.z+d.z)*t*t*t)};}
for(const b of BRANCHES.slice(1))Object.assign(b,curveRoute(b.controls));
export function branchCenter(id,s){return id==='main'?center(s):pointOnCurve(BRANCHES.find(b=>b.id===id),s);}
for(const b of BRANCHES){b.startFrame=frameAt(0,b.id);b.endFrame=frameAt(b.length,b.id);b.route=Array.from({length:Math.ceil(b.length)+1},(_,i)=>({s:Math.min(i,b.length),p:branchCenter(b.id,Math.min(i,b.length))}));b.bounds={min:{x:Infinity,y:Infinity,z:Infinity},max:{x:-Infinity,y:-Infinity,z:-Infinity}};for(const n of b.route)for(const a of ['x','y','z']){b.bounds.min[a]=Math.min(b.bounds.min[a],n.p[a]-12);b.bounds.max[a]=Math.max(b.bounds.max[a],n.p[a]+12);}}
function nearestOn(b,p){
  let best=Infinity,result;
  for(let i=1;i<b.route.length;i++){
    const a=b.route[i-1],c=b.route[i],x=c.p.x-a.p.x,y=c.p.y-a.p.y,z=c.p.z-a.p.z;
    const t=clamp(((p.x-a.p.x)*x+(p.y-a.p.y)*y+(p.z-a.p.z)*z)/(x*x+y*y+z*z),0,1);
    const at={x:a.p.x+x*t,y:a.p.y+y*t,z:a.p.z+z*t},d=distance(p,at);
    if(d<best){best=d;result={s:a.s+(c.s-a.s)*t,c:at,d,branch:b.id};}
  }return result;
}
export function nearestRoute(p){let best=null;for(const b of BRANCHES){const n=nearestOn(b,p);if(!best||n.d<best.d)best=n;}return best;}
function wallAngle(p,n){const f=frameAt(n.s,n.branch),x=p.x-n.c.x,y=p.y-n.c.y,z=p.z-n.c.z;return Math.atan2(x*f.v.x+y*f.v.y+z*f.v.z,x*f.u.x+y*f.u.y+z*f.u.z);}
export function tunnelClearance(p,exclude=null){
  let best=-Infinity;
  for(const b of BRANCHES){
    if(b.id===exclude||['x','y','z'].some(a=>p[a]<b.bounds.min[a]-1||p[a]>b.bounds.max[a]+1))continue;
    const n=nearestOn(b,p);let clear=wallRadius(n.s,wallAngle(p,n),b.id)-n.d;
    if(b.id!=='main')clear=Math.min(clear,-startOverrun(p,b).over);if(!b.toQueen)clear=Math.min(clear,-terminalOverrun(p,b).over);best=Math.max(best,clear);
  }return best;
}
export function chamberClearance(p){return (1-Math.hypot((p.x-CHAMBER.x)/CHAMBER.r,(p.y-CHAMBER.y)/CHAMBER.ry,(p.z-CHAMBER.z)/CHAMBER.r))*CHAMBER.ry;}
export function isTunnelInterior(p,margin=0,exclude=null){
  for(const b of BRANCHES){if(b.id===exclude||['x','y','z'].some(a=>p[a]<b.bounds.min[a]||p[a]>b.bounds.max[a]))continue;const n=nearestOn(b,p);if(n.d<wallRadius(n.s,wallAngle(p,n),b.id)-margin&&(b.id==='main'||startOverrun(p,b,margin).over<=0)&&(b.toQueen||terminalOverrun(p,b,margin).over<=0))return true;}return false;
}
export function chamberFloor(x,z){const q=((x-CHAMBER.x)/CHAMBER.r)**2+((z-CHAMBER.z)/CHAMBER.r)**2;return CHAMBER.y-CHAMBER.ry*Math.sqrt(Math.max(0,1-q));}
export function inChamber(p,margin=0){return ((p.x-CHAMBER.x)/(CHAMBER.r-margin))**2+((p.y-CHAMBER.y)/(CHAMBER.ry-margin))**2+((p.z-CHAMBER.z)/(CHAMBER.r-margin))**2<=1;}
export function surfaceHeight(x,z){const a=Math.atan2(z,x),r=Math.hypot(x,z)/(HOLE_SCALE*rimRadius(a));if(r>=1)return 0;if(r<SINKHOLE_INNER)return -Infinity;return HOLE_SCALE*bowlHeight(a,r);}
export function confine(p,margin=.65){
  if(p.y>=-HOLE_SCALE*SINKHOLE_DEPTH+.4){
    const floor=surfaceHeight(p.x,p.z)+margin;
    const old={...p};p.y=clamp(p.y,floor,32);p.x=clamp(p.x,-65,65);p.z=clamp(p.z,-65,65);return distance(old,p)>.001;
  }
  if(isTunnelInterior(p,margin)||inChamber(p,margin))return false;
  let tube=null,tubeDistance=Infinity;
  for(const b of BRANCHES){const n=nearestOn(b,p),limit=wallRadius(n.s,wallAngle(p,n),b.id)-margin,d=n.d||1;const c={x:n.c.x+(p.x-n.c.x)/d*limit,y:n.c.y+(p.y-n.c.y)/d*limit,z:n.c.z+(p.z-n.c.z)/d*limit};if(b.id!=='main'){const cap=startOverrun(c,b,margin);if(cap.over>0){c.x+=cap.t.x*cap.over;c.y+=cap.t.y*cap.over;c.z+=cap.t.z*cap.over;}}if(!b.toQueen){const cap=terminalOverrun(c,b,margin);if(cap.over>0){c.x-=cap.t.x*cap.over;c.y-=cap.t.y*cap.over;c.z-=cap.t.z*cap.over;}}const correction=distance(p,c);if(correction<tubeDistance){tubeDistance=correction;tube=c;}}
  const rx=CHAMBER.r-margin,ry=CHAMBER.ry-margin,ex=(p.x-CHAMBER.x)/rx,ey=(p.y-CHAMBER.y)/ry,ez=(p.z-CHAMBER.z)/rx,k=Math.hypot(ex,ey,ez);
  const chamber={x:CHAMBER.x+ex/k*rx,y:CHAMBER.y+ey/k*ry,z:CHAMBER.z+ez/k*rx};
  const correction=distance(p,tube)<distance(p,chamber)?tube:chamber;
  p.x=correction.x;p.y=correction.y;p.z=correction.z;return true;
}
export function pointSegmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy+(p.z-a.z)*dz)/(dx*dx+dy*dy+dz*dz||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy,p.z-a.z-t*dz);}
// A broad region around the Queen, never a world-space waypoint or exact socket.
// anywhere near the Queen, not one spot (the owner, 2026-10-16): the chamber round her within 70 m, from well under her to well over
export function closeToQueen(p){return p.y<QUEEN.y+16&&p.y>QUEEN.baseY-14&&Math.hypot(p.x-QUEEN.x,p.z-QUEEN.z)<70&&inChamber(p,1);}
export const MAX_HP=12;
export function createMission(){return {phase:'descent',integrity:MAX_HP,hits:0,lampState:'working',lidarAvailable:false,lidarProcessingAt:0,lidar:false,lidarMode:0,payload:true,armProgress:0,bombPosition:null,fuse:FUSE,time:0,nursery:false,shaftSeen:false,deadEndSeen:false,flares:FLARE_COUNT,extracted:false,signalLost:false,detonated:false,outcome:null};}
export function recordImpact(m){
  if(m.outcome||m.extracted||m.signalLost||m.integrity<=0)return [];
  m.integrity=Math.max(0,m.integrity-1);m.hits++;
  if(m.hits===1)return ['airframe-hit'];
  if(m.hits===2){m.lampState='flicker';m.lampAt=m.time;return ['lamp-flicker'];}   // the second hit: the lamp flickers, comes back, then fails for good (the owner, 2026-10-16; see lampStrength)
  return [];
}
export function useFlare(m){if(m.outcome||m.extracted||m.signalLost||m.flares<=0)return false;m.flares--;return true;}
// THE WORK LIGHT (the owner, 2026-10-16: "the lamp should not fail right away... it should start stronger, then start to fail with flickers... come back...
// fail again for good a bit later"): strong while whole; after the second hit LAMP.flicker seconds of flicker, back (dimmer) for LAMP.back seconds, then out
// FLARES STICK TO SLOPES (owner, 2026-10-18: "the flares need to STICK to sloped areas better, although they must fall with gravity"; flare-physics.js):
// on contact the rock grips (friction, coefficient `friction`, against gravity's push into the surface), and a flare slower than `restSpeed` on rock no
// steeper than `restSlope` degrees comes to rest. Two numbers: with mu 1, gravity's pull along the slope beats the grip from 45 degrees (tan 45 = 1), so
// from there a flare speeds up rather than slows; the rest threshold is 50 degrees, so between 45 and 50 a flare still rests if it is already slow, and
// above 50 it slides on (the bowed shaft's 67-degree lean never holds one). "Static friction" here means only that a resting flare never wakes: stepFlare
// returns at once for a resting flare and nothing in the cave pushes flares. In the air nothing changes
export const FLARE_STICK={restSlope:50,restSpeed:.9,friction:1};
export const LAMP={strong:1.25,flicker:6,back:25,dim:.8};
export function lampStrength(m){
  if(m.lampState==='failed')return 0;
  if(m.lampState==='flicker'){const t=m.time*1;return .25+.75*Math.abs(Math.sin(t*23.1)*Math.sin(t*7.3)+.3*Math.sin(t*41));}
  if(m.lampState==='back')return LAMP.dim;
  return LAMP.strong;
}
export function tickMission(m,dt,p,arming){
  if(m.outcome)return [];const events=[];m.time+=dt;
  if(m.lampState==='flicker'&&m.time-m.lampAt>LAMP.flicker){m.lampState='back';m.lampAt=m.time;events.push('lamp-back');}
  else if(m.lampState==='back'&&m.time-m.lampAt>LAMP.back){m.lampState='failed';events.push('lamp-failed');}
  if(!m.lidarAvailable&&!m.lidarProcessingAt&&p.y<=-86){m.lidarProcessingAt=m.time+4;events.push('lidar-processing');}
  if(!m.lidarAvailable&&m.lidarProcessingAt&&m.time>=m.lidarProcessingAt){m.lidarAvailable=true;events.push('lidar-ready');}
  if(!m.deadEndSeen){const n=nearestRoute(p),b=BRANCHES.find(b=>b.id===n.branch);if(b.id==='blind'&&n.s>b.length-13){m.deadEndSeen=true;events.push('dead-end');}}
  if(!m.shaftSeen&&Math.abs(p.x)<13&&p.z<-67&&p.y<-42){m.shaftSeen=true;events.push('shaft');}
  if(!m.nursery&&p.y<CHAMBER_LIP-5){m.nursery=true;m.phase='nursery';events.push('nursery');}
  if(m.payload&&closeToQueen(p)&&arming){m.armProgress=Math.min(1,m.armProgress+dt/3);if(m.armProgress>=1){m.payload=false;m.bombPosition={x:p.x,y:p.y-.8,z:p.z};m.phase='escape';events.push('armed');}}
  else if(m.payload)m.armProgress=Math.max(0,m.armProgress-dt*.5);
  if(!m.payload){
    // Arming finishes at the end of this tick; the fuse starts on the next one.
    if(!events.includes('armed'))m.fuse=Math.max(0,m.fuse-dt);
    if(m.fuse>0&&!m.extracted&&!m.signalLost&&m.integrity>0&&p.y>2&&Math.hypot(p.x,p.z)<38){m.extracted=true;m.phase='surface';events.push('extracted');}
    if(!m.extracted&&!m.signalLost&&m.integrity<=0){m.signalLost=true;events.push('signal-lost');}
    if(m.fuse<=0){m.detonated=true;m.outcome=m.extracted?'rescued':'sacrifice';events.push('detonated');}
  }
  else if(m.integrity<=0){m.outcome='lost';events.push('lost');}
  return events;
}
