// THE BIOMASS FIELD (round 8 note 7, src/domain/biomass-field.js): kills lie on the ground, one pile a cell, and seep away when nobody comes (2026-11-12).
import assert from 'node:assert/strict';
import { createField } from '../src/domain/biomass-field.js';
import { FIELD } from '../src/content/rover.js';

const dist = (a, b) => Math.abs(a - b);   // a line of cells: the caller's metric
{ const f = createField({ seep: null, maxPiles: 4 });   // no seepage: the drop, near and take rules alone
  assert.equal(f.drop(5, 30, 0), 30); assert.equal(f.drop(5, 20, 1), 20, 'a second body on the same cell');
  assert.deepEqual(f.piles(), [{ cell: 5, kg: 50, at: 1 }], 'aggregated per cell, touched by the second drop');
  f.drop(7, 10, 2); f.drop(20, 40, 2);
  assert.equal(f.total(), 100);
  assert.equal(f.drop(-1, 10, 2), 0, 'no cell, no pile'); assert.equal(f.drop(3, 0, 2), 0, 'no kg, no pile'); assert.equal(f.total(), 100);
  // near: within reach of a cell, nearest first
  assert.deepEqual(f.near(6, 3, dist).map((p) => p.cell), [5, 7], 'the two within 3 cells, nearest first (ties by cell)');
  assert.deepEqual(f.near(6, 0.5, dist), []);
  // take: up to what lies there, touching the pile; an emptied pile is gone
  assert.equal(f.take(5, 35, 3), 35); assert.equal(f.piles().find((p) => p.cell === 5).kg, 15);
  assert.equal(f.take(5, 99, 3), 15, 'only what is left'); assert.ok(!f.piles().some((p) => p.cell === 5), 'emptied, gone');
  assert.equal(f.take(5, 10, 3), 0, 'nothing on a bare cell'); assert.equal(f.total(), 50);
  assert.equal(f.tick(5), 0); assert.equal(f.tick(500), 0, 'seep: null, nothing lost'); assert.equal(f.total(), 50); }
// SEEPAGE (the economy design 2.6, 2026-11-12): max(floor, kg x share) kg a second; the first tick starts the clock; a pile seeped away is gone
{ const f = createField({ seep: { floor: 0.5, share: 1 / 400 }, maxPiles: 10 });
  f.drop(1, 6, 0); f.drop(2, 50, 0); f.drop(3, 4000, 0);
  assert.equal(f.tick(0), 0, 'the first tick only starts the clock');
  const lost = f.tick(10);
  assert.ok(Math.abs(lost - (5 + 5 + 100)) < 1e-6, `10 s: 0.5 kg/s off the small piles, a quarter of a percent a second off 4,000 kg (${lost})`);
  assert.ok(Math.abs(f.piles().find((p) => p.cell === 3).kg - 3900) < 1e-6);
  f.tick(12); assert.ok(!f.piles().some((p) => p.cell === 1), 'a lone 6 kg kill gone in 12 s'); assert.ok(Math.abs(f.seeped() - (6 + 6 + 100 + 19.5)) < 1e-6, `seeped ${f.seeped()}`);
  assert.equal(f.rotted(), f.seeped(), 'rotted counts the seepage'); assert.ok(Math.abs(f.total() + f.seeped() - 4056) < 1e-6, 'laid = on the ground + seeped');
  const v = f.version(); f.tick(12.1); assert.equal(f.version(), v, 'the shrinking redraws at most every half second'); f.tick(12.7); assert.ok(f.version() > v); }
// the cap: at maxPiles a new cell rots the oldest pile first, so the newest body always lies where it fell
{ const f = createField({ maxPiles: 2 });
  f.drop(1, 10, 0); f.drop(2, 20, 1); const v = f.version(); f.drop(3, 30, 2);
  assert.deepEqual(f.piles().map((p) => p.cell), [2, 3]); assert.equal(f.rotted(), 10); assert.equal(f.total(), 50); assert.ok(f.version() > v, 'the scene sees the change');
  f.drop(2, 5, 3); assert.equal(f.size(), 2, 'an existing cell never evicts'); }
{ const f = createField(); f.drop(1, 50, 0); f.drop(10, 30, 0); f.drop(12, 30, 0); f.drop(13, 5, 0);
  assert.deepEqual(f.richest(3, dist), { cell: 10, kg: 65 }, 'the richest ground: 10, 12 and 13 within 3 of cell 10'); assert.equal(createField().richest(3, dist), null); }
assert.deepEqual([FIELD.seep.floor, FIELD.seep.share, FIELD.maxPiles], [0.5, 1 / 400, 400], 'the content numbers'); assert.equal(FIELD.decaySeconds, undefined, 'the rot is gone');
console.log('Biomass field: drop, aggregate, near, take, seepage and the cap hold.');
