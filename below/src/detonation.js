import * as THREE from '../vendor/three.module.js';
import {smooth} from './mission.js';
import {SINKHOLE_BOUNDARY_GLSL,SINKHOLE_INNER,SINKHOLE_DEPTH} from './stalheart/sinkhole-shape.js';
import {SMOKE_COUNT,SMOKE_SOURCE_Y,SMOKE_FIRST_EMISSION,SMOKE_SURFACE_DELAY,SMOKE_BURST_SPEED,SMOKE_RELEASE_WINDOW,smokeParticle} from './smoke.js';

export function createDetonation(scene,entrance){
  let started=null,age=0;
  const positions=new Float32Array(SMOKE_COUNT*3),seeds=new Float32Array(SMOKE_COUNT),sizes=new Float32Array(SMOKE_COUNT),alphas=new Float32Array(SMOKE_COUNT);
  for(let i=0;i<SMOKE_COUNT;i++){positions[i*3+1]=SMOKE_SOURCE_Y;seeds[i]=((i*73)%(SMOKE_COUNT-1))/(SMOKE_COUNT-1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('aAlpha',new THREE.BufferAttribute(alphas,1).setUsage(THREE.DynamicDrawUsage));
  const uniforms={uPixelScale:{value:600},uRight:{value:new THREE.Vector3(1,0,0)},uUp:{value:new THREE.Vector3(0,1,0)},uSinkholeInverse:{value:new THREE.Matrix4()}};
  const smoke=new THREE.Points(geometry,new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,
    vertexShader:`attribute float aSeed;attribute float aSize;attribute float aAlpha;uniform float uPixelScale;varying float vAlpha;varying float vSeed;varying float vSize;varying vec3 vCenter;
      void main(){vec4 world=modelMatrix*vec4(position,1.),view=viewMatrix*world;gl_Position=projectionMatrix*view;
        gl_PointSize=clamp(aSize*uPixelScale/max(1.,-view.z),1.,300.);vSize=gl_PointSize*max(1.,-view.z)/uPixelScale;
        vCenter=world.xyz;vAlpha=aAlpha;vSeed=aSeed;
      }`,
    fragmentShader:`uniform vec3 uRight;uniform vec3 uUp;uniform mat4 uSinkholeInverse;
      varying float vAlpha;varying float vSeed;varying float vSize;varying vec3 vCenter;
      ${SINKHOLE_BOUNDARY_GLSL}
      void main(){
        if(vAlpha<.001)discard;vec2 p=gl_PointCoord*2.-1.;float r=length(p);
        // Clip each billboard pixel against the same irregular bowl as the terrain.
        vec3 world=vCenter+(p.x*uRight-p.y*uUp)*vSize*.5,local=(uSinkholeInverse*vec4(world,1.)).xyz;
        float angle=atan(local.z,local.x),radius=length(local.xz)/sinkholeRim(angle);
        if(radius>=${SINKHOLE_INNER}){
          float t=clamp((1.-radius)/(1.-${SINKHOLE_INNER}),0.,1.);
          float delta=atan(sin(angle-1.),cos(angle-1.)),approach=exp(-pow(delta/.65,4.));
          float floorY=-${SINKHOLE_DEPTH}*pow(t,.48+.77*approach)+.018*sin(angle*23.+t*17.)*t*(1.-t);
          if(local.y<floorY+.001)discard;
        }
        float n=.5+.19*sin(p.x*9.+sin(p.y*7.)+vSeed*41.)+.16*cos(p.y*13.-vSeed*31.)+.1*sin(p.x*23.+p.y*17.);
        float edge=r+(1.-n)*.26;if(edge>1.)discard;
        float a=(1.-smoothstep(.2,1.,edge))*vAlpha*(.55+n*.65);
        vec3 col=mix(vec3(.075,.085,.08),vec3(.34,.36,.33),n*.65+vSeed*.3);gl_FragColor=vec4(col,a);
      }`
  }));smoke.frustumCulled=false;smoke.visible=false;smoke.renderOrder=4;scene.add(smoke);
  const puff=new Float64Array(5);let firstAboveGround=null;
  const ring=new THREE.Mesh(new THREE.RingGeometry(.987,1,128),new THREE.MeshBasicMaterial({color:0xaaa789,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.y=.08;scene.add(ring);
  const flash=new THREE.PointLight(0xffd8a3,0,95,1);flash.position.set(0,1,0);scene.add(flash);
  const dustPositions=new Float32Array(720*3);
  for(let i=0;i<720;i++){const a=i*2.39996,r=19+(i%13)*.9;dustPositions[i*3]=Math.cos(a)*r;dustPositions[i*3+1]=.3;dustPositions[i*3+2]=Math.sin(a)*r;}
  const dust=new THREE.Points(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(dustPositions,3)),new THREE.PointsMaterial({color:0x9eaaa2,size:.8,transparent:true,opacity:0,depthWrite:false}));scene.add(dust);

  function start(time){started=time;firstAboveGround=null;age=0;smoke.visible=true;}
  function update(time,reducedMotion=false,camera=null){
    if(started===null)return;age=Math.max(0,time-started);
    for(let i=0;i<SMOKE_COUNT;i++){smokeParticle(seeds[i],age,puff);positions[i*3]=puff[0];positions[i*3+1]=puff[1];positions[i*3+2]=puff[2];sizes[i]=puff[3];alphas[i]=puff[4];if(firstAboveGround===null&&puff[4]>.001&&puff[1]>0)firstAboveGround=age;}
    geometry.attributes.position.needsUpdate=true;geometry.attributes.aSize.needsUpdate=true;geometry.attributes.aAlpha.needsUpdate=true;
    if(camera){camera.updateMatrixWorld();uniforms.uRight.value.setFromMatrixColumn(camera.matrixWorld,0);uniforms.uUp.value.setFromMatrixColumn(camera.matrixWorld,1);uniforms.uPixelScale.value=camera.projectionMatrix.elements[5]*innerHeight*.5;}

    const quake=(1-smooth(0,5,age))*(reducedMotion?.035:2.4);
    entrance.group.position.y=Math.sin(age*31)*quake;entrance.group.rotation.x=Math.sin(age*23)*quake*.016;entrance.group.rotation.z=Math.cos(age*19)*quake*.014;

    entrance.group.updateMatrixWorld(true);uniforms.uSinkholeInverse.value.copy(entrance.group.matrixWorld).invert();
    flash.position.set(0,SMOKE_SOURCE_Y+3,0);flash.intensity=9000*Math.exp(-age*9);ring.scale.setScalar(4+age*210);ring.material.opacity=.28*(1-smooth(0,.7,age));
    dust.material.opacity=Math.max(0,.65-age*.2);dust.position.y=Math.min(18,age*22);dust.scale.setScalar(1+age*3.5);
  }
  function reset(){started=null;age=0;firstAboveGround=null;smoke.visible=false;flash.intensity=0;ring.material.opacity=0;dust.material.opacity=0;dust.position.y=0;dust.scale.setScalar(1);entrance.group.position.y=0;entrance.group.rotation.set(0,0,0);}
  return {start,update,reset,ageAt:time=>started===null?0:Math.max(0,time-started),stats:()=>({detonationActive:started!==null,detonationAge:age,smokeVisible:smoke.visible&&age>SMOKE_FIRST_EMISSION,smokeParticles:smoke.visible?SMOKE_COUNT:0,smokeOriginDepth:-SMOKE_SOURCE_Y,smokeLaunchSpeed:SMOKE_BURST_SPEED,smokeReleaseWindow:SMOKE_RELEASE_WINDOW,smokeSurfaceDelay:SMOKE_SURFACE_DELAY,firstSmokeAboveGround:firstAboveGround,groundDisplacement:entrance.group.position.y})};
}
