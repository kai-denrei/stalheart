// The kit's scripts/verify-monster.mjs and scripts/verify-probes.mjs as of the export's commit f2a4f89 (lab-creatures, kai-denrei;
// derived from Jelly Baby by scottstts; GPL-3.0, see src/fx/nih-dairia/LICENSE), pointed at the port, plus the test of upstream b3cfb52 (turning prey must not starve the pull phase; the pursuit fix).
// Changes from the kit's scripts: imports go to src/fx/nih-dairia and the vendored three; the models load
// from assets/creatures/nih-dairia relative to this file; verify-monster's parseBabyCage (in the kit an
// alias of parseCage) is parseCage; AutoLure is imported from auto-lure.js, the port of
// src/monster/auto-lure.ts; the kit's diagnostic console.log lines
// are folded into the one summary line at the end. No assertion is dropped: verify-monster already ran
// on the nih-dairia model, so none of its assertions is baby-only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCage } from '../src/fx/nih-dairia/cage-model.js';
import { SoftBody } from '../src/fx/nih-dairia/soft-body.js';
import { MonsterBehavior } from '../src/fx/nih-dairia/behavior.js';
import { PHYS } from '../src/fx/nih-dairia/constants.js';
import { SpiderGait } from '../src/fx/nih-dairia/gait.js';
import { Vector3 } from '../vendor/three.module.js';
import { DEFAULT_MOTION, MOTION_CONTROLS, normalizeMotion } from '../src/fx/nih-dairia/motion-settings.js';
import { TentaclePursuit } from '../src/fx/nih-dairia/pursuit.js';
import { ARENA } from '../src/fx/nih-dairia/arena.js';
import { AutoLure } from '../src/fx/nih-dairia/auto-lure.js';

