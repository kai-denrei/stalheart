import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { MeshoptDecoder } from '../../vendor/meshopt_decoder.module.js';
import { generateSphereMesh,relax } from '../grid.js';
import { LOOKS } from '../looks.js';
import { sentryUrl } from '../sentry.js';

// A prepared firing terrace on a curved planet. Combat keeps local metre coordinates.
export function createSniperEnvironment(scene){
 const group=new THREE.Group();group.name='Sniper planet and canyon';scene.add(group);
 const radius=2600,look=LOOKS.tronColors,grid=generateSphereMesh({seed:4414,n:260});relax(grid,{n_iters:12});
 const points=grid.vertices.map(([x,y,z])=>{const p=new THREE.Vector3(x,y,z).normalize().multiplyScalar(radius);p.y-=radius;const d=Math.hypot(p.x,p.z);if(y>0){const f=1-THREE.MathUtils.smoothstep(d,1450,1850);p.y*=1-f;}return p;});
 const vertices=[],lines=[];
 for(const q of grid.quads){for(let i=1;i<q.length-1;i++)vertices.push(...points[q[0]].toArray(),...points[q[i]].toArray(),...points[q[i+1]].toArray());for(let i=0;i<q.length;i++)lines.push(...points[q[i]].toArray(),...points[q[(i+1)%q.length]].toArray());}
 const groundGeometry=new THREE.BufferGeometry();groundGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));groundGeometry.computeVertexNormals();
 group.add(new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({color:new THREE.Color(...look.floors.room),roughness:1,side:THREE.DoubleSide})));
 const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const gridLines=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:look.edges.color,transparent:true,opacity:.22}));gridLines.position.y=.035;group.add(gridLines);
 const boxes=[],placements=[];
 function wall(x,z,w,h,d){boxes.push(new THREE.Box3(new THREE.Vector3(x-w/2,0,z-d/2),new THREE.Vector3(x+w/2,h,z+d/2)));return {x,z,w,h,d};}
 const blocks=[wall(0,-5,14,6,10)];
 for(let i=0;i<56;i++)for(const sign of [-1,1]){
  const z=35+i*24,x=sign*(65+z*.025+Math.max(0,z-600)*.015*Math.sin(i*.15)),h=12+(i%4)*3;
  blocks.push(wall(x,z,18,h,23.5));
  if([13,23,35].includes(i))placements.push({x,y:h,z,key:sign<0?'quiver':'lancer'});
  if(i%3===0)blocks.push(wall(x+sign*35,z+10,44,h+12,45));
 }
 for(let i=-5;i<=5;i++)if(Math.abs(i)>1)blocks.push(wall(i*42,1450,40,30+(i%3)*4,35));
 const bodyGeometry=new THREE.BoxGeometry(1,1,1),body=new THREE.InstancedMesh(bodyGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(...look.walls.side)}),blocks.length),dummy=new THREE.Object3D(),edgeSource=new THREE.EdgesGeometry(bodyGeometry),edgePositions=[];
 blocks.forEach((b,i)=>{dummy.position.set(b.x,b.h/2,b.z);dummy.scale.set(b.w,b.h,b.d);dummy.updateMatrix();body.setMatrixAt(i,dummy.matrix);const pos=edgeSource.attributes.position;for(let j=0;j<pos.count;j++)edgePositions.push(...new THREE.Vector3().fromBufferAttribute(pos,j).applyMatrix4(dummy.matrix).toArray());});
 body.instanceMatrix.needsUpdate=true;body.computeBoundingSphere();group.add(body);edgeSource.dispose();
 const edges=new THREE.BufferGeometry();edges.setAttribute('position',new THREE.Float32BufferAttribute(edgePositions,3));group.add(new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:look.edges.color,transparent:true,opacity:.6})));
 let disposed=false,mounted=0,error=null;
 const disposeObjects=root=>{const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.isInstancedMesh)o.dispose();});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();};
 const ready=Promise.all(['quiver','lancer'].map(async key=>{
  const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(sentryUrl(key,1));if(disposed){disposeObjects(gltf.scene);return;}
  for(const p of placements.filter(p=>p.key===key)){const model=gltf.scene.clone(true);model.position.set(p.x,p.y,p.z);model.scale.setScalar(3);const yaw=model.getObjectByName('YAW');if(yaw)yaw.rotation.y=p.x<0?Math.PI/2:-Math.PI/2;model.name=`Wall-mounted ${key}`;group.add(model);mounted++;}
 })).catch(e=>{error=e.message;});
 const ray=new THREE.Ray(),direction=new THREE.Vector3(),hit=new THREE.Vector3();
 return {group,ready,mountHeight:6,
  intersect(from,to){direction.copy(to).sub(from);const length=direction.length();if(length<1e-6)return null;ray.set(from,direction.divideScalar(length));let distance=length,result=null;for(const box of boxes){if(ray.intersectBox(box,hit)){const d=from.distanceTo(hit);if(d>.001&&d<distance){distance=d;result=hit.clone();}}}return result?{point:result,distance}:null;},
  state:()=>({radius,wallCount:blocks.length,mounted,error,canyonLength:1400,terrain:'planet',floor:'prepared terrace'}),
  dispose(){if(disposed)return;disposed=true;disposeObjects(group);group.removeFromParent();},
 };
}
