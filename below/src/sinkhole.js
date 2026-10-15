import * as THREE from '../vendor/three.module.js';
import {rimRadius,bowlHeight,SINKHOLE_INNER,SINKHOLE_DEPTH} from './stalheart/sinkhole-shape.js';
import {LOOKS} from './stalheart/looks.js';
import {HOLE_SCALE} from './mission.js';

// Bowl, UVs, rim rubble and seven contours extracted from Stalheart's
// makeSinkholeTerrain. The opaque bottom cap is removed for flight.
export function createSinkholeEntrance(scene){
  const group=new THREE.Group();group.name='Stalheart sinkhole';scene.add(group);
  const look=LOOKS.tronColors,segments=192,rings=24,positions=[],colors=[],uv=[],indices=[];
  const earth=new THREE.Color(...look.floors.room);
  for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){
    const a=i/segments*Math.PI*2,r=1-(1-SINKHOLE_INNER)*j/rings;
    const x=Math.cos(a)*rimRadius(a)*r,z=Math.sin(a)*rimRadius(a)*r,y=bowlHeight(a,r);
    positions.push(x,y,z);uv.push(x*3.5/2.6,z*3.5/2.6);
    const light=Math.pow(1-Math.min(1,-y/SINKHOLE_DEPTH),1.2);colors.push(earth.r*light,earth.g*light,earth.b*light);
    if(j<rings&&i<segments){const k=j*(segments+1)+i;indices.push(k,k+segments+1,k+1,k+1,k+segments+1,k+segments+2);}
  }
  // The surrounding ground shares the bowl's rim vertices; no overlapping
  // annulus or exposed slivers between separate surfaces.
  const outerStart=positions.length/3,path=new THREE.Color(...look.floors.path);
  for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,x=Math.cos(a)*32,z=Math.sin(a)*32;positions.push(x,0,z);uv.push(x*3.5/2.6,z*3.5/2.6);colors.push(path.r,path.g,path.b);if(i<segments)indices.push(i,outerStart+i,i+1,i+1,outerStart+i,outerStart+i+1);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const bowl=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({roughness:1,vertexColors:true,side:THREE.DoubleSide}));group.add(bowl);
  const rubble=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:new THREE.Color(...look.walls.top),roughness:1}),36),dummy=new THREE.Object3D();
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2+.05*Math.sin(i*7),r=rimRadius(a)*(1.015+.025*Math.sin(i*3)),size=.025+.018*(1+Math.sin(i*13))/2;
    dummy.position.set(Math.cos(a)*r,size*.35,Math.sin(a)*r);dummy.rotation.set(i*.7,i*1.3,i*.2);dummy.scale.set(size*1.5,size*.6,size);dummy.updateMatrix();rubble.setMatrixAt(i,dummy.matrix);
  }
  group.add(rubble);
  const contourPoints=[];
  for(let ring=0;ring<7;ring++)for(let i=0;i<96;i++){
    const ratio=1-(1-SINKHOLE_INNER)*ring/6;
    for(const a of [i/96*Math.PI*2,(i+1)/96*Math.PI*2])contourPoints.push(Math.cos(a)*rimRadius(a)*ratio,bowlHeight(a,ratio)+.003,Math.sin(a)*rimRadius(a)*ratio);
  }
  const contours=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(contourPoints,3)),new THREE.LineBasicMaterial({color:look.edges.color,transparent:true,opacity:.6,depthWrite:false,blending:THREE.AdditiveBlending}));group.add(contours);
  group.scale.setScalar(HOLE_SCALE);
  const seams=[];
  for(let x=-60;x<=60;x+=8)for(let z=-60;z<60;z+=8)for(const [a,b] of [[[x,z],[x+8,z]],[[x,z],[x,z+8]]]){
    if([a,b].every(p=>Math.hypot(...p)>HOLE_SCALE*rimRadius(Math.atan2(p[1],p[0]))+2))seams.push(a[0],.015,a[1],b[0],.015,b[1]);
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(seams,3)),new THREE.LineBasicMaterial({color:look.edges.color,transparent:true,opacity:.16})));
  return {group,geometry,contours,source:'stalheart/src/sinkhole-terrain.js',segments,rings};
}
