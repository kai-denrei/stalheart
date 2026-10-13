// Ported from Jelly-Baby src/cutis/creature/geometry.ts and the contact shadow of src/cutis/scene.ts (the owner's own project, commit 0a23df8; GPL-3.0, see ./LICENSE), types stripped; the meshes are the kit's.
// Changes from the kit: ConvexGeometry comes from ./convex.js over the vendored ConvexHull; the iLife attribute; update() packs only ACTIVE instances and picks the LOD in the group's local space (the group sits on the planet);
// planetR (setPlanetR) bends the membrane and the shadow onto the sphere in their vertex shaders; the shadow is part of the group.
// 3a985e1: a body with a rigid core (config.coreShape >= 1) hides the soft inner core mesh (the hard core is drawn by ./hard-core.js); the kit's per-tier
// batches for its mixed preview are not ported (one swarm per tier here). bend() is ./shaders.js bendPoint, PLANET_BEND's JS twin.
import * as THREE from '../../../vendor/three.module.js';
import { mergeVertices } from '../../../vendor/BufferGeometryUtils.js';
import { ConvexGeometry } from './convex.js';
import { createMembraneMaterial, createShadowMaterial, updateMaterial } from './material.js';
import { KIT_R0, CUTIS_LOD } from './config.js';
import { bendPoint } from './shaders.js';

const sizes={iOffset:3,iHeading:3,iAnchor:3,iState:4,iParams:4,iProbe0:3,iProbe1:3,iProbe2:3,iLife:4};

