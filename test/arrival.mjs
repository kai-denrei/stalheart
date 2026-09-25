// THE ARRIVAL'S HANDS (src/fx/arrival.js) on a recording host: the real module and real three.js nodes, the base, the beats and the
// controller faked. What a browser run cannot reach on demand is here: the waits for each landmark, the cut, both ends, the skips,
// and the fallback when a model never comes. The pictures themselves are --grow's.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createArrival } from '../src/fx/arrival.js';
import { STORY_ARRIVAL } from '../src/content/story-defaults.js';
import { BRIEFS, lineDwell } from '../src/isaobriefs.js';

const METRES = 1 / 753, HOVER = 1 + 18.6 * METRES, CLIPS = { Legs_Deploy: 2.4, Landing_Shock: 2, Top_Door_Open: 1.8 };
const site = new THREE.Matrix4().makeTranslation(0, 1, 0);   // the landing island at the pole of a unit sphere: +y up, +z toward the pole
function world() {
  const group = new THREE.Group(), records = new Map(), errors = [], log = [];
  const base = {
    group, errors,
    structure: (id) => records.get(id) ?? null,
    reveal: (id) => { const r = records.get(id); if (r) r.holder.visible = true; },
    conceal: (id) => { const r = records.get(id); if (r) r.holder.visible = false; },
    // a landmark's model arrives (story-base: the rocket stands shown with its clips held at their ends, the rest hidden until a beat)
    load(id) {
      const holder = new THREE.Group(); holder.matrixAutoUpdate = false;
      holder.userData.placed = site.clone().multiply(new THREE.Matrix4().makeScale(1.5 * METRES, 1.5 * METRES, 1.5 * METRES)); holder.matrix.copy(holder.userData.placed);
      holder.visible = id === 'sh02'; group.add(holder);
      const root = new THREE.Group(); holder.add(root);
      if (id === 'sh02') root.userData = { mixer: { update: () => {} }, actions: Object.fromEntries(Object.entries(CLIPS).map(([n, d]) => [n, { enabled: true, paused: true, time: d, getClip: () => ({ duration: d }) }])) };
      records.set(id, { holder, root, near: root, far: null });
    },
  };
  let deploys = 0;
  const beats = { deploy(api) { deploys++; api.foundry('deploy'); return true; }, deploys: () => deploys };
  const obj = new THREE.Object3D(); obj.scale.setScalar(0.0153); obj.position.set(0.02, 1, 0.01).setLength(HOVER);   /* placed as the game places him: on his hover radius */ obj.userData = { getFace: () => 'neutral' };
  const drone = { obj, dir: obj.position.clone().normalize().toArray(), loiter: null, faceLock: null };
  const camera = new THREE.PerspectiveCamera(68, 1.6, 0.004, 50);
  let shot = null, snaps = 0;
  const goal = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  const api = {
    camera, drone: () => (world.isao ? drone : null),
    startShot(s) { const was = shot; shot = null; was?.onEnd?.(); shot = { ...s, left: s.dur }; log.push(['shot', s.id]); api.snapCamera(); },
    snapCamera() { snaps++; if (shot) shot.poseAt(Math.min(1, 1 - shot.left / shot.dur), goal); camera.position.copy(goal.pos); camera.quaternion.copy(goal.quat); },
    brief: (id) => log.push(['brief', id]), briefing: () => false,
    // the controller's foundry hand on the deploy: the swap (src/fx/foundry-fx.js)
    foundry: (ev) => { log.push(['foundry', ev]); if (ev === 'deploy') { base.conceal('sh02'); base.reveal('sh02-salvage'); base.reveal('foundry'); } },
  };
  // the controller's frame: the shot's clock (stepShot), then the arrival's tick; a skip is the shot ending early
  const frame = (dt, arrival) => { if (shot) { shot.left -= dt; if (shot.left <= 0) { const s = shot; shot = null; s.onEnd?.(); } } arrival.tick(dt, api); };
  const skip = () => { const s = shot; shot = null; s?.onEnd?.(); };
  const world = { base, beats, drone, camera, api, log, frame, skip, isao: false, shot: () => shot?.id ?? null, snaps: () => snaps, goal };
  return world;
}
const make = (w, on = true) => createArrival({ on, base: w.base, beats: w.beats, site, metres: METRES });
const run = (w, a, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) w.frame(dt, a); };
const vis = (w, id) => w.base.structure(id)?.holder.visible ?? null;
const talk = lineDwell(BRIEFS[STORY_ARRIVAL.talk.brief], 0) + lineDwell(BRIEFS[STORY_ARRIVAL.talk.brief], 1) + STORY_ARRIVAL.talk.into;

