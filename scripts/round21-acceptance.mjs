import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
export async function round21({go,until,evaluate,send,delay,finish}){
 const T='window.__stalheartTest',R=`${T}.rover.state()`;
 await go('round21-field','index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&sector=2&pets=born#td');
 await until(`${R}.ready`,120000);await evaluate(`${T}.sectorQuiet(true);${T}.sectorCull(999);document.querySelector('#controls-card [data-close]')?.click();${T}.rover.fillPearls();${T}.rover.spend(8000)`);
 await evaluate(`(()=>{window.__r21={up:1,frames:0,phases:{},low:[],high:[]};const f=()=>{const s=${T}.state(),r=${R}.fleet[0],i=s.programme?.isao,L=window.__r21;if(i){const [x,y,z,w]=i.quat,up=[2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w)],n=Math.hypot(...i.pos);L.up=Math.min(L.up,up.reduce((v,a,k)=>v+a*i.pos[k]/n,0));L.frames++;}L.phases[r.flightPhase]=(L.phases[r.flightPhase]??0)+1;if(r.flightPhase==='coast'){(r.localHop?L.low:L.high).push(r.height);L.coastOff=(L.coastOff??true)&&r.thrusters.intensity===0;}if(!L.stop)requestAnimationFrame(f);};f();})()`);
 const piles=await evaluate(`(()=>{const ci=${T}.rover.openNear(${R}.deposits[0].cell),other=${T}.rover.ring(ci)[0];${T}.rover.lay(ci,600);${T}.rover.lay(other,600);${T}.rover.flareAt(ci);return [ci,other];})()`);assert.ok(piles.every(Number.isInteger));
 await until(`__r21.low.length>0&&__r21.high.length>0`,90000);
 await until(`${R}.deliveredBy.biomass>=1000`,90000);
 const record=await evaluate(`(__r21.stop=true,__r21)`);assert.ok(record.up>.9999,'Isao stays upright');assert.ok(record.coastOff);assert.ok(Math.max(...record.low)<12,'local pickup hops stay low');assert.ok(Math.max(...record.high)>=32);
 console.log('  flight:',{up:record.up,frames:record.frames,phases:record.phases,lowMax:Math.max(...record.low),high:Math.max(...record.high)});
 // Force a visible competing HUD at the original flare position; the supply strip must move clear.
 await evaluate(`(()=>{const b=document.createElement('div');b.id='ground-feed';b.dataset.r21='block';b.style.cssText='position:fixed;right:0;bottom:70px;width:340px;height:250px';document.body.append(b);})()`);await delay(400);
 const rects=await evaluate(`(()=>{const a=document.querySelector('.flare-status'),b=document.querySelector('[data-r21=block]'),r=a.getBoundingClientRect(),s=b.getBoundingClientRect();return {visible:getComputedStyle(a).visibility,overlap:r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top};})()`);assert.equal(rects.visible,'visible');assert.equal(rects.overlap,false);
 await evaluate(`document.querySelector('[data-r21=block]').remove()`);await finish();
 const s=await evaluate(`${T}.state()`);console.log('  shell works:',s.programme.colony.pad);
 if(s.programme.colony.pad?.standing){assert.equal(s.programme.colony.pad.crates,2);assert.equal(s.programme.colony.pad.warheads,13);await evaluate(`${T}.placeTank(${s.programme.colony.cell});${T}.setAmmo(0);${T}.showcase.ground(${s.programme.colony.cell},3,3)`);await delay(1000);const p=await send('Page.captureScreenshot',{format:'png'});writeFileSync('artifacts/browser/round21-shell-works.png',Buffer.from(p.data,'base64'));}
}
