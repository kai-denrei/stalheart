// heptapod.mjs — the A6 is the first thing on this board with a life of
// its own, so its loop is the thing that has to be right: it must go home
// when it is dry, it must come back, it must not fire rounds it does not
// have, and it must not wander off the board chasing something.
import {
  A6_TUNE, magFor, makeA6, stepA6, arc, stepToward, pointNear, a6Line,
} from '../src/heptapod.js';

let failures = 0;
const check = (what, ok) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const CELL = 0.045;                 // roughly the board's own cell side
const RANGE = 4 * CELL;
const BERTH = [0, 0, 1];
// a point `cells` away from the berth along +X
const at = (cells) => {
  const a = cells * CELL;
  return [Math.sin(a), 0, Math.cos(a)];
};

// run the machine for `secs` at 60 Hz against a fixed picture
function soak(a6, secs, enemyPos, shots = [], extra = {}) {
  const ctx = {
    range: RANGE, cellSide: CELL,
    sense: () => (enemyPos ? { id: 'e1', pos: enemyPos, dist: arc(a6.pos, enemyPos) } : null),
    emit: (t) => shots.push({ t: a6.t, id: t.id }),
    rand: (() => { let n = 0; return () => ((n = (n * 9301 + 49297) % 233280) / 233280); })(),
    ...extra,
  };
  for (let i = 0; i < Math.round(secs * 60); i++) stepA6(a6, 1 / 60, ctx);
  return a6;
}

console.log('the geometry:');
{
  check('arc is radians on a unit sphere',
    Math.abs(arc([0, 0, 1], [Math.sin(0.3), 0, Math.cos(0.3)]) - 0.3) < 1e-9);
  check('a step that overshoots LANDS, it does not orbit',
    arc(stepToward([0, 0, 1], at(2), 99), at(2)) < 1e-12);
  check('a partial step gets exactly that far',
    Math.abs(arc([0, 0, 1], stepToward([0, 0, 1], at(4), 0.05)) - 0.05) < 1e-9);
  check('stepping to where you are is where you are',
    arc(stepToward([0, 0, 1], [0, 0, 1], 0.1), [0, 0, 1]) < 1e-9);
  check('a point near the berth is that far from it',
    Math.abs(arc(BERTH, pointNear(BERTH, 0.2, 1.1)) - 0.2) < 0.02);
  check('every step is still a unit vector',
    Math.abs(Math.hypot(...stepToward([0, 0, 1], at(3), 0.02)) - 1) < 1e-12);
}

console.log('the cassette:');
{
  check('six, eight, ten by tier',
    magFor(0) === 6 && magFor(1) === 8 && magFor(2) === 10);
  check('a silly tier still gives a magazine', magFor(99) === 10 && magFor(-3) === 6);
  const a6 = makeA6(BERTH, 1);
  check('it starts full and at its berth',
    a6.ammo === 8 && a6.mag === 8 && arc(a6.pos, BERTH) < 1e-12);
}

console.log('the loop:');
{
  const a6 = makeA6(BERTH, 0);
  const shots = [];
  // an enemy two cells out — inside the leash, outside the standoff. SIX
  // seconds: long enough to walk in and empty a six-round cassette, short
  // enough that it has not yet reloaded and started a second one.
  soak(a6, 6, at(2), shots);
  check(`it emptied the cassette (${shots.length} rockets)`, shots.length === 6);
  check('...and exactly one emit per round, never one more', a6.fired === shots.length);
  check('it is on its way home, dry', a6.ammo === 0 && (a6.state === 'home' || a6.state === 'refill'));
  check('the salvo was spaced, not dumped',
    shots.length > 1 && shots.every((s, i) => i === 0 || s.t !== shots[i - 1].t));

  // ...and it comes back, reloads, and starts again
  soak(a6, 24, at(2), shots);
  check('it went home and reloaded', a6.trips >= 1);
  check(`and fired again on the new magazine (${shots.length} total)`, shots.length > 6);
}

console.log('going home is unconditional:');
{
  const a6 = makeA6(BERTH, 0);
  a6.ammo = 0; a6.state = 'home';
  a6.pos = at(4);
  const shots = [];
  // a target sitting right on top of it the whole way back
  soak(a6, 6, at(4), shots);
  check('a dry A6 fires nothing, however good the target', shots.length === 0);
  check('...and it got home', a6.state === 'refill' || a6.trips >= 1);
  // the reload takes the time it says it takes
  const b = makeA6(BERTH, 0);
  b.ammo = 0;
  soak(b, A6_TUNE.refillSecs - 1, null);
  check('it is still reloading a second short', b.ammo === 0);
  soak(b, 2, null);
  check('and full a second long', b.ammo === b.mag && b.trips === 1);
}

console.log('the safety:');
{
  // A LOCK-ON WEAPON IS AIMED AND NOT ALLOWED TO SHOOT. The gate must cost
  // rockets, not merely delay them — an A6 that spends the cassette while
  // refusing to fire is worse than one with no lock at all.
  const a6 = makeA6(BERTH, 0);
  const shots = [];
  soak(a6, 6, at(2), shots, { ready: () => false });
  check('held: nothing fired', shots.length === 0 && a6.fired === 0);
  check('...and nothing spent', a6.ammo === a6.mag);
  check('...and it says why', a6.state === 'lockon');
  // ...and the salvo clock did not run down while it waited, or the first
  // shot after a lock would arrive with a free reload behind it
  soak(a6, 0.6, at(2), shots, { ready: () => true });
  check('released: it fires', shots.length >= 1);

  // the gate is only asked at the firing point — a walking A6 is not
  // "holding fire", it is walking
  const b = makeA6(BERTH, 0);
  soak(b, 0.4, at(4), [], { ready: () => false });
  check('a closing A6 is engaging, not holding', b.state === 'engage');

  check('no gate at all still fires', soak(makeA6(BERTH, 0), 6, at(2), []).fired > 0);
}

