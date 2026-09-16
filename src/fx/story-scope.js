// THE QUIVER'S FIRE-CONTROL OPTIC, written in SOL-82's register (src/fx/laser-scope.js, src/fx/laser-inset-hud.js):
// one 2D canvas over the seat, redrawn each frame from a plain frame object, with the satellite's plated telemetry
// blocks tucked into the margins around the sight rather than laid across it.
//
// THE LOCK RULES ARE NOT PRESENTATION, AND NOTHING HERE TOUCHES THEM. Whatever sits inside the lock square is the
// target, the timer runs while it stays there, and the square is drawn at the seeker's true angular cone. Everything
// below only says that louder (owner, 2026-09-16): four phases with their own colour and motion, an inner box that
// converges from the square's edge onto the body the rules actually hold, a TARGET LOCKED blink, and the numbers.
//
//   SEARCHING  nothing held — a wide segmented ring drifts round the centre, dim cyan
//   TRACKING   a body inside the square — the ring tightens and speeds up as the timer fills, bright cyan
//   LOCKED     the timer is full — the ring snaps still, closes on the body, and the tag blinks, white
//   AWAY       a round is in flight — the blink stops, the ring counter-turns slowly, the launcher reads HOLD
//
// Cyan and white are ours; amber is only ever a warning (out of range, the launcher holding its round).
// prefers-reduced-motion drops every spin and blink and says the phase in words instead.
import { BELT_OF } from '../content/sectors.js';

const WHITE = '#f2fbff';
const FG = '#dfe8ee';
const CYAN = '#5fe6d6';
const DIM = 'rgba(223, 232, 238, 0.45)';
const SOFT = 'rgba(95, 230, 214, 0.42)';
const FAINT = 'rgba(223, 232, 238, 0.12)';
const WARN = '#ffb020';
const PLATE = 'rgba(5, 8, 11, 0.62)';
const TAU = Math.PI * 2;
const LH = 14;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const text = (l) => (typeof l === 'string' ? l : l.s);

