import assert from 'node:assert/strict';
import { pulseFits, sectorDef, makeSector, releaseWave, nextWaveIndex, breachLive, closeBreach, spendBreach, isSecure, summary, forfeitOf, waveYield, pickBreachCells, CLOSERS } from '../src/domain/sectors.js';
import { SECTORS, SECTOR_GENERATOR, SECTOR_PLACEMENT, SECTOR_FORFEIT, BELT_OF, BELTS, BREACH_CLOSERS, SECTOR_STATS, SECTOR_TIMING } from '../src/content/sectors.js';
import { ENEMY_SPEC, CREATURE_TINTS, SAFE_HUES, ALARM_HUES, computeWavePlan } from '../src/enemyspec.js';
import { waveClearBonus } from '../src/domain/economy.js';
import { POINT_SCALE, waveScore } from '../src/score.js';
import { mulberry32 } from '../src/rng.js';
import { SENTRY_ORDER } from '../src/content/sentries.js';

// the authored table is the spec's
assert.deepEqual(SECTORS.map((s) => [s.n, s.name, s.breaches, s.waves, s.threat]), [
  [1, 'THE LANE', { gate: 2 }, 6, 1.8], [2, 'THE BACK DOOR', { back: 1, gate: 1 }, 6, 2.8], [3, 'BOTH WALLS', { gate: 1, back: 1 }, 8, 2.2]]);
assert.deepEqual(Object.keys(SECTORS[1].breaches), ['back', 'gate'], 'the back door sector picks and opens its back breach first');
assert.ok(SECTORS.every((s) => s.pulse > 0), 'every sector keeps its own clock');
assert.ok(SECTORS[1].feast.entries.every((e) => ENEMY_SPEC[e.type].rammable), 'the feast is all soft bodies');
assert.deepEqual(SECTORS.map((s) => [s.backDoor, s.laser, s.hardcoresEveryWave]), [[false, false, false], [true, true, false], [true, true, true]]);
assert.ok(Object.isFrozen(SECTORS[0].breaches) && Object.isFrozen(SECTOR_GENERATOR.sides[0]), 'content is frozen through');
for (const s of SECTORS) assert.ok(s.held.kg > 0 && s.held.points > 0 && s.brief.length === 2, `${s.name}: a held bonus and two lines`);
assert.ok(SECTOR_PLACEMENT.minSeparationCells > SECTOR_PLACEMENT.exclusionCells);
assert.deepEqual(Object.keys(BREACH_CLOSERS).sort(), [...CLOSERS, 'held'].sort());
assert.deepEqual(SECTOR_STATS.towers, [...SENTRY_ORDER]);

// the belts follow the tints: every enemy has one, on the right side of the ram line
const hueName = (hex) => Object.entries({ ...SAFE_HUES, ...ALARM_HUES }).find(([, h]) => h === hex)[0].replace(/Pale|Deep/, '');
for (const type of Object.keys(ENEMY_SPEC)) {
  assert.ok(BELTS.includes(BELT_OF[type]), `${type} has a belt`);
  assert.equal(BELT_OF[type], hueName(CREATURE_TINTS[type]), `${type}'s belt is its tint`);
  assert.equal(BELTS.indexOf(BELT_OF[type]) < BELTS.indexOf('orange'), Object.values(SAFE_HUES).includes(CREATURE_TINTS[type]), `${type}: rammable belts sit below orange`);
}

