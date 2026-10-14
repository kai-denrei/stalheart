import assert from 'node:assert/strict';
import { readGameFlags, GAME_FLAG_KEYS } from '../src/platform/game-flags.js';
import { SHIELD_KNOBS } from '../src/domain/shield.js';
// THE URL FLAGS, READ ONCE (src/platform/game-flags.js): what URLSearchParams.get said at each site, from one frozen object
const search = `?mobile=1&coarse=1&metal=0&tier=low&sim=style1&seed=1000&labseed=&${SHIELD_KNOBS[0].key}=8`;
const f = readGameFlags(search), q = new URLSearchParams(search);
assert.equal(f.mobile, '1'); assert.equal(f.coarse, '1'); assert.equal(f.metal, '0'); assert.equal(f.tier, 'low'); assert.equal(f.sim, 'style1'); assert.equal(f.seed, '1000');
assert.equal(f.acceptance, null, 'absent is null, never undefined'); assert.equal(f.fps === '1', false); assert.equal(f.viewwatch !== '0', true);
assert.equal(f.labseed, '', 'present without a value is the empty string (has() is !== null)');
assert.ok(Object.isFrozen(f) && Object.isFrozen(f.shield));
assert.deepEqual(Object.keys(f), [...GAME_FLAG_KEYS, 'shield']);
for (const k of GAME_FLAG_KEYS) assert.equal(f[k], q.get(k), k);
for (const k of SHIELD_KNOBS) assert.equal(f.shield[k.key], q.get(k.key), k.key);
assert.equal(f.shield[SHIELD_KNOBS[0].key], '8');
assert.equal(readGameFlags('').acceptance, null);
// THE PEARL SET IS THE STORY'S DEFAULT (owner, 2026-10-14): an absent `creatures` on a story page reads 'pearl'; dots / 0 read null (the dot
// clouds); the campaign board (?acceptance / ?sim without the story) keeps null; an explicit value is kept as given
for (const s of ['', '?intro=0', '?skip=defence&sector=2', '?acceptance=1&world=story', '?acceptance=1&skip=wave', '?story=1&acceptance=1']) assert.equal(readGameFlags(s).creatures, 'pearl', s);
for (const s of ['?acceptance=1', '?sim=style1', '?creatures=dots', '?creatures=DOTS', '?creatures=0', '?acceptance=1&world=story&creatures=dots']) assert.equal(readGameFlags(s).creatures, null, s);
for (const [s, v] of [['?creatures=pearl', 'pearl'], ['?acceptance=1&creatures=pearl', 'pearl'], ['?skip=defence&creatures=cutis:small&ramp=1', 'cutis:small'], ['?creatures=reed:big', 'reed:big']]) assert.equal(readGameFlags(s).creatures, v, s);
console.log('Game flags: one frozen read of the URL, null for an absent flag, the same strings URLSearchParams gives, the shield knobs by name; the Pearl set the story\'s default enemies (dots on ?creatures=dots and on the campaign board).');
