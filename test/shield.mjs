// shield.mjs — the shield's rules as invariants. The refusals are the module:
// a shield that can be topped up from the rack, or whose cooldown starts at
// the deploy instead of the drop, is a different feature from the one the
// operator approved — and neither shows up as an error at runtime. They show
// up as a hold-to-win button.
import {
  SHIELD_TUNE, makeShield, charge, deploy, tickShield, restockShield,
  tapTower, towerOffline, stationDraw, waveReset, shoveVec, shoveMag,
  shieldKnobProblems,
} from '../src/shield.js';
import { makeArrayStation, arrayDraw, refillArray, stepShieldFrame } from '../src/domain/shield.js';
import { SHIELD_ARRAY } from '../src/content/shield-array.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

console.log('schema:');
check('knob table is sound', shieldKnobProblems().length === 0, shieldKnobProblems().join('; '));

console.log('the meter:');
{
  const st = makeShield();
  check('starts empty', st.t === 0);
  check('a pickup charges it', near(charge(st, SHIELD_TUNE.pickup), SHIELD_TUNE.pickup));
  check('the meter holds it', near(st.t, SHIELD_TUNE.pickup));
  const took = charge(st, 50);
  check('the cap clamps', near(st.t, SHIELD_TUNE.cap));
  check('and reports what it actually took', near(took, SHIELD_TUNE.cap - SHIELD_TUNE.pickup));
  check('a zero charge is a no-op', charge(st, 0) === 0 && near(st.t, SHIELD_TUNE.cap));
}

console.log('the rack and its refusals:');
{
  const st = makeShield();
  check('starts with two charges', st.rack === SHIELD_TUNE.rackStart);
  check('S deploys', deploy(st, 0) === 'ok');
  check('a charge is spent', st.rack === SHIELD_TUNE.rackStart - 1);
  check('and buys ten seconds', near(st.t, SHIELD_TUNE.deploySecs));
  check('S refuses while the shield is up', deploy(st, 1) === 'up');
  check('the refusal costs no charge', st.rack === SHIELD_TUNE.rackStart - 1);
}
{
  // THE SEAM. The cooldown is measured from the DROP, not from the deploy —
  // so it is a fixed coolSecs wherever the bubble came from, and a 12-second
  // pickup does not hand you a free re-deploy the moment it expires.
  const st = makeShield();
  deploy(st, 0);
  let dropped = false;
  for (let t = 0; t < SHIELD_TUNE.deploySecs + 0.5; t += 0.5) {
    if (tickShield(st, 0.5, t)) dropped = true;
  }
  check('it drops after deploySecs', dropped && st.t === 0);
  const dropT = st.coolUntil - SHIELD_TUNE.coolSecs;
  check('the cooldown is stamped at the drop, not the deploy',
    near(dropT, SHIELD_TUNE.deploySecs, 0.51), `dropT=${dropT}`);
  check('S refuses inside the seam', deploy(st, st.coolUntil - 0.01) === 'cooling');
  check('and works the moment it closes', deploy(st, st.coolUntil) === 'ok');
}
{
  const st = makeShield();
  st.rack = 0;
  check('an empty rack refuses', deploy(st, 0) === 'empty');
  restockShield(st, SHIELD_TUNE.caseSize);
  check('a case restocks', st.rack === SHIELD_TUNE.caseSize);
  restockShield(st, 99);
  check('the rack cap holds and the overflow is lost', st.rack === SHIELD_TUNE.rackCap);
}
{
  // The seam must fit inside the ram-combo window: RAM_COMBO_GAP is 4s in
  // td-tab.js. If this ever fails, the rack chain stops carrying a combo and
  // the whole point of the 2-second cooldown is gone.
  check('the seam is inside the 4s ram-combo window', SHIELD_TUNE.coolSecs < 4);
  check('two charges are exactly one full meter',
    near(SHIELD_TUNE.rackStart * SHIELD_TUNE.deploySecs, SHIELD_TUNE.cap));
}

