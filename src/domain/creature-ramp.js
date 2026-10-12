// THE CREATURE PROBE'S RAMP (owner, 2026-10-12: "see how many we can afford at once without dropping fps"; spec
// docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md, "The probe"). A state machine over measured frames: it waits
// `startDelay` seconds, then asks for `step` more bodies of the tier every `hold` seconds; each frame's real milliseconds go into a
// sliding span of `span` seconds, and once the window's mean has stayed above `thresholdMs` for `overSeconds` (or the target reaches
// `hardCap`, or `maxSeconds` pass) it is done. Every step keeps its own frames (after `settle` seconds, the spawn's own hitch excluded)
// for the result: the most alive, the last step whose mean fitted the budget, and the mean / p95 of each. Pure: numbers in, state out.
// Also the page's ?creatures=<family>:<tier> parse and the share of a wave a tier takes (the knobs come from src/content/creature-enemies.js).

export function makeRamp({ step, hold, settle = 0, span: win = 1, thresholdMs, overSeconds, hardCap, startDelay = 0, maxSeconds = Infinity, gapMs = 250 }) {
  return { step, hold, settle, win, thresholdMs, overSeconds, hardCap, startDelay, maxSeconds, gapMs,
    phase: 'waiting', clock: 0, target: 0, stepAt: 0, over: 0, frames: [], steps: [], maxAlive: 0, reason: null };
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
// `alive` the tier's bodies up now. Returns the ramp (its `phase`: 'waiting' | 'ramping' | 'done'; `target` the bodies it wants up)
export function stepRamp(r, { dt, ms, alive = 0 }) {
  if (r.phase === 'done') return r;
  r.clock += dt;
  if (r.phase === 'waiting') {
    if (r.clock < r.startDelay) return r;
    r.phase = 'ramping'; r.target = Math.min(r.hardCap, r.step); r.stepAt = r.clock; r.steps.push({ target: r.target, frames: [], alive: 0 });
    return r;
  }
  r.maxAlive = Math.max(r.maxAlive, alive);
  const cur = r.steps[r.steps.length - 1];
  cur.alive = Math.max(cur.alive, alive);
  if (ms > 0 && ms <= r.gapMs) {
    r.frames.push({ t: r.clock, ms });
    while (r.frames.length && r.frames[0].t < r.clock - r.win) r.frames.shift();
    if (r.clock - r.stepAt >= r.settle) cur.frames.push(ms);
    // over budget only counts once the window is full of this run's frames
    if (r.clock - r.startDelay >= r.win && windowMean(r) > r.thresholdMs) r.over += dt; else r.over = 0;
  }
  if (r.over >= r.overSeconds) return finish(r, 'over budget');
  if (r.clock - r.startDelay >= r.maxSeconds) return finish(r, 'time');
  if (r.clock - r.stepAt >= r.hold) {
    if (r.target >= r.hardCap) return finish(r, 'hard cap');
    r.target = Math.min(r.hardCap, r.target + r.step); r.stepAt = r.clock; r.steps.push({ target: r.target, frames: [], alive: 0 });
  }
  return r;
}

function finish(r, reason) { r.phase = 'done'; r.reason = reason; return r; }

// the result: each step's target, most alive, mean and p95; `fits` the most alive of the last step whose mean was within budget
export function rampResult(r) {
  const steps = r.steps.map((s) => ({ target: s.target, alive: s.alive, frames: s.frames.length, mean: +mean(s.frames).toFixed(2), p95: +percentile(s.frames, 0.95).toFixed(2) }));
  const ok = steps.filter((s) => s.frames && s.mean <= r.thresholdMs);
  const last = r.steps[r.steps.length - 1];
  const tail = r.frames.map((f) => f.ms);
  return { phase: r.phase, reason: r.reason, maxAlive: r.maxAlive, fits: ok.length ? ok[ok.length - 1].alive : 0, target: r.target, thresholdMs: r.thresholdMs,
    frameMean: +mean(tail).toFixed(2), frameP95: +percentile(tail, 0.95).toFixed(2), lastStep: last ? last.target : 0, steps };
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
