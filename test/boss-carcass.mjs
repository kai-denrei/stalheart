// boss-carcass.mjs — a dead Reed's tentacle carcass (owner, 2026-10-10: "barebone tentacles, and they disintegrate with further explosions or time";
// src/domain/boss-carcass.js): the Reed's own rest nodes sorted into four limbs of rings root to tip by the kit's limb rule, the tip-first crumble schedule,
// the pieces an impact breaks per gun, a broken piece's flight and the carcass's decay.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { limbRings, crumbleTimes, blastFor, blastBreaks, flingOf, flingPose, crumblePose, carcassLook, seeded } from '../src/domain/boss-carcass.js';

const K = T.wave.carcass, CH = K.chain, SEGS = CH.segments;
let reed = '';
const MIN_LIMBS = 3, MIN_SEGS = 4, MIN_RINGS = 6;   // the acceptance's floor: a carcass of at least three limbs of four pieces; a limb's curve through six ring centres at least

// the content
assert.ok(K.decay === 60 && K.max === 30 && SEGS >= MIN_SEGS && CH.radial >= 6 && CH.radial <= 8, 'about a minute, at most 30, 6-8 sided tubes in pieces');
assert.ok(K.blast.rotary.cap > 0 && K.blast.rotary.cap <= 4 && K.blast.nuke.radius === 0 && K.blast.nuke.cap === 0, 'the 25 mm breaks a few, the MK-9 its whole ring');
assert.ok(K.fling.time > 0 && K.fling.time <= 1, 'a broken piece is gone within a second');

// the Reed's own cage: four limbs, each a chain of rings out from the axis, every limb node in exactly one ring
{
  const m = JSON.parse(readFileSync(new URL('../assets/creatures/nih-dairia/reed.json', import.meta.url), 'utf8'));
  const b = readFileSync(new URL('../assets/creatures/nih-dairia/reed.bin', import.meta.url)), ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const rest = new Float64Array(ab, m.layout.particles.offset, m.layout.particles.length);
  const { torso, limbs } = limbRings(rest, m.limbCount, CH);
  assert.equal(limbs.length, 4, 'the Reed\'s four limbs');
  assert.ok(torso.length > 20, `a torso (${torso.length} nodes)`);
  const seen = new Set();
  for (const [l, rings] of limbs.entries()) {
    assert.ok(rings.length >= MIN_RINGS && rings.length <= CH.bins, `limb ${l}: ${rings.length} rings`);
    let last = -Infinity;
    for (const ring of rings) {
      const r = ring.map((i) => Math.hypot(rest[i * 3], rest[i * 3 + 2]));
      assert.ok(Math.min(...r) >= last - 1e-12, `limb ${l}: the rings go root to tip`);
      last = Math.max(...r);
      for (const i of ring) { assert.ok(!seen.has(i)); seen.add(i); }
      const dir = Math.atan2(ring.reduce((s, i) => s + rest[i * 3 + 2], 0), ring.reduce((s, i) => s + rest[i * 3], 0));
      assert.ok(Math.abs(Math.atan2(Math.sin(dir - l * Math.PI / 2), Math.cos(dir - l * Math.PI / 2))) < Math.PI / 4, `limb ${l}: its rings lie in its sector`);
    }
  }
  torso.forEach((i) => assert.ok(!seen.has(i), 'the torso is no limb\'s'));
  reed = `the Reed's ${limbs.length} limbs of ${limbs.map((r) => r.length).join('/')} rings round ${torso.length} torso nodes`;
  assert.ok(limbs.length >= MIN_LIMBS);
}

// the crumble: every limb from its tip inward, within [from, to] of the decay; the core never (it goes with the carcass); seeded
{
  const pieces = [...[0, 1, 2, 3].flatMap((limb) => Array.from({ length: SEGS }, (_, j) => ({ limb, j }))), { limb: -1, j: 0 }];
  const t = crumbleTimes(pieces, K, 7), again = crumbleTimes(pieces, K, 7), other = crumbleTimes(pieces, K, 8);
  assert.deepEqual(t, again, 'seeded: the same seed, the same times');
  assert.notDeepEqual(t, other, 'another seed, other times');
  assert.equal(t[t.length - 1], Infinity, 'the core goes with the carcass');
  for (let limb = 0; limb < 4; limb++) {
    const own = pieces.map((p, i) => [p, t[i]]).filter(([p]) => p.limb === limb).sort((a, b) => b[0].j - a[0].j);   // tip first
    for (let k = 1; k < own.length; k++) assert.ok(own[k][1] > own[k - 1][1], `limb ${limb}: piece ${own[k][0].j} after the one beyond it`);
    assert.ok(own[0][1] >= K.crumble.from * K.decay && own[own.length - 1][1] <= K.crumble.to * K.decay, 'within the span');
  }
  const tips = t.filter((_, i) => pieces[i].j === SEGS - 1), roots = t.filter((_, i) => pieces[i].limb >= 0 && pieces[i].j === 0);
  assert.ok(Math.max(...tips) < Math.min(...roots), 'every tip before any root');
}

