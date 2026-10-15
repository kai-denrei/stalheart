// seat-status.mjs — the seat's word and its reticle's state are one rule, in the order the player needs them
import assert from 'node:assert/strict';
import { seatStatus } from '../src/domain/seat-status.js';

assert.deepEqual(seatStatus({ overheated: true, heat: 1.04 }), { state: 'overheated', text: 'OVERHEATED · 104%' }, 'overheated first, whatever else');
assert.equal(seatStatus({ overheated: true, loading: true, distance: 900, maxRange: 100 }).state, 'overheated');
assert.equal(seatStatus({ loading: true, aimErr: 40 }).state, 'loading', 'a mount still loading');
assert.deepEqual(seatStatus({ distance: 420, maxRange: 400 }), { state: 'range', text: 'OUT OF RANGE' }, 'a target past the range');
assert.equal(seatStatus({ distance: 400, maxRange: 400 }).state, 'ready', 'at the range is in range');
assert.equal(seatStatus({ distance: null, maxRange: 100 }).state, 'ready', 'no target is not out of range');
assert.deepEqual(seatStatus({ cooldown: 2.4 }), { state: 'cooling', text: 'COOLING 2.4 s' }, 'a long cooling');
assert.equal(seatStatus({ cooldown: 0.1 }).state, 'ready', 'a Rotor between rounds is not cooling');
assert.equal(seatStatus({ cooldown: 0.5, cadence: 0.6 }).state, 'ready', 'the cadence is the gun\'s own');
assert.equal(seatStatus({ guided: true }).state, 'acquiring', 'a launcher without its lock');
assert.equal(seatStatus({ guided: true, locked: true }).state, 'ready');
assert.deepEqual(seatStatus({ aimErr: 3 }), { state: 'traversing', text: 'TRAVERSING' }, 'a head still turning');
assert.equal(seatStatus({ aimErr: 3, tolerance: 4 }).state, 'ready');
assert.deepEqual(seatStatus(), { state: 'ready', text: 'READY' });
console.log('Seat status: one rule for the word and the reticle.');
