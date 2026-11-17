import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
export async function round19({go,until,evaluate,send,delay,finish,openingOnly=false,onRotor=null}){
 const T='window.__stalheartTest',R=`${T}.rover.state()`,state=()=>evaluate(`${T}.state()`);
 const shot=async name=>{const p=await send('Page.captureScreenshot',{format:'png'});writeFileSync(`artifacts/browser/${name}.png`,Buffer.from(p.data,'base64'));};
 await go('round19-opening','index.html?sw=0&acceptance=1&cine=0&world=story&landing=1&dog=1&first=1#td');
 await until(`${T}?.state().arrival?.signature`,120000);await evaluate(`${T}.landing('skip')`);
 await until(`${T}.state().arrival.landing?.phase==='manual'`,30000);await evaluate(`${T}.landing('skip')`);
 await until(`document.querySelector('#gunship-briefing:not([hidden])')`,180000);
 assert.ok(!(await evaluate(`${T}.dog.state().active`)),'gunship introduction before dog control');
 assert.match(await evaluate(`document.querySelector('#gunship-briefing').textContent`),/watchful eye overhead/);await shot('round19-overwatch');
 await evaluate(`document.querySelector('#gunship-briefing [data-skip]').click()`);
 await until(`${T}.dog.state().active`,120000);await delay(3000);
 for(const index of [0,1]){await evaluate(`${T}.dog.goto(${index},8)`);await delay(2000);await evaluate(`${T}.dog.goto(${index},4)`);await until(`${T}.dog.state().surveyed.includes(${index})`,12000);}
 assert.equal(await evaluate(`${T}.dog.state().atGate`),false,'scanning does not immediately summon contact');
 await evaluate(`${T}.dog.goto('gate')`);await until(`${T}.dog.state().watching`,10000);assert.match(await evaluate(`document.querySelector('#td-brief').textContent`),/More movement beyond the gate/);await delay(9000);await shot('round19-gate-watch');
 await until(`${T}.seatState().seatKey==='rotor'`,150000);assert.equal(await evaluate(`${T}.dog.state().active`),false);if(onRotor)await onRotor();await shot('round19-rotor-handoff');
 console.log('  opening: early gunship, two scans, gate watch, Rotor handoff');await finish();if(openingOnly)return;
 await go('round19-fleet','index.html?sw=0&acceptance=1&cine=0&world=story&skip=defence&pets=born#td');
 await until(`${R}.ready`,120000);await evaluate(`${T}.sectorQuiet(true);${T}.sectorCull(999);document.querySelector('#controls-card [data-close]')?.click();${T}.rover.fillPearls();${T}.board.open(2)`);
 const board=(await state()).board,offer=board.offers.find(o=>o.id==='hauler:second');assert.ok(offer,'second SAI offered');assert.equal(offer.price,2400);
 await shot('round19-second-sai-offer');assert.ok(await evaluate(`${T}.board.toggle('hauler:second')`));await evaluate(`${T}.board.confirm()`);
 await until(`${R}.fleet.length===2`,10000);assert.equal(await evaluate(`${R}.fleet[1].printing`),true);
 await until(`${R}.fleet[1].ready`,120000);await shot('round19-two-sai');
 await evaluate(`${T}.board.open(2)`);assert.ok(!(await state()).board.offers.some(o=>o.kind==='hauler'),'no third aircraft offered');await evaluate(`${T}.board.skip();${T}.rover.spend(8000)`);
 const initial=await evaluate(R),target=initial.deposits[1]??initial.deposits[0];
 const pile=await evaluate(`(()=>{const r=${R},ci=${T}.rover.openNear(r.deposits[0].cell);${T}.rover.lay(ci,1200);return ${T}.rover.piles().find(p=>p.kg>=1000)?.cell;})()`);
 assert.ok(Number.isInteger(pile));await evaluate(`${T}.rover.flareAt(${pile});${T}.rover.mine(${JSON.stringify(target.id)})`);
 await until(`${R}.fleet.filter(s=>s.mode!=='idle').length===2`,10000);
 assert.deepEqual((await evaluate(`${R}.fleet`)).map(s=>s.resource).sort(),['biomass','mineral']);
 await until(`${R}.deliveredBy.biomass>100&&${R}.deliveredBy.mineral>100`,180000);
 console.log('  fleet: paid print, two independent holds, both resources delivered',await evaluate(`${R}.deliveredBy`));
 // Empty the shared carried supply outdoors with real F inputs.
 await evaluate(`${T}.placeTank(${target.cell})`);await delay(300);
 for(let i=0;i<8;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF'});await delay(180);}
 assert.equal(await evaluate(`${R}.stock`),0);assert.match(await evaluate(`document.querySelector('.flare-status').textContent`),/0\/8.*REFILL/);await shot('round19-empty-flares');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'f',code:'KeyF'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'f',code:'KeyF'});assert.equal(await evaluate(`${R}.stock`),0);
 await evaluate(`${T}.parkHull()`);await until(`${R}.stock===8`,10000);
 // A real presentation queue: hard-core knowledge alone cannot teach tank sensors.
 await evaluate(`(async()=>{const c=await import('./src/fx/contact-card.js');window.__sensorProbe=document.createElement('div');document.body.append(__sensorProbe);c.showContact(__sensorProbe,'barbed',null,{hull:false});window.__unlockSensor=()=>c.unlockTankSensors(__sensorProbe);})()`);
 await delay(6200);assert.equal(await evaluate(`!!__sensorProbe.querySelector('.sensor-card')`),false);
 await evaluate(`__unlockSensor()`);await until(`__sensorProbe.querySelector('.sensor-radar-copy')`,3000);assert.equal(await evaluate(`__unlockSensor()`),false);await shot('round19-tank-sensors');await evaluate(`__sensorProbe.querySelector('button').click();__sensorProbe.remove()`);
 // The invitation holds beyond its countdown outside, then starts at home.
 await evaluate(`${T}.placeTank(${target.cell});${T}.partyNow()`);await until(`${T}.state().party.phase==='countdown'`,45000);await delay(34000);
 assert.equal((await state()).party.phase,'countdown');await evaluate(`${T}.parkHull()`);await until(`${T}.state().party.phase==='party'`,45000);await shot('round19-party-home');
 await finish();console.log('  flare supply/refill, tank sensor unlock, party waits for tank home passed');
}

