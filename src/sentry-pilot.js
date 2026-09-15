// Game-owned input/optic adapter. Combat, map and wave ownership stay in TD.
import * as THREE from '../vendor/three.module.js';
import { createGunshipHud, planetCoords } from './fx/gunship-hud.js';
import { headingTurn } from './domain/gunship-track.js';
import { framingWeight, frameRound, ROUND_FRAME } from './core/round-framing.js';
export function createSentryPilot(root, host) {
  const state = { tower:null, held:false, yaw:0, pitch:-.2, zoom:1, target:null, shots:0, view:'pov' };   // view: pov (over the barrels) | third (behind the turret)
  const panel=document.createElement('section'); panel.id='sentry-pilot';
  panel.innerHTML=`<header>SENTRY CONTROL <small>THE MOUNTS ON THE WALL</small></header><p><button data-map>Map / optic · M</button></p><output></output><footer>${host.mobile?'Drag to aim · ‹ › turn · ◉ fire · MAP':'Click to lock the mouse, move it to aim · Space fires · wheel zoom · 1 map · 2 PoV · 3 third · P pause'}</footer><div class="pilot-cross">＋</div>`;
  root.append(panel);root.classList.add('sentry-pilot-mode');
  const up=new THREE.Vector3(),forward=new THREE.Vector3(),direction=new THREE.Vector3(),eye=new THREE.Vector3(),camEye=new THREE.Vector3(),v=new THREE.Vector3();
  let dragging=false,map=false,lastX=0,lastY=0,lastT=performance.now();
  const locked=()=>document.pointerLockElement===root;
  state.turn=0;   // -1..1 from the tank pad's side zones on touch
  const abort=new AbortController(),listen=(el,key,fn,options={})=>el.addEventListener(key,fn,{...options,signal:abort.signal});
  function select(key){dismountGunship();state.held=false;host.select(key);panel.querySelectorAll('[data-weapon]').forEach(b=>b.classList.toggle('on',b.dataset.weapon===key));}
  function toggleMap(){map=!map;state.held=false;root.classList.toggle('pilot-map',map);host.map(map);host.zoom(map?1:state.zoom);}
  listen(panel.querySelector('[data-map]'),'click',toggleMap);
  const editable=e=>/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.target.isContentEditable;
  listen(window,'keydown',e=>{
    if(editable(e))return;
    e.stopImmediatePropagation();
    if(e.code==='Space'){e.preventDefault();state.held=gunship||!map;}
    if(e.repeat)return;
    if(gunship){if(/^[123]$/.test(e.key))selectGun(G.order[Number(e.key)-1]);if(e.code==='KeyV')setView(map?'pov':state.view==='third'?'pov':'third');if(e.code==='KeyM')setMode(mode+1);if(e.code==='KeyT'){if(map)setView('pov');else{setView('map');frameApproach(true);}}if(e.code==='KeyP')host.pause();return;}   // the gunner's views: the map (the orbital strike's own), or a look at the ship
    // the tank's keys: 1 map, 2 first person, 3 third person
    if(e.key==='1'&&!map)toggleMap();if(e.key==='2')setView('pov');if(e.key==='3')setView('third');
    if(e.code==='KeyM')toggleMap();if(e.code==='KeyP')host.pause();
  },{capture:true});
  listen(window,'keyup',e=>{if(editable(e))return;e.stopImmediatePropagation();if(e.code==='Space'){e.preventDefault();state.held=false;}},{capture:true});
  listen(root,'pointerdown',e=>{
    if(e.target.closest('button,a,input,select,.lil-gui,.tzone,.tfire,#shell-bar,#shell-nav,#gunship-briefing'))return;
    if(gunship&&map){e.stopImmediatePropagation();e.preventDefault();px=e.clientX;py=e.clientY;state.held=true;host.wake();return;}   // the shelved top view: the pointer is the aim, the button the trigger, no lock
    if(gunship&&locked()&&e.pointerType==='mouse'&&e.button===0){e.stopImmediatePropagation();e.preventDefault();state.held=true;host.wake();return;}   // locked in the seat: the button is the trigger
    if(map)return;
    e.stopImmediatePropagation();e.preventDefault();dragging=true;lastX=e.clientX;lastY=e.clientY;
    // moving and shooting are separate: a mouse click locks the pointer so the mouse aims; the trigger is Space (or the pad's fire button)
    if(e.pointerType==='mouse'&&e.button===0&&!locked())root.requestPointerLock?.();
    e.target.setPointerCapture?.(e.pointerId);host.wake();
  },{capture:true});
  listen(window,'pointermove',e=>{if(gunship&&map){px=e.clientX;py=e.clientY;return;}if(!dragging&&!locked())return;if(map)return;e.stopImmediatePropagation();const dx=locked()?e.movementX:e.clientX-lastX,dy=locked()?e.movementY:e.clientY-lastY;state.yaw-=dx*.004/state.zoom;state.pitch=Math.max(gunship?G.platform.pitchMin:-1.25,Math.min(gunship?G.platform.pitchMax:.9,state.pitch-dy*.004/state.zoom));lastX=e.clientX;lastY=e.clientY;},{capture:true});
  listen(window,'pointerup',()=>{dragging=false;if(gunship)state.held=false;},{capture:true});
  // the tank pad on touch: the fire button holds the trigger, the side zones turn the mount; their clicks never reach the tank
  for(const [sel,down,up] of [['#td-pad-fire',()=>{state.held=!map;},()=>{state.held=false;}],['#td-pad-left',()=>{state.turn=-1;},()=>{state.turn=0;}],['#td-pad-right',()=>{state.turn=1;},()=>{state.turn=0;}]]){
    const el=root.querySelector(sel);if(!el)continue;
    listen(el,'pointerdown',e=>{e.stopImmediatePropagation();e.preventDefault();down();host.wake();},{capture:true});
    for(const evt of ['pointerup','pointerleave','pointercancel'])listen(el,evt,e=>{e.stopImmediatePropagation();up();},{capture:true});
    listen(el,'click',e=>{e.stopImmediatePropagation();e.preventDefault();},{capture:true});
  }
  listen(root,'contextmenu',e=>{if(!map)e.preventDefault();});
  listen(window,'blur',()=>{dragging=false;state.held=false;});
  listen(root,'wheel',e=>{if(map||e.target.closest('#sentry-pilot'))return;e.preventDefault();e.stopImmediatePropagation();const z=Math.max(1,Math.min(5,(gunship?state.zoomGoal??state.zoom:state.zoom)+(e.deltaY<0?.25:-.25)));if(gunship)state.zoomGoal=z;else{state.zoom=z;host.zoom(state.zoom);};},{capture:true,passive:false});
  function pose(tw,goal){
    if(!tw)return false;
    if(gunship&&tw===ship)holdAim();
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
    goal.pos.copy(camEye);host.cameraPose(camEye,frameView(dt),up,goal);
    return !map;
  }
  // THE ROUND STAYS IN FRAME (owner, 2026-09-16; src/core/round-framing.js): while this mount's guided round is in its opening
  // (host.round: its position and flight fraction) the lens eases toward 1x and the view follows the round in a dead zone, then hands
  // back to the aim through the climb. The aim itself never moves, so the lock and the next shot are where the pilot left them.
  const look=new THREE.Vector3();let lens=null;   // lens: the zoom while a round is framed; null when the lens is the pilot's own
  function frameView(dt){
    const r=gunship||map?null:host.round?.(),w=r?framingWeight(r.u):0;
    if(gunship||map){lens=null;}
    else if(w>0||lens!==null){const want=state.zoom+(ROUND_FRAME.lens-state.zoom)*w;lens??=state.zoom;lens+=(want-lens)*(1-Math.exp(-dt/.12));if(w===0&&Math.abs(lens-want)<.01){lens=null;host.zoom(state.zoom);}else host.zoom(lens);}
    root.classList.toggle('pilot-framing',w>0);   // the reticle marks the aim, and the view is elsewhere for a moment
    if(!(w>0))return direction;
    const [fovDeg,aspect]=host.lens?.()??[60/(lens??state.zoom),innerWidth/innerHeight];
    return look.fromArray(frameRound({eye:camEye.toArray(),aim:direction.toArray(),up:up.toArray(),round:r.pos,fovDeg,aspect,weight:w}));
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
    state.tower=tw;state.held=false;state.target=null;state.hidden=null;headSeen=false;   // the yaw below is against the mount's frame as it is now
    v.fromArray(toward);tw.obj.worldToLocal(v);state.yaw=Math.atan2(v.x,v.z);
    up.copy(tw.obj.position).normalize();eye.copy(tw.obj.position).addScaledVector(up,host.cellSide()*.65);
    v.fromArray(toward).sub(eye);state.pitch=Math.atan2(v.dot(up),v.clone().addScaledVector(up,-v.dot(up)).length());
  }
  // THE GUNSHIP (docs/superpowers/specs/2026-09-13-heavy-gunship-design.md). A virtual mount riding the pass over the base:
  // the player takes the optic and the guns, never the aircraft. Position is the schedule's, not an input. Every gun fires
  // wherever it is pointed; the danger report is a readout. The heavy IS the orbital strike: choosing it arms the safety,
  // aiming paints the cell, the trigger launches through strike.js's own ritual.
  const G=host.gunship,ship={key:'gunship',obj:G?G.optic.platformObject():null,ci:-1},aim=new THREE.Vector3(),t1=new THREE.Vector3(),t2=new THREE.Vector3();
  let gunship=false,impact=null,report=null,rounds=0,landedRounds=0,pendingAim=null,px=innerWidth/2,py=innerHeight/2,fireLoop=null;
  const MODES=['normal','night','thermal'];let mode=0;   // M cycles the seat's view: the planet as it is, night vision (dark, contacts white), thermal (hot, contacts yellow)
  function setMode(i){mode=(i+MODES.length)%MODES.length;for(const m of MODES)root.classList.toggle(`gunship-${m}`,gunship&&MODES[mode]===m);G.optic.contactsStyle(gunship?MODES[mode]:'normal');host.thermal?.(gunship&&MODES[mode]==='thermal');}   /* thermal also runs the base warm (src/fx/thermal-heat.js) */const GUNSHIP_EYE=-.35;   // cells below the platform origin: the belly, where the muzzles are
  const hud=G?createGunshipHud(root):null;
  const guns=document.createElement('div');guns.className='pilot-guns';guns.style.display='none';
  guns.innerHTML=G?G.order.map((k,i)=>`<button data-gun="${k}">${i+1} · ${G.guns[k].label}</button>`).join(''):'';panel.querySelector('header').after(guns);
  function selectGun(key){if(!G||!G.select(key))return;state.held=false;guns.querySelectorAll('[data-gun]').forEach(b=>b.classList.toggle('on',b.dataset.gun===key));if(!G.guns[key].strike)G.laser(-1);if(gunship&&!map){state.zoomGoal=G.guns[key].zoom??state.zoom;}}   // each gun its own magnification
  guns.querySelectorAll('[data-gun]').forEach(b=>listen(b,'click',()=>selectGun(b.dataset.gun)));
  // the platform's place is the optic's (host.gunship.optic.ride, driven by the game each tick); the seat only reads it
  const trackAxes=()=>{t1.set(0,0,1).applyQuaternion(ship.obj.quaternion);t2.set(1,0,0).applyQuaternion(ship.obj.quaternion);};
  // THE SEAT HOLDS ITS WORLD AIM (owner, 2026-09-15: the gunship creeps toward the breaches). The yaw stays relative to the platform, and the
  // platform now turns (slowly, src/domain/gunship-track.js): every frame the yaw gives back what the heading turned, so the view stays where the
  // gunner left it and never swings with the hull. Called from the tick and from pose(); a second call in a frame finds no turn.
  const headWas=new THREE.Vector3(),headNow=new THREE.Vector3(),headUp=new THREE.Vector3();let headSeen=false;
  function holdAim(){if(!ship.obj)return;headNow.set(0,0,1).applyQuaternion(ship.obj.quaternion);headUp.copy(ship.obj.position).normalize();if(headSeen)state.yaw-=headingTurn(headWas.toArray(),headNow.toArray(),headUp.toArray());headWas.copy(headNow);headSeen=true;}
  function mountGunship(){
    if(!G||G.mount()!=='mounted')return 'refused';
    gunship=true;ship.ci=G.heart();state.tower=ship;state.held=false;state.target=null;state.hidden=null;state.view='pov';state.zoom=G.platform.zoom??1;state.zoomGoal=state.zoom;host.zoom(state.zoom);px=innerWidth/2;py=innerHeight/2;
    pendingAim=G.centers[G.lane()];aimShip();state.pitch=-1.45;   // the seat opens looking straight down, the lane's way   // the seat opens on where they come from; settled again on the first tick, once the platform has taken its track (its frame can swing when a breach opens)
    guns.style.display='';panel.querySelector('header').innerHTML='KORP / GS01 <small>HEAVY GUNSHIP · ON STATION</small>';panel.querySelector('footer').textContent='Click to lock the mouse, move it to aim · Space or the button fires · rounds take seconds to land: lead them · 1 rotary · 2 bofors · 3 heavy · M view: normal / night / thermal · V the ship · T top view · P pause';
    G.optic.mount();host.views?.('gunship');selectGun(G.state.gun);if(map)toggleMap();root.classList.add('gunship-seat');panel.querySelector('.pilot-cross').style.display='none';setMode(2);   // the seat opens in thermal, the FLIR ironbow (owner, 2026-09-14)
    return 'mounted';
  }
  function dismountGunship(){
    if(!gunship)return;gunship=false;headSeen=false;root.classList.remove('gunship-seat');for(const m of MODES)root.classList.remove(`gunship-${m}`);host.thermal?.(false);fireLoop?.stop(.1);fireLoop=null;hud?.update({on:false});G.laser(-1);panel.querySelector('.pilot-cross').style.display='';G.dismount();G.optic.dismount();G.optic.rings(null);impact=null;report=null;guns.style.display='none';
  }
  function aimShip(){ship.obj.updateMatrixWorld(true);attach(ship,pendingAim);state.pitch=-1.45;}
  // THE ROUNDS LEAVE FROM UNDER THE GUNNER (owner, 2026-09-14): from the seat the model's muzzle sockets sit above and to the
  // right of the eye, so every round came in from the top right of the frame. Seen from the seat a round starts just below
  // the view's centre, the rotary pair a hair left and right, and converges on the aim; the ship and map views keep the sockets.
  const muz=new THREE.Vector3(),muzR=new THREE.Vector3(),muzU=new THREE.Vector3();let muzSide=0;
  function muzzleFor(key){
    if(state.view!=='pov'||map)return G.optic.muzzle(key);
    const c=host.cellSide();muzR.crossVectors(direction,up);if(muzR.lengthSq()<1e-12)muzR.copy(t2);muzR.normalize();muzU.crossVectors(muzR,direction).normalize();
    return muz.copy(eye).addScaledVector(direction,c*.6).addScaledVector(muzU,-c*.08).addScaledVector(muzR,key==='heavy'?0:((muzSide++&1)?c*.03:-c*.03)).toArray();
  }
  // THE MAP FRAMES THE APPROACH: centred between the base and the swarm's centre, zoomed on mount to hold both, so what is coming is
  // in view and moving; the wheel still zooms after that. Returns the swarm's centre and count for the readout.
  const cen=new THREE.Vector3(),hn=new THREE.Vector3();let frameAt=0;
  function frameApproach(zoom){
    const es=G.enemies();hn.fromArray(G.normals[G.heart()]).normalize();cen.set(0,0,0);for(const e of es)cen.add(v.fromArray(e.pos).normalize());
    if(!es.length){if(zoom)G.frame(hn.toArray(),2.0);return {n:0};}
    cen.divideScalar(es.length).normalize();const span=Math.acos(Math.max(-1,Math.min(1,cen.dot(hn))));
    G.frame(v.copy(hn).add(cen).normalize().toArray(),zoom?1.25+span*2.6:0);
    return {n:es.length,span};
  }
  // the sim step: the platform's place, the aim, the readout, the rounds
  function gunshipTick(dt){
    if(!G)return;
    if(!gunship)return;
    // THE ZOOM EASES (owner, 2026-09-15: camera jumps when changing weapons): a gun's magnification or a wheel step is a goal, reached over ~0.15 s, not a cut
    if(!map&&state.zoomGoal!=null&&Math.abs(state.zoom-state.zoomGoal)>1e-3){state.zoom+=(state.zoomGoal-state.zoom)*(1-Math.exp(-dt/0.14));if(Math.abs(state.zoom-state.zoomGoal)<0.005)state.zoom=state.zoomGoal;host.zoom(state.zoom);}
    if(pendingAim){aimShip();pendingAim=null;}
    if(!G.onStation()){dismountGunship();host.views?.('tank');host.leave?.();return;}
    holdAim();trackAxes();up.copy(ship.obj.position).normalize();
    forward.set(Math.sin(state.yaw),0,Math.cos(state.yaw)).applyQuaternion(ship.obj.quaternion).normalize();
    direction.copy(forward).multiplyScalar(Math.cos(state.pitch)).addScaledVector(up,Math.sin(state.pitch)).normalize();
    eye.copy(ship.obj.position).addScaledVector(up,host.cellSide()*GUNSHIP_EYE);   // the same eye pose() puts the camera on
    G.optic.contacts(G.enemies());frameAt+=dt;let swarm=null;if(map&&frameAt>=1){frameAt=0;swarm=frameApproach(false);}
    let ci=-1;if(map){ci=G.cellAt(px,py);impact=ci>=0?G.centers[ci].slice():null;}else{impact=G.aim(eye.toArray(),direction.toArray());ci=impact?G.cell(impact):-1;}   // on the map the pointer is the aim; looking at the ship, the optic's ray is
    const gun=G.guns[G.state.gun],c=host.cellSide();
    report=impact?Object.fromEntries(G.order.map(k=>[k,G.danger(impact,G.guns[k].dangerCells*c)])):null;
    G.optic.rings(impact,ci>=0?G.normals[ci]:[0,1,0],G.state.gun,report);
    let fired=null;
    if(gun.strike){   // THE GUNSHIP'S OWN 105: paint, then launch; the camera stays in the seat, the shell is seen falling; one nudge; then the reload
      const hs=G.heavyState();
      if(hs.phase==='falling'){if(ci>=0&&!hs.nudged&&G.nudgeHeavy(ci))G.laser(ci);}
      else if(state.held){state.held=false;
        if(hs.phase==='painted'){const tgt=G.centers[hs.ci];const lc=G.launchHeavy();if(lc>=0){fired='round';G.sfx(gun.sound,ship.obj.position.toArray());G.optic.flight(muzzleFor('heavy'),tgt,gun.ringHex,gun.travel,1.2);G.optic.paint(tgt,G.normals[lc],gun.blastCells*c,gun.travel);}}
        else if(hs.phase==='ready'&&ci>=0&&G.paintHeavy(ci)){G.laser(ci);G.sfx('tank_shells',impact);}
      }
      if(hs.phase!=='falling'&&hs.phase!=='painted')G.laser(-1);
    }else{
      const n=G.step(dt,state.held);
      if(n>0&&impact){
        fired='round';if(!gun.loop)G.sfx(gun.sound,ship.obj.position.toArray(),{rate:gun.pitch??1});
        for(let i=0;i<n;i++){   // a golden-angle scatter inside half the blast, so a burst walks rather than drills; the round is in the air for `travel` seconds
          const a=(rounds++)*2.399963,r=gun.blastCells*c*.5*Math.sqrt((rounds%7)/7);
          aim.fromArray(impact).addScaledVector(t1,Math.cos(a)*r).addScaledVector(t2,Math.sin(a)*r);
          G.fire(gun.key,aim.toArray(),gun.travel);G.optic.flight(muzzleFor(gun.key),aim.toArray(),gun.ringHex,gun.travel,gun.key==='bofors'?.5:.25);
          if(gun.key==='bofors'&&ci>=0)G.optic.paint(aim.toArray(),G.normals[ci],gun.blastCells*c,gun.travel);   // the shell's target, painted red until it lands
        }
      }else if(state.held)fired='held';
      if(gun.loop&&state.held){fireLoop??=G.loop(gun.sound,{gain:1});}else if(fireLoop){fireLoop.stop(.12);fireLoop=null;}   // the sustained gun sounds as long as the trigger is down
    }
    {const lc=G.stepHeavy();if(lc>=0){G.blast(lc);G.laser(-1);}}   // the 105 lands: the strike's blast, the gunship's shell
    for(const r of G.landed()){   // what stands where the round was aimed, when it lands
      const g=G.guns[r.gun],rc=G.cell(r.point);aim.fromArray(r.point);
      for(const e of G.enemies()){const d=aim.distanceTo(v.fromArray(e.pos));if(d<g.blastCells*c)G.damage(e,G.splash(d,g.blastCells*c,g.damage));}
      if(g.key==='bofors'){G.puff(rc,g.ringHex,.7,g.blastCells*c*1.6);G.puff(rc,0xffffff,.35,g.blastCells*c*.7);if(!G.explode('gunship.bofors',r.point))G.burst(r.point,0xffd08a,44,.5);G.sfx(g.impact,r.point,{rate:.7});}else{G.puff(rc,g.ringHex,.16,g.blastCells*c*.9);if(!G.explode('gunship.rotary',r.point))G.burst(r.point,0xdfe8ee,7,.18);if(landedRounds++%2===0)G.sfx(g.impact,r.point,{rate:.9,gain:.5});}   // the impact, seen and heard where the round lands: the strike's ring language one register down
    }
    G.optic.hull(state.view!=='pov'||map);G.optic.pose({pitch:state.pitch,gun:G.state.gun,firing:fired,dt});
    const r=report?.[G.state.gun],left=Math.ceil(G.left());
    const hsNow=G.heavyState(),range=impact?Math.round(v.fromArray(impact).distanceTo(ship.obj.position)/c*G.platform.metresPerCell/10)*10:0,es=G.enemies(),hc=G.centers[G.heart()],near=es.reduce((m,e)=>Math.min(m,Math.hypot(e.pos[0]-hc[0],e.pos[1]-hc[1],e.pos[2]-hc[2])),Infinity);
    panel.querySelector('output').textContent=`${gun.label} · ${gun.cue}`;
    hud?.update({on:!map,w:innerWidth,h:innerHeight,gun:G.state.gun,hot:state.held||fired==='round',spinning:G.state.gun==='rotary'&&(state.held||fired==='round')?1:0,dt,range,coords:impact?planetCoords(v.fromArray(impact).normalize().toArray()):'—',contacts:es.length,nearest:es.length?near/c*G.platform.metresPerCell:null,blast:r&&(r.walls||r.towers||r.tank||r.isao)?`${r.walls} wall${r.walls===1?'':'s'} · ${r.towers} sentr${r.towers===1?'y':'ies'}${r.tank?' · TANK':''}${r.isao?' · ISAO':''}`:'clear',left:G.left(),state:gun.strike?({falling:`SHELL FALLING · ${hsNow.nudged?'NUDGED':'NUDGE ONCE'}`,reloading:`RELOADING ${Math.ceil(hsNow.left??0)} S`,painted:'PAINTED · FIRE TO LAUNCH',ready:'FIRE TO PAINT'})[hsNow.phase]:gun.magazine?(G.state.mag===0||G.state.clock<G.state.reloadUntil?`RELOADING ${Math.ceil(G.state.reloadUntil-G.state.clock)} S`:state.held?`FIRING · ${G.state.mag<0?gun.magazine:G.state.mag} LEFT`:`READY · ${G.state.mag<0?gun.magazine:G.state.mag} / ${gun.magazine}`):(G.state.overheated?'OVERHEATED · COOLING':state.held?`FIRING · HEAT ${Math.round(G.state.heat*100)}%`:'READY'),bar:gun.strike?(hsNow.phase==='reloading'?1-hsNow.left/gun.reload:hsNow.phase==='falling'?1-hsNow.left/gun.travel:1):gun.magazine?(G.state.mag===0||G.state.clock<G.state.reloadUntil?1-Math.max(0,G.state.reloadUntil-G.state.clock)/gun.reload:(G.state.mag<0?gun.magazine:G.state.mag)/gun.magazine):G.state.heat,barHot:gun.strike?hsNow.phase!=='ready':gun.magazine?(G.state.mag===0||G.state.clock<G.state.reloadUntil):G.state.overheated,barLabel:gun.strike?(hsNow.phase==='reloading'?'RELOAD':hsNow.phase==='falling'?'FALL':'SHELL'):gun.magazine?'MAG':'HEAT',painted:gun.strike?hsNow.phase==='painted'||hsNow.phase==='falling':G.state.rounds.some(x=>x.gun==='bofors'),zoom:state.zoom});
  }
  // GROUND TRUTH · IMPACT, one constant framing (owner, 2026-09-15: keep it at the 105's view for every gun, not zoomed in too far): the long lens fits
  // three of the 105's blast radii and stands back far enough to stay inside the monitor's 30° clamp, whichever gun is firing
  const gunshipOptic=()=>{if(!gunship||!impact)return null;const c=host.cellSide(),span=Math.max(c*1.2,(G.guns.heavy?.blastCells??3.2)*c*3),back=Math.max(c*2.2,span*1.9);return{from:aim.fromArray(impact).addScaledVector(t1,back).toArray(),pos:impact,span,lift:back*0.45,label:'GROUND TRUTH · IMPACT'};};
  let hitT=0;const cross=panel.querySelector('.pilot-cross');
  return {state,pose,target,attach,select,setView,isMap:()=>map,hit(){cross.classList.add('hit');clearTimeout(hitT);hitT=setTimeout(()=>cross.classList.remove('hit'),120);},mountGunship,dismountGunship,gunshipTick,gunshipOptic,get gunship(){return gunship;},
    aimAt:pos=>{const {held,target}=state;attach(state.tower,pos);state.held=held;state.target=target;},
    update(text){panel.querySelector('output').textContent=text;},
    dispose(){dismountGunship();hud?.dispose();abort.abort();if(locked())document.exitPointerLock?.();panel.remove();root.classList.remove('sentry-pilot-mode','pilot-framing');}
  };
}
