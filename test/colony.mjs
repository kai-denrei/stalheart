// THE COLONY'S PLACEMENT RULE AND ITS ROW (2026-11-12 night; src/domain/colony.js): the corner rule, the kinds each up to its max, Isao's suggestion
// along the default city, each card's proposed cell and its price at the board's index.
import assert from 'node:assert/strict';
import { cellStates, kindsLeft, suggest, cellFor, colonyOffers } from '../src/domain/colony.js';
import { COLONY_CELLS } from '../src/content/dome-city.js';
import { COLONY } from '../src/content/colony.js';

const none = () => false;
// the corner rule: W waits for NW and SW to stand, E for NE and SE; a bought cell is taken
{
  const s = cellStates(COLONY_CELLS, { taken: new Set(), standing: none });
  assert.deepEqual(s.map((x) => [x.id, x.state]), [['nw', 'free'], ['ne', 'free'], ['w', 'locked'], ['e', 'locked'], ['sw', 'free'], ['s', 'free'], ['se', 'free']]);
  assert.deepEqual(s.find((x) => x.id === 'w').behind, ['nw', 'sw'], 'W names the corners it waits for');
  const t = cellStates(COLONY_CELLS, { taken: new Set(['nw', 'sw']), standing: (id) => id === 'nw' });
  assert.deepEqual(t.map((x) => [x.id, x.state]), [['nw', 'taken'], ['ne', 'free'], ['w', 'locked'], ['e', 'locked'], ['sw', 'taken'], ['s', 'free'], ['se', 'free']], 'bought is not standing: W still waits for SW');
  const u = cellStates(COLONY_CELLS, { taken: new Set(['nw', 'sw']), standing: (id) => id === 'nw' || id === 'sw' });
  assert.equal(u.find((x) => x.id === 'w').state, 'free', 'both corners stand: W is free');
}
// the kinds: each once, the habitat twice
{
  assert.deepEqual(kindsLeft(COLONY.kinds, {}), ['logistics', 'research', 'fabrication', 'biosphere', 'power', 'habitat']);
  assert.deepEqual(kindsLeft(COLONY.kinds, { ne: 'logistics', nw: 'habitat' }), ['research', 'fabrication', 'biosphere', 'power', 'habitat']);
  assert.deepEqual(kindsLeft(COLONY.kinds, { ne: 'habitat', nw: 'habitat' }), ['logistics', 'research', 'fabrication', 'biosphere', 'power'], 'two habitats at most');
  assert.equal(Object.values(COLONY.kinds).reduce((n, k) => n + k.max, 0), COLONY_CELLS.length, 'the kinds fill the seven cells exactly');
}
// Isao's suggestion: the default city in its order, the first dome NE LOGISTICS; a taken cell or a held kind moves it along
{
  const s0 = cellStates(COLONY_CELLS, {});
  assert.deepEqual(suggest(COLONY.order, s0, kindsLeft(COLONY.kinds, {})), { cell: 'ne', kind: 'logistics' }, 'the first dome Isao proposes');
  const s1 = cellStates(COLONY_CELLS, { taken: new Set(['ne']) });
  assert.deepEqual(suggest(COLONY.order, s1, kindsLeft(COLONY.kinds, { ne: 'logistics' })), { cell: 'nw', kind: 'research' });
  // the player put research on SE: the suggestion skips NW's research for the next entry whose kind is left
  const s2 = cellStates(COLONY_CELLS, { taken: new Set(['se']) });
  assert.deepEqual(suggest(COLONY.order, s2, kindsLeft(COLONY.kinds, { se: 'research' })), { cell: 'ne', kind: 'logistics' });
  assert.equal(cellFor('research', COLONY.order, s2), 'nw', 'research still proposes its own cell');
  assert.equal(cellFor('logistics', COLONY.order, cellStates(COLONY_CELLS, { taken: new Set(['ne']) })), 'nw', 'its cell taken: the first free one');
  // the corner rule along the default order: W's biosphere comes after NW and SW stand
  const s3 = cellStates(COLONY_CELLS, { taken: new Set(['ne', 'nw', 'sw']), standing: none });
  assert.deepEqual(suggest(COLONY.order, s3, kindsLeft(COLONY.kinds, { ne: 'logistics', nw: 'research', sw: 'habitat' })), { cell: 'se', kind: 'habitat' }, 'W locked: the next entry');
  assert.equal(suggest(COLONY.order, cellStates(COLONY_CELLS, { taken: new Set(COLONY_CELLS.map((c) => c.id)) }), ['habitat']), null, 'no cell free');
}
// the row: a card a kind left, its price at the index, the suggested one marked, every free cell listed; nothing with no free cell
{
  const w = { cells: COLONY_CELLS, taken: new Set(), standing: none, held: {}, index: 2 };
  const row = colonyOffers(w, COLONY);
  assert.deepEqual(row.map((o) => o.id), ['dome:logistics', 'dome:research', 'dome:fabrication', 'dome:biosphere', 'dome:power', 'dome:habitat']);
  assert.deepEqual(row.map((o) => o.price), [6400, 6000, 5600, 6400, 5600, 4800], 'the base prices at index 2');
  assert.deepEqual(row.filter((o) => o.suggested).map((o) => [o.dome, o.cell]), [['logistics', 'ne']]);
  assert.deepEqual(row.find((o) => o.dome === 'biosphere').cell, 'nw', 'W locked: the biosphere proposes the first free cell');
  assert.deepEqual(row[0].cells, ['nw', 'ne', 'sw', 's', 'se']);
  assert.deepEqual(row.map((o) => o.perk), ['armory', 'uplink', 'rebuild', 'farm', 'chips', null]);
  assert.deepEqual(colonyOffers({ ...w, taken: new Set(COLONY_CELLS.map((c) => c.id)) }, COLONY), [], 'a full grid: no row');
}
console.log('Colony: the corner rule, each kind up to its max, Isao\'s suggestion along the default city, the row priced at the index.');
