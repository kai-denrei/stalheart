// boss-wave.mjs — the bait mode's first wave (2026-10-09; src/domain/boss-wave.js): N Reeds of 20 hit points, each hurt by the fight's own falloff on its nearest
// floor contact (a landing splashes, a stream burns by dt), deaths, the wave cleared when the last dies, the boss's entry once, Isao put clear of where it lands,
// the spawn ring 15 m inside the bound, the nearest Reed by its contacts.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { splashDamage } from '../src/domain/gunship.js';
import { makeWave, wavePlaces, aliveCount, hurtReed, resolveReeds, waveCleared, bossEnters, nearestReed, entryClear } from '../src/domain/boss-wave.js';

const EPS = 1e-9;
const W = T.wave;

// the content: the owner's numbers
assert.deepEqual({ ...W }, { count: 10, reedHealth: 20, size: 15, inset: 15, corpse: 2, clear: 45, budget: 10, lod: false }, 'the wave');
assert.ok(Object.isFrozen(W), 'deep-frozen');

// a wave of N: N Reeds, each whole at 20; a wave of 0 is cleared and the boss is in from the start (no entry to announce)
{
  const w = makeWave(10, T);
  assert.equal(w.count, 10); assert.equal(w.reeds.length, 10); assert.equal(aliveCount(w), 10);
  assert.ok(w.reeds.every((r) => r.hp === 20 && r.max === 20 && !r.dead), 'each Reed whole at 20');
  assert.ok(!waveCleared(w) && !bossEnters(w), 'a live wave holds the boss back');
  const z = makeWave(0, T);
  assert.ok(waveCleared(z) && z.boss && !bossEnters(z), 'a wave of 0 is the boss at once, no entry to announce');
  assert.equal(makeWave(4.6, T).count, 5, 'the count is rounded');
  assert.equal(makeWave(-3, T).count, 0, 'and never below 0');
}

// the spawn ring: evenly round the centre, `inset` inside the bound's radius
{
  const at = [7, -3], ps = wavePlaces(8, T, at, 0.3), r = T.bounds.radius - W.inset;
  assert.equal(ps.length, 8);
  for (const p of ps) assert.ok(Math.abs(Math.hypot(p[0] - at[0], p[1] - at[1]) - r) < 1e-9, `on the ring ${r} m out`);
  const a = ps.map((p) => Math.atan2(p[1] - at[1], p[0] - at[0]));
  for (let i = 0; i < 8; i++) { const d = ((a[(i + 1) % 8] - a[i]) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI); assert.ok(Math.abs(d - Math.PI / 4) < 1e-9, 'evenly spaced'); }
}

// a landing: the fight's falloff on each Reed's nearest contact; a direct 40 mm costs 4, the ring's edge nothing, the MK-9 kills every Reed within its reach
const B = T.bofors, N = T.nuke, R = T.rotary;
{
  const w = makeWave(3, T);
  const bodies = [
    { id: 0, centre: [0, 0], contacts: [[0, 0], [5, 0]] },
    { id: 1, centre: [30, 0], contacts: [[30, 0], [10, 0]] },   // a foot 10 m from the round
    { id: 2, centre: [80, 0], contacts: [[80, 0]] },            // outside the ring
  ];
  const plan = { kind: 'bofors', at: [0, 0], radius: B.radius, damage: B.damage };
  const hit = resolveReeds(w, plan, 0, bodies, 1);
  assert.equal(hit.length, 2, 'the two Reeds inside the ring are hit, the far one not');
  assert.ok(Math.abs(w.reeds[0].hp - (20 - B.damage)) < EPS, `a direct 40 mm costs ${B.damage}`);
  assert.ok(Math.abs(w.reeds[1].hp - (20 - splashDamage(10, B.radius, B.damage))) < EPS, 'the falloff on the nearest contact, not the centre');
  assert.equal(w.reeds[2].hp, 20, 'the ring\'s outside costs nothing');
  assert.equal(w.reeds[0].hits, 1);
  // five direct 40 mm rounds kill a Reed (4 x 5 = 20): dead at the clock of the fifth
  for (let k = 0; k < 4; k++) resolveReeds(w, plan, 0, bodies.slice(0, 1), 2 + k);
  assert.ok(w.reeds[0].dead && w.reeds[0].hp === 0 && w.reeds[0].diedAt === 5, `five direct rounds kill a Reed (hp ${w.reeds[0].hp})`);
  assert.equal(resolveReeds(w, plan, 0, bodies.slice(0, 1), 6).length, 0, 'a dead Reed takes nothing more');
  // the MK-9 kills every Reed within the radius where 60 x (1 - (d / 55)^2) reaches 20
  const nuke = { kind: 'nuke', at: [0, 0], radius: N.radius, damage: N.damage };
  const kill = N.radius * Math.sqrt(1 - 20 / N.damage);
  const v = makeWave(2, T);
  resolveReeds(v, nuke, 0, [{ id: 0, centre: [kill - 1, 0], contacts: [[kill - 1, 0]] }, { id: 1, centre: [kill + 1, 0], contacts: [[kill + 1, 0]] }], 3);
  assert.ok(v.reeds[0].dead && !v.reeds[1].dead, `the MK-9 kills a Reed within ${kill.toFixed(1)} m, not beyond`);
}