const load=name=>{
  const bytes=readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.bin`,import.meta.url));
  return parseCage(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),JSON.parse(readFileSync(new URL(`../assets/creatures/nih-dairia/${name}.json`,import.meta.url),'utf8')));
};

// ---- verify-monster.mjs ----
// Keep the original choreography as a regression fixture; exercise the user's
// new default and expanded ranges separately below.
const baseline={speed:1,reachTime:1,pullTime:1,pauseTime:1,erratic:1,stretch:1,spread:1,stepHeight:.021,stepDuration:.19,stepSpacing:.07,stride:.022,recoil:1,grip:0,sweep:0};
assert.deepEqual(DEFAULT_MOTION,{speed:1.8,reachTime:2.4,pullTime:2,pauseTime:1.25,erratic:2,stretch:2.2,spread:1.6,stepHeight:.032,stepDuration:.12,stepSpacing:.035,stride:.022,recoil:1,grip:1.5,sweep:1});

assert.deepEqual(normalizeMotion(null),DEFAULT_MOTION);
const sanitized=normalizeMotion({speed:100,stretch:NaN,stepHeight:-2,pullTime:'bad'});
assert.equal(sanitized.speed,6);assert.equal(sanitized.stretch,DEFAULT_MOTION.stretch);
assert.equal(sanitized.stepHeight,.004);assert.equal(sanitized.pullTime,DEFAULT_MOTION.pullTime);
const tuning={...DEFAULT_MOTION,speed:1,erratic:0},pursuit=new TentaclePursuit(tuning);
let normalPeak=0,fasterPeak=0;
for(let i=0;i<240;i++){pursuit.step(PHYS.step,new Vector3(1,0,0),true);normalPeak=Math.max(normalPeak,pursuit.speed);assert.equal(Math.abs(pursuit.side),0,'zero erratic motion disables sideways feints');}
tuning.speed=1.5;pursuit.reset();
for(let i=0;i<240;i++){pursuit.step(PHYS.step,new Vector3(1,0,0),true);fasterPeak=Math.max(fasterPeak,pursuit.speed);}
assert(Math.abs(fasterPeak/normalPeak-1.5)<1e-12,'live speed changes reach the pursuit controller');
const searching=new TentaclePursuit();
for(let i=0;i<100;i++)searching.step(PHYS.step,new Vector3(1,0,0),true);
assert.equal(searching.phase,'reach','the new default keeps the arms reaching for over 400 ms');
assert(searching.lead!==searching.secondLead&&searching.reach>.8&&searching.secondReach>.7,'two different arms reach together');
assert(searching.firstDirection.z*searching.secondDirection.z<0&&searching.firstDirection.dot(searching.secondDirection)<.9,'the arms feel in different directions on opposite sides of the prey');

const gait=new SpiderGait({...baseline}),gaitCenter=new Vector3(),direction=new Vector3(1,0,0);
const lifted=new Set();
const liftStarts=[];
for(let step=0;step<480;step++){
  const previous=gait.feet.map(foot=>foot.clone()),planted=gait.planted.slice();
  gaitCenter.x+=.029*PHYS.step;gait.step(PHYS.step,gaitCenter,direction,true);
  assert(gait.planted.filter(Boolean).length>=4,'no more than two supporting legs swing together');
  let started=0;
  gait.feet.forEach((foot,i)=>{
    if(planted[i]&&!gait.planted[i]){started++;liftStarts.push(step);}
    if(planted[i]&&gait.planted[i])assert(foot.distanceTo(previous[i])<1e-12,'planted feet stay fixed in world space');
    if(Math.hypot(foot.x-previous[i].x,foot.z-previous[i].z)>1e-9)assert(foot.y>.019,'a foot lifts clear before sweeping forward');
    if(foot.y>.005)lifted.add(i);
  });
  assert(started<=1,'legs start individually rather than as synchronized groups');
}
assert.equal(lifted.size,6,'all six feet take lifted steps');
assert(liftStarts.every((at,i)=>i===0||at-liftStarts[i-1]>=16),'successive footfalls are visibly staggered');
const followGait=new SpiderGait({...baseline}),finished=new Set();
for(let i=0;i<240;i++){
  const wasPlanted=followGait.planted.slice();
  followGait.step(PHYS.step,new Vector3(),direction,i===0,0);
  followGait.planted.forEach((planted,leg)=>{if(planted&&!wasPlanted[leg])finished.add(leg);});
}
assert.deepEqual([...finished].sort(),[1,2,3,4,5],'all supporting legs finish after even a short pull trigger');
const dualGait=new SpiderGait();
for(let i=0;i<360;i++){
  dualGait.step(PHYS.step,new Vector3(),direction,true,0,1);
  assert(dualGait.planted[0]&&dualGait.planted[1],'both probing arms are excluded from the walking sequence');
  assert(dualGait.planted.filter(p=>!p).length<=1,'four support legs leave three grounded while two arms explore');
}

const cage=load('nih-dairia');
const edges=new Map();
for(let i=0;i<cage.surface.indices.length;i+=3)for(let k=0;k<3;k++){
  const a=cage.surface.indices[i+k],b=cage.surface.indices[i+(k+1)%3],key=`${Math.min(a,b)},${Math.max(a,b)}`;
  edges.set(key,(edges.get(key)||0)+1);
}
assert([...edges.values()].every(n=>n===2),'monster surface is closed and manifold');
const body=new SoftBody(cage),rig=new MonsterBehavior(body,{...baseline}),states=new Set();
// Isolate locomotion regressions from the separately tested feeding lifecycle.
rig.feeding.enabled=false;
const restSurface=body.surface.positions.slice();
const step=n=>{for(let i=0;i<n;i++){rig.step(PHYS.step);body.step(PHYS.step);states.add(rig.state);assert(body.isFinite());assert(body.lastMinJacobian>=.12,'elements do not invert');}body.updateSurface();};
rig.active=false;
step(480);
let coreClearance=Infinity,coreContacts=0,legContacts=0;
for(let i=0;i<restSurface.length;i+=3)if(Math.hypot(restSurface[i],restSurface[i+2])<.018)coreClearance=Math.min(coreClearance,body.surface.positions[i+1]);
for(let i=0;i<body.mass.length;i++)if(body.contact[i]){if(Math.hypot(body.rest[i*3],body.rest[i*3+2])<.03)coreContacts++;else legContacts++;}
assert(coreClearance>.018,'the abdomen stays visibly elevated above the table');
assert(coreContacts===0&&legContacts>0,'legs, not the torso, contact the ground');
rig.active=true;rig.time=.6;step(24);
const origin=rig.center.clone();rig.stimulus=1;step(1440);
assert(rig.center.x>origin.x+.01,'creature advances toward the lure');
assert(states.has('probing')&&states.has('stalking'),'idle exploration transitions into a stalk');
rig.target.set(rig.center.x+.025,.012,rig.center.z);step(360);
assert.equal(rig.state,'enveloping');
assert(body.volumeRatio()>.75&&body.volumeRatio()<1.25,'coiling retains tissue volume');
rig.disturb();step(30);assert.equal(rig.state,'recoiling');step(180);assert.notEqual(rig.state,'recoiling');
rig.active=false;step(240);assert.equal(rig.state,'listening');
// The same stimulus works behind the animal; it has no privileged forward axis.
rig.reset();rig.active=true;rig.target.set(-.12,.012,-.03);rig.stimulus=1;step(960);assert(rig.center.x<-.01,'creature pursues targets on the opposite side');
// Measure the actual deformed skin: extension and fanning must precede the pull.
rig.reset();rig.active=false;step(480);
const leadingSkin=[];
for(let j=0;j<restSurface.length;j+=3)if(restSurface[j]>.062&&restSurface[j]<.081&&Math.abs(Math.atan2(restSurface[j+2],restSurface[j]))<.4)leadingSkin.push(j);
const leadingWidth=()=>Math.max(...leadingSkin.map(j=>body.surface.positions[j+2]))-Math.min(...leadingSkin.map(j=>body.surface.positions[j+2]));
const leadingExtent=()=>Math.max(...leadingSkin.map(j=>body.surface.positions[j]))-rig.center.x;
const beforeWidth=leadingWidth(),beforeExtent=leadingExtent(),beforeCenter=rig.center.clone();
rig.active=true;rig.target.set(.24,.012,0);rig.stimulus=1;step(44);
const extension=leadingExtent()-beforeExtent,spread=leadingWidth()/beforeWidth,bodyAdvance=rig.center.x-beforeCenter.x;
assert.equal(rig.pursuit.phase,'reach');
assert(extension>.012,'leading tissue extends noticeably before the body follows');
assert(Number.isFinite(spread)&&spread>.5,'sensor tissue retains a finite width; spread now controls the pair sweep');
assert(bodyAdvance<extension*.6,'the leading tentacle moves ahead of the torso');
step(72);assert(rig.center.x-beforeCenter.x>.018,'the body surges after the leading reach');
const distalSkin=Array.from({length:6},()=>[]),footClearance=new Float64Array(6);
for(let j=0;j<restSurface.length;j+=3){
  const x=restSurface[j],z=restSurface[j+2];
  if(Math.hypot(x,z)>.081)distalSkin[(Math.round(Math.atan2(z,x)/(Math.PI/3))+6)%6].push(j+1);
}
for(let tick=0;tick<96;tick++){
  step(4);
  distalSkin.forEach((ids,leg)=>{if(!rig.gait.planted[leg])footClearance[leg]=Math.max(footClearance[leg],Math.min(...ids.map(j=>body.surface.positions[j])));});
}
assert(Array.from(footClearance).filter(height=>height>.004).length>=4,'the four supporting feet visibly clear the floor while two arms probe');
// Abrupt retargeting must select a new lead without losing volume or orientation.
rig.target.set(-.12,.012,-.04);step(240);
assert(rig.pursuit.lead===3,'opposite stimulus switches the leading limb');
assert(body.volumeRatio()>.8&&body.volumeRatio()<1.2,'erratic pursuit preserves tissue volume');
rig.reset();assert.deepEqual(Array.from(body.x),Array.from(body.rest),'reset restores all simulated nodes');
rig.step(PHYS.step);
let verticalMomentum=0;
for(let i=0;i<body.mass.length;i++)verticalMomentum+=body.mass[i]*body.velocity[i*3+1];
assert(Math.abs(verticalMomentum)<1e-12,'muscles create no net vertical lift without ground reaction');
for(const mode of ['minimum','maximum','fast-footwork']){
  Object.assign(rig.settings,normalizeMotion(Object.fromEntries(MOTION_CONTROLS.map(control=>[control.key,mode==='minimum'?control.min:mode==='fast-footwork'&&['stepDuration','stepSpacing','reachTime','pullTime','pauseTime'].includes(control.key)?control.min:control.max]))));
  rig.reset();rig.active=true;rig.stimulus=1;
  for(let i=0;i<3;i++){
    if(i===1)rig.target.set(-.12,.012,.03);
    if(i===2)rig.disturb();
    step(240);
    assert(body.volumeRatio()>.75&&body.volumeRatio()<1.25,`${mode} controls keep tissue volume bounded`);
  }
}
rig.settings.speed=1.4;rig.reset();assert.equal(rig.settings.speed,1.4,'resetting the specimen retains motion tuning');
Object.assign(rig.settings,DEFAULT_MOTION);
rig.reset();rig.active=false;step(480);
const armPoint=leg=>{
  const ids=distalSkin[leg],point=new Vector3();
  for(const j of ids){point.x+=body.surface.positions[j-1]/ids.length;point.z+=body.surface.positions[j+1]/ids.length;}
  return point;
};
const startArms=distalSkin.map((_,leg)=>armPoint(leg)),startCenter=rig.center.clone();
rig.target.set(.2,.012,0);rig.active=true;rig.stimulus=1;step(105);
const armExtensions=[],armDirections=[];
for(const leg of [rig.pursuit.lead,rig.pursuit.secondLead]){
  const point=armPoint(leg),initial=startArms[leg];
  armExtensions.push(Math.hypot(point.x-rig.center.x,point.z-rig.center.z)-Math.hypot(initial.x-startCenter.x,initial.z-startCenter.z));
  armDirections.push(new Vector3(point.x-rig.center.x,0,point.z-rig.center.z).normalize());
}
assert.equal(rig.pursuit.phase,'reach');
assert(armExtensions.every(extension=>extension>.020),'both actual arms extend by more than two centimeters before the pull');
assert(armDirections[0].dot(armDirections[1])<.9,'the physical arms probe distinct directions');
rig.reset();rig.active=true;
const auto=new AutoLure();auto.enabled=true;
let furthest=0;
for(let i=0;i<3600;i++){
  const previous=rig.target.clone();auto.step(PHYS.step,rig.target,rig.center);
  assert(rig.target.distanceTo(previous)<=.105*PHYS.step+1e-9,'autonomous lure moves without teleporting');
  assert(Math.hypot(rig.target.x,rig.target.z)<=ARENA.lureRadius,'auto lure remains inside the arena');
  rig.stimulus=1;step(1);furthest=Math.max(furthest,Math.hypot(rig.center.x,rig.center.z));
}
assert(furthest>.15,'new default pursues the moving lure beyond the old test area');
auto.enabled=false;const stoppedTarget=rig.target.clone();auto.step(1,rig.target,rig.center);assert.deepEqual(rig.target,stoppedTarget,'disabling automatic motion preserves manual target');
rig.reset();rig.target.set(.38,.012,0);rig.stimulus=1;step(24);assert.equal(rig.state,'stalking','a far target in the expanded arena is detectable');

// A physical shove should settle sooner with adhesion, without pinning lifted feet.
const drift=[];
for(const grip of [0,1.5]){
  Object.assign(rig.settings,DEFAULT_MOTION,{grip});rig.reset();rig.active=false;step(480);
  const start=rig.center.clone();
  for(let i=0;i<body.mass.length;i++)body.velocity[i*3]=.08;
  let peak=0;
  for(let i=0;i<120;i++){step(1);peak=Math.max(peak,Math.abs(rig.center.x-start.x));}
  drift.push(peak);
}
assert(drift[1]<drift[0]*.8,'grip materially reduces residual body drift');
rig.traction.prepare(body,rig.gait,rig.pursuit,true);
assert(rig.traction.weights.some(w=>w>0),'actual ground contacts acquire adhesion');
rig.gait.planted.fill(false);rig.traction.prepare(body,rig.gait,rig.pursuit,true);
assert(rig.traction.weights.every(w=>w===0),'lifting releases all adhesion');
rig.gait.planted.fill(true);body.contact.fill(0);rig.traction.prepare(body,rig.gait,rig.pursuit,true);
assert(rig.traction.weights.every(w=>w===0),'airborne legs cannot grip the floor');

// Compare actual distal-node slip during a chase, not just controller targets.
const slip=[];
for(const grip of [0,1.5]){
  Object.assign(rig.settings,DEFAULT_MOTION,{grip});rig.reset();rig.active=false;step(240);
  rig.active=true;rig.target.set(.3,.012,0);rig.stimulus=1;
  let travel=0,samples=0;
  for(let tick=0;tick<720;tick++){
    const ids=[];
    for(let i=0;i<body.mass.length;i++){
      const x=body.rest[i*3],z=body.rest[i*3+2],leg=(Math.round(Math.atan2(z,x)/(Math.PI/3))+6)%6;
      const probe=leg===rig.pursuit.lead?rig.pursuit.reach:leg===rig.pursuit.secondLead?rig.pursuit.secondReach:0;
      if(Math.hypot(x,z)>.078&&body.contact[i]>0&&rig.gait.planted[leg]&&probe<.2)ids.push([i,body.x[i*3],body.x[i*3+2]]);
    }
    step(1);
    for(const [i,x,z] of ids){travel+=Math.hypot(body.x[i*3]-x,body.x[i*3+2]-z);samples++;}
  }
  assert(samples>100,'the chase includes measurable planted contact');slip.push(travel/samples/PHYS.step);
}
assert(slip[1]<slip[0]*.9,'grip reduces actual supporting-foot slip during pursuit');

// Controlled penetrating configurations test the proxy response independently
// of muscle forces, without asking the elastic solver to accept a torn cage.
for(const againstCore of [false,true]){
  rig.reset();body.velocity.fill(0);
  const proxies=rig.separation.proxies;
  const a=proxies.find(p=>againstCore?p.limb===-1:p.limb===0&&p.band===4);
  const b=proxies.find(p=>p.limb===1&&p.band===4);
  const centroid=p=>{const c=new Vector3();for(const i of p.ids)c.addScaledVector(new Vector3().fromArray(body.x,i*3),body.mass[i]/p.mass);return c;};
  const shift=centroid(a).add(new Vector3(.004,0,0)).sub(centroid(b));
  for(const id of b.ids){body.x[id*3]+=shift.x;body.x[id*3+1]+=shift.y;body.x[id*3+2]+=shift.z;}
  rig.separation.apply(body,PHYS.step);
  assert(rig.separation.contacts>0,'penetrating limbs and torso trigger contact');
  const momentum=new Vector3();
  for(let i=0;i<body.mass.length;i++)momentum.addScaledVector(new Vector3().fromArray(body.velocity,i*3),body.mass[i]);
  assert(momentum.length()<1e-12,'self-contact adds no net momentum or levitation');
  const vx=p=>p.ids.reduce((sum,i)=>sum+body.velocity[i*3]*body.mass[i]/p.mass,0);
  assert(vx(b)>vx(a),'contact separates the intruding limb from the other tissue');
}
rig.reset();

// ---- verify-probes.mjs (its own body and rig) ----
let probes;
{
const body=new SoftBody(load('nih-dairia'));
const rig=new MonsterBehavior(body),rest=body.surface.positions.slice(),tips=Array.from({length:6},()=>[]);
rig.feeding.enabled=false;
for(let j=0;j<rest.length;j+=3)if(Math.hypot(rest[j],rest[j+2])>.081)tips[(Math.round(Math.atan2(rest[j+2],rest[j])/(Math.PI/3))+6)%6].push(j);
function tick(){rig.step(PHYS.step);body.step(PHYS.step);assert(body.isFinite());assert(body.lastMinJacobian>=.12);}
function measure(settings,distance=.3){
  Object.assign(rig.settings,DEFAULT_MOTION,settings);rig.reset();rig.active=false;
  for(let i=0;i<360;i++)tick();
  const start=rig.center.clone();
  rig.target.set(start.x+distance,.012,start.z);rig.active=true;rig.stimulus=1;
  for(let i=0;i<105;i++)tick();body.updateSurface();
  assert.equal(rig.pursuit.phase,'reach');
  const points=[rig.pursuit.lead,rig.pursuit.secondLead].map(leg=>{
    const ids=tips[leg];let x=0,z=0;
    for(const j of ids){x+=body.surface.positions[j]/ids.length;z+=body.surface.positions[j+2]/ids.length;}
    return {x:x-rig.center.x,z:z-rig.center.z};
  });
  return {lengths:points.map(p=>Math.hypot(p.x,p.z)),width:Math.abs(points[0].z-points[1].z),advance:rig.center.x-start.x};
}
const short=measure({stretch:0}),long=measure({stretch:5}),narrow=measure({stretch:4,spread:0}),wide=measure({stretch:4,spread:6}),near=measure({stretch:5},.07);
for(let arm=0;arm<2;arm++){
 assert(long.lengths[arm]>short.lengths[arm]+.04,'stretch increases each physical sensor reach by at least 4 cm');
 assert(long.lengths[arm]>near.lengths[arm]+.04,'each sensor retracts substantially near prey');
}
assert(wide.width>narrow.width+.04,'spread widens the two actual sensor tips by at least 4 cm');
assert(long.advance<.03,'the searching arms extend before the whole body follows');

// A long reach must include visible lateral travel while both arms are extended.
function sweepTravel(sweep){
 Object.assign(rig.settings,DEFAULT_MOTION,{reachTime:10,stretch:3,sweep});rig.reset();rig.active=false;
 for(let i=0;i<240;i++)tick();
 rig.target.set(.35,.012,0);rig.active=true;rig.stimulus=1;
 const low=[Infinity,Infinity],high=[-Infinity,-Infinity];let staggered=0;
 for(let i=0;i<440;i++){
  tick();
  if(i<290||i%4)continue;
  assert.equal(rig.pursuit.phase,'reach','10x duration keeps the body in search mode');
  body.updateSurface();
  for(const [arm,leg] of [rig.pursuit.lead,rig.pursuit.secondLead].entries()){
   const ids=tips[leg];let x=0,z=0;
   for(const j of ids){x+=body.surface.positions[j]/ids.length;z+=body.surface.positions[j+2]/ids.length;}
   const angle=Math.atan2(z-rig.center.z,x-rig.center.x);low[arm]=Math.min(low[arm],angle);high[arm]=Math.max(high[arm],angle);
  }
  const a=rig.pursuit.firstDirection,b=rig.pursuit.secondDirection;
  if(Math.abs(a.z+b.z)>.05)staggered++;
 }
 return {ranges:high.map((v,i)=>v-low[i]),staggered};
}
const steady=sweepTravel(0),sweeping=sweepTravel(3);
for(let i=0;i<2;i++)assert(sweeping.ranges[i]>steady.ranges[i]+.15,'each actual arm sweeps through a visibly larger arc');
assert(sweeping.staggered>10,'arms are not locked into mirrored arcs');

// A target that turns during a long reach used to reset the phase indefinitely.
// Exercise live slider changes and maximum duration against repeated direction changes.
const pursuit=rig.pursuit;pursuit.reset();
const direction=rig.target.clone();let pulls=0;
Object.assign(rig.settings,DEFAULT_MOTION,{reachTime:10,sweep:5});
for(let i=0;i<240*20;i++){
 const angle=i/240*3;direction.set(Math.cos(angle),0,Math.sin(angle));
 if(i===240*5)Object.assign(rig.settings,{stretch:5,spread:6,grip:5,pauseTime:12});
 pursuit.step(PHYS.step,direction,true,.3);
 if(pursuit.speed>0)pulls++;
}
assert(pulls>100,'turning prey and live tuning must not starve the pull phase');
probes={long:long.lengths.map(v=>+v.toFixed(3)),sweep:sweeping.ranges.map(v=>+v.toFixed(2))};
}

const f=v=>+v.toFixed(4);
console.log(`Nih-Dairia motion: settings, pursuit, gait, stance (core ${f(coreClearance)} m up), stalk, envelop, recoil, two-arm reach (${armExtensions.map(f).join(', ')} m), auto lure (furthest ${f(furthest)} m), grip (drift ${drift.map(f).join(' / ')}; slip ${slip.map(f).join(' / ')}), limb separation, probes (stretch ${probes.long.join(', ')} m; sweep ${probes.sweep.join(', ')} rad; turning prey keeps pulling) as the kit verifies them.`);
