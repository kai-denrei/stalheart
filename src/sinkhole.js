import { createBreachWalls } from './breach-walls.js';
import { LOOKS } from './looks.js';
import { createBreachSurface } from './breach-surface.js';
import { createBreachEnemies } from './breach-enemies.js';
import { makeSinkholeTerrain } from './sinkhole-terrain.js';
import { SINKHOLE_BOUNDARY_GLSL,sinkholeGroundHeight } from './core/sinkhole-shape.js';
import { makeAudio } from './audio.js';
import { BREACH_SOUNDS } from './content/breach-defaults.js';
import * as THREE from '../vendor/three.module.js';
import { settings } from './fx/sinkhole/config/settings.js';
import { frame } from './fx/sinkhole/core/FrameUniforms.js';
import { ParticleEngine } from './fx/sinkhole/particles/ParticleEngine.js';
import { LightPool } from './fx/sinkhole/effects/LightPool.js';
import { DecalSystem } from './fx/sinkhole/effects/GroundDecals.js';
import { CameraShake } from './fx/sinkhole/effects/CameraShake.js';
import { patchOnBeforeCompile } from './fx/sinkhole/utils/shaderPatch.js';
import { MonolithRiftAbility } from './fx/sinkhole/abilities/MonolithRiftAbility.js';
import { getStoneTextures } from './fx/sinkhole/loaders/StoneTextures.js';