// sectorDef: authored rows continue the wave ladder, generated rows grow
const def = (n) => sectorDef(n, SECTORS, SECTOR_GENERATOR);
assert.deepEqual([1, 2, 3].map((n) => def(n).waveBase), [0, 1, 6], 'each sector starts the ladder where content says');
assert.ok([1, 2, 3, 4, 9].every((n) => def(n).ladderCap === SECTOR_GENERATOR.ladderCap), 'one ladder cap for every sector');
for (const n of [1, 2, 3, 4, 5, 6]) assert.ok(def(n).waveBase + 1 <= def(n).ladderCap, `sector ${n}: the first wave sits under the cap`);
assert.equal(def(0).n, 1, 'n below one is sector one');
assert.equal(def(2).name, 'THE BACK DOOR');
const gen = [4, 5, 6].map(def);
assert.deepEqual(gen.map((d) => d.n), [4, 5, 6]);
assert.deepEqual(gen.map((d) => d.name), ['SECTOR 4', 'SECTOR 5', 'SECTOR 6']);
assert.deepEqual(gen.map((d) => d.waves), [9, 10, 11], 'waves wavesBase + n past the table');
assert.ok(gen.every((d) => d.pulse === SECTORS[2].pulse), 'the clock carries over');
assert.deepEqual(gen.map((d) => d.threat), [2.35, 2.5, 2.65], 'threat +0.15 a sector');
assert.deepEqual(gen.map((d) => d.breaches), [{ gate: 2 }, { back: 2 }, { gate: 2 }], 'the pair alternates sides');
assert.deepEqual(gen.map((d) => d.waveBase), [6, 6, 6], 'generated sectors start the ladder where sector 3 did');
assert.ok(gen.every((d) => d.laser && d.backDoor && d.hardcoresEveryWave && d.new === null), 'flags carry over, nothing new');
assert.ok(gen.every((d) => Object.values(d.breaches).reduce((a, b) => a + b, 0) === 2), 'two breaches each');
assert.ok(gen[1].held.kg > gen[0].held.kg && gen[2].held.points > gen[1].held.points, 'the held bonus grows');

// THE CLIMB (owner, 2026-09-16: "slow start, then it should start getting hectic... hundreds of low levels, a few more hardcores").
// Sector 1 opens gently and every sector's biggest wave beats the last one's, through the invasion surge the old ladder cap held
// every programme below — which is what made the late waves SHRINK instead of swell.
{
  const bodies = (d, i) => computeWavePlan(Math.min(d.ladderCap, d.waveBase + i), 1, 4, d.threat).entries.reduce((n, e) => n + e.count, 0)
    + (d.hardcoresEveryWave ? d.hardcores ?? 1 : 0);
  const alive = (d, i) => bodies(d, i) * Object.values(d.breaches).reduce((a, b) => a + b, 0);
  const peaks = [1, 2, 3, 4, 5, 6].map((n) => { const d = def(n); return Math.max(...Array.from({ length: d.waves }, (_, k) => alive(d, k + 1))); });
  // sector 0 (the Stålheart's construction) is the gentle start now; sector 1 is the tank's first real fight (owner, 2026-09-24:
  // "too slow between enemies, not hectic enough"), so it opens with a crowd but still well under what the lane will bring
  assert.ok(alive(def(1), 1) <= 30, `sector 1 opens with a crowd, not a flood (${alive(def(1), 1)} alive)`);
  for (let i = 1; i < peaks.length; i++) assert.ok(peaks[i] > peaks[i - 1], `sector ${i + 1} peaks harder than the one before (${peaks})`);
  assert.ok(peaks[2] >= 300, `sector 3 fights in the hundreds (${peaks[2]})`);
  assert.ok(Math.max(...peaks) <= 520, `...and never past the frame budget this machine holds (${peaks})`);
  assert.equal(SECTORS[2].hardcores, 2, 'a few hard cores a wave, not the twenty the surge throws in on its own');
}

// the clock's guard: a pulse arms while it fits, and an empty field always takes the next one
assert.equal(pulseFits(100, 120, 520), true);
assert.equal(pulseFits(400, 121, 520), false, 'a pulse that would crowd past the budget waits');
assert.equal(pulseFits(0, 900, 520), true, 'an empty field never stalls on a big pulse');
{
  const pulse = (d, i) => (computeWavePlan(Math.min(d.ladderCap, d.waveBase + i), 1, 4, d.threat).entries.reduce((n, e) => n + e.count, 0) + (d.hardcoresEveryWave ? d.hardcores ?? 1 : 0)) * Object.values(d.breaches).reduce((a, b) => a + b, 0);
  for (const n of [1, 2, 3, 4, 5, 6]) { const d = def(n); for (let i = 1; i <= d.waves; i++) assert.ok(pulse(d, i) <= SECTOR_TIMING.aliveBudget, `sector ${n} pulse ${i} fits the budget on an empty field`); }
}

