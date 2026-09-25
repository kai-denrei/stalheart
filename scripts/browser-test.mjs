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
import { LASER_VIEW, LASER_BURN } from '../src/content/orbital-laser.js';
import { GUNSHIP_TRACK, GUNSHIP_GUNS, GUNSHIP_ORBIT } from '../src/content/gunship.js';
import { scopeRect } from '../src/fx/laser-scope.js';
const args=process.argv.slice(2),production=args.includes('--dist');
const port=+process.env.STALHEART_BROWSER_PORT||18155,base=production?'/stalheart/':'/';
const origin=`http://127.0.0.1:${port}`,urlRoot=origin+base;
const output=resolve('artifacts/browser'+(production?'-dist':''));mkdirSync(output,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),'stalheart-chrome-'));
const authoringWorkspace=args.includes('--local-authoring')?mkdtempSync(join(tmpdir(),'stalheart-authoring-browser-')):null;
if(authoringWorkspace) for(const path of ['src','scripts','test','docs','vendor','assets','icons','index.html','labs.html','settings.html','styles.css','app.css','manifest.webmanifest','favicon.svg','sw.js','ATTRIBUTIONS.md','DEVLOG.md','package.json']) cpSync(resolve(path),join(authoringWorkspace,path),{recursive:true});
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
/* dpr: the page LOADS at this device pixel ratio. The renderer reads devicePixelRatio once, when it is built, so a ratio
   applied after the load never reaches it — a step that needs a Retina surface has to ask for one here, not afterwards. */
