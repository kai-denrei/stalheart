import { A6_TUNE } from './heptapod.js';
// Adapt shared combat/content inputs to a manually operated range.
// No roster or persisted defaults live here. Environment owns gravity/wind/sway.
export function manualWeapon(def, stats, profile, missile, metresPerCell) {
  const kind=profile.shot.kind;
  return {
    id:def.key, label:def.label, kind, pierce:!!def.pierce, model:def.model, sound:def.fire,
    cooldown:def.attack==='walker'?A6_TUNE.salvoGap:1/stats.rate, damage:stats.dmg, splash:(stats.splash||0)*metresPerCell,
    range:missile ? missile.maxRange*(stats.range/def.range) : stats.range*metresPerCell,
    minRange:missile?.minRange||0,
    muzzleVel:profile.shot.projSpeed*metresPerCell || 1,
    hitscan:kind==='lance'||kind==='throw', loft:kind==='lob',
    homing:kind==='seeker', lock:kind==='seeker', field:kind==='field', charge:0,
  };
}
