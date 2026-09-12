// Drives a light rig and a background colour through the day: the sun
// circles, the hemisphere and sun blend between the rig's own night
// values and a day set, and the background follows. No shadows: this is
// three colours and two intensities a frame.
import * as THREE from '../../vendor/three.module.js';
import { sunAngle, sunDirection, daylightOf } from '../core/daylight.js';
export function createDaylight({ hemi, sun, bg, day, tune, phase = 0 }) {
  const c = (v) => new THREE.Color(v);
  let night = null, p = phase, d = 0, elevation = 0;
  const rebase = () => { night = { hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity], sun: [sun.color.clone(), sun.intensity], bg: bg.clone() }; };
  rebase();
  const dayHemi = [c(day.hemi[0]), c(day.hemi[1])], daySun = c(day.sun[0]), dayBg = c(day.bg), tmp = new THREE.Color();
  function apply() {
    const dir = sunDirection(sunAngle(p, tune.dayShare), tune.tilt); elevation = dir[1]; d = daylightOf(elevation);
    sun.position.set(dir[0], dir[1], dir[2]).multiplyScalar(4);
    hemi.color.copy(night.hemi[0]).lerp(dayHemi[0], d); hemi.groundColor.copy(night.hemi[1]).lerp(dayHemi[1], d); hemi.intensity = night.hemi[2] + (day.hemi[2] - night.hemi[2]) * d;
    sun.color.copy(night.sun[0]).lerp(daySun, d); sun.intensity = night.sun[1] + (day.sun[1] - night.sun[1]) * d * Math.max(0.15, elevation);
    bg.copy(night.bg).lerp(tmp.copy(dayBg), d);
    return d;
  }
  apply();
  return {
    tick(dt) { p = (p + dt / tune.seconds) % 1; return apply(); },
    set(phase) { p = ((phase % 1) + 1) % 1; return apply(); },
    rebase() { rebase(); apply(); },
    state: () => ({ phase: +p.toFixed(4), daylight: +d.toFixed(3), elevation: +elevation.toFixed(3) }),
  };
}