async function go(name,path,width=1440,height=900,expectedPath=path,dpr=1){
 current=name;consoleLines.length=0;errors.length=0;requests.length=0;
 await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:false});
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
 if(args.includes('--breach-game')) {
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
 assert.equal(await evaluate('window.__stalheartTest.state().explosions.spawned["strike.orbital"]'),1,'the orbital strike lands as the nuclear cloud');
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.drawCalls'),1);
 await evaluate('new Promise(resolve=>setTimeout(resolve,2200))');
 assert(await evaluate('window.__stalheartTest.state().breachRubble.caps>=1'));
 current='game-breach-rubble';await finish();
 await evaluate('window.__stalheartTest.breachSpent()');
 assert.equal(await evaluate('window.__stalheartTest.state().breaches.length'),0);
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.caps'),sources);
 await evaluate('window.__stalheartTest.restart()');assert.equal((await evaluate('window.__stalheartTest.state().breaches')).length,2);
 assert.equal(await evaluate('window.__stalheartTest.state().breachRubble.caps'),0);current='game-breach-reset';await finish();
 await go('game-breach-look','index.html?sw=0&acceptance=1&cine=0&look=battlezone#td');
 await until('window.__stalheartTest?.state().breaches.length>0');await evaluate('window.__stalheartTest.breachScenario()');
 await until('window.__stalheartTest.state().breaches.length>0&&window.__stalheartTest.state().breaches.every(b=>b.phase==="rumbling")');
 assert.deepEqual([...new Set(await evaluate('window.__stalheartTest.state().breaches.map(b=>b.look)'))],['battlezone'],'game sinkholes follow ?look=battlezone');await finish();
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

 await evaluate('window.__stalheartPortalTest.dispose()');
 } else if(args.includes('--story')) {
 // THE STÅLHEART CANDIDATES IN THE STORY LAB, through the same switch and mapping the game world uses. Checked in both
 // callers because they must agree on which files a review is looking at — that is the point of having one mapping.
 // A far tier only reports once its GLB has loaded, so a candidate that failed to load times out here instead of passing.
 // THE ARRIVAL RECYCLED: stage 2 shows the AFR-01 and the SH02 cut into sections where the intact rocket stood, for the owner's art review
 await go('story-lab-foundry','labs.html?sw=0&acceptance=1&stage=2#story');await until('window.__stalheartStoryTest?.state().ready',90000);await delay(1500);await evaluate('window.__stalheartStoryTest.overview()');await delay(1200);
 {const s=await evaluate('window.__stalheartStoryTest.state()');assert(!(s.base?.errors||[]).length,'the foundry tiers load without error');}
 await finish();
 await go('story-lab-candidate','labs.html?sw=0&acceptance=1&stage=6&landmarks=candidate#story');
 await until('(window.__stalheartStoryTest?.state().base?.lod||[]).some(l=>l.id==="stalheart")',90000);
 {const s=await evaluate('window.__stalheartStoryTest.state()'),st=s.base.lod.find(l=>l.id==='stalheart');
  assert.equal(st.files.far,'assets/models/astro/terraformer_3000_d0_lod2.glb','lab: the candidate distance tier stands first');
  assert.equal(st.files.near,'assets/models/astro/terraformer_3000_d0_lod1.glb','lab: the candidate game tier is what comes near');
  assert.deepEqual(s.base.errors,[],'lab: the candidate tiers load without error');}
 await finish();
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
 const base=await evaluate('window.__stalheartStoryTest.state()');assert.equal(base.stage,8);assert.deepEqual(base.base.errors,[]);assert.equal(base.base.islands,7);assert.equal(base.base.walls,12);assert(base.base.gate);assert.equal(base.base.structures,12,'twelve landmarks at stage 8 in the lab (the foundry and the salvage layout stand where the rocket was; the landing scene owns the rocket; three earlier landings out past the clearing)');
 assert(base.playUrl.includes('story=8'),'play carries the stage');
 await evaluate('window.__stalheartStoryTest.reset()');await delay(300);current='story-stage-8';await finish();
 await evaluate('window.__stalheartStoryTest.overview()');await delay(400);current='story-stage-8-overview';await finish();
 // far tiers: from the overview every landmark with a far tier stands on it and the near tier was never fetched; framed close to the solar island the near tier loads and takes over
 const lodFar=await evaluate('window.__stalheartStoryTest.state().base.lod');assert.equal(lodFar.length,9,'nine landmarks carry a far tier (the foundry and the salvage layout ship distance tiers)');assert(lodFar.every((l)=>l.shown==='far'),'from the overview every landmark shows its far tier');
 await evaluate("window.__stalheartStoryTest.frame({ pos: [0, 12, -30], look: [0, 4, 0], fov: 45 }, { x: 44, z: -60 })");await until('window.__stalheartStoryTest.state().base.lod.find((l)=>l.id==="solar").nearLoaded',60000);await delay(300);
 const lodNear=await evaluate('window.__stalheartStoryTest.state().base.lod');assert.equal(lodNear.find((l)=>l.id==='solar').shown,'near','close to the solar island its near tier shows');assert(lodNear.filter((l)=>!/rocket|wreck/.test(l.id)).every((l)=>l.nearLoaded),'within 150 m of the whole base every landmark near tier has been fetched');assert(lodNear.filter((l)=>/rocket|wreck/.test(l.id)).every((l)=>l.shown==='far'&&!l.nearLoaded),'the earlier landings out past the clearing stay far and unfetched');
 current='story-stage-8-solar-near';await finish();
 await evaluate('window.__stalheartStoryTest.overview()');await delay(300);assert.equal((await evaluate('window.__stalheartStoryTest.state().base.lod')).find((l)=>l.id==='solar').shown,'far','back on the overview the far tier returns');
 await evaluate('window.__stalheartStoryTest.setStage(4)');await evaluate('window.__stalheartStoryTest.baseReady()');await delay(300);
 assert.equal((await evaluate('window.__stalheartStoryTest.state()')).base.gate.present,true,'gate loaded with its clip');
 await evaluate('window.__stalheartStoryTest.gate(true)');await delay(2200);const opened=await evaluate('window.__stalheartStoryTest.state()');assert.equal(opened.base.gate.open,true,'gate opens');
 await evaluate('window.__stalheartStoryTest.gate(false)');await delay(2200);assert.equal((await evaluate('window.__stalheartStoryTest.state()')).base.gate.open,false,'gate closes');
 await evaluate('window.__stalheartStoryTest.setStage(1)');await evaluate('window.__stalheartStoryTest.baseReady()');await delay(300);const s1=await evaluate('window.__stalheartStoryTest.state()');assert.equal(s1.base.islands,0);assert.equal(s1.base.structures,5,'the three earlier landings out past the clearing, and the foundry and salvage layout loaded hidden for the beat');
 // the menu's arrival entry: ?land=1 opens straight on the cinematic
 await go('story-arrival-link','labs.html?sw=0&acceptance=1&land=1#story');await until('window.__stalheartStoryTest?.state().ready',90000);await delay(1200);
 const auto=await evaluate('window.__stalheartStoryTest.state()');assert(auto.playing&&auto.t>0.5,'the cinematic plays on load');assert(await evaluate('!!document.querySelector("#story-hud a.story-back")'),'a way back to the game');
 await evaluate('window.__stalheartStoryTest.dispose()');
 } else if(args.includes('--gunship')) {
 // THE GUNSHIP'S SEAT (docs/superpowers/specs/2026-09-13-heavy-gunship-design.md): refused while the platform is on its way in,
 // taken while it is overhead; the thermal optic and the ground-truth monitor; the pass counting out under the gunner.
 await go('gunship-off-station','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(1500);
 {const s=await evaluate('window.__stalheartTest.state().gunship');assert.equal(s.phase,'pass','the platform starts on its way in');assert(!s.station);
  assert.equal(await evaluate('window.__stalheartTest.mountGunship()'),false,'off station the seat is refused');
  assert(await evaluate('document.querySelector("#story-views [data-mount=gunship]").disabled'),'the button is dark');
  assert(/GUNSHIP · \d+ S$/.test(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent')),'the next pass counts down on the button');}
 await finish();
 await go('gunship-on-station','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&gunship=station#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(1500);
 {assert.equal(await evaluate('window.__stalheartTest.mountGunship()'),false,'the first seat opens the briefing, not the guns');assert(await evaluate('window.__stalheartTest.state().gunship.briefing'),'the briefing is open');assert(await evaluate('window.__stalheartTest.state().paused'),'the game waits under it');
  await delay(1500);current='gunship-briefing';await finish();await evaluate('document.querySelector("#gunship-briefing [data-next]").click()');await delay(300);
  // THE SEAT'S FIRST-USE HITCH (a V1 known gap, ~83-117 ms the first time the seat is taken): long tasks and the longest rAF gap over
  // the 2.5 s from the call, against 2.5 s of baseline just before; the same watch runs again on a second seat later in the pass
  const seatWatch=call=>evaluate(`new Promise(resolve=>{const long=[];const po=new PerformanceObserver(l=>{for(const e of l.getEntries())long.push([+e.duration.toFixed(1),Math.round(e.startTime-t0)]);});po.observe({type:'longtask'});let callMs=0,last=0,max=0,maxAt=0,frames=0,t0=0;const gaps=[];const tick=()=>{const now=performance.now();gaps.push(+(now-last).toFixed(1));if(now-last>max){max=now-last;maxAt=Math.round(now-t0);}last=now;frames++;if(now-t0<2500)requestAnimationFrame(tick);else setTimeout(()=>{po.disconnect();resolve({long,maxFrame:+max.toFixed(1),maxAt,frames,callMs,over50:gaps.filter(g=>g>50).length});},50);};requestAnimationFrame(()=>{t0=last=performance.now();${call?`const a=performance.now();${call};callMs=+(performance.now()-a).toFixed(1);`:''}requestAnimationFrame(tick);});})`);
  const programsBefore=await evaluate('window.__stalheartTest.state().programs'),listBefore=await evaluate('window.__stalheartTest.programs()');
  const seatBase=await seatWatch(null),seatFirst=await seatWatch('document.querySelector("#gunship-briefing [data-skip]").click()');
  const programsAfter=await evaluate('window.__stalheartTest.state().programs'),listAfter=await evaluate('window.__stalheartTest.programs()');
  console.log(`GUNSHIP seat new programs: ${listAfter.filter(k=>!listBefore.includes(k)).join(' ')}`);
  console.log(`GUNSHIP warm ${JSON.stringify(await evaluate('window.__stalheartTest.state().warm'))}`);
  console.log(`GUNSHIP seat baseline ${JSON.stringify(seatBase)} first seat ${JSON.stringify(seatFirst)} programs ${programsBefore} -> ${programsAfter}`);
  assert(programsAfter-programsBefore<=12,`the seat links few shader programs: most were warmed while the game ran (${programsBefore} -> ${programsAfter}; it linked 18 before src/fx/program-warm.js)`);   // deterministic, unlike the timings below on a shared machine
  assert(seatFirst.maxFrame<130,`the first seat's hitch stays bounded (longest frame ${seatFirst.maxFrame} ms at +${seatFirst.maxAt} ms against a ${seatBase.maxFrame} ms baseline; it was 78.6 ms before the warm, 60-64 ms after, and this only catches a collapse)`);
  assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'skipping the briefing takes the seat');
  const s=await evaluate('window.__stalheartTest.state().gunship');assert(s.mounted&&s.seat&&s.optic,`thermal optic live ${JSON.stringify(s)}`);
  assert.equal(await evaluate('document.querySelector("#story-monitor .head").textContent'),'GROUND TRUTH · IMPACT','the monitor shows the impact point');
  assert((await evaluate('document.querySelector("#gunship-hud [data-f=blast]").textContent')).length>0,'the danger readout is written in the HUD');
  assert(await evaluate('!!document.querySelector("#gunship-hud .reticle circle")'),'the rotary reticle is up');
  current='gunship-pov-rotary';await finish();
  await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(400);assert(await evaluate('!!document.querySelector("#gunship-hud .reticle path")'),'the strike reticle is up');current='gunship-pov-heavy';await finish();
  assert(await evaluate('document.querySelector("#tab-td").classList.contains("gunship-thermal")'),'the seat opens in thermal');assert.equal(await evaluate('getComputedStyle(document.querySelector("#td-app canvas")).filter'),'url("#flir")','thermal is the FLIR ironbow');assert.equal(await evaluate('getComputedStyle(document.querySelector("#td-app canvas.minimap")).filter'),'none','the radar keeps its own green');assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'still seated');current='gunship-thermal';await finish();
  // THERMAL IS THE SEAT, NOT A MODE (owner, 2026-09-16): M no longer cycles, there is no normal or night to land on, and nothing draws a square over an enemy
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'m',code:'KeyM'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'m',code:'KeyM'});await delay(400);assert(await evaluate('document.querySelector("#tab-td").classList.contains("gunship-thermal")'),'M leaves the seat in thermal');assert(!await evaluate('document.querySelector("#tab-td").classList.contains("gunship-normal")||document.querySelector("#tab-td").classList.contains("gunship-night")'),'no normal or night view to switch to');current='gunship-thermal-held';await finish();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT'});await delay(800);current='gunship-top-view';await finish();await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT'});await delay(400);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV'});await delay(600);current='gunship-third';await finish();
  // the second seat of the pass, measured the same way: leave for the tank, come back
  await evaluate('document.querySelector("#story-views [data-view=tank]").click()');await delay(900);assert(!await evaluate('window.__stalheartTest.state().gunship.seat'),'TANK leaves the seat');
  {const again=await seatWatch('window.__stalheartTest.mountGunship()');await delay(300);assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'the seat is taken again');
   console.log(`GUNSHIP second seat ${JSON.stringify(again)} programs ${await evaluate('window.__stalheartTest.state().programs')}`);}
  // no input reaches the clock: the pass keeps counting out while the gunner sits
  const a=await evaluate('window.__stalheartTest.state().gunship.left');await delay(1200);const b=await evaluate('window.__stalheartTest.state().gunship.left');assert(b<a,'the pass counts out under the gunner');
  // the trigger on the rotary: rounds are owed and nothing throws with no enemy under the reticle
  await evaluate('window.__stalheartTest.gunshipGun("rotary")');await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(700);await evaluate('window.__stalheartTest.gunshipHold(false)');
  await delay(2400);{const x=await evaluate('window.__stalheartTest.state().explosions');assert(x.available&&x.spawned['gunship.rotary']>0,`rotary rounds burst where they land (${JSON.stringify(x)})`);}
  current='gunship-rotary-fired';await finish();
  await evaluate('window.__stalheartTest.gunshipGun("bofors")');await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(400);await evaluate('window.__stalheartTest.gunshipHold(false)');
  await delay(3000);{const x=await evaluate('window.__stalheartTest.state().explosions');assert(x.spawned['gunship.bofors']>0,`the Bofors shell bursts on landing (${JSON.stringify(x)})`);}
  current='gunship-bofors-burst';await finish();
  await until('window.__stalheartTest.state().explosions.live===0',5000).catch(async()=>assert.fail(`the bursts are reaped once they burn out (${JSON.stringify(await evaluate('window.__stalheartTest.state().explosions'))})`));
  // THE MK-9 MINI NUKE (owner, 2026-09-16, replacing the 105's instant strike): paint, RELEASE, and then a body in the world — it
  // drops from the belly, falls free for two seconds, its motor lights, and it dives onto the painted cell. The five frames below
  // are the owner's own sequence: release, free fall, ignition, dive, blast. The 105's howitzer-blast assertion is gone with the gun.
  await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(300);
  await until('window.__stalheartTest.state().gunship.nuke?.ready',40000);   // the TALON body's own pool, made on the first station tick
  assert(/DANGER CLOSE|MK-9/.test(await evaluate('document.querySelector("#gunship-hud .reticle text")?.textContent ?? document.querySelector("#gunship-hud .reticle").textContent')),'the third reticle names the MK-9 or the danger it is standing over');
  await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(200);
  assert.equal((await evaluate('window.__stalheartTest.state().gunship.heavy')).phase,'painted','the first press paints');
  await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(250);
  {const fl=await evaluate('window.__stalheartTest.state().gunship');
   assert.equal(fl.heavy.phase,'released','the second press RELEASES the round, motor still cold');
   assert(fl.nuke.flying&&!fl.nuke.ignited,`the MK-9 is a modelled body in the air and has not lit (${JSON.stringify(fl.nuke)})`);
   assert(fl.seat,'the camera never left the seat');
   assert.match(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),/^RELEASED/,'the HUD says RELEASED');
   assert.equal(await evaluate('document.querySelector("#story-monitor .head").textContent'),'MK-9 · ROUND IN FLIGHT','and the GROUND TRUTH feed rides the round, not the impact point');}
  current='gunship-nuke-release';await finish();
  await delay(700);assert.equal((await evaluate('window.__stalheartTest.state().gunship.heavy')).phase,'released','a second in, it is still falling free');current='gunship-nuke-freefall';await finish();
  await until('window.__stalheartTest.state().gunship.heavy.phase==="ignited"',8000);
  {const ig=await evaluate('window.__stalheartTest.state().gunship');assert(ig.nuke.ignited&&ig.nuke.flying,`the motor lit with the round still in the air (${JSON.stringify(ig.nuke)})`);
   assert.match(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),/^IGNITED/,'the HUD says IGNITED');
   const x=await evaluate('window.__stalheartTest.state().explosions');assert.equal(x.spawned['gunship.ignite'],1,`the motor lights with its own burst, not the 25 mm impact pop (${JSON.stringify(x.spawned)})`);}
  current='gunship-nuke-ignite';await finish();
  await delay(500);current='gunship-nuke-dive';await finish();
  await until('window.__stalheartTest.state().gunship.heavy.phase==="reloading"',8000);await delay(700);
  {const x=await evaluate('window.__stalheartTest.state().explosions');
   assert.equal(x.spawned['gunship.nuke'],1,`the MK-9 lands as the mini nuke (${JSON.stringify(x.spawned)})`);
   assert(!x.spawned['gunship.heavy'],'and the 105\'s howitzer blast is never spawned: that gun is gone');
   const rl=await evaluate('window.__stalheartTest.state().gunship');assert.equal(rl.heavy.phase,'reloading',`then the tube safes (${JSON.stringify(rl.heavy)})`);
   assert.equal(rl.nuke.flying,false,'and the body is back in its pool');
   assert.match(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),/^IMPACT/,'the HUD says IMPACT');
   assert.equal(await evaluate('document.querySelector("#gunship-hud [data-f=barLabel]").textContent'),'SAFING','one release a pass: the meter reads the safing, not a reload for another');}
  current='gunship-nuke-blast';await finish();
  // ONE RELEASE A PASS, END TO END (Node-tested in test/gunship.mjs, never before seen in a browser): once the tube has safed the pass
  // is SPENT, the HUD says so in its own words, and a press neither paints nor releases; the pass ends, the next call brings the
  // platform back on station with a fresh round, and the same press paints and releases again
  // the tube safes over its reload; this must happen while the pass is still overhead, or the seat is torn down and the HUD reads nothing
  await until('(()=>{const g=window.__stalheartTest.state().gunship;return g.heavy.phase==="spent"||!g.station})()',GUNSHIP_GUNS.heavy.reload*1000+8000).catch(async()=>assert.fail(`the tube safes into SPENT (${JSON.stringify(await evaluate('window.__stalheartTest.state().gunship.heavy'))})`));
  {const before=await evaluate('window.__stalheartTest.state()');
   assert(before.gunship.station&&before.gunship.seat,`the pass must still be on station with the gunner seated when the tube safes (station ${before.gunship.station}, seat ${before.gunship.seat}, left ${before.gunship.left} s): the step ran long against the ${GUNSHIP_ORBIT.station} s station`);
   assert.equal(before.gunship.heavy.phase,'spent',`the tube safed into SPENT (${JSON.stringify(before.gunship.heavy)})`);
   assert.equal(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),'SPENT · ONE RELEASE A PASS','the HUD refuses in its own words');
   await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(250);await evaluate('window.__stalheartTest.gunshipHold(false)');await delay(150);await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(250);await evaluate('window.__stalheartTest.gunshipHold(false)');await delay(400);
   const after=await evaluate('window.__stalheartTest.state()');
   assert.equal(after.gunship.heavy.phase,'spent',`a second press in the same pass neither paints nor releases (${JSON.stringify(after.gunship.heavy)})`);
   assert.equal(after.gunship.nuke.flying,false,'no second body in the air');assert.equal(after.explosions.spawned['gunship.nuke'],1,'and no second blast');
   assert.equal(after.gunship.passes,before.gunship.passes,'still the same pass');assert.equal(after.gunship.seat,true,'the gunner is still seated');
   assert.equal(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),'SPENT · ONE RELEASE A PASS','and the HUD still refuses');
   console.log(`  gunship: pass ${after.gunship.passes} spent, second press refused (${after.gunship.heavy.phase})`);}
  current='gunship-nuke-spent';await finish();
  // the pass ends; the call-in brings the next one, and the MK-9 is armed again
  {const passes=await evaluate('window.__stalheartTest.state().gunship.passes');
   await evaluate('window.__stalheartTest.gunshipPassEnd()');await until('!window.__stalheartTest.state().gunship.station',5000);await delay(800);
   if(await evaluate('window.__stalheartTest.state().gunship.seat'))await evaluate('document.querySelector("#story-views [data-view=tank]").click()');await delay(600);
   assert.equal(await evaluate('window.__stalheartTest.mountGunship()'),false,'between passes the seat is refused');
   await evaluate('window.__stalheartTest.gunshipPassEnd()');await until('window.__stalheartTest.state().gunship.station',5000);await delay(600);   // this page is not past the call-in: the orbit brings the next pass on its own, ended early here
   await evaluate('window.__stalheartTest.mountGunship()');await delay(1200);await evaluate('document.querySelector("#gunship-briefing [data-skip]")?.click()');
   await until('window.__stalheartTest.state().gunship.station && window.__stalheartTest.state().gunship.seat',15000);
   await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(400);
   const s=await evaluate('window.__stalheartTest.state().gunship');assert.equal(s.passes,passes+1,`a new pass (${s.passes})`);
   assert.equal(s.heavy.phase,'ready',`the new pass re-arms the MK-9 (${JSON.stringify(s.heavy)})`);
   assert.equal(await evaluate('document.querySelector("#gunship-hud [data-f=state]").textContent'),'ARMED · FIRE TO PAINT','the HUD says ARMED again');
   await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(200);assert.equal((await evaluate('window.__stalheartTest.state().gunship.heavy')).phase,'painted','the press paints again');
   await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(250);
   const r=await evaluate('window.__stalheartTest.state().gunship');assert.equal(r.heavy.phase,'released',`and releases the pass's one round (${JSON.stringify(r.heavy)})`);assert(r.nuke.flying,'a fresh body in the air');
   console.log(`  gunship: pass ${r.passes} re-armed, released again`);}
  current='gunship-nuke-rearmed';await finish();
  await until('window.__stalheartTest.state().gunship.heavy.phase==="reloading"',10000);await delay(500);
  assert.equal((await evaluate('window.__stalheartTest.state().explosions')).spawned['gunship.nuke'],2,'the second pass\'s round lands as the second mini nuke');}
 // THE SKIP MARKER: the panel beside the build tag opens the seat by itself and raises enemies, which then read hot in the thermal optic
 await go('gunship-skip','index.html?sw=0&cine=0&world=story&stage=6&acceptance=1&gunship=station&skip=gunship&enemies=24&brief=0#td');
 await until('!!window.__stalheartTest && window.__stalheartTest.state().gunship.seat',120000);await delay(9000);
 {const s=await evaluate('window.__stalheartTest.state()');assert(s.gunship.seat&&s.gunship.optic,'the skip took the seat');assert(s.performance.enemies>=10,`enemies raised by the skip (${s.performance.enemies})`);assert.deepEqual(s.enemyTypes,['amoeba'],'the skip raises the white amoeba swarm');
  assert(await evaluate('document.querySelector("#shell-nav [data-entry=jump-gunship]").classList.contains("active")'),'the drawer marks the jump we came from');
  await evaluate('document.querySelector("#shell-nav [data-tool=raise]").click()');await delay(1500);const more=await evaluate('window.__stalheartTest.state().performance.enemies');assert(more>s.performance.enemies,`the + button raised more (${more})`);}
 current='gunship-skip-enemies';await finish();
 // THE SHIP CREEPS TOWARD THE BREACHES (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3): over ~10 s the platform's ground point
 // closes on the live breach, or holds its loiter circle round it, while the gunner holds still and the seat's camera never jumps
 {const arc=(a,b)=>Math.atan2(Math.hypot(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]),a[0]*b[0]+a[1]*b[1]+a[2]*b[2]);
  const k0=(await evaluate('window.__stalheartTest.state().gunship')).track;assert(k0&&k0.target&&!k0.home,`the track has a live breach to go to (${JSON.stringify(k0)})`);
  const d0=arc(k0.pos,k0.target)/k0.cellSide;current='gunship-track-before';await finish();
  const probe=await evaluate(`new Promise(res=>{const T=window.__stalheartTest,start=performance.now();let prev=null,max=0,sum=0,n=0;const f=()=>{const q=T.gunshipCam();if(prev){const a=2*Math.acos(Math.min(1,Math.abs(q[0]*prev[0]+q[1]*prev[1]+q[2]*prev[2]+q[3]*prev[3])));max=Math.max(max,a);sum+=a;}prev=q;n++;if(performance.now()-start<9000)requestAnimationFrame(f);else res({max,sum,n});};requestAnimationFrame(f);})`);
  await delay(800);const k1=(await evaluate('window.__stalheartTest.state().gunship')).track,d1=arc(k1.pos,k1.target)/k1.cellSide,deg=r=>(r*180/Math.PI).toFixed(3);
  console.log(`gunship track: ${d0.toFixed(2)} -> ${d1.toFixed(2)} cells from the breach, moved ${(arc(k0.pos,k1.pos)/k1.cellSide).toFixed(2)} cells at ${k1.speed.toFixed(2)} cells/s, hull turned ${deg(arc(k0.heading,k1.heading))} deg; seat camera: max ${deg(probe.max)} deg/frame, ${deg(probe.sum)} deg in all over ${probe.n} frames`);
  assert(arc(k0.target,k1.target)<1e-6,'the same breach all the while');
  assert(d1<d0-1||Math.abs(d1-GUNSHIP_TRACK.loiterCells)<0.6,`the ground point closes on the breach or circles it (${d0.toFixed(2)} -> ${d1.toFixed(2)} cells)`);
  assert(probe.n>=90,`the probe saw the frames (${probe.n})`);assert(probe.max<0.25*Math.PI/180,`the seat's camera never jumps while the gunner holds still (max ${deg(probe.max)} deg in a frame)`);
  assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'still seated');
  current='gunship-track-after';await finish();}
 /* THE SECOND VIEW'S UNITS, ON A RETINA SURFACE (owner, 2026-09-24: in Safari "everything off to the right", the tank off centre
    and the HUD miscalibrated against where the guns shoot). The monitor is scissored into a corner and then puts the MAIN viewport
    back, and three's setViewport/setScissor take CSS pixels — the renderer multiplies by its own pixel ratio on the way to
    gl.viewport. Device pixels there left the world drawn into a viewport dpr times too large, anchored at the buffer's bottom-left
    corner, so at dpr 2 the glass showed the bottom-left quarter of the frame blown up: the whole world slid right and up while the
    DOM overlays stayed where they were. It is exactly a no-op at dpr 1, which is why every earlier headless run was clean, so this
    step loads at 2 — the renderer takes its ratio when it is built and never revisits it. */
 await go('gunship-retina','index.html?sw=0&cine=0&world=story&stage=6&acceptance=1&gunship=station&skip=gunship&enemies=24&brief=0#td',1440,900,undefined,2);
 await until('!!window.__stalheartTest && window.__stalheartTest.state().gunship.seat',120000);await delay(6000);
 {const g=await evaluate('(()=>{const cv=document.querySelector("#td-app canvas:not(.minimap)"),x=cv.getContext("webgl2")||cv.getContext("webgl");return {dpr:devicePixelRatio,vp:Array.from(x.getParameter(x.VIEWPORT)),buf:[x.drawingBufferWidth,x.drawingBufferHeight],shown:window.__stalheartTest.state().monitorShown};})()');
  assert.equal(g.dpr,2,`the seat loaded on a Retina surface (${JSON.stringify(g)})`);
  assert(g.shown>0,`the seeker feed drew at dpr 2 (${JSON.stringify(g)})`);
  assert.deepEqual(g.vp,[0,0,g.buf[0],g.buf[1]],`and left the main viewport over the whole drawing buffer (${JSON.stringify(g)})`);}
 current='gunship-retina';await finish();
 } else if(args.includes('--phone')) {
 // A TOUCH PHONE (owner, 2026-09-18: the friends open the live link on phones, and nothing built in the last two days was tested
 // under touch). A 390x844 portrait phone at dpr 3 with a coarse pointer and touch events, no mouse at all: the harness plays the
 // V1 session the way a thumb does, and at every station proves the controls a player needs are on screen, 44 px, and not under
 // anything (document.elementFromPoint at each control's centre must find the control itself). Screenshots at each station.
 const T='window.__stalheartTest', st=()=>evaluate(`${T}.state()`);
 const PW=390,PH=844;
 // the phone: the metrics, the touch screen and the media features are set BEFORE the page boots, since the shell decides on
 // (pointer: coarse) at module load. Chrome's mobile emulation is what makes that query true (the ?coarse=1 rewrite is not needed).
 async function phone(name,path,w=PW,h=PH){
  current=name;consoleLines.length=0;errors.length=0;requests.length=0;
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await send('Emulation.setEmulatedMedia',{features:[{name:'pointer',value:'coarse'},{name:'hover',value:'none'},{name:'any-pointer',value:'coarse'},{name:'any-hover',value:'none'}]}).catch(()=>{});
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:3,mobile:true,screenWidth:w,screenHeight:h,screenOrientation:w>h?{type:'landscapePrimary',angle:90}:{type:'portraitPrimary',angle:0}});
  if(await evaluate('location.href')===urlRoot+path){await send('Page.navigate',{url:'about:blank'});await until('location.href === "about:blank"');}
  await evaluate('window.__stalheartReady = false');
  await send('Page.navigate',{url:urlRoot+path});
  await until(`location.href === ${JSON.stringify(urlRoot+path)} && window.__stalheartReady === true`);
 }
 const touch=(type,points)=>send('Input.dispatchTouchEvent',{type,touchPoints:points});
 const centre=sel=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`);
 const tapAt=async(x,y,ms=70)=>{await touch('touchStart',[{x,y}]);await delay(ms);await touch('touchEnd',[]);await delay(150);};
 // what a thumb finds at the control's centre: 'ok' is the control itself or a child of it; anything else is why a player cannot press it
 const over=sel=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return 'missing';const r=e.getBoundingClientRect();if(!(r.width>0&&r.height>0))return 'no size';const s=getComputedStyle(e);if(s.display==='none'||s.visibility==='hidden'||+s.opacity===0)return 'hidden';if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)return 'off screen '+JSON.stringify([r.left,r.top,r.right,r.bottom].map(Math.round));const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(!h)return 'nothing at its centre';if(e===h||e.contains(h))return 'ok';return 'covered by '+(h.id?'#'+h.id:h.tagName.toLowerCase()+(h.className&&typeof h.className==='string'?'.'+h.className.split(' ')[0]:''));})()`);
 const reachable=async(sel,what=sel)=>{const o=await over(sel);assert.equal(o,'ok',`${what} is under the thumb (${o})`);};
 // a readout, not a control: on screen and under nothing but the board's canvas (a pointer-events: none panel lets the probe through to it)
 const shown=async(sel,what=sel)=>{const o=await over(sel);assert.match(o,/^(ok|covered by canvas)$/,`${what} is on the screen (${o})`);};
 const thumb=async(sel,what=sel)=>{const c=await centre(sel);assert(c&&c.w>=44&&c.h>=44,`${what} is a 44 px thumb target (${c?`${Math.round(c.w)}x${Math.round(c.h)}`:'missing'})`);};
 const tap=async(sel,what=sel)=>{await reachable(sel,what);const c=await centre(sel);await tapAt(c.x,c.y);};
 const press=async(sel,ms)=>{await reachable(sel);const c=await centre(sel);await touch('touchStart',[{x:c.x,y:c.y}]);await delay(ms);await touch('touchEnd',[]);};
 const drag=async(x0,y0,x1,y1,{steps=12,ms=360,lift=true}={})=>{await touch('touchStart',[{x:x0,y:y0}]);await delay(40);for(let i=1;i<=steps;i++){await touch('touchMove',[{x:x0+(x1-x0)*i/steps,y:y0+(y1-y0)*i/steps}]);await delay(ms/steps);}if(lift){await touch('touchEnd',[]);await delay(100);}};
 const rects=sels=>evaluate(`((sels)=>{const out={};for(const s of sels){const e=document.querySelector(s);if(!e)continue;const r=e.getBoundingClientRect();const st=getComputedStyle(e);if(st.display==='none'||st.visibility==='hidden'||+st.opacity===0||!(r.width>0&&r.height>0))continue;out[s]=[r.left,r.top,r.right,r.bottom].map(v=>Math.round(v));}return out;})(${JSON.stringify(sels)})`);
 // no two of these may share more than a 2 px sliver, and every one of them is on the screen
 const layout=async(sels,what)=>{const R=await rects(sels);const keys=Object.keys(R),bad=[];for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=R[keys[i]],b=R[keys[j]];const w=Math.min(a[2],b[2])-Math.max(a[0],b[0]),h=Math.min(a[3],b[3])-Math.max(a[1],b[1]);if(w>2&&h>2)bad.push(`${keys[i]} ${JSON.stringify(a)} over ${keys[j]} ${JSON.stringify(b)}`);}
  for(const [k,r] of Object.entries(R))if(!(r[0]>=-1&&r[1]>=-1&&r[2]<=innerW()+1&&r[3]<=innerH()+1))bad.push(`${k} off the screen ${JSON.stringify(r)}`);
  assert.deepEqual(bad,[],`${what}: nothing sits on anything else and nothing is off the screen`);return R;};
 let W=PW,H=PH;const innerW=()=>W,innerH=()=>H;
 const PAD=['#td-pad-fire','#td-pad-laser','#td-pad-shield'];
 const CHROME=[...PAD,'#story-views','#td-brief','#td-stats','#mob-mode','#tab-td .minimap','#sector-card','#td-sitrep','#td-toast','#td-wave','#td-tower','#skip-tutorial','#td-tut','#td-launch','#shell-bar'];   /* #td-tut is here because the SKIP offer was sitting on the coach's second line and nothing measured it */
 // 1. THE BARE OPENING, the page the live link opens: the phone shell, no rotate wall, SKIP TUTORIAL a thumb can reach
 await phone('phone-opening','index.html?sw=0&acceptance=1&cine=0&world=story&grow=1&fps=0#td');
 await until(`!!${T}`,90000);await delay(2500);
 assert.equal(await evaluate('matchMedia("(pointer: coarse)").matches'),true,'the emulated phone is a coarse pointer');
 assert.equal(await evaluate('navigator.maxTouchPoints>0'),true,'and a touch screen');
 assert.equal(await evaluate('document.body.classList.contains("mobile-shell")'),true,'the game takes its phone shell');
 {const rot=await evaluate('(()=>{const e=document.querySelector("#td-rotate");if(!e)return "none";const s=getComputedStyle(e);return s.display==="none"?"none":s.pointerEvents==="none"?"passive":"blocking";})()');assert.notEqual(rot,'blocking','portrait is not walled off by the rotate prompt');}
 await until(`${T}.state().skip?.offer?.shown`,20000);
 await thumb('#skip-tutorial','SKIP TUTORIAL');await reachable('#skip-tutorial','SKIP TUTORIAL');
 await layout(CHROME,'the opening');
 await finish();
 // the tap is the entry: a touch on the button lands in the skipped run
 await tap('#skip-tutorial','SKIP TUTORIAL');
 current='phone-skip-run';consoleLines.length=0;errors.length=0;requests.length=0;
 await until('location.search.includes("skip=defence")',20000);await until('window.__stalheartReady===true',90000);
 await until(`!!${T} && (${T}.state().storyLod||[]).some(l=>l.id==="stalheart")`,90000);
 assert.equal(await evaluate('document.body.classList.contains("mobile-shell")'),true,'the skipped run is on the phone shell too');
 assert.equal((await st()).skip.on,true,'the tap landed in the skipped run');
 await evaluate(`${T}.sectorQuiet(true)`);   // the seats are the subject here; the sector's waves and the gate wear wait for the debrief station
 // 2. THE SKIPPED RUN'S CHROME: the pad, the strip, the sector line, the comms card and the touch labels, all reachable, none on another
 await until(`!${T}.state().deploying`,60000).catch(()=>{});
 await until('document.querySelector("#tab-td").classList.contains("pad-labelled")',30000).catch(async()=>assert.fail(`the pad wears its touch labels once the tank is ours (card ${JSON.stringify(await evaluate('document.querySelector("#controls-card")?.hidden'))})`));
 assert.equal(await evaluate('document.querySelector("#controls-card")?.hidden ?? true'),true,'no key list on a phone');
 assert.deepEqual(await evaluate('[...document.querySelectorAll("#tab-td [data-label]")].filter(e=>getComputedStyle(e).display!=="none").map(e=>e.dataset.label)'),['FIRE','LASER','SHIELD'],'FIRE, LASER and SHIELD are named on the pad');
 for(const s of PAD){await thumb(s);await reachable(s);}
 for(const s of ['#story-views [data-view=tank]','#story-views [data-mount=gunship]','#mob-mode']){await thumb(s);await reachable(s);}
 assert.match(await over('#story-views [data-view=map]'),/^(hidden|no size)$/,'no MAP on the phone: BUILD is the orbit view');
 await until('/SECTOR 2/.test(document.querySelector("#td-stats").textContent)',60000).catch(async()=>assert.fail(`the sector line is on the HUD (${await evaluate('document.querySelector("#td-stats").textContent')})`));
 await shown('#td-stats .hud-sector','the sector line');   /* the shell hides the other .hud-obj lines while driving; this one stays */
 assert(await evaluate('!document.querySelector("#td-brief").classList.contains("hidden")'),'Isao is speaking on arrival');
 await reachable('#td-brief-next','the comms card NEXT');await thumb('#td-brief-next','the comms card NEXT');
 await layout(CHROME,'the skipped run');
 await finish();
 // 3. DRIVING BY TOUCH: a finger down on the left half puts the stick there, up is forward; a tap on the ground is a destination
 // a tap during a camera shot skips the shot (td-tab shotSkipTap), which is right for a player and wrong for this probe: the sector's
 // back-door crack runs one on its own clock, so the finger waits for the rock to give and for the camera to be the tank's again
 await until(`${T}.backDoorOpen()`,90000).catch(()=>{});await until(`${T}.state().shot===null`,30000);await delay(600);
 {const p0=(await st()).playerPosition;
  // bare ground on the left half: the first point down the left column where a thumb finds the board's canvas and no chrome
  const g=await evaluate('(()=>{for(let y=300;y<760;y+=20){const h=document.elementFromPoint(90,y);if(h&&h.tagName==="CANVAS"&&!h.classList.contains("minimap"))return {x:90,y};}return null;})()');assert(g,'bare ground on the left half');
  const x=g.x,y=g.y,stickUp=()=>evaluate('!document.querySelector("#td-stick").classList.contains("hidden")');
  await touch('touchStart',[{x,y}]);await delay(120);
  if(!(await stickUp())){await touch('touchEnd',[]);await until(`${T}.state().shot===null`,30000);await delay(800);await touch('touchStart',[{x,y}]);await delay(120);}   /* a shot began under the finger: once more */
  assert(await stickUp(),`the stick appears under the finger at ${x},${y} (shot ${await evaluate(`${T}.state().shot`)}, hit ${await evaluate(`(h=>h?h.id||h.tagName+"."+h.className:null)(document.elementFromPoint(${x},${y}))`)}, build ${await evaluate('document.body.classList.contains("mob-build")')})`);
  for(let i=1;i<=6;i++){await touch('touchMove',[{x,y:y-i*12}]);await delay(30);}await delay(1500);
  const p1=(await st()).playerPosition;current='phone-drive';await finish();await touch('touchEnd',[]);await delay(200);
  const moved=Math.hypot(...p1.map((v,i)=>v-p0[i]));assert(moved>.005,`the tank drives on the stick (${moved})`);
  assert(await evaluate('document.querySelector("#td-stick").classList.contains("hidden")'),'the stick goes with the finger');}
 // 4. A TOWER ORDER BY TAP: BUILD, the radial on a buildable cell, a tap on a tower puts the order on Isao's list
 await tap('#mob-mode','BUILD');await delay(800);
 assert(await evaluate('document.body.classList.contains("mob-build")'),'BUILD mode');
 assert(await evaluate(`${T}.openBuildMenu()`),'the radial opens on a buildable cell');await delay(400);
 {const bio=(await st()).biomass;const key=await evaluate('(()=>{const b=[...document.querySelectorAll("#td-shop .shop-buy")].find(b=>!b.disabled&&!b.classList.contains("locked"));return b?b.dataset.key:null;})()');assert(key,'an affordable tower on the radial');
  await thumb(`#td-shop .shop-buy[data-key=${key}]`,`the radial's ${key}`);await tap(`#td-shop .shop-buy[data-key=${key}]`,`the radial's ${key}`);await delay(500);
  assert(await evaluate('document.querySelector("#td-shop").classList.contains("hidden")'),'the radial closes on the order');
  assert((await st()).biomass<bio,`the order is paid for (${bio} -> ${(await st()).biomass})`);}
 current='phone-build';await finish();
 await tap('#mob-mode','DRIVE');await delay(800);assert(!(await evaluate('document.body.classList.contains("mob-build")')),'back to DRIVE');
 // 5. THE GUNSHIP FROM THE STRIP: the briefing's SKIP by touch, the seat's own gun buttons, aim by drag, the pad's fire button as the trigger.
 // Since the sectors run on a clock (2026-09-24) the skip run is always mid-fight here, and a live sector is never frozen under the
 // briefing (it waits for a calm moment, 2026-09-16): the briefing is opened as the G key opens it, its SKIP tapped by touch, and
 // then the strip's GUNSHIP takes the seat.
 await evaluate(`${T}.fillGunshipCall(100000)`);await until('document.querySelector("#story-views [data-mount=gunship]").textContent==="GUNSHIP · CALL"',5000);
 await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"g",bubbles:true}))');
 await until('!!document.querySelector("#gunship-briefing:not([hidden])")',5000);await delay(600);
 await thumb('#gunship-briefing [data-skip]','the briefing\'s SKIP');await reachable('#gunship-briefing [data-skip]','the briefing\'s SKIP');
 current='phone-gunship-briefing';await finish();
 await tap('#gunship-briefing [data-skip]','the briefing\'s SKIP');
 await until('!!document.querySelector("#gunship-briefing")?.hidden',5000);
 await tap('#story-views [data-mount=gunship]','the strip\'s GUNSHIP');
 await until(`${T}.state().gunship.seat`,15000);await delay(1500);
 for(const k of ['rotary','bofors','heavy']){await thumb(`#sentry-pilot [data-gun=${k}]`,`the ${k} button`);await reachable(`#sentry-pilot [data-gun=${k}]`,`the ${k} button`);}
 await thumb('#td-pad-fire','the trigger');await reachable('#td-pad-fire','the trigger');
 await reachable('#story-views [data-view=tank]','TANK on the strip');
 await layout(['#td-pad-fire','#story-views','#sentry-pilot header','#sentry-pilot .pilot-guns','#sentry-pilot [data-map]','#sentry-pilot footer','#gunship-hud .ro','#story-monitor','#mob-mode','#shell-bar','#tab-td .minimap'],'the gunship seat');
 {const q0=await evaluate(`${T}.gunshipCam()`);await drag(200,430,120,400);await delay(400);const q1=await evaluate(`${T}.gunshipCam()`);
  const a=2*Math.acos(Math.min(1,Math.abs(q0[0]*q1[0]+q0[1]*q1[1]+q0[2]*q1[2]+q0[3]*q1[3])));assert(a>0.01,`a drag turns the optic (${(a*180/Math.PI).toFixed(2)} deg)`);}
 current='phone-gunship-seat';await finish();
 {const rotary=async()=>(await evaluate(`${T}.state().explosions`)).spawned?.['gunship.rotary']??0;const before=await rotary();
  await press('#td-pad-fire',700);await delay(2600);assert(await rotary()>before,`the rotary fires from the pad's button (${before} -> ${await rotary()})`);}
 await tap('#sentry-pilot [data-gun=bofors]','the Bofors button');await delay(300);assert.equal((await st()).gunship.gun,'bofors','the Bofors by touch');
 await tap('#sentry-pilot [data-gun=heavy]','the MK-9 button');await delay(300);assert.equal((await st()).gunship.gun,'heavy','the MK-9 by touch');
 // 6. THE MK-9 RELEASE BY TOUCH: one tap paints, the next releases
 await until(`${T}.state().gunship.nuke?.ready`,40000);
 await tap('#td-pad-fire','the trigger');await delay(300);assert.equal((await st()).gunship.heavy.phase,'painted','the first tap paints');
 await tap('#td-pad-fire','the trigger');await delay(400);
 {const g=(await st()).gunship;assert.equal(g.heavy.phase,'released',`the second tap releases the MK-9 (${JSON.stringify(g.heavy)})`);assert(g.nuke.flying,'the round is in the air');}
 current='phone-nuke-release';await finish();
 await until(`${T}.state().gunship.heavy.phase==="reloading"`,15000);
 await tap('#story-views [data-view=tank]','TANK on the strip');await delay(1000);assert(!(await st()).gunship.seat,'TANK leaves the seat');
 // 7. SOL-82'S SEAT: the strip's button, the briefing's SKIP, the scope steered by a drag, HOLD burns, TANK leaves
 assert.equal((await st()).laser.online,true,'SOL-82 is online at the back door');
 await evaluate(`${T}.laserPassNow()`);await until('document.querySelector("#story-views [data-view=laser]")?.textContent==="SOL-82 OVERHEAD"',8000);
 await thumb('#story-views [data-view=laser]','SOL-82 on the strip');await tap('#story-views [data-view=laser]','SOL-82 on the strip');
 await until('!!document.querySelector("#sol82-briefing:not([hidden]) [data-skip]")',5000);await delay(600);
 await thumb('#sol82-briefing [data-skip]','SOL-82\'s SKIP');await tap('#sol82-briefing [data-skip]','SOL-82\'s SKIP');
 await until(`${T}.state().laser.seated`,15000);await delay(1000);
 await thumb('#laser-seat-keys [data-hold]','HOLD');await reachable('#laser-seat-keys [data-hold]','HOLD');
 await thumb('#laser-seat-keys [data-tank]','the seat\'s TANK');await reachable('#laser-seat-keys [data-tank]','the seat\'s TANK');
 await layout(['#laser-seat','#laser-seat-keys','#story-views','#mob-mode','#shell-bar'],'SOL-82\'s seat');
 {const r=scopeRect(W,H,{left:16,bottom:116,top:150}),cx=r.x+r.w/2,cy=r.y+r.h/2;   // the seat's own lens geometry (src/fx/laser-seat.js rect)
  assert(cy>0&&r.h>60,`the scope has room in portrait (${JSON.stringify(r)})`);
  await evaluate(`${T}.laserSteer("breach")`);await delay(500);const c0=(await st()).laser.contact;assert(c0,'the beam is laid on the breach');
  await drag(cx,cy,cx+r.w*0.22,cy+r.h*0.18,{lift:false});await delay(600);
  const c1=(await st()).laser.contact;assert(c1&&Math.hypot(...c1.map((v,i)=>v-c0[i]))>1e-4,`a drag in the scope steers the beam (${JSON.stringify(c0)} -> ${JSON.stringify(c1)})`);
  await touch('touchEnd',[]);await delay(200);}
 {const c=await centre('#laser-seat-keys [data-hold]');await touch('touchStart',[{x:c.x,y:c.y}]);await delay(900);
  const s=await evaluate(`${T}.state().laser`);assert.equal(s.burning,true,`HOLD burns while the thumb is down (${JSON.stringify(s)})`);
  current='phone-sol82';await finish();await touch('touchEnd',[]);await delay(400);
  assert.equal((await evaluate(`${T}.state().laser`)).burning,false,'and stops when it lifts');}
 await tap('#laser-seat-keys [data-tank]','the seat\'s TANK');await delay(800);assert.equal((await st()).laser.seated,false,'TANK leaves SOL-82');
 // 8. THE DEBRIEF AT 390 PX: both breaches closed, the field cleared, the card up; pages advance by tap, CONTINUE reachable
 /* the back door's sector opens its gate side after the feast (2026-09-24): clear the feast so the gate side opens, then seal */
 await until(`(()=>{const S=${T}.state().sector;if(S.feast&&!S.feast.scrambled)${T}.sectorClearField();return S.breaches.length===2&&S.breaches.every(b=>b.opened);})()`,90000).catch(async()=>assert.fail(`the sector has both its breaches open (${JSON.stringify((await st()).sector)})`));
 // SOL-82's HOLD above may already have sealed the gate-side one: seal whatever is still live rather than assuming both are
 for(const b of (await st()).sector.breaches){if(!b.live)continue;assert.equal(await evaluate(`${T}.sectorClose(${JSON.stringify(b.id)},"gunship")`),'gunship',`breach ${b.id} sealed`);}
 assert((await st()).sector.breaches.every((b)=>!b.live),'both breaches are closed');
 await evaluate(`${T}.sectorClearField()`);await until(`${T}.state().sector.secure`,30000);await until(`${T}.state().sector.debriefOpen`,20000);await delay(1500);
 assert(await evaluate('!!document.querySelector(".sdb-root:not([hidden])")'),'the debrief card is up');
 {const pages=+(await evaluate('document.querySelector(".sdb-root").dataset.pages'));assert(pages>=2,`a multi-page report (${pages})`);
  await thumb('.sdb-acts .sdb-btn','NEXT');await reachable('.sdb-acts .sdb-btn','NEXT');await layout(['.sdb-frame'],'the debrief');
  // a tap on the page completes it, the next tap advances: page 0 to page 1 by two thumbs on the body
  const body=await centre('.sdb-body');await tapAt(body.x,body.y);await delay(200);await tapAt(body.x,body.y);await delay(300);
  assert.equal(await evaluate('document.querySelector(".sdb-root").dataset.page'),'1','two taps on the page turn it');
  current='phone-debrief';await finish();
  // NEXT to the last page, where CONTINUE stands
  for(let i=1;i<pages-1;i++){await tap('.sdb-acts [data-act=next]','NEXT');await delay(250);}
  assert.equal(await evaluate('document.querySelector(".sdb-root").dataset.page'),String(pages-1),'on the last page');
  await thumb('.sdb-acts [data-act=continue]','CONTINUE');await reachable('.sdb-acts [data-act=continue]','CONTINUE');
  current='phone-debrief-last';await finish();
  await tap('.sdb-acts [data-act=continue]','CONTINUE');
  await until(`${T}.state().sector.n===3 && !${T}.state().sector.debriefOpen`,15000);}
 current='phone-sector-3';await finish();
 // 9. LANDSCAPE, 844x390. Portrait is the layout this pass rules; landscape is held to the contract that matters —
 // every control a thumb can reach at 44 px and no control under another. The read-only cards (the coach, the wave and
 // tower announcements, the sector brief, Isao) are 87 px short of the height their lane was ruled for and still stack
 // here; they are captions over a board, never a control, so they are shown rather than pulled apart. Portrait holds
 // all of CHROME apart.
 W=844;H=390;await phone('phone-landscape','index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&fps=0#td',W,H);
 await until(`!!${T} && (${T}.state().storyLod||[]).some(l=>l.id==="stalheart")`,90000);await evaluate(`${T}.sectorQuiet(true)`);
 await until(`!${T}.state().deploying`,60000).catch(()=>{});await delay(1500);
 for(const s of [...PAD,'#story-views [data-view=tank]','#story-views [data-mount=gunship]','#mob-mode']){await thumb(s);await reachable(s);}
 await layout([...PAD,'#story-views','#mob-mode','#shell-bar','#tab-td .minimap','#td-launch'],'landscape');
 await shown('#td-stats','the landscape HUD');   /* the sector brief and Isao's card come and go on their own clocks; the HUD is always up */
 await finish();
 } else if(args.includes('--nav')) {
 // THE NAVIGATION SHELL: PLAYTEST | DEV on every screen, the drawer by toggle and backslash, an Esc that never reaches
 // the game, tuning and docs over a running game without navigating, a felt-it note that survives a reload
 const key=async(k,code)=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code});await delay(250);};
 const visible=sel=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return false;const r=e.getBoundingClientRect();return getComputedStyle(e).display!=="none"&&r.width>0&&r.height>0;})()`);
 const open=()=>evaluate('document.body.classList.contains("shell-open")');
 const tap=async sel=>{await evaluate(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:"nearest"})`);await click(sel);};   // the DEV drawer scrolls once tuning fills it
 await go('nav-game','index.html?sw=0&acceptance=1&story=1#td');await until('!!window.__stalheartTest',90000);await delay(1500);
 assert(await visible('#shell-bar .shell-toggle'),'the toggle is on the game');
 assert(await evaluate('!!document.querySelector("#shell-bar #build-tag")'),'the build tag is joined to the toggle');
 assert(!(await visible('#vars-toggle'))&&!(await visible('#td-link'))&&!(await evaluate('!!document.querySelector("#tabbar,#chrome-toggle,#story-skips")')),'no tab bar, menu, gear, link or skip panel remains');
 assert.equal(await evaluate('document.querySelector("#shell-bar [data-mode=playtest]").classList.contains("current")'),true,'a story stage loads in PLAYTEST');
 assert.equal(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),!production,'DEV is offered on the source tree and hidden on a release');
 const href=await evaluate('location.href');
 await key('\\','Backslash');assert(await open(),'backslash opens the drawer');
 assert(await visible('#shell-nav [data-entry=story].active'),'the drawer marks where we are');
 await evaluate('window.__escSeen=0;document.addEventListener("keydown",e=>{if(e.key==="Escape")window.__escSeen++;})');
 await key('Escape','Escape');assert.equal(await open(),false,'Esc closes the drawer');assert.equal(await evaluate('window.__escSeen'),0,'the Esc that closed the drawer never reached the game');
 await finish();
 if(!production){
  await click('#shell-bar [data-mode=dev]');await delay(300);
  assert(await visible('#shell-nav section[data-mode=dev]')&&!(await visible('#shell-nav section[data-mode=playtest]')),'DEV opens its own drawer');
  await click('#shell-bar [data-mode=playtest]');await delay(300);
  assert(await visible('#shell-nav section[data-mode=playtest]')&&await open(),'PLAYTEST opens its drawer again');
  assert.equal(await evaluate('location.href'),href,'switching modes never navigates');
  current='nav-switch';await finish();
  await click('#shell-bar [data-mode=dev]');await delay(300);await until('!!document.querySelector("#shell-nav [data-tuning=bloom]")');
  await tap('#shell-nav [data-tuning=bloom]');await delay(300);
  assert(await evaluate('document.body.classList.contains("vars-open")'),'DEV · Tuning · bloom opens the variables');
  assert.equal(await evaluate('document.querySelector("#td-vars .vars-nav button.active").textContent'),'bloom','on its bloom page');
  await evaluate('document.querySelector("#td-vars .vars-page.active input").focus()');await key('\\','Backslash');
  assert.equal(await open(),false,'a backslash typed into a variable does not open the drawer');
  current='nav-tuning';await finish();
  await evaluate('document.body.classList.remove("vars-open");document.activeElement?.blur()');
  await click('#shell-bar [data-mode=dev]');await delay(300);
  await tap('#shell-nav [data-entry=doc-funmap]');await until('document.querySelectorAll("#docs-overlay .nt-body h2").length>2');
  assert(!(await evaluate('document.querySelector("#docs-overlay").textContent.includes("unavailable")')),'the FunMap was fetched');
  assert.equal(await evaluate('location.href'),href,'the docs open over the game without navigating');
  current='nav-funmap';await finish();
  await key('Escape','Escape');assert(await evaluate('document.querySelector("#docs-overlay").hidden'),'Esc closes the docs');
  await click('#shell-bar [data-mode=dev]');await delay(300);await tap('#shell-nav [data-entry=tool-felt]');await until('!!document.querySelector("#felt-capture:not([hidden])")');
  await evaluate('(()=>{document.querySelector("#felt-capture [data-text]").value="the first rotor burst felt great";document.querySelector("#felt-capture [data-lesson]").value="R13";})()');
  await click('#felt-capture [data-save]');await delay(200);
  await go('nav-felt-reload','index.html?sw=0&acceptance=1&story=1#td');await delay(1500);
  await click('#shell-bar [data-mode=dev]');await delay(300);await tap('#shell-nav [data-entry=tool-felt]');await until('!!document.querySelector("#felt-capture:not([hidden])")');
  assert(await evaluate('document.querySelector("#felt-capture [data-list]").textContent.includes("the first rotor burst felt great")'),'a felt-it note survives a reload');
  await click('#felt-capture [data-copy=md]');await delay(200);
  assert.match(await evaluate('document.querySelector("#felt-capture [data-export]").value'),/^- \d{4}-\d{2}-\d{2} · the first rotor burst felt great · R13$/m,'it copies as a FunMap line');
  await finish();
  await go('nav-lab','labs.html?sw=0#beam');await delay(1000);
  assert.equal(await evaluate('document.querySelector("#shell-bar [data-mode=dev]").classList.contains("current")'),true,'a workshop lab loads in DEV');
  await click('#shell-bar [data-mode=dev]');await delay(300);
  assert(!(await visible('#shell-nav [data-group=tuning]')),'no tuning where the page has no variables');
  await finish();
  // TOUCH: no DEV on a phone, and PLAYTEST's own targets meet the 44px minimum
  await go('nav-phone','index.html?sw=0&acceptance=1&story=1&coarse=1#td',844,390);await delay(1500);
  assert(!(await visible('#shell-bar [data-mode=dev]')),'no DEV toggle on a phone');
  assert((await evaluate('document.querySelector("#shell-bar [data-mode=playtest]").getBoundingClientRect().height'))>=44,'the PLAYTEST toggle meets the 44px touch target');
  await click('#shell-bar [data-mode=playtest]');await delay(300);
  const stage=await evaluate('(()=>{const r=document.querySelector("#shell-nav .shell-small").getBoundingClientRect();return {w:r.width,h:r.height};})()');
  assert(stage.h>=44&&stage.w>=44,`a .shell-small stage button meets the 44px touch target (${JSON.stringify(stage)})`);
  await finish();
  // NARROW DESKTOP: a fine pointer under 700px wide still gets the beam lab's lil-gui panel
  await go('nav-narrow-lab','labs.html?sw=0#beam',680,800);await delay(1500);
  assert(await evaluate('(()=>{const e=document.querySelector(".tab:not(.tab-hidden) .lil-gui.root")||document.querySelector(".lil-gui.root");return !!e&&getComputedStyle(e).display!=="none";})()'),'the beam lab panel opens in a narrow desktop window');
  await finish();
  // THE OVERLAYS OWN THE KEYBOARD IN THE SEAT: the seat's key listener is added after the shell's, and it used to swallow
  // Esc and take Space as the trigger while the FunMap was open. Read the FunMap from the gunship: Space does not fire,
  // typing into find still types, Esc closes it, and Space is the trigger again once it is gone.
  await go('nav-seat-docs','index.html?sw=0&cine=0&world=story&stage=6&acceptance=1&gunship=station&skip=gunship&enemies=0&brief=0#td');
  await until('!!window.__stalheartTest && window.__stalheartTest.state().gunship.seat',120000);await delay(1500);
  await evaluate('window.__stalheartTest.gunshipGun("rotary")');await delay(300);
  {const rotary=async()=>(await evaluate('window.__stalheartTest.state().explosions')).spawned?.['gunship.rotary']??0;
   const trigger=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await delay(700);await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});await delay(2400);};
   await click('#shell-bar [data-mode=dev]');await delay(300);await tap('#shell-nav [data-entry=doc-funmap]');await until('document.querySelectorAll("#docs-overlay .nt-body h2").length>2');
   await evaluate('document.activeElement?.blur()');
   const before=await rotary(),heat=(await evaluate('window.__stalheartTest.state().gunship')).heat;await trigger();
   assert.equal(await rotary(),before,'Space over the FunMap in the seat does not fire the gun');
   assert.equal((await evaluate('window.__stalheartTest.state().gunship')).heat,heat,'nor heat the barrels');
   await evaluate('document.querySelector("#docs-overlay [data-find]").focus()');
   for(const c of 'ram')await send('Input.dispatchKeyEvent',{type:'keyDown',key:c,code:'Key'+c.toUpperCase(),text:c}),await send('Input.dispatchKeyEvent',{type:'keyUp',key:c,code:'Key'+c.toUpperCase()});
   assert.equal(await evaluate('document.querySelector("#docs-overlay [data-find]").value'),'ram','typing into find still types');
   current='nav-seat-docs';await finish();
   await key('Escape','Escape');assert(await evaluate('document.querySelector("#docs-overlay").hidden'),'Esc closes the docs in the seat');
   assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'and the gunner is still seated');
   await evaluate('document.activeElement?.blur()');await trigger();
   assert(await rotary()>before,`Space fires again once the docs are closed (${JSON.stringify(await evaluate('window.__stalheartTest.state().explosions'))})`);}
  current='nav-seat-fires';await finish();
 } else {
  await go('nav-dist-dev','index.html?sw=0&acceptance=1&story=1&dev=1#td');await delay(1000);
  assert(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),'?dev=1 offers DEV on a release');await finish();
  await go('nav-dist-remembered','index.html?sw=0&acceptance=1&story=1#td');await delay(1000);
  assert(await evaluate('!!document.querySelector("#shell-bar [data-mode=dev]")'),'and remembers it');await finish();
 }
 } else if(args.includes('--sectors')) {
 // THE SECTOR LOOP (src/fx/sector-run.js, docs/superpowers/specs/2026-09-15-v1-session-design.md): past the handover sector 1
 // briefs and opens two breaches; each sends its own programme; one closed early through a real seal path (the gunship's 105)
 // books what it would have paid, the other held to its last wave collapses on its own and pays HELD; with the field clear the
 // sector is SECURE and the debrief card opens on a report that keeps the contract; CONTINUE starts sector 2
 const { checkReport } = await import('../src/domain/sector-stats.js');
 const T='window.__stalheartTest', sec=()=>evaluate(`${T}.state().sector`);
 await go('sectors-handover','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until(`!!${T} && (${T}.state().storyLod||[]).some(l=>l.id==="stalheart")`,90000);
 // a playable base (QA 2026-09-16: the jump starts with no towers): the story's Rotor and Quiver on their sockets
 {const socks=(await sec()).sockets;assert(socks.length>=2,`the story sockets (${socks})`);
  assert(await evaluate(`${T}.commitTower('rotor',${socks[0]})`),'a Rotor on its socket');assert(await evaluate(`${T}.commitTower('quiver',${socks[1]})`),'a Quiver on its socket');}
 await until(`["brief","fighting"].includes(${T}.state().sector.phase)`,30000);
 {const s=await sec();assert.equal(s.n,1);assert.equal(s.name,'THE LANE');
  assert(await evaluate('/SECTOR 1 · THE LANE/.test(document.querySelector("#sector-card")?.textContent||"")'),'the brief card names the sector (the breaches open under it)');
  const hud=await evaluate('document.querySelector("#td-stats")?.textContent||""');
  assert(/SECTOR 1 · THE LANE/.test(hud),`the HUD carries the sector line (${hud})`);assert(!/of sector \d|TERRAFORMER/.test(hud),`no campaign lines in the story HUD (${hud})`);}
 current='sectors-brief';await finish();
 await until(`(()=>{const b=${T}.state().sector.breaches;return b.length===2&&b.every(x=>x.live);})()`,40000);
 {const s=await sec();assert.deepEqual(s.breaches.map(b=>b.side),['gate','gate'],'sector 1: two breaches on the gate side');assert.notEqual(s.breaches[0].cell,s.breaches[1].cell);
  assert(/BREACHES 2/.test(await evaluate('document.querySelector("#td-stats").textContent')),'the HUD counts both breaches');
  assert.equal(s.strays,0,'every live breach is the sector\'s: the opening\'s sinkhole caved in');assert(!/SECTOR \d+ SECTOR/.test(await evaluate('document.querySelector("#td-stats").textContent')),'the HUD names the sector once');}
 current='sectors-two-breaches';await finish();
 // breach A: one wave out, then the 105 seals it; its remaining waves are left in the field
 await evaluate(`${T}.sectorRelease("A")`);
 {assert.equal(await evaluate(`${T}.sectorClose("A","gunship")`),'gunship','the 105 sealed breach A');
  const a=(await sec()).breaches[0];assert(!a.live,'A is sealed');assert(a.leftInField.kg>0&&a.leftInField.points>0,`the forfeit is booked (${JSON.stringify(a)})`);}
 current='sectors-closed-early';await finish();
 // breach B: every wave out; once the last has emerged it collapses on its own and pays HELD
 await until(`(()=>{const b=${T}.state().sector.breaches[1];if(b.wavesReleased<b.wavesPlanned)${T}.sectorRelease("B");return ${T}.state().sector.breaches[1].wavesReleased>=b.wavesPlanned;})()`,30000);
 await until(`${T}.state().sector.breaches[1].closedBy==="held"`,90000).catch(async()=>assert.fail(`B never collapsed (${JSON.stringify(await sec())} queued ${await evaluate(`${T}.state().queued`)})`));
 assert((await sec()).breaches[1].bonus.kg>0,'HELD pays');
 // THE BACK DOOR RUMBLED (2026-09-24): with B's whole programme out, the rumble and the crack have both come, and the radar holds
 // a tremor contact on the mouth's bearing until it falls
 {const s=await sec();assert.deepEqual(s.omens,['rumble','crack'],`sector 1 foreshadows the back door (${JSON.stringify(s.omens)})`);
  assert.equal(await evaluate(`${T}.state().storyHud?.tremor`),true,'the tremor contact is on the radar');}
 current='sectors-held';await finish();
 // A FAULT IN THE FRAME (2026-09-25): the world keeps running and drawing, and the fault is reported once, not once a frame
 {const c0=await evaluate(`${T}.state().shieldClock`);assert(await evaluate(`${T}.faultOnce()`),'a fault is injected');await delay(1500);
  const c1=await evaluate(`${T}.state().shieldClock`);assert(c1>c0+0.5,`the game clock runs on through the fault (${c0} -> ${c1})`);
  assert.equal(errors.filter(x=>/injected frame fault/.test(x)).length,1,`the fault reaches the page's error handlers once (${JSON.stringify(errors)})`);
  const ring=await evaluate(`window.__stalheart.diagnostics().events.filter(e=>e.type==='error'&&/injected frame fault/.test(e.data.message)).length`);assert.equal(ring,1,'and the diagnostics ring once');
  errors.length=0;}
 await evaluate(`${T}.sectorClearField()`);
 // THE DEAD ARE LET GO (2026-09-25): a cleared field holds no dead records, only the living (the expedition sites' guards)
 await until(`${T}.state().enemyRecords===${T}.state().enemiesAlive`,5000).catch(async()=>assert.fail(`dead records kept (${await evaluate(`JSON.stringify([${T}.state().enemyRecords,${T}.state().enemiesAlive])`)})`));
 await until(`${T}.state().sector.secure`,20000).catch(async()=>assert.fail(`not secure (${JSON.stringify(await sec())} enemies ${await evaluate(`${T}.state().performance?.enemies`)})`));
 current='sectors-secure';await finish();
 await until(`${T}.state().sector.debriefOpen`,15000);
 {const r=await evaluate(`${T}.sectorReport()`);assert.deepEqual(checkReport(r),[],'the report keeps the contract');assert.equal(r.outcome,'secure');
  assert.deepEqual(r.breaches.map(b=>b.closedBy),['gunship','held'],'who closed each breach');assert(r.biomass.leftInField>0,'left in the field');assert(r.score.bonuses>0,'the held bonus scored');
  assert(await evaluate('!!document.querySelector(".sdb-root:not([hidden])")'),'the debrief card is on screen');}
 await delay(1500);current='sectors-debrief';await finish();
 await evaluate(`${T}.sectorContinue()`);
 await until(`${T}.state().sector.n===2 && !${T}.state().sector.debriefOpen && !${T}.state().paused`,15000);
 current='sectors-sector-2-brief';await finish();
 // THE FEAST, THEN THE SCRAMBLE (2026-09-24): the back breach opens first and the clock sends its soft flood; the gate side waits
 // until the flood is mostly down, then Isao asks for turrets and the gate side opens
 await until(`(()=>{const b=${T}.state().sector.breaches;return b.length===2&&b[0].live;})()`,60000);
 {const s=await sec();assert.equal(s.breaches[0].side,'back','the back breach opens first');assert(!s.breaches[1].opened,'the gate side waits for the feast');}
 await until(`!!${T}.state().sector.feast`,60000).catch(async()=>assert.fail(`the clock sends the feast (${JSON.stringify(await sec())})`));
 await until(`${T}.state().performance.enemies>=30`,30000);
 current='sectors-feast';await finish();
 await evaluate(`${T}.sectorClearField()`);
 await until(`${T}.state().sector.feast.scrambled`,10000).catch(async()=>assert.fail(`the scramble once the feast is down (${JSON.stringify(await sec())})`));
 await until(`(()=>{const b=${T}.state().sector.breaches;return b.length===2&&b.every(x=>x.live);})()`,40000);
 current='sectors-sector-2';await finish();
 // SECTOR 2 COMPLETES (QA 2026-09-16): the back door's breach fights too, both are held to their last wave, SECURE, and a fresh report
 {const s=await sec();assert.deepEqual(s.breaches.map(b=>b.side).sort(),['back','gate'],'sector 2: one gate breach, one behind the bays');assert.equal(s.strays,0,'no stray breach in sector 2');
  assert.equal(await evaluate(`${T}.sectorReport()`),null,'the new sector cleared the last report');}
 await until(`(()=>{document.querySelector('#gunship-briefing:not([hidden]) [data-skip]')?.click();const S=${T}.state().sector;for(const b of S.breaches)if(b.live&&b.wavesReleased<b.wavesPlanned)${T}.sectorRelease(b.id);if(S.breaches.every(b=>!b.live||b.wavesReleased>=b.wavesPlanned))${T}.sectorClearField();return S.breaches.every(b=>b.closedBy);})()`,120000).catch(async()=>assert.fail(`sector 2's breaches never closed (${JSON.stringify(await sec())})`));
 await evaluate(`${T}.sectorClearField()`);
 await until(`${T}.state().sector.secure`,30000).catch(async()=>assert.fail(`sector 2 not secure (${JSON.stringify(await sec())})`));
 current='sectors-sector-2-secure';await finish();
 await until(`${T}.state().sector.debriefOpen`,15000);
 {const r=await evaluate(`${T}.sectorReport()`);assert.deepEqual(checkReport(r),[],'sector 2\'s report keeps the contract');assert.equal(r.sector,2);assert.equal(r.outcome,'secure');
  assert.deepEqual(r.breaches.map(b=>b.side).sort(),['back','gate'],'the back breach is in the books');assert(r.breaches.every(b=>b.closedBy),`every breach closed or held (${JSON.stringify(r.breaches)})`);
  console.log(`PASS sector 2 secure: ${r.seconds}s, kills ${r.kills.total}, breaches ${r.breaches.map(b=>`${b.id}/${b.side}/${b.closedBy}/${b.wavesFought}of${b.wavesPlanned}`).join(' ')}, prints [${r.colony.prints}]`);}
 await delay(1500);current='sectors-sector-2-debrief';await finish();
 } else if(args.includes('--waves')) {
 // THE RESHAPED PROGRAMMES UNDER LOAD (owner, 2026-09-16: "hundreds of low levels ... testing the fps of the browser"). Drive the
 // sector loop forward, then release a whole programme from every live breach WITHOUT clearing the field and sample frame times
 // while the bodies pile up. Reports rather than asserts a frame budget: the numbers are the point, and the machine is the machine.
 const T='window.__stalheartTest', sec=()=>evaluate(`${T}.state().sector`);
 await go('waves-load','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until(`!!${T} && (${T}.state().storyLod||[]).some(l=>l.id==="stalheart")`,90000);
 {const s=await sec();if(s.sockets&&s.sockets.length>=2){await evaluate(`${T}.commitTower('rotor',${s.sockets[0]})`);await evaluate(`${T}.commitTower('quiver',${s.sockets[1]})`);}}
 const reach=parseInt(args.find(a=>a.startsWith('--sector='))?.split('=')[1]??'3',10);
 // sectors before the one under test, the quick way: every wave out, the field cleared by hand, CONTINUE
 for(let n=1;n<reach;n++){
  try{
   /* the back door's sector opens its gate side only after the feast is down (2026-09-24): release the feast and clear it */
   await until(`(()=>{const S=${T}.state().sector;if(S.phase==="fighting"&&S.breaches.some(b=>b.side==="back"&&b.opened&&b.wavesReleased===0))${T}.sectorRelease(S.breaches.find(b=>b.side==="back").id);if(S.feast&&!S.feast.scrambled)${T}.sectorClearField();return S.phase==="fighting"&&S.breaches.every(b=>b.opened);})()`,120000);
   await until(`(()=>{const S=${T}.state().sector;for(const b of S.breaches)if(b.live&&b.wavesReleased<b.wavesPlanned)${T}.sectorRelease(b.id);return S.breaches.every(b=>!b.live||b.wavesReleased>=b.wavesPlanned);})()`,120000);
   await evaluate(`${T}.sectorClearField()`);
   await until(`${T}.state().sector.secure`,90000);
   await until(`${T}.state().sector.debriefOpen`,30000);
   await evaluate(`${T}.sectorContinue()`);
   await until(`${T}.state().sector.n===${n+1}`,30000);
   console.log(`WAVES sector ${n} cleared`);
  }catch(e){console.log(`WAVES stopped short at sector ${n}: ${e.message}`);break;}
 }
 const at=await sec();
 await until(`(()=>{const S=${T}.state().sector;if(S.phase==="fighting"&&S.breaches.some(b=>b.side==="back"&&b.opened&&b.wavesReleased===0))${T}.sectorRelease(S.breaches.find(b=>b.side==="back").id);if(S.feast&&!S.feast.scrambled)${T}.sectorClearField();return S.phase==="fighting"&&S.breaches.every(b=>b.opened);})()`,120000).catch(()=>{});
 if(args.includes('--last')){
  // ONE wave from every breach, which is what the game actually puts on the ground at once (the next wave waits for a cleared
  // field): walk the programme to its last wave, clearing between each, then release that biggest wave and measure it alone.
  await until(`(()=>{const S=${T}.state().sector;if(!S.breaches.some(b=>b.live&&b.wavesReleased<b.wavesPlanned-1))return true;for(const b of S.breaches)if(b.live&&b.wavesReleased<b.wavesPlanned-1)${T}.sectorRelease(b.id);${T}.sectorClearField();return false;})()`,180000).catch(()=>{});
  await evaluate(`${T}.sectorClearField()`);await delay(1200);
  await evaluate(`(()=>{const S=${T}.state().sector;for(const b of S.breaches)if(b.live)${T}.sectorRelease(b.id);})()`);
 } else {
  // the whole programme out of every live breach at once: a deliberate overload, several times the real peak
  await evaluate(`(()=>{const S=${T}.state().sector;for(let k=0;k<20;k++)for(const b of S.breaches)if(b.live)${T}.sectorRelease(b.id);})()`);
 }
 const probe=await evaluate(`new Promise(res=>{const T=window.__stalheartTest,f=[],t0=performance.now();let prev=t0,peak=0;const tick=()=>{const now=performance.now();f.push(now-prev);prev=now;peak=Math.max(peak,T.state().performance?.enemies||0);if(now-t0<12000)requestAnimationFrame(tick);else{const s=f.slice(1).sort((a,b)=>a-b);res({frames:s.length,p50:+s[Math.floor(s.length*0.5)].toFixed(2),p95:+s[Math.floor(s.length*0.95)].toFixed(2),max:+s[s.length-1].toFixed(2),peak});}};requestAnimationFrame(tick);})`);
 const after=await sec();
 console.log(`WAVES sector ${after.n} (${after.name}): peak concurrent ${probe.peak}, frame ms p50 ${probe.p50} p95 ${probe.p95} max ${probe.max} over ${probe.frames} frames`);
 console.log(`WAVES breaches ${after.breaches.map(b=>`${b.id}/${b.side} ${b.wavesReleased}of${b.wavesPlanned}`).join(' ')} (entered sector ${at.n})`);
 current='waves-pile';await finish();
 } else if(args.includes('--defense')) {
 // THE HANDOVER (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): past the Quiver the towers fire
 // on their own and the wave clock runs; the gunship waits for an earned call; the tank clears a nest and brings a part home
 await go('defense-handover','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);
 // the sector loop's waves and gate wear would take a one-Rotor base down mid-run (--sectors covers the loop); this step is about the handover's systems
 await evaluate('window.__stalheartTest.sectorQuiet(true)');await delay(2500);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.story.phase,'expedition','the jump lands past the handover');assert.equal(s.automated,true,'automated');
  assert.equal(await evaluate('document.querySelectorAll("#story-views [data-mount]:not([data-mount=gunship])").length'),0,'no tower mounts after the handover');
  assert(await evaluate('!!document.querySelector("#story-views [data-view=tank]")'),'the tank is offered');
  assert(/GUNSHIP · \d+%$/.test(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent')),'the gunship button shows the call-in meter');
  assert(s.expeditions.sites.filter(x=>x.state==='guarded').length===3,'the first three sites are guarded');}
 await finish();
 // THE CONTROLS ARE TAUGHT (src/fx/controls-card.js): the tank is ours past the handover, so the card is up once; H hides it and brings it back
 assert.equal(await evaluate('document.querySelector("#controls-card")?.hidden'),false,'the controls card shows the first time the tank is ours');
 assert.match(await evaluate('document.querySelector("#controls-card").textContent'),/Space\s*fire a shell/,'the card lists the real keys');
 current='defense-controls-card';await finish();
 for(const shown of [false,true]){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'h',code:'KeyH'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'h',code:'KeyH'});await delay(150);assert.equal(await evaluate('!document.querySelector("#controls-card").hidden'),shown,`H ${shown?'brings the card back':'hides it'}`);}
 await evaluate('document.querySelector("#controls-card [data-close]").click()');
 // towers fire on their own: a Rotor on its story socket kills raised fodder with no pilot
 {const ci=await evaluate('window.__stalheartTest.state().story.socket');assert(await evaluate(`window.__stalheartTest.commitTower('rotor',${JSON.stringify(ci)})`),'a Rotor stands on the story socket');
  const before=await evaluate('window.__stalheartTest.state().killsBySrc.tower');await evaluate('window.__stalheartTest.spawnFodder(20)');
  await until(`window.__stalheartTest.state().killsBySrc.tower>${before}`,120000).catch(async()=>assert.fail(`no unpiloted tower kill (${JSON.stringify(await evaluate('window.__stalheartTest.state().killsBySrc'))})`));}
 current='defense-towers-fire';await finish();
 // the call-in: fill, call, take the seat
 await evaluate('window.__stalheartTest.fillGunshipCall(100000)');await delay(400);
 assert.equal(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent'),'GUNSHIP · CALL','a full meter lights the call');
 await evaluate('document.querySelector("#story-views [data-mount=gunship]").click()');await delay(1200);
 await evaluate('document.querySelector("#gunship-briefing [data-skip]")?.click()');
 await until('window.__stalheartTest.state().gunship.station && window.__stalheartTest.state().gunship.seat',15000);
 assert.equal((await evaluate('window.__stalheartTest.state().gunshipCall')).overhead,true,'the pass is overhead');
 current='defense-gunship-called';await finish();
 // THE TOWERS ARE NOT SILENCED BY THE SEAT: the gunship is ridden and its trigger untouched, and a tower still kills on its own
 {const before=await evaluate('window.__stalheartTest.state().killsBySrc.tower');await evaluate('window.__stalheartTest.spawnFodder(20)');
  await until(`window.__stalheartTest.state().killsBySrc.tower>${before}`,60000).catch(async()=>assert.fail(`towers keep firing while the gunship is ridden (${JSON.stringify(await evaluate('window.__stalheartTest.state().killsBySrc'))})`));}
 current='defense-towers-under-gunship';await finish();
 await evaluate('document.querySelector("#story-views [data-view=tank]").click()');await delay(800);
 // an expedition: clear rocket-a's nest, reach the site, bring the part to the foundry
 {const cells=await evaluate('window.__stalheartTest.siteCells()');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="guarded"',5000);
  await delay(4000);await evaluate('window.__stalheartTest.killGuards("rocket-a")');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="cleared"',10000);
  // SEEN AND HEARD (docs/superpowers/specs/2026-09-15-v1-session-design.md section 3): our flag goes up over the cleared site
  await until('(window.__stalheartTest.state().cargo?.flags||[]).some(f=>f.id==="rocket-a"&&f.state==="up"&&f.ready)',30000).catch(async()=>assert.fail(`the flag is raised (${JSON.stringify(await evaluate('window.__stalheartTest.state().cargo'))})`));
  {const v=await evaluate('window.__stalheartTest.cargoView("flag","rocket-a")');assert(v,'a close look at the site flag');writeFileSync(join(output,'defense-flag-raised-view.json'),JSON.stringify(v,null,1));}await delay(500);
  current='defense-flag-raised';await finish();
  await evaluate('window.__stalheartTest.cargoView(null)');
  // the site's own cell is the lander: stand beside it, within reach, so the tank camera sees the crate come aboard
  {const stand=await evaluate('window.__stalheartTest.cargoStand("site","rocket-a")');assert(stand>=0&&stand!==cells['rocket-a'].cell,`a stand cell beside rocket-a (${stand})`);
   await evaluate(`window.__stalheartTest.placeTank(${stand})`);}
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-a"',10000);
  await until('window.__stalheartTest.state().cargo.attached===true',10000).catch(async()=>assert.fail(`the crate rides the back deck (${JSON.stringify(await evaluate('window.__stalheartTest.state().cargo'))})`));
  {const c=await evaluate('window.__stalheartTest.state().cargo');assert.equal(c.carrying,'rocket-a','the crate on the deck is the site\'s part');assert.deepEqual(c.errors,[],'the cargo assets load');
   assert(/PART SECURED · FIELD COIL/.test(await evaluate('document.querySelector("#td-callouts")?.textContent||""')),'the pickup callout');}
  await evaluate('window.__stalheartTest.cargoView(null)');await delay(700);   // the teleport left the chase camera behind: snap it to the tank
  writeFileSync(join(output,'defense-part-carried-view.json'),JSON.stringify(await evaluate('window.__stalheartTest.cargoView("tank")'),null,1));await delay(300);
  current='defense-part-carried';await finish();
  {const v=await evaluate('window.__stalheartTest.cargoView("crate")');assert(v,'a close look at the crate on the hull');writeFileSync(join(output,'defense-crate-on-hull-view.json'),JSON.stringify(v,null,1));}await delay(500);
  current='defense-crate-on-hull';await finish();
  await evaluate('window.__stalheartTest.cargoView(null)');
  // home is the foundry's own cell: deliver from open floor on the landing island, within the delivery radius
  {const stand=await evaluate('window.__stalheartTest.cargoStand("home")');assert(stand>=0,`a stand cell at home (${stand})`);
   await evaluate(`window.__stalheartTest.placeTank(${stand})`);}
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="delivered"',10000);
  const unlocked=await evaluate('window.__stalheartTest.state().unlocked');assert(unlocked.includes('relay'),`the Relay unlocks (${unlocked})`);
  // home: off the back deck, a landing, RELAY UNLOCKED, a trophy flag on the landing island
  await until('(s=>s.carrying===null&&s.crates.some(p=>p==="rest"))(window.__stalheartTest.state().cargo)',10000).catch(async()=>assert.fail(`the crate drops and sits (${JSON.stringify(await evaluate('window.__stalheartTest.state().cargo'))})`));
  // ISAO RECEIVES THE PART: the crate waits for him, he flies over and beams it, and only then the unlock is called
  {const c=await evaluate('window.__stalheartTest.state().cargo');assert.equal(c.receiving,true,`the crate is held for Isao (${JSON.stringify(c)})`);
   assert(!/RELAY UNLOCKED/.test(await evaluate('document.querySelector("#td-callouts")?.textContent||""')),'no unlock before he has the part');}
  {const v=await evaluate('window.__stalheartTest.cargoView("drop")');assert(v,'a close look at the dropped crate');writeFileSync(join(output,'defense-crate-dropped-view.json'),JSON.stringify(v,null,1));}await delay(500);
  current='defense-crate-dropped';await finish();
  await evaluate('window.__stalheartTest.cargoView(null)');   // a still is a shot, and a shot freezes Isao: let him fly
  await until('(p=>p&&p.isao&&p.isao.order==="receive"&&p.isao.state==="build")(window.__stalheartTest.state().programme)',30000).catch(async()=>assert.fail(`Isao flies to the crate and beams it (${JSON.stringify((await evaluate('window.__stalheartTest.state().programme'))?.isao)})`));
  await evaluate('window.__stalheartTest.cargoView("drop")');await delay(700);current='defense-part-received';await finish();
  await evaluate('window.__stalheartTest.cargoView(null)');
  await until('/RELAY UNLOCKED/.test(document.querySelector("#td-callouts")?.textContent||"")',10000).catch(()=>assert.fail('the unlock callout once he has beamed the crate'));
  {const c=await evaluate('window.__stalheartTest.state().cargo');assert.equal(c.receiving,false,'the receipt is done');}
  await until('window.__stalheartTest.state().cargo.trophies===1',10000);await delay(2600);
  assert(await evaluate('window.__stalheartTest.cargoView("trophy")'),'a close look at the trophy flag');await delay(500);
  current='defense-trophy';await finish();
  await evaluate('window.__stalheartTest.cargoView(null)');
  // a hull lost while carrying drops the part back at its site
  await delay(4000);await evaluate('window.__stalheartTest.killGuards("rocket-b")');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state==="cleared"',10000);
  await evaluate('window.__stalheartTest.placeTank(window.__stalheartTest.cargoStand("site","rocket-b"))');
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-b"',10000);
  await evaluate('window.__stalheartTest.hitTank()');await delay(600);
  assert.equal(await evaluate('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state'),'cleared','the part is back at its site');
  {const c=await evaluate('window.__stalheartTest.state().cargo');assert.equal(c.carrying,null,'the lost hull throws the crate off');
   assert(c.crates.some(p=>p==='tumble'||p==='fade'),`the crate tumbles (${c.crates})`);
   assert.equal(c.flags.find(f=>f.id==='rocket-b')?.state,'lowering','the site flag comes down');}}
 current='defense-part-dropped';await finish();
 } else if(args.includes('--pacing')) {
 // THE SESSION'S PACING, MEASURED (docs/superpowers/specs/2026-09-24-session-pacing-design.md E). A bare page at the full threat
 // plays from the landing into sector 2 in real time. The harness is an IDEAL DEFENDER: it aims the manned seat through the opening,
 // and in a sector every body that reaches a door dies there (sectorCull), so what it counts is the design's rhythm: when bodies
 // ARRIVE, not how well anyone kills them. Every beat, pulse and omen is a PACE line; ARRIVE lines are arrivals per 5 s; the summary
 // gives, per sector, the seconds from its card to the first arrival and the arrival gaps (seconds with nothing reaching a door).
 const T='window.__stalheartTest';
 await go('pacing-bare','index.html?sw=0&acceptance=1&cine=0&world=story&intro=0#td');
 await until(`!!${T}&&!!${T}.state().programme`,90000);
 await evaluate(`(()=>{const T=${T},P=window.__pace={t0:performance.now(),ev:[],arr:[],rows:[],last:{},aimAt:0,contAt:0,done:false,passive:${args.includes('--passive')}};
  /* GAME TIME, not the wall clock (2026-09-25): the game's clock advances at most 0.1 s a frame, so on a slow machine or beside a
     second suite the wall ran ahead of the game and every number here inflated. Stamps are the game's own t (state().shieldClock). */
  const now=()=>+(P.clock-P.clock0).toFixed(1),ev=(what)=>P.ev.push([now(),what]);
  const seen=(k,v,what)=>{if(P.last[k]!==v){P.last[k]=v;if(v!==undefined&&v!==null&&v!==false&&v!=='')ev(what(v));}};
  P.iv=setInterval(()=>{try{
   const s=T.state(),S=s.sector||{},pg=s.programme||{},st=s.story||{};P.clock=s.shieldClock;P.clock0??=P.clock;
   seen('phase',st.phase,v=>'story '+v);seen('active',pg.active,v=>'print begins '+v);seen('printed',(pg.printed||[]).join(),v=>'printed '+(pg.printed||[]).slice(-1)[0]);
   seen('heart',s.heart,v=>'heart '+v);seen('towers',s.towers,v=>'towers '+v);seen('hulls',s.hulls,v=>'hulls '+v);seen('deploying',s.deploying,v=>'hull deploying');seen('automated',s.automated,v=>'automated');
   seen('sector',S.n||null,v=>'sector '+v+' card');seen('sphase',S.phase,v=>'sector phase '+v);seen('debrief',S.debriefOpen,v=>'debrief');
   for(const b of S.breaches||[]){seen('open'+S.n+b.id,b.opened,v=>'breach '+b.id+' '+b.side+' opens');seen('rel'+S.n+b.id,b.wavesReleased||null,v=>'pulse '+b.id+' '+b.side+' wave '+v);}
   for(const g of S.gates||[])seen('broken'+g.id,g.broken,v=>g.id+' is down');
   seen('feast'+S.n,!!S.feast,v=>'feast released');seen('scr'+S.n,!!S.feast?.scrambled,v=>'scramble');seen('omens',(S.omens||[]).join(),v=>'omen '+(S.omens||[]).slice(-1)[0]);
   const fighting=S.phase==='fighting'||S.phase==='secure';
   if(fighting&&!P.passive){const n=T.sectorCull(8);if(n)P.arr.push([now(),n,S.n]);}
   if(fighting&&Math.floor(now())!==P.lastRow){P.lastRow=Math.floor(now());P.rows.push([P.lastRow,s.performance?.enemies??0,Math.round((S.gates||[]).reduce((m,g)=>Math.min(m,g.hp/g.max),1)*100),S.n]);}
   if(S.phase==='lost'||S.phase==='lost-shown'){ev('LOST');P.done=true;}
   const pt=window.__stalheartPilotTest;
   if(!s.automated&&pt){pt.hold(true);if(performance.now()-P.aimAt>500){P.aimAt=performance.now();try{pt.aimEnemy();}catch{}}}
   document.querySelector('#gunship-briefing:not([hidden]) [data-skip]')?.click();document.querySelector('#sol82-briefing:not([hidden]) [data-skip]')?.click();
   if(s.screenOpen)document.querySelector('#synthetic-modal [data-continue]')?.click();
   if(S.debriefOpen){if(!P.contAt)P.contAt=performance.now()+2500;else if(performance.now()>P.contAt){P.contAt=0;T.sectorContinue();}}
   if(S.n===2&&(S.breaches||[]).some(b=>b.side==='back'&&b.wavesReleased>=3))P.done=true;
  }catch(e){P.err=String(e);}},250);})()`);
 const t0=Date.now();
 while(Date.now()-t0<15*60000){await delay(5000);const p=await evaluate('({done:window.__pace.done,err:window.__pace.err,n:window.__pace.ev.length,last:window.__pace.ev.slice(-1)[0]})');if(p.err)console.log('PACE harness error '+p.err);if(p.done)break;}
 const P=await evaluate('(()=>{clearInterval(window.__pace.iv);return {ev:window.__pace.ev,arr:window.__pace.arr,rows:window.__pace.rows};})()');
 for(const [t,w] of P.ev)console.log(`PACE ${String(t).padStart(6)} ${w}`);
 const bins={};for(const [t,n] of P.arr){const b=Math.floor(t/5)*5;bins[b]=(bins[b]||0)+n;}
 console.log('ARRIVE '+Object.entries(bins).map(([b,n])=>`${b}:${n}`).join(' '));
 // ALIVE / GATE every 10 s while a sector fights: how big the pile is and how much of the weakest door is left
 console.log('FIELD '+P.rows.filter(r=>r[0]%10===0).map(r=>`${r[0]}:${r[1]}/${r[2]}%`).join(' '));
 const at=(re)=>P.ev.find(([,w])=>re.test(w))?.[0]??null;
 const summary={wallSeconds:+((Date.now()-t0)/1000).toFixed(0),gameSeconds:P.ev.length?P.ev[P.ev.length-1][0]:0,hullOut:at(/^hull deploying/),automated:at(/^automated/),sectors:{}};
 for(const n of [1,2]){
  const card=at(new RegExp(`^sector ${n} card`)),arr=P.arr.filter(a=>a[2]===n);
  if(card===null||!arr.length){summary.sectors[n]={card,arrivals:0};continue;}
  const secs=new Set(arr.map(a=>Math.floor(a[0])));const first=arr[0][0],last=arr[arr.length-1][0];
  let gap=0,longest=0,quiet=0;for(let t=Math.floor(first);t<=Math.floor(last);t++){if(secs.has(t)){gap=0;}else{gap++;quiet++;longest=Math.max(longest,gap);}}
  const minutes=Math.max(1/60,(last-first)/60);
  summary.sectors[n]={card,firstContact:+(first-card).toFixed(1),arrivals:arr.reduce((a,b)=>a+b[1],0),span:+(last-first).toFixed(0),longestGap:longest,quietPerMin:+(quiet/minutes).toFixed(1)};
 }
 console.log('PACE SUMMARY '+JSON.stringify(summary));
 writeFileSync(join(output,args.includes('--passive')?'pacing-passive.json':'pacing.json'),JSON.stringify({summary,events:P.ev,arrivals:P.arr,field:P.rows},null,1));
 current=args.includes('--passive')?'pacing-passive-end':'pacing-end';await finish();
 if(args.includes('--passive'))console.log('PACE PASSIVE: no defender at the doors; the towers alone '+(P.ev.some(([,w])=>w==='LOST')?'LOST the colony at '+P.ev.find(([,w])=>w==='LOST')[0]+' s':'held'));
 else{assert(summary.sectors[1]?.arrivals>0,'sector 1 is reached and fought');
 assert(summary.sectors[1].firstContact<=40,`sector 1's first body reaches a door within 40 s of its card (${summary.sectors[1].firstContact})`);
  if(summary.sectors[2]?.arrivals)assert(summary.sectors[2].firstContact<=40,`sector 2's feast reaches the back mouth within 40 s of its card (${summary.sectors[2].firstContact})`);}
 } else if(args.includes('--grow')) {
 // ISAO GROWS THE BASE (V1, 2026-09-16): a story page that names no stage grows; stage=1&grow=1 runs the whole opening to the handover
 // while Isao prints the gate (the tremor waits for it), the landing pad and the Stålheart, then the rest as the phases and sectors come.
 const hiddenNear='(window.__stalheartTest.state().storyLod||[]).filter(l=>!l.visible&&l.nearLoaded).map(l=>l.id)';
 const shotBase=async(name)=>{await evaluate('window.__stalheartTest.focusHeart()');await delay(1500);assert.deepEqual(await evaluate(hiddenNear),[],`${name}: no hidden landmark fetched its near tier`);current=name;await finish();};
 await go('grow-bare','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none#td');await until('!!window.__stalheartTest&&!!window.__stalheartTest.state().programme',90000);
 {const b=await evaluate('window.__stalheartTest.state()');assert.equal(b.programme.grow,true,'a story page with no stage grows its base');assert.equal(b.programme.next,'foundry','he works the recycler before he prints the gate');assert.equal(b.programme.gate.built,false);
  assert.equal(b.hull?.state,'held','SECTOR 0: a bare page has no hull until the Stålheart stands');}
 await finish();
 await go('grow-landing','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=1&grow=1#td');await until('!!window.__stalheartTest',90000);await delay(2500);
 const g0=await evaluate('window.__stalheartTest.state()');assert.equal(g0.programme.grow,true);assert.equal(g0.programme.gate.built,false,'no gate at the landing');assert.deepEqual(g0.programme.printed,[]);assert.deepEqual(g0.bays,[],'the bays are not printed yet');
 // SECTOR 0 (owner, 2026-09-24: "The Tank is built by the Stalheart"): the opening is Isao coming out and building; no MÖRK is drawn or driven
 assert.equal(g0.hull.state,'held','no hull at the landing');assert.equal(g0.hull.visible,false,'the hull is not drawn');assert(g0.hull.door>=0,`the Stålheart has a door to roll the hull out of (${JSON.stringify(g0.hull)})`);
 assert.deepEqual(await evaluate(hiddenNear),[]);await finish();
 const t0=Date.now(),mark=async(what)=>console.log(`GROW ${what} at ${((Date.now()-t0)/1000).toFixed(1)} s`);
 await mark('landed');
 await until('window.__stalheartTest.state().towers===1',120000);await mark('Rotor printed');
 // ISAO WORKS THE RECYCLER FIRST (owner, 2026-09-16): before the gate he flies to the AFR-01 and holds the beam on it. The beat prints
 // nothing, so nothing may stand at the end of it, and the gate must not be pushed materially later than the baseline 26.0 s
 await until('window.__stalheartTest.state().programme.active==="foundry"',60000);await mark('foundry beat begins');await delay(5000);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.programme.print.step,'foundry','his beam is on the AFR-01');
  assert(s.programme.print.k>0&&s.programme.print.k<1,`the beat is under way (k ${s.programme.print.k})`);
  assert.deepEqual(s.programme.printed,[],'working the recycler prints nothing');assert.equal(s.programme.gate.built,false);}
 current='grow-foundry-beam';await finish();
 await until('window.__stalheartTest.state().programme.printed.includes("foundry")',60000);await mark('foundry beat ends');
 await until('window.__stalheartTest.state().programme.active==="gate"',60000);const walls0=(await evaluate('window.__stalheartTest.state()')).wallCount;await mark('gate print begins');await delay(5000);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.story.phase,'rotor-ready','the tremor waits while the gate prints');assert.equal(s.programme.gate.built,false);assert.equal(s.wallCount,walls0,'the walls block only once they stand');assert(s.programme.print.step==='gate'&&s.programme.print.k>0,'the print is under way');}
 current='grow-gate-printing';await finish();
 await until('window.__stalheartTest.state().programme.printed.includes("gate")',90000);await mark('gate stands');
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.programme.gate.built,true);assert(s.wallCount>walls0&&s.wallCount<=walls0+12,`the walls are rock once printed (${walls0} -> ${s.wallCount})`);assert.notEqual(s.story.gateAt,null);}
 await until('window.__stalheartTest.state().story.phase==="tremor"',20000);await mark('tremor');current='grow-tremor';await finish();
 await until('window.__stalheartTest.state().story.phase==="breach"||window.__stalheartTest.state().story.spawned>0',40000);await mark('breach');
 await until('window.__stalheartTest.state().story.spawned>0',40000);await mark('first fodder');
 await until('window.__stalheartTest.state().towerCells.some(([k])=>k==="quiver")',60000);await mark('Quiver stands');   // ordered by the beats the moment the gate stood, ahead of the Stålheart in Isao's queue
 await until('(()=>{const p=window.__stalheartTest.state().programme;return p.isao?.state==="build"&&p.isao.order==="structure"&&p.print.step==="stalheart";})()',90000);await mark('Stålheart print begins');
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.programme.active,'stalheart');assert(!s.programme.printed.includes('landing'),'the Stålheart prints straight after the gate: the pad waits behind it');assert.equal(s.hull.state,'held');}
 await delay(8000);assert.deepEqual(await evaluate(hiddenNear),[]);
 assert(/STÅLHEART \d+%/.test(await evaluate('document.querySelector("#td-stats").textContent')),`the HUD reads the Stålheart's progress (${await evaluate('document.querySelector("#td-stats").textContent')})`);
 current='grow-stalheart-rising';await finish();
 await until('window.__stalheartTest.state().story.phase==="override"',150000);await mark('override');
 await until('!!window.__stalheartPilotTest',30000);await mark('first kill possible (the Rotor is the players)');await until('window.__stalheartTest.state().performance.enemies>0',60000);await delay(2000);current='grow-fodder';await finish();
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.said.includes("wave_cleared"))return true;const t=window.__stalheartPilotTest;if(!t||t.state().overheated)return false;t.aimEnemy();return false;})()',600000);
 await evaluate('window.__stalheartPilotTest?.hold(false)');await mark('first wave cleared');
 {const s=await evaluate('window.__stalheartTest.state()');const up=s.programme.printed.includes('stalheart');   // the hull is the Stålheart's: none while it prints, and no TANK on the strip
  assert.equal(s.hull.state==='held',!up,`no hull while the Stålheart prints, a hull once it stands (${JSON.stringify(s.hull)}, printed ${s.programme.printed})`);
  if(!up){assert.equal(s.hull.tankButton,false,'the strip offers no TANK before the hull is out');assert.equal(s.hull.visible,false);}}
 await until('window.__stalheartTest.state().story.phase==="quiver-piloting"',150000);await delay(600);await mark('Quiver optic');
 await evaluate('window.__stalheartPilotTest.hold(true)');
 // the player's hands in sector 0: re-aim every half second, and hop to the other mount when this one has had nothing in reach for 3 s
 const aimOn=(stop)=>`(()=>{const s=window.__stalheartTest.state();if(${stop})return true;const t=window.__stalheartPilotTest;if(!t)return false;if(!window.__aimAt||Date.now()-window.__aimAt>500){window.__aimAt=Date.now();if(t.aimEnemy())window.__seen=Date.now();else if(Date.now()-(window.__seen||0)>3000){window.__seen=Date.now();const k=t.state().key==='rotor'?'quiver':'rotor';document.querySelector('#story-views [data-mount="'+k+'"]')?.click();setTimeout(()=>window.__stalheartPilotTest?.hold(true),300);}}return false;})()`;
 const seat=async(key)=>{await evaluate(`document.querySelector('#story-views [data-mount="${key}"]')?.click()`);await delay(400);await evaluate('window.__stalheartPilotTest?.hold(true)');};
 await until(aimOn('["construction","settled","study-talk","study","expedition"].includes(s.story.phase)'),200000);
 if((await evaluate('window.__stalheartTest.state().story.phase'))==='construction'){await mark('construction (sector 0)');
  // SECTOR 0: the gunship arrives from orbit for a free pass, and waves rise from the sinkhole on a clock while the Stålheart prints
  {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.gunship.station,true,`the gunship is on station over the construction (${JSON.stringify(s.gunship)})`);assert.equal(s.automated,false,'the towers are still the player\'s: the seats are the fight');assert.equal(s.hull.state,'held');}
  await until(aimOn('s.story.construction.waves>=1'),30000);await mark('first construction wave');current='grow-construction';await finish();
  await seat('rotor');   // soft bodies: the Rotor's seat, as a player hops to it
  await until(aimOn('s.hull.state!=="held"'),150000);await mark('Stålheart stands, the hull rolls out');
  {const s=await evaluate('window.__stalheartTest.state()');assert(s.programme.printed.includes('stalheart'),'the hull comes out of the Stålheart once it stands');assert.equal(s.hull.tankButton,true,'TANK is offered with the hull');console.log(`  grow: ${s.story.construction.waves} construction wave(s), ${s.story.construction.sent} bodies sent, the hull ${s.hull.quiet?'set down under a gunner':'rolled out on camera'}`);}
  await delay(1200);current='grow-rollout';await finish();
  await until('window.__stalheartTest.state().hull.state==="out"',30000);await mark('hull out');
  {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.hull.visible,true,'the MÖRK is drawn');console.log(`  grow: ${s.performance.enemies} of sector 0 still on the field as the hull comes out (phase ${s.story.phase})`);}
  // SECTOR 0 ENDS WHEN ITS FIELD IS DOWN: the handover waits for the last of it (the automatic towers are too weak to mop it up),
  // cleared here from the seats; a player also has the new hull's rams and the gunship
  if((await evaluate('window.__stalheartTest.state().story.phase'))==='construction'){await seat('rotor');await until(aimOn('s.story.phase!=="construction"'),180000);await mark('sector 0 down');}}
 else{const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.hull.state,'out',`no construction only when the Stålheart already stood at the Quiver's clear (${JSON.stringify(s.hull)})`);}
 await until('["settled","study-talk","study","expedition"].includes(window.__stalheartTest.state().story.phase)',30000);
 await evaluate('window.__stalheartPilotTest?.hold(false)');await mark('settled (the handover)');current='grow-settled';await finish();
 {const seen=await evaluate('JSON.parse(localStorage.getItem("stalheart:v1:td.briefs")||"[]")');for(const id of ['stalheart_begins','gunship_overhead','stalheart_stands'])assert(seen.includes(id),`Isao said ${id} (${seen})`);}
 await until('window.__stalheartTest.state().screenOpen',60000);await mark('study screen');current='grow-study';await finish();
 await click('#synthetic-modal [data-continue]');await until('window.__stalheartTest.state().story.phase==="expedition"',8000);await mark('expedition');
 assert.equal(await evaluate('window.__stalheartTest.state().automated'),true,'the handover reached from a bare opening');
 await until('window.__stalheartTest.state().programme.printed.includes("landing")',90000);await mark('landing pad stands');
 await until('window.__stalheartTest.state().programme.active==="solar"',90000);await delay(7000);await shotBase('grow-solar-rising');
 await until('window.__stalheartTest.state().programme.printed.includes("solar")',90000);await mark('solar stands');
 {const s=await evaluate('window.__stalheartTest.state()');assert(s.programme.perks.includes('station'),'the array station is on');assert.equal(s.programme.next,'bays');}
 await delay(8000);{const s=await evaluate('window.__stalheartTest.state()');assert(s.programme.active===null||(s.sector?.n??0)>=1,`the bays wait for sector 1 (active ${s.programme.active}, sector ${s.sector?.n})`);}
 await evaluate('(window.__stalheartTest.state().sector?.n??0)>=1||window.__stalheartTest.setSector(1)');   // the sector loop owns story.sectorN once sector 1 starts; the test only stands in if it has not
 await until('window.__stalheartTest.state().programme.printed.includes("bays")',240000);await mark('bays stand');
 await until('window.__stalheartTest.state().bays.length===3',20000);{const s=await evaluate('window.__stalheartTest.state()');assert.deepEqual(s.bays.map(b=>b.ci),s.berthCells,'the printed bays are the berths');}
 await shotBase('grow-bays');
 await until('window.__stalheartTest.state().programme.printed.includes("hugin")',240000);await mark('HUGIN stands');assert((await evaluate('window.__stalheartTest.state().programme.perks')).includes('gunship'));
 await shotBase('grow-hugin');
 await evaluate('window.__stalheartTest.hitTank()');await delay(800);const hullsLost=(await evaluate('window.__stalheartTest.state()')).hulls;
 await evaluate('window.__stalheartTest.setSector(2)');
 await until('window.__stalheartTest.state().programme.printed.includes("assembly")',300000);await mark('radar and assembly line stand');
 {const s=await evaluate('window.__stalheartTest.state()');assert.deepEqual(s.programme.printed,['foundry','gate','stalheart','landing','solar','bays','hugin','radar','assembly'],'every step, in order');assert.equal(s.programme.next,'backgate','the back gate is all that is left, and it waits for the surprise');assert(!s.programme.perks.includes('backgate'));assert.deepEqual(s.programme.perks.slice().sort(),['gate','gunship','hulls','rebuild','stalheart','station','uplink']);assert.equal(s.hulls,hullsLost,'no rebuild inside the sector the line was printed in');}
 await evaluate('window.__stalheartTest.setSector(3)');await until(`window.__stalheartTest.state().hulls===${Math.min(3,hullsLost+1)}`,10000).catch(()=>{});   /* a condition, not 800 ms: the rebuild lands on the programme's next build tick */
 assert.equal((await evaluate('window.__stalheartTest.state()')).hulls,Math.min(3,hullsLost+1),'the assembly line rebuilds a lost hull at the next sector start');
 await shotBase('grow-finished');
 // ISAO'S GATE REPAIR IS ANIMATED (a V1 known gap). Take the door down while the lane is still quiet: he flies out and BEAMS it,
 // his print bed laid over the door's own footprint the way the foundry beat's `over:` bed is, and GATE % climbs under the beam
 // instead of jumping the moment he leaves.
 {await evaluate('window.__stalheartTest.sectorClearField()');await delay(3000);   /* a repair is only taken between waves: the lane has to be quiet. NOT clearSector() — that ends the sector and puts the debrief card over the very thing this step is here to look at */
  /* ON THE CLOCK (2026-09-24) the sector keeps sending pulses and its hard cores may have the door down already: hold the sector
     quiet (no pulses, no wear) and start from a whole door, so what follows is Isao's repair and nothing else */
  await evaluate('window.__stalheartTest.sectorQuiet(true)');await evaluate('window.__stalheartTest.sectorClearField()');await evaluate('window.__stalheartTest.mendGate()');await delay(500);
  assert(await evaluate(`window.__stalheartTest.breakGate()`),'the harness takes the door down');
  {const g=await evaluate(`window.__stalheartTest.state().sector.gate`);assert(g.broken&&g.hp<2,`the gate is down (${JSON.stringify(g)})`);   /* the ambient mend may have ticked a frame's worth back already */}
  await until(`window.__stalheartTest.state().programme.repairing?.kind==='gate'`,40000).catch(async()=>assert.fail(`Isao never took the gate repair (${JSON.stringify(await evaluate(`window.__stalheartTest.state().story`))})`));
  assert(await evaluate(`window.__stalheartTest.state().programme.repairBed`),'the repair order carries a print bed: he beams the door, not a square of dirt beside it');
  await until(`window.__stalheartTest.state().programme.isao?.state==='build' && window.__stalheartTest.state().programme.isao.printK>0.15`,40000).catch(async()=>assert.fail(`he never started printing (${JSON.stringify(await evaluate(`window.__stalheartTest.state().programme.isao`))})`));
  current='grow-gate-repair';await finish();
  /* sampled on the wall clock across the whole print, not until the order clears: the point is the climb IN BETWEEN, not its ends */
  const climb=await evaluate(`new Promise(done=>{const seen=[];const t0=performance.now();(function look(){const s=window.__stalheartTest.state();seen.push([s.programme.isao?.printK??1,+s.sector.gate.hp.toFixed(1)]);if(performance.now()-t0>9000)return done(seen);setTimeout(look,120);})();})`);
  const hp=climb.map(x=>x[1]);
  assert(hp[hp.length-1]>hp[0],`GATE % climbs under the beam (${JSON.stringify(climb.slice(0,2))} ... ${JSON.stringify(climb.slice(-2))})`);
  assert(new Set(hp).size>=4,`GATE % climbs in steps under the beam rather than jumping once at the end (${JSON.stringify(hp)})`);
  assert(hp.every((v,i)=>i===0||v>=hp[i-1]),`and never goes backwards while he works (${JSON.stringify(hp)})`);
  await until(`window.__stalheartTest.state().sector.gate.broken===false && window.__stalheartTest.state().sector.gate.hp>=window.__stalheartTest.state().sector.gate.hp`,20000);
  {const g=await evaluate(`window.__stalheartTest.state().sector.gate`);assert(!g.broken,`the door is closed again when he is done (${JSON.stringify(g)})`);
   console.log(`  grow: Isao's gate repair ${hp[0]} -> ${hp[hp.length-1]} hp over print k ${climb[0][0]} -> ${climb[climb.length-1][0]}, ${g.breaks} break(s) booked`);}} } else if(args.includes('--shield-story')) {
 // THE TANK'S SHIELD IN THE STORY (V1 session design, section 3): T and the pad deploy a rack of two, the solar array's pad
 // recharges it from a finite reserve that only refillArrays restores, a shielded hull shoves hard cores, and rams pay a premium
 // the player can read over the hull, with the combo tier callouts
 const T='window.__stalheartTest',S=`${T}.state()`,st=()=>evaluate(S),hud=()=>evaluate('document.querySelector("#td-stats").textContent');
 const key=async k=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code:'Key'+k.toUpperCase(),text:k});await send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code:'Key'+k.toUpperCase()});};
 await go('shield-array-hud','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until(`!!${T} && (${S}.storyLod||[]).some(l=>l.id==="stalheart")`,90000);await delay(2500);
 let s=await st();const pad=s.shield.arrayPad;
 assert(pad&&pad.standing&&pad.cell>=0,`the solar array's pad stands at stage 6 (${JSON.stringify(pad)})`);
 assert.equal(s.shield.arrayReserve,30,'the array starts the sector full');assert.equal(s.shield.rack,2,'a rack of two');
 assert.equal(s.shield.ring?.visible,true,'the pad ring is drawn');assert(/SHIELD\s*T/.test(await hud())&&/ARRAY 30s/.test(await hud()),`the panel reads the shield and the array (${await hud()})`);
 await evaluate(`${T}.placeTank(${s.storyHome})`);await delay(600);
 await key('t');await delay(300);s=await st();
 assert(s.shield.active&&s.shield.visible&&s.shield.rack===1,`T raises the dome from the rack (${JSON.stringify(s.shield)})`);
 current='shield-array-dome';await finish();
 await evaluate(`${T}.shieldAdvance(10.2)`);s=await st();
 assert(!s.shield.active&&s.shield.cooling&&s.shield.drops>=1,'the charge drains and the seam opens');assert(/COOLING/.test(await hud()),'the seam is counted down on the panel');
 assert.equal(await evaluate(`${T}.deployShield()`),'cooling','the seam refuses');
 await evaluate(`${T}.shieldAdvance(2.1)`);await click('#td-pad-shield');s=await st();assert.equal(s.shield.rack,0,'the pad button spends the second charge');
 await evaluate(`${T}.shieldAdvance(12.3)`);assert.equal(await evaluate(`${T}.deployShield()`),'empty','an empty rack refuses');
 assert(/solar array/.test(await evaluate('document.querySelector("#td-toast").textContent')),'the refusal points at the array');
 s=await st();assert.equal(s.shield.arrayReserve,30,'off the pad the reserve is untouched');
 current='shield-array-empty';await finish();
 // park on the pad: the charge comes back, the ring glows, the reserve drains to zero and stops
 await evaluate(`${T}.placeTank(${pad.cell})`);await delay(1800);s=await st();
 assert(s.shield.charging&&s.shield.arrayReserve<30&&(s.shield.rackFill>0||s.shield.rack>0),`parked on the pad it charges (${JSON.stringify(s.shield)})`);
 assert(s.shield.ring.opacity>0.55,`the ring glows while it feeds (${s.shield.ring.opacity})`);assert(/ARRAY ▲/.test(await hud()),`the panel shows the feed (${await hud()})`);
 current='shield-array-charging';await finish();
 await evaluate(`${T}.shieldAdvance(16)`);s=await st();
 assert.equal(s.shield.arrayReserve,0,'the reserve runs dry');assert.equal(s.shield.rack,3,'thirty seconds of reserve are three charges');assert.equal(s.shield.charging,false,'a dry pad stops');
 assert(Math.abs(s.shield.arrayDrawn-30)<1e-6,`it gave exactly its reserve (${s.shield.arrayDrawn})`);assert(/ARRAY DRY/.test(await hud()),'the panel says dry');
 await evaluate(`${T}.shieldAdvance(5)`);s=await st();assert(s.shield.rack===3&&s.shield.arrayReserve===0,'and never refills itself');
 await delay(900);assert(s.shield.ring.opacity<0.2||(await st()).shield.ring.opacity<0.2,'the ring dims');
 current='shield-array-dry';await finish();
 assert.equal(await evaluate(`(${T}.refillArrays(),${T}.state().shield.arrayReserve)`),30,'refillArrays restores the reserve');
 await evaluate(`${T}.shieldAdvance(6)`);s=await st();assert.equal(s.shield.rack,4,'and the pad tops the rack to its cap');
 await evaluate(`${T}.shieldAdvance(6)`);s=await st();assert(s.shield.rack===4&&Math.abs(s.shield.arrayReserve-20)<0.1,`the cap stops the draw (${JSON.stringify(s.shield)})`);
 // a shielded hull shoves a hard core aside: no hull lost, the core lives, the combo untouched
 await evaluate(`${T}.spawnFodder(2,'barbed')`);await until(`${S}.foes.some(f=>!f[1])`,20000);
 await evaluate(`${T}.placeTank(${s.storyHome})`);await delay(300);assert.equal(await evaluate(`${T}.deployShield()`),'ok','a banked charge deploys');
 {const hulls=(await st()).hulls;for(let i=0;i<20;i++){const f=(await st()).foes.find(f=>!f[1]);if(!f)break;await evaluate(`${T}.placeTank(${f[0]})`);await delay(120);}
  s=await st();assert.equal(s.hulls,hulls,'the shield takes the hard core');assert(s.enemyTypes.includes('barbed'),'and the core is shoved, not killed');}   /* the combo is not asserted here: the wave's own fodder is rammed on the way */
 await evaluate(`${T}.placeTank(${s.storyHome})`);await until(`!${S}.shield.active`,15000);await evaluate(`${T}.shieldAdvance(2.2)`);   /* off the pad: parked on it, the array keeps a live bubble topped up */
 // rams: the premium floats over the hull as +N kg ×M, the combo climbs, the tier callouts land
 await evaluate(`window.__calls=[];new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>__calls.push(n.textContent)))).observe(document.querySelector('#td-callouts'),{childList:true})`);
 {const r0=(await st()).ram;await evaluate(`${T}.spawnFodder(30)`);let shot=false;
  /* the hull is TELEPORTED onto each body, and a float is only drawn for a hull in front of the camera: the chase camera is
     snapped after each teleport (a drive never teleports), or rams landed while it lagged behind and floated nothing (red on
     main too, 2026-09-25: 13 rams, 8 floats) */
  for(let i=0;i<220;i++){s=await st();const f=s.foes.find(f=>f[1]);if(f)await evaluate(`${T}.placeTank(${f[0]});${T}.showcase.follow()`);else if(s.ram.rams>r0.rams+12&&!s.foes.some(f=>f[1]))break;
   if(!shot&&s.ram.combo>=6&&s.ram.float.live>0){shot=true;current='shield-array-ram';await finish();}await delay(100);}
  s=await st();const calls=await evaluate('window.__calls');
  assert(s.ram.rams-r0.rams>=10,`the tank rams the fodder (${s.ram.rams-r0.rams})`);assert(s.ram.best>=10,`the combo reaches ten (${s.ram.best})`);
  assert(s.ram.biomass>r0.biomass,'rams pay biomass');assert(s.ram.float.shown>=s.ram.rams-r0.rams,'every ram floats its premium');
  assert(/^\+\d+ kg ×\d+$/.test(s.ram.float.last),`the readout says +N kg ×M (${s.ram.float.last})`);assert(s.ram.float.live<=s.ram.float.max,'the pool is bounded');
  assert(calls.includes('RAM ×10'),`the x10 tier callout lands (${calls.join(' | ')})`);assert(shot,'a ram readout was on screen');}
 await evaluate(`${T}.placeTank(${pad.cell})`);await delay(400);current='shield-array-end';await finish();
 } else if(args.includes('--skip-tutorial')) {
 // SKIP TUTORIAL (owner, 2026-09-16; docs/log/entries/2026-09-16-skip-tutorial-built.json). The opening still plays from the landing
 // and offers a button; the button is a LINK to ?skip=defence, and what it opens is a real run already at the back door: the Relay
 // and the Mortar earned and buildable, an undelivered part still refused, SOL-82 online, three hulls, and waves that come.
 const T='window.__stalheartTest', st=()=>evaluate(`${T}.state()`);
 // 1. THE OPENING IS UNTOUCHED, and it carries the offer
 await go('skip-tutorial-offer','index.html?sw=0&acceptance=1&cine=0&world=story&grow=1#td');
 await until(`!!${T}`,90000);await delay(2500);
 {const s=await st();assert.equal(s.skip.on,false,'a page that does not ask to skip does not skip');assert.equal(s.automated,false,'the opening still plays the tutorial');
  assert(['landed','foundry','printing','rotor-ready'].includes(s.story.phase),`the run is in the opening beats (${s.story.phase})`);
  assert.equal(s.skip.offer.shown,true,'the offer stands');
  assert.equal(await evaluate('document.querySelector("#skip-tutorial b").textContent'),'SKIP TUTORIAL','the button says what it does');
  assert.equal(await evaluate('(()=>{const r=document.querySelector("#skip-tutorial").getBoundingClientRect();return r.width>80&&r.height>30&&r.bottom<innerHeight&&r.right<=innerWidth;})()'),true,'it is on screen and thumb-sized');
  assert.equal(s.skip.offer.href,'index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence#td','the button carries this page\'s keys into the skipped run and drops the opening\'s');}
 current='skip-tutorial-offer';await finish();
 // 2. A CLICK IS THE ENTRY: a real pointer on the button, and the page it lands on is the skipped run
 await click('#skip-tutorial');
 await until('location.search.includes("skip=defence")',20000);
 await until('window.__stalheartReady===true',90000);
 // ISAO SAYS WHERE THEY ARE, on arrival — the panel runs on its own clock, so it is read as it plays, not after
 await until('/Relay and Mortar are ours/.test(document.querySelector("#td-brief:not(.hidden)")?.textContent||"")',30000).catch(async()=>assert.fail(`Isao's arrival lines (${await evaluate('document.querySelector("#td-brief")?.textContent')})`));
 await until(`!!${T} && (${T}.state().storyLod||[]).some(l=>l.id==="stalheart")`,90000);
 await delay(3000);
 {const s=await st();
  assert.equal(s.skip.on,true,'the click landed in the skipped run');
  assert.equal(s.skip.offer,null,'the offer is not repeated inside the run it opens');
  assert.equal(await evaluate('!!document.querySelector("#skip-tutorial")'),false,'no SKIP TUTORIAL button past the tutorial');
  assert.equal(s.automated,true,'past the handover: the towers are automatic');
  assert.equal(s.story.phase,'expedition');
  // TWO TOWERS EARNED: the Relay and the Mortar, their flags up at the sites and their trophies home
  assert.deepEqual(s.unlocked,['rotor','quiver','relay','mortar'],`the two expedition towers are unlocked (${JSON.stringify(s.unlocked)})`);
  assert.deepEqual(s.expeditions.sites.filter(x=>x.state==='delivered').map(x=>x.id),['rocket-a','rocket-b'],'as though rocket-a and rocket-b came home');
  assert.equal(s.cargo.trophies,2,`two trophies stand at the landing (${JSON.stringify(s.cargo)})`);
  assert.deepEqual(s.cargo.flags.map(f=>f.id).sort(),['rocket-a','rocket-b'],'our flags stand over both sites');
  assert(s.cargo.flags.every(f=>f.state==='up'),`the flags are up, not raising (${JSON.stringify(s.cargo.flags)})`);
  assert.equal(s.cargo.carrying,null,'nothing is on the back deck');
  // THE BASE IS STANDING THROUGH THE BAYS, so the three hulls read as lives
  assert.equal(s.hulls,3,'three hulls');assert.equal(s.bays.length,3,'three bays');
  assert(s.biomass>=300,`biomass enough to place a few towers (${s.biomass})`);
  assert(s.shield.rack>=2,`the shield rack is full (${s.shield.rack})`);
  assert(s.shield.arrayReserve>0,`the array reserve is charged (${s.shield.arrayReserve})`);}
 // the first hull rolls out of its bay: the first frames a player sees have the MÖRK in them, not an empty yard
 await until(`${T}.state().deploying`,30000).catch(()=>{});
 await until(`!${T}.state().deploying`,60000).catch(()=>{});
 await delay(1500);
 current='skip-tutorial-arrival';await finish();
 // 3. TWO TOWERS REALLY STAND: the Relay and the Mortar go up on the story's own sockets
 {const socks=(await st()).sector.sockets;assert(socks.length>=2,`the story sockets (${socks})`);
  assert(await evaluate(`${T}.commitTower('relay',${socks[0]})`),'the Relay can be placed');
  assert(await evaluate(`${T}.commitTower('mortar',${socks[1]})`),'the Mortar can be placed');
  assert.equal(await evaluate(`${T}.state().towers>=2`),true,'both stand');}
 // 4. THE BACK DOOR IS THE FIRST FIGHT: sector 2, the mouth behind the bays open, a live breach there, SOL-82 online
 await until(`${T}.state().sector.n===2`,60000).catch(async()=>assert.fail(`the run opens at the back-door sector (${JSON.stringify((await st()).sector)})`));
 assert.equal((await st()).sector.name,'THE BACK DOOR');
 await until(`${T}.backDoorOpen()`,60000).catch(()=>assert.fail('the rock behind the bays gives way'));
 // the back breach first, its feast on the clock, then the gate side once the feast is down (2026-09-24)
 await until(`!!${T}.state().sector.feast`,90000).catch(async()=>assert.fail(`the feast comes through the back (${JSON.stringify((await st()).sector)})`));
 await evaluate(`${T}.sectorClearField()`);
 await until(`(()=>{const b=${T}.state().sector.breaches;return b.length===2&&b.every(x=>x.live);})()`,60000).catch(async()=>assert.fail(`both breaches open (${JSON.stringify((await st()).sector)})`));
 {const s=await st();assert.deepEqual(s.sector.breaches.map(b=>b.side).sort(),['back','gate'],'one breach behind the bays, one on the gate side');
  assert.equal(s.laser.online,true,'SOL-82 is online');
  assert.equal(s.sector.strays,0,'no stray breach from an opening this run never played');}
 // 5. A WAVE ACTUALLY ARRIVES, on the run's own clock
 await until(`${T}.state().sector.breaches.some(b=>b.wavesReleased>0)`,120000).catch(async()=>assert.fail(`a wave comes without being asked (${JSON.stringify((await st()).sector)})`));
 await until(`${T}.state().performance.enemies>0`,60000);
 {const s=await st();console.log(`PASS skip-tutorial waves: enemies ${s.performance.enemies}, ${s.sector.breaches.map(b=>`${b.id}/${b.side} ${b.wavesReleased}/${b.wavesPlanned}`).join(' ')}, gate ${JSON.stringify(s.sector.gate)}`);}
 current='skip-tutorial-back-door-fight';await finish();
 // THE BUILD MENU IS THE PROOF OF THE UNLOCK: the player's own radial offers the Relay and the Mortar at their price and
 // still reads PART OUT on a part nobody fetched. It moves the build camera, so it runs after the fight is photographed.
 assert.equal(await evaluate(`${T}.openBuildMenu()`),true,'the build menu opens on an open cell');
 await delay(300);
 {const shop=await evaluate(`(()=>{const out={};for(const b of document.querySelectorAll('#td-shop .shop-buy'))out[b.dataset.key]={locked:b.classList.contains('locked'),disabled:b.disabled,txt:b.textContent};return out;})()`);
  for(const key of ['rotor','quiver','relay','mortar'])assert(shop[key]&&!shop[key].locked,`${key} is offered (${JSON.stringify(shop[key])})`);
  for(const key of ['lancer','plasma'])assert(shop[key]?.locked&&/PART OUT/.test(shop[key].txt),`${key}'s part is still out at its site (${JSON.stringify(shop[key])})`);}
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await delay(200);
 assert.equal(await evaluate('document.querySelector("#td-shop").classList.contains("hidden")'),true,'Escape closes the build menu');
 // 6. IT IS A RUN, NOT A DIORAMA: the sector is fought to its end, SECURE and the debrief follow, CONTINUE moves on
 await until(`(()=>{const S=${T}.state().sector;for(const b of S.breaches)if(b.live&&b.wavesReleased<b.wavesPlanned)${T}.sectorRelease(b.id);if(S.breaches.every(b=>!b.live||b.wavesReleased>=b.wavesPlanned))${T}.sectorClearField();return S.breaches.every(b=>b.closedBy);})()`,180000).catch(async()=>assert.fail(`the breaches close (${JSON.stringify((await st()).sector)})`));
 await evaluate(`${T}.sectorClearField()`);
 await until(`${T}.state().sector.secure`,30000).catch(async()=>assert.fail(`SECTOR SECURE (${JSON.stringify((await st()).sector)})`));
 await until(`${T}.state().sector.debriefOpen`,20000);
 {const r=await evaluate(`${T}.sectorReport()`);assert.equal(r.sector,2);assert.equal(r.outcome,'secure');
  assert.deepEqual(r.breaches.map(b=>b.side).sort(),['back','gate'],'the back breach is in the books');
  console.log(`PASS skip-tutorial secure: ${r.seconds}s, kills ${r.kills.total}, breaches ${r.breaches.map(b=>`${b.id}/${b.side}/${b.closedBy}`).join(' ')}`);}
 await delay(1200);current='skip-tutorial-debrief';await finish();
 await evaluate(`${T}.sectorContinue()`);
 await until(`${T}.state().sector.n===3 && !${T}.state().sector.debriefOpen && !${T}.state().paused`,20000).catch(async()=>assert.fail(`CONTINUE moves to the next sector (${JSON.stringify((await st()).sector)})`));
 current='skip-tutorial-next-sector';await finish();
 } else if(args.includes('--showcase')) {
 // THE SHOWCASE (owner, 2026-09-24; docs/log/entries/2026-09-24-intro-simplified.json). FOUR BEATS, and each one drives a
 // real system in a real run of the skipped world. So this step does not look at the rail's intentions — it photographs
 // each beat at its midpoint and then reads the counters the rail recorded at every cut, and asserts the system named by
 // that beat's `proof` actually moved while it was on screen: labels on the wireframes, a breach pouring, rams landing,
 // gunship rounds landing on bodies in frame.
 const W='window.__stalheartShowcase', SH=()=>evaluate(`${W}.state()`);
 // 1. A BARE PAGE PLAYS IT ONCE. Fresh store, no query but the harness's own sw=0: the montage comes up before the landing.
 await go('showcase-load','index.html?sw=0&intro=0#td');
 await evaluate('localStorage.removeItem("stalheart:v1:td-showcase-seen")');
 await go('showcase-bare','index.html?sw=0#td');
 await until(`!!${W}`,90000);
 assert.equal(await evaluate('document.body.classList.contains("showcase-on")'),true,'the montage hides the HUD with its own class');
 assert.equal(await evaluate('!!document.querySelector("#td-stats")&&getComputedStyle(document.querySelector("#td-stats")).display'),'none','the HUD panel is not drawn under the montage');
 await until(`${W}.state().started`,180000).catch(async()=>assert.fail(`the montage starts over the built world (${JSON.stringify(await SH())})`));
 const first=await SH();
 assert(first.total<28,`the whole montage is clearly under the twelve-shot cut's 28 s (${first.total})`);
 assert.equal(first.shots.length,4,'four beats');
 assert.deepEqual(first.shots.map(s=>s.id),['elements-wireframe','breach-swarm','tank-ram','gunship-guns'],'the beats are the owner\'s order: the elements, the breach, the ram, the gunship');
 console.log(`SHOWCASE table: ${first.shots.map(s=>`${s.id} ${s.seconds}s/${s.seat}`).join(' | ')} = ${first.total}s`);
 // 2. ONE SCREENSHOT PER BEAT, AT ITS MIDPOINT. The clock is the rail's own, so the wait is on its state, never a sleep.
 for(const sh of first.shots){
  const id=JSON.stringify(sh.id);
  await until(`${W}.state().shot===${id}||${W}.state().over||${W}.state().index>${first.shots.indexOf(sh)}`,120000)
   .catch(async()=>assert.fail(`${sh.id} comes up (${JSON.stringify((await SH()).shot)})`));
  const s=await SH();
  assert.equal(s.shot,sh.id,`${sh.id} is on screen in its turn`);
  if(sh.card)assert.equal(s.card,sh.card,`${sh.id} carries its card`);
  else assert(typeof s.card==='string'&&s.card.length>0,`${sh.id}: the element reel names whatever subject is up (${s.card})`);
  // the wireframe stage is opaque: if it is standing over a beat that is not the reveal, that beat is not the game
  assert.equal(await evaluate('getComputedStyle(document.querySelector("#showcase .sc-wire")).display!=="none"'),sh.seat==='wireframe',`${sh.id}: the wireframe stage stands only for the reveal`);
  await until(`${W}.state().shot!==${id}||${W}.state().left<=${(sh.seconds*0.45).toFixed(2)}`,20000);
  {const m=await SH();
   if(sh.seat==='wireframe'){
    assert(m.labels.length>=2,`elements-wireframe: the subject is labelled at its midpoint (${JSON.stringify(m.labels)})`);
    assert(m.element!==null,`elements-wireframe: a subject is on the stage (${m.element})`);
    assert.equal(await evaluate('[...document.querySelectorAll("#showcase .sc-label")].filter(b=>!b.hidden&&b.getBoundingClientRect().width>10).length>=2'),true,'the labels are drawn on the stage, not only in the rail\'s state');
    console.log(`SHOWCASE beat A midpoint: ${m.element} — ${m.labels.join(' / ')} under "${m.card}"`);}
   console.log(`SHOWCASE ${sh.id} midpoint: view=${m.counters.view} shot=${m.counters.shot} seat=${m.counters.seat} alive=${m.counters.alive} hull=${m.counters.hullX},${m.counters.hullY},${m.counters.hullZ}`);
   if(sh.id==='gunship-guns')assert.equal(m.counters.seat,'gunship','gunship-guns is shot from the gunship seat');}
  current=`showcase-${sh.id}`;await finish();
  // THE HERO OF THE RAM BEAT IS THE HULL, and the counters say where it is on screen in ndc. Asserted at the midpoint
  // AND again near the cut, because the beat re-places the hull every 0.6 s: a framing that only holds for the frame
  // after a snap is not a framing. The game's own chase view puts it at y -0.43 and off the bottom edge once the hull
  // has grown, which is the miss this step now catches (docs/log/entries/2026-09-24-intro-four-beats-built.json).
  if(sh.id==='tank-ram'){
   const inFrame=(c,where)=>{
    assert(typeof c.hullY==='number',`tank-ram ${where}: the hull's screen position is measured (${JSON.stringify(c.hullY)})`);
    assert(c.hullZ<1,`tank-ram ${where}: the hull is in front of the camera (z ${c.hullZ})`);
    assert(Math.abs(c.hullX)<0.8,`tank-ram ${where}: the hull is not off the side (x ${c.hullX})`);
    assert(c.hullY>-0.72&&c.hullY<0.25,`tank-ram ${where}: the hull is IN FRAME, low but drawn (y ${c.hullY})`);
    console.log(`SHOWCASE tank-ram ${where}: hull at ndc ${c.hullX},${c.hullY} (z ${c.hullZ}) alive=${c.alive} rams=${c.rams} combo=${c.combo}`);};
   inFrame((await SH()).counters,'midpoint');
   await until(`${W}.state().shot!==${id}||${W}.state().left<=0.8`,20000);
   {const late=await SH();
    if(late.shot===sh.id){inFrame(late.counters,'near the cut');current='showcase-tank-ram-late';await finish();}
    else assert.fail('tank-ram is still up 0.8 s before its cut');}}
 }
 // 3. THE LAST CARD: Isao, the question and the two ways in
 await until(`${W}.state().over`,30000).catch(async()=>assert.fail(`the montage reaches its last card (${JSON.stringify(await SH())})`));
 await delay(1200);
 {const s=await SH();
  assert.equal(s.shot,'isao-ready','the last cut is Isao\'s card');
  assert.equal(await evaluate('document.querySelector("#showcase .sc-finale h1").textContent'),'ARE YOU READY?','he asks the question');
  assert.deepEqual(s.buttons.map(b=>b.label),['PLAY','SKIP TUTORIAL'],'two buttons: the story from the landing, and the skip');
  assert.equal(s.urls.play,'index.html?sw=0&intro=0#td','PLAY goes to the landing with the montage off');
  assert.equal(s.urls.skip,'index.html?sw=0&intro=0&skip=defence#td','SKIP TUTORIAL goes to the back door with the montage off');
  assert.equal(await evaluate('(()=>{const b=[...document.querySelectorAll("#showcase .sc-choice button")];return b.every(x=>{const r=x.getBoundingClientRect();return r.width>120&&r.height>36&&r.bottom<innerHeight;});})()'),true,'both are on screen and thumb-sized');
  // 4. EVERY BEAT'S SYSTEM REALLY FIRED. `played` holds the counters at each cut, so beat i is proved by the move from
  //    cut i to cut i+1 (the last beat by the counters at the finale, which the rail records as the state's own), and by
  //    the HIGH WATER MARK each beat kept while it was up (a swarm mown down inside a beat leaves the net count alone).
  const cuts=[...s.played.map(p=>p.counters),s.counters],by=Object.fromEntries(s.played.map((p,i)=>[p.id,[cuts[i],cuts[i+1]]])),peak=Object.fromEntries(s.played.map(p=>[p.id,p.peak]));
  console.log(`SHOWCASE peaks:\n  ${s.played.map(p=>`${p.id}@${p.at}s ${JSON.stringify(p.peak)}`).join('\n  ')}`);
  const [ra,rb]=by['tank-ram'],rams=Math.max(rb.rams-ra.rams,rb.tankKills-ra.tankKills);   /* a ram IS a tank kill: the larger of the two, never their sum */
  console.log(`SHOWCASE proof: labels=${peak['elements-wireframe'].labels} emerging=${peak['breach-swarm'].emerging} rams+${rb.rams-ra.rams} tankKills+${rb.tankKills-ra.tankKills} combo=${peak['tank-ram'].combo} gunRounds+${by['gunship-guns'][1].explosions-by['gunship-guns'][0].explosions} horde=${peak['gunship-guns'].alive}`);
  assert(peak['elements-wireframe'].labels>=2,`elements-wireframe: the wireframes are labelled (${peak['elements-wireframe'].labels})`);
  assert(peak['breach-swarm'].emerging>=30,`breach-swarm: a real horde climbs out of the rock while the beat is up (${peak['breach-swarm'].emerging} emerging)`);
  assert(rams>=20,`tank-ram: the hull drives through the horde (${rb.rams-ra.rams} rams, ${rb.tankKills-ra.tankKills} bodies)`);
  assert(peak['tank-ram'].alive>=20,`tank-ram: there is a horde to drive through (${peak['tank-ram'].alive} rammable bodies)`);
  assert(by['gunship-guns'][1].explosions-by['gunship-guns'][0].explosions>=8,`gunship-guns: the guns land rounds on the horde (${by['gunship-guns'][1].explosions-by['gunship-guns'][0].explosions})`);
  assert(peak['gunship-guns'].alive>=20,`gunship-guns: there is a horde under the belly (${peak['gunship-guns'].alive} rammable bodies)`);}
 current='showcase-isao-ready';await finish();
 // 5. THE ONCE RULE: PLAY lands on the landing with the montage off, and a second bare visit goes straight there too
 await click('#showcase .sc-choice button[data-choice=play]');
 await until('location.search.includes("intro=0")',20000);
 await until('window.__stalheartReady===true',90000);
 assert.equal(await evaluate('!!window.__stalheartShowcase'),false,'PLAY opens the game, not the montage again');
 await go('showcase-second-visit','index.html?sw=0#td');
 await delay(2500);
 assert.equal(await evaluate('!!window.__stalheartShowcase'),false,'a second bare visit goes straight to the landing');
 assert.equal(await evaluate('localStorage.getItem("stalheart:v1:td-showcase-seen")'),'1','the montage is remembered');
 current='showcase-second-visit';await finish();
 // 6. ?intro=1 ALWAYS PLAYS IT, remembered or not — the PLAYTEST drawer's SHOWCASE entry and the shareable link
 await go('showcase-forced','index.html?sw=0&intro=1#td');
 await until(`!!${W}`,90000);
 assert.equal(await evaluate(`${W}.state().shots.length`),4,'?intro=1 plays it again on a browser that has seen it');
 // and it is skippable at any moment: Space goes straight to the last card
 await until(`${W}.state().started`,180000);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});
 await until(`${W}.state().over`,10000).catch(async()=>assert.fail(`Space skips the montage (${JSON.stringify(await SH())})`));
 await delay(800);current='showcase-skipped';await finish();
 } else if(args.includes('--backdoor')) {
 // THE SECOND FRONT: sector gating must not seal the outer world in the story (the back lanes and the far sites live out there)
 await go('backdoor-stage6','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6#td');
 await until('!!window.__stalheartTest',90000);await delay(1500);
 {const s=await evaluate('window.__stalheartTest.state()');console.log(`BACKDOOR stage6 wallCount=${s.wallCount} ${consoleLines.filter(l=>l.startsWith('sector ')).join('|')}`);
  assert(s.wallCount<45000,`the story is one sector: ${s.wallCount} rock cells (~68k means round 1 sealed the outer world)`);}
 await finish();
 // stage 8 past the handover: the collapse, its cost, the candidates, and a swarm walking in through the back
 await go('backdoor-load','index.html?sw=0&acceptance=1&cine=0&world=story&stage=8&phase=expedition#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(2500);
 await evaluate('window.__stalheartTest.begin()');
 const mouth=await evaluate('window.__stalheartTest.backMouth()');assert.deepEqual(mouth.cells,[1086,34817],'the back mouth rides along with the story');
 assert.equal(await evaluate('window.__stalheartTest.backDoorOpen()'),false,'sealed before the call');
 const shut=await evaluate('window.__stalheartTest.backCandidates()');assert(shut.length>0&&shut.every(c=>c.side==='back'&&c.route>c.hops+15),`before the collapse the back lanes route through the gate (${JSON.stringify(shut[0])})`);
 await until('!window.__stalheartTest.state().deploying',30000);await delay(500);   // a hull rolling out of its bay owns the camera over any shot
 await evaluate('window.__stalheartTest.sectorQuiet(true)');await until('(()=>{const s=window.__stalheartTest.state().sector;return !!s&&s.breaches.length>=2&&s.breaches.every(b=>b.live)})()',90000);await delay(1500);   // sector 1 opens its own two breaches and their sinkholes clear rock: measure after they stand
 const walls0=await evaluate('window.__stalheartTest.state().wallCount');
 // the frame cost: rAF deltas and long tasks for 2.5 s before the call (baseline) and 2.5 s from the call
 const watch=call=>evaluate(`new Promise(resolve=>{const long=[];const po=new PerformanceObserver(l=>{for(const e of l.getEntries())long.push(+e.duration.toFixed(1));});po.observe({type:'longtask'});let callMs=0,cells=0,last=0,max=0,maxAt=0,frames=0,t0=0;const longAt=[];const tick=()=>{const now=performance.now();if(now-last>max){max=now-last;maxAt=Math.round(now-t0);}last=now;frames++;if(now-t0<2500)requestAnimationFrame(tick);else setTimeout(()=>{po.disconnect();for(const e of performance.getEntriesByType?.('longtask')??[])longAt.push(Math.round(e.startTime-t0));resolve({long,longAt:longAt.filter(v=>v>=0),maxFrame:+max.toFixed(1),maxAt,frames,callMs,cells});},50);};requestAnimationFrame(()=>{t0=last=performance.now();${call?'const a=performance.now();cells=window.__stalheartTest.openBackDoor();callMs=+(performance.now()-a).toFixed(1);':''}requestAnimationFrame(tick);});})`);
 await until('window.__stalheartTest.state().shot===null',20000);await delay(500);   // and after their establishing shot: measured under it, the dive is refused (a shot is live) and the window catches the breach cut's first-use shader link, not the collapse
 const base=await watch(false),hit=await watch(true);
 current='backdoor-dive';await finish();   // at once: the dive reaches the mouth at 1.7 s and blends home from 3.8 s
 console.log(`BACKDOOR baseline ${JSON.stringify(base)} collapse ${JSON.stringify(hit)}`);
 assert(hit.cells>=2,`the mouth came down (${hit.cells} cells)`);
 assert.equal(await evaluate('window.__stalheartTest.state().wallCount'),walls0-hit.cells,'the wall count drops by the collapsed cells');
 assert.equal(await evaluate('window.__stalheartTest.backDoorOpen()'),true);
 assert(hit.callMs<100,`the collapse call costs ${hit.callMs} ms`);
 const worst=Math.max(0,...hit.long);assert(worst<=100||worst<=Math.max(0,...base.long)+25,`no long task over 100 ms from the collapse (${hit.long}; baseline ${base.long})`);
 assert.equal(await evaluate('window.__stalheartTest.state().shot'),'backdoor','the dive frames the collapse');
 assert.equal(await evaluate('window.__stalheartTest.openBackDoor()'),0,'a second call does nothing');
 assert.equal(await evaluate('window.__stalheartTest.state().wallCount'),walls0-hit.cells,'and takes no more rock');
 assert.equal(await evaluate('window.__stalheartTest.state().storyHud.back'),true,'the radar marks the back door');
 const open=await evaluate('window.__stalheartTest.backCandidates()');
 assert(open.length>0&&open[0].side==='back'&&open[0].hops<60&&open[0].route===open[0].hops&&open[0].pos.length===3,`a back lane routes in under 60 hops (${JSON.stringify(open[0])})`);
 await until('window.__stalheartTest.state().shot===null',15000);
 await evaluate('window.__stalheartTest.viewBack()');await delay(1500);current='backdoor-mouth';await finish();
 await evaluate('window.__stalheartTest.begin()');   // the still freezes the board; the swarm needs it running
 // a real breach on the nearest back lane: its fodder walks in through the back
 const cell=await evaluate('window.__stalheartTest.backBreach(16)');assert(cell>=0,'a back breach opened');
 await until('window.__stalheartTest.state().breaches.length>0',10000);
 await until('window.__stalheartTest.backInside()>0',180000).catch(async()=>assert.fail(`no fodder reached the clearing from the back (${JSON.stringify(await evaluate('({alive:window.__stalheartTest.state().performance?.enemies,inside:window.__stalheartTest.state().insideEnemies,queued:window.__stalheartTest.state().queued})'))})`));
 await evaluate('window.__stalheartTest.viewBack()');await delay(800);
 current='backdoor-swarm-inside';await finish();
 await evaluate('window.__stalheartTest.begin()');

 } else if(args.includes('--back-gate')) {
 // THE BACK GATE (owner, 2026-09-18): the surprise opens the mouth behind the bays, the player holds it, and only THEN does Isao
 // print a door there. This step runs the second half: the mouth open and quiet, the programme queueing the back gate, the print,
 // the mounts beside the back lane becoming sockets a sentry can be ordered on, and the finished door standing as a wall to the swarm.
 await go('back-gate','index.html?sw=0&acceptance=1&cine=0&skip=defence#td');
 await until('!!window.__stalheartTest',90000);await delay(2500);
 await evaluate('window.__stalheartTest.begin()');
 await evaluate('window.__stalheartTest.sectorQuiet(true)');
 await until('!window.__stalheartTest.state().deploying',30000);await delay(500);
 const mouth=await evaluate('window.__stalheartTest.backMouth()');
 {const s=await evaluate('window.__stalheartTest.state()');
  assert.equal(s.programme.next,'backgate','the back gate is the one step a finished base has not printed');
  assert.deepEqual((s.programme.gates||[]).map(g=>[g.id,g.built]),[['gate',true],['back',false]],'two doors planned, only the front one standing');
  assert(!s.programme.perks.includes('backgate'),'and its perk is off');
  for(const ci of mouth.cells) assert.equal(await evaluate(`window.__stalheartTest.sealedAt(${ci})`),false,'sealed rock is not a gate');}
 // the surprise: the mouth comes down
 assert(await evaluate('window.__stalheartTest.openBackDoor()')>=2,'the mouth came down');
 await until('window.__stalheartTest.state().shot===null',30000);await delay(500);
 await evaluate('window.__stalheartTest.setSector(2)');
 for(const ci of mouth.cells) assert.equal(await evaluate(`window.__stalheartTest.sealedAt(${ci})`),false,'a cracked mouth with no door on it is a way in');
 // held and quiet: Isao queues the door
 await until('window.__stalheartTest.state().programme.print.step==="backgate"',120000)
   .catch(async()=>assert.fail(`the back gate never queued: ${JSON.stringify(await evaluate('window.__stalheartTest.state().programme'))}`));
 await evaluate('window.__stalheartTest.viewBack()');await delay(1200);current='back-gate-printing';await finish();await evaluate('window.__stalheartTest.begin()');   /* a still freezes the board; the print needs it running */
 await until('(window.__stalheartTest.state().programme.gates||[]).some(g=>g.id==="back"&&g.built)',120000)
   .catch(async()=>assert.fail(`the print never finished: ${JSON.stringify(await evaluate('({p:window.__stalheartTest.state().programme,i:window.__stalheartTest.state().programme.isao})'))}`));
 await delay(800);await evaluate('window.__stalheartTest.viewBack()');await delay(800);current='back-gate-standing';await finish();await evaluate('window.__stalheartTest.begin()');
 const built=await evaluate('window.__stalheartTest.state()');
 console.log(`BACK GATE printed=${JSON.stringify(built.programme.printed)} gates=${JSON.stringify(built.programme.gates)} sector=${JSON.stringify(built.sector.gates)}`);
 assert(built.programme.printed.includes('backgate'),'the step is on the book');
 assert(built.programme.perks.includes('backgate'),'the perk is on');
 assert.deepEqual((built.sector.gates||[]).map(g=>g.id),['gate','back'],'the sector loop wears both doors down');
 assert(built.sector.gates.every(g=>g.hp>0&&!g.broken),'both doors start whole');
 // a closed door is a wall on its own cells, and it opens for the tank
 for(const ci of mouth.cells) assert.equal(await evaluate(`window.__stalheartTest.sealedAt(${ci})`),true,'the standing door seals the mouth');
 // the mounts beside the back lane are sockets now, and a sentry can be ordered on one
 const socks=await evaluate('window.__stalheartTest.backSocketCells()');
 assert(socks.length>=1,`back sockets ${JSON.stringify(socks)}`);
 assert(built.sector.sockets.some(c=>socks.includes(c)),'the back mounts joined the story sockets');
 {let placed=null,why=null;
  for(const ci of socks){const e=await evaluate(`window.__stalheartTest.orderAt(${ci})`);if(e===null){placed=ci;break;}why=e;}
  assert(placed!==null,`no sentry could be ordered behind the bays (${why})`);
  console.log(`BACK GATE sentry ordered on ${placed}`);}
 await evaluate('window.__stalheartTest.viewBack()');await delay(1000);current='back-gate-socket';await finish();await evaluate('window.__stalheartTest.begin()');
 // the swarm: a real back breach, and the door holds it out of the clearing
 await evaluate('window.__stalheartTest.begin()');
 const cell=await evaluate('window.__stalheartTest.backBreach(16)');assert(cell>=0,'a back breach opened');
 await delay(1000);
 const inside0=await evaluate('window.__stalheartTest.backInside()');
 // the sector stays quiet, so the only bodies on the board are this breach's: they walk the 25-35 hops to the mouth and find a
 // door. Ninety seconds of that and none of them is inside on the back half. (Wear under pressure is quiet-gated in sector-run,
 // so the pressure rule itself is covered by test/gate-integrity.mjs and by --sectors on the front door.)
 for(let i=0;i<9;i++){await delay(10000);
   const n=await evaluate('window.__stalheartTest.backInside()');
   assert.equal(n,inside0,`the closed door keeps them out while it holds (${n} inside after ${(i+1)*10}s)`);}
 const under=await evaluate('window.__stalheartTest.state()');
 console.log(`BACK GATE closed ${JSON.stringify(under.sector.gates)} inside ${under.insideEnemies} back ${await evaluate('window.__stalheartTest.backInside()')}`);
 assert(under.sector.gates.find(g=>g.id==='gate').hp===built.sector.gates.find(g=>g.id==='gate').hp,'the pile behind the bays does not wear the front door');
 await evaluate('window.__stalheartTest.viewBack()');await delay(800);current='back-gate-under-pressure';await finish();await evaluate('window.__stalheartTest.begin()');
 // ...and a door that is open is a way through: the same rule that opens it for the tank. Taking it down forces it open.
 assert(await evaluate(`window.__stalheartTest.breakGate('back')`),'the harness takes the back door down');
 await delay(600);
 for(const ci of mouth.cells) assert.equal(await evaluate(`window.__stalheartTest.sealedAt(${ci})`),false,'an open back door is a way through');
 await until('window.__stalheartTest.backInside()>'+inside0,180000)
   .catch(async()=>assert.fail(`nothing came through the broken back door (${JSON.stringify(await evaluate('window.__stalheartTest.state().sector.gates'))})`));
 await evaluate('window.__stalheartTest.viewBack()');await delay(800);current='back-gate-down';await finish();
 console.log('PASS back-gate: the programme queues it once the surprise is held, the print stands it, its mounts take a sentry, and it is a wall to the swarm until it is down.');
 await evaluate('window.__stalheartTest.begin()');
 } else if(args.includes('--quiver-frame')) {
 // THE QUIVER'S ROCKET STAYS IN FRAME (owner, 2026-09-16; src/core/round-framing.js): from the Quiver's hand-over one TALON leaves from the
 // PoV seat and one from third person. Every frame of each flight the round is projected through the real camera; from launch through
 // ignite (the fraction the framing holds) it is inside the frame in at least 95% of samples. A frame strip is saved per view.
 await go('quiver-frame','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=4&phase=cleared#td');
 await until('!!window.__stalheartTest',90000);
 try{await until('window.__stalheartTest.state().story.phase==="quiver-piloting" && !!window.__stalheartPilotTest',180000);}catch(e){console.log('QUIVER FRAME BEATS',JSON.stringify(await evaluate('window.__stalheartTest.state().story')));throw e;}
 await delay(1500);
 // THE OPTIC'S FOUR PHASES, for the eye (owner, 2026-09-16: the Quiver's sight in the Orbital Laser's register). Nothing held,
 // then a body inside the square with the timer running, then the lock taken; the round away is caught below, once the framing
 // has handed the camera back and the sight is on screen again.
 await evaluate('window.__stalheartPilotTest.view("pov")');await delay(500);
 await evaluate('window.__stalheartPilotTest.aimSky()');await until('window.__stalheartPilotTest.lock().tgt===null',10000);await delay(400);current='quiver-scope-searching';await finish();
 await until('(()=>{const l=window.__stalheartPilotTest.lock();if(l.tgt!==null&&l.meter>0.04&&!l.locked)return true;if(!window.__aimAt||Date.now()-window.__aimAt>900){window.__aimAt=Date.now();window.__stalheartPilotTest.aimEnemy();}return false;})()',90000);current='quiver-scope-tracking';await finish();
 await until('(()=>{const l=window.__stalheartPilotTest.lock();if(l.locked)return true;if(!window.__aimAt||Date.now()-window.__aimAt>900){window.__aimAt=Date.now();window.__stalheartPilotTest.aimEnemy();}return false;})()',90000);current='quiver-scope-locked';await finish();
 for(const view of ['pov','third']){
  await evaluate(`window.__stalheartPilotTest.view(${JSON.stringify(view)})`);await delay(400);
  await evaluate(`(()=>{const q=window.__qf={samples:[],done:false},T=window.__stalheartPilotTest;const f=()=>{const r=T.round();if(r)q.samples.push(r);else if(q.samples.length){q.done=true;return;}requestAnimationFrame(f);};requestAnimationFrame(f);})()`);
  await evaluate('window.__stalheartPilotTest.hold(true)');
  await until('(()=>{if(window.__qf.samples.length)return true;if(!window.__aimAt||Date.now()-window.__aimAt>500){window.__aimAt=Date.now();window.__stalheartPilotTest.aimEnemy();}return false;})()',120000);
  await evaluate('window.__stalheartPilotTest.hold(false)');
  if(view==='pov'){await until('(()=>{const s=window.__qf.samples.at(-1);return !!s&&s.u>0.72;})()',20000).catch(()=>{});current='quiver-scope-away';await finish();}   /* the sight with a round in flight, after the framing hands the camera back */
  for(let i=0;i<6;i++){await delay(450);const s=await evaluate('window.__qf.samples.at(-1)');current=`quiver-frame-${view}-${i}-${(s?.phase??'landed').toLowerCase()}`;await finish();}
  await until('window.__qf.done',15000);
  const samples=await evaluate('window.__qf.samples'),inside=s=>Math.abs(s.x)<=1&&Math.abs(s.y)<=1&&s.z<1;
  const open=samples.filter(s=>s.u<=.42),back=samples.filter(s=>s.u>.42&&s.u<=.62),n=a=>a.filter(inside).length;
  console.log(`quiver frame ${view}: launch to ignite ${n(open)} of ${open.length} in frame (${(100*n(open)/Math.max(1,open.length)).toFixed(1)}%), max |y| ${Math.max(...open.map(s=>Math.abs(s.y))).toFixed(2)}, fov ${open[0]?.fov}->${open.at(-1)?.fov}; climb hand-back ${n(back)} of ${back.length}; whole flight ${n(samples)} of ${samples.length}`);
  assert(open.length>=60,`${view}: the probe saw the opening (${open.length} samples)`);
  assert(n(open)>=.95*open.length,`${view}: the round stays in frame from launch to ignite (${n(open)} of ${open.length})`);
 }
 } else if(args.includes('--story-world')) {
 // THE STÅLHEART CANDIDATES IN THE GAME CAMERA — the review surface the asset owner asked for. lod() reports the FILE
 // behind each tier, and a far tier only reports once its GLB has loaded, so a switch that quietly loaded the shipped tiers,
 // or a candidate that failed to load, fails here rather than passing on something that merely looks right. The near
 // tier is fetched by camera distance, so its loading is not required; its file on the record is.
 await go('story-world-candidate','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&landmarks=candidate#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);
 {const c=await evaluate('window.__stalheartTest.state()'),st=c.storyLod.find(l=>l.id==='stalheart');
  assert.equal(st.files.far,'assets/models/astro/terraformer_3000_d0_lod2.glb','game: the candidate distance tier stands first');
  assert.equal(st.files.near,'assets/models/astro/terraformer_3000_d0_lod1.glb','game: the candidate game tier is what comes near');
  assert.deepEqual(c.storyBaseErrors,[],'game: the candidate tiers load without error');}
 // WAIT FOR THE FRAME RATE, DO NOT SLEEP FOR IT. performance.fps is a moving average seeded from zero and halved toward the
 // truth every half second: measured at stage 6 it read 0.58 when Stålheart's tier landed, 19 half a second later, and a
 // locked 60 by six seconds — on both the candidate and the shipped tiers. Reading it at once failed a base that was fine.
 await until('(window.__stalheartTest.state().performance?.fps||0)>20',30000);
 await finish();
 await go('story-world','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6#td');
 await until('!!window.__stalheartTest',90000);await delay(3000);
 await until('(window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);
 const w=await evaluate('window.__stalheartTest.state()');
 // SHIPPED BY DEFAULT: a plain story link stands Stålheart on its derived distance tier and brings it near as the game-ready
 // model. The review switch must never leak into a link that did not ask for it.
 {const st=w.storyLod.find(l=>l.id==='stalheart');
  assert.equal(st.files.far,'assets/models/far/stalheart.glb','shipped: the derived distance tier');
  assert.equal(st.files.near,'assets/models/astro/terraformer_3000_d0_game.glb','shipped: the game-ready tier');
  assert.deepEqual(w.storyBaseErrors,[],'shipped: the base loads without error');}
 // the same moving average: this used to be asserted after a fixed three-second sleep, and measured it read 22.7 at exactly
 // 3.0 s — passing by a tenth of a second. A condition, not a sleep.
 await until('(window.__stalheartTest.state().performance?.fps||0)>20',30000);
 assert.equal(w.heartAsset,'none','no dot-cloud heart in the story world');assert.deepEqual(w.berthAssets,[],'no camp containers');assert.equal(w.queued,0,'no enemies queued');
 assert(w.wallCount>40000&&w.wallCount<71314,`story world rock count ${w.wallCount}`);assert(w.playerAssetReady,'tank landed on the story world');
 await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});await delay(800);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'1',code:'Digit1'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'1',code:'Digit1'});await delay(1500);
 current='story-world-orbit';await finish();
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'3',code:'Digit3'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'3',code:'Digit3'});await delay(1200);
 current='story-world-tank';await finish();
 assert.equal(await evaluate('document.querySelectorAll("canvas").length>0'),true);
 await go('story-world-stage1','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=1#td');await until('!!window.__stalheartTest',90000);await delay(2500);
 const one=await evaluate('window.__stalheartTest.state()');assert.equal(one.towers,0);assert.equal(one.queued,0);
 assert.equal(await evaluate('!document.querySelector("#td-intro")'),true,'no field manual in the story world');
 await finish();
 await until('window.__stalheartTest.state().towers===1',90000);const printed=await evaluate('window.__stalheartTest.state()');
 assert.equal(printed.towers,1,'Isao printed the Rotor');assert(printed.story.foundry&&printed.story.foundry.barrels>=1,`the Rotor was paid for by the foundry's first barrel (${JSON.stringify(printed.story.foundry)})`);assert.equal(printed.wallCount,one.wallCount,'the socket is floor, not rock');assert.equal(printed.queued,0);
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
 await until('!!window.__stalheartPilotTest',30000);
 // THE ROTOR'S VOICES STAY WITH THE ROTOR (2026-09-25 playtest: its spin and fire carried into the next seat). A real key arms the
 // page's audio (the context waits for a gesture); every looping voice heard while the Rotor is the seat is banked, so the check
 // after the Quiver hand-over below is not made against a silent page
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'F2',code:'F2'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'F2',code:'F2'});
 await evaluate(`(()=>{window.__rotorVoices=new Set();const f=()=>{try{const T=window.__stalheartTest,p=window.__stalheartPilotTest?.state?.();if(p&&p.key==='rotor')for(const k of T.state().loopVoices)window.__rotorVoices.add(k);}catch{}if(!window.__rotorVoicesDone)requestAnimationFrame(f);};f();})()`);
 // THE ROTOR'S HEAT PEAK IS MEASURED IN THE PAGE, EVERY FRAME. The harness polls at 150 ms plus a CDP round trip, so banking the peak
 // from its poll bodies sampled the barrels' cooling curve by luck: a run where the piloted Rotor cleared the wave quickly read 0.037,
 // 0.040 and 0.041 on three branches while passing on main both times (2026-09-16). This hook rides requestAnimationFrame from the
 // moment the seat is taken, records the max of state().heat while the seat is still the Rotor, and removes itself the moment the key
 // changes (the Quiver hand-over), the seat is left (the hook is deleted) or state() throws. The assertion below reads its peak.
 await evaluate('(()=>{window.__rotorHeatMax=0;window.__rotorHeatFrames=0;const tick=()=>{const t=window.__stalheartPilotTest;if(!t)return;let p;try{p=t.state();}catch(e){return;}if(p.key!=="rotor")return;window.__rotorHeatMax=Math.max(window.__rotorHeatMax,p.heat||0);window.__rotorHeatFrames++;requestAnimationFrame(tick);};requestAnimationFrame(tick);})()');
 await until('window.__stalheartTest.state().performance.enemies>0',60000);await delay(14000);
 const fodder=await evaluate('window.__stalheartTest.state()');assert(fodder.performance.enemies>=2&&fodder.performance.enemies<=50,`fodder alive ${fodder.performance.enemies}`);   // the first wave is one fifty-strong swarmassert.equal(fodder.performance.wave,0,'no wave arms');
 assert.deepEqual(fodder.enemyTypes,['amoeba'],'the first wave is the white amoeba');assert.equal(fodder.insideEnemies,0,'the closed gate holds the fodder outside');assert.equal(fodder.queued,0);
 current='story-world-fodder';await finish();
 await until('window.__stalheartPilotTest.aimEnemy()!==null',15000);const victim=await evaluate('window.__stalheartPilotTest.aimEnemy()');assert(victim!==null,'an amoeba is in reach and sight of the Rotor');   // the pile at the gate shuffles; give it a moment
 await evaluate('window.__stalheartPilotTest.hold(true)');
 // the fodder keeps walking, so re-aim each poll until this one drops (the heat peak is banked per frame by the hook above)
 await until(`(()=>{const t=window.__stalheartPilotTest;const e=t.enemy(${victim.id});if(!e||!e.alive)return true;t.aimEnemy();return false;})()`,8000);await evaluate('window.__stalheartPilotTest.hold(false)');
 // A DELIBERATE BURST, WHILE THE SEAT IS CERTAINLY THE ROTOR (2026-09-18). The heat assertion below used to read whatever the
 // ten kills above happened to cost in rounds, which is not a burst: once the opening put the seat in the player's hands with the
 // swarm still bunched mid-lane, ten kills took half the rounds and the peak halved with them (0.073 -> 0.037) without a single
 // barrel behaving differently. Two seconds of held fire is the burst the assertion names, and the per-frame hook banks its peak.
 const shots=await evaluate('window.__stalheartPilotTest.state().shots');assert(shots>=2,'the Rotor streamed rounds');assert((await evaluate('window.__stalheartTest.state().brassLive'))>0,'spent cases fell from the Rotor in sentry control (docs/AMMUNITION.md)');current='story-world-rotor-kill';await finish();
 await evaluate('window.__stalheartPilotTest.hold(true)');
 for(let i=0;i<10;i++){await evaluate('window.__stalheartPilotTest&&window.__stalheartPilotTest.state().key==="rotor"&&window.__stalheartPilotTest.aimEnemy()');await delay(200);}
 await evaluate('window.__stalheartPilotTest&&window.__stalheartPilotTest.hold(false)');

 // keep shooting: the fifth kill brings the comms study, the tenth the biomass line
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.said.includes("harvest_biomass"))return true;window.__stalheartPilotTest.aimEnemy();return false;})()',120000);
 await evaluate('window.__stalheartPilotTest.hold(false)');const said=await evaluate('window.__stalheartTest.state().story.said');assert(said.includes('alien_comms')&&said.includes('harvest_biomass'),'both lines said');
 // THE HEAT CHECK READS THE ROTOR'S OWN PEAK, NOT A FRESH BURST (owner, 2026-09-14): confirmed live that a piloted Rotor can clear the whole wave during the waits above and the game hands control to the Quiver 0.6s later (STORY_QUIVER.delay) — read here, `state().key` may already be 'quiver', heat 0, held reset by the hand-over's own attach(). A burst fired at THIS point fires the wrong mount, so the per-frame hook installed at the seat banked the Rotor's own heat while it was still the Rotor, and the peak it reached is what is asserted on
 const heatPeak=await evaluate('window.__rotorHeatMax||0'),heatFrames=await evaluate('window.__rotorHeatFrames||0');console.log(`rotor heat peak ${heatPeak.toFixed(4)} over ${heatFrames} frames in the seat`);assert(heatFrames>0,'the heat hook sampled the Rotor seat');assert(heatPeak>0.05,`the barrels carry heat after a burst (${heatPeak})`);
 await delay(400);current='story-world-harvest';await finish();
 // THE FIRST WAVE DOWN IS THE NEXT UNLOCK: keep firing until the twenty are spent and none stand, then Isao's line and the view strip
 if(!(await evaluate('window.__stalheartTest.state().story.said')).includes('wave_cleared'))assert.equal(await evaluate('document.querySelector("#story-views")'),null,'no view strip before the wave is cleared');   // a piloted Rotor can clear the whole wave during the kills above (2026-09-14), and phase can move past 'cleared' to 'quiver-piloting' the same tick it is set, so said is checked instead of the exact phase
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.said.includes("wave_cleared"))return true;const t=window.__stalheartPilotTest;if(t.state().overheated)return false;t.aimEnemy();return false;})()',480000);
 await evaluate('window.__stalheartPilotTest.hold(false)');const cleared=await evaluate('window.__stalheartTest.state()');assert(cleared.story.said.includes('wave_cleared'));await until('!(window.__stalheartTest.state().enemyTypes||[]).includes("amoeba")',5000);   // the performance block is a periodic sample. NOT a count of zero any more: the Quiver now stands before the wave is down and its first hard core rises within a third of a second of `cleared` (STORY_QUIVER.delay 0.3, 2026-09-18), so the field is never empty here. The fifty white amoeba being gone is the same claim, made of the wave this step is about
 await until('!!document.querySelector("#story-views")',5000);await delay(600);current='story-world-cleared';await finish();
 // the view strip is exercised after the Quiver: the hand-over now follows the cleared wave almost at once (owner, 2026-09-13)
 // THE QUIVER: printed across the lane while the wave was fought, handed over the moment the wave is down (its post first,
 // the Rotor's behind it), two TALON shots with the seeker feed riding along, then settled and the strip is back
 await until('window.__stalheartTest.state().story.phase==="quiver-piloting"',120000);await delay(600);
 {await delay(1200);const heard=await evaluate('(window.__rotorVoicesDone=true,[...window.__rotorVoices])'),now=await evaluate('window.__stalheartTest.state().loopVoices');
  assert(heard.includes('rotor_pov_fire')&&heard.includes('minigun_ready'),`the Rotor's spin and fire were heard while it was the seat (${JSON.stringify(heard)})`);
  assert(!now.includes('rotor_pov_fire')&&!now.includes('minigun_ready'),`and neither carries into the Quiver's seat (${JSON.stringify(now)})`);}
 const qp=await evaluate('window.__stalheartPilotTest.state()');assert.equal(qp.key,'quiver','the Quiver optic first');assert.equal(qp.posts.length,2,'both mounts are posts');
 await until('window.__stalheartPilotTest.lock().locked',8000).catch(()=>{});current='story-world-quiver-optic';await finish();   /* the sight in the game's own run: whatever phase the seat is in when the hand-over lands */
 const killsBefore=(await evaluate('window.__stalheartTest.state()')).kills;await evaluate('window.__stalheartPilotTest.hold(true)');
 // re-aim every half second, not every poll: each re-aim re-slews the launcher, and a lock needs the reticle held still on the target
 try{await until('(()=>{const s=window.__stalheartTest.state();if(s.story.phase==="settled")return true;if(!window.__aimAt||Date.now()-window.__aimAt>500){window.__aimAt=Date.now();window.__stalheartPilotTest.aimEnemy();}return false;})()',150000);}
 catch(e){console.log('QUIVER DUMP',JSON.stringify(await evaluate('(()=>{const s=window.__stalheartTest.state(),p=window.__stalheartPilotTest?.state();return {story:s.story,kills:s.kills,enemies:s.performance.enemies,towers:s.towerCells,engagement:s.engagement,pilot:p&&{key:p.key,ci:p.ci,posts:p.posts,held:p.held,shots:p.shots,view:p.view},reach:window.__stalheartPilotTest?.reach(),monitor:s.monitorShown,shot:s.shot};})()')));throw e;}
 await evaluate('window.__stalheartPilotTest.hold(false)');const settled=await evaluate('window.__stalheartTest.state()');assert.equal(settled.kills-killsBefore,2,'two hard cores, two rounds');assert(settled.monitorShown>0,'the seeker feed showed during a flight');assert(settled.explosions.spawned['quiver.talon']>=2,'each TALON hit bursts on its target');
 await delay(500);current='story-world-quiver-settled';await finish();
 // ISAO's study: the synthetic-learning terminal opens over the game a few seconds after the Quiver beat settles, pauses it, and CONTINUE closes it
 await until('window.__stalheartTest.state().story.phase==="study-talk"',15000);assert.equal(await evaluate('window.__stalheartTest.state().shot'),'isaoTalk','a close-up of Isao while he says it');current='story-world-isao-talk';await delay(1500);await finish();
 await until('window.__stalheartTest.state().screenOpen',40000);assert.match(await evaluate('document.querySelector("#synthetic-modal h1").textContent'),/PRELIMINARY ALIEN VIBRATION LANGUAGE ANALYSIS/);await delay(1200);assert(await evaluate('window.__stalheartTest.state().paused'),'the game pauses under the screen');assert.equal(await evaluate('document.querySelectorAll("#synthetic-modal canvas").length'),4,'four panels');
 current='story-world-study';await finish();
 await click('#synthetic-modal [data-continue]');await delay(400);const afterScreen=await evaluate('window.__stalheartTest.state()');assert(!afterScreen.screenOpen&&!afterScreen.paused,'CONTINUE closes it and the game resumes');assert.equal(afterScreen.screensOpened,1);
 await until('window.__stalheartTest.state().story.phase==="expedition"',5000);const exp=await evaluate('window.__stalheartTest.state()');assert(exp.story.said.includes('rocket_sites'),'Isao sends the tank to the landing sites');assert(exp.storyHud.sites>=3,'the landing sites are on the radar');assert.equal(exp.shot,'sites','the planet pulled back');await delay(2500);current='story-world-expedition';await finish();
 assert.equal(await evaluate('getComputedStyle(document.querySelector("#synthetic-modal")).display'),'none','the closed screen is really gone, not a transparent sheet over the strip');
 // the sector loop's waves would take a one-Rotor base down while this step reads the views strip (--sectors and --pacing cover the loop), as in --defense
 await evaluate('window.__stalheartTest.sectorQuiet(true)');
 // past the handover the towers fire themselves, so the strip drops their mounts and the gunship button becomes the call-in meter
 assert.equal(await evaluate('document.querySelectorAll("#story-views [data-mount]:not([data-mount=gunship])").length'),0,'no tower mounts after the handover');
 await until('window.__stalheartTest.state().gunship.station===false',150000);await delay(500);   // the pass that was already overhead at the handover has to finish before the button is the meter rather than the countdown; the meter is written on the frame after it leaves
 assert.match(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent'),/^GUNSHIP · (\d+%|CALL)$/,'the gunship button shows the call-in meter');
 assert.equal(await evaluate('window.__stalheartTest.state().automated'),true,'the phase is automated');current='story-world-views-cycle';await finish();
 await click('#story-views [data-view="tank"]');await until('typeof window.__stalheartPilotTest==="undefined" && !document.querySelector("#sentry-pilot")',5000);await delay(800);current='story-world-views-tank';await finish();
 await click('#story-views [data-view="map"]');await until('document.querySelector("#story-views [data-view=map]").classList.contains("active")',5000);await delay(600);current='story-world-views-map';await finish();
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
 assert.equal(await evaluate('!document.querySelector("#td-intro")'),true);
 assert.equal(await evaluate('document.querySelector("#shell-nav [data-entry=story]").classList.contains("active")'),true,'the drawer marks story as the active entry');
 await finish();
 await go('story-default-route','index.html?sw=0&intro=0#td')   /* intro=0: a bare page plays the showcase once (src/platform/showcase-entry.js); this suite wants the landing */;await until('document.querySelector("#shell-nav [data-entry=story]")!==null');await delay(2500);
 assert.equal(await evaluate('document.querySelector("#shell-nav [data-entry=story]").classList.contains("active")'),true,'a bare index.html is the story');assert.equal(await evaluate('!document.querySelector("#td-intro")'),true);
 await go('story-cine-redirect','index.html?sw=0&acceptance=1&story=4&cine=1#td',1440,900,'labs.html?sw=0&acceptance=1&land=1#story');await until('window.__stalheartStoryTest?.state().ready',90000);await delay(1500);assert(await evaluate('window.__stalheartStoryTest.state().playing'),'the story cine switch plays the arrival');await finish();
 await go('story-world-default','index.html?sw=0&acceptance=1&cine=0#td');
 await until('!!window.__stalheartTest',60000);await delay(1500);
 const d=await evaluate('window.__stalheartTest.state()');assert(d.wallCount>1500&&d.wallCount<2236,`default world unchanged ${d.wallCount}`);
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
 } else if(args.includes('--laser-game')) {
 // SOL-82 IN THE ARSENAL (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 3): past the handover with
 // ?laser=online the pass clock runs and the strip counts it down; a pass overhead lights the button, the button opens the
 // seat (the scope over the ground view), the beam held on a breach seals it and burns what rises out of it, and leaving
 // gives the tank its own lens back
 const laser=()=>evaluate('window.__stalheartTest.state().laser');
 const strip=()=>evaluate('(b=>b?{text:b.textContent,hidden:b.hidden,disabled:b.disabled,live:b.classList.contains("live")}:null)(document.querySelector("#story-views [data-view=laser]"))');
 await go('laser-game-load','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition&laser=online#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(2500);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.automated,true,'past the handover');
  assert.equal(s.laser.online,true,'?laser=online brings SOL-82 online');assert.equal(s.laser.phase,'away');assert.equal(s.laser.seated,false);
  const b=await strip();assert(b&&!b.hidden&&b.disabled,`the strip shows SOL-82, dark between passes (${JSON.stringify(b)})`);
  assert(/^SOL-82 \d\d:\d\d$/.test(b.text),`the strip counts the next pass down (${b.text})`);}
 await finish();
 // the pass, and the seat from the strip (the first seat plays SOL-82's briefing: skipped)
 await evaluate('window.__stalheartTest.laserPassNow()');
 await until('window.__stalheartTest.state().laser.overhead',5000);
 await until('document.querySelector("#story-views [data-view=laser]")?.textContent==="SOL-82 OVERHEAD"',5000).catch(async()=>assert.fail(`the strip lights through the pass (${JSON.stringify(await strip())})`));
 {const b=await strip();assert(b.live&&!b.disabled,'the button opens');}
 await evaluate('document.querySelector("#story-views [data-view=laser]").click()');
 await until('!!document.querySelector("#sol82-briefing [data-skip]") || window.__stalheartTest.state().laser.seated',5000);
 await evaluate('document.querySelector("#sol82-briefing [data-skip]")?.click()');
 await until('window.__stalheartTest.state().laser.seated',15000);
 // enemies out of a real breach (spawnFodder opens one), with the beam already laid on it: they rise only once the
 // sinkhole has opened, and a swarm on the move walks as fast as the beam drags, so the beam waits where they come out
 await evaluate('window.__stalheartTest.spawnFodder(16)');
 await evaluate('window.__stalheartTest.laserSteer("breach")');await delay(400);   // the first aim of a pass snaps onto it
 {const s=await laser();assert(s.contact,'the seat lays a contact on the breach');assert.equal(s.fov,52,'the seat takes its ground lens');
  assert(await evaluate('!!document.querySelector("#laser-seat") && document.querySelector("#tab-td").classList.contains("laser-seat")'),'the seat panel is up');}
 await until('(s=>s.nearestBodyM!==null&&s.nearestBodyM<8)(window.__stalheartTest.state().laser)',17000).catch(async()=>assert.fail(`no bodies rose under the beam while the pass was overhead (${JSON.stringify(await laser())})`));
 current='laser-game-seat';await finish();
 // HOLD ON THE BREACH: what rises out of it burns on contact, and one second of beam seals it
 const before=await evaluate('window.__stalheartTest.state().killsBySrc.laser||0');
 await evaluate('window.__stalheartTest.laserHold(true)');
 await until('window.__stalheartTest.state().laser.burned.breaches>0',15000).catch(async()=>assert.fail(`the beam did not seal the breach (${JSON.stringify(await laser())})`));
 await delay(600);
 current='laser-game-burn';await finish();
 // any that got away walk faster than the beam drags: lay it ahead of the nearest, on their way to the base
 for(let i=0;i<48;i++){const s=await laser();if(s.burned.bodies>=3||s.energy<=2)break;await evaluate('window.__stalheartTest.laserSteer("ahead")');await delay(250);}
 {const s=await laser(),kills=await evaluate('window.__stalheartTest.state().killsBySrc.laser||0');
  console.log(`  laser-game: ${s.burned.bodies} bodies, ${s.burned.breaches} breaches, ${s.burned.walls} walls, ${s.burned.rocks} rocks, ${s.burned.towers} towers, ${s.energy} s left, trail ${s.trail}`);
  assert(s.burned.bodies>0,`the beam burned bodies (${JSON.stringify(s.burned)})`);assert(kills>before,`the kills are the laser's (${kills})`);
  assert(s.trail>0,'the scorch trail was laid');assert(s.energy<10,'the pass spent energy');}
 // a rock cell, to time the break at runtime (the game's board surface patches the cell in place): the beam lifts,
 // drags onto the nearest rock with its inertia, then burns there
 await evaluate('window.__stalheartTest.laserHold(false)');await evaluate('window.__stalheartTest.laserSteer("rock")');await delay(3000);
 await evaluate('window.__stalheartTest.laserHold(true)');
 for(let i=0;i<16;i++){const s=await laser();if(s.burned.rocks>0||s.energy<=0)break;await delay(250);}
 await evaluate('window.__stalheartTest.laserHold(false)');await evaluate('window.__stalheartTest.laserSteer(null)');
 {const s=await laser();console.log(`  laser-game: rock ${s.burned.rocks}, the slowest break ${s.breakMs} ms, ${s.energy} s left`);}
 await delay(1500);
 current='laser-game-sealed';await finish();
 // TANK leaves: the seat goes, and the tank's third person comes back through its own 68 degree lens
 await evaluate('document.querySelector("#laser-seat-keys [data-tank]").click()');await delay(800);
 {const s=await laser();assert.equal(s.seated,false,'TANK leaves the seat');assert.equal(s.fov,68,'the tank camera gets its own lens back');
  assert(!await evaluate('!!document.querySelector("#laser-seat")'),'the seat panel is gone');}
 current='laser-game-tank';await finish();
 // FRIENDLY FIRE: the next pass laid straight on one of our own kit walls burns it, and the seat says so while it burns;
 // Esc leaves this time
 await until('window.__stalheartTest.state().laser.phase==="away"',30000);
 await evaluate('window.__stalheartTest.laserPassNow()');
 await until('document.querySelector("#story-views [data-view=laser]")?.textContent==="SOL-82 OVERHEAD"',5000);
 await evaluate('document.querySelector("#story-views [data-view=laser]").click()');
 await until('window.__stalheartTest.state().laser.seated',5000);
 await evaluate('window.__stalheartTest.laserSteer("wall")');await delay(400);   // a fresh pass: the first aim snaps
 await evaluate('window.__stalheartTest.laserHold(true)');
 {const seen=await evaluate(`new Promise(done=>{const t0=performance.now();(function look(){const s=window.__stalheartTest.state().laser,w=document.querySelector('#laser-seat [data-warn]');if(s.under.wall>0&&w&&!w.hidden)return done({under:s.under,warn:w.textContent});if(performance.now()-t0>6000)return done({under:s.under,warn:w?.hidden?null:w?.textContent});requestAnimationFrame(look);})();})`);
  assert(/OURS UNDER THE BEAM/.test(seen.warn||''),`the seat warns while our wall is under the beam (${JSON.stringify(seen)})`);}
 current='laser-game-friendly';await finish();
 await until('window.__stalheartTest.state().laser.burned.walls>0',8000).catch(async()=>assert.fail(`the beam did not burn our wall (${JSON.stringify(await laser())})`));
 await evaluate('window.__stalheartTest.laserHold(false)');await evaluate('window.__stalheartTest.laserSteer(null)');
 {const s=await laser();console.log(`  laser-game: friendly fire ${s.burned.walls} wall segments, ${s.burned.towers} towers, heart ${s.burned.heart}, tank ${s.burned.tank}`);}
 // IT BURNS EVERY BUILDING, NOT ONLY THE STALHEART (a V1 known gap). The solar complex stands at stage 6; hold the beam on it,
 // watch the scope name it by name rather than count "1 STRUCTURE", and check the colony pays: the array's perk goes out with it.
 {const before=await evaluate('window.__stalheartTest.state().programme');
  assert(before.perks.includes('station'),`the solar array's perk is on before the burn (${JSON.stringify(before.perks)})`);
  /* a fresh pass: the wall and the rock above spent this one's ten seconds, and a building wants two of them */
  await until('window.__stalheartTest.state().laser.phase==="away"',40000);
  await evaluate('window.__stalheartTest.laserPassNow()');
  await until('window.__stalheartTest.state().laser.overhead && window.__stalheartTest.state().laser.energy>4',10000);
  if(!await evaluate('window.__stalheartTest.state().laser.seated')){await evaluate('window.__stalheartTest.laserSeat(true)');await until('window.__stalheartTest.state().laser.seated',5000);}   /* the pass that closed took the seat with it */
  await evaluate('window.__stalheartTest.laserSteer("structure:solar")');await delay(900);
  await evaluate('window.__stalheartTest.laserHold(true)');
  const seen=await evaluate(`new Promise(done=>{const t0=performance.now();(function look(){const s=window.__stalheartTest.state().laser,w=document.querySelector('#laser-seat [data-warn]');if(s.under.structure>0&&w&&!w.hidden)return done({under:s.under,names:s.underNames,warn:w.textContent});if(performance.now()-t0>8000)return done({under:s.under,names:s.underNames,warn:w?.hidden?null:w?.textContent});requestAnimationFrame(look);})();})`);
  assert(/OURS UNDER THE BEAM/.test(seen.warn||'')&&/SOLAR/.test(seen.warn||''),`the scope names the building, not a count (${JSON.stringify(seen)})`);
  current='laser-game-building-warned';await finish();
  await until('window.__stalheartTest.state().laser.burned.structures>0',10000).catch(async()=>assert.fail(`the beam did not burn the solar complex (${JSON.stringify(await laser())})`));
  await evaluate('window.__stalheartTest.laserHold(false)');await evaluate('window.__stalheartTest.laserSteer(null)');await delay(600);
  const after=await evaluate('window.__stalheartTest.state().programme');
  console.log(`  laser-game: buildings burned ${(await laser()).burned.structures}, perks ${JSON.stringify(before.perks)} -> ${JSON.stringify(after.perks)}, lost ${JSON.stringify(after.lost)}`);
  assert(after.lost.includes('solar'),`the solar complex is booked lost (${JSON.stringify(after)})`);
  assert(!after.perks.includes('station'),`...and its perk went out with it (${JSON.stringify(after.perks)})`);
  assert(after.done.includes('solar'),'the step stays done: Isao does not print a burned building back');
  assert.equal(await evaluate('window.__stalheartTest.state().storyLod.find(l=>l.id==="solar")?.visible'),false,'the burned complex is concealed');
  current='laser-game-building-lost';await finish();}
 await evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{code:"Escape",key:"Escape",bubbles:true}))');await delay(600);
 {const s=await laser();assert.equal(s.seated,false,'Esc leaves the seat');assert.equal(s.fov,68,'and the tank has its lens back');}
 // NEW RUN: the scorch, the smoke, the books and the pass clock go with the old world (the gap the V1 session shipped with)
 {const s=await laser();assert(s.trail>0&&s.smoke>0,`the old run left a scorch to clear (trail ${s.trail}, smoke ${s.smoke})`);}
 {const generation=await evaluate('window.__stalheartTest.state().runGen');
  await evaluate('window.__stalheartTest.restart()');await until(`window.__stalheartTest.state().runGen > ${generation}`,30000);await delay(800);
  const s=await laser();console.log(`  laser-game: after NEW RUN trail ${s.trail}, smoke ${s.smoke}, passes ${s.passes}, phase ${s.phase}, burned ${JSON.stringify(s.burned)}`);
  assert.equal(s.trail,0,'the scorch trail is cleared by NEW RUN');assert.equal(s.smoke,0,'the smoke ring is cleared by NEW RUN');
  assert.equal(s.passes,0,'the pass count starts over');assert.equal(s.burned.walls+s.burned.bodies+s.burned.breaches,0,'the books start over');
  assert.equal(s.seated,false);assert.equal(s.online,true,'?laser=online still holds on the new run');
  // THE REST OF THE OLD WORLD GOES TOO (2026-09-25): the gunship's pass count and any MK-9 in flight
  const g=await evaluate('window.__stalheartTest.state().gunship');assert.equal(g.passes,0,`the gunship's passes start over (${JSON.stringify(g)})`);assert(!g.nuke?.flying,`no MK-9 falls into the new run (the rig itself comes back empty, on demand) (${JSON.stringify(g.nuke)})`);}
 current='laser-game-new-run';await finish();
 } else if(args.includes('--laser')) {
 // THE ORBITAL LASER LAB. Open it, wait for the real base and for the sinkhole's crater to actually open, jump the
 // clock to a pass, then hold the beam and drag it up the trench through the test hook — the pointer only steers
 // inside the inset, so the hook speaks in inset-normalised coordinates. The assertion is the point of the lab:
 // bodies burn, the wall gives way, and the hole takes its rubble cap.
 //
 // THE INSET CHASES THE CONTACT. frameSat re-centres the satellite view on the contact every frame (and on the
 // queue's tail while there is none), so (0.5, 0.5) IS the contact and a steer held off-centre is a constant drag in
 // that direction at the slew rate, not a move to a fixed spot. Everything below is written as a closed loop on
 // state(): read where the contact is, aim at the world point we want, steer again.
 const laserState=()=>evaluate('window.__stalheartLaserTest.state()');
 const laserSteer=(nx,ny)=>evaluate(`window.__stalheartLaserTest.steer(${nx.toFixed(4)},${ny.toFixed(4)})`);
 const laserHold=on=>evaluate(`window.__stalheartLaserTest.hold(${on})`);
 const clamp01=v=>Math.min(1,Math.max(0,v));
 // the lens is HEADING-UP (frameSat's up is viewForward, 2026-09-15), so screen axes are not world axes: the old fixed
 // mapping (screen up +z, left +x) drove the contact AWAY from its target. The hook projects the target through the
 // satellite camera itself; the inset is centred on the contact, so that point is the drag direction.
 const laserAim=async(state,to)=>{const [nx,ny]=await evaluate(`window.__stalheartLaserTest.inset(${JSON.stringify(to)})`);return laserSteer(clamp01(nx),clamp01(ny));};
 const laserNear=(state,to)=>Math.hypot(to[0]-state.contact[0],to[1]-state.contact[1],to[2]-state.contact[2]);
 const laserWalk=async(to,steps,burn)=>{   // drag the contact onto a world point; unheld it costs no energy
  if(burn)await laserHold(true);
  for(let i=0;i<steps;i++){const s=await laserState();if(!s.contact||laserNear(s,to(s))<3)break;await laserAim(s,to(s));await delay(120);}
 };
 await go('laser-lab-load','labs.html?sw=0&acceptance=1&slew=40&accel=0#laser');
 await until('window.__stalheartLaserTest?.state().ready',120000);
 {const s=await laserState();
  assert.deepEqual(s.errors,[],'the lab builds the base without error');
  assert(s.alive>=20,`the trench queues its bodies (${s.alive})`);
  assert(s.wallsStanding>=10,`the shipped walls stand (${s.wallsStanding})`);
  assert(s.structsStanding>=6,`the base structures and the sentries are pickable (${s.structsStanding})`);
  assert.equal(s.sentries,2,'both sentries stand on their story sockets');
  assert.equal(s.phase,'away');assert.equal(s.heart,'INTACT');}
 // the four stone textures have to land before createSinkhole will trigger, and then the crater takes its pre-roll
 await until('window.__stalheartLaserTest.state().sinkPhase==="open"',60000);
 await finish();
 // makeLaser starts `fresh`, so the lab's very first aim SNAPS to the pick instead of slewing (aimLaser). Dead
 // centre is the anchor, and with no contact yet the anchor is the queue's tail: one steer, still in the away phase
 // where nothing can burn, puts the beam down behind twenty bodies and reports where they start.
 await laserSteer(.5,.5);await delay(300);
 const tail=(await laserState()).contact;
 assert(tail,'the first aim of the lab lands a contact');
 await evaluate('window.__stalheartLaserTest.passNow()');
 await until('window.__stalheartLaserTest.state().phase==="overhead"');
 current='laser-lab-overhead';await finish();
 {const s=await laserState();
  console.log(`  laser: tail ${tail.join()} gate ${s.gate.join()} sink ${s.sink.join()}`);
  console.log(`  laser: tail to gate ${Math.hypot(s.gate[0]-tail[0],s.gate[1]-tail[1],s.gate[2]-tail[2]).toFixed(1)} m,`
   +` tail to sink ${Math.hypot(s.sink[0]-tail[0],s.sink[1]-tail[1],s.sink[2]-tail[2]).toFixed(1)} m, ${s.alive} alive`);}
 await laserWalk(s=>s.gate,30,true);                      // down the queue to the gate: soft bodies die on touch
 await laserSteer(.5,.5);await delay(200);                // aim at the contact itself: the beam stands still to be photographed
 {const s=await laserState();console.log(`  laser: at the gate with ${s.bodies} burned, ${s.alive} alive, ${s.energy} s of energy`);}
 current='laser-lab-burn';await finish();                 // mid-burn: the column in the trench, the reticle in the inset
 // THEN ONTO A WALL CELL, AND STAND THERE. The twelve wall cells stand either side of the trench's own line, so no drag
 // along the trench reaches one, and a cell needs LASER_BURN.wall seconds of unbroken contact. Blind sideways nudges
 // stopped landing on one once the 2026-09-15 view change reframed the inset, so the step aims at the nearest standing
 // cell from state() and then holds dead centre, polling, until the cut is counted (burn time plus a generous margin).
 {const s=await laserState();
  const wall=s.wallPoints.reduce((a,b)=>laserNear(s,b)<laserNear(s,a)?b:a);
  console.log(`  laser: nearest wall cell ${wall.join()} is ${laserNear(s,wall).toFixed(1)} m from the contact`);
  await laserWalk(()=>wall,40,true);
  await laserSteer(.5,.5);
  const settle=Date.now();
  let t=await laserState();
  while(t.walls===0&&t.energy>0&&Date.now()-settle<(LASER_BURN.wall+2.5)*1000){await delay(100);t=await laserState();}
  console.log(`  laser: ${laserNear(t,wall).toFixed(1)} m off the cell, ${t.under.wall} wall under the beam,`
   +` ${t.walls} cut after ${((Date.now()-settle)/1000).toFixed(1)} s held, ${t.energy} s of energy`);}
 await laserHold(false);
 {const s=await laserState();
  assert(s.bodies>0,`the beam burned bodies (${s.bodies})`);
  assert(s.walls>0,`the beam cut the wall (${s.walls})`);
  assert(s.trail>0,`the scorch trail was laid (${s.trail})`);
  assert(s.energy<10,`the pass spent energy (${s.energy})`);
  assert.deepEqual(s.errors,[],'burning raises no errors');
  console.log(`  laser: ${s.bodies} bodies, ${s.walls} walls, ${s.towers} towers, ${s.trail} scorch quads, ${s.energy} s left`);}
 // a second pass for the seal: the hole is most of the trench back up the line, further than one pass's energy would
 // carry a held beam, and lifting the beam forgets every second it had accumulated anyway
 await laserSteer(.5,.5);
 await until('window.__stalheartLaserTest.state().phase==="away"',40000);
 await evaluate('window.__stalheartLaserTest.passNow()');
 await until('window.__stalheartLaserTest.state().phase==="overhead"');
 await laserWalk(s=>s.sink,60,true);
 for(let i=0;i<40;i++){const s=await laserState();if(s.sealed)break;await laserAim(s,s.sink);await delay(120);}
 await laserHold(false);
 // and aim at the contact itself. steer() leaves `steering` on for good, and applyBurn aims whether or not the beam
 // is held, so any residual lean keeps dragging the contact at the slew rate: four seconds of it walked the view a
 // hundred metres off the hole it had just sealed.
 await laserSteer(.5,.5);
 await delay(4000);                                       // breach-rubble settles its cap over SETTLE_S, and the
                                                          // touchdown cloud has to clear before the cap can be seen
 current='laser-lab-sealed';await finish();
 {const s=await laserState();
  assert(s.sealed,'the beam sealed the sinkhole');
  assert.equal(s.heart,'INTACT','the Stalheart was never in the footprint');
  assert.equal(s.lost,false,'the colony stands');
  assert.deepEqual(s.errors,[],'the seal raises no errors');}
 await evaluate('window.__stalheartLaserTest.dispose()');
 } else if(args.includes('--seats')) {
 // THE SEAT-TRANSITION CONTRACT (src/domain/seat-view.js; owner, 2026-09-23: "changing views to control the game is a large
 // part of it"). The whole cycle matrix on one board: TANK to a seat and back, seat to seat, seat to MAP and back. After every
 // transition back to the hull the tank must sit exactly where it sat, at exactly the lens it had, with no seat left occupied
 // and no pointer lock hanging on; and a seat entered FROM another seat must be that seat and nothing else -- the failure the
 // owner saw was SOL-82 opening on top of the gunship, which kept the camera while SOL-82's 52 degree lens went in behind a
 // reticle that still said 2.6x. The gunship's three guns are checked against the reticle itself: the aim the rounds fly at,
 // projected through the very camera that draws the frame, is the centre of the screen the reticle is drawn on.
 const SEAT_PX=2;   // the reticle's own stroke is 1.4 px wide: a gun off by more than a couple of pixels is off
 const seat=()=>evaluate('window.__stalheartTest.seatState()');
 const stripClick=async(sel,wait=1600)=>{await evaluate(`document.querySelector("#story-views ${sel}").click()`);await delay(wait);return seat();};
 /* a LEAVE is read one frame later, not two seconds later: leavePilot snaps the camera onto the hull's goal, and after that the
    chase camera eases (0.14 a frame) behind a tank that drives itself, so a late reading measures the follow's lag, not the restore */
 const toTank=()=>stripClick('[data-view=tank]',300);
 const armPass=async()=>{await evaluate('window.__stalheartTest.laserOnline(true)');if(!await evaluate('window.__stalheartTest.state().laser.overhead'))await evaluate('window.__stalheartTest.laserPassNow()');
  await until('window.__stalheartTest.state().laser.overhead',10000);await until('!document.querySelector("#story-views [data-view=laser]").disabled',10000);};
 await go('seats-load','index.html?sw=0&acceptance=1&cine=0&world=story&threat=0.35&heart=none&stage=6&phase=expedition&laser=online&gunship=station#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(2500);
 // both briefings out of the way: they are each a first-seat beat, not part of the matrix
 await evaluate('window.__stalheartTest.mountGunship()');await delay(600);
 await until('!!document.querySelector("#gunship-briefing [data-skip]") || window.__stalheartTest.state().gunship.seat',12000);
 await evaluate('document.querySelector("#gunship-briefing [data-skip]")?.click()');await until('window.__stalheartTest.state().gunship.seat',12000);await delay(800);
 await stripClick('[data-view=tank]');
 await armPass();await evaluate('document.querySelector("#story-views [data-view=laser]").click()');await delay(600);
 await until('!!document.querySelector("#sol82-briefing [data-skip]") || window.__stalheartTest.state().laser.seated',12000);
 await evaluate('document.querySelector("#sol82-briefing [data-skip]")?.click()');await until('window.__stalheartTest.state().laser.seated',12000);await delay(800);
 await stripClick('[data-view=tank]');await delay(1200);
 /* the reference pose: one warm-up in and out of the guns, so `home` is the snapped hull camera every later leave is compared against */
 await stripClick('[data-mount=gunship]');const home=await toTank();
 assert(!home.pilot&&!home.laserSeat,'the matrix starts in the hull');
 assert.equal(home.fov,68,'the hull owns its own lens');
 assert.equal(home.view,'third','and its own chase camera');
 assert(Math.abs(home.tank[0])<0.02,`the hull's chase camera is centred on the tank (x ${home.tank[0]})`);
 const back=(name,s)=>{assert(!s.pilot&&!s.gunshipSeat,`${name}: no pilot seat is left occupied`);assert(!s.laserSeat,`${name}: SOL-82's seat is left with it`);
  assert(!s.locked,`${name}: the pointer lock does not survive the seat`);
  assert.equal(s.view,home.view,`${name}: the hull's own view comes back (${s.view})`);
  assert.equal(s.fov,home.fov,`${name}: the hull's own lens comes back (${s.fov})`);
  assert(Math.abs(s.tank[0])<0.02&&Math.abs(s.tank[1]-home.tank[1])<0.02,
   `${name}: the tank is where it was on the glass (${s.tank} vs ${home.tank})`);};
 // TANK -> GUNSHIP -> TANK
 {const g=await stripClick('[data-mount=gunship]');assert(g.gunshipSeat&&!g.laserSeat,'GUNSHIP takes the guns alone');
  back('tank>gunship>tank',await toTank());}
 // TANK -> SOL-82 -> TANK, and the pose SOL-82's own seat holds
 await armPass();const solo=await stripClick('[data-view=laser]');
 assert(solo.laserSeat&&!solo.pilot,'SOL-82 takes the beam alone');assert.equal(solo.fov,52,'the seat takes its ground lens');
 back('tank>sol82>tank',await toTank());
 // TANK -> GUNSHIP -> SOL-82 -> TANK: the middle step is the one that used to open two seats at once
 {const g=await stripClick('[data-mount=gunship]');assert(g.gunshipSeat,'the guns first');
  await armPass();const l=await stripClick('[data-view=laser]');
  assert(l.laserSeat,'SOL-82 opens from the gunship');
  assert(!l.pilot&&!l.gunshipSeat,'and the gunship seat is LEFT, not kept underneath it');
  assert.equal(l.fov,solo.fov,'the same lens whichever seat it is entered from');
  assert.equal(l.view,solo.view,'the same view whichever seat it is entered from');
  assert(Math.abs(l.pos[0]-solo.pos[0])<1e-3&&Math.abs(l.pos[1]-solo.pos[1])<1e-3&&Math.abs(l.pos[2]-solo.pos[2])<1e-3,
   `SOL-82's own ground view, not the gunship's (${l.pos} vs ${solo.pos})`);
  back('tank>gunship>sol82>tank',await toTank());}
 // a seat, MAP, and back to the hull
 {await stripClick('[data-mount=gunship]');const m=await stripClick('[data-view=map]');assert.equal(m.view,'orbit','MAP is the global view');
  back('gunship>map>tank',await toTank());}
 current='seats-tank';await finish();
 // THE GUNS AIM AT THE RETICLE. state().gunship.aim is the point the rounds are fired at (src/sentry-pilot.js gunshipTick);
 // seatState projects it through the live camera, so this is the reticle the player is looking through, not a second sum.
 await stripClick('[data-mount=gunship]');await delay(1200);
 for(const gun of ['rotary','bofors','heavy']){
  await evaluate(`window.__stalheartTest.gunshipGun(${JSON.stringify(gun)})`);await delay(900);
  const s=await seat(),w=await evaluate('innerWidth'),h=await evaluate('innerHeight');
  assert(s.aim,`${gun}: the seat has an aim point`);
  const dx=s.aim[0]/2*w,dy=-s.aim[1]/2*h;
  console.log(`  seats: ${gun} lands ${dx.toFixed(2)} px across, ${dy.toFixed(2)} px down from the reticle at fov ${s.fov}`);
  assert(Math.abs(dx)<=SEAT_PX&&Math.abs(dy)<=SEAT_PX,`${gun}: the round goes where the reticle is (${dx.toFixed(2)},${dy.toFixed(2)} px)`);}
 current='seats-gunship';await finish();
 back('gunship>tank (guns)',await toTank());
 // P IN A SEAT IS THE GAME'S PAUSE (2026-09-25): its card shows, P again resumes, and leaving a paused seat never leaves a silent
 // freeze behind (the world is running, or paused under the card that says how to resume). It used to flip the flag with no card,
 // and leaving the seat left the whole game frozen with every key but ESC ignored.
 {const keyP=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'p',code:'KeyP',text:'p'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'p',code:'KeyP'});await delay(350);};
  const esc=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await delay(350);};
  const held=()=>evaluate('({paused:window.__stalheartTest.state().paused,card:!document.querySelector("#td-msg").classList.contains("hidden")})');
  for(const [name,sel] of [['gunship','[data-mount=gunship]'],['SOL-82','[data-view=laser]']]){
   if(name==='SOL-82')await armPass();
   await stripClick(sel);
   await keyP();{const p=await held();assert(p.paused&&p.card,`${name}: P pauses the game with its card (${JSON.stringify(p)})`);}
   await keyP();{const p=await held();assert(!p.paused&&!p.card,`${name}: P again resumes it (${JSON.stringify(p)})`);}
   await keyP();await toTank();{const p=await held();assert(!p.paused||p.card,`${name}: leaving a paused seat leaves no silent freeze (${JSON.stringify(p)})`);}
   if((await held()).paused)await esc();
   assert(!(await held()).paused,`${name}: ESC resumes after it`);}
  current='seats-pause';await finish();}
 // THE WAY BACK TO THE TANK (2026-09-25 playtest: "the switch from gunship back to tank was not obvious ... clicking the tank icon
 // bottom left did not bring me to tank position"): Esc in the gunship's seat (the mouse already free) leaves it for the hull's own
 // view; from the MAP with no seat taken, TANK lands on the hull's own view too
 {const esc=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await delay(400);};
  await stripClick('[data-mount=gunship]');assert((await seat()).gunshipSeat,'in the gunship seat');
  await esc();{const s=await seat();assert(!s.gunshipSeat&&!s.pilot,`Esc leaves the gunship seat (${JSON.stringify(s)})`);assert.equal(s.view,'third','for the hull\'s own view');assert.equal(await evaluate('window.__stalheartTest.state().paused'),false,'and does not pause');}
  await stripClick('[data-view=map]',800);assert.notEqual((await seat()).view,'third','the map is up');
  {const s=await toTank();assert.equal(s.view,'third',`TANK from the map lands on the hull (${s.view})`);}
  current='seats-way-back';await finish();}
 } else if(args.includes('--debrief')) {
 // THE SECTOR DEBRIEF (src/fx/sector-debrief.js) in its lab, labs.html#debrief. Every sample report is shown, each page
 // is completed with a real Space press and advanced with the next one, and the pages and labels are checked against
 // the report contract's page list. Screenshots at a 1280x800 desktop and a 400x860 phone, where nothing may poke out
 // of the frame sideways. Dismissed by hand only: Space on the last page points at CONTINUE, Esc changes nothing, and
 // only the buttons close the card.
 const PAGES=['THE BREACHES','THE KILLS','THE TANK','THE COLONY'];
 const LABELS={secure:['SECURE',...PAGES],flawless:['SECURE',...PAGES],lost:['LAST TRANSMISSION',...PAGES],campaign:['THE COLONY HOLDS']};
 const dbf=()=>evaluate('window.__stalheartDebriefTest.state()');
 const press=async key=>{const code=key===' '?'Space':key;
  await send('Input.dispatchKeyEvent',{type:'keyDown',key,code,...(key===' '?{text:' '}:{})});await send('Input.dispatchKeyEvent',{type:'keyUp',key,code});await delay(120);};
 const watchConsole=()=>evaluate('window.__dbfConsole=[];{const error=console.error.bind(console),warn=console.warn.bind(console);console.error=(...a)=>{window.__dbfConsole.push(a.map(String).join(" "));error(...a);};console.warn=(...a)=>{window.__dbfConsole.push(a.map(String).join(" "));warn(...a);};}');
 for(const [w,h] of [[1280,800],[400,860]]){
  await go(`debrief-${w}-load`,'labs.html?sw=0&acceptance=1&sound=0#debrief',w,h);
  await until('!!window.__stalheartDebriefTest');await watchConsole();
  for(const name of Object.keys(LABELS)){
   assert.deepEqual(await evaluate(`window.__stalheartDebriefTest.show(${JSON.stringify(name)})`),LABELS[name],`${name}: the page labels`);
   let s=await dbf();
   assert(s.open&&s.page===0&&s.animating,`${name}: opens on its first page and animates (${JSON.stringify(s)})`);
   assert.equal(s.outcome,name==='lost'?'lost':'secure',`${name}: the outcome variant`);
   if(name==='secure'){await delay(1100);current=`debrief-${w}-secure-rolling`;await finish();
    await press('Escape');s=await dbf();assert(s.open&&s.page===0&&!s.animating,'Esc completes the page and does nothing else');}
   for(let i=0;i<LABELS[name].length;i++){
    s=await dbf();
    if(s.animating){await press(' ');s=await dbf();}
    assert.equal(s.page,i,`${name}: the press completed page ${i+1} without leaving it`);
    assert(!s.animating,`${name}: page ${i+1} is complete`);
    assert.equal(s.label,LABELS[name][i],`${name}: page ${i+1} is ${LABELS[name][i]}`);
    assert.equal(s.stamps,s.stampsTotal,`${name} page ${i+1}: every stamp is down after the skip`);
    assert(s.overflowX<=1&&!s.poking.length,`${name} page ${i+1} at ${w} px: nothing pokes out sideways (${s.overflowX} ${JSON.stringify(s.poking)})`);
    current=`debrief-${w}-${name}-p${i+1}`;await delay(150);await finish();
    if(i<LABELS[name].length-1){await press(' ');assert.equal((await dbf()).page,i+1,`${name}: the next press advances`);}
   }
   await press(' ');s=await dbf();
   assert(s.open,`${name}: Space on the last page never dismisses`);
   assert(await evaluate('document.activeElement?.classList.contains("sdb-btn--go")'),`${name}: it points at the way out`);
   if(name==='secure'){
    await press('ArrowLeft');s=await dbf();assert.equal(s.page,3,'ArrowLeft goes back');assert(!s.animating,'a page already seen comes back complete');
    await press('ArrowRight');assert.equal((await dbf()).page,4,'ArrowRight goes forward');
   }
   if(name==='flawless')assert((await dbf()).rainbow>=1,'a record over 1000 turns rainbow');
   await press('Escape');assert((await dbf()).open,`${name}: Esc does not dismiss`);
   await click(name==='campaign'?'.sdb-root [data-act=keep]':'.sdb-root [data-act=continue]');await delay(150);
   s=await dbf();assert(!s.open,`${name}: the button dismisses`);
   assert.equal(s.events.at(-1).what,name==='campaign'?'KEEP HOLDING':'CONTINUE',`${name}: its callback ran`);
  }
  assert.deepEqual(await evaluate('window.__dbfConsole'),[],`debrief at ${w} px: no console errors or warnings`);
 }
 // the width toggle holds a phone column on a desktop screen, and the card stacks by its host, not by the screen
 await go('debrief-width-toggle','labs.html?sw=0&acceptance=1&sound=0&still=1#debrief',1280,800);
 await until('!!window.__stalheartDebriefTest');
 {assert.equal(await evaluate('window.__stalheartDebriefTest.width("400")'),400,'the host is 400 px wide');
  await evaluate('window.__stalheartDebriefTest.show("flawless")');const s=await dbf();
  assert(!s.animating&&s.stamps===s.stampsTotal,'?still=1 shows the page complete, stamps down');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".sdb-stats")).gridTemplateColumns.split(" ").length'),2,'a 400 px host stacks the hero stats in two columns');
  assert(s.overflowX<=1&&!s.poking.length,`nothing pokes out of a 400 px host (${JSON.stringify(s.poking)})`);
  current='debrief-width-400-on-1280';await finish();
  await evaluate('window.__stalheartDebriefTest.show("campaign")');await click('.sdb-root [data-act=newrun]');await delay(150);
  assert.equal((await dbf()).events.at(-1).what,'NEW RUN','NEW RUN dismisses with its own callback');}
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
 await until("!!document.querySelector('#td-msg .msg-begin')",20000);
 await click('#td-msg .msg-begin');await until('window.__stalheartTest.state().paused === false');
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
 // a page with a tank from the first frame: since sector 0 (2026-09-24) a bare page has no hull until the Stålheart rolls one out
 await go('mobile-input','index.html?sw=0&cine=0&mobile=1&coarse=1&keyprobe=1&layout=1&world=story&stage=6&phase=expedition#td',844,390);
 const start=Date.now();while(!consoleLines.some(x=>x.includes('S drives, T shields'))&&Date.now()-start<12000)await delay(200);
 assert(consoleLines.some(x=>x.includes('S drives, T shields')));await finish();