// an impact's breaks: within its radius, nearest first, capped per gun
{
  const centres = Array.from({ length: 33 }, (_, i) => [i * 0.5, 0]);   // a line of pieces 0.5 m apart
  const all = () => true;
  const r25 = blastFor({ kind: 'rotary', radius: T.rotary.radius }, K.blast), r40 = blastFor({ kind: 'bofors', radius: T.bofors.radius }, K.blast), mk9 = blastFor({ kind: 'nuke', radius: T.nuke.radius }, K.blast);
  assert.equal(blastFor({ kind: 'sol', radius: 9 }, K.blast), null, 'a kind with no break breaks nothing');
  assert.equal(mk9.radius, T.nuke.radius, 'the MK-9 its own ring');
  const a = blastBreaks(centres, all, [4, 0], r25.radius, r25.cap);
  assert.ok(a.length === r25.cap && a[0] === 8 && a.every((i) => Math.abs(centres[i][0] - 4) <= r25.radius), `the 25 mm: the ${r25.cap} nearest (${a})`);
  const b = blastBreaks(centres, all, [0, 0], r40.radius, r40.cap);
  assert.deepEqual(b, centres.map((_, i) => i).filter((i) => centres[i][0] <= r40.radius), 'the 40 mm: every piece within its radius, the rest left');
  assert.ok(b.length > 0 && b.length < centres.length, 'it leaves the far ones');
  assert.equal(blastBreaks(centres, all, [8, 0], mk9.radius, mk9.cap).length, centres.length, 'the MK-9 clears them all');
  assert.deepEqual(blastBreaks(centres, (i) => i % 2 === 0, [0, 0], 2, 0), [0, 2, 4], 'a piece already gone is not broken again');
  assert.deepEqual(blastBreaks(centres, all, [0, 50], 3, 0), [], 'a miss breaks nothing');
}

// a broken piece's flight: outward from the impact and up, falling, shrinking to nothing by `fling.time`
{
  const F = K.fling, f = flingOf([10, 0], [0, 0], 22, F, 3);
  assert.ok(f.v[0] > 0 && Math.abs(f.v[2]) < 1e-9 && f.v[1] > 0, 'thrown away from the impact, and up');
  assert.ok(Math.abs(Math.hypot(...f.axis) - 1) < 1e-9 && f.spin > 0, 'tumbling');
  const p0 = flingPose(f, 0, F), mid = flingPose(f, F.time / 2, F), end = flingPose(f, F.time, F);
  assert.deepEqual([p0.offset, p0.scale, p0.done], [[0, 0, 0], 1, false], 'whole where it was');
  assert.equal(flingPose(f, F.time * F.whole * 0.99, F).scale, 1, 'whole for the first part of its flight');
  assert.ok(mid.offset[0] > 0 && mid.scale > 0 && mid.scale < 1 && !mid.done, 'on its way, shrinking');
  assert.ok(end.scale === 0 && end.done, 'gone');
  const g = flingOf([0, 0], [0, 0], 8, F, 4);
  assert.ok(Number.isFinite(g.v[0]) && Math.hypot(g.v[0], g.v[2]) > 0, 'on the impact itself: a seeded bearing');
  const c = crumblePose(K.crumble.time / 2, K.crumble);
  assert.ok(c.scale > 0 && c.scale < 1 && c.drop > 0 && !c.done && crumblePose(K.crumble.time, K.crumble).done, 'a crumbling piece shrinks and sags');
}

// the carcass: fresh, darkening, sinking and cooling, gone at the decay's end
{
  const a = carcassLook(0, K), m = carcassLook(K.decay / 2, K), z = carcassLook(K.decay, K);
  assert.deepEqual(a, { k: 0, dark: 0, sink: 0, heat: 1, gone: false }, 'fresh: as it fell, warm');
  assert.ok(m.dark > 0 && m.dark < K.dark && m.sink > 0 && m.sink < K.sink && !m.gone && m.heat > 0 && m.heat < 0.25, 'half way');
  assert.equal(carcassLook(K.decay * K.cold, K).heat, 0, `cold by ${K.cold * 100} % of the decay`);
  assert.ok(Math.abs(z.dark - K.dark) < 1e-12 && Math.abs(z.sink - K.sink) < 1e-12 && z.gone, 'at the end: dark, sunk and gone');
  let h = 2; for (let t = 0; t <= K.decay; t += 1) { const l = carcassLook(t, K); assert.ok(l.heat <= h, 'it never warms again'); h = l.heat; }
}

{ const r = seeded(1), xs = Array.from({ length: 200 }, r); assert.ok(xs.every((x) => x >= 0 && x < 1) && new Set(xs).size === 200, 'the generator'); }

console.log(`boss-carcass.mjs: ${reed}, ${SEGS} pieces a limb, tips first between ${K.crumble.from * K.decay} and ${K.crumble.to * K.decay} s; the 25 mm breaks ${K.blast.rotary.cap} within ${K.blast.rotary.radius} m, the 40 mm every one within ${K.blast.bofors.radius} m, the MK-9 its ${T.nuke.radius} m ring; a broken piece gone in ${K.fling.time} s`);
