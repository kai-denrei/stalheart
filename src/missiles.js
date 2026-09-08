import { missileFrame, sampleMissile } from './domain/missile-flight.js';
import { sphereMissileFrame, sampleSphereMissile } from './domain/sphere-missile-flight.js';
export { createMissilePool } from './missile-presentation.js';

// All viewers share the asset, timing, profile, ignition and launch snapshot.
// Consumers own targeting/damage and release on arrival or scene reset.
export function launchDart(pool,{config,from,target,direction,scale=1,sphere=false}) {
  const mesh=pool?.acquire(config.length*scale);
  if(!mesh)return null;
  const m={mesh,config:{...config},target:target.slice(),t:0,sphere,
    frame:(sphere?sphereMissileFrame:missileFrame)(from,target,direction)};
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
