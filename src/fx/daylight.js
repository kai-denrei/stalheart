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
export { dayFlag } from '../core/daylight.js';   // td-tab reads the ?day= flag through this module (no new import line there)
import { sunAngle, sunDirection, daylightOf, phaseGlyph } from '../core/daylight.js';
// `dayNo`: the day the run opens on (1 on the first dawn; the rig adds one each time the phase wraps). `dial`: an element the HUD's day dial goes in (owner, 2026-10-03: "a small day/night cycle moving animation in the main hud ... a circle
// getting increasingly darker and brighter"): a disc lit by the daylight, warm at the golden hour, the day's number under it
export function createDaylight({ hemi, sun, bg, day, tune, phase = 0, dayNo = 1, dial = null }) {
  const c = (v) => new THREE.Color(v);
  let night = null, p = phase, d = 0, elevation = 0, days = Math.max(1, Math.floor(dayNo));
  const rebase = () => { night = { hemi: [hemi.color.clone(), hemi.groundColor.clone(), hemi.intensity], sun: [sun.color.clone(), sun.intensity], bg: bg.clone() }; };
  rebase();
  const dayHemi = [c(day.hemi[0]), c(day.hemi[1])], daySun = c(day.sun[0]), dayBg = c(day.bg), tmp = new THREE.Color();
  const dusk = tune.dusk ? { sun: c(tune.dusk.sun), sky: c(tune.dusk.sky), bg: c(tune.dusk.bg), share: tune.dusk.share, band: tune.dusk.band } : null;
  const discs = tune.discs && sun.parent ? makeDiscs(sun.parent, tune.discs) : null, face = dial ? makeDial(dial) : null;
  let g = 0;
  function apply() {
    const dir = sunDirection(sunAngle(p, tune.dayShare), tune.tilt); elevation = dir[1]; d = daylightOf(elevation);
    sun.position.set(dir[0], dir[1], dir[2]).multiplyScalar(4);
    hemi.color.copy(night.hemi[0]).lerp(dayHemi[0], d); hemi.groundColor.copy(night.hemi[1]).lerp(dayHemi[1], d); hemi.intensity = night.hemi[2] + (day.hemi[2] - night.hemi[2]) * d;
    sun.color.copy(night.sun[0]).lerp(daySun, d); sun.intensity = night.sun[1] + (day.sun[1] - night.sun[1]) * d * Math.max(0.15, elevation);
    bg.copy(night.bg).lerp(tmp.copy(dayBg), d);
    g = dusk ? Math.max(0, 1 - Math.abs(elevation - 0.04) / dusk.band) ** 1.5 * dusk.share : 0;   // the golden hour, either side of the horizon
    if (g > 0) { sun.color.lerp(dusk.sun, g); hemi.color.lerp(dusk.sky, g * 0.7); bg.lerp(dusk.bg, g); }
    discs?.place(dir, g); face?.set(p, g, days, tune.dayShare);
    return d;
  }
  apply();
  return {
    tick(dt) { const np = p + dt / tune.seconds; if (np >= 1) days += Math.floor(np); p = ((np % 1) + 1) % 1; return apply(); },
    set(phase) { p = ((phase % 1) + 1) % 1; return apply(); },
    day: () => days,
    rebase() { rebase(); apply(); },
    // the rig's night back on the lights, before another rig is built over them (2026-09-25: a NEW RUN at noon took noon for night)
    restore() { discs?.dispose(); face?.dispose(); hemi.color.copy(night.hemi[0]); hemi.groundColor.copy(night.hemi[1]); hemi.intensity = night.hemi[2]; sun.color.copy(night.sun[0]); sun.intensity = night.sun[1]; bg.copy(night.bg); },
    state: () => ({ phase: +p.toFixed(4), day: days, daylight: +d.toFixed(3), elevation: +elevation.toFixed(3), dusk: +g.toFixed(3), sunShown: !!discs }),
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

// THE PHASE DISC (owner, 2026-10-18; src/core/daylight.js phaseGlyph): a 26 px disc, the lit part growing from the right through the morning
// and the shadow eating in from the right through the evening, the terminator a half-ellipse; the lit fill warms at the golden hour; the day's
// number under it. Drawn, not an emoji: the HUD has one hand.
function makeDial(parent) {
  if (typeof document === 'undefined') return null;
  const NS = 'http://www.w3.org/2000/svg', R = 11, C = 13;
  const el = document.createElement('div'); el.id = 'day-dial'; el.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 26 26');
  const dark = document.createElementNS(NS, 'circle'); dark.setAttribute('cx', C); dark.setAttribute('cy', C); dark.setAttribute('r', R); dark.setAttribute('class', 'dd-dark');
  const lit = document.createElementNS(NS, 'path'); lit.setAttribute('class', 'dd-lit');
  const rim = document.createElementNS(NS, 'circle'); rim.setAttribute('cx', C); rim.setAttribute('cy', C); rim.setAttribute('r', R); rim.setAttribute('class', 'dd-rim');
  svg.append(dark, lit, rim); const num = document.createElement('b'); el.append(svg, num); parent.append(el);
  let lastDay = 0, lastD = null, lastTf = null, lastFill = null;
  return {
    set(p, g, day, dayShare) {
      const { lit: f, waning, rx } = phaseGlyph(p, dayShare);
      // the lit region: the right semicircle, closed by the terminator (a half-ellipse of half-width rx·R bowing into the dark side when more
      // than half is lit, into the lit side when less); mirrored for the evening so the shadow sits on the right
      const sweep = f > 0.5 ? 1 : 0, path = f <= 0.001 ? '' : f >= 0.999 ? `M${C} ${C - R} A${R} ${R} 0 1 1 ${C} ${C + R} A${R} ${R} 0 1 1 ${C} ${C - R}Z`
        : `M${C} ${C - R} A${R} ${R} 0 0 1 ${C} ${C + R} A${(rx * R).toFixed(2)} ${R} 0 0 ${sweep} ${C} ${C - R}Z`;
      const tf = waning ? 'translate(26 0) scale(-1 1)' : '', warm = Math.min(1, g * 1.4);
      if (path !== lastD) { lastD = path; lit.setAttribute('d', path); }
      if (tf !== lastTf) { lastTf = tf; lit.setAttribute('transform', tf); }
      // RGB between the HUD's ice blue and a golden orange: an HSL hue sweep would go the long way through green and yellow
      const fill = `rgb(${Math.round(207 + 48 * warm)}, ${Math.round(233 - 57 * warm)}, ${Math.round(255 - 159 * warm)})`;
      if (fill !== lastFill) { lastFill = fill; lit.style.fill = fill; }
      if (day !== lastDay) { lastDay = day; num.textContent = `DAY ${day}`; }
    },
    dispose() { el.remove(); },
  };
}
