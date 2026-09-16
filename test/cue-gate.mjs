import assert from 'node:assert/strict';
import { makeCueGate, CUE_MIN_GAP } from '../src/core/cue-gate.js';

const gate = makeCueGate();

// the first word is always spoken
assert.equal(gate.allow('minigun_ready', 0), true, 'the first cue speaks');
// a held trigger flickering every frame cannot turn it into a buzz
assert.equal(gate.allow('minigun_ready', 0.016), false, 'one frame later: refused');
assert.equal(gate.allow('minigun_ready', 0.1), false, 'still inside the gap');
assert.equal(gate.allow('minigun_ready', CUE_MIN_GAP), true, 'past the gap it speaks again');

// a refused cue does not push the window out: the clock runs from what was
// actually SAID, or a fast flicker would silence the cue for good
const g2 = makeCueGate(0.2);
assert.equal(g2.allow('a', 0), true);
for (let t = 0.01; t < 0.2; t += 0.01) assert.equal(g2.allow('a', t), false, `refused at ${t.toFixed(2)}`);
assert.equal(g2.allow('a', 0.2), true, 'the window is measured from the last spoken cue');

// each name has its own floor: the ready cue never gags the stop cue
const g3 = makeCueGate(0.2);
assert.equal(g3.allow('ready', 0), true);
assert.equal(g3.allow('stop', 0), true, 'a different cue is not gated by its neighbour');
assert.equal(g3.allow('ready', 0.05), false);

// a fresh engagement speaks at once
const g4 = makeCueGate(0.2);
assert.equal(g4.allow('ready', 0), true);
assert.equal(g4.allow('ready', 0.05), false);
g4.reset('ready');
assert.equal(g4.allow('ready', 0.05), true, 'reset lets the next engagement speak');
g4.reset();
assert.equal(g4.allow('ready', 0.06), true, 'a bare reset clears every name');

console.log('Cue gate: first cue speaks, a flickering trigger cannot buzz, names are independent, reset re-arms.');
