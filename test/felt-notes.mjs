import assert from 'node:assert/strict';
import { FELT_KINDS, FELT_LESSONS, addNote, sanitiseNotes, toFunmapLines, toJson } from '../src/domain/felt-notes.js';

assert.deepEqual(FELT_KINDS, ['satisfying', 'needs-work']);
assert.equal(FELT_LESSONS.length, 21);
assert.equal(FELT_LESSONS[0], 'R1');
assert.equal(FELT_LESSONS.at(-1), 'M');
let notes = addNote([], { date: '2026-09-14', kind: 'satisfying', text: '  the rotor burst  ', lesson: 'R13' });
notes = addNote(notes, { date: '2026-09-14', kind: 'needs-work', text: 'amoeba deaths too loud' });
assert.deepEqual(notes, [
  { date: '2026-09-14', kind: 'satisfying', text: 'the rotor burst', lesson: 'R13' },
  { date: '2026-09-14', kind: 'needs-work', text: 'amoeba deaths too loud' },
]);
assert.throws(() => addNote([], { date: '14/09/2026', kind: 'satisfying', text: 'x' }), /date/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'meh', text: 'x' }), /kind/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: '   ' }), /text/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: 'x', lesson: 'R21' }), /lesson/);
assert.throws(() => addNote([], { date: '2026-09-14', kind: 'satisfying', text: 'x'.repeat(501) }), /text/);
assert.equal(toFunmapLines(notes), '- 2026-09-14 · the rotor burst · R13\n- 2026-09-14 · needs work: amoeba deaths too loud');
assert.deepEqual(sanitiseNotes(toJson(notes)), notes, 'JSON round trip');
assert.deepEqual(sanitiseNotes('{not json'), []);
assert.deepEqual(sanitiseNotes(null), []);
assert.deepEqual(sanitiseNotes(JSON.stringify([notes[0], { date: 'x' }, 7, null, { ...notes[1], text: '' }])), [notes[0]], 'malformed entries are dropped, never thrown');
console.log('Felt notes: validation, FunMap lines and JSON round trip hold.');
