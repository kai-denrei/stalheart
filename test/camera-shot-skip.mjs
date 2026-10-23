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
