// view-edge.mjs — the view watchdog's edge report: which side of the visible band the tank is off, and by how much.
import assert from 'node:assert/strict';
import { viewEdge, viewportLine } from '../src/domain/view-edge.js';
const vv = { width: 400, height: 300, offsetLeft: 10, offsetTop: 20 };
assert.equal(viewEdge({ x: 100, y: 100 }, vv), 'inside');
assert.equal(viewEdge({ x: 100, y: 5 }, vv), 'above by 15');
assert.equal(viewEdge({ x: 500, y: 400 }, vv), 'below by 80+right by 90');
assert.equal(viewEdge({ x: 0, y: 100 }, vv), 'left by 10');
assert.equal(viewEdge({ x: 0, y: 0 }, null), '-');
assert.equal(viewportLine(vv), '400x300@10,20');
assert.equal(viewportLine(null), '-');
console.log('view-edge: all good');
