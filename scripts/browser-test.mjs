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
 browser=launchChrome(['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--window-size=1440,987','--hide-scrollbars','--mute-audio'],{watchdogMs:360000});
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
 await evaluate('window.__stalheartTest.restart()');assert.equal((await evaluate('window.__stalheartTest.state().breaches')).length,2);current='game-breach-reset';await finish();
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
 } else if(args.includes('--sniper')) {
 await go('sniper-roster','labs.html?sw=0&acceptance=1&sound=1&swaySlow=0&swayFast=0#sniper');
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
 await evaluate('window.__stalheartSniperTest.mortarAim([4,0,20])');await click('#sniper-fire');
 await until('window.__stalheartSniperTest.state().mortar.impacts.length>0',60000);
 const landing=await evaluate('window.__stalheartSniperTest.state().mortar.impacts[0]');assert(landing.radius>0);assert(Math.abs(landing.point[0]-4)<3);
 current='sniper-mortar-landing';await finish();
 await evaluate('window.__stalheartSniperTest.select("quiver");window.__stalheartSniperTest.distance(20)');await until('window.__stalheartSniperTest.state().ready');

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
 await go('mork-game','index.html?sw=0&cine=0&tutorial=0&creature=mork&acceptance=1#td');
 await until('window.__stalheartTest.state().playerAsset === "mork" && window.__stalheartTest.state().playerAssetReady');
 assert.deepEqual(await evaluate('window.__stalheartTest.state().playerModelStats'),{triangles:24196,batches:50});
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
 await go('mork-workshop' ,'labs.html?sw=0&unit=mork&acceptance=1#units');
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
 assert.equal(missile.pool.triangles,188);assert.equal(missile.pool.batches,4);
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
  await go('catalog-'+lab,`labs.html?sw=0#${lab}`);
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
