// gunship.mjs — the orbital pass, the mount, the guns and the danger rings
// as invariants. The platform's schedule is the one thing the player cannot
// touch, so it is asserted to be untouchable.
import { GUNSHIP_ORBIT, GUNSHIP_GUNS, GUNSHIP_PLATFORM } from '../src/content/gunship.js';
import {
  makeGunship, stepGunship, onStation, phaseLeft, passProgress,
  mountGunship, dismountGunship, selectGun, stepGun, aimOnSphere, splashDamage, dangerReport, fireRound, stepRounds,
  paintHeavy, launchHeavy, nudgeHeavy, stepHeavy, heavyState,
} from '../src/domain/gunship.js';

let failures = 0;
const check = (what, ok) => { if (!ok) failures++; console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); };
const soak = (st, secs, orbit = GUNSHIP_ORBIT) => { const ev = []; for (let i = 0; i < Math.round(secs * 60); i++) { const e = stepGunship(st, 1 / 60, orbit); if (e) ev.push(e); } return ev; };

console.log('the profiles:');
{
  check('three guns', Object.keys(GUNSHIP_GUNS).length === 3);
  check('the heavy has its own ritual, not a cadence', GUNSHIP_GUNS.heavy.strike === true && GUNSHIP_GUNS.heavy.rate === 0);
  check('danger widens with the gun', GUNSHIP_GUNS.rotary.dangerCells < GUNSHIP_GUNS.bofors.dangerCells && GUNSHIP_GUNS.bofors.dangerCells < GUNSHIP_GUNS.heavy.dangerCells);
  check('the platform is overhead at least 45 s (owner, 2026-09-14)', GUNSHIP_ORBIT.station >= 45 && GUNSHIP_ORBIT.pass > 0);
  check('the platform looks down', GUNSHIP_PLATFORM.pitchMax < 0 && GUNSHIP_PLATFORM.pitchMin < GUNSHIP_PLATFORM.pitchMax);
}

console.log('the schedule:');
{
  const st = makeGunship({ pass: 10, station: 4 });
  check('starts on the way in', !onStation(st) && Math.abs(phaseLeft(st) - 10) < 1e-9);
  const ev = soak(st, 10.01, { pass: 10, station: 4 });
  check('arrives once the pass counts out', ev.length === 1 && ev[0] === 'arrive' && onStation(st));
  check('the window counts down', phaseLeft(st) > 3.9 && phaseLeft(st) <= 4);
  check('progress runs 0..1 across the window', passProgress(st, { pass: 10, station: 4 }) >= 0 && passProgress(st, { pass: 10, station: 4 }) < 0.05);
  const ev2 = soak(st, 4, { pass: 10, station: 4 });
  check('departs when the window closes', ev2.includes('depart') && !onStation(st));
  check('progress is 0 off station', passProgress(st, { pass: 10, station: 4 }) === 0);
  const cycles = soak(st, 140, { pass: 10, station: 4 });
  check('the cycle repeats deterministically', cycles.filter((e) => e === 'arrive').length === 10 && cycles.filter((e) => e === 'depart').length === 10);
}
{
  const st = makeGunship({ pass: 10, station: 4 }, { station: true });
  check('a test can start on station', onStation(st) && Math.abs(phaseLeft(st) - 4) < 1e-9);
}
{
  // NO PLAYER INPUT REACHES THE CLOCK: the only mutator is stepGunship with a delta.
  const st = makeGunship({ pass: 10, station: 4 });
  const before = JSON.stringify({ phase: st.phase, left: st.left });
  st.mounted = true; st.gun = 'bofors';
  check('mount and gun selection do not touch the clock', JSON.stringify({ phase: st.phase, left: st.left }) === before);
  check('a negative delta is ignored', (stepGunship(st, -5, { pass: 10, station: 4 }), JSON.stringify({ phase: st.phase, left: st.left }) === before));
}

console.log('the mount:');
{
  const st = makeGunship({ pass: 10, station: 4 });
  check('off station the seat is refused', mountGunship(st) === 'refused' && !st.mounted);
  soak(st, 10.01, { pass: 10, station: 4 });
  check('on station it is allowed', mountGunship(st) === 'mounted' && st.mounted);
  dismountGunship(st); check('and given back', !st.mounted);
  mountGunship(st); soak(st, 4.01, { pass: 10, station: 4 });
  check('departing throws the gunner out', !st.mounted);
}

