import assert from 'node:assert/strict';
import { hullDepth, deepensContact, threadClearance } from '../src/domain/hull-contact.js';
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
// THE WAIST BEFORE ROCKET-B (2026-10-16): the story board's cells round 506 -> 504, the last corridor cell before rocket-b's clearing, in
// cells, 506 at the origin and 504 along x (read off the planet by --corridor-probe GEOM=506): the rock 505 sits in the bend's inside
// between them, 41712 and 41711 across. 0.54 cells of the 506|504 boundary lie between the faces; the hull's centre keeps 0.3 x
// STORY_SCALE.tankUnit 0.684 = 0.205 cells of room, which leaves a band of 0.06 cells to cross in, a fifth of a cell off the line between
// the two centres that every drive takes (the step aims at the next cell, the creep and the unstick pull back to 506's centre)
{
  const ids = [506, 504, 505, 41712, 41711, 59650, 30476], rock = new Set([505, 41712, 41711]);
  const xy = { 506: [0, 0], 504: [1.268, 0], 505: [0.62, 0.723], 41712: [0.002, -0.912], 41711: [1.371, -0.91], 59650: [-1.037, 0.731], 30476: [2.215, 0.644] };
  const links = { 506: [504, 505, 41712, 59650], 504: [505, 506, 30476, 41711], 505: [504, 506], 41712: [41711, 506], 41711: [504, 41712], 59650: [506], 30476: [504] };
  const centers = [], adj = [];
  ids.forEach((id) => { centers[id] = [...xy[id], 1]; adj[id] = links[id]; });
  const cellOf = (p) => ids.reduce((b, id) => (Math.hypot(p[0] - xy[id][0], p[1] - xy[id][1]) < Math.hypot(p[0] - xy[b][0], p[1] - xy[b][1]) ? id : b), 506);
  const waist = { centers, adj, cellOf, blocked: (ci) => rock.has(ci) };
  const across = (y, clearance) => hullDepth([{ p: [0.634, y, 1], clearance }], waist);   // a point on the 506|504 boundary, y cells off the centres' line
  const band = (clearance) => { let n = 0; for (let y = -0.6; y <= 0.6; y += 0.001) if (across(y, clearance) < 0) n++; return n * 0.001; };
  const full = 0.3 * 0.684, thread = threadClearance(full, true, 0.04);
  assert.ok(band(0) > 0.5 && band(0) < 0.56, `the waist: 0.54 cells of the 506|504 boundary lie between the faces (${band(0).toFixed(3)})`);
  assert.ok(band(full) < 0.07, `with its full clearance the centre has a band of ${band(full).toFixed(3)} cells to thread`);
  assert.ok(across(0, full) > 0, 'and the line between the two centres, the one the drive takes, is refused');
  assert.equal(band(0.3), 0, 'at the clearance cap (0.3 of a cell) no line at all');
  assert.equal(threadClearance(full, false, 0.04), full, 'unsqueezed, the centre keeps its full clearance');
  assert.equal(threadClearance(0.02, true, 0.04), 0.02, 'a smaller clearance is never raised');
  assert.ok(across(0, thread) < 0 && band(thread) > 0.35, 'squeezed, the centre threads the waist on the centres\' line');
  // the straight drive from 506's centre to 504's, squeezed, never deepens a contact
  let last = hullDepth([{ p: [0, 0, 1], clearance: thread }], waist), ok = true;
  for (let k = 1; k <= 40; k++) { const d = hullDepth([{ p: [1.268 * k / 40, 0, 1], clearance: thread }], waist); if (deepensContact(last, d, 0.002)) ok = false; last = d; }
  assert.ok(ok, 'squeezed, the drive from 506 to 504 is never refused');
}
console.log('Hull contact: faces are bisectors, clearance counts, a touching hull can always back out, and a squeezed hull threads a waist.');
