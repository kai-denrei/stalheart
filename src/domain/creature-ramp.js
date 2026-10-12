// THE CREATURE PROBE'S RAMP (owner, 2026-10-12: "see how many we can afford at once without dropping fps"; spec
// docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md, "The probe"). A state machine over measured frames: it waits
// `startDelay` seconds, then holds `baseline` seconds with no probe bodies and keeps those frames (the sector alone: its mean and p95),
// then asks for `step` more bodies of the tier every `hold` seconds; each frame's real milliseconds go into a sliding span of `span`
// seconds, and once the window's mean has stayed above the LIMIT for `overSeconds` (or the target reaches `hardCap`, or `maxSeconds`
// pass) it is done. THE LIMIT (2026-10-12, the first headed run on the M4: the sector alone ran at ~20 ms, so a fixed 16.7 ms stopped
// every tier at its first step): with `relative`, the most of `thresholdMs`, the baseline's mean x (1 + `overRatio`) and the baseline's
// mean + `overMs` (what the bodies add, not what the sector costs); without (or with no baseline), `thresholdMs`. Every step keeps its own
// frames (after `settle` seconds, the spawn's own hitch excluded) for the result: the most alive, the last step whose mean fitted the
// limit, the mean / p95 of each, and the frame ms each added body costs (a least-squares slope over the baseline and the steps).
// Pure: numbers in, state out. Also the page's ?creatures=<family>:<tier> parse and the share of a wave a tier takes (the knobs come
// from src/content/creature-enemies.js).

export function makeRamp({ step, hold, settle = 0, span: win = 1, thresholdMs, overSeconds, hardCap, startDelay = 0, maxSeconds = Infinity, gapMs = 250,
  baseline = 0, relative = true, overRatio = 0.1, overMs = 1.5 }) {
  return { step, hold, settle, win, thresholdMs, overSeconds, hardCap, startDelay, maxSeconds, gapMs, baseline, relative, overRatio, overMs,
    phase: 'waiting', clock: 0, target: 0, stepAt: 0, over: 0, frames: [], steps: [], maxAlive: 0, reason: null,
    base: { frames: [], alive: [], mean: null, p95: null, alive0: 0 }, limit: thresholdMs, rampAt: 0 };
}

// the limit over a baseline of mean `mean` ms (null: none measured): see THE LIMIT
export function rampLimit({ thresholdMs, relative = true, overRatio = 0.1, overMs = 1.5 }, mean) {
  if (!relative || mean === null || mean === undefined) return thresholdMs;
  return Math.max(thresholdMs, mean * (1 + overRatio), mean + overMs);
}

// the least-squares slope of y over x (0 with fewer than two distinct x)
export function slope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p[0], 0) / n, my = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0;
  for (const [x, y] of points) { sxx += (x - mx) * (x - mx); sxy += (x - mx) * (y - my); }
  return sxx > 1e-12 ? sxy / sxx : 0;
}

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export function percentile(values, p) {
  if (!values.length) return 0;
  const s = values.slice().sort((a, b) => a - b), k = Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1));
  return s[k];
}

// the window's mean frame ms now (0 with no frames)
export const windowMean = (r) => mean(r.frames.map((f) => f.ms));

