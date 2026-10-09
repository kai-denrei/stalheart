// boss-gun-fear.mjs — the bait mode's fear per gun (wave B, 2026-10-09; src/domain/boss-fear.js `barrage`, `scare`, `flightNow`): the 25 mm's barrage meter
// fills and drains and tips into a flinch, the 40 mm sends the creature wild and the MK-9 into a panic, a fresh hit extends the flight and re-aims it from
// the newest impact, the stronger level wins, the flee point runs away from the impact, the stun is its own knob, the tank mode's rule is untouched.
import assert from 'node:assert/strict';
import { BOSS_FIGHT as T } from '../src/content/boss-fight.js';
import { makeFear, barrage, scare, flightNow, meterNow, stun, clearFear, frighten, fearNow } from '../src/domain/boss-fear.js';

const EPS = 1e-9, G = T.gunFear, C = [0, 0], U = [1, 0];
const near = (a, b, msg) => assert.ok(Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, `${msg}: ${a} vs ${b}`);

// the content: the owner's numbers (2026-10-09), deep-frozen
assert.deepEqual(JSON.parse(JSON.stringify(G)), {
  rotary: { amount: 0.06, drain: 0.5, flee: 10, duration: 0.8, speed: 1.3, erratic: 0 },
  bofors: { flee: 35, duration: 2.5, speed: 2, erratic: 2 },
  nuke: { flee: 50, duration: 3.5, speed: 2.5, erratic: 1, stun: 0 },
}, 'the fear per gun');
assert.ok(Object.isFrozen(G) && Object.isFrozen(G.rotary) && Object.isFrozen(G.nuke), 'deep-frozen');
assert.equal(T.nuke.stun, 1.5, 'the tank mode keeps its 1.5 s stun');

// the meter: +amount a round, drained `drain` a second; at 1 a flinch and the meter back at 0
let roundsToTip = 0;
{
  const f = makeFear();
  assert.equal(barrage(f, [5, 0], 0, T), null, 'one round does not tip it');
  assert.ok(Math.abs(meterNow(f, 0, T) - G.rotary.amount) < EPS, 'one round is `amount`');
  assert.ok(Math.abs(meterNow(f, 0.1, T) - (G.rotary.amount - G.rotary.drain * 0.1)) < EPS, 'drained at `drain` a second');
  assert.equal(meterNow(f, 10, T), 0, 'and never below 0');
  // a sustained barrage at 30 rounds a second (the game's 25 mm): it tips in under a second
  const g = makeFear();
  let r = null, t = 0;
  for (; t < 5 && !r; t += 1 / 30) { r = barrage(g, [5, 0], t, T); roundsToTip++; }
  assert.ok(r && r.level === 'flinch' && r.fresh, `a sustained barrage tips the meter into a flinch (${roundsToTip} rounds)`);
  assert.ok(roundsToTip > 1 / G.rotary.amount && roundsToTip < 2 / G.rotary.amount, `in ${roundsToTip} rounds: more than 1 / amount for the drain, under twice that`);
  assert.equal(g.meter, 0, 'the meter is reset at the flinch');
  const fl = flightNow(g, t, C, U);
  assert.equal(fl.mode, 'flee'); assert.equal(fl.flight.level, 'flinch'); assert.equal(fl.flight.speed, G.rotary.speed);
  near(fl.point, [-G.rotary.flee, 0], 'the flinch runs `flee` m straight away from the impact');
  assert.equal(flightNow(g, t - 1 / 30 + G.rotary.duration + 0.01, C, U).mode, 'hunt', 'and ends after its duration');
  // rounds a second apart never tip it (the drain wins)
  const h = makeFear();
  for (let i = 0; i < 100; i++) assert.equal(barrage(h, [5, 0], i, T), null, 'a round a second never tips the meter');
}

// the 40 mm: wild, `flee` 35 m away from the impact for 2.5 s at twice the chase speed, the erratic motion up
{
  const f = makeFear(), r = scare(f, 'bofors', [0, 10], 0, T);
  assert.deepEqual(r, { level: 'wild', fresh: true, escalated: false, disturb: true });
  const a = flightNow(f, 2.49, [0, 0], U);
  assert.equal(a.mode, 'flee'); near(a.point, [0, -G.bofors.flee], 'away from the impact at [0, 10]');
  assert.equal(a.flight.speed, 2); assert.equal(a.flight.erratic, 2);
  near(flightNow(f, 1, [10, 10], U).point, [10 + G.bofors.flee, 10], 'the point is re-read from the centre as it moves (away from the impact)');
  assert.equal(flightNow(f, 2.51, C, U).mode, 'hunt', 'it ends at 2.5 s');
  assert.equal(f.flight, null, 'an ended flight is dropped');
}

