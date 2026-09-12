// linear-transformers.js — 3 panels building up one (k,v) pair at a time:
// (left)  bar chart of <k_t, q> with dashed query slot,
// (mid)   RdBu W_fast = sum v_t k_t^T accumulating outer products,
// (right) target (white) vs y_via_A (blue) vs y_via_B (amber outline).
// The 1992<->2021 equivalence: A and B are mathematically identical.
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 11500;
const N_PAIRS = 8;
const D_KEY = 8, D_VAL = 8;
const SEED = 60291;

function rdbu(v) {
  v = clamp(v, -1, 1);
  if (v >= 0) {
    const t = v;
    return `rgb(${(60+195*t)|0},${(10+20*(1-t))|0},${(10+20*(1-t))|0})`;
  } else {
    const t = -v;
    return `rgb(${(10+20*(1-t))|0},${(10+20*(1-t))|0},${(60+195*t)|0})`;
  }
}

// Bake the test episode plus per-prefix W_fast and y once.
function buildContext(seed) {
  const rng = mulberry32(seed);
  const keys = [], values = [];
  for (let t = 0; t < N_PAIRS; t++) {
    const k = new Float32Array(D_KEY), v = new Float32Array(D_VAL);
    for (let i = 0; i < D_KEY; i++) k[i] = rng() * 2 - 1;
    for (let i = 0; i < D_VAL; i++) v[i] = (rng() * 2 - 1) * 0.9;
    keys.push(k); values.push(v);
  }
  const q_idx = (rng() * N_PAIRS) | 0;
  const q = keys[q_idx];

  const scores = new Float32Array(N_PAIRS);
  for (let t = 0; t < N_PAIRS; t++) {
    let s = 0;
    for (let i = 0; i < D_KEY; i++) s += keys[t][i] * q[i];
    scores[t] = s / D_KEY;
  }
  const WByT = [new Float32Array(D_VAL * D_KEY)];
  const yByT = [new Float32Array(D_VAL)];
  for (let len = 1; len <= N_PAIRS; len++) {
    const W = new Float32Array(D_VAL * D_KEY);
    W.set(WByT[len - 1]);
    const v = values[len - 1], k = keys[len - 1];
    for (let i = 0; i < D_VAL; i++)
      for (let j = 0; j < D_KEY; j++) W[i * D_KEY + j] += v[i] * k[j];
    WByT.push(W);
    const y = new Float32Array(D_VAL);
    for (let i = 0; i < D_VAL; i++) {
      let s = 0;
      for (let j = 0; j < D_KEY; j++) s += W[i * D_KEY + j] * q[j];
      y[i] = s / D_KEY;
    }
    yByT.push(y);
  }
  const target = values[q_idx];
  let scoreLim = 1e-6, valLim = 1e-6, wLim = 1e-6;
  for (let t = 0; t < N_PAIRS; t++) if (Math.abs(scores[t]) > scoreLim) scoreLim = Math.abs(scores[t]);
  const fullW = WByT[N_PAIRS], fullY = yByT[N_PAIRS];
  for (let i = 0; i < D_VAL; i++) {
    if (Math.abs(target[i]) > valLim) valLim = Math.abs(target[i]);
    if (Math.abs(fullY[i]) > valLim) valLim = Math.abs(fullY[i]);
  }
  for (let i = 0; i < fullW.length; i++) if (Math.abs(fullW[i]) > wLim) wLim = Math.abs(fullW[i]);
  return { q_idx, scores, WByT, yByT, target, scoreLim: scoreLim * 1.2, valLim: valLim * 1.25, wLim: wLim * 1.05 };
}

let _ctx = null;
const getCtx = () => _ctx || (_ctx = buildContext(SEED));

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;
  const C = getCtx();

  const buildPhase = clamp(phase / 0.80, 0, 1);
  const len = Math.min(N_PAIRS, (buildPhase * N_PAIRS) | 0);

  clearBg(ctx, w, h, PALETTE.bg);
  const pad = 6, headerH = 14;
  drawHeader(ctx, pad, 2,
    `> LIN-TFM-FWP  PAIRS ${fmtStep(len, 2)}/${N_PAIRS}  |A-B|: 0.0e+0`,
    PALETTE.amber, 10);

  const topY = headerH + pad;
  const bodyH = h - topY - pad;
  const colW = (w - pad * 4) / 3;

  drawScores  (ctx, pad,                 topY, colW, bodyH, C, len);
  drawWMatrix (ctx, pad * 2 + colW,      topY, colW, bodyH, C, len);
  drawValueBars(ctx, pad * 3 + colW * 2, topY, colW, bodyH, C, len);

  drawBezel(ctx, w, h, PALETTE.amberDim);
}

