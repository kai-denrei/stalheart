import * as THREE from '../vendor/three.module.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import {impactCue} from './audio-cues.js';
import {createFlight,fly} from './flight.js';
import { parseMode, endingAction, postOutcome } from './handoff.js';
import { DOOR, tiltAt, climbAt } from './door.js';
import { center, confine, closeToQueen, createMission, tickMission, clamp, START, QUEEN, CHAMBER_LIP, nearestRoute, useFlare, recordImpact, MAX_HP, FLARE_COUNT, SINKHOLE_THROAT, FUSE } from './mission.js';

const $=id=>document.getElementById(id);
const stalheart=parseMode(location.search);   // the campaign's last mission inside Stålheart's page (src/handoff.js)
const audio=createAudio();
const keys=new Set(),velocity=new THREE.Vector3();
let world,mission=createMission(),flight=createFlight(START),mode='briefing',resumeMode='playing',detonationAt=0,yaw=0,pitch=-.43,dragging=false,hadLock=false;
let simulationTime=0,lastTime=performance.now(),lastScan=-10,lastHit=-10,alertUntil=0,commsUntil=0,impact=0,lookDelta=0;
let dialogueQueue=[],seen=new Set(),frameTimes=[];
let climbing=null,skyFade=null;   // the climb out of the arena's hole (src/door.js): its seconds, and the sky's fade over the page
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const formatTime=s=>{const total=Math.max(0,Math.ceil(s));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;};

