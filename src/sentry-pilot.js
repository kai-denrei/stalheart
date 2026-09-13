// Game-owned input/optic adapter. Combat, map and wave ownership stay in TD.
import * as THREE from '../vendor/three.module.js';
import { SENTRIES } from './content/sentries.js';
export function createSentryPilot(root, host) {
  const state = { tower:null, held:false, yaw:0, pitch:-.2, zoom:1, target:null, shots:0, view:'pov' };   // view: pov (over the barrels) | third (behind the turret)
  const panel=document.createElement('section'); panel.id='sentry-pilot';
  panel.innerHTML=`<header>SENTRY CONTROL · SECTOR 01 <small>LIVE TD MAP · PRACTICE</small></header><div class="pilot-weapons">${SENTRIES.map(s=>`<button data-weapon="${s.key}">${s.label}</button>`).join('')}</div><p><button data-post="-1">Q · Previous post</button> <button data-post="1">E · Next post</button> <button data-map>Map / optic · M</button> <button data-restart>Restart</button> <a href="labs.html#sniper">Range bench</a></p><output></output><footer>Right-drag to aim · hold Space / left mouse to fire · wheel to zoom · 1–8 weapon · P pause</footer><div class="pilot-cross">＋</div>`;
  root.append(panel);root.classList.add('sentry-pilot-mode');
  // the story hands over one printed sentry: no weapon swaps, no posts, no bench
  if(host.story){panel.querySelector('header').innerHTML='SENTRY CONTROL <small>THE MOUNTS ON THE WALL</small>';panel.querySelector('.pilot-weapons').style.display='none';panel.querySelectorAll('[data-post],[data-restart],a[href]').forEach(b=>{b.style.display='none';});panel.querySelector('footer').textContent=host.mobile?'Drag to aim · ‹ › turn · ◉ fire · MAP':'Click to lock the mouse, move it to aim · Space fires · wheel zoom · 1 map · 2 PoV · 3 third · P pause';}
  const up=new THREE.Vector3(),forward=new THREE.Vector3(),direction=new THREE.Vector3(),eye=new THREE.Vector3(),camEye=new THREE.Vector3(),v=new THREE.Vector3();
  let dragging=false,map=false,lastX=0,lastY=0,lastT=performance.now();
  const locked=()=>document.pointerLockElement===root;
  state.turn=0;   // -1..1 from the tank pad's side zones on touch
  const abort=new AbortController(),listen=(el,key,fn,options={})=>el.addEventListener(key,fn,{...options,signal:abort.signal});
  function select(key){dismountGunship();state.held=false;host.select(key);panel.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('on',b.dataset.weapon===key));}
  panel.querySelectorAll('[data-weapon]').forEach(b=>listen(b,'click',()=>select(b.dataset.weapon)));
  panel.querySelectorAll('[data-post]').forEach(b=>listen(b,'click',()=>host.post(Number(b.dataset.post))));
  function toggleMap(){map=!map;state.held=false;root.classList.toggle('pilot-map',map);host.map(map);host.zoom(map?1:state.zoom);}
  listen(panel.querySelector('[data-map]'),'click',toggleMap);
  listen(panel.querySelector('[data-restart]'),'click',()=>location.reload());
  const editable=e=>/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable;
  listen(window,'keydown',e=>{
    if(editable(e))return;
    e.stopImmediatePropagation();
    if(e.code==='Space'){e.preventDefault();state.held=!map;}
    if(e.repeat)return;
    if(gunship){if(/^[123]$/.test(e.key))selectGun(G.order[Number(e.key)-1]);if(e.code==='KeyV')setView(state.view==='third'?'pov':'third');if(e.code==='KeyM')toggleMap();if(e.code==='KeyP')host.pause();return;}
    const s=SENTRIES.find(s=>String(s.number)===e.key);if(s&&!host.story)select(s.key);
    // the tank's keys: 1 map, 2 first person, 3 third person
    if(host.story){if(e.key==='1'&&!map)toggleMap();if(e.key==='2')setView('pov');if(e.key==='3')setView('third');}
    if(e.code==='KeyQ')host.post(-1);if(e.code==='KeyE')host.post(1);
    if(e.code==='KeyM')toggleMap();if(e.code==='KeyP')host.pause();
  },{capture:true});
  listen(window,'keyup',e=>{if(editable(e))return;e.stopImmediatePropagation();if(e.code==='Space'){e.preventDefault();state.held=false;}},{capture:true});
  listen(root,'pointerdown',e=>{
    if(map||e.target.closest('button,a,input,select,.lil-gui,.tzone,.tfire'))return;
    e.stopImmediatePropagation();e.preventDefault();dragging=true;lastX=e.clientX;lastY=e.clientY;
    // moving and shooting are separate: a mouse click locks the pointer so the mouse aims; the trigger is Space (or the pad's fire button)
    if(e.pointerType==='mouse'&&e.button===0&&!locked())root.requestPointerLock?.();
    e.target.setPointerCapture?.(e.pointerId);host.wake();
  },{capture:true});
  listen(window,'pointermove',e=>{if(!dragging&&!locked())return;if(map)return;e.stopImmediatePropagation();const dx=locked()?e.movementX:e.clientX-lastX,dy=locked()?e.movementY:e.clientY-lastY;state.yaw-=dx*.004/state.zoom;state.pitch=Math.max(gunship?G.platform.pitchMin:-1.25,Math.min(gunship?G.platform.pitchMax:.9,state.pitch-dy*.004/state.zoom));lastX=e.clientX;lastY=e.clientY;},{capture:true});
  listen(window,'pointerup',()=>{dragging=false;},{capture:true});
  // the tank pad on touch: the fire button holds the trigger, the side zones turn the mount; their clicks never reach the tank
  for(const [sel,down,up] of [['#td-pad-fire',()=>{state.held=!map;},()=>{state.held=false;}],['#td-pad-left',()=>{state.turn=-1;},()=>{state.turn=0;}],['#td-pad-right',()=>{state.turn=1;},()=>{state.turn=0;}]]){
    const el=root.querySelector(sel);if(!el)continue;
    listen(el,'pointerdown',e=>{e.stopImmediatePropagation();e.preventDefault();down();host.wake();},{capture:true});
    for(const evt of ['pointerup','pointerleave','pointercancel'])listen(el,evt,e=>{e.stopImmediatePropagation();up();},{capture:true});
    listen(el,'click',e=>{e.stopImmediatePropagation();e.preventDefault();},{capture:true});
  }
  listen(root,'contextmenu',e=>{if(!map)e.preventDefault();});
  listen(window,'blur',()=>{dragging=false;state.held=false;});
  listen(root,'wheel',e=>{if(map||e.target.closest('#sentry-pilot'))return;e.preventDefault();e.stopImmediatePropagation();state.zoom=Math.max(1,Math.min(5,state.zoom+(e.deltaY<0?.25:-.25)));host.zoom(state.zoom);},{capture:true,passive:false});
  function pose(tw,goal){
    if(!tw)return false;
    const now=performance.now(),dt=Math.min(.05,(now-lastT)/1000);lastT=now;
    if(state.turn)state.yaw-=state.turn*1.6*dt;
    up.copy(tw.obj.position).normalize();
    forward.set(Math.sin(state.yaw),0,Math.cos(state.yaw)).applyQuaternion(tw.obj.quaternion).normalize();
    direction.copy(forward).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up,Math.sin(state.pitch)).normalize();
    eye.copy(tw.obj.position).addScaledVector(up,host.cellSide()*.65);
    // The optic stays on the mount for aiming; the camera sits back from it
    // so the barrels are in frame: a little in PoV, the whole turret in third.
    const c=host.cellSide(),back=state.view==='third'?(gunship?6*c:2.4*c):(gunship?0:.34*c),lift=state.view==='third'?(gunship?2.2*c:1.35*c):(gunship?(GUNSHIP_EYE-.65)*c:.12*c);   // the gunner's eye is under the belly, with the guns, not inside the hull
    if(gunship&&state.view==='third')camEye.copy(eye).addScaledVector(direction,-6*c).addScaledVector(up,.8*c);else camEye.copy(eye).addScaledVector(forward,-back).addScaledVector(up,lift);   // the gunship's third view backs off along the aim so the KORP sits in frame over its target
    goal.pos.copy(camEye);host.cameraPose(camEye,direction,up,goal);
    return !map;
  }
  function setView(v){if(v==='map'){if(!map)toggleMap();return;}state.view=v==='third'?'third':'pov';if(map)toggleMap();}
  // A GUIDED MOUNT USES THE LOCK BOX (host.cone, the tangent of its half-angle): whatever is inside it is the target, and it STAYS the
  // target while it stays inside. Swapping to whichever body is momentarily nearest was the frustration: every swap reset the timer, so
  // a lock looked random. A gun still needs the reticle on the body itself.
  const inBox=(e,cone,cellSide,sight=true)=>{
    v.fromArray(e.pos).addScaledVector(v.clone().normalize(),cellSide*.3).sub(eye);
    const along=v.dot(direction),off=v.clone().addScaledVector(direction,-along).length();
    return along>0&&(cone?off<along*cone:off<cellSide*Math.max(.34,(e.size??e.spec.size)*.95))&&(!sight||host.visible(e))?along:-1;   // a gun's box covers the whole dot cloud, top to bottom (owner, 2026-09-13: basic enemies should drop to the Rotor wherever it hits them)
  };
  // A ROCK EDGE IS NOT A LOSS (operator, 2026-09-13: the Quiver climbed to ~62% and reset, every time). A hard core walking the lane
  // grazes the rock between it and the optic: measured, it stayed dead centre in the box while its sightline flickered off for ~170 ms
  // every ~0.45 s, and each flicker zeroed a 0.9 s lock. A held body that is still inside the box keeps it through that long a blink.
  const SIGHT_GRACE=.5;   // seconds
  function target(enemies,range,cellSide){
    let best=null,near=Infinity;const cone=host.cone?.()||0,now=performance.now()/1000;
    const held=cone&&state.target?.alive?enemies.find(e=>e===state.target):null;   // the one being locked keeps the box until it leaves it
    if(held&&inBox(held,cone,cellSide)>0){best=held;state.hidden=null;}
    else if(held&&inBox(held,cone,cellSide,false)>0&&now-(state.hidden??=now)<SIGHT_GRACE)best=held;   // in the box, behind an edge: held a moment
    else{state.hidden=null;for(const e of enemies){if(!e.alive)continue;const along=inBox(e,cone,cellSide);if(along>0&&along<near){near=along;best=e;}}}
    state.target=best;
    return best||{pilotAim:true,pos:host.aimPoint(eye,direction,range)};
  }
  function attach(tw,toward){
    state.tower=tw;state.held=false;state.target=null;state.hidden=null;
    v.fromArray(toward);tw.obj.worldToLocal(v);state.yaw=Math.atan2(v.x,v.z);
    up.copy(tw.obj.position).normalize();eye.copy(tw.obj.position).addScaledVector(up,host.cellSide()*.65);
    v.fromArray(toward).sub(eye);state.pitch=Math.atan2(v.dot(up),v.clone().addScaledVector(up,-v.dot(up)).length());
  }
  // THE GUNSHIP (docs/superpowers/specs/2026-09-13-heavy-gunship-design.md). A virtual mount riding the pass over the base:
  // the player takes the optic and the guns, never the aircraft. Position is the schedule's, not an input. Every gun fires
  // wherever it is pointed; the danger report is a readout. The heavy IS the orbital strike: choosing it arms the safety,
  // aiming paints the cell, the trigger launches through strike.js's own ritual.
  const G=host.gunship,ship={key:'gunship',obj:G?G.optic.platformObject():null,ci:-1},aim=new THREE.Vector3(),t1=new THREE.Vector3(),t2=new THREE.Vector3();
  let gunship=false,impact=null,report=null,rounds=0;const GUNSHIP_EYE=-.35;   // cells below the platform origin: the belly, where the muzzles are
  const guns=document.createElement('div');guns.className='pilot-guns';guns.style.display='none';
  guns.innerHTML=G?G.order.map((k,i)=>`<button data-gun="${k}">${i+1} · ${G.guns[k].label}</button>`).join(''):'';panel.querySelector('header').after(guns);
  function selectGun(key){if(!G||!G.select(key))return;state.held=false;guns.querySelectorAll('[data-gun]').forEach(b=>b.classList.toggle('on',b.dataset.gun===key));if(G.guns[key].strike){if(!G.strike.armed)G.arm();}else if(G.strike.armed)G.arm();}
  guns.querySelectorAll('[data-gun]').forEach(b=>listen(b,'click',()=>selectGun(b.dataset.gun)));
  // the platform's place is the optic's (host.gunship.optic.ride, driven by the game each tick); the seat only reads it
  const trackAxes=()=>{t1.set(0,0,1).applyQuaternion(ship.obj.quaternion);t2.set(1,0,0).applyQuaternion(ship.obj.quaternion);};
  function mountGunship(){
    if(!G||G.mount()!=='mounted')return 'refused';
    gunship=true;ship.ci=G.heart();state.tower=ship;state.held=false;state.target=null;state.hidden=null;state.view='pov';state.zoom=G.platform.zoom??1;host.zoom(state.zoom);
    attach(ship,G.centers[G.lane()]);state.pitch=Math.max(G.platform.pitchMin,Math.min(G.platform.pitchMax,state.pitch));   // the seat opens on the lane end, where they come from
    guns.style.display='';panel.querySelector('header').innerHTML='KORP / GS01 <small>HEAVY GUNSHIP · ON STATION</small>';panel.querySelector('footer').textContent='1 rotary · 2 bofors · 3 heavy (the strike) · Space fires · V PoV / third · M map · P pause';
    G.optic.mount();host.views?.('gunship');selectGun(G.state.gun);if(map)toggleMap();
    return 'mounted';
  }
  function dismountGunship(){
    if(!gunship)return;gunship=false;G.dismount();G.optic.dismount();G.optic.rings(null);impact=null;report=null;guns.style.display='none';
    if(G.strike.armed)G.arm();   // the safety re-engages when the gunner leaves
  }
  // the sim step: the platform's place, the aim, the readout, the rounds
  function gunshipTick(dt){
    if(!G)return;
    if(!gunship)return;
    if(!G.onStation()){dismountGunship();host.views?.('tank');host.leave?.();return;}
    trackAxes();up.copy(ship.obj.position).normalize();
    forward.set(Math.sin(state.yaw),0,Math.cos(state.yaw)).applyQuaternion(ship.obj.quaternion).normalize();
    direction.copy(forward).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up,Math.sin(state.pitch)).normalize();
    eye.copy(ship.obj.position).addScaledVector(up,host.cellSide()*GUNSHIP_EYE);   // the same eye pose() puts the camera on
    impact=G.aim(eye.toArray(),direction.toArray());
    const ci=impact?G.cell(impact):-1,gun=G.guns[G.state.gun],c=host.cellSide();
    report=impact?Object.fromEntries(G.order.map(k=>[k,G.danger(impact,G.guns[k].dangerCells*c)])):null;
    G.optic.rings(impact,ci>=0?G.normals[ci]:[0,1,0],G.state.gun,report);
    let fired=null;
    if(gun.strike){
      if(ci>=0&&G.strike.armed&&!map)G.paint(ci);
      if(state.held&&!map){state.held=false;if(G.launch())fired='round';}
    }else{
      const n=G.step(dt,state.held&&!map);
      if(n>0&&impact){
        fired='round';G.sfx(gun.sound,impact);
        for(let i=0;i<n;i++){   // a golden-angle scatter inside half the blast, so a burst walks rather than drills
          const a=(rounds++)*2.399963,r=gun.blastCells*c*.5*Math.sqrt((rounds%7)/7);
          aim.fromArray(impact).addScaledVector(t1,Math.cos(a)*r).addScaledVector(t2,Math.sin(a)*r);
          for(const e of G.enemies()){const d=aim.distanceTo(v.fromArray(e.pos));if(d<gun.blastCells*c)G.damage(e,G.splash(d,gun.blastCells*c,gun.damage));}
        }
        if(gun.key==='bofors'||rounds%6===0)G.puff(ci,gun.ringHex,gun.key==='bofors'?.5:.18,gun.blastCells*c);
      }else if(state.held&&!map)fired='held';
    }
    G.optic.pose({pitch:state.pitch,gun:G.state.gun,firing:fired,dt});
    const r=report?.[G.state.gun],left=Math.ceil(G.left());
    panel.querySelector('output').textContent=`${gun.label} · ${gun.cue} · ON STATION ${left} S`+(gun.strike?` · ${G.strike.ready>0?(G.strike.armed?'ARMED':'READY'):G.strike.cooldown>0?'RE-ORBIT':'NO SHELL'}`:'')+(r?` · IN BLAST: ${r.walls} WALL${r.walls===1?'':'S'} · ${r.towers} SENTR${r.towers===1?'Y':'IES'}${r.tank?' · TANK':''}${r.isao?' · ISAO':''}`:'');
  }
  const gunshipOptic=()=>gunship&&impact?{from:aim.fromArray(impact).addScaledVector(t1,host.cellSide()*2.2).toArray(),pos:impact,label:'GROUND TRUTH · IMPACT'}:null;
  return {state,pose,target,attach,select,setView,isMap:()=>map,mountGunship,dismountGunship,gunshipTick,gunshipOptic,get gunship(){return gunship;},
    aimAt:pos=>{const {held,target}=state;attach(state.tower,pos);state.held=held;state.target=target;},
    update(text){panel.querySelector('output').textContent=text;},
    dispose(){dismountGunship();abort.abort();if(locked())document.exitPointerLock?.();panel.remove();root.classList.remove('sentry-pilot-mode');}
  };
}