// a fresh hit extends the flight and re-aims it from the newest impact
{
  const f = makeFear();
  scare(f, 'bofors', [0, 10], 0, T);
  const r = scare(f, 'bofors', [10, 0], 2, T);
  assert.equal(r.fresh, false); assert.equal(r.disturb, false, 'a renewal does not disturb');
  near(flightNow(f, 3, C, U).point, [-G.bofors.flee, 0], 're-aimed from the newest impact');
  assert.equal(flightNow(f, 4.49, C, U).mode, 'flee', 'extended to 2 + 2.5 s');
  assert.equal(flightNow(f, 4.51, C, U).mode, 'hunt');
  assert.equal(f.scares.wild, 2, 'both scares are counted');
}

// levels: a stronger hit takes the flight over, a weaker one keeps its numbers but re-aims it (and extends only to its own end)
{
  const f = makeFear();
  scare(f, 'bofors', [0, 10], 0, T);
  const up = scare(f, 'nuke', [10, 0], 1, T);
  assert.equal(up.escalated, true);
  let fl = flightNow(f, 1.5, C, U).flight;
  assert.equal(fl.level, 'panic'); assert.equal(fl.speed, 2.5); assert.equal(fl.flee, 50); assert.ok(Math.abs(fl.until - (1 + 3.5)) < EPS, 'the panic runs 3.5 s from its hit');
  const down = scare(f, 'bofors', [0, -10], 2, T);
  assert.equal(down.escalated, false);
  fl = flightNow(f, 2.5, C, U).flight;
  assert.equal(fl.level, 'panic', 'a 40 mm in a panic keeps the panic'); assert.ok(Math.abs(fl.until - 4.5) < EPS, 'and its later end');
  near(flightNow(f, 2.5, C, U).point, [0, 50], 're-aimed from the 40 mm');
  const fl2 = makeFear(); scare(fl2, 'rotary', [0, 10], 0, T);
  assert.equal(scare(fl2, 'bofors', [0, 10], 0.1, T).escalated, true, 'a flinch becomes wild');
}

// the impact on the centre: away from the bait (-u); the stun is the bait mode's own knob (0 by default: the caller does not stun), and wins while it lasts
{
  const f = makeFear(); scare(f, 'nuke', [0, 0], 0, T);
  near(flightNow(f, 1, C, [0, 1]).point, [0, -50], 'an impact on the centre runs away from the bait');
  const g = makeFear(); scare(g, 'nuke', [10, 0], 0, T); stun(g, 0, T, 1);
  assert.equal(flightNow(g, 0.5, C, U).mode, 'stun', 'a stun wins while it lasts');
  assert.equal(flightNow(g, 1.5, C, U).mode, 'flee', 'and the panic runs on after it');
  assert.equal(g.stuns, 1);
}

// the reset: no flight, the meter empty, the counts kept; the tank mode's fright is the rule it was (a frighten's flee point, no flight)
{
  const f = makeFear(); scare(f, 'bofors', [0, 10], 0, T); barrage(f, [0, 10], 0.1, T);
  clearFear(f);
  assert.equal(f.flight, null); assert.equal(meterNow(f, 0.2, T), 0); assert.equal(f.scares.wild, 1);
  assert.equal(flightNow(f, 0.2, C, U).mode, 'hunt');
  const g = makeFear(); frighten(g, 'a', [0, 10], 'bofors', T.fear.bofors, 0, T);
  assert.equal(g.flight, null, 'a tank-mode fright starts no flight');
  near(fearNow(g, 1, C, U, T).point, [0, -T.fear.flee], 'and steers as before');
}

console.log(`boss-gun-fear.mjs: the 25 mm meter tips in ${roundsToTip} rounds of a 30 a second barrage (+${G.rotary.amount} a round, -${G.rotary.drain}/s) into a ${G.rotary.flee} m, ${G.rotary.duration} s flinch; the 40 mm wild ${G.bofors.flee} m for ${G.bofors.duration} s at x${G.bofors.speed}; the MK-9 panic ${G.nuke.flee} m for ${G.nuke.duration} s at x${G.nuke.speed}, stun ${G.nuke.stun} s; renewals re-aim and extend, the stronger level wins.`);
