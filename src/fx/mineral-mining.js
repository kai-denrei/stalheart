// SAI-93 uses the existing transport FSM for orders, capacity, queuing and
// deposits into the economy. Its route is a flight over a sphere arc. Only
// this presentation owns the hopper's height, authored rig and deposit marks.
import * as THREE from '../../vendor/three.module.js';
import { MINERALS as M } from '../content/minerals.js';
import { pickDeposits, takeMineral, surfaceArc } from '../domain/mineral-deposits.js';
import { selectHauler } from '../domain/resource-haul.js';
import { createResourceAircraft } from './resource-aircraft.js';
import { bfsDist, BLOCKED } from '../dungeon.js';
import { createAmethyst } from './crystals.js';
import { makeSiteRing, disposeSiteRing } from './site-ring.js';
import { createHullFlares } from './hull-flare.js';

export function createMineralMining(h) {
  const graph = h.graph(), m = h.metres(), scene = h.scene, home = h.home, centers = graph.centers;
  const hops = bfsDist(graph.adj, [home], (ci) => h.dungeon().tags[ci] !== BLOCKED);
  const reachable = bfsDist(graph.adj, [home], (ci) => hops[ci] >= 0 && hops[ci] <= M.maxHops && (h.inside(ci) || h.open(ci)));
  const candidates = [];
  for (let ci = 0; ci < centers.length; ci++) if (reachable[ci] >= 0 && hops[ci] >= M.minHops && hops[ci] <= M.maxHops && !h.inside(ci) && h.open(ci) && !h.solid(centers[ci], M.radiusM * m)) candidates.push(ci);
  const flares = createHullFlares(scene, { metres: m, cellSide: m, tune: M.flare, reach: M.radiusM });
  const deposits = pickDeposits(candidates, centers, h.seed, M, m);
  const visuals = deposits.map((d) => {
    const root = new THREE.Group(); root.position.fromArray(centers[d.cell]).normalize(); root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), root.position); root.scale.setScalar(m); scene.add(root);
    const crystal = createAmethyst(d.cell, M.crystal.heightM * 1.5); root.add(crystal.group);
    const ring = makeSiteRing(scene, root.position.toArray(), root.position.toArray(), M.radiusM * m / 0.42, 0.2 * m, 0xb9a4ff);
    return { root, crystal, ring };
  });
  const mineral={live:o=>deposits.some(d=>d.id===o?.id&&d.kg>0),near:cell=>deposits.filter(d=>d.cell===cell&&d.kg>0),take:(cell,n)=>takeMineral(deposits,cell,n),deposit:n=>h.deposit(n)};
  const units=[];let clock=0,intro=false;
  const add=(pad,ci,printing=false)=>{
    const id=units.length?'sai93:2':'sai93';
    const unit=createResourceAircraft({scene,metres:m,id,home:ci,pad,heading:h.heading,centers,resources:{biomass:h.biomass,mineral},wire:h.wire,printing,
      ceiling:(a,b,r)=>h.ceiling(a,b,r,id),landingClear:(p,r,atHome)=>h.landingClear(p,r,atHome,id)});
    units.push(unit);return unit;
  };
  add(h.pad,home);
  const dispatch=(kind,order)=>{const i=selectHauler(units.map(u=>u.state()));return i<0?false:units[i].dispatch(kind,order);};
  const secondPad=()=>{
    const up=new THREE.Vector3().fromArray(h.pad).normalize(),forward=new THREE.Vector3().fromArray(h.heading).projectOnPlane(up).normalize();
    for(let i=0;i<48;i++){const p=up.clone().addScaledVector(forward.clone().applyAxisAngle(up,i*Math.PI/8),(16+Math.floor(i/16)*8)*m).normalize().toArray(),ci=h.cellOf(p);
      if(ci!==home&&h.inside(ci)&&h.landingClear(p,M.bodyRadiusM*m,false,'sai93:2'))return {pad:p,ci};}
    return null;
  };
  let hud = null;
  if (typeof document !== 'undefined') { hud = document.createElement('div'); hud.className = 'mineral-hud'; hud.style.cssText = 'position:fixed;left:50%;bottom:112px;transform:translateX(-50%);padding:6px 12px;background:#080c0ed9;border:1px solid #bcc4cc;color:#eef1f4;font:12px ui-monospace,monospace;pointer-events:none;z-index:25'; document.body.append(hud); }
  const near = (point) => deposits.filter((d) => d.kg > 0).map((d) => ({ d, distance: surfaceArc(point, centers[d.cell]) / m })).filter((x) => x.distance <= M.markM).sort((a,b) => a.distance-b.distance)[0]?.d ?? null;
  function order(d) { if(!d||d.kg<=0)return false;const result=dispatch('mineral',{id:d.id,cell:d.cell});if(!result)return false;flares.drop(centers[d.cell],d.cell,clock);h.toast(result==='now'?M.words.dispatched:M.words.queued);return true; }
  return {
    dispatchNear(point){return order(near(point));},dispatchBiomass:order=>dispatch('biomass',order),
    canPrintSecond:()=>units.length===1&&units[0].available()&&!!secondPad(),
    printSecond(){
      if(units.length!==1||!units[0].available())return null;const site=secondPad();if(!site)return null;
      const unit=add(site.pad,site.ci,true),up=new THREE.Vector3().fromArray(site.pad).normalize(),f=new THREE.Vector3().fromArray(h.heading).projectOnPlane(up).normalize(),right=new THREE.Vector3().crossVectors(up,f);
      return {kind:'fabrication',ci:site.ci,seconds:M.second.seconds,cost:M.second.price,label:M.second.label,ready:unit.loaded,progress:k=>unit.print(k),done:()=>{unit.print(1);h.toast('SECOND SAI-93 · READY FOR DISPATCH');},
        bed:(x,z,k)=>up.clone().multiplyScalar(1+4*k*m).addScaledVector(right,x*7*m).addScaledVector(f,z*9*m).toArray()};
    },
    settle(now,markers,room){const out={cargo:0,field:0,kept:0};units.forEach((u,i)=>{const r=u.settle(now,i?[]:markers,room);out.cargo+=r.cargo;out.field+=r.field;out.kept+=r.kept;});return out;},
    tick(dt,now){
      clock=now;flares.tick(now);for(const u of units)u.tick(dt,now);
      if(!intro&&units[0].available()&&!h.busy()){intro=true;h.brief(M.words.intro);}
      deposits.forEach((d,i)=>{const v=visuals[i];v.root.visible=d.kg>0;v.root.scale.setScalar(m*(0.4+0.6*d.kg/d.initial));v.ring.visible=d.kg>0;});
      const d=h.player()?near(h.player()):null,states=units.map(u=>u.state());
      if(hud){hud.hidden=h.busy()||(!d&&states.every(s=>s.mode==='idle'));hud.textContent=d?`${M.words.name} · ${Math.ceil(d.kg)} KG · ${M.words.hint}`:states.map((s,i)=>`SAI-93 ${i+1} · ${s.mode==='full'?M.words.full:s.mode.toUpperCase()} · ${Math.round(s.cargo)}/${s.capacity} KG`).join('   /   ');}
    },
    contact:()=>units[0].contact(),contacts:()=>units.map(u=>u.contact()).filter(Boolean),
    state:()=>{const fleet=units.map(u=>u.state());return {...fleet[0],fleet,count:fleet.length,delivered:fleet.reduce((n,s)=>n+s.delivered,0),trips:fleet.reduce((n,s)=>n+s.trips,0),harvested:fleet.reduce((n,s)=>n+s.harvested,0),deliveredBy:{biomass:fleet.reduce((n,s)=>n+s.deliveredBy.biomass,0),mineral:fleet.reduce((n,s)=>n+s.deliveredBy.mineral,0)},flares:flares.live(),flareColour:M.flare.colour,deposits:deposits.map(d=>({...d})),clock};},
    test:{dispatch:id=>order(deposits.find(d=>d.id===id))},
    dispose(){flares.dispose();hud?.remove();units.forEach(u=>u.dispose());visuals.forEach(v=>{v.crystal.dispose();v.root.removeFromParent();disposeSiteRing(scene,v.ring);});},
  };
}
