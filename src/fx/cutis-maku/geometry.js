// Ported from Jelly-Baby src/cutis/creature/geometry.ts and the contact shadow of src/cutis/scene.ts (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), types stripped; the meshes are the kit's.
// Changes from the kit: ConvexGeometry comes from ./convex.js over the vendored ConvexHull; the iLife attribute; update() packs only ACTIVE instances and picks the LOD in the group's local space (the group sits on the planet);
// planetR (setPlanetR) bends the membrane and the shadow onto the sphere in their vertex shaders; the shadow is part of the group.
import * as THREE from '../../../vendor/three.module.js';
import { mergeVertices } from '../../../vendor/BufferGeometryUtils.js';
import { ConvexGeometry } from './convex.js';
import { createMembraneMaterial, createShadowMaterial, updateMaterial } from './material.js';
import { KIT_R0 } from './config.js';

const sizes={iOffset:3,iHeading:3,iAnchor:3,iState:4,iParams:4,iProbe0:3,iProbe1:3,iProbe2:3,iLife:4};

/** The kit's membrane hull for one LOD: three ring-aligned cap patches joined into one closed convex membrane. */
function membraneGeometry(low) {
  // Ring-aligned caps keep cross-sections coherent even on long curved stalks.
  // A spherical convex hull joins all three patches into one closed membrane.
  const caps=[-1.2,0,1.2].map(a=>new THREE.Vector3(Math.sin(a),0,Math.cos(a)));
  const points=[],base=new THREE.SphereGeometry(1,low?16:40,low?12:24);
  const positions=base.getAttribute('position'),boundary=.59;
  for(let i=0;i<positions.count;i++){
    const n=new THREE.Vector3().fromBufferAttribute(positions,i);
    if(caps.every(axis=>n.dot(axis)<Math.cos(boundary)))points.push(n);
  }
  base.dispose();
  const rings=low?20:48,sides=low?16:40;
  for(const axis of caps){
    const tangent=new THREE.Vector3(axis.z,0,-axis.x);
    points.push(axis.clone());
    for(let j=1;j<=rings;j++){
      const theta=boundary*Math.pow(j/rings,1.35);
      for(let k=0;k<sides;k++){
        const a=k/sides*Math.PI*2;
        points.push(axis.clone().multiplyScalar(Math.cos(theta)).addScaledVector(tangent,Math.sin(theta)*Math.cos(a)).add(new THREE.Vector3(0,Math.sin(theta)*Math.sin(a),0)));
      }
    }
  }
  const hull=new ConvexGeometry(points);hull.deleteAttribute('normal');
  const geometry=mergeVertices(hull);hull.dispose();
  return geometry;
}

