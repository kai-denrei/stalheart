import { missileFrame, sampleMissile, dropFrame, sampleDrop } from './domain/missile-flight.js';
import { sphereMissileFrame, sampleSphereMissile } from './domain/sphere-missile-flight.js';
export { createMissilePool } from './missile-presentation.js';

// All viewers share the asset, timing, profile, ignition and launch snapshot.
// Consumers own targeting/damage and release on arrival or scene reset.
export function launchDart(pool,{config,from,target,direction,scale=1,sphere=false,metre=undefined}) {
  const mesh=pool?.acquire(config.length*scale);
  if(!mesh)return null;
  const m={mesh,config:{...config},target:target.slice(),launchTarget:target.slice(),t:0,sphere,
    frame:(sphere?sphereMissileFrame:missileFrame)(from,target,direction,metre===undefined?{}:{metre})};   // metre: one metre in the scene's units, so the pop-out's cap reads in metres
  advanceDart(pool,m,0);
  return m;
}
export function advanceDart(pool,m,dt,target=m.target) {
  // THE CLIMB IS BLIND, THE DIVE HOMES (owner, 2026-10-05: "sometimes it seems like it is adjusting its trajectory laterally after
  // having been shot, that should be impossible. it only hones into the target from the apex"). The curve's end is pulled toward the
  // target as the round goes, so a live target moving under the climb bent it sideways. Up to the crest it flies at where the target was
  // at launch; from the crest the live target is eased in over the rest of the flight, so the path never jumps
  const past=/^(Crest|Hook|Dive)$/.test(m.pose?.phase??'');
  if(past&&m.crestT==null)m.crestT=m.t;
  const w=past?Math.min(1,(m.t-m.crestT)/Math.max(1e-6,m.config.duration-m.crestT)):0,e=w*w*(3-2*w);
  m.target=m.launchTarget?m.launchTarget.map((v,i)=>v+(target[i]-v)*e):target.slice();
  // THE PLUNGE (owner, 2026-10-03: "once it reaches the apex and starts going down it should be very fast"): past its crest a round with
  // `diveRate` runs its clock that many times faster, so the lit descent snaps down and lands sooner; the climb is untouched
  const k=m.config.diveRate&&/^(Crest|Hook|Dive)$/.test(m.pose?.phase??'')?m.config.diveRate:1;
  m.t=Math.min(m.config.duration,m.t+Math.max(0,dt)*k);
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