console.log('the leash:');
{
  // a target far outside the leash: it must not be chased
  const a6 = makeA6(BERTH, 0);
  const shots = [];
  let worst = 0;
  const far = at(40);
  for (let i = 0; i < 60 * 30; i++) {
    stepA6(a6, 1 / 60, {
      range: RANGE, cellSide: CELL,
      sense: () => ({ id: 'far', pos: far, dist: arc(a6.pos, far) }),
      emit: (t) => shots.push(t), rand: () => 0.3,
    });
    worst = Math.max(worst, arc(BERTH, a6.pos) / CELL);
  }
  check(`it never left the leash (${worst.toFixed(2)} cells, leash ${A6_TUNE.leash})`,
    worst <= A6_TUNE.leash + 1e-6);
  check('and never shot at something it could not reach', shots.length === 0);

  // ...but a target JUST outside the leash, within range of a spot inside
  // it, is still fair game — the leash is on where it stands, not on where
  // the enemy is
  const b = makeA6(BERTH, 0);
  const hits = [];
  const edge = at(A6_TUNE.leash + 1.5);
  for (let i = 0; i < 60 * 20; i++) {
    stepA6(b, 1 / 60, {
      range: RANGE, cellSide: CELL,
      sense: () => ({ id: 'edge', pos: edge, dist: arc(b.pos, edge) }),
      emit: (t) => hits.push(t), rand: () => 0.3,
    });
  }
  check('it walks to the fence and shoots over it', hits.length > 0);
}

console.log('patrol:');
{
  const a6 = makeA6(BERTH, 0);
  let worst = 0, moved = 0, last = a6.pos.slice();
  // HOISTED. Built inside the per-frame object literal it was re-seeded
  // every frame — a constant, not a stream — and the A6 re-picked the same
  // waypoint forever and parked on it. That was the test's bug, but it is
  // also a caller mistake worth surviving, so the module now turns the
  // bearing by the golden angle each leg regardless.
  let n = 7;
  const rand = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 60 * 40; i++) {
    stepA6(a6, 1 / 60, { range: RANGE, cellSide: CELL, sense: () => null, rand });
    worst = Math.max(worst, arc(BERTH, a6.pos) / CELL);
    moved += arc(last, a6.pos); last = a6.pos.slice();
  }
  check('with nothing to shoot it patrols', a6.state === 'patrol');
  check(`it does not park (${(moved / CELL).toFixed(0)} cells walked)`, moved / CELL > 10);
  check(`and it stays near the berth (${worst.toFixed(1)} cells)`, worst <= A6_TUNE.patrolCells + 0.6);
  check('a patrolling A6 has no target', a6.target === null);

  // A CONSTANT STREAM IS NOT A REASON TO STAND STILL.
  const b = makeA6(BERTH, 0);
  let bm = 0, bl = b.pos.slice();
  for (let i = 0; i < 60 * 40; i++) {
    stepA6(b, 1 / 60, { range: RANGE, cellSide: CELL, sense: () => null, rand: () => 0.5 });
    bm += arc(bl, b.pos); bl = b.pos.slice();
  }
  check(`it still patrols on a stubbed stream (${(bm / CELL).toFixed(0)} cells)`, bm / CELL > 10);
}

console.log('what the HUD says:');
{
  const a6 = makeA6(BERTH, 2);
  check('it names the state and the load', a6Line(a6) === 'PATROL · 10/10');
  a6.ammo = 0; a6.state = 'home';
  check('and says why it is walking away', a6Line(a6) === 'RETURNING · dry');
  a6.state = 'refill'; a6.t = 2;
  check('and how long the reload has left', a6Line(a6).startsWith('RELOADING'));
}

console.log('determinism:');
{
  const one = makeA6(BERTH, 1), two = makeA6(BERTH, 1);
  const s1 = [], s2 = [];
  soak(one, 25, at(2), s1);
  soak(two, 25, at(2), s2);
  check('the same patrol twice is the same patrol',
    JSON.stringify(one.pos) === JSON.stringify(two.pos) && s1.length === s2.length);
}

console.log('narrow engagement bands and pause:');
{
  const a6=makeA6(BERTH,0), target={id:700,pos:pointNear(BERTH,2.9*CELL,0)};
  let fired=0;
  const ctx={range:3*CELL,minRange:2.8*CELL,cellSide:CELL,sense:()=>target,
    ready:()=>true,emit:()=>fired++,rand:()=>.5};
  const before=JSON.stringify(a6);stepA6(a6,0,ctx);
  check('paused walker spends no ammo or movement',JSON.stringify(a6)===before && fired===0);
  for(let i=0;i<120;i++)stepA6(a6,1/60,ctx);
  check('a narrow valid band can fire without walking into the blind zone',fired>0 && arc(a6.pos,target.pos)>=ctx.minRange);
  const held=makeA6(BERTH,0);let spent=0;
  for(let i=0;i<600;i++)stepA6(held,1/60,{...ctx,ready:()=>false,emit:()=>spent++});
  check('unavailable launcher keeps its cassette intact',held.ammo===held.mag && spent===0);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall heptapod invariants hold');
process.exit(failures ? 1 : 0);
