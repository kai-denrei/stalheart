// story-scope.mjs — the Quiver scope's feed (src/fx/story-scope.js createScopeFeed) against a recording controller: nothing
// without a scope, the frame the reticle draws (the cone at the camera's field of view, the held body's point on the glass,
// the bearing off the barrel, rounds in flight), and TARGET LOCKED's cue once per lock.
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { createScopeFeed } from '../src/fx/story-scope.js';

globalThis.innerWidth = 1000; globalThis.innerHeight = 800;   // the feed reads the window, as the controller's did
const centers = [[0, 1, 0]], cellSide = 0.05;
function controller(o = {}, seekers = []) {
  const s = { frames: [], sounds: [], scope: { update: (f) => s.frames.push(f) }, pilot: { isMap: () => false, state: { zoom: 2 } }, story: { quiverCone: 0.1 }, ...o };
  const camera = new THREE.PerspectiveCamera(60, 1000 / 800, 0.001, 10); camera.position.set(0, 1.02, 0.08); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
  const feed = createScopeFeed({
    camera, sfx: { play: (n) => s.sounds.push(n) }, towerBarrel: () => [0, 0, -1], towerSeekers: seekers, missileOf: (key) => (key === 'quiver' ? { maxRange: 300, lockTime: 1.2 } : null),
    storyScope: () => s.scope, graph: () => ({ centers }), cellSide: () => cellSide, pilot: () => s.pilot, story: () => s.story,
  });
  return { s, feed };
}
const mount = (o = {}) => ({ key: 'quiver', ci: 0, lock: { locked: false, meter: 0.4 }, obj: { userData: {} }, overheated: false, cooldown: -0.5, ...o });

// NO SCOPE, NO FRAME
{
  const { s, feed } = controller({ scope: null });
  feed(mount(), null, 200); assert.deepEqual(s.frames, []); assert.deepEqual(s.sounds, []);
}
// THE FRAME: no target yet
{
  const { s, feed } = controller();
  const tw = mount(); feed(tw, null, 200);
  const f = s.frames[0];
  assert.deepEqual({ on: f.on, w: f.w, h: f.h, meter: f.meter, locked: f.locked, target: f.target, max: f.max, zoom: f.zoom, lockTime: f.lockTime, ready: f.ready, cooldown: f.cooldown, sx: f.sx, sy: f.sy },
    { on: true, w: 1000, h: 800, meter: 0.4, locked: false, target: null, max: 300, zoom: 2, lockTime: 1.2, ready: true, cooldown: 0, sx: null, sy: null });
  assert.ok(Math.abs(f.box - 400 * 0.1 / Math.tan(Math.PI / 6)) < 1e-9, 'the square is the cone at the field of view');
  assert.ok(Math.abs(f.cone - Math.atan(0.1) * 180 / Math.PI) < 1e-12);
  // a gun that is no guided mount draws nothing, and neither does the map
  feed(mount({ key: 'rotor' }), null, 200); assert.equal(s.frames[1].on, false); assert.equal(s.frames[1].max, 200, 'the mount\'s own range');
  s.pilot.isMap = () => true; feed(tw, null, 200); assert.equal(s.frames[2].on, false);
}
// A HELD BODY: its bearing off the barrel, its point on the glass, the rounds in flight; the lock's cue once per lock
{
  const tw = mount(), seekers = [{ by: tw }, { by: tw }, { by: null }], { s, feed } = controller({}, seekers);
  tw.pilotTarget = { id: 7, type: 'amoeba', pos: [0, 1, -0.05] };
  feed(tw, 123, 200);
  const f = s.frames.at(-1);
  assert.deepEqual(f.target, { id: 7, range: 123, bearing: 0, type: 'amoeba' }, 'dead ahead of the barrel');
  assert.equal(f.flight, 2, 'its own rounds in the air');
  assert.ok(Number.isFinite(f.sx) && Number.isFinite(f.sy), 'the held body is on the glass');
  tw.pilotTarget.pilotAim = true; feed(tw, 5, 200); assert.equal(s.frames.at(-1).target, null, 'the pilot\'s own aim point is no target');
  tw.lock.locked = true; feed(tw, 5, 200); feed(tw, 5, 200); tw.lock.locked = false; feed(tw, 5, 200); tw.lock.locked = true; feed(tw, 5, 200);
  assert.deepEqual(s.sounds, ['laser_click', 'laser_click'], 'TARGET LOCKED ticks once per lock');
}
console.log('Story scope feed: no scope, no frame; the cone, the held body on the glass and its bearing; one cue per lock.');
