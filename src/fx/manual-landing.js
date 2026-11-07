// THE LANDING'S HOST (spec docs/superpowers/specs/2026-11-07-landing-mini-game-design.md section 4): while the arrival's OVERRIDE, MANUAL and
// FLARE phases run, the rocket's pose comes from the flight model (src/domain/manual-landing.js) in its flight frame (below), the plumes burn with
// the throttle, the side camera dollies with it (spec 14 A), the reticle lies on the ground under the predicted impact point, the pad's ring marks
// the landing zone (the owner's rule: the player must always see it), the HUD reads the state,
// and the keys fly: SPACE held is the burn (LANDING_GAME.input.burnKey), A/D (and the arrows left/right) tilt left/right while held, L the
// legs; nothing else (spec 14 B: three variables, the burn, the tilt and the legs). The arrival
// keeps the clock, the sequence, the swap and the HUD panel (it shows the verdict through the cut, so it outlives this host: dispose()
// leaves it to the arrival).
// The harness's state() reports the tilt SIGNED (about z, positive toward +x) and the drift on x as `vx`, which the browser suite's scripted
// pilot steers on; the HUD's reading() carries the screen drift `vx` as driftAlong (its DRIFT row: the arrow by its sign, the speed) and the tilt's magnitude.
// Frames (2026-11-07): `toWorld` maps island metres with the pad's top at y = 0 to world units; `root` is a group whose local frame is
// those same metres (the arrival's fxRoot, lifted to the pad's top), so the reticle is placed in it directly.
// THE SIDE VIEW (spec 14 A): the flight model runs in its own frame, the island's turned about the pad's up by `azimuth` (island =
// Ry(azimuth) . flight, three.js's makeRotationY sense: flightToIsland below). The camera sits on the flight's +z side and looks level
// toward -z, so the flight's +x is the screen's right (right = forward x up) and its -z the line of sight, toward the accretion disk (the
// arrival sets azimuth = atan2(-d.x, -d.z) from the disk's island direction d). All model math stays in the flight frame; the boundary
// converts: the rocket's offset, the reticle and the camera go through flightToIsland, floorAt is asked in island metres, and pose(),
// state().x/z and view() report island metres (state().along is the flight x the pilot steers on, state().vx the screen drift).
import * as THREE from '../../vendor/three.module.js';
import { LANDING_GAME } from '../content/landing-game.js';
import { SH02_WELL } from '../content/story-defaults.js';
import { createLanding, step, hStop, predictImpact, verdict, flareDue, flareStep, touched } from '../domain/manual-landing.js';

const FLAT = () => ({ y: 0, normal: [0, 1, 0] });
// the flight frame to the island's and back (arrays of metres): island = Ry(azimuth) . flight, a + azimuth turning +z toward +x
export function flightToIsland([x, y, z], azimuth) { const c = Math.cos(azimuth), s = Math.sin(azimuth); return [c * x + s * z, y, -s * x + c * z]; }
export function islandToFlight([x, y, z], azimuth) { const c = Math.cos(azimuth), s = Math.sin(azimuth); return [c * x - s * z, y, s * x + c * z]; }
// the hull's tilt in the holder's (island) frame: Rz(-tilt) about the FLIGHT z (the matrix that puts the hull's up on the thrust
// direction d = (sin tilt, cos tilt, 0)), turned to the island: Ry(azimuth) . Rz(-tilt) . Ry(-azimuth)
const ry = new THREE.Matrix4(), rz = new THREE.Matrix4();
export function hullTilt(tilt, azimuth, out = new THREE.Matrix4()) { return out.makeRotationY(azimuth).multiply(rz.makeRotationZ(-tilt)).multiply(ry.makeRotationY(-azimuth)); }

