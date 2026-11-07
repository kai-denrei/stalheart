// landing-stick.mjs — the floating stick's rates (src/fx/landing-stick.js stickRates): the dead zone, the full throw, the clamp, the axes' signs
import assert from 'node:assert/strict';
import { stickRates, createStick } from '../src/fx/landing-stick.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
const S = LANDING_GAME.input.stick, r = (dx, dy) => stickRates(dx, dy, S);
assert.deepEqual(r(0, 0), { tiltRate: 0, bankRate: 0 });
assert.deepEqual(r(4, -4), { tiltRate: 0, bankRate: 0 }, 'inside the dead zone');
assert.ok(Math.abs(r(48, 0).bankRate - 1) < 1e-12 && r(48, 0).tiltRate === 0, 'a full throw right is bank +1');
assert.ok(Math.abs(r(-48, 0).bankRate + 1) < 1e-12, 'left is -1');
assert.ok(Math.abs(r(0, -48).tiltRate - 1) < 1e-12, 'a drag UP is the nose forward, +1');
assert.ok(Math.abs(r(0, 48).tiltRate + 1) < 1e-12, 'down is back');
assert.ok(Math.abs(r(200, 0).bankRate - 1) < 1e-12, 'clamped past the full throw');
assert.ok(Math.abs(r(26.5, 0).bankRate - 0.5) < 1e-9, 'linear past the dead zone: (26.5 - 5) / 43');
// no DOM (node, or a missing root): an inert stick, its rates 0, reset and dispose no-ops
for (const root of [null, undefined, {}]) {
  const k = createStick(root, { ...S, enabled: () => true });
  assert.deepEqual([k.tiltRate, k.bankRate], [0, 0]); k.reset(); k.dispose();
}
// the press is heard in CAPTURE on the window (2026-11-07, the review: the shot's capture tap listener on #tab-td ate a bubbling one), and
// the stick never stops it; a press on a control is the control's, one pointer at a time, dispose removes the press listener
{
  const on = {}, made = [], saved = { addEventListener: globalThis.addEventListener, removeEventListener: globalThis.removeEventListener, document: globalThis.document };
  globalThis.addEventListener = (t, f, o) => { (on[t] ||= []).push({ f, o }); };
  globalThis.removeEventListener = (t, f) => { on[t] = (on[t] || []).filter((h) => h.f !== f); };
  const el = () => { const e = { style: {}, append() {}, remove() {} }; made.push(e); return e; };
  globalThis.document = { body: { addEventListener() {}, append() {} }, createElement: el };
  try {
    const k = createStick(globalThis.document.body, { ...S, enabled: () => true });
    assert.equal(on.pointerdown?.length, 1, 'the press listener is on the window'); assert.equal(on.pointerdown[0].o?.capture, true, 'in capture');
    let stopped = false; const ev = (id, x, y, target = { closest: () => null }) => ({ pointerId: id, clientX: x, clientY: y, target, preventDefault() {}, stopPropagation() { stopped = true; }, stopImmediatePropagation() { stopped = true; } });
    on.pointerdown[0].f(ev(1, 100, 100, { closest: (q) => (q.includes('button') ? {} : null) }));
    assert.equal(made.length, 0, 'a press on a button is the button\'s');
    on.pointerdown[0].f(ev(1, 100, 100)); assert.equal(made.length, 2, 'a press drops the ring and its knob');
    on.pointerdown[0].f(ev(2, 300, 300)); assert.equal(made.length, 2, 'one pointer at a time');
    on.pointermove[0].f(ev(1, 100, 52)); assert.ok(Math.abs(k.tiltRate - 1) < 1e-12 && k.bankRate === 0, 'a drag up 48 px is full forward');
    assert.equal(stopped, false, 'the stick never stops the event');
    on.pointerup[0].f(ev(1, 100, 52)); assert.deepEqual([k.tiltRate, k.bankRate], [0, 0], 'the release centres it');
    k.dispose(); assert.equal(on.pointerdown.length, 0, 'dispose removes the press listener');
  } finally { Object.assign(globalThis, saved); }
}
console.log('landing-stick: ok');
