import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { holeFrame, divePose, risePose, measureDoor, createHoleDoor } from '../src/fx/hole-door.js';
import { createDescentHost } from '../src/fx/descent-host.js';
import { DESCENT } from '../src/content/descent.js';

// THE HOLE IS THE DOOR (owner, 2026-10-26, note 7: "both the entrance to the Cave and when coming out should read as exactly the same sinkhole where the
// Boss fight took place"): the dive ends under the lip looking down the hole's axis, the rise ends at the rim; both on one cell and one axis
const cs = 0.004, center = [0.3, 0.8, 0.52], from = new THREE.Vector3(0.31, 0.83, 0.5).normalize().multiplyScalar(1.03);
const f = holeFrame(center, cs, from), out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }, T = DESCENT.door;
assert.ok(Math.abs(f.n.length() - 1) < 1e-12 && f.n.distanceTo(new THREE.Vector3(...center).normalize()) < 1e-12, 'the axis is the hole\'s radial');
{ const m = measureDoor(f, f.rim.pos, f.rim.quat); assert.ok(m.fromRim <= 2 && m.fromRim > 0.5, `the rim view within 2 cells of the rim (${m.fromRim})`); }
divePose(f, 0, DESCENT.lookHold, out); assert.ok(out.pos.distanceTo(f.rim.pos) < 1e-12, 'the dive starts at the rim view');
let fovK = divePose(f, DESCENT.lookHold * 0.7, DESCENT.lookHold, out); { const h = out.pos.clone().sub(f.c), side = h.clone().addScaledVector(f.n, -h.dot(f.n)).length(); assert.ok(side < 1e-9, `on the axis after the turn (${side})`); assert.ok(fovK < 1 && fovK > T.fov, 'narrowing'); }
fovK = divePose(f, DESCENT.lookHold, DESCENT.lookHold, out);
{ const m = measureDoor(f, out.pos, out.quat); assert.ok(Math.abs(m.fromCentre - T.under) < 1e-6, `under the lip, ${T.under} cells below the centre (${m.fromCentre})`); assert.ok(m.along > 0.999, `looking down -normal (${m.along})`);
  assert.ok(out.pos.clone().sub(f.c).dot(f.n) < 0, 'below the surface'); assert.ok(Math.abs(fovK - T.fov) < 1e-12, 'narrowed to the dark'); }
risePose(f, 0, out); { const m = measureDoor(f, out.pos, out.quat); assert.ok(Math.abs(m.fromCentre - T.under) < 1e-6 && m.along < -0.999, `the rise starts under the lip looking up at the sky (${JSON.stringify(m)})`); }
risePose(f, T.rise * 0.4, out); { const h = out.pos.clone().sub(f.c), side = h.clone().addScaledVector(f.n, -h.dot(f.n)).length(); assert.ok(side < 1e-9 && h.dot(f.n) > 0, 'up the same axis'); }
risePose(f, T.rise, out); { const m = measureDoor(f, out.pos, out.quat); assert.ok(out.pos.distanceTo(f.rim.pos) < 1e-12 && m.fromRim <= 2, `the rise ends at the rim view (${m.fromRim})`); }