function say(text,duration=6,speaker='ISAO',delay=0){
  if(delay){dialogueQueue.push({at:simulationTime+delay,text,duration,speaker});return;}
  audio.noteActivity(simulationTime,duration);
  $('speaker').textContent=speaker;$('dialogue').textContent=text;$('comms').classList.add('on');commsUntil=simulationTime+duration;
}
// PRESS Q (owner, 2026-10-18: "when the LIDAR becomes available, indicate 'Press Q' for lidar"): from 'lidar-ready' the alert line holds the hint
// until the LiDAR is first used (Q, or a view key, which sends the first sweep through scan()), and only while the bomb is carried: extraction clears it
const LIDAR_HINT='PRESS Q · LIDAR';
function alert(text,duration=4){$('alert').textContent=text;alertUntil=simulationTime+duration;}
function lock(){
  try{const promise=$('view').requestPointerLock();promise?.catch(()=>{alert('DRAG TO LOOK · ARROW KEYS ALSO AVAILABLE',5);});}catch{alert('DRAG TO LOOK · ARROW KEYS ALSO AVAILABLE',5);}
}
function start(){
  mission=createMission();world.reset();simulationTime=0;lastScan=-10;lastHit=-10;impact=0;dialogueQueue=[];seen=new Set();keys.clear();velocity.set(0,0,0);
  // THE DOOR (2026-10-26, src/door.js): in Stålheart's page ISAO starts at the foot of the arena's hole, on its rubble, under its mouth of sky
  const from=stalheart?world.doorStart.position:START;world.showDoor(stalheart);climbing=null;if(skyFade)skyFade.style.opacity='0';
  yaw=0;pitch=-.43;world.player.copy(from);flight=createFlight(from);flight.position=world.player;flight.velocity=velocity;
  $('briefing').hidden=true;$('pause').hidden=true;$('ending').hidden=true;$('hud').hidden=false;$('countdown').hidden=true;$('interaction').hidden=true;$('isao-face').classList.remove('worried');
  $('alert').textContent='';alertUntil=0;mode='playing';audio.reset();audio.pause(false);audio.init().catch(()=>{});updateSoundLabel();lock();
  say('Work light’s on. Keep me clear of the walls.',6);
  say('Fifteen flares. F to drop one. We’ll need to find our own way back.',7,'ISAO',7);
  say('Keep me clear of the walls. I’d like to come back.',6,'ISAO',16);
}
function pause(){if(!['playing','surface','detonation'].includes(mode))return;resumeMode=mode;mode='paused';keys.clear();velocity.set(0,0,0);$('pause').hidden=false;audio.pause(true);if(document.pointerLockElement)document.exitPointerLock();}
function resume(){if(mode!=='paused')return;mode=resumeMode;$('pause').hidden=true;audio.pause(false);if(mode==='playing')lock();}
function scan(){
  if(mode!=='playing')return;
  if(!mission.lidarAvailable){alert(mission.lidarProcessingAt?'PROCESSING LIDAR RETURNS':'LIDAR INFORMATION NOT YET PROCESSED',3);return;}
  if(!seen.has('lidar-used')){seen.add('lidar-used');if($('alert').textContent===LIDAR_HINT){$('alert').textContent='';alertUntil=0;}}   // the hint's job is done
  if(simulationTime-lastScan<2.1){alert('SURVEY ARRAY RECHARGING',1);return;}
  if(!mission.lidar){mission.lidar=true;$('isao-face').classList.add('worried');say('Those aren’t cracks in the rock.',5,'ISAO',4);say('They’re moving.',4,'ISAO',10);}
  lastScan=simulationTime;world.scan(simulationTime);audio.tone(730,1.1,.09);alert('SURVEY PULSE / 170 m',1.5);
}
function selectView(mode){
  if(mode==='optical'){mission.lidar=false;return;}
  if(!mission.lidarAvailable)return;mission.lidarMode=Number(mode);world.setLidarMode(mission.lidarMode);mission.lidar=true;
  if(simulationTime-lastScan>=2.1)scan();
}
function receiveImpact(kind='impact'){
  if(mode!=='playing'||mission.integrity<=0)return;mission.lastContact=kind;impact=.9;world.flashHit(simulationTime);audio.noteActivity(simulationTime);audio.play(impactCue(kind),.6);
  for(const e of recordImpact(mission))event(e);
}
function dropFlare(){
  if(mode!=='playing')return;
  if(!useFlare(mission)){alert('NO FLARES REMAINING',2);return;}
  world.dropFlare(world.player,simulationTime,yaw);audio.tone(180,.3,.09);alert(`FLARE RELEASED / ${mission.flares} REMAINING`,2);
}
function end(outcome){
  mode='ended';keys.clear();velocity.set(0,0,0);dialogueQueue=[];audio.finish();if(document.pointerLockElement)document.exitPointerLock();
  $('ending').hidden=false;$('hud').hidden=true;
  const content={
    rescued:['COLONY SECURED / UNIT RECOVERED','WELCOME<br>HOME.','The ground goes quiet. Four damaged rotors clear the rim.<br><br>ISAO: “I need a new lamp.”'],
    sacrifice:['COLONY SECURED / UNIT LOST','DELIVERY<br>COMPLETE.','The charge is in place. His last transmission breaks into static.<br><br>Above you, the Stålheart keeps building.'],
    lost:['SIGNAL LOST / PAYLOAD NOT ARMED','NO<br>RESPONSE.','The feed goes dark. The tremors continue.<br><br>ISAO never reached the source. Try again. Bring him home.']
  }[outcome];
  $('ending-kicker').textContent=content[0];$('ending-title').innerHTML=content[1];$('ending-copy').innerHTML=content[2];
  $('ending-stats').textContent=`FLIGHT ${formatTime(mission.time)} / HULL ${mission.integrity} / ${MAX_HP} HP / ${mission.payload?'PAYLOAD UNDELIVERED':'PAYLOAD ARMED'}`;
  $('restart').innerHTML=`${endingAction(outcome,stalheart).label} <span>↗</span>`;   // in Stålheart's page the outcome goes back to it (src/handoff.js)
}
function event(type){
  if(type==='airframe-hit'){
    say('I felt that. Light’s still working.',4);
  } else if(type==='lamp-flicker'){
    say('Light’s going… hold on.',4);
  } else if(type==='lamp-back'){
    say('It’s back. Won’t last.',4);
  } else if(type==='lamp-failed'){
    alert('USE THE FLARES (F) FOR TEMPORARY LIGHT',10);say('Lamp’s dead. Use the flares (F) for temporary light.',8);
  } else if(type==='lidar-processing'){
    say('I’ll try processing the LiDAR information.',5,'ISAO',.6);
  } else if(type==='lidar-ready'){
    say('LiDAR is ready. Choose a view. Q sends a wide sweep.',6);alert(LIDAR_HINT,6);
  } else if(type==='dead-end'){
    say('This passage is sealed. We have to turn back.',6);
  } else if(type==='shaft'){
    say('Straight down. A long way. Mark it if you want to find it again.',7);alert('VERTICAL SHAFT / SHIFT TO DESCEND · SPACE TO CLIMB',7);
  } else if(type==='nursery'){
    audio.play('queen_laying_eggs',.42);dialogueQueue=[];say('All those tremors. She’s been underneath us the whole time.',7);
    if(mission.lidar){world.scan(simulationTime);lastScan=simulationTime;audio.tone(550,1.5,.08);}
    say('Place the bomb close to the Queen.',8,'ISAO',8);
  } else if(type==='armed'){
    audio.tone(360,.7,.16);dialogueQueue=[];say('Delivery complete. Now please get me out.',7);alert('PAYLOAD ARMED — GET BACK TO THE SURFACE',8);$('countdown').hidden=false;
    say('One hundred seconds. Find the shaft. Get me out.',5,'ISAO',9);   // mission.js FUSE (100 s since 2026-10-18), spelled out like 'Thirty seconds.'; test/mission.test.mjs checks the words against FUSE
  } else if(type==='extracted'){
    mode='surface';keys.clear();velocity.set(0,0,0);world.player.set(-17,2.5,22);if(document.pointerLockElement)document.exitPointerLock();$('alert').textContent='';alertUntil=0;   // no PRESS Q hint over the surface
    dialogueQueue=[];say('I’m out. The charge is still counting.',6);
  } else if(type==='signal-lost'){
    mode='surface';keys.clear();velocity.set(0,0,0);if(document.pointerLockElement)document.exitPointerLock();$('alert').textContent='';alertUntil=0;say('ISAO — SIGNAL LOST',6,'CONTROL');
  } else if(type==='detonated'){
    mode='detonation';detonationAt=simulationTime;world.startDetonation(simulationTime);keys.clear();velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();audio.finish();audio.play('sinkhole_quake',.6);audio.play('blast_fire',.55);$('comms').classList.remove('on');$('alert').textContent='SUBSURFACE DETONATION';
  } else if(type==='lost')end(type);
}
function step(dt){
  if(!['playing','surface','detonation'].includes(mode))return;
  simulationTime+=dt;
  if(mode==='surface'||mode==='detonation'){
    if(mode==='surface')for(const e of tickMission(mission,dt,world.player,false))event(e);
    world.update(simulationTime,mission,false,{flight,dt,yaw,pitch,cinematic:true,reducedMotion});updateHUD();
    if(simulationTime>commsUntil)$('comms').classList.remove('on');
    if(mode==='detonation'&&simulationTime-detonationAt>14)end(mission.outcome);
    return;
  }
  // A DRONE'S HANDS (the owner, 2026-10-16: "Isao control should be like a drone; WS for front back, and AD for rotation. Forcing a rotate then forward
  // control style. Then up and down separate"): A and D turn the airframe (the arrows still look), W and S fly it where it faces; no strafe
  const turn=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight'))+Number(keys.has('KeyA'))-Number(keys.has('KeyD')))*dt*1.3;
  yaw+=turn;pitch=clamp(pitch+(Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown')))*dt,-1.565,1.565);
  const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS')),side=0;
  const vertical=Number(keys.has('Space'))-Number(keys.has('ShiftLeft')||keys.has('ShiftRight'));
  fly(flight,dt,{forward,right:side,vertical},yaw,mission.payload);
  const player=world.player;
  const caveWall=confine(player),bodyContact=world.constrainBodies(player),wall=caveWall||bodyContact,limb=world.contacts(player);
  if(wall)velocity.multiplyScalar(.55);
  if((wall||limb)&&simulationTime-lastHit>1.4){
    receiveImpact(limb?(limb.kind||'tentacle'):bodyContact?bodyContact.kind:'wall');lastHit=simulationTime;
    if(limb){const push=player.clone().sub(limb.root).normalize();velocity.addScaledVector(push,3);player.addScaledVector(push,.25);if(mission.hits!==2)alert('CONTACT / SOMETHING HAS THE AIRFRAME',2);}
    else if(mission.hits!==2)alert(bodyContact?`CONTACT / ${bodyContact.kind.toUpperCase()}`:'CONTACT / CAVE WALL',2);
  }
  const events=tickMission(mission,dt,player,keys.has('KeyE')&&velocity.length()<1.8);
  for(const e of events)event(e);
  if(mode!=='playing')return;
  if(!seen.has('wall')&&nearestRoute(player).s>65&&nearestRoute(player).branch==='main'&&player.y>-60){seen.add('wall');say('Slowly. Wait for it to open, then go.',5);}
  if(!mission.payload&&mission.fuse<30&&!seen.has('thirty')){seen.add('thirty');say('Thirty seconds. Keep climbing.',5);audio.play('sinkhole_quake',.25);}
  if(!mission.payload&&mission.fuse<10&&!seen.has('ten')){seen.add('ten');say('Whatever happens. The charge stays.',5);}
  dialogueQueue.sort((a,b)=>a.at-b.at);
  if(dialogueQueue.length&&dialogueQueue[0].at<=simulationTime){const line=dialogueQueue.shift();say(line.text,line.duration,line.speaker);}
  if(simulationTime>commsUntil)$('comms').classList.remove('on');
  if(simulationTime>alertUntil)$('alert').textContent=mission.payload&&mission.lidarAvailable&&!seen.has('lidar-used')?LIDAR_HINT:'';   // other alerts pass over it, then it is back; not on the escape (the bomb placed), and surface/detonation never come here
  impact=Math.max(0,impact-dt*.7);$('impact').style.opacity=String(impact);
  const route=nearestRoute(player);audio.update(velocity.length(),simulationTime,player.y<SINKHOLE_THROAT-1,!keys.has('KeyE')&&mission.fuse>10,route.s,route.branch);world.update(simulationTime,mission,false,{flight,dt,yaw,pitch,reducedMotion});
  if(stalheart&&!reducedMotion&&simulationTime<DOOR.tilt)doorLook(tiltAt(simulationTime));
  updateHUD();
}
// THE DOOR'S FIRST SECONDS (src/door.js): from looking straight up the throat at the mouth of sky to the chase camera's view of the cave ahead
const upPos=new THREE.Vector3(),upQ=new THREE.Quaternion(),chasePos=new THREE.Vector3(),chaseQ=new THREE.Quaternion(),looker=new THREE.PerspectiveCamera();   // a camera's lookAt aims its -z
function doorLook(u){
  const cam=world.camera,p=world.player;chasePos.copy(cam.position);chaseQ.copy(cam.quaternion);
  // behind ISAO where the chase camera sits (not under it: it would fill the view), looking up the throat's axis at the mouth of sky, its top toward the
  // cave ahead; the tilt then only lowers the view
  const fx=-Math.sin(yaw),fz=-Math.cos(yaw),mouth=world.doorStart.mouth;upPos.set(p.x-fx*3,p.y-.3,p.z-fz*3);looker.position.copy(upPos);looker.up.set(fx,0,fz);looker.lookAt(0,mouth+6,0);upQ.copy(looker.quaternion);looker.up.set(0,1,0);
  const k=1-u;cam.position.lerpVectors(chasePos,upPos,k);cam.quaternion.slerpQuaternions(chaseQ,upQ,k);
}
// THE CLIMB OUT (src/door.js): the ending's RETURN TO THE SURFACE rises up the hole's axis to its mouth of sky and fades to it, then posts the outcome
function climb(){
  if(climbing!==null)return;
  climbing=0;mode='climb';$('ending').hidden=true;
  if(!skyFade){skyFade=document.createElement('div');skyFade.id='door-sky';skyFade.style.cssText=`position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;background:radial-gradient(circle at 50% 50%,#${DOOR.sky.toString(16).padStart(6,'0')} 0,#${DOOR.skyEdge.toString(16).padStart(6,'0')} 70%)`;document.body.append(skyFade);}
}
function climbStep(dt){
  climbing+=dt;const c=climbAt(climbing,world.doorStart),cam=world.camera;
  cam.position.set(0,c.y,0);looker.position.copy(cam.position);looker.up.set(0,0,-1);looker.lookAt(0,c.y+30,0);looker.up.set(0,1,0);cam.quaternion.copy(looker.quaternion);   // straight up: the up vector across the axis
  skyFade.style.opacity=String(c.fade);
  if(c.done&&mode==='climb'){mode='ended';postOutcome(mission.outcome);}
}
function updateHUD(){
  const cinematic=mode==='surface'||mode==='detonation';
  $('reticle').hidden=cinematic;
  document.querySelector('.controls').hidden=cinematic;
  if(!mission.payload&&!mission.detonated&&mission.fuse<=4.2226&&mission.fuse>0&&!seen.has('spoken-countdown')){
    seen.add('spoken-countdown');audio.countdown(mission.fuse);dialogueQueue=[];say('Strike inbound. Three. Two. One.',mission.fuse,'ISAO');
  }
  $('countdown').style.color=mission.fuse<15?'var(--red)':'var(--amber)';
  $('countdown').querySelector('.label').textContent=mission.detonated?'CHARGE DETONATED':'DETONATION IN';
  $('countdown').lastElementChild.textContent=mission.detonated?'COLONY / SOURCE DESTROYED':mission.extracted?'ISAO SAFE / STAND CLEAR':'GET ISAO TO THE SURFACE';
  const player=world.player,depth=Math.max(0,-player.y);
  $('clock').textContent=`00:${formatTime(mission.time)}`;
  $('depth').textContent=String(Math.round(depth)).padStart(3,'0');
  $('speed').textContent=`${velocity.length().toFixed(1)} m/s`;
  $('integrity').innerHTML=`${mission.integrity}<small> / ${MAX_HP} HP</small>`;$('hull-bar').style.width=`${mission.integrity/MAX_HP*100}%`;$('hull-bar').style.background=mission.integrity<=3?'var(--red)':'';
  $('sensor-mode').textContent=cinematic?'SURFACE / OPTICAL':mission.lidar?['LIDAR / DEPTH','LIDAR / PHOSPHOR','LIDAR / MOTION'][mission.lidarMode]:'OPTICAL';
  $('sensor-status').textContent=cinematic?'OBSERVATION FEED':mission.lidar?'Q / WIDE SURVEY PULSE':mission.lampState==='working'?'WORK LIGHT / NOMINAL':mission.lampState==='flicker'?'WORK LIGHT / UNSTABLE':mission.lampState==='back'?'WORK LIGHT / WEAK':'WORK LIGHT LOST / FLARES F';
  $('sensor-light').style.background=mission.lampState==='failed'&&!mission.lidar?'var(--red)':'';
  $('lidar-options').hidden=!mission.lidarAvailable||cinematic;
  $('scan-key').hidden=!mission.lidarAvailable;
  for(const button of document.querySelectorAll('[data-view]'))button.classList.toggle('active',button.dataset.view===(mission.lidar?String(mission.lidarMode):'optical'));
  $('objective').textContent=mission.detonated?'SUBSURFACE DETONATION':mission.extracted?'ISAO RECOVERED / CHARGE COUNTING':mission.signalLost?'SIGNAL LOST / CHARGE COUNTING':!mission.payload?'RETURN TO THE SINKHOLE':mission.nursery?'Place the bomb close to the Queen.':mission.hits>0?'FIND THE SOURCE / AVOID CONTACT':'DESCEND INTO THE BREACH';
  $('depth-key').hidden=!mission.lidar||cinematic;$('payload-state').textContent=mission.payload?'SECURED':'DEPLOYED';
  $('bearing').textContent=`HDG ${String(Math.round((-yaw*180/Math.PI%360+360)%360)).padStart(3,'0')}`;
  $('range').textContent=mission.payload?'SURVEY / SOURCE UNKNOWN':'RETURN / SURFACE';
  if(mission.nursery&&mission.payload)$('range').textContent='QUEEN / CONFIRMED';
  $('flare-count').textContent=String(mission.flares).padStart(2,'0')+' / '+FLARE_COUNT;
  $('link').textContent=`LINK ${Math.max(18,Math.round(99-depth*.29))}%`;
  const placing=mission.payload&&keys.has('KeyE');
  $('interaction').hidden=!placing;
  $('interaction-text').textContent=!closeToQueen(player)?'Place the bomb close to the Queen.':velocity.length()>1.8?'HOLD POSITION':'PLACING CHARGE — KEEP HOLDING E';
  $('arm-bar').style.width=`${mission.armProgress*100}%`;
  $('timer').textContent=formatTime(mission.fuse);
}
function updateSoundLabel(){ $('sound').textContent=audio.enabled?'AUDIO ON':'AUDIO OFF';$('sound').setAttribute('aria-label',audio.enabled?'Mute audio':'Unmute audio'); }
updateSoundLabel();
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>selectView(button.dataset.view));
$('begin').addEventListener('click',start);$('resume').addEventListener('click',resume);$('restart').addEventListener('click',()=>{if(endingAction(mission.outcome,stalheart).action==='return')climb();else start();});   // the climb out, then the outcome to the game (src/door.js)$('restart-pause').addEventListener('click',start);
$('sound').addEventListener('click',()=>{audio.init().catch(()=>{});audio.mute(audio.enabled);updateSoundLabel();});
document.addEventListener('keydown',e=>{
  // A SHORTCUT IS NOT FLIGHT (the owner, 2026-10-16: a screenshot's Cmd+Shift+4 pressed Shift and put Isao into the ground): a key down with the command or
  // control key held is the system's, and whatever was held is let go; the keys come back when they are pressed again on their own
  if(e.metaKey||e.ctrlKey){keys.clear();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code)&&mode==='playing')e.preventDefault();
  if(e.repeat){if(mode==='playing')keys.add(e.code);return;}
  if(e.code==='Escape'||e.code==='KeyP'){if(['playing','surface','detonation'].includes(mode))pause();else if(mode==='paused')resume();return;}
  if(e.code==='KeyM'){audio.mute(audio.enabled);updateSoundLabel();return;}
  if(mode==='playing'){keys.add(e.code);if(e.code==='KeyQ')scan();if(e.code==='KeyF')dropFlare();if(['Digit1','Digit2','Digit3'].includes(e.code))selectView(Number(e.code.slice(-1))-1);if(e.code==='KeyV')selectView('optical');}
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.key==='Meta'||e.key==='Control')keys.clear();});
document.addEventListener('mousemove',e=>{if(mode!=='playing'||(!document.pointerLockElement&&!dragging))return;yaw-=e.movementX*.002;pitch=clamp(pitch-e.movementY*.002,-1.565,1.565);lookDelta=clamp(e.movementX*.03,-1,1);});
$('view').addEventListener('mousedown',()=>{if(mode==='playing'){dragging=true;if(!document.pointerLockElement)lock();}});
document.addEventListener('mouseup',()=>dragging=false);
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement){hadLock=true;}else if(hadLock){hadLock=false;if(mode==='playing')pause();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('blur',()=>{keys.clear();if(['playing','surface','detonation'].includes(mode))pause();});
window.addEventListener('resize',()=>world?.resize());

try{
  world=await createWorld($('view'));
  $('begin').disabled=false;$('begin-label').textContent=stalheart?'TAKE THE FEED':'TAKE CONTROL OF ISAO';
  if(stalheart){const w=document.querySelector('.wordmark');if(w)w.style.visibility='hidden';const c=document.querySelector('.brief-copy');if(c)c.innerHTML='The arena’s sinkhole is the way down to the nest.<br>MÖRK is too big for it.<br>ISAO takes the bomb to their Queen.';}   // Stålheart's own card: no link out, the campaign's words (2026-10-18: the arena's hole, as Isao's brief over the game says it; that brief sits under this frame)
  function frame(now){
    const dt=Math.min((now-lastTime)/1000,.05);lastTime=now;
    if(mode==='briefing'){
      simulationTime+=dt;world.camera.position.set(31+Math.sin(simulationTime*.035)*2,36,39);world.camera.lookAt(0,-7,0);world.update(simulationTime,mission,true);
    }else if(mode==='climb')climbStep(dt);else step(dt);
    world.render();frameTimes.push(dt);if(frameTimes.length>120)frameTimes.shift();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Explicit test URL only; the normal game exposes no debug controls.
  if(new URLSearchParams(location.search).has('test'))window.__below={
    snapshot:()=>({mode,mission:{...mission},position:world.player.toArray(),cameraPosition:world.camera.position.toArray(),velocity:velocity.toArray(),attitude:{roll:flight.roll,pitch:flight.pitch},yaw,pitch,drawCalls:world.renderer.info.render.calls,points:world.renderer.info.render.points,meanFrameMs:frameTimes.reduce((a,b)=>a+b,0)/frameTimes.length*1000,...world.stats(),audio:audio.stats(),mother:'ovum-spider-v3',route:nearestRoute(world.player).s}),
    place:(s,dx=0,dy=0)=>{const c=center(s);world.player.set(c.x+dx,c.y+dy,c.z);velocity.set(0,0,0);},
    look:(y,p)=>{yaw=y;pitch=p;},
    advance:(seconds)=>{for(let t=0;t<seconds;t+=1/60)step(Math.min(1/60,seconds-t));},
    contactSamples:world.contactSamples,
    blastFrame:(age)=>{world.startDetonation(simulationTime);mission.payload=false;mission.detonated=true;mission.outcome='sacrifice';mode='detonation';detonationAt=simulationTime;world.update(simulationTime+age,mission,false,{flight,dt:0,yaw,pitch,cinematic:true,reducedMotion});updateHUD();mode='paused';resumeMode='detonation';audio.pause(true);world.render();},
    surveyFrame:(age)=>{world.scan(simulationTime);world.update(simulationTime+age,mission,false,{flight,dt:0,yaw,pitch,reducedMotion});world.render();},
    hurt:(value)=>{mission.integrity=Math.max(0,mission.integrity-value);},
    pose:(x,y,z)=>{world.player.set(x,y,z);velocity.set(0,0,0);},
    nearQueen:()=>{world.player.set(QUEEN.x+37,QUEEN.y,QUEEN.z+8);velocity.set(0,0,0);},
    scan, pause, resume, start, dropFlare, hit:receiveImpact, selectView, climb, climbStep, end,
    capturePose:(s,y=0,p=-.15)=>{const c=center(s);world.player.copy(c);yaw=y;pitch=p;mission.lidarAvailable=true;mission.lidar=true;world.scan(simulationTime);world.update(simulationTime+1,mission,false,{flight,dt:.016,yaw,pitch,reducedMotion});world.render();}
  };
}catch(error){
  $('load-error').hidden=false;$('load-error').textContent=`The survey feed could not start. ${error.message} Please use a desktop browser with WebGL enabled and reload.`;
  $('begin-label').textContent='FEED UNAVAILABLE';console.error(error);
}
