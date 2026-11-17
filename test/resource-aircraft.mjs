import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {createResourceAircraft} from '../src/fx/resource-aircraft.js';
// Read the pinned model locally; keep the real parser, rig and print materials.
GLTFLoader.prototype.load=function(url,ok,progress,fail){const b=readFileSync(new URL('../'+url,import.meta.url));this.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',ok,fail);};
const scene=new THREE.Scene(),centers=[[0,1,0],[.05,Math.sqrt(1-.05**2),0]],m=.001;
let bank=0,stock=120;const resource={live:()=>stock>0,near:()=>stock>0?[{cell:1,kg:stock}]:[],take:(c,n)=>{const got=Math.min(n,stock);stock-=got;return got;},deposit:n=>{bank+=n;return n;}};
const unit=createResourceAircraft({scene,metres:m,id:'sai93:2',home:0,pad:centers[0],heading:[1,0,0],centers,resources:{mineral:resource,biomass:resource},printing:true,ceiling:()=>0,landingClear:()=>true});
for(let i=0;i<100&&!unit.loaded()&&!unit.state().error;i++)await new Promise(r=>setTimeout(r,10));
assert.equal(unit.state().thrusters.sockets,4,'pinned model has four exhaust sockets');assert.equal(unit.state().error,null);assert.equal(unit.loaded(),true);assert.equal(unit.available(),false);
unit.print(.5);unit.tick(.1,1);assert.equal(unit.state().printK,.5);assert.equal(bank,0);assert.equal(unit.contact().id,'sai93:2');
const mesh=scene.children[0].getObjectByProperty('isMesh',true);assert.ok(mesh.material.clippingPlanes?.length);
unit.print(1);assert.equal(unit.available(),true);assert.ok(!mesh.material.clippingPlanes?.length,'original material restored after print');
unit.dispatch('mineral',{id:'m',cell:1});const phases=new Set();for(let t=0;t<80;t+=.05){unit.tick(.05,t);const s=unit.state();phases.add(s.flightPhase);if(s.flightPhase==='coast')assert.equal(s.thrusters.intensity,0);if(s.flightPhase==='landing')assert.ok(s.thrusters.intensity>0);}
assert.ok(['climb','boost','coast','brake','landing','parked'].every(p=>phases.has(p)),[...phases].join(','));
assert.ok(unit.state().thrusters.wash.emitted>0,'real cargo flight emits landing dust');assert.equal(unit.state().thrusters.intensity,0);assert.equal(bank,120);assert.equal(stock,0);assert.equal(unit.state().deliveredBy.mineral,120);assert.ok(unit.state().trips>0);
unit.dispose();assert.equal(scene.children.length,0);
console.log('Resource aircraft: real SAI rig loads, printing gates dispatch, materials restore, flight harvest returns cargo.');
// Neighbouring biomass piles use low flights; the home legs retain cruise height.
{const scene=new THREE.Scene(),cs=[0,.05,.075].map(a=>[Math.sin(a),Math.cos(a),0]),stocks=new Map([[1,120],[2,120]]);let paid=0;
 const source={live:()=>true,near:()=>[...stocks].filter(([,n])=>n>0).map(([cell,kg])=>({cell,kg})),take:(c,n)=>{const k=Math.min(n,stocks.get(c)??0);stocks.set(c,(stocks.get(c)??0)-k);return k;},deposit:n=>(paid+=n,n)};
 const u=createResourceAircraft({scene,metres:.001,id:'hops',home:0,pad:cs[0],heading:[1,0,0],centers:cs,resources:{biomass:source,mineral:source},ceiling:()=>0,landingClear:()=>true});
 for(let i=0;i<100&&!u.loaded();i++)await new Promise(r=>setTimeout(r,10));u.dispatch('biomass',{id:'flare',cell:1});let low=false,high=false;
 for(let t=0;t<100;t+=.02){u.tick(.02,t);const s=u.state();if(s.flightPhase==='coast'){if(s.localHop){low=true;assert.ok(s.height<6);}else {high=true;assert.ok(s.height>=32);}}}
 assert.ok(low&&high,'both commute and pickup hops exercised');assert.equal(paid,240);u.dispose();}
