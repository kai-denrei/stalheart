// start-gate — without a page there is nothing to wait for: the gate reports itself open and disposes quietly.
import assert from 'node:assert/strict';
import { createStartGate } from '../src/fx/start-gate.js';
const g = createStartGate(null); assert.equal(g.opened, true); g.dispose();
assert.equal(createStartGate({}).opened, true, 'no document: open');
console.log('Start gate: open where no page can show it.');
