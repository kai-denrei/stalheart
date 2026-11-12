// king-fight.mjs — THE KING'S FIGHT AS PURE RULES (src/domain/king-fight.js; owner, 2026-11-12 night: "we tune the aggro of the King so that it aims for the mechs
// and the tank ... time the shells so they a) do not deal friendly fire damage and b) stop the King in its track and funnels it to a spot where a nuke is about to
// drop"): the target choice and its hold, the tell and the charge and its hits, the 40 mm's stagger with diminishing returns and its veer, the friendly blast, the
// nuke's share and its countdown
import assert from 'node:assert/strict';
import { makeKing, pickTarget, stepKing, shellHit, nearBody, friendlyHits, nukeShare, nukeCall, short } from '../src/domain/king-fight.js';
import { ARENA_KING as T } from '../src/content/arena-king.js';

const near = (a, b, tol = 1e-6) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;

// WHO IT HUNTS: the nearest; a mech that hit it recently or the hull (the lure) is worth T.aggro.attacker / lure metres; out of range is nobody; the choice is held
{ const k = makeKing(), c = [0, 0];
  assert.equal(pickTarget(k, [{ id: 'm0', pos: [50, 0] }, { id: 'm1', pos: [80, 0] }], c, 0, T), 'm0', 'the nearest');
  const k2 = makeKing();
  assert.equal(pickTarget(k2, [{ id: 'm0', pos: [50, 0] }, { id: 'm1', pos: [80, 0], attackedAt: -1 }], c, 0, T), 'm1', 'a recent attacker within the bonus beats the nearest');
  const k3 = makeKing();
  assert.equal(pickTarget(k3, [{ id: 'm0', pos: [50, 0] }, { id: 'm1', pos: [80, 0], attackedAt: -1 - T.aggro.memory - 0.1 }], c, 0, T), 'm0', 'an old attack counts for nothing');
  const k4 = makeKing();
  assert.equal(pickTarget(k4, [{ id: 'm0', pos: [50, 0] }, { id: 'hull', pos: [85, 0], lure: true }], c, 0, T), 'hull', 'the hull is the bait');
  assert.equal(pickTarget(makeKing(), [{ id: 'm0', pos: [T.aggro.range + 1, 0] }], c, 0, T), null, 'nobody out of range');
  // the hold: a nearer one does not take it within T.aggro.hold s, it does after; a target that leaves goes at once
  const kh = makeKing(), A = { id: 'a', pos: [60, 0] }, B = { id: 'b', pos: [100, 0] };
  assert.equal(pickTarget(kh, [A, B], c, 0, T), 'a');
  A.pos = [120, 0]; B.pos = [30, 0];
  assert.equal(pickTarget(kh, [A, B], c, T.aggro.hold - 0.1, T), 'a', 'held: no flicker');
  assert.equal(pickTarget(kh, [A, B], c, T.aggro.hold + 0.1, T), 'b', 'after the hold the nearer');
  assert.equal(pickTarget(kh, [A], c, T.aggro.hold + 0.2, T), 'a', 'its target gone: the next at once');
  assert.ok(T.aggro.hold >= 3, 'a hold long enough to read'); }

