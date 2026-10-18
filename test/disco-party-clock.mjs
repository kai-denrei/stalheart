import assert from 'node:assert/strict';
import { createPartyClock } from '../src/domain/disco-party-clock.js';
import { DAY_42 } from '../src/content/day-42.js';
const calm = { day: 42, fighting: true, secure: false, breathing: true, shot: false, seated: false, card: false, alive: true, boss: false, won: false, isaoBusy: false };
const run = (c, dt, secs, cond) => { const ev = []; for (let k = 0; k < secs / dt; k++) ev.push(...c.tick(dt, cond)); return ev; };
assert.equal(DAY_42.day, 42); assert.equal(DAY_42.seconds, 43.8); assert.equal(DAY_42.shot.at, 1.5); assert.equal(DAY_42.shot.seconds, 10);
// arms only at day 42, fighting (or secure), in a breath, with no shot, seat or card, the hull alive, not the arena, not won, Isao free
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, { ...calm, day: 41 }), []); assert.deepEqual(c.tick(0.1, { ...calm, breathing: false }), []);
  for (const k of ['shot', 'seated', 'card', 'boss', 'won', 'isaoBusy']) assert.deepEqual(c.tick(0.1, { ...calm, [k]: true }), [], `${k} holds it off`);
  assert.deepEqual(c.tick(0.1, { ...calm, alive: false }), []); assert.deepEqual(c.tick(0.1, { ...calm, fighting: false }), [], 'idle sector: no party');
  assert.deepEqual(c.tick(0.1, { ...calm, fighting: false, secure: true }), ['start'], 'a secured sector is a lull');
}
// the sequence: start at 0, the shot at shot.at, over at seconds, done lower seconds after; holding from start to over
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, calm), ['start']); assert.equal(c.holding(), true); assert.equal(c.state().phase, 'party');
  const ev = run(c, 0.1, 1.6, calm); assert.deepEqual(ev, ['shot']);
  const ev2 = run(c, 0.1, DAY_42.seconds, calm); assert.deepEqual(ev2, ['over']); assert.equal(c.holding(), false); assert.equal(c.state().phase, 'over');
  const ev3 = run(c, 0.1, DAY_42.lower + 0.2, calm); assert.deepEqual(ev3, ['done']); assert.equal(c.state().phase, 'done');
  assert.deepEqual(run(c, 0.1, 100, calm), [], 'once a run'); c.reset(); assert.equal(c.state().phase, 'idle'); assert.deepEqual(c.tick(0.1, calm), ['start'], 'a new run can party again'); }
// patience: with no breath by day 42 + patience it goes at the next free moment
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, { ...calm, day: 45, breathing: false }), []); assert.deepEqual(c.tick(0.1, { ...calm, day: 42 + DAY_42.patience, breathing: false }), ['start']); }
// over(): the host ends it early (the music ran out first); force(): the harness and the drawer arm it whatever the day, still never under a shot
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); run(c, 0.1, 5, calm); assert.deepEqual(c.over(), ['over']); assert.equal(c.state().phase, 'over'); assert.deepEqual(c.over(), [], 'idempotent'); }
{ const c = createPartyClock(DAY_42); c.force(); assert.deepEqual(c.tick(0.1, { ...calm, day: 3, breathing: false, shot: true }), []); assert.deepEqual(c.tick(0.1, { ...calm, day: 3, breathing: false }), ['start']); }
// a frozen frame (dt 0) advances nothing
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); run(c, 0.1, 1, calm); const s = c.state().t; for (let i = 0; i < 50; i++) c.tick(0, calm); assert.equal(c.state().t, s); }
console.log('disco-party-clock ok');