console.log('the slow-tower tap:');
{
  const st = makeShield();
  const got = tapTower(st, 7, 0, 1);
  check('a second parked pays tapRate', near(got, SHIELD_TUNE.tapRate));
  check('and the meter has it', near(st.t, SHIELD_TUNE.tapRate));
  check('that tower is offline while tapped', towerOffline(st, 7, 0) === true);
  check('and stays offline through the outage',
    towerOffline(st, 7, SHIELD_TUNE.tapOutage - 0.01) === true);
  check('then comes back', towerOffline(st, 7, SHIELD_TUNE.tapOutage + 0.01) === false);
  check('an untapped tower is never offline', towerOffline(st, 8, 0) === false);
  st.t = SHIELD_TUNE.cap;
  check('a full meter takes nothing', near(tapTower(st, 7, 1, 1), 0));
}

console.log('the heart station:');
{
  const st = makeShield();
  check('a second on the pad pays stationRate', near(stationDraw(st, 1), SHIELD_TUNE.stationRate));
  check('the budget went down by it',
    near(st.stationLeft, SHIELD_TUNE.stationBudget - SHIELD_TUNE.stationRate));
  let spent = 0;
  for (let i = 0; i < 100; i++) spent += stationDraw(st, 1);
  check('the budget is the ceiling',
    near(spent + SHIELD_TUNE.stationRate, SHIELD_TUNE.stationBudget), `spent=${spent}`);
  check('an exhausted pad pays nothing', near(stationDraw(st, 1), 0));
  waveReset(st);
  check('the next wave refills it', near(st.stationLeft, SHIELD_TUNE.stationBudget));
}

console.log('the array station:');
{
  // THE SOLAR ARRAY (V1 session design, section 3): rechargeable, not infinite.
  const A = SHIELD_ARRAY;
  const parked = { metres: 0, speed: 0 };
  {
    const st = makeShield(), sta = makeArrayStation(A);
    check('a station starts with its reserve', near(sta.reserve, A.reserve));
    st.rack = 0;
    const got = arrayDraw(st, sta, 1, parked, A);
    check('a second parked pays the rate', near(got, A.rate), `got=${got}`);
    check('into the next rack charge', near(st.rackFill, A.rate) && st.rack === 0);
    check('out of the reserve', near(sta.reserve, A.reserve - A.rate));
    check('the first paying step says start', sta.event === 'start' && sta.charging === true);
    let charged = false;
    for (let i = 0; i < 100 && st.rack === 0; i++) { arrayDraw(st, sta, 0.25, parked, A); if (sta.event === 'charge') charged = true; }
    check('a full charge lands in the rack', st.rack === 1 && charged, `rack=${st.rack}`);
  }
  {
    const st = makeShield(), sta = makeArrayStation(A);
    st.rack = 0;
    check('nothing while moving fast', arrayDraw(st, sta, 1, { metres: 0, speed: A.maxSpeed + 0.5 }, A) === 0 && sta.charging === false);
    check('nothing outside the pad', arrayDraw(st, sta, 1, { metres: A.radiusMetres + 1, speed: 0 }, A) === 0);
    check('and the reserve is untouched', near(sta.reserve, A.reserve));
    check('a crawl still charges', arrayDraw(st, sta, 1, { metres: A.radiusMetres - 1, speed: A.maxSpeed * 0.5 }, A) > 0);
  }
  {
    const st = makeShield(), sta = makeArrayStation(A);
    deploy(st, 0);
    const before = st.t, rack = st.rack;
    arrayDraw(st, sta, 1, parked, A);
    check('an active bubble fills first', near(st.t, before + A.rate) && st.rack === rack && st.rackFill === 0);
    st.t = SHIELD_TUNE.cap;
    arrayDraw(st, sta, 1, parked, A);
    check('a capped bubble passes the rest to the rack', near(st.rackFill, A.rate));
  }
  {
    const st = makeShield(), sta = makeArrayStation(A);
    st.rack = SHIELD_TUNE.rackCap;
    check('a full rack draws nothing', arrayDraw(st, sta, 1, parked, A) === 0 && near(sta.reserve, A.reserve));
    st.rack = SHIELD_TUNE.rackCap - 1;
    for (let i = 0; i < 400; i++) arrayDraw(st, sta, 0.1, parked, A);
    check('the rack cap holds', st.rack === SHIELD_TUNE.rackCap, `rack=${st.rack}`);
    check('and the pad stops paying at the cap', near(A.reserve - sta.reserve, SHIELD_TUNE.deploySecs), `drawn=${A.reserve - sta.reserve}`);
  }
  {
    const st = makeShield(), sta = makeArrayStation(A);
    st.rack = 0;
    let events = [];
    for (let i = 0; i < 2000; i++) { arrayDraw(st, sta, 1 / 30, parked, A); if (sta.event) events.push(sta.event); }
    check('the reserve is finite: it runs to zero and stops', sta.reserve === 0 && near(sta.drawn, Math.min(A.reserve, SHIELD_TUNE.rackCap * SHIELD_TUNE.deploySecs)), `reserve=${sta.reserve} drawn=${sta.drawn}`);
    check('it pays exactly its reserve in charges', st.rack === Math.min(SHIELD_TUNE.rackCap, Math.floor(A.reserve / SHIELD_TUNE.deploySecs)), `rack=${st.rack}`);
    check('running dry is said once', events.filter((e) => e === 'dry').length === 1, events.join(','));
    const rack = st.rack;
    st.rack = 0;
    for (let i = 0; i < 600; i++) arrayDraw(st, sta, 1, parked, A);
    check('a dry pad never refills itself', sta.reserve === 0 && st.rack === 0 && st.rackFill === 0);
    refillArray(sta, A);
    check('refillArray is the only way back', near(sta.reserve, A.reserve));
    check('and it charges again', arrayDraw(st, sta, 1, parked, A) > 0);
    st.rack = rack;
  }
  {
    // the pad feeds the rack, never the seam: a charge banked on the array
    // still waits out the cooldown, and the frame transaction carries it
    const st = makeShield(), sta = makeArrayStation(A);
    deploy(st, 0);
    let dropped = 0;
    for (let t = 0; t < 30; t += 0.1) if (stepShieldFrame(st, 0.1, t, { array: { station: sta, tune: A, metres: 99, speed: 0 } })) dropped++;
    check('off the pad the bubble still drops once', dropped === 1 && st.t === 0);
    st.coolUntil = 100;
    stepShieldFrame(st, 1, 99, { array: { station: sta, tune: A, ...parked } });
    check('the pad charges the rack through the frame step', st.rackFill > 0 || st.rack > SHIELD_TUNE.rackStart - 1);
    check('and a banked charge still respects the seam', deploy(st, 99.5) === 'cooling');
    check('the station knows how much it gave', sta.drawn > 0);
  }
}

