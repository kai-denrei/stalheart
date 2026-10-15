import assert from 'node:assert/strict';
import { bossWaves, phaseScale, bossAlive } from '../src/domain/boss-sector.js';
import { BOSS_SECTOR } from '../src/content/sectors.js';
import { CUTIS_HITS } from '../src/content/cutis-maku.js';

// THE BOSS SECTOR (owner, 2026-10-15): the wave then the boss, both hunting the tank; the reach is the weak spot
const tierSpec = (f, t) => ({ body: f, tier: t, hp: 1, rammable: false, speed: 0.4 });
const [wave, boss] = bossWaves(BOSS_SECTOR, { tierSpec });
assert.equal(wave.reduce((n, e) => n + e.count, 0), 20, 'twenty in the wave');
assert.ok(wave.every((e) => e.hunter && e.tier === 'small' && e.type === 'cutis' && e.spec.hp === 20 && e.spec.rammable === false), 'small Cutis hunters at the wave\'s hit points');
assert.deepEqual(boss.map((e) => [e.tier, e.count, e.spec.hp, e.hunter]), [['huge', 1, 180, true]], 'then the boss, one, at 180');
assert.deepEqual(bossWaves({ name: 'x' }, { tierSpec }), [[], []], 'a row without a boss sends nothing of its own');
assert.equal(phaseScale('COIL', CUTIS_HITS), CUTIS_HITS.reach); assert.equal(phaseScale('EXTEND', CUTIS_HITS), 1); assert.equal(phaseScale('ANCHOR', CUTIS_HITS), 1);
assert.equal(phaseScale('REST', CUTIS_HITS), 0.5); assert.equal(phaseScale('SETTLE', CUTIS_HITS), 0.5); assert.equal(phaseScale('TRANSFER', CUTIS_HITS), 0, 'absorbed through the transfer');
assert.equal(phaseScale(undefined, CUTIS_HITS), 1, 'no phase: the game\'s own damage'); assert.equal(phaseScale('COIL', null), 1);
assert.deepEqual(bossAlive([{ alive: true, hunter: true, tier: 'small' }, { alive: true, hunter: true, tier: 'huge' }, { alive: false, hunter: true, tier: 'huge' }, { alive: true, hunter: false, tier: 'small' }]), { wave: 1, boss: 1 });
assert.deepEqual(bossAlive(null), { wave: 0, boss: 0 });
console.log('Boss sector: the wave and the boss as hunter plans, the phase scale (the reach full, rest half, the transfer none), the count alive.');
