// THE CLOSE-UP GATE (flow fixes, 2026-11-13, docs/FLOW.md 6): one rule for the antenna's print, the companion prints and the FEIDS-26 drop
import assert from 'node:assert/strict';
import { closeupHold, fightOf } from '../src/domain/closeup-gate.js';
import { printReady } from '../src/domain/pet-print.js';
import { dropReady } from '../src/domain/reinforcements.js';

assert.equal(closeupHold({}), null, 'nothing running: clear');
assert.equal(closeupHold({ shot: true, seated: true, fighting: true }), 'shot');
assert.equal(closeupHold({ seated: true }), 'seat', 'a weapon seat holds it, fight or not');
assert.equal(closeupHold({ fighting: true }), 'fight', 'a live wave holds it');
assert.equal(closeupHold({ fighting: true, breathing: true }), null, 'the sector\'s breath is the lull');
assert.deepEqual(fightOf(null), { fighting: false, breathing: false });
assert.deepEqual(fightOf({ state: () => ({ phase: 'secure' }), breathing: () => true }), { fighting: false, breathing: false }, 'SECURE is no fight');
assert.deepEqual(fightOf({ state: () => ({ phase: 'fighting' }), breathing: () => false }), { fighting: true, breathing: false });
// the two rules that take the camera read it the same way
const print = { gates: true, held: 999, delay: 0, patience: 0, alive: true }, drop = { due: 1, day: 5, alive: true };
for (const c of [{ fighting: true }, { seated: true }, { shot: true }]) {
  assert.equal(printReady({ ...print, ...c }), false, `a print waits: ${JSON.stringify(c)}`);
  assert.equal(dropReady({ ...drop, ...c }), false, `the drop waits: ${JSON.stringify(c)}`);
}
assert.equal(printReady({ ...print, fighting: true, breathing: true }), true); assert.equal(dropReady({ ...drop, fighting: true, breathing: true }), true);
console.log('Close-up gate: shot, seat and a live wave hold the antenna, the prints and the drop; a breath or no fight lets them go.');
