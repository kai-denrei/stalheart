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
console.log('Hole door: the rim view, the dive down the hole\'s axis to under the lip (the view narrowing), the rise back to the rim; the host dives once the brief is read and rises as the cave goes.');
