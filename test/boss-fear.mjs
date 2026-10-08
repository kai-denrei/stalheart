// boss-fear.mjs — the creature's fright and the nuke's stun (spec 2026-10-08-boss-fight-next-round-design.md, section 2):
// what landed within reach, a fright's flee point, renewals and the disturb cooldown, the stun and its overlap with a fright.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeFear, inReach, frighten, stun, fearNow, clearFear } from '../src/domain/boss-fear.js';

const EPS = 1e-9;
const near = (a, b, msg) => assert.ok(Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS, `${msg}: ${a} vs ${b}`);
const C = [0, 0], U = [1, 0];

// the content
assert.deepEqual({ ...T.fear, weight: { ...T.fear.weight } }, { reach: 8, bofors: 1.2, after: 0.8, flee: 20, cooldown: 1, weight: { sol: 2, bofors: 1 } }, 'the fear numbers');
assert.ok(Object.isFrozen(T.fear) && Object.isFrozen(T.fear.weight), 'the fear block is deep-frozen');

// the reach: the nearest contact within radius + reach
{
  const contacts = [[100, 100], [30, 0]], radius = 22, reach = T.fear.reach;
  assert.equal(inReach([0.01, 0], radius, contacts, reach), true, 'a contact at radius + reach - 0.01 is in reach');
  assert.equal(inReach([-0.02, 0], radius, contacts, reach), false, 'a contact at radius + reach + 0.01 is not');
  assert.equal(inReach([0, 0], radius, [], reach), false, 'no contacts, no reach');
}

// a new state is calm
{
  const f = makeFear();
  assert.equal(f.threats.size, 0); assert.equal(f.stunUntil, -Infinity); assert.equal(f.lastDisturb, -Infinity); assert.equal(f.frights, 0); assert.equal(f.stuns, 0);
  assert.equal(fearNow(f, 0, C, U, T).mode, 'hunt', 'calm hunts'); assert.equal(fearNow(f, 0, C, U, T).point, null);
}

// a Bofors fright at 0 for 1.2 s: flee at 1.19, hunt at 1.21; the flee point is 20 m directly away from the threat
{
  const f = makeFear(), r = frighten(f, 'a', [0, 10], 'bofors', T.fear.bofors, 0, T);
  assert.equal(r.fresh, true); assert.equal(r.disturb, true); assert.equal(f.frights, 1);
  const a = fearNow(f, 1.19, C, U, T); assert.equal(a.mode, 'flee'); near(a.point, [0, -T.fear.flee], 'the flee point for a threat at [0, 10]');
  const b = fearNow(f, 1.21, C, U, T); assert.equal(b.mode, 'hunt'); assert.equal(b.point, null); assert.equal(f.threats.size, 0, 'an ended fright is dropped');
}

// two threats weigh by kind: SOL twice a Bofors landing
{
  const f = makeFear();
  frighten(f, 'sol', [10, 0], 'sol', 5, 0, T); frighten(f, 'bof', [0, 10], 'bofors', 5, 0, T);
  const m = Math.hypot(2, 1), p = fearNow(f, 1, C, U, T).point;
  near(p, [-2 / m * T.fear.flee, -1 / m * T.fear.flee], 'a sum of the weighted unit vectors');
  const g = makeFear(); frighten(g, 'p', [13, 4], 'sol', 5, 0, T);
  near(fearNow(g, 1, [3, 4], U, T).point, [3 - T.fear.flee, 4], 'the point is relative to the centre');
}

// a threat at the centre has no direction: the fallback is straight away from the tank
{
  const f = makeFear(); frighten(f, 'x', [0, 0], 'bofors', 2, 0, T);
  near(fearNow(f, 1, C, [0, 1], T).point, [0, -T.fear.flee], 'a threat at the centre falls back to -u * flee');
  const g = makeFear(); frighten(g, 'p', [10, 0], 'bofors', 2, 0, T); frighten(g, 'q', [-10, 0], 'bofors', 2, 0, T);
  near(fearNow(g, 1, C, [1, 0], T).point, [-T.fear.flee, 0], 'a zero sum falls back to -u * flee');
}

