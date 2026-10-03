// THE ARC-01 PUTS SOL-88 UP (owner, 2026-10-01: "perhaps the story is that this one is automated... and replaces the old one, we
// launch it with the orbital launcher"). The launcher's authored choreography is engine-driven upstream (SentryTowers_A6
// assets/orbital-launcher/runtime.js: +Y up, +Z the launch direction, 30 s): the sled slides back, charges, accelerates up the rail's
// arc and releases, the payload climbs on along the rail's tangent and unfolds, the sled comes home. This is that choreography ported
// onto the pinned lod1 models, the SEED-01 collector standing in for SOL-88 on the sled (it is a 2 m bus; the platform is 40 m and
// built in orbit, which is the fiction). The beat drives the named nodes of the standing launcher structure and a clone of the
// satellite parented under it, so the launcher's own heading and offset carry the launch. The host ticks it on the game clock and is
// told once when it is complete (SOL-88 online: src/fx/laser-arsenal.js setAuto).
import * as THREE from '../../vendor/three.module.js';
import { loadModelFixture, cloneFixture } from './model-fixture.js';

export const LAUNCH = Object.freeze({ duration: 30, radius: 40, sweep: 1.05, start: 8, seconds: 0.4, climb: 6, satellite: 'assets/models/astro/arc01_satellite_d0_lod1.glb' });
const RELEASE = LAUNCH.start + LAUNCH.seconds;
const clamp = (v) => Math.min(1, Math.max(0, v));
const ease = (t, a, b) => { const u = clamp((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const railPose = (u) => { const a = LAUNCH.sweep * u; return { position: [0, 2.6 + LAUNCH.radius * (1 - Math.cos(a)), -20 + LAUNCH.radius * Math.sin(a)], pitch: -a }; };
const extensionPose = (d) => { const p = railPose(1); p.position[1] += Math.sin(LAUNCH.sweep) * d; p.position[2] += Math.cos(LAUNCH.sweep) * d; return p; };

// the sled, the payload, the charge, the clamps, the petals and the burn at `seconds` into the launch (upstream launchState)
export function launchState(seconds) {
  const t = Math.min(LAUNCH.duration, Math.max(0, seconds));
  let sled;
  if (t < LAUNCH.start) { sled = railPose(0); sled.position[2] -= 4 * (1 - ease(t, 0, LAUNCH.start)); }
  else if (t < RELEASE) sled = railPose(((t - LAUNCH.start) / LAUNCH.seconds) ** 2);
  else if (t < 16) sled = extensionPose(3.2 * (1 - (1 - clamp((t - RELEASE) / (6.4 / 210))) ** 2));
  else if (t < 18) sled = extensionPose(3.2 * (1 - ease(t, 16, 18)));
  else if (t < 26) sled = railPose(1 - ease(t, 18, 26));
  else { sled = railPose(0); sled.position[2] -= 4 * ease(t, 26, 29); }
  // ...AND KEEPS CLIMBING (owner, 2026-10-03: "it should go higher in space, currently it looks like it stops too low"): past the
  // rail's kick the payload accelerates on along the tangent at LAUNCH.climb m/s² until it is gone, hundreds of metres up
  const away = Math.max(0, t - RELEASE - 1 / 3);
  const payload = t < RELEASE ? { position: [...sled.position], pitch: sled.pitch } : extensionPose(35 * (1 - (1 - clamp((t - RELEASE) / (1 / 3))) ** 2) + 0.5 * LAUNCH.climb * away * away);
  const phase = t < 4 ? 'loading' : t < LAUNCH.start ? 'charging' : t < RELEASE ? 'accelerating' : t < 17 ? 'released' : t < 21 ? 'unfolding' : t < 26 ? 'insertion' : 'reset';
  return { t, sled, payload, phase, charge: t < LAUNCH.start ? ease(t, 4, LAUNCH.start) : t < RELEASE ? 1 : 1 - ease(t, RELEASE, RELEASE + 2), clamp: 1 - ease(t, RELEASE - 0.04, RELEASE), deploy: ease(t, 17, 21), burn: t >= 21 && t < 26, done: t >= LAUNCH.duration };
}

// launcher: the standing structure's root (src/fx/story-base.js structure(id).root); now(): the game clock in seconds; onComplete: once
// sfx: the game's sound (loop(key, opts) -> { set(gain, rate), stop(fade) }): the landing's rocket thrust bed rides the charge, the
// acceleration and the climb, and cuts as the payload is away
// onPhase(phase): once per phase change (loading, charging, accelerating, released, unfolding, insertion, reset), for the narration
export function createArcLaunch({ launcher, now, onComplete = null, satellite = LAUNCH.satellite, sfx = null, onPhase = null }) {
  const node = (n) => launcher?.getObjectByName(n) ?? null;
  const sled = node('LAUNCH_SLED'), clamps = [[node('CLAMP_L'), -1], [node('CLAMP_R'), 1]], gates = node('PASSAGE_GATES'), lights = node('ACCELERATOR_LIGHTS');
  let t0 = null, sat = null, petals = [], plume = null, done = false, last = null, thrust = null, lastPhase = null;
  const up = new THREE.Vector3(0, 0.43, 0);
  if (launcher) loadModelFixture(satellite).then((scene) => { if (done) return; sat = cloneFixture(scene); sat.name = 'sol88-payload'; launcher.add(sat); petals = [1, 2, 3, 4, 5, 6].map((i) => sat.getObjectByName(`PETAL_${i}_HINGE`)).filter(Boolean); plume = sat.getObjectByName('INSERTION_PLUME'); apply(last ?? launchState(0)); }, () => {});
  function apply(s) {
    last = s;
    if (sled) { sled.position.fromArray(s.sled.position); sled.rotation.x = s.sled.pitch; }
    for (const [c, side] of clamps) if (c) c.position.x = side * (1.47 - 0.15 * s.clamp);
    for (const m of [gates, lights]) if (m?.material?.emissive) { m.material.emissive.set(0x00eaff); m.material.emissiveIntensity = 0.25 + s.charge * 2; }
    if (sat) {
      sat.position.fromArray(s.payload.position); sat.rotation.x = s.payload.pitch; sat.position.add(up.clone().applyEuler(sat.rotation));
      for (const h of petals) h.rotation.x = (1 - s.deploy) * Math.PI / 2;
      if (plume) plume.scale.setScalar(s.burn ? 1 : 0);
      sat.visible = s.t < 26;   // past insertion the bus is a point in the sky: gone
    }
  }
  return {
    tick() {
      if (done) return;
      t0 ??= now();
      const s = launchState(now() - t0);
      apply(s);
      if (s.phase !== lastPhase) { lastPhase = s.phase; onPhase?.(s.phase); }
      const loud = s.t < RELEASE ? s.charge * 0.5 : s.t < 12 ? 1 - (s.t - RELEASE) / (12 - RELEASE) : 0;   // the charge hums, the release roars, the climb fades
      if (loud > 0) { thrust ??= sfx?.loop?.('rocket_thrust', { dist: 0, gain: 0 }) ?? null; thrust?.set?.(loud, 0.9 + 0.2 * loud); } else if (thrust) { thrust.stop?.(0.4); thrust = null; }
      if (s.done) { done = true; if (sat) { launcher.remove(sat); sat = null; } thrust?.stop?.(0.3); thrust = null; onComplete?.(); }
    },
    // where a camera should look: the payload while it flies, else the sled (world space)
    // computed from the choreography in the launcher's own frame, not read off a node whose world matrix may not be updated yet
    focus: (out = new THREE.Vector3()) => { if (!launcher) return out; launcher.updateWorldMatrix(true, false); const s = last ?? launchState(0); return launcher.localToWorld(out.fromArray(s.t < RELEASE ? s.sled.position : s.payload.position)); },
    state: () => ({ t: last ? +last.t.toFixed(1) : 0, phase: last?.phase ?? 'loading', done, satellite: !!sat, sled: !!sled }),
    dispose() { done = true; if (sat) launcher?.remove(sat); sat = null; thrust?.stop?.(0.2); thrust = null; },
  };
}
