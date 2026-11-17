// Uses the browser runner's owned Chrome/server and real key events.
import assert from 'node:assert/strict';
export async function round15({go,until,evaluate,send,delay,finish}) {
  const T='window.__stalheartTest', P='window.__stalheartPilotTest';
  await go('round15-quiver','index.html?sw=0&acceptance=1&cine=0&skip=quiver#td');
  await until(`${P}?.state().ready && ${P}.state().key==='quiver'`,120000);
  await evaluate(`document.querySelector('#controls-card [data-close]')?.click()`);
  await until(`!${T}.state().shot && ${T}.state().story.clock>2`,30000);
  await evaluate(`window.__r15aim=setInterval(()=>${P}.aimEnemy(),80)`);
  await until(`${P}.guidance().candidate!==null`,60000).catch(async(e)=>{console.log(await evaluate(`${P}.state()`),await evaluate(`${P}.reach()`));throw e;});
  await delay(2000);
  assert.equal((await evaluate(`${P}.lock()`)).locked,false,'mouse aim alone cannot lock');
  const g=await evaluate(`${P}.guidance()`);assert.ok(g.candidate,'mouse sight sees a target');
  for(const axis of ['x','y']) for(let attempt=0;attempt<30;attempt++) {
    const value=(await evaluate(`${P}.guidance()`))[axis]; if(Math.abs(value)<.045)break;
    const [code,key,vk]=axis==='x' ? (value>0?['KeyA','a',65]:['KeyD','d',68]) : (value>0?['KeyW','w',87]:['KeyS','s',83]);
    await send('Input.dispatchKeyEvent',{type:'keyDown',code,key,windowsVirtualKeyCode:vk});await delay(Math.min(160,Math.abs(value)/.65*1000));
    await send('Input.dispatchKeyEvent',{type:'keyUp',code,key,windowsVirtualKeyCode:vk});
  }
  console.log('  guidance',await evaluate(`${P}.guidance()`));
  await until(`${P}.lock().locked`,20000);
  await finish();
  await evaluate(`clearInterval(window.__r15aim);${P}.hold(true)`);
  await until(`${P}.state().shots>0`,10000);
  await evaluate(`${P}.hold(false)`);
  await go('round15-mining','index.html?sw=0&acceptance=1&cine=0&skip=defence&sector=2&rovercard=0#td');
  await until(`${T}?.rover.state().mining?.ready || ${T}?.rover.state().mining?.error`,120000);
  const m=await evaluate(`${T}.rover.state().mining`);
  assert.equal(m.error,null);assert.equal(m.deposits.length,5,'reachable deposits around the base');
  await evaluate(`document.querySelector('#controls-card [data-close]')?.click()`);
  await until(`!${T}.state().shot && !${T}.state().paused && !${T}.state().deploying && !${T}.state().rollingOut && ${T}.state().story.clock>10`,60000);
  await evaluate(`${T}.placeTank(${m.deposits[0].cell})`);
  await delay(100);
  console.log('  mining order',m.deposits[0],await evaluate(`${T}.state().playerCell`));
  await send('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyF',key:'f',windowsVirtualKeyCode:70});
  await send('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyF',key:'f',windowsVirtualKeyCode:70});
  await until(`${T}.rover.state().mining.mode==='out'`,15000);
  await until(`${T}.rover.state().mining.cargo>0`,60000);
  const carrying=await evaluate(`${T}.rover.state().mining`);assert.equal(carrying.delivered,0,'cargo is not banked at the mine');
  await finish();
  await until(`${T}.rover.state().mining.delivered>0`,60000);
  console.log('  mining delivered',await evaluate(`${T}.rover.state().mining`));
  await finish();
}

export async function round15Traffic({go,until,evaluate,delay,finish}) {
  const T='window.__stalheartTest';
  await go('round15-traffic','index.html?sw=0&acceptance=1&cine=0&skip=defence&sector=2&rovercard=0#td');
  await until(`${T}?.rover.state().mining?.ready && ${T}.rover.state().scene.ready`,120000);
  await until(`!${T}.state().shot && !${T}.state().deploying && !${T}.state().rollingOut && ${T}.state().story.clock>10`,60000);
  await evaluate(`${T}.sectorQuiet(true)`);
  const {STORY_EXPEDITIONS}=await import('../src/content/story-defaults.js');
  for(const site of STORY_EXPEDITIONS.sites)await evaluate(`${T}.killGuards(${JSON.stringify(site.id)})`);
  await evaluate(`${T}.sectorCull(999,'tank')`);await delay(3000);await evaluate(`${T}.sectorCull(999,'tank')`);
  const m=await evaluate(`${T}.rover.state().mining`),cell=process.env.STALHEART_DOCK_PROBE ? await evaluate(`${T}.rover.state().home`) : m.deposits[1].cell;
  await evaluate(`${T}.placeTank(${m.deposits[0].cell});${T}.rover.lay(${cell},1200);${T}.rover.flareAt(${cell})`);
  await until(`${T}.rover.state().scene.distance>5`,30000).catch(async e=>{console.log(JSON.stringify(await evaluate(`${T}.rover.state()`)),await evaluate(`${T}.rover.road()`));throw e;});
  console.log('  rover cleared the parked miner');
  await until(`${T}.rover.state().delivered>0`,120000).catch(async e=>{console.log(await evaluate(`${T}.rover.state()`));throw e;});
  console.log('  rover delivery',await evaluate(`${T}.rover.state().delivered`));await finish();
}
