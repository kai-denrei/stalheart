import * as THREE from '../vendor/three.module.js';
import {FLARE_COUNT,FLARE_SLOTS} from './mission.js';
import {createFlareBody,stepFlare} from './flare-physics.js';

// a stuck flare's stick lies on the rock (its axis across the surface normal) and its light stands LIGHT_LIFT metres off the face, so it lights the passage
// out from the surface rather than half into it (2026-10-26); the light's radius (16 m) and the flare's life (the whole trip) are unchanged
// THE GREEN FLARE (owner, 2026-11-02, note 11: "a GREEN flare pre-dropped close to the entrance/exit"): one more slot after the fifteen red ones, never
// spent by F: left at the start beside ISAO (beacon(position, time)), resting on the rubble or the throat's floor, it marks the way out. Same physics,
// light radius and life as the red ones; only the colour differs
export const BEACON=Object.freeze({core:0x55ff77,light:0x22ff55,halo:[.06,1,.16],offset:{x:1.6,y:0,z:0},glow:.25});   // glow: its light's share of a red flare's (it marks the way, it does not flood the throat green)
const RED=Object.freeze({core:0xff4433,light:0xff2116,halo:[1,.055,.02]});
const LIGHT_LIFT=.3,UP=new THREE.Vector3(0,1,0),SIDE=new THREE.Vector3(1,0,0),normal=new THREE.Vector3(),across=new THREE.Vector3();

export function createFlares(scene,uniforms,rock=undefined){   // rock: the clearance the flares fall against (flare-physics.js caveClearance by default)
  const flares=[];
  for(let i=0;i<FLARE_SLOTS;i++){
    const look=i<FLARE_COUNT?RED:BEACON;
    const group=new THREE.Group();scene.add(group);group.visible=false;
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.38,8),new THREE.MeshBasicMaterial({color:look.core,fog:false}));core.rotation.z=.5;group.add(core);
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:1},tint:{value:new THREE.Vector3(...look.halo)}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;uniform vec3 tint;void main(){float d=length(vUv-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,exp(-d*5.)*strength);}' }));group.add(halo);
    const light=new THREE.PointLight(look.light,0,16,1.3);scene.add(light);
    flares.push({group,halo,light,active:false,body:null,lastTime:0,laid:false,green:look===BEACON});
  }
  function drop(position,time,heading,flare=flares.find(f=>!f.active&&!f.green)){
    if(!flare||flare.active)return false;
    flare.active=true;flare.body=createFlareBody(position,heading);flare.lastTime=time;flare.laid=false;flare.halo.position.set(0,0,0);flare.group.children[0].quaternion.identity();
    flare.group.position.copy(flare.body.position);
    flare.group.visible=true;return true;
  }
  function update(time,camera){
    for(let i=0;i<flares.length;i++){
      const f=flares[i];if(!f.active)continue;
      stepFlare(f.body,Math.max(0,time-f.lastTime),rock);f.lastTime=time;
      f.group.position.copy(f.body.position);
      const core=f.group.children[0],n=f.body.normal;
      if(!f.body.resting){core.rotation.x=time*4+i;core.rotation.z=time*2.7+i;}
      else if(!f.laid&&n){f.laid=true;normal.set(n.x,n.y,n.z);across.crossVectors(normal,Math.abs(normal.y)<.9?UP:SIDE).normalize();core.quaternion.setFromUnitVectors(UP,across);f.halo.position.copy(normal).multiplyScalar(LIGHT_LIFT);}
      f.halo.quaternion.copy(camera.quaternion);const flicker=.88+.09*Math.sin(time*17+i)+.03*Math.sin(time*31+i);
      f.halo.material.uniforms.strength.value=flicker;f.light.position.copy(f.group.position);if(f.body.resting&&n)f.light.position.addScaledVector(normal.set(n.x,n.y,n.z),LIGHT_LIFT);f.light.intensity=55*flicker*(f.green?BEACON.glow:1);
      uniforms.uFlarePositions.value[i].copy(f.group.position);uniforms.uFlareStrengths.value[i]=flicker;
    }
  }
  function reset(){for(let i=0;i<flares.length;i++){const f=flares[i];f.active=false;f.group.visible=false;f.light.intensity=0;uniforms.uFlareStrengths.value[i]=0;}}
  // the green one: at `position` (the start, beside ISAO), falling to the rock like the rest
  const beacon=(position,time)=>drop(position,time,0,flares[FLARE_COUNT]);
  return {drop:(position,time,heading)=>drop(position,time,heading),beacon,update,reset,stats:()=>flares.filter(f=>f.active).map(f=>({position:f.group.position.toArray(),velocity:[f.body.velocity.x,f.body.velocity.y,f.body.velocity.z],resting:f.body.resting,green:f.green,normal:f.body.normal?[f.body.normal.x,f.body.normal.y,f.body.normal.z]:null}))};
}
