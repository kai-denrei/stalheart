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
  function select(key){state.held=false;host.select(key);panel.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('on',b.dataset.weapon===key));}
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
  listen(window,'pointermove',e=>{if(!dragging&&!locked())return;if(map)return;e.stopImmediatePropagation();const dx=locked()?e.movementX:e.clientX-lastX,dy=locked()?e.movementY:e.clientY-lastY;state.yaw-=dx*.004/state.zoom;state.pitch=Math.max(-1.25,Math.min(.9,state.pitch-dy*.004/state.zoom));lastX=e.clientX;lastY=e.clientY;},{capture:true});
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
    const c=host.cellSide(),back=state.view==='third'?2.4*c:.34*c,lift=state.view==='third'?1.35*c:.12*c;
    camEye.copy(eye).addScaledVector(forward,-back).addScaledVector(up,lift);
    goal.pos.copy(camEye);host.cameraPose(camEye,direction,up,goal);
    return !map;
  }
  function setView(v){if(v==='map'){if(!map)toggleMap();return;}state.view=v==='third'?'third':'pov';if(map)toggleMap();}
  // a guided mount acquires anything in range inside a cone around the optic (host.cone, the tangent of its half-angle): the override steers the
  // optic, the seeker does the finding. A gun still needs the reticle on the body.
  function target(enemies,range,cellSide){
    let best=null,near=Infinity;const cone=host.cone?.()||0;
    for(const e of enemies){if(!e.alive)continue;
      v.fromArray(e.pos).addScaledVector(v.clone().normalize(),cellSide*.3).sub(eye);
      const along=v.dot(direction),off=v.clone().addScaledVector(direction,-along).length();
      if(along>0&&along<near&&(cone?off<along*cone:off<cellSide*Math.max(.22,(e.size??e.spec.size)*.55))&&host.visible(e)){near=along;best=e;}
    }
    state.target=best;
    return best||{pilotAim:true,pos:host.aimPoint(eye,direction,range)};
  }
  function attach(tw,toward){
    state.tower=tw;state.held=false;state.target=null;
    v.fromArray(toward);tw.obj.worldToLocal(v);state.yaw=Math.atan2(v.x,v.z);
    up.copy(tw.obj.position).normalize();eye.copy(tw.obj.position).addScaledVector(up,host.cellSide()*.65);
    v.fromArray(toward).sub(eye);state.pitch=Math.atan2(v.dot(up),v.clone().addScaledVector(up,-v.dot(up)).length());
  }
  return {state,pose,target,attach,select,setView,isMap:()=>map,
    aimAt:pos=>{const {held,target}=state;attach(state.tower,pos);state.held=held;state.target=target;},
    update(text){panel.querySelector('output').textContent=text;},
    dispose(){abort.abort();if(locked())document.exitPointerLock?.();panel.remove();root.classList.remove('sentry-pilot-mode');}
  };
}
