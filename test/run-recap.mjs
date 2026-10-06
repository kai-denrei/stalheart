// The run recap (src/core/run-recap.js): the campaign card's whole-run rows, the tempo laid end to end, the bests and the bars.
import assert from 'node:assert/strict';
import { DEBRIEF_SAMPLES } from '../src/content/debrief-samples.js';
import { recapRows, runTempo, runBests, bars } from '../src/core/run-recap.js';

const reps = [DEBRIEF_SAMPLES.secure, DEBRIEF_SAMPLES.flawless, DEBRIEF_SAMPLES.lost].map((r, i) => ({ ...r, sector: i + 1 }));
const rows = recapRows(reps);
assert.equal(rows.length, 3, 'one row per sector');
assert.deepEqual(rows.map((x) => x.sector), [1, 2, 3]);
assert.equal(rows[2].lost, true, 'a lost sector is marked');
for (const x of rows) assert.equal(x.by.tank, x.by.tank | 0, 'tank kills are counted with rams');

const t = runTempo(reps);
assert.equal(t.bins.length, reps.reduce((a, r) => a + r.kills.tempo.length, 0), 'every bin of every sector, end to end');
assert.deepEqual(t.marks.map((m) => m.sector), [1, 2, 3]);
assert.equal(t.marks[1].at, reps[0].kills.tempo.length, 'the second sector starts where the first ends');

const b = runBests(rows), by = Object.fromEntries(b.map((x) => [x.key, x]));
const maxCombo = Math.max(...rows.map((x) => x.combo));
if (maxCombo > 0) { assert.equal(by.combo.value, maxCombo); assert.equal(by.combo.sector, rows.find((x) => x.combo === maxCombo).sector, 'the best combo names its sector (the first on a tie)'); }
if (by.fastest) assert.ok(!rows.find((x) => x.sector === by.fastest.sector).lost, 'the fastest sector is a secured one');
assert.deepEqual(runBests([]), [], 'nothing counted, nothing listed');

const g = bars([{ v: 2 }, { v: 0 }, { v: 8 }], (x) => x.v, 100, 40, 2);
assert.equal(g.top, 8); assert.equal(g.peak, 2, 'the peak bar');
assert.equal(g.bars[2].h, 40); assert.equal(g.bars[0].h, 10); assert.equal(g.bars[1].h, 0);
assert.ok(g.bars[2].x + g.bars[2].w <= 100.1, 'the bars fit the box');
console.log(`Run recap: ${rows.length} sectors, ${t.bins.length} tempo bins, ${b.length} bests.`);
