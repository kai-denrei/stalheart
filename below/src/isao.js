import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {confine} from './mission.js';
import {CHASE,chaseYaw,boomFor,chasePitch} from './flight.js';

export async function createIsao(scene,camera){
  const gltf=await new GLTFLoader().loadAsync('./assets/models/isao_birudoron_lod1.glb');
  const rig=new THREE.Group(),model=new THREE.Group();rig.name='ISAO flight rig';rig.add(model);scene.add(rig);
  const box=new THREE.Box3().setFromObject(gltf.scene),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const scale=2.25/Math.max(size.x,size.z);gltf.scene.position.sub(center);model.scale.setScalar(scale);model.rotation.y=Math.PI;model.add(gltf.scene);
  const mixer=new THREE.AnimationMixer(gltf.scene);const actions=new Map();
  for(const clip of gltf.animations)actions.set(clip.name,mixer.clipAction(clip));
  actions.get('Rotor_Cycle')?.play();let face=null;
  const payload=new THREE.Mesh(new THREE.CylinderGeometry(.15,.15,.65,12),new THREE.MeshStandardMaterial({color:0x96916c,roughness:.55,metalness:.35}));payload.rotation.z=Math.PI/2;payload.position.set(0,-.58,0);rig.add(payload);
  const lamp=new THREE.SpotLight(0xe0dfbf,38,19,Math.PI/5,.7,1.4);
  lamp.position.set(0,-.15,-.8);lamp.target.position.set(0,-.8,-7);rig.add(lamp,lamp.target);
  const spill=new THREE.PointLight(0xc9d7c0,.8,3,1.5);spill.position.set(0,-.1,-.8);rig.add(spill);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.055,8,6),new THREE.MeshBasicMaterial({color:0xe0dfbf}));bulb.position.copy(lamp.position);rig.add(bulb);
  const haloUniforms={strength:{value:0}};
  const hitHalo=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),new THREE.ShaderMaterial({uniforms:haloUniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vView=-p.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform float strength;varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),1.5);gl_FragColor=vec4(1.,.015,.005,(.04+rim*.9)*strength);}'
  }));hitHalo.name='ISAO impact halo';hitHalo.scale.set(1.55,.95,1.55);rig.add(hitHalo);hitHalo.visible=false;let hitAt=-100;
  function flashHit(time){hitAt=time;}
  const back=new THREE.Vector3(),desired=new THREE.Vector3(),target=new THREE.Vector3(),test=new THREE.Vector3(),last=new THREE.Vector3(),seen=new THREE.Vector3(),goal=new THREE.Vector3();
  function clipBoom(position,goal){
    last.copy(position);
    for(let i=1;i<=12;i++){test.lerpVectors(position,goal,i/12);const x=test.x,y=test.y,z=test.z;confine(test,.18);if(Math.hypot(test.x-x,test.y-y,test.z-z)>.05)break;last.copy(test);}
    return last;
  }
  let initialized=false,camYaw=0,reach=0,rise=0;const anchor=new THREE.Vector3();
  function update(time,dt,position,yaw,orbitPitch,flight,mission,orbit=null){
    const hitAge=time-hitAt;haloUniforms.strength.value=hitAge>=0&&hitAge<.9?(1-hitAge/.9)*(.8+.2*Math.sin(hitAge*24)):0;hitHalo.visible=haloUniforms.strength.value>0;
    lamp.intensity=mission.lampState==='working'?38:0;spill.intensity=mission.lampState==='working'?.8:0;bulb.visible=mission.lampState==='working';
    rig.position.copy(position);rig.rotation.set(flight.pitch,yaw,flight.roll,'YXZ');payload.visible=mission.payload;
    const emotion=mission.integrity<=3?'Emotion_Alarm':mission.hits>0?'Emotion_Worried':!mission.payload?'Emotion_Determined':'Emotion_Neutral';
    if(emotion!==face){if(face)actions.get(face)?.stop();actions.get(emotion)?.play();face=emotion;}
    actions.get('Rotor_Cycle')?.setEffectiveTimeScale(1+Math.hypot(flight.velocity.x,flight.velocity.y,flight.velocity.z)*.055);mixer.update(Math.max(0,dt));
    // the chase camera (flight.js CHASE, round 7 note 9): its azimuth eases toward the heading and never swings round ISAO; the wall shortens and lifts the boom.
    // The camera sits on the camera yaw's own half-plane: the boom's reach and height ease at rate 10 and so does the point it hangs from (ISAO's position), so
    // the smoothing never cuts a chord round him. A jump no flight makes in a frame (a teleport: the harness's place/pose, a restart) puts it straight behind him
    const teleported=initialized&&seen.distanceTo(position)>3;seen.copy(position);
    if(!initialized||teleported)camYaw=yaw;else camYaw=chaseYaw(camYaw,yaw,dt);
    // THE MOUSE ORBITS THE CAMERA (round 8, note 4, owner 2026-11-05: "moving the mouse should move the camera but without hindering the Isao movement"): the
    // drag's orbit (flight.js orbitStep) is added HERE ONLY, to the azimuth and pitch the camera is built on; his yaw, the follow and the boom's rules are untouched,
    // so the wall still pulls the boom in along his ray and the view still looks along the camera's own azimuth (now his heading plus the orbit)
    const az=camYaw+(orbit?.yaw||0),pitch=chasePitch(orbitPitch+(orbit?.pitch||0));
    const sy=Math.sin(az),cy=Math.cos(az);
    back.set(sy*Math.cos(pitch),-Math.sin(pitch),cy*Math.cos(pitch));
    desired.copy(position).addScaledVector(back,CHASE.boom);desired.y+=.5;
    const {length,lift}=boomFor(clipBoom(position,desired).distanceTo(position));
    goal.copy(position).addScaledVector(back,length);goal.y+=.5+lift;desired.copy(clipBoom(position,goal));   // clipped along ISAO's own ray: the wall pulls it in, never round him
    const reachGoal=Math.hypot(desired.x-position.x,desired.z-position.z),riseGoal=desired.y-position.y;
    if(!initialized||teleported){anchor.copy(position);reach=reachGoal;rise=riseGoal;initialized=true;}
    else{const k=1-Math.exp(-dt*10);anchor.lerp(position,k);if(reachGoal<reach){reach=reachGoal;rise=riseGoal;}else{reach+=(reachGoal-reach)*k;rise+=(riseGoal-rise)*k;}}   // the wall pulls the boom in at once, to the free point on its ray (an eased boom would sit in the rock and be pushed round him); it lets it out at rate 10
    camera.position.set(anchor.x+sy*reach,anchor.y+rise,anchor.z+cy*reach);
    confine(camera.position,.18);camera.up.set(0,1,0);
    // it looks along its own yaw, down at ISAO's height over at least minBoom: a boom the rock has pulled in under him never looks straight down (a lookAt
    // from over him spins the view with every centimetre), so the view's heading is the camera yaw in every frame
    const r=Math.max(reach,CHASE.minBoom);target.set(camera.position.x-sy*r,anchor.y+.25,camera.position.z-cy*r);camera.lookAt(target);
  }
  function reset(){hitAt=-100;hitHalo.visible=false;haloUniforms.strength.value=0;initialized=false;face=null;mixer.setTime(0);}
  return {rig,update,reset,flashHit,stats:()=>({isaoModel:'isao_birudoron_lod1',rotorClip:actions.has('Rotor_Cycle'),rotorRotation:gltf.scene.getObjectByName('ROTOR_FL_SPIN')?.quaternion.toArray(),cameraDistance:camera.position.distanceTo(rig.position),lampIntensity:lamp.intensity,hitHaloVisible:hitHalo.visible,hitHaloStrength:haloUniforms.strength.value})};
}
