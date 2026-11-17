import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { round19 } from './round19-acceptance.mjs';
export async function round20(h) {
 const {go,until,evaluate,send,delay,finish}=h,T='window.__stalheartTest',P='window.__stalheartPilotTest',R=`${T}.rover.state()`;
 const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`artifacts/browser/${name}.png`,Buffer.from(s.data,'base64'));};
 if(!h.resourcesOnly)await round19({...h,openingOnly:true,onRotor:async()=>{
   const at=Date.now();await until(`${P}.aimEnemy()!=null`,2000);
   console.log('  Rotor target available after handoff:',Date.now()-at,'ms',await evaluate(`${P}.reach().filter(e=>e.los&&e.m<46).slice(0,5)`));
   await shot('round20-gate-and-rotor');
 }});
 await go('round20-resource-flight','index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&pets=born#td');
 await until(`${R}.ready`,120000);
 await evaluate(`${T}.sectorQuiet(true);${T}.sectorCull(999);document.querySelector('#controls-card [data-close]')?.click();${T}.rover.fillPearls();${T}.rover.spend(8000)`);
 const initial=await evaluate(R),target=initial.deposits[0];assert.equal(initial.stock,8);
 await evaluate(`${T}.rover.mine(${JSON.stringify(target.id)})`);
 await until(`${R}.fleet[0].height>12`,20000);
 const flying=await evaluate(`${R}.fleet[0].thrusters`);assert.equal(flying.sockets,4);assert.ok(flying.intensity>0);
 await shot('round20-sai-flight');
 await until(`${R}.fleet[0].mode==='harvest'&&${R}.fleet[0].height<6&&${R}.fleet[0].thrusters.wash.k>0`,90000);
 await shot('round20-sai-landing');
 console.log('  SAI flight and landing FX:',await evaluate(`${R}.fleet[0].thrusters`));
 await evaluate(`${T}.placeTank(${target.cell})`);await delay(300);
 const press=async()=>{await send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF'});await delay(160);};
 for(let i=0;i<8;i++)await press();assert.equal(await evaluate(`${R}.stock`),0);
 await press();assert.equal(await evaluate(`${R}.stock`),0);await delay(300);
 assert.match(await evaluate(`document.querySelector('.flare-status').textContent`),/0\/8.*CARGO DROP-OFF FLAGS/);
 await shot('round20-empty-flares');
 const before=await evaluate(`${T}.state().sounds`);
 const cell=await evaluate(`${T}.cargoStand('home')`);assert.ok(cell>=0,'cargo flags have an accessible standing cell');
 console.log('  refill stand',cell,await evaluate(`(()=>{${T}.placeTank(${cell});return {p:${T}.state().playerPosition,pad:${T}.state().cargo.pad};})()`));await until(`${R}.stock===8`,5000);await delay(300);
 const parked=await evaluate(`${T}.state()`),pad=parked.cargo.pad;assert.ok(Math.hypot(...parked.playerPosition.map((x,i)=>x-pad.at[i]))<pad.reach*1.15,'tank actually stands inside the cargo refill ring');
 const after=await evaluate(`${T}.state().sounds`);assert.equal(after.tank_shells,(before.tank_shells??0)+1,'one shell-loading sound on refill');
 await delay(1000);assert.equal(await evaluate(`${T}.state().sounds.tank_shells`),after.tank_shells,'no repeated refill sound while full');
 console.log('  cargo-flag refill: 8/8, one shell-loading sound',await evaluate(`${T}.state().cargo.pad`));
 await shot('round20-refilled-flares');await finish();
}
