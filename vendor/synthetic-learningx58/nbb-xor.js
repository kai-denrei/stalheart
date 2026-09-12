// nbb-xor.js — 3x3 Hinton diagram + output-preference bar + accuracy curve.
// render(ctx, t, w, h, opts?) — pure, deterministic, seamless loop.

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 11000;
const SEED = 1337;

function buildHistory(seed) {
  const N = 80;                       // discrete steps per cycle
  const rng = mulberry32(seed);
  // Target W_ih: deterministic structured target so weights look meaningful.
  const target = [
    [ 0.6, -0.8,  0.2],   // bias row
    [-0.7,  0.9, -0.3],   // x1 row
    [ 0.8, -0.6,  0.5],   // x2 row
  ];
  const W = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      W[i][j] = (rng() - 0.5) * 0.05;
  const targetPref = [0.045, -0.05, 0.03];
  const pref = [0, 0, 0];
  for (let j = 0; j < 3; j++) pref[j] = (rng() - 0.5) * 0.005;

  const history = new Array(N);
  for (let s = 0; s < N; s++) {
    const a = smoothstep(0, N - 1, s);
    const jitter = 0.06 * (1 - a) + 0.02;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const noise = (hash01(s * 131 + i * 11 + j) - 0.5) * jitter;
        W[i][j] = lerp(W[i][j], target[i][j] + noise, 0.18);
      }
    }
    for (let j = 0; j < 3; j++) {
      const noise = (hash01(s * 53 + j * 7 + 9001) - 0.5) * 0.012 * (1 - a);
      pref[j] = lerp(pref[j], targetPref[j] + noise, 0.16);
    }
    const acc = 4 * smoothstep(0.05, 0.85, a);
    const accInt = clamp(Math.round(acc + (hash01(s * 17) - 0.5) * 0.25), 0, 4);
    history[s] = {
      W: [W[0].slice(), W[1].slice(), W[2].slice()],
      pref: pref.slice(),
      acc: accInt,
      accF: acc,
    };
  }
  return history;
}

let _cachedHistory = null;
const getHistory = () => _cachedHistory || (_cachedHistory = buildHistory(SEED));

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;
  const history = getHistory();
  const N = history.length;
  const stepF = phase * (N - 1);
  const step = stepF | 0;
  const frame = history[step];

  clearBg(ctx, w, h, PALETTE.bg);

  const pad = 8;
  const headerH = 14;
  const topH = Math.floor((h - headerH - pad * 2) * 0.58);
  const botY = headerH + pad + topH + pad;
  const botH = h - botY - pad;

  const stepNum = (step * 60) | 0;
  drawHeader(ctx, pad, 2,
    `> NBB-XOR  STEP ${fmtStep(stepNum, 4)}/${fmtStep(60 * (N - 1), 4)}  ACC: ${frame.acc}/4`,
    PALETTE.green, 10);

  const hintonW = Math.floor((w - pad * 3) * 0.55);
  const hintonX = pad;
  const hintonY = headerH + pad;
  drawHinton(ctx, hintonX, hintonY, hintonW, topH, frame.W);

  const prefX = hintonX + hintonW + pad;
  drawPrefBars(ctx, prefX, hintonY, w - prefX - pad, topH, frame.pref);

  drawAccCurve(ctx, pad, botY, w - pad * 2, botH, history, stepF);
  drawBezel(ctx, w, h, PALETTE.greenDim);
}

function drawHinton(ctx, x, y, w, h, W) {
  label(ctx, x, y, 'W_ih  3x3', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 12;
  const cellW = w / 3;
  const cellH = innerH / 3;

  let maxAbs = 1e-6;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (Math.abs(W[i][j]) > maxAbs) maxAbs = Math.abs(W[i][j]);

  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const yy = innerY + i * cellH;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
  }
  for (let j = 0; j <= 3; j++) {
    const xx = x + j * cellW;
    ctx.beginPath(); ctx.moveTo(xx, innerY); ctx.lineTo(xx, innerY + innerH); ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const v = W[i][j];
      const mag = Math.sqrt(Math.abs(v) / maxAbs);
      const sw = cellW * 0.85 * mag;
      const sh = cellH * 0.85 * mag;
      const cx = x + (j + 0.5) * cellW;
      const cy = innerY + (i + 0.5) * cellH;
      ctx.fillStyle = v >= 0 ? PALETTE.amber : PALETTE.blue;
      ctx.fillRect(cx - sw / 2, cy - sh / 2, sw, sh);
    }
  }
}

function drawPrefBars(ctx, x, y, w, h, pref) {
  label(ctx, x, y, 'OUT PREF', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 12;
  const rowH = innerH / 3;
  const midX = x + w / 2;
  const maxAbs = 0.06;

  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.beginPath(); ctx.moveTo(midX, innerY); ctx.lineTo(midX, innerY + innerH); ctx.stroke();
  ctx.restore();

  for (let i = 0; i < 3; i++) {
    const v = clamp(pref[i] / maxAbs, -1, 1);
    const barLen = (w / 2 - 4) * v;
    const cy = innerY + (i + 0.5) * rowH;
    const barH = Math.min(rowH * 0.55, 10);
    ctx.fillStyle = v >= 0 ? PALETTE.green : PALETTE.red;
    if (barLen >= 0) ctx.fillRect(midX, cy - barH / 2, barLen, barH);
    else             ctx.fillRect(midX + barLen, cy - barH / 2, -barLen, barH);
    label(ctx, x, cy - 4, `h${i}`, PALETTE.gray, 8);
  }
}

function drawAccCurve(ctx, x, y, w, h, history, stepF) {
  label(ctx, x, y, 'ACC (0-4)', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 14;
  const N = history.length;

  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
  ctx.setLineDash([2, 3]);
  for (let g = 1; g <= 3; g++) {
    const gy = innerY + innerH - (g / 4) * innerH;
    ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = PALETTE.green;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const cur = Math.min((stepF | 0) + 1, N);
  for (let s = 0; s < cur; s++) {
    const px = x + (s / (N - 1)) * w;
    const py = innerY + innerH - (history[s].accF / 4) * innerH;
    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  const phx = x + (stepF / (N - 1)) * w;
  ctx.save();
  ctx.strokeStyle = PALETTE.amber;
  ctx.beginPath(); ctx.moveTo(phx, innerY); ctx.lineTo(phx, innerY + innerH); ctx.stroke();
  ctx.restore();
}

export default render;
