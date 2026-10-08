// Ported from lab-creatures src/monster/prey.ts (kai-denrei, f2a4f89, export of 2026-10-08; derived from Jelly Baby by scottstts; GPL-3.0, see ./LICENSE), types stripped; the solver, the gait, the pursuit and the feeding are unchanged.
// Rewritten for WebGL: r160 has no MeshPhysicalNodeMaterial, so the TSL colorNode mix(red, attribute('skinColor'), coverage) and clearcoatNode coverage*.65 become CPU writes of material.color (lerped towards the mean tissue colour of the prey geometry) and material.clearcoat in update(); createPrey takes the look for the red and the emissive.
// This is the file's mesh half (wrappedGeometry, createPrey); the logic half is prey-shapes.js, re-exported here.
import * as THREE from '../../../vendor/three.module.js';
import { tissueColors } from './skin.js';
import { preyGeometry } from './prey-shapes.js';
export { PREY_SHAPES, preyGeometry, preyImprint, preyClearance } from './prey-shapes.js';

function wrappedGeometry(shape){
  const geometry=preyGeometry(shape);
  geometry.setAttribute('skinColor',new THREE.BufferAttribute(tissueColors(geometry.getAttribute('position').array),3));
  return geometry;
}
/** The mean of the geometry's skinColor attribute: the one colour a uniform material can blend to. */
function meanTissueColor(geometry,target=new THREE.Color()){
  const c=geometry.getAttribute('skinColor'),n=c.count;let r=0,g=0,b=0;
  for(let i=0;i<n;i++){r+=c.getX(i);g+=c.getY(i);b+=c.getZ(i);}
  return target.setRGB(r/n,g/n,b/n);
}
export function createPrey(look){
  const red=new THREE.Color(look.preyRed),tissue=new THREE.Color();
  // One precompiled material blends the original surface into opaque tissue.
  // No transparent overlay, material swap, or geometry shrink during ingestion.
  const material=new THREE.MeshPhysicalMaterial({metalness:.45,roughness:.3,emissive:look.preyEmissive,emissiveIntensity:.2,
    ior:1.37,clearcoatRoughness:.16,color:look.preyRed});
  const mesh=new THREE.Mesh(wrappedGeometry('sphere'),material);meanTissueColor(mesh.geometry,tissue);
  mesh.castShadow=true;mesh.receiveShadow=true;let shape='sphere';
  return {mesh,update(feeding){
    if(shape!==feeding.shape){shape=feeding.shape;mesh.geometry.dispose();mesh.geometry=wrappedGeometry(shape);meanTissueColor(mesh.geometry,tissue);}
    const wrap=feeding.skinCoverage;material.color.lerpColors(red,tissue,wrap);material.clearcoat=.65*wrap;
    material.metalness=.45*(1-wrap);material.roughness=.3-.04*wrap;
    material.emissiveIntensity=.2*(1-wrap);
    mesh.position.copy(feeding.preyPosition);mesh.scale.setScalar(feeding.scale);mesh.visible=feeding.visible;
  }};
}
