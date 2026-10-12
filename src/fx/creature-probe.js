// THE CREATURE PROBE (owner, 2026-10-12: "start with a perf probe"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md,
// "The probe"). `&ramp=1` with ?creatures=<family>:<tier>: on top of the running sector it keeps a rising number of the tier's bodies up
// (src/domain/creature-ramp.js: a step every hold, the frame's real ms in a sliding mean, done when it stays over budget), then shows a
// result card at the top centre (dismissable), publishes it for the test hook and logs one `console.info` line. The frame time is the
// real time between this probe's frames (the crowd gate's measure, src/fx/crowd-gate.js); the CPU split, GPU ms, draw calls and
// triangles are the perf overlay's sample (src/platform/perf-overlay.js; the probe turns the overlay on).
import { makeRamp, stepRamp, rampResult, windowMean } from '../domain/creature-ramp.js';

// `root` the game's DOM root (the card), `family`/`tier`/`def` the tier, `tune` CREATURE_PROBE (or its test overrides merged), `spawn(n)` adds
// up to n of the tier's bodies and returns how many it did, `alive()` the tier's records up, `total()` every enemy up, `perf()` the perf
// overlay's sample (null while off), `perfOn()` turns the overlay on, `bodies()` the bodies' stats, `now()` real milliseconds
export function createCreatureProbe({ root, family, tier, def, tune, spawn, alive, total, perf, perfOn, bodies, now = () => performance.now() }) {
  const cap = Math.min(tune.hardCap, def.capacity ?? tune.hardCap);
  const ramp = makeRamp({ step: def.probeStep, hold: tune.hold, settle: tune.settle, span: tune.span, thresholdMs: tune.thresholdMs, overSeconds: tune.overSeconds, hardCap: cap,
    startDelay: tune.startDelay, maxSeconds: tune.maxSeconds, gapMs: tune.gapMs });
  let last = null, result = null, card = null, spawned = 0, peakTotal = 0, sampleAt = null;

  function step(dt) {
    const t = now(), ms = last === null ? 0 : t - last;
    if (last === null) perfOn?.();   // the overlay's sample carries the CPU split, GPU ms, draw calls and triangles
    last = t;
    if (ramp.phase === 'done') return;
    const up = alive();
    peakTotal = Math.max(peakTotal, total());
    stepRamp(ramp, { dt, ms, alive: up });
    if (ramp.phase === 'ramping' && up < ramp.target) spawned += spawn(Math.min(tune.perFrame, ramp.target - up));
    const s = perf?.();
    if (s && ramp.phase === 'ramping') sampleAt = { ...s, alive: up, target: ramp.target, window: windowMean(ramp) };
    if (ramp.phase === 'done') finish();
  }

  function finish() {
    const r = rampResult(ramp), s = sampleAt ?? perf?.() ?? null, b = bodies?.() ?? null, tierStats = b?.families?.[family]?.[tier] ?? null;
    result = {
      family, tier, label: def.label, done: true, reason: r.reason, maxAlive: r.maxAlive, fits: r.fits, target: r.target, thresholdMs: r.thresholdMs,
      totalAlive: total(), peakTotal, frameMean: r.frameMean, frameP95: r.frameP95,
      enemiesCpuMs: s?.cpu ? +s.cpu.enemies.toFixed(2) : null, frameCpuMs: s?.cpu ? +s.cpu.frame.toFixed(2) : null, gpuMs: s?.gpuMs != null ? +s.gpuMs.toFixed(2) : null,
      calls: s?.calls ?? null, triangles: s?.triangles ?? null, replaced: b?.replaced ?? 0, spawned, slotsRefused: tierStats?.full ?? 0, steps: r.steps,
    };
    console.info(`CREATURE PROBE ${family}:${tier} maxAlive=${result.maxAlive} fits=${result.fits} total=${result.totalAlive} frameMs=${result.frameMean} p95=${result.frameP95}`
      + ` enemiesCpu=${result.enemiesCpuMs} gpu=${result.gpuMs} calls=${result.calls} tris=${result.triangles} replaced=${result.replaced} reason=${result.reason}`);
    show();
  }

  function show() {
    if (!root || typeof document === 'undefined') return;
    card?.remove();
    card = document.createElement('div'); card.id = 'creature-probe-card';
    card.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:60;max-width:calc(100vw - 32px);box-sizing:border-box;'
      + 'font:12px/1.55 ui-monospace,Menlo,monospace;color:#e8f2f4;background:rgba(4,12,16,.88);border:1px solid #5d7a84;padding:10px 34px 10px 16px;letter-spacing:.06em';
    const r = result, n = (v, d = 1) => (v === null || v === undefined ? '—' : typeof v === 'number' ? v.toFixed(d) : v);
    const rows = [
      `<div style="font-size:15px;font-weight:700;letter-spacing:.14em">CREATURE PROBE · ${r.family}:${r.tier}</div>`,
      `<div>most ${r.label} alive <b>${r.maxAlive}</b> · within ${r.thresholdMs} ms <b>${r.fits}</b> · enemies alive ${r.totalAlive} (peak ${r.peakTotal})</div>`,
      `<div>frame ${n(r.frameMean)} ms mean · ${n(r.frameP95)} ms p95 · enemies CPU ${n(r.enemiesCpuMs, 2)} ms · GPU ${r.gpuMs === null ? 'n/a' : `${n(r.gpuMs)} ms`}</div>`,
      `<div>${n(r.calls, 0)} draw calls · ${r.triangles === null ? '—' : `${(r.triangles / 1000).toFixed(1)}k`} tris · re-placed ${r.replaced} · stopped: ${r.reason}</div>`,
      `<div style="opacity:.7">${r.steps.slice(-6).map((s) => `${s.alive}: ${s.mean}/${s.p95}`).join(' · ')} (alive: mean/p95 ms)</div>`,
    ];
    card.innerHTML = rows.join('') + '<button type="button" aria-label="Dismiss" style="position:absolute;top:4px;right:6px;background:none;border:0;color:#e8f2f4;font:16px ui-monospace,monospace;cursor:pointer">×</button>';
    card.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); card.remove(); card = null; });
    card.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    root.appendChild(card);
  }

  return {
    step,
    // the test hook's view: the phase, the target, the tier alive, and the result once done
    state: () => ({ family, tier, phase: ramp.phase, target: ramp.target, maxAlive: ramp.maxAlive, steps: ramp.steps.length, spawned, window: +windowMean(ramp).toFixed(2), card: !!card?.isConnected, result }),
    dispose: () => { card?.remove(); card = null; },
  };
}
