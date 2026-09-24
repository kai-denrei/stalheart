// vars-modal.mjs — the VARS modal against a minimal DOM and lil-gui stand-in: the root controls become the game page, each
// folder its own page, a nav button per page; ?vars=1 and the lab open it; the lab page carries its knobs and opens on them;
// a page without the modal's markup still gets its lab folder.
import assert from 'node:assert/strict';
import { buildVarsModal } from '../src/fx/vars-modal.js';

function node(tag = 'div') {
  const classes = new Set(), listeners = {}, kids = [];
  return {
    tag, kids, listeners, style: {}, textContent: '', classes,
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c), contains: (c) => classes.has(c) },
    appendChild(c) { kids.push(c); return c; },
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    click() { for (const fn of listeners.click ?? []) fn(); },
    querySelectorAll(sel) { return kids.filter((k) => k.tag === sel); },
  };
}
function page({ markup = true, query = '', lab = { on: false } } = {}) {
  globalThis.document = { createElement: (tag) => node(tag), body: node('body') };
  const nav = node(), body = node(), close = node(), modal = node(), toggle = node();
  modal.classList.add('hidden');
  modal.querySelector = (s) => ({ '.vars-nav': nav, '.vars-body': body, '.vars-close': close })[s];
  const root = { querySelector: (s) => markup ? ({ '#td-vars': modal, '#vars-toggle': toggle })[s] : null };
  const control = (label) => ({ label, domElement: node(), name() { return this; }, onChange(fn) { this.change = fn; return this; }, onFinishChange(fn) { this.finish = fn; return this; }, updateDisplay() {} });
  const folder = (title) => ({ _title: title, domElement: node(), opened: false, controls: [], open() { this.opened = true; }, add(o, k) { const c = control(k); c.target = o; this.controls.push(c); return c; }, controllersRecursive() { return this.controls; } });
  const gui = { controllers: [control('seed'), control('fps readout')], folders: [folder('bloom'), folder('tank feel')], domElement: node(), addFolder(t) { const f = folder(t); this.folders.push(f); return f; } };
  const calls = [];
  buildVarsModal({ root, gui, lab, urlParams: new URLSearchParams(query), skySeed: 4242, gpuExt: null,
    applySky: () => calls.push(['sky', lab.galaxySeed]), spawnWave: () => calls.push(['wave']), postfx: { setEnabled: (v) => calls.push(['bloom', v]) },
    setPerfOverlay: (...a) => calls.push(['perf', ...a]) });
  return { nav, body, close, modal, toggle, gui, calls, doc: globalThis.document };
}
const active = (p) => p.nav.kids.findIndex((b) => b.classes.has('active'));

// THE PAGES: the root controls on the game page, then a page per folder, one button each, the game page shown, the modal unhidden
{
  const p = page();
  assert.deepEqual(p.nav.kids.map((b) => b.textContent), ['game', 'bloom', 'tank feel']);
  assert.equal(p.body.kids.length, 3); assert.equal(p.body.kids[0].kids[0].kids[0].kids.length, 2, 'both root controls on the game page');
  assert.equal(p.body.kids[1].kids[0], p.gui.folders[0].domElement, 'a folder is moved whole'); assert.equal(p.gui.folders[1].opened, true);
  assert.equal(p.gui.domElement.style.display, 'none', 'the emptied root gui is parked');
  assert.equal(p.modal.classList.contains('hidden'), false); assert.equal(active(p), 0);
  assert.equal(p.doc.body.classList.contains('vars-open'), false, 'closed until asked for');
  p.nav.kids[2].click(); assert.equal(active(p), 2); assert.equal(p.body.kids[2].classes.has('active'), true, 'a button shows its page');
  p.toggle.click(); assert.equal(p.doc.body.classList.contains('vars-open'), true, 'the toggle opens it');
  p.close.click(); assert.equal(p.doc.body.classList.contains('vars-open'), false, 'and the close button shuts it');
  assert.deepEqual(p.calls, [], 'no lab, no sky, no readout');
}
// ?vars=1 OPENS IT for a screenshot or a link
assert.equal(page({ query: 'vars=1' }).doc.body.classList.contains('vars-open'), true);
// THE LAB PAGE: its knobs in a folder of their own, the run's sky seed unless the URL named one, and the modal open on it
{
  const lab = { on: true, waveMult: 3, bg: 'galaxy', galaxySeed: 5, bloom: false, immortalHeart: true, immortalTank: false };
  const log = console.log; const lines = []; console.log = (s) => lines.push(s);
  let p; try { p = page({ lab }); } finally { console.log = log; }
  assert.equal(lab.galaxySeed, 4242, 'the lab opens on the run\'s own sky');
  const f = p.gui.folders.find((x) => x._title === 'lab');
  assert.equal(f.controls.length, 14, 'every lab knob');
  assert.equal(p.nav.kids[active(p)].textContent, 'lab', 'the modal opens on the lab page');
  assert.equal(p.doc.body.classList.contains('vars-open'), true);
  assert.deepEqual(p.calls, [['sky', 4242], ['bloom', false], ['perf', true, false]], 'the URL\'s sky and bloom, and the readout without saving a preference');
  assert.match(lines[0], /^LAB on mult=3 bg=galaxy immortal=heart gpuQuery=false$/);
  f.controls.find((c) => c.label === 'spawn').target.spawn(); assert.deepEqual(p.calls.at(-1), ['wave'], 'the spawn button raises a wave');
  f.controls.find((c) => c.label === 'bloom').change(true); assert.deepEqual(p.calls.at(-1), ['bloom', true]);
  const named = { on: true, galaxySeed: 9 }; console.log = (s) => lines.push(s);
  try { page({ lab: named, query: 'labseed=9' }); } finally { console.log = log; }
  assert.equal(named.galaxySeed, 9, 'a seed the URL named is kept');
}
// NO MARKUP: nothing to move pages into, but the lab folder is still built and its sky applied
{
  const lab = { on: true, galaxySeed: 1, bloom: true };
  const p = page({ markup: false, lab });
  assert.equal(p.nav.kids.length, 0); assert.ok(p.gui.folders.some((x) => x._title === 'lab'));
  assert.deepEqual(p.calls, [['sky', 4242], ['bloom', true]]);
}
delete globalThis.document;
console.log('VARS modal pages the root controls and folders, opens on request and on the lab, and builds the lab page.');