// a renewal (the same key, a new place) moves the threat, extends it, and is not fresh
{
  const f = makeFear();
  frighten(f, 'sol', [0, 10], 'sol', T.fear.after, 0, T);
  const r = frighten(f, 'sol', [10, 0], 'sol', T.fear.after, 0.5, T);
  assert.equal(r.fresh, false); assert.equal(r.disturb, false); assert.equal(f.frights, 1, 'a renewal is not a new fright'); assert.equal(f.threats.size, 1);
  near(fearNow(f, 1.0, C, U, T).point, [-T.fear.flee, 0], 'the renewed threat is at its new place');
  assert.equal(fearNow(f, 1.29, C, U, T).mode, 'flee', 'the renewal lasts after the first end (0.5 + 0.8)'); assert.equal(fearNow(f, 1.31, C, U, T).mode, 'hunt');
  // a shorter renewal never cuts a longer fright short: the latest end wins
  const g = makeFear(); frighten(g, 'k', [0, 10], 'bofors', 2, 0, T); frighten(g, 'k', [0, 10], 'bofors', 0.1, 0.5, T);
  assert.equal(fearNow(g, 1.9, C, U, T).mode, 'flee', 'the latest end wins');
}

// a second source while one is live is not fresh either (the creature is already running)
{
  const f = makeFear(); frighten(f, 'a', [0, 10], 'bofors', 1.2, 0, T);
  assert.equal(frighten(f, 'b', [10, 0], 'bofors', 1.2, 0.5, T).fresh, false, 'another threat while one is live is not fresh');
  assert.equal(f.frights, 1);
}

// the disturb cooldown: a fresh fright 0.5 s after the last disturb stays quiet, 1.0 s after it disturbs
{
  const f = makeFear();
  assert.equal(frighten(f, 'a', [0, 10], 'bofors', 0.3, 0, T).disturb, true); assert.equal(f.lastDisturb, 0);
  const q = frighten(f, 'b', [0, 10], 'bofors', 0.3, 0.5, T); assert.equal(q.fresh, true); assert.equal(q.disturb, false, 'inside the cooldown'); assert.equal(f.lastDisturb, 0, 'a quiet fright does not move the clock');
  const d = frighten(f, 'c', [0, 10], 'bofors', 0.3, 1.0, T); assert.equal(d.fresh, true); assert.equal(d.disturb, true, 'after the cooldown'); assert.equal(f.lastDisturb, 1.0);
  assert.equal(f.frights, 3);
}

// the stun: stun until 1.5 (a point-less mode), then the fright that began at 1.0 and lasts 1.2 s still steers at 1.6
{
  const f = makeFear(), s = stun(f, 0, T);
  assert.deepEqual(s, { disturb: true }); assert.equal(f.stunUntil, T.nuke.stun); assert.equal(f.stuns, 1); assert.equal(f.lastDisturb, 0);
  frighten(f, 'a', [0, 10], 'bofors', 1.2, 1.0, T);
  const mid = fearNow(f, 1.49, C, U, T); assert.equal(mid.mode, 'stun'); assert.equal(mid.point, null);
  const after = fearNow(f, 1.6, C, U, T); assert.equal(after.mode, 'flee'); near(after.point, [0, -T.fear.flee], 'a fright running when the stun ends steers');
  assert.equal(fearNow(f, 2.3, C, U, T).mode, 'hunt');
  assert.equal(frighten(makeFear(), 'z', [0, 5], 'bofors', 1, 0, T).disturb, true);
}

// clearFear is the round's reset
{
  const f = makeFear(); frighten(f, 'a', [0, 10], 'sol', 5, 0, T); stun(f, 0, T);
  clearFear(f);
  assert.equal(f.threats.size, 0); assert.equal(fearNow(f, 0.1, C, U, T).mode, 'hunt', 'cleared: hunting again');
  assert.equal(f.frights, 1); assert.equal(f.stuns, 1, 'the counts are the run\'s record, not cleared');
}

console.log('boss-fear.mjs: the reach, the flee point and weights, renewals, the disturb cooldown, the stun and its overlap, the reset');
