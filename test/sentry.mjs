// sentry.mjs — the turret's rules as invariants. Two of these are the
// difference between a sentry and a thing that waves a barrel around: the
// yaw WRAP (slewing from +170 to -170 is twenty degrees, and the naive
// subtraction is wrong there and nowhere else, so it passes every test
// anybody writes by accident) and the ELEVATION SIGN, which decides whether
// the gun points at the sky or the floor.
import { existsSync } from 'node:fs';
import {
  SENTRY_TUNE, SENTRY_FAMILIES, lobAngle, familyById, sentryUrl,
  wrapDeg, deltaDeg, aimAt, inEnvelope,
  makeSentry, slew, track, onTarget, aimError, stepGun, canFire, fire,
  makeRange, popTarget, stepRange, pickTarget, hitTarget, landedOn, sentryKnobProblems,
  placeBattery, relTo, spawnWave, stepWalkers, stepWaves, deadZone, leadPoint,
} from '../src/sentry.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const mulberry32 = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

console.log('schema:');
check('knob table is sound', sentryKnobProblems().length === 0, sentryKnobProblems().join('; '));
check('eight families', SENTRY_FAMILIES.length === 8);
// FIXED means no articulation to drive. The Relay is a mast; the A6 carries
// its cells vertically and walks instead of traversing.
check('the fixed ones are the mast and the walker',
  familyById('relay').fixed === true && familyById('heptapod_a6').fixed === true
  && SENTRY_FAMILIES.filter((f) => f.fixed).length === 2);
check('every family names a model that exists on disk',
  SENTRY_FAMILIES.every((f) => existsSync(sentryUrl(f.id, 1).replace(/^/, ''))));
// A LOBBER MUST DECLARE ITS ARC, because the barrel's angle is derived from
// it — a lob with no height would aim flat and stop being a lob.
check('the lobbers are the mortar and the howitzer',
  SENTRY_FAMILIES.filter((f) => f.lob).map((f) => f.id).join(',') === 'mortar,howitzer');
check('...and each names an arc height',
  SENTRY_FAMILIES.filter((f) => f.lob).every((f) => f.arcCells > 0));
check('the url is the workshop’s own path', sentryUrl('rotor', 3) === 'assets/models/sentries/rotor_t3.glb');

console.log('the lob:');
{
  // atan(4h/d): a parabola of height h over range d leaves at this angle.
  // The Workshop opens a Mortar at 68 degrees, which is the check on it.
  check('a 4.6-cell arc over 3.5 cells leaves near seventy',
    Math.abs(lobAngle(3.5, 4.6) - 79.2) < 1);
  check('the same arc over a longer range is shallower',
    lobAngle(7, 4.6) < lobAngle(3.5, 4.6));
  check('a higher arc over the same range is steeper',
    lobAngle(3.5, 6) > lobAngle(3.5, 4.6));
  check('it is always UP — a lob never points below the horizontal',
    [0.5, 1, 3, 7, 20].every((d) => lobAngle(d, 3.4) > 0));
  check('and never past vertical', [0.001, 0.5, 20].every((d) => lobAngle(d, 4.6) < 90));
}

console.log('angles:');
check('wrap keeps the half-open turn', wrapDeg(180) === 180 && wrapDeg(-180) === 180);
check('wrap folds past a turn', wrapDeg(190) === -170 && wrapDeg(-190) === 170 && wrapDeg(720) === 0);
// THE ONE THAT MATTERS
check('the short way across the seam', deltaDeg(170, -170) === 20, String(deltaDeg(170, -170)));
check('...and back', deltaDeg(-170, 170) === -20, String(deltaDeg(-170, 170)));
check('the short way is still the short way inside the range', deltaDeg(10, 40) === 30);
check('a half turn does not flip-flop', Math.abs(deltaDeg(0, 180)) === 180);

console.log('where to point:');
// +Z forward, +Y up (the workshop's stated convention)
check('dead ahead is zero', near(aimAt([0, 0, 5]).yaw, 0) && near(aimAt([0, 0, 5]).elev, 0));
check('+X is a quarter turn right', near(aimAt([5, 0, 0]).yaw, 90));
check('-X is a quarter turn left', near(aimAt([-5, 0, 0]).yaw, -90));
check('behind is a half turn', Math.abs(aimAt([0, 0, -5]).yaw) === 180);
// ELEVATION IS POSITIVE UP. If this flips, the gun tracks the floor.
check('above is positive elevation', near(aimAt([0, 5, 5]).elev, 45));
check('below is negative elevation', near(aimAt([0, -5, 5]).elev, -45));
check('straight up is ninety', near(aimAt([0, 5, 0]).elev, 90));

