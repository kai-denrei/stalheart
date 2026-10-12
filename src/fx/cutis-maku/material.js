// Ported from Jelly-Baby src/cutis/creature/material.ts (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), types stripped; the GLSL comes from ./shaders.js.
// Changes from the kit: the core is transparent too (the dying creature fades); uPlanetR; each material carries an `emissive` Color and `emissiveIntensity` and binds the same Color as uHeat, so src/fx/thermal-heat.js's heatMaterial works on it unchanged; createShadowMaterial.
import * as THREE from '../../../vendor/three.module.js';
import { MEMBRANE_VERT, MEMBRANE_FRAG, SHADOW_VERT, SHADOW_FRAG } from './shaders.js';
import { CUTIS_PALETTES } from './config.js';

export function createMembraneMaterial(config,core=false,low=false) {
  const palettes=Object.values(CUTIS_PALETTES),emissive=new THREE.Color(0,0,0);
  const material=new THREE.ShaderMaterial({vertexShader:MEMBRANE_VERT,fragmentShader:MEMBRANE_FRAG,transparent:true,depthWrite:core,side:core||low?THREE.FrontSide:THREE.DoubleSide,uniforms:{
    uMulticolored:{value:0},uPaletteSkin:{value:palettes.map(p=>new THREE.Color(p.skinTint))},uPaletteVein:{value:palettes.map(p=>new THREE.Color(p.veinTint))},uPaletteGlow:{value:palettes.map(p=>new THREE.Color(p.pulseTint))},
    uSeekSweep:{value:config.seekSweep},uSeekRate:{value:config.seekRate},uAcceleration:{value:config.transferAcceleration},uTime:{value:0},uRadius:{value:config.r0},uNoise:{value:config.noiseAmp},uBreath:{value:config.breathRate},uRestCube:{value:config.cubenessRest},uCap:{value:config.capAngle},uNeck:{value:config.neckThin},uDelay:{value:config.delaySpread},uCore:{value:core?1:0},uForceCube:{value:0},uPulse:{value:config.pulseSpeed},uVeinWidth:{value:config.veinWidth},uSkin:{value:new THREE.Color(config.skinTint)},uVein:{value:new THREE.Color(config.veinTint)},uGlow:{value:new THREE.Color(config.pulseTint)},uDebug:{value:0},uLow:{value:low?1:0},
    uPlanetR:{value:0},uHeat:{value:emissive},
  }});
  material.forceSinglePass=low||core;
  material.emissive=emissive;material.emissiveIntensity=1;
  return material;
}
export function updateMaterial(material,config,time,debug=0,force=false,multicolored=false) {
  const u=material.uniforms;u.uMulticolored.value=multicolored?1:0;u.uSeekSweep.value=config.seekSweep;u.uSeekRate.value=config.seekRate;u.uAcceleration.value=config.transferAcceleration;u.uTime.value=time;u.uRadius.value=config.r0;u.uNoise.value=config.noiseAmp;u.uBreath.value=config.breathRate;u.uRestCube.value=config.cubenessRest;u.uCap.value=config.capAngle;u.uNeck.value=config.neckThin;u.uDelay.value=config.delaySpread;u.uPulse.value=config.pulseSpeed;u.uVeinWidth.value=config.veinWidth;u.uSkin.value.setHex(config.skinTint);u.uVein.value.setHex(config.veinTint);u.uGlow.value.setHex(config.pulseTint);u.uDebug.value=debug;u.uForceCube.value=force?1:0;
}
/** The contact shadow's material; its plane is laid out by geometry.js (instanceMatrix places and sizes it, iFade fades it). */
export function createShadowMaterial() {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexShader:SHADOW_VERT,fragmentShader:SHADOW_FRAG,uniforms:{uPlanetR:{value:0}}});
  material.polygonOffset=true;material.polygonOffsetFactor=-2;material.polygonOffsetUnits=-2;
  return material;
}
