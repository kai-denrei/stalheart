// moving-light.js — moving-light input strip + 6x2 magma heatmap + accuracy curve.
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 12000;
const N_CELLS = 5;
const SEED = 4242;

// magma-ish gradient via 4 stops, mapped t in [0,1].
function magma(t) {
  t = clamp(t, 0, 1);
  const stops = [[0,0,0], [80,18,90], [220,80,30], [255,220,130]];
  const seg = t * (stops.length - 1);
  const i = Math.min(seg | 0, stops.length - 2);
  const f = seg - i, a = stops[i], b = stops[i + 1];
  const r = (a[0] + (b[0] - a[0]) * f) | 0;
  const g = (a[1] + (b[1] - a[1]) * f) | 0;
  const bl = (a[2] + (b[2] - a[2]) * f) | 0;
  return `rgb(${r},${g},${bl})`;
}

function buildHistory(seed) {
  const N = 90;
  const rng = mulberry32(seed);
  // Rows: bias + 5 cells. Cols: out[0]=LR, out[1]=RL.
  const target = [
    [1.00, 1.00], [1.10, 0.90], [1.05, 0.95],
    [1.00, 1.00], [0.95, 1.05], [0.90, 1.10],
  ];
  const W = [];
  for (let i = 0; i < 6; i++) W.push([1.0 + (rng() - 0.5) * 0.04, 1.0 + (rng() - 0.5) * 0.04]);

  const history = new Array(N);
  for (let s = 0; s < N; s++) {
    const a = smoothstep(0, N - 1, s);
    const jitter = 0.04 * (1 - a) + 0.005;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 2; j++) {
        const noise = (hash01(s * 211 + i * 13 + j) - 0.5) * jitter;
        W[i][j] = lerp(W[i][j], target[i][j] + noise, 0.18);
      }
    }
    const acc = 2 * smoothstep(0.10, 0.80, a);
    const accInt = clamp(Math.round(acc + (hash01(s * 23) - 0.5) * 0.3), 0, 2);
    history[s] = { W: W.map(row => row.slice()), acc: accInt, accF: acc };
  }
  return history;
}

let _history = null;
const getHistory = () => _history || (_history = buildHistory(SEED));

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

  // Light position: multiple sweeps per cycle.
  const sweepsPerCycle = 4;
  const sweepPhase = (phase * sweepsPerCycle) % 1;
  const lightPos = sweepPhase * (N_CELLS - 1);
  const lightDir = (Math.floor(phase * sweepsPerCycle) % 2) === 0 ? 'LR' : 'RL';

  drawHeader(ctx, pad, 2,
    `> MOVING-LIGHT  STEP ${fmtStep(step * 50, 4)}/${fmtStep(50 * (N - 1), 4)}  ACC: ${frame.acc}/2  DIR:${lightDir}`,
    PALETTE.amber, 10);

  const topY = headerH + pad;
  const topH = Math.floor((h - headerH - pad * 3) * 0.62);
  const botY = topY + topH + pad;
  const botH = h - botY - pad;

  const hmW = Math.floor((w - pad * 3) * 0.55);
  drawHeatmap(ctx, pad, topY, hmW, topH, frame.W);
  drawLightStrip(ctx, pad + hmW + pad, topY, w - (pad + hmW + pad) - pad, topH, lightPos, lightDir);
  drawAccCurve(ctx, pad, botY, w - pad * 2, botH, history, stepF);

  drawBezel(ctx, w, h, PALETTE.amberDim);
}

function drawHeatmap(ctx, x, y, w, h, W) {
  label(ctx, x, y, 'W_io  6x2', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 12;
  const cellW = w / 2;
  const cellH = innerH / 6;
  const labels = ['bias', 'c0', 'c1', 'c2', 'c3', 'c4'];
  const lo = 0.85, hi = 1.15;

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 2; j++) {
      const v = clamp((W[i][j] - lo) / (hi - lo), 0, 1);
      ctx.fillStyle = magma(v);
      ctx.fillRect(x + j * cellW, innerY + i * cellH, cellW + 0.5, cellH + 0.5);
    }
    label(ctx, x - 1, innerY + i * cellH + cellH / 2 - 4, labels[i], PALETTE.grayDim, 7);
  }

  ctx.save();
  ctx.fillStyle = PALETTE.gray;
  ctx.font = '8px "Courier New", ui-monospace, monospace';
  ctx.textBaseline = 'bottom';
  ctx.fillText('o[0]', x + cellW * 0.3, innerY - 1);
  ctx.fillText('o[1]', x + cellW * 1.3, innerY - 1);
  ctx.restore();

  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);
}

function drawLightStrip(ctx, x, y, w, h, lightPos, dir) {
  label(ctx, x, y, `INPUT 1x${N_CELLS}`, PALETTE.gray, 9);
  const stripY = y + 18;
  const stripH = Math.min(h - 24, 36);
  const cellW = w / N_CELLS;

  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, stripY + 0.5, w - 1, stripH - 1);

  for (let c = 0; c < N_CELLS; c++) {
    const d = Math.abs(c - lightPos);
    const intensity = Math.exp(-d * d * 1.8);
    const r = (255 * intensity) | 0;
    const g = (170 * intensity) | 0;
    const b = (40 * intensity) | 0;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x + c * cellW + 1, stripY + 1, cellW - 2, stripH - 2);
    label(ctx, x + c * cellW + cellW / 2 - 3, stripY + stripH + 2, String(c), PALETTE.grayDim, 8);
  }

  // direction arrow
  const arrowY = stripY + stripH + 16;
  ctx.save();
  ctx.strokeStyle = PALETTE.amber;
  ctx.beginPath();
  if (dir === 'LR') {
    ctx.moveTo(x + 4, arrowY); ctx.lineTo(x + w - 6, arrowY);
    ctx.lineTo(x + w - 10, arrowY - 3);
    ctx.moveTo(x + w - 6, arrowY); ctx.lineTo(x + w - 10, arrowY + 3);
  } else {
    ctx.moveTo(x + w - 4, arrowY); ctx.lineTo(x + 6, arrowY);
    ctx.lineTo(x + 10, arrowY - 3);
    ctx.moveTo(x + 6, arrowY); ctx.lineTo(x + 10, arrowY + 3);
  }
  ctx.stroke();
  ctx.restore();
}

function drawAccCurve(ctx, x, y, w, h, history, stepF) {
  label(ctx, x, y, 'ACC (0-2)', PALETTE.gray, 9);
  const innerY = y + 12;
  const innerH = h - 14;
  const N = history.length;

  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);

  ctx.save();
  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const cur = Math.min((stepF | 0) + 1, N);
  for (let s = 0; s < cur; s++) {
    const px = x + (s / (N - 1)) * w;
    const py = innerY + innerH - (history[s].accF / 2) * innerH;
    if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  const phx = x + (stepF / (N - 1)) * w;
  ctx.save();
  ctx.strokeStyle = PALETTE.green;
  ctx.beginPath(); ctx.moveTo(phx, innerY); ctx.lineTo(phx, innerY + innerH); ctx.stroke();
  ctx.restore();
}

export default render;
