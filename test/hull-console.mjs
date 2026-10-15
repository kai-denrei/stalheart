import assert from 'node:assert/strict';
// THE HULL CONSOLE (owner, 2026-10-15/16): a DOM-free fake of the one element the readout makes, with the three spans it fills
const made = [];
const span = (cls) => ({ className: cls, textContent: '' });
globalThis.document = { createElement: (tag) => { const el = { tag, className: '', hidden: false, textContent: '', style: {}, classes: new Set(), innerHTML: '', remove() { el.removed = true; } };
  el.spans = { '.hc-pips': span('hc-pips'), '.hc-kmh': span('hc-kmh'), '.hc-mode': span('hc-mode') }; el.querySelector = (q) => el.spans[q];
  el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle: (c, v) => { v ? el.classes.add(c) : el.classes.delete(c); }, contains: (c) => el.classes.has(c) };
  made.push(el); return el; } };
const container = { appendChild: (el) => { el.parent = container; } };
const { createHullConsole } = await import('../src/fx/hull-console.js');
const hc = createHullConsole(container, { metres: () => 100 });   // 100 m a unit
const el = made[0], read = { on: true, above: 208, armour: 4, hits: 4, mode: 'MANUAL' };
assert.equal(el.className, 'hull-console'); assert.equal(el.hidden, true); assert.equal(el.parent, container);
hc.tick(1 / 60, [0, 0, 1], read);
assert.equal(el.hidden, false, 'shown when on'); assert.equal(el.spans['.hc-pips'].textContent, '■■■■', 'the armour whole'); assert.equal(el.spans['.hc-mode'].textContent, 'MANUAL');
// 0.01 units a frame at 60 fps = 0.6 units/s = 60 m/s = 216 km/h, eased in
let p = 1; for (let i = 0; i < 300; i++) { p += 0.01; hc.tick(1 / 60, [0, 0, p], read); }
assert.ok(Math.abs(hc.kmh() - 216) < 2, `the pace in km/h (${hc.kmh()})`);
assert.match(el.spans['.hc-kmh'].textContent, /^21\d km\/h$/); assert.equal(el.style.bottom, 'calc(max(14px, env(safe-area-inset-bottom)) + 208px)');
hc.tick(1 / 60, [0, 0, p], { ...read, armour: 3, mode: 'CRUISE' });
assert.equal(el.spans['.hc-pips'].textContent, '■■■□', 'a dent'); assert.equal(el.classes.has('hc-dent'), true, 'the line flashes'); assert.equal(el.spans['.hc-mode'].textContent, 'CRUISE');
for (let i = 0; i < 60; i++) hc.tick(1 / 60, [0, 0, p], { ...read, armour: 3 });
assert.equal(el.classes.has('hc-dent'), false, 'the flash is over'); assert.ok(hc.kmh() < 20, 'standing still eases to 0');
hc.tick(1 / 60, [0, 0, p], { ...read, armour: 1, mode: 'AVOID' }); assert.equal(el.classes.has('hc-low'), true, 'the last pip reads low'); assert.equal(el.spans['.hc-pips'].textContent, '■□□□');
hc.tick(1 / 60, [0, 0, p], { ...read, armour: 4 }); assert.equal(el.classes.has('hc-low'), false, 'a new hull is whole');
hc.tick(1 / 60, [0, 0, p], { ...read, on: false }); assert.equal(el.hidden, true, 'hidden in a seat');
hc.dispose(); assert.equal(el.removed, true);
console.log('Hull console: the hull\'s armour as pips, its pace in km/h and how it is driven, one line over the radar; a dent flashes it.');