// one frame: `dt` seconds of the probe's clock, `ms` the real frame time (a gap over gapMs, a hidden tab or a stall, is not measured),
// `alive` the tier's bodies up now. Returns the ramp (its `phase`: 'waiting' | 'baseline' | 'ramping' | 'done'; `target` the bodies it wants up)
export function stepRamp(r, { dt, ms, alive = 0 }) {
  if (r.phase === 'done') return r;
  r.clock += dt;
  if (r.phase === 'waiting') {
    if (r.clock < r.startDelay) return r;
    if (r.baseline > 0) { r.phase = 'baseline'; r.stepAt = r.clock; return r; }
    return startRamp(r);
  }
  if (r.phase === 'baseline') {
    if (ms > 0 && ms <= r.gapMs) { r.base.frames.push(ms); r.base.alive.push(alive); }
    if (r.clock - r.stepAt < r.baseline) return r;
    const b = r.base;
    if (b.frames.length) { b.mean = +mean(b.frames).toFixed(2); b.p95 = +percentile(b.frames, 0.95).toFixed(2); b.alive0 = +mean(b.alive).toFixed(1); }
    r.limit = rampLimit(r, b.mean);
    return startRamp(r);
  }
  r.maxAlive = Math.max(r.maxAlive, alive);
  const cur = r.steps[r.steps.length - 1];
  cur.alive = Math.max(cur.alive, alive);
  if (ms > 0 && ms <= r.gapMs) {
    r.frames.push({ t: r.clock, ms });
    while (r.frames.length && r.frames[0].t < r.clock - r.win) r.frames.shift();
    if (r.clock - r.stepAt >= r.settle) cur.frames.push(ms);
    // over budget only counts once the window is full of this run's frames
    if (r.clock - r.rampAt >= r.win && windowMean(r) > r.limit) r.over += dt; else r.over = 0;
  }
  if (r.over >= r.overSeconds) return finish(r, 'over budget');
  if (r.clock - r.startDelay >= r.maxSeconds) return finish(r, 'time');
  if (r.clock - r.stepAt >= r.hold) {
    if (r.target >= r.hardCap) return finish(r, 'hard cap');
    r.target = Math.min(r.hardCap, r.target + r.step); r.stepAt = r.clock; r.steps.push({ target: r.target, frames: [], alive: 0 });
  }
  return r;
}

function startRamp(r) {
  r.phase = 'ramping'; r.rampAt = r.clock; r.target = Math.min(r.hardCap, r.step); r.stepAt = r.clock; r.steps.push({ target: r.target, frames: [], alive: 0 });
  return r;
}
function finish(r, reason) { r.phase = 'done'; r.reason = reason; return r; }

// the result: each step's target, most alive, mean and p95; `fits` the most alive of the last step whose mean was within the limit
// (`limitMs`; `thresholdMs` the fixed budget); the baseline's mean and p95 (null without one) and whether it was itself over the
// budget; `msPerBody` the frame ms one more body costs (the slope over the baseline at its own alive and every measured step)
export function rampResult(r) {
  const steps = r.steps.map((s) => ({ target: s.target, alive: s.alive, frames: s.frames.length, mean: +mean(s.frames).toFixed(2), p95: +percentile(s.frames, 0.95).toFixed(2) }));
  const ok = steps.filter((s) => s.frames && s.mean <= r.limit);
  const last = r.steps[r.steps.length - 1];
  const tail = r.frames.map((f) => f.ms);
  const b = r.base, points = steps.filter((s) => s.frames).map((s) => [s.alive, s.mean]);
  if (b.mean !== null) points.unshift([b.alive0, b.mean]);
  return { phase: r.phase, reason: r.reason, maxAlive: r.maxAlive, fits: ok.length ? ok[ok.length - 1].alive : 0, target: r.target, thresholdMs: r.thresholdMs,
    limitMs: +r.limit.toFixed(2), baselineMean: b.mean, baselineP95: b.p95, baselineAlive: b.alive0, baselineOver: b.mean !== null && b.mean > r.thresholdMs,
    msPerBody: +slope(points).toFixed(4), frameMean: +mean(tail).toFixed(2), frameP95: +percentile(tail, 0.95).toFixed(2), lastStep: last ? last.target : 0, steps };
}

// ?creatures=<family>:<tier> -> { family, tier } when both are known (`tiers` the content's table), else null
export function parseCreatures(value, tiers) {
  if (typeof value !== 'string' || !value) return null;
  const [family, tier = 'small'] = value.toLowerCase().split(':');
  return tiers?.[family]?.[tier] ? { family, tier } : null;
}

// how many of a wave of `bodies` a tier takes: a share of them (rounded, at least one, at most `max`) or a fixed `count` per wave
export function shareOf(bodies, style) {
  if (!(bodies > 0) || !style) return 0;
  if (style.count !== undefined) return Math.min(bodies, style.count);
  return Math.min(bodies, style.max ?? Infinity, Math.max(1, Math.round(bodies * (style.share ?? 0))));
}

// which of `n` queue slots to replace with `k` creatures: spread evenly through the wave (deterministic), as indices ascending
export function spreadPicks(n, k) {
  if (!(k > 0) || !(n > 0)) return [];
  const out = [], m = Math.min(n, k);
  for (let i = 0; i < m; i++) out.push(Math.min(n - 1, Math.floor((i + 0.5) * n / m)));
  return out;
}
