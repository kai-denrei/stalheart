// THE ARRIVAL, IN THE GAME (owner, 2026-09-25, from a playtest of the live build: "bring back the landing, short and sweet but
// showing the landing. Isao comes out, close up on his face; he's the narrator. 'Rough landing!' 'So much to build!' 'I'll get
// started on recycling the rocket.' (2026-09-25, second playtest: '... saying he'll cannibalize the rocket to get started with
// terraforming'.) The state change from rocket intact to dismantled should happen off camera to hide the fact we
// do not have an animation for it"). About eight seconds at every story start; src/platform/story-world.js decides which (a bare
// page, the burger's Story, ?grow=1 at stage 1; never SKIP TUTORIAL, stage=N and story=N links or phase jumps).
//
// Two shots over the base's own landmarks (src/fx/story-base.js), no second rocket:
//   'arrival'      the SH02 comes down along its own up on src/domain/arrival-shot.js's clock (the lab's timeline, cut short), its
//                  legs, shock and door clips scrubbed, the lab's plumes, scorch and dust under it; Isao climbs out of the well
//                  (smaller than his game size: the six metre drone would not fit it) and flies clear toward the pole
//   'arrivalTalk'  the CUT to his face (src/domain/story-shots.js isaoFace) through a long lens, the rocket BEHIND the camera. On
//                  that cut the beats deploy the AFR-01 (story-beats deploy): the intact rocket is swapped for its salvage and the
//                  foundry where no camera looks. His lines run on the panel (src/isaobriefs.js arrival_talk) and on the drone's
//                  face; the camera holds the first two and the start of the third, then is back on the base (the lens restored,
//                  the chase view snapped) while he finishes it
// A key or a tap ends either shot, as every shot, on the same end state: before the cut the swap happens with it, on the cut to the
// chase view. Until the shot the rocket is kept out of sight as it loads and Isao hidden, so nothing stands before it lands; if the
// rocket, its salvage, the foundry or Isao never come (`wait` seconds, or a load error) the beats are released and the lines said
// without a shot.
//
// THE SOUND (owner, 2026-09-30: "the landing needs a sound of rocket thrusters landing and gears moving"): the story lab's score
// (src/labs/story-tab.js audioSync) — the thrust bed loops under the burn, riding the plume, and cuts at touchdown; the tank's
// pneumatics stand in for the legs deploying, the shock and the door. Audio starts on the page's first gesture, so the shot spends
// that gesture on the sound and the next one skips (src/fx/camera-shot.js `unlock`).
//
// The host is td-tab's storyApi, handed to tick every frame, frozen or not: brief(id), camera, startShot, snapCamera, drone() (Isao's
// record: obj, dir, loiter, faceLock), sfx (src/audio.js); the beats' deploy runs the foundry through it.
import * as THREE from '../../vendor/three.module.js';
import { createLaunchPlume } from './launch-plume.js';
import { makeScorch, makeEmbers, IMPACT_TUNE } from '../impactfx.js';
import { PLUME_CLUSTER, SH02_WELL, STORY_ARRIVAL, STORY_ARRIVAL_MANUAL } from '../content/story-defaults.js';
import { makeArrivalShot } from '../domain/arrival-shot.js';
import { isaoFace } from '../domain/story-shots.js';
import { BRIEFS, lineDwell } from '../isaobriefs.js';
import { createStartGate } from './start-gate.js';
import { LANDING_GAME } from '../content/landing-game.js';
import { seedEntry } from '../domain/manual-landing.js';
import { createManualLanding } from './manual-landing.js';
import { createLandingHud } from './landing-hud.js';
import { startLandingGlare } from './landing-glare.js';
import { storage } from '../storage.js';

const IDS = ['sh02', 'sh02-salvage', 'foundry'];
const CLIPS = ['Legs_Deploy', 'Landing_Shock', 'Top_Door_Open'];

