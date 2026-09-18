import { createBreachRubble } from './breach-rubble.js';
import * as THREE from '../vendor/three.module.js';
import { createSinkhole } from './sinkhole.js';
import { CONTENT } from './content/runtime.js';
import { BREACH_SURFACE_GLSL } from './core/breach-surface.js';
import { SINKHOLE_BOUNDARY_GLSL } from './core/sinkhole-shape.js';

// Game owns walls, navigation, wave counts and health. This adapter owns ground visuals.
// `look` (optional getter): the game's visual identity (params.look), re-read on create and every update so a sinkhole
// wears the board's look (Battlezone, TRON...) instead of CONTENT.breach's textured stone. `makeSinkhole` is a test seam.
export function createGameBreaches(scene,camera,sounds,{look=null,makeSinkhole=createSinkhole}={}){
 const entries=new Set(),limit=32,matrices={value:Array.from({length:limit},()=>new THREE.Matrix4())},holes={value:Array(limit).fill(0)},count={value:0},radius={value:1};
 const rubble=createBreachRubble(scene);
 let clock=0;const patched=new WeakSet();
 // THE SHADERS BEFORE THE FIRST BREACH. The frame the ground first opened linked every sinkhole program the game had
 // not drawn yet (the crater's stone, the fissures, the particle systems, the decals) and uploaded the four stone
 // maps: 100 ms at dpr 1, 148 ms at dpr 2, on the shot's own cut (2026-09-18 dive profile). One hidden template
 // sinkhole, built at boot and never triggered, links them all through the warmer (src/fx/shader-warm.js) and, once
 // the maps have arrived, uploads one per frame from update(). It is kept for the run: three frees a program with its
 // last material, so the template's materials are what hold the cache.
 let template=null,warmer=null;const uploads=[];
 function sync(){let i=0;for(const e of entries){if(i===limit)break;matrices.value[i].copy(e.fx.inverseFrame.value);holes.value[i]=e.fx.hole.value;i++;}count.value=i;}
 return {
  create(normal,forward,scale){
   if(entries.size>=limit)throw Error('Ground breach capacity exceeded');
   const fx=makeSinkhole(scene,camera,{game:true,sounds}),obj=fx.group;
   const up=new THREE.Vector3(...normal).normalize(),z=new THREE.Vector3(...forward).projectOnPlane(up).normalize();
   if(z.lengthSq()<.1)z.set(1,0,0).projectOnPlane(up).normalize();
   const x=new THREE.Vector3().crossVectors(up,z).normalize();z.crossVectors(x,up);
   obj.position.copy(up);obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));obj.rotateY(1-Math.PI/2);obj.scale.setScalar(scale);obj.visible=true;
   Object.assign(fx.tune,CONTENT.breach,{planetRadius:1/scale,spawnWaves:false,sound:false});if(look)fx.tune.look=look();radius.value=1/scale;
   const entry={fx,obj,age:0,started:false,cleared:false,pending:true};entries.add(entry);
   obj.userData.breach=entry;obj.userData.grounded=true;obj.userData.sizeScale=scale;obj.userData.tick=()=>{};
   obj.userData.dispose=()=>{entries.delete(entry);fx.dispose();sync();};
   return obj;
  },
  seal(obj){const e=obj.userData.breach;if(!e||!entries.has(e))return false;rubble.add(obj,e.fx.tune.craterRadius);obj.userData.dispose();return true;},
  rubbleState:()=>rubble.state(),
  craters:()=>[...entries].map(e=>({p:e.obj.position.toArray(),r:e.fx.tune.craterRadius})),   // where the ground is open, and how wide: the hull may not drive onto it
  warm(w){if(template)return;warmer=w;template=makeSinkhole(scene,camera,{game:true,sounds});Object.assign(template.tune,CONTENT.breach,{spawnWaves:false,sound:false});if(look)template.tune.look=look();
   template.group.visible=true;template.update(0,0);template.group.visible=false;uploads.push(...template.textures());return template.warm(warmer);},   // one update dresses the template as create()+update() would (look, wraps) before its materials compile
  update(dt,onClear,onOpen=()=>{}){clock+=dt;const opened=[];rubble.update(dt);   // sealed caps pile up over breach-rubble's SETTLE_S
   if(uploads.length&&template.ready())warmer.upload(uploads.shift());
   for(const e of entries){
    if(dt>0&&e.pending&&e.fx.ready()){e.pending=false;e.started=true;e.fx.trigger();opened.push(e.obj);}
    if(e.started)e.age+=dt;
    if(look)e.fx.tune.look=look();   // the sinkhole setLook returns early when unchanged
    e.fx.update(dt,clock);
    if(e.started&&!e.cleared&&e.age>=e.fx.tune.preRoll){e.cleared=true;onClear(e.obj);}
   }sync();if(opened.length)onOpen(opened);
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
  state:()=>[...entries].map(e=>{let materialPeak=0;e.obj.traverse(o=>{if(o.material?.color)materialPeak=Math.max(materialPeak,o.material.color.r,o.material.color.g,o.material.color.b);});return {...e.fx.state(),materialPeak,age:e.age,cleared:e.cleared,ready:e.started&&e.age>=e.fx.tune.duration};}),
  reset(){for(const e of [...entries])e.obj.userData.dispose();rubble.reset();sync();},
  dispose(){for(const e of [...entries])e.obj.userData.dispose();rubble.dispose();sync();template?.dispose();template=null;uploads.length=0;},
 };
}
