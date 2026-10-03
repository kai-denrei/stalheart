// The paint shop's palettes (2026-10-03: natural palettes instead of the belt dyes) and the book that keeps the choice.
import assert from 'node:assert/strict';
import { PALETTES, PALETTE_BY_ID, DYE_SLOTS, LIVERY_LOOKS, LIVERY_IDS } from '../src/content/dyes.js';
import { makeDyeBook, paint } from '../src/domain/dyes.js';
assert.ok(PALETTES.length >= 8, 'a real choice');
assert.ok(PALETTES.every((p) => /^#[0-9a-f]{6}$/.test(p.armour) && /^#[0-9a-f]{6}$/.test(p.edge)), 'two colours each');
assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length, 'unique ids');
assert.equal(DYE_SLOTS.length, 2);
const b = makeDyeBook(null, PALETTES);
assert.equal(b.palette, 'factory', 'factory paint to start');
assert.equal(paint(b, 'desert', PALETTES), true); assert.equal(b.palette, 'desert');
assert.equal(paint(b, 'white', PALETTES), false, 'a belt dye is no palette');
assert.equal(makeDyeBook(JSON.parse(JSON.stringify(b)), PALETTES).palette, 'desert', 'kept across runs');
assert.equal(makeDyeBook({ unlocked: ['white'], livery: { armour: 'white' } }, PALETTES).palette, 'factory', 'an old belt book loads as factory');
assert.ok(PALETTE_BY_ID.navy);
// the A6 looks (2026-10-03) sit in the book beside the palettes
{ const b2 = makeDyeBook({ palette: 'night-circuit' }, LIVERY_IDS); assert.equal(b2.palette, 'night-circuit'); assert.ok(paint(b2, 'bunny-overdrive', LIVERY_IDS)); assert.ok(paint(b2, 'hazard', LIVERY_IDS));
  assert.deepEqual(LIVERY_LOOKS.map((l) => l.id), ['bunny-overdrive', 'night-circuit', 'field-notes']); assert.ok(PALETTE_BY_ID.hazard.stripes, 'hazard is striped'); }
console.log('dyes: natural palettes, every one open, the choice kept across runs.');
