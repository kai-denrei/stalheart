import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

export async function round16({go,until,evaluate,send,delay,finish}) {
  const T = 'window.__stalheartTest';
  await go('round16-followups', 'index.html?sw=0&acceptance=1&cine=0&skip=defence&sector=2&rovercard=0#td');
  await until(`${T}?.rover.state().mining?.ready`, 120000);
  await evaluate(`document.querySelector('#controls-card [data-close]')?.click()`);
  await until(`!${T}.state().shot && !${T}.state().paused && !${T}.state().deploying && !${T}.state().rollingOut && ${T}.state().story.clock>10`,60000);
  const mining = await evaluate(`${T}.rover.state().mining`);
  await evaluate(`${T}.placeTank(${mining.deposits[0].cell})`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyF',key:'f',windowsVirtualKeyCode:70});
  await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyF',key:'f',windowsVirtualKeyCode:70});
  await until(`${T}.rover.state().mining.flares.length===1`);
  const dispatched = await evaluate(`${T}.rover.state().mining`);
  assert.equal(dispatched.flareColour, 0xb58aff);
  assert.equal(dispatched.flares[0].until - dispatched.flares[0].at, 90);
  assert.equal(dispatched.order ?? dispatched.queued, mining.deposits[0].id);
  await until(`${T}.state().breaches.some(b=>b.ready)`,60000);
  const cell = await evaluate(`${T}.state().sector.breaches.find(b=>b.live).cell`);
  assert.ok(Number.isInteger(cell), 'sinkhole exposes its cell');
  assert.ok(await evaluate(`${T}.rover.lay(${cell},123)`));
  const piles = await evaluate(`${T}.rover.piles()`);
  assert.ok(piles.length > 0 && piles.every(p=>p.safe), 'all piles lie outside sinkholes with footprint clearance');
  assert.ok(piles.every(p=>p.cell!==cell), 'a kill at the sinkhole center moves to its accessible rim');
  await finish();
  // Exercise the actual contact queue; soft bodies must not teach this sensor.
  await evaluate(`(async()=>{
    const {showContact}=await import('./src/fx/contact-card.js');
    const {ENEMY_SPEC}=await import('./src/enemyspec.js');
    const root=document.createElement('div');root.id='sensor-acceptance';document.querySelector('#tab-td').append(root);window.__sensorTest={root,showContact};
    const soft=Object.keys(ENEMY_SPEC).find(t=>ENEMY_SPEC[t].rammable),hard=Object.keys(ENEMY_SPEC).find(t=>!ENEMY_SPEC[t].rammable);
    window.__sensorTest.hard=hard;showContact(root,soft,null,{hull:false});
  })()`);
  assert.equal(await evaluate(`!!document.querySelector('#sensor-acceptance .sensor-card')`),false);
  await delay(6000);
  await evaluate(`__sensorTest.showContact(__sensorTest.root,__sensorTest.hard,null,{hull:false})`);
  await until(`!!document.querySelector('#sensor-acceptance .sensor-card')`,10000);
  const text = await evaluate(`document.querySelector('#sensor-acceptance .sensor-card').textContent`);
  assert.match(text,/Once printed/); assert.match(text,/BLUE: 4 cells/); assert.match(text,/RED: 2 cells or closer/);
  await evaluate(`document.querySelector('#sensor-acceptance .sensor-card').style.cssText += ';left:auto;right:16px'`);
  await delay(500);
  await finish();
  const shot = await send('Page.captureScreenshot',{format:'png'});
  writeFileSync('artifacts/browser/round16-sensor.png',Buffer.from(shot.data,'base64'));
  const at = await evaluate(`(()=>{const r=document.querySelector('#sensor-acceptance .sensor-card button').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...at});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...at});
  await until(`!document.querySelector('#sensor-acceptance .sensor-card')`);
  await evaluate(`__sensorTest.showContact(__sensorTest.root,__sensorTest.hard)`);
  await delay(6000);
  assert.equal(await evaluate(`!!document.querySelector('#sensor-acceptance .sensor-card')`),false,'sensor explanation appears once');
  console.log('  violet dispatch flare, accessible biomass and sensor explanation passed');
  await finish();
}
