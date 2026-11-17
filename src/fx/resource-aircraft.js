// One SAI-93: flight, typed cargo and a printable model. Deposits and dispatch
// stay with mineral-mining; all aircraft draw atomically from those same stocks.
import * as THREE from '../../vendor/three.module.js';
import { MINERALS as M, BIOMASS_HAUL } from '../content/minerals.js';
import { createResourceHaul } from '../domain/resource-haul.js';
import { surfaceArc } from '../domain/mineral-deposits.js';
import { loadModelFixture, cloneFixture, setWireframe } from './model-fixture.js';
import { printGhost } from './tower-print.js';
import { createResourceThrusters } from './resource-thrusters.js';
import { applySai93 } from '../../assets/models/sai93/runtime.js';
export function createResourceAircraft(h) {
 const m=h.metres,holder=new THREE.Group();holder.name=`SAI-93 resource hauler ${h.id}`;holder.scale.setScalar(m);h.scene.add(holder);
 const pos=new THREE.Vector3().fromArray(h.pad).normalize(),forward=new THREE.Vector3().fromArray(h.heading),stands=new Map();
 const haul=createResourceHaul(h.home,{biomass:BIOMASS_HAUL,mineral:M},h.resources),run=haul.run;
 let thrusters=null,model=null,dead=false,error=null,height=0,clock=0,flightPath=null,flightTop=0,flightPhase='parked',printK=h.printing?0:1,originals=[],print=null;
 loadModelFixture(M.model).then(src=>{
   if(dead)return;model=cloneFixture(src);if(h.wire)setWireframe(model,true,h.wire);holder.add(model);
   if(printK<1){model.traverse(o=>{if(o.isMesh)originals.push([o,o.material]);});print=printGhost(model,0xbfe6ff);print.set(printK);}
   thrusters=createResourceThrusters({model,holder,scene:h.scene,metres:m});
 }).catch(e=>{error=String(e);});
 const pointOf=ci=>ci===h.home?h.pad:stands.get(ci)??h.centers[ci];
 const arcPoint=(a,b,u)=>{const p=new THREE.Vector3().fromArray(a).normalize(),q=new THREE.Vector3().fromArray(b).normalize(),angle=p.angleTo(q);return angle<1e-8?p:p.multiplyScalar(Math.sin((1-u)*angle)).addScaledVector(q,Math.sin(u*angle)).divideScalar(Math.sin(angle)).normalize();};
 const chooseStand=cell=>{
   if(stands.has(cell))return;const center=new THREE.Vector3().fromArray(h.centers[cell]).normalize(),toward=new THREE.Vector3().fromArray(h.pad).projectOnPlane(center).normalize(),radius=(haul.kind()==='mineral'?M.radiusM:2)+M.bodyRadiusM;
   for(let i=0;i<32;i++){const p=center.clone().addScaledVector(toward.clone().applyAxisAngle(center,i*Math.PI/8),(radius+Math.floor(i/16)*3)*m).normalize().toArray();if(h.landingClear(p,M.bodyRadiusM*m,false)){stands.set(cell,p);return;}}
   stands.set(cell,h.centers[cell]);
 };
 const transport={path:(a,b)=>{if(b!==h.home)chooseStand(b);return a===b?[a]:[a,b];},length:p=>p.length<2?0:surfaceArc(pointOf(p[0]),pointOf(p.at(-1)))/m,bearing:()=>0};
 function pose(){
   const up=pos.clone(),f=forward.clone().projectOnPlane(up);if(f.lengthSq()<1e-10)f.set(1,0,0).projectOnPlane(up);f.normalize();
   const right=new THREE.Vector3().crossVectors(up,f).normalize();f.crossVectors(right,up).normalize();
   holder.position.copy(pos).multiplyScalar(1+height*m+(!run.path&&run.cell===h.home?Math.max(0,Math.hypot(...h.pad)-1):0));holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,f));holder.visible=!!model;
 }
 pose();
 return {
   dispatch:(kind,order)=>haul.dispatch(kind,order), loaded:()=>!!model, available:()=>!!model&&printK>=1,
   print(k){printK=Math.max(printK,Math.min(1,k));if(printK>=1&&print){for(const [o,material]of originals)o.material=material;for(const mat of print.mats)mat.dispose();delete model.userData.print;originals=[];print=null;}},
   settle(now,flares,room){const out=haul.settle(now,flares,room);pos.fromArray(h.pad).normalize();height=0;pose();return out;},
   tick(dt,now){
     clock=now;if(printK<1){pose();print?.set(printK);thrusters?.tick(dt,now,0,false);return;}
     const airborne=run.path&&run.path.length>1,next=airborne?pointOf(run.path.at(-1)):pos.toArray();
     if(airborne&&flightPath!==run.path){flightPath=run.path;flightTop=h.ceiling(pos.toArray(),next,M.bodyRadiusM*m)/m+M.bodyRadiusM;}
     const ahead=arcPoint(pos.toArray(),next,Math.min(1,16*m/Math.max(m,surfaceArc(pos.toArray(),next)))).toArray();
     const localHop=haul.kind()==='biomass'&&run.mode==='harvest';
     const cruise=Math.max(localHop?M.hopM:M.flightM,airborne?flightTop:0,h.ceiling(pos.toArray(),ahead,M.bodyRadiusM*m)/m+M.bodyRadiusM);
     let targetHeight=airborne?cruise:0;if(!airborne&&!h.landingClear(pos.toArray(),M.bodyRadiusM*m,run.cell===h.home))targetHeight=Math.max(M.bodyRadiusM,height);
     const ready=airborne?height>=cruise-.05:height<.15;height+=Math.max(-M.climbMps*dt,Math.min(M.climbMps*dt,targetHeight-height));
     if(model&&ready)haul.step(dt,now,{...transport,grounded:height<.15});
     if(run.path&&run.path.length>1){const a=pointOf(run.path[0]),b=pointOf(run.path.at(-1));pos.copy(arcPoint(a,b,run.length>0?Math.min(1,run.s/run.length):1));forward.fromArray(b).sub(new THREE.Vector3().fromArray(a));}
     else{pos.fromArray(pointOf(run.cell)).normalize();if(run.cell===h.home)forward.fromArray(h.heading);}
     pose();if(model){holder.remove(model);model.updateMatrixWorld(true);applySai93(THREE,model,{fold:Math.min(1,height/4),anchor:run.mode==='harvest'?1:0,deploy:run.mode==='harvest'?1:0,fill:run.cargo/run.tune.capacity,offload:run.mode==='unload'?1:0,time:now,drillAngle:now*8,grounded:height<.15});holder.add(model);}
     const fraction=run.length>0?run.s/run.length:0;
     flightPhase=height<.03?'parked':!airborne?'landing':height<cruise-.05?'climb':fraction<M.boostFraction?'boost':fraction>1-M.brakeFraction?'brake':'coast';
     thrusters?.tick(dt,now,height,flightPhase!=='coast');
   },
   contact:()=>model?{id:h.id,pos:holder.position.toArray(),dir:forward.toArray(),halfLength:M.bodyRadiusM,halfWidth:M.bodyRadiusM,height:4}:null,
   state:()=>({id:h.id,printing:printK<1,printK,resource:haul.kind(),deliveredBy:{...haul.delivered},capacity:run.tune.capacity,cell:run.cell,home:h.home,harvested:run.harvested,events:run.events.slice(-24),thrusters:thrusters?.state()??null,scene:{ready:!!model,point:holder.position.toArray(),url:M.model},ready:!!model&&printK>=1,error,mode:printK<1?'printing':run.mode,cargo:run.cargo,delivered:run.delivered,trips:run.trips,order:run.order?.id??null,queued:run.queued?.id??null,height,flightPhase,localHop:haul.kind()==='biomass'&&run.mode==='harvest',pos:pos.toArray(),clock}),
   dispose(){dead=true;thrusters?.dispose();for(const mat of print?.mats??[])mat.dispose();holder.removeFromParent();},
 };
}