// the host: the rim view while the brief is read, the dive once it is, the cave lookHold + settle later; the rise as the cave goes; the door measured
{
  const shots = [], camera = new THREE.PerspectiveCamera(50); camera.position.copy(from);
  let shot = null, t = 0, paused = false, briefing = 'descent_brief';
  const startShot = (s) => { if (shot?.onEnd) shot.onEnd(); shot = s; shots.push(s.id); };
  const door = createHoleDoor({ camera, startShot, cellSide: () => cs, centers: () => [center] });
  const frames = [];
  globalThis.document = { createElement: () => { const el = { hidden: false, posted: [], setAttribute() {}, remove() { el.removed = true; } }; el.contentWindow = { postMessage: (m) => el.posted.push(m) }; frames.push(el); return el; } };
  let listener = null; globalThis.addEventListener = (type, fn) => { if (type === 'message') listener = fn; }; globalThis.removeEventListener = () => { listener = null; };
  const story = { arena: { cell: 0 } }, calls = [];
  let held = false, wallT = 100;
  const host = createDescentHost({ appendChild() {} }, { hold: (v) => { paused = held = v; }, wall: () => wallT, showBrief: () => {}, speak: () => {}, story: () => story, mobile: false, t: () => t, briefing: () => briefing,
    look: (ci) => { calls.push('look'); door.look(ci); }, dive: (ci, s) => { calls.push('dive'); door.dive(ci, s); }, rise: (ci) => { calls.push('rise'); door.rise(ci); }, door: (ci) => door.measure(ci) });
  const timers = []; globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; }; globalThis.clearTimeout = () => {};
  const run = () => { const fns = timers.splice(0); for (const fn of fns) fn(); };
  const pose = (secs) => { const o = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; shot.poseAt(Math.min(1, secs / shot.dur), o); camera.position.copy(o.pos); camera.quaternion.copy(o.quat); };
  let ended = false;
  host.begin(() => { ended = true; }); run();
  // THE CAVE LOADS BEHIND A STILL GAME (2026-11-02, note 10): the glide to the rim view live, then the game held still and only then the cave's frame
  assert.deepEqual(calls, ['look'], 'the rim view first'); assert.equal(frames.length, 0, 'no cave while the camera glides'); assert.equal(held, false);
  t = DESCENT.still; run(); assert.equal(held, true, 'the glide done: the game stands still'); assert.equal(frames.length, 1, 'the cave starts loading under the still frame');
  assert.equal(frames[0].hidden, true); assert.equal(host.state().phase, 'load');
  wallT += 5; run(); assert.equal(host.state().phase, 'load', 'not ready, the brief on the panel: still'); assert.deepEqual(calls, ['look']);
  listener({ data: { belowReady: true }, source: {} }); assert.equal(host.state().readyAt, null, 'a ready from another window is nothing');
  wallT += 3; listener({ data: { belowReady: true }, source: frames[0].contentWindow }); assert.equal(host.state().readyAt, 8, 'the cave ready 8 s into the load');
  run(); assert.equal(host.state().phase, 'load', 'ready, but Isao still speaking'); assert.equal(held, true);
  briefing = null; wallT += 1; run();
  assert.equal(held, false, 'ready and read: the game runs for the dive'); assert.equal(host.state().loadedIn, 9);
  assert.deepEqual(calls, ['look', 'dive'], 'the brief read: the dive'); assert.equal(host.state().shown, false, 'the cave waits for the dive');
  const t1 = t; t = t1 + DESCENT.lookHold; pose(DESCENT.lookHold); run(); assert.equal(host.state().shown, false, 'and the settle');
  t = t1 + DESCENT.lookHold + T.settle; run(); assert.equal(host.state().shown, true, 'then the cave'); assert.equal(paused, true); assert.equal(held, true, 'nothing drawn behind the cave');
  assert.deepEqual(frames[0].posted, [{ belowShow: true }], 'the cave told it is shown');
  { const m = host.state().door; assert.ok(m.fromCentre < 2 && m.along > 0.9, `the hand-over: within 2 cells of the hole's centre, looking along -normal (${JSON.stringify(m)})`); assert.ok(camera.fov < 50, 'the view narrowed'); }
  host.report('rescued'); assert.deepEqual(calls, ['look', 'dive', 'rise'], 'out the same way'); assert.equal(paused, false); assert.equal(held, false); assert.equal(camera.fov, 50, 'the fov back');
  pose(T.rise); { const m = host.state().door; assert.ok(m.fromRim < 2, `the return: within 2 cells of the rim (${JSON.stringify(m)})`); }
  run(); assert.equal(ended, true, 'then the ending');
  assert.deepEqual(shots, ['descentLook', 'descentLook', 'descentLook']);
  // a cave that never says it is ready: the game runs again after DESCENT.readyCap real seconds
  t = 0; briefing = null; host.begin(() => {}); run(); t = DESCENT.still; run(); assert.equal(host.state().phase, 'load');
  wallT += DESCENT.readyCap - 0.1; run(); assert.equal(host.state().phase, 'load'); wallT += 0.2; run(); assert.equal(host.state().phase, 'dive', 'the ready cap');
  host.dispose(); delete globalThis.addEventListener; delete globalThis.removeEventListener;
  delete globalThis.document;
}
// ONE PLACE (owner, 2026-11-05, round 5 note 10; src/domain/descent-handoff.js): the cave asks and is answered with the dive's last pose in hole units (half a hole
// radius down the axis, looking down it, the view narrowed), the sky and the carcass; the show covers the cave with the game's last frame until the cave says it
// has drawn; the outcome's pose is where the rise starts, the cave's still fading out over the game
{
  const shots = [], camera = new THREE.PerspectiveCamera(50); camera.position.copy(from);
  let shot = null, t = 0, briefing = null;
  const startShot = (s) => { if (shot?.onEnd) shot.onEnd(); shot = s; shots.push(s.id); };
  const sky = { daylight: 0.25, bg: 0x0b1524, stars: 0.8, hemi: [0xc8cfe0, 0x555060] }, carcass = { chain: { core: [0, 0, 0], coreRadii: [1, 1, 1], limbs: [{ limb: 0, points: [[0, 0, 0], [1, 0, 0]], radii: [[1, 0.1]] }] }, C: { chain: {} }, toWorld: new THREE.Matrix4().makeTranslation(...center).toArray(), tone: 0.3, moved: [], char: [], gone: [] };
  const lastCanvas = { width: 4, height: 3, getContext: () => ({}) };
  const door = createHoleDoor({ camera, startShot, cellSide: () => cs, centers: () => [center], heart: () => [0, 1, 0], sky: () => sky, carcass: () => carcass, still: () => lastCanvas });
  const frames = [], added = [], root = { appendChild: (el) => added.push(el), querySelectorAll: () => added.filter((el) => el.className === 'descent-fade' && !el.removed) };
  globalThis.document = { createElement: (tag) => { const el = { tag, hidden: false, posted: [], style: {}, setAttribute() {}, remove() { el.removed = true; }, getContext: () => ({ drawImage() {} }) }; el.contentWindow = { postMessage: (m) => el.posted.push(m) }; if (tag === 'iframe') frames.push(el); return el; } };
  globalThis.Image = class { style = {}; remove() { this.removed = true; } decode() { return Promise.resolve(); } };
  globalThis.requestAnimationFrame = (fn) => fn();
  let listener = null; globalThis.addEventListener = (type, fn) => { if (type === 'message') listener = fn; }; globalThis.removeEventListener = () => { listener = null; };
  const story = { arena: { cell: 0 } }, risen = [];
  let wallT = 0;
  const host = createDescentHost(root, { hold: () => {}, wall: () => wallT, showBrief: () => {}, speak: () => {}, story: () => story, mobile: false, t: () => t, briefing: () => briefing,
    look: (ci) => door.look(ci), dive: (ci, s) => door.dive(ci, s), rise: (ci, p) => { risen.push(p); door.rise(ci, p); }, door: (ci) => door.measure(ci), handoff: (ci) => door.handoff(ci), still: () => door.still() });
  const timers = []; globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; }; globalThis.clearTimeout = () => {};
  const run = () => { const fns = timers.splice(0); for (const fn of fns) fn(); };
  host.begin(() => {}); run(); t = DESCENT.still; run();
  const win = frames[0].contentWindow;
  listener({ data: { belowAsk: true }, source: {} }); assert.equal(frames[0].posted.length, 0, 'another window\'s ask is nothing');
  listener({ data: { belowAsk: true }, source: win });
  const h = frames[0].posted[0]?.belowHandoff;
  assert.ok(h && Math.abs(h.pose.pos[1] + T.under / 3) < 1e-9 && Math.hypot(h.pose.pos[0], h.pose.pos[2]) < 1e-9, `answered with the dive's last pose: ${T.under / 3} hole radii down the axis (${h?.pose.pos})`);
  assert.ok(h.pose.fwd[1] < -0.999 && Math.abs(h.pose.fov - 50 * T.fov) < 1e-9, `looking down the axis, the view narrowed (${h.pose.fwd}, ${h.pose.fov})`);
  assert.deepEqual(h.sky, sky); assert.ok(h.carcass && h.carcass.toHole.length === 16 && !h.carcass.toWorld, 'the carcass in hole units'); assert.equal(h.radius, 30, 'metres a hole unit');
  assert.ok(host.state().handoff?.carcass?.limbs === 1, 'the harness sees what was answered');
  listener({ data: { belowReady: true }, source: win }); run();
  const t1 = t; t = t1 + DESCENT.lookHold + T.settle; run(); assert.equal(host.state().shown, true);
  const show = frames[0].posted.at(-1); assert.ok(show.belowShow && show.sky === sky && Math.abs(show.pose.pos[1] + T.under / 3) < 1e-9, `the show carries the sky now and the pose (${JSON.stringify(show)})`);
  let fades = host.state().fades; assert.equal(fades.length, 1); assert.equal(fades[0].kind, 'in'); assert.equal(fades[0].fading, null, 'the game\'s last frame covers the cave');
  assert.equal(added.filter((el) => el.className === 'descent-fade').length, 1, 'one cover over the page');
  listener({ data: { belowShown: true }, source: win }); fades = host.state().fades; assert.ok(fades[0].fading != null, 'the cave has drawn: the cover fades');
  run(); assert.ok(host.state().fades[0].gone != null, `gone after ${DESCENT.fade} s`);
  const back = { pos: [0, -0.55, 0], fwd: [0, 1, 0], up: [0, 0, -1], fov: 72 };
  listener({ data: { below: 'sacrifice', pose: back, still: 'data:image/jpeg;base64,AA' }, source: win });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(risen, [back], 'the rise from the cave\'s last pose'); assert.deepEqual(host.state().risenFrom, back); assert.equal(host.state().open, false, 'the frame gone');
  fades = host.state().fades; assert.equal(fades[1]?.kind, 'out', 'the cave\'s still over the game'); assert.ok(fades[1].fading != null, 'fading once the game has drawn');
  const o = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() }; shot.poseAt(0, o); camera.position.copy(o.pos); camera.quaternion.copy(o.quat);
  { const m = door.measure(0); assert.ok(Math.abs(m.fromCentre - 0.55 * 3) < 1e-6 && m.along < -0.999, `the rise starts at the cave's pose: 0.55 hole radii down, looking up (${JSON.stringify(m)})`); }
  assert.ok(Math.abs(camera.fov - 72) < 1e-6, `the cave's fov first (${camera.fov})`); shot.poseAt(T.rise / shot.dur, o); assert.ok(Math.abs(camera.fov - 50) < 1e-6, 'then the game\'s');
  host.dispose(); delete globalThis.addEventListener; delete globalThis.removeEventListener; delete globalThis.document; delete globalThis.Image; delete globalThis.requestAnimationFrame;
}
console.log('Hole door: the rim view, the dive down the hole\'s axis to under the lip (the view narrowing), the rise back to the rim; the host dives once the brief is read and rises as the cave goes; the handoff in hole units, the cross-fades, the rise from the cave\'s pose.');
