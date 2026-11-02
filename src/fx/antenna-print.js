// THE ANTENNA, PRINTED ON SCREEN (owner, 2026-11-02, round 4 note 4: the Ridgeback drop came too early after the K9's print: "a skippable antenna
// build close-up, Isao says reinforcements come in 8 days, the drop 8 days later"). The radar step (src/content/base-programme.js, `closeup`) holds
// its line at the start of its trip (src/fx/programme-host.js); once Isao is over the plot and the print is under way (story.print.state(), the
// base print's step and progress, src/fx/base-print.js), this asks for the line (build_radar: "... Eight days out.") and cuts to the rising
// structure through ANTENNA_CLOSEUP's four angles on the shared rail (src/fx/print-closeup.js: 5 s mandatory, then Space skips, the hint, the
// lowered near plane). The cut only frames it: the print itself is the step's own (the world runs under the cut, td-tab's live shots). No cut over
// a manned seat or another shot, or with less than `latest` of the print left: the line alone then.
//   host: camera, metres(), startShot, endShot, snapCamera, want(id) (Isao's line, waiting for his panel), print() (story.print or null),
//         shotActive(), seated()
//   createAntennaPrint(host) -> { tick(dt), force() (the harness: the cut now over the standing radar, its print replayed from the floor by this
//         module through story.print.progress, the line asked; false without a plot or with a shot up), state(), restore() }
import * as THREE from '../../vendor/three.module.js';
import { BASE_PROGRAMME, ANTENNA_CLOSEUP } from '../content/base-programme.js';
import { createPrintCloseup } from './print-closeup.js';

const A = ANTENNA_CLOSEUP, STEP = BASE_PROGRAMME.find((s) => s.id === A.step);

export function createAntennaPrint(h) {
  const cu = createPrintCloseup({ camera: h.camera, startShot: h.startShot, endShot: h.endShot, snapCamera: h.snapCamera }, A.shot);
  let run = null, done = false, said = false, why = 'idle', cuts = 0, skips = 0, last = null;
  // the plot's frame: its centre on the floor, up the planet's normal, z along the plot's heading, x = up x z (src/fx/base-print.js bed)
  function frame() {
    const bed = h.print()?.bed?.(STEP); if (!bed) return null;
    const origin = new THREE.Vector3(...bed(0, 0, 0)), up = origin.clone().normalize(), z = new THREE.Vector3(...bed(0, 1, 0)).sub(origin);
    z.addScaledVector(up, -z.dot(up)); if (z.lengthSq() < 1e-14) return null;
    z.normalize();
    return { origin, up, z, x: new THREE.Vector3().crossVectors(up, z).normalize(), m: h.metres() };
  }
  function begin(k) {
    const f = frame(); if (!f) { why = 'no plot'; done = true; return; }
    const r = { ...f, t: 0, k0: k, dur: (1 - k) * STEP.seconds + A.tail, skipped: false, replay: false };
    run = r; cuts++; why = 'cut';
    cu.begin({ origin: r.origin, x: r.x, up: r.up, z: r.z, m: r.m, angles: A.angles, size: 1, dur: r.dur, clock: () => r.t,
      onEnd: () => { if (r.replay) h.print()?.finish?.(STEP); r.skipped = r.t < r.dur - 0.05; if (r.skipped) skips++; last = { t: +r.t.toFixed(2), k0: r.k0, skipped: r.skipped, angle: cu.angle() }; run = null; why = 'done'; } });
  }
  return {
    tick(dt) {
      if (run) { run.t += dt; if (run.replay) h.print()?.progress?.(STEP, Math.min(1, run.t / STEP.seconds)); cu.tick(dt); return; }
      if (done || !STEP) return;
      const st = h.print()?.state?.();
      if (!st || st.step !== STEP.id) return;
      if (st.k >= 1) { done = true; why = 'stood'; return; }   // printed already (a grown base, or a print it never saw start)
      if (!said) { said = true; h.want(STEP.brief); }
      if (st.k > A.latest) { done = true; why = 'late'; return; }
      if (h.shotActive() || h.seated()) { why = h.seated() ? 'seat' : 'shot'; return; }
      done = true; begin(st.k);
    },
    force() {
      if (run || h.shotActive() || !h.print()) return false;
      said = true; h.want(STEP.brief); done = true; begin(0); if (!run) return false;
      run.replay = true; h.print().progress?.(STEP, 0); return true;
    },
    state: () => ({ why, cuts, skips, said, last, cut: run ? { t: +run.t.toFixed(2), dur: +run.dur.toFixed(2), angle: cu.angle(), eyeM: +(h.camera.position.distanceTo(run.origin) / run.m).toFixed(1) } : null, lens: cu.lens(), hint: cu.hint() }),
    restore() { if (run) cu.end(); cu.restore(); run = null; },
  };
}
