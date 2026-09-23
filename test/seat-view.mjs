import assert from 'node:assert/strict';
import { TANK_LENS, SEAT_RETURN_VIEWS, seatLens, seatZoom, takeSeatView, baseFor, restoreSeatView, vacateFor } from '../src/domain/seat-view.js';

// the lens and the zoom readout are one number
assert.equal(seatLens(1), 60);
assert.equal(+seatLens(2.6).toFixed(4), 23.0769);
assert.equal(+seatZoom(seatLens(2.6)).toFixed(4), 2.6);
assert.equal(seatLens(0), 600000, 'a zero zoom cannot divide by zero');

// a snapshot keeps a view the player chose and a real lens
assert.deepEqual(takeSeatView({ view: 'orbit', fov: 60, lock: true }), { view: 'orbit', fov: 60, lock: true });
assert.deepEqual(takeSeatView({ view: 'third', fov: 68 }), { view: 'third', fov: 68, lock: false });
for (const v of SEAT_RETURN_VIEWS) assert.equal(takeSeatView({ view: v, fov: 68 }).view, v);
// a cinematic or derived camera is not a place a leave returns to
for (const v of ['bastion', 'drone', undefined, null, 'nonsense']) assert.equal(takeSeatView({ view: v, fov: 68 }).view, 'third', `${v} comes back to the hull`);
assert.equal(takeSeatView({ view: 'third', fov: 0 }).fov, TANK_LENS, 'a nonsense lens falls back to the hull\'s own');
assert.equal(takeSeatView().fov, TANK_LENS);
assert.deepEqual(restoreSeatView(null), { view: 'third', fov: TANK_LENS, lock: false });

// THE CHAIN: the first seat records the base, a seat entered from a seat inherits it
const tank = { view: 'third', fov: TANK_LENS };
const base = baseFor(null, false, tank);
assert.deepEqual(base, { view: 'third', fov: 68, lock: false }, 'tank -> gunship records the hull');
const inGunship = { view: 'bastion', fov: seatLens(2.6) };
assert.deepEqual(baseFor(base, true, inGunship), base, 'gunship -> SOL-82 keeps the hull, not the gunship lens');
assert.deepEqual(restoreSeatView(baseFor(base, true, inGunship)), { view: 'third', fov: 68, lock: false },
  'SOL-82 -> tank lands exactly where gunship -> tank lands');
// a base lost between runs is retaken rather than inherited as nothing
assert.deepEqual(baseFor(null, true, inGunship), { view: 'third', fov: +seatLens(2.6), lock: false });
// the player who took a seat from the map comes back to the map
const fromOrbit = baseFor(null, false, { view: 'orbit', fov: 60 });
assert.deepEqual(restoreSeatView(fromOrbit), { view: 'orbit', fov: 60, lock: false });

// OCCUPANCY IS EXCLUSIVE: SOL-82 from the gunship vacates the gunship
assert.deepEqual(vacateFor(['gunship'], 'sol82'), ['gunship']);
assert.deepEqual(vacateFor(['sol82'], 'gunship'), ['sol82']);
assert.deepEqual(vacateFor(['gunship'], 'gunship'), [], 'a seat does not vacate itself');
assert.deepEqual(vacateFor([], 'sol82'), []);
assert.deepEqual(vacateFor(null, 'sol82'), []);
assert.deepEqual(vacateFor(['sentry', 'sol82'], 'gunship'), ['sentry', 'sol82']);

console.log('seat-view: the contract holds');
