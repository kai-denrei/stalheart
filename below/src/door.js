import * as THREE from '../vendor/three.module.js';
import {SINKHOLE_THROAT,radius,clamp,smooth,HOLE_SCALE} from './mission.js';
import {caveClearance} from './flare-physics.js';
import {createReedActor} from './reed.js';
import {rimRadius} from './stalheart/sinkhole-shape.js';
import {LOOKS} from './stalheart/looks.js';

// THE DOOR (owner, 2026-10-26, note 7: "both the entrance to the Cave and when coming out should read as exactly the same sinkhole where the Boss fight
// took place"). In Stålheart's page the game's camera dives down the arena's hole to just under its lip before this page shows (src/fx/hole-door.js
// there), and rises from under the lip to the rim after it closes. Here, in that mode only: ISAO starts at the foot of the throat under the hole's axis,
// on rubble the size of the game's sinkhole rubble, under a mouth of sky (a sky-coloured disc over the hole and the rim's dark ring at the throat's
// mouth), the camera looking up at it and tilting down to the cave ahead over `tilt` seconds; the ending's RETURN TO THE SURFACE climbs the same axis
// back to the same disc over `climb` seconds, fading to it, before the outcome is posted. Cheap: one sprite disc, one torus, one instanced rubble pile.
export const DOOR=Object.freeze({
  tilt:2, climb:2, up:1.25,   // seconds; the pitch the camera starts at (looking up the throat), easing to the chase camera's own
  // THE SAME PLANET (owner, 2026-11-02, note 13: "the entrance/exit should look like it belongs to the same planet, maybe with the Nih-Dairia carcass
  // outside"): the disc is the game's night over the arena (the near-black sky the game draws its stars on, a faint navy glow, `stars` of its cells lit),
  // high and wide enough to sit over the carcass; the ring is the bowl's own rock (tronColors' floor); the carcass below
  sky:0x0b1a3a, skyEdge:0x020610, skyY:40, skyR:90, stars:.9965,   // centre and edge colours, metres up, metres wide, the share of the disc's cells left dark
  // THE GAME'S SKY AT THAT MOMENT (Stålheart's round 5, note 10, 2026-11-05): with a handoff (src/handoff.js) the disc takes the game's background colour at its
  // centre (`edge` of it at the rim), its stars as bright as the game's star sky is then, and the surface light the game's hemisphere colours, its strength
  // `light[0]` at night to `light[1]` at noon (the game's daylight 0..1): night or day as the game showed it when the dive began
  edge:.3, light:[.45,1],
  rim:LOOKS.tronColors.floors.room, rimTube:.8,   // the rim's silhouette: a ring of the planet's rock at the throat's mouth
  // NIH-DAIRIA, DEAD (note 13): the cave's own Reed body (reed.js, the rest pose, still), the dead grey of the game's corpses (pearl-enemies death.grey
  // 0.12, matte), `span` times the hole's diameter across as the mother is to her hole in the game (40 m out of a 20 m hole), flattened to `flat` of its
  // height (it lies), its body on the lip at angle `at` with its longest limb laid over the hole `aim` radians off the axis: seen up the throat from the
  // start and from the climb, the axis itself left open to the sky. All of it above the ground's level: out of the throat and the flares' way
  carcass:Object.freeze({grey:.12, span:2, flat:.3, at:-.9, aim:.3}),
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
  const sky=new THREE.Mesh(new THREE.CircleGeometry(DOOR.skyR,48),new THREE.ShaderMaterial({fog:false,depthWrite:false,uniforms:{inner:{value:new THREE.Color(DOOR.sky)},edge:{value:new THREE.Color(DOOR.skyEdge)},stars:{value:DOOR.stars},glow:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;uniform vec3 inner,edge;uniform float stars,glow;void main(){float d=length(vUv-.5)*2.;vec3 c=mix(inner,edge,smoothstep(.0,1.,d));float h=fract(sin(dot(floor(vUv*420.),vec2(12.9898,78.233)))*43758.5453);c+=vec3(.75,.85,1.)*glow*step(stars,h)*(.35+.65*fract(h*91.))*(1.-.6*d);gl_FragColor=vec4(c,1.);}'}));
  sky.rotation.x=Math.PI/2;sky.position.y=DOOR.skyY;group.add(sky);   // facing down: seen from under the hole only (culled from above)
  const rim=new THREE.Mesh(new THREE.TorusGeometry(start.hole+DOOR.rimTube*.5,DOOR.rimTube,8,48),new THREE.MeshBasicMaterial({color:new THREE.Color(...DOOR.rim)}));
  rim.rotation.x=Math.PI/2;rim.position.y=start.mouth;group.add(rim);
  const pile=rubbleRocks(start),rocks=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshStandardMaterial({color:0x1c2a33,roughness:1}),pile.length),dummy=new THREE.Object3D();
  pile.forEach((r,i)=>{dummy.position.set(r.position.x,r.position.y,r.position.z);dummy.rotation.set(r.rotation.x,r.rotation.y,r.rotation.z);dummy.scale.set(r.scale.x,r.scale.y,r.scale.z);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);});
  group.add(rocks);
  const onRubble=rubbleClearance(pile);
  // the rock a flare meets: the cave's, and the rubble's while the door is shown
  const clearance=(p)=>{const c=caveClearance(p);return group.visible?Math.min(c,onRubble(p)):c;};
  let carcass=null;
  function addCarcass(geometry){
    if(carcass)return carcass;const pose=carcassPose(geometry);
    carcass=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:new THREE.Color(DOOR.carcass.grey,DOOR.carcass.grey,DOOR.carcass.grey),roughness:1,metalness:0,fog:false}));
    carcass.name='nih-dairia-carcass';carcass.position.set(pose.position.x,pose.position.y,pose.position.z);carcass.rotation.y=pose.rotationY;carcass.scale.set(pose.scale.x,pose.scale.y,pose.scale.z);carcass.frustumCulled=false;
    group.add(carcass);return carcass;
  }
  // the game's sky at the handoff (skyOf below): the disc's colours and stars; -> the surface light's colours and strength for the world (null: its own)
  let light=null;
  function setSky(game){
    const s=skyOf(game);if(!s)return null;
    sky.material.uniforms.inner.value.setHex(s.inner);sky.material.uniforms.edge.value.setHex(s.edge);sky.material.uniforms.glow.value=s.glow;
    return light=s.light;
  }
  return {group,start,clearance,addCarcass,setSky,show:(on)=>{group.visible=!!on;},stats:()=>({visible:group.visible,start:start.position,floor:start.floor,mouth:start.mouth,skyY:DOOR.skyY,carcass:!!carcass,carcassFrom:carcass?.userData.from??null,sky:{inner:sky.material.uniforms.inner.value.getHex(),edge:sky.material.uniforms.edge.value.getHex(),glow:sky.material.uniforms.glow.value},light})};
}
// the carcass: the Reed's rest pose from its own soft body (reed.js), copied still; and where it lies (carcassPose): scaled so its widest limb-to-limb span
// is DOOR.carcass.span times the hole's diameter (2 x HOLE_SCALE), its body on the lip at DOOR.carcass.at, turned so its longest limb points across the hole
export function carcassGeometry(buffer,meta){
  const source=createReedActor(buffer,meta,0).body.surface.geometry,geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',source.attributes.position.clone());geometry.setIndex(source.index.clone());geometry.computeVertexNormals();return geometry;
}
export function carcassPose(geometry){
  const p=geometry.attributes.position,{span,flat,at,aim}=DOOR.carcass;let tip=0,phi=0,low=Infinity;
  for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));low=Math.min(low,p.getY(i));if(r>tip){tip=r;phi=Math.atan2(p.getZ(i),p.getX(i));}}
  const s=span*2*HOLE_SCALE/(2*tip),lip=HOLE_SCALE*rimRadius(at);
  // Object3D.rotation.y = r takes a direction at angle a (atan2(z, x)) to a - r: the tip's angle to the way across the hole, `aim` off it
  return {scale:{x:s,y:s*flat,z:s},rotationY:phi-(at+Math.PI+aim),position:{x:Math.cos(at)*lip,y:-low*s*flat,z:Math.sin(at)*lip},tip:tip*s,lip};
}
// the game's sky ({ daylight 0..1, bg (hex: its background colour then), stars 0..1 (its star sky's brightness then), hemi [sky hex, ground hex] }) as the door's:
// { inner, edge (hex), glow (the stars' brightness), light { sky, ground (hex), strength } }; null for no sky (the door keeps its own night)
export function skyOf(game){
  if(!game||typeof game!=='object'||!Number.isFinite(game.bg))return null;
  const day=Math.min(1,Math.max(0,Number(game.daylight)||0)),c=new THREE.Color(game.bg),e=c.clone().multiplyScalar(DOOR.edge);
  const hemi=Array.isArray(game.hemi)&&game.hemi.length>=2&&game.hemi.every(Number.isFinite)?game.hemi:null;
  return {inner:c.getHex(),edge:e.getHex(),glow:Math.min(1,Math.max(0,Number.isFinite(game.stars)?game.stars:1-day)),light:hemi?{sky:hemi[0],ground:hemi[1],strength:DOOR.light[0]+(DOOR.light[1]-DOOR.light[0])*day}:null};
}
