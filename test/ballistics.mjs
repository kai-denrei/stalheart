import { WEAPONS, WEAPON_IDS, applyWeapon } from './fixtures/ballistics-reference.js';
// ballistics.mjs — the sniper's physics as invariants. The whole promise of
// a sniper mechanic is that the number on the scope is the number the bullet
// obeys, so most of these are about ONE integrator answering every question:
// if the drop the HUD prints and the drop the round takes come from two
// pieces of code, the scope lies, and a scope that lies is not difficult.
import {
  BALLISTICS_TUNE, toMrad, fromMrad, windAt, launch, step, flyTo,
  zeroAngle, solution, makeShooter, stepBreath, sway, rangeFromMrad, hitsAt,
  ballisticsKnobProblems, MRAD, nextPlate,
  solveAngles, launchAngleFor, splashHits,
  refineAngle,
} from '../src/ballistics.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const T = BALLISTICS_TUNE;
const noWind = { ...T, wind: 0, gust: 0 };
const noDrag = { ...noWind, drag: 0 };

console.log('schema:');
check('knob table is sound', ballisticsKnobProblems().length === 0, ballisticsKnobProblems().join('; '));
check('mrad round-trips', Math.abs(fromMrad(toMrad(2, 800), 800) - 2) < 1e-9);
check('a milliradian is a metre at a kilometre', Math.abs(fromMrad(1, 1000) - 1) < 1e-9);

console.log('drop:');
{
  // FLAT FIRE, NO DRAG: the closed form is 0.5·g·t², and the integrator must
  // agree with it. This is the one case where an independent answer exists,
  // so it is the one case that can check the integrator itself.
  const r = flyTo(600, 0, 0, noDrag);
  const t = 600 / noDrag.muzzleVel;
  const want = -0.5 * noDrag.gravity * t * t;
  check('a level shot falls as ½gt²', Math.abs(r.drop - want) < 0.02,
    `${r.drop.toFixed(3)} vs ${want.toFixed(3)}`);
  check('...and takes the time it should', Math.abs(r.time - t) < 1e-3);

  // ...and the SHAPE holds with drag on, which is what the game flies
  const a = flyTo(400, 0, 0, noWind).drop, b = flyTo(800, 0, 0, noWind).drop;
  check('drop grows faster than range', Math.abs(b) > Math.abs(a) * 3,
    `${a.toFixed(2)} -> ${b.toFixed(2)}`);
  const fast = flyTo(800, 0, 0, { ...noWind, muzzleVel: T.muzzleVel * 2 }).drop;
  check('a faster round drops less', Math.abs(fast) < Math.abs(b) / 3);
  check('no gravity, no drop', Math.abs(flyTo(800, 0, 0, { ...noWind, gravity: 0 }).drop) < 1e-6);
  check('drag costs time', flyTo(800, 0, 0, noWind).time > flyTo(800, 0, 0, noDrag).time);
}

console.log('the zero:');
{
  const z = zeroAngle(T.zero, noWind);
  check('the zero is a small angle up', z > 0 && z < 0.05, `${(z * 1000).toFixed(2)} mrad`);
  // THE DEFINING PROPERTY: at the zero range the round is ON the sight line
  check('the round crosses the sight line AT the zero',
    Math.abs(flyTo(T.zero, z, 0, noWind).drop) < 0.02);
  // ...and the mid-range rise is real: inside the zero it is HIGH
  check('inside the zero it shoots high', flyTo(T.zero / 2, z, 0, noWind).drop > 0.1);
  check('past the zero it shoots low', flyTo(T.zero * 2, z, 0, noWind).drop < -0.5);
  // a further zero is a steeper launch
  check('a longer zero needs more angle', zeroAngle(800, noWind) > zeroAngle(300, noWind));
}

console.log('the firing solution:');
{
  const s4 = solution(T.zero, noWind), s8 = solution(800, noWind);
  check('no hold at the zero', Math.abs(s4.holdUp) < 0.1, s4.holdUp.toFixed(3));
  check('hold UP past the zero', s8.holdUp > 1, s8.holdUp.toFixed(2));
  check('hold DOWN inside it', solution(200, noWind).holdUp < 0);
  // AND IT AGREES WITH THE BULLET. If a shooter dials the solution's hold,
  // the round must land on the sight line — this is the whole promise.
  const range = 900;
  const sol = solution(range, noWind);
  const z = zeroAngle(noWind.zero, noWind);
  const held = flyTo(range, z + sol.holdUp / MRAD, 0, noWind);
  check('dialling the hold puts the round on the line',
    Math.abs(held.drop) < 0.25, `${held.drop.toFixed(3)} m at ${range} m`);
  check('an unreachable range says so', !solution(20000, noWind).reached);
}

