// Sequential real-browser acceptance. Own server + isolated Chrome + bounded calls.
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { launchChrome } from './chrome-proc.mjs';
import assert from 'node:assert/strict';
import { SENTRIES } from '../src/content/sentries.js';
import { CONTENT } from '../src/content/runtime.js';
import { clone, serializePreset } from '../src/content/preset.js';
const args=process.argv.slice(2),production=args.includes('--dist');
const port=18155,base=production?'/stalheart/':'/';
const origin=`http://127.0.0.1:${port}`,urlRoot=origin+base;
const output=resolve('artifacts/browser'+(production?'-dist':''));mkdirSync(output,{recursive:true});
const profile=mkdtempSync(join(tmpdir(),'stalheart-chrome-'));
const server=spawn(process.execPath,['scripts/serve.mjs','--port',String(port),'--dir',production?'dist':'.','--base',base],{stdio:['ignore','pipe','pipe']});
let browser,ws,counter=0;const pending=new Map(),consoleLines=[],errors=[],requests=[];let current='boot';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function cleanup(){try{ws?.close();}catch{}browser?.kill();server.kill('SIGTERM');try{rmSync(profile,{recursive:true,force:true});}catch{}}
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
 for(const name of ['units','impact','sentry','sim']){await go('lab-'+name,`labs.html?sw=0#${name}`);await delay(1500);await finish();}
 }
 // All three visual entry points must resolve the same eight actual GLBs.
 for(const lab of ['units','sentry','impact']) {
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
  await finish();
 }
 await go('retired-roster-link','index.html?sw=0&cine=0&roster=1#td',844,390,'index.html?sw=0&cine=0&roster=2#td');
 assert.equal(await evaluate('new URLSearchParams(location.search).get("roster")'),'2');
 await finish();
 // Real file import -> lab working copy -> shared draft -> actual game selection.
 const draft=clone(CONTENT);draft.id='browser-fx';draft.weapons.lancer.impact.size=.93;draft.audio.kinetic_fire.gain=.37;
 const fixture=join(output,'browser-fx.json');writeFileSync(fixture,serializePreset(draft));
 await go('preset-import','labs.html?sw=0#impact');
 const doc=await send('DOM.getDocument');
 const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'[data-preset-import]'});
 await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixture]});
 await until('document.querySelector("[data-preset-id]").value === "browser-fx"');
 await click('[data-preset-save]');await finish();
 await go('lab-audio','labs.html?sw=0&acceptance=1#audio');
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
 console.log(`Browser acceptance passed (${production?'release /stalheart/':'source'}). Artifacts: ${output}`);
}catch(err){writeFileSync(join(output,current+'-failure.json'),JSON.stringify({error:String(err),errors,consoleLines,requests},null,2));console.error(err);process.exitCode=1;}
finally{cleanup();}