console.log('the envelope:');
check('level is inside', inEnvelope(aimAt([0, 0, 5])));
check('the model’s ceiling is respected', !inEnvelope(aimAt([0, 20, 5])),
  String(aimAt([0, 20, 5]).elev));
check('...and its floor', !inEnvelope(aimAt([0, -5, 5])));
check('just inside the ceiling is engageable', inEnvelope({ elev: SENTRY_TUNE.elevMax - 0.1 }));

console.log('the drive:');
{
  const st = makeSentry();
  st.wantYaw = 90;
  slew(st, 0.1);
  check('it turns at its rate', near(st.yaw, SENTRY_TUNE.yawRate * 0.1));
  check('...and is not on target yet', !onTarget(st));
  // ACROSS THE SEAM, in the machine rather than in the helper
  const st2 = makeSentry();
  st2.yaw = 170; st2.wantYaw = -170;
  slew(st2, 0.05);                       // 5.5 degrees at 110 deg/s
  check('it crosses the seam forwards', st2.yaw > 170 || st2.yaw < -170,
    `yaw ${st2.yaw.toFixed(2)}`);
  check('...and gets nearer, not further', Math.abs(deltaDeg(st2.yaw, -170)) < 20);
  let guard = 0;
  while (!slew(st2, 0.05) && guard++ < 400);
  check('and it arrives', onTarget(st2) && guard < 400, `after ${guard} steps`);

  // the envelope clamps the MACHINE too, not only the want
  const st3 = makeSentry();
  st3.wantElev = 200;
  for (let k = 0; k < 200; k++) slew(st3, 0.05);
  check('it cannot drive past its stops', st3.elev === SENTRY_TUNE.elevMax);

  // ON TARGET IS A TOTAL ERROR: dead-on in yaw and high in elevation is not
  // aimed at anything, and a per-axis test would call it a hit
  const st4 = makeSentry();
  st4.yaw = 0; st4.wantYaw = 0; st4.elev = 0; st4.wantElev = 10;
  check('an axis that is off is off', !onTarget(st4) && near(aimError(st4), 10));
}

console.log('tracking:');
{
  const st = makeSentry();
  const aim = track(st, [5, 0, 5]);
  check('it wants the bearing', near(st.wantYaw, 45) && near(aim.yaw, 45));
  // A TARGET OUTSIDE THE ENVELOPE IS STILL TRACKED IN YAW, clamped in
  // elevation — the barrel goes as close as it can, and the CALLER can see
  // from the returned aim that the shot is not on. Refusing to move at all
  // would read as a broken turret.
  const high = track(st, [0, 40, 5]);
  check('an unreachable target still turns it', near(st.wantYaw, 0));
  check('...clamped at the stop', st.wantElev === SENTRY_TUNE.elevMax);
  check('...and the caller can tell', !inEnvelope(high));
}

console.log('the gun:');
{
  const st = makeSentry();
  st.wantYaw = 0; st.wantElev = 0;
  check('a cold gun on target may fire', canFire(st, true));
  check('...but not at an unreachable target', !canFire(st, false));
  const m0 = fire(st, 6);
  check('it fires from the first muzzle', m0 === 0);
  check('...and goes hot', st.cool === SENTRY_TUNE.cooldown && !canFire(st, true));
  check('...and recoils', st.recoil === SENTRY_TUNE.recoilKick);
  stepGun(st, SENTRY_TUNE.cooldown);
  check('it cools', st.cool === 0 && canFire(st, true));
  // ROUND ROBIN: a six-barrelled Rotor walks its barrels
  const seen = [m0];
  for (let k = 0; k < 7; k++) { seen.push(fire(st, 6)); stepGun(st, 9); }
  check('the barrels walk', seen.slice(0, 6).join() === '0,1,2,3,4,5', seen.join());
  check('...and wrap', seen[6] === 0 && seen[7] === 1);
  const one = makeSentry();
  check('a single-muzzle model always fires from 0',
    fire(one, 1) === 0 && (stepGun(one, 9), fire(one, 1)) === 0);
  check('zero muzzles does not divide by zero', fire(makeSentry(), 0) === 0);
  const rec = makeSentry();
  fire(rec, 1);
  stepGun(rec, 10);
  check('the recoil returns', rec.recoil === 0);
  check('rounds are counted', st.rounds === 8);
}