// the programme: release, close, spend
const d2 = def(2);
const st = makeSector(d2, [{ id: 'g', side: 'gate', cell: 10 }, { id: 'b', side: 'back', cell: 20 }], 100);
assert.equal(st.breaches.length, 2);
assert.ok(breachLive(st, 'g') && breachLive(st, 'b') && !breachLive(st, 'x'));
assert.equal(nextWaveIndex(st, 'g'), 2, 'sector 2 starts at ladder wave 2');
assert.equal(spendBreach(st, 'g', 101), null, 'a breach with waves to send cannot be spent');
const waves = [];
for (let i = 0; i < 8; i++) waves.push(releaseWave(st, 'g', 100 + i));
assert.deepEqual(waves, [{ wave: 2, last: false }, { wave: 3, last: false }, { wave: 4, last: false }, { wave: 5, last: false }, { wave: 6, last: false }, { wave: 7, last: true }, null, null]);
{
  const s4 = makeSector(def(4), [{ id: 'a', side: 'gate', cell: 1 }], 0);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => releaseWave(s4, 'a', i).wave), [7, 8, 9, 10, 11, 11], 'a long programme repeats its top wave at the cap');
}
assert.equal(nextWaveIndex(st, 'g'), null);
assert.equal(isSecure(st, 0), false, 'open breaches keep the sector unsecure');
assert.deepEqual(spendBreach(st, 'g', 140), d2.held, 'held pays the bonus');
assert.equal(st.breaches[0].closedBy, 'held');
assert.equal(breachLive(st, 'g'), false);
assert.equal(spendBreach(st, 'g', 141), null, 'spent once');
assert.equal(closeBreach(st, 'g', 'laser', 141, { kg: 9, points: 9 }), null, 'a spent breach cannot be closed');
releaseWave(st, 'b', 110);
assert.equal(closeBreach(st, 'b', 'teeth', 120), null, 'an unknown closer is refused');
const closed = closeBreach(st, 'b', 'laser', 120, { kg: 88.4, points: 912.6 });
assert.equal(closed.closedBy, 'laser');
assert.deepEqual(closed.leftInField, { kg: 88, points: 913 });
assert.equal(releaseWave(st, 'b', 121), null, 'a closed breach sends nothing');
assert.equal(nextWaveIndex(st, 'b'), null);
assert.equal(isSecure(st, 3), false, 'the sector is alive while its enemies are');
assert.equal(isSecure(st, 0), true);
assert.deepEqual(summary(st), { sector: 2, name: 'THE BACK DOOR', breaches: 2, open: 0, closed: 1, spent: 1, wavesPlanned: 12, wavesReleased: 7, leftInField: { kg: 88, points: 913 }, bonus: d2.held });
// a breach whose whole programme is out forfeits nothing when it is closed
const st2 = makeSector(def(1), [{ id: 'a', side: 'gate', cell: 1 }], 0);
for (let i = 0; i < def(1).waves; i++) releaseWave(st2, 'a', i);
assert.deepEqual(closeBreach(st2, 'a', 'shells', 5, { kg: 50, points: 50 }).leftInField, { kg: 0, points: 0 });

