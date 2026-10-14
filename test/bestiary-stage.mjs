// THE BESTIARY'S STAGE, SLOW AND FAR (owner, 2026-10-14: "bestiary; still unsatisfactory with how we represent the enemy locomotion, the appendage
// extend a tiny bit, instead of the ominous slow feeling around, everything is too rushed. we need; slower animation; longer reach, wider view - they
// have to reach further to catch the prey."; src/fx/bestiary-stage.js, src/content/bestiary.js BESTIARY_STAGE.body). The stage run in node at 60 Hz,
// every Pearl tier's pack of three for 20 s, against the same stage at the game's own numbers (every multiplier 1, the game's timing): each tier's
// stalks stretch further a hop (more than a body length on average, and half again the game's), it hops less often, it spends longer extending,
// no record is ever within the lure's lead, and the lead is more than the pack's full stalk; a pack seated far back closes on the lure before it bolts.
import assert from 'node:assert/strict';
import { createBestiaryStage } from '../src/fx/bestiary-stage.js';
import { bestiaryRoster } from '../src/domain/bestiary.js';
import { ENTRIES, BESTIARY_STAGE } from '../src/content/bestiary.js';
import { PEARL_TIERS, PEARL_OF, PEARL_GAIT } from '../src/content/pearl-enemies.js';

const roster = bestiaryRoster({ entries: ENTRIES, tiers: PEARL_TIERS, of: PEARL_OF });
const B = BESTIARY_STAGE.body, L = BESTIARY_STAGE.lure;
// 1. the named multipliers: slower (a longer cycle ceiling, a slower walk), further (a longer stride, a farther hunt point), a longer extend
assert(B.cycle > 1 && B.reach > 1 && B.lead > 1 && B.speed > 0 && B.speed < 1, `the body's multipliers (${JSON.stringify(B)})`);
const shares = Object.values(B.timing).reduce((a, b) => a + b, 0);
assert(Math.abs(shares - 1) < 1e-9, `the hop's stages share the cycle (${shares})`);
assert(B.timing.extend > PEARL_GAIT.config.timing.extend, 'a longer extend than the game\'s');
assert(L.aheadReach > 1 && L.pace > 0 && L.pace < 1, `the lure: ahead of the full stalk, a little slower than the pack (${JSON.stringify(L)})`);

const GAME = { ...BESTIARY_STAGE, body: { cycle: 1, reach: 1, speed: 1, lead: 1, timing: null } };
function watch(stage, id, secs = 20) {
  const st = createBestiaryStage({ stage }); st.show(roster.find((e) => e.id === id), { state: 'full', pack: 3 });
  const hops = [], last = []; let extend = 0, nearest = Infinity, closest = Infinity, start = null;
  for (let k = 0; k < secs * 60; k++) {
    st.step(1 / 60, 700); const s = st.state();
    s.stalks.forEach((b, i) => {
      const l = (last[i] ??= { max: 0, phase: 0 });
      if (b.phase < l.phase) { hops.push(l.max / (2 * b.radius)); l.max = 0; }
      if (b.stage === 'EXTEND' || b.stage === 'ANCHOR') l.max = Math.max(l.max, b.reach);
      if (b.stage === 'EXTEND') extend += 1 / 60 / s.stalks.length;
      l.phase = b.phase;
    });
    nearest = Math.min(nearest, s.nearest);
    const cx = s.stalks.reduce((a, b) => a + b.centre[0], 0) / 3, cz = s.stalks.reduce((a, b) => a + b.centre[1], 0) / 3, d = Math.hypot(cx - s.lure[0], cz - s.lure[1]);
    start ??= d; closest = Math.min(closest, d);
  }
  const s = st.state(); st.dispose();
  return { hops, mean: hops.reduce((a, b) => a + b, 0) / Math.max(1, hops.length), extend, nearest, ahead: s.ahead, reach: s.reach, start, closest };
}
const lines = [];
for (const e of roster.filter((x) => x.kind === 'tier')) {
  const slow = watch(BESTIARY_STAGE, e.id), game = watch(GAME, e.id);
  lines.push(`${e.id} ${game.mean.toFixed(2)} -> ${slow.mean.toFixed(2)} body lengths a hop, ${game.hops.length} -> ${slow.hops.length} hops, extending ${game.extend.toFixed(1)} -> ${slow.extend.toFixed(1)} s`);
  assert(slow.mean > 1.2, `${e.id}: the stalk stretches more than a body length a hop on average (${slow.mean.toFixed(2)})`);
  assert(slow.mean > game.mean * 1.5, `${e.id}: half again the game's reach (${game.mean.toFixed(2)} -> ${slow.mean.toFixed(2)})`);
  assert(slow.hops.length < game.hops.length * 0.7, `${e.id}: slower, fewer hops (${game.hops.length} -> ${slow.hops.length})`);
  assert(slow.extend > game.extend * 1.3, `${e.id}: a longer reach in time (${game.extend.toFixed(1)} -> ${slow.extend.toFixed(1)} s)`);
  assert(slow.ahead > slow.reach, `${e.id}: the lure's lead (${slow.ahead}) past the full stalk (${slow.reach})`);
  assert(slow.nearest >= slow.ahead - 1e-6, `${e.id}: no record within the lure's lead (${slow.nearest} < ${slow.ahead})`);
}
// the pack seated far back closes on the lure before it bolts (white, 45 s)
{ const w = watch(BESTIARY_STAGE, 'white', 45); assert(w.start - w.closest > 5, `the pack closes on the lure (${w.start.toFixed(1)} -> ${w.closest.toFixed(1)} m)`); }
console.log(`bestiary stage, slow and far (game -> stage, 20 s, a pack of three):\n  ${lines.join('\n  ')}`);
