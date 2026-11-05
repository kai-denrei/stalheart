// THE BIOMASS FIELD (round 8 note 7, src/domain/biomass-field.js): kills lie on the ground, one pile a cell, and rot when nobody comes.
import assert from 'node:assert/strict';
import { createField } from '../src/domain/biomass-field.js';
import { FIELD } from '../src/content/rover.js';

const dist = (a, b) => Math.abs(a - b);   // a line of cells: the caller's metric
{ const f = createField({ decaySeconds: 10, maxPiles: 4 });
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
  // decay: untouched past decaySeconds, rotted; a touched one lives on
  f.take(7, 1, 11);   // touched at 11
  assert.equal(f.tick(12.5), 40, 'cell 20 (laid at 2) rotted at 12.5'); assert.equal(f.rotted(), 40);
  assert.deepEqual(f.piles().map((p) => p.cell), [7], 'the touched pile is still there');
  assert.equal(f.tick(30), 9); assert.equal(f.total(), 0); assert.equal(f.size(), 0); }
// the cap: at maxPiles a new cell rots the oldest pile first, so the newest body always lies where it fell
{ const f = createField({ decaySeconds: 100, maxPiles: 2 });
  f.drop(1, 10, 0); f.drop(2, 20, 1); const v = f.version(); f.drop(3, 30, 2);
  assert.deepEqual(f.piles().map((p) => p.cell), [2, 3]); assert.equal(f.rotted(), 10); assert.equal(f.total(), 50); assert.ok(f.version() > v, 'the scene sees the change');
  f.drop(2, 5, 3); assert.equal(f.size(), 2, 'an existing cell never evicts'); }
assert.ok(FIELD.decaySeconds === 240 && FIELD.maxPiles === 400, 'the content numbers');
console.log('Biomass field: drop, aggregate, near, take, decay and the cap hold.');
