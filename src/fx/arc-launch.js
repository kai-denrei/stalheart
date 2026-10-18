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
import { LAUNCHER_LIGHTS } from '../content/orbital-works.js';
import { lightLevels, arcIndex } from '../domain/light-sequence.js';

export const LAUNCH = Object.freeze({ duration: 30, radius: 40, sweep: 1.05, start: 8, seconds: 0.4, climb: 6, satellite: 'assets/models/astro/arc01_satellite_d0_lod1.glb' });
const RELEASE = LAUNCH.start + LAUNCH.seconds;
const CHARGE_AT = 4;   // launchState's 'charging' phase begins here: the magnets' sequence is its beat
const RAIL_CENTRE = [2.6 + LAUNCH.radius, -20];   // the centre [y, z] of railPose's arc, in the launcher's frame
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

// THE MAGNETS ONE BY ONE (owner, 2026-10-19, third round, note 5: "small change, stage 7 the launcher; the magnets should light up in cyan one
// by one, not all at a time"). The magnets are the ARC-01's sixteen passage gates and the status lights on them, and the pinned lod1 merges
// each set into one mesh with one material (PASSAGE_GATES, ACCELERATOR_LIGHTS: no node per gate), so one emissive lit them all at once. For
// the charge each mesh wears a copy of its geometry with its triangles sorted into one group per gate (by the gate's place on the rail's arc,
// src/domain/light-sequence.js arcIndex) and one clone of its material per group. The clones share the original's shader program, so nothing
// compiles; the extra draws (sixteen a mesh) last only until the magnets are equal again after the release, and the merged mesh comes back.
function perMagnet(mesh, count) {
  if (!mesh?.isMesh || Array.isArray(mesh.material) || !mesh.material?.emissive) return null;
  const was = { geometry: mesh.geometry, material: mesh.material };
  const g = was.geometry.clone(), pos = g.attributes.position, src = g.index?.array ?? null, n = src ? src.length : pos.count;
  const vertex = (k) => (src ? src[k] : k), byGate = Array.from({ length: count }, () => []);
  for (let t = 0; t + 2 < n; t += 3) {
    let y = 0, z = 0;
    for (let k = 0; k < 3; k++) { y += pos.getY(vertex(t + k)); z += pos.getZ(vertex(t + k)); }
    byGate[arcIndex(y / 3, z / 3, RAIL_CENTRE, LAUNCH.sweep, count)].push(t);
  }
  const index = [];
  g.clearGroups();
  byGate.forEach((tris, i) => { g.addGroup(index.length, tris.length * 3, i); for (const t of tris) index.push(vertex(t), vertex(t + 1), vertex(t + 2)); });
  g.setIndex(index);
  const mats = byGate.map(() => was.material.clone());
  mesh.geometry = g; mesh.material = mats;
  return {
    mats, worn: () => mesh.material === mats,   // something else may have swapped the material since: then the merged path lights it as before
    restore() { if (mesh.material === mats) { mesh.geometry = was.geometry; mesh.material = was.material; } g.dispose(); for (const m of mats) m.dispose(); },
  };
}

