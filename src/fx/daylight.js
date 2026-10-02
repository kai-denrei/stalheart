// Drives a light rig and a background colour through the day: the sun
// circles, the hemisphere and sun blend between the rig's own night
// values and a day set, and the background follows. No shadows: this is
// three colours and two intensities a frame.
// A BETTER DAY (owner, 2026-10-02, seventh notes: "Need to improve day night cycle"). The blend had two keys, night and noon, so a
// sunset was a dimmer switch. Now the hour near the horizon has its own colour (`tune.dusk`: a low orange sun, a violet sky and fill,
// strongest as the sun crosses the horizon and gone `duskBand` of elevation either side), and the sky shows what is happening: a sun
// disc with a halo where the light comes from and a pale moon opposite, both far out and depth-tested, so the planet's own horizon
// hides them and the player sees the sun go down behind the rock. Added to the light's parent; restore() takes them out.
import * as THREE from '../../vendor/three.module.js';
import { sunAngle, sunDirection, daylightOf } from '../core/daylight.js';
export function createDaylight({ hemi, sun, bg, day, tune, phase = 0 }) {
  const c = (v) => new THREE.Color(v);
  let night = null, p = phase, d = 0, elevation = 0;
  const rebase = () => { night = { hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity], sun: [sun.color.clone(), sun.intensity], bg: bg.clone() }; };
  rebase();
  const dayHemi = [c(day.hemi[0]), c(day.hemi[1])], daySun = c(day.sun[0]), dayBg = c(day.bg), tmp = new THREE.Color();
  const dusk = tune.dusk ? { sun: c(tune.dusk.sun), sky: c(tune.dusk.sky), bg: c(tune.dusk.bg), share: tune.dusk.share, band: tune.dusk.band } : null;
  const discs = tune.discs && sun.parent ? makeDiscs(sun.parent, tune.discs) : null;
  let g = 0;
  function apply() {
    const dir = sunDirection(sunAngle(p, tune.dayShare), tune.tilt); elevation = dir[1]; d = daylightOf(elevation);
    sun.position.set(dir[0], dir[1], dir[2]).multiplyScalar(4);
    hemi.color.copy(night.hemi[0]).lerp(dayHemi[0], d); hemi.groundColor.copy(night.hemi[1]).lerp(dayHemi[1], d); hemi.intensity = night.hemi[2] + (day.hemi[2] - night.hemi[2]) * d;
    sun.color.copy(night.sun[0]).lerp(daySun, d); sun.intensity = night.sun[1] + (day.sun[1] - night.sun[1]) * d * Math.max(0.15, elevation);
    bg.copy(night.bg).lerp(tmp.copy(dayBg), d);
    g = dusk ? Math.max(0, 1 - Math.abs(elevation - 0.04) / dusk.band) ** 1.5 * dusk.share : 0;   // the golden hour, either side of the horizon
    if (g > 0) { sun.color.lerp(dusk.sun, g); hemi.color.lerp(dusk.sky, g * 0.7); bg.lerp(dusk.bg, g); }
    discs?.place(dir, g);
    return d;
  }
  apply();
  return {
    tick(dt) { p = (p + dt / tune.seconds) % 1; return apply(); },
    set(phase) { p = ((phase % 1) + 1) % 1; return apply(); },
    rebase() { rebase(); apply(); },
    // the rig's night back on the lights, before another rig is built over them (2026-09-25: a NEW RUN at noon took noon for night)
    restore() { discs?.dispose(); hemi.color.copy(night.hemi[0]); hemi.groundColor.copy(night.hemi[1]); hemi.intensity = night.hemi[2]; sun.color.copy(night.sun[0]); sun.intensity = night.sun[1]; bg.copy(night.bg); },
    state: () => ({ phase: +p.toFixed(4), daylight: +d.toFixed(3), elevation: +elevation.toFixed(3), dusk: +g.toFixed(3), sunShown: !!discs }),
  };
}

// a soft round glow, white at the centre: the sun's and the moon's sprite, tinted by the material
function glowTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.16, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// the sun and the moon in the sky: `distance` from the planet's centre along the light, `size` their sprites' width there
function makeDiscs(parent, { distance, sunSize, moonSize, sun: sunHex, low: lowHex, moon: moonHex }) {
  if (typeof document === 'undefined') return null;
  const tex = glowTexture(), mk = (hex, size) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: hex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.scale.setScalar(size); m.renderOrder = -1; parent.add(m); return m; };
  const sunS = mk(sunHex, sunSize), moonS = mk(moonHex, moonSize), noon = new THREE.Color(sunHex), low = new THREE.Color(lowHex);
  return {
    place(dir, g) {
      sunS.position.set(dir[0], dir[1], dir[2]).multiplyScalar(distance);
      moonS.position.set(-dir[0], -dir[1], -dir[2]).multiplyScalar(distance);
      sunS.material.color.copy(noon).lerp(low, Math.min(1, g * 1.6));
      sunS.scale.setScalar(sunSize * (1 + 0.5 * g));   // a low sun swells
    },
    dispose() { for (const m of [sunS, moonS]) { parent.remove(m); m.material.dispose(); } tex.dispose(); },
  };
}
