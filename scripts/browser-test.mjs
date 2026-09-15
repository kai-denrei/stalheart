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
import { LASER_VIEW } from '../src/content/orbital-laser.js';
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
  await delay(1500);current='gunship-briefing';await finish();await evaluate('document.querySelector("#gunship-briefing [data-next]").click()');await delay(300);await evaluate('document.querySelector("#gunship-briefing [data-skip]").click()');await delay(1200);
  assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'skipping the briefing takes the seat');
  const s=await evaluate('window.__stalheartTest.state().gunship');assert(s.mounted&&s.seat&&s.optic,`thermal optic live ${JSON.stringify(s)}`);
  assert.equal(await evaluate('document.querySelector("#story-monitor .head").textContent'),'GROUND TRUTH · IMPACT','the monitor shows the impact point');
  assert((await evaluate('document.querySelector("#gunship-hud [data-f=blast]").textContent')).length>0,'the danger readout is written in the HUD');
  assert(await evaluate('!!document.querySelector("#gunship-hud .reticle circle")'),'the rotary reticle is up');
  current='gunship-pov-rotary';await finish();
  await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(400);assert(await evaluate('!!document.querySelector("#gunship-hud .reticle path")'),'the strike reticle is up');current='gunship-pov-heavy';await finish();
  assert(await evaluate('document.querySelector("#tab-td").classList.contains("gunship-thermal")'),'the seat opens in thermal');assert.equal(await evaluate('getComputedStyle(document.querySelector("#td-app canvas")).filter'),'url("#flir")','thermal is the FLIR ironbow');assert.equal(await evaluate('getComputedStyle(document.querySelector("#td-app canvas.minimap")).filter'),'none','the radar keeps its own green');assert(await evaluate('window.__stalheartTest.state().gunship.seat'),'still seated');current='gunship-thermal';await finish();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'m',code:'KeyM'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'m',code:'KeyM'});await delay(400);assert(await evaluate('document.querySelector("#tab-td").classList.contains("gunship-normal")'),'M cycles to normal');current='gunship-normal';await finish();
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'m',code:'KeyM'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'m',code:'KeyM'});await delay(200);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT'});await delay(800);current='gunship-top-view';await finish();await send('Input.dispatchKeyEvent',{type:'keyDown',key:'t',code:'KeyT'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'t',code:'KeyT'});await delay(400);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'v',code:'KeyV'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'v',code:'KeyV'});await delay(600);current='gunship-third';await finish();
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
  // THE GUNSHIP'S OWN 105: paint, launch, the shell falls from the seat, the blast lands, then the reload is read
  await evaluate('window.__stalheartTest.gunshipGun("heavy")');await delay(300);await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(200);
  assert.equal((await evaluate('window.__stalheartTest.state().gunship.heavy')).phase,'painted','the first press paints');
  await evaluate('window.__stalheartTest.gunshipHold(true)');await delay(300);const fl=await evaluate('window.__stalheartTest.state().gunship');assert.equal(fl.heavy.phase,'falling','the second press launches');assert(fl.seat,'the camera never left the seat');
  current='gunship-heavy-falling';await finish();await delay(3800);assert.equal((await evaluate('window.__stalheartTest.state().explosions')).spawned['gunship.heavy'],1,'the 105 lands as the howitzer blast');const rl=await evaluate('window.__stalheartTest.state().gunship');assert.equal(rl.heavy.phase,'reloading',`after the fall the gun reloads (${JSON.stringify(rl.heavy)})`);current='gunship-heavy-reloading';await finish();}
 // THE SKIP MARKER: the panel beside the build tag opens the seat by itself and raises enemies, which then read hot in the thermal optic
 await go('gunship-skip','index.html?sw=0&cine=0&world=story&stage=6&acceptance=1&gunship=station&skip=gunship&enemies=24&brief=0#td');
 await until('!!window.__stalheartTest && window.__stalheartTest.state().gunship.seat',120000);await delay(9000);
 {const s=await evaluate('window.__stalheartTest.state()');assert(s.gunship.seat&&s.gunship.optic,'the skip took the seat');assert(s.performance.enemies>=10,`enemies raised by the skip (${s.performance.enemies})`);assert.deepEqual(s.enemyTypes,['amoeba'],'the skip raises the white amoeba swarm');
  assert(await evaluate('document.querySelector("#shell-nav [data-entry=jump-gunship]").classList.contains("active")'),'the drawer marks the jump we came from');
  await evaluate('document.querySelector("#shell-nav [data-tool=raise]").click()');await delay(1500);const more=await evaluate('window.__stalheartTest.state().performance.enemies');assert(more>s.performance.enemies,`the + button raised more (${more})`);}
 current='gunship-skip-enemies';await finish();
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
 } else if(args.includes('--defense')) {
 // THE HANDOVER (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): past the Quiver the towers fire
 // on their own and the wave clock runs; the gunship waits for an earned call; the tank clears a nest and brings a part home
 await go('defense-handover','index.html?sw=0&acceptance=1&cine=0&world=story&stage=6&phase=expedition#td');
 await until('!!window.__stalheartTest && (window.__stalheartTest.state().storyLod||[]).some(l=>l.id==="stalheart")',90000);await delay(2500);
 {const s=await evaluate('window.__stalheartTest.state()');assert.equal(s.story.phase,'expedition','the jump lands past the handover');assert.equal(s.automated,true,'automated');
  assert.equal(await evaluate('document.querySelectorAll("#story-views [data-mount]:not([data-mount=gunship])").length'),0,'no tower mounts after the handover');
  assert(await evaluate('!!document.querySelector("#story-views [data-view=tank]")'),'the tank is offered');
  assert(/GUNSHIP · \d+%$/.test(await evaluate('document.querySelector("#story-views [data-mount=gunship]").textContent')),'the gunship button shows the call-in meter');
  assert(s.expeditions.sites.filter(x=>x.state==='guarded').length===3,'the first three sites are guarded');}
 await finish();
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
  await evaluate(`window.__stalheartTest.placeTank(${cells['rocket-a'].cell})`);
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-a"',10000);
  current='defense-part-carried';await finish();
  await evaluate('window.__stalheartTest.placeTank(window.__stalheartTest.state().storyHome)');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-a").state==="delivered"',10000);
  const unlocked=await evaluate('window.__stalheartTest.state().unlocked');assert(unlocked.includes('relay'),`the Relay unlocks (${unlocked})`);
  // a hull lost while carrying drops the part back at its site
  await delay(4000);await evaluate('window.__stalheartTest.killGuards("rocket-b")');
  await until('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state==="cleared"',10000);
  await evaluate(`window.__stalheartTest.placeTank(${cells['rocket-b'].cell})`);
  await until('window.__stalheartTest.state().expeditions.carrying==="rocket-b"',10000);
  await evaluate('window.__stalheartTest.hitTank()');await delay(600);
  assert.equal(await evaluate('window.__stalheartTest.state().expeditions.sites.find(s=>s.id==="rocket-b").state'),'cleared','the part is back at its site');}
 current='defense-part-dropped';await finish();
 } else if(args.includes('--shield-story')) {
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
 await evaluate(`${T}.placeTank(${pad.cell})`);await until(`!${S}.shield.active`,15000);await evaluate(`${T}.shieldAdvance(2.2)`);
 // rams: the premium floats over the hull as +N kg ×M, the combo climbs, the tier callouts land
 await evaluate(`window.__calls=[];new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>__calls.push(n.textContent)))).observe(document.querySelector('#td-callouts'),{childList:true})`);
 {const r0=(await st()).ram;await evaluate(`${T}.spawnFodder(30)`);let shot=false;
  for(let i=0;i<220;i++){s=await st();const f=s.foes.find(f=>f[1]);if(f)await evaluate(`${T}.placeTank(${f[0]})`);else if(s.ram.rams>r0.rams+12&&!s.foes.some(f=>f[1]))break;
   if(!shot&&s.ram.combo>=6&&s.ram.float.live>0){shot=true;current='shield-array-ram';await finish();}await delay(100);}
  s=await st();const calls=await evaluate('window.__calls');
  assert(s.ram.rams-r0.rams>=10,`the tank rams the fodder (${s.ram.rams-r0.rams})`);assert(s.ram.best>=10,`the combo reaches ten (${s.ram.best})`);
  assert(s.ram.biomass>r0.biomass,'rams pay biomass');assert(s.ram.float.shown>=s.ram.rams-r0.rams,'every ram floats its premium');
  assert(/^\+\d+ kg ×\d+$/.test(s.ram.float.last),`the readout says +N kg ×M (${s.ram.float.last})`);assert(s.ram.float.live<=s.ram.float.max,'the pool is bounded');
  assert(calls.includes('RAM ×10'),`the x10 tier callout lands (${calls.join(' | ')})`);assert(shot,'a ram readout was on screen');}
 await evaluate(`${T}.placeTank(${pad.cell})`);await delay(400);current='shield-array-end';await finish();
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
 await until('!!window.__stalheartPilotTest',30000);await until('window.__stalheartTest.state().performance.enemies>0',60000);await delay(14000);
 const fodder=await evaluate('window.__stalheartTest.state()');assert(fodder.performance.enemies>=2&&fodder.performance.enemies<=50,`fodder alive ${fodder.performance.enemies}`);   // the first wave is one fifty-strong swarmassert.equal(fodder.performance.wave,0,'no wave arms');
 assert.deepEqual(fodder.enemyTypes,['amoeba'],'the first wave is the white amoeba');assert.equal(fodder.insideEnemies,0,'the closed gate holds the fodder outside');assert.equal(fodder.queued,0);
 current='story-world-fodder';await finish();
 await until('window.__stalheartPilotTest.aimEnemy()!==null',15000);const victim=await evaluate('window.__stalheartPilotTest.aimEnemy()');assert(victim!==null,'an amoeba is in reach and sight of the Rotor');   // the pile at the gate shuffles; give it a moment
 await evaluate('window.__stalheartPilotTest.hold(true)');
 // the fodder keeps walking, so re-aim each poll until this one drops; every poll also banks the Rotor's own heat peak (see below)
 await until(`(()=>{const t=window.__stalheartPilotTest;const p=t.state();if(p.key==='rotor')window.__rotorHeatMax=Math.max(window.__rotorHeatMax||0,p.heat);const e=t.enemy(${victim.id});if(!e||!e.alive)return true;t.aimEnemy();return false;})()`,8000);await evaluate('window.__stalheartPilotTest.hold(false)');
 const shots=await evaluate('window.__stalheartPilotTest.state().shots');assert(shots>=2,'the Rotor streamed rounds');assert((await evaluate('window.__stalheartTest.state().brassLive'))>0,'spent cases fell from the Rotor in sentry control (docs/AMMUNITION.md)');current='story-world-rotor-kill';await finish();
 // keep shooting: the fifth kill brings the comms study, the tenth the biomass line
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();const p=window.__stalheartPilotTest.state();if(p.key==="rotor")window.__rotorHeatMax=Math.max(window.__rotorHeatMax||0,p.heat);if(s.story.said.includes("harvest_biomass"))return true;window.__stalheartPilotTest.aimEnemy();return false;})()',120000);
 await evaluate('window.__stalheartPilotTest.hold(false)');const said=await evaluate('window.__stalheartTest.state().story.said');assert(said.includes('alien_comms')&&said.includes('harvest_biomass'),'both lines said');
 // THE HEAT CHECK READS THE ROTOR'S OWN PEAK, NOT A FRESH BURST (owner, 2026-09-14): confirmed live that a piloted Rotor can clear the whole wave during the waits above and the game hands control to the Quiver 0.6s later (STORY_QUIVER.delay) — read here, `state().key` is already 'quiver', heat 0, held reset by the hand-over's own attach(). A burst fired at THIS point fires the wrong mount, so every poll above banked the Rotor's own heat while it was still the Rotor, and the peak it reached is what is asserted on
 const heatPeak=await evaluate('window.__rotorHeatMax||0');assert(heatPeak>0.05,`the barrels carry heat after a burst (${heatPeak})`);
 await delay(400);current='story-world-harvest';await finish();
 // THE FIRST WAVE DOWN IS THE NEXT UNLOCK: keep firing until the twenty are spent and none stand, then Isao's line and the view strip
 if(!(await evaluate('window.__stalheartTest.state().story.said')).includes('wave_cleared'))assert.equal(await evaluate('document.querySelector("#story-views")'),null,'no view strip before the wave is cleared');   // a piloted Rotor can clear the whole wave during the kills above (2026-09-14), and phase can move past 'cleared' to 'quiver-piloting' the same tick it is set, so said is checked instead of the exact phase
 await evaluate('window.__stalheartPilotTest.hold(true)');
 await until('(()=>{const s=window.__stalheartTest.state();if(s.story.said.includes("wave_cleared"))return true;const t=window.__stalheartPilotTest;if(t.state().overheated)return false;t.aimEnemy();return false;})()',480000);
 await evaluate('window.__stalheartPilotTest.hold(false)');const cleared=await evaluate('window.__stalheartTest.state()');assert(cleared.story.said.includes('wave_cleared'));await until('window.__stalheartTest.state().performance.enemies===0',5000);   // the performance block is a periodic sample
 await until('!!document.querySelector("#story-views")',5000);await delay(600);current='story-world-cleared';await finish();
 // the view strip is exercised after the Quiver: the hand-over now follows the cleared wave almost at once (owner, 2026-09-13)
 // THE QUIVER: printed across the lane while the wave was fought, handed over the moment the wave is down (its post first,
 // the Rotor's behind it), two TALON shots with the seeker feed riding along, then settled and the strip is back
 await until('window.__stalheartTest.state().story.phase==="quiver-piloting"',120000);await delay(600);
 const qp=await evaluate('window.__stalheartPilotTest.state()');assert.equal(qp.key,'quiver','the Quiver optic first');assert.equal(qp.posts.length,2,'both mounts are posts');
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
 await go('story-default-route','index.html?sw=0#td');await until('document.querySelector("#shell-nav [data-entry=story]")!==null');await delay(2500);
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
 // how much ground the square inset covers: 2 tan(fov/2) * altitude * radius, in LASER_VIEW's own numbers against the
 // story planet's 753 m radius. This is only the GAIN of the aim loop below, which re-reads the contact every step:
 // being out by a third changes how fast it converges and nothing else, so it never needs measuring in the browser.
 const laserSpan=2*Math.tan(LASER_VIEW.fov*Math.PI/360)*LASER_VIEW.altitude*753;
 // screen up is +z and screen left is +x (the satellite's up is the frame's north and it looks straight down)
 const laserAim=(state,to)=>laserSteer(clamp01(.5-(to[0]-state.contact[0])/laserSpan),clamp01(.5-(to[2]-state.contact[2])/laserSpan));
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
 // THEN ACROSS THE GATE MOUTH, IN STEPS. The twelve wall cells stand either side of the trench's own line, so no drag
 // along the trench reaches one — and a cell needs half a second of contact, which a 40 m/s drag through a 6 m
 // footprint never gives it (0.24 s at best). The beam nudges sideways and then stands still, the way a hand would.
 for(let i=0;i<8;i++){
  await laserSteer(.44,.5);await delay(140);
  await laserSteer(.5,.5);await delay(560);
  const s=await laserState();
  if(s.walls>0&&i>=3)break;
 }
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
 await go('mobile-input','index.html?sw=0&cine=0&mobile=1&coarse=1&keyprobe=1&layout=1#td',844,390);
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
}catch(err){writeFileSync(join(output,current+'-failure.json'),JSON.stringify({error:String(err),state:await evaluate('window.__stalheartTest?.state()').catch(()=>null),errors,consoleLines,requests},null,2));console.error(err);process.exitCode=1;}
finally{cleanup();}
