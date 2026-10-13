// THE PEARL BODIES' MOTION AUDIT (round four, owner 2026-10-13: "the moving animations are too jerky, they should feel slower and more organic";
// spec docs/superpowers/specs/2026-10-13-pearl-enemies-design.md, "Round 4"). The harness's and the offline sim's measure of how a body MOVES as drawn,
// not as planned: up to `perTier` live bodies a tier are watched, and every frame each one's visible centre (the mean of its membrane's body points, the
// stalks left out: ./cutis-maku/deform.js, the shader's deform in JS, over every fourth direction of the lowest hull) gives its speed, acceleration and
// jerk in body radii (per second, per second squared, cubed), and each body point's own move gives the shape's. A POP is a frame in which the centre
// moves more than `pop` radii, or a body point more than `shapePop` radii, at 60 frames a second (a longer frame is scaled down to that); a rate step
// a frame in which the hop's phase rate changes by more than a fifth within one stage (a pace jump mid-hop). The hop cycle's timing is booked at each
// new hop: its seconds, its transfer's, and the share of it the body is moving. A hand-over to another hub re-projects the plane, so the body's history
// is dropped there, not counted. Off unless the harness or the sim turns it on: nothing is sampled, nothing allocated, in play.
//   createMotionAudit({ perTier, pop, shapePop }) -> { sample(pools, dt), forget(slotKey), report() }
import { deformInto, footprintDirs } from './cutis-maku/deform.js';
import { capAngles } from './cutis-maku/config.js';

const SUB = new Map(), dirsOf = (config) => { const all = footprintDirs(capAngles(config)); let d = SUB.get(all); if (!d) { d = all.filter((_, k) => k % 4 === 0); SUB.set(all, d); } return d; };
const STAGES = [0.1, 0.55, 0.62, 0.85, 1], NAMES = ['coil', 'extend', 'anchor', 'transfer', 'settle'];
const stageOf = (phase) => { let s = 0; while (s < 4 && phase >= STAGES[s]) s++; return s; };
const pct = (a, q) => { if (!a.length) return 0; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]; };
const r2 = (v) => +v.toFixed(2);

