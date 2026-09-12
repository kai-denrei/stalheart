// fast-weights.js — 5x5 cosine similarity heatmap (RdBu) annealing from
// noisy to clean diagonal, plus target-vs-retrieved bar pairs.
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 10000;
const N_KEYS = 5;
const D_VAL = 8;
const SEED = 9001;

// RdBu_r style: blue (-1) -> white (0) -> red (+1)
function rdbu(v) {
  v = clamp(v, -1, 1);
  if (v >= 0) {
    // white -> red
    const t = v;
    const r = 255;
    const g = (255 * (1 - t)) | 0;
    const b = (255 * (1 - t)) | 0;
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    const r = (255 * (1 - t)) | 0;
    const g = (255 * (1 - t)) | 0;
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

// Pre-bake a target value vector and a noise schedule per key pair.
function buildContext(seed) {
  const rng = mulberry32(seed);
  // Target: diagonal of +0.95, off-diagonal cluster around 0.65 initially
  // (shared bias direction), shrinking to ~0 as training progresses.
  const targetVal = new Array(D_VAL);
  for (let i = 0; i < D_VAL; i++) targetVal[i] = (rng() - 0.5) * 1.6;

  // Per cell static noise component to give a "live" matrix look.
  const noise = new Array(N_KEYS * N_KEYS);
  for (let i = 0; i < noise.length; i++) noise[i] = rng();

  return { targetVal, noise };
}

let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = buildContext(SEED);
  return _ctx;
}

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;     // 0..1, restarts each cycle
  const C = getCtx();

  clearBg(ctx, w, h, PALETTE.bg);

  const pad = 8;
  const headerH = 14;

  // Convergence parameter: 0 = noisy, 1 = clean diagonal.
  const conv = smoothstep(0.05, 0.92, phase);
  const step = ((phase * 1500) | 0);

  drawHeader(ctx, pad, 2,
    `> FAST-WEIGHTS  STEP ${fmtStep(step, 4)}/1500  COS_Y: ${conv >= 0.5 ? '+' : ''}${(conv * 1.85 - 0.85).toFixed(2)}`,
    PALETTE.blue, 10);

  // Layout: heatmap left ~52%, bars right.
  const topY = headerH + pad;
  const innerH = h - topY - pad;
  const hmW = Math.floor((w - pad * 3) * 0.5);
  const hmX = pad;
  const hmY = topY;
  const hmH = innerH;

  drawCosHeatmap(ctx, hmX, hmY, hmW, hmH, conv, C, t);

  const barX = hmX + hmW + pad;
  const barY = topY;
  const barW = w - barX - pad;
  const barH = innerH;
  drawBarPairs(ctx, barX, barY, barW, barH, conv, C);

  drawBezel(ctx, w, h, PALETTE.blueDim);
}

function drawCosHeatmap(ctx, x, y, w, h, conv, C, t) {
  label(ctx, x, y, 'cos(W_K k_i, W_K k_j)', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 14;
  const cell = Math.min(w / N_KEYS, innerH / N_KEYS);
  const gridW = cell * N_KEYS;
  const gridH = cell * N_KEYS;
  const ox = x + (w - gridW) / 2;
  const oy = innerY + (innerH - gridH) / 2;

  // For a tiny per-frame liveliness, sample a slowly-changing noise term.
  const liveN = (t / 80) | 0;

  for (let i = 0; i < N_KEYS; i++) {
    for (let j = 0; j < N_KEYS; j++) {
      let v;
      if (i === j) {
        // Diagonal: high to start (always identity-ish), but in early phase
        // it can dip due to noise.
        v = lerp(0.4, 0.98, conv);
      } else {
        // Off-diagonal: starts ~0.55..0.75 (shared bias), goes to ~0.
        const base = lerp(0.55 + 0.2 * C.noise[i * N_KEYS + j], 0.0, conv);
        v = base;
      }
      // Live jitter: stronger early, decays with conv.
      const jitter = (hash01(liveN * 9001 + i * 31 + j * 7) - 0.5) * 0.18 * (1 - conv);
      v = clamp(v + jitter, -1, 1);

      ctx.fillStyle = rdbu(v);
      ctx.fillRect(ox + j * cell, oy + i * cell, cell + 0.5, cell + 0.5);
    }
  }

  // Grid
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= N_KEYS; i++) {
    ctx.beginPath();
    ctx.moveTo(ox, oy + i * cell);
    ctx.lineTo(ox + gridW, oy + i * cell);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox + i * cell, oy);
    ctx.lineTo(ox + i * cell, oy + gridH);
    ctx.stroke();
  }
  ctx.restore();
  // Outer
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(ox + 0.5, oy + 0.5, gridW, gridH);
}

function drawBarPairs(ctx, x, y, w, h, conv, C) {
  label(ctx, x, y, 'TARGET vs RETRIEVED', PALETTE.gray, 9);
  const innerY = y + 14;
  const innerH = h - 16;
  const groupW = w / D_VAL;
  const barW = groupW * 0.4;
  const midY = innerY + innerH / 2;

  // Frame
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
  // zero axis
  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const halfH = innerH / 2 - 4;
  const maxV = 1.5;

  for (let d = 0; d < D_VAL; d++) {
    const target = C.targetVal[d];
    // retrieved approaches target as conv -> 1.
    // early: noisy ~0.3 magnitude.
    const noise = (hash01(d * 41 + 1234) - 0.5) * 0.7 * (1 - conv);
    const retrieved = lerp(noise, target, conv);

    const cx = x + (d + 0.5) * groupW;
    // target bar (left of pair) - amber
    const tH = (target / maxV) * halfH;
    ctx.fillStyle = PALETTE.amber;
    if (tH >= 0) ctx.fillRect(cx - barW, midY - tH, barW, tH);
    else         ctx.fillRect(cx - barW, midY, barW, -tH);

    // retrieved bar (right of pair) - blue
    const rH = (retrieved / maxV) * halfH;
    ctx.fillStyle = PALETTE.blue;
    if (rH >= 0) ctx.fillRect(cx, midY - rH, barW, rH);
    else         ctx.fillRect(cx, midY, barW, -rH);
  }

  // legend
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(x, y + h - 8, 6, 6);
  label(ctx, x + 8, y + h - 9, 'TGT', PALETTE.gray, 8);
  ctx.fillStyle = PALETTE.blue;
  ctx.fillRect(x + 36, y + h - 8, 6, 6);
  label(ctx, x + 44, y + h - 9, 'RET', PALETTE.gray, 8);
}

export default render;
