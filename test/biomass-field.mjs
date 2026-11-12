// THE BIOMASS FIELD (round 8 note 7, src/domain/biomass-field.js): kills lie on the ground, one pile a cell, and seep away when nobody comes (2026-11-12).
import assert from 'node:assert/strict';
import { createField } from '../src/domain/biomass-field.js';
import { FIELD } from '../src/content/rover.js';

const dist = (a, b) => Math.abs(a - b);   // a line of cells: the caller's metric
{ const f = createField({ seep: null, maxPiles: 4 });   // no seepage: the drop, near and take rules alone
  assert.equal(f.drop(5, 30, 0), 30); assert.equal(f.drop(5, 20, 1), 20, 'a second body on the same cell');
  assert.deepEqual(f.piles(), [{ cell: 5, kg: 50, at: 1, bodies: 2 }], 'aggregated per cell, touched by the second drop, two bodies');
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
// SEEPAGE (the economy design 2.6, 2026-11-12): max(floor, kg x share) kg a second off a lone body's pile (no grace, no cap: the rule of 2026-11-12);
// the first tick starts the clock; a pile seeped away is gone
{ const f = createField({ seep: { floor: 0.5, share: 1 / 400 }, maxPiles: 10 });
  f.drop(1, 6, 0); f.drop(2, 50, 0); f.drop(3, 4000, 0);
  assert.equal(f.tick(0), 0, 'the first tick only starts the clock');
  const lost = f.tick(10);
  assert.ok(Math.abs(lost - (5 + 5 + 100)) < 1e-6, `10 s: 0.5 kg/s off the small piles, a quarter of a percent a second off 4,000 kg (${lost})`);
  assert.ok(Math.abs(f.piles().find((p) => p.cell === 3).kg - 3900) < 1e-6);
  f.tick(12); assert.ok(!f.piles().some((p) => p.cell === 1), 'a lone 6 kg kill gone in 12 s'); assert.ok(Math.abs(f.seeped() - (6 + 6 + 100 + 19.5)) < 1e-6, `seeped ${f.seeped()}`);
  assert.equal(f.rotted(), f.seeped(), 'rotted counts the seepage'); assert.ok(Math.abs(f.total() + f.seeped() - 4056) < 1e-6, 'laid = on the ground + seeped');
  const v = f.version(); f.tick(12.1); assert.equal(f.version(), v, 'the shrinking redraws at most every half second'); f.tick(12.7); assert.ok(f.version() > v); }
// whole kilos off a seeping pile: an integer ask takes whole kg, a remainder under 1 kg goes to the ground
{ const f = createField({ seep: { floor: 0.5, share: 0 }, maxPiles: 4 }); f.drop(1, 10, 0); f.tick(0); f.tick(1.3);   // 9.35 kg left
  assert.equal(f.take(1, 5, 2), 5); assert.equal(f.take(1, 50, 2), 4, 'the whole kilos left'); assert.equal(f.size(), 0, 'the 0.35 kg remainder seeped');
  assert.ok(Math.abs(f.seeped() - 1) < 1e-9, `seeped ${f.seeped()}`); assert.ok(Math.abs(f.total()) < 1e-9); }
// the cap: at maxPiles a new cell rots the smallest pile first (the oldest of equals), so the newest body always lies where it fell
{ const f = createField({ maxPiles: 2 });
  f.drop(1, 10, 0); f.drop(2, 20, 1); const v = f.version(); f.drop(3, 30, 2);
  assert.deepEqual(f.piles().map((p) => p.cell), [2, 3]); assert.equal(f.rotted(), 10); assert.equal(f.total(), 50); assert.ok(f.version() > v, 'the scene sees the change');
  f.drop(2, 5, 3); assert.equal(f.size(), 2, 'an existing cell never evicts');
  f.take(3, 20, 4); f.drop(1, 40, 4); assert.deepEqual(f.piles().map((p) => p.cell), [2, 1], 'the smallest went (cell 3 at 10 kg), not the oldest (cell 2 at 25)');
  assert.equal(f.seeped(), 0, 'an eviction is rotted, not seeped'); }
// BONDED PILES HOLD (2026-11-12 night): no seepage for `grace` s after a pile's last body; then max(floor, kg x share) / min(bodies, bond) a second
{ const f = createField({ seep: { grace: 20, floor: 0.5, share: 1 / 400, bond: 8, cap: null }, maxPiles: 10 });
  f.drop(1, 6, 0);   // a lone kill
  for (let k = 0; k < 2; k++) f.drop(2, 10, 0);   // two bodies on one cell
  for (let k = 0; k < 20; k++) f.drop(3, 200, 0);   // a chain of twenty: 4,000 kg
  f.tick(0); assert.equal(f.tick(19.9), 0, 'nothing seeps within the grace');
  f.drop(4, 6, 15); f.tick(20); f.tick(30); const kg = (c) => f.piles().find((p) => p.cell === c)?.kg ?? 0;
  assert.equal(kg(4), 6, 'a pile\'s grace runs from its first body (laid at 15 s: whole at 30 s)');
  { const g = createField({ seep: { grace: 20, floor: 0.5, share: 0, bond: 1, cap: null } }); g.drop(1, 50, 0); g.drop(1, 50, 15); g.tick(0); g.tick(20); g.tick(30);
    assert.ok(Math.abs(g.total() - 95) < 1e-9, `a later body does not renew the grace (${g.total()})`); }
  assert.ok(Math.abs(kg(2) - (20 - (0.5 / 2) * 10)) < 1e-9, `two bodies: half the floor (${kg(2)})`);
  assert.ok(Math.abs(kg(3) - (4000 - ((4000 / 400) / 8) * 10)) < 1e-6, `a chain of twenty: an eighth of the share, the bond's cap (${kg(3)})`);
  assert.ok(Math.abs(kg(1) - (6 - 0.5 * 10)) < 1e-9, `the lone kill at the floor (${kg(1)})`); f.tick(32.1); assert.equal(kg(1), 0, 'gone 12 s after its grace');
  const lone = createField({ seep: { grace: 20, floor: 0.5, share: 1 / 400, bond: 8, cap: null } }); for (let k = 0; k < 20; k++) lone.drop(k, 200, 0); lone.tick(0); lone.tick(30);
  assert.ok(f.piles().find((p) => p.cell === 3).kg > lone.total() / 20 + 4, 'bonded holds more than lone piles of the same weight'); }
// THE GROUND TAKES ONLY SO MUCH: the seepage stops at `cap` of what was laid in the term; term() opens the next
{ const f = createField({ seep: { grace: 0, floor: 0.5, share: 0, bond: 1, cap: 0.25 }, maxPiles: 400 });
  for (let k = 0; k < 100; k++) f.drop(k, 6, 0);   // 600 kg of lone kills
  f.tick(0); f.tick(3); assert.ok(Math.abs(f.seeped() - 150) < 1e-9, `150 of 600 kg at most (${f.seeped()})`); f.tick(60); assert.ok(Math.abs(f.seeped() - 150) < 1e-9, 'and no more');
  assert.equal(f.size(), 100, 'scaled down evenly: every pile left');
  const w = f.term(); assert.ok(Math.abs(w.laid - 600) < 1e-9 && Math.abs(w.seeped - 150) < 1e-9, JSON.stringify(w)); f.tick(61); assert.equal(f.seeped(), 150, 'a new term with nothing laid takes nothing');
  f.drop(500, 40, 61); f.tick(62); assert.ok(Math.abs(f.seeped() - 160) < 1e-9, `a quarter of the next 40 kg (${f.seeped()})`); }
{ const f = createField(); f.drop(1, 50, 0); f.drop(10, 30, 0); f.drop(12, 30, 0); f.drop(13, 5, 0);
  assert.deepEqual(f.richest(3, dist), { cell: 10, kg: 65 }, 'the richest ground: 10, 12 and 13 within 3 of cell 10'); assert.equal(createField().richest(3, dist), null); }
assert.deepEqual([FIELD.seep.grace, FIELD.seep.floor, FIELD.seep.share, FIELD.seep.bond, FIELD.seep.cap, FIELD.maxPiles], [20, 0.5, 1 / 400, 3, 0.25, 400], 'the content numbers'); assert.equal(FIELD.decaySeconds, undefined, 'the rot is gone');
console.log('Biomass field: drop, aggregate, near, take, seepage (grace, bond, cap) and the pile cap hold.');
