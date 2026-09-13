import assert from 'node:assert/strict';
import { hullDepth, deepensContact } from '../src/domain/hull-contact.js';
// a flat strip of unit cells along x (near enough a sphere patch for the geometry): 0 open, 1 open, 2 rock
const centers = [[0, 0, 1], [1, 0, 1], [2, 0, 1]], adj = [[1], [0, 2], [1]];
const board = { centers, adj, blocked: (ci) => ci === 2, cellOf: (p) => (p[0] < -0.5 || p[0] >= 2.5 ? -1 : Math.round(p[0])) };
const at = (x, clearance = 0) => ({ p: [x, 0, 1], clearance });
assert.ok(hullDepth([at(1)], board) < 0, 'the centre of an open cell beside rock is clear');
assert.ok(Math.abs(hullDepth([at(1.3)], board) - -0.2) < 1e-9, 'the face sits halfway: 0.2 short of it');
assert.ok(Math.abs(hullDepth([at(1.3, 0.3)], board) - 0.1) < 1e-9, 'clearance moves the face in');
assert.equal(hullDepth([at(2)], board), Infinity, 'a point in rock');
assert.equal(hullDepth([at(0)], board), -Infinity, 'nothing near: no contact at all');
assert.equal(deepensContact(-0.2, 0.05), true, 'clear to touching is refused');
assert.equal(deepensContact(0.1, 0.05), false, 'backing out of a touch is allowed');
assert.equal(deepensContact(-1, -0.1), false, 'clear to clear is always fine');
assert.equal(deepensContact(0.1, Infinity), true);
console.log('Hull contact: faces are bisectors, clearance counts, a touching hull can always back out.');
