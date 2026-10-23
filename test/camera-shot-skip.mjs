// camera-shot-skip.mjs — a screenshot is not a skip (owner, 2026-10-23: "I could not take screenshots because any key press cancels the
// animation"): src/fx/camera-shot.js skipsOn(ev) and the shots' keydown path. A key with Cmd, Ctrl or Alt held, or a modifier key alone,
// lets a skippable shot run; every other key and every tap still skips it (the breach's own path included).
import assert from 'node:assert/strict';
import { skipsOn, createCameraShots } from '../src/fx/camera-shot.js';

// the predicate
for (const ev of [{ key: 'Meta' }, { key: 'Shift' }, { key: 'Control' }, { key: 'Alt' }, { key: 'CapsLock' }, { key: 'Fn' },
  { key: '4', metaKey: true, shiftKey: true }, { key: '5', metaKey: true, shiftKey: true }, { key: 'p', ctrlKey: true }, { key: 's', altKey: true }])
  assert.equal(skipsOn(ev), false, `no skip on ${JSON.stringify(ev)}`);
for (const ev of [{ key: 'a' }, { key: ' ' }, { key: 'Escape' }, { key: 'Enter' }, { key: 'F2' }, { key: 'A', shiftKey: true }])
  assert.equal(skipsOn(ev), true, `a skip on ${JSON.stringify(ev)}`);

// the shots' listeners, on a stub window (the module adds its keydown on the global, its taps on the target)
const listeners = {}, tapListeners = {};
globalThis.addEventListener = (type, fn) => { listeners[type] = fn; };
globalThis.removeEventListener = (type, fn) => { if (listeners[type] === fn) delete listeners[type]; };
const target = { addEventListener: (type, fn) => { tapListeners[type] = fn; }, removeEventListener: (type, fn) => { if (tapListeners[type] === fn) delete tapListeners[type]; } };
const shots = createCameraShots({ target, snap: () => {} });
const key = (o) => listeners.keydown?.({ preventDefault() {}, stopImmediatePropagation() {}, ...o });
for (const id of ['feidsDrop', 'breach']) {
  let ended = 0;
  shots.start({ id, dur: 10, poseAt: () => {}, onEnd: () => { ended++; } });
  key({ key: 'Meta', metaKey: true }); key({ key: 'Shift', metaKey: true, shiftKey: true }); key({ key: '4', metaKey: true, shiftKey: true });
  key({ key: 'Control', ctrlKey: true }); key({ key: 'Alt', altKey: true });
  assert.equal(shots.id(), id, `${id}: a screenshot chord leaves the shot running`); assert.equal(ended, 0);
  key({ key: 'k' });
  assert.equal(shots.id(), null, `${id}: a plain key skips`); assert.equal(ended, 1);
}
{ let ended = 0; shots.start({ id: 'feidsDrop', dur: 10, poseAt: () => {}, onEnd: () => { ended++; } });
  tapListeners.pointerdown({ target: {}, stopImmediatePropagation() {} }); assert.equal(ended, 1, 'a tap still skips'); }
console.log('camera-shot-skip: a screenshot chord or a lone modifier never skips a shot; a plain key and a tap do');

// THE MANDATORY FIVE SECONDS (owner, 2026-10-23, round 2): a shot started with lockFor and skipKey (the drop's cut) skips on nothing inside the lock,
// after it on its key alone, never on a tap; the gestures it does not obey are eaten (not passed to the game); other shots keep the rule above
{
  let ended = 0, eaten = 0;
  const ev = (o) => ({ preventDefault() {}, stopImmediatePropagation() { eaten++; }, ...o });
  shots.start({ id: 'feidsDrop', dur: 28, poseAt: () => {}, onEnd: () => { ended++; }, lockFor: 5, skipKey: ' ' });
  for (const t of [0.5, 2, 4.9]) {
    while (shots.shot.age < t) shots.step(0.1);
    for (const o of [{ key: 'k' }, { key: ' ' }, { key: 'Escape' }]) listeners.keydown(ev(o));
    tapListeners.pointerdown(ev({ target: {} }));
    assert.equal(shots.id(), 'feidsDrop', `inside the lock at ${shots.shot.age.toFixed(1)} s nothing skips`);
  }
  assert.equal(eaten, 12, 'the locked gestures are eaten');
  while (shots.shot.age < 5.2) shots.step(0.1);
  for (const o of [{ key: 'k' }, { key: 'Enter' }, { key: 'Spacebar' }]) listeners.keydown(ev(o));
  tapListeners.pointerdown(ev({ target: {} }));
  key({ key: '4', metaKey: true, shiftKey: true });
  assert.equal(shots.id(), 'feidsDrop', 'after the lock another key, a tap or a chord does not skip');
  assert.equal(ended, 0);
  listeners.keydown(ev({ key: ' ' }));
  assert.equal(shots.id(), null, 'after the lock Space skips'); assert.equal(ended, 1);
  assert.equal(listeners.keydown, undefined, 'the listeners go with the shot');
}
{ // a lock without a key: after it any key skips; a shot without either is unchanged (skips at once)
  let ended = 0;
  shots.start({ id: 'locked', dur: 10, poseAt: () => {}, onEnd: () => { ended++; }, lockFor: 1 });
  key({ key: 'k' }); assert.equal(shots.id(), 'locked', 'a plain lock holds');
  shots.step(1.05); key({ key: 'k' }); assert.equal(ended, 1, 'after a plain lock any key skips');
  shots.start({ id: 'arrival', dur: 10, poseAt: () => {}, onEnd: () => { ended++; } });
  tapListeners.pointerdown({ target: {}, stopImmediatePropagation() {} }); assert.equal(ended, 2, 'an unlocked shot skips on a tap at once');
}
console.log('camera-shot-skip: the drop\'s cut holds through its 5 s lock, then skips on Space alone; other shots unchanged');
