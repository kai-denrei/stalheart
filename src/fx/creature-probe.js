// THE CREATURE PROBE (owner, 2026-10-12: "start with a perf probe"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md,
// "The probe"). `&ramp=1` with ?creatures=<family>:<tier>: on top of the running sector it keeps a rising number of the tier's bodies up
// (src/domain/creature-ramp.js: the sector alone first, its baseline, then a step every hold, the frame's real ms in a sliding mean, done when it
// stays over the limit relative to the baseline), then shows a
// result card at the top centre (dismissable), publishes it for the test hook and logs one `console.info` line. The frame time is the
// real time between this probe's frames (the crowd gate's measure, src/fx/crowd-gate.js); the CPU split, GPU ms, draw calls and
// triangles are the perf overlay's sample (src/platform/perf-overlay.js; the probe turns the overlay on).
import { makeRamp, stepRamp, rampResult, windowMean } from '../domain/creature-ramp.js';

// `root` the game's DOM root (the card), `family`/`tier`/`def` the tier, `tune` CREATURE_PROBE (or its test overrides merged), `spawn(n)` adds
// up to n of the tier's bodies and returns how many it did, `alive()` the tier's records up, `total()` every enemy up, `perf()` the perf
// overlay's sample (null while off), `perfOn()` turns the overlay on, `bodies()` the bodies' stats, `defence()` the ground and the
// garrison (src/fx/creature-enemies.js: the sentries built, their hits and kills on the creatures, the spawn band, the held heart),
// `now()` real milliseconds
export function createCreatureProbe({ root, family, tier, def, tune, spawn, alive, total, perf, perfOn, bodies, defence = null, now = () => performance.now() }) {
  const cap = Math.min(tune.hardCap, def.capacity ?? tune.hardCap);
  const ramp = makeRamp({ step: def.probeStep, hold: tune.hold, settle: tune.settle, span: tune.span, thresholdMs: tune.thresholdMs, overSeconds: tune.overSeconds, hardCap: cap,
    startDelay: tune.startDelay, maxSeconds: tune.maxSeconds, gapMs: tune.gapMs, baseline: tune.baseline, relative: tune.relative, overRatio: tune.overRatio, overMs: tune.overMs });
  let last = null, result = null, card = null, spawned = 0, peakTotal = 0, sampleAt = null;

  function step(dt) {
    const t = now(), ms = last === null ? 0 : t - last;
    if (last === null) perfOn?.();   // the overlay's sample carries the CPU split, GPU ms, draw calls and triangles
    last = t;
    if (ramp.phase === 'done') return;
    const up = alive();
    peakTotal = Math.max(peakTotal, total());
    // the ramp runs on the wall clock, not the game's dt (2026-10-12, the headed M4 run: the game's clock gave the probe ~48 s in 900 s of real time)
    stepRamp(ramp, { dt: ms > 0 ? Math.min(ms, 1000) / 1000 : dt, ms, alive: up });
    if (ramp.phase === 'ramping' && up < ramp.target) spawned += spawn(Math.min(tune.perFrame, ramp.target - up));
    const s = perf?.();
    if (s && ramp.phase === 'ramping') sampleAt = { ...s, alive: up, target: ramp.target, window: windowMean(ramp) };
    if (ramp.phase === 'done') finish();
  }

  function finish() {
    const r = rampResult(ramp), s = sampleAt ?? perf?.() ?? null, b = bodies?.() ?? null, tierStats = b?.families?.[family]?.[tier] ?? null;
    result = {
      family, tier, label: def.label, done: true, reason: r.reason, maxAlive: r.maxAlive, fits: r.fits, target: r.target, thresholdMs: r.thresholdMs, limitMs: r.limitMs,
      baselineMean: r.baselineMean, baselineP95: r.baselineP95, baselineAlive: r.baselineAlive, baselineOver: r.baselineOver, msPerBody: r.msPerBody,
      totalAlive: total(), peakTotal, frameMean: r.frameMean, frameP95: r.frameP95,
      enemiesCpuMs: s?.cpu ? +s.cpu.enemies.toFixed(2) : null, frameCpuMs: s?.cpu ? +s.cpu.frame.toFixed(2) : null, gpuMs: s?.gpuMs != null ? +s.gpuMs.toFixed(2) : null,
      calls: s?.calls ?? null, triangles: s?.triangles ?? null, replaced: b?.replaced ?? 0, spawned, slotsRefused: tierStats?.full ?? 0, steps: r.steps,
      // a family with its own solver (the Reeds, src/fx/creature-reed.js): the ms a body costs a frame, the family's solver ms (running mean), its rate
      bodyMs: tierStats?.bodyMs ?? null, solverMs: tierStats?.solverMean ?? null, solverHz: tierStats?.hz ?? null,
      // THE DEFENCE (owner, 2026-10-12): the sentries that stood, what they did to the creatures, where the bodies came up, the heart held
      ...(defence ? { defence: defence() } : {}),
    };
    console.info(`CREATURE PROBE ${family}:${tier} maxAlive=${result.maxAlive} fits=${result.fits} limitMs=${result.limitMs} baseline=${result.baselineMean}/${result.baselineP95}`
      + ` msPerBody=${result.msPerBody} total=${result.totalAlive} frameMs=${result.frameMean} p95=${result.frameP95}`
      + `${result.bodyMs === null ? '' : ` bodyMs=${result.bodyMs} solverMs=${result.solverMs} hz=${result.solverHz}`} enemiesCpu=${result.enemiesCpuMs} gpu=${result.gpuMs} calls=${result.calls} tris=${result.triangles} replaced=${result.replaced} reason=${result.reason}`
      + `${result.defence ? ` sentries=${result.defence.sentries} sentryKills=${result.defence.fight.kills} band=${result.defence.band ? `${result.defence.band.lo}-${result.defence.band.hi}` : '-'} heartHeld=${result.defence.heartHeld}` : ''}`);
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
      r.baselineMean === null ? '' : `<div>sector alone ${n(r.baselineMean)} ms mean · ${n(r.baselineP95)} ms p95${r.baselineOver ? ` · <b>the sector alone runs at ${n(r.baselineMean)} ms</b>, over ${r.thresholdMs} ms${tune.relative === false ? '' : ': the limit is relative'}` : ''}</div>`,
      `<div>most ${r.label} alive <b>${r.maxAlive}</b> · within ${n(r.limitMs)} ms <b>${r.fits}</b> · +${n(r.msPerBody, 3)} ms a body · enemies alive ${r.totalAlive} (peak ${r.peakTotal})</div>`,
      `<div>frame ${n(r.frameMean)} ms mean · ${n(r.frameP95)} ms p95 · enemies CPU ${n(r.enemiesCpuMs, 2)} ms · GPU ${r.gpuMs === null ? 'n/a' : `${n(r.gpuMs)} ms`}</div>`,
      r.bodyMs === null ? '' : `<div>solver ${n(r.bodyMs, 2)} ms a body · ${n(r.solverMs, 1)} ms all bodies · at ${r.solverHz} Hz</div>`,
      `<div>${n(r.calls, 0)} draw calls · ${r.triangles === null ? '—' : `${(r.triangles / 1000).toFixed(1)}k`} tris · re-placed ${r.replaced} · stopped: ${r.reason}</div>`,
      r.defence ? defenceRows(r.defence) : '',
      `<div style="opacity:.7">${r.steps.slice(-6).map((s) => `${s.alive}: ${s.mean}/${s.p95}`).join(' · ')} (alive: mean/p95 ms)</div>`,
    ];
    card.innerHTML = rows.join('') + '<button type="button" aria-label="Dismiss" style="position:absolute;top:4px;right:6px;background:none;border:0;color:#e8f2f4;font:16px ui-monospace,monospace;cursor:pointer">×</button>';
    card.querySelector('button').addEventListener('click', (ev) => { ev.stopPropagation(); card.remove(); card = null; });
    card.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    root.appendChild(card);
  }

  // the defence's lines: the sentries (count, types), their kills on the creatures, the spawn band, the held heart
  function defenceRows(d) {
    const types = Object.entries(d.types).map(([k, v]) => `${v} ${k}`).join(', ') || 'none';
    const band = d.band ? `${d.band.lo}–${d.band.hi} hops beyond the gate (${d.band.cells} cells)` : 'none (no gate)';
    return `<div>sentries <b>${d.sentries}</b> (${types}) · sentry kills <b>${d.fight.kills}</b> of the tier (${d.fight.killsAll} creatures, ${d.fight.hits} hits)</div>`
      + `<div>spawned ${band} · ${d.starts.inside ? `<b>${d.starts.inside} inside the walls</b>` : 'none inside'} · heart ${d.heartHeld ? `held (${Math.round(d.heartHits)} damage off)` : 'not held'}</div>`;
  }

  return {
    step,
    phase: () => ramp.phase,
    // the test hook's view: the phase, the target, the tier alive, and the result once done
    state: () => ({ family, tier, phase: ramp.phase, target: ramp.target, maxAlive: ramp.maxAlive, steps: ramp.steps.length, spawned, window: +windowMean(ramp).toFixed(2),
      baselineMean: ramp.base.mean, baselineP95: ramp.base.p95, limitMs: +ramp.limit.toFixed(2), card: !!card?.isConnected, cardText: card?.isConnected ? card.textContent : null, result }),
    dispose: () => { card?.remove(); card = null; },
  };
}
