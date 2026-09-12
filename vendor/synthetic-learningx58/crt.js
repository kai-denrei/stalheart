// crt.js — shared CRT-aesthetic helpers for all animations.
// No state, no allocations in hot loops where avoidable.

// 8-bit-ish palette. Keep this list tight; animations should pull from here.
export const PALETTE = {
  bg:        '#000000',
  bgDim:     '#050505',
  green:     '#00ff41',  // phosphor primary
  greenDim:  '#007a1f',
  amber:     '#ffaa00',
  amberDim:  '#7a4f00',
  red:       '#ff5555',
  redDim:    '#7a2424',
  blue:      '#5599ff',
  blueDim:   '#23457a',
  gray:      '#aaaaaa',
  grayDim:   '#444444',
  white:     '#e0e0e0',
};

// Mulberry32 — fast deterministic PRNG. Returns a function f() in [0,1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Cheap deterministic hash → [0,1) for "noise per frame index" lookups.
export function hash01(n) {
  let x = (n | 0) ^ 0x9E3779B9;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Linear interpolation.
export const lerp = (a, b, t) => a + (b - a) * t;

// Clamp.
export const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;

// Smoothstep.
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Apply 1px scanlines across the rect (every other row).
// Cheap: a single fillRect per row, semi-transparent black.
export function applyScanlines(ctx, w, h, opts = {}) {
  const alpha = opts.alpha ?? 0.18;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += 2) {
    ctx.fillRect(0, y, w, 1);
  }
  ctx.restore();
}

// Sparse static noise: scatter ~intensity*w*h tiny pixels across the rect.
// Deterministic when given a seedFrame.
export function staticNoise(ctx, w, h, intensity = 0.03, seedFrame = 0) {
  const count = (w * h * intensity) | 0;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < count; i++) {
    const r = hash01(seedFrame * 7919 + i * 31);
    const r2 = hash01(seedFrame * 6151 + i * 17);
    ctx.fillRect((r * w) | 0, (r2 * h) | 0, 1, 1);
  }
  ctx.restore();
}

// Phosphor glow wrapper: call drawFn while a shadowBlur is in effect.
// Use sparingly — shadowBlur is expensive on big strokes.
export function phosphorGlow(ctx, drawFn, color, blur = 6) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  drawFn(ctx);
  ctx.restore();
}

// Draw a thin outer bezel/border to suggest a CRT panel.
export function drawBezel(ctx, w, h, color = PALETTE.greenDim) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.restore();
}

// Render a small terminal-style header line at (x,y).
// Returns nothing. Always uses monospace stack.
export function drawHeader(ctx, x, y, text, color = PALETTE.green, size = 10) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Draw monospace label.
export function label(ctx, x, y, text, color = PALETTE.gray, size = 9, baseline = 'top') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px "Courier New", ui-monospace, monospace`;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Clear rect to background.
export function clearBg(ctx, w, h, color = PALETTE.bg) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

// Format a 4-digit step counter.
export function fmtStep(n, width = 4) {
  const s = String(n | 0);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}
