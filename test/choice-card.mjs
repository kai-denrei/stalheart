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
console.log('Choice card: a line and two buttons over the game, the pick resolves and the card goes.');
