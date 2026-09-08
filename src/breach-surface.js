import * as THREE from '../vendor/three.module.js';
import { BREACH_SURFACE_GLSL } from './core/breach-surface.js';
import { patchOnBeforeCompile } from './fx/sinkhole/utils/shaderPatch.js';
// Patch presentation after its own shader deformation. Simulation stays in arc metres.
export function createBreachSurface(radius){
 const patched=new WeakSet();
 const project=THREE.ShaderChunk.project_vertex.replace('mvPosition = modelViewMatrix * mvPosition;','mvPosition = viewMatrix * vec4(breachWrap((modelMatrix * mvPosition).xyz),1.0);');
 function patch(shader){
  shader.uniforms.uBreachRadius=radius;
  let v=shader.vertexShader;
  v=BREACH_SURFACE_GLSL+'\n'+v;
  v=v.replace('#include <project_vertex>',project)
   .replace('vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);','vec4 mvPosition = viewMatrix * vec4(breachWrap((modelMatrix*vec4(pos,1.0)).xyz),1.0);')
   .replace('gl_Position = projectionMatrix * viewMatrix * world;','gl_Position = projectionMatrix * viewMatrix * vec4(breachWrap(world.xyz),1.0);')
   .replace('gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);','gl_Position = projectionMatrix * viewMatrix * vec4(breachWrap((modelMatrix*vec4(position,1.0)).xyz),1.0);');
  v=v.replace('#include <defaultnormal_vertex>',`#include <defaultnormal_vertex>
   vec4 breachAnchor=vec4(position,1.0);
   #ifdef USE_INSTANCING
    breachAnchor=instanceMatrix*breachAnchor;
   #endif
   breachAnchor=modelMatrix*breachAnchor;
   transformedNormal=mat3(viewMatrix)*breachRotate(inverseTransformDirection(transformedNormal,viewMatrix),breachAnchor.xyz);`);
  shader.vertexShader=v;
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
