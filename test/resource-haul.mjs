import assert from 'node:assert/strict';
import { createResourceHaul, selectHauler } from '../src/domain/resource-haul.js';
import { MINERALS, BIOMASS_HAUL } from '../src/content/minerals.js';
let bank=0,now=0;const stocks={biomass:7000,mineral:900},alive={b:true,m:true};
const resources=Object.fromEntries(Object.keys(stocks).map(kind=>[kind,{live:o=>alive[o.id]&&stocks[kind]>0,near:()=>stocks[kind]>0?[{cell:kind==='biomass'?1:2,kg:stocks[kind]}]:[],take:(c,n)=>{const k=Math.min(n,stocks[kind]);stocks[kind]-=k;return k;},deposit:n=>{bank+=n;return n;}}]));
const haul=createResourceHaul(0,{biomass:BIOMASS_HAUL,mineral:MINERALS},resources),route={path:(a,b)=>a===b?[a]:[a,b],length:p=>p.length<2?0:100,bearing:()=>0};
const tick=()=>{now+=.05;haul.step(.05,now,route);};
haul.dispatch('biomass',{id:'b',cell:1});while(haul.run.cargo<100)tick();
haul.dispatch('mineral',{id:'m',cell:2});assert.equal(haul.kind(),'biomass');assert.equal(haul.run.tune.capacity,6000);
while(haul.kind()==='biomass'&&now<100)tick();
assert.equal(haul.delivered.biomass,6000,'the full biomass hold unloads before changing resource');assert.equal(haul.run.cargo,0);assert.equal(haul.kind(),'mineral');assert.equal(haul.run.tune.capacity,600);
while(haul.delivered.mineral<900&&now<200)tick();assert.equal(haul.delivered.mineral,900);assert.equal(bank,6900);assert.equal(stocks.biomass,1000,'a mineral order cannot extract biomass');
haul.dispatch('biomass',{id:'b',cell:1});while(haul.delivered.biomass<7000&&now<300)tick();assert.equal(bank,7900);
assert.equal(haul.run.cargo,0);assert.deepEqual(stocks,{biomass:0,mineral:0});
console.log('Single resource hauler: shared queue, typed holds, capacity switch after unloading, conservation.');
// An expired queued mineral job must not reinterpret a standing biomass job.
stocks.biomass=1000;stocks.mineral=100;alive.m=false;
const retry=createResourceHaul(0,{biomass:BIOMASS_HAUL,mineral:MINERALS},resources);
retry.run.order={id:'b',cell:1,kind:'biomass'};retry.dispatch('mineral',{id:'m',cell:2});retry.step(.1,1,route);
assert.equal(retry.kind(),'biomass');assert.equal(retry.run.order.id,'b');
// Reaching a second pile at flight height must not extract before touchdown.
Object.assign(retry.run,{mode:'harvest',cell:1,path:null,pile:1,stand:1});
retry.step(.1,2,{...route,grounded:false});assert.equal(retry.run.cargo,0);assert.equal(stocks.biomass,1000);
retry.step(.1,3,{...route,grounded:true});assert.ok(retry.run.cargo>0);

// The second aircraft stays out of dispatch while printing; independent holds
// share finite stocks without manufacturing or depositing the same kg twice.
assert.equal(selectHauler([{ready:true,mode:'harvest',queued:null,trips:1},{ready:true,mode:'idle',trips:0}]),1);
assert.equal(selectHauler([{ready:true,mode:'harvest',queued:null,trips:1},{ready:false,printing:true,mode:'printing',trips:0}]),0);
assert.equal(selectHauler([{ready:false,printing:true}]),-1);
stocks.biomass=2000;stocks.mineral=900;alive.m=true;bank=0;
const fleet=[0,1].map(()=>createResourceHaul(0,{biomass:BIOMASS_HAUL,mineral:MINERALS},resources));
fleet.forEach(u=>u.dispatch('mineral',{id:'m',cell:2}));
for(let t=0;t<100;t+=.05)fleet.forEach(u=>u.step(.05,t,route));
assert.equal(bank,900);assert.equal(stocks.mineral,0);assert.equal(fleet.reduce((n,u)=>n+u.delivered.mineral,0),900);
