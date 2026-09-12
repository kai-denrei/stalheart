// em-segmentation.js — EM-micrograph + GT contour, magma probability map,
// thresholded binary prediction, red AUC curve climbing 0.5 -> ~0.95.
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 12000;
const SEED = 5717;
const MAP_W = 36, MAP_H = 24;
const N_SITES = 18;

function magma(v) {
  v = clamp(v, 0, 1);
  const stops = [[0,0,0],[80,18,90],[220,80,30],[255,220,130]];
  const seg = v * (stops.length - 1);
  const i = Math.min(seg | 0, stops.length - 2);
  const f = seg - i, a = stops[i], b = stops[i+1];
  return `rgb(${(a[0]+(b[0]-a[0])*f)|0},${(a[1]+(b[1]-a[1])*f)|0},${(a[2]+(b[2]-a[2])*f)|0})`;
}

// Bake a Worley/Voronoi-cellular field + GT membrane mask once.
function buildContext(seed) {
  const rng = mulberry32(seed);
  const sites = new Array(N_SITES);
  for (let i = 0; i < N_SITES; i++) sites[i] = [rng(), rng()];

  const em = new Float32Array(MAP_W * MAP_H);
  const gt = new Uint8Array(MAP_W * MAP_H);
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) {
      const u = (px + 0.5) / MAP_W, v = (py + 0.5) / MAP_H;
      let d1 = 1e9, d2 = 1e9, id1 = 0;
      for (let i = 0; i < N_SITES; i++) {
        const dx = sites[i][0] - u, dy = sites[i][1] - v;
        const d = dx*dx + dy*dy;
        if (d < d1) { d2 = d1; d1 = d; id1 = i; }
        else if (d < d2) { d2 = d; }
      }
      const idx = py * MAP_W + px;
      const cellBright = 0.30 + 0.55 * hash01(id1 * 919 + 17);
      const jitter = (hash01(px * 131 + py * 17) - 0.5) * 0.18;
      em[idx] = clamp(cellBright + jitter, 0, 1);
      gt[idx] = (Math.sqrt(d2) - Math.sqrt(d1)) < 0.018 ? 1 : 0;
    }
  }
  return { em, gt };
}

let _ctx = null;
const getCtx = () => _ctx || (_ctx = buildContext(SEED));

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;
  const conv = smoothstep(0.05, 0.85, phase);
  const C = getCtx();
  const epoch = (conv * 10) | 0;
  const auc = lerp(0.5, 0.95, conv) + (hash01(((phase * 2400) | 0)) - 0.5) * 0.012;

  clearBg(ctx, w, h, PALETTE.bg);

  const pad = 6, headerH = 14;
  drawHeader(ctx, pad, 2,
    `> EM-SEG-ISBI  EPOCH ${fmtStep(epoch, 2)}/10  AUC: ${auc.toFixed(3)}`,
    PALETTE.green, 10);

  const topY = headerH + pad;
  const bodyH = h - topY - pad;
  const plotW = Math.floor((w - pad * 3) * 0.34);
  const tileW = w - plotW - pad * 3;
  const tileH = (bodyH - pad * 2) / 3;
  const flickerSeed = (phase * 200) | 0;

  // Panel 1: EM grayscale + green GT membrane overlay
  drawTiles(ctx, pad, topY, tileW, tileH, 'INPUT + GT', (px, py) => {
    const g = (C.em[py * MAP_W + px] * 255) | 0;
    return `rgb(${g},${g},${g})`;
  });
  const cw1 = tileW / MAP_W, ch1 = tileH / MAP_H;
  ctx.fillStyle = PALETTE.green;
  for (let py = 0; py < MAP_H; py++)
    for (let px = 0; px < MAP_W; px++)
      if (C.gt[py * MAP_W + px])
        ctx.fillRect(pad + px * cw1, topY + py * ch1, Math.max(1, cw1 * 0.6), Math.max(1, ch1 * 0.6));

  // Panel 2: magma probability map (anneals from noise to clean GT)
  const probY = topY + tileH + pad;
  drawTiles(ctx, pad, probY, tileW, tileH, 'MLP PROB (magma)', (px, py) => {
    const idx = py * MAP_W + px;
    const noise = hash01(idx * 17 + ((conv * 32) | 0) * 7);
    const gtV = C.gt[idx] ? 0.92 : 0.08 + 0.06 * hash01(idx * 53);
    return magma(lerp(noise, gtV, conv));
  });

  // Panel 3: thresholded binary prediction
  const predY = probY + tileH + pad;
  const thr = lerp(0.55, 0.42, conv);
  drawTiles(ctx, pad, predY, tileW, tileH, `PRED @thr ${thr.toFixed(2)}`, (px, py) => {
    const idx = py * MAP_W + px;
    const noise = hash01(idx * 23 + flickerSeed);
    const gtV = C.gt[idx] ? 0.92 : 0.08;
    return lerp(noise, gtV, conv) >= thr ? PALETTE.white : '#0a0a0a';
  });

  drawAuc(ctx, pad * 2 + tileW, topY, plotW, bodyH, conv, phase);
  drawBezel(ctx, w, h, PALETTE.greenDim);
}

function drawTiles(ctx, x, y, w, h, title, sample) {
  label(ctx, x, y - 11, title, PALETTE.gray, 9);
  const cw = w / MAP_W, ch = h / MAP_H;
  for (let py = 0; py < MAP_H; py++) {
    for (let px = 0; px < MAP_W; px++) {
      ctx.fillStyle = sample(px, py);
      ctx.fillRect(x + px * cw, y + py * ch, cw + 0.5, ch + 0.5);
    }
  }
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawAuc(ctx, x, y, w, h, conv, phase) {
  label(ctx, x, y, 'TEST AUC', PALETTE.gray, 9);
  const innerY = y + 12, innerH = h - 14;
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);

  const yPx = (yv) => innerY + innerH - ((yv - 0.4) / 0.6) * innerH;

  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.setLineDash([1, 3]);
  for (const yv of [0.5, 0.7, 0.9]) {
    const yy = yPx(yv);
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  ctx.restore();

  // edge baseline (dashed gray)
  ctx.save();
  ctx.strokeStyle = PALETTE.gray;
  ctx.setLineDash([3, 3]);
  const ebY = yPx(0.74);
  ctx.beginPath(); ctx.moveTo(x + 4, ebY); ctx.lineTo(x + w - 4, ebY); ctx.stroke();
  ctx.restore();
  label(ctx, x + 4, ebY - 9, 'edge 0.74', PALETTE.gray, 7);

  // climbing red AUC
  const N = 10;
  const upTo = Math.max(1, Math.min(N, Math.ceil(conv * N) + 1));
  ctx.save();
  ctx.strokeStyle = PALETTE.red;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let e = 0; e < upTo; e++) {
    const cv = smoothstep(0.05, 0.85, e / N);
    const aucV = lerp(0.5, 0.95, cv) + (hash01(e * 313) - 0.5) * 0.012;
    const px = x + (e / (N - 1)) * w;
    const py = yPx(aucV);
    if (e === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    ctx.fillStyle = PALETTE.red;
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  ctx.stroke();
  ctx.restore();

  // playhead
  const phx = x + clamp(phase / 0.85, 0, 1) * w;
  ctx.save();
  ctx.strokeStyle = PALETTE.amber;
  ctx.beginPath(); ctx.moveTo(phx, innerY); ctx.lineTo(phx, innerY + innerH); ctx.stroke();
  ctx.restore();
}

export default render;