// launcher: the standing structure's root (src/fx/story-base.js structure(id).root); now(): the game clock in seconds; onComplete: once
// sfx: the game's sound (loop(key, opts) -> { set(gain, rate), stop(fade) }): the landing's rocket thrust bed rides the charge, the
// acceleration and the climb, and cuts as the payload is away
// onPhase(phase): once per phase change (loading, charging, accelerating, released, unfolding, insertion, reset), for the narration
export function createArcLaunch({ launcher, now, onComplete = null, satellite = LAUNCH.satellite, sfx = null, onPhase = null }) {
  const node = (n) => launcher?.getObjectByName(n) ?? null;
  const sled = node('LAUNCH_SLED'), clamps = [[node('CLAMP_L'), -1], [node('CLAMP_R'), 1]], gates = node('PASSAGE_GATES'), lights = node('ACCELERATOR_LIGHTS');
  let magnets = [gates, lights].map((m) => [m, perMagnet(m, LAUNCHER_LIGHTS.magnets)]);
  const levels = new Array(LAUNCHER_LIGHTS.magnets).fill(0);
  const merge = () => { for (const [, split] of magnets) split?.restore(); magnets = magnets.map(([m]) => [m, null]); };
  let t0 = null, sat = null, petals = [], plume = null, done = false, last = null, thrust = null, lastPhase = null;
  const up = new THREE.Vector3(0, 0.43, 0);
  // NAVIGATION LIGHTS (owner, 2026-10-16: 'the second SOL satellite launch should have glowing lights against the dark sky'): red to port, green to
  // starboard, a white strobe on top, additive sprites on the bus's box; they ride the climb until the payload is gone
  let navLights = [];
  function dressLights(bus) {
    const box = new THREE.Box3().setFromObject(bus), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3()); bus.worldToLocal(c);
    const sprite = (hex, scale) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ color: hex, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(scale); m.name = 'nav light'; bus.add(m); return m; };
    const r = Math.max(size.x, size.z) * 0.5 || 1, h = size.y * 0.5 || 0.5;
    navLights = [{ m: sprite(0xff3b2f, 0.7), at: [c.x - r, c.y, c.z], kind: 'nav' }, { m: sprite(0x3bff6a, 0.7), at: [c.x + r, c.y, c.z], kind: 'nav' }, { m: sprite(0xffffff, 1.1), at: [c.x, c.y + h + 0.3, c.z], kind: 'strobe' }];
    for (const l of navLights) l.m.position.fromArray(l.at);
  }
  if (launcher) loadModelFixture(satellite).then((scene) => { if (done) return; sat = cloneFixture(scene); sat.name = 'sol88-payload'; launcher.add(sat); petals = [1, 2, 3, 4, 5, 6].map((i) => sat.getObjectByName(`PETAL_${i}_HINGE`)).filter(Boolean); plume = sat.getObjectByName('INSERTION_PLUME'); dressLights(sat); apply(last ?? launchState(0)); }, () => {});
  function apply(s) {
    last = s;
    if (sled) { sled.position.fromArray(s.sled.position); sled.rotation.x = s.sled.pitch; }
    for (const [c, side] of clamps) if (c) c.position.x = side * (1.47 - 0.15 * s.clamp);
    // through the charge each magnet rises on its own beat, from the breech up the rail (LAUNCHER_LIGHTS); after the release they fall with
    // the charge together, and once it is spent they are one mesh again
    if (s.t >= RELEASE + 2) merge();
    const lit = s.t < RELEASE ? lightLevels(s.t - CHARGE_AT, LAUNCHER_LIGHTS.magnets, LAUNCHER_LIGHTS.step, LAUNCHER_LIGHTS.ramp, levels) : null;
    for (const [m, split] of magnets) {
      if (split?.worn()) split.mats.forEach((mat, i) => { mat.emissive.set(0x00eaff); mat.emissiveIntensity = 0.25 + 2 * (lit ? lit[i] : s.charge); });
      else if (m?.material?.emissive) { m.material.emissive.set(0x00eaff); m.material.emissiveIntensity = 0.25 + s.charge * 2; }
    }
    if (sat) {
      sat.position.fromArray(s.payload.position); sat.rotation.x = s.payload.pitch; sat.position.add(up.clone().applyEuler(sat.rotation));
      for (const h of petals) h.rotation.x = (1 - s.deploy) * Math.PI / 2;
      if (plume) plume.scale.setScalar(s.burn ? 1 : 0);
      sat.visible = s.t < 26;   // past insertion the bus is a point in the sky: gone
      for (const l of navLights) { const strobe = l.kind === 'strobe'; l.m.material.opacity = strobe ? ((s.t * 1.6) % 1 < 0.12 ? 1 : 0.08) : 0.55 + 0.35 * Math.sin(s.t * 5 + (l.at[0] > 0 ? 1.7 : 0)); l.m.scale.setScalar((strobe ? 1.1 : 0.7) * (1 + Math.max(0, s.t - RELEASE) * 0.08)); }   // the strobe flashes, the nav lights breathe; they grow a little with the climb so they still read as the bus recedes
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
      if (s.done) { done = true; merge(); if (sat) { launcher.remove(sat); sat = null; } thrust?.stop?.(0.3); thrust = null; onComplete?.(); }
    },
    // where a camera should look: the payload while it flies, else the sled (world space)
    // computed from the choreography in the launcher's own frame, not read off a node whose world matrix may not be updated yet
    focus: (out = new THREE.Vector3()) => { if (!launcher) return out; launcher.updateWorldMatrix(true, false); const s = last ?? launchState(0); return launcher.localToWorld(out.fromArray(s.t < RELEASE ? s.sled.position : s.payload.position)); },
    state: () => ({ t: last ? +last.t.toFixed(1) : 0, phase: last?.phase ?? 'loading', done, satellite: !!sat, sled: !!sled }),
    dispose() { done = true; merge(); if (sat) launcher?.remove(sat); sat = null; thrust?.stop?.(0.2); thrust = null; },
  };
}