// STALK, TELL, CHARGE, RECOVER: it stalks T.keep short; within T.charge.from after T.charge.stalk s, the tell (it stands); the charge at the point locked at the
// tell's start, at its speed; who is within reach on the way is hit once; recover; idle with nobody
{ const k = makeKing(); const tg = { id: 'm0', pos: [60, 0] }; let c = [0, 0], now = 0;
  const step = (dt = 0.1) => { now += dt; return stepKing(k, { now, centre: c, targets: [tg] }, T); };
  let o = step(); assert.equal(o.mode, 'stalk'); assert.ok(near(o.aim, short(tg.pos, c, T.keep)), `it stalks ${T.keep} m short`);
  while (o.mode === 'stalk' && now < 10) o = step();
  assert.equal(o.mode, 'tell', 'the tell after the stalk'); assert.ok(Math.abs(now - T.charge.stalk) < 0.15, `after ${T.charge.stalk} s within ${T.charge.from} m`);
  assert.equal(o.aim, null, 'it stands through the tell'); assert.deepEqual(o.lock, [60, 0], 'the lock is where the target stood');
  const t0 = now; tg.pos = [60, 20];   // the target steps aside during the tell
  while (o.mode === 'tell') o = step();
  assert.ok(Math.abs(now - t0 - T.charge.tell) < 0.15, `the tell lasts ${T.charge.tell} s`);
  assert.equal(o.mode, 'charge'); assert.deepEqual(o.aim, [60, 0], 'the charge goes for the locked point, not the target now');
  c = [55, 10]; o = step(); assert.deepEqual(o.hits, ['m0'], 'within reach on the way: hit'); o = step(); assert.deepEqual(o.hits, [], 'once a charge');
  c = [58, 0]; o = step(); assert.equal(o.mode, 'recover', 'arrived: recover');
  while (o.mode === 'recover') o = step();
  assert.equal(o.mode, 'stalk', 'and the stalk again');
  const k2 = makeKing(); const o2 = stepKing(k2, { now: 1, centre: [10, 0], targets: [] }, T); assert.equal(o2.mode, 'idle'); assert.deepEqual(o2.aim, [0, 0], 'nobody: the arena\'s centre');
  // a charge that never arrives ends after T.charge.max
  const k3 = makeKing(), far = { id: 'h', pos: [65, 0] }; let n3 = 0, o3;
  do { n3 += 0.1; o3 = stepKing(k3, { now: n3, centre: [0, 0], targets: [far] }, T); } while (o3.mode !== 'charge');
  const c0 = n3; do { n3 += 0.1; o3 = stepKing(k3, { now: n3, centre: [0, 0], targets: [far] }, T); } while (o3.mode === 'charge');
  assert.ok(n3 - c0 <= T.charge.max + 0.15, 'a charge ends after its max'); }

// THE 40 MM STOPS IT AND TURNS IT: a stagger cancels a tell; each one inside the recovery is shorter, then none (no stun-lock); it recovers; the veer is away
// from the burst every time, after the stagger
{ const k = makeKing(); const tg = { id: 'm0', pos: [60, 0] }; let now = 0, o;
  do { now += 0.1; o = stepKing(k, { now, centre: [0, 0], targets: [tg] }, T); } while (o.mode !== 'tell');
  const s1 = shellHit(k, [0, 0], [0, -10], now, T);
  assert.ok(Math.abs(s1.stagger - T.stagger.seconds) < 1e-9, 'the first stagger is whole'); assert.ok(near(s1.veer, [0, T.veer.metres]), 'the veer straight away from the burst');
  o = stepKing(k, { now: now + 0.1, centre: [0, 0], targets: [tg] }, T); assert.equal(o.mode, 'stagger'); assert.equal(o.aim, null, 'it stands: stopped in its tracks'); assert.equal(k.lock, null, 'the tell is cancelled');
  const s2 = shellHit(k, [0, 0], [10, 0], now + 0.2, T), s3 = shellHit(k, [0, 0], [10, 0], now + 0.3, T), s4 = shellHit(k, [0, 0], [10, 0], now + 0.4, T);
  assert.ok(s2.stagger < s1.stagger && s3.stagger < s2.stagger, `diminishing (${s1.stagger}, ${s2.stagger}, ${s3.stagger})`);
  assert.equal(s4.stagger, 0, 'then no stop at all: it cannot be stun-locked'); assert.ok(near(s4.veer, [-T.veer.metres, 0]), 'but it still turns away');
  let t = now + 0.5; while (t < now + 20 && stepKing(k, { now: t, centre: [0, 0], targets: [tg] }, T).mode === 'stagger') t += 0.05;
  assert.equal(stepKing(k, { now: t + 0.01, centre: [0, 0], targets: [tg] }, T).mode, 'veer', 'after the stagger the veer'); assert.ok(near(stepKing(k, { now: t + 0.02, centre: [0, 0], targets: [tg] }, T).aim, [-T.veer.metres, 0]), 'toward the point away from the last burst');
  const later = now + 0.4 + 4 / T.stagger.recover + 1; assert.ok(Math.abs(shellHit(k, [0, 0], [10, 0], later, T).stagger - T.stagger.seconds) < 1e-9, 'recovered: a whole stagger again');
  assert.ok(nearBody([0, 25], [0, 0], [[0, 20]], 8), 'a burst near a contact is near the body'); assert.ok(!nearBody([0, 40], [0, 0], [[0, 20]], 8), 'one far is not'); }

