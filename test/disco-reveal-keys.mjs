// disco-reveal-keys.mjs — DAY 42's reveal is skipped by Escape only (owner, 2026-11-05, round 5 note 9: "driving the tank must not skip the
// party; only Esc skips"): the real shots (src/fx/camera-shot.js) with DAY_42.shot's skipKey/passKeys, a stub window that dispatches keydown to
// capture listeners first and bubble listeners after (stopImmediatePropagation honoured), and a stand-in for the tank's bubble keydown
// (src/platform/tank-input.js: Escape toggles the pause, W drives). W, A, S, D, the arrows, Q/E and Space reach the tank and leave the cut
// running; a tap is eaten and does not skip; Escape ends the cut and never reaches the tank's pause.
import assert from 'node:assert/strict';
import { createCameraShots } from '../src/fx/camera-shot.js';
import { DAY_42 } from '../src/content/day-42.js';

const L = [];
globalThis.addEventListener = (type, fn, capture = false) => { L.push({ type, fn, capture: !!capture }); };
globalThis.removeEventListener = (type, fn, capture = false) => { const i = L.findIndex((l) => l.type === type && l.fn === fn && l.capture === !!capture); if (i >= 0) L.splice(i, 1); };
const dispatch = (type, o) => {
  let stopped = false, prevented = false;
  const ev = { type, ...o, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } };
  for (const phase of [true, false]) for (const l of L.filter((x) => x.type === type && x.capture === phase)) { if (stopped) break; l.fn(ev); }
  return { stopped, prevented };
};
const tank = { keys: [], paused: false };
addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { tank.paused = !tank.paused; return; } tank.keys.push(ev.key); });   // the tank's own, registered at start-up, bubble
const taps = {}; const target = { addEventListener: (t, fn) => { taps[t] = fn; }, removeEventListener: (t, fn) => { if (taps[t] === fn) delete taps[t]; } };
const shots = createCameraShots({ target, snap: () => {} });

const S = DAY_42.shot;
assert.equal(S.skipKey, 'Escape', 'the reveal skips on Escape'); assert.equal(S.passKeys, true, 'every other key passes'); assert.equal(S.hint, 'ESC · SKIP');
let ended = 0;
shots.start({ id: S.id, dur: 14, poseAt: () => {}, onEnd: () => { ended++; }, skippable: true, skipKey: S.skipKey, passKeys: S.passKeys });
const drive = ['w', 'a', 's', 'd', 'ArrowUp', 'ArrowLeft', 'q', 'e', ' ', 'k'];
for (const t of [0.05, 3, 9]) {
  while (shots.shot.age < t) shots.step(0.05);
  for (const key of drive) { const r = dispatch('keydown', { key }); assert.equal(r.stopped, false, `${key} is not eaten`); assert.equal(r.prevented, false, `${key} keeps its default`); }
  let tapStopped = false; taps.pointerdown({ target: {}, stopImmediatePropagation() { tapStopped = true; } });
  assert.equal(tapStopped, true, 'a tap is eaten'); assert.equal(shots.id(), S.id, `at ${t} s the driving keys and a tap leave the reveal running`);
}
assert.deepEqual(tank.keys, [...drive, ...drive, ...drive], 'the tank got every driving key');
const esc = dispatch('keydown', { key: 'Escape' });
assert.equal(esc.stopped, true, 'Escape is the shot\'s'); assert.equal(shots.id(), null, 'Escape ends the reveal'); assert.equal(ended, 1);
assert.equal(tank.paused, false, 'Escape never reached the tank\'s pause');
assert.equal(L.filter((l) => l.capture).length, 0, 'the shot\'s listener went with it');
dispatch('keydown', { key: 'Escape' }); assert.equal(tank.paused, true, 'with no shot, Escape pauses as before');

// a shot without passKeys still eats what it does not obey (the drop's, the print close-ups')
tank.keys.length = 0;
shots.start({ id: 'feidsDrop', dur: 28, poseAt: () => {}, lockFor: 5, skipKey: ' ' });
assert.equal(dispatch('keydown', { key: 'w' }).stopped, true, 'the drop eats W'); assert.deepEqual(tank.keys, []); shots.drop();
console.log('disco-reveal-keys: the driving keys reach the tank under DAY 42\'s reveal, a tap is eaten, Escape alone skips and never pauses');
