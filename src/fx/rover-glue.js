// Field, pearls and the printable SAI-93 fleet. The public rover hook is
// retained for story/economy callers; no Yushi vehicle is created in gameplay.
import * as THREE from '../../vendor/three.module.js';
import { createField } from '../domain/biomass-field.js';
import { createPearls } from '../domain/bio-pearls.js';
import { hasPerk } from '../domain/build-programme.js';
import { ROVER, FIELD, PEARLS, PILE_LOOK, FLARE, ROVER_WORDS } from '../content/rover.js';
import { bfsPath, bfsDist } from '../dungeon.js';
import { driveBlock } from '../domain/drive-ground.js';
import { createBioPearlScene } from './bio-pearls.js';
import { createBiomassPiles } from './biomass-piles.js';
import { createHullFlares } from './hull-flare.js';
import { createFlareStatus } from './flare-status.js';
import { MINERALS } from '../content/minerals.js';
import { createMineralMining } from './mineral-mining.js';
const chord=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const kgText=n=>Math.round(n).toLocaleString('en-US');
export function createRoverGlue(h){
  let S=null;
  const live=()=>!!h.story()?.programme&&hasPerk(h.story().programme,'depot');
  const centers=()=>h.graph().centers,apart=(a,b)=>chord(centers()[a],centers()[b])/h.cellSide();
  const fielded=()=>!!S?.field&&S.story===h.story();
  const ground=(ci)=>({...h.ground,solid:()=>{if(h.t()-S.solidAt>5){S.solid.clear();S.solidAt=h.t();}if(!S.solid.has(ci))S.solid.set(ci,h.ground.solid?.(centers()[ci],h.metres()*ROVER.road.pad)??null);return S.solid.get(ci);}});
  const open=ci=>!S.closed?.has(ci)&&!driveBlock(centers()[ci],ci,ground(ci),h.metres()*ROVER.road.pad);
  const pileSafe=ci=>open(ci)&&!h.ground.breach?.(centers()[ci],PILE_LOOK.maxMetres*1.2*h.metres());
  function pileCell(cell){
    if(!Number.isInteger(cell)||!centers()[cell])return -1;if(pileSafe(cell))return cell;
    if(!S.pileReach||h.t()-S.pileReachAt>5){S.pileReach=bfsDist(h.graph().adj,[h.story()?.gateCell??h.dungeon().heart],ci=>!!h.story()?.inside?.(ci)||open(ci));S.pileReachAt=h.t();}
    return bfsPath(h.graph().adj,cell,ci=>S.pileReach[ci]>=0&&pileSafe(ci))?.at(-1)??-1;
  }
  const drop=(cell,kg)=>S.field.drop(pileCell(cell),kg,h.t());
  const deposit=n=>{const got=h.eco().deposit(n);S.pearls.fillAt(S.pearls.mostRoom(),got);return got;};
  function reset(){
    if(S){S.piles?.dispose();S.flares?.dispose();S.mining?.dispose();S.flareHud?.dispose();}
    S={story:h.story(),field:createField(FIELD),built:false,solid:new Map(),solidAt:-99,stock:FLARE.stock,hudAt:-9,hudKey:'',hinted:false};
    S.flareHud=createFlareStatus(FLARE);
    S.piles=createBiomassPiles(h.scene,{metres:h.metres(),look:PILE_LOOK,max:FIELD.maxPiles,centers});
  }
  function build(){
    const bay=h.storyBase()?.structure('sai92-bay')?.holder;if(!bay)return false;bay.updateWorldMatrix(true,true);
    const landing=bay.getObjectByName('SOCKET_LANDING')?.getWorldPosition(new THREE.Vector3())??bay.getWorldPosition(new THREE.Vector3());
    S.home=h.cellIndex(landing.toArray());S.pearls=createPearls(PEARLS);S.pearlFx=createBioPearlScene(h.storyBase(),PEARLS.ids);
    S.flares=createHullFlares(h.scene,{metres:h.metres(),cellSide:h.cellSide(),tune:FLARE,reach:ROVER.reach});
    S.mining=createMineralMining({scene:h.scene,graph:h.graph,dungeon:h.dungeon,metres:h.metres,home:S.home,cellOf:h.cellIndex,pad:landing.toArray(),heading:new THREE.Vector3(0,0,1).applyQuaternion(bay.quaternion).toArray(),seed:h.seed(),
      inside:ci=>!!h.story()?.inside(ci),open,solid:h.ground.solid,player:()=>h.playerHP()>0?h.player.pos:null,deposit,
      biomass:{live:o=>!!S.flares.alive(o.id),near:(ci,r)=>S.field.near(ci,r,apart),take:(ci,n)=>S.field.take(ci,n,h.t()),deposit},
      ceiling:(a,b,pad,id)=>h.traffic.ceiling(a,b,pad,id),landingClear:(p,pad,home,id)=>h.traffic.landingClear(p,pad,id,home),
      busy:()=>!h.hullOut()||h.pilotMode()||!!h.briefQ()||h.busy(),brief:h.showBrief,toast:text=>h.showToast?.(`<div class="wave-num">${text}</div>`,1800),wire:h.wire?.()??null});
    S.built=true;return true;
  }
  function flareAt(cell){if(!S?.built)return null;const f=S.flares.drop(centers()[cell],cell,h.t());S.mining.dispatchBiomass({id:f.id,cell});return f;}
  function state(){
    const base={live:live(),built:!!S?.built,field:fielded()?Math.round(S.field.total()):0,piles:fielded()?S.field.size():0,rotted:fielded()?Math.round(S.field.rotted()):0,seeped:fielded()?Math.round(S.field.seeped()):0};
    if(!S?.built)return base;const r=S.mining.state();return {...base,...r,word:r.mode.toUpperCase(),mining:r,scene:r.scene,disabled:false,prey:false,bitten:0,stock:S.stock,
      drawn:S.piles.count(),pearls:S.pearls.list().map(v=>Math.round(v.stored)),cap:S.pearls.capacity(),bank:h.eco().biomass,flares:S.flares.live(),card:h.arrival?.state?.()??null,seepWindow:S.lastWindow??null,lastBreak:S.lastBreak??null};
  }
  function remaining(){h.showToast?.(`<div class="wave-num">${S.stock?`SAI-93 DISPATCHED · FLARES ${S.stock}/${FLARE.stock}`:ROVER_WORDS.noFlares}</div>`,S.stock?2200:4200);}
  const contact=()=>S?.built&&S.story===h.story()?S.mining.contact():null;
  return {
    payKill(bounty,opts,cell){const on=fielded(),kg=h.eco().award(bounty,{...opts,hold:on});if(on)drop(cell,kg);return kg;},
    dropFlare(){
      if(!live()||!S?.built){h.showToast?.(`<div class="wave-num">${ROVER_WORDS.noDepot}</div>`,1400);return null;}
      if(h.playerHP()<=0)return null;if(S.stock<=0){h.showToast?.(`<div class="wave-num">${ROVER_WORDS.noFlares}</div>`,4200);return null;}
      if(S.mining.dispatchNear(h.player.pos)){S.stock--;remaining();return {mineral:true};}
      const f=flareAt(h.player.cur);if(f){S.stock--;remaining();}return f;
    },
    tick(dt){
      if(!h.story())return;if(!S||S.story!==h.story())reset();const now=h.t();S.field.tick(now);S.field.relocate(pileCell);
      if(live()&&(S.built||build())){
        const eco=h.eco();if(h.story().programme.done?.has('pearl')&&S.pearls.list().length<PEARLS.ids.length)S.pearls.add();if(eco.cap!==S.pearls.capacity())eco.setCap(S.pearls.capacity());
        S.mining.tick(dt,now);S.flares.tick(now);const r=S.mining.state();
        S.flareHud.update(S.stock,S.flares.live().length,r.flares.length,h.hullOut()&&!h.pilotMode()&&!h.busy());h.arrival?.tick(r.mode!=='idle');
        if(S.stock<FLARE.stock&&h.playerHP()>0&&h.atBase?.()){S.stock=FLARE.stock;h.sfx?.play?.(FLARE.refillSound);h.showToast?.(`<div class="wave-num">${ROVER_WORDS.restocked}</div>`,1400);}
        S.pearls.settle(eco.biomass);S.pearlFx.tick(now,S.pearls.list(),r.mode==='unload'?S.pearls.mostRoom():-1);
        h.hullConsole?.note?.(`SAI-93 · ${r.resource.toUpperCase()} · ${r.mode.toUpperCase()} · ${kgText(r.cargo)}/${kgText(r.capacity)} KG · FLARES ${S.stock}/${FLARE.stock}`,r.mode==='full');
        if(!S.hinted&&S.field.total()>=ROVER_WORDS.hintKg&&!h.pilotMode()&&!h.briefQ()){S.hinted=true;h.showBrief?.(ROVER_WORDS.hint);}
      }
      S.piles.sync(S.field);const key=`${Math.round(S.field.total()/10)}|${h.eco().biomass}`;if(key!==S.hudKey&&now-S.hudAt>.5){S.hudKey=key;S.hudAt=now;h.updateHud?.();}
    },
    breakHome(){if(fielded())S.lastWindow=S.field.term();if(!live()||!S?.built)return null;
      const eco=h.eco(),out=S.mining.settle(h.t(),S.flares.live(),()=>Math.max(0,eco.cap-eco.biomass));S.flares.clear();S.pearls.settle(eco.biomass);S.lastBreak=out;
      if(out.cargo+out.field>0){h.showBrief?.(ROVER_WORDS.breakBrief);h.updateHud?.();}return out;},
    lay:(cell,kg)=>!!(fielded()&&kg>0&&drop(cell,kg)),
    // The retired ground hunter/rescue contract stays inert for its callers.
    prey:()=>null,bite:()=>0,contact,contacts:()=>S?.built?S.mining.contacts():[],
    haulerOffer:()=>S?.built&&S.mining.canPrintSecond()?{...MINERALS.second,available:true}:null,
    printSecond(){const order=S?.mining?.printSecond();if(!order)return false;h.queuePrint(order);return true;},
    collision:()=>{const b=contact();return b&&Math.hypot(...b.pos)<1+4*h.metres()?b:null;},
    miningContact:()=>{const b=contact();return b&&Math.hypot(...b.pos)<1+4*h.metres()?b:null;},
    radar:()=>S?.mining?.state().fleet.filter(s=>!s.printing&&s.mode!=='idle').map(s=>({pos:s.pos,disabled:false}))??[],
    hud:()=>fielded()&&(S.built||S.field.total()>0)?` <span class="hud-field">FIELD ${kgText(S.field.total())} kg</span>`:'',ground:()=>fielded()?Math.round(S.field.total()):0,
    test:{state,flareAt,mine:id=>S?.mining?.test.dispatch(id)??false,metres:()=>h.metres(),
      richest:()=>fielded()?S.field.richest(ROVER.reach,apart):null,lay:(ci,n)=>!!(fielded()&&n>0&&drop(ci,n)),piles:()=>fielded()?S.field.piles().map(p=>({...p,safe:pileSafe(p.cell)})):[],
      openNear:ci=>open(ci)?ci:bfsPath(h.graph().adj,ci,c=>open(c))?.at(-1)??null,ring:ci=>h.graph().adj[ci].filter(open),
      collect:()=>{if(!fielded())return 0;let n=0;for(const p of S.field.piles()){const got=h.eco().deposit(p.kg);S.field.take(p.cell,got,h.t());n+=got;}S.pearls?.settle(h.eco().biomass);return n;},
      fillPearls:()=>{const room=h.eco().cap-h.eco().biomass;if(Number.isFinite(room)&&room>0)h.eco().addBiomass(room,{category:'grant'});return h.eco().biomass;},spend:kg=>h.eco().spend(kg,{category:'test'}),
    },
  };
}
