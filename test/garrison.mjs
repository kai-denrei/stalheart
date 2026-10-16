// garrison.mjs — where the opening garrison goes (src/domain/garrison.js, moved out of src/td-tab.js in refactor round 3): wall
// cells with an open neighbour inside the band from the heart, nearest a live gate first, kept `apart` cells from each other; when
// the band or the spacing cannot be met, any legal wall with an open neighbour rather than no garrison.
import assert from 'node:assert/strict';
import { BLOCKED } from '../src/dungeon.js';
import { norm3 } from '../src/vec3.js';
import { garrisonSites } from '../src/domain/garrison.js';

// a strip of cells 0..9 along x, 0.01 apart (cellSide 0.01: one cell per step); odd cells are walls, even cells open floor
const n = 10, centers = [], tags = [], distToHeart = [], adj = [];
for (let i = 0; i < n; i++) { centers.push(norm3([i * 0.01, 0, 1])); tags.push(i % 2 ? BLOCKED : 2); distToHeart.push(i); adj.push([i - 1, i + 1].filter((k) => k >= 0 && k < n)); }
const world = (over = {}) => ({ spawnPoints: [{ ci: 9, alive: true }], dungeon: { tags, distToHeart }, graph: { centers, adj }, cellSide: 0.01, placeError: () => null, band: [3, 6], apart: 4, ...over });

// walls 3, 5 and 7 touch floor inside the band (4, 4/6, 6); wall 1 (0/2) and wall 9 (8) do not; 7 is nearest the gate at 9
assert.deepEqual(garrisonSites(1, world()), [7], 'nearest a live gate first');
// 5 and 3 are under four cells from 7 (the chord on the sphere is a hair short of the grid step): the fallback fills from the lowest legal wall
assert.deepEqual(garrisonSites(2, world()), [7, 1], 'kept apart; the rest from any legal wall');
assert.deepEqual(garrisonSites(2, world({ apart: 1.5 })), [7, 5], 'apart 1.5 lets the two nearest band sites stand');
// a dead gate does not pull: with no live gate every candidate is 0 from a gate, so the sort keeps cell order
assert.deepEqual(garrisonSites(1, world({ spawnPoints: [{ ci: 9, alive: false }] })), [3], 'no live gate: the first band site');
// placeError vetoes a site in both passes
assert.deepEqual(garrisonSites(2, world({ placeError: (ci) => (ci === 7 || ci === 1 ? 'no' : null) })), [5, 3], 'a vetoed wall is never chosen');
assert.deepEqual(garrisonSites(0, world()), [], 'none wanted, none given');
console.log('Garrison: the band, the nearest gate, kept apart, the any-wall fallback, placeError.');
