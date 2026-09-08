import { LOOKS } from './looks.js';
import { BREACH_SURFACE_GLSL } from './core/breach-surface.js';
import { generateSphereMesh,relax } from './grid.js';
import * as THREE from '../vendor/three.module.js';
import { rimRadius,bowlHeight,SINKHOLE_INNER,SINKHOLE_DEPTH,SINKHOLE_BOUNDARY_GLSL } from './core/sinkhole-shape.js';
import { getStoneTextures,STONE_TILE_METRES } from './fx/sinkhole/loaders/StoneTextures.js';

export function makeSinkholeTerrain(hole,radius,{ground=true}={}){
  const textures=getStoneTextures(),group=new THREE.Group(),bowl=new THREE.Group();group.add(bowl);
  const segments=192,rings=24,positions=[],colors=[],uv=[],indices=[];
  const earth=new THREE.Color(0x978777);
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,r=1-(1-SINKHOLE_INNER)*j/rings;
    const x=Math.cos(a)*rimRadius(a)*r,z=Math.sin(a)*rimRadius(a)*r,y=bowlHeight(a,r);
    positions.push(x,y,z);uv.push(x*3.5/STONE_TILE_METRES,z*3.5/STONE_TILE_METRES);
    const depth=Math.min(1,-y/SINKHOLE_DEPTH),light=Math.pow(1-depth,1.2);
    colors.push(earth.r*light,earth.g*light,earth.b*light);
    if(j<rings&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material=new THREE.MeshStandardMaterial({map:textures.map,roughnessMap:textures.roughnessMap,roughness:1,vertexColors:true,side:THREE.DoubleSide});
  bowl.add(new THREE.Mesh(geometry,material));
  const blackPositions=[0,-SINKHOLE_DEPTH-.01,0],blackIndices=[];
  for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=rimRadius(a)*SINKHOLE_INNER;blackPositions.push(Math.cos(a)*r,-SINKHOLE_DEPTH,Math.sin(a)*r);if(i<segments)blackIndices.push(0,i+2,i+1);}
  const blackGeometry=new THREE.BufferGeometry();blackGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blackPositions,3));blackGeometry.setIndex(blackIndices);
  bowl.add(new THREE.Mesh(blackGeometry,new THREE.MeshBasicMaterial({color:0,side:THREE.DoubleSide})));
  const rubble=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({map:textures.map,color:0x8b7d6b,roughness:1}),36),dummy=new THREE.Object3D();
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2+.05*Math.sin(i*7),r=rimRadius(a)*(1.015+.025*Math.sin(i*3));
    const size=.025+.018*(1+Math.sin(i*13))/2;
    dummy.position.set(Math.cos(a)*r,size*.35,Math.sin(a)*r);dummy.rotation.set(i*.7,i*1.3,i*.2);dummy.scale.set(size*1.5,size*.6,size);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);
  }
  bowl.add(rubble);
  const contourPoints=[];
  for(let ring=0;ring<7;ring++)for(let i=0;i<96;i++){
    const ratio=1-(1-SINKHOLE_INNER)*ring/6;
    for(const angle of [i/96*Math.PI*2,(i+1)/96*Math.PI*2])contourPoints.push(Math.cos(angle)*rimRadius(angle)*ratio,bowlHeight(angle,ratio)+.003,Math.sin(angle)*rimRadius(angle)*ratio);
  }
  const contours=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(contourPoints,3)),new THREE.LineBasicMaterial({transparent:true,opacity:.6,depthWrite:false}));bowl.add(contours);contours.visible=false;

  const floorGeometry=new THREE.PlaneGeometry(100,100);floorGeometry.rotateX(-Math.PI/2);
  const p=floorGeometry.attributes.position,u=floorGeometry.attributes.uv;
  for(let i=0;i<p.count;i++)u.setXY(i,p.getX(i)/STONE_TILE_METRES,p.getZ(i)/STONE_TILE_METRES);
  const floorMaterial=new THREE.MeshStandardMaterial({map:textures.map,roughnessMap:textures.roughnessMap,color:0x978777,roughness:1});
  floorMaterial.onBeforeCompile=shader=>{
    shader.uniforms.uHoleRadius=hole;shader.uniforms.uBreachRadius=radius;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHoleWorld;').replace('#include <project_vertex>','vHoleWorld=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vHoleWorld;uniform float uHoleRadius;\n${SINKHOLE_BOUNDARY_GLSL}\n${BREACH_SURFACE_GLSL}`).replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nvec3 breachLocal=breachUnwrap(vHoleWorld);if(length(breachLocal.xz)<uHoleRadius*sinkholeRim(atan(breachLocal.z,breachLocal.x)))discard;');
  };
  floorMaterial.customProgramCacheKey=()=> 'sinkhole-irregular-floor-v2';
  const flat=new THREE.Mesh(floorGeometry,floorMaterial);flat.userData.breachWorld=true;group.add(flat);
  const globeGeometry=new THREE.SphereGeometry(1,ground?192:8,ground?128:6),globe=new THREE.Mesh(globeGeometry,floorMaterial);
  for(let i=0;i<globeGeometry.attributes.uv.count;i++){const uv=globeGeometry.attributes.uv;uv.setXY(i,uv.getX(i)*32,uv.getY(i)*16);}
  globe.userData.breachWorld=true;group.add(globe);
  // Same pinned organic quad kernel as the game, used only for a visual grid.
  const grid=ground?generateSphereMesh({seed:7,n:90}):{quads:[],vertices:[]};if(ground)relax(grid,{n_iters:15});const lines=[],seen=new Set();
  for(const q of grid.quads)for(let i=0;i<q.length;i++){
    const a=q[i],b=q[(i+1)%q.length],key=[Math.min(a,b),Math.max(a,b)].join(':');if(seen.has(key))continue;seen.add(key);
    const start=new THREE.Vector3(...grid.vertices[a]),end=new THREE.Vector3(...grid.vertices[b]);
    for(let j=0;j<4;j++){lines.push(...start.clone().lerp(end,j/4).normalize().multiplyScalar(1.001).toArray(),...start.clone().lerp(end,(j+1)/4).normalize().multiplyScalar(1.001).toArray());}
  }
  const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  const gridMaterial=new THREE.LineBasicMaterial({color:0xa3bab6,transparent:true,opacity:.17,depthWrite:false});gridMaterial.onBeforeCompile=floorMaterial.onBeforeCompile;gridMaterial.customProgramCacheKey=()=> 'breach-planet-grid-v1';
  const gridMesh=new THREE.LineSegments(gridGeometry,gridMaterial);gridMesh.userData.breachWorld=true;group.add(gridMesh);
  let currentLook='';
  return {group,setLook(name){if(currentLook===name)return;currentLook=name;const look=LOOKS[name];
    floorMaterial.map=look?null:textures.map;floorMaterial.roughnessMap=look?null:textures.roughnessMap;
    floorMaterial.color.copy(look?new THREE.Color(...look.floors.path):earth);floorMaterial.needsUpdate=true;
    material.map=look?null:textures.map;material.needsUpdate=true;
    rubble.material.map=look?null:textures.map;rubble.material.color.copy(look?new THREE.Color(...look.walls.top):new THREE.Color(0x8b7d6b));rubble.material.needsUpdate=true;
    gridMaterial.color.set(look?.edges.color??0xa3bab6);gridMaterial.opacity=look?.edges.opacity??.17;gridMaterial.blending=look?.edges.additive?THREE.AdditiveBlending:THREE.NormalBlending;
    contours.visible=!!look;contours.material.color.set(look?.edges.color??0xffffff);contours.material.blending=gridMaterial.blending;
    const c=geometry.attributes.color,base=look?new THREE.Color(...look.floors.room):earth;
    for(let i=0;i<c.count;i++){const shade=Math.pow(1-Math.min(1,-positions[i*3+1]/SINKHOLE_DEPTH),1.2);c.setXYZ(i,base.r*shade,base.g*shade,base.b*shade);}c.needsUpdate=true;
  },update(){bowl.visible=hole.value>0;bowl.scale.setScalar(hole.value);flat.visible=ground&&radius.value<=0;
    for(const o of [globe,gridMesh]){o.visible=ground&&radius.value>0;o.scale.setScalar(radius.value||1);o.position.y=-radius.value;}
  },dispose(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();if(o.isInstancedMesh)o.dispose();});group.removeFromParent();}};
}
