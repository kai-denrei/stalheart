import assert from 'node:assert/strict';
import { SECTORS, SECTOR_MOTES } from '../src/content/sectors.js';
import { computeWavePlan, ENEMY_SPEC } from '../src/enemyspec.js';
import { PEARL_WAVES } from '../src/content/pearl-enemies.js';
import { sizeWave, shareOut, pulseBodies, flowWaves, pulseDue, flowDue, flowTarget, streamOffsets } from '../src/domain/sector-shape.js';

// THE SECTOR'S SHAPE (owner, 2026-10-15: "both by sector"; spec docs/superpowers/specs/2026-10-15-sector-shapes-design.md)
const spec = { amoeba: { rammable: true }, ghost: { rammable: true }, drifter: {}, barbed: {} };
const total = (es) => es.reduce((n, e) => n + e.count, 0);

// SIZING: the plan's mix at an exact count
{
  const plan = [{ type: 'drifter', count: 6 }, { type: 'amoeba', count: 6 }, { type: 'ghost', count: 6 }];
  const w = sizeWave(plan, spec, { bodies: 100, coreShare: 0.05 });
  assert.equal(total(w), 100, 'the count is exact');
  assert.deepEqual(w.map((e) => e.type), ['drifter', 'amoeba', 'ghost'], 'the plan\'s order');
  assert.equal(w.find((e) => e.type === 'drifter').count, 5, 'five of a hundred are cored');
  assert.deepEqual(w.filter((e) => spec[e.type].rammable).map((e) => e.count), [48, 47], 'the soft types share the rest by their proportions');
}
{
  const plan = [{ type: 'barbed', count: 8 }, { type: 'amoeba', count: 20 }, { type: 'drifter', count: 3 }, { type: 'ghost', count: 20 }];
  const w = sizeWave(plan, spec, { bodies: 30, coreShare: 0.03 });
  assert.equal(total(w), 30);
  assert.deepEqual(w.filter((e) => !spec[e.type].rammable).map((e) => e.count), [1, 1], 'one of each cored type when the share rounds under it');
  const w0 = sizeWave(plan, spec, { bodies: 30, coreShare: 0 });
  assert.ok(w0.every((e) => spec[e.type].rammable) && total(w0) === 30, 'no share, no cores');
  const w3 = sizeWave(plan, spec, { bodies: 3, coreShare: 0.5 });
  assert.equal(total(w3), 3, 'a tiny wave is still exact');
  const big = sizeWave(plan, spec, { bodies: 1000, coreShare: 0.08 });
  assert.equal(total(big), 1000);
  assert.equal(big.filter((e) => !spec[e.type].rammable).reduce((n, e) => n + e.count, 0), 80, 'eight in a hundred cored at a thousand');
  assert.deepEqual(big.filter((e) => !spec[e.type].rammable).map((e) => e.count), [58, 22], 'the cored types in the plan\'s proportions (8:3)');
}
{
  const w = sizeWave([{ type: 'amoeba', count: 4 }], spec, { bodies: 12, coreShare: 0.2 });
  assert.deepEqual(w, [{ type: 'amoeba', count: 12 }], 'no cored type in the plan: all soft');
  const c = sizeWave([{ type: 'barbed', count: 4 }], spec, { bodies: 12, coreShare: 0.2 });
  assert.deepEqual(c, [{ type: 'barbed', count: 12 }], 'no soft type in the plan: all cored');
  assert.deepEqual(sizeWave([{ type: 'amoeba', count: 4 }], spec, { bodies: 0 }), [], 'nothing to send');
  const one = sizeWave([{ type: 'amoeba', count: 9 }, { type: 'ghost', count: 1 }], spec, { bodies: 1 });
  assert.deepEqual(one, [{ type: 'amoeba', count: 1 }], 'one body: the biggest type');
}

// THE PULSE LIST
assert.equal(pulseBodies([10, 20, 30, 50], 0), 10);
assert.equal(pulseBodies([10, 20, 30, 50], 3), 50);
assert.equal(pulseBodies([10, 20, 30, 50], 9), 50, 'past the list its last entry repeats');
assert.equal(pulseBodies([], 2), 0);

