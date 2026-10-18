import assert from 'node:assert/strict';
import { createPartyClock } from '../src/domain/disco-party-clock.js';
import { DAY_42 } from '../src/content/day-42.js';
const calm = { day: 42, fighting: true, secure: false, breathing: true, shot: false, seated: false, card: false, alive: true, boss: false, won: false, isaoBusy: false };
const run = (c, dt, secs, cond) => { const ev = []; for (let k = 0; k < Math.round(secs / dt); k++) ev.push(...c.tick(dt, cond)); return ev; };
// the countdown passed through to the party's 'start' (owner, 2026-10-18 round 2: thirty seconds of Isao's announcement first)
const toParty = (c, cond = calm) => run(c, 0.25, DAY_42.countdown, cond);   // quarter seconds: exact in binary, so 30 s is 30 s
assert.equal(DAY_42.day, 42); assert.equal(DAY_42.seconds, 43.8); assert.equal(DAY_42.shot.at, 1.5); assert.equal(DAY_42.shot.seconds, 10);
assert.equal(DAY_42.countdown, 30); assert.equal(DAY_42.back, 20); assert.equal(DAY_42.briefs.soon, 'day_42_soon'); assert.equal(DAY_42.briefs.back, 'day_42_back');
// arms only at day 42, fighting (or secure), in a breath, with no shot, seat or card, the hull alive, not the arena, not won, Isao free
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, { ...calm, day: 41 }), []); assert.deepEqual(c.tick(0.1, { ...calm, breathing: false }), []);
  for (const k of ['shot', 'seated', 'card', 'boss', 'won', 'isaoBusy']) assert.deepEqual(c.tick(0.1, { ...calm, [k]: true }), [], `${k} holds it off`);
  assert.deepEqual(c.tick(0.1, { ...calm, alive: false }), []); assert.deepEqual(c.tick(0.1, { ...calm, fighting: false }), [], 'idle sector: no party');
  assert.deepEqual(c.tick(0.1, { ...calm, fighting: false, secure: true }), ['announce'], 'a secured sector is a lull');
}
// THE COUNTDOWN (owner, 2026-10-18 round 2): armed, the clock announces (Isao's "we need to celebrate") and holds the sector clock from
// there; 'back' ("come back to the base") at `back` seconds in, ten before the party; 'start' at `countdown`; nothing else in between
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, calm), ['announce']); assert.equal(c.state().phase, 'countdown'); assert.equal(c.holding(), true, 'the hold begins with the announcement');
  assert.deepEqual(run(c, 0.25, 19.75, calm), [], 'nothing before the second line'); assert.equal(c.state().t, 19.75);
  assert.deepEqual(run(c, 0.25, 0.25, calm), ['back'], 'the second line at 20 s'); assert.equal(c.state().phase, 'countdown');
  assert.deepEqual(run(c, 0.25, 9.75, calm), [], 'nothing between'); assert.deepEqual(run(c, 0.25, 0.25, calm), ['start'], 'the party at 30 s');
  assert.equal(c.state().phase, 'party'); assert.equal(c.state().t, 0); assert.equal(c.holding(), true); }
// one big step still says every line in order
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); assert.deepEqual(c.tick(31, calm), ['back', 'start']); }
// the countdown is an invitation: a seat, a shot, a card, Isao busy or a breath gone does NOT cancel it (the cut at 1.5 s asks the seat and the shot again)
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); const busy = { ...calm, seated: true, shot: true, card: true, isaoBusy: true, breathing: false, fighting: false };
  assert.deepEqual(toParty(c, busy), ['back', 'start'], 'seated and under a shot: the countdown runs on'); assert.equal(c.state().phase, 'party'); }
// a hull death or the win during the countdown cancels it quietly: no party this run, the hold released
for (const k of ['alive', 'won']) { const c = createPartyClock(DAY_42); c.tick(0.1, calm); run(c, 0.1, 5, calm);
  assert.deepEqual(c.tick(0.1, { ...calm, [k]: k === 'won' }), ['cancel'], `${k}: cancelled`); assert.equal(c.state().phase, 'done'); assert.equal(c.holding(), false);
  assert.deepEqual(run(c, 0.1, 60, calm), [], `${k}: no party after`); }
// the sequence: start at 0, the shot at shot.at, over at seconds, done lower seconds after; holding from the announcement to over
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, calm), ['announce']); assert.deepEqual(toParty(c), ['back', 'start']); assert.equal(c.holding(), true); assert.equal(c.state().phase, 'party');
  const ev = run(c, 0.1, 1.6, calm); assert.deepEqual(ev, ['shot']);
  const ev2 = run(c, 0.1, DAY_42.seconds, calm); assert.deepEqual(ev2, ['over']); assert.equal(c.holding(), false); assert.equal(c.state().phase, 'over');
  const ev3 = run(c, 0.1, DAY_42.lower + 0.2, calm); assert.deepEqual(ev3, ['done']); assert.equal(c.state().phase, 'done');
  assert.deepEqual(run(c, 0.1, 100, calm), [], 'once a run'); c.reset(); assert.equal(c.state().phase, 'idle'); assert.deepEqual(c.tick(0.1, calm), ['announce'], 'a new run can party again'); }
// patience: with no breath by day 42 + patience it goes at the next free moment
{ const c = createPartyClock(DAY_42); assert.deepEqual(c.tick(0.1, { ...calm, day: 45, breathing: false }), []); assert.deepEqual(c.tick(0.1, { ...calm, day: 42 + DAY_42.patience, breathing: false }), ['announce']); }
// over(): the host ends it early (the music ran out first), never in the countdown; force(): the harness and the drawer arm it whatever the day, still never under a shot
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); assert.deepEqual(c.over(), [], 'no over in the countdown'); toParty(c); run(c, 0.1, 5, calm); assert.deepEqual(c.over(), ['over']); assert.equal(c.state().phase, 'over'); assert.deepEqual(c.over(), [], 'idempotent'); }
{ const c = createPartyClock(DAY_42); c.force(); assert.deepEqual(c.tick(0.1, { ...calm, day: 3, breathing: false, shot: true }), []); assert.deepEqual(c.tick(0.1, { ...calm, day: 3, breathing: false }), ['announce']); }
// a frozen frame (dt 0) advances nothing, in the countdown or the party
{ const c = createPartyClock(DAY_42); c.tick(0.1, calm); run(c, 0.1, 1, calm); let s = c.state().t; for (let i = 0; i < 50; i++) c.tick(0, calm); assert.equal(c.state().t, s);
  toParty(c); run(c, 0.1, 1, calm); s = c.state().t; for (let i = 0; i < 50; i++) c.tick(0, calm); assert.equal(c.state().t, s); }
console.log('disco-party-clock ok');
