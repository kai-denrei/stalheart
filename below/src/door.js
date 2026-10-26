import * as THREE from '../vendor/three.module.js';
import {SINKHOLE_THROAT,radius,clamp,smooth} from './mission.js';
import {caveClearance} from './flare-physics.js';

// THE DOOR (owner, 2026-10-26, note 7: "both the entrance to the Cave and when coming out should read as exactly the same sinkhole where the Boss fight
// took place"). In Stålheart's page the game's camera dives down the arena's hole to just under its lip before this page shows (src/fx/hole-door.js
// there), and rises from under the lip to the rim after it closes. Here, in that mode only: ISAO starts at the foot of the throat under the hole's axis,
// on rubble the size of the game's sinkhole rubble, under a mouth of sky (a sky-coloured disc over the hole and the rim's dark ring at the throat's
// mouth), the camera looking up at it and tilting down to the cave ahead over `tilt` seconds; the ending's RETURN TO THE SURFACE climbs the same axis
// back to the same disc over `climb` seconds, fading to it, before the outcome is posted. Cheap: one sprite disc, one torus, one instanced rubble pile.
export const DOOR=Object.freeze({
  tilt:2, climb:2, up:1.25,   // seconds; the pitch the camera starts at (looking up the throat), easing to the chase camera's own
  sky:0x6f8fbf, skyEdge:0x223a66, skyY:6, skyR:40,   // the planet's sky (tronColors' hemisphere sky, lit): the disc over the hole, metres up, metres wide
  rim:0x0b0f0d, rimTube:.8,   // the rim's silhouette: a ring of dark rock at the throat's mouth
  // the game's sinkhole rubble (src/breach-rubble.js there): one rock at 0.55 of the hole's radius, the rest 0.23-0.39 of it; here the hole is the throat
  rubble:Object.freeze({count:9,big:.55,small:.23,spread:.16}),
  hover:1.1,   // metres ISAO hovers over the rubble's top
});
// the foot of the throat: the floor straight down the hole's axis (x = z = 0), the rubble's top over it, ISAO over that
export function doorStart(clearance=caveClearance){
  let y=SINKHOLE_THROAT-1;while(clearance({x:0,y,z:0})>0&&y>SINKHOLE_THROAT-80)y-=.05;
  const hole=radius(0),top=y+hole*DOOR.rubble.big;   // the big rock's top: centred size*0.35 up, half its height (0.65 of its size) above that
  return {floor:y,rubbleTop:top,position:{x:0,y:top+DOOR.hover,z:0},hole,mouth:SINKHOLE_THROAT};
}
export const tiltAt=(seconds)=>smooth(0,DOOR.tilt,seconds);   // 0 looking up the throat, 1 the chase camera's view
// the climb out: the camera from the foot up the axis to the throat's mouth, looking up; the sky's fade over the second half
export function climbAt(seconds,start=doorStart()){
  const u=clamp(seconds/DOOR.climb,0,1),k=u*u*(3-2*u);
  return {y:start.position.y+(start.mouth-start.position.y)*k,fade:smooth(.5,1,u),done:u>=1};
}
// the rubble pile's rocks (the game's sizes, scattered round the axis), and their clearance: the flares land on them (src/flares.js), ISAO hovers over them
export function rubbleRocks(start=doorStart()){
  const {count,big,small,spread}=DOOR.rubble,rocks=[];
  for(let i=0;i<count;i++){
    const size=start.hole*(i===0?big:small+spread*(.5+.5*Math.sin(i*7))),a=i*2.4,r=i===0?0:start.hole*(.35+.25*Math.sin(i*3.1));
    rocks.push({position:{x:Math.cos(a)*r,y:start.floor+size*.35,z:Math.sin(a)*r},rotation:{x:i*.7,y:i*1.3,z:i*.2},scale:{x:size*1.5,y:size*.65,z:size}});
  }
  return rocks;
}
const INSCRIBED=.8;   // a unit dodecahedron's faces lie 0.79 from its centre: the rock as an ellipsoid that size
export function rubbleClearance(rocks){
  const inverse=rocks.map((r)=>new THREE.Matrix4().compose(new THREE.Vector3(r.position.x,r.position.y,r.position.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(r.rotation.x,r.rotation.y,r.rotation.z)),new THREE.Vector3(r.scale.x,r.scale.y,r.scale.z)).invert()),q=new THREE.Vector3();
  const least=rocks.map((r)=>Math.min(r.scale.x,r.scale.y,r.scale.z));
  return (p)=>{let best=Infinity;for(let i=0;i<rocks.length;i++){q.set(p.x,p.y,p.z).applyMatrix4(inverse[i]);best=Math.min(best,(q.length()-INSCRIBED)*least[i]);}return best;};
}
export function createDoor(scene){
  const start=doorStart(),group=new THREE.Group();group.name='door';group.visible=false;scene.add(group);
  const sky=new THREE.Mesh(new THREE.CircleGeometry(DOOR.skyR,48),new THREE.ShaderMaterial({fog:false,depthWrite:false,uniforms:{inner:{value:new THREE.Color(DOOR.sky)},edge:{value:new THREE.Color(DOOR.skyEdge)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 inner,edge;void main(){float d=length(vUv-.5)*2.;gl_FragColor=vec4(mix(inner,edge,smoothstep(.0,1.,d)),1.);}'}));
  sky.rotation.x=Math.PI/2;sky.position.y=DOOR.skyY;group.add(sky);   // facing down: seen from under the hole only (culled from above)
  const rim=new THREE.Mesh(new THREE.TorusGeometry(start.hole+DOOR.rimTube*.5,DOOR.rimTube,8,48),new THREE.MeshBasicMaterial({color:DOOR.rim}));
  rim.rotation.x=Math.PI/2;rim.position.y=start.mouth;group.add(rim);
  const pile=rubbleRocks(start),rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x1c2a33,roughness:1}),pile.length),dummy=new THREE.Object3D();
  pile.forEach((r,i)=>{dummy.position.set(r.position.x,r.position.y,r.position.z);dummy.rotation.set(r.rotation.x,r.rotation.y,r.rotation.z);dummy.scale.set(r.scale.x,r.scale.y,r.scale.z);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);});
  group.add(rocks);
  const onRubble=rubbleClearance(pile);
  // the rock a flare meets: the cave's, and the rubble's while the door is shown
  const clearance=(p)=>{const c=caveClearance(p);return group.visible?Math.min(c,onRubble(p)):c;};
  return {group,start,clearance,show:(on)=>{group.visible=!!on;},stats:()=>({visible:group.visible,start:start.position,floor:start.floor,mouth:start.mouth,skyY:DOOR.skyY})};
}