export function createStoryScope(root) {
  const layer = document.createElement('div'); layer.id = 'story-scope'; layer.style.display = 'none';
  layer.innerHTML = '<canvas class="reticle" aria-hidden="true"></canvas>';
  root.append(layer);
  const canvas = layer.querySelector('canvas'), ctx = canvas.getContext('2d');
  const reduced = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let clock = 0, prev = 0, spin = 0, counter = 0;

  function fit(w, h) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  // four corner brackets at a half-size, so a box never draws over the body it holds
  function brackets(cx, cy, half, arm, width) {
    ctx.lineWidth = width;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const x = cx + sx * half, y = cy + sy * half;
      ctx.beginPath(); ctx.moveTo(x - sx * arm, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy * arm); ctx.stroke();
    }
  }
  // a segmented ring: `segs` arcs each filling `fill` of its slot, turned to `angle`
  function segments(cx, cy, r, segs, fill, angle, width) {
    ctx.lineWidth = width;
    const slot = TAU / segs, run = slot * clamp01(fill);
    for (let i = 0; i < segs; i++) {
      const a = angle + i * slot;
      ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r), a, a + run); ctx.stroke();
    }
  }

  const measure = (rows) => ({ w: Math.max(...rows.map((r) => ctx.measureText(text(r)).width)) + 16, h: rows.length * LH + 8 });
  // one plated block of monospace lines, optionally with a meter bar in a reserved last row
  function block(x, y, title, lines, meter) {
    const rows = [{ s: title, c: DIM }, ...lines, ...(meter ? [' '] : [])];
    const { w, h } = measure(rows);
    ctx.fillStyle = PLATE; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = FAINT; ctx.fillRect(x, y, 2, h);
    ctx.textAlign = 'left';
    rows.forEach((l, i) => { ctx.fillStyle = typeof l === 'string' ? FG : l.c; ctx.fillText(text(l), x + 8, y + 5 + i * LH); });
    if (meter) {
      ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.strokeRect(x + 8.5, y + h - 13.5, w - 17, 5);
      ctx.fillStyle = meter.colour; ctx.fillRect(x + 9.5, y + h - 12.5, clamp01(meter.frac) * (w - 19), 3);
    }
    return h;
  }
  const height = (title, lines, meter) => measure([title, ...lines.map(text), ...(meter ? [' '] : [])]).h;
  const widthOf = (title, lines) => measure([title, ...lines.map(text)]).w;

  return {
    // one call a frame. `on` hides everything. meter 0..1 and `locked` come straight off the launcher's own lock;
    // `sx`/`sy` are the held body's own point on the glass, so the inner box closes on THAT body and no other.
    update({ on, w, h, meter = 0, locked = false, target = null, max = 0, zoom = 1, box = 0, cone = 0, lockTime = 0, flight = 0, ready = true, cooldown = 0, sx = null, sy = null }) {
      layer.style.display = on ? '' : 'none';
      if (!on) { prev = 0; return; }
      const now = (typeof performance === 'object' ? performance.now() : Date.now()) / 1000;
      const dt = prev ? Math.min(0.1, now - prev) : 0; prev = now; clock += dt;
      const still = !!reduced?.matches;
      fit(w, h);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '11px ui-monospace, Menlo, monospace';
      ctx.textBaseline = 'top';

      const cx = w / 2, cy = h / 2;
      /* the square IS the cone, exactly as before: the seeker's angular size at the camera's own field of view */
      const R = Math.min(w, h) * 0.11;
      const b = Math.max(R * 1.2, Math.min(Math.min(w, h) * 0.46, box || R * 2.2));
      const far = target && max > 0 && target.range > max;
      const phase = flight > 0 ? 'away' : locked ? 'lock' : target ? 'track' : 'search';
      const fill = locked ? 1 : clamp01(meter);
      const beat = still ? 1 : (clock % 0.62) < 0.38 ? 1 : 0.34;      /* the LOCKED blink, and only that: it never dims past reading */
      const tone = phase === 'lock' ? WHITE : phase === 'track' ? CYAN : phase === 'away' ? FG : SOFT;

      /* ---------------- the ring: the phase you can read without looking at a word ---------------- */
      if (!still) { spin += dt * (phase === 'search' ? 0.55 : phase === 'track' ? 0.8 + fill * 3.4 : 0); counter -= dt * (phase === 'away' ? 0.5 : 0); }
      const ringR = phase === 'search' ? b * 0.62 : phase === 'away' ? b * 0.46 : b * (0.62 - 0.3 * fill);
      /* the ring itself stays solid on LOCKED — a still frame must read as locked; the tag and the inner box carry the blink */
      ctx.strokeStyle = tone;
      segments(cx, cy, ringR, phase === 'search' ? 8 : phase === 'away' ? 6 : 8 + Math.round(fill * 6), phase === 'search' ? 0.42 : 0.3 + fill * 0.28, phase === 'away' ? counter : spin, phase === 'lock' ? 2.6 : 1.4);

      /* ---------------- the lock square, at the seeker's true size, and the timer on its top edge ---------------- */
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1;
      ctx.globalAlpha = phase === 'search' ? 0.3 : 0.55;
      ctx.setLineDash(phase === 'search' ? [6, 8] : []);
      ctx.strokeRect(cx - b, cy - b, b * 2, b * 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      brackets(cx, cy, b, b * 0.28, phase === 'search' ? 1.6 : 2.4);
      if (fill > 0.001 && phase !== 'away') {
        ctx.strokeStyle = phase === 'lock' ? WHITE : CYAN;
        ctx.lineWidth = 3;
        line(cx - b, cy - b, cx - b + 2 * b * fill, cy - b);
      }

      /* ---------------- tracking inside the tracking: the box closes from the square's edge onto the body ---------------- */
      const bx = sx === null ? cx : Math.max(cx - b, Math.min(cx + b, sx)), by = sy === null ? cy : Math.max(cy - b, Math.min(cy + b, sy));
      if (target && phase !== 'away') {
        const ease = fill * fill * (3 - 2 * fill);
        const half = b + (Math.max(11, b * 0.15) - b) * ease;
        const ix = cx + (bx - cx) * ease, iy = cy + (by - cy) * ease;
        ctx.strokeStyle = phase === 'lock' ? WHITE : CYAN;
        ctx.globalAlpha = phase === 'lock' ? 0.45 + 0.55 * beat : 0.55 + 0.45 * fill;
        brackets(ix, iy, half, Math.max(5, half * 0.3), phase === 'lock' ? 2 : 1.4);
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        if (Math.hypot(bx - cx, by - cy) > 12) line(cx, cy, bx, by);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      /* the body's own pip, on the point the rules hold */
      if (target) {
        ctx.strokeStyle = tone; ctx.lineWidth = 1;
        line(bx - 6, by, bx + 6, by); line(bx, by - 6, bx, by + 6);
      }

      /* the centre pip: where the launcher is pointed */
      ctx.strokeStyle = tone; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.22, 0, TAU); ctx.stroke();
      line(cx - R * 0.5, cy, cx - R * 0.24, cy); line(cx + R * 0.24, cy, cx + R * 0.5, cy);
      line(cx, cy - R * 0.5, cx, cy - R * 0.24); line(cx, cy + R * 0.24, cx, cy + R * 0.5);

      /* ---------------- the word for the phase, under the square ---------------- */
      /* clear of the seat's own strip and hint bar along the bottom, which the square's edge runs behind */
      const tagY = cy + Math.min(b + 8, h * 0.29);
      ctx.textAlign = 'center';
      if (phase === 'lock') {
        ctx.globalAlpha = 0.4 + 0.6 * beat;
        ctx.fillStyle = WHITE; ctx.fillRect(cx - 82, tagY, 164, 17);
        ctx.fillStyle = '#0b1418'; ctx.fillText('TARGET LOCKED', cx, tagY + 4);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = far ? WARN : phase === 'track' ? CYAN : phase === 'away' ? FG : 'rgba(95, 230, 214, 0.78)';
        ctx.fillText(phase === 'away' ? `ROUND AWAY · ${flight} IN FLIGHT` : far ? 'OUT OF RANGE' : phase === 'track' ? `LOCKING ${Math.round(fill * 100)}%` : 'SEARCHING · NOTHING IN THE BOX', cx, tagY + 4);
      }

      /* ---------------- telemetry, tucked into the margins beside the sight ---------------- */
      const belt = target ? (BELT_OF[target.type] || '—').toUpperCase() : '—';
      const lockLine = locked ? { s: 'LOCKED', c: WHITE } : target ? { s: `T-LOCK ${(Math.max(0, 1 - fill) * lockTime).toFixed(2)} S`, c: CYAN } : { s: 'NO TARGET', c: DIM };
      const seeker = ['SEEKER · QUIVER', [`CONE ${cone.toFixed(1)}° HALF`, `MAG ${zoom.toFixed(1)}x`, `MAX ${Math.round(max)} M`, { s: still ? `STATE ${phase.toUpperCase()}` : 'BOX = WHAT IT TAKES', c: DIM }]];
      const launcher = ['LAUNCHER · TALON', [
        flight > 0 ? { s: `HOLD · ${flight} IN FLIGHT`, c: WARN } : ready && cooldown <= 0 ? { s: 'READY', c: FG } : { s: 'LOADING', c: WARN },
        cooldown > 0 ? `COOLING ${cooldown.toFixed(1)} S` : 'COOLING 0.0 S',
        { s: `TRIGGER ${locked && flight === 0 ? 'ARMED' : 'SAFE'}`, c: locked && flight === 0 ? WHITE : DIM },
      ]];
      const track = ['TRACK', [
        target ? { s: `TGT-${String(target.id).padStart(2, '0')} ${String(target.type || '—').toUpperCase()}`, c: tone } : { s: 'NO CONTACT', c: DIM },
        `BELT ${belt}`,
        target ? { s: `RANGE ${Math.round(target.range)} M`, c: far ? WARN : FG } : 'RANGE — M',
        target ? `BEARING ${target.bearing.toFixed(1)}°` : 'BEARING —',
        lockLine,
      ]];
      const colW = Math.max(widthOf(seeker[0], seeker[1]), widthOf(launcher[0], launcher[1]));
      const trkW = widthOf(track[0], track[1]);
      const leftRoom = cx - b, rightRoom = w - (cx + b);
      const gap = 10;
      const seekH = height(seeker[0], seeker[1]), launH = height(launcher[0], launcher[1]), trkH = height(track[0], track[1], true);
      const lx = leftRoom >= colW + 24 ? Math.max(14, leftRoom - colW - 12) : 14;
      const ly = leftRoom >= colW + 24 ? Math.max(14, cy - (seekH + gap + launH) / 2) : 14;
      block(lx, ly, seeker[0], seeker[1]);
      block(lx, ly + seekH + gap, launcher[0], launcher[1]);
      const rx = rightRoom >= trkW + 24 ? Math.min(w - trkW - 14, cx + b + 12) : w - trkW - 14;
      const ry = rightRoom >= trkW + 24 ? Math.max(14, cy - trkH / 2) : 14;
      block(rx, ry, track[0], track[1], { frac: fill, colour: locked ? WHITE : CYAN });
    },
    dispose() { canvas.remove(); layer.remove(); },
  };
}
