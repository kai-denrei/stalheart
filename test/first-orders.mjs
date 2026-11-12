// THE FIRST ORDERS' HOST (2026-11-08, THE SETTLING, spec 2.B): the board opened once, over the paused game, when the beats are past `landed`, the
// story runs a settle and the landers' tour is over; Isao's scouting line as it closes; never on a story without a settle; on an acceptance page only when asked
import assert from 'node:assert/strict';
import { createFirstOrders } from '../src/fx/first-orders.js';

function rig({ settle = 120, phase = 'printing', touring = false, acceptance = false, wanted = false, offers = true, scout = null, loading = false } = {}) {
  const log = []; let go = null;
  const story = { beats: { state: () => ({ settle, phase, scout }) } };
  const board = { first: (g) => { log.push('first'); go = g; return offers; } };
  const fo = createFirstOrders({ board, story: () => story, touring: () => touring, loading: () => loading, pause: (v) => log.push(['pause', v]), brief: (id) => log.push(['brief', id]), acceptance, wanted });
  return { fo, log, close: () => go?.(), story, set: (k, v) => { if (k === 'touring') touring = v; } };
}
{ const r = rig(); r.fo.tick(); assert.deepEqual(r.log, [['pause', true], 'first'], 'paused, then the card'); assert.deepEqual(r.fo.state(), { shown: true, open: true });
  r.fo.tick(); assert.equal(r.log.length, 2, 'once'); r.close(); assert.deepEqual(r.log.slice(2), [['pause', false], ['brief', 'scout_material']], 'unpaused, the scouting line'); assert.equal(r.fo.state().open, false); }
{ const r = rig({ phase: 'landed' }); r.fo.tick(); assert.deepEqual(r.log, [], 'not before the deploy'); }
{ const r = rig({ touring: true }); r.fo.tick(); assert.deepEqual(r.log, [], 'not during the landers\' tour'); r.set('touring', false); r.fo.tick(); assert.equal(r.log[1], 'first'); }
{ const r = rig({ settle: null }); r.fo.tick(); assert.deepEqual(r.log, [], 'no settle, no first orders'); }
{ const r = rig({ acceptance: true }); r.fo.tick(); assert.deepEqual(r.log, [], 'an acceptance page passes it by'); }
{ const r = rig({ acceptance: true, wanted: true }); r.fo.tick(); assert.equal(r.log[1], 'first', 'unless it asks'); }
{ const r = rig({ offers: false }); r.fo.tick(); assert.deepEqual(r.log, [['pause', true], 'first', ['pause', false], ['brief', 'scout_material']], 'nothing to offer: straight on, the line said'); }
// THE RECON DOG (2026-11-12): on the dog's opening (the beats' scout) the card waits for `orders`, says no scouting line, and done() is what the beats wait on
{ const r = rig({ settle: null, scout: {}, phase: 'piloting' }); r.fo.tick(); assert.deepEqual(r.log, [], 'not before the beats\' orders'); assert.equal(r.fo.done(), false); }
{ const r = rig({ settle: null, scout: {}, phase: 'orders', touring: true }); r.fo.tick(); assert.deepEqual(r.log, [['pause', true], 'first'], 'at orders'); assert.equal(r.fo.done(), false, 'open');
  r.close(); assert.deepEqual(r.log.slice(2), [['pause', false]], 'closed: no scouting line'); assert.equal(r.fo.done(), true); }
{ const r = rig({ settle: null, scout: {}, phase: 'orders', loading: true }); r.fo.tick(); assert.deepEqual(r.log, [], '?skip=dog: not while the rocket\'s swap is still loading (a paused page freezes it)'); }
{ const r = rig({ settle: null, scout: {}, phase: 'orders', acceptance: true }); assert.equal(r.fo.done(), true, 'an acceptance page passes it by: done at once'); }
console.log('First orders: once after the tour over the paused game, the scouting line as it closes.');
