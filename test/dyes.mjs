import assert from 'node:assert/strict';
import { DYES, DYE_SLOTS, DYE_BY_ID } from '../src/content/dyes.js';
import { BELTS, BELT_OF } from '../src/content/sectors.js';
import { makeDyeBook, processKills, unoffered, markOffered, paint, progress } from '../src/domain/dyes.js';
import { BRIEFS } from '../src/isaobriefs.js';

assert.deepEqual(DYES.map((d) => d.id), [...BELTS], 'one dye per belt, in ladder order');
assert.ok(DYES.every((d) => /^#[0-9a-f]{6}$/.test(d.paint) && d.kills > 0));
assert.ok(DYE_BY_ID.white.kills >= DYE_BY_ID.red.kills, 'the low belts take more kills than the rare ones');
assert.equal(DYE_SLOTS.length, 2);
assert.ok(BRIEFS.dyes_found, 'Isao has the dye line');
const b = makeDyeBook(null, DYES);
assert.deepEqual(b.livery, { armour: 'factory', edge: 'factory' });
assert.deepEqual(processKills(b, 'white', DYE_BY_ID.white.kills - 1, DYES), []);
assert.deepEqual(processKills(b, 'white', 1, DYES), ['white'], 'the white dye is extracted at its count');
assert.deepEqual(processKills(b, 'white', 50, DYES), [], 'once');
assert.deepEqual(unoffered(b), ['white']); markOffered(b); assert.deepEqual(unoffered(b), []);
assert.equal(paint(b, 'armour', 'red'), false, 'a dye the book does not have cannot be painted');
assert.equal(paint(b, 'armour', 'white'), true); assert.equal(b.livery.armour, 'white');
const back = makeDyeBook(JSON.parse(JSON.stringify(b)), DYES);
assert.deepEqual(back, b, 'the book survives a save and a load');
assert.deepEqual(makeDyeBook({ unlocked: ['nope', 'red'], livery: { armour: 'nope' } }, DYES).unlocked, ['red'], 'unknown dyes are dropped');
assert.equal(makeDyeBook({ livery: { armour: 'red' } }, DYES).livery.armour, 'factory', 'a livery naming a locked dye falls back');
assert.ok(progress(b, DYES).find((p) => p.id === 'white').unlocked);
// every enemy type belongs to a belt that has a dye
assert.ok(Object.values(BELT_OF).every((belt) => DYE_BY_ID[belt]));
console.log('Dyes: one per belt, extracted by kills processed, offered once, painted only with what the book has, saved and loaded.');
