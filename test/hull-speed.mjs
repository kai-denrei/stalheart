import assert from 'node:assert/strict';
// THE SPEED OVER THE RADAR (owner, 2026-10-15): a DOM-free fake of the one element the readout makes
const made = [];
globalThis.document = { createElement: (tag) => { const el = { tag, className: '', hidden: false, textContent: '', style: {}, remove() { el.removed = true; } }; made.push(el); return el; } };
const container = { appendChild: (el) => { el.parent = container; } };
const { createHullSpeed } = await import('../src/fx/hull-speed.js');
const hs = createHullSpeed(container, { metres: () => 100 });   // 100 m a unit
const el = made[0];
assert.equal(el.className, 'hull-speed'); assert.equal(el.hidden, true); assert.equal(el.parent, container);
hs.tick(1 / 60, [0, 0, 1], { on: true, above: 208 });
assert.equal(el.hidden, false, 'shown when on');
// 0.01 units a frame at 60 fps = 0.6 units/s = 60 m/s = 216 km/h, eased in
let p = 1; for (let i = 0; i < 300; i++) { p += 0.01; hs.tick(1 / 60, [0, 0, p], { on: true, above: 208 }); }
assert.ok(Math.abs(hs.kmh() - 216) < 2, `the pace in km/h (${hs.kmh()})`);
assert.match(el.textContent, /^21\d km\/h$/); assert.equal(el.style.bottom, 'calc(max(14px, env(safe-area-inset-bottom)) + 208px)');
for (let i = 0; i < 300; i++) hs.tick(1 / 60, [0, 0, p], { on: true, above: 208 });
assert.ok(hs.kmh() < 1, 'standing still reads 0');
hs.tick(1 / 60, [0, 0, p], { on: false, above: 208 }); assert.equal(el.hidden, true, 'hidden in a seat');
hs.dispose(); assert.equal(el.removed, true);
console.log('Hull speed: the hull\'s pace from frame to frame in km/h, smoothed, shown over the radar when the hull is the view.');