// One casterless event, reused on retrigger. No monoliths, no distortion pass.
export function createSinkhole(scene,camera){
  const group=new THREE.Group();group.name='Sinkhole';scene.add(group);group.visible=false;
  const hole={value:0},collapse={value:0},radius={value:14};
  const surface=createBreachSurface(radius);
  const sound=makeAudio({sounds:BREACH_SOUNDS,persist:false});sound.arm();
  let soundGeneration=0;
  const rig={shakeOffset:new THREE.Vector3(),shakeRoll:0};
  const ctx={scene:group,camera,environment:{registerShadowCasterWithPatch:patchOnBeforeCompile,groundHeightAt:(x,z)=>sinkholeGroundHeight(x,z,hole.value)},
    particles:new ParticleEngine(group),lights:new LightPool(group),decals:new DecalSystem(group),
    shake:new CameraShake(rig),flash:{trigger(){}}};
  const ability=new MonolithRiftAbility(ctx);group.add(ability.group);ability.group.visible=false;
  // The reference plate fractures upward. This host adds central subsidence
  // after fracture; the deepest pieces pass below the cavity's dark bottom.
  patchOnBeforeCompile(ability.crater.material,shader=>{
    shader.uniforms.uSinkholeCollapse=collapse;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uSinkholeCollapse;')
      .replace('#include <project_vertex>','transformed.y-=uSinkholeCollapse*max(0.3,pow(max(0.0,1.0-length(aCell.xy)),0.65));\n#include <project_vertex>');
  },'sinkhole-subsidence-r160-v1');
  const terrain=makeSinkholeTerrain(hole,radius);group.add(terrain.group);
  const enemies=createBreachEnemies(group);
  const walls=createBreachWalls(group);
  const scars=ability.fissures.material;
  scars.uniforms.uHoleRadius=hole;
  scars.fragmentShader=`uniform float uHoleRadius;\n${SINKHOLE_BOUNDARY_GLSL}\n`+scars.fragmentShader.replace('void main() {','void main() {\nif(length(vWorld.xz)<uHoleRadius*sinkholeRim(atan(vWorld.z,vWorld.x))+.025)discard;');
  let time=0,lead=-1,opened=false,disposed=false,waveConfig=null;
  const tune={look:'textured',walls:true,wallHeight:1.2,clearRadius:6,crackLength:5,preRoll:1.6,sound:true,...settings.quake,fissureLife:600,environment:'planet',planetRadius:14,spawnWaves:true,kind:'mixed',waves:3,count:8,spacing:.45,gap:3,delay:2,emerge:1.2,speed:1.3};
  function reset(){enemies.reset();soundGeneration++;sound.panic();ability.destroy();ctx.particles.reset();ctx.lights.reset();ctx.decals.clear();hole.value=0;collapse.value=0;lead=-1;opened=false;ctx.shake.trauma=0;rig.shakeOffset.set(0,0,0);rig.shakeRoll=0;terrain.update();walls.update(tune,-1);}
  function trigger(){if(disposed||getStoneTextures().state.loaded<4)return;reset();waveConfig={...tune};lead=0;const generation=soundGeneration;
    sound.whenReady(()=>{if(!disposed&&generation===soundGeneration&&tune.sound)sound.play('sinkhole_quake');});}
  terrain.update();surface.wrap(group);
  return {group,tune,trigger,reset,rig,setSound(on){tune.sound=on;if(!on)sound.panic();},
    ready:()=>getStoneTextures().state.loaded===4,
    update(dt){if(disposed||!group.visible)return;
      radius.value=tune.environment==='planet'?tune.planetRadius:0;
      time+=dt;frame.uTime.value=time;frame.uDelta.value=dt;frame.uCameraNear.value=camera.near;frame.uCameraFar.value=camera.far;
      const look=LOOKS[tune.look];
      scene.background.set(look?.bg??0x04070d);terrain.setLook(tune.look);
      Object.assign(settings.quake,tune,{stoneCount:0,blastShare:0,fissureRadius:tune.craterRadius+tune.crackLength});
      if(look){settings.quake.colorFissureLip='#'+new THREE.Color(look.edges.color).getHexString();settings.quake.fissureLip=.85;}
      const settling=Math.exp(-Math.max(0,ability.impactTime-1.5)*1.5);
      settings.quake.settleDust=tune.settleDust*settling;settings.quake.moteRate=tune.moteRate*settling;
      if(lead>=0&&!opened){lead+=dt;ctx.shake.rumble(.02+.10*Math.min(1,lead/Math.max(.01,tune.preRoll)),dt);
        if(lead>=tune.preRoll){ability.spawn(new THREE.Vector3(0,0,-.1),new THREE.Vector3(0,0,1),.1);opened=true;}}
      ability.update(dt);ctx.particles.flush();ctx.decals.update(dt);ctx.lights.update(dt);ctx.shake.update(dt);
      collapse.value=opened?4*Math.min(1,Math.max(0,ability.impactTime-.25)/1.25):0;
      if(opened)hole.value=Math.min(tune.craterRadius,Math.max(0,ability.impactTime)*tune.plateGrowth);
      terrain.update();walls.update(tune,opened?ability.impactTime:-1);
      if(opened&&waveConfig?.spawnWaves)enemies.update(dt,waveConfig,hole.value,radius.value,time);
      surface.wrap(group);
      if(opened&&ability.impactTime>=1.5)ability.crater.mesh.visible=false;
    },
    state:()=>({look:tune.look,walls:walls.state(),crackWidth:tune.fissureWidth,crackLength:tune.crackLength,environment:tune.environment,planetRadius:radius.value,enemies:enemies.state(),ready:getStoneTextures().state.loaded===4,phase:opened?'open':lead>=0?'rumbling':'idle',holeRadius:hole.value,
      openingAge:ability.impactTime,collapse:collapse.value,slopeVisible:hole.value>0,audioVoices:sound.voices,audioState:sound.contextState,stones:ability._activeCount,particles:ctx.particles.systems.size,craterVisible:ability.crater.mesh.visible,time,disposed}),
    dispose(){if(disposed)return;reset();disposed=true;ability.dispose();ctx.particles.dispose();ctx.decals.dispose();ctx.lights.dispose();
      terrain.dispose();walls.dispose();enemies.dispose();sound.dispose();scene.remove(group);},
  };
}
