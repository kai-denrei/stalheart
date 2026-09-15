// The shield off the hull: the dotted charging rings on the ground (the
// campaign's heart pad, the story's solar array) and the panel line that reads
// the meter, the rack and the array's reserve. Presentation only: the numbers
// come from src/domain/shield.js state and src/content/shield-array.js.
import * as THREE from '../../vendor/three.module.js';

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// A ring of dots on the unit sphere around `centre`, `theta` radians out, at
// radius `lift`; `rings` are extra concentric rings as shares of theta.
export function makePadRing(centre, theta, lift, { size = 3, color = 0x59c8ff, segments = 64, rings = [1] } = {}) {
  const c = unit(centre), ref = Math.abs(c[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = unit(cross(c, ref)), t2 = cross(c, t1), pos = [];
  for (const k of rings) for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI, th = theta * k, co = Math.cos(th), si = Math.sin(th);
    const p = unit([0, 1, 2].map((j) => c[j] * co + (t1[j] * Math.cos(a) + t2[j] * Math.sin(a)) * si));
    pos.push(p[0] * lift, p[1] * lift, p[2] * lift);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const ring = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, color, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.userData.size = size;
  return ring;
}

// 'idle' breathes slowly, 'charging' pulses fast and bright, 'dry' is a dim
// outline (a trip that will not pay must be declinable from across the
// board); a null mode hides the ring.
export function glowPadRing(ring, mode, time) {
  if (!ring) return;
  ring.visible = !!mode;
  if (!mode) return;
  const m = ring.material, base = ring.userData.size ?? m.size;
  if (mode === 'charging') { m.opacity = 0.8 + 0.2 * Math.sin(time * 12); m.size = base * 1.35; }
  else if (mode === 'dry') { m.opacity = 0.12; m.size = base; }
  else { m.opacity = 0.5 + 0.3 * Math.sin(time * 3); m.size = base; }
}

// THE SHIELD IS ALWAYS ON THE PANEL, and IT HAS TO SAY WHAT IT IS: the operator
// once played a full board and asked whether the shield existed, because the
// readout was a bare glyph. The word, then the number, then what you can spend:
// up and draining, cooling through the seam, or idle with a rack. With an
// array standing, its reserve follows: ARRAY 24s, a rising mark and the next
// charge's progress while it feeds, DRY once it has given everything.
export function shieldPanel(sh, tune, now, array = null) {
  const pips = `<i class="sh-pip">${'▮'.repeat(sh.rack)}${'▯'.repeat(Math.max(0, tune.rackCap - sh.rack))}</i>`;
  const bar = sh.t > 0
    ? `<b class="sh-bar" style="--sh:${Math.max(0, Math.min(1, sh.t / tune.cap))}">◈ SHIELD ${Math.ceil(sh.t)}s</b> ${pips}`
    : (now < sh.coolUntil
      ? `<span class="sh-cool">◈ SHIELD COOLING ${(sh.coolUntil - now).toFixed(1)}s</span> ${pips}`
      : `<span class="sh-idle">◈ SHIELD</span> <b class="sh-ready">T</b> ${pips}`);
  if (!array) return bar;
  if (array.reserve <= 0) return `${bar} <span class="sh-array dry">ARRAY DRY</span>`;
  const fill = sh.rackFill > 0 ? ` · NEXT ${Math.floor((sh.rackFill / tune.deploySecs) * 100)}%` : '';
  return `${bar} <span class="sh-array${array.charging ? ' on' : ''}">ARRAY ${array.charging ? '▲ ' : ''}${Math.ceil(array.reserve)}s${array.charging ? fill : ''}</span>`;
}