console.log('wind:');
{
  const calm = flyTo(800, 0, 0, noWind).drift;
  const blown = flyTo(800, 0, 0, { ...T, gust: 0 }).drift;
  check('a calm shot does not drift', Math.abs(calm) < 1e-6);
  check('a cross wind pushes it', Math.abs(blown) > 1, blown.toFixed(2));
  // 90 degrees is FROM the left, so the round goes right
  check('...to the right, from the left', blown > 0);
  check('the other side pushes the other way',
    flyTo(800, 0, 0, { ...T, gust: 0, windDir: 270 }).drift < 0);
  // A HEAD WIND IS NOT A CROSS WIND. The classic mistake is to apply wind
  // as a flat lateral push; here it acts through drag on the RELATIVE
  // velocity, so a head-on wind barely moves the round sideways at all.
  check('a head wind barely deflects',
    Math.abs(flyTo(800, 0, 0, { ...T, gust: 0, windDir: 0 }).drift) < Math.abs(blown) / 10);
  check('twice the wind is about twice the drift', (() => {
    const d2 = flyTo(800, 0, 0, { ...T, gust: 0, wind: T.wind * 2 }).drift;
    return d2 > blown * 1.7 && d2 < blown * 2.3;
  })());
  check('drift grows faster than range', (() => {
    const a = Math.abs(flyTo(400, 0, 0, { ...T, gust: 0 }).drift);
    const b = Math.abs(flyTo(800, 0, 0, { ...T, gust: 0 }).drift);
    return b > a * 2.2;
  })());
  // NO DRAG MEANS NO WIND. It is the coupling; a "wind" that moved a
  // drag-free round would be a fudge, and this pins that it is not one.
  check('a drag-free round ignores the wind',
    Math.abs(flyTo(800, 0, 0, { ...T, drag: 0, gust: 0 }).drift) < 1e-6);

  // the gust breathes, and a shot held too long is a different shot
  const w0 = windAt(0, T), w1 = windAt(T.gustPeriod / 4, T);
  check('the gust changes the wind', Math.abs(Math.hypot(...w1) - Math.hypot(...w0)) > 1);
  check('...and comes back round', Math.abs(windAt(T.gustPeriod, T)[0] - w0[0]) < 1e-6);
  check('no gust is a steady wind',
    Math.abs(windAt(3, { ...T, gust: 0 })[0] - windAt(9, { ...T, gust: 0 })[0]) < 1e-9);
}

