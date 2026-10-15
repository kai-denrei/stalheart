import * as THREE from '../vendor/three.module.js';
import {surveyGLSL} from './lidar.js';
import {createReedActor} from './reed.js';
import {IVORY_SPOTS,GORO_SPOTS,REED_SPOTS} from './cave-pacing.js';
import {CutisSwarm} from './fx/cutis-maku/swarm.js';
import {DEFAULT_CONFIG} from './fx/cutis-maku/config.js';
import {createSwarmGeometry} from './fx/cutis-maku/geometry.js';
import {deformInto} from './fx/cutis-maku/deform.js';
import {PEARL_TIERS} from './stalheart/pearl-enemies.js';
import {CutisSwarm as GoroSwarm} from './fx/gorogoro/controller.js';
import {createSwarmGeometry as createGoroGeometry} from './fx/gorogoro/geometry.js';
import {GOROGORO_DEFAULT_CONFIG} from './fx/gorogoro/tiers.js';
import {frameAt,ringPoint,branchCenter,FLARE_COUNT} from './mission.js';

export async function createTunnelCreatures({scene,body,points,material,uniforms,camera}){
  const ivory=PEARL_TIERS.find(t=>t.id==='white'),creatures=[];
  const configs=IVORY_SPOTS;
  for(const [index,spot] of configs.entries()){
    const config={...DEFAULT_CONFIG,...ivory.values,r0:.7,reach:5.5,cycleDuration:9,transferEase:1,frameStep:1};
    const swarm=new CutisSwarm(config,{capacity:1});swarm.populate(1);swarm.reachLimit=()=>4.1;
    const source=createSwarmGeometry(swarm,{lod:{force:2}}),rest=source.levels[2].geometry.attributes.position;
    const geometry=new THREE.BufferGeometry();geometry.setIndex(source.levels[2].geometry.index.clone());geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(rest.count*3),3));
    const directions=Array.from({length:rest.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(rest,i).normalize().toArray());source.dispose();
    const f=frameAt(spot.s,spot.branch),root=new THREE.Vector3().copy(ringPoint(spot.s,spot.a,.35,spot.branch));
    const up=new THREE.Vector3().copy(f.u).multiplyScalar(-Math.cos(spot.a)).addScaledVector(new THREE.Vector3().copy(f.v),-Math.sin(spot.a));
    const z=new THREE.Vector3().copy(f.t),x=new THREE.Vector3().crossVectors(up,z).normalize();
    const group=new THREE.Group();group.name=ivory.name;group.position.copy(root);group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));scene.add(group);
    const mesh=body(geometry,material(ivory.values.skinTint,.48,false,spot.bio?.025:0),group,0);mesh.frustumCulled=false;points(geometry,group,true);
    swarm.phase[0]=index*.09;swarm.seed[0]+=index*7;creatures.push({swarm,geometry,directions,group,root,index,phase:0});
  }
  const goros=[];
  for(const [i,spot] of GORO_SPOTS.entries()){
    const s=spot.s;
    const config={...GOROGORO_DEFAULT_CONFIG,r0:.55,reach:6.5,cycleDuration:7,aggression:.78,skinTint:0x7b8274};
    const swarm=new GoroSwarm(config);swarm.phase[0]=i*.14;swarm.seed[0]+=i*9;const geometry=createGoroGeometry(swarm);
    const a=Math.PI/2,f=frameAt(s,spot.branch),root=new THREE.Vector3().copy(ringPoint(s,a,.4,spot.branch));
    const up=new THREE.Vector3().copy(f.u).multiplyScalar(-Math.cos(a)).addScaledVector(new THREE.Vector3().copy(f.v),-Math.sin(a)),z=new THREE.Vector3().copy(f.t),x=new THREE.Vector3().crossVectors(up,z).normalize();
    const group=new THREE.Group();group.name='Cutis-gorogoro';group.position.copy(root);group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));group.add(geometry.group);scene.add(group);
    for(const level of geometry.levels)for(const mat of [level.material,level.coreMaterial]){
      for(const name of ['uScanTime','uScanOrigin','uLampPosition','uLampDirection','uLampStrength'])mat.uniforms[name]=uniforms[name];
      mat.uniforms.uSurveyTime=uniforms.uTime;
      mat.uniforms.uLidar=uniforms.uLidar;mat.uniforms.uScanMode=uniforms.uScanMode;mat.uniforms.uFlarePositions=uniforms.uFlarePositions;mat.uniforms.uFlareStrengths=uniforms.uFlareStrengths;
      mat.fragmentShader='#define FLARE_COUNT '+FLARE_COUNT+'\n'+'uniform float uSurveyTime;uniform float uScanTime;uniform vec3 uScanOrigin;uniform vec3 uLampPosition;uniform vec3 uLampDirection;uniform float uLampStrength;\n'+surveyGLSL.replaceAll('uTime','uSurveyTime')+'\n'+'uniform float uLidar;uniform float uScanMode;uniform vec3 uFlarePositions[FLARE_COUNT];uniform float uFlareStrengths[FLARE_COUNT];\n'+mat.fragmentShader;
      mat.fragmentShader=mat.fragmentShader.replace('#include <tonemapping_fragment>',`
        if(uLidar>.5){float d=distance(vWorld,uScanOrigin),echo=surveyReturn(vWorld);float grain=fract(sin(dot(floor(vWorld*23.),vec3(12.9,78.2,45.1))+floor(uSurveyTime*8.)*.17)*43758.5);if(echo<.02||grain<.24||mod(gl_FragCoord.x,3.)>1.||mod(gl_FragCoord.y,3.)>1.)discard;gl_FragColor=vec4(surveyColor(d,uScanMode,1.)*.8,echo*.65);}
        else{float light=0.;for(int i=0;i<FLARE_COUNT;i++)light+=uFlareStrengths[i]*(1.-smoothstep(2.,14.,distance(vWorld,uFlarePositions[i])));vec3 delta=vWorld-uLampPosition;float lamp=uLampStrength*(1.-smoothstep(2.,19.,length(delta)))*smoothstep(.78,.95,dot(normalize(delta),uLampDirection));gl_FragColor.rgb*=light*vec3(1.,.075,.03)+lamp*vec3(.65,.68,.57);gl_FragColor.a*=step(.015,light+lamp);if(${spot.bio?1:0}>0){float bio=pow(vein,3.);gl_FragColor.rgb+=vec3(.008,.018,.012)*bio;gl_FragColor.a=max(gl_FragColor.a,bio*.5);}}
        #include <tonemapping_fragment>`);
    }
    const core=body(new THREE.SphereGeometry(config.r0*config.coreSize,16,12),material(config.coreTint,.3),group,500);
    goros.push({swarm,geometry,group,root,core,index:i});
  }
  const [metaResponse,binResponse]=await Promise.all([fetch('./assets/models/reed.json'),fetch('./assets/models/reed.bin')]);
  if(!metaResponse.ok||!binResponse.ok)throw new Error('Reed geometry could not be loaded.');
  const meta=await metaResponse.json(),buffer=await binResponse.arrayBuffer(),reeds=[];
  for(const [i,spot] of REED_SPOTS.entries()){
    const actor=createReedActor(buffer,meta,i),source=actor.body.surface.geometry;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(source.attributes.position.count*3),3));geometry.setAttribute('normal',source.attributes.normal.clone());geometry.setIndex(source.index.clone());
    const group=new THREE.Group();group.name='Reed';group.scale.setScalar(32);scene.add(group);body(geometry,material(0xa6af99,.38,false,spot.bio?.025:0),group,0);points(geometry,group,true);reeds.push({group,geometry,actor,spot,index:i,root:new THREE.Vector3()});
  }
  const out=[0,0,0,0,0],point=new THREE.Vector3(),target={x:0,z:0};let lastTime=0;
  function update(time){
    const dt=Math.max(0,Math.min(.05,time-lastTime));lastTime=time;
    for(const c of creatures){
      c.swarm.setTarget(0,Math.sin(time*.05+c.index)*1.5,Math.cos(time*.05+c.index)*2.5);c.swarm.advance(dt);c.phase=c.swarm.phase[0];
      const p=c.geometry.attributes.position;
      for(let i=0;i<c.directions.length;i++){deformInto(c.swarm,0,c.directions[i],out);p.setXYZ(i,out[0],out[1],out[2]);}
      p.needsUpdate=true;c.geometry.computeVertexNormals();c.geometry.computeBoundingSphere();
    }
    for(const g of goros){
      target.x=Math.sin(time*.12+g.index)*2;target.z=Math.cos(time*.09+g.index)*2.2;g.swarm.step(dt,target);g.geometry.update(camera,innerHeight);const c=g.swarm.getCoreContact(0);g.core.position.copy(c.center);
    }
    for(const r of reeds){
      r.actor.update(dt);const center=r.actor.body.center,s=r.spot.s+center.z*32,f=frameAt(s,r.spot.branch),at=ringPoint(s,Math.PI/2,.18,r.spot.branch);
      r.root.copy(at).addScaledVector(new THREE.Vector3().copy(f.u),center.x*32);r.group.position.copy(r.root);
      const up=new THREE.Vector3().copy(f.v).negate(),z=new THREE.Vector3().copy(f.t),x=new THREE.Vector3().crossVectors(up,z).normalize();r.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));
      const source=r.actor.body.surface.geometry,p=r.geometry.attributes.position,n=r.geometry.attributes.normal,sp=source.attributes.position;
      for(let i=0;i<p.count;i++)p.setXYZ(i,sp.getX(i)-center.x,sp.getY(i),sp.getZ(i)-center.z);
      p.needsUpdate=true;n.array.set(source.attributes.normal.array);n.needsUpdate=true;r.geometry.computeBoundingSphere();
    }
  }

  function contacts(position){
    for(const c of creatures){if(position.distanceTo(c.root)>6)continue;c.group.updateWorldMatrix(true,false);const p=c.geometry.attributes.position;
      for(let i=0;i<p.count;i+=3){point.fromBufferAttribute(p,i).applyMatrix4(c.group.matrixWorld);if(point.distanceTo(position)<.7)return {root:c.root,kind:'cutis'};}
    }
    for(const g of goros){g.group.updateWorldMatrix(true,false);const local=position.clone();g.group.worldToLocal(local);const c=g.swarm.getCoreContact(0),segment=g.swarm.getStretchSegment(0),to=g.swarm.getSeekingAnchors(0);if(local.distanceTo(new THREE.Vector3().copy(c.center))<1)return {root:g.root,kind:'gorogoro'};for(const tip of to){const start=new THREE.Vector3().copy(segment.from),end=new THREE.Vector3().copy(tip);const line=new THREE.Line3(start,end);if(line.closestPointToPoint(local,true,point).distanceTo(local)<.65)return {root:g.root,kind:'gorogoro'};}}
    for(const r of reeds){if(position.distanceTo(r.root)>14)continue;r.group.updateWorldMatrix(true,false);const p=r.geometry.attributes.position;
      for(let i=0;i<p.count;i+=3){point.fromBufferAttribute(p,i).applyMatrix4(r.group.matrixWorld);if(point.distanceTo(position)<.7)return {root:r.root,kind:'reed'};}
    }
    return null;
  }
  function reset(){lastTime=0;for(const c of creatures){c.swarm.populate(1);c.swarm.phase[0]=c.index*.09;c.phase=0;}for(const g of goros){g.swarm.reset(1);g.swarm.phase[0]=g.index*.14;}for(const r of reeds)r.actor.reset();}
  return {update,contacts,reset,contactSample:()=>{const g=goros[0];g.group.updateWorldMatrix(true,false);return g.group.localToWorld(new THREE.Vector3().copy(g.swarm.getCoreContact(0).center)).toArray();},stats:()=>({cutisCount:creatures.length,cutisType:ivory.name,cutisPhases:creatures.map(c=>c.phase),gorogoroCount:goros.length,gorogoroPhases:goros.map(g=>g.swarm.phase[0]),reedCount:reeds.length,reedPositions:reeds.map(r=>r.group.position.toArray()),reedMotion:reeds.map(r=>r.actor.stats()),creaturePlacements:[...IVORY_SPOTS,...GORO_SPOTS,...REED_SPOTS].map(s=>({s:s.s,branch:s.branch||'main',bio:!!s.bio}))})};
}
