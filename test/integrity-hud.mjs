// integrity-hud.mjs — the strip's gate rows (src/fx/integrity-hud.js) over a small fake DOM: a gate worn to half and a quarter has Isao's lines; a `quiet`
// row (the arena's wave count and boss, src/fx/boss-run.js) falling has none (owner, 2026-10-18, note 6: "it's not quite clear what we must do", and Isao
// said "The gate is at half" as the small Reeds died); a row's name follows its phase
import assert from 'node:assert/strict';

function node() {
  const kids = new Map(), el = {
    className: '', hidden: false, textContent: '', style: {}, dataset: {}, classes: new Set(), offsetWidth: 1, children: [], removed: false,
    setAttribute() {}, remove() { el.removed = true; },
    append(...n) { el.children.push(...n); },
    querySelector(q) { if (!kids.has(q)) kids.set(q, node()); return kids.get(q); },
  };
  el.classList = { add: (c) => el.classes.add(c), remove: (c) => el.classes.delete(c), toggle: (c, v) => { (v ?? !el.classes.has(c)) ? el.classes.add(c) : el.classes.delete(c); }, contains: (c) => el.classes.has(c) };
  return el;
}
globalThis.document = { createElement: () => node() };
const root = { append() {}, querySelector: () => null };
const { createIntegrityHud } = await import('../src/fx/integrity-hud.js');

{ const said = [], hud = createIntegrityHud(root, { brief: (id) => said.push(id) });
  const gate = (hp) => ({ heart: null, gates: [{ id: 'gate', name: 'GATE', hp, max: 100, broken: false }] });
  hud.tick(gate(100), 0.1); hud.tick(gate(45), 0.1); hud.tick(gate(20), 0.1);
  assert.deepEqual(said, ['gate_half', 'gate_failing'], 'a gate worn down: half, then failing'); }

{ const said = [], hud = createIntegrityHud(root, { brief: (id) => said.push(id) });
  const row = (name, hp, max) => ({ heart: null, gates: [{ id: 'boss', name, hp, max, broken: false, quiet: true }] });
  hud.tick(row('TREMOR · FAR OUT', 1, 1), 0.1);
  hud.tick(row('WAVE · NIH-DAIRIA', 18, 18), 0.1); hud.tick(row('WAVE · NIH-DAIRIA', 7, 18), 0.1); hud.tick(row('WAVE · NIH-DAIRIA', 2, 18), 0.1);
  hud.tick(row('NIH-DAIRIA', 180, 180), 0.1); hud.tick(row('NIH-DAIRIA', 60, 180), 0.1);
  assert.deepEqual(said, [], 'the arena\'s row falling is no gate: no gate lines');
  const hudSaid = [], hud2 = createIntegrityHud(root, { brief: (id) => hudSaid.push(id) }), made = [];
  const create = globalThis.document.createElement; globalThis.document.createElement = () => { const n = create(); made.push(n); return n; };
  hud2.tick(row('TREMOR · FAR OUT', 1, 1), 0.1);
  const r = made.at(-1);
  hud2.tick(row('WAVE · NIH-DAIRIA', 5, 18), 0.1);
  assert.equal(r.querySelector('.ih-lbl').textContent, 'WAVE · NIH-DAIRIA', 'the row takes the phase\'s name');
  hud2.tick(row('NIH-DAIRIA', 180, 180), 0.1);
  assert.equal(r.querySelector('.ih-lbl').textContent, 'NIH-DAIRIA', 'and the boss\'s');
  globalThis.document.createElement = create; }

console.log('Integrity strip: a gate worn down has its lines, a quiet row (the arena\'s) has none, and a row\'s name follows its phase.');