console.log('historical integrator reference cases:');
{
  // the Javelin's PHYSICS live in lockon.js; what it owes this table is a
  // name, a cadence and an honest "there is nothing to hold"
  check('the seeker is declared as one', WEAPONS.javelin.homing && WEAPONS.javelin.lock);
  const tuneFor = (id) => { const t = { ...noWind }; applyWeapon(t, id); return t; };
  // applyWeapon takes the ROUND and leaves the range alone: the wind, the
  // sway, the zero and the plate are the range's, not the weapon's
  const t2 = { ...T, wind: 33, zero: 912, swayFast: 4 };
  applyWeapon(t2, 'mortar');
  check('a weapon changes the round, not the range',
    t2.wind === 33 && t2.zero === 912 && t2.swayFast === 4 && t2.muzzleVel === 150);

  // A LASER HAS NOTHING TO SOLVE. Saying so beats printing a drop the round
  // will not take.
  const laser = solution(900, tuneFor('laser'), 0, WEAPONS.laser);
  check('a laser has no drop, no drift and no flight',
    laser.holdUp === 0 && laser.drift === 0 && laser.time === 0 && laser.reached);

  // THE RAIL GUN IS FLAT. Same range, an order of magnitude less to dial.
  const lan = solution(700, tuneFor('lancer'), 0, WEAPONS.lancer);
  const rail = solution(700, tuneFor('railgun'), 0, WEAPONS.railgun);
  check('the rail gun barely drops', Math.abs(rail.holdUp) < Math.abs(lan.holdUp) / 10,
    `${rail.holdUp.toFixed(2)} vs ${lan.holdUp.toFixed(2)}`);
  check('...and gets there far sooner', rail.time < lan.time / 3);

  // THE MORTAR LOBS. Two answers exist at that range and it takes the HIGH
  // one — a solver that assumed a single branch could not express it at all.
  const mt = tuneFor('mortar');
  const arcs = solveAngles(700, mt);
  check('a lobbed round has two answers', arcs.length === 2, arcs.map((a) => (a * 180 / Math.PI).toFixed(1)).join());
  check('...a flat one and a high one', arcs[0] < 0.4 && arcs[1] > 1.0);
  check('it takes the high one',
    Math.abs(launchAngleFor(700, mt, true) - arcs[1]) < 1e-9);
  check('...and the flat one when asked',
    Math.abs(launchAngleFor(700, mt, false) - arcs[0]) < 1e-9);
  // AND THE HIGH ONE ACTUALLY LANDS THERE — the property that makes it a
  // solution rather than a steep angle
  check('the high arc lands on the target',
    Math.abs(flyTo(700, arcs[1], 0, mt).drop) < 1.0,
    flyTo(700, arcs[1], 0, mt).drop.toFixed(3));
  check('...and takes much longer to arrive', flyTo(700, arcs[1], 0, mt).time > 5 * lan.time);
  const mort = solution(700, mt, 0, WEAPONS.mortar);
  check('the mortar reports its whole launch angle as the hold', mort.holdUp > 1000);

  // SPLASH is the mortar's answer to a wind it cannot dial away
  check('a near miss still counts with splash', splashHits(9, 0.55, 14));
  check('...and does not without', !splashHits(9, 0.55, 0));
  check('a far miss counts for nobody', !splashHits(40, 0.55, 14));

  // the memo is a memo, not a new answer
  const a1 = launchAngleFor(650, mt, true), a2 = launchAngleFor(650, mt, true);
  check('the cached answer is the same answer', a1 === a2 && Number.isFinite(a1));
}

console.log('the pop-up plate:');
{
  const rng = (() => { let a = 4414; return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }; })();
  const prev = { range: 700, bearing: 0 };
  const p1 = nextPlate(prev, rng, T, [200, 1200]);
  // THE ONE THAT MATTERS: it must MOVE, or a shooter dials once and stops
  // reading, which is the opposite of what a calibration string is for.
  check('the next plate is somewhere else',
    Math.abs(p1.range - prev.range) >= T.plateMin - 1e-9, `${p1.range.toFixed(1)}`);
  check('...but not far', Math.abs(p1.range - prev.range) <= T.plateStep + 1e-9);
  check('...and it shifts across too', p1.bearing !== prev.bearing);
  check('the shift is bounded', Math.abs(p1.bearing - prev.bearing) <= T.plateSpread / 1000 + 1e-12);

  // it never leaves the range that was set up
  let lo = Infinity, hi = -Infinity, moved = 0;
  let cur = { range: 700, bearing: 0 };
  for (let i = 0; i < 400; i++) {
    const n = nextPlate(cur, rng, T, [200, 1200]);
    if (Math.abs(n.range - cur.range) >= T.plateMin - 1e-9) moved++;
    lo = Math.min(lo, n.range); hi = Math.max(hi, n.range);
    cur = n;
  }
  check('it stays on the range it was given', lo >= 200 - 1e-9 && hi <= 1200 + 1e-9,
    `${lo.toFixed(0)}..${hi.toFixed(0)}`);
  check('every plate moves, four hundred times running', moved === 400, String(moved));
  // pushed against an end it comes back the other way rather than sticking
  const atFar = nextPlate({ range: 1200, bearing: 0 }, rng, T, [200, 1200]);
  check('at the far end it comes back', atFar.range < 1200);
  const atNear = nextPlate({ range: 200, bearing: 0 }, rng, T, [200, 1200]);
  check('at the near end it goes out', atNear.range > 200);
}

