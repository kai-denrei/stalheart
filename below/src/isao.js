import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {confine} from './mission.js';

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
  const back=new THREE.Vector3(),desired=new THREE.Vector3(),target=new THREE.Vector3(),test=new THREE.Vector3(),last=new THREE.Vector3(),candidate=new THREE.Vector3(),best=new THREE.Vector3();
  function clipBoom(position,goal){
    last.copy(position);
    for(let i=1;i<=12;i++){test.lerpVectors(position,goal,i/12);const x=test.x,y=test.y,z=test.z;confine(test,.18);if(Math.hypot(test.x-x,test.y-y,test.z-z)>.05)break;last.copy(test);}
    return last;
  }
  let initialized=false;
  function update(time,dt,position,yaw,orbitPitch,flight,mission){
    const hitAge=time-hitAt;haloUniforms.strength.value=hitAge>=0&&hitAge<.9?(1-hitAge/.9)*(.8+.2*Math.sin(hitAge*24)):0;hitHalo.visible=haloUniforms.strength.value>0;
    lamp.intensity=mission.lampState==='working'?38:0;spill.intensity=mission.lampState==='working'?.8:0;bulb.visible=mission.lampState==='working';
    rig.position.copy(position);rig.rotation.set(flight.pitch,yaw,flight.roll,'YXZ');payload.visible=mission.payload;
    const emotion=mission.integrity<=3?'Emotion_Alarm':mission.hits>0?'Emotion_Worried':!mission.payload?'Emotion_Determined':'Emotion_Neutral';
    if(emotion!==face){if(face)actions.get(face)?.stop();actions.get(emotion)?.play();face=emotion;}
    actions.get('Rotor_Cycle')?.setEffectiveTimeScale(1+Math.hypot(flight.velocity.x,flight.velocity.y,flight.velocity.z)*.055);mixer.update(Math.max(0,dt));
    back.set(Math.sin(yaw)*Math.cos(orbitPitch),-Math.sin(orbitPitch),Math.cos(yaw)*Math.cos(orbitPitch));
    desired.copy(position).addScaledVector(back,4.9);desired.y+=.5;
    // Shorten the boom where it would pass through the cave wall.
    desired.copy(clipBoom(position,desired));
    if(desired.distanceTo(position)<1.8){
      best.copy(desired);
      for(const turn of [0,.8,-.8,1.6,-1.6]){
        candidate.set(Math.sin(yaw+turn)*4,-1.1,Math.cos(yaw+turn)*4).add(position);const result=clipBoom(position,candidate);
        if(result.distanceTo(position)>best.distanceTo(position))best.copy(result);
      }
      desired.copy(best);
    }
    if(!initialized){camera.position.copy(desired);initialized=true;}else camera.position.lerp(desired,1-Math.exp(-dt*10));
    const before=camera.position.clone();confine(camera.position,.18);if(before.distanceTo(camera.position)>1)camera.position.copy(desired);
    target.copy(position);target.y+=.25;camera.lookAt(target);
  }
  function reset(){hitAt=-100;hitHalo.visible=false;haloUniforms.strength.value=0;initialized=false;face=null;mixer.setTime(0);}
  return {rig,update,reset,flashHit,stats:()=>({isaoModel:'isao_birudoron_lod1',rotorClip:actions.has('Rotor_Cycle'),rotorRotation:gltf.scene.getObjectByName('ROTOR_FL_SPIN')?.quaternion.toArray(),cameraDistance:camera.position.distanceTo(rig.position),lampIntensity:lamp.intensity,hitHaloVisible:hitHalo.visible,hitHaloStrength:haloUniforms.strength.value})};
}
