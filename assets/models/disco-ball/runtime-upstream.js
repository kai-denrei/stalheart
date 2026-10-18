import {discoState,applyDisco,DURATION,PARTY_COLORS} from '../disco-ball/runtime.js';

export {DURATION,PARTY_COLORS};

export const REST_HOOK_WORLD=[0.0528,11.6288,2.6];
export const HOOK_LOCAL_OFFSET=[0,6.2,0];

export function celebrationState(time,options={}){
  const s=discoState(time,options);
  const w=(s.time/DURATION)*Math.PI*2;
  return {
    ...s,
    gantryZ:Math.sin(w)*3.2,
    carriageX:Math.sin(w*2)*2.4,
    liftY:1.87+Math.cos(w*2)*0.35,
    j1Yaw:Math.sin(w)*0.25,
    j2Shoulder:-0.5,
    j3Elbow:1.05,
    j5Wrist:-0.55,
    morkTurretYaw:Math.sin(w*2)*0.65,
    morkGunPitch:-0.28-0.12*Math.abs(Math.sin(w*4)),
    isaoBounceY:Math.abs(Math.sin(w*8))*0.22,
    isaoYaw:Math.sin(w*2)*0.45
  };
}

export function applyStalheartCelebration(T,refs,time,lod=1,options={}){
  const s=celebrationState(time,options);
  const {stalheart,disco,mork,isao}=refs;
  if(stalheart&&lod<2){
    const gantry=stalheart.getObjectByName('GANTRY_TRAVEL_Y');
    const carriage=stalheart.getObjectByName('CARRIAGE_TRAVEL_X');
    const lift=stalheart.getObjectByName('TOOL_LIFT_Z');
    const j1=stalheart.getObjectByName('J1_BASE_YAW');
    const j2=stalheart.getObjectByName('J2_SHOULDER');
    const j3=stalheart.getObjectByName('J3_ELBOW');
    const j4=stalheart.getObjectByName('J4_FOREARM_ROLL');
    const j5=stalheart.getObjectByName('J5_WRIST_PITCH');
    const j6=stalheart.getObjectByName('J6_TOOL_ROLL');
    if(gantry)gantry.position.set(0,0,s.gantryZ);
    if(carriage)carriage.position.set(s.carriageX,25.8,2.6);
    if(lift)lift.position.set(0,s.liftY,0);
    if(j1)j1.rotation.set(0,s.j1Yaw,0);
    if(j2)j2.rotation.set(0,0,s.j2Shoulder);
    if(j3)j3.rotation.set(0,0,s.j3Elbow);
    if(j4)j4.rotation.set(0,0,0);
    if(j5)j5.rotation.set(0,0,s.j5Wrist);
    if(j6)j6.rotation.set(0,0,0);
    stalheart.updateMatrixWorld(true);
  }
  let hookPos=new T.Vector3(...REST_HOOK_WORLD);
  if(stalheart&&lod<2){
    const tip=stalheart.getObjectByName('EXTRUSION_TIP');
    if(tip)tip.getWorldPosition(hookPos);
  }
  if(disco){
    applyDisco(disco,time,lod,{...options,hanging:true});
    const cradle=disco.getObjectByName('STANDALONE_CRADLE');
    if(cradle)cradle.visible=false;
    disco.position.set(
      hookPos.x-HOOK_LOCAL_OFFSET[0],
      hookPos.y-HOOK_LOCAL_OFFSET[1],
      hookPos.z-HOOK_LOCAL_OFFSET[2]
    );
    disco.updateMatrixWorld(true);
  }
  if(mork&&lod<2){
    const turret=mork.getObjectByName('TURRET_YAW');
    const gun=mork.getObjectByName('GUN_PITCH');
    if(turret)turret.rotation.y=s.morkTurretYaw;
    if(gun)gun.rotation.x=s.morkGunPitch;
    mork.updateMatrixWorld(true);
  }
  if(isao&&lod<2){
    isao.position.y=s.isaoBounceY;
    isao.rotation.y=-0.6+s.isaoYaw;
    isao.updateMatrixWorld(true);
  }
  return {...s,hookWorld:hookPos.toArray()};
}
