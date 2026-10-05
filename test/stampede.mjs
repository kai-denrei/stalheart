import assert from 'node:assert/strict';
import { isStampede, stampedeOf, stampedeWave } from '../src/domain/stampede.js';
import { SECTOR_STAMPEDE } from '../src/content/sectors.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';
const tune = SECTOR_STAMPEDE;
assert.deepEqual([0, 1, 2, 3].map((i) => isStampede(i, tune)), [false, true, false, true], 'every second wave a breach sends');
const plan = [{ type: 'amoeba', count: 20 }, { type: 'phage', count: 6 }, { type: 'barbed', count: 3 }];
const st = stampedeOf(plan, ENEMY_SPEC, tune);
assert.deepEqual(st, [{ type: 'amoeba', count: 20 * tune.size }, { type: 'phage', count: 6 * tune.size }, { type: tune.core, count: tune.cores }], 'the soft ones multiplied, the solid ones out, a few cores in');
assert.equal(stampedeOf([{ type: 'barbed', count: 10 }], ENEMY_SPEC, tune)[0].type, tune.fallback, 'an all-solid plan becomes the fallback flood');
assert.ok(ENEMY_SPEC[tune.fallback].rammable && !ENEMY_SPEC[tune.core].rammable);
// the pair (2026-10-03): a soft trickle at its own spacing, then a flood with cores; Isao's automations grow both and arm the flood
{ const t1 = stampedeWave(plan, ENEMY_SPEC, tune, { index: 1 }), f1 = stampedeWave(plan, ENEMY_SPEC, tune, { index: 3 });
  assert.equal(t1.kind, 'trickle'); assert.equal(t1.gap, tune.trickleGap); assert.ok(t1.entries.every((e) => ENEMY_SPEC[e.type].rammable), 'soft only');
  assert.ok(tune.trickleGap < 4, 'spaced inside the ram combo window (4 s)');
  assert.equal(f1.kind, 'flood'); assert.equal(f1.gap, null); assert.deepEqual(f1.entries.at(-1), { type: tune.core, count: tune.cores });
  const f2 = stampedeWave(plan, ENEMY_SPEC, tune, { index: 3, tier: 2 });
  assert.equal(f2.entries.at(-1).count, tune.cores + 2 * tune.tierCores, 'more cores with each automation');
  assert.ok(f2.entries[0].count > f1.entries[0].count, 'and more bodies'); }
// a trickle stays a trickle (2026-10-05, the sector 4 lull): however big the plan, at most trickleMax bodies, so it is over in under a minute
{ const big = stampedeWave([{ type: 'amoeba', count: 400 }, { type: 'phage', count: 100 }], ENEMY_SPEC, tune, { index: 1, tier: 2 }), n = big.entries.reduce((a, e) => a + e.count, 0);
  assert.ok(n <= tune.trickleMax + big.entries.length && n >= tune.trickleMax - big.entries.length, `capped near ${tune.trickleMax} (${n})`);
  assert.ok(n * tune.trickleGap < 60, 'a trickle drips for under a minute');
  assert.ok(big.entries[0].count > big.entries[1].count, 'in proportion');
  const small = stampedeWave(plan, ENEMY_SPEC, tune, { index: 1 });
  assert.equal(small.entries.reduce((a, e) => a + e.count, 0), Math.min(tune.trickleMax, Math.round(26 * tune.trickle)), 'a small plan is untouched'); }
console.log('stampede: every second wave is a flood of rammable bodies with a few hard cores.');
