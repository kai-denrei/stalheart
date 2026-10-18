import assert from 'node:assert/strict';
// THE CHOICE CARD (owner, 2026-10-15): a DOM-free fake of the elements it makes
const made = [];
globalThis.document = { createElement: (tag) => { const el = { tag, className: '', textContent: '', dataset: {}, children: [], attrs: {}, handlers: {}, setAttribute(k, v) { el.attrs[k] = v; }, append(...c) { el.children.push(...c); }, appendChild(c) { el.children.push(c); return c; }, addEventListener(t, f) { el.handlers[t] = f; }, remove() { el.removed = true; } }; made.push(el); return el; } };
const root = { children: [], appendChild(c) { root.children.push(c); return c; } };
const { createChoiceCard } = await import('../src/fx/choice-card.js');
const cc = createChoiceCard(root);
assert.equal(cc.isOpen(), false);
const p = cc.show({ line: 'Two ways.', a: 'YOU DRIVE THE TANK', b: 'GUNSHIP ON AUTOPILOT' });
assert.equal(cc.isOpen(), true);
const card = root.children[0]; assert.equal(card.className, 'choice-card');
const buttons = made.filter((e) => e.tag === 'button');
assert.equal(buttons.length, 2); assert.deepEqual(buttons.map((b) => b.dataset.pick), ['a', 'b']); assert.match(buttons[1].textContent, /^2 · GUNSHIP/);
buttons[1].handlers.click();
assert.equal(await p, 'b', 'the second button picks b'); assert.equal(cc.isOpen(), false); assert.equal(card.removed, true);
const p2 = cc.show({ line: 'Again.', a: 'A', b: 'B' }); made.filter((e) => e.tag === 'button').at(-2).handlers.click(); assert.equal(await p2, 'a');
// ONE BUTTON (owner, 2026-10-19, note 8a, THE ARENA's hand-over): a title, Isao's lines, a hint and only `a`; Enter takes it as well as 1
let onKey = null; globalThis.addEventListener = (t, f) => { if (t === 'keydown') onKey = f; }; globalThis.removeEventListener = () => { onKey = null; };
made.length = 0; root.children.length = 0;
const p3 = cc.show({ title: 'THE MOTHER', lines: ['One.', 'Two.'], hint: 'Space fires', a: 'TAKE THE GUN' });
const one = made.filter((e) => e.tag === 'button'); assert.equal(one.length, 1, 'one button'); assert.equal(one[0].textContent, 'TAKE THE GUN'); assert.equal(one[0].dataset.pick, 'a');
assert.deepEqual(made.filter((e) => e.className === 'choice-line').map((e) => e.textContent), ['One.', 'Two.']);
assert.equal(made.find((e) => e.className === 'choice-title').textContent, 'THE MOTHER'); assert.equal(made.find((e) => e.className === 'choice-hint').textContent, 'Space fires');
onKey({ key: '2', preventDefault() {}, stopPropagation() {} }); assert.equal(cc.isOpen(), true, '2 does nothing with one button');
onKey({ key: 'Enter', preventDefault() {}, stopPropagation() {} }); assert.equal(await p3, 'a', 'Enter takes it'); assert.equal(cc.isOpen(), false);
console.log('Choice card: a line and two buttons over the game, the pick resolves and the card goes; one button with a title, lines and a hint, Enter takes it.');
