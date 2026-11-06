// THE LANDING'S HOST (spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md section 4): while the arrival's OVERRIDE, MANUAL and
// FLARE phases run, the rocket's pose comes from the flight model (src/domain/manual-landing.js) in the island's metres, the plumes burn with
// the throttle, the chase camera rides behind, the reticle lies on the ground under the predicted impact point, the HUD reads the state,
// and the keys fly. The arrival keeps the clock, the sequence, the swap and the HUD panel (it shows the verdict through the cut, so it
// outlives this host: dispose() leaves it to the arrival).
// Frames (2026-11-07): `toWorld` maps island metres with the pad's top at y = 0 to world units; `root` is a group whose local frame is
// those same metres (the arrival's fxRoot, lifted to the pad's top), so the reticle is placed in it directly.
import * as THREE from '../../vendor/three.module.js';
import { LANDING_GAME } from '../content/landing-game.js';
import { SH02_WELL } from '../content/story-defaults.js';
import { createLanding, step, hStop, predictImpact, verdict, flareDue, flareStep, touched } from '../domain/manual-landing.js';

const FLAT = () => ({ y: 0, normal: [0, 1, 0] });

export function createManualLanding({ game = LANDING_GAME, entry, rocket, plumes, camera, sfx, hud, toWorld, up, floorAt = FLAT, root, clipScrub, coarse = false }) {
  const m4 = new THREE.Matrix4(), tiltM = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), n = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3();
  const origin = toWorld([0, 0, 0], new THREE.Vector3()), follow = new THREE.Vector3(), aim = new THREE.Vector3(), aimTo = new THREE.Vector3();
  const legClip = rocket.root?.userData.actions?.Legs_Deploy?.getClip().duration ?? game.vehicle.legTime * 4;   // the clip is 2.4 s, scrubbed by the legs' fraction
  let pred = null, s = null, phase = 'idle', acc = 0, input = { throttle: null, legs: false }, held = { back: false, fwd: false }, rate = 0, thrust = null, pingAt = 0, contact = null, legsHeard = false;
  // the reticle: three fixed rings and the altitude ring, a line loop each, and the hard square, laid on the ground under the predicted point
  const ring = (color) => { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: game.reticle.segments + 1 }, (_, i) => { const t = i / game.reticle.segments * Math.PI * 2; return new THREE.Vector3(Math.cos(t), 0, Math.sin(t)); })); return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false })); };
  const reticle = new THREE.Group(); reticle.name = 'LandingReticle'; reticle.renderOrder = 999;
  const altRing = ring(0x7dff5a), fixed = game.reticle.rings.map(() => ring(0x4fae63)), square = ring(0xffffff); square.geometry.setFromPoints([[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 0, -1]].map((p) => new THREE.Vector3(...p)));
  reticle.add(altRing, ...fixed, square); root.add(reticle); reticle.visible = false;
  const keys = (ev, down) => {   // the flight keys; the shot passes keys and keeps Escape as the skip (camera-shot passKeys/skipKey)
    if (phase !== 'manual' && phase !== 'override') return;
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === 'w' || k === 'ArrowUp') { if (down) input.throttle = Math.min(1, (input.throttle ?? s?.set ?? 0) + (ev.shiftKey ? 1 : game.input.step)); }
    else if (k === 's' || k === 'ArrowDown') { if (down) input.throttle = Math.max(0, (input.throttle ?? s?.set ?? 0) - (ev.shiftKey ? 1 : game.input.step)); }
    else if (k === 'a' || k === 'ArrowLeft') held.back = down;
    else if (k === 'd' || k === 'ArrowRight') held.fwd = down;
    else if (k === 'l') { if (down) input.legs = true; }
    else if (k === game.input.offerKey) { /* Space does nothing in flight (spec 5): a reflex from the 2D game cannot cut the burn */ }
    else return;
    ev.preventDefault(); ev.stopImmediatePropagation();
  };
  const onDown = (ev) => keys(ev, true), onUp = (ev) => keys(ev, false);
  let listening = false;
  const listen = (on) => { if (on === listening || typeof addEventListener !== 'function') return; listening = on; const f = on ? addEventListener : removeEventListener; f('keydown', onDown, true); f('keyup', onUp, true); };
  // once a frame, for the reticle and the ping: the predictor at the held throttle; under the auto-lander's flare the drift is being
  // eased out, so the point is under the rocket (the predictor's held set point would hover past its horizon)
  const predict = () => (phase === 'flare' ? { x: s.x, z: s.z, t: s.y / Math.max(0.1, -s.vy), reached: true } : predictImpact(s, game));
  function poseRocket() {
    // the flight's offset is a translation in world units along the island's basis, before the placement (whose own frame is scaled by
    // the model's scale: a translation after it would be 1.5x long); the tilt about the hull's own x, positive toward +z, at its feet
    const h = rocket.holder;
    toWorld([s.x, s.y, s.z], a).sub(origin);
    h.matrix.copy(h.userData.placed).premultiply(m4.makeTranslation(a.x, a.y, a.z)).multiply(tiltM.makeRotationX(s.tilt)); h.matrixWorldNeedsUpdate = true;
    clipScrub('Legs_Deploy', s.legs * legClip);
    if (s.legs > 0 && !legsHeard) { legsHeard = true; sfx?.play('tank_spool_up', { dist: 0 }); }   // the pneumatics as the legs start down, as the arrival's
  }
  function placeReticle() {
    const p = pred, g = floorAt(p.x, p.z);
    reticle.position.set(p.x, g.y + 0.05, p.z);
    q.setFromUnitVectors(a.set(0, 1, 0), n.fromArray(g.normal).normalize()); reticle.quaternion.copy(q);   // the terrain normal skews it on a slope
    const r = Math.max(2, s.y * game.reticle.metresPerMetre), v = Math.hypot(s.vx, s.vz), stretch = 1 + Math.min(2, v * 0.08);
    altRing.scale.set(r, 1, r * stretch); altRing.rotation.y = Math.atan2(s.vx, s.vz);   // stretched along the ground velocity
    fixed.forEach((f, i) => { const at = game.reticle.rings[i]; f.visible = s.y > at; f.scale.setScalar(Math.max(1, (s.y - at) * game.reticle.metresPerMetre)); });
    square.visible = s.y <= game.reticle.square; square.scale.setScalar(4);
    const onPad = Math.hypot(p.x, p.z) <= game.pad.reach; altRing.material.color.set(onPad ? 0x7dff5a : 0xff6a5a);   // green on the pad, the alarm red off it (spec 4; 2026-11-07: the brief's cyan was the lattice's own and vanished on it)
    reticle.visible = p.reached;   // a throttle that climbs or hovers past the predictor's horizon meets no ground: no ring
  }
  // the chase's look target (2026-11-07, the controller's call C): the reticle's ground point, the predicted impact, so the ground the
  // player aims at is the frame's centre and the rocket above it; a prediction more than `camera.lookReach` m off the pad is blended
  // toward the rocket's own ground point (all of it at twice that), and no prediction is the rocket's ground point, so the camera never
  // swings off to the horizon. Eased at `camera.lag` like the follow point
  function aimTarget() {
    const c = game.camera, p = pred, off = p?.reached ? Math.hypot(p.x, p.z) - game.pad.reach : Infinity, w = Math.max(0, Math.min(1, (off - c.lookReach) / c.lookReach));
    const x = p?.reached ? p.x + (s.x - p.x) * w : s.x, z = p?.reached ? p.z + (s.z - p.z) * w : s.z;
    return aimTo.set(x, floorAt(x, z).y, z);
  }
  // the shot's poseAt: behind along -z, above, and a little to +x (a three-quarter view: the tilt is about x, so from straight behind it
  // would lie along the line of sight), each distance growing with the height so the rocket and the ground under it share the frame
  // (LANDING_GAME.camera); the follow point trails the rocket by `camera.lag`
  function chase(out) {
    const c = game.camera, h = Math.max(0, follow.y), back = c.back + c.backPerMetre * h, rise = c.up + c.upPerMetre * h;
    if (camera && camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    toWorld([follow.x + c.side * back, follow.y + rise, follow.z - back], eye); toWorld([aim.x, aim.y, aim.z], look);
    m4.lookAt(eye, look, up); out.quat.setFromRotationMatrix(m4); out.pos.copy(eye);
  }
  function sounds(dt) {
    if (s.throttle > game.hud.audibleThrottle) { thrust ??= sfx?.loop('rocket_thrust', { dist: 0, gain: 0 }); thrust?.set(0.4 + 0.6 * s.throttle, 0.96 + 0.06 * s.throttle); }
    else if (thrust) { thrust.stop(0.08); thrust = null; }
    const p = pred, gap = p.reached ? game.hud.ping.far + (game.hud.ping.near - game.hud.ping.far) * Math.max(0, Math.min(1, 1 - (s.y - game.hud.ping.nearAt) / 300)) : game.hud.ping.far;
    pingAt += dt; if (pingAt >= gap) { pingAt = 0; sfx?.play('laser_click', { dist: 0, gain: 0.5 }); }
  }
  function plumesAt() {   // each engine on its own cadence, its sheet turned to the chase eye about the hull's axis
    const h = rocket.holder; h.updateMatrixWorld(true); a.copy(camera?.position ?? eye); h.worldToLocal(a);
    const lit = s.throttle > 0 ? Math.max(game.vehicle.minThrottle, s.throttle) : 0;
    for (const p of plumes) {
      const e = p.userData.engine;
      p.userData.setIntensity(lit * (1 - e.depth + e.depth * Math.sin(s.t * e.cadence + e.phase)) * 0.55); p.userData.tick(s.t + e.phase);
      p.rotation.set(0, Math.atan2(a.x - p.position.x, a.z - p.position.z), 0);
    }
  }
  function reading() { return { altitude: Math.max(0, s.y), sink: Math.max(0, -s.vy), driftAlong: s.vz, driftAcross: s.vx, tilt: s.tilt, tw: game.vehicle.thrust * Math.max(s.throttle, s.throttle > 0 ? game.vehicle.minThrottle : 0) / game.sim.gravity, hStop: hStop(s, game), fuel: s.fuel, legs: s.legs, phase }; }
  function stopAll() { listen(false); hud.touch(false); if (thrust) { thrust.stop(0.4); thrust = null; } reticle.visible = false; }
  const host = {
    hud,
    // OVERRIDE: the seeded problem (the entry: src/domain/manual-landing.js seedEntry; 2026-11-07, the sequence's own altitude and rate were
    // not flyable, LANDING_GAME.approach), placed under the glare; clear the panel, arm the keys; MANUAL starts when the arrival calls manual()
    begin(legs = 0) {
      s = createLanding(entry); s.legs = legs; s.legsDown = legs >= 1; legsHeard = legs > 0;
      phase = 'override'; acc = 0; contact = null; follow.set(s.x, s.y, s.z);
      hud.clear(); hud.show(true); hud.annunciate('AUTO-LAND FAULT · MANUAL OVERRIDE', 'alarm'); hud.set(reading()); listen(true);
      if (coarse) hud.touch(true, { throttle: (v) => { input.throttle = v; }, tilt: (d) => { held.back = d < 0; held.fwd = d > 0; }, legs: () => { input.legs = true; }, skip: () => host.skip() });
      pred = predict(); aim.copy(aimTarget()); sfx?.play('danger_alert', { dist: 0 }); poseRocket(); placeReticle();
    },
    manual() { if (phase === 'override') { phase = 'manual'; hud.annunciate('MANUAL', 'info'); } },
    tick(dt) {
      if (!s || phase === 'idle' || phase === 'touched') return phase;
      acc += Math.min(dt, game.sim.dt * game.sim.maxSteps);
      const i = { throttle: input.throttle, tiltRate: (held.fwd ? 1 : 0) - (held.back ? 1 : 0) || rate, legs: input.legs };   // a held key, else the harness's rate
      if (phase === 'override') {   // the alarm beat: the rocket holds where the auto-lander left it, the keys already set the throttle and the legs
        if (i.throttle != null) s.set = Math.max(0, Math.min(1, i.throttle));
        if (i.legs && s.legs === 0) s.legs = 1e-6;
        input.throttle = null; input.legs = false; acc = 0;
      }
      while (phase !== 'override' && acc >= game.sim.dt) {
        acc -= game.sim.dt;
        if (phase === 'manual' && flareDue(s, game)) { phase = 'flare'; hud.annunciate('AUTO-LAND RESUMED', 'ok'); }
        if (phase === 'flare') flareStep(s, game.sim.dt, game); else step(s, i, game.sim.dt, game);
        i.throttle = null; i.legs = false; input.throttle = null; input.legs = false;   // a set point and a legs request are consumed by the step that reads them
        if (touched(s, floorAt(s.x, s.z).y)) { phase = 'touched'; break; }
      }
      follow.lerp(a.set(s.x, s.y, s.z), Math.min(1, dt / game.camera.lag));
      pred = predict(); aim.lerp(aimTarget(), Math.min(1, dt / game.camera.lag));
      poseRocket(); plumesAt(); hud.set(reading());
      if (phase === 'touched') {
        const g = floorAt(s.x, s.z), slope = Math.acos(Math.max(-1, Math.min(1, g.normal[1])));
        contact = verdict(s, slope, Math.hypot(s.x, s.z) > game.pad.reach, game);
        if (contact.grade === 'WRECK') sfx?.play('mech_landing_impact', { dist: 0 });
        hud.verdict(contact); hud.annunciate(`LANDING · ${contact.grade}`, contact.grade === 'WRECK' ? 'alarm' : 'ok'); stopAll();
      } else { placeReticle(); sounds(dt); }
      return phase;
    },
    chase,
    input(i) { if (i.throttle != null) input.throttle = i.throttle; rate = Math.max(-1, Math.min(1, i.tiltRate ?? 0)); if (i.legs) input.legs = true; },   // the harness: the tilt rate held until the next call
    // Esc or SKIP (spec 8): graded CLEAN, the auto-lander never crashes; the arrival resumes its sequence at the touchdown
    skip() { if (!s || phase === 'touched') return; phase = 'touched'; contact = { grade: 'CLEAN', reason: 'skipped', sink: 0, drift: 0, tilt: 0 }; hud.verdict(contact); hud.annunciate('AUTO-LAND RESUMED', 'ok'); stopAll(); },
    contact: () => contact, phase: () => phase, pose: () => (s ? { x: s.x, y: s.y, z: s.z, tilt: s.tilt } : null),
    // the harness's frame check: where the rocket's feet, its top (the well's rim at the model's 1.5) and the reticle fall on screen, NDC (in frame within +-1)
    view() {
      if (!s || !camera) return null;
      camera.updateMatrixWorld(); const ndc = (p) => { const v = toWorld(p, new THREE.Vector3()).project(camera); return [+v.x.toFixed(2), +v.y.toFixed(2)]; };
      return { feet: ndc([s.x, s.y, s.z]), top: ndc([s.x, s.y + 1.5 * SH02_WELL.rim, s.z]), reticle: reticle.visible ? ndc([reticle.position.x, reticle.position.y, reticle.position.z]) : null };
    },
    state: () => (s ? { phase, grade: contact?.grade ?? null, reason: contact?.reason ?? null, sink: +Math.max(0, -s.vy).toFixed(2), drift: +Math.hypot(s.vx, s.vz).toFixed(2), vz: +s.vz.toFixed(2), tilt: +s.tilt.toFixed(3), fuel: +s.fuel.toFixed(1), altitude: +s.y.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), throttle: +s.throttle.toFixed(2), legs: +s.legs.toFixed(2), t: +s.t.toFixed(2) } : null),
    dispose() { stopAll(); reticle.removeFromParent(); for (const l of [altRing, ...fixed, square]) { l.geometry.dispose(); l.material.dispose(); } },   // the HUD is the arrival's
  };
  return host;
}
