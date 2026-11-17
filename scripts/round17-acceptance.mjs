import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

// A feedback pilot, not the removed automatic flare: it sends the same
// throttle/tilt/legs inputs all the way down and spends the actual fuel.
export const manualPilot = `(()=>{const T=window.__stalheartTest;window.__flightPhases=[];(function fly(){
 const L=T.state().arrival?.landing;if(!L)return;
 if(__flightPhases.at(-1)!==L.phase)__flightPhases.push(L.phase);
 if(L.phase==='done'||L.phase==='touched')return;
 if(L.phase==='manual'){
  const sink=L.sink,wantSink=Math.min(24,Math.sqrt(Math.max(0,L.altitude-3)*4)+1),wantVx=Math.max(-4,Math.min(4,-L.along*.25));
  const tilt=L.altitude<6?0:Math.max(-.3,Math.min(.3,(wantVx-L.vx)*.15));
  const throttle=Math.max(0,Math.min(1,(3.2+(sink-wantSink)*1.6-.0016*sink*sink)/(12*Math.cos(L.tilt))));
  T.landing('input',{throttle,tiltRate:Math.max(-1,Math.min(1,(tilt-L.tilt)*6)),legs:true});
 }requestAnimationFrame(fly);})();})()`;

export async function round17({go,until,evaluate,send,delay,finish}) {
  const T='window.__stalheartTest',P='window.__stalheartPilotTest',L=`${T}.state().arrival.landing`;
  const key=async(code,on)=>send('Input.dispatchKeyEvent',{type:on?'keyDown':'keyUp',code,key:code==='Space'?' ':code.slice(3).toLowerCase()});
  const tap=async(code)=>{await key(code,true);await key(code,false);};
  const shot=async(name)=>{await finish();const p=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`artifacts/browser/${name}.png`,Buffer.from(p.data,'base64'));};
  await go('round17-landing-dog','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1&dog=1&first=1#td');
  await until(`${T}?.state().arrival?.signature`,120000);await evaluate(`${T}.landing('skip')`);
  await until(`${L}?.phase==='manual'`,20000);await evaluate(manualPilot);
  await until(`${L}.altitude<80`,60000);
  assert.equal(await evaluate(`${L}.phase`),'manual');
  assert.ok(await evaluate(`Number(document.querySelector('#lh-speed').textContent)>0`),'speed telemetry follows the moving ship');
  await shot('round17-flight-hud');
  await until(`['touched','done'].includes(${L}.phase)`,60000);
  const landed=await evaluate(L);assert.notEqual(landed.grade,'CRASH');assert.notEqual(landed.reason,'skipped');
  assert.ok(!(await evaluate('__flightPhases')).includes('flare'),'no automatic takeover before touchdown');
  console.log('  manual touchdown',landed.grade,landed.sink);
  await until(`(()=>{document.querySelector('#gunship-briefing:not([hidden]) [data-skip]')?.click();return ${T}.dog.state().active;})()`,180000);await delay(3500);
  await tap('KeyH');await until(`${T}.dog.state().trick==='paw'`);await delay(1200);
  const hand=await evaluate(`${T}.dog.state()`);assert.equal(hand.clip,'Give_Paw');assert.ok(hand.facingCamera>.4&&hand.facingCamera<.9,`three-quarter facing ${hand.facingCamera}`);
  assert.equal(await evaluate(`document.querySelector('#controls-card')?.hidden`),true,'H belongs to the dog in this seat');
  await shot('round17-dog-hand');await until(`${T}.dog.state().trick===null`,10000);
  await tap('KeyB');await until(`${T}.dog.state().trick==='bark'`);await until(`${T}.dog.state().trick===null`,5000);
  await tap('KeyR');await until(`${T}.dog.state().clip==='Roll_Over'`);await tap('KeyW');await until(`${T}.dog.state().trick===null`,5000);
  for(const [index,kind] of [[0,'rock'],[1,'biomass']]) {
    await evaluate(`${T}.dog.goto(${index},8)`);await delay(2000);
    await evaluate(`${T}.dog.goto(${index},4)`);await delay(400);await until(`${T}.dog.state().scan.beam`,5000);
    await shot(`round17-scan-${kind}`);
    await until(`${T}.dog.state().scan.result==='${kind}'`,10000);
    assert.match(await evaluate(`document.querySelector('.scout-scan-hud').textContent`),/SCAN COMPLETE/);
  }
  await shot('round17-scan-results');
  await go('round17-quiver','index.html?sw=0&acceptance=1&cine=0&world=story&skip=quiver#td');
  await until(`${P}?.state().ready && ${P}.state().key==='quiver'`,120000);
  await evaluate(`document.querySelector('#controls-card [data-close]')?.click()`);
  await until(`!${T}.state().shot`,30000);
  await key('KeyA',true);await delay(250);await key('KeyA',false);
  const x0=await evaluate(`${P}.guidance().x`);await delay(100);const x1=await evaluate(`${P}.guidance().x`);
  assert.ok(x1<x0-.005,'reticle coasts after release');await finish();
  // Round 19 moves the enlarged radar lesson to the tank's unlock.
  assert.equal(await evaluate(`!!document.querySelector('.sensor-radar-copy')`),false,'no tank lesson during Quiver control');
  console.log('  dog keys, eye scans, reticle inertia and no premature tank lesson passed');
}

