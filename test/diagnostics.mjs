import assert from 'node:assert/strict';
import { record, diagnosticBundle } from '../src/diagnostics.js';

// A FAULT THAT FIRES EVERY FRAME no longer floods the ring: identical events fold into their first entry with a count
record('app.boot');
for (let i = 0; i < 1000; i++) record('error', { message: 'x is not defined', line: 12 });
record('error', { message: 'another fault', line: 40 });
const ev = diagnosticBundle().events;
assert.equal(ev[0].type, 'app.boot', 'the boot record survives a thousand repeats');
assert.equal(ev.length, 3, 'one entry per distinct event');
assert.equal(ev[1].count, 1000, 'the repeat is counted');
assert.ok(ev[1].last >= ev[1].time, 'and stamped with its last time');
assert.equal(ev[2].data.message, 'another fault');
assert.ok(ev.every((e) => !('key' in e)), 'the fold key stays private');
// the ring still holds only its limit of distinct events, oldest first out, and a folded key leaves with its entry
for (let i = 0; i < 400; i++) record('performance.sample', { i });
const after = diagnosticBundle().events;
assert.equal(after.length, 300);
assert.equal(after[0].data.i, 100, 'the oldest distinct events leave first');
record('error', { message: 'x is not defined', line: 12 });
assert.equal(diagnosticBundle().events.at(-1).count, undefined, 'a fault whose entry has left the ring is recorded afresh');
console.log('Diagnostics: repeats fold into a count, the boot record survives, the ring stays bounded.');
