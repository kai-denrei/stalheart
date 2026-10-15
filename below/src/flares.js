import * as THREE from '../vendor/three.module.js';
import {FLARE_COUNT} from './mission.js';
import {createFlareBody,stepFlare} from './flare-physics.js';

export function createFlares(scene,uniforms){
  const flares=[];
  for(let i=0;i<FLARE_COUNT;i++){
    const group=new THREE.Group();scene.add(group);group.visible=false;
    const core=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.38,8),new THREE.MeshBasicMaterial({color:0xff4433,fog:false}));core.rotation.z=.5;group.add(core);
    const halo=new THREE.Mesh(new THREE.PlaneGeometry(2.2,2.2),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{strength:{value:1}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec2 vUv;uniform float strength;void main(){float d=length(vUv-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(1.,.055,.02,exp(-d*5.)*strength);}' }));group.add(halo);
    const light=new THREE.PointLight(0xff2116,0,16,1.3);scene.add(light);
    flares.push({group,halo,light,active:false,body:null,lastTime:0});
  }
  function drop(position,time,heading){
    const flare=flares.find(f=>!f.active);if(!flare)return false;
    flare.active=true;flare.body=createFlareBody(position,heading);flare.lastTime=time;
    flare.group.position.copy(flare.body.position);
    flare.group.visible=true;return true;
  }
  function update(time,camera){
    for(let i=0;i<flares.length;i++){
      const f=flares[i];if(!f.active)continue;
      stepFlare(f.body,Math.max(0,time-f.lastTime));f.lastTime=time;
      f.group.position.copy(f.body.position);
      if(!f.body.resting){f.group.children[0].rotation.x=time*4+i;f.group.children[0].rotation.z=time*2.7+i;}
      f.halo.quaternion.copy(camera.quaternion);const flicker=.88+.09*Math.sin(time*17+i)+.03*Math.sin(time*31+i);
      f.halo.material.uniforms.strength.value=flicker;f.light.position.copy(f.group.position);f.light.intensity=55*flicker;
      uniforms.uFlarePositions.value[i].copy(f.group.position);uniforms.uFlareStrengths.value[i]=flicker;
    }
  }
  function reset(){for(let i=0;i<flares.length;i++){const f=flares[i];f.active=false;f.group.visible=false;f.light.intensity=0;uniforms.uFlareStrengths.value[i]=0;}}
  return {drop,update,reset,stats:()=>flares.filter(f=>f.active).map(f=>({position:f.group.position.toArray(),velocity:[f.body.velocity.x,f.body.velocity.y,f.body.velocity.z],resting:f.body.resting}))};
}