console.log('the shooter:');
{
  const sh = makeShooter();
  check('a fresh shooter has a full breath', sh.breath === 1);
  const wide = Math.hypot(...sway(1.234, sh, T));
  stepBreath(sh, 0.5, true, T);
  check('holding is holding', sh.holding && sh.breath < 1);
  const tight = Math.hypot(...sway(1.234, sh, T));
  check('a held breath steadies the reticle', tight < wide / 2, `${tight.toFixed(2)} vs ${wide.toFixed(2)}`);
  check('...but never stops it', tight > 0);
  // it RUNS OUT
  for (let i = 0; i < 200; i++) stepBreath(sh, 0.1, true, T);
  check('the breath runs out', sh.breath === 0 && !sh.holding);
  check('...and leaning on the button does not refill it', (() => {
    for (let i = 0; i < 50; i++) stepBreath(sh, 0.1, true, T);
    return sh.breath === 0;
  })());
  check('...and the reticle opens again', Math.hypot(...sway(1.234, sh, T)) > tight * 2);
  for (let i = 0; i < 200; i++) stepBreath(sh, 0.1, false, T);
  check('letting go recovers it', sh.breath === 1);

  // the sway is BOUNDED and does not repeat inside a shot
  let max = 0;
  const seen = new Set();
  const fresh = makeShooter();
  for (let t = 0; t < 30; t += 0.05) {
    const [x, y] = sway(t, fresh, T);
    max = Math.max(max, Math.hypot(x, y));
    seen.add(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  check('the sway is bounded', max <= (T.swayFast + T.swaySlow) * 1.45 + 1e-9, max.toFixed(3));
  check('...and does not trace one loop', seen.size > 500, String(seen.size));
}

console.log('the rangefinder:');
{
  // a 1.8 m target subtending 3 mrad is 600 m away
  check('known height and subtense give the range',
    Math.abs(rangeFromMrad(1.8, 3) - 600) < 1e-9);
  check('half the subtense is twice the range',
    Math.abs(rangeFromMrad(1.8, 1.5) - 1200) < 1e-9);
  check('nothing subtended is out of sight', rangeFromMrad(1.8, 0) === Infinity);
  check('it inverts toMrad', Math.abs(rangeFromMrad(1.8, toMrad(1.8, 750)) - 750) < 1e-6);
}

console.log('hits:');
{
  check('dead centre hits', hitsAt(0, 0.4));
  check('the edge hits', hitsAt(0.4, 0.4));
  check('past it misses', !hitsAt(0.41, 0.4));
}

console.log('every weapon obeys its own solution:');
{
  // THE ONE PROMISE. Dial what the HUD prints and the round arrives — for
  // each weapon, at a moment that is NOT t=0. Every one of these caught a
  // real bug: a hold solved at t0=0 and fired a second into the gust (the
  // mortar landed ten metres low), an elevation solved straight ahead then
  // swung ten degrees into the wind (seventy metres short), a beam given a
  // bullet's zero, and a lob aimed along the sight line instead of on its
  // own arc.
  for (const id of WEAPON_IDS) {
    const w = WEAPONS[id];
    const t = { ...BALLISTICS_TUNE };
    applyWeapon(t, id);
    for (const t0 of [0, 1.4, 3.9]) {
      const range = 700;
      const s2 = solution(range, t, t0, w);
      // a beam and a seeker both go where they are pointed — neither has a
      // hold to print, and saying so is the assertion
      if (w.hitscan || w.homing) {
        check(`${id} @${t0}s: ${w.homing ? 'a seeker' : 'a beam'} has no hold`,
          s2.holdUp === 0 && s2.holdSide === 0);
        continue;
      }
      // a flat weapon's hold sits ON TOP of its zero — the barrel already
      // points that much above the sight line — where a lob's hold IS the
      // whole launch angle. Firing one as if it were the other is exactly
      // the mistake the game made.
      const zed = w.loft ? 0 : zeroAngle(t.zero, t);
      const r = flyTo(range, zed + s2.holdUp / MRAD, s2.holdSide / MRAD, t, t0);
      const miss = Math.hypot(r.drop, r.drift);
      check(`${id} @${t0}s: its own solution arrives (${miss.toFixed(2)} m)`,
        r.reached && miss <= (w.splash ? 3 : 0.35));
    }
  }
  // and the lofted solve is the HIGH branch, not the flat one dressed up
  const m = { ...BALLISTICS_TUNE }; applyWeapon(m, 'mortar');
  check('a lob is solved past forty-five degrees', refineAngle(700, m, 0) > Math.PI / 4);
  check('the same question twice is the same answer',
    refineAngle(700, m, 1.4) === refineAngle(700, m, 1.4));
}

console.log(failures ? `\n${failures} FAILURES` : '\nall ballistics invariants hold');
process.exit(failures ? 1 : 0);
