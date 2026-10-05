// squads — a big wave's soft bodies packed five to an entity, the bodies unchanged; a small one untouched; hard cores never packed.
import assert from 'node:assert/strict';
import { packSquads, bodiesOf } from '../src/domain/squads.js';
import { SQUADS } from '../src/content/sectors.js';
import { ENEMY_SPEC } from '../src/enemyspec.js';
const small = [{ type: 'amoeba', count: 120 }, { type: 'barbed', count: 3 }];
assert.deepEqual(packSquads(small, ENEMY_SPEC, SQUADS), small, 'under `over` soft bodies: as it was');
const big = [{ type: 'amoeba', count: 1200 }, { type: 'phage', count: 300 }, { type: 'barbed', count: 6 }];
const p = packSquads(big, ENEMY_SPEC, SQUADS);
assert.equal(bodiesOf(p), bodiesOf(big), 'the same bodies, every one');
assert.deepEqual(p.find((e) => e.type === 'barbed'), { type: 'barbed', count: 6 }, 'hard cores single');
const singles = p.filter((e) => !e.squad && ENEMY_SPEC[e.type].rammable).reduce((n, e) => n + e.count, 0);
assert.ok(singles >= SQUADS.single && singles < SQUADS.single + 2 * SQUADS.size, `about ${SQUADS.single} singles (${singles})`);
const entities = p.reduce((n, e) => n + e.count, 0);
assert.ok(entities < bodiesOf(big) / 3, `far fewer entities (${entities} for ${bodiesOf(big)})`);
assert.ok(p.filter((e) => e.squad).every((e) => e.squad === SQUADS.size && ENEMY_SPEC[e.type].rammable), 'squads are soft, of `size`');
assert.equal(bodiesOf(packSquads(p, ENEMY_SPEC, SQUADS)), bodiesOf(big), 'packing a packed wave loses nothing');
console.log('squads: a big wave packs its soft bodies five to an entity; the bodies and the hard cores are unchanged.');
