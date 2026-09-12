// Sequential real-browser acceptance. Own server + isolated Chrome + bounded calls.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { launchChrome } from './chrome-proc.mjs';
import assert from 'node:assert/strict';
import { SENTRIES } from '../src/content/sentries.js';
import { CONTENT } from '../src/content/runtime.js';
import { changeSummary } from '../src/content/authoring.js';
import { clone, serializePreset } from '../src/content/preset.js';
const args=process.argv.slice(2),production=args.includes('--dist');
const port=18155,base=production?'/stalheart/':'/';
const origin=`http://127.0.0.1:${port}`,urlRoot=origin+base;
const output=resolve('artifacts/browser'+(production?'-dist':''));mkdirSync(output,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),'stalheart-chrome-'));
const authoringWorkspace=args.includes('--local-authoring')?mkdtempSync(join(tmpdir(),'stalheart-authoring-browser-')):null;
if(authoringWorkspace) for(const path of ['src','scripts','test','docs','vendor','assets','icons','minigames','index.html','labs.html','settings.html','styles.css','app.css','manifest.webmanifest','favicon.svg','sw.js','ATTRIBUTIONS.md','DEVLOG.md','package.json']) cpSync(resolve(path),join(authoringWorkspace,path),{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs',...(authoringWorkspace?[]:['--read-only']),'--port',String(port),'--dir',authoringWorkspace || (production?'dist':'.'),'--base',base],{stdio:['ignore','pipe','pipe']});
let browser,ws,counter=0;const pending=new Map(),consoleLines=[],errors=[],requests=[];let current='boot';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const landing_rim=()=>23.5*1.5;   // the SH02's door rim in the story lab's local metres
function cleanup(){try{ws?.close();}catch{}browser?.kill();server.kill('SIGTERM');try{rmSync(profile,{recursive:true,force:true});if(authoringWorkspace)rmSync(authoringWorkspace,{recursive:true,force:true});}catch{}}
process.once('exit',cleanup);
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++counter;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout ${method}`));},15000);
 pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});
 ws.send(JSON.stringify({id,method,params}));
});
const evaluate=async expression=>{
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text+' '+r.exceptionDetails.exception?.description);
 return r.result?.value;
};
async function until(expression,timeout=25000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(150);}throw Error(`Timed out: ${expression}`);}
async function go(name,path,width=1440,height=900,expectedPath=path){
 current=name;consoleLines.length=0;errors.length=0;requests.length=0;
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 if(await evaluate('location.href')===urlRoot+path){await send('Page.navigate',{url:'about:blank'});await until('location.href === "about:blank"');}
 await evaluate('window.__stalheartReady = false');
 await send('Page.navigate',{url:urlRoot+path});
 await until(`location.href === ${JSON.stringify(urlRoot+expectedPath)} && window.__stalheartReady === true`);
}
async function finish(){
 writeFileSync(join(output,current+'.log'),consoleLines.join('\n')+'\n');
 writeFileSync(join(output,current+'-requests.json'),JSON.stringify(requests,null,2));
 assert.deepEqual(errors,[],`${current}: browser errors`);
 assert(!requests.some(r=>r.status>=400),`${current}: failed resource`);
 const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,current+'.png'),Buffer.from(shot.data,'base64'));
 console.log(`PASS ${current}`);
}
async function click(selector){
 const box=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount:1});
}
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server did not start')),10000);server.stdout.once('data',()=>{clearTimeout(timer);resolve();});server.once('error',reject);server.once('exit',code=>{if(code)reject(Error(`Server exited ${code}`));});});
 browser=launchChrome(['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1440,987','--hide-scrollbars','--mute-audio'],{watchdogMs:1200000});
 const chromePort=await browser.port;
 const targets=await(await fetch(`http://127.0.0.1:${chromePort}/json`)).json();
 ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}
  if(m.method==='Runtime.consoleAPICalled')consoleLines.push(m.params.args.map(a=>a.value??a.description??'').join(' '));
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
  if(m.method==='Network.responseReceived')requests.push({url:m.params.response.url,status:m.params.response.status});
 });
 for(const method of ['Runtime.enable','Page.enable','Network.enable'])await send(method);
 if(args.includes('--sentry-pilot')) {
 await go('sentry-pilot','index.html?sw=0&acceptance=1&sentryPilot=1#td');
 await until('window.__stalheartPilotTest?.state().posts.length > 0');
 const initial=await evaluate('window.__stalheartPilotTest.state()');
 assert.equal(initial.seed,7);assert.equal(initial.points,500);assert.equal(initial.sector,1);assert.equal(initial.key,'needle');
 await delay(1500);
 assert.equal(await evaluate('window.__stalheartPilotTest.state().shots'),0,'Manual mount stays silent');
 assert.deepEqual(await evaluate('window.__stalheartPilotTest.state().tank'),initial.tank,'Tank remains parked');
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '});
 await until('window.__stalheartPilotTest.state().shots > 0');
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '});
 assert.equal(await evaluate('window.__stalheartPilotTest.state().held'),false);
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyE',key:'e'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyE',key:'e'});
 assert.notEqual(await evaluate('window.__stalheartPilotTest.state().ci'),initial.ci);
 for(const s of SENTRIES){await click(`[data-weapon="${s.key}"]`);assert.equal(await evaluate('window.__stalheartPilotTest.state().key'),s.key);await until('window.__stalheartPilotTest.state().ready');}
 await click('[data-weapon="needle"]');
 await until('window.__stalheartPilotTest.state().wave > 0 && window.__stalheartPilotTest.state().enemies > 0',30000);
 let victim=null;
 for(let i=0;i<6&&!victim;i++){
   victim=await evaluate('window.__stalheartPilotTest.aimEnemy()');
   if(!victim)await click('[data-post="1"]');
 }
 assert(victim,'A live wave enemy is visible and in range from a real wall post');
 await until('(()=>{window.__stalheartPilotTest.aimEnemy();return window.__stalheartPilotTest.state().target !== null;})()');
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'Space',key:' '});
 await until(`(()=>{window.__stalheartPilotTest.aimEnemy();const e=window.__stalheartPilotTest.enemy(${victim.id});return !e || e.hp<${victim.hp};})()`);
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'Space',key:' '});
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyM',key:'m'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyM',key:'m'});
 assert(await evaluate('document.querySelector(".pilot-map") !== null'));
 await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyM',key:'m'});
 await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyM',key:'m'});
 await finish();
 } else if(args.includes('--breach-game')) {
 await go('game-breach-load','index.html?sw=0&acceptance=1&cine=0#td');
 await until('window.__stalheartTest?.state().breaches.length>0');
 await evaluate('window.__stalheartTest.breachScenario()');
 const before=await evaluate('window.__stalheartTest.state().wallCount');
 await until('window.__stalheartTest.state().breaches.every(b=>b.phase==="rumbling")');current='game-breach-rumble';await finish();
 await until('window.__stalheartTest.state().breaches.every(b=>b.cleared)',30000);
 assert(await evaluate(`window.__stalheartTest.state().wallCount<${before}`),'Breach removes real wall cells');current='game-breach-clear';await finish();
 await until('window.__stalheartTest.state().wave>=1 && window.__stalheartTest.state().emerging>0',30000);current='game-breach-emergence';await finish();
 await until('window.__stalheartTest.state().breaches.every(b=>b.age>=8)',30000);current='game-breach-open';await finish();assert(await evaluate('window.__stalheartTest.state().breaches.every(b=>Number.isFinite(b.materialPeak)&&b.materialPeak<=2)'),'Bloom restores shared breach materials without accumulating brightness');
 const age=await evaluate('window.__stalheartTest.state().breaches[0].age');
 await evaluate('window.__stalheartTest.breachNextWave();window.__stalheartTest.breachShell()');
 assert(await evaluate(`window.__stalheartTest.state().breaches.every(b=>b.age>=${age}&&b.ready)`),'Later waves and shells leave the breach open');
 await evaluate('window.__stalheartTest.breachNew()');
 await until('window.__stalheartTest.state().shot==="breach"');current='game-breach-camera';await finish();
 await until('window.__stalheartTest.state().breaches.every(b=>b.ready)',30000);
 const sources=await evaluate('window.__stalheartTest.state().breaches.length');
 await evaluate('window.__stalheartTest.breachStrike()');
 assert(await evaluate('window.__stalheartTest.state().breachRubble.caps>=1'),'Orbital strike seals the hole');
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.drawCalls'),1);
 await evaluate('new Promise(resolve=>setTimeout(resolve,2200))');
 assert(await evaluate('window.__stalheartTest.state().breachRubble.caps>=1'));
 current='game-breach-rubble';await finish();
 await evaluate('window.__stalheartTest.breachSpent()');
 assert.equal(await evaluate('window.__stalheartTest.state().breaches.length'),0);
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.caps'),sources);
 await evaluate('window.__stalheartTest.restart()');assert.equal((await evaluate('window.__stalheartTest.state().breaches')).length,2);
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.caps'),0);current='game-breach-reset';await finish();
 } else if(args.includes('--sinkhole')) {
 await go('sinkhole-load','labs.html?sw=0&acceptance=1&genre=sinkhole#portal');
 await until('window.__stalheartPortalTest?.state().sinkhole?.ready',45000);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.crackWidth'),1.15);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.crackLength'),2);
 assert((await evaluate('window.__stalheartPortalTest.state().sinkhole.crackRenderOrder'))<0);
 await evaluate('window.__stalheartPortalTest.configure({craterRadius:3.5,delay:6})');
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.holeRadius'),0);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.environment'),'planet');
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.enemies.spawned'),0);
 await click('[data-sinkhole-open]');
 await until('window.__stalheartPortalTest.state().sinkhole.phase==="rumbling"');
 await until('window.__stalheartPortalTest.state().sinkhole.audioVoices>0');
 await finish();
 await until('window.__stalheartPortalTest.state().sinkhole.holeRadius>=3.49',30000);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.stones'),0);
 await until('window.__stalheartPortalTest.state().sinkhole.collapse>=3.99');
 assert(await evaluate('window.__stalheartPortalTest.state().sinkhole.slopeVisible'));
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.craterVisible'),false);
 current='sinkhole-open';await finish();
 await until('window.__stalheartPortalTest.state().sinkhole.enemies.spawned>0');
 const growing=await evaluate('window.__stalheartPortalTest.state().sinkhole.enemies.actors[0]');
 assert(growing.opacity>=0&&growing.opacity<1&&growing.scale<growing.fullSize,'Creature fades and grows from the breach');
 await evaluate('window.__stalheartPortalTest.view("breach")');current='sinkhole-emergence';await finish();
 await until('window.__stalheartPortalTest.state().sinkhole.openingAge>=8',30000);
 current='sinkhole-settled';await finish();
 await until('window.__stalheartPortalTest.state().sinkhole.enemies.done',40000);
 const creatures=await evaluate('window.__stalheartPortalTest.state().sinkhole.enemies');
 assert.equal(creatures.wave,3);assert.equal(creatures.spawned,24);assert(new Set(creatures.actors.map(a=>a.kind)).size>3);
 assert(creatures.actors[0].arc>5);
 const first=creatures.actors[0].position,planetRadius=await evaluate('window.__stalheartPortalTest.state().sinkhole.planetRadius');
 const altitude=Math.hypot(first[0],first[1]+planetRadius,first[2])-planetRadius;
 assert(altitude>-.01&&altitude<2,'Emerged creatures follow planet curvature');
 await evaluate('window.__stalheartPortalTest.view("planet")');current='sinkhole-waves';await finish();
 await evaluate('window.__stalheartPortalTest.reset()');assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.holeRadius'),0);
 await until('window.__stalheartPortalTest.state().sinkhole.audioVoices===0');
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.enemies.spawned'),0);
 await evaluate('window.__stalheartPortalTest.open()');await until('window.__stalheartPortalTest.state().sinkhole.holeRadius>=3.49');
 current='sinkhole-reopen';await finish();
 await evaluate('window.__stalheartPortalTest.configure({environment:"flat",spawnWaves:false});window.__stalheartPortalTest.view("breach");window.__stalheartPortalTest.open()');
 await until('window.__stalheartPortalTest.state().sinkhole.holeRadius>=3.49');
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.planetRadius'),0);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.enemies.spawned'),0);
 current='sinkhole-flat-reference';await finish();
 await evaluate('Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{window.__breachCopied=text;}}})');
 await click('[data-preset-copy]');await until('document.querySelector(".preset-panel output").textContent.includes("Copied changed values")');
 assert((await evaluate('window.__breachCopied')).includes('3.5'),'Copied summary contains the edited crater radius');
 await evaluate('navigator.clipboard.writeText=async()=>{throw Error("denied");}');await click('[data-preset-copy]');
 assert(await evaluate('!document.querySelector("[data-preset-copy-text]").hidden'),'Denied clipboard exposes selected text');
 current='sinkhole-copy-feedback';await finish();

 for(const look of ['tronColors','battlezone']){
  await evaluate(`window.__stalheartPortalTest.configure({environment:"planet",look:${JSON.stringify(look)},crackLength:.6,fissureWidth:1.4,clearRadius:6});window.__stalheartPortalTest.open()`);
  await until('window.__stalheartPortalTest.state().sinkhole.openingAge>2 && window.__stalheartPortalTest.state().sinkhole.phase==="open"');
  const state=await evaluate('window.__stalheartPortalTest.state().sinkhole');
  assert.equal(state.crackWidth,1.4);assert.equal(state.crackLength,.6);
  assert(state.walls.destroyed>0&&state.walls.remaining>0,'Breach clears nearby walls and preserves distant fixtures');
  current='sinkhole-'+look;await finish();
 }

 await evaluate('window.__stalheartPortalTest.genre("portals")');await delay(200);
 assert.equal(await evaluate('window.__stalheartPortalTest.state().sinkhole.audioVoices'),0);
 current='sinkhole-return-portals';await finish();
 await evaluate('window.__stalheartPortalTest.dispose()');
 } else if(args.includes('--astro')) {
 await go('astro-station','labs.html?sw=0&acceptance=1#astro');
 await until('window.__stalheartAstroTest?.state().ready',60000);await delay(1000);
 await until('window.__stalheartAstroTest.state().performance.fps>0');
 const first=await evaluate('window.__stalheartAstroTest.state()');
 assert.equal(first.mode,'diorama');assert.equal(first.crew.length,9);assert.deepEqual([...new Set(first.crew.map(c=>c.role))].sort(),['astronaut','scientist','worker']);assert.deepEqual(first.errors,[]);
 assert(first.groups.find(g=>g.id==='antenna').triangles>0);assert(first.groups.every(g=>g.batches>0));await finish();
 await delay(4500);const moved=await evaluate('window.__stalheartAstroTest.state()');assert.notDeepEqual(moved.crew.map(c=>c.position),first.crew.map(c=>c.position));assert(moved.crew.some(c=>c.history.includes('Walk')));assert(moved.crew.some(c=>c.history.includes('Run')));assert(moved.crew.some(c=>c.history.includes('Point')));
 assert(moved.groups.filter(g=>g.clips).every(g=>g.time>0),'Landmark clips advance');
 assert(first.foundationTiles>100);for(const id of ['assembly','cargo','solar','reactor','foundations'])assert(first.groups.some(g=>g.id===id&&g.triangles>0));
 const solarBudget=first.groups.find(g=>g.id==='solar');assert(solarBudget.batches<100,'Solar static geometry is batched');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});await delay(200);assert.equal(await evaluate('window.__stalheartAstroTest.state().drive.mode'),'tank');
 const parked=await evaluate('window.__stalheartAstroTest.state().drive');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(1000);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});const driven=await evaluate('window.__stalheartAstroTest.state().drive');assert(Math.hypot(driven.z-parked.z,driven.x-parked.x)>2);assert(driven.hover>.5);current='astro-tank-drive';await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA'});await delay(500);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA'});assert(await evaluate('window.__stalheartAstroTest.state().drive.yaw')>driven.yaw);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1'});const free=await evaluate('window.__stalheartAstroTest.state().drive');assert.equal(free.mode,'free');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW'});await delay(400);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW'});assert.equal(await evaluate('window.__stalheartAstroTest.state().drive.z'),free.z);
 await evaluate('document.querySelector("#tab-astro .lil-gui input").focus()');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});assert.equal(await evaluate('window.__stalheartAstroTest.state().drive.mode'),'free');await evaluate('document.activeElement.blur()');

 await evaluate('window.__stalheartAstroTest.focus("Overview")');await delay(300);current='astro-overview';await finish();
 await evaluate('window.__stalheartAstroTest.motion(false)');await delay(100);const frozen=await evaluate('window.__stalheartAstroTest.state().crew.map(c=>c.position)');await delay(500);assert.deepEqual(await evaluate('window.__stalheartAstroTest.state().crew.map(c=>c.position)'),frozen);
 await evaluate('window.__stalheartAstroTest.toggle("antenna",false);window.__stalheartAstroTest.count(30)');await delay(1000);assert.equal(await evaluate('window.__stalheartAstroTest.state().crew.length'),30);assert.equal(await evaluate('window.__stalheartAstroTest.state().groups.find(g=>g.id==="antenna").triangles'),0);
 assert(await evaluate('window.__stalheartAstroTest.state().performance.samples<=120'));current='astro-load-comparison';await finish();
 await evaluate('window.__stalheartAstroTest.count(9);window.__stalheartAstroTest.toggle("antenna",true);window.__stalheartAstroTest.motion(true);window.__stalheartAstroTest.focus("Crew")');await delay(500);current='astro-return-crew';assert(await evaluate('window.__stalheartAstroTest.state().performance.textures')<=first.performance.textures+4,'Crew resize releases old skeleton textures');await finish();
 await go('astro-shared-settings','labs.html?sw=0&acceptance=1&yard_count=6&yard_antenna=0&yard_gait=Point#astro');await until('window.__stalheartAstroTest?.state().ready',60000);await delay(300);const shared=await evaluate('window.__stalheartAstroTest.state()');assert.equal(shared.crew.length,6);assert(shared.crew.every(c=>c.clip==='Point'));assert.equal(shared.groups.find(g=>g.id==='antenna').visible,false);await finish();
 await evaluate('window.__stalheartAstroTest.dispose()');const stopped=await evaluate('window.__stalheartAstroTest.state().time');await delay(200);assert.equal(await evaluate('window.__stalheartAstroTest.state().time'),stopped);assert.equal(await evaluate('window.__stalheartAstroTest.state().crew.length'),0);

 } else if(args.includes('--story')) {
 await go('story-arrival','labs.html?sw=0&acceptance=1#story');
 await until('window.__stalheartStoryTest?.state().ready',90000);await delay(800);
 const rest=await evaluate('window.__stalheartStoryTest.state()');
 assert.equal(rest.cells,71314);assert.equal(rest.openMouths,1);assert(rest.mouths>=6,'lane mouths found');assert.deepEqual(rest.errors,[]);
 assert.equal(rest.phase,'done');assert.equal(rest.landing.clips.Top_Door_Open,1.8,'door held open at rest');assert(rest.landing.isao?.visible,'Isao is out at rest');
 assert(rest.gateMarker,'gate-sized marker at the open mouth');
 assert(rest.counts.floorTriangles>20000&&rest.counts.rockTriangles>20000&&rest.counts.edgeSegments>100000,'lattice geometry built');
 await finish();
 await evaluate('window.__stalheartStoryTest.seek(8)');await delay(300);current='story-descent';await finish();
 const descent=await evaluate('window.__stalheartStoryTest.state()');
 assert.equal(descent.phase,'descent');assert(descent.landing.altitude>0&&descent.landing.altitude<300,'rocket descending');assert.equal(descent.landing.clips.Landing_Shock,null);
 await evaluate('window.__stalheartStoryTest.seek(12.6)');await delay(300);current='story-touchdown';await finish();
 const down=await evaluate('window.__stalheartStoryTest.state()');
 assert.equal(down.landing.altitude,0);assert(down.landing.clips.Landing_Shock>0.5,'shock clip running');assert(down.landing.scorch,'scorch under the bells');assert.equal(down.landing.clips.Legs_Deploy,null,'deploy released to the shock clip');
 await evaluate('window.__stalheartStoryTest.land()');await delay(1500);const live=await evaluate('window.__stalheartStoryTest.state()');assert(live.playing&&live.t>1,'landing plays in real time');
 assert.equal(live.landing.plumes,6,'six engine plumes');
 await evaluate('window.__stalheartStoryTest.seek(6)');await delay(200);const burning=await evaluate('window.__stalheartStoryTest.state()');assert.equal(burning.landing.burning,6,'all six engines burn in descent');assert(burning.cues.includes('rocket_thrust'),'thrust bed started');
 current='story-six-engines';await finish();
 await evaluate('window.__stalheartStoryTest.seek(12.2)');await delay(200);const cut=await evaluate('window.__stalheartStoryTest.state()');assert.equal(cut.landing.burning,0,'engines cut at touchdown');assert(cut.cues.includes('tank_spool_up')&&cut.cues.includes('tank_spool_down'),'legs and landing pneumatics fired');
 await evaluate('window.__stalheartStoryTest.seek(24.6)');await delay(300);const mid=await evaluate('window.__stalheartStoryTest.state()');assert.equal(mid.landing.face,'angry','red with anger as he clears the rim');assert(mid.comms&&mid.comms.includes('Rough landing'),'the comms line');assert(mid.landing.isao.y>landing_rim(mid),'he is out of the tube');current='story-isao-angry';await finish();
 await evaluate('window.__stalheartStoryTest.seek(27.5)');await delay(300);const late=await evaluate('window.__stalheartStoryTest.state()');assert.equal(late.phase,'hold');assert.equal(late.landing.face,'glee','delighted once he is clear');assert(late.comms.includes('So much to build'));current='story-isao-happy';await finish();
 await evaluate('window.__stalheartStoryTest.skip()');await delay(300);const done=await evaluate('window.__stalheartStoryTest.state()');
 assert.equal(done.phase,'done');assert.equal(done.landing.isao.visible,true);assert.equal(done.landing.face,'glee');current='story-isao-out';await finish();
 await evaluate('window.__stalheartStoryTest.setStage(8)');await evaluate('window.__stalheartStoryTest.baseReady()');await delay(2500);
 const base=await evaluate('window.__stalheartStoryTest.state()');assert.equal(base.stage,8);assert.deepEqual(base.base.errors,[]);assert.equal(base.base.islands,7);assert.equal(base.base.walls,12);assert(base.base.gate);assert.equal(base.base.structures,10,'ten landmarks at stage 8 in the lab (the landing scene owns the rocket; three earlier landings out past the clearing)');
 assert(base.playUrl.includes('story=8'),'play carries the stage');
 await evaluate('window.__stalheartStoryTest.reset()');await delay(300);current='story-stage-8';await finish();
 await evaluate('window.__stalheartStoryTest.overview()');await delay(400);current='story-stage-8-overview';await finish();
 // far tiers: from the overview every landmark with a far tier stands on it and the near tier was never fetched; framed close to the solar island the near tier loads and takes over
 const lodFar=await evaluate('window.__stalheartStoryTest.state().base.lod');assert.equal(lodFar.length,7,'seven landmarks carry a far tier');assert(lodFar.every((l)=>l.shown==='far'),'from the overview every landmark shows its far tier');
 await evaluate("window.__stalheartStoryTest.frame({ pos: [0, 12, -30], look: [0, 4, 0], fov: 45 }, { x: 44, z: -60 })");await until('window.__stalheartStoryTest.state().base.lod.find((l)=>l.id==="solar").nearLoaded',60000);await delay(300);
 const lodNear=await evaluate('window.__stalheartStoryTest.state().base.lod');assert.equal(lodNear.find((l)=>l.id==='solar').shown,'near','close to the solar island its near tier shows');assert(lodNear.filter((l)=>!/rocket|wreck/.test(l.id)).every((l)=>l.nearLoaded),'within 150 m of the whole base every landmark near tier has been fetched');assert(lodNear.filter((l)=>/rocket|wreck/.test(l.id)).every((l)=>l.shown==='far'&&!l.nearLoaded),'the earlier landings out past the clearing stay far and unfetched');
 current='story-stage-8-solar-near';await finish();
 await evaluate('window.__stalheartStoryTest.overview()');await delay(300);assert.equal((await evaluate('window.__stalheartStoryTest.state().base.lod')).find((l)=>l.id==='solar').shown,'far','back on the overview the far tier returns');
 await evaluate('window.__stalheartStoryTest.setStage(4)');await evaluate('window.__stalheartStoryTest.baseReady()');await delay(300);
 assert.equal((await evaluate('window.__stalheartStoryTest.state()')).base.gate.present,true,'gate loaded with its clip');
 await evaluate('window.__stalheartStoryTest.gate(true)');await delay(2200);const opened=await evaluate('window.__stalheartStoryTest.state()');assert.equal(opened.base.gate.open,true,'gate opens');
 await evaluate('window.__stalheartStoryTest.gate(false)');await delay(2200);assert.equal((await evaluate('window.__stalheartStoryTest.state()')).base.gate.open,false,'gate closes');
 await evaluate('window.__stalheartStoryTest.setStage(1)');await evaluate('window.__stalheartStoryTest.baseReady()');await delay(300);const s1=await evaluate('window.__stalheartStoryTest.state()');assert.equal(s1.base.islands,0);assert.equal(s1.base.structures,3,'only the three earlier landings out past the clearing');
 // the menu's arrival entry: ?land=1 opens straight on the cinematic
 await go('story-arrival-link','labs.html?sw=0&acceptance=1&land=1#story');await until('window.__stalheartStoryTest?.state().ready',90000);await delay(1200);
 const auto=await evaluate('window.__stalheartStoryTest.state()');assert(auto.playing&&auto.t>0.5,'the cinematic plays on load');assert(await evaluate('!!document.querySelector("#story-hud a.story-back")'),'a way back to the game');
 await evaluate('window.__stalheartStoryTest.dispose()');
 } else if(args.includes('--story-world')) {
 await go('story-world','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6#td');
 await until('!!window.__stalheartTest',90000);await delay(3000);
 const w=await evaluate('window.__stalheartTest.state()');
 assert.equal(w.heartAsset,'none','no dot-cloud heart in the story world');assert.deepEqual(w.berthAssets,[],'no camp containers');assert.equal(w.queued,0,'no enemies queued');
 assert(w.wallCount>40000&&w.wallCount<71314,`story world rock count ${w.wallCount}`);assert(w.performance.fps>20,'story world renders');assert(w.playerAssetReady,'tank landed on the story world');
 await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});await delay(800);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1'});await delay(1500);
 current='story-world-orbit';await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});await delay(1200);
 current='story-world-tank';await finish();
 assert.equal(await evaluate('document.querySelectorAll("canvas").length>0'),true);
 await go('story-world-stage1','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=1#td');await until('!!window.__stalheartTest',90000);await delay(2500);
 const one=await evaluate('window.__stalheartTest.state()');assert.equal(one.towers,0);assert.equal(one.queued,0);
 assert.equal(await evaluate('document.querySelector("#td-intro").classList.contains("hidden")'),true,'no field manual in the story world');
 await finish();
 await until('window.__stalheartTest.state().towers===1',90000);const printed=await evaluate('window.__stalheartTest.state()');
 assert.equal(printed.towers,1,'Isao printed the Rotor');assert.equal(printed.wallCount,one.wallCount,'the socket is floor, not rock');assert.equal(printed.queued,0);
 await delay(1500);current='story-world-rotor';await finish();
 try{await until('!!window.__stalheartPilotTest',30000);}catch(e){console.log('STORY BEATS',JSON.stringify(await evaluate('(s=>({story:s.story,towers:s.towerCells,biomass:s.biomass}))(window.__stalheartTest.state())')));throw e;}await delay(500);const took=await evaluate('window.__stalheartPilotTest.state()');
 assert.equal(took.key,'rotor','control taken of the printed Rotor');assert.equal(took.posts.length,1);assert.deepEqual(printed.towerCells,[['rotor',took.ci]],'the only tower is the one under control');
 await delay(3800);current='story-world-control';await finish();
 await evaluate('window.__stalheartPilotTest.view("third")');await delay(600);assert.equal(await evaluate('window.__stalheartPilotTest.state().view'),'third');current='story-world-third';await finish();
 await evaluate('window.__stalheartPilotTest.view("map")');await delay(600);current='story-world-map';await finish();
 await evaluate('window.__stalheartPilotTest.view("pov")');await delay(600);assert.equal(await evaluate('window.__stalheartPilotTest.state().view'),'pov');
 await delay(6000);assert.equal((await evaluate('window.__stalheartTest.state()')).performance.enemies,0,'no fodder before a gate stands');
 await go('story-world-gate','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=4#td');await until('!!window.__stalheartTest',90000);await delay(2500);
 const four=await evaluate('window.__stalheartTest.state()');assert.equal(four.wallCount-w.wallCount,0,'stage 4 and 6 block the same wall cells');assert(four.wallCount>one.wallCount,'walls are rock to the pathfinder');
 await finish();
 await until('window.__stalheartTest.state().towers===1',90000);
 await until('window.__stalheartTest.state().story.phase==="tremor"',20000);await delay(600);current='story-world-tremor';await finish();
 await until('window.__stalheartTest.state().story.phase==="breach"',20000);await until('window.__stalheartTest.state().shot==="breach"',15000);await delay(1200);
 assert((await evaluate('window.__stalheartTest.state().breaches')).length>0,'the ground opened');current='story-world-breach';await finish();
 // THE PLANET STAYS IN FRAME: the orbit shot holds through the opening and the first fodder emerging, then hands back
 await until('window.__stalheartTest.state().story.spawned>=2',20000);assert.equal(await evaluate('window.__stalheartTest.state().shot'),'breach','still from orbit while the first fodder emerge');current='story-world-breach-emerge';await finish();
 await until('window.__stalheartTest.state().shot!=="breach"',20000);
 await until('window.__stalheartTest.state().story.phase==="override"',90000);await delay(800);
 assert.equal(await evaluate('document.querySelector("#td-brief").classList.contains("hidden")'),false,'Isao speaks the override line');
 const held=await evaluate('window.__stalheartTest.state()');assert.equal(held.kills,0,'the sentry did not fire on its own');assert(held.performance.enemies>=held.story.spawned-1&&held.performance.enemies>0,`every spawned enemy is still alive (${held.performance.enemies} of ${held.story.spawned}, the last may still be emerging)`);current='story-world-override';await finish();
 assert.equal(await evaluate('typeof window.__stalheartPilotTest'),'undefined','no control before the override');
 await until('!!window.__stalheartPilotTest',30000);await until('window.__stalheartTest.state().performance.enemies>0',60000);await delay(14000);
 const fodder=await evaluate('window.__stalheartTest.state()');assert(fodder.performance.enemies>=2&&fodder.performance.enemies<=8,`fodder alive ${fodder.performance.enemies}`);assert.equal(fodder.performance.wave,0,'no wave arms');
 assert.equal(fodder.insideEnemies,0,'the closed gate holds the fodder outside');assert.equal(fodder.queued,0);
 current='story-world-fodder';await finish();
 await until('window.__stalheartPilotTest.aimEnemy()!==null',15000);const victim=await evaluate('window.__stalheartPilotTest.aimEnemy()');assert(victim!==null,'a phage is in reach and sight of the Rotor');   // the pile at the gate shuffles; give it a moment
 await evaluate('window.__stalheartPilotTest.hold(true)');
 // the fodder keeps walking, so re-aim each poll until this one drops
 await until(`(()=>{const t=window.__stalheartPilotTest;const e=t.enemy(${victim.id});if(!e||!e.alive)return true;t.aimEnemy();return false;})()`,8000);await evaluate('window.__stalheartPilotTest.hold(false)');
 const shots=await evaluate('window.__stalheartPilotTest.state().shots');assert(shots>=2,'the Rotor streamed rounds');assert((await evaluate('window.__stalheartTest.state().brassLive'))>0,'spent cases fell from the Rotor in sentry control (docs/AMMUNITION.md)');current='story-world-rotor-kill';await finish();
 // keep shooting: the fifth kill brings the comms study, the tenth the biomass line
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.said.includes("harvest_biomass"))return true;window.__stalheartPilotTest.aimEnemy();return false;})()',120000);
 const hot=await evaluate('window.__stalheartPilotTest.state()');assert(hot.heat>0.05,`the barrels carry heat after a burst (${hot.heat})`);
 await evaluate('window.__stalheartPilotTest.hold(false)');const said=await evaluate('window.__stalheartTest.state().story.said');assert(said.includes('alien_comms')&&said.includes('harvest_biomass'),'both lines said');
 await delay(400);current='story-world-harvest';await finish();
 // THE FIRST WAVE DOWN IS THE NEXT UNLOCK: keep firing until the twenty are spent and none stand, then Isao's line and the view strip
 assert.equal(await evaluate('document.querySelector("#story-views")'),null,'no view strip before the wave is cleared');
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.phase==="cleared")return true;const t=window.__stalheartPilotTest;if(t.state().overheated)return false;t.aimEnemy();return false;})()',240000);
 await evaluate('window.__stalheartPilotTest.hold(false)');const cleared=await evaluate('window.__stalheartTest.state()');assert(cleared.story.said.includes('wave_cleared'));await until('window.__stalheartTest.state().performance.enemies===0',5000);   // the performance block is a periodic sample
 await until('!!document.querySelector("#story-views")',5000);await delay(600);current='story-world-cleared';await finish();
 await click('#story-views [data-view="tank"]');await until('typeof window.__stalheartPilotTest==="undefined" && !document.querySelector("#sentry-pilot")',5000);await delay(800);current='story-world-views-tank';await finish();
 await click('#story-views [data-mount="rotor"]');await until('!!window.__stalheartPilotTest && !!document.querySelector("#sentry-pilot")',5000);await delay(600);assert.equal(await evaluate('window.__stalheartPilotTest.state().key'),'rotor','the ROTOR button takes the Rotor');current='story-world-views-sentry';await finish();
 await click('#story-views [data-view="map"]');await until('!!document.querySelector(".pilot-map")',5000);await delay(600);current='story-world-views-map';await finish();
 // THE QUIVER: Isao prints it across the lane, a hard core reaches the gate, the override hands over the Quiver's optic (its post first,
 // the Rotor's behind it), two TALON shots with the seeker feed riding along, then settled and the strip is back
 await until('window.__stalheartTest.state().story.phase==="quiver-piloting"',120000);await delay(600);
 const qp=await evaluate('window.__stalheartPilotTest.state()');assert.equal(qp.key,'quiver','the Quiver optic first');assert.equal(qp.posts.length,2,'both mounts are posts');
 const killsBefore=(await evaluate('window.__stalheartTest.state()')).kills;await evaluate('window.__stalheartPilotTest.hold(true)');
 // re-aim every half second, not every poll: each re-aim re-slews the launcher, and a lock needs the reticle held still on the target
 try{await until('(()=>{const s=window.__stalheartTest.state();if(s.story.phase==="settled")return true;if(!window.__aimAt||Date.now()-window.__aimAt>500){window.__aimAt=Date.now();window.__stalheartPilotTest.aimEnemy();}return false;})()',150000);}
 catch(e){console.log('QUIVER DUMP',JSON.stringify(await evaluate('(()=>{const s=window.__stalheartTest.state(),p=window.__stalheartPilotTest?.state();return {story:s.story,kills:s.kills,enemies:s.performance.enemies,towers:s.towerCells,engagement:s.engagement,pilot:p&&{key:p.key,ci:p.ci,posts:p.posts,held:p.held,shots:p.shots,view:p.view},reach:window.__stalheartPilotTest?.reach(),monitor:s.monitorShown,shot:s.shot};})()')));throw e;}
 await evaluate('window.__stalheartPilotTest.hold(false)');const settled=await evaluate('window.__stalheartTest.state()');assert.equal(settled.kills-killsBefore,2,'two hard cores, two rounds');assert(settled.monitorShown>0,'the seeker feed showed during a flight');
 await delay(500);current='story-world-quiver-settled';await finish();
 // ISAO's study: the synthetic-learning terminal opens over the game a few seconds after the Quiver beat settles, pauses it, and CONTINUE closes it
 await until('window.__stalheartTest.state().screenOpen',10000);await delay(1200);assert(await evaluate('window.__stalheartTest.state().paused'),'the game pauses under the screen');assert.equal(await evaluate('document.querySelectorAll("#synthetic-modal canvas").length'),4,'four panels');
 current='story-world-study';await finish();
 await click('#synthetic-modal [data-continue]');await delay(400);const afterScreen=await evaluate('window.__stalheartTest.state()');assert(!afterScreen.screenOpen&&!afterScreen.paused,'CONTINUE closes it and the game resumes');assert.equal(afterScreen.screensOpened,1);
 assert.equal(await evaluate('getComputedStyle(document.querySelector("#synthetic-modal")).display'),'none','the closed screen is really gone, not a transparent sheet over the strip');
 assert.equal(await evaluate('document.querySelectorAll("#story-views [data-mount]").length'),2,'one button per mount');
 await click('#story-views [data-mount="rotor"]');await delay(500);
 if(await evaluate('window.__stalheartPilotTest?.state().key')!=='rotor')console.log('PICK DUMP',JSON.stringify(await evaluate('(()=>{const s=window.__stalheartTest.state(),p=window.__stalheartPilotTest?.state();const b=document.querySelector("#story-views [data-mount=rotor]"),r=b?.getBoundingClientRect();const top=r?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2):null;return {pilot:p&&{key:p.key,posts:p.posts,view:p.view},paused:s.paused,screenOpen:s.screenOpen,phase:s.story.phase,hasPilot:!!window.__stalheartPilotTest,button:!!b,under:top&&(top.id||top.className||top.tagName),strip:[...document.querySelectorAll("#story-views button")].map(x=>x.textContent)};})()')));
 assert.equal(await evaluate('window.__stalheartPilotTest.state().key'),'rotor','ROTOR picks that mount while piloting');await click('#story-views [data-mount="quiver"]');await delay(500);assert.equal(await evaluate('window.__stalheartPilotTest.state().key'),'quiver','and back');current='story-world-views-cycle';await finish();
 // THE THREE HULLS ARE THE THREE LIVES: at stage 7 the bays are the berths; the first hull starts inside bay 3 and rolls out of its doors,
 // bay 3's parked hull is hidden the moment it is the one being driven, bays 1 and 2 keep theirs (1 sealed and empty by construction)
 await go('story-world-bays','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=7#td');await until('!!window.__stalheartTest',90000);
 const first=await evaluate('window.__stalheartTest.state()');assert.equal(first.deployBerth,2,'the first hull rolls out of bay 3');assert.equal(first.berthCells.length,3);
 await until('window.__stalheartTest.state().bays.length===3',60000);await delay(400);
 const bays=await evaluate('window.__stalheartTest.state()');assert.equal(bays.hulls,3);assert.deepEqual(bays.bays.map((b)=>b.hasTank),[false,true,true],'bay 1 sealed and empty, 2 and 3 hold a hull');assert.deepEqual(bays.bays.map((b)=>b.racked),[false,true,true],'bay 3\'s hull is still on show: it is the one rolling out');
 assert.deepEqual(bays.bays.map((b)=>b.ci),bays.berthCells,'the bays are the berths');assert.deepEqual(bays.berthAssets,['mork','mork']);
 current='story-world-bays';await finish();
 assert(bays.deploying&&bays.rollingOut&&bays.deployBerth===2,'once the bays stand, the first hull replays as bay 3\'s authored roll-out');
 await delay(4000);current='story-world-bays-rolling';await finish();
 await until('!window.__stalheartTest.state().deploying',15000);const rolled=await evaluate('window.__stalheartTest.state()');assert.equal(rolled.bays[2].racked,false,'the authored hull hides at the hand-over');assert.notEqual(rolled.playerCell,first.berthCells[2],'the hull left its bay');current='story-world-bays-out';await finish();
 // the phone deep link: ?story=N alone means the story world at that stage, no old heart, no cold open, sparse waves
 await go('story-world-deeplink','index.html?sw=0&acceptance=1&story=4#td');await until('!!window.__stalheartTest',90000);await delay(1500);
 const dl=await evaluate('window.__stalheartTest.state()');assert.equal(dl.heartAsset,'none');assert(dl.story&&dl.story.phase,'story beats run from the deep link');assert(dl.wallCount>40000);
 assert.equal(await evaluate('document.querySelector("#td-intro").classList.contains("hidden")'),true);
 assert.equal(await evaluate('document.querySelector("#tabbar [data-story]").classList.contains("active")'),true,'the burger marks story as the active mode');
 assert.equal(await evaluate('document.querySelector("#tabbar [data-classic]").classList.contains("active")'),false,'classic is not active in the story');await finish();
 await go('story-default-route','index.html?sw=0#td');await until('document.querySelector("#tabbar [data-story]")!==null');await delay(2500);
 assert.equal(await evaluate('document.querySelector("#tabbar [data-story]").classList.contains("active")'),true,'a bare index.html is the story');assert.equal(await evaluate('document.querySelector("#td-intro").classList.contains("hidden")'),true);
 await go('story-cine-redirect','index.html?sw=0&acceptance=1&story=4&cine=1#td',1440,900,'labs.html?sw=0&acceptance=1&land=1#story');await until('window.__stalheartStoryTest?.state().ready',90000);await delay(1500);assert(await evaluate('window.__stalheartStoryTest.state().playing'),'the story cine switch plays the arrival');await finish();
 await go('story-world-default','index.html?sw=0&acceptance=1&cine=0#td');
 await until('!!window.__stalheartTest',60000);await delay(1500);
 const d=await evaluate('window.__stalheartTest.state()');assert(d.wallCount>1500&&d.wallCount<2236,`default world unchanged ${d.wallCount}`);
 } else if(args.includes('--sniper')) {
 await go('sniper-showcase','labs.html?sw=0&acceptance=1&swaySlow=0&swayFast=0#sniper');
 await until('window.__stalheartSniperTest?.state().ready');
 await until('window.__stalheartSniperTest.state().environment.mounted===6',30000);
 const defaults=await evaluate('window.__stalheartSniperTest.state()');
 assert.equal(defaults.rangeScale,5);assert.equal(defaults.weaponMaxRange,350);assert(defaults.environment.wallCount>100);assert.equal(defaults.environment.canyonLength,1400);
 assert(defaults.range>=50&&defaults.phase==='showcase');assert.equal(defaults.targets.filter(t=>t.kind).length,14);assert(defaults.targets.some(t=>t.kind==='shellback'));assert(defaults.targets.some(t=>t.kind==='knot'));await finish();
 await evaluate('window.__stalheartSniperTest.overview(true)');await delay(200);current='sniper-planet-overview';await finish();
 await evaluate('window.__stalheartSniperTest.overview(false)');
 await evaluate('window.__stalheartSniperTest.pan(Math.atan2(70,250),0)');await click('#sniper-fire');
 await until('!!window.__stalheartSniperTest.state().beam');
 assert(await evaluate('window.__stalheartSniperTest.state().beam.reach<300'), 'Canyon walls stop the beam before maximum range');
 await until('!window.__stalheartSniperTest.state().beam && window.__stalheartSniperTest.state().sequence.left===0');
 await evaluate('window.__stalheartSniperTest.aim("phage")');await click('#sniper-fire');
 await until('window.__stalheartSniperTest.state().kills>0',15000);
 const death=await evaluate('window.__stalheartSniperTest.state()');
 assert(death.targets.some(t=>t.dying&&!t.alive),'Laser starts the creature death animation');
 assert(death.cues.some(c=>c.startsWith('enemy_die_')),'Kill emits a death cue');
 assert(death.voiceDetails.some(v=>v.key.startsWith('enemy_die_')),'Death sound has an active audio voice');
 await until('window.__stalheartSniperTest.state().targets.some(t=>t.dying&&Math.abs(t.rotation)>.1)');current='sniper-creature-death';await finish();
 const victim=death.targets.find(t=>t.dying).id;
 await until(`!window.__stalheartSniperTest.state().targets.some(t=>t.id===${victim})`);
 await until('window.__stalheartSniperTest.state().sequence.left===0 && !window.__stalheartSniperTest.state().beam');
 const coreId=await evaluate('window.__stalheartSniperTest.state().targets.find(t=>t.kind==="shellback").id');
 for(let shot=0;shot<2;shot++){
   await evaluate('window.__stalheartSniperTest.aim("shellback")');await click('#sniper-fire');
   await until('window.__stalheartSniperTest.state().sequence.left===0 && !window.__stalheartSniperTest.state().beam');
 }
 assert(await evaluate(`!window.__stalheartSniperTest.state().targets.some(t=>t.id===${coreId}&&t.alive)`),'Hard-core enemy can be killed by sustained fire');
 await evaluate('window.__stalheartSniperTest.select("quiver")');
 await until('window.__stalheartSniperTest.state().ready && window.__stalheartSniperTest.state().talonPool');
 await evaluate('window.__stalheartSniperTest.aim()');await until('window.__stalheartSniperTest.state().lock.locked');await click('#sniper-fire');
 await until('window.__stalheartSniperTest.state().flights.some(f=>f.t>1.5)');
 const talon=await evaluate('window.__stalheartSniperTest.state().flights[0]');
 assert.equal(talon.mesh,'talon');assert.equal(talon.profile,'heavy');assert.equal(talon.duration,6);assert.equal(talon.length,1.8);
 assert.equal(await evaluate('window.__stalheartSniperTest.state().talonPool.triangles'),1340);current='sniper-talon-coast';await finish();
 await until('window.__stalheartSniperTest.state().flights.some(f=>f.t>4)');current='sniper-talon-crest';await finish();
 await until('window.__stalheartSniperTest.state().talonPool.active===0');
 await go('sniper-roster','labs.html?sw=0&acceptance=1&phase=calibrate&range=20&rangeScale=1&quiverTalon=0&sound=1&swaySlow=0&swayFast=0#sniper');
 await until('window.__stalheartSniperTest?.state().ready && window.__stalheartSniperTest.state().pool');
 assert.deepEqual((await evaluate('window.__stalheartSniperTest.state().roster')).map(s=>s.key),SENTRIES.map(s=>s.key));
 for(const sentry of SENTRIES){
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:String(sentry.number),code:'Digit'+sentry.number});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:String(sentry.number),code:'Digit'+sentry.number});
   await until(`window.__stalheartSniperTest.state().weapon===${JSON.stringify(sentry.key)}`);
   await until('window.__stalheartSniperTest.state().ready');
   const state=await evaluate('window.__stalheartSniperTest.state()');
   assert.equal(state.label,sentry.label);assert.equal(state.model,sentry.model);
   assert.deepEqual(state.profile,CONTENT.weapons[sentry.key]);
   await until('Number.parseFloat(document.querySelector("#f-maxrange").textContent)===Math.round(window.__stalheartSniperTest.state().weaponMaxRange)');
   const maxRange=await evaluate('Number.parseFloat(document.querySelector("#f-maxrange").textContent)');
   await evaluate(`window.__stalheartSniperTest.distance(${maxRange+30});window.__stalheartSniperTest.aim()`);
   await until('document.querySelector("#f-envelope").dataset.range==="far"');
   assert.equal(await evaluate('document.querySelector("#f-envelope").textContent'),'OUT OF RANGE');
   await evaluate('window.__stalheartSniperTest.distance(20);window.__stalheartSniperTest.aim()');

   await evaluate('window.__stalheartSniperTest.aim()');
   if(CONTENT.missiles[sentry.key]){
     await until('window.__stalheartSniperTest.state().lock.locked');
     const before=await evaluate('window.__stalheartSniperTest.state().arrived');
     await click('#sniper-fire');
     await until(`window.__stalheartSniperTest.state().arrived > ${before}`);
     const shot=await evaluate('window.__stalheartSniperTest.state().last');
     assert.equal(shot.key,sentry.key);assert.equal(shot.config.duration,CONTENT.missiles[sentry.key].duration);
     assert(shot.direction[1]>.6,'Missile uses upward authored launch socket');
     await evaluate('window.__stalheartSniperTest.distance(1);window.__stalheartSniperTest.aim()');
     await until('!window.__stalheartSniperTest.state().lock.locked');
     const count=await evaluate('window.__stalheartSniperTest.state().launched');await click('#sniper-fire');
     assert.equal(await evaluate('window.__stalheartSniperTest.state().launched'),count);
     await evaluate('window.__stalheartSniperTest.distance(20)');
   }else {
     const shots=await evaluate('window.__stalheartSniperTest.state().shots');
     await click('#sniper-fire');
     if(['rotor','plasma','lancer'].includes(sentry.key)){
       await until(`window.__stalheartSniperTest.state().shots>${shots}`);
       if(sentry.key==='lancer'){
         const early=await evaluate('window.__stalheartSniperTest.state()');
         assert.equal(early.recoil,0);assert.equal(early.cameraHeight,early.opticHeight);
         assert(Math.abs(early.beam.screen[0])<.001&&Math.abs(early.beam.screen[1])<.001,'Lancer starts at scope centre');
         assert(await evaluate(`!!document.querySelector('#sniper-reticle [data-reticle="lancer"]')`));
         current='sniper-lancer-start';await finish();
         await evaluate('window.__stalheartSniperTest.pan(.18,.07)');await delay(150);
         const moved=await evaluate('window.__stalheartSniperTest.state()');
         assert(Math.abs(moved.beam.screen[0])<.001&&Math.abs(moved.beam.screen[1])<.001,'Beam follows the moving scope');current='sniper-lancer-pan';await finish();
         await evaluate('window.__stalheartSniperTest.aim()');
       }
       await delay(2200);
       const running=await evaluate('window.__stalheartSniperTest.state()');
       assert(running.audioVoices>0,'Firing has a live audio voice');
       if(sentry.key==='rotor'){assert(running.shots-shots>=20);assert(running.cues.includes('minigun_ready'));}
       else {assert(running.beam && running.beam.key===sentry.key,'Beam remains continuous after two seconds');assert(running.voiceDetails.some(v=>v.loop&&v.duration>1),'Continuous sustain buffer is used');}
       if(sentry.key==='lancer'){assert.equal(running.shots-shots,1,'One sustained Lancer beam');assert(Math.abs(running.beam.screen[0])<.001&&Math.abs(running.beam.screen[1])<.001,'Lancer stays centred');}
       await until('window.__stalheartSniperTest.state().sequence.left===0 && !window.__stalheartSniperTest.state().beam');
       if(sentry.key==='rotor')assert((await evaluate('window.__stalheartSniperTest.state().cues')).filter(c=>c==='minigun_ready').length>=2);
     }else assert.equal(await evaluate('window.__stalheartSniperTest.state().shots'),shots+(sentry.key==='relay'?0:1));
     if(sentry.key==='relay')assert(await evaluate('window.__stalheartSniperTest.state().targets.some(t=>t.slowUntil>window.__stalheartSniperTest.state().time)'));
   }
   current='sniper-'+sentry.key;await finish();
 }
 await evaluate('window.__stalheartSniperTest.select("needle")');await until('window.__stalheartSniperTest.state().ready');
 await evaluate('window.__stalheartSniperTest.distance(70);window.__stalheartSniperTest.aim();window.__stalheartSniperTest.fire()');
 await until('window.__stalheartSniperTest.state().traceGuides.length===1');
 const trace=await evaluate('window.__stalheartSniperTest.state().traceGuides[0]');
 assert(trace.samples>2&&trace.end[2]>=69&&trace.end[2]<=81,'Needle retains its actual long-range path');
 current='sniper-needle-trace';await finish();
 await evaluate('window.__stalheartSniperTest.tracer(false)');await delay(80);
 assert.equal(await evaluate('window.__stalheartSniperTest.state().traceGuides[0].visible'),false);
 await evaluate('window.__stalheartSniperTest.tracer(true)');
 await until('window.__stalheartSniperTest.state().traceGuides.length===0');
 await evaluate('window.__stalheartSniperTest.reset();window.__stalheartSniperTest.distance(20)');
 await evaluate('window.__stalheartSniperTest.select("quiver")');await until('window.__stalheartSniperTest.state().ready');
 await evaluate('window.__stalheartSniperTest.aim()');await until('window.__stalheartSniperTest.state().lock.locked');
 await click('#sniper-fire');
 const resetState=await evaluate('window.__stalheartSniperTest.reset();window.__stalheartSniperTest.state()');
 assert.equal(resetState.pool.active,0);assert.equal(resetState.lock.id,null);
 current='sniper-reset';await finish();
 await evaluate('window.__stalheartSniperTest.distance(500);window.__stalheartSniperTest.aim()');
 await until('window.__stalheartSniperTest.state().lock.locked');
 const farBefore=await evaluate('window.__stalheartSniperTest.state().arrived');await click('#sniper-fire');
 await until(`window.__stalheartSniperTest.state().arrived>${farBefore}`,15000);current='sniper-javelin-range';await finish();
 await evaluate('window.__stalheartSniperTest.distance(20);window.__stalheartSniperTest.select("mortar")');
 await until('window.__stalheartSniperTest.state().ready');
 assert(await evaluate('!!document.querySelector("#sniper-mortar-map")?.getBoundingClientRect().width'),'Mortar map survives range resets');
 assert(await evaluate('window.__stalheartSniperTest.state().mortar.monochrome'));
 assert(await evaluate('document.querySelector("#sniper-mortar-map").getBoundingClientRect().bottom<innerHeight*.4'),'Mortar map leaves the central POV clear');
 await until('document.querySelector("[data-telemetry]").textContent.includes("GROUND")');
 await evaluate('window.__stalheartSniperTest.mortarAim([4,0,20])');await click('#sniper-fire');
 await evaluate('window.__stalheartSniperTest.mortarAim([-4,0,15])');
 await until('window.__stalheartSniperTest.state().mortar.impacts.length>0',60000);
 const landing=await evaluate('window.__stalheartSniperTest.state().mortar.impacts[0]');assert(landing.radius>0);assert(Math.abs(landing.point[0]-4)<3);assert.deepEqual(landing.aim,[4,0,20],'Impact error retains launch-time aim');
 assert(await evaluate('window.__stalheartSniperTest.state().worldSplashes>0'),'Impact leaves a splash ring in the main world');
 current='sniper-mortar-landing';await finish();
 await go('sniper-mortar-long-range','labs.html?sw=0&acceptance=1&weapon=mortar&rangeScale=5&quiverTalon=0&wind=0&swaySlow=0&swayFast=0#sniper');
 await until('window.__stalheartSniperTest?.state().ready');
 assert.equal(await evaluate('window.__stalheartSniperTest.state().weaponMaxRange'),175);
 await evaluate('window.__stalheartSniperTest.mortarAim([0,0,149])');await click('#sniper-fire');
 await until('window.__stalheartSniperTest.state().mortar.impacts.length>0',60000);
 assert(await evaluate('Math.abs(window.__stalheartSniperTest.state().mortar.impacts[0].point[2]-149)<3'),'Manual 5× mortar reaches distant ground target');await finish();
 await go('sniper-import-fixture','labs.html?sw=0&acceptance=1&weapon=quiver&rangeScale=1&range=20&phase=calibrate&quiverTalon=0#sniper');await until('window.__stalheartSniperTest?.state().ready');

 const draft=clone(CONTENT);draft.id='sniper-browser';draft.missiles.quiver.duration=1.7;
 draft.missiles.quiver.length=.51;draft.weapons.quiver.impact.size=1.13;
 const file=join(output,'sniper-browser.json');writeFileSync(file,serializePreset(draft));
 const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-preset-import]'});
 await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});
 await until('document.querySelector("[data-preset-id]").value==="sniper-browser"');
 assert.equal(await evaluate('window.__stalheartSniperTest.state().profile.impact.size'),1.13);
 await click('[data-preset-preview]');
 await until('window.__stalheartReady && window.__stalheartSniperTest?.state().ready && window.__stalheartContent?.id==="sniper-browser"');
 assert.equal(await evaluate('window.__stalheartSniperTest.state().weapon'),'quiver');
 await evaluate('window.__stalheartSniperTest.aim()');await until('window.__stalheartSniperTest.state().lock.locked');
 await click('#sniper-fire');await until('window.__stalheartSniperTest.state().arrived>0');
 assert.equal(await evaluate('window.__stalheartSniperTest.state().last.config.duration'),1.7);
 assert.equal(await evaluate('window.__stalheartSniperTest.state().last.config.length'),.51);
 current='sniper-draft';await finish();
 await evaluate('window.__stalheartSniperTest.dispose()');
 const stopped=await evaluate('window.__stalheartSniperTest.state().time');await delay(120);
 assert.equal(await evaluate('window.__stalheartSniperTest.state().time'),stopped);
 assert.equal(await evaluate('window.__stalheartSniperTest.state().pool.active'),0);
 await evaluate('window.__stalheartSniperTest.dispose()');
 await go('sniper-default-isolation','labs.html?sw=0&acceptance=1&weapon=quiver#sniper');
 await until('window.__stalheartSniperTest?.state().ready');
 assert.equal(await evaluate('window.__stalheartSniperTest.state().missiles.quiver.duration'),CONTENT.missiles.quiver.duration);
 await finish();

 } else if(args.includes('--shield-perf')) {
 await go('shield-relay','index.html?sw=0&tutorial=0&cine=0&fps=1&creature=mork&acceptance=1#td');
 await evaluate('document.querySelector(".msg-begin")?.click();window.__stalheartTest.begin()');
 await until('window.__stalheartTest.state().performance?.groups.length > 0 && !window.__stalheartTest.state().deploying');
 assert(await evaluate('document.querySelector("#td-perf").textContent.includes("workload")'));
 const id=await evaluate('window.__stalheartTest.shieldScenario()');assert(id);
 const motion=await evaluate('window.__stalheartTest.state().motionClock');
 await evaluate('window.__stalheartTest.shieldAdvance(8)');
 let st=await evaluate('window.__stalheartTest.state()');
 assert(Math.abs(st.shield.seconds-4)<1e-6);assert.equal(st.shield.drops,0);assert.equal(st.shield.rack,2);assert.equal(st.shield.visible,true);
 assert.equal(st.motionClock,motion);assert(await evaluate(`window.__stalheartTest.relayOffline(${id})`));
 await evaluate('window.__stalheartTest.leaveRelay();window.__stalheartTest.shieldAdvance(4.1)');
 st=await evaluate('window.__stalheartTest.state()');assert.equal(st.shield.drops,1);assert.equal(st.shield.visible,false);
 assert.equal(await evaluate('window.__stalheartTest.deployShield()'),'cooling');
 await evaluate('window.__stalheartTest.shieldAdvance(2.1)');
 assert.equal(await evaluate('window.__stalheartTest.deployShield()'),'ok');
 assert.equal(await evaluate('window.__stalheartTest.state().shield.rack'),1);
 assert.equal(await evaluate(`window.__stalheartTest.relayOffline(${id})`),false);
 await finish();
 await click('#td-perf summary');await delay(650);
 assert(await evaluate('document.querySelector("#td-perf details").open'));
 await until('document.querySelector("#td-perf").textContent.includes("4. Relay")');
 await send('Browser.grantPermissions',{origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
 await click('[data-copy-perf]');
 assert((await evaluate('navigator.clipboard.readText()')).includes('Scene estimates before culling'));
 assert(await evaluate('window.__stalheart.diagnostics().events.some(e=>e.type==="performance.sample")'));
 current='performance-workload';await finish();
 } else if(args.includes('--missile-parity')) {
 for(const family of ['quiver','heptapod']){
   await go('missile-parity-'+family,'index.html?sw=0&acceptance=1&cine=0#td');
   await until('window.__stalheartTest?.state().missileReady');
   await until(`window.__stalheartTest.missileScenario(${JSON.stringify(family)})`);
   await delay(1000);
   await evaluate('window.__stalheartTest.missileTargets([1,20]);window.__stalheartTest.missileAdvance(1/60)');
   let state=await evaluate('window.__stalheartTest.state()');
   assert.equal(state.engagement[0].target,-902,'Skip too-close target');
   assert.equal(state.engagement[0].config.lockTime,CONTENT.missiles[family].lockTime);
   await evaluate('window.__stalheartTest.missileAdvance(10)');
   state=await evaluate('window.__stalheartTest.state()');
   assert(state.seekerHits>0,'Actual combat loop launches and lands missiles');
   await evaluate('window.__stalheartTest.missileTargets([1,1]);window.__stalheartTest.missileAdvance(1/60)');
   state=await evaluate('window.__stalheartTest.state()');
   assert.equal(state.engagement[0].target,null);assert.equal(state.engagement[0].lock.locked,false);
   const before=state.engagement[0];await evaluate('window.__stalheartTest.missileAdvance(0)');
   assert.deepEqual((await evaluate('window.__stalheartTest.state()')).engagement[0],before);
   await evaluate('window.__stalheartTest.restart()');
   await until('window.__stalheartTest.state().missiles.length===0');
   assert.equal((await evaluate('window.__stalheartTest.state()')).missilePool.active,0);
   await finish();
 }
 } else if(authoringWorkspace) {
 await go('local-authoring','labs.html?sw=0&acceptance=1&mode=armour&family=quiver#sentry');
 await until('document.querySelector("[data-authoring-review]")?.hidden === false && document.querySelector("#tab-sentry").dataset.modelReady === "true"');
 const originalSource=readFileSync(join(authoringWorkspace,'src/content/shipped.js'),'utf8');
 const edited=clone(CONTENT);edited.id='local-test';edited.missiles.quiver.length=.48;edited.missiles.quiver.minRange=9;edited.missiles.quiver.maxRange=40;edited.weapons.lancer.impact.size=2.5;
 const fixture=join(output,'local-authoring-draft.json');writeFileSync(fixture,serializePreset(edited));
 const documentNode=await send('DOM.getDocument');
 const fileNode=await send('DOM.querySelector',{nodeId:documentNode.root.nodeId,selector:'[data-preset-import]'});
 await send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[fixture]});
 await until('document.querySelector("[data-preset-id]").value === "local-test"');
 await evaluate(`(()=>{const input=document.querySelector('[data-help-key="lockTime"]').closest('.controller').querySelector('input');input.value=.7;input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.quiver.lockTime'),.7);
 assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.heptapod.lockTime'),CONTENT.missiles.heptapod.lockTime);

 await evaluate('window.__saveStorage=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.includes("fx-draft"))throw Error("quota test");return window.__saveStorage.call(this,key,value);}');
 await click('[data-preset-save]');
 await until('document.querySelector(".preset-panel output").textContent.startsWith("Working copy saved in the project")');
 await evaluate('Storage.prototype.setItem=window.__saveStorage;delete window.__saveStorage');
 assert.equal(JSON.parse(readFileSync(join(authoringWorkspace,'artifacts/authoring/drafts/sentry-quiver.stalheart-fx.json'),'utf8')).missiles.quiver.length,.48);
 await click('[data-authoring-review]');
 await until('document.querySelector(".authoring-review").open');
 assert.equal(await evaluate('document.querySelectorAll(".authoring-review tr").length'),5);
 assert(await evaluate('document.querySelector("[data-authoring-diff]").textContent.includes("0.48")'));
 assert.equal(readFileSync(join(authoringWorkspace,'src/content/shipped.js'),'utf8'),originalSource);
 await click('[data-authoring-apply]');
 await until('document.querySelector(".preset-panel output").textContent.includes("Checks and build passed")',120000);
 const shipped=await evaluate('fetch("./__authoring/state").then(r=>r.json())');
 assert.equal(shipped.preset.missiles.quiver.length,.48);
 assert.equal(shipped.preset.weapons.lancer.impact.size,CONTENT.weapons.lancer.impact.size);
 assert.equal(await evaluate('window.__stalheartSentryTest.state().weapons.lancer.impact.size'),2.5,'Unrelated working edits survive applying Quiver');
 await finish();
 await go('local-applied-game','index.html?sw=0&acceptance=1&cine=0#td');
 await until('window.__stalheartTest?.state().missileReady');
 await until('window.__stalheartTest.missileScenario("quiver")');
 const applied=await evaluate('window.__stalheartTest.state().engagement[0].config');
 assert.equal(applied.minRange,9);assert.equal(applied.maxRange,40);assert.equal(applied.lockTime,.7);
 await evaluate('window.__stalheartTest.missileTargets([5,35]);window.__stalheartTest.missileAdvance(1/60)');
 assert.equal(await evaluate('window.__stalheartTest.state().engagement[0].target'),-902);
 await finish();
 await go('local-applied-reload','labs.html?sw=0&acceptance=1&family=quiver#sentry');
 await until('window.__stalheartSentryTest?.state().missiles.quiver.length === 0.48');
 await until('!document.querySelector("[data-authoring-undo]").hidden');
 await click('[data-authoring-undo]');
 await until('document.querySelector(".authoring-review").open');
 await click('[data-authoring-apply]');
 await until('document.querySelector(".preset-panel output").textContent.includes("defaults restored")',120000);
 assert.equal(readFileSync(join(authoringWorkspace,'src/content/shipped.js'),'utf8'),originalSource);
 await click('[data-preset-load]');
 await until('document.querySelector(".preset-panel output").textContent === "Project working copy loaded."');
 assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.quiver.length'),.48);
 await finish();

 } else {
 if(!args.includes('--authoring')) {
 await go('cold-open','index.html?sw=0&acceptance=1#td');
 await until("document.getElementById('td-intro') && !document.getElementById('td-intro').classList.contains('hidden')",20000);
 await click('#td-intro');await until('window.__stalheartTest.state().paused === false');
 await until('window.__stalheartTest.state().towers >= 2',20000);await finish();
 assert(!requests.some(r=>/\/(?:sentry|impact|grid|units|beam)-tab\.js/.test(r.url)),'Game downloaded a lab');
 // Exercise a zero-cash victory and the actual next-sector button.
 current='sector-solvency';errors.length=0;
 await evaluate('window.__stalheartTest.clearSector()');
 assert.equal(await evaluate('window.__stalheartTest.state().biomass'),250);
 assert.equal(await evaluate('document.querySelector(".msg-next").disabled'),false);
 assert.equal(await evaluate('document.querySelector(".msg-buystrike").disabled'),true);
 await click('.msg-next');await until('window.__stalheartTest.state().round === 2');await finish();
 const generation=await evaluate('window.__stalheartTest.state().runGen');
 await evaluate('window.__stalheartTest.restart()');await until(`window.__stalheartTest.state().runGen > ${generation}`);assert.equal(await evaluate('window.__stalheartTest.state().round'),1);
 for(const roster of [2]){
  await go(`sim-roster-${roster}`,`index.html?sw=0&sim=style1&seed=1000&simfast=50&simcap=180&roster=${roster}#td`,844,390);
  await until('!!window.__stalheartSimResult',30000);
  const result=await evaluate('window.__stalheartSimResult');assert.equal(result.schema,2);assert.equal(result.roster,roster);assert.equal(result.outcome,'loss');
  writeFileSync(join(output,`sim-${roster}.json`),JSON.stringify(result,null,2));await finish();
 }
 await go('numbered-radial','index.html?sw=0&cine=0&acceptance=1&roster=2#td',844,390);
 assert(await evaluate('window.__stalheartTest.openBuildMenu()'));
 assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("#td-shop .shop-buy"),b=>b.innerText.split("\\n")[0])'),SENTRIES.map(s=>s.label));
 await finish();
 await go('mobile-input','index.html?sw=0&cine=0&mobile=1&coarse=1&keyprobe=1&layout=1#td',844,390);
 const start=Date.now();while(!consoleLines.some(x=>x.includes('S drives, T shields'))&&Date.now()-start<12000)await delay(200);
 assert(consoleLines.some(x=>x.includes('S drives, T shields')));await finish();
 for(const mission of ['rescue','rescue2']){
  await go(mission,`index.html?sw=0&cine=0&mission=${mission}&acceptance=1#td`,844,390);await delay(1500);assert(await evaluate('!!window.__stalheartTest.state().mission'));await finish();
 }
 for(const hack of ['hdt','bridges','shikaku']){
  await go('hack-'+hack,`index.html?sw=0&cine=0&hack=${hack}#td`,844,390);await delay(2500);
  assert(requests.some(r=>r.url.includes('/minigames/')));await finish();
 }
 await go('terraformer','index.html?sw=0&cine=0&terraformer=a6&acceptance=1#td');
 await until('window.__stalheartTest.state().heartAsset === "sentry-terraformer"',30000);
 // Each spare hull must deploy onto open ground and respond to real input.
 for (const hull of [2,1,0]) {
  await evaluate(`window.__stalheartTest.deployHull(${hull})`);
  await until('!window.__stalheartTest.state().deploying');
  const before = await evaluate('window.__stalheartTest.state()');
  assert.equal(before.camp.length,3);assert(before.camp.every(b=>b.open));
  assert.equal(before.playerBlocked,false,`Hull ${hull+1} deployed into collision`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  await delay(750);
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
  const after=await evaluate('window.__stalheartTest.state()');
  const moved=Math.hypot(...after.playerPosition.map((v,i)=>v-before.playerPosition[i]));
  assert(moved>.01,`Hull ${hull+1} stuck after handover: ${moved}`);
  consoleLines.push(`CAMP_DRIVE hull=${hull+1} moved=${moved} clearance=${before.camp[hull].clearance}`);
 }
 await evaluate('window.__stalheartTest.focusHeart()');await delay(1500);await finish();
 for(const [hp,state] of [[.6,1],[.2,2],[0,3]]){
  await evaluate(`window.__stalheartTest.heartHealth(${hp})`);await until(`window.__stalheartTest.state().heartAssetState === ${state}`,30000);
 }
 assert(consoleLines.filter(l=>l.includes('SENTRY_TERRAFORMER')).length>=4);
 assert.deepEqual(errors,[], 'Terraformer damage transitions');
 writeFileSync(join(output,'terraformer-states.log'),consoleLines.join('\n'));
 await go('game-dart','index.html?sw=0&cine=0&creature=mork&terraformer=a6&acceptance=1#td');
 await until('window.__stalheartTest.state().missileReady && window.__stalheartTest.state().playerAssetReady && window.__stalheartTest.state().heartAsset === "sentry-terraformer"');
 await evaluate('window.__stalheartTest.begin()');
 for(const key of ['quiver','heptapod']){
  await until(`window.__stalheartTest.fireMissile(${JSON.stringify(key)})`);
  const shot=await evaluate(`window.__stalheartTest.state().missiles.find(m=>m.key===${JSON.stringify(key)})`);
  assert.equal(shot.name,'MISSILE_MOTION');assert.deepEqual(shot.config,CONTENT.missiles[key]);
 }
 await until('window.__stalheartTest.state().missiles.some(m=>m.ignition)');
 await finish();
 await evaluate('window.__stalheartTest.restart()');
 assert.equal(await evaluate('window.__stalheartTest.state().missilePool.active'),0);
 for(const key of ['quiver','heptapod']){
  await go('units-dart-'+key,`labs.html?sw=0&unit=${key}&acceptance=1#units`);
  await until('window.__stalheartUnits.state().missileReady && window.__stalheartUnits.state().modelReady');
  await evaluate('window.__stalheartUnits.fire()');
  await until('window.__stalheartUnits.state().missiles.some(m=>m.ignition)');
  const shot=await evaluate('window.__stalheartUnits.state().missiles[0]');
  assert.equal(shot.name,'MISSILE_MOTION');assert.deepEqual(shot.config,CONTENT.missiles[key]);
  await finish();
  await click('#units-next');assert.equal(await evaluate('window.__stalheartUnits.state().missiles.length'),0);
 }
 await go('mork-game','index.html?sw=0&cine=0&tutorial=0&acceptance=1#td');
 await until('window.__stalheartTest.state().playerAsset === "mork" && window.__stalheartTest.state().playerAssetReady');
 await until('window.__stalheartTest.state().berthAssets.length===3');assert.deepEqual(await evaluate('window.__stalheartTest.state().berthAssets'),['mork','mork','mork']);
 // the release copy is meshopt-packed, which drops degenerate triangles: the batches must match exactly, the triangle count within 1 %
 {const ms=await evaluate('window.__stalheartTest.state().playerModelStats');assert.equal(ms.batches,50);if(production)assert(ms.triangles<=24196&&ms.triangles>=24196*0.99,`packed MÖRK triangles ${ms.triangles}`);else assert.equal(ms.triangles,24196);
  const span=await evaluate('window.__stalheartTest.state().playerSpan');assert(span>1&&span<4,`the hull's size over its scale is sane (${span}); a packed model whose integer attributes were transformed raw reads absurd here`);}
 await evaluate('document.querySelector(".msg-begin")?.click()');
 await evaluate('window.__stalheartTest.begin()');
 const morkBefore=await evaluate('window.__stalheartTest.state().playerPosition');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 await delay(800);
 await send('Input.dispatchKeyEvent',{type:'keyUp',key:'w',code:'KeyW',windowsVirtualKeyCode:87});
 assert.notDeepEqual(await evaluate('window.__stalheartTest.state().playerPosition'),morkBefore);
 await evaluate('window.__stalheartTest.begin()');
 const ammoBefore=await evaluate('window.__stalheartTest.state().ammo');
 await evaluate('window.__stalheartTest.fireShell()');
 await until('window.__stalheartTest.state().cannonHeat > 2 && window.__stalheartTest.state().cannonColor !== 0x232833');
 assert.equal(await evaluate('window.__stalheartTest.state().ammo'),ammoBefore-1);
 await evaluate('window.__stalheartTest.fireShell()');
 assert.equal(await evaluate('window.__stalheartTest.state().ammo'),ammoBefore-1);
 await finish();
 await until('window.__stalheartTest.state().cannonHeat === 0');
 assert.equal(await evaluate('window.__stalheartTest.state().cannonColor'),0x232833);
 await evaluate('window.__stalheartTest.fireShell()');
 assert.equal(await evaluate('window.__stalheartTest.state().ammo'),ammoBefore-2);
 current='debrief-records';
 await evaluate('window.__stalheartTest.showRecordTest()');
 assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".dbf-record--rainbow b"),e=>e.textContent)'),['1001','1200']);
 assert.deepEqual(await evaluate('Array.from(document.querySelectorAll(".dbf-record:not(.dbf-record--rainbow) b"),e=>getComputedStyle(e).color)'),['rgb(159, 220, 255)','rgb(159, 220, 255)']);
 assert(await evaluate('Array.from(document.querySelectorAll(".dbf-record--rainbow b")).every(e=>getComputedStyle(e).backgroundImage.includes("linear-gradient"))'));
 await finish();
 await go('mork-workshop' ,'labs.html?sw=0&acceptance=1#units');
 await until('window.__stalheartUnits?.state().asset === "mork"');
 assert.equal(await evaluate('window.__stalheartUnits.state().guns'),2);
 assert(await evaluate('document.querySelector("#units-note").textContent.includes("50 batches")'));
 await click('#units-engine');
 await until('window.__stalheartUnits.state().hover > 0.5');
 await evaluate('window.__stalheartUnits.fire()');
 await until('window.__stalheartUnits.state().recoil < -0.4',3000);
 assert(await evaluate('window.__stalheartUnits.state().cannonColor !== 0x232833'));
 current='mork-heat';await finish();
 current='mork-workshop';
 await delay(1500);
 assert(await evaluate('Math.abs(window.__stalheartUnits.state().recoil) < 0.01'));
 await finish();
 await click('#units-engine');
 await until('Math.abs(window.__stalheartUnits.state().hover) < 0.01');
 await click('#units-next');await click('#units-prev');
 await until('window.__stalheartUnits?.state().asset === "mork"');
 await finish();
 await go('mork-beam','labs.html?sw=0&acceptance=1#beam');
 await until('window.__stalheartBeamTest?.state().asset==="mork"');
 assert.equal(await evaluate('window.__stalheartBeamTest.state().guns'),2);assert.equal(await evaluate('window.__stalheartBeamTest.state().pivots'),2);assert.deepEqual(await evaluate('window.__stalheartBeamTest.state().muzzleOffsets'),[0,0]);await finish();
 for(const name of ['units','sentry','sniper','sim']){await go('lab-'+name,`labs.html?sw=0#${name}`);await delay(1500);await finish();}
 }
 // One shooter/flight/effect pipeline for material targets and moving enemies.
 for (const [mode, family, duration] of [['wall','quiver',1.35],['armour','heptapod',2.7],['hull','quiver',1.35]]) {
  await go('combined-'+mode,`labs.html?sw=0&acceptance=1&mode=${mode}&family=${family}&count=1&lockTime=0.1&surfaceAngle=35#sentry`);
  await until('window.__stalheartSentryTest?.state().arrived > 0',30000);
  const state=await evaluate('window.__stalheartSentryTest.state()');
  assert.equal(state.last.duration,duration); assert.equal(state.effects.last.mode,mode);
  assert(state.effects.last.normal[2]<0 && state.effects.last.normal[0]<0);
  assert.equal(state.targets.length,1);
  const contact=await evaluate('window.__stalheartSentryTest.surfacePoint()');
  assert(contact.x>0 && contact.x<1190 && contact.y>0 && contact.y<700 && Math.abs(contact.z)<1,'Surface contact must be visible clear of the panels');
  assert(Math.hypot(...state.effects.last.point.map((v,i)=>v-state.targets[0].pos[i])) < 1e-6);
  // Edit the actual control, then prove the effect at arrival used that preset.
  await evaluate('(()=>{const title=Array.from(document.querySelectorAll("#tab-sentry .title")).find(t=>t.textContent==="muzzle / impact");title.click();const i=document.querySelector("[data-help-key=effectSize]").closest(".controller").querySelector("input");i.value="0.65";i.dispatchEvent(new Event("input",{bubbles:true}));i.dispatchEvent(new Event("change",{bubbles:true}));})()');
  await until('window.__stalheartSentryTest.state().effects.last.size === 0.65',15000);
  await click('[data-preset-save]');
  const stored=await evaluate('JSON.parse(localStorage.getItem("stalheart:v1:ssg.fx-draft.v1"))');
  assert.equal(stored.weapons[family].impact.size,.65);assert.equal(stored.missiles[family].duration,duration);
  await finish();
 }
 await go('impact-alias','labs.html?sw=0&sentry=quiver&preset=draft#impact',1440,900,'labs.html?sw=0&sentry=quiver&preset=draft&mode=armour&family=quiver#sentry');
 await until('document.querySelector("#tab-sentry").dataset.modelReady === "true"');
 assert(!requests.some(r=>r.url.includes('/impact-tab.js')));
 assert.equal(await evaluate('document.querySelectorAll("[data-preset-save]").length'),1);
 await finish();
 // Click an actual tower, select the whole battery, then observe real launches.
 await go('sentry-radial','labs.html?sw=0&acceptance=1&count=3&lockTime=0.1&walkSpeed=0.1&hp=10#sentry');
 await until('window.__stalheartSentryTest?.state().pool && document.querySelector("#tab-sentry").dataset.modelReady === "true"');
 // Every variable/action has help, including disabled missile settings.
 assert.equal(await evaluate('document.querySelectorAll("#tab-sentry .controller").length'),await evaluate('document.querySelectorAll("#tab-sentry [data-help-key]").length'));
 await evaluate('document.querySelector("[data-help-key=reachRadius]").scrollIntoView({block:"center"})');
 await delay(300);
 const helpPoint=await evaluate('(()=>{const r=document.querySelector("[data-help-key=reachRadius]").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...helpPoint});
 await until('!document.querySelector(".lab-control-help").hidden');
 assert((await evaluate('document.querySelector(".lab-control-help p").textContent')).includes('center of the battery'));
 const bubblePoint=await evaluate('(()=>{const r=document.querySelector(".lab-control-help").getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...bubblePoint});await delay(250);
 assert.equal(await evaluate('document.querySelector(".lab-control-help").hidden'),false);
 current='sentry-control-help';await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 assert.equal(await evaluate('document.querySelector(".lab-control-help").hidden'),true);
 await evaluate('Array.from(document.querySelectorAll("#tab-sentry .lil-gui > .title")).find(e=>e.textContent==="missiles / lock").click()');
 await evaluate('document.querySelector("[data-help-key=lockBreak]").scrollIntoView({block:"center"})');await delay(300);
 await evaluate('document.querySelector("[data-help-key=lockBreak]").focus()');
 assert((await evaluate('document.querySelector(".lab-control-help p").textContent')).includes('not a rocket already in flight'));
 await evaluate('document.querySelector("[data-help-key=profile]").scrollIntoView({block:"center"})');await delay(300);
 await click('[data-help-key=profile]');
 assert((await evaluate('document.querySelector(".lab-control-help p").textContent')).includes('Quiver and Heptapod only'));
 // Reading a boolean label must not toggle its checkbox.
 const wasLive=await evaluate('document.querySelector("[data-help-key=live]").closest(".controller").querySelector("input").checked');
 await evaluate('document.querySelector("[data-help-key=live]").scrollIntoView({block:"center"})');await delay(300);
 await click('[data-help-key=live]');
 assert.equal(await evaluate('document.querySelector("[data-help-key=live]").closest(".controller").querySelector("input").checked'),wasLive);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:500,y:100,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:500,y:100,button:'left',clickCount:1});
 assert.equal(await evaluate('document.querySelector(".lab-control-help").hidden'),true);
 current='sentry-radial';
 const point=await evaluate('window.__stalheartSentryTest.towerPoint()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
 await until('document.querySelector(".sentry-radial").open');
 assert.deepEqual(await evaluate('Array.from(document.querySelectorAll("[data-sentry-choice]"),b=>b.textContent)'),SENTRIES.map(s=>s.label));
 await finish();
 await click('[data-sentry-choice="quiver"]');
 await until('window.__stalheartSentryTest.state().last?.family === "quiver"');
 let missile=await evaluate('window.__stalheartSentryTest.state()');
 assert.deepEqual(missile.battery,['quiver','quiver','quiver']);
 assert.equal(missile.last.duration,1.35);assert.equal(missile.last.profile,'swift');assert.equal(missile.last.length,.32);
 assert(missile.last.launchDirection[1]>.6,'Quiver muzzle actually aims upward');
 if(production)assert(missile.pool.triangles<=188&&missile.pool.triangles>=188*0.97,`packed DART triangles ${missile.pool.triangles}`);else assert.equal(missile.pool.triangles,188);assert.equal(missile.pool.batches,4);   // the packed release drops degenerate triangles
 await until('window.__stalheartSentryTest.state().live.some(m=>m.u<.32 && !m.ignition) && window.__stalheartSentryTest.state().live.some(m=>m.u>.32 && m.ignition)');
 await until('window.__stalheartSentryTest.state().arrived >= 3');
 const arrival=await evaluate('window.__stalheartSentryTest.state().lastArrival');
 assert.equal(arrival.duration,1.35);assert.equal(arrival.ignition,false);assert(arrival.error<1e-9);
 current='quiver-swift';await finish();
 // A drag is an orbit gesture, not a tower selection.
 const dragPoint=await evaluate('window.__stalheartSentryTest.towerPoint()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...dragPoint,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:dragPoint.x+25,y:dragPoint.y,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:dragPoint.x+25,y:dragPoint.y,button:'left',clickCount:1});
 assert.equal(await evaluate('document.querySelector(".sentry-radial").open'),false);
 await click('#sentry-center');await delay(500);
 const again=await evaluate('window.__stalheartSentryTest.towerPoint()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...again,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...again,button:'left',clickCount:1});
 await until('document.querySelector(".sentry-radial").open');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'8',code:'Digit8',windowsVirtualKeyCode:56,text:'8'});
 await until('window.__stalheartSentryTest.state().last?.family === "heptapod"');
 missile=await evaluate('window.__stalheartSentryTest.state()');
 assert.deepEqual(missile.battery,['heptapod','heptapod','heptapod']);
 assert.equal(missile.last.duration,2.7);assert.equal(missile.last.profile,'hook');assert.equal(missile.last.length,.8);
 assert(missile.last.launchDirection[1]>.6,'Heptapod muzzle actually aims upward');
 assert(missile.pool.allocated<=missile.pool.capacity);
 current='heptapod-hook';await delay(3000);await finish();
 assert.equal(await evaluate('window.__stalheartSentryTest.state().lastArrival.duration'),2.7);
 assert(await evaluate('window.__stalheartSentryTest.state().lastArrival.error < 1e-9'));
 await evaluate('window.__stalheartSentryTest.hold();window.__stalheartSentryTest.reset()');
 assert.equal(await evaluate('window.__stalheartSentryTest.state().pool.active'),0);
 // Complete-package Sentry export/import retains the other labs' data.
 const missileDraft=clone(CONTENT);missileDraft.id='missile-browser';missileDraft.missiles.quiver.length=.4;missileDraft.missiles.quiver.minRange=4;missileDraft.missiles.quiver.maxRange=35;
 const missileFile=join(output,'missile-browser.json');writeFileSync(missileFile,serializePreset(missileDraft));
 const missileDoc=await send('DOM.getDocument');
 const missileInput=await send('DOM.querySelector',{nodeId:missileDoc.root.nodeId,selector:'[data-preset-import]'});
 await send('DOM.setFileInputFiles',{nodeId:missileInput.nodeId,files:[missileFile]});
 await until('document.querySelector("[data-preset-id]").value === "missile-browser"');
 await click('[data-preset-preview]');
 await until('window.__stalheartReady && window.__stalheartContent?.id === "missile-browser" && location.hash === "#sentry"');
 assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.quiver.minRange'),4);
 assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.quiver.maxRange'),35);
 current='missile-draft';await finish();
 await go('sentry-radial-mobile','labs.html?sw=0&acceptance=1&family=quiver&count=3#sentry',390,844);
 await until('document.querySelector("#tab-sentry").dataset.modelReady === "true"');
 const mobileTower=await evaluate('window.__stalheartSentryTest.towerPoint()');
 await send('Input.dispatchMouseEvent',{type:'mousePressed',...mobileTower,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',...mobileTower,button:'left',clickCount:1});
 await until('document.querySelector(".sentry-radial").open');
 assert(await evaluate('(()=>{const r=document.querySelector(".sentry-radial").getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})()'));
 await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
 await until('!document.querySelector(".sentry-radial").open');
 await click('#sentry-gear');
 await evaluate('document.querySelector("[data-help-key=family]").scrollIntoView({block:"center"})');await delay(300);
 await click('[data-help-key=family]');
 assert(await evaluate('(()=>{const e=document.querySelector(".lab-control-help"),r=e.getBoundingClientRect();return !e.hidden && r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})()'));
 current='sentry-help-mobile';await finish();


 // Exercise real target acquisition and live range edits through the GUI.
 await go('missile-ranges','labs.html?sw=0&acceptance=1&family=quiver&count=3&ringMax=18&lockTime=0.1&walkSpeed=0.1&hp=10#sentry');
 const rangeControl=async(key,value)=>evaluate(`(()=>{const input=document.querySelector('[data-help-key="${key}"]').closest('.controller').querySelector('input');input.value=${value};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 for(const family of ['quiver','heptapod']){
  if(family==='heptapod'){
   await evaluate(`(()=>{const s=document.querySelector('#tab-sentry select');s.selectedIndex=7;s.dispatchEvent(new Event('change'));})()`);
   await until('window.__stalheartSentryTest.state().family === "heptapod" && document.querySelector("#tab-sentry").dataset.modelReady === "true"');
   assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.heptapod.minRange'),3);
   assert.equal(await evaluate('window.__stalheartSentryTest.state().missiles.quiver.minRange'),6);
  }
  await until(`window.__stalheartSentryTest.state().last?.family === '${family}'`);
  assert((await evaluate('window.__stalheartSentryTest.state().last.targetDistance'))>12,'Launcher acquires distant targets');
  await rangeControl('maxRange',5);
  await until('window.__stalheartSentryTest.state().tracking.every(t=>t.target===-1 && t.lockId===null && !t.locked && t.meter===0)');
  let count=await evaluate('window.__stalheartSentryTest.state().launched');
  await delay(400);assert.equal(await evaluate('window.__stalheartSentryTest.state().launched'),count,'No firing beyond maximum');
  await rangeControl('maxRange',30);
  await until(`window.__stalheartSentryTest.state().launched > ${count}`);
  await rangeControl('minRange',25);
  await until('window.__stalheartSentryTest.state().tracking.every(t=>t.target===-1 && t.lockId===null && !t.locked && t.meter===0)');
  count=await evaluate('window.__stalheartSentryTest.state().launched');
  const arrivals=await evaluate('window.__stalheartSentryTest.state().arrived');
  await delay(400);assert.equal(await evaluate('window.__stalheartSentryTest.state().launched'),count,'No firing inside minimum');
  await until(`window.__stalheartSentryTest.state().arrived > ${arrivals}`); // Existing rockets still finish.
  await rangeControl('minRange',50);
  assert.equal(await evaluate(`window.__stalheartSentryTest.state().missiles.${family}.minRange`),30);
  await rangeControl('maxRange',10);
  assert.equal(await evaluate(`window.__stalheartSentryTest.state().missiles.${family}.maxRange`),30);
  await rangeControl('minRange',family==='quiver'?6:8);
  await rangeControl('maxRange',family==='quiver'?24:28);
 }
 await evaluate('document.querySelector("[data-preset-id]").value="range-browser"');
 await click('[data-preset-preview]');
 await until('window.__stalheartReady && window.__stalheartContent?.id === "range-browser"');
 const ranges=await evaluate('window.__stalheartSentryTest.state().missiles');
 assert.equal(ranges.quiver.minRange,6);assert.equal(ranges.quiver.maxRange,24);
 assert.equal(ranges.heptapod.minRange,8);assert.equal(ranges.heptapod.maxRange,28);
 await until('document.querySelector("#tab-sentry").dataset.modelReady === "true"');
 await evaluate('Array.from(document.querySelectorAll("#tab-sentry .lil-gui > .title")).find(e=>e.textContent==="missiles / lock").click()');
 await evaluate('document.querySelector("[data-help-key=maxRange]").scrollIntoView({block:"center"})');await delay(300);
 assert.equal(await evaluate('document.querySelector("[data-help-key=minRange]").closest(".controller").querySelector("input").value'),'6');
 assert.equal(await evaluate('document.querySelector("[data-help-key=maxRange]").closest(".controller").querySelector("input").value'),'24');
 await finish();
 // All three visual entry points must resolve the same eight actual GLBs.
 for(const lab of ['units','sentry']) {
  await go('catalog-'+lab,`labs.html?sw=0${lab==='units'?'&unit=rotor':''}#${lab}`);
  for(const [i,s] of SENTRIES.entries()) {
   if(lab==='units') { if(i) await click('#units-next'); }
   else {
    assert.deepEqual(await evaluate(`Array.from(document.querySelector('#tab-${lab} select').options,o=>o.textContent)`),SENTRIES.map(s=>s.label));
    await evaluate(`(()=>{const select=document.querySelector('#tab-${lab} select');select.selectedIndex=${i};select.dispatchEvent(new Event('change'));})()`);
   }
   await until(`!!document.querySelector('[data-sentry="${s.key}"][data-model-ready="true"]')`);
   if(lab==='units') assert.equal(await evaluate('document.querySelector("#units-name").textContent'),s.label);
  }
  if (lab !== 'units') {
   const trigger = `#tab-${lab} select + .lab-choice-trigger`;
   await click(trigger);
   await evaluate(`(()=>{const input=document.querySelector('.lab-choice-dialog input');input.value='quiver';input.dispatchEvent(new Event('input'));})()`);
   assert.equal(await evaluate("document.querySelectorAll('.lab-choice-results button').length"),1);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',code:'ArrowDown'});
   assert.equal(await evaluate('document.activeElement.textContent'),'3. Quiver');
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
   assert.equal(await evaluate(`document.querySelector('#tab-${lab} select').selectedIndex`),2, 'Enter commits the filtered choice');
   await until(`!!document.querySelector('[data-sentry="quiver"][data-model-ready="true"]')`);
   assert.equal(await evaluate("document.querySelector('.lab-choice-dialog').open"),false);
   assert(await evaluate('document.activeElement.classList.contains("lab-choice-trigger")'));
   await click(trigger);
   // Close/reopen in one task so the old queued close event arrives afterward.
   await evaluate(`(()=>{const dialog=document.querySelector('.lab-choice-dialog');dialog.close();document.querySelector('${trigger}').click();})()`);
   await delay(100);
   await evaluate(`(()=>{const input=document.querySelector('.lab-choice-dialog input');input.value='no-such-sentry';input.dispatchEvent(new Event('input'));})()`);
   assert.equal(await evaluate("document.querySelectorAll('.lab-choice-results button').length"),0);
   await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
   await until("!document.querySelector('.lab-choice-dialog').open");
  }
  await finish();
 }
 await go('retired-roster-link','index.html?sw=0&cine=0&roster=1#td',844,390,'index.html?sw=0&cine=0&roster=2#td');
 assert.equal(await evaluate('new URLSearchParams(location.search).get("roster")'),'2');
 await finish();
 // Real file import -> lab working copy -> shared draft -> actual game selection.
 const draft=clone(CONTENT);draft.id='browser-fx';draft.weapons.lancer.impact.size=.93;draft.audio.kinetic_fire.gain=.37;
 const fixture=join(output,'browser-fx.json');writeFileSync(fixture,serializePreset(draft));
 await go('preset-import','labs.html?sw=0#impact',1440,900,'labs.html?sw=0&mode=armour#sentry');
 const doc=await send('DOM.getDocument');
 const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-preset-import]'});
 await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
 await until('document.querySelector("[data-preset-id]").value === "browser-fx"');
 await click('[data-preset-save]');
 // Copy presents only this subject's changed values; JSON remains the backup format.
 await evaluate("(()=>{const s=document.querySelector('#tab-sentry select');s.selectedIndex=5;s.dispatchEvent(new Event('change'));})()");
 await until('document.querySelector("#tab-sentry").dataset.sentry === "lancer"');
 const summary=changeSummary(CONTENT,draft,{kind:'sentry',key:'lancer'});
 await send('Browser.grantPermissions',{origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']});
 await click('[data-preset-copy]');
 await until('document.querySelector(".preset-panel output").textContent.startsWith("Copied changed values")');
 const copied=await evaluate('navigator.clipboard.readText()');
 assert.equal(copied,summary);assert(copied.length<300);
 await send('Browser.resetPermissions');
 await send('Browser.setPermission',{origin,permission:{name:'clipboard-write'},setting:'denied'});
 await click('[data-preset-copy]');
 await until('!document.querySelector("[data-preset-copy-text]").hidden');
 assert.equal(await evaluate('document.querySelector("[data-preset-copy-text]").value'),summary);
 assert(await evaluate('(()=>{const t=document.querySelector("[data-preset-copy-text]");return t.selectionStart===0 && t.selectionEnd===t.value.length;})()'));
 await send('Browser.resetPermissions');
 await finish();
 await go('lab-audio','labs.html?sw=0&acceptance=1#audio');
 // Controls rebuilt after boot use the same adapter and release it on removal.
 await evaluate(`(()=>{const label=document.createElement('label');label.id='choice-probe';label.textContent='Probe ';const select=document.createElement('select');for(let i=0;i<3;i++)select.add(new Option('Choice '+i,String(i)));label.append(select);document.querySelector('#tab-audio').append(label);})()`);
 await until("document.querySelector('#choice-probe .lab-choice-trigger')?.hidden === true");
 await evaluate(`(()=>{const s=document.querySelector('#choice-probe select');for(let i=3;i<10;i++)s.add(new Option('Choice '+i,String(i)));})()`);
 await until("document.querySelector('#choice-probe .lab-choice-trigger')?.hidden === false");
 await evaluate("document.querySelector('#choice-probe select').disabled=true");
 await until("document.querySelector('#choice-probe .lab-choice-trigger').disabled");
 await evaluate("document.querySelector('#choice-probe select').length=3");
 await until("document.querySelector('#choice-probe .lab-choice-trigger').hidden");
 await evaluate("window.__choiceProbe=document.querySelector('#choice-probe');window.__choiceProbe.remove()");
 await until("!window.__choiceProbe.querySelector('.lab-choice-trigger')");
 await evaluate('delete window.__choiceProbe');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
 await click('#audio-cue + .lab-choice-trigger');
 await evaluate(`(()=>{const input=document.querySelector('.lab-choice-dialog input');input.value='tank engine';input.dispatchEvent(new Event('input'));})()`);
 assert.equal(await evaluate("document.querySelectorAll('.lab-choice-results button').length"),1);
 assert(await evaluate("(()=>{const r=document.querySelector('.lab-choice-dialog').getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.bottom<=innerHeight;})()"));
 await finish();
 await click('.lab-choice-results button');
 assert.equal(await evaluate('document.querySelector("#audio-cue").value'),'tank_engine');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await evaluate('(()=>{const s=document.querySelector("#audio-cue");s.value="kinetic_fire";s.dispatchEvent(new Event("change"));})()');
 await click('[data-preset-load]');
 assert.equal(await evaluate('document.querySelector("[data-audio-knob=gain]").value'),'0.37');
 await evaluate('(()=>{const i=document.querySelector("[data-audio-knob=gain]");i.value="0.42";i.dispatchEvent(new Event("change"));})()');
 await click('[data-preset-save]');
 await evaluate('(()=>{const s=document.querySelector("#audio-cue");s.value="tank_engine";s.dispatchEvent(new Event("change"));})()');
 await click('#audio-play');await until('document.querySelector("#audio-status").textContent.startsWith("Playing")',30000);
 assert((await evaluate('window.__stalheartAudioTest.state().context')).startsWith('running'));
 await evaluate('window.__stalheartAudioTest.measure()');await delay(1100);
 assert(consoleLines.some(l=>{const m=l.match(/AUDIO LEVEL peak=([0-9.]+) over (\d+) frames/);return m && Number(m[1])>.0005 && Number(m[2])>=10;}),'Audio signal missing or measurement inconclusive');
 await finish();
 current='preset-preview';consoleLines.length=0;errors.length=0;requests.length=0;
 await click('[data-preset-preview]');
 await until('location.pathname.endsWith("index.html") && window.__stalheartReady === true && window.__stalheartContent?.id === "browser-fx"');
 const selected=await evaluate(`(async()=>{const token=document.querySelector('meta[name=cb]').content;const m=await import('./src/content/runtime.js'+(token==='00000000'?'':'?v='+token));return {gain:m.SOUNDS.kinetic_fire.gain,size:m.SENTRY_FX.lancer.impact.size};})()`);
 assert.equal(selected.gain,.42);assert.equal(selected.size,.93);await finish();
 await go('preset-isolation','index.html?sw=0&cine=0#td');
 assert.equal(await evaluate('window.__stalheartContent.id'),CONTENT.id);await finish();
 // Source asset cache checks run as Node tests; browser exercises installation too.
 if(production){
  await go('pwa','index.html?cine=0#td');await until('navigator.serviceWorker.controller !== null',15000);await finish();
 }
 }
 console.log(`Browser acceptance passed (${production?'release /stalheart/':'source'}). Artifacts: ${output}`);
}catch(err){writeFileSync(join(output,current+'-failure.json'),JSON.stringify({error:String(err),state:await evaluate('window.__stalheartTest?.state()').catch(()=>null),errors,consoleLines,requests},null,2));console.error(err);process.exitCode=1;}
finally{cleanup();}