// the hull's resolution per LOD: [sphere width segments, height segments, cap rings, cap sides]; the kit's two (high ~13k triangles, low ~2.2k) and the
// round-two third, ~450 triangles for a body a few pixels across
const RESOLUTION=[[40,24,48,40],[16,12,20,16],[10,6,6,10]];
/** The kit's membrane hull for one LOD: three ring-aligned cap patches joined into one closed convex membrane. */
function membraneGeometry(level) {
  // Ring-aligned caps keep cross-sections coherent even on long curved stalks.
  // A spherical convex hull joins all three patches into one closed membrane.
  const [ws,hs,rings,sides]=RESOLUTION[level];
  const caps=[-1.2,0,1.2].map(a=>new THREE.Vector3(Math.sin(a),0,Math.cos(a)));
  const points=[],base=new THREE.SphereGeometry(1,ws,hs);
  const positions=base.getAttribute('position'),boundary=.59;
  for(let i=0;i<positions.count;i++){
    const n=new THREE.Vector3().fromBufferAttribute(positions,i);
    if(caps.every(axis=>n.dot(axis)<Math.cos(boundary)))points.push(n);
  }
  base.dispose();
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

// ROUND TWO (owner, 2026-10-13, the Pearl set in the story: "the fps gets very low ... fps wise we maybe cannot afford them as is"; spec
// docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 2"). The headed M4 soak drew 12.3M triangles for ~600 Pearl bodies against the dot
// clouds' 2.8M, every body of every tier packed and drawn wherever it was (the meshes are not frustum culled: one instanced draw spans the planet).
// update() now packs only the bodies that can be seen and draws each at the resolution its size on screen needs:
//   CULLED  a body outside the camera's frustum (a sphere round its origin wide enough for its longest stalk) or below the planet's horizon
//           (the eye's and the body's horizon distances, the body `horizonRadii` radii tall) is not packed at all: no membrane, core, pearl or shadow;
//   LOD 0   the kit's high hull (~13k triangles, double-sided transparency: two passes) only for a body whose radius is over `high` device pixels,
//           and at most `highCap` of them (the largest on screen; the rest drop to LOD 1); its inner core is drawn with LOD 1's hull (it is inside);
//   LOD 1   the kit's low hull (~2.2k, single pass) above `low` pixels; its inner core with LOD 2's hull;
//   LOD 2   the third hull (~450 triangles, the low material) for a body a few pixels across; no inner core (a dark speck under the membrane).
// A body changes level only `hysteresis` past a threshold, so a body on the boundary does not flicker. `lod` overrides CUTIS_LOD (./config.js) per swarm.
// `cull` false (a second view of the scene is up, src/fx/story-monitor.js) packs every active body, levels still by the main camera.
// levelOf[i] is each instance's level this frame (3 culled; ./hard-core.js draws its pearl at the matching resolution and skips a culled one);
// lodCounts [lod 0, lod 1, lod 2, culled].
export function createSwarmGeometry(swarm,{ planetR=0, lod=null }={}) {
  const group=new THREE.Group();group.name='Cutis-Maku';
  const L={...CUTIS_LOD,...(lod??{})};
  let planet=planetR;
  const hulls=RESOLUTION.map((_,level)=>membraneGeometry(level));
  const levels=[0,1,2].map(level=>{
    const low=level>0,geometry=hulls[level];
    const attributes=Object.fromEntries(Object.entries(sizes).map(([name,size])=>[name,new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity*size),size).setUsage(THREE.DynamicDrawUsage)]));
    for(const [name,attribute] of Object.entries(attributes))geometry.setAttribute(name,attribute);
    // the inner core one resolution down (it sits inside the membrane), none at the lowest level
    let coreGeometry=null;
    if(level<2){coreGeometry=new THREE.BufferGeometry();coreGeometry.setIndex(hulls[level+1].index);coreGeometry.setAttribute('position',hulls[level+1].getAttribute('position'));for(const [name,attribute] of Object.entries(attributes))coreGeometry.setAttribute(name,attribute);}
    const material=createMembraneMaterial(swarm.config,false,low),coreMaterial=coreGeometry?createMembraneMaterial(swarm.config,true,true):null;
    const membrane=new THREE.InstancedMesh(geometry,material,swarm.capacity),core=coreGeometry?new THREE.InstancedMesh(coreGeometry,coreMaterial,swarm.capacity):null;
    membrane.frustumCulled=false;membrane.renderOrder=2;membrane.count=0;membrane.visible=false;group.add(membrane);
    if(core){core.frustumCulled=false;core.renderOrder=1;core.count=0;core.visible=false;group.add(core);}
    return {geometry,coreGeometry,material,coreMaterial,membrane,core,attributes,count:0};
  });
  // Quiet contact shadows support the translucent shader without per-instance shadow maps: a flat plane per active instance, subdivided so it hugs the sphere.
  const shadowGeometry=new THREE.PlaneGeometry(2,2,4,4);shadowGeometry.rotateX(-Math.PI/2);
  const fade=new THREE.InstancedBufferAttribute(new Float32Array(swarm.capacity),1).setUsage(THREE.DynamicDrawUsage);shadowGeometry.setAttribute('iFade',fade);
  const shadowMaterial=createShadowMaterial();
  const shadows=new THREE.InstancedMesh(shadowGeometry,shadowMaterial,swarm.capacity);shadows.frustumCulled=false;shadows.renderOrder=0;shadows.count=0;shadows.visible=false;group.add(shadows);
  const eye=new THREE.Vector3(),spot=new THREE.Vector3(),matrix=new THREE.Matrix4(),clip=new THREE.Matrix4(),view=new THREE.Matrix4(),frustum=new THREE.Frustum(),sphere=new THREE.Sphere(),state=new Float32Array(4);
  const levelOf=new Uint8Array(swarm.capacity).fill(1),pixelsOf=new Float32Array(swarm.capacity),big=new Float32Array(swarm.capacity),lodCounts=[0,0,0,0];
  const specs=Object.entries(sizes);
  const bent=[0,0,0];
  function bend(v) { if(!(planet>0))return v;bendPoint(v.x,v.y,v.z,planet,bent);return v.set(bent[0],bent[1],bent[2]); }
  function setPlanetR(R) {
    planet=R>0?R:0;
    for(const l of levels){l.material.uniforms.uPlanetR.value=planet;if(l.coreMaterial)l.coreMaterial.uniforms.uPlanetR.value=planet;}
    shadowMaterial.uniforms.uPlanetR.value=planet;
  }
  setPlanetR(planetR);
  // a body's level from its radius in device pixels and its last level (the hysteresis)
  function levelFor(pixels,was) {
    const h=L.hysteresis,hi=L.high*(was===0?1-h:1+h),lo=L.low*(was===2?1+h:1-h);
    return pixels>=hi?0:pixels>=lo?1:2;
  }
  /** Pack the VISIBLE instances, split by LOD (pixels measured in the group's local space, the camera brought into it), and their life into the instance attributes and the shadows; advance the materials. */
  function update(camera,height,debug=0,force=false,multicolored=false,cull=true) {
    levels.forEach(l=>l.count=0);lodCounts.fill(0);
    group.updateWorldMatrix(true,false);camera.updateMatrixWorld();
    camera.getWorldPosition(eye);group.worldToLocal(eye);
    view.copy(camera.matrixWorld).invert();clip.multiplyMatrices(camera.projectionMatrix,view).multiply(group.matrixWorld);frustum.setFromProjectionMatrix(clip);
    const source={iOffset:swarm.offset,iHeading:swarm.heading,iAnchor:swarm.anchor,iState:state,iParams:swarm.params,iProbe0:swarm.probe0,iProbe1:swarm.probe1,iProbe2:swarm.probe2,iLife:swarm.life};
    const r0=swarm.config.r0,lift=.002*r0/KIT_R0,reach=(swarm.config.reach??15)*1.2+2;
    const pixelsPer=camera.isPerspectiveCamera?height/(2*Math.tan(camera.fov*Math.PI/360)):Infinity;
    // the eye's horizon distance over the planet (its centre at (0, -R, 0) in this plane)
    const eyeHorizon=planet>0?Math.sqrt(Math.max(0,eye.x*eye.x+(eye.y+planet)*(eye.y+planet)+eye.z*eye.z-planet*planet)):Infinity;
    // pass 1: who can be seen, how big, and at which level; the candidates for LOD 0 over the cap keep only the largest
    let candidates=0;
    for(let i=0;i<swarm.count;i++){
      if(!swarm.active[i])continue;
      const radius=r0*swarm.scale[i];
      spot.set(swarm.offset[i*3],radius,swarm.offset[i*3+2]);bend(spot);
      const distance=eye.distanceTo(spot),tall=L.horizonRadii*radius;
      sphere.center.copy(spot);sphere.radius=radius*reach;
      if(cull&&(distance>eyeHorizon+Math.sqrt(2*planet*tall+tall*tall)+radius*reach||!frustum.intersectsSphere(sphere))){pixelsOf[i]=-1;continue;}
      const pixels=radius*pixelsPer/Math.max(.1,distance),level=levelFor(pixels,levelOf[i]);
      pixelsOf[i]=pixels;levelOf[i]=level;
      if(level===0)big[candidates++]=pixels;
    }
    let floor=-Infinity;
    if(candidates>L.highCap){const top=big.subarray(0,candidates).sort();floor=top[candidates-L.highCap];}
    // pass 2: pack
    let shown=0;
    for(let i=0;i<swarm.count;i++){
      if(!swarm.active[i])continue;
      if(pixelsOf[i]<0){levelOf[i]=3;lodCounts[3]++;continue;}
      if(levelOf[i]===0&&pixelsOf[i]<floor)levelOf[i]=1;
      const level=levels[levelOf[i]],index=level.count++;lodCounts[levelOf[i]]++;
      state[0]=swarm.phase[i];state[1]=swarm.seed[i];state[2]=swarm.scale[i];state[3]=swarm.probeCount[i]*4+swarm.chosenProbe[i];
      for(const [name,size] of specs){const array=level.attributes[name].array,from=source[name],base=name==='iState'?0:i*size;for(let k=0;k<size;k++)array[index*size+k]=from[base+k];}
      // the shadow: under the body's present position, sized with it, spread by a puddle, faded by opacity, deflate and sinking below ground
      const p=swarm.position(i),Li=swarm.life,deflate=Li[i*4+1],radius=r0*swarm.scale[i];
      const size=radius*1.2*(1+.6*deflate);
      matrix.makeScale(size,size,size).setPosition(p[0],lift,p[2]);
      shadows.setMatrixAt(shown,matrix);
      fade.array[shown]=Li[i*4+2]*(1-.6*deflate)*(1-Math.min(1,Math.max(0,-Li[i*4]/radius)));
      shown++;
    }
    shadows.count=shown;shadows.visible=shown>0;shadows.instanceMatrix.needsUpdate=true;
    fade.clearUpdateRanges();fade.addUpdateRange(0,shown);fade.needsUpdate=true;
    const soft=!((swarm.config.coreShape??0)>=1);
    for(const l of levels){
      l.membrane.count=l.count;l.membrane.visible=l.count>0;
      if(l.core){l.core.count=l.count;l.core.visible=l.count>0&&soft;updateMaterial(l.coreMaterial,swarm.config,swarm.time,debug,force,multicolored);}
      if(l.count>0)for(const a of Object.values(l.attributes)){a.clearUpdateRanges();a.addUpdateRange(0,l.count*a.itemSize);a.needsUpdate=true;}
      updateMaterial(l.material,swarm.config,swarm.time,debug,force,multicolored);
    }
  }
  return {group,levels,shadows,update,setPlanetR,levelOf,lodCounts,get planetR(){return planet;},dispose:()=>{levels.forEach(l=>{l.geometry.dispose();l.coreGeometry?.dispose();l.material.dispose();l.coreMaterial?.dispose();l.membrane.dispose();l.core?.dispose();});shadowGeometry.dispose();shadowMaterial.dispose();shadows.dispose();}};
}