await go('shell-explosion','index.html?sw=0&cine=0&acceptance=1&blast=1#td');
 await until('window.__stalheartTest?.state().explosions?.spawned["tank.shell"]===1',30000);await finish();
 await go('terraformer','index.html?sw=0&cine=0&acceptance=1#td');
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
 await go('game-dart','index.html?sw=0&cine=0&creature=mork&acceptance=1#td');
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
 // THE ENEMY STUDY. Guards what Node cannot see: that the dot shader compiles
 // and draws, that each family reports the motion it should — the authored
 // creatures rendered STATIC in gameplay until the vertex-shader port, and a
 // regression there looks like nothing at all — and that the lane actually
 // runs bodies into the tank, since a study nobody can feel is just a chart.
 await go('swarm-study','labs.html?sw=0&acceptance=1#swarm');
 await until('window.__stalheartSwarm && window.__stalheartSwarm.state().built===100');
 {
  const s0=await evaluate('window.__stalheartSwarm.state()');
  assert.equal(s0.motion,'wobble','the authored creatures deform on the GPU');
  assert(s0.calls>0&&s0.points>0,'the crowd is actually drawn');
  assert(await evaluate('window.__stalheartSwarm.set("count",300)'));
  await until('window.__stalheartSwarm.state().built===300');
  assert((await evaluate('window.__stalheartSwarm.state()')).points>s0.points,'more bodies draw more points');
  // the tank must be DRIVEN by default, and the lane must still run without a
  // hand on it — so the test switches to the scripted charge to make progress
  assert.equal(s0.drive,'manual','the study opens under the tester\'s hand');
  await evaluate('window.__stalheartSwarm.set("drive","charge")');
  // the lane closes and the rammable belt goes under the treads: kills climb,
  // the chain counts, and every impact costs the hull speed it earns back
  await until('window.__stalheartSwarm.state().kills>3',30000);
  const ram=await evaluate('window.__stalheartSwarm.state()');
  assert(ram.maxCombo>=2,`a chain forms (${ram.maxCombo})`);
  assert(ram.earned>0,'ramming pays');
  assert(ram.hull<=1,'the hull slows on impact');
  assert.equal(ram.blocked,0,'a white belt never blocks');
  // the ladder wears the game's rungs, and the tenth one shouts
  await until('window.__stalheartSwarm.state().maxCombo>=10',30000);
  assert.equal(await evaluate('document.querySelector("#swarm [data-combo]").hidden'),false,'the ladder shows');
  assert(await evaluate('+document.querySelector("#swarm [data-combo] b").dataset.tier>=1'),'the rung climbs');
  assert(await evaluate('getComputedStyle(document.querySelector("#swarm [data-combo] b")).fontFamily.length>0'),'it wears the shout pack');
  // a solid core stops the hull instead, and breaks the chain
  await evaluate('window.__stalheartSwarm.set("type","drifter")');
  await until('window.__stalheartSwarm.state().blocked>0',30000);
  assert.equal(await evaluate('window.__stalheartSwarm.state().kills'),0,'a solid core is never rammed');
  // the swimmers keep their own motion; the roster's machinery stays static
  await evaluate('window.__stalheartSwarm.set("type","scoutufo")');
  await until('window.__stalheartSwarm.state().motion==="swim"');
  await evaluate('window.__stalheartSwarm.set("type","ghost")');
  await until('window.__stalheartSwarm.state().motion==="static"');
  // the jelly body is a mesh, so it arrives as triangles
  await evaluate('window.__stalheartSwarm.set("count",30);window.__stalheartSwarm.set("form","jelly")');
  await until('window.__stalheartSwarm.state().triangles>0');
  // A RUN IS A FIXED POPULATION. Small, so the suite is not held up by it:
  // the point is that the lane empties and scores itself, not how long it
  // takes. Every body must end up rammed, escaped or blocked — a run that
  // ends with bodies unaccounted for means retire() leaked one.
  await evaluate('window.__stalheartSwarm.set("form","dots");window.__stalheartSwarm.set("type","phage");window.__stalheartSwarm.set("count",8)');
  await until('window.__stalheartSwarm.state().built===8');
  // The two modes must be distinguishable on screen: the owner read a ram
  // count far above the population and reasonably concluded the population was
  // wrong, when it was free play recycling and nothing said so.
  await until('document.querySelector("#swarm .sw-hud").textContent.includes("FREE PLAY")',10000);
  await evaluate('window.__stalheartSwarm.startRun()');
  await until('window.__stalheartSwarm.state().running===true');
  await until('document.querySelector("#swarm .sw-hud").textContent.includes("RUN")',10000);
  await until('window.__stalheartSwarm.state().running===false',60000);
  const rec=await evaluate('(()=>{const r=window.__stalheartSwarm.lastRun();return r&&{...r,series:undefined,gpuSeries:undefined};})()');
  assert(rec,'a finished run leaves a record');
  assert.equal(rec.kills+rec.escaped+rec.blocked,8,`every body is accounted for (${JSON.stringify(rec)})`);
  assert(rec.frame&&rec.frame.n>10,'the run sampled wall-clock frames');
  assert(rec.seconds>0&&rec.calls>0,'the run recorded its shape');
  // kept runs persist so the next run can be read against them
  await evaluate('document.querySelector("#swarm [data-keep]").click()');
  assert.equal(await evaluate('window.__stalheartSwarm.kept().length'),1,'a run can be kept');
  assert.equal(await evaluate('document.querySelectorAll("#swarm .sw-col").length'),2,'the card compares it with this run');
  await evaluate('document.querySelector("#swarm [data-clear]").click()');
  assert.equal(await evaluate('window.__stalheartSwarm.kept().length'),0,'kept runs can be cleared');
 }
 await finish();
 // THE ROADMAP AND THE DEVLOG, AS THE DEV DOCS OVERLAY. The overlay holds no copy of
 // either: it fetches the files, so this asserts they are reachable AND that
 // the generated open-items block reached the page. A release that forgot to
 // ship them renders an explanation rather than an empty document, which is
 // the failure this catches. The retired #notes route redirects here.
 await go('docs-roadmap','labs.html?sw=0&acceptance=1&dev=1&doc=roadmap#units');
 await until('document.querySelectorAll("#notes .nt-body h2").length > 2');
 assert(await evaluate('document.querySelectorAll("#notes .nt-body table").length>0'),'the Now table renders');
 assert(await evaluate('document.querySelectorAll("#notes .nt-toc a").length>2'),'the contents rail is built from the headings');
 assert(await evaluate('document.body.textContent.includes("Open in the log")'),'the generated block is present');
 assert(!(await evaluate('document.body.textContent.includes("unavailable")')),'both documents were fetched');
 {
  const roadmapHeads=await evaluate('document.querySelectorAll("#notes .nt-body h2").length');
  await click('#notes [data-doc="devlog"]');
  await until(`document.querySelectorAll("#notes .nt-body h2").length > ${roadmapHeads}`);
  // filtering hides whole sections, not lines: an entry without its outcome is a headline
  const all=await evaluate('document.querySelectorAll("#notes .nt-body>*").length');
  await evaluate('(()=>{const f=document.querySelector("#notes [data-find]");f.value="ram premium";f.dispatchEvent(new Event("input"));})()');
  const shown=await evaluate('[...document.querySelectorAll("#notes .nt-body>*")].filter(e=>!e.hidden).length');
  assert(shown>0&&shown<all,`the filter narrows the devlog (${shown} of ${all})`);
 }
 await finish();
 // THE MÖRK REVIEW TIERS, as the Units viewer builds them. modelReady only turns
 // true once the real model replaces the placeholder — for a review tier that is
 // the lazy re-show firing, so if it does not, these time out on the procedural
 // tank. Sizes are the BUILT unit the viewer shows, not a prepared mesh: the
 // proxy once carried no baseScale and rendered 1.33x off the hull it stands in
 // for, while every prepare-level test passed.
 {
  const seen = {};
  for (const [id, tris, batches, floor] of [['mork', 24196, 50, 0.99], ['mork-low', 6742, 49, 0.98], ['mork-proxy', 1706, 1, 1]]) {
   // FROZEN POSE. The viewer spins the turntable and sweeps the turret every
   // frame, and an axis-aligned box around a rotating hull is not a size: a first
   // run read the proxy 4.8% wider than the hull, and the hull itself 8% wider
   // than at rest, purely from the angle it was caught at. yaw=0 and sweep=0 are
   // the viewer's own switches for a still, rest-pose unit — and yaw only started
   // actually holding a tank still once show() stopped overriding it.
   await go('units-tier-' + id, `labs.html?sw=0&unit=${id}&yaw=0&sweep=0&acceptance=1#units`);
   await until('window.__stalheartUnits && window.__stalheartUnits.state().modelReady === true');
   const st = await evaluate('window.__stalheartUnits.state()');
   // The release meshopt-packs every model, and packing drops degenerate
   // triangles — how MANY depends on the mesh, so the floor is per tier. Measured
   // 2026-09-14 against the lockfile-pinned gltfpack 1.2.0: the hull lost 114
   // (0.47%), LOW lost 104 (1.54%) and the one-draw proxy lost none. A single 1%
   // floor carried over from the mork-game case passed the hull and failed LOW:
   // a bound derived for a 24k-triangle model does not transfer to a 6.7k one.
   // Exact against source; in the release never MORE, and never under the floor.
   if (production) assert(st.stats.triangles <= tris && st.stats.triangles >= Math.floor(tris * floor),
     `${id} packed triangles ${st.stats.triangles}, source ${tris}, floor ${Math.floor(tris * floor)}`);
   else assert.equal(st.stats.triangles, tris, `${id} triangles ${st.stats.triangles}, expected ${tris}`);
   assert.equal(st.stats.batches, batches, `${id} batches ${st.stats.batches}, expected ${batches}`);   // batches survive packing
   assert.equal(st.proxy, id === 'mork-proxy', `${id} proxy flag`);
   assert(Array.isArray(st.size), `${id} reports its built size`);
   seen[id] = st.size;
   await finish();
  }
  const near = (a, b, tol, what) => assert(Math.abs(a / b - 1) < tol, `${what}: ${a.toFixed(3)} vs ${b.toFixed(3)}`);
  // LOW would replace the shipped hull, so it must be the same size on every axis
  ['x', 'y', 'z'].forEach((ax, i) => near(seen['mork-low'][i], seen.mork[i], 0.02, `mork-low ${ax}`));
  // the proxy must share the ground plan; its height is the pinned authored delta
  near(seen['mork-proxy'][0], seen.mork[0], 0.02, 'mork-proxy x');
  near(seen['mork-proxy'][2], seen.mork[2], 0.02, 'mork-proxy z');
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
 assert.equal(await evaluate('window.__stalheartBeamTest.state().guns'),2);assert.equal(await evaluate('window.__stalheartBeamTest.state().pivots'),2);assert.deepEqual(await evaluate('window.__stalheartBeamTest.state().muzzleOffsets'),[0,0]);
 const beamOpen=await evaluate('window.__stalheartBeamTest.state().preset');assert.equal(beamOpen.glowWidth,0.464,'the beam lab opens on the board glow width');assert.equal(beamOpen.coreWidth,0.0025,'the beam lab opens on the board core width');assert.equal(beamOpen.jitterAmount,0.19);
 await evaluate('window.__stalheartBeamTest.set({glowWidth:2,coreWidth:0.3,rankStep:15});window.__stalheartBeamTest.reset()');assert.deepEqual(await evaluate('window.__stalheartBeamTest.state().preset'),beamOpen,'reset returns the beam lab to the board preset');await finish();
 // METAL LAB: both MÖRK tiers and the kit bays are subjects, and a base colour recolours the dressed tank (measured on the baked albedo)
 await go('metal-subjects','labs.html?sw=0&acceptance=1#metal');
 await until('window.__stalheartMetalTest?.state().ready && window.__stalheartMetalTest.state().dressCount>0',60000);
 assert.deepEqual(Object.keys(await evaluate('window.__stalheartMetalTest.subjects()')).sort(),['bays','container','isao','tank','tank-low'],'the metal lab lists both MÖRK tiers and the kit bays');
 const armour=`window.__stalheartMetalTest.state().materials.find(m=>m.name==="Mork armor / midnight petrol")`;
 assert(await evaluate(`${armour}.map`),'the full MÖRK armour is dressed');const greyMean=await evaluate(`${armour}.mapMean`);
 const dressedBefore=await evaluate('window.__stalheartMetalTest.state().dressCount');
 await evaluate('window.__stalheartMetalTest.setGui("gBase","#ff66cc")');
 await until(`window.__stalheartMetalTest.state().dressCount>${dressedBefore}`,15000);
 const pinkMean=await evaluate(`${armour}.mapMean`);
 assert(pinkMean[0]>greyMean[0]+40&&pinkMean[0]>pinkMean[1]+40,`a pink base recolours the full MÖRK (${greyMean} -> ${pinkMean})`);await finish();
 await evaluate('window.__stalheartMetalTest.select("tank-low")');
 await until('window.__stalheartMetalTest.state().subject==="tank-low" && window.__stalheartMetalTest.state().ready',60000);
 await until(`${armour}?.mapMean?.[0]>${greyMean[0]+40}`,15000);current='metal-tank-low';await finish();
 await evaluate('window.__stalheartMetalTest.select("bays")');
 await until('window.__stalheartMetalTest.state().subject==="bays" && window.__stalheartMetalTest.state().ready',60000);
 assert(await evaluate('window.__stalheartMetalTest.state().materials.length>0'),'the kit container bays load');current='metal-bays';await finish();
 for(const name of ['units','sentry','portal','sim']){await go('lab-'+name,`labs.html?sw=0#${name}`);await delay(1500);await finish();}
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
}catch(err){writeFileSync(join(output,current+'-failure.json'),JSON.stringify({error:String(err),state:await evaluate('window.__stalheartTest?.state()').catch(()=>null),errors,consoleLines,requests},null,2));
 try{const shot=await send('Page.captureScreenshot',{format:'png'});writeFileSync(join(output,current+'-failure.png'),Buffer.from(shot.data,'base64'));}catch{}   /* the screen as it failed, next to the record */
 console.error(err);process.exitCode=1;}
finally{cleanup();}
