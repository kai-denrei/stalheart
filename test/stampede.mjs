import assert from 'node:assert/strict';
import { isStampede, stampedeWave } from '../src/domain/stampede.js';
import { SECTOR_STAMPEDE } from '../src/content/sectors.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';
const tune = SECTOR_STAMPEDE;
assert.deepEqual([0, 1, 2, 3].map((i) => isStampede(i, tune)), [false, true, false, true], 'every second wave a breach sends');
const plan = [{ type: 'amoeba', count: 20 }, { type: 'phage', count: 6 }, { type: 'barbed', count: 3 }];
assert.ok(!ENEMY_SPEC[tune.core].rammable, 'the flood\'s cores are hard');
// the pair (2026-10-03): a trickle at its own spacing, then a flood with cores. THE SIZE IS THE SECTOR'S (2026-10-15, sector shapes): the
// entries come in sized off the sector's row and neither kind multiplies them
{ const t1 = stampedeWave(plan, ENEMY_SPEC, tune, { index: 1 }), f1 = stampedeWave(plan, ENEMY_SPEC, tune, { index: 3 });
  assert.equal(t1.kind, 'trickle'); assert.equal(t1.gap, tune.trickleGap); assert.deepEqual(t1.entries, plan, 'a trickle is the wave as sized, one by one');
  assert.ok(tune.trickleGap < 4, 'spaced inside the ram combo window (4 s)');
  assert.equal(f1.kind, 'flood'); assert.equal(f1.gap, null); assert.deepEqual(f1.entries, [...plan, { type: tune.core, count: tune.cores }], 'a flood is the wave as sized with a few cores in it');
  assert.ok(t1.entries !== plan && t1.entries[0] !== plan[0], 'copies, never the plan itself');
  assert.deepEqual([1, 3, 5, 7].map((i) => stampedeWave(plan, ENEMY_SPEC, tune, { index: i }).kind), ['trickle', 'flood', 'trickle', 'flood'], 'alternating');
  assert.ok(!('size' in tune) && !('trickle' in tune) && !('trickleMax' in tune), 'no multipliers left in the content'); }
console.log('stampede: every second wave is a trickle or a flood with a few hard cores, at the sector\'s own size.');