// forfeit: an estimator built the way the integrator will, and more owed waves forfeit more
const bounty = Object.fromEntries(Object.entries(ENEMY_SPEC).map(([k, s]) => [k, s.bounty]));
const estimate = (i, threat) => waveYield(computeWavePlan(i, 1, 4, threat), { bounty, pointScale: POINT_SCALE, ...SECTOR_FORFEIT, clearKg: waveClearBonus(i), clearPoints: waveScore(i) });
const plan1 = computeWavePlan(1, 1, 4);
assert.equal(estimate(1, 1).kg, plan1.entries.reduce((s, e) => s + e.count * bounty[e.type], 0) + waveClearBonus(1));
assert.deepEqual(waveYield({ counts: Object.fromEntries(plan1.entries.map((e) => [e.type, e.count])) }, { bounty }), waveYield(plan1, { bounty }), 'counts and entries agree');
const d3 = def(3);
const owed = Array.from({ length: d3.waves + 1 }, (_, released) => forfeitOf({ wavesPlanned: d3.waves, wavesReleased: released, waveIndexBase: d3.waveBase, ladderCap: d3.ladderCap, threat: d3.threat }, estimate));
for (let i = 1; i < owed.length; i++) assert.ok(owed[i].kg < owed[i - 1].kg && owed[i].points < owed[i - 1].points, `forfeit falls as waves are fought (${i})`);
assert.deepEqual(owed[d3.waves], { kg: 0, points: 0 }, 'nothing owed after the last wave');
assert.ok(owed[0].kg > 100 && owed[0].points > 1000, 'a whole sector-3 programme is worth real income');
const seen = [];
forfeitOf({ wavesPlanned: 4, wavesReleased: 1, waveIndexBase: 3, threat: 1.3 }, (i, th) => { seen.push([i, th]); return { kg: 1, points: 1 }; });
assert.deepEqual(seen, [[5, 1.3], [6, 1.3], [7, 1.3]], 'the estimator sees each owed ladder wave and the threat');
seen.length = 0;
forfeitOf({ wavesPlanned: 6, wavesReleased: 3, waveIndexBase: 3, ladderCap: 8, threat: 2 }, (i, th) => { seen.push([i, th]); return { kg: 1, points: 1 }; });
assert.deepEqual(seen, [[7, 2], [8, 2], [8, 2]], 'the forfeit is sized at the capped ladder waves');

// placement: a ring of candidates, hops rising with angle; positions on a unit circle
const cands = [];
for (let i = 0; i < 72; i++) {
  const a = (i / 72) * Math.PI * 2;
  cands.push({ cell: i, side: i < 36 ? 'gate' : 'back', hops: 40 + (i % 36), pos: [Math.cos(a), Math.sin(a), 0] });
}
const arc = 2 * Math.sin(Math.PI / 72);   // neighbour spacing
const far = pickBreachCells({ candidates: cands, want: { gate: 1, back: 1 }, minSeparation: 3 * arc });
assert.deepEqual(far.map((p) => [p.cell, p.side, p.relaxed]), [[35, 'gate', false], [71, 'back', false]], 'farthest first per side');
const two = pickBreachCells({ candidates: cands, want: { gate: 2 }, minSeparation: 5 * arc });
assert.equal(two.length, 2);
assert.ok(Math.hypot(...two[0].pos.map((x, k) => x - two[1].pos[k])) >= 5 * arc, 'two on one side stand apart');
assert.equal(two[0].cell, 35); assert.ok(two[1].cell <= 30, 'the second is the farthest clear of the first');
const withExcl = pickBreachCells({ candidates: cands, want: { gate: 1 }, exclusion: 2.5 * arc, excluded: [cands[35].pos] });
assert.ok(withExcl[0].cell <= 32, 'never within the exclusion radius of a sealed breach');
const seeded = (seed) => pickBreachCells({ candidates: cands, want: { gate: 1, back: 1 }, minSeparation: 3 * arc, bandHops: 10, rng: mulberry32(seed) }).map((p) => p.cell);
assert.deepEqual(seeded(7), seeded(7), 'deterministic for a seed');
assert.ok([1, 2, 3, 4, 5, 6, 7, 8].some((s) => seeded(s).join() !== seeded(7).join()), 'the band lets seeds differ');
for (const s of [1, 2, 3]) assert.ok(seeded(s).every((c) => cands[c].hops >= 65), 'a seeded pick stays within the band');
const cramped = pickBreachCells({ candidates: cands.slice(0, 2), want: { gate: 2 }, minSeparation: 10 });
assert.deepEqual(cramped.map((p) => p.relaxed), [false, true], 'separation relaxes rather than leaving a side short');
assert.deepEqual(pickBreachCells({ candidates: cands.slice(0, 2), want: { back: 1 }, minSeparation: 0 }), [], 'no candidate, no pick');
console.log('Sectors: authored and generated defs, the programme released, closed and spent, the forfeit estimate, the secure test, placement.');
