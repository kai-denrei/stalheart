import * as THREE from '../../vendor/three.module.js';
import { GLTFLoader } from '../../vendor/GLTFLoader.js';
import { cloneSkinned } from '../units.js';
import { yardRoute } from '../domain/yard-route.js';

const ROLES=['astronaut','scientist','worker'];
const LANDMARKS=[['stalheart','Stålheart','terraformer_3000_d0_game.glb',-40,-45],['hugin','Hugin','hugin_launchpad_d0_game.glb',40,-45],['antenna','SKYWARD array','skyward_array.glb',0,-165]];
export function modelBudget(root){let triangles=0,batches=0;root?.traverseVisible(o=>{if(!o.isMesh)return;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);batches+=Array.isArray(o.material)?o.geometry.groups.length:1;});return {triangles:Math.round(triangles),batches};}
export function createAstroDiorama(scene,{tankBounds}){
 const group=new THREE.Group();scene.add(group);const people=new THREE.Group();group.add(people);
 const items=[],prototypes=[],crew=[],errors=[];let disposed=false,enabled=true,time=0,serial=0;
 const settings={count:9,crew:true,stalheart:true,hugin:true,antenna:true,motion:true,gait:'Auto'};
 const loaders=new GLTFLoader(),geometries=new Set(),materials=new Set(),textures=new Set();
 function own(root){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [o.material].flat().filter(Boolean)){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});}
 function label(text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#081418';ctx.fillRect(0,0,512,64);ctx.fillStyle='#d9ffff';ctx.font='28px monospace';ctx.textAlign='center';ctx.fillText(text,256,42);const texture=new THREE.CanvasTexture(c),material=new THREE.SpriteMaterial({map:texture,depthTest:true});textures.add(texture);materials.add(material);const sprite=new THREE.Sprite(material);sprite.scale.set(12,1.5,1);sprite.position.set(x,y,z);return sprite;}
 const ready=Promise.allSettled([
  ...LANDMARKS.map(async([id,name,file,x,z])=>{const gltf=await loaders.loadAsync('assets/models/astro/'+file);own(gltf.scene);if(disposed)return;const root=gltf.scene;root.position.set(x,0,z);group.add(root);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);const marker=label(name,x,4,box.max.z+1);group.add(marker);const mixer=new THREE.AnimationMixer(root);for(const clip of gltf.animations)mixer.clipAction(clip).play();items.push({id,name,root,marker,box,mixer,clips:gltf.animations.map(c=>c.name)});}),
  ...ROLES.map(async id=>{const gltf=await loaders.loadAsync('assets/models/astro/'+id+'_station.glb');own(gltf.scene);if(!disposed)prototypes.push({id,...gltf});})
 ]).then(results=>{for(const r of results)if(r.status==='rejected')errors.push(String(r.reason));if(disposed){release();return;}prototypes.sort((a,b)=>ROLES.indexOf(a.id)-ROLES.indexOf(b.id));rebuild();});
 function stations(){const result=items.filter(i=>settings[i.id]).map(i=>({id:i.id,point:[i.box.getCenter(new THREE.Vector3()).x,i.box.max.z+3]}));const b=tankBounds();result.unshift({id:'mork',point:[b?.max.x+2||8,3]});result.push({id:'assembly',point:[-8,12]});return result;}
 function obstacles(){const b=tankBounds();return [...items.filter(i=>settings[i.id]).map(i=>i.box),...(b?[b]:[])].map(b=>({min:[b.min.x,b.min.z],max:[b.max.x,b.max.z]}));}
 function clip(m,name){if(m.clip===name)return;m.action?.fadeOut(.2);const c=m.clips.find(c=>c.name===name);if(!c)return;m.clip=name;m.action=m.mixer.clipAction(c).reset().fadeIn(.2).play();m.history.add(name);}
 function stopCrew(){for(const m of crew){m.mixer.stopAllAction();m.mixer.uncacheRoot(m.root);m.root.traverse(o=>o.skeleton?.dispose());}crew.length=0;people.clear();}
 function rebuild(){serial++;stopCrew();if(!prototypes.length)return;const places=stations();for(let i=0;i<Math.max(0,Math.min(60,Math.round(settings.count)));i++){const p=prototypes[i%prototypes.length],root=cloneSkinned(p.scene);people.add(root);const at=i%places.length,point=places[at].point;root.position.set(point[0]+(i%3)*.7,0,point[1]+Math.floor(i/places.length)*.8);const m={root,role:p.id,clips:p.animations,mixer:new THREE.AnimationMixer(root),clip:null,history:new Set(),at,turn:i,wait:1+i*.2,route:[],leg:0};crew.push(m);clip(m,['Point','Kneel','Idle'][i%3]);}}
 function travel(m){const places=stations();if(places.length<2)return;m.turn++;m.at=(m.at+1+m.turn%2)%places.length;const target=places[m.at];m.destination=target.id;m.route=yardRoute([m.root.position.x,m.root.position.z],target.point,obstacles());m.leg=1;m.wait=2+(m.turn%4);if(m.route.length<2){m.route=[];clip(m,'Idle');return;}clip(m,m.turn%2?'Walk':'Run');}
 function tick(absoluteTime){const dt=Math.max(0,Math.min(.05,absoluteTime-time));time=absoluteTime;group.visible=enabled;if(!enabled)return;
  for(const i of items){i.root.visible=i.marker.visible=settings[i.id];if(i.root.visible&&settings.motion)i.mixer.update(dt);}
  people.visible=settings.crew;if(!settings.crew||!settings.motion)return;
  for(const m of crew){if(settings.gait!=='Auto'){clip(m,settings.gait);m.mixer.update(dt);continue;}
   if(m.route.length){let remaining=dt*(m.clip==='Run'?3:1.15);while(remaining>0&&m.leg<m.route.length){const goal=m.route[m.leg],dx=goal[0]-m.root.position.x,dz=goal[1]-m.root.position.z,d=Math.hypot(dx,dz);if(d>1e-6)m.root.rotation.y=Math.atan2(dx,dz);const step=Math.min(d,remaining);if(d>0){m.root.position.x+=dx/d*step;m.root.position.z+=dz/d*step;}remaining-=step;if(d<=step+1e-6)m.leg++;else break;}if(m.leg>=m.route.length){m.route=[];clip(m,['Point','Kneel','Idle'][m.turn%3]);}}
   else{m.wait-=dt;if(m.wait<=0)travel(m);}m.mixer.update(dt);
  }
 }
 function release(){stopCrew();for(const i of items){i.mixer.stopAllAction();i.mixer.uncacheRoot(i.root);}for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}
 return {settings,ready,tick,rebuild,setEnabled(on){enabled=on;group.visible=on;},
  focus(name,camera,controls){let target,d;if(name==='Crew'){target=new THREE.Vector3(0,2,0);d=new THREE.Vector3(22,15,32);}else if(name==='Overview'){target=new THREE.Vector3(0,8,-95);d=new THREE.Vector3(145,150,200);}else{const item=items.find(i=>i.id===name.toLowerCase());if(!item)return;target=item.box.getCenter(new THREE.Vector3());const sz=item.box.getSize(new THREE.Vector3()).length();d=new THREE.Vector3(.6,.4,1).normalize().multiplyScalar(sz*1.2);}camera.position.copy(target).add(d);controls.target.copy(target);controls.update();},
  state:()=>({ready:items.length===3&&prototypes.length===3,errors:[...errors],time,serial,crew:crew.map(m=>({role:m.role,clip:m.clip,history:[...m.history],position:m.root.position.toArray(),destination:m.destination})),groups:[...items.map(i=>({id:i.id,visible:enabled&&settings[i.id],...modelBudget(i.root),clips:i.clips,time:i.mixer.time})),{id:'crew',visible:enabled&&settings.crew,...modelBudget(people)}]}),
  dispose(){if(disposed)return;disposed=true;release();group.removeFromParent();}
 };
}
