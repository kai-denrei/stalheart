// Dependency-injected articulated adapter. All inventory/navigation belongs to the caller.
export const WHEELS=[...[-1,1].flatMap(side=>[-2.9,-.25,2.4].map((z,i)=>({id:(side<0?'L':'R')+(i+1),side,z})))];
export const BELT={bottom:[0,.69,4.72],top:[0,2.65,1.35],radius:.19,count:24};
export const SPEC={wheel_radius_m:.76,suspension_arm_m:1,suspension_mount_y_m:1.45,tank_count:2,capacity_demo:100,units:'demo biomass units; balance is game-owned'};
export function beltPoint(distance){
 const b=BELT.bottom,t=BELT.top,L=Math.hypot(t[1]-b[1],t[2]-b[2]),u=[(t[1]-b[1])/L,(t[2]-b[2])/L],n=[-u[1],u[0]],r=BELT.radius,total=2*L+2*Math.PI*r;
 let s=((distance%total)+total)%total,y,z,dy,dz;
 if(s<L){y=b[1]+u[0]*s+n[0]*r;z=b[2]+u[1]*s+n[1]*r;dy=u[0];dz=u[1];}
 else if((s-=L)<Math.PI*r){const a=s/r;y=t[1]+r*(n[0]*Math.cos(a)+u[0]*Math.sin(a));z=t[2]+r*(n[1]*Math.cos(a)+u[1]*Math.sin(a));dy=-n[0]*Math.sin(a)+u[0]*Math.cos(a);dz=-n[1]*Math.sin(a)+u[1]*Math.cos(a);}
 else if((s-=Math.PI*r)<L){y=t[1]-u[0]*s-n[0]*r;z=t[2]-u[1]*s-n[1]*r;dy=-u[0];dz=-u[1];}
 else{const a=(s-L)/r;y=b[1]+r*(-n[0]*Math.cos(a)-u[0]*Math.sin(a));z=b[2]+r*(-n[1]*Math.cos(a)-u[1]*Math.sin(a));dy=n[0]*Math.sin(a)-u[0]*Math.cos(a);dz=n[1]*Math.sin(a)-u[1]*Math.cos(a);}
 return{y,z,angle:Math.atan2(dz,dy),length:total,straight:L};
}
export function createRoverController(T,scene){
 const root=scene.getObjectByName('YUSHIROVER_ROOT'),node=n=>root.getObjectByName(n),body=node('CHASSIS_SUSPENSION'),v=new T.Vector3(),down=new T.Vector3(0,-1,0);
 if(!root)throw new Error('Missing YUSHIROVER_ROOT');const stat=root.userData.static;
 const wheels=WHEELS.map(w=>({...w,swing:node('SUSPENSION_'+w.id+'_SWING'),upright:node('SUSPENSION_'+w.id+'_UPRIGHT'),steer:node('WHEEL_'+w.id+'_STEER'),roll:node('WHEEL_'+w.id+'_ROLL'),damper:node('SUSPENSION_'+w.id+'_DAMPER'),rod:node('SUSPENSION_'+w.id+'_ROD')}));
 const slats=Array.from({length:BELT.count},(_,i)=>node('CONVEYOR_SLAT_'+String(i).padStart(2,'0')));
 const tanks=[0,1].map(i=>({g:node('TANK_'+i+'_ISOLATOR'),level:node('TANK_'+i+'_LEVEL'),needle:node('TANK_'+i+'_GAUGE_NEEDLE'),valve:node('TANK_'+i+'_VALVE')}));
 return{root,body,wheels,static:stat,
 update({time=0,distance=0,beltDistance=0,fill=0,harvesting=false,unloading=false,steering=0,wheelTravel=null,wheelSteer=null,terrain=()=>0,suspension=1}={}){
  if(stat)return;fill=T.MathUtils.clamp(fill,0,1);body.position.y=0;body.rotation.set(0,0,0);root.updateMatrixWorld(true);
  const heights=WHEELS.map(w=>{v.set(w.side*2.36,0,w.z+body.position.z).applyMatrix4(root.matrixWorld);return terrain(v.x,v.z);});
  body.position.y=heights.reduce((a,b)=>a+b,0)/6;
  body.rotation.x=((heights[0]+heights[3])-(heights[2]+heights[5]))/10.6*suspension;
  body.rotation.z=((heights[3]+heights[4]+heights[5])-(heights[0]+heights[1]+heights[2]))/14.2*suspension;
  root.updateMatrixWorld(true);
  for(const [wi,w]of wheels.entries()){
   // Solve wheel-ground contact on the actual terrain, with a rigid one-metre swing arm.
   let lo=.2,hi=1.2;for(let i=0;i<18;i++){const a=(lo+hi)/2;v.set(w.side*(1.6+Math.cos(a)),1.45-Math.sin(a),w.z).applyMatrix4(body.matrixWorld);if(v.y>terrain(v.x,v.z)+SPEC.wheel_radius_m)lo=a;else hi=a;}
   const angle=(lo+hi)/2;w.swing.rotation.z=-w.side*angle;w.upright.rotation.z=w.side*angle-body.rotation.z;w.upright.rotation.x=-body.rotation.x;w.steer.rotation.y=wheelSteer?.[wi]??steering*(w.z/2.9);w.roll.rotation.x=(wheelTravel?.[wi]??distance)/SPEC.wheel_radius_m;
   const end=new T.Vector3(w.side*(1.6+Math.cos(angle)),1.45-Math.sin(angle),w.z-.25),d=end.sub(w.damper.position);w.damper.quaternion.setFromUnitVectors(down,d.clone().normalize());w.rod.position.y=-d.length();
  }
  const loop=beltPoint(0).length;slats.forEach((g,i)=>{const p=beltPoint(beltDistance+i*loop/BELT.count);g.position.set(0,p.y,p.z);g.rotation.x=p.angle;});
  node('BELT_LOWER_ROLL').rotation.x=-beltDistance/BELT.radius;node('BELT_UPPER_ROLL').rotation.x=-beltDistance/BELT.radius;node('PICKUP_ROTOR_ROLL').rotation.x=-beltDistance/.32;
  for(const [i,t]of tanks.entries()){t.needle.rotation.z=2.3-fill*4.6;t.level.scale.z=Math.max(.001,fill);t.level.visible=fill>0;t.valve.rotation.y=unloading?Math.PI/2:0;t.g.position.y=2.55+(harvesting?Math.sin(time*9+i)*.012:0);}
  body.updateMatrixWorld(true);
 },socket(name){return node(name)?.getWorldPosition(new T.Vector3());}};
}
