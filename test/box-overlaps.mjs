// box-overlaps.mjs — the layout ruler's clash count: pairs overlapping more than the margin both ways, and nothing else.
import assert from 'node:assert/strict';
import { boxOverlaps } from '../src/domain/box-overlaps.js';
const b = (left, top, right, bottom) => ({ left, top, right, bottom });
assert.deepEqual(boxOverlaps({ hud: b(0, 0, 100, 50), map: b(90, 40, 200, 150), fire: b(300, 300, 350, 350) }), [{ a: 'hud', b: 'map', x: 10, y: 10 }]);
assert.deepEqual(boxOverlaps({ a: b(0, 0, 100, 50), b: b(98, 0, 200, 50) }), [], 'two pixels of touch is not a clash');
assert.deepEqual(boxOverlaps({}), []);
console.log('box-overlaps: all good');
