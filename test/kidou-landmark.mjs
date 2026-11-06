// THE WHEELED STÅLHEART, A LOOK BEHIND A FLAG (the owner's note of 2026-11-07, call C; docs/superpowers/specs/2026-11-07-base-from-scratch-design.md
// section 2.C): ?gantry=kidou swaps the `stalheart` landmark's two tiers for the KIDOU moving gantry's pinned files (scale 1, no clips: the
// author's adapter poses it, src/fx/kidou-rig.js), and anything else is the rail terraformer exactly as it shipped.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { gantryMode, GANTRY_MODES } from '../src/platform/game-flags.js';
import { STRUCTURES, stalheartEntry } from '../src/content/base-layout.js';

// the switch: one parser, the rail terraformer unless the page asks for the KIDOU by name
assert.deepEqual(GANTRY_MODES, ['rail', 'kidou']);
assert.equal(gantryMode('?gantry=kidou'), 'kidou');
assert.equal(gantryMode('?sw=0&skip=defence&gantry=kidou&base=dome'), 'kidou');
for (const q of ['', null, undefined, '?gantry=rail', '?gantry=KIDOU', '?gantry=', '?gantry=wheels', '?base=classic', '?kidou=1']) assert.equal(gantryMode(q), 'rail', `${JSON.stringify(q)} reads rail`);

// the KIDOU's entry: the two pinned tiers (docs/a6-kidou-sai93-assets.lock.json), both on disk, no clips, not batched (its wheels, dampers
// and hoses are posed by name), scale 1 (metres), the rig named; still the Stålheart's id, island and stage
const k = stalheartEntry('kidou');
assert.equal(k.asset, 'assets/models/stalheart-kidou/stalheart_kidou_d0_lod1.glb');
assert.equal(k.far, 'assets/models/stalheart-kidou/stalheart_kidou_d0_lod2.glb');
for (const f of [k.asset, k.far]) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `${f} is pinned on disk`);
assert.deepEqual(k.clips, []); assert.equal(k.batch, false); assert.equal(k.scale, 1); assert.equal(k.rig, 'kidou');
assert.deepEqual(k.offset, [0, 0, 0], 'the root (the plot centre at the ground) on the slab\'s centre');
assert.equal(k.id, 'stalheart'); assert.equal(k.island, 'stalheart'); assert.equal(k.stage, 6);
assert.equal(k.candidate, undefined, 'the rail model\'s review candidates never ride the KIDOU (?landmarks=candidate would swap its files back)');

// the rail entry is today's, field for field (as it stood at 06af741c), and it is the one STRUCTURES ships
const TODAY = { id: 'stalheart', batch: true, asset: 'assets/models/astro/terraformer_3000_d0_game.glb', far: 'assets/models/far/stalheart.glb', island: 'stalheart', stage: 6, scale: 1, offset: [10, 0, 0], clips: ['Terraforming_Cycle'],
  candidate: { asset: 'assets/models/astro/terraformer_3000_d0_lod1.glb', far: 'assets/models/astro/terraformer_3000_d0_lod2.glb' } };
assert.deepEqual(stalheartEntry('rail'), TODAY);
assert.deepEqual(stalheartEntry(), TODAY, 'no mode is the rail');
assert.deepEqual(STRUCTURES.find((s) => s.id === 'stalheart'), TODAY);
console.log('KIDOU landmark: ?gantry=kidou the only way to the wheeled Stålheart, its two pinned tiers with no clips and its rig; the rail terraformer unchanged otherwise.');