export function createMotionAudit({ perTier = 6, pop = 0.25, shapePop = 0.5 } = {}) {
  const tiers = new Map(), P = [0, 0, 0, 0, 1];
  function tierOf(id) {
    let t = tiers.get(id);
    if (!t) { t = { watched: [], speed: [], accel: [], jerk: [], point: [], pops: 0, shapePops: 0, rateSteps: 0, at: {}, replaced: 0, frames: 0, cycles: [], transfers: [], seen: 0, scan: 0 }; tiers.set(id, t); }
    return t;
  }
  // a body's visible centre and its body points (x, z pairs) into `w`
  function look(sw, i, w) {
    const DIRS = dirsOf(sw.config);
    let cx = 0, cz = 0, n = 0;
    for (let d = 0; d < DIRS.length; d++) {
      deformInto(sw, i, DIRS[d], P);
      // a point's weight in the centre is its share of the body as drawn (continuous: a point does not pop into or out of the body's centre)
      const wt = Math.max(0, Math.min(1, P[4])), body = wt > 0.75;
      w.pts[d * 3] = P[0]; w.pts[d * 3 + 1] = P[2]; w.pts[d * 3 + 2] = body ? 1 : 0;
      cx += P[0] * wt; cz += P[2] * wt; n += wt;
    }
    if (n > 1e-6) { w.cx = cx / n; w.cz = cz / n; }
    return n > 1e-6;
  }
  function sample(pools, dt) {
    if (!(dt > 0)) return;
    for (const p of pools.values()) {
      const sw = p.swarm, t = tierOf(p.id), r0 = sw.config.r0;
      // drop the watched bodies that died, were freed or were knocked; fill up from the live ones (a rotating scan)
      t.watched = t.watched.filter((w) => sw.active[w.i] && p.owner[w.i] === w.h && !w.h.dead && !p.dying.has(w.i));
      for (let k = 0; k < sw.count && t.watched.length < perTier; k++) {
        const i = (t.scan + k) % Math.max(1, sw.count), h = p.owner[i];
        if (!sw.active[i] || !h || h.dead || p.dying.has(i) || t.watched.some((w) => w.i === i)) continue;
        t.watched.push({ i, h, pts: new Float64Array(dirsOf(sw.config).length * 3), prev: new Float64Array(dirsOf(sw.config).length * 3), has: 0, cx: 0, cz: 0, vx: 0, vz: 0, ax: 0, az: 0, phase: sw.phase[i], rate: 0, start: null, clock: 0, transfer: 0, hub: sw.hub[i], placed: sw.placed[i] });
        t.seen++; t.scan = i + 1;
      }
      for (const w of t.watched) {
        const i = w.i, r = r0 * sw.scale[i], phase = sw.phase[i], DIRS = dirsOf(sw.config);
        // a hand-over re-projects the plane; a re-placement (the leash's last resort, off screen) is booked apart, not as a pop
        if (w.placed !== sw.placed[i]) { t.replaced++; w.placed = sw.placed[i]; w.has = 0; w.start = null; continue; }
        if (p.jolts.has(i) || w.hub !== sw.hub[i]) { w.has = 0; w.hub = sw.hub[i]; w.start = null; continue; }
        const px = w.cx, pz = w.cz;
        w.prev.set(w.pts);
        if (!look(sw, i, w)) continue;
        // the hop's timing: a new hop when the phase wraps
        if (phase < w.phase - 0.5) { if (w.start != null) { t.cycles.push(w.clock - w.start); t.transfers.push(w.transfer); } w.start = w.clock; w.transfer = 0; }
        w.clock += dt;
        if (phase >= 0.62 && phase < 0.85) w.transfer += dt;
        const rate = (phase - w.phase) / dt, same = phase >= w.phase && stageOf(phase) === stageOf(w.phase);
        if (same && w.rate > 1e-6 && rate > 1e-6 && Math.abs(rate - w.rate) > 0.2 * w.rate) t.rateSteps++;
        w.rate = same ? rate : 0; w.phase = phase;
        if (w.has >= 1) {
          const vx = (w.cx - px) / dt / r, vz = (w.cz - pz) / dt / r, step = Math.hypot(w.cx - px, w.cz - pz) / r * Math.min(1, 1 / (60 * dt));
          let worst = 0, wd = -1;
          for (let d = 0; d < DIRS.length; d++) if (w.pts[d * 3 + 2] && w.prev[d * 3 + 2]) { const m = Math.hypot(w.pts[d * 3] - w.prev[d * 3], w.pts[d * 3 + 1] - w.prev[d * 3 + 1]) / r; if (m > worst) { worst = m; wd = d; } }
          worst *= Math.min(1, 1 / (60 * dt));
          t.frames++; t.speed.push(Math.hypot(vx, vz)); t.point.push(worst);
          if (step > pop) t.pops++;
          if (worst > shapePop) t.shapePops++;
          if (step > pop || worst > shapePop) { const at = NAMES[stageOf(phase)]; t.at[at] = (t.at[at] ?? 0) + 1; if ((t.ex ??= []).length < 6) t.ex.push({ at, phase: r2(phase), step: r2(step), worst: r2(worst), dir: DIRS[wd]?.map(r2), probes: sw.probeCount[i], chosen: sw.chosenProbe[i], hd: [r2(sw.heading[i * 3]), r2(sw.heading[i * 3 + 2])], pa: [r2(sw.probe0[i * 3]), r2(sw.probe1[i * 3])] }); }
          if (w.has >= 2) {
            const ax = (vx - w.vx) / dt, az = (vz - w.vz) / dt, am = Math.hypot(ax, az), st = NAMES[stageOf(phase)];
            t.accel.push(am); (t.accelAt ??= {})[st] = Math.max(t.accelAt[st] ?? 0, r2(am));
            if (w.has >= 3) t.jerk.push(Math.hypot(ax - w.ax, az - w.az) / dt);
            w.ax = ax; w.az = az;
          }
          w.vx = vx; w.vz = vz;
        }
        w.has++;
      }
    }
  }
  // per tier: bodies watched, frames, the centre's speed (p50, p95, max), acceleration and jerk (p95, max) in radii, the body points' largest frame move
  // (p95, max, radii at 60 fps), pops, shape pops, rate steps, and the hop's seconds, its transfer's and the moving share (means)
  function report() {
    const out = {};
    for (const [id, t] of tiers) {
      const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0), cyc = mean(t.cycles), tr = mean(t.transfers);
      out[id] = { bodies: t.seen, frames: t.frames, speed: [r2(pct(t.speed, 0.5)), r2(pct(t.speed, 0.95)), r2(pct(t.speed, 1))], accel: [r2(pct(t.accel, 0.95)), r2(pct(t.accel, 1))],
        jerk: [r2(pct(t.jerk, 0.95)), r2(pct(t.jerk, 1))], point: [r2(pct(t.point, 0.95)), r2(pct(t.point, 1))], pops: t.pops, shapePops: t.shapePops, popsAt: t.at, ex: t.ex, accelAt: t.accelAt, replaced: t.replaced, rateSteps: t.rateSteps,
        hops: t.cycles.length, cycle: r2(cyc), transfer: r2(tr), moving: cyc > 0 ? r2(tr / cyc) : 0 };
    }
    return out;
  }
  return { sample, report };
}