// `site`: the landing island's world basis (src/fx/story-base.js basisAt: +y its up, +z toward the pole), `metres`: world units a metre.
// `past`: the page starts past the landing (a tutorial chapter, a phase jump at stage 1): no shot, and the rocket is its salvage and
// the foundry from the first frame, each landmark put in that end state as it loads.
// THE LANDING (src/platform/story-world.js decideLanding): `manual` the player flies it (the longer approach, STORY_ARRIVAL_MANUAL,
// unless a tune is passed), `offer` the start gate offers it (FLY THE LANDING beside START, 2026-11-07: taking it makes the start a
// manual one, start() choosing the tune), `seed` the override's entry (src/domain/manual-landing.js seedEntry, per planet). The parameters stay in this closure for the flown landing
export function createArrival({ on = false, past = false, base = null, beats = null, site = null, metres = 1, tune, manual = false, offer = false, seed = 'planet' } = {}) {
  const given = tune;
  tune ??= manual ? STORY_ARRIVAL_MANUAL : STORY_ARRIVAL;
  let phase = on && base && beats && site ? 'waiting' : past && base ? 'done' : 'off';
  let shot = makeArrivalShot(tune);
  const holdOf = (id) => BRIEFS[id].lines.reduce((sum, _, i) => sum + lineDwell(BRIEFS[id], i), 0);
  let talkSeconds = holdOf(tune.talk.brief);   // the close-up holds every line (the owner's second playtest); a graded talk's own count (toTalk)
  const m4 = new THREE.Matrix4(), up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), eye = new THREE.Vector3();
  const inv = site ? site.clone().invert() : null;
  if (site) up.setFromMatrixColumn(site, 1).normalize();
  const toWorld = (p, out = new THREE.Vector3()) => out.set(p[0] * metres, p[1] * metres, p[2] * metres).applyMatrix4(site);
  const pose = (out, eye, look, n) => { m4.lookAt(eye, look, n); out.quat.setFromRotationMatrix(m4); out.pos.copy(eye); };
  let api = null, camera = null, fov = null, rocket = null, drone = null, size = 0, to = null, fxRoot = null, scorch = null, dust = null;
  let t = 0, talkT = 0, waited = 0, cutting = false, deployed = false, skipped = false, thrust = null, heard = null, cues = [], late = phase === 'done' ? new Set(IDS) : null, plumes = [], gate = null;
  // THE LANDING FLOWN (2026-11-07, spec section 2): `flying` the host (src/fx/manual-landing.js) from the start when the landing may be flown,
  // `lhud` its panel (the arrival's: the verdict reads through the cut), `grade` the contact once the ground is met, `landed` where the
  // rocket stood (island metres; null on a skip), `jolt` the rail's shake after a hard or wrecked contact, `offered` the gate's offer taken
  let flying = null, lhud = null, glare = null, overrideAt = Infinity, overrideT = 0, offered = false, grade = null, landed = null, jolt = 0;
  const talkBrief = () => (grade && grade.reason !== 'skipped' ? LANDING_GAME.lines[grade.grade] : tune.talk.brief);   // a skip is the plain talk (spec 7)
  // the start gate (src/fx/start-gate.js), the welcome guide, from the first frame: the landing loads behind it and waits for START;
  // an acceptance run lands without it unless it asks (?gate=1)
  const q = typeof location === 'object' ? new URLSearchParams(location.search) : null, gated = !q || q.get('acceptance') !== '1' || q.get('gate') === '1';

  const drop = (o) => { o.removeFromParent(); o.geometry?.dispose(); o.material?.dispose(); };
  const hud = (on) => globalThis.document?.body.classList.toggle('arrival-on', on);   // styles.css hides the chrome while it plays
  function clip(name, time) {   // held actions (story-base): a scrub sets the time; null takes the clip off the pose
    const act = rocket.root?.userData.actions?.[name]; if (!act) return;
    act.enabled = time !== null; if (time !== null) { act.paused = true; act.time = time; }
  }
  const cue = (key, o) => { cues.push(key); api.sfx?.play(key, { dist: 0, ...o }); };
  function sound(s) {   // `s`: the landing's state this frame; null: the landing is over
    if (s?.plume > 0) { thrust ??= api.sfx?.loop('rocket_thrust', { dist: 0, gain: 0 }); thrust?.set(0.4 + 0.6 * s.plume, 0.96 + 0.06 * s.plume); }   // null until the sound has started: asked again next frame
    else if (thrust) { thrust.stop(s ? 0.08 : 0.4); thrust = null; }
    if (!s) { heard = null; return; }
    const was = heard; heard = { legs: s.clips.Legs_Deploy !== null, down: s.clips.Landing_Shock !== null, door: s.clips.Top_Door_Open !== null };
    if (!was) return;
    if (heard.legs && !was.legs) cue('tank_spool_up');
    if (heard.down && !was.down) cue('tank_spool_down');
    if (heard.door && !was.door) cue('tank_spool_up', { rate: 0.85 });
  }
  // the rocket at time `time` of the landing: along its own up, its clips, plumes, scorch and dust; Isao climbing out and clear
  function apply(time, dt) {
    const s = shot.stateAt(time), h = rocket.holder;
    if (manual && !grade) s.clips.Legs_Deploy = null;   // the flown landing's legs are the player's (L, or 200 m): the approach keeps them stowed
    sound(s);
    // after a flown touchdown the rocket stands where it met the ground (`landed`, island metres off the pad's centre), not snapped to it
    toWorld(landed ?? [0, 0, 0], c).sub(toWorld([0, 0, 0], b)).addScaledVector(up, s.altitude * metres);
    h.matrix.copy(h.userData.placed).premultiply(m4.makeTranslation(c.x, c.y, c.z)); h.matrixWorldNeedsUpdate = true;
    clip('Legs_Deploy', s.clips.Landing_Shock === null ? (s.clips.Legs_Deploy ?? 0) : null);   // stowed until they deploy; the shock owns the legs after touchdown
    // the shock clip at a rate from the contact (spec 2.5): as authored on a clean one, faster on a hard one, hardest on a wreck
    clip('Landing_Shock', s.clips.Landing_Shock === null ? null : s.clips.Landing_Shock * (grade?.grade === 'WRECK' ? 1.6 : grade?.grade === 'HARD' ? 1.25 : 1)); clip('Top_Door_Open', s.clips.Top_Door_Open ?? 0);
    rocket.root?.userData.mixer?.update(0);
    toWorld(shot.camera(time).pos, eye); h.updateMatrixWorld(true); a.copy(eye); h.worldToLocal(a);   // this frame's eye, off the rail
    for (const p of plumes) {   // several engines, each on its own cadence (the lab's burn), each sheet turned to the camera about the hull's axis
      const e = p.userData.engine;
      p.userData.setIntensity(s.plume * (1 - e.depth + e.depth * Math.sin(time * e.cadence + e.phase)) * 0.55); p.userData.tick(time + e.phase);
      p.rotation.set(0, Math.atan2(a.x - p.position.x, a.z - p.position.z), 0);
    }
    const wreck = grade?.grade === 'WRECK', [lx, , lz] = landed ?? [0, 0, 0];   // a wreck: the scorch wider, the dust doubled (spec 2.5)
    if (s.scorch && !scorch) { scorch = makeScorch({ ...IMPACT_TUNE, scorchSize: wreck ? 14 : 9, scorchLife: 1e9 }, 0x0a0806); scorch.rotation.x = -Math.PI / 2; scorch.position.set(lx, 0.02, lz); fxRoot.add(scorch); }
    if (s.dust && !dust) { dust = makeEmbers({ ...IMPACT_TUNE, emberCount: wreck ? 840 : 420, emberLife: 2.6, emberDrag: 0.985, emberRise: 0.9 }, 0x9a8f7a, 11); dust.scale.setScalar(6); dust.position.set(lx, 0.4, lz); fxRoot.add(dust); }
    if (dust && dt > 0 && !dust.userData.tick(dt)) { drop(dust); dust = null; }
    const i = shot.isaoAt(time, to), o = drone.obj;
    o.visible = i.visible;
    if (!i.visible) return;
    o.scale.setScalar(size * tune.isao.scale); toWorld(landed ? [i.pos[0] + lx * (1 - i.out), i.pos[1], i.pos[2] + lz * (1 - i.out)] : i.pos, o.position);   // out of the rocket where it stands, then his arc to his point
    // he faces the camera as he comes out, angry at the landing: the first line's face, before the line
    b.copy(o.position).normalize(); c.copy(eye).sub(o.position); c.addScaledVector(b, -c.dot(b)).add(o.position);
    m4.lookAt(c, o.position, b); o.quaternion.setFromRotationMatrix(m4); drone.faceLock = 'angry';
  }
  // the rocket back on the ground in its end pose (the base's own: legs out, shock over, door open), the landing's effects gone
  function settle() {
    if (!rocket) return;
    sound(null);
    rocket.holder.matrix.copy(rocket.holder.userData.placed); rocket.holder.matrixWorldNeedsUpdate = true;
    for (const name of CLIPS) { const act = rocket.root?.userData.actions?.[name]; if (act) clip(name, act.getClip().duration); }
    rocket.root?.userData.mixer?.update(0);
    for (const p of plumes) { p.removeFromParent(); p.userData.dispose(); }
    plumes = []; if (dust) drop(dust); if (scorch) drop(scorch); dust = scorch = null; fxRoot?.removeFromParent();
  }
  // Isao out at his point at his game size, facing the rocket; the beats deploy the AFR-01 (the swap) and he says his lines
  function deploy() {
    if (deployed) return; deployed = true;
    if (drone) {
      const o = drone.obj; o.scale.setScalar(size); o.visible = true; toWorld(to, o.position);
      b.copy(o.position).normalize(); toWorld([0, to[1], 0], c);
      m4.lookAt(c, o.position, b); o.quaternion.setFromRotationMatrix(m4); o.updateMatrixWorld();
      drone.dir = b.toArray(); drone.faceLock = null;
    }
    beats.deploy(api);
    api.brief(talkBrief());   // the graded talk (LANDING_GAME.lines), the plain one when the landing was not flown or was skipped
  }
  // THE LANDING HANDS OVER TO THE TOUR of the landers, and the tour dives straight into the Rotor (owner, 2026-10-05: "no more 'look
  // around' the map after the beacon"; it was a free orbit camera since 2026-09-30); without a tour, the orbit camera on the base
  const look = () => (api.freeLook ? api.freeLook() : api.snapCamera());
  function start() {
    // the flown landing is chosen here, not at creation: a first start (`manual`), or the gate's FLY THE LANDING on a later one (`offer`)
    if (offer && (offered || gate?.choice === 'fly')) { offered = true; manual = true; }
    if (manual && !given) { tune = STORY_ARRIVAL_MANUAL; shot = makeArrivalShot(tune); talkSeconds = holdOf(tune.talk.brief); }
    overrideAt = manual ? LANDING_GAME.approach.overrideAt : Infinity;
    rocket = base.structure('sh02'); drone = api.drone(); camera = api.camera; fov = camera.fov; size = drone.obj.scale.x;
    // where he ends: `clear` metres toward the pole at his own hover height, so the game takes him back without a jump
    toWorld([0, 0, tune.isao.clear], a).normalize().multiplyScalar(drone.obj.position.length());
    to = a.applyMatrix4(inv).divideScalar(metres).toArray();
    base.reveal('sh02');
    fxRoot = new THREE.Group(); fxRoot.name = 'Arrival'; fxRoot.matrixAutoUpdate = false; fxRoot.matrix.copy(site).multiply(m4.makeScale(metres, metres, metres)); base.group.add(fxRoot);
    plumes = PLUME_CLUSTER.map((e) => {   // under the skirt, in the hull's own authored metres, as the lab hangs them
      const p = createLaunchPlume({ width: e.width, height: e.height }), ang = e.angle * Math.PI / 180;
      p.position.set(Math.cos(ang) * e.radius, SH02_WELL.bell - e.height / 2 + 1, Math.sin(ang) * e.radius); p.userData.engine = e; rocket.holder.add(p); return p;
    });
    phase = 'landing'; t = 0;
    hud(true);
    camera.fov = shot.camera(0).fov; camera.updateProjectionMatrix(); apply(0, 0);
    api.mission?.();   // the why, laconic, over the descent (src/fx/mission-card.js)
    if (manual) {   // THE LANDING (2026-11-07): the host in island metres with the pad's top at 0, its reticle under a group lifted there
      const pad = new THREE.Vector3().setFromMatrixPosition(rocket.holder.userData.placed).applyMatrix4(inv).divideScalar(metres).y;
      const flightRoot = new THREE.Group(); flightRoot.name = 'LandingFlight'; flightRoot.position.y = pad; fxRoot.add(flightRoot);
      lhud = createLandingHud(globalThis.document?.body);
      flying = createManualLanding({ entry: seedEntry(seed, LANDING_GAME), rocket, plumes, camera, sfx: api.sfx, hud: lhud, toWorld: (p, out) => toWorld([p[0], p[1] + pad, p[2]], out), up, root: flightRoot,
        clipScrub: (name, time) => { clip(name, time); rocket.root?.userData.mixer?.update(0); }, coarse: !!globalThis.matchMedia?.('(pointer: coarse)').matches });
    }
    api.startShot({ id: 'arrival', dur: shot.cut + 2, poseAt: railPose, unlock: !!api.sfx && !api.sfx.ready, onEnd: () => { if (!cutting) finish(true); } });   // its end is the cut (tick), not its clock
  }
  function railPose(u, out) {
    const p = shot.camera(Math.min(t, shot.cut));
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    pose(out, toWorld(p.pos, a), toWorld(p.look, b), up);
    if (jolt > 0) out.pos.addScaledVector(up, Math.sin(jolt * 40) * jolt * LANDING_GAME.camera.jolt * metres);   // the shake on a hard contact (spec 4)
  }
  function talkPose(u, out) {
    const o = drone.obj, f = isaoFace(o.position.toArray(), drone.dir, o.getWorldDirection(a).toArray(), o.scale.x, u);
    pose(out, a.fromArray(f.eye), b.fromArray(f.look), c.fromArray(f.up));
  }
  // THE CUT: everything that would show the swap is behind the camera, and the swap happens in this call
  function toTalk() {
    settle(); deploy();
    phase = 'talk'; talkT = 0; talkSeconds = holdOf(talkBrief());
    camera.fov = tune.talk.fov; camera.updateProjectionMatrix();
    cutting = true; api.startShot({ id: 'arrivalTalk', dur: talkSeconds, poseAt: talkPose, unlock: !!api.sfx && !api.sfx.ready, onEnd: () => finish(false) }); cutting = false;
  }
  function finish(skip) {
    if (phase !== 'landing' && phase !== 'talk') return;
    skipped = skip && phase === 'landing';
    settle(); deploy();   // a skip before the cut: the swap happens with it, on the cut to the base
    camera.fov = fov; camera.updateProjectionMatrix();
    if (drone) { drone.loiter = toWorld([0, 0, 0], a).normalize().toArray(); drone.obj.visible = true; }   // he drifts back to the foundry he is about to work
    hud(false); endFlight(true);
    phase = 'done';
    look();
  }
  // no landing to show (a model never came): the beats are released and the lines said; whatever loads later lands in the end state
  function release() {
    phase = 'done'; late = new Set(IDS.filter((id) => !base.structure(id))); endFlight(true);
    const d = api.drone(); if (d) d.obj.visible = true;
    deploy(); look();
  }
  // the host and the glare go at the touchdown; the panel (its verdict) at the end of the arrival
  function endFlight(all) {
    flying?.dispose(); flying = null; glare?.dispose(); glare = null;
    if (!all) return;
    lhud?.dispose(); lhud = null;
  }
  // the offer taken before START (the harness's landing('override'), as the gate's FLY THE LANDING): start() flies the landing
  function takeOffer() {
    if (!offer || offered || phase !== 'waiting') return false;
    offered = true; return true;
  }
  // OVERRIDE: the seeded entry under the glare (LANDING_GAME.approach says why not the sequence's own state); the chase shot takes over from the rail
  function override() {
    if (thrust) { thrust.stop(0.08); thrust = null; }   // the host's own thrust bed takes over
    flying.begin(0);   // the flown approach keeps the legs stowed (apply): they are the player's
    api.brief(LANDING_GAME.lines.override); storage.setItem('td.landing.flown', '1');
    if (globalThis.document?.body) glare = startLandingGlare(globalThis.document.body, { ...LANDING_GAME.override.glare, reducedMotion: !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches });
    cutting = true;   // starting a shot ends the rail's, whose onEnd would finish the arrival
    api.startShot({ id: 'arrivalFlight', dur: 1e6, poseAt: (u, out) => flying?.chase(out), skippable: true, skipKey: LANDING_GAME.input.skipKey, passKeys: true, onEnd: () => { if (!cutting && phase === 'landing') flying?.skip(); } });
    cutting = false; overrideT = 0;
  }
  // TOUCHDOWN: the grade to the foundry, the sequence resumes at its touchdown where the rocket stands, the rail shot back
  function touchdown() {
    const p = flying.pose(); grade = flying.contact(); landed = grade.reason === 'skipped' ? null : [p.x, 0, p.z];
    jolt = grade.grade === 'HARD' ? 0.5 : grade.grade === 'WRECK' ? 1 : 0;
    t = shot.seq.touchdown; overrideAt = Infinity; if (heard) heard.legs = true;   // the legs are down: no second pneumatics cue
    beats.salvage?.(LANDING_GAME.salvage[grade.grade]);
    endFlight(false);
    cutting = true; api.startShot({ id: 'arrival', dur: shot.cut - t + 2, poseAt: railPose, onEnd: () => { if (!cutting) finish(true); } }); cutting = false;
  }
  function landingTick(dt) {   // the landing branch; while the flight holds the clock `t` stands still (the rail and the sequence wait)
    t += dt;
    if (flying && t >= overrideAt && !flying.pose()) override();
    if (flying?.pose()) {   // the window: OVERRIDE for override.seconds, then MANUAL / FLARE, until the ground
      glare?.tick(dt); if (glare?.done) glare = null;
      overrideT += dt; if (flying.phase() === 'override' && overrideT >= LANDING_GAME.override.seconds) flying.manual();
      if (flying.tick(dt) === 'touched') touchdown(); else { t -= dt; return; }
    }
    jolt = Math.max(0, jolt - dt);
    if (t >= shot.cut) toTalk(); else apply(t, dt);
  }
  return {
    tick(dt, host) {
      if (phase === 'off') return;
      api = host;
      if (phase === 'done') {   // a landmark that came after a release is put in the end state as it appears, once
        if (late) for (const id of late) if (base.structure(id)) { late.delete(id); if (id === 'sh02') base.conceal(id); else base.reveal(id); }
        return;
      }
      if (phase === 'waiting') {
        if (base.structure('sh02')?.holder.visible) base.conceal('sh02');   // nothing stands before it lands
        const d = api.drone(); if (d) d.obj.visible = false;
        if (gated && !gate) { gate = createStartGate(globalThis.document?.body, { sfx: api.sfx, offer: offer && !offered }); hud(true); }
        if (gate && !gate.opened) return;   // the welcome holds the landing; its load clock starts on START
        waited += dt;
        if (d && IDS.every((id) => base.structure(id))) start();
        else if (waited > tune.wait || base.errors.some((e) => IDS.some((id) => e.startsWith(`${id}:`)))) release();
        return;
      }
      if (phase === 'landing') landingTick(dt);
      else talkT += dt;
      if (phase !== 'done') api.snapCamera();   // on the rail exactly: the chase view's lag would trail a falling rocket
    },
    done: () => phase === 'done',   // the beats' Rotor waits for it (and for the tour after it)
    // THE LANDING's harness (window.__stalheartTest.landing): 'input' ({ throttle, tiltRate, legs }, held until the next), 'skip', 'override' (takes the gate's offer before START)
    landing(cmd, arg) {
      if (cmd === 'input') { flying?.input(arg ?? {}); return !!flying?.pose(); }
      if (cmd === 'skip') { if (flying?.pose()) { flying.skip(); return true; } return false; }
      if (cmd === 'override') return takeOffer();
      return null;
    },
    state: () => {
      const vis = (id) => base?.structure(id)?.holder.visible ?? null, local = (v) => v.clone().applyMatrix4(inv).divideScalar(metres).toArray().map((x) => +x.toFixed(1));
      return { on, phase, gate: gate ? (gate.opened ? 'opened' : 'shown') : null, thrust: !!thrust, cues: cues.slice(-12), sound: api?.sfx?.ready ?? null, t: +t.toFixed(2), cut: +shot.cut.toFixed(2), talk: +talkSeconds.toFixed(2), talkT: +talkT.toFixed(2), waited: +waited.toFixed(1), deployed, skipped,
        to: to?.map((x) => +x.toFixed(1)) ?? null, eye: camera ? local(camera.position) : null, at: drone ? local(drone.obj.position) : null,   // metres around the island: the camera and Isao
        altitude: rocket ? +shot.stateAt(phase === 'landing' ? t : shot.cut).altitude.toFixed(1) : null, rocket: vis('sh02'), salvage: vis('sh02-salvage'), foundry: vis('foundry'),
        isao: drone ? { visible: drone.obj.visible, scale: +(drone.obj.scale.x / size).toFixed(2), face: drone.obj.userData.getFace?.() ?? null } : null, fov: camera ? +camera.fov.toFixed(1) : null, lens: fov,   // lens: the game's own, put back at the end
        manual, offer, offered, flown: storage.getItem('td.landing.flown') === '1', talkBrief: talkBrief(),
        view: flying?.view() ?? null, landing: flying?.state() ?? (grade ? { phase: 'done', grade: grade.grade, reason: grade.reason, sink: +grade.sink.toFixed(2), drift: +grade.drift.toFixed(2), tilt: +grade.tilt.toFixed(3), landed } : null) };
    },
  };
}