console.log('the shove:');
{
  // Tank at the north pole heading east. The push must be PERPENDICULAR to
  // the heading and TANGENT to the sphere — a world-space cross product that
  // forgets the surface pushes enemies into the ground or off it.
  const NORTH = [0, 1, 0];
  const EAST = [1, 0, 0];
  const enemyLeft = [0.01, 1, -0.06];    // off to one side of the heading
  const v = shoveVec(enemyLeft, NORTH, EAST);
  check('the shove is a unit vector', near(Math.hypot(v[0], v[1], v[2]), 1));
  check('perpendicular to the heading', near(v[0] * EAST[0] + v[1] * EAST[1] + v[2] * EAST[2], 0));
  check('tangent to the sphere', near(v[0] * NORTH[0] + v[1] * NORTH[1] + v[2] * NORTH[2], 0));
  const away = (v[0] * enemyLeft[0] + v[1] * enemyLeft[1] + v[2] * enemyLeft[2]);
  check('it pushes the enemy the way it is already leaning', away > 0, `away=${away}`);
  const other = shoveVec([0.01, 1, 0.06], NORTH, EAST);
  check('an enemy on the other side goes the other way',
    other[2] * v[2] < 0, `${other[2]} vs ${v[2]}`);
  const dead = shoveVec([0.06, 1, 0], NORTH, EAST);   // dead ahead: no lean at all
  check('a dead-ahead enemy still gets a real push',
    near(Math.hypot(dead[0], dead[1], dead[2]), 1));
}
{
  check('a fresh shove is at full magnitude',
    near(shoveMag({ t: SHIELD_TUNE.shoveLife }), SHIELD_TUNE.shoveCells));
  check('a spent shove is zero', near(shoveMag({ t: 0 }), 0));
  const half = shoveMag({ t: SHIELD_TUNE.shoveLife / 2 });
  check('and it decays monotonically in between',
    half > 0 && half < SHIELD_TUNE.shoveCells, `half=${half}`);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall shield invariants hold');
process.exit(failures ? 1 : 0);
