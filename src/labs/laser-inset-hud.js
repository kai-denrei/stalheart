// THE SATELLITE SCOPE'S HUD. The inset is where the player actually aims (owner, 2026-09-15), and it is ROUND, a scope
// rather than a window. On the lens: a bezel with bearing ticks, a radar sweep, a heading tape that longitude scrolls,
// a range ladder in metres, the beam's real contact boxed and ringed at its footprint, and at the aim point X brackets
// with a spinning tick arc and a tether back to the lagging contact.
//
// COLOUR IS THE FEEDBACK. Armed inside the range the sight is cyan, deepening to blue as the aim nears the limit;
// beyond the limit it goes amber to orange-red and says so (the beam is held at the limit); lasing it is ember red.
//
// Telemetry is tucked against the scope, not across the view: OPTICS and LASER in a row along its top edge, PASS and
// TARGET stacked against its right edge. The diegetic numbers the game needs (energy, seconds, kills, the sinkhole,
// the Stalheart) sit among them.
//
// A 2D canvas over the lab's container, redrawn after each 3D frame from one plain frame object in canvas pixels. The
// only state here is animation phase and the contact's temperature, integrated from LASER_TELEMETRY.
import { LASER_TELEMETRY } from '../content/orbital-laser.js';

const FG = '#dfe8ee';
const HOT = '#ff3b1f';
const DIM = 'rgba(223, 232, 238, 0.45)';
const FAINT = 'rgba(223, 232, 238, 0.12)';
const WARN = '#ffb020';
const PLATE = 'rgba(5, 8, 11, 0.62)';
const TAU = Math.PI * 2;
/* the range ramps: near to the limit in blues, past it amber to orange-red */
const CYAN = [98, 215, 255], BLUE = [47, 107, 255], AMBER = [255, 176, 32], ORANGE_RED = [255, 84, 26];
const fix = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '--');
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => `rgb(${a.map((c, i) => Math.round(c + (b[i] - c) * clamp01(t))).join(', ')})`;

