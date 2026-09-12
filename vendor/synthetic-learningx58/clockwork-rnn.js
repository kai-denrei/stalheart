// clockwork-rnn.js — three rows: (top) target + CW-RNN + vanilla traces,
// (mid) 8xT binary clock-schedule raster (the highlight), (bot) 8 viridis
// hidden-state traces. Loops as training progresses 0->1.
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 12500;
const N_GROUPS = 8;
const T_LEN = 96;
const SEED = 31337;

function viridis(v) {
  v = clamp(v, 0, 1);
  const stops = [[68,1,84],[59,82,139],[33,144,140],[94,201,98],[253,231,37]];
  const seg = v * (stops.length - 1);
  const i = Math.min(seg | 0, stops.length - 2);
  const f = seg - i, a = stops[i], b = stops[i+1];
  return `rgb(${(a[0]+(b[0]-a[0])*f)|0},${(a[1]+(b[1]-a[1])*f)|0},${(a[2]+(b[2]-a[2])*f)|0})`;
}

function buildContext(seed) {
  const rng = mulberry32(seed);
  const target = new Float32Array(T_LEN);
  const sigPeriods = [8, 24, 48, 96];
  const sigPhases = sigPeriods.map(() => rng() * Math.PI * 2);
  for (let i = 0; i < T_LEN; i++) {
    let s = 0;
    for (let k = 0; k < sigPeriods.length; k++) s += Math.sin(2 * Math.PI * i / sigPeriods[k] + sigPhases[k]);
    target[i] = s / sigPeriods.length;
  }
  const groupPhase = new Array(N_GROUPS), groupAmp = new Array(N_GROUPS);
  for (let g = 0; g < N_GROUPS; g++) {
    groupPhase[g] = rng() * Math.PI * 2;
    groupAmp[g]   = 0.55 + 0.45 * rng();
  }
  const vanillaResid = new Float32Array(T_LEN);
  for (let i = 0; i < T_LEN; i++) vanillaResid[i] = (rng() - 0.5) * 0.7;
  return { target, groupPhase, groupAmp, vanillaResid };
}

let _ctx = null;
const getCtx = () => _ctx || (_ctx = buildContext(SEED));

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;
  const trainP = smoothstep(0.05, 0.88, phase);
  const C = getCtx();
  const epoch = (trainP * 1500) | 0;

  clearBg(ctx, w, h, PALETTE.bg);
  const pad = 6, headerH = 14;
  drawHeader(ctx, pad, 2,
    `> CLOCKWORK-RNN  EPOCH ${fmtStep(epoch, 4)}/1500  GROUPS:${N_GROUPS}`,
    PALETTE.green, 10);

  const topY = headerH + pad;
  const bodyH = h - topY - pad;
  const rowGap = 4;
  const rowTopH = Math.floor((bodyH - rowGap * 2) * 0.34);
  const rowMidH = Math.floor((bodyH - rowGap * 2) * 0.26);
  const rowBotH = bodyH - rowGap * 2 - rowTopH - rowMidH;

  drawWaveforms(ctx, pad, topY,                                   w - pad * 2, rowTopH, C, trainP);
  drawClockRaster(ctx, pad, topY + rowTopH + rowGap,              w - pad * 2, rowMidH);
  drawHiddenTraces(ctx, pad, topY + rowTopH + rowMidH + rowGap*2, w - pad * 2, rowBotH, C, trainP, phase);

  drawBezel(ctx, w, h, PALETTE.greenDim);
}

function drawWaveforms(ctx, x, y, w, h, C, p) {
  label(ctx, x, y, 'TARGET / CW-RNN / VANILLA', PALETTE.gray, 9);
  const innerY = y + 11, innerH = h - 12;
  const yMin = -1.4, yMax = 1.4;
  const yPx = (v) => innerY + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const tPx = (i) => x + (i / (T_LEN - 1)) * w;

  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.setLineDash([1, 3]);
  ctx.beginPath(); ctx.moveTo(x, yPx(0)); ctx.lineTo(x + w, yPx(0)); ctx.stroke();
  ctx.restore();

  // helper: draw a trace
  const trace = (color, lw, alpha, fn) => {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < T_LEN; i++) {
      const px = tPx(i), py = yPx(fn(i));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  };
  trace(PALETTE.white, 1.2, 1.0, (i) => C.target[i]);
  trace(PALETTE.green, 1.2, 1.0, (i) => {
    const noiseAmp = lerp(0.7, 0.04, p);
    const n = (hash01(i * 17 + 7) - 0.5) * 2 * noiseAmp;
    return lerp(n, C.target[i] + n * 0.08, smoothstep(0, 1, p));
  });
  trace(PALETTE.red, 1.0, 0.85, (i) => {
    const noiseAmp = lerp(0.7, 0.30, p);
    const n = (hash01(i * 13 + 99) - 0.5) * 2 * noiseAmp;
    return lerp(n, C.target[i] * 0.55 + C.vanillaResid[i] * 0.35, p) + n * 0.15;
  });
}

function drawClockRaster(ctx, x, y, w, h) {
  label(ctx, x, y, 'CLOCK SCHEDULE  (active = bright)', PALETTE.gray, 9);
  const innerY = y + 11, innerH = h - 12;
  ctx.fillStyle = '#050505';
  ctx.fillRect(x, innerY, w, innerH);

  const cellW = w / T_LEN;
  const cellH = innerH / N_GROUPS;
  for (let g = 0; g < N_GROUPS; g++) {
    const fillCol = viridis(g / (N_GROUPS - 1));
    const period = 1 << g;
    ctx.fillStyle = fillCol;
    for (let i = 0; i < T_LEN; i += period) {
      ctx.fillRect(x + i * cellW + 0.5, innerY + g * cellH + 0.5,
                   Math.max(1, cellW - 1), Math.max(1, cellH - 1));
    }
  }
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
}

function drawHiddenTraces(ctx, x, y, w, h, C, p, phase) {
  label(ctx, x, y, 'HIDDEN MEAN PER GROUP  (slow=violet, fast=yellow)', PALETTE.gray, 9);
  const innerY = y + 11, innerH = h - 12;
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);

  const yPx = (v) => innerY + innerH/2 - v * (innerH/2 - 2);
  const tPx = (i) => x + (i / (T_LEN - 1)) * w;
  const drift = phase * 2 * Math.PI;

  for (let g = 0; g < N_GROUPS; g++) {
    ctx.save();
    ctx.strokeStyle = viridis(g / (N_GROUPS - 1));
    ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    const periodSamples = 1 << g;
    const omega = 2 * Math.PI / Math.max(2, periodSamples);
    for (let i = 0; i < T_LEN; i++) {
      // step-hold: each group only updates at its tick boundary
      const lastTick = i - (i % periodSamples);
      const a = lerp(0.10, C.groupAmp[g], p);
      const v = a * Math.sin(omega * lastTick + C.groupPhase[g] + drift);
      const px = tPx(i), py = yPx(v);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export default render;