// THE FLOW'S BOOKS
assert.equal(flowWaves({ total: 1800, burst: 150 }, 2), 6, '1800 over two breaches in bursts of 150');
assert.equal(flowWaves({ total: 3000, burst: 200 }, 1), 15);
assert.equal(flowWaves({ total: 10, burst: 150 }, 2), 1, 'never under one wave');

// THE BREATH: a sector's first pulse is always due; then the pulse after the field is mostly dead, or the ceiling
const breath = { at: 0.25, max: 60 };
assert.equal(pulseDue({ sent: false, alive: 500, lastSize: 0, sinceRelease: 0, pulse: 12, breath }), true, 'the first pulse');
assert.equal(pulseDue({ sent: true, alive: 30, lastSize: 100, sinceRelease: 13, pulse: 12, breath }), false, 'the wave is still up');
assert.equal(pulseDue({ sent: true, alive: 25, lastSize: 100, sinceRelease: 13, pulse: 12, breath }), true, 'mostly dead: due');
assert.equal(pulseDue({ sent: true, alive: 0, lastSize: 100, sinceRelease: 5, pulse: 12, breath }), false, 'dead early: the pulse still runs');
assert.equal(pulseDue({ sent: true, alive: 100, lastSize: 100, sinceRelease: 60, pulse: 12, breath }), true, 'the ceiling: stacked');

// THE FLOW: under the target, send
assert.equal(flowDue({ alive: 449, target: 450 }), true);
assert.equal(flowDue({ alive: 450, target: 450 }), false);
assert.equal(flowTarget(850, 400), 400, 'the crowd cap clamps the target');
assert.equal(flowTarget(850, Infinity), 850);
assert.equal(flowTarget(850, undefined), 850);

// THE STREAM
assert.deepEqual(streamOffsets(4, 6), [0, 1.5, 3, 4.5]);
assert.deepEqual(streamOffsets(1, 6), [0]);
assert.deepEqual(streamOffsets(0, 6), [0]);

// THE MOTES (owner, 2026-11-13: "introduce an even smaller category of whites that glide at 2x or 3x"): a share of the amoebas traded for motes, the
// total kept, the motes first; nothing at share 0 or without amoebas; in the sectors' own waves (sector 1, every pulse) the count is the row's
{
  const w = shareOut([{ type: 'drifter', count: 2 }, { type: 'amoeba', count: 20 }], { from: 'amoeba', to: 'mote', share: 0.3 });
  assert.deepEqual(w, [{ type: 'drifter', count: 2 }, { type: 'mote', count: 6 }, { type: 'amoeba', count: 14 }]);
  assert.equal(shareOut(w, { from: 'amoeba', to: 'mote', share: 0 }), w);
  assert.deepEqual(shareOut([{ type: 'ghost', count: 5 }], { from: 'amoeba', to: 'mote', share: 0.5 }), [{ type: 'ghost', count: 5 }]);
  assert.deepEqual(shareOut([{ type: 'amoeba', count: 2 }], { from: 'amoeba', to: 'mote', share: 1 }), [{ type: 'mote', count: 2 }]);
  const lines = [];
  for (const row of SECTORS.filter((r) => r.shape === 'pulse')) row.bodies.forEach((b, k) => {
    const plan = computeWavePlan(row.ladderStart + k, 1, 4, row.threat).entries, sized = sizeWave(plan, ENEMY_SPEC, { bodies: Math.round(b * PEARL_WAVES.crowd), coreShare: row.coreShare });
    const out = shareOut(sized, { ...SECTOR_MOTES, share: SECTOR_MOTES.share[row.n] ?? 0 }), n = (es, t) => es.find((e) => e.type === t)?.count ?? 0;
    assert.equal(total(out), total(sized), `sector ${row.n} wave ${k + 1}: the count is the row's`);
    lines.push(`S${row.n}w${k + 1} ${total(sized)}: amoeba ${n(sized, 'amoeba')} -> ${n(out, 'amoeba')} + mote ${n(out, 'mote')}`);
  });
  assert(SECTOR_MOTES.share[1] > 0 && lines.some((l) => !/mote 0$/.test(l)), 'the motes in the first sector');
  if (process.env.MOTES) console.log(lines.join('\n'));
}

console.log('sector-shape ok');