export function createSwarmGeometry(swarm,{ planetR=0 }={}) {
  const group=new THREE.Group();group.name='Cutis-Maku';
  let planet=planetR;
  const levels=[false,true].map(low=>{
    const geometry=membraneGeometry(low),coreGeometry=geometry.clone();
    const attributes=Object.fromEntries(Object.entries(sizes).map(([name,size])=>[name,new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity*size),size).setUsage(THREE.DynamicDrawUsage)]));
    for(const [name,attribute] of Object.entries(attributes)){geometry.setAttribute(name,attribute);coreGeometry.setAttribute(name,attribute);}
    const material=createMembraneMaterial(swarm.config,false,low),coreMaterial=createMembraneMaterial(swarm.config,true,true);
    const membrane=new THREE.InstancedMesh(geometry,material,swarm.capacity),core=new THREE.InstancedMesh(coreGeometry,coreMaterial,swarm.capacity);
    membrane.frustumCulled=core.frustumCulled=false;membrane.renderOrder=2;core.renderOrder=1;group.add(core,membrane);
    return {geometry,coreGeometry,material,coreMaterial,membrane,core,attributes,count:0};
  });
  // Quiet contact shadows support the translucent shader without per-instance shadow maps: a flat plane per active instance, subdivided so it hugs the sphere.
  const shadowGeometry=new THREE.PlaneGeometry(2,2,8,8);shadowGeometry.rotateX(-Math.PI/2);
  const fade=new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity),1).setUsage(THREE.DynamicDrawUsage);shadowGeometry.setAttribute('iFade',fade);
  const shadowMaterial=createShadowMaterial();
  const shadows=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,swarm.capacity);shadows.frustumCulled=false;shadows.renderOrder=0;shadows.count=0;shadows.visible=false;group.add(shadows);
  const eye=new THREE.Vector3(),spot=new THREE.Vector3(),matrix=new THREE.Matrix4(),state=new Float32Array(4);
  const specs=Object.entries(sizes);
  function bend(v) {
    if(!(planet>0))return v;
    const d=Math.hypot(v.x,v.z),t=d/planet,rr=planet+v.y,f=d>1e-9?rr*Math.sin(t)/d:0;
    const y=v.y*Math.cos(t)-2*planet*Math.sin(t/2)**2;
    v.x*=f;v.z*=f;v.y=y;return v;
  }
  function setPlanetR(R) {
    planet=R>0?R:0;
    for(const l of levels){l.material.uniforms.uPlanetR.value=planet;l.coreMaterial.uniforms.uPlanetR.value=planet;}
    shadowMaterial.uniforms.uPlanetR.value=planet;
  }
  setPlanetR(planetR);
  /** Pack the ACTIVE instances, split by LOD (pixels measured in the group's local space, the camera brought into it), and their life into the instance attributes and the shadows; advance the materials. */
  function update(camera,height,debug=0,force=false,multicolored=false) {
    levels.forEach(l=>l.count=0);
    group.updateWorldMatrix(true,false);
    camera.getWorldPosition(eye);group.worldToLocal(eye);
    const source={iOffset:swarm.offset,iHeading:swarm.heading,iAnchor:swarm.anchor,iState:state,iParams:swarm.params,iProbe0:swarm.probe0,iProbe1:swarm.probe1,iProbe2:swarm.probe2,iLife:swarm.life};
    const r0=swarm.config.r0,pixelsPer=height/(2*Math.tan(camera.fov*Math.PI/360)),lift=.002*r0/KIT_R0;
    let shown=0;
    for(let i=0;i<swarm.count;i++){
      if(!swarm.active[i])continue;
      spot.set(swarm.offset[i*3],r0,swarm.offset[i*3+2]);bend(spot);
      const pixels=r0*swarm.scale[i]*pixelsPer/Math.max(.1,eye.distanceTo(spot));
      const level=levels[pixels<26?1:0],index=level.count++;
      state[0]=swarm.phase[i];state[1]=swarm.seed[i];state[2]=swarm.scale[i];state[3]=swarm.probeCount[i]*4+swarm.chosenProbe[i];
      for(const [name,size] of specs){const array=level.attributes[name].array,from=source[name],base=name==='iState'?0:i*size;for(let k=0;k<size;k++)array[index*size+k]=from[base+k];}
      // the shadow: under the body's present position, sized with it, spread by a puddle, faded by opacity, deflate and sinking below ground
      const p=swarm.position(i),L=swarm.life,deflate=L[i*4+1],radius=r0*swarm.scale[i];
      const size=radius*1.2*(1+.6*deflate);
      matrix.makeScale(size,size,size).setPosition(p[0],lift,p[2]);
      shadows.setMatrixAt(shown,matrix);
      fade.array[shown]=L[i*4+2]*(1-.6*deflate)*(1-Math.min(1,Math.max(0,-L[i*4]/radius)));
      shown++;
    }
    shadows.count=shown;shadows.visible=shown>0;shadows.instanceMatrix.needsUpdate=true;
    fade.clearUpdateRanges();fade.addUpdateRange(0,shown);fade.needsUpdate=true;
    for(const l of levels){l.membrane.count=l.core.count=l.count;l.membrane.visible=l.core.visible=l.count>0;for(const a of Object.values(l.attributes)){a.clearUpdateRanges();a.addUpdateRange(0,l.count*a.itemSize);a.needsUpdate=true;}updateMaterial(l.material,swarm.config,swarm.time,debug,force,multicolored);updateMaterial(l.coreMaterial,swarm.config,swarm.time,debug,force,multicolored);}
  }
  return {group,levels,shadows,update,setPlanetR,get planetR(){return planet;},dispose:()=>{levels.forEach(l=>{l.geometry.dispose();l.coreGeometry.dispose();l.material.dispose();l.coreMaterial.dispose();l.membrane.dispose();l.core.dispose();});shadowGeometry.dispose();shadowMaterial.dispose();shadows.dispose();}};
}