console.log('the guns:');
{
  const st = makeGunship({ pass: 10, station: 4 }, { station: true });
  check('rotary by default', st.gun === 'rotary');
  check('selecting a known gun', selectGun(st, 'bofors', GUNSHIP_GUNS) && st.gun === 'bofors');
  check('an unknown gun is ignored', !selectGun(st, 'laser', GUNSHIP_GUNS) && st.gun === 'bofors');
  check('not mounted: nothing fires', stepGun(st, 1, true, GUNSHIP_GUNS) === 0);
  mountGunship(st);
  check('trigger up: nothing fires', stepGun(st, 1, false, GUNSHIP_GUNS) === 0);
  let rounds = 0; for (let i = 0; i < 60; i++) rounds += stepGun(st, 1 / 60, true, GUNSHIP_GUNS);
  check('the bofors owes its rate over a second', Math.abs(rounds - GUNSHIP_GUNS.bofors.rate) <= 1);
  selectGun(st, 'rotary', GUNSHIP_GUNS); rounds = 0; for (let i = 0; i < 60; i++) rounds += stepGun(st, 1 / 60, true, GUNSHIP_GUNS);
  check('the rotary owes thirty a second', Math.abs(rounds - GUNSHIP_GUNS.rotary.rate) <= 1);
  check('a released trigger drops the owed fraction', (stepGun(st, 0.02, false, GUNSHIP_GUNS), st.accum === 0));
  selectGun(st, 'bofors', GUNSHIP_GUNS); check('a fresh click fires one round at once', stepGun(st, 0.016, true, GUNSHIP_GUNS) === 1 && stepGun(st, 0.016, true, GUNSHIP_GUNS) === 0);
  selectGun(st, 'heavy', GUNSHIP_GUNS);
  check('the heavy has no cadence here', stepGun(st, 1, true, GUNSHIP_GUNS) === 0);
  const off = makeGunship({ pass: 10, station: 4 }); off.mounted = true;
  check('off station a mounted flag still fires nothing', stepGun(off, 1, true, GUNSHIP_GUNS) === 0);
}

console.log('the aim:');
{
  const hit = aimOnSphere([0, 2, 0], [0, -1, 0]);
  check('straight down lands on the sphere', hit && Math.abs(hit[1] - 1) < 1e-9);
  check('looking away misses', aimOnSphere([0, 2, 0], [0, 1, 0]) === null);
  const g = aimOnSphere([0, 1.5, 0], [0.3, -1, 0].map((v) => v / Math.hypot(0.3, 1)));
  check('an oblique ray lands on the near side', g && Math.abs(Math.hypot(g[0], g[1], g[2]) - 1) < 1e-9 && g[1] > 0);
}

console.log('the splash:');
{
  check('full at the centre', splashDamage(0, 1, 4) === 4);
  check('fat middle: three quarters at half radius', Math.abs(splashDamage(0.5, 1, 4) - 3) < 1e-9);
  check('zero at the ring and beyond', splashDamage(1, 1, 4) === 0 && splashDamage(2, 1, 4) === 0);
}

console.log('the danger report:');
{
  const bodies = [{ kind: 'wall', pos: [0.1, 0, 0] }, { kind: 'wall', pos: [3, 0, 0] }, { kind: 'tower', pos: [0, 0.2, 0] }, { kind: 'tank', pos: [0.5, 0, 0] }, { kind: 'isao', pos: [4, 0, 0] }];
  const r = dangerReport([0, 0, 0], 1, bodies);
  check('counts what is inside', r.walls === 1 && r.towers === 1 && r.tank === true && r.isao === false);
  check('lists them', r.inside.length === 3);
  const none = dangerReport([10, 10, 10], 1, bodies);
  check('an empty ring', none.walls === 0 && none.towers === 0 && !none.tank && none.inside.length === 0);
}

