// Ported from lab-creatures src/monster/appearance.ts (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.
// Rewritten for WebGL: r160 has no MeshPhysicalNodeMaterial, so the TSL transmissionNode (1-(1-smoothstep(.016,.040,|positionWorld.xz-center.xz|))*coverage)*.65 becomes a per-vertex transmissionMask written on the CPU in update() and multiplied into material.transmission by an onBeforeCompile patch; the function takes the look and returns { mesh, update }.
import * as THREE from '../../../vendor/three.module.js';
import { tissueColors } from './skin.js';

const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const MASKED_TRANSMISSION='material.transmission = transmission * vTransmissionMask;';
/** r160's physical shader with material.transmission scaled by the per-vertex transmissionMask attribute. */
function maskTransmission(material){
  material.onBeforeCompile=(shader)=>{
    const fragment=THREE.ShaderChunk.transmission_fragment.replace('material.transmission = transmission;',MASKED_TRANSMISSION);
    if(!fragment.includes(MASKED_TRANSMISSION))throw new Error('Nih-Dairia transmission patch: r160 transmission_fragment changed');
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nattribute float transmissionMask;\nvarying float vTransmissionMask;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTransmissionMask = transmissionMask;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vTransmissionMask;')
      .replace('#include <transmission_fragment>',fragment);
  };
  material.customProgramCacheKey=()=>'nih-dairia-transmission-mask';
}

export function createMonsterAppearance(body,feeding,look){
  const geometry=body.surface.geometry;
  geometry.setAttribute('color',new THREE.BufferAttribute(tissueColors(body.surface.positions,body.cage.limbCount??6),3));
  const mask=new THREE.BufferAttribute(new Float32Array(body.surface.positions.length/3).fill(1),1);
  mask.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('transmissionMask',mask);
  const material=new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:look.roughness,metalness:look.metalness,transmission:look.transmission,thickness:look.thickness,ior:look.ior,
    attenuationColor:look.attenuationColor,attenuationDistance:look.attenuationDistance,clearcoat:look.clearcoat,clearcoatRoughness:look.clearcoatRoughness,side:THREE.DoubleSide});
  maskTransmission(material);
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;
  // Vertices whose mask was last written below 1; restored once when the coverage returns to 0.
  const touched=[];
  function update(){
    if(!feeding)return;
    const coverage=feeding.skinCoverage*(feeding.phase==='recovering'?feeding.drop:1),m=mask.array;
    if(coverage<=0){
      if(!touched.length)return;
      for(const i of touched)m[i]=1;
      touched.length=0;mask.needsUpdate=true;return;
    }
    const p=body.surface.positions,center=feeding.capturedPosition;
    for(const i of touched)m[i]=1;
    touched.length=0;
    for(let i=0,j=0;j<p.length;i++,j+=3){
      const skin=smoothstep(.016,.040,Math.hypot(p[j]-center.x,p[j+2]-center.z));
      if(skin>=1)continue;
      m[i]=1-(1-skin)*coverage;touched.push(i);
    }
    mask.needsUpdate=true;
  }
  return {mesh,update};
}