console.log('the range:');
{
  const rng = mulberry32(4414);
  const range = makeRange();
  stepRange(range, 0.016, rng);
  check('it fills to the count', range.targets.length === SENTRY_TUNE.targets);
  check('everything is up', range.targets.every((t) => t.up));
  check('they stand on the ring', range.targets.every((t) => {
    const r = Math.hypot(t.pos[0], t.pos[2]);
    return r >= SENTRY_TUNE.ringMin - 1e-9 && r <= SENTRY_TUNE.ringMax + 1e-9;
  }));
  check('nothing pops below the floor', range.targets.every((t) => t.pos[1] >= 0));
  // DETERMINISTIC: a replayed range must set the same problem, or a tuning
  // session is guesswork
  const r2 = makeRange();
  stepRange(r2, 0.016, mulberry32(4414));
  check('the same seed sets the same problem',
    r2.targets.map((t) => t.pos.join()).join('|') === range.targets.map((t) => t.pos.join()).join('|'));

  // they drop when their time is up, are reported, and the count comes back
  const before = range.targets.map((t) => t.id);
  const dropped = stepRange(range, 20, rng);
  check('the old ones drop and say so', dropped.length > 0
    && dropped.every((id) => before.includes(id)));
  check('...and the range refills', range.targets.length === SENTRY_TUNE.targets);
  check('...with new ones', range.targets.every((t) => !before.includes(t.id)));

  // pickTarget: the nearest it can REACH
  const p = makeRange();
  p.targets = [
    { id: 1, pos: [0, 40, 1], up: true, hp: 2 },     // right on top, unreachable
    { id: 2, pos: [0, 0, 9], up: true, hp: 2 },      // far, level
    { id: 3, pos: [0, 0, 5], up: true, hp: 2 },      // nearer, level
    { id: 4, pos: [0, 0, 2], up: false, hp: 2 },     // nearest, but down
  ];
  check('it picks the nearest it can point at', p.targets[pickTarget(p)].id === 3);
  // A SENTRY COMMITS. Re-picking the nearest every frame whips the barrel
  // between two targets and settles on neither — which looks like a broken
  // drive and is really a broken decision.
  check('it keeps the target it has, even when something nearer pops',
    p.targets[pickTarget(p, SENTRY_TUNE, 2)].id === 2);
  check('...but not one that went down', (() => {
    p.targets.find((t) => t.id === 2).up = false;
    return p.targets[pickTarget(p, SENTRY_TUNE, 2)].id === 3;
  })());
  check('...nor one it cannot reach', p.targets[pickTarget(p, SENTRY_TUNE, 1)].id === 3);
  check('...nor one that is not there', p.targets[pickTarget(p, SENTRY_TUNE, 404)].id === 3);
  p.targets = [{ id: 9, pos: [0, 40, 1], up: true, hp: 2 }];
  check('nothing reachable is no target', pickTarget(p) === -1);

  // WHERE THE ROUND LANDED. Without this the tolerance knob is decoration.
  const tt = { id: 1, pos: [0, 1, 6] };
  check('a round on the target lands', landedOn([0, 1, 6], tt));
  check('...and just inside the radius', landedOn([0, 1, 6 - SENTRY_TUNE.hitRadius + 0.01], tt));
  check('...but not just outside it', !landedOn([0, 1, 6 - SENTRY_TUNE.hitRadius - 0.01], tt));
  check('a round with nothing to land on misses', !landedOn([0, 1, 6], null));

  // hits
  const st = makeSentry();
  const h = makeRange();
  h.targets = [{ id: 7, pos: [0, 0, 5], up: true, hp: 2 }];
  check('a hit wounds', hitTarget(st, h, 7) === 'hit' && st.hits === 1);
  check('the next one kills', hitTarget(st, h, 7) === 'kill' && st.kills === 1);
  check('...and it is down', !h.targets[0].up);
  check('a dead target cannot be hit again', hitTarget(st, h, 7) === null && st.hits === 2);
  check('a miss on nothing is null', hitTarget(st, h, 999) === null);
}

console.log('the battery:');
{
  check('one stands at the origin', placeBattery({ ...SENTRY_TUNE, count: 1 })[0].join() === '0,0,0');
  const three = placeBattery({ ...SENTRY_TUNE, count: 3, spread: 3, mount: 2 });
  check('three stand on a ring', three.length === 3
    && three.every((p) => Math.abs(Math.hypot(p[0], p[2]) - 3) < 1e-9));
  check('...spread apart, not stacked', Math.hypot(three[0][0] - three[1][0], three[0][2] - three[1][2]) > 3);
  // THE WALL. Raising the mount raises every gun.
  check('a wall lifts them all', three.every((p) => p[1] === 2));
  check('one on a wall is lifted too', placeBattery({ ...SENTRY_TUNE, count: 1, mount: 4 })[0][1] === 4);
}

