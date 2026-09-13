// The authored three were the densest bodies on the roster and the only ones a
// crowd could not turn down. Measured in the swarm lab at 1,200 bodies:
// 592,800 points drops 22.5% of frames, 296,400 drops 9.6%, and 177,600 drops
// 0.1% — same population, same 1,256 draw calls throughout. Thinning is what
// moves that, so these tests hold its shape.
import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATURES, thinCloud } from '../src/creatures.js';
import { dotShapePts } from '../src/units.js';

test('the authored three honour the density factor', () => {
  for (const type of ['phage', 'amoeba', 'jellyfish']) {
    const full = dotShapePts(type, 1).length;
    const half = dotShapePts(type, 0.5).length;
    assert.ok(Math.abs(half - full / 2) <= 1, `${type}: ${half} is not half of ${full}`);
    assert.ok(dotShapePts(type, 0.3).length < half, `${type} keeps thinning`);
  }
});

test('the authored count is the ceiling — nothing is invented', () => {
  for (const type of ['phage', 'amoeba', 'jellyfish']) {
    const full = dotShapePts(type, 1).length;
    assert.equal(dotShapePts(type, 4).length, full, `${type} at d=4 is unchanged`);
    assert.equal(dotShapePts(type, 1.5).length, full, `${type} at d=1.5 is unchanged`);
  }
});

// The failure this guards is a cloud that loses one PART of itself: a slice
// would take the phage's head and drop its legs, because the generator writes
// the sections in order. A uniform resample keeps each section's share.
test('thinning keeps every section of the body', () => {
  const full = CREATURES.phage();
  const third = thinCloud(full, 1 / 3);
  const bucket = (pts) => {
    const b = [0, 0, 0, 0];
    for (const p of pts) b[Math.min(3, Math.max(0, Math.floor((p[1] + 1) / 2 * 4)))]++;
    return b;
  };
  const a = bucket(full), c = bucket(third);
  for (let i = 0; i < 4; i++) {
    if (a[i] === 0) continue;
    const share = c[i] / third.length, want = a[i] / full.length;
    assert.ok(Math.abs(share - want) < 0.06,
      `band ${i}: ${(share * 100).toFixed(1)}% of the thinned cloud vs ${(want * 100).toFixed(1)}% of the full one`);
  }
});

test('a thinned cloud is never empty and never grows', () => {
  const full = CREATURES.amoeba();
  for (const d of [0.001, 0.01, 0.1, 0.9, 1]) {
    const out = thinCloud(full, d);
    assert.ok(out.length >= 1, `d=${d} keeps at least one dot`);
    assert.ok(out.length <= full.length, `d=${d} never grows the cloud`);
  }
  assert.deepEqual(thinCloud([], 0.5), [], 'an empty cloud stays empty');
});

test('thinning is deterministic — a replay builds the same body twice', () => {
  const full = CREATURES.jellyfish();
  assert.deepEqual(thinCloud(full, 0.37), thinCloud(full, 0.37));
});

test('highlight dots survive thinning', () => {
  // every 12th dot carries the 4th element; a thinned cloud that lost all of
  // them would render without its sparkle layer and nothing would fail
  const thin = dotShapePts('amoeba', 0.4);
  assert.ok(thin.some((p) => p.length > 3), 'some highlight dots remain');
});