export async function round19Sensors({go,until,evaluate,delay,finish}){
 const T='window.__stalheartTest',P='window.__stalheartPilotTest';
 await go('round19-sensor-unlock','index.html?sw=0&acceptance=1&cine=0&world=story&skip=quiver#td');
 await until(`${P}?.state().ready&&${P}.state().key==='quiver'`,120000);
 await until(`${T}.state().enemyTypes.includes('barbed')||${T}.state().enemyTypes.includes('titan')`,60000);
 assert.equal(await evaluate(`!!document.querySelector('.sensor-radar-copy')`),false,'no sensor lesson in the Quiver');
 assert.equal(await evaluate(`${T}.state().hull.state`),'held');
 await until(`(()=>{${T}.sectorCull(999);return ${T}.seatState().gunshipSeat;})()`,60000);
 await evaluate(`${T}.gunshipGun('heavy')`);await until(`${T}.state().gunship.nuke?.ready`,40000);
 await evaluate(`${T}.gunshipHold(true)`);await delay(250);await evaluate(`${T}.gunshipHold(true)`);
 await until(`['early','out'].includes(${T}.state().hull.state)`,120000);
 await until(`document.querySelector('.sensor-radar-copy')`,40000);
 assert.equal(await evaluate(`${T}.state().hull.state`),'out');await finish();console.log('  real Quiver -> gunship nuke -> tank unlock -> sensor lesson passed');
}