export function createManualLanding({ game = LANDING_GAME, entry, rocket, plumes, camera, sfx, hud, toWorld, up, floorAt = FLAT, root, clipScrub, coarse = false, azimuth = 0 }) {
  // the frame's turn, fixed at begin() for the whole flight: `azimuth` a number or a function read then (the arrival's: the disk may be aimed
  // behind the Stålheart after the arrival starts, once that structure loads, src/fx/sky-rig.js)
  let az = 0;
  const m4 = new THREE.Matrix4(), tiltM = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), n = new THREE.Vector3(), eye = new THREE.Vector3(), look = new THREE.Vector3();
  const toWorldF = (p, out) => toWorld(flightToIsland(p, az), out);   // flight metres to world units
  const origin = toWorld([0, 0, 0], new THREE.Vector3()), follow = new THREE.Vector3();
  let pred = null, s = null, phase = 'idle', acc = 0, input = { legs: false }, harnessThrottle = null, held = { left: false, right: false, burn: false }, rate = { tilt: 0 }, touchTilt = 0, thrust = null, pingAt = 0, contact = null, legsHeard = false;
  // the reticle: three fixed rings and the altitude ring, a line loop each, and the hard square, laid on the ground under the predicted point
  const ring = (color) => { const g = new THREE.BufferGeometry().setFromPoints(Array.from({ length: game.reticle.segments + 1 }, (_, i) => { const t = i / game.reticle.segments * Math.PI * 2; return new THREE.Vector3(Math.cos(t), 0, Math.sin(t)); })); return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false })); };
  const reticle = new THREE.Group(); reticle.name = 'LandingReticle'; reticle.renderOrder = 999;
  const altRing = ring(0x7dff5a), fixed = game.reticle.rings.map(() => ring(0x4fae63)), square = ring(0xffffff); square.geometry.setFromPoints([[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1], [-1, 0, -1]].map((p) => new THREE.Vector3(...p)));
  reticle.add(altRing, ...fixed, square); root.add(reticle); reticle.visible = false;
  // THE PAD (2026-11-07, spec 14 C; the owner's rule, the player must always see the landing zone): a ring of pad.reach at the flight frame's
  // origin, through the boundary conversion as the reticle, the reticle's green at half opacity, shown while the flight runs
  const padRing = ring(0x7dff5a); padRing.name = 'LandingPad'; padRing.renderOrder = 999; padRing.material.opacity = 0.5; padRing.scale.set(game.pad.reach, 1, game.pad.reach);
  { const [px, , pz] = flightToIsland([0, 0, 0], 0), g = floorAt(px, pz); padRing.position.set(px, g.y + 0.05, pz); padRing.quaternion.setFromUnitVectors(a.set(0, 1, 0), n.fromArray(g.normal).normalize()); }
  root.add(padRing); padRing.visible = false;
  const keys = (ev, down) => {   // the flight keys, taken here in capture before the shot's listener; the shot eats the rest and keeps Escape as the skip (camera-shot skipKey; passKeys off since 2026-11-07)
    if (phase !== 'manual' && phase !== 'override' && phase !== 'flare') return;   // FLARE eats them too (2026-11-07): the auto-lander has the rocket, no flight key reaches the tank
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (k === game.input.burnKey) held.burn = down;   // spec 13: the burn is held, as the 2D game's (its key repeat only re-sets it)
    else if (k === 'a' || k === 'ArrowLeft') held.left = down;
    else if (k === 'd' || k === 'ArrowRight') held.right = down;
    else if (k === 'l') { if (down) input.legs = true; }
    else return;
    ev.preventDefault(); ev.stopImmediatePropagation();
  };
  const onDown = (ev) => keys(ev, true), onUp = (ev) => keys(ev, false);
  const onBlur = () => { held = { left: false, right: false, burn: false }; touchTilt = 0; };   // a key held as the window loses focus never sees its keyup (Space then Cmd+Tab latched the burn)
  let listening = false;
  const listen = (on) => { if (on === listening || typeof addEventListener !== 'function') return; listening = on; const f = on ? addEventListener : removeEventListener; f('keydown', onDown, true); f('keyup', onUp, true); f('blur', onBlur); };
  // once a frame, for the reticle and the ping: the predictor at the held throttle; under the auto-lander's flare the drift is being
  // eased out, so the point is under the rocket (the predictor's held set point would hover past its horizon)
  const predict = () => (phase === 'flare' ? { x: s.x, z: s.z, t: s.y / Math.max(0.1, -s.vy), reached: true } : predictImpact(s, game));
  function poseRocket() {
    // the flight's offset is a translation in world units along the island's basis, before the placement (whose own frame is scaled by
    // the model's scale: a translation after it would be 1.5x long); then Rz(-tilt) at its feet, the matrix that maps the hull's up onto
    // the model's thrust direction d = (sin tilt, cos tilt, 0) (src/domain/manual-landing.js's header): negative so a + tilt leans toward +x
    // (the side view: the offset turned to the island, the tilt about the flight's z turned with it, hullTilt)
    const h = rocket.holder;
    toWorldF([s.x, s.y, s.z], a).sub(origin);
    h.matrix.copy(h.userData.placed).premultiply(m4.makeTranslation(a.x, a.y, a.z)).multiply(hullTilt(s.tilt, az, tiltM)); h.matrixWorldNeedsUpdate = true;
    clipScrub('Legs_Deploy', s.legs);   // the legs' fraction: the arrival scrubs the clip by it times the clip's own length
    if (s.legs > 0 && !legsHeard) { legsHeard = true; sfx?.play('tank_spool_up', { dist: 0 }); }   // the pneumatics as the legs start down, as the arrival's
  }
  function placeReticle() {
    const p = pred, [ix, , iz] = flightToIsland([p.x, 0, p.z], az), g = floorAt(ix, iz);   // the reticle's group is in island metres
    reticle.position.set(ix, g.y + 0.05, iz);
    q.setFromUnitVectors(a.set(0, 1, 0), n.fromArray(g.normal).normalize()); reticle.quaternion.copy(q);   // the terrain normal skews it on a slope
    const R = game.reticle, r = Math.max(R.minRadius, s.y * R.metresPerMetre), v = Math.hypot(s.vx, s.vz), stretch = 1 + Math.min(R.stretchMax, v * R.stretchPerMps);
    altRing.scale.set(r, 1, r * stretch); altRing.rotation.y = Math.atan2(s.vx, s.vz) + az;   // stretched along the ground velocity (turned to the island)
    fixed.forEach((f, i) => { const at = game.reticle.rings[i]; f.visible = s.y > at; f.scale.setScalar(Math.max(1, (s.y - at) * game.reticle.metresPerMetre)); });
    square.visible = s.y <= R.square; square.scale.setScalar(R.squareSize);
    const onPad = Math.hypot(p.x, p.z) <= game.pad.reach; altRing.material.color.set(onPad ? 0x7dff5a : 0xff6a5a);   // green on the pad, the alarm red off it (spec 4; 2026-11-07: the brief's cyan was the lattice's own and vanished on it)
    reticle.visible = p.reached;   // a throttle that climbs or hovers past the predictor's horizon meets no ground: no ring
  }
  // the shot's poseAt (spec 14 A, the side view; the name kept from the morning's chase): the camera's ANGLE is fixed, level along the
  // flight's -z toward the disk, its right the flight's +x; only its POSITION moves, a dolly: on the flight's +z side `camera.back +
  // camera.backPerMetre x height + camera.backPerMetreAcross x |x|` m from the rocket, `camera.up + camera.upPerMetre x height` m above the
  // pad, and across at the MIDPOINT of the rocket and the pad (the pad is the frame's x = 0), so a drifting flight keeps the landing zone in
  // view (the owner's rule, 2026-11-07: the player must always see it); the follow point trails the rocket by `camera.lag` (LANDING_GAME.camera)
  function chase(out) {
    const c = game.camera, h = Math.max(0, follow.y), back = c.back + c.backPerMetre * h + c.backPerMetreAcross * Math.abs(follow.x), rise = c.up + c.upPerMetre * h, x = follow.x / 2;
    if (camera && camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    toWorldF([x, rise, follow.z + back], eye); toWorldF([x, rise, follow.z + back - 1], look);
    m4.lookAt(eye, look, up); out.quat.setFromRotationMatrix(m4); out.pos.copy(eye);
  }
  function sounds(dt) {
    if (s.throttle > game.hud.audibleThrottle) { thrust ??= sfx?.loop('rocket_thrust', { dist: 0, gain: 0 }); thrust?.set(0.4 + 0.6 * s.throttle, 0.96 + 0.06 * s.throttle); }
    else if (thrust) { thrust.stop(0.08); thrust = null; }
    const p = pred, gap = p.reached ? game.hud.ping.far + (game.hud.ping.near - game.hud.ping.far) * Math.max(0, Math.min(1, 1 - (s.y - game.hud.ping.nearAt) / game.hud.ping.nearOver)) : game.hud.ping.far;
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
  const island = () => flightToIsland([s.x, s.y, s.z], az), ground = () => { const [x, , z] = island(); return floorAt(x, z); };   // the rocket in island metres, the ground under it
  function reading() { return { altitude: Math.max(0, s.y), sink: Math.max(0, -s.vy), driftAlong: s.vx, driftAcross: s.vz, tilt: Math.abs(s.tilt), tw: game.vehicle.thrust * Math.max(s.throttle, s.throttle > 0 ? game.vehicle.minThrottle : 0) / game.sim.gravity, hStop: hStop(s, game), fuel: s.fuel, legs: s.legs, phase }; }
  function stopAll() { listen(false); hud.touch(false); held = { left: false, right: false, burn: false }; touchTilt = 0; if (thrust) { thrust.stop(0.4); thrust = null; } reticle.visible = false; padRing.visible = false; }
  const host = {
    hud,
    // OVERRIDE: the seeded problem (the entry: src/domain/manual-landing.js seedEntry; 2026-11-07, the sequence's own altitude and rate were
    // not flyable), placed under the glare with the boosters LIT (spec 14 C: the throttle and its set point at 1 from the first frame, the
    // auto-lander's last burn); clear the panel, arm the keys; MANUAL starts when the arrival calls manual()
    begin(legs = 0) {
      az = typeof azimuth === 'function' ? azimuth() : azimuth;
      s = createLanding(entry); s.legs = legs; s.legsDown = legs >= 1; legsHeard = legs > 0; s.throttle = 1; s.set = 1;
      padRing.visible = true;
      phase = 'override'; acc = 0; contact = null; harnessThrottle = null; rate = { tilt: 0 }; touchTilt = 0; follow.set(s.x, s.y, s.z);
      hud.clear(); hud.show(true); hud.annunciate('AUTO-LAND FAULT · MANUAL OVERRIDE', 'alarm'); hud.set(reading()); listen(true);
      if (coarse) hud.touch(true, { tilt: (r) => { touchTilt = r; }, burn: (on) => { held.burn = on; }, legs: () => { input.legs = true; }, skip: () => host.skip() });
      pred = predict(); sfx?.play('danger_alert', { dist: 0 }); poseRocket(); plumesAt(); placeReticle();   // the plumes now, so the first frame out of the black shows the boosters lit
    },
    manual() { if (phase === 'override') { phase = 'manual'; hud.annunciate('MANUAL', 'info'); } },
    tick(dt) {
      if (!s || phase === 'idle' || phase === 'touched') return phase;
      acc += Math.min(dt, game.sim.dt * game.sim.maxSteps);
      // the throttle's set point every step (the model spools toward it): the burn held, else the harness's held throttle, else idle;
      // the tilt a held key, else a held rail triangle, else the harness's rate
      const i = { throttle: held.burn ? 1 : (harnessThrottle ?? 0), tiltRate: ((held.right ? 1 : 0) - (held.left ? 1 : 0)) || touchTilt || rate.tilt, legs: input.legs };
      // the alarm beat (spec 14 C): the auto-lander's last burn, the physics running with the throttle forced to 1; the tilt keys and the legs
      // live, so the player can already lean; then MANUAL, where the burn follows Space
      while (acc >= game.sim.dt) {
        acc -= game.sim.dt;
        if (phase === 'manual' && flareDue(s, game)) { phase = 'flare'; hud.annunciate('AUTO-LAND RESUMED', 'ok'); }
        if (phase === 'flare') flareStep(s, game.sim.dt, game); else step(s, phase === 'override' ? { throttle: 1, tiltRate: i.tiltRate, legs: i.legs } : i, game.sim.dt, game);
        i.legs = false; input.legs = false;   // a legs request is consumed by the step that reads it (the set point is held)
        if (touched(s, ground().y)) { phase = 'touched'; break; }
      }
      follow.lerp(a.set(s.x, s.y, s.z), Math.min(1, dt / game.camera.lag));
      pred = predict();
      poseRocket(); plumesAt(); hud.set(reading());
      if (phase === 'touched') {
        // the ground's slope (the angle of its normal from the pad's up) and the tilt against the LOCAL normal along the drift axis (x,
        // spec 14): on the arrival's sphere that is s.tilt - atan2(x, R), the ground under a far wreck leaning away from the pad (2026-11-07);
        // the normal is the island's, turned into the flight frame for its component along the drift
        const g = ground(), ny = Math.max(-1, Math.min(1, g.normal[1])), slope = Math.acos(ny), nf = islandToFlight(g.normal, az);
        contact = verdict({ ...s, tilt: s.tilt - Math.atan2(nf[0], nf[1]) }, slope, Math.hypot(s.x, s.z) > game.pad.reach, game);
        if (contact.grade === 'WRECK') sfx?.play('mech_landing_impact', { dist: 0 });
        hud.verdict(contact); hud.annunciate(`LANDING · ${contact.grade}`, contact.grade === 'WRECK' ? 'alarm' : 'ok'); stopAll();
      } else { placeReticle(); sounds(dt); }
      return phase;
    },
    chase,
    // the harness: the throttle (when given) and the tilt rate held until the next call; a held burn key or BURN button outranks the throttle
    input(i) { if (i.throttle != null) harnessThrottle = Math.max(0, Math.min(1, i.throttle)); rate.tilt = Math.max(-1, Math.min(1, i.tiltRate ?? 0)); if (i.legs) input.legs = true; },
    // Esc or SKIP (spec 8): graded CLEAN, the auto-lander never crashes; the arrival resumes its sequence at the touchdown
    skip() { if (!s || phase === 'touched') return; phase = 'touched'; contact = { grade: 'CLEAN', reason: 'skipped', sink: 0, drift: 0, tilt: 0 }; hud.verdict(contact); hud.annunciate('AUTO-LAND RESUMED', 'ok'); stopAll(); },
    contact: () => contact, phase: () => phase, azimuth: () => az, pose: () => { if (!s) return null; const [x, y, z] = island(); return { x, y, z, tilt: s.tilt }; },   // island metres
    // the harness's frame check: where the rocket's feet, its top (the well's rim at the model's 1.5), the reticle and the pad's centre fall
    // on screen, NDC (in frame within +-1); the points in island metres
    view() {
      if (!s || !camera) return null;
      camera.updateMatrixWorld(); const ndc = (p) => { const v = toWorld(p, new THREE.Vector3()).project(camera); return [+v.x.toFixed(2), +v.y.toFixed(2)]; };
      const [x, y, z] = island();
      return { feet: ndc([x, y, z]), top: ndc([x, y + 1.5 * SH02_WELL.rim, z]), reticle: reticle.visible ? ndc([reticle.position.x, reticle.position.y, reticle.position.z]) : null, pad: ndc([0, 0, 0]) };
    },
    state: () => (s ? { phase, grade: contact?.grade ?? null, reason: contact?.reason ?? null, sink: +Math.max(0, -s.vy).toFixed(2), drift: +Math.hypot(s.vx, s.vz).toFixed(2), vx: +s.vx.toFixed(2), vz: +s.vz.toFixed(2), tilt: +s.tilt.toFixed(3), fuel: +s.fuel.toFixed(1), altitude: +s.y.toFixed(1), x: +island()[0].toFixed(1), z: +island()[2].toFixed(1), along: +s.x.toFixed(1), throttle: +s.throttle.toFixed(2), legs: +s.legs.toFixed(2), t: +s.t.toFixed(2) } : null),
    dispose() { stopAll(); reticle.removeFromParent(); padRing.removeFromParent(); for (const l of [altRing, ...fixed, square, padRing]) { l.geometry.dispose(); l.material.dispose(); } },   // the HUD is the arrival's
  };
  // the keys listen FROM CREATION (spec 14 C): the arrival starts the flight shot right after creating this host, before begin(), and capture
  // listeners on one target run in registration order, so the host's must come first or the shot (passKeys off) eats Space, A and D; keys()
  // ignores every key until begin() and after the contact, so listening early takes nothing from the page
  listen(true);
  return host;
}