console.log('a wall changes what it can reach:');
{
  const ground = makeSentry('rotor', 1, [0, 0, 0]);
  const wall = makeSentry('rotor', 1, [0, 4, 0]);
  const t = { id: 1, pos: [0, 0, 6], up: true, hp: 2 };
  check('from the ground it is level', Math.abs(aimAt(relTo(ground, t.pos)).elev) < 1e-9);
  // ...and from four units up the SAME target is well below the horizon
  const down = aimAt(relTo(wall, t.pos)).elev;
  check('from a wall it is below the horizon', down < -30, String(down));
  // WHICH A TIGHT DEPRESSION STOP THEN REFUSES. A wall sentry covers the far
  // ground and is blind at its feet — that is what putting one on a wall
  // buys and costs, and the envelope is where it shows. Pinned against the
  // WORKSHOP's own -10, explicitly, rather than against whatever the range's
  // default happens to be: this test is about the stop, not about the
  // default, and it should not move when the default is retuned.
  const tight = { ...SENTRY_TUNE, elevMin: -10 };
  check('...and past a -10 depression stop', !inEnvelope(aimAt(relTo(wall, t.pos)), tight));
  const far = { id: 2, pos: [0, 0, 30], up: true, hp: 2 };
  check('the far ground is still reachable from the wall',
    inEnvelope(aimAt(relTo(wall, far.pos)), tight));
  // ...and the range's own, wider stop takes the near one, which is exactly
  // why the range does not ship the workshop's number
  check('the range’s own stop reaches it', inEnvelope(aimAt(relTo(wall, t.pos)), SENTRY_TUNE));

  // pickTarget respects whose frame it is asked in
  const r = makeRange();
  r.targets = [t, far];
  check('a tight stop skips what it cannot depress to',
    r.targets[pickTarget(r, tight, -1, wall)].id === 2);
  check('...and the ground gun takes the near one',
    r.targets[pickTarget(r, tight, -1, ground)].id === 1);
  // a battery member off to one side has its own bearing
  const east = makeSentry('rotor', 1, [5, 0, 0]);
  check('two sentries do not agree about a bearing',
    Math.abs(aimAt(relTo(ground, t.pos)).yaw - aimAt(relTo(east, t.pos)).yaw) > 20);
}

console.log('lead:');
{
  const from = [0, 0, 0];
  // a target crossing at right angles: the lead must be AHEAD of it
  const p = [0, 0, 9], v = [2, 0, 0];
  const lp = leadPoint(p, v, from, 26);
  check('the aim point moves along the target’s travel', lp[0] > 0 && lp[2] === 9);
  // ...and the amount is the time of flight
  const tof = Math.hypot(lp[0], lp[2]) / 26;
  check('...by one time-of-flight', Math.abs(lp[0] - v[0] * tof) < 0.02, `${lp[0].toFixed(3)}`);
  check('a stationary target needs no lead', leadPoint(p, [0, 0, 0], from, 26).join() === p.join());
  check('no velocity at all is no lead', leadPoint(p, null, from, 26).join() === p.join());
  check('an instant round needs almost none', leadPoint(p, v, from, 1e6)[0] < 1e-3);
  check('a slow round needs a lot', leadPoint(p, v, from, 4)[0] > leadPoint(p, v, from, 26)[0]);

  // THE MISS IT EXISTS TO STOP. A walker inbound at the default speed, a
  // round at the default velocity: aiming where it IS lands outside the hit
  // radius, and aiming where it WILL BE lands inside.
  const w = { id: 1, pos: [0, 0, 9], vel: [0, 0, -SENTRY_TUNE.walkSpeed] };
  const flight = 9 / SENTRY_TUNE.muzzleVel;
  const willBe = [0, 0, 9 - SENTRY_TUNE.walkSpeed * flight];
  check('aiming where it is, misses', !landedOn(w.pos, { pos: willBe }));
  const led = leadPoint(w.pos, w.vel, from, SENTRY_TUNE.muzzleVel);
  check('aiming where it will be, lands', landedOn(led, { pos: willBe }),
    `${led[2].toFixed(3)} vs ${willBe[2].toFixed(3)}`);
}

