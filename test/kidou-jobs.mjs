// WHO PRINTS IT (owner, 2026-11-13: "the bigger ones are his, as long as they fit inside"): src/domain/kidou-jobs.js against the content's sizes.
import assert from 'node:assert/strict';
import { printerOf, reachedAt, printTable } from '../src/domain/kidou-jobs.js';
import { KIDOU_BAY, COLONY_GANTRY, COLONY_CELLS } from '../src/content/dome-city.js';
import { ISLANDS } from '../src/content/base-layout.js';
import { BASE_PROGRAMME } from '../src/content/base-programme.js';
import { gantryStop } from '../src/domain/gantry-route.js';

const opts = { ready: true, ...KIDOU_BAY };
// the rule's three answers and the gate
assert.equal(printerOf({ w: 4, d: 4, h: 2 }, opts), 'isao', 'a pad is Isao\'s');
assert.equal(printerOf({ w: 14, d: 12, h: 5 }, opts), 'kidou', 'a chip plant fits inside');
assert.equal(printerOf({ w: 20, d: 20, h: 23.3 }, opts), 'shared', 'a dome is taller than the bay');
assert.equal(printerOf({ w: 14, d: 12, h: 5 }, { ...opts, ready: false }), 'isao', 'before KIDOU stands everything is Isao\'s');
assert.equal(printerOf({ w: 36, d: 16, h: 4 }, opts), 'shared', 'wider than the bay');
// the bay's height is the tool's layer
assert.equal(KIDOU_BAY.bay.height, +(COLONY_GANTRY.reach - COLONY_GANTRY.nozzle).toFixed(2));
// a dome step is the gantry's under the rule, as before it
const isl = Object.fromEntries(ISLANDS.map((i) => [i.id, i]));
const sizeOf = (s) => { const i = isl[s.islands?.[0]]; return i ? { w: i.w, d: i.d, h: s.metres } : null; };
for (const s of BASE_PROGRAMME.filter((x) => x.cell)) assert.equal(printerOf({ w: 20, d: 20, h: s.metres }, opts), 'shared', `${s.id} shared`);
const rows = printTable(BASE_PROGRAMME.filter((s) => sizeOf(s)).map((s) => ({ id: s.id, ...sizeOf(s) })), opts);
assert(rows.length > 0);
// reach: the stop gantryStop drives to puts the tool on the cell's centre
for (const c of COLONY_CELLS) {
  const stop = gantryStop(COLONY_CELLS, COLONY_GANTRY, c.id), p = stop.points.at(-1);
  assert(reachedAt({ x: p[0], z: p[1] }, stop.heading, COLONY_GANTRY.tool, stop.cell, KIDOU_BAY.near), `${c.id}: the stop is within reach`);
  assert(!reachedAt({ x: COLONY_GANTRY.home[0], z: COLONY_GANTRY.home[1] }, COLONY_GANTRY.heading, COLONY_GANTRY.tool, stop.cell, KIDOU_BAY.near), `${c.id}: home is not`);
}
if (process.env.TABLE) console.table(rows);
console.log(`kidou-jobs: ${rows.length} programme steps sized, the seven domes shared, the stops within ${KIDOU_BAY.near} m`);
