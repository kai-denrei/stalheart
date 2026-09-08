import * as THREE from '../vendor/three.module.js';
import { createSinkhole } from './sinkhole.js';
import { CONTENT } from './content/runtime.js';
import { BREACH_SURFACE_GLSL } from './core/breach-surface.js';
import { SINKHOLE_BOUNDARY_GLSL } from './core/sinkhole-shape.js';

// Game owns walls, navigation, wave counts and health. This adapter owns ground visuals.
export function createGameBreaches(scene,camera,sounds){
 const entries=new Set(),limit=32,matrices={value:Array.from({length:limit},()=>new THREE.Matrix4())},holes={value:Array(limit).fill(0)},count={value:0},radius={value:1};
 let clock=0;const patched=new WeakSet();
 function sync(){let i=0;for(const e of entries){if(i===limit)break;matrices.value[i].copy(e.fx.inverseFrame.value);holes.value[i]=e.fx.hole.value;i++;}count.value=i;}
 return {
  create(normal,forward,scale){
   if(entries.size>=limit)throw Error('Ground breach capacity exceeded');
   const fx=createSinkhole(scene,camera,{game:true,sounds}),obj=fx.group;
   const up=new THREE.Vector3(...normal).normalize(),z=new THREE.Vector3(...forward).projectOnPlane(up).normalize();
   if(z.lengthSq()<.1)z.set(1,0,0).projectOnPlane(up).normalize();
   const x=new THREE.Vector3().crossVectors(up,z).normalize();z.crossVectors(x,up);
   obj.position.copy(up);obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));obj.rotateY(1-Math.PI/2);obj.scale.setScalar(scale);obj.visible=true;
   Object.assign(fx.tune,CONTENT.breach,{planetRadius:1/scale,spawnWaves:false,sound:false});radius.value=1/scale;
   const entry={fx,obj,age:0,started:false,cleared:false,pending:true};entries.add(entry);
   obj.userData.breach=entry;obj.userData.grounded=true;obj.userData.sizeScale=scale;obj.userData.tick=()=>{};
   obj.userData.dispose=()=>{entries.delete(entry);fx.dispose();sync();};
   return obj;
  },
  trigger(obj){const e=obj.userData.breach;if(!e)return;e.pending=true;e.started=false;e.age=0;e.cleared=false;e.fx.reset();},
  update(dt,onClear){clock+=dt;
   for(const e of entries){
    if(e.pending&&e.fx.ready()){e.pending=false;e.started=true;e.fx.trigger();}
    if(e.started)e.age+=dt;
    e.fx.update(dt,clock);
    if(e.started&&!e.cleared&&e.age>=e.fx.tune.preRoll){e.cleared=true;onClear(e.obj);}
   }sync();
  },
  ready(obj){const e=obj.userData.breach;return !e||e.started&&e.age>=e.fx.tune.duration;},
  patch(material){if(patched.has(material))return;patched.add(material);const previous=material.onBeforeCompile;
   material.onBeforeCompile=function(shader,...args){previous.call(this,shader,...args);
    Object.assign(shader.uniforms,{uBreachInverseFrames:matrices,uBreachHoles:holes,uBreachCount:count,uBreachRadius:radius});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBreachGround;').replace('#include <project_vertex>','vBreachGround=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vBreachGround;uniform int uBreachCount;uniform mat4 uBreachInverseFrames[${limit}];uniform float uBreachHoles[${limit}];\n${BREACH_SURFACE_GLSL}\n${SINKHOLE_BOUNDARY_GLSL}`)
     .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nfor(int i=0;i<${limit};i++){if(i>=uBreachCount)break;vec3 p=breachUnwrap((uBreachInverseFrames[i]*vec4(vBreachGround,1.0)).xyz);if(length(p.xz)<uBreachHoles[i]*sinkholeRim(atan(p.z,p.x)))discard;}`);
   };material.customProgramCacheKey=()=> 'game-breach-ground-v1';material.needsUpdate=true;
  },
  state:()=>[...entries].map(e=>{let materialPeak=0;e.obj.traverse(o=>{if(o.material?.color)materialPeak=Math.max(materialPeak,o.material.color.r,o.material.color.g,o.material.color.b);});return {materialPeak,age:e.age,cleared:e.cleared,ready:e.started&&e.age>=e.fx.tune.duration,...e.fx.state()};}),
  reset(){for(const e of [...entries])e.obj.userData.dispose();sync();},
 };
}
