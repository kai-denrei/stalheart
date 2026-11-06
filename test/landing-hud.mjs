// landing-hud.mjs — the panel reads what the flight model says, in the HUD's words (src/fx/landing-hud.js) over a small fake DOM tree
import assert from 'node:assert/strict';
import { LANDING_GAME } from '../src/content/landing-game.js';

// a minimal document: a real tree (append, remove, replaceChildren), querySelector by '#id', classList, textContent, style, hidden, listeners
function node(tag) {
  const el = {
    tag, id: '', className: '', hidden: false, textContent: '', style: {}, dataset: {}, attrs: {}, children: [], parent: null, handlers: {},
    setAttribute(k, v) { el.attrs[k] = v; },
    append(...c) { for (const n of c) { n.parent = el; el.children.push(n); } },
    appendChild(n) { el.append(n); return n; },
    replaceChildren(...c) { for (const n of el.children) n.parent = null; el.children = []; el.append(...c); },
    remove() { if (el.parent) el.parent.children = el.parent.children.filter((n) => n !== el); el.parent = null; },
    addEventListener(t, f) { (el.handlers[t] ||= []).push(f); },
    querySelector(q) {
      const id = q.startsWith('#') ? q.slice(1) : null;
      for (const c of el.children) { if (id !== null && c.id === id) return c; const r = c.querySelector(q); if (r) return r; }
      return null;
    },
  };
  const names = () => new Set(el.className.split(/\s+/).filter(Boolean));
  const put = (s) => { el.className = [...s].join(' '); };
  el.classList = {
    add: (c) => put(names().add(c)), remove: (c) => { const s = names(); s.delete(c); put(s); }, contains: (c) => names().has(c),
    toggle: (c, v) => { const s = names(), on = v ?? !s.has(c); on ? s.add(c) : s.delete(c); put(s); return on; },
  };
  return el;
}
globalThis.document = { createElement: node };
const { createLandingHud } = await import('../src/fx/landing-hud.js');

const root = node('div');
const hud = createLandingHud(root);
hud.show(true); assert.ok(root.querySelector('#landing-hud'), 'the panel is in the root'); assert.equal(root.querySelector('#landing-hud').hidden, false);
hud.show(false); assert.equal(root.querySelector('#landing-hud').hidden, true, 'show(false) hides it'); hud.show(true);
hud.set({ altitude: 123.4, sink: 7.6, driftAlong: 2.1, driftAcross: 0, tilt: 0.1, tw: 2.5, hStop: 40, fuel: 12.3, legs: 0, phase: 'manual' });
assert.equal(root.querySelector('#lh-alt').textContent, '123'); assert.equal(root.querySelector('#lh-sink').textContent, '7.6');
assert.equal(root.querySelector('#lh-fuel').textContent, '12'); assert.equal(root.querySelector('#lh-stop').textContent, '40');
assert.ok(root.querySelector('#lh-sink').classList.contains('hot'), 'a sink over HARD reads hot');
hud.annunciate('AUTO-LAND FAULT · MANUAL OVERRIDE', 'alarm'); assert.equal(root.querySelector('#lh-ann').textContent, 'AUTO-LAND FAULT · MANUAL OVERRIDE');
assert.ok(root.querySelector('#lh-ann').classList.contains('alarm'), 'the alarm kind is a class');
hud.verdict({ grade: 'HARD', reason: 'sink', sink: 4.2, drift: 1, tilt: 0.03 }); assert.ok(root.querySelector('#lh-verdict').textContent.includes('HARD') && root.querySelector('#lh-verdict').textContent.includes('SINK 4.2'));
hud.offer(true, 'SPACE'); assert.ok(root.querySelector('#lh-offer').textContent.includes('SPACE')); assert.equal(root.querySelector('#lh-offer').hidden, false);
hud.offer(false); assert.equal(root.querySelector('#lh-offer').hidden, true);

// the rest of the readings: calm numbers are not hot, the drift reads with its arrow, legs by their fraction, tilt in degrees
hud.set({ altitude: 50, sink: 1.2, driftAlong: -1, driftAcross: 0, tilt: 0.05, tw: 1.5, hStop: 10, fuel: 30, legs: 0.5, phase: 'manual' });
assert.ok(!root.querySelector('#lh-sink').classList.contains('hot'), 'a gentle sink is not hot');
assert.equal(root.querySelector('#lh-drift').textContent, '← 1.0'); assert.equal(root.querySelector('#lh-tilt').textContent, '2.9'); assert.equal(root.querySelector('#lh-tw').textContent, '1.50');
assert.equal(root.querySelector('#lh-legs').textContent, 'LEGS 50%');
hud.set({ altitude: 5, sink: 1, driftAlong: 5, driftAcross: 0, tilt: 0, tw: 1, hStop: 20, fuel: 1, legs: 1, phase: 'manual' });
assert.ok(root.querySelector('#lh-stop').classList.contains('hot'), 'a stopping distance past the altitude reads hot'); assert.ok(root.querySelector('#lh-drift').classList.contains('hot'), 'a drift over HARD reads hot');
assert.equal(root.querySelector('#lh-legs').textContent, 'LEGS DOWN'); assert.ok(root.querySelector('#lh-legs').classList.contains('ok'));
assert.equal(LANDING_GAME.verdict.hard.sink, 6, 'the hot lines are the verdict\'s own');

// clear(): a new flight starts with no verdict and no annunciation left from an earlier one (Task 7, 2026-11-07)
hud.clear(); assert.equal(root.querySelector('#lh-verdict').textContent, ''); assert.equal(root.querySelector('#lh-verdict').className, 'lh-verdict');
assert.equal(root.querySelector('#lh-ann').textContent, ''); assert.equal(root.querySelector('#lh-ann').className, 'lh-ann');

// the touch rail: five controls, the buttons call their handlers, the slider is the throttle
const got = [];
hud.touch(true, { tilt: (d) => got.push(['tilt', d]), legs: () => got.push(['legs']), skip: () => got.push(['skip']), throttle: (v) => got.push(['throttle', v]) });
const rail = root.querySelector('#lh-touch'); assert.equal(rail.hidden, false); assert.equal(rail.children.length, 5);
const btn = (cls) => rail.children.find((c) => c.className.includes(cls));
btn('tilt-fwd').handlers.pointerdown[0]({ preventDefault() {} }); btn('tilt-fwd').handlers.pointerup[0]();
btn('legs').handlers.pointerdown[0]({ preventDefault() {} }); btn('skip').handlers.pointerdown[0]({ preventDefault() {} });
const slider = rail.children.find((c) => c.className.includes('lh-throttle')); slider.value = '50'; slider.handlers.input[0]();
assert.deepEqual(got, [['tilt', 1], ['tilt', 0], ['legs'], ['skip'], ['throttle', 0.5]]);
hud.touch(false); assert.equal(rail.hidden, true); assert.equal(rail.children.length, 0);

hud.dispose(); assert.equal(root.querySelector('#landing-hud'), null);
// no root, no document: an inert panel that never throws
const inert = createLandingHud(null); inert.show(true); inert.set({}); inert.clear(); inert.dispose();
console.log('landing-hud: ok');