// OFF: a page that does not start the story plays nothing, whatever loads
{
  const w = world(), a = make(w, false); w.isao = true; for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
  run(w, a, 2); assert.equal(a.state().phase, 'off'); assert.deepEqual(w.log, []); assert.equal(vis(w, 'sh02'), true, 'the rocket stands as it loaded');
}
// THE WHOLE ARRIVAL: it waits for all four, keeps the rocket and Isao out of sight meanwhile, lands, cuts, talks, and hands back
{
  const w = world(), a = make(w);
  run(w, a, 0.5); assert.equal(a.state().phase, 'waiting');
  w.base.load('sh02'); run(w, a, 0.1); assert.equal(vis(w, 'sh02'), false, 'nothing stands before it lands: the rocket is hidden the frame it loads');
  w.isao = true; run(w, a, 0.1); assert.equal(w.drone.obj.visible, false, 'Isao is hidden while he waits');
  w.base.load('sh02-salvage'); run(w, a, 0.1); assert.equal(a.state().phase, 'waiting', 'still one landmark to come');
  w.base.load('foundry'); w.frame(1 / 60, a);
  assert.equal(a.state().phase, 'landing'); assert.equal(w.shot(), 'arrival'); assert.equal(vis(w, 'sh02'), true, 'the rocket is shown to land');
  assert.equal(w.camera.fov, STORY_ARRIVAL.rail[0].fov, 'the rail\'s lens');
  const holder = w.base.structure('sh02').holder, up = () => new THREE.Vector3().setFromMatrixPosition(holder.matrix).y - 1;
  assert.ok(Math.abs(up() / METRES - STORY_ARRIVAL.landing.startAltitude) < 3, `the rocket starts high (${(up() / METRES).toFixed(1)} m)`);
  const acts = w.base.structure('sh02').root.userData.actions;
  assert.equal(acts.Legs_Deploy.time, 0, 'the legs stowed'); assert.equal(acts.Top_Door_Open.time, 0, 'the door shut'); assert.equal(acts.Landing_Shock.enabled, false, 'no shock in the air');
  assert.equal(holder.children.filter((c) => c.name === 'Launch plume').length, 6, 'six plumes under the skirt');
  run(w, a, 2.7); assert.ok(up() / METRES < 1e-6, 'down'); assert.equal(acts.Legs_Deploy.enabled, false, 'the shock owns the legs after touchdown'); assert.equal(acts.Landing_Shock.enabled, true);
  assert.equal(w.drone.obj.visible, false, 'he waits in the hull until the door opens');
  run(w, a, 0.7); assert.ok(acts.Top_Door_Open.time > 0, 'the door opening'); assert.equal(w.drone.obj.visible, true, 'he is climbing out'); assert.equal(w.drone.faceLock, 'angry');
  assert.ok(Math.abs(w.drone.obj.scale.x - 0.0153 * STORY_ARRIVAL.isao.scale) < 1e-9, 'smaller than his game size in the well');
  assert.deepEqual(w.log.filter((l) => l[0] !== 'shot'), [], 'nothing deployed, nothing said while it lands');
  // THE CUT
  run(w, a, STORY_ARRIVAL.rail[STORY_ARRIVAL.rail.length - 1].t - 3.4 - 1 / 60 + 0.05);
  assert.equal(a.state().phase, 'talk'); assert.equal(w.shot(), 'arrivalTalk');
  assert.deepEqual(w.log, [['shot', 'arrival'], ['foundry', 'deploy'], ['brief', 'arrival_talk'], ['shot', 'arrivalTalk']], 'on the cut, in one tick: the swap, his lines, the close-up');
  assert.equal(w.beats.deploys(), 1);
  assert.equal(vis(w, 'sh02'), false); assert.equal(vis(w, 'sh02-salvage'), true); assert.equal(vis(w, 'foundry'), true);
  assert.ok(new THREE.Vector3().setFromMatrixPosition(holder.matrix).distanceTo(new THREE.Vector3().setFromMatrixPosition(holder.userData.placed)) < 1e-12, 'the rocket back on its plot');
  assert.ok(Object.values(acts).every((x) => x.enabled && x.time === CLIPS[Object.keys(acts).find((k) => acts[k] === x)]), 'every clip at its end: the base\'s own pose');
  assert.equal(holder.children.filter((c) => c.name === 'Launch plume').length, 0, 'the plumes gone');
  assert.equal(w.drone.obj.scale.x, 0.0153, 'Isao at his game size');
  assert.ok(Math.abs(w.drone.obj.position.length() - HOVER) < 1e-9, 'at his hover height: the game takes him back without a jump');
  const at = w.drone.obj.position.clone().sub(new THREE.Vector3(0, 1, 0)).divideScalar(METRES);
  assert.ok(Math.abs(at.z - STORY_ARRIVAL.isao.clear) < 1 && Math.abs(at.x) < 1e-6, `clear of the rocket toward the pole (${at.toArray().map((v) => v.toFixed(1))})`);
  const eye = w.goal.pos.clone().sub(new THREE.Vector3(0, 1, 0)).divideScalar(METRES);
  assert.ok(eye.z > 3 && eye.z < at.z, `the camera stands between him and the rocket (${eye.z.toFixed(1)} m of ${at.z.toFixed(1)})`);
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(w.goal.quat);
  assert.ok(look.z > 0.8, 'looking at him, away from the rocket: the swap is behind the camera');
  const fw = w.drone.obj.getWorldDirection(new THREE.Vector3()); assert.ok(fw.z < -0.9, 'he faces the camera (and the rocket beyond it)');
  assert.equal(w.camera.fov, STORY_ARRIVAL.talk.fov);
  // the close-up runs its lines' length and hands back
  run(w, a, talk - 0.1); assert.equal(a.state().phase, 'talk');
  const snaps = w.snaps(); run(w, a, 0.2); assert.equal(a.state().phase, 'done'); assert.equal(w.shot(), null); assert.ok(w.snaps() > snaps, 'the chase view snapped');
  assert.equal(w.camera.fov, 68, 'the lens is the game\'s again'); assert.equal(w.drone.obj.visible, true);
  assert.ok(new THREE.Vector3().fromArray(w.drone.loiter).distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-9, 'he drifts back to the foundry');
  assert.equal(w.beats.deploys(), 1, 'deployed once'); assert.equal(w.log.filter((l) => l[0] === 'brief').length, 1, 'said once');
  run(w, a, 5); assert.equal(w.log.length, 4, 'nothing more');
}
// A SKIP IN THE LANDING: the same end state at once, the swap with the cut to the base
{
  const w = world(), a = make(w); w.isao = true; for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
  run(w, a, 1.5); assert.equal(a.state().phase, 'landing');
  w.skip();
  assert.equal(a.state().phase, 'done'); assert.equal(a.state().skipped, true);
  assert.deepEqual(w.log, [['shot', 'arrival'], ['foundry', 'deploy'], ['brief', 'arrival_talk']], 'the swap and the lines, no close-up');
  assert.equal(vis(w, 'sh02'), false); assert.equal(w.camera.fov, 68); assert.equal(w.drone.obj.visible, true); assert.equal(w.drone.obj.scale.x, 0.0153);
  assert.equal(w.base.structure('sh02').holder.children.length, 1, 'no plume left under the rocket');
  run(w, a, 3); assert.equal(w.beats.deploys(), 1);
}
// A SKIP ON HIS FACE, and another shot taking the camera: both end it on the end state
{
  const w = world(), a = make(w); w.isao = true; for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
  run(w, a, STORY_ARRIVAL.rail[STORY_ARRIVAL.rail.length - 1].t + 0.5); assert.equal(a.state().phase, 'talk');
  w.skip(); assert.equal(a.state().phase, 'done'); assert.equal(w.camera.fov, 68); assert.equal(w.beats.deploys(), 1);
  const w2 = world(), a2 = make(w2); w2.isao = true; for (const id of ['sh02', 'sh02-salvage', 'foundry']) w2.base.load(id);
  run(w2, a2, 1); w2.api.startShot({ id: 'other', dur: 3, poseAt: () => {} });
  assert.equal(a2.state().phase, 'done', 'another shot ends the arrival'); assert.equal(w2.beats.deploys(), 1); assert.equal(w2.shot(), 'other', 'and keeps the camera');
}
// NO LANDING TO SHOW: a model that errors, or one that never comes, releases the beats without a shot; what loads late lands in the
// end state once (the rocket hidden, the salvage and the foundry shown) and is left alone after that
{
  const w = world(), a = make(w); w.isao = true; w.base.load('sh02'); w.base.load('foundry');
  run(w, a, 1); w.base.errors.push('sh02-salvage: 404'); run(w, a, 0.1);
  assert.equal(a.state().phase, 'done'); assert.equal(w.shot(), null, 'no shot'); assert.deepEqual(w.log, [['foundry', 'deploy'], ['brief', 'arrival_talk']]);
  assert.equal(w.drone.obj.visible, true, 'Isao is shown');
  const w2 = world(), a2 = make(w2); w2.isao = true;
  run(w2, a2, STORY_ARRIVAL.wait + 0.2); assert.equal(a2.state().phase, 'done', `given up after ${STORY_ARRIVAL.wait} s`); assert.equal(w2.beats.deploys(), 1);
  w2.base.load('sh02'); w2.base.load('sh02-salvage'); run(w2, a2, 0.1);
  assert.equal(vis(w2, 'sh02'), false, 'a rocket that loads after the release does not stand next to its own salvage'); assert.equal(vis(w2, 'sh02-salvage'), true);
  w2.base.conceal('sh02-salvage'); run(w2, a2, 0.5); assert.equal(vis(w2, 'sh02-salvage'), false, 'once: a later conceal (a burn) stands');
  w2.base.load('foundry'); run(w2, a2, 0.1); assert.equal(vis(w2, 'foundry'), true);
}
console.log(`Arrival: waits for the rocket, its salvage, the foundry and Isao; lands; swaps on the cut to his face; ${talk.toFixed(1)} s of lines; skips and give-ups land on the same end state.`);