// THE PLAYER'S SHELLS ON FRIENDLIES: within the blast, by kind, at most once per unit per gun per `every`; the MK-9 every time; outside nothing
{ const last = new Map(), units = [{ id: 'hull', kind: 'hull', pos: [0, 0] }, { id: 'm0', kind: 'mech', pos: [15, 0] }, { id: 'm1', kind: 'mech', pos: [60, 0] }];
  const h1 = friendlyHits({ point: [5, 0], radius: 22, gun: 'bofors', units, last, now: 0 }, T);
  assert.deepEqual(h1, [{ id: 'hull', kind: 'hull', dmg: T.friendly.bofors.hull }, { id: 'm0', kind: 'mech', dmg: T.friendly.bofors.mech }], 'the two within 22 m');
  assert.deepEqual(friendlyHits({ point: [5, 0], radius: 22, gun: 'bofors', units, last, now: 0.5 }, T), [], 'the next round of the burst: no second hit');
  assert.equal(friendlyHits({ point: [5, 0], radius: 22, gun: 'bofors', units, last, now: T.friendly.bofors.every + 0.01 }, T).length, 2, 'again after `every`');
  assert.equal(friendlyHits({ point: [5, 0], radius: 55, gun: 'heavy', units, last, now: 0 }, T).length, 3, 'the MK-9: all within its blast');
  assert.equal(friendlyHits({ point: [5, 0], radius: 55, gun: 'heavy', units, last, now: 0 }, T).length, 3, 'every time');
  assert.deepEqual(friendlyHits({ point: [200, 0], radius: 22, gun: 'bofors', units, last: new Map(), now: 0 }, T), [], 'none far off');
  assert.deepEqual(friendlyHits({ point: [0, 0], radius: 22, gun: 'laser', units, last: new Map(), now: 0 }, T), [], 'an unknown gun hurts nobody'); }

// THE NUKE: a share within the blast + slack, none beyond; three good ones end it with the minor share from the rest; the countdown and its release
{ assert.equal(nukeShare([0, 0], [30, 0], 55, T), T.nuke.share); assert.equal(nukeShare([0, 0], [55 + T.nuke.slack + 1, 0], 55, T), 0, 'a miss');
  assert.ok(3 * T.nuke.share >= 0.8 && 3 * T.nuke.share < 1, 'three good nukes are most of it, not all');
  const travel = 4.2; assert.deepEqual(nukeCall(0, travel, T), { left: T.nuke.countdown, release: false });
  assert.equal(nukeCall(T.nuke.countdown - travel - 0.01, travel, T).release, false, 'held');
  assert.equal(nukeCall(T.nuke.countdown - travel, travel, T).release, true, 'released to land on the countdown');
  assert.ok(T.nuke.countdown - travel >= 2, 'several seconds of mark before the fall');
  assert.ok(T.armour > 0 && T.armour < 0.5, 'the rest is armoured'); }

console.log('King fight: the target and its hold, the tell and the charge, the 40 mm\'s stop and turn, the friendly blast, the called nuke.');