// a stream: dps x dt while a contact is inside its ring, one hit per Reed a stream; ~3 s of the 25 mm on a Reed kills it
let streamSeconds = 0;
{
  const w = makeWave(1, T), body = [{ id: 0, centre: [0, 0], contacts: [[3, 0]] }];
  const plan = { kind: 'rotary', at: [0, 0], radius: R.radius, damage: R.dps, moving: true };
  resolveReeds(w, plan, 0.1, body, 0);
  assert.ok(Math.abs(w.reeds[0].hp - (20 - R.dps * 0.1)) < EPS, 'a stream costs dps x dt');
  for (let t = 0.1; !w.reeds[0].dead && t < 10; t += 1 / 60) { resolveReeds(w, plan, 1 / 60, body, t); streamSeconds = t; }
  assert.ok(w.reeds[0].dead, 'the stream kills it');
  assert.ok(Math.abs(streamSeconds - 20 / R.dps) < 0.05, `in ${(20 / R.dps).toFixed(2)} s of the 25 mm (${streamSeconds.toFixed(2)})`);
  assert.equal(w.reeds[0].hits, 1, 'one hit for the whole stream');
  const away = makeWave(1, T);
  resolveReeds(away, { ...plan, at: [R.radius + 3.5, 0] }, 1, body, 0);
  assert.equal(away.reeds[0].hp, 20, 'a stream whose ring holds no contact costs nothing');
}

// deaths, the wave cleared, the boss's entry once
{
  const w = makeWave(3, T);
  assert.deepEqual(hurtReed(w, 1, 25, 4), { dealt: 20, died: true }, 'overkill deals the hit points left');
  assert.deepEqual(hurtReed(w, 1, 5, 5), { dealt: 0, died: false }, 'nothing on a dead Reed');
  assert.deepEqual(hurtReed(w, 0, -2, 5), { dealt: 0, died: false }, 'no healing');
  assert.equal(aliveCount(w), 2); assert.equal(w.killed, 1);
  hurtReed(w, 0, 20, 6);
  assert.ok(!waveCleared(w) && !bossEnters(w), 'one left: the boss waits');
  hurtReed(w, 2, 20, 7);
  assert.ok(waveCleared(w), 'the last one dead: cleared');
  assert.ok(bossEnters(w), 'the boss enters');
  assert.ok(!bossEnters(w), 'once');
}

// the nearest Reed by its nearest floor contact (its centre when none touches), and Isao put clear of the boss's landing
{
  const bodies = [{ id: 0, centre: [10, 0], contacts: [[25, 0]] }, { id: 1, centre: [30, 0], contacts: [[18, 0]] }, { id: 2, centre: [21, 0], contacts: [] }];
  assert.equal(nearestReed(bodies, [20, 0]).id, 2, 'a body with no contact counts by its centre');
  assert.equal(nearestReed(bodies.slice(0, 2), [20, 0]).id, 1, 'the nearest contact wins over the nearest centre');
  assert.equal(nearestReed([], [0, 0]), null);
  assert.equal(entryClear([50, 0], [0, 0], W.clear), null, 'beyond `clear` he stays');
  const p = entryClear([3, 4], [1, 1], W.clear);
  assert.ok(Math.abs(Math.hypot(p[0] - 1, p[1] - 1) - W.clear) < 1e-9 && Math.abs(Math.atan2(p[1] - 1, p[0] - 1) - Math.atan2(3, 2)) < 1e-9, 'nearer, he goes out along his bearing to `clear`');
  assert.deepEqual(entryClear([0, 0], [0, 0], 10), [10, 0], 'on the centre itself, east');
}

console.log(`boss-wave.mjs: ${W.count} Reeds of ${W.reedHealth} hp by default; a direct 40 mm costs ${B.damage} (five kill one), the 25 mm kills one in ${streamSeconds.toFixed(2)} s, the MK-9 every Reed within ${(N.radius * Math.sqrt(1 - W.reedHealth / N.damage)).toFixed(1)} m; cleared at the last death, the boss enters once, Isao put ${W.clear} m clear of its landing.`);
