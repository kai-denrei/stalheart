export const STATIONS=[-1,1].flatMap(side=>[9,3,-3,-9].map((z,i)=>({id:(side<0?'L':'R')+(i+1),side,z})));
export const SPEC={wheel_radius_m:1.82,wheel_source_scale:3.6,half_track_m:16,arm_length_m:3,arm_drop_m:2.4,arm_trail_m:1.8,pivot_height_m:4.22,compression_m:[-.55,.55],gantry_raise_m:3.9,chassis_raise_m:1.6,cycle_s:16};
const refs=new WeakMap(),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function stateAt(time,mode='park'){
 const w=time*Math.PI*2/16,k=Math.PI*2/16,s={time,mode,x:0,z:0,yaw:0,vx:0,vz:0,omega:0,distance:0,turnAngle:0,compression:{},fabricate:mode==='fabricate'};
 if(mode==='drive'){s.z=10*Math.sin(w);s.vz=10*k*Math.cos(w);s.distance=s.z;}
 if(mode==='crab'){s.x=8*Math.sin(w);s.vx=8*k*Math.cos(w);s.distance=s.x;}
 if(mode==='turn'){s.yaw=w;s.omega=k;s.turnAngle=w;}
 if(mode==='suspension')for(const [i,l]of STATIONS.entries())s.compression[l.id]=.48*Math.sin(w+i*.77);
 return s;
}
function cache(root){let c=refs.get(root);if(c)return c;const n=name=>root.getObjectByName(name);c={root,body:n('BODY_HEAVE'),gantry:n('GANTRY_TRAVEL_Y'),carriage:n('CARRIAGE_TRAVEL_X'),lift:n('TOOL_LIFT_Z'),j:[1,2,3,4,5,6].map((_,i)=>n(['J1_BASE_YAW','J2_SHOULDER','J3_ELBOW','J4_FOREARM_ROLL','J5_WRIST_PITCH','J6_TOOL_ROLL'][i])),feed:[n('FEED_HOSE_1'),n('FEED_HOSE_2')],wheels:STATIONS.map(l=>({...l,pivot:n('SUSP_PIVOT_'+l.id),upright:n('UPRIGHT_'+l.id),steer:n('WHEEL_STEER_'+l.id),spin:n('WHEEL_SPIN_'+l.id),top:n('SOCKET_DAMPER_UPPER_'+l.id),bottom:n('SOCKET_DAMPER_LOWER_'+l.id),aim:n('DAMPER_AIM_'+l.id),rod:n('DAMPER_ROD_'+l.id),contact:n('SOCKET_CONTACT_'+l.id)}))};refs.set(root,c);return c;}
export function applyKidou(T,scene,{time=0,mode='park',vx=0,vz=0,omega=0,distance=0,turnAngle=0,steerDeg=0,compression={},bias=0,terrain=null,carriageX=0}={}){
 const root=scene.getObjectByName('STALHEART_KIDOU_ROOT');if(!root)throw new Error('STALHEART_KIDOU_ROOT missing');if(root.userData.static)return{static:true};const c=cache(root);root.updateMatrixWorld(true);
 c.body.position.y=0;
 if(terrain){let sum=0;for(const l of c.wheels){const v=new T.Vector3(l.side*SPEC.half_track_m,0,l.z).applyMatrix4(root.matrixWorld);sum+=terrain(v.x,v.z)-root.position.y;}c.body.position.y=sum/8;}
 root.updateMatrixWorld(true);let residual=0;
 for(const l of c.wheels){
  let travel=clamp((compression[l.id]||0)+bias,...SPEC.compression_m);
  if(terrain){for(let j=0;j<6;j++){const y=-2.4+travel,z=Math.sqrt(9-y*y),v=c.body.localToWorld(new T.Vector3(l.side*SPEC.half_track_m,0,l.z-1.8+z));travel=clamp(terrain(v.x,v.z)-root.position.y-c.body.position.y,...SPEC.compression_m);}}
  const y=-2.4+travel,z=Math.sqrt(9-y*y),a=Math.atan2(1.8,2.4)-Math.atan2(z,-y);l.pivot.rotation.x=a;l.upright.rotation.x=-a;
  const wx=vx+omega*l.z,wz=vz-omega*l.side*SPEC.half_track_m;let steering=Math.atan2(wx,wz),sign=1;
  if(Math.abs(steering)>Math.PI/2){steering-=Math.sign(steering)*Math.PI;sign=-1;}
  if(mode==='drive')steering=0;else if(mode==='crab')steering=Math.PI/2;else if(!wx&&!wz)steering=steerDeg*Math.PI/180;
  l.steer.rotation.y=steering;l.spin.rotation.x=(omega?turnAngle*Math.hypot(l.side*SPEC.half_track_m,l.z)*sign:distance)/SPEC.wheel_radius_m;
  l.travel=travel;l.speed=mode==='drive'?vz:mode==='crab'?vx:Math.hypot(wx,wz)*sign;
 }
 const moving=['drive','crab','turn'].includes(mode),printing=mode==='fabricate',w=time*Math.PI*2/16;
 c.carriage.position.x=carriageX+(printing?1.45*Math.sin(w):0);
 c.lift.position.y=moving?-2.4:-(8.85+SPEC.chassis_raise_m)+(printing?.18*(1-Math.cos(w*2)):0);
 c.j[0].rotation.set(0,printing?.08*Math.sin(w*2):0,0);c.j[1].rotation.set(0,0,-.5);c.j[2].rotation.set(0,0,1.05);c.j[3].rotation.set(0,0,0);c.j[4].rotation.set(0,0,-.55);c.j[5].rotation.set(0,printing?time*.3:0,0);
 root.updateMatrixWorld(true);
 for(const l of c.wheels){const a=l.top.getWorldPosition(new T.Vector3()),b=l.bottom.getWorldPosition(new T.Vector3());c.body.worldToLocal(a);c.body.worldToLocal(b);const d=b.clone().sub(a);l.aim.position.copy(a);const up=d.clone().normalize(),right=new T.Vector3().crossVectors(up,Math.abs(up.z)<.9?new T.Vector3(0,0,1):new T.Vector3(1,0,0)).normalize(),forward=new T.Vector3().crossVectors(right,up);l.aim.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,forward));l.rod.position.y=d.length();l.aim.userData.length_m=d.length();}
 root.updateMatrixWorld(true);
 for(let i=0;i<2;i++){const end=c.carriage.localToWorld(new T.Vector3(.6+i*.35,0,.7));c.gantry.worldToLocal(end);const key=end.toArray().map(v=>v.toFixed(5)).join(',');if(c.feed[i].userData.endpoint!==key){const curve=new T.CubicBezierCurve3(new T.Vector3(5+i*.35,28.5,-.4),new T.Vector3(9+i*.35,31,2),end.clone().add(new T.Vector3(4,2.2,.3)),end);c.feed[i].geometry.dispose();c.feed[i].geometry=new T.TubeGeometry(curve,root.userData.lod===0?32:16,.13,root.userData.lod===0?8:5,false);c.feed[i].geometry.deleteAttribute('uv');const color=new T.Color(0x26343d),colors=new Float32Array(c.feed[i].geometry.attributes.position.count*3);for(let j=0;j<colors.length;j+=3)color.toArray(colors,j);c.feed[i].geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));c.feed[i].userData.endpoint=key;}}
 root.updateMatrixWorld(true);
 if(terrain)for(const l of c.wheels){const p=l.contact.getWorldPosition(new T.Vector3());residual=Math.max(residual,Math.abs(p.y-terrain(p.x,p.z)));}
 c.maxContactError=residual;return c;
}
