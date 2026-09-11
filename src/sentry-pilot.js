// Game-owned input/optic adapter. Combat, map and wave ownership stay in TD.
import * as THREE from '../vendor/three.module.js';
import { SENTRIES } from './content/sentries.js';
export function createSentryPilot(root, host) {
  const state = { tower:null, held:false, yaw:0, pitch:-.2, zoom:1, target:null, shots:0 };
  const panel=document.createElement('section'); panel.id='sentry-pilot';
  panel.innerHTML=`<header>SENTRY CONTROL · SECTOR 01 <small>LIVE TD MAP · PRACTICE</small></header><div class="pilot-weapons">${SENTRIES.map(s=>`<button data-weapon="${s.key}">${s.label}</button>`).join('')}</div><p><button data-post="-1">Q · Previous post</button> <button data-post="1">E · Next post</button> <button data-map>Map / optic · M</button> <button data-restart>Restart</button> <a href="labs.html#sniper">Range bench</a></p><output></output><footer>Right-drag to aim · hold Space / left mouse to fire · wheel to zoom · 1–8 weapon · P pause</footer><div class="pilot-cross">＋</div>`;
  root.append(panel);root.classList.add('sentry-pilot-mode');
  // the story hands over one printed sentry: no weapon swaps, no posts, no bench
  if(host.story){panel.querySelector('header').innerHTML='SENTRY CONTROL <small>THE ROTOR ON THE WALL</small>';panel.querySelector('.pilot-weapons').style.display='none';panel.querySelectorAll('[data-post],[data-restart],a[href]').forEach(b=>{b.style.display='none';});panel.querySelector('footer').textContent='Right-drag to aim · hold Space / left mouse to fire · wheel to zoom · M map · P pause';}
  const up=new THREE.Vector3(),forward=new THREE.Vector3(),direction=new THREE.Vector3(),eye=new THREE.Vector3(),v=new THREE.Vector3();
  let dragging=false,map=false,lastX=0,lastY=0;
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
    if(e.code==='KeyQ')host.post(-1);if(e.code==='KeyE')host.post(1);
    if(e.code==='KeyM')toggleMap();if(e.code==='KeyP')host.pause();
  },{capture:true});
  listen(window,'keyup',e=>{if(editable(e))return;e.stopImmediatePropagation();if(e.code==='Space'){e.preventDefault();state.held=false;}},{capture:true});
  listen(root,'pointerdown',e=>{
    if(map||e.target.closest('button,a,input,select,.lil-gui'))return;
    e.stopImmediatePropagation();e.preventDefault();dragging=true;state.held=e.button===0;lastX=e.clientX;lastY=e.clientY;
    e.target.setPointerCapture?.(e.pointerId);host.wake();
  },{capture:true});
  listen(window,'pointermove',e=>{if(!dragging)return;e.stopImmediatePropagation();state.yaw-=(e.clientX-lastX)*.004/state.zoom;state.pitch=Math.max(-1.25,Math.min(.9,state.pitch-(e.clientY-lastY)*.004/state.zoom));lastX=e.clientX;lastY=e.clientY;},{capture:true});
  listen(window,'pointerup',()=>{dragging=false;state.held=false;},{capture:true});
  listen(root,'contextmenu',e=>{if(!map)e.preventDefault();});
  listen(window,'blur',()=>{dragging=false;state.held=false;});
  listen(root,'wheel',e=>{if(map||e.target.closest('#sentry-pilot'))return;e.preventDefault();e.stopImmediatePropagation();state.zoom=Math.max(1,Math.min(5,state.zoom+(e.deltaY<0?.25:-.25)));host.zoom(state.zoom);},{capture:true,passive:false});
  function pose(tw,goal){
    if(!tw)return false;
    up.copy(tw.obj.position).normalize();
    forward.set(Math.sin(state.yaw),0,Math.cos(state.yaw)).applyQuaternion(tw.obj.quaternion).normalize();
    direction.copy(forward).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up,Math.sin(state.pitch)).normalize();
    eye.copy(tw.obj.position).addScaledVector(up,host.cellSide()*.65);
    // Raised optic on the actual mount; no remote flat-range camera.
    goal.pos.copy(eye);host.cameraPose(eye,direction,up,goal);
    return !map;
  }
  function target(enemies,range,cellSide){
    let best=null,near=Infinity;
    for(const e of enemies){if(!e.alive)continue;
      v.fromArray(e.pos).addScaledVector(v.clone().normalize(),cellSide*.3).sub(eye);
      const along=v.dot(direction),off=v.clone().addScaledVector(direction,-along).length();
      if(along>0&&along<near&&off<cellSide*Math.max(.22,(e.size??e.spec.size)*.55)&&host.visible(e)){near=along;best=e;}
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
  return {state,pose,target,attach,select,isMap:()=>map,
    aimAt:pos=>{const {held,target}=state;attach(state.tower,pos);state.held=held;state.target=target;},
    update(text){panel.querySelector('output').textContent=text;},
    dispose(){abort.abort();panel.remove();root.classList.remove('sentry-pilot-mode');}
  };
}