export async function round17Gunship({go,until,evaluate,finish}) {
 const T='window.__stalheartTest',P='window.__stalheartPilotTest';
 await go('round17-gunship','index.html?sw=0&acceptance=1&cine=0&world=story&skip=quiver#td');
 await until(`${P}?.state().ready && ${P}.state().key==='quiver'`,120000);
 await until(`(()=>{${T}.sectorCull(999);document.querySelector('.sensor-card button')?.click();return ${T}.seatState().gunshipSeat;})()`,60000);
 assert.equal(await evaluate(`${T}.state().story.phase`),'construction');
 await finish();console.log('  Quiver clear hands directly to the gunship');
}

export async function landingHelmet({go,until,evaluate,send,delay,finish}) {
 const T='window.__stalheartTest',L=`${T}.state().arrival.landing`;
 await go('landing-helmet','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1#td');
 await until(`${T}?.state().arrival?.signature`,120000);await evaluate(`${T}.landing('skip')`);
 await until(`${L}?.phase==='manual'`,20000);await evaluate(manualPilot);
 await until(`${L}.altitude<200`,60000);
 const readings=await evaluate(`['alt','speed','sink','drift','tilt','rate','throttle','tw','stop','fuel'].map(k=>{const e=document.querySelector('#lh-'+k),r=e.getBoundingClientRect();return {k,text:e.textContent,size:parseFloat(getComputedStyle(e).fontSize),x:r.x,y:r.y,right:r.right,bottom:r.bottom};})`);
 assert.equal(readings.length,10);assert.ok(readings.every(r=>r.text!=='—'&&r.x>=0&&r.right<=1440&&r.y>=0&&r.bottom<=900));
 assert.ok(readings.filter(r=>['alt','speed'].includes(r.k)).every(r=>r.size>=36&&(r.right<1440*.4||r.x>1440*.6)),'large primary readouts outside the rocket corridor');
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('#landing-hud')).backgroundColor`),'rgba(0, 0, 0, 0)');
 const clearTutorial = `(()=>{const c=document.querySelector('#skip-tutorial')?.getBoundingClientRect();return !c||['alt','speed','sink','drift','tilt','rate','throttle','tw','stop','fuel'].every(k=>{const r=document.querySelector('#lh-'+k).getBoundingClientRect();return r.right<=c.left||r.left>=c.right||r.bottom<=c.top||r.top>=c.bottom;});})()`;
 assert.ok(await evaluate(clearTutorial),'desktop tutorial does not cover telemetry');
 await finish();
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(350);
 assert.ok(await evaluate(`['alt','speed','sink','drift','tilt','rate','throttle','tw','stop','fuel'].every(k=>{const r=document.querySelector('#lh-'+k).getBoundingClientRect();return r.x>=0&&r.right<=390&&r.y>=0&&r.bottom<=844;})`),'all mobile telemetry fits');
 assert.ok(await evaluate(clearTutorial),'narrow tutorial does not cover telemetry');
 const mobile=await send('Page.captureScreenshot',{format:'png'});writeFileSync('artifacts/browser/landing-helmet-mobile.png',Buffer.from(mobile.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:false});await delay(350);
 assert.ok(await evaluate(clearTutorial),'short landscape tutorial does not cover telemetry');
 const landscape=await send('Page.captureScreenshot',{format:'png'});writeFileSync('artifacts/browser/landing-helmet-landscape.png',Buffer.from(landscape.data,'base64'));
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await until(`${L}.altitude<80`,60000);
 const low=await send('Page.captureScreenshot',{format:'png'});writeFileSync('artifacts/browser/landing-helmet-final-descent.png',Buffer.from(low.data,'base64'));
 await until(`['touched','done'].includes(${L}.phase)`,60000);assert.equal(await evaluate(`${L}.grade`),'CLEAN');
 console.log('  helmet HUD: ten live readings, large peripheral primary figures, transparent center, mobile fit, CLEAN manual touchdown');
}
