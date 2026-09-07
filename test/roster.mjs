// One numbered Sentry roster: combat contracts and retired-ID compatibility.
import {
  ROSTERS, ROSTER, TOWERS, TOWER_BY_KEY, TOWER_ORDER, HACK_GATED, DEFAULT_ROSTER_ID,
  useRoster, starterTower, unlockedTowerKeys, towerUnlockWave,
  effectiveStats, upgradeCost, MAX_TIER,
} from '../src/towers.js';
import { shotOf } from '../src/sentryfx.js';

let failures = 0;
const check = (what, ok) => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('one authoritative roster', Object.keys(ROSTERS).join() === '2');
check('retired links resolve to Sentries', useRoster(1) === ROSTER && useRoster(99) === ROSTER);

console.log('every board is complete:');
for (const id of [2]) {
  const r = useRoster(id);
  const keys = r.towers.map((t) => t.key);
  check(`board ${id}: keys are unique`, new Set(keys).size === keys.length);
  check(`board ${id}: TOWERS is the live binding`, TOWERS === r.towers);
  check(`board ${id}: TOWER_BY_KEY covers it`,
    keys.every((k) => TOWER_BY_KEY[k] && TOWER_BY_KEY[k].key === k));
  check(`board ${id}: the order names only towers that exist`,
    TOWER_ORDER.every((k) => keys.includes(k)));
  check(`board ${id}: every tower is on the order`,
    keys.every((k) => TOWER_ORDER.includes(k)));
  check(`board ${id}: the gated keys exist`, HACK_GATED.every((k) => keys.includes(k)));
  check(`board ${id}: the starter is the cheapest`,
    starterTower().cost === Math.min(...r.towers.map((t) => t.cost)));
  // the fields the tab reads off a def on every frame, for every tower
  check(`board ${id}: every def is complete`, r.towers.every((d) =>
    typeof d.label === 'string' && typeof d.attack === 'string'
    && d.cost > 0 && d.range > 0 && d.rate > 0 && d.dmg >= 0
    && Number.isFinite(d.color)));
  check(`board ${id}: costs ascend — the ladder reads cheap to capstone`,
    r.towers.every((d, i) => i === 0 || d.cost >= r.towers[i - 1].cost));
  // ...and the ladder still hands one out per wave and terminates
  check(`board ${id}: wave 1 gives exactly one tower`, unlockedTowerKeys(1).length === 1);
  check(`board ${id}: the ladder saturates`,
    unlockedTowerKeys(99, 9).length === keys.length);
  check(`board ${id}: a gated key has no wave`,
    HACK_GATED.every((k) => towerUnlockWave(k) === null));
  check(`board ${id}: upgrades still terminate`,
    upgradeCost(r.towers[0], MAX_TIER) === null);
  check(`board ${id}: tier 2 is stronger than tier 0`,
    r.towers.every((d) => effectiveStats(d, 2).range >= effectiveStats(d, 0).range));
}

console.log('the active Sentry roster:');
{
  useRoster(2);
  const keys = TOWERS.map((t) => t.key);
  check('Rapid is gone', !keys.includes('rapid'));
  check('the Rotor leads', keys[0] === 'rotor');
  check('the Plasma Thrower is a BEAM, not a spread',
    TOWER_BY_KEY.plasma.attack === 'beam');
  check('...and it is the shortest-ranged thing on the board',
    TOWERS.every((d) => d.range >= TOWER_BY_KEY.plasma.range));
  // ...among the weapons that fire SHOTS. The Plasma Thrower's rate is a
  // draw rate, not a rate of fire: a sustained beam has to re-light faster
  // than a sixth of a second or it strobes, and its damage per tick is
  // divided to match. Comparing the two numbers directly is comparing a
  // cadence with a refresh.
  check('the Rotor out-fires every GUN, which is Rapid\'s job',
    TOWERS.filter((d) => d.attack !== 'beam').every((d) => d.rate <= TOWER_BY_KEY.rotor.rate));
  check('...and the Plasma Thrower re-lights faster than it strobes',
    TOWER_BY_KEY.plasma.rate >= 5);
  check('the sustained weapon\'s DPS is what it always was',
    Math.abs(TOWER_BY_KEY.plasma.dmg * TOWER_BY_KEY.plasma.rate - (15 / 90) * 1.6) < 0.02);
  check('the Howitzer lobs, and further than the Mortar',
    TOWER_BY_KEY.howitzer.attack === 'mortar'
    && TOWER_BY_KEY.howitzer.range > TOWER_BY_KEY.mortar.range
    && TOWER_BY_KEY.howitzer.splash > TOWER_BY_KEY.mortar.splash
    && TOWER_BY_KEY.howitzer.rate < TOWER_BY_KEY.mortar.rate);
  check('the Lancer reaches furthest', TOWERS.every((d) => d.range <= TOWER_BY_KEY.lancer.range));
  // THE LANCE IS AIMED AT A LINE, NOT A BODY. It pierces, so its value is
  // in how many things happen to be standing on the line — which only pays
  // if it is slow enough that pointing it is a decision, and long enough
  // that a line is a meaningful thing to point it down.
  check('the Lancer pierces and is aimed down a line',
    TOWER_BY_KEY.lancer.attack === 'lance' && TOWER_BY_KEY.lancer.pierce === true);
  check('...in ONE long burst, not a stream',
    TOWER_BY_KEY.lancer.burst >= 0.5
    && TOWER_BY_KEY.lancer.burst < 1 / TOWER_BY_KEY.lancer.rate);
  check('...and it is the slowest thing on the board',
    TOWERS.every((d) => d.rate >= TOWER_BY_KEY.lancer.rate));
  // A LASER IS GREEN AND A TOWER IS NOT (operator). Two keys, so the beam can
  // have a colour without repainting the machine that throws it — the identity
  // colour still drives the range ring, the shop icon and the tint. The split
  // is now across two FILES rather than two keys on one def: `color` is
  // identity and stays in towers.js, `beamColor` is what it throws and lives
  // in sentryfx.js. The rule the operator asked for is unchanged and so is
  // this test's job — it just reads the beam's colour from its owner.
  const lanceShot = shotOf(TOWER_BY_KEY.lancer);
  check('the lance has a beam colour of its own',
    lanceShot.beamColor !== undefined
    && lanceShot.beamColor !== TOWER_BY_KEY.lancer.color);
  check('...and it is green',
    ((lanceShot.beamColor >> 8) & 0xff)
      > Math.max(lanceShot.beamColor >> 16, lanceShot.beamColor & 0xff));
  // THE QUIVER IS THE LAB'S LAUNCHER. It must lock before it fires, which
  // is the one thing that makes it a launcher rather than a gun with a
  // curved bullet — and it is the only tower on either board that does.
  check('the Quiver locks before it fires',
    TOWER_BY_KEY.quiver.attack === 'seeker' && TOWER_BY_KEY.quiver.lock === true);
  check('...and it is the only one that has to',
    TOWERS.filter((d) => d.lock).length === 1);
  // the models are the point of this board
  check('every tower names a model', TOWERS.every((d) => typeof d.model === 'string' && d.model));
}

useRoster(1);
console.log(failures ? `\n${failures} FAILURES` : '\nall roster invariants hold');
process.exit(failures ? 1 : 0);
