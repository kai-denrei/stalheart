import * as THREE from '../vendor/three.module.js';
import { BREACH_SURFACE_GLSL } from './core/breach-surface.js';
import { patchOnBeforeCompile } from './fx/sinkhole/utils/shaderPatch.js';
// Patch presentation after its own shader deformation. Simulation stays in arc metres.
export function createBreachSurface(radius,frameMatrix={value:new THREE.Matrix4()},inverseFrame={value:new THREE.Matrix4()}){
 const patched=new WeakSet();
 const project=THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;','mvPosition = viewMatrix * vec4(breachWorld((modelMatrix * mvPosition).xyz),1.0);');
 function patch(shader){
  shader.uniforms.uBreachRadius=radius;shader.uniforms.uBreachFrame=frameMatrix;shader.uniforms.uBreachInverse=inverseFrame;
  let v=shader.vertexShader;
  v=BREACH_SURFACE_GLSL+'\nuniform mat4 uBreachFrame;uniform mat4 uBreachInverse;vec3 breachWorld(vec3 p){return (uBreachFrame*vec4(breachWrap((uBreachInverse*vec4(p,1.0)).xyz),1.0)).xyz;}\n'+v;
  v=v.replace('#include <project_vertex>',project)
   .replace('vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);','vec4 mvPosition = viewMatrix * vec4(breachWorld((modelMatrix*vec4(pos,1.0)).xyz),1.0);')
   .replace('gl_Position = projectionMatrix * viewMatrix * world;','gl_Position = projectionMatrix * viewMatrix * vec4(breachWorld(world.xyz),1.0);')
   .replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);','gl_Position = projectionMatrix * viewMatrix * vec4(breachWorld((modelMatrix*vec4(position,1.0)).xyz),1.0);');
  v=v.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
   vec4 breachAnchor=vec4(position,1.0);
   #ifdef USE_INSTANCING
    breachAnchor=instanceMatrix*breachAnchor;
   #endif
   breachAnchor=uBreachInverse*modelMatrix*breachAnchor;
   transformedNormal=mat3(viewMatrix)*mat3(uBreachFrame)*breachRotate(mat3(uBreachInverse)*inverseTransformDirection(transformedNormal,viewMatrix),breachAnchor.xyz);`);
  v=v.replace('mvPosition.xy += corner;','mvPosition.xy += corner * length(uBreachFrame[0].xyz);');
  v=v.replace('vWorld = world.xyz;','vWorld = (uBreachInverse*world).xyz;');shader.vertexShader=v;
 }
 return {wrap(root){root.traverse(o=>{
  if(!o.material||o.userData.breachWorld)return;
  o.frustumCulled=false;
  for(const material of Array.isArray(o.material)?o.material:[o.material]){
   if(patched.has(material))continue;patched.add(material);
   patchOnBeforeCompile(material,patch,'breach-sphere-r160-v1');material.needsUpdate=true;
  }
 });}};
}
