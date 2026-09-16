import { missileFrame, sampleMissile, dropFrame, sampleDrop } from './domain/missile-flight.js';
import { sphereMissileFrame, sampleSphereMissile } from './domain/sphere-missile-flight.js';
export { createMissilePool } from './missile-presentation.js';

// All viewers share the asset, timing, profile, ignition and launch snapshot.
// Consumers own targeting/damage and release on arrival or scene reset.
export function launchDart(pool,{config,from,target,direction,scale=1,sphere=false,metre=undefined}) {
  const mesh=pool?.acquire(config.length*scale);
  if(!mesh)return null;
  const m={mesh,config:{...config},target:target.slice(),t:0,sphere,
    frame:(sphere?sphereMissileFrame:missileFrame)(from,target,direction,metre===undefined?{}:{metre})};   // metre: one metre in the scene's units, so the pop-out's cap reads in metres
  advanceDart(pool,m,0);
  return m;
}
export function advanceDart(pool,m,dt,target=m.target) {
  m.target=target.slice();
  m.t=Math.min(m.config.duration,m.t+Math.max(0,dt));
  m.pose=(m.sphere?sampleSphereMissile:sampleMissile)(m.frame,m.t/m.config.duration,m.config.profile,m.target);
  pool.pose(m.mesh,m.pose,m.config.exhaust);
  return m.t>=m.config.duration;
}
// A DROPPED ROUND (the gunship's MK-9): the same pool, the same pose contract, the drop profile instead of the pop-up. `velocity` is
// the launcher's own velocity in scene units per second and `up` the release point's outward normal, so the fall is down the planet.
// The clock is seconds, not a fraction: the free fall is a wall-clock two seconds whatever the range.
export function launchDrop(pool,{config,from,target,velocity=[0,0,0],up=[0,1,0],scale=1,metre=1}) {
  const mesh=pool?.acquire(config.length*scale);
  if(!mesh)return null;
  const m={mesh,config:{...config},target:target.slice(),t:0,drop:true,
    frame:dropFrame(from,target,velocity,{freeFall:config.freeFall,drive:config.drive,gravity:config.gravity,arrivalLead:config.arrivalLead,metre,up})};
  advanceDrop(pool,m,0);
  return m;
}
export function advanceDrop(pool,m,dt,target=m.target) {
  m.target=target.slice();
  m.t=Math.min(m.frame.duration,m.t+Math.max(0,dt));
  m.pose=sampleDrop(m.frame,m.t,m.target);
  pool.pose(m.mesh,m.pose,m.config.exhaust!==false);
  return m.t>=m.frame.duration;
}