export function createInsetHud(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'laser-inset-hud';
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let spin = 0, counter = 0, sweep = 0, temp = 0, clock = 0;

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = container.clientWidth, h = container.clientHeight;
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.stroke(); };
  const LH = 14;
  const textOf = (l) => (typeof l === 'string' ? l : l.s);

  // a block's size before it is drawn, so blocks can be laid out against the scope
  function measure(lines, title) {
    const rows = title ? [title, ...lines.map(textOf)] : lines.map(textOf);
    return { w: Math.max(...rows.map((s) => ctx.measureText(s).width)) + 16, h: rows.length * LH + 8 };
  }

  // a block of text lines on a translucent plate; a line is a string or { s, c } for its own colour
  function block(x, y, lines, title) {
    const rows = title ? [{ s: title, c: DIM }, ...lines] : lines;
    const { w, h } = measure(lines, title);
    ctx.fillStyle = PLATE;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = FAINT;
    ctx.fillRect(x, y, 2, h);
    ctx.textAlign = 'left';
    rows.forEach((l, i) => {
      ctx.fillStyle = typeof l === 'string' ? FG : l.c;
      ctx.fillText(textOf(l), x + 8, y + 5 + i * LH);
    });
    return { x, y, w, h };
  }

  function bar(x, y, w, frac, colour) {
    ctx.strokeStyle = DIM;
    ctx.strokeRect(x + 0.5, y + 0.5, w, 5);
    ctx.fillStyle = colour;
    ctx.fillRect(x + 1.5, y + 1.5, clamp01(frac) * (w - 2), 3);
  }

  function draw(f, dt) {
    const { w, h } = fit();
    ctx.clearRect(0, 0, w, h);
    const T = LASER_TELEMETRY, r = f.rect;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, lens = Math.min(r.w, r.h) / 2;
    clock += dt;

    /* the laser line and the contact's heat */
    const irradiance = T.powerMW / (Math.PI * f.radiusM * f.radiusM);          /* MW per square metre while lasing */
    const settle = f.burning ? T.kelvinPerMWm2 * irradiance / (1 + f.speed / T.speedHalving) : 0;
    temp += (settle - temp) * (1 - Math.exp(-dt / (f.burning ? T.heatSeconds : T.coolSeconds)));
    spin += dt * (0.35 + f.speed * 0.12) * (f.burning ? 2.4 : 1);
    counter -= dt * (f.burning ? 1.7 : 0.4);
    sweep += dt * (f.burning ? 2.2 : 0.9);
    const live = f.phase === 'overhead' && f.energy > 0;
    const low = f.energy01 < 0.25;

    /* the range: how far out the aim is against the limit */
    const reach = f.aiming && f.limitM > 0 ? f.aimArcM / f.limitM : 0;
    const beyond = reach > 1;
    const tone = f.burning ? HOT
      : beyond ? mix(AMBER, ORANGE_RED, (reach - 1) / 0.4)
      : live ? mix(CYAN, BLUE, (reach - 0.5) / 0.5)
      : DIM;

    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 1;

    /* ======================= ON THE LENS ======================= */
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, lens, 0, TAU);
    ctx.clip();

    /* the radar sweep: a fading wedge trailing a bright line, in the sight's colour */
    const sweepRgb = f.burning ? [255, 59, 31] : beyond ? AMBER : CYAN;
    if (ctx.createConicGradient) {
      const g = ctx.createConicGradient(sweep, cx, cy);
      g.addColorStop(0, `rgba(${sweepRgb.join(', ')}, 0.16)`);
      g.addColorStop(0.12, `rgba(${sweepRgb.join(', ')}, 0)`);
      g.addColorStop(1, `rgba(${sweepRgb.join(', ')}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(cx - lens, cy - lens, lens * 2, lens * 2);
    }
    ctx.strokeStyle = `rgba(${sweepRgb.join(', ')}, 0.35)`;
    line(cx, cy, cx + Math.cos(sweep) * lens, cy + Math.sin(sweep) * lens);

    /* range rings at a quarter, a half and three quarters of the lens */
    ctx.strokeStyle = FAINT;
    for (const k of [0.25, 0.5, 0.75]) circle(cx, cy, lens * k);

    /* the heading tape inside the top of the lens: longitude scrolls it */
    const tapeY = cy - lens * 0.86, span = lens * 0.46, perDeg = 6;
    ctx.strokeStyle = DIM;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'center';
    line(cx - span, tapeY, cx + span, tapeY);
    const firstDeg = Math.ceil((f.lon - span / perDeg) / 5) * 5;
    for (let d = firstDeg; d <= f.lon + span / perDeg; d += 5) {
      const x = cx + (d - f.lon) * perDeg;
      const major = ((d % 15) + 15) % 15 === 0;
      line(x, tapeY, x, tapeY - (major ? 8 : 4));
      if (major) ctx.fillText(String(((d % 360) + 360) % 360).padStart(3, '0'), x, tapeY + 3);
    }
    ctx.fillStyle = FG;
    ctx.beginPath();
    ctx.moveTo(cx, tapeY + 16); ctx.lineTo(cx - 5, tapeY + 23); ctx.lineTo(cx + 5, tapeY + 23); ctx.closePath();
    ctx.fill();

    /* the beam's real contact: a box and a ring at its footprint, an x at its heart */
    const a = f.aim, arm = Math.max(18, lens * 0.11);
    const pxPerM = f.contact && f.radiusM > 0 ? f.footprintPx / f.radiusM : 1 / Math.max(1e-3, f.gsd);
    if (f.contact) {
      const c = f.contact, half = Math.max(8, f.footprintPx);
      ctx.strokeStyle = tone;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(c.x - half, c.y - half, half * 2, half * 2);
      circle(c.x, c.y, half * (f.burning ? 0.92 + 0.08 * Math.sin(clock * 16) : 1));
      ctx.lineWidth = 1;
      line(c.x - 4, c.y - 4, c.x + 4, c.y + 4);
      line(c.x - 4, c.y + 4, c.x + 4, c.y - 4);
      if (Math.hypot(a.x - c.x, a.y - c.y) > arm * 0.6) {
        ctx.strokeStyle = beyond ? tone : DIM;
        ctx.setLineDash([2, 5]);
        line(c.x, c.y, a.x, a.y);
        ctx.setLineDash([]);
        ctx.fillStyle = beyond ? tone : DIM;
        ctx.textAlign = 'left';
        ctx.fillText(`LAG ${fix(f.lagM, 0)} M`, (a.x + c.x) / 2 + 6, (a.y + c.y) / 2);
      }
    }

    /* the aim: X brackets from a gap, corner brackets, a spinning tick arc, a centre cross */
    ctx.strokeStyle = tone;
    ctx.lineWidth = 1.5;
    const gap = arm * 0.55, reachPx = arm * 2.1;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      line(a.x + sx * gap, a.y + sy * gap, a.x + sx * reachPx, a.y + sy * reachPx);
      const k = arm * (f.burning ? 1.25 + 0.15 * Math.sin(clock * 12) : beyond ? 1.4 + 0.12 * Math.sin(clock * 9) : 1.4), b = arm * 0.4;
      ctx.beginPath();
      ctx.moveTo(a.x + sx * k, a.y + sy * (k - b));
      ctx.lineTo(a.x + sx * k, a.y + sy * k);
      ctx.lineTo(a.x + sx * (k - b), a.y + sy * k);
      ctx.stroke();
    }
    ctx.lineWidth = 1;
    line(a.x - 5, a.y, a.x + 5, a.y);
    line(a.x, a.y - 5, a.x, a.y + 5);
    for (let i = 0; i < 24; i++) {
      const ang = spin + (i * TAU) / 24;
      if ((i % 6) === 5) continue;                                      /* gaps make the spin legible */
      const r1 = arm * 0.95, r2 = arm * (i % 6 === 0 ? 1.12 : 1.03);
      line(a.x + Math.cos(ang) * r1, a.y + Math.sin(ang) * r1, a.x + Math.cos(ang) * r2, a.y + Math.sin(ang) * r2);
    }
    for (let i = 0; i < 2; i++) {
      const start = counter + i * Math.PI;
      ctx.beginPath();
      ctx.arc(a.x, a.y, arm * 2.45, start, start + TAU / 8);
      ctx.stroke();
    }

    /* the range ladder under the aim, in metres at the ground */
    ctx.strokeStyle = DIM;
    ctx.fillStyle = DIM;
    ctx.textAlign = 'left';
    for (const m of [100, 200, 300]) {
      const y = a.y + arm * 2.6 + m * pxPerM * 0.5;
      if (y > cy + lens * 0.8) break;
      line(a.x - 6, y, a.x + 6, y);
      ctx.fillText(`${m}M`, a.x + 10, y - 6);
    }

    /* the status under the reticle */
    const status = f.burning ? ((clock % 0.6) < 0.4 ? 'LASING' : '')
      : beyond ? `OUT OF RANGE · ${Math.round(f.aimArcM)} / ${Math.round(f.limitM)} M`
      : live ? 'ARMED · HOLD TO FIRE'
      : f.phase !== 'overhead' ? 'NO LINE OF SIGHT' : 'CAPACITOR DRAINED';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.burning ? HOT : beyond ? tone : !live && f.phase === 'overhead' ? WARN : live ? FG : DIM;
    ctx.fillText(status, cx, cy + lens * 0.72);
    ctx.restore();

    /* the bezel: rim, bearing ticks, cardinal letters (north up), rim tinted by the range */
    ctx.strokeStyle = beyond ? tone : DIM;
    ctx.lineWidth = 2;
    circle(cx, cy, lens - 1);
    ctx.lineWidth = 1;
    /* the lens is heading-up (the player's forward), so the bezel turns to keep N on north */
    const turn = f.northAngle || 0;
    for (let deg = 0; deg < 360; deg += 10) {
      const ang = (deg * Math.PI) / 180 - Math.PI / 2 + turn, long = deg % 30 === 0;
      const r1 = lens - 2, r2 = lens - (long ? 12 : 6);
      ctx.strokeStyle = long ? FG : DIM;
      line(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1, cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
    }
    ctx.fillStyle = FG;
    ctx.textAlign = 'center';
    for (const [label, deg] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
      const ang = (deg * Math.PI) / 180 - Math.PI / 2 + turn;
      ctx.fillText(label, cx + Math.cos(ang) * (lens - 22), cy + Math.sin(ang) * (lens - 22) - 6);
    }

    /* ======================= TUCKED AGAINST THE SCOPE ======================= */
    const optics = [
      `ALT ${fix(f.altitudeM / 1000, 3)} KM`,
      `RNG ${fix(f.rangeM / 1000, 3)} KM`,
      `FOV ${fix(f.fovDeg, 1)}°  GSD ${fix(f.gsd, 2)} M/PX`,
      `LAT ${fix(f.lat, 3)}°  LON ${fix(f.lon, 3)}°`,
    ];
    const laser = [
      `λ ${T.wavelengthUm.toFixed(3)} µm  ND:YAG CW`,
      f.burning ? { s: `P ${fix(T.powerMW, 1)} MW`, c: HOT } : { s: 'P STBY', c: DIM },
      `I ${fix(irradiance, 2)} MW/m²  Ø ${fix(f.radiusM * 2, 1)} M`,
      `Q ${fix(f.deliveredMJ, 0)} / ${fix(f.capMJ, 0)} MJ`,
      { s: `RANGE ${f.aiming ? Math.round(f.aimArcM) : '--'} / ${Math.round(f.limitM)} M`, c: beyond ? tone : FG },
    ];
    const passLine = f.infinite ? 'PASS  ∞  DEBUG'
      : f.phase === 'overhead' ? `OVERHEAD ${String(Math.ceil(f.left)).padStart(2, '0')} S`
      : `AWAY  T-${Math.ceil(f.left)} S`;
    const pass = [
      passLine,
      { s: `ENERGY ${fix(f.energy, 1)} S`, c: low ? WARN : FG },
      `SLEW ${fix(f.speed, 1)} / ${fix(f.slew, 0)} M/S`,
      ' ',
    ];
    const u = f.under;
    const target = [
      { s: `ΔT +${Math.round(temp)} K`, c: temp > 1500 ? HOT : FG },
      `KILLS ${f.counts.bodies}  ALIVE ${f.counts.alive}`,
      `WALL ${f.counts.walls}  ROCK ${f.counts.rocks}  TWR ${f.counts.towers}`,
      `SINKHOLE ${f.sealed ? 'SEALED' : 'OPEN'}`,
      { s: `STALHEART ${f.heart}`, c: f.heart === 'LOST' ? WARN : FG },
      f.burning ? `UNDER ${u.wall}W ${u.rock}R ${u.tower + u.heart}T ${u.soft}B` : { s: 'UNDER --', c: DIM },
    ];
    const mo = measure(optics, 'OPTICS · NADIR'), ml = measure(laser, 'LASER');
    const mp = measure(pass, 'PASS'), mt = measure(target, 'TARGET');
    const gapPx = 8, room = w - (r.x + r.w);

    /* OPTICS and LASER: a row along the scope's top edge; when the scope reaches the top of the view, beside it */
    const rowH = Math.max(mo.h, ml.h);
    let rowX = r.x, rowY = r.y - rowH - gapPx;
    if (rowY < 64) {
      if (room > mo.w + ml.w + 30) { rowX = r.x + r.w + 12; rowY = r.y; }
      else { rowY = r.y + r.h + gapPx; }                                   /* portrait: under the lens */
    }
    block(rowX, rowY, optics, 'OPTICS · NADIR');
    block(rowX + mo.w + gapPx, rowY, laser, 'LASER');

    /* PASS and TARGET: stacked against the scope's right edge, bottom-aligned; in portrait, under the row */
    let colX = r.x + r.w + 12, passY = r.y + r.h - mp.h - mt.h - gapPx;
    if (room < Math.max(mp.w, mt.w) + 24) { colX = rowX; passY = rowY + rowH + gapPx; }
    else if (rowX > r.x && passY < rowY + rowH + gapPx) passY = rowY + rowH + gapPx;
    const pb = block(colX, passY, pass, 'PASS');
    bar(pb.x + 8, pb.y + pb.h - 20, pb.w - 16, f.infinite ? 1 : f.pass01, DIM);
    bar(pb.x + 8, pb.y + pb.h - 11, pb.w - 16, f.energy01, low ? WARN : FG);
    block(colX, passY + mp.h + gapPx, target, 'TARGET');
  }

  return {
    draw,
    temperature: () => temp,
    dispose() { canvas.remove(); },
  };
}