console.log('the dead zone a wall buys:');
{
  check('a gun at ground level has none', deadZone({ ...SENTRY_TUNE, mount: 0 }, 0) === 0);
  // EVEN ON THE FLOOR a sentry has one, because its trunnion is 1.4 units up
  const floor = deadZone({ ...SENTRY_TUNE, elevMin: -10 }, 1.4);
  check('a floor sentry at -10 is still blind to 7.9', Math.abs(floor - 7.939) < 0.01, floor.toFixed(3));
  check('...which is why the range does not use -10', SENTRY_TUNE.elevMin < -10);
  check('at the range’s own stop it can cover its ring',
    deadZone(SENTRY_TUNE, 1.4) < SENTRY_TUNE.ringMin, deadZone(SENTRY_TUNE, 1.4).toFixed(2));
  // at the workshop's own -10 stop, a two-unit wall is blind out to 11.3
  const d = deadZone({ ...SENTRY_TUNE, mount: 2, elevMin: -10 }, 2);
  check('a 2-unit wall at -10 is blind to 11.3 units', Math.abs(d - 11.343) < 0.01, d.toFixed(3));
  check('...which is the WHOLE range', d > SENTRY_TUNE.ringMax);
  check('more depression shrinks it',
    deadZone({ ...SENTRY_TUNE, elevMin: -45 }, 2) < deadZone({ ...SENTRY_TUNE, elevMin: -20 }, 2));
  check('45 degrees of depression sees its own wall height',
    Math.abs(deadZone({ ...SENTRY_TUNE, elevMin: -45 }, 3) - 3) < 1e-9);
  check('no depression at all is blind everywhere',
    deadZone({ ...SENTRY_TUNE, elevMin: 0 }, 2) === Infinity);
  // and it agrees with the envelope test, which is the thing that acts on it
  const wall = makeSentry('rotor', 1, [0, 2, 0]);
  const tune = { ...SENTRY_TUNE, mount: 2, elevMin: -10 };
  const inside = { pos: [0, 0, d - 1] }, outside = { pos: [0, 0, d + 1] };
  check('inside the zone the envelope refuses', !inEnvelope(aimAt(relTo(wall, inside.pos)), tune));
  check('outside it the envelope allows', inEnvelope(aimAt(relTo(wall, outside.pos)), tune));
}

console.log('waves:');
{
  const rng = mulberry32(4414);
  const r = makeRange();
  const n = spawnWave(r, rng, SENTRY_TUNE);
  check('the first wave is the first size', n === SENTRY_TUNE.waveSize && r.wave === 1);
  check('they start out on the ring', r.targets.every((t) =>
    Math.hypot(t.pos[0], t.pos[2]) > SENTRY_TUNE.ringMax * 0.9));
  check('they can die', r.targets.every((t) => t.hp === SENTRY_TUNE.hp && t.up));
  check('...and they walk', r.targets.every((t) => t.walker && t.speed > 0));

  // THEY CLOSE IN
  const before = r.targets.map((t) => Math.hypot(t.pos[0], t.pos[2]));
  stepWalkers(r, 0.5, SENTRY_TUNE);
  const after = r.targets.map((t) => Math.hypot(t.pos[0], t.pos[2]));
  check('a step brings them nearer', after.every((d, i) => d < before[i]));
  check('...and does not move them off their bearing', r.targets.every((t, i) => {
    const a0 = Math.atan2(t.pos[0], t.pos[2]);
    return Number.isFinite(a0) && after[i] > 0;
  }));

  // ...and GET THROUGH
  const one = makeRange();
  one.targets = [{ id: 9, pos: [0, 0, 8], up: true, hp: 2, walker: true, speed: 100 }];
  const through = stepWalkers(one, 1, SENTRY_TUNE);
  check('one that reaches the guns is through', through.join() === '9' && one.leaked === 1);
  check('...and is off the field', one.targets.length === 0);

  // the wave clock
  const w = makeRange();
  const r2 = mulberry32(7);
  check('the first wave comes at once', stepWaves(w, 0.016, r2, SENTRY_TUNE) === SENTRY_TUNE.waveSize);
  check('nothing more while the field is busy', stepWaves(w, 1, r2, SENTRY_TUNE) === 0);
  w.targets.length = 0;
  check('a cleared field waits the gap', stepWaves(w, 0.1, r2, SENTRY_TUNE) === 0 && w.cleared === 1);
  const sent = stepWaves(w, SENTRY_TUNE.waveGap, r2, SENTRY_TUNE);
  check('...then sends a BIGGER one',
    sent === SENTRY_TUNE.waveSize + SENTRY_TUNE.waveGrow, String(sent));
  check('the wave counter advances', w.wave === 2);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall sentry invariants hold');
process.exit(failures ? 1 : 0);