function drawScores(ctx, x, y, w, h, C, len) {
  label(ctx, x, y, '<k_t, q>', PALETTE.gray, 9);
  const innerY = y + 12, innerH = h - 14;
  const midY = innerY + innerH / 2;
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
  ctx.save(); ctx.strokeStyle = PALETTE.grayDim;
  ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke(); ctx.restore();

  const slotW = w / N_PAIRS;
  const qx = x + (C.q_idx + 0.5) * slotW;
  ctx.save();
  ctx.strokeStyle = PALETTE.green;
  ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(qx, innerY); ctx.lineTo(qx, innerY + innerH); ctx.stroke();
  ctx.restore();

  const halfH = innerH / 2 - 4;
  for (let t = 0; t < len; t++) {
    const v = clamp(C.scores[t] / C.scoreLim, -1, 1);
    const bH = v * halfH;
    const cx = x + (t + 0.5) * slotW;
    const bw = slotW * 0.55;
    ctx.fillStyle = PALETTE.blue;
    if (bH >= 0) ctx.fillRect(cx - bw / 2, midY - bH, bw, bH);
    else         ctx.fillRect(cx - bw / 2, midY, bw, -bH);
    label(ctx, cx - 3, innerY + innerH - 9, String(t), PALETTE.grayDim, 7);
  }
  label(ctx, qx - 12, innerY + 1, `q=${C.q_idx}`, PALETTE.green, 7);
}

function drawWMatrix(ctx, x, y, w, h, C, len) {
  label(ctx, x, y, 'W_fast  v⊗k', PALETTE.gray, 9);
  const innerY = y + 12, innerH = h - 14;
  const cell = Math.min(w / D_KEY, innerH / D_VAL);
  const gridW = cell * D_KEY, gridH = cell * D_VAL;
  const ox = x + (w - gridW) / 2;
  const oy = innerY + (innerH - gridH) / 2;

  const W = C.WByT[len], lim = C.wLim;
  for (let i = 0; i < D_VAL; i++) {
    for (let j = 0; j < D_KEY; j++) {
      ctx.fillStyle = rdbu(clamp(W[i * D_KEY + j] / lim, -1, 1));
      // 1px gap between cells gives a subtle grid look without extra strokes
      ctx.fillRect(ox + j * cell + 0.5, oy + i * cell + 0.5, cell - 1, cell - 1);
    }
  }
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(ox + 0.5, oy + 0.5, gridW, gridH);
}

function drawValueBars(ctx, x, y, w, h, C, len) {
  label(ctx, x, y, 'TGT vs A vs B', PALETTE.gray, 9);
  const innerY = y + 12, innerH = h - 14;
  const midY = innerY + innerH / 2;
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
  ctx.save(); ctx.strokeStyle = PALETTE.grayDim;
  ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke(); ctx.restore();

  const groupW = w / D_VAL;
  const halfH = innerH / 2 - 6;
  const lim = C.valLim;
  const y_via = C.yByT[len];

  for (let d = 0; d < D_VAL; d++) {
    const cx = x + (d + 0.5) * groupW;
    const tH = (C.target[d] / lim) * halfH;
    const yH = (y_via[d] / lim) * halfH;
    const bw = groupW * 0.22;
    // target (white)
    ctx.fillStyle = PALETTE.white;
    if (tH >= 0) ctx.fillRect(cx - bw * 1.5, midY - tH, bw, tH);
    else         ctx.fillRect(cx - bw * 1.5, midY, bw, -tH);
    // y via A (blue)
    ctx.fillStyle = PALETTE.blue;
    if (yH >= 0) ctx.fillRect(cx - bw * 0.5, midY - yH, bw, yH);
    else         ctx.fillRect(cx - bw * 0.5, midY, bw, -yH);
    // y via B (amber outline) — equal to A by construction
    ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 1.25;
    if (yH >= 0) ctx.strokeRect(cx + bw * 0.5 + 0.5, midY - yH + 0.5, bw - 1, Math.max(0, yH - 1));
    else         ctx.strokeRect(cx + bw * 0.5 + 0.5, midY + 0.5, bw - 1, Math.max(0, -yH - 1));
  }

  ctx.fillStyle = PALETTE.white; ctx.fillRect(x + 2, y + h - 8, 6, 6);
  label(ctx, x + 11, y + h - 9, 'TGT', PALETTE.gray, 7);
  ctx.fillStyle = PALETTE.blue;  ctx.fillRect(x + 32, y + h - 8, 6, 6);
  label(ctx, x + 41, y + h - 9, 'A', PALETTE.gray, 7);
  ctx.strokeStyle = PALETTE.amber; ctx.lineWidth = 1.25;
  ctx.strokeRect(x + 54, y + h - 8.5, 5, 5);
  label(ctx, x + 63, y + h - 9, 'B', PALETTE.gray, 7);
}

export default render;
