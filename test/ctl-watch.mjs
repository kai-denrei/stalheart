// ctl-watch.mjs — the control watchdog (src/platform/ctl-watch.js, moved out of src/td-tab.js in refactor round 4): a hull asked to
// move and not moving for a second barks CTL-DEAD once with the gate row, re-armed only once it moves again; a drive key seen raw at
// the capture phase while the game's keys stay false barks CTL-SWALLOWED once; nothing while paused, won, or not asking.
import assert from 'node:assert/strict';
import { createCtlWatch, CTL_DRIVE_KEYS } from '../src/platform/ctl-watch.js';

const listeners = [];
globalThis.addEventListener = (type, fn, capture) => listeners.push({ type, fn, capture });
const logged = []; const realLog = console.log; console.log = (s) => logged.push(String(s));
try {
  const player = { pos: [0, 0, 1], won: false }, keys = { left: false, right: false, fast: false, slow: false };
  const S = { cruise: false, throttle: 0, paused: false };
  const w = createCtlWatch({ player, keys, cellSide: () => 0.08, cruise: () => S.cruise, throttle: () => S.throttle, paused: () => S.paused, state: (tag) => `ROW[${tag}]` });
  assert.equal(listeners.length, 1); assert.equal(listeners[0].type, 'keydown'); assert.equal(listeners[0].capture, true, 'the raw key listener sits at the capture phase');
  assert.deepEqual(CTL_DRIVE_KEYS, ['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);

  // not asking: nothing accumulates
  for (let i = 0; i < 20; i++) w.tick(0.1);
  assert.equal(w.stillFor(), 0); assert.deepEqual(logged, []);
  // asking (W held, the game sees it) and standing still: one bark after a second, with the row
  keys.fast = true;
  for (let i = 0; i < 9; i++) w.tick(0.1);
  assert.deepEqual(logged, [], 'under a second: quiet');
  w.tick(0.2); w.tick(0.2);
  assert.equal(logged.length, 1); assert.match(logged[0], /^CTL-DEAD asked 1\.[13]s, no motion — ROW\[dead\]$/);
  for (let i = 0; i < 30; i++) w.tick(0.1);
  assert.equal(logged.length, 1, 'one line per episode');
  // the hull moves: re-armed, the clock reset
  player.pos = [0.01, 0, 1]; w.tick(0.1);
  assert.equal(w.stillFor(), 0);
  for (let i = 0; i < 12; i++) w.tick(0.1);
  assert.equal(logged.length, 2, 'a second episode barks again');
  // hover bob is not motion
  logged.length = 0; player.pos = [0.01 + 1e-7, 0, 1];
  for (let i = 0; i < 12; i++) w.tick(0.1);
  assert.equal(logged.length, 0, 'a nudge under 1e-4 cells is not motion: the episode stays barked');
  // paused or won: the clock holds at zero
  logged.length = 0; S.paused = true; for (let i = 0; i < 15; i++) w.tick(0.1); assert.equal(w.stillFor(), 0); S.paused = false;
  player.won = true; for (let i = 0; i < 15; i++) w.tick(0.1); assert.equal(w.stillFor(), 0); player.won = false;
  assert.deepEqual(logged, []);
  // cruise or a throttle count as asking too
  keys.fast = false; player.pos = [0.015, 0, 1]; w.tick(0.1);   // moved: the next episode may bark
  S.cruise = true; for (let i = 0; i < 12; i++) w.tick(0.1); assert.equal(logged.length, 1, 'cruise counts as asking'); assert.match(logged[0], /^CTL-DEAD/);
  S.cruise = false; player.pos = [0.02, 0, 1]; w.tick(0.1); logged.length = 0;
  S.throttle = 0.5; for (let i = 0; i < 12; i++) w.tick(0.1); assert.equal(logged.length, 1); S.throttle = 0;
  // swallowed: a raw W at the capture phase, the game's keys all false, still asking through cruise
  player.pos = [0.03, 0, 1]; w.tick(0.1); logged.length = 0;
  listeners[0].fn({ key: 'W' }); assert.equal(w.raw().key, 'w', 'the raw key, lower-cased');
  S.cruise = true; w.tick(0.1);
  assert.equal(logged.length, 1); assert.match(logged[0], /^CTL-SWALLOWED raw 'w' pressed but keys are all false — something is eating keydown\. ROW\[swallowed\]$/);
  w.tick(0.1); assert.equal(logged.length, 1, 'once per episode');
  listeners[0].fn({ key: 'x' }); assert.equal(w.raw().key, 'w', 'a non-drive key is not recorded');
  S.cruise = false;
} finally { console.log = realLog; }
console.log('Control watchdog: CTL-DEAD after a second of asking, once per episode, re-armed by motion; CTL-SWALLOWED on a raw drive key the game never sees; quiet when paused, won or idle.');
