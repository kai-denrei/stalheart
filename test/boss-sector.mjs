import assert from 'node:assert/strict';
import { bossWaves, phaseScale, bossAlive } from '../src/domain/boss-sector.js';
import { BOSS_SECTOR } from '../src/content/sectors.js';
import { CUTIS_HITS } from '../src/content/cutis-maku.js';

// THE BOSS SECTOR (owner, 2026-10-15; 2026-10-16 THE ARENA: the Reeds, the pups, then the Nih-Dairia), every one hunting the tank; a Cutis body's reach is its weak spot
const tierSpec = (f, t) => ({ body: f, tier: t, hp: 1, rammable: false, speed: 0.4 });
const plans = bossWaves(BOSS_SECTOR, { tierSpec }), [wave, pups, boss] = plans;
assert.equal(wave.reduce((n, e) => n + e.count, 0), 12, 'twelve in the first wave');
assert.ok(wave.every((e) => e.hunter && e.tier === 'small' && e.type === 'reed' && e.spec.hp === 4 && e.spec.rammable === false), 'small Reed hunters at the wave\'s hit points');
assert.deepEqual(pups.map((e) => [e.tier, e.count, e.spec.hp, e.hunter]), [['pup', 6, 6, true]], 'then the pups (2026-10-16: THE ARENA)');
assert.deepEqual(boss.map((e) => [e.tier, e.count, e.spec.hp, e.hunter]), [['huge', 1, 180, true]], 'then the boss, one, at 180');
assert.equal(plans.length, BOSS_SECTOR.waves, 'one plan a wave');
assert.deepEqual(bossWaves({ name: 'x' }, { tierSpec }), [[], []], 'a row without a boss sends nothing of its own');
assert.deepEqual(bossWaves({ boss: { family: 'cutis', wave: { count: 2, tier: 'small', hp: 1 }, boss: { tier: 'huge', hp: 9 } } }, { tierSpec }).map((p) => p[0].tier), ['small', 'huge'], 'a single wave still reads');
assert.equal(phaseScale('COIL', CUTIS_HITS), CUTIS_HITS.reach); assert.equal(phaseScale('EXTEND', CUTIS_HITS), 1); assert.equal(phaseScale('ANCHOR', CUTIS_HITS), 1);
assert.equal(phaseScale('REST', CUTIS_HITS), 0.5); assert.equal(phaseScale('SETTLE', CUTIS_HITS), 0.5); assert.equal(phaseScale('TRANSFER', CUTIS_HITS), 0, 'absorbed through the transfer');
assert.equal(phaseScale(undefined, CUTIS_HITS), 1, 'no phase: the game\'s own damage'); assert.equal(phaseScale('COIL', null), 1);
assert.deepEqual(bossAlive([{ alive: true, hunter: true, tier: 'small' }, { alive: true, hunter: true, tier: 'huge' }, { alive: false, hunter: true, tier: 'huge' }, { alive: true, hunter: false, tier: 'small' }]), { wave: 1, boss: 1, tiers: { small: 1 } });
assert.deepEqual(bossAlive([{ alive: true, hunter: true, tier: 'small' }, { alive: true, hunter: true, tier: 'pup' }, { alive: true, hunter: true, tier: 'pup' }], { waveTiers: ['small', 'pup'] }), { wave: 3, boss: 0, tiers: { small: 1, pup: 2 } }, 'the waves\' tiers together and apart');
assert.deepEqual(bossAlive(null), { wave: 0, boss: 0, tiers: { small: 0 } });
console.log('Boss sector: the wave and the boss as hunter plans, the phase scale (the reach full, rest half, the transfer none), the count alive.');