console.log('rounds in flight:');
{
  const st = makeGunship({ pass: 10, station: 40 }, { station: true }); mountGunship(st);
  fireRound(st, 'rotary', [0, 1, 0], 2); fireRound(st, 'bofors', [0, 0, 1], 2.6);
  check('nothing lands before its time', stepRounds(st).length === 0 && st.rounds.length === 2);
  soak(st, 2.01, { pass: 10, station: 40 });
  const a = stepRounds(st);
  check('the rotary round lands at two seconds where it was aimed', a.length === 1 && a[0].gun === 'rotary' && a[0].point[1] === 1);
  soak(st, 0.6, { pass: 10, station: 40 });
  check('the bofors shell lands at two point six', stepRounds(st).length === 1 && st.rounds.length === 0);
  fireRound(st, 'rotary', [1, 0, 0], 2); dismountGunship(st);
  check('leaving the seat drops the rounds in the air', st.rounds.length === 0);
}
console.log('downtime:');
{
  const O = { pass: 10, station: 400 }, st = makeGunship(O, { station: true }); mountGunship(st);
  let fired = 0, ticks = 0; while (!st.overheated && ticks++ < 60 * 20) { fired += stepGun(st, 1 / 60, true, GUNSHIP_GUNS); stepGunship(st, 1 / 60, O); }
  check('the rotary overheats after its heat seconds', st.overheated && Math.abs(ticks / 60 - GUNSHIP_GUNS.rotary.heatSeconds) < 0.1 && fired > 100);
  check('overheated: the trigger does nothing', stepGun(st, 1 / 60, true, GUNSHIP_GUNS) === 0);
  for (let i = 0; i < Math.round(GUNSHIP_GUNS.rotary.coolSeconds * 60) + 2; i++) { stepGun(st, 1 / 60, false, GUNSHIP_GUNS); stepGunship(st, 1 / 60, O); }
  check('cooled: it fires again', !st.overheated && stepGun(st, 1 / 60, true, GUNSHIP_GUNS) === 1);
  selectGun(st, 'bofors', GUNSHIP_GUNS); let shots = 0; for (let i = 0; i < 60 * 2.6; i++) { shots += stepGun(st, 1 / 60, true, GUNSHIP_GUNS); stepGunship(st, 1 / 60, O); }
  check('the bofors empties its magazine and waits', shots === GUNSHIP_GUNS.bofors.magazine && st.mag === 0);
  for (let i = 0; i < Math.round(GUNSHIP_GUNS.bofors.reload * 60) + 2; i++) { stepGun(st, 1 / 60, false, GUNSHIP_GUNS); stepGunship(st, 1 / 60, O); }
  check('reloaded: a full magazine', stepGun(st, 1 / 60, true, GUNSHIP_GUNS) === 1 && st.mag === GUNSHIP_GUNS.bofors.magazine - 1);
}
// THE MK-9 MINI NUKE (owner, 2026-09-16), which replaced the 105's instant strike. Same paint-then-fire ritual, but the round is
// modelled: RELEASED while the motor is cold, IGNITED once it lights at `freeFall`, impact at `travel`. One release a pass.
console.log('the gunship\'s MK-9:');
{
  check('the third gun is the nuke, and it is the widest', GUNSHIP_GUNS.heavy.blastCells > GUNSHIP_GUNS.bofors.blastCells * 3 && GUNSHIP_GUNS.heavy.perPass === 1);
  check('it falls before it burns', GUNSHIP_GUNS.heavy.freeFall > 0 && GUNSHIP_GUNS.heavy.travel > GUNSHIP_GUNS.heavy.freeFall);
  const O = { pass: 10, station: 400 }, st = makeGunship(O, { station: true }); mountGunship(st);
  check('ready, nothing painted', heavyState(st, GUNSHIP_GUNS).phase === 'ready' && launchHeavy(st, GUNSHIP_GUNS) === -1);
  check('paint, then the state says so', paintHeavy(st, 42, GUNSHIP_GUNS) && heavyState(st, GUNSHIP_GUNS).phase === 'painted');
  check('release: the round is out and the motor is cold', launchHeavy(st, GUNSHIP_GUNS) === 42 && heavyState(st, GUNSHIP_GUNS).phase === 'released' && stepHeavy(st) === -1);
  check('the burn is counted down, not guessed', Math.abs(heavyState(st, GUNSHIP_GUNS).burn - GUNSHIP_GUNS.heavy.freeFall) < 1e-9);
  check('one nudge, no more', nudgeHeavy(st, 43) && !nudgeHeavy(st, 44) && st.heavyFalling.ci === 43);
  for (let i = 0; i < Math.round(GUNSHIP_GUNS.heavy.freeFall * 60) + 2; i++) stepGunship(st, 1 / 60, O);
  check('after the free fall it is ignited, still in the air', heavyState(st, GUNSHIP_GUNS).phase === 'ignited' && stepHeavy(st) === -1);
  let landed = -1; for (let i = 0; i < Math.round(GUNSHIP_GUNS.heavy.travel * 60) + 2 && landed < 0; i++) { stepGunship(st, 1 / 60, O); landed = stepHeavy(st); }
  check('it lands where it was nudged, then safes', landed === 43 && heavyState(st, GUNSHIP_GUNS).phase === 'reloading' && !paintHeavy(st, 1, GUNSHIP_GUNS));
  for (let i = 0; i < Math.round(GUNSHIP_GUNS.heavy.reload * 60) + 2; i++) stepGunship(st, 1 / 60, O);
  check('ONE A PASS: the tube clears but the pass is spent', heavyState(st, GUNSHIP_GUNS).phase === 'spent' && !paintHeavy(st, 1, GUNSHIP_GUNS) && launchHeavy(st, GUNSHIP_GUNS) === -1);
  soak(st, 400, O); soak(st, 10, O); mountGunship(st);
  check('the next pass carries a fresh round', heavyState(st, GUNSHIP_GUNS).phase === 'ready' && paintHeavy(st, 7, GUNSHIP_GUNS) && launchHeavy(st, GUNSHIP_GUNS) === 7);
}
if (failures) { console.log(`${failures} failure(s)`); process.exit(1); }
console.log('gunship ok');
