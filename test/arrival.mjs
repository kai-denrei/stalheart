// THE ARRIVAL'S HANDS (src/fx/arrival.js) on a recording host: the real module and real three.js nodes, the base, the beats and the
// controller faked. What a browser run cannot reach on demand is here: the waits for each landmark, the cut, both ends, the skips,
// and the fallback when a model never comes. The pictures themselves are --grow's.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createArrival } from '../src/fx/arrival.js';
import { STORY_ARRIVAL } from '../src/content/story-defaults.js';
import { BRIEFS, lineDwell } from '../src/isaobriefs.js';
import { LANDING_GAME } from '../src/content/landing-game.js';

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
const talk = BRIEFS[STORY_ARRIVAL.talk.brief].lines.reduce((sum, _, i) => sum + lineDwell(BRIEFS[STORY_ARRIVAL.talk.brief], i), 0);   // the close-up holds every line

// OFF: a page that does not start the story plays nothing, whatever loads
{
  const w = world(), a = make(w, false); w.isao = true; for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
  run(w, a, 2); assert.equal(a.state().phase, 'off'); assert.deepEqual(w.log, []); assert.equal(vis(w, 'sh02'), true, 'the rocket stands as it loaded');
}
// PAST THE LANDING (a tutorial chapter's page, 2026-09-25): no shot, no line, no deploy, and the rocket is its salvage and the foundry
// from the frame each landmark loads, whenever that is
{
  const w = world(), a = createArrival({ on: false, past: true, base: w.base, beats: w.beats, site, metres: METRES }); w.isao = true;
  w.base.load('sh02-salvage'); run(w, a, 0.5); assert.equal(vis(w, 'sh02-salvage'), true, 'the salvage shows the frame it loads');
  w.base.load('sh02'); run(w, a, 1 / 60); assert.equal(vis(w, 'sh02'), false, 'the intact rocket is hidden the frame it loads');
  run(w, a, 3); w.base.load('foundry'); run(w, a, 1 / 60); assert.equal(vis(w, 'foundry'), true, 'and the foundry, however late');
  assert.deepEqual(w.log, [], 'no shot, no line, no foundry deploy'); assert.equal(w.beats.deploys(), 0, 'the beats are not released: they started past it');
  assert.equal(a.state().phase, 'done'); assert.equal(a.state().on, false);
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
// THE LANDING FLOWN, the skip pays no grade (2026-11-07, the final review; the owner's call 1: the grade is for a flown landing): a skip
// mid-flight is graded CLEAN for the record but the foundry is left as today (no salvage call: no CLEAN bonus barrel for Esc), the talk the
// plain one; a flown contact (no input: a WRECK) does set the salvage. The flight shot passes no keys (the host takes the flight keys), Esc skips it
{
  const fly = () => {
    const w = world(), salvaged = [], shots = []; w.beats.salvage = (x) => salvaged.push(x);
    const start = w.api.startShot; w.api.startShot = (sh) => { shots.push(sh); start(sh); };
    const a = createArrival({ on: true, base: w.base, beats: w.beats, site, metres: METRES, manual: true }); w.isao = true;
    for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
    for (let i = 0; i < 60 * 20 && !a.state().landing; i++) w.frame(1 / 60, a);
    return { w, a, salvaged, shots };
  };
  { const { w, a, salvaged, shots } = fly(); assert.ok(a.state().landing, 'the override began');
    const flight = shots.at(-1); assert.deepEqual([flight.id, flight.passKeys, flight.skipKey], ['arrivalFlight', false, 'Escape'], 'the flight shot eats what the host does not take; Esc skips');
    assert.equal(a.landing('skip'), true); run(w, a, 0.1);
    assert.deepEqual([a.state().landing.grade, a.state().landing.reason], ['CLEAN', 'skipped']); assert.deepEqual(salvaged, [], 'a skip pays no salvage');
    const rail = shots.at(-1); assert.deepEqual([rail.id, rail.skipKey, rail.lockFor], ['arrival', 'Escape', LANDING_GAME.touchdown.lockSeconds], 'the resumed rail: locked, then Esc (a tap on a phone)');
    run(w, a, 30); assert.equal(a.state().talkBrief, 'arrival_talk', 'the plain talk'); assert.ok(w.log.some(([k, id]) => k === 'brief' && id === 'arrival_talk')); }
  { const { w, a, salvaged } = fly();
    for (let i = 0; i < 60 * 40 && a.state().phase === 'landing' && a.state().landing?.phase !== 'done'; i++) w.frame(1 / 60, a);
    assert.equal(a.state().landing.grade, 'CRASH', `no input is a CRASH, the total crash (${JSON.stringify(a.state().landing)})`); assert.deepEqual(salvaged, [], 'a crash pays no salvage'); }
}
// THE CRASH IS GAME OVER (owner, 2026-11-12): no input falls ~33 m/s into a CRASH; the run stops at the wreck (the arrival never finishes, no salvage,
// no talk, the beats' Rotor never released), the flight shot is replaced by one nothing skips, Esc included; FLY IT AGAIN restarts the same entry
{
  const fly = () => {
    const w = world(), salvaged = [], shots = []; w.beats.salvage = (x) => salvaged.push(x);
    const start = w.api.startShot; w.api.startShot = (sh) => { shots.push(sh); start(sh); };
    const a = createArrival({ on: true, base: w.base, beats: w.beats, site, metres: METRES, manual: true }); w.isao = true;
    for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
    for (let i = 0; i < 60 * 20 && !a.state().landing; i++) w.frame(1 / 60, a);
    return { w, a, salvaged, shots };
  };
  const { w, a, salvaged, shots } = fly(), entryAlt = a.state().landing.altitude;
  for (let i = 0; i < 60 * 40 && !a.state().lost; i++) w.frame(1 / 60, a);
  const g = a.state().landing; assert.deepEqual([g.grade, g.reason], ['CRASH', 'sink'], `the crash names its reason (${JSON.stringify(g)})`); assert.ok(g.sink > LANDING_GAME.crash.sink, 'faster than the crash line');
  assert.equal(a.state().lost, true); assert.equal(a.state().phase, 'landing', 'the arrival does not finish'); assert.deepEqual(salvaged, [], 'no salvage');
  const lost = shots.at(-1); assert.deepEqual([lost.id, lost.skippable, lost.skipKey, lost.passKeys], ['arrivalLost', true, null, false], 'a shot that eats every key and cannot be skipped');
  assert.ok(lost.lockFor > 1e6, 'its lock never ends: no key or tap skips it');
  run(w, a, 60); assert.equal(a.state().phase, 'landing', 'a minute on: the story did not proceed'); assert.equal(w.beats.deploys(), 0, 'the foundry never deployed'); assert.equal(vis(w, 'sh02'), true, 'the wreck stands');
  assert.ok(!w.log.some(([k, id]) => k === 'brief' && /^arrival_talk/.test(id)), 'no Isao talk'); assert.equal(a.landing('skip'), false, 'the harness skip is not a crash\'s way out');
  assert.equal(a.landing('again'), true, 'FLY IT AGAIN');
  const f = a.state().landing; assert.deepEqual([a.state().lost, f.phase, f.grade, f.throttle], [false, 'override', null, 1], `the flight restarted at its override (${JSON.stringify(f)})`);
  assert.ok(Math.abs(f.altitude - entryAlt) < 5, `from its entry again (${f.altitude} against ${entryAlt})`); assert.equal(shots.at(-1).id, 'arrivalFlight', 'the flight shot is back'); assert.equal(a.landing('again'), false, 'nothing to retry in flight');
  assert.equal(shots.at(-1).skipKey, 'Escape', 'and Esc skips a flight again');
  for (let i = 0; i < 60 * 40 && !a.state().lost; i++) w.frame(1 / 60, a); assert.equal(a.state().landing.grade, 'CRASH', 'a second no-input flight crashes again');
  // a skip is not a crash: Esc mid-flight is CLEAN · skipped as before (the tests above), and nothing of the card
  const s = fly(); assert.equal(s.a.landing('skip'), true); run(s.w, s.a, 0.1); assert.equal(s.a.state().lost, false); assert.equal(s.a.state().landing.reason, 'skipped');
}
console.log('arrival: crash ok');
// THE HAND-OVER IN MOTION (spec 14 C): a flown landing starts no orbit rail (the flight shot from start(), the rocket hidden until the override);
// the flight waits for the sky disk's aim (never longer than override.aimWait), begins with the boosters lit, and the physics run through the
// 1.5 s override at full throttle (the rocket sinking, the burn braking it, the arrival's clock held), then MANUAL
{
  const flown = (aimed) => {
    const w = world(), a = createArrival({ on: true, base: w.base, beats: w.beats, site, metres: METRES, manual: true }); w.isao = true;
    const scene = new THREE.Scene(), hole = new THREE.Group(); hole.name = 'sky-hole'; hole.userData.hole = { dir: [0.3, 0.2, -1] }; if (aimed) hole.userData.aimedFor = w.base; scene.add(hole); w.api.scene = scene;
    for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
    return { w, a, hole };
  };
  const shots = (w) => w.log.filter(([k]) => k === 'shot').map(([, id]) => id);
  { const { w, a, hole } = flown(false); run(w, a, 0.5);
    assert.equal(a.state().phase, 'landing'); assert.deepEqual(shots(w), ['arrivalFlight'], 'the flight shot at once: no orbit rail');
    assert.equal(a.state().landing, null, 'the flight waits for the disk aimed'); assert.equal(vis(w, 'sh02'), false, 'the rocket hidden until the override places it');
    hole.userData.aimedFor = {}; w.frame(1 / 60, a); assert.equal(a.state().landing, null, 'a stale world\'s stamp is not this base\'s aim');
    hole.userData.aimedFor = w.base; w.frame(1 / 60, a);
    const s0 = a.state().landing; assert.deepEqual([s0?.phase, s0?.throttle], ['override', 1], `the boosters lit on the first frame (${JSON.stringify(s0)})`);
    assert.equal(vis(w, 'sh02'), true, 'the rocket shown at the entry'); assert.ok(a.state().aimWait > 0.3 && a.state().aimWait < 0.6, `the wait reported (${a.state().aimWait})`);
    run(w, a, 0.5); const s1 = a.state().landing;
    assert.deepEqual([s1.phase, s1.throttle], ['override', 1], 'the auto-lander burns through the override'); assert.ok(s1.altitude < s0.altitude, 'the rocket sinking'); assert.ok(s1.sink < s0.sink, 'the burn brakes the sink');
    assert.equal(a.state().t, 0, 'the arrival\'s clock held');
    run(w, a, LANDING_GAME.override.seconds - 0.4); assert.equal(a.state().landing.phase, 'manual', 'MANUAL after override.seconds'); assert.deepEqual(shots(w), ['arrivalFlight'], 'one shot from start() to the flight'); }
  { const { w, a } = flown(false); run(w, a, LANDING_GAME.override.aimWait + 0.2); assert.equal(a.state().landing?.phase, 'override', 'a disk never aimed does not hold the flight past override.aimWait'); }
  { const { w, a } = flown(true); w.frame(1 / 60, a); w.frame(1 / 60, a); assert.equal(a.state().landing?.phase, 'override', 'aimed: the flight at once'); assert.equal(a.state().aimWait, 0); }
  // Esc on the flight shot before the override (the flight waiting on the aim) skips the whole arrival, ungraded: no flight to skip
  { const { w, a } = flown(false); run(w, a, 0.3); w.skip(); assert.equal(a.state().phase, 'done'); assert.equal(a.state().skipped, true); assert.equal(a.state().landing, null); }
}
// THE CROSS-FADE (spec 15 B): a fake signature (its clock, its opacity) handed in as startSignature. Aimed, the flight begins at seconds - blend
// under it, the intro on (the engine shot, eased out over the blend), the canvas fading to 0 at its end; not aimed, the signature holds its frame
// (its clock stopped at seconds - blend, opacity 1) until the flight begins; a skip during the blend ends it at once, the intro eases on; no
// signature, no intro
{
  const S = LANDING_GAME.signature, at = S.seconds - S.blend;
  const fakeSignature = () => {
    const log = { ticks: 0, opacity: [] };
    const factory = (root, o) => {
      let t = 0, done = false;
      const h = { log, tick(dt) { if (done) return; t += dt; log.ticks++; if (t >= o.seconds - 1e-9) h.dispose(); }, get done() { return done; }, get t() { return t; },
        fadeTo(x) { log.opacity.push(x); }, skip() { if (done) return; o.onSkip?.(); h.dispose(); }, dispose() { done = true; log.disposed = t; } };
      log.handle = h; return h;
    };
    return { factory, log };
  };
  const flown = ({ aimed = true, signature = true } = {}) => {
    const w = world(), sig = fakeSignature();
    const a = createArrival({ on: true, base: w.base, beats: w.beats, site, metres: METRES, manual: true, startSignature: signature ? sig.factory : (() => null) }); w.isao = true;
    const scene = new THREE.Scene(), hole = new THREE.Group(); hole.name = 'sky-hole'; hole.userData.hole = { dir: [0.3, 0.2, -1] }; if (aimed) hole.userData.aimedFor = w.base; scene.add(hole); w.api.scene = scene;
    for (const id of ['sh02', 'sh02-salvage', 'foundry']) w.base.load(id);
    w.frame(1 / 60, a);   // start(): the signature begins
    return { w, a, hole, sig: sig.log };
  };
  const dt = 1 / 60;
  // aimed: no flight before seconds - blend, the flight at it (the signature still playing, opaque), the intro from 0, the fade to 0 at its end
  { const { w, a, sig } = flown();
    assert.equal(a.state().signature, true, 'the signature plays');
    run(w, a, at - 0.1, dt); assert.equal(a.state().landing, null, `no flight before the blend (${sig.handle.t.toFixed(2)} s)`); assert.deepEqual(sig.opacity, [], 'no fade before it');
    run(w, a, 0.15, dt); const s0 = a.state().landing;
    assert.equal(s0?.phase, 'override', `the flight at seconds - blend (${sig.handle.t.toFixed(3)} s)`); assert.equal(a.state().signature, true, 'under the signature, which stands through the blend');
    assert.ok(Math.abs(sig.handle.t - at - 0.05) < 0.03, `the signature's clock about at the blend's start (${sig.handle.t.toFixed(3)})`);
    assert.ok(s0.intro > 0 && s0.intro < 0.1, `the intro starts with the flight (${s0.intro})`);
    { const feet = new THREE.Vector3().setFromMatrixPosition(w.base.structure('sh02').holder.matrix), d = w.goal.pos.distanceTo(feet) / METRES, fw = new THREE.Vector3(0, 0, -1).applyQuaternion(w.goal.quat);
      const bells = new THREE.Vector3(0, 1, 0).multiplyScalar(2 * 1.5 * METRES).add(feet).sub(w.goal.pos).normalize();   // the hull's bottom (SH02_WELL.bell x 1.5), the tilt ignored
      const I = LANDING_GAME.camera.intro, want = Math.hypot(I.back, I.up + 3); assert.ok(Math.abs(d - want) < 1, `the engine shot: the eye ~${want.toFixed(1)} m off the hull's feet (${d.toFixed(2)} m)`); assert.ok(fw.dot(bells) > 0.97, `looking at the engines (${fw.dot(bells).toFixed(3)})`); }
    assert.ok(sig.opacity.length > 0 && sig.opacity.at(-1) < 1 && sig.opacity.at(-1) > 0.9, `the canvas begins to fade (${sig.opacity.at(-1)})`);
    assert.equal(w.camera.fov, LANDING_GAME.camera.intro.fov, `the engine shot's lens, held (${w.camera.fov})`);
    { const H = LANDING_GAME.camera.intro.hold, eye = w.goal.pos.clone(); run(w, a, H - 0.2, dt);
      const feet = new THREE.Vector3().setFromMatrixPosition(w.base.structure('sh02').holder.matrix), d = w.goal.pos.distanceTo(feet) / METRES;
      assert.equal(w.camera.fov, LANDING_GAME.camera.intro.fov, 'still the engine shot\'s lens through the hold'); const I = LANDING_GAME.camera.intro, want = Math.hypot(I.back, I.up + 3); assert.ok(Math.abs(d - want) < 1, `the engine shot held on the falling hull (${d.toFixed(2)} m of ~${want.toFixed(1)})`);
      assert.ok(eye.distanceTo(w.goal.pos) / METRES > 10, 'riding down with it'); }
    run(w, a, S.blend / 2 - (LANDING_GAME.camera.intro.hold - 0.2), dt);
    assert.ok(Math.abs(sig.opacity.at(-1) - 0.5 ** 1.5) < 0.03, `(1 - u)^1.5 half way: ${(0.5 ** 1.5).toFixed(3)} (${sig.opacity.at(-1)})`); assert.ok(Math.abs(a.state().landing.intro - 0.5) < 0.05, `the intro half way (${a.state().landing.intro})`);
    assert.ok(w.camera.fov > LANDING_GAME.camera.intro.fov && w.camera.fov < LANDING_GAME.camera.fov, `pulling back half way (${w.camera.fov})`);
    for (let i = 1; i < sig.opacity.length; i++) assert.ok(sig.opacity[i] <= sig.opacity[i - 1] + 1e-12, 'the fade never climbs');
    run(w, a, S.blend / 2 + 0.05, dt);
    assert.equal(a.state().signature, false, 'the signature over at its end'); assert.ok(sig.disposed >= S.seconds - 1e-9, `it ran its whole clock (${sig.disposed})`);
    assert.ok(sig.opacity.at(-1) < 0.02, `the opacity reaches 0 at the end (${sig.opacity.at(-1)})`);
    assert.equal(a.state().landing.intro, 1, 'the side view holds once the blend is over'); assert.equal(a.state().landing.phase, 'manual', 'MANUAL came under the blend');
    assert.equal(w.camera.fov, LANDING_GAME.camera.fov, 'the side view\'s lens'); }
  // not aimed: the signature's clock stops at seconds - blend at opacity 1 (its last frame held) until the aim; then the blend runs its 2 s
  { const { w, a, hole, sig } = flown({ aimed: false });
    run(w, a, at + 1, dt);
    assert.equal(a.state().landing, null, 'the flight waits for the aim'); assert.ok(Math.abs(sig.handle.t - at) < 1e-9, `the signature held at the blend's start (${sig.handle.t})`);
    assert.deepEqual(sig.opacity, [], 'opaque while it holds'); assert.equal(a.state().signature, true, 'and still standing');
    assert.ok(a.state().aimWait > 0.9, `the wait counted from the blend's start (${a.state().aimWait})`);
    hole.userData.aimedFor = w.base; w.frame(dt, a); assert.equal(a.state().landing?.phase, 'override', 'aimed: the flight begins');
    run(w, a, S.blend - 0.1, dt); assert.equal(a.state().signature, true, 'the blend late, its whole length'); run(w, a, 0.15, dt); assert.equal(a.state().signature, false); assert.ok(sig.opacity.at(-1) < 0.02); }
  // never aimed: override.aimWait still bounds the hold
  { const { w, a } = flown({ aimed: false }); run(w, a, at + LANDING_GAME.override.aimWait + 0.1, dt); assert.equal(a.state().landing?.phase, 'override', 'the aim wait bounds the hold'); }
  // a skip during the blend: the signature ends at once, the intro goes on from where it is
  { const { w, a, sig } = flown(); run(w, a, at + 0.5, dt); const i0 = a.state().landing.intro;
    assert.equal(a.landing('skip'), 'signature', 'the harness skip ends the signature, not the flight'); assert.equal(a.state().signature, false); assert.ok(sig.disposed < S.seconds, 'at once');
    assert.equal(a.state().landing.phase, 'override', 'the flight goes on'); w.frame(dt, a); assert.ok(a.state().landing.intro > i0 && a.state().landing.intro < 1, `the intro eases on (${i0} > ${a.state().landing.intro})`);
    run(w, a, S.blend, dt); assert.equal(a.state().landing.intro, 1); }
  // a skip before the blend: the flight and the intro at once
  { const { w, a } = flown(); run(w, a, 1, dt); a.landing('skip'); w.frame(dt, a); const s = a.state().landing; assert.equal(s?.phase, 'override', 'the skip starts the flight'); assert.ok(s.intro < 0.05, `with its intro from the start (${s.intro})`); }
  // no signature (reduced motion, no WebGL2): no intro, the side view from the first frame
  { const { w, a } = flown({ signature: false }); w.frame(dt, a); assert.equal(a.state().signature, false); assert.equal(a.state().landing?.phase, 'override', 'the flight at once');
    assert.equal(a.state().landing.intro, 1, 'no intro'); assert.equal(w.camera.fov, LANDING_GAME.camera.fov, 'the side view\'s lens from the first frame'); }
}
console.log(`Arrival: waits for the rocket, its salvage, the foundry and Isao; lands; swaps on the cut to his face; ${talk.toFixed(1)} s of lines; skips and give-ups land on the same end state.`);
