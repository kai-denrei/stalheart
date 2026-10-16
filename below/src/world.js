import * as THREE from '../vendor/three.module.js';
import { center, radius, frameAt, ringPoint, tunnelClearance, chamberClearance, lampStrength, ROUTE_END, SHAFT_TOP, CHAMBER_LIP, chamberFloor, smooth, pointSegmentDistance, FLARE_COUNT, exteriorExposure, nearestRoute } from './mission.js';
import {createSinkholeEntrance} from './sinkhole.js';
import {createNursery} from './nursery.js';
import {createCaveNetwork} from './cave.js';
import {createIsao} from './isao.js';
import {createTunnelCreatures} from './creatures.js';
import {createDetonation} from './detonation.js';
import {createFlares} from './flares.js';
import {surveyGLSL} from './lidar.js';
import {MAIN_TENTACLES,LEFT_TENTACLES,BLIND_TENTACLES,colonyPresence,colonyDistance} from './cave-pacing.js';

const TAU=Math.PI*2;
function random(seed=9317){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
const rand=random();
const vec=(p)=>new THREE.Vector3(p.x,p.y,p.z);

export async function createWorld(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  renderer.setSize(innerWidth,innerHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x020504);
  scene.fog=new THREE.FogExp2(0x020504,.035);
  const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,340);
  camera.rotation.order='YXZ';scene.add(camera);const player=new THREE.Vector3();
  const uniforms={uTime:{value:0},uLidar:{value:0},uScanTime:{value:-100},uScanOrigin:{value:new THREE.Vector3()},uScanMode:{value:0},uPreview:{value:0},uLampPosition:{value:new THREE.Vector3()},uLampDirection:{value:new THREE.Vector3()},uLampStrength:{value:0},uFlarePositions:{value:Array.from({length:FLARE_COUNT},()=>new THREE.Vector3())},uFlareStrengths:{value:Array(FLARE_COUNT).fill(0)}};
  const surfaces=[];
  function material(color,roughness=.93,rock=false,bio=0){
    const mat=new THREE.MeshStandardMaterial({color,roughness,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
    mat.onBeforeCompile=shader=>{
      shader.uniforms.uLidar=uniforms.uLidar;shader.uniforms.uFlarePositions=uniforms.uFlarePositions;shader.uniforms.uFlareStrengths=uniforms.uFlareStrengths;
      shader.vertexShader='varying vec3 vFlareWorld;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vec4 flarePosition=vec4(transformed,1.);\n#ifdef USE_INSTANCING\nflarePosition=instanceMatrix*flarePosition;\n#endif\nvFlareWorld=(modelMatrix*flarePosition).xyz;\n#include <project_vertex>');
      shader.fragmentShader='#define FLARE_COUNT '+FLARE_COUNT+'\n'+'uniform float uLidar;uniform vec3 uFlarePositions[FLARE_COUNT];uniform float uFlareStrengths[FLARE_COUNT];varying vec3 vFlareWorld;\n'+shader.fragmentShader;
      if(bio){
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
float bioVein=pow(.5+.5*sin(vFlareWorld.x*7.+sin(vFlareWorld.z*9.)*2.+vFlareWorld.y*5.),20.);totalEmissiveRadiance+=vec3(.20,.46,.30)*${bio.toFixed(4)}*bioVein;`);
      }
      if(rock){
        shader.vertexShader='varying vec3 vRock;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRock=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=`varying vec3 vRock;
          float hashRock(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
          float noiseRock(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hashRock(i),hashRock(i+vec3(1,0,0)),f.x),mix(hashRock(i+vec3(0,1,0)),hashRock(i+vec3(1,1,0)),f.x),f.y),mix(mix(hashRock(i+vec3(0,0,1)),hashRock(i+vec3(1,0,1)),f.x),mix(hashRock(i+vec3(0,1,1)),hashRock(i+vec3(1,1,1)),f.x),f.y),f.z);}
        `+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat strata=noiseRock(vRock*1.8)*.5+noiseRock(vRock*7.)*.3+noiseRock(vRock*23.)*.2;diffuseColor.rgb*=.25+strata*1.25;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(normal+vec3(dFdx(strata),dFdy(strata),0.)*2.);');
      }
      shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n if(uLidar > .5){float light=0.;for(int i=0;i<FLARE_COUNT;i++)light+=uFlareStrengths[i]*(1.-smoothstep(2.,12.,distance(vFlareWorld,uFlarePositions[i])));gl_FragColor.rgb=mix(vec3(.002,.005,.004),gl_FragColor.rgb,clamp(light,0.,1.));}');
    };mat.customProgramCacheKey=()=>`cave:${rock}:${bio}`;return mat;
  }
  const stone=material(0x62675a,.93,true),flesh=material(0x535b43,.55),metal=material(0x55645e,.6);
  const pointMaterial=new THREE.ShaderMaterial({
    uniforms,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
    vertexShader:`
      uniform float uScanMode; uniform float uTime; uniform float uLidar; uniform float uScanTime; uniform vec3 uScanOrigin; uniform float uPreview;
      attribute float aMotion; attribute float aSeed; varying float vMotion; varying float vAlpha; varying float vDistance; varying float vSeed;
      ${surveyGLSL}
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);vec4 view=viewMatrix*world;
        float d=distance(world.xyz,uScanOrigin),sampleTime=floor(uTime*8.);
        float dropout=step(.19,fract(sin(aSeed*794.3+sampleTime*.17)*437.5));
        vAlpha=surveyReturn(world.xyz)*uLidar*dropout*(.6+.4*aSeed);
        vec3 jitter=vec3(sin(aSeed*93.+sampleTime),cos(aSeed*79.+sampleTime),sin(aSeed*41.-sampleTime))*(.018+d*.0012);
        view=viewMatrix*vec4(world.xyz+jitter,1.);
        vDistance=d;vSeed=aSeed;vMotion=aMotion;
        gl_Position=projectionMatrix*view;
        gl_PointSize=clamp((34.+aSeed*17.)/max(1.,-view.z),1.,2.3);
      }`,
    fragmentShader:`
      uniform float uScanMode; uniform float uTime;uniform float uScanTime;uniform vec3 uScanOrigin;
      ${surveyGLSL}
      varying float vMotion;varying float vAlpha;varying float vDistance;varying float vSeed;
      void main(){
        if(vAlpha<.02) discard;
        vec2 c=gl_PointCoord-.5;if(dot(c,c)>.25)discard;
        vec3 col=surveyColor(vDistance,uScanMode,vMotion);
        gl_FragColor=vec4(col*(.85+vSeed*.15),min(.8,vAlpha));
      }`
  });
  function points(geometry,parent=scene,moving=false){
    if(!geometry.getAttribute('aSeed')){const a=new Float32Array(geometry.getAttribute('position').count);for(let i=0;i<a.length;i++)a[i]=rand();geometry.setAttribute('aSeed',new THREE.BufferAttribute(a,1));}
    if(!geometry.getAttribute('aMotion'))geometry.setAttribute('aMotion',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(moving?1:0),1));
    const p=new THREE.Points(geometry,pointMaterial);p.frustumCulled=false;parent.add(p);return p;
  }
  function sample(geometry,count,bound=false){
    const p=geometry.attributes.position,indices=geometry.index?.array;
    const triangles=indices?indices.length/3:p.count/3;
    const areas=new Float64Array(triangles);let area=0;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
    for(let i=0;i<triangles;i++){a.fromBufferAttribute(p,indices?indices[i*3]:i*3);b.fromBufferAttribute(p,indices?indices[i*3+1]:i*3+1);c.fromBufferAttribute(p,indices?indices[i*3+2]:i*3+2);area+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;areas[i]=area;}
    const out=new Float32Array(count*3),ids=bound?new Uint32Array(count*3):null,weights=bound?new Float32Array(count*3):null;
    for(let i=0;i<count;i++){
      const r=rand()*area;let lo=0,hi=triangles-1;while(lo<hi){const mid=(lo+hi)>>1;if(areas[mid]<r)lo=mid+1;else hi=mid;}
      a.fromBufferAttribute(p,indices?indices[lo*3]:lo*3);b.fromBufferAttribute(p,indices?indices[lo*3+1]:lo*3+1);c.fromBufferAttribute(p,indices?indices[lo*3+2]:lo*3+2);
      const u=Math.sqrt(rand()),v=rand();if(bound){for(let j=0;j<3;j++)ids[i*3+j]=indices?indices[lo*3+j]:lo*3+j;weights.set([1-u,u*(1-v),u*v],i*3);}out[i*3]=a.x*(1-u)+b.x*u*(1-v)+c.x*u*v;out[i*3+1]=a.y*(1-u)+b.y*u*(1-v)+c.y*u*v;out[i*3+2]=a.z*(1-u)+b.z*u*(1-v)+c.z*u*v;
    }
    const sampled=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(out,3));if(bound)sampled.userData.binding={ids,weights};return sampled;
  }
  function body(geometry,mat,parent=scene,samples=1500){const mesh=new THREE.Mesh(geometry,mat);parent.add(mesh);surfaces.push(mesh);if(samples)points(sample(geometry,samples),mesh,parent.name.includes('Queen')||parent.name.includes('Cutis'));return mesh;}

  const entrance=createSinkholeEntrance(scene);
  const network=createCaveNetwork({body,stone,scene});
  const nursery=await createNursery({scene,body,points,sample,stone,flesh,rand});
  const flares=createFlares(scene,uniforms);
  const isao=await createIsao(scene,camera);
  const creatures=await createTunnelCreatures({scene,body,points,material,uniforms,camera});

  // Only surface light fades in the throat; darkness below still requires the lamp.
  const surfaceHemi=new THREE.HemisphereLight(0x7097bb,0x0a1018,.9);scene.add(surfaceHemi);
  const surfaceSun=new THREE.DirectionalLight(0xb8d4e1,1.3);surfaceSun.position.set(20,50,10);scene.add(surfaceSun);

  const blast=createDetonation(scene,entrance);

  const limbs=[],bioFlesh=material(0x535b43,.55,false,.025);
  function addLimb(s,angle,phase,branch='main'){
    const f=frameAt(s,branch),root=vec(ringPoint(s,angle,.3,branch)),length=radius(s,branch)*1.7;
    // ROOTED IN ROCK (the owner, 2026-10-16: "some tentacles are floating in the air, not attached to walls"): where this tube's wall is cut away by another
    // tunnel or the chamber (trimSurface, the same clearances) there is no wall to grow from, so a limb whose root would stand in the opening is not made
    if(Math.max(tunnelClearance(root,branch),chamberClearance(root))>-.6)return;
    const inward=vec(f.u).multiplyScalar(-Math.cos(angle)).addScaledVector(vec(f.v),-Math.sin(angle));
    const side=vec(f.u).multiplyScalar(-Math.sin(angle)).addScaledVector(vec(f.v),Math.cos(angle));
    const segments=32,radial=9,arr=new Float32Array((segments+1)*(radial+1)*3),idx=[];
    for(let i=0;i<segments;i++)for(let j=0;j<radial;j++){const k=i*(radial+1)+j;idx.push(k,k+radial+1,k+1,k+1,k+radial+1,k+radial+2);}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(arr,3));geo.setIndex(idx);
    const mesh=new THREE.Mesh(geo,limbs.length%7===3?bioFlesh:flesh);scene.add(mesh);mesh.frustumCulled=false;points(geo,scene,true);
    limbs.push({s,branch,bio:limbs.length%7===3,angle,length,phase,root,inward,side,along:vec(f.t),geo,arr,segments,radial,path:[]});
  }
  for(const [i,s] of MAIN_TENTACLES.entries()){addLimb(s,i%2?2.7:.35,i*1.7);addLimb(s+4,i%2?-.7:3.8,i*1.7+2.9);}
  for(const [i,s] of LEFT_TENTACLES.entries()){addLimb(s,.3,i*1.4,'left');addLimb(s+5,3.6,i*1.4+2.2,'left');}
  for(const [i,s] of BLIND_TENTACLES.entries()){addLimb(s,.5,i*2,'blind');addLimb(s+5,3.6,i*2+1,'blind');}
  const tangent=new THREE.Vector3(),axis=new THREE.Vector3(),normal=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),alternative=new THREE.Vector3(0,0,1);
  function animateLimbs(time){
    for(const l of limbs){
      l.path.length=0;
      const life=colonyPresence(l.s,l.branch),pace=.4+life*.9,reach=l.length*(.35+life*.13+(.2+life*.2)*Math.sin(time*pace+l.phase));
      for(let i=0;i<=l.segments;i++){
        const u=i/l.segments;
        l.path.push(l.root.clone().addScaledVector(l.inward,reach*u).addScaledVector(l.side,Math.sin(u*4.8+time*1.8+l.phase)*u*2.4).addScaledVector(l.along,Math.sin(u*3.5+l.phase+time*1.1)*u*3.5));
      }
      for(let i=0;i<=l.segments;i++){
        const p=l.path[i];tangent.subVectors(l.path[Math.min(i+1,l.segments)],l.path[Math.max(0,i-1)]).normalize();axis.crossVectors(tangent,Math.abs(tangent.y)>.94?alternative:up).normalize();normal.crossVectors(tangent,axis).normalize();
        const r=.075+.78*Math.pow(1-i/l.segments,1.4);
        for(let j=0;j<=l.radial;j++){const a=j/l.radial*TAU,k=(i*(l.radial+1)+j)*3;l.arr[k]=p.x+r*(axis.x*Math.cos(a)+normal.x*Math.sin(a));l.arr[k+1]=p.y+r*(axis.y*Math.cos(a)+normal.y*Math.sin(a));l.arr[k+2]=p.z+r*(axis.z*Math.cos(a)+normal.z*Math.sin(a));}
      }
      l.geo.attributes.position.needsUpdate=true;l.geo.computeVertexNormals();
    }
  }
  const drop=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,1.2,12),metal);drop.visible=false;scene.add(drop);
  const dropGlow=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),new THREE.MeshBasicMaterial({color:0xf15a3a}));dropGlow.position.y=.61;drop.add(dropGlow);
  let dropTime=null,dropFloor=0;
  const dustPos=new Float32Array(1800*3);
  for(let i=0;i<1800;i++){const s=rand()*ROUTE_END,f=frameAt(s),a=rand()*TAU,r=rand()*radius(s)*.85;dustPos[i*3]=f.c.x+r*(f.u.x*Math.cos(a)+f.v.x*Math.sin(a));dustPos[i*3+1]=f.c.y+r*(f.u.y*Math.cos(a)+f.v.y*Math.sin(a));dustPos[i*3+2]=f.c.z+r*(f.u.z*Math.cos(a)+f.v.z*Math.sin(a));}
  const dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(dustPos,3)),new THREE.PointsMaterial({color:0x7f9877,size:.025,transparent:true,opacity:.27}));scene.add(dust);
  function scan(time){uniforms.uScanTime.value=time;uniforms.uScanOrigin.value.copy(player);}
  let exposure=1;
  function update(time,mission,preview=false,flightData=null){
    const cinematic=!!flightData?.cinematic;
    if(flightData)isao.update(time,flightData.dt,player,flightData.yaw,flightData.pitch,flightData.flight,mission);
    isao.rig.visible=!preview&&(!cinematic||mission.extracted);
    if(cinematic){const state=blast.stats(),age=blast.ageAt(time),q=flightData.reducedMotion||!state.detonationActive?0:Math.max(0,1-age/5)*1.5;const pull=smooth(.35,1.15,age);camera.position.set(31+pull*115+Math.sin(time*47)*q,29+pull*73+Math.cos(time*41)*q,39+pull*145);camera.lookAt(0,-3+pull*7,0);}
    uniforms.uLampPosition.value.copy(player).add(new THREE.Vector3(0,-.15,-.8).applyAxisAngle(new THREE.Vector3(0,1,0),flightData?.yaw||0));
    uniforms.uLampDirection.value.set(-Math.sin(flightData?.yaw||0),-.1,-Math.cos(flightData?.yaw||0)).normalize();uniforms.uLampStrength.value=lampStrength(mission);
    uniforms.uTime.value=time;uniforms.uLidar.value=mission.lidar&&!preview&&!cinematic?1:0;uniforms.uPreview.value=0;
    const location=nearestRoute(player),surface=cinematic||preview?1:exteriorExposure(player.y,colonyDistance(location.s,location.branch));exposure=surface;surfaceHemi.intensity=surface*.9;surfaceSun.intensity=surface*1.3;
    scene.background.setRGB(.002+surface*.003,.005+surface*.004,.004+surface*.012);
    scene.fog.density=(mission.lidar||preview)? .002 : .035*(1-surface)+.005;
    dust.visible=false;
    animateLimbs(time);nursery.update(time);creatures.update(time);flares.update(time,camera);blast.update(time,flightData?.reducedMotion,camera);
    drop.visible=!mission.payload;
    if(mission.bombPosition){
      if(dropTime===null){dropTime=time;dropFloor=chamberFloor(mission.bombPosition.x,mission.bombPosition.z)+.7;}
      drop.position.copy(mission.bombPosition);drop.position.y=Math.max(dropFloor,mission.bombPosition.y-(time-dropTime)**2*3);dropGlow.visible=Math.sin(time*5)>0;
    }
  }
  function contacts(p){
    for(const l of limbs){if(p.distanceTo(l.root)>l.length+2)continue;for(let i=1;i<l.path.length;i++)if(pointSegmentDistance(p,l.path[i-1],l.path[i])<.62+.7*(1-i/l.path.length))return l;}return creatures.contacts(p);
  }
  function reset(){flares.reset();isao.reset();creatures.reset();nursery.reset();blast.reset();dropTime=null;drop.visible=false;uniforms.uScanTime.value=-100;}
  function render(){renderer.render(scene,camera);}
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
  return {camera,player,renderer,scene,update,render,resize,scan,contacts,constrainBodies:nursery.constrain,contactSamples:()=>({...nursery.contactSamples(),tentacle:limbs[0].path[16].toArray(),enemy:creatures.contactSample()}),reset,uniforms,dropFlare:flares.drop,startDetonation:blast.start,setLidarMode:(mode)=>{uniforms.uScanMode.value=mode;},flashHit:isao.flashHit,stats:()=>({exteriorExposure:exposure,...network.stats(),...nursery.stats(),...isao.stats(),...creatures.stats(),...blast.stats(),flares:flares.stats(),sinkhole:entrance.source,shaftDepth:SHAFT_TOP-CHAMBER_LIP,tentacles:limbs.length,tentaclePlacements:limbs.map(l=>({s:l.s,branch:l.branch,bio:l.bio}))})};
}
