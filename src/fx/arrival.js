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
// The host is td-tab's storyApi, handed to tick every frame, frozen or not: brief(id), camera, startShot, snapCamera, drone() (Isao's
// record: obj, dir, loiter, faceLock); the beats' deploy runs the foundry through it.
import * as THREE from '../../vendor/three.module.js';
import { createLaunchPlume } from './launch-plume.js';
import { makeScorch, makeEmbers, IMPACT_TUNE } from '../impactfx.js';
import { PLUME_CLUSTER, SH02_WELL, STORY_ARRIVAL } from '../content/story-defaults.js';
import { makeArrivalShot } from '../domain/arrival-shot.js';
import { isaoFace } from '../domain/story-shots.js';
import { BRIEFS, lineDwell } from '../isaobriefs.js';

const IDS = ['sh02', 'sh02-salvage', 'foundry'];
const CLIPS = ['Legs_Deploy', 'Landing_Shock', 'Top_Door_Open'];

// `site`: the landing island's world basis (src/fx/story-base.js basisAt: +y its up, +z toward the pole), `metres`: world units a metre.
// `past`: the page starts past the landing (a tutorial chapter, a phase jump at stage 1): no shot, and the rocket is its salvage and
// the foundry from the first frame, each landmark put in that end state as it loads
export function createArrival({ on = false, past = false, base = null, beats = null, site = null, metres = 1, tune = STORY_ARRIVAL } = {}) {
  let phase = on && base && beats && site ? 'waiting' : past && base ? 'done' : 'off';
  const shot = makeArrivalShot(tune), lines = BRIEFS[tune.talk.brief];
  const talkSeconds = lines.lines.reduce((sum, _, i) => sum + lineDwell(lines, i), 0);   // the close-up holds every line (the owner's second playtest)
  const m4 = new THREE.Matrix4(), up = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), eye = new THREE.Vector3();
  const inv = site ? site.clone().invert() : null;
  if (site) up.setFromMatrixColumn(site, 1).normalize();
  const toWorld = (p, out = new THREE.Vector3()) => out.set(p[0] * metres, p[1] * metres, p[2] * metres).applyMatrix4(site);
  const pose = (out, eye, look, n) => { m4.lookAt(eye, look, n); out.quat.setFromRotationMatrix(m4); out.pos.copy(eye); };
  let api = null, camera = null, fov = null, rocket = null, drone = null, size = 0, to = null, fxRoot = null, scorch = null, dust = null;
  let t = 0, talkT = 0, waited = 0, cutting = false, deployed = false, skipped = false, late = phase === 'done' ? new Set(IDS) : null, plumes = [];

  const drop = (o) => { o.removeFromParent(); o.geometry?.dispose(); o.material?.dispose(); };
  const hud = (on) => globalThis.document?.body.classList.toggle('arrival-on', on);   // styles.css hides the chrome while it plays
  function clip(name, time) {   // held actions (story-base): a scrub sets the time; null takes the clip off the pose
    const act = rocket.root?.userData.actions?.[name]; if (!act) return;
    act.enabled = time !== null; if (time !== null) { act.paused = true; act.time = time; }
  }
  // the rocket at time `time` of the landing: along its own up, its clips, plumes, scorch and dust; Isao climbing out and clear
  function apply(time, dt) {
    const s = shot.stateAt(time), h = rocket.holder;
    h.matrix.copy(h.userData.placed).premultiply(m4.makeTranslation(up.x * s.altitude * metres, up.y * s.altitude * metres, up.z * s.altitude * metres)); h.matrixWorldNeedsUpdate = true;
    clip('Legs_Deploy', s.clips.Landing_Shock === null ? (s.clips.Legs_Deploy ?? 0) : null);   // stowed until they deploy; the shock owns the legs after touchdown
    clip('Landing_Shock', s.clips.Landing_Shock); clip('Top_Door_Open', s.clips.Top_Door_Open ?? 0);
    rocket.root?.userData.mixer?.update(0);
    toWorld(shot.camera(time).pos, eye); h.updateMatrixWorld(true); a.copy(eye); h.worldToLocal(a);   // this frame's eye, off the rail
    for (const p of plumes) {   // several engines, each on its own cadence (the lab's burn), each sheet turned to the camera about the hull's axis
      const e = p.userData.engine;
      p.userData.setIntensity(s.plume * (1 - e.depth + e.depth * Math.sin(time * e.cadence + e.phase)) * 0.55); p.userData.tick(time + e.phase);
      p.rotation.set(0, Math.atan2(a.x - p.position.x, a.z - p.position.z), 0);
    }
    if (s.scorch && !scorch) { scorch = makeScorch({ ...IMPACT_TUNE, scorchSize: 9, scorchLife: 1e9 }, 0x0a0806); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.02; fxRoot.add(scorch); }
    if (s.dust && !dust) { dust = makeEmbers({ ...IMPACT_TUNE, emberCount: 420, emberLife: 2.6, emberDrag: 0.985, emberRise: 0.9 }, 0x9a8f7a, 11); dust.scale.setScalar(6); dust.position.y = 0.4; fxRoot.add(dust); }
    if (dust && dt > 0 && !dust.userData.tick(dt)) { drop(dust); dust = null; }
    const i = shot.isaoAt(time, to), o = drone.obj;
    o.visible = i.visible;
    if (!i.visible) return;
    o.scale.setScalar(size * tune.isao.scale); toWorld(i.pos, o.position);
    // he faces the camera as he comes out, angry at the landing: the first line's face, before the line
    b.copy(o.position).normalize(); c.copy(eye).sub(o.position); c.addScaledVector(b, -c.dot(b)).add(o.position);
    m4.lookAt(c, o.position, b); o.quaternion.setFromRotationMatrix(m4); drone.faceLock = 'angry';
  }
  // the rocket back on the ground in its end pose (the base's own: legs out, shock over, door open), the landing's effects gone
  function settle() {
    if (!rocket) return;
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
    api.brief(tune.talk.brief);
  }
  function start() {
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
    api.startShot({ id: 'arrival', dur: shot.cut + 2, poseAt: railPose, onEnd: () => { if (!cutting) finish(true); } });   // its end is the cut (tick), not its clock
  }
  function railPose(u, out) {
    const p = shot.camera(Math.min(t, shot.cut));
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix(); }
    pose(out, toWorld(p.pos, a), toWorld(p.look, b), up);
  }
  function talkPose(u, out) {
    const o = drone.obj, f = isaoFace(o.position.toArray(), drone.dir, o.getWorldDirection(a).toArray(), o.scale.x, u);
    pose(out, a.fromArray(f.eye), b.fromArray(f.look), c.fromArray(f.up));
  }
  // THE CUT: everything that would show the swap is behind the camera, and the swap happens in this call
  function toTalk() {
    settle(); deploy();
    phase = 'talk'; talkT = 0;
    camera.fov = tune.talk.fov; camera.updateProjectionMatrix();
    cutting = true; api.startShot({ id: 'arrivalTalk', dur: talkSeconds, poseAt: talkPose, onEnd: () => finish(false) }); cutting = false;
  }
  function finish(skip) {
    if (phase !== 'landing' && phase !== 'talk') return;
    skipped = skip && phase === 'landing';
    settle(); deploy();   // a skip before the cut: the swap happens with it, on the cut to the base
    camera.fov = fov; camera.updateProjectionMatrix();
    if (drone) { drone.loiter = toWorld([0, 0, 0], a).normalize().toArray(); drone.obj.visible = true; }   // he drifts back to the foundry he is about to work
    hud(false);
    phase = 'done';
    api.snapCamera();
  }
  // no landing to show (a model never came): the beats are released and the lines said; whatever loads later lands in the end state
  function release() {
    phase = 'done'; late = new Set(IDS.filter((id) => !base.structure(id)));
    const d = api.drone(); if (d) d.obj.visible = true;
    deploy();
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
        waited += dt;
        if (base.structure('sh02')?.holder.visible) base.conceal('sh02');   // nothing stands before it lands
        const d = api.drone(); if (d) d.obj.visible = false;
        if (d && IDS.every((id) => base.structure(id))) start();
        else if (waited > tune.wait || base.errors.some((e) => IDS.some((id) => e.startsWith(`${id}:`)))) release();
        return;
      }
      if (phase === 'landing') { t += dt; if (t >= shot.cut) toTalk(); else apply(t, dt); }
      else talkT += dt;
      if (phase !== 'done') api.snapCamera();   // on the rail exactly: the chase view's lag would trail a falling rocket
    },
    state: () => {
      const vis = (id) => base?.structure(id)?.holder.visible ?? null, local = (v) => v.clone().applyMatrix4(inv).divideScalar(metres).toArray().map((x) => +x.toFixed(1));
      return { on, phase, t: +t.toFixed(2), cut: +shot.cut.toFixed(2), talk: +talkSeconds.toFixed(2), talkT: +talkT.toFixed(2), waited: +waited.toFixed(1), deployed, skipped,
        to: to?.map((x) => +x.toFixed(1)) ?? null, eye: camera ? local(camera.position) : null, at: drone ? local(drone.obj.position) : null,   // metres around the island: the camera and Isao
        altitude: rocket ? +shot.stateAt(phase === 'landing' ? t : shot.cut).altitude.toFixed(1) : null, rocket: vis('sh02'), salvage: vis('sh02-salvage'), foundry: vis('foundry'),
        isao: drone ? { visible: drone.obj.visible, scale: +(drone.obj.scale.x / size).toFixed(2), face: drone.obj.userData.getFace?.() ?? null } : null, fov: camera ? +camera.fov.toFixed(1) : null, lens: fov };   // lens: the game's own, put back at the end
    },
  };
}
