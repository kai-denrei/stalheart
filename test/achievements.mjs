// achievements.mjs — every condition fires on the state it should, and stays
// quiet on the state it should not. The second half is the half that matters:
// an achievement that triggers on a blank run is worse than one that never
// triggers, because it is a lie the player cannot un-see.

import { ACHIEVEMENTS, ACHV_IDS, ACHV_GROUPS, blankRun, earned, freshlyEarned, sanitiseRecord }
  from '../src/achievements.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

console.log('table:');
check('ids are unique', new Set(ACHV_IDS).size === ACHV_IDS.length);
check('every entry has a name and a note',
  ACHIEVEMENTS.every((a) => a.name && a.note && a.note.length > 8));
check('every group is a declared group',
  ACHIEVEMENTS.every((a) => ACHV_GROUPS.includes(a.group)));

console.log('nothing is earned by doing nothing:');
{
  const none = earned(blankRun());
  check('a blank run earns nothing', none.length === 0, none.join(','));
  // and a run object missing fields entirely must behave like a blank one —
  // this is the undefined >= 100 trap the blank shape exists to close
  check('an EMPTY object earns nothing', earned({}).length === 0);
}

console.log('each condition, on and off:');
{
  const on = (patch) => earned({ ...blankRun(), ...patch });
  check('streak ladder is cumulative',
    on({ bestStreak: 300 }).join(',') === 'streak100,streak200,streak300');
  check('streak 99 earns nothing', on({ bestStreak: 99 }).length === 0);
  check('the boss hands-on pays twice — personal AND the red belt',
    on({ bossHandsOn: true }).includes('personal')
    && on({ bossHandsOn: true }).includes('redbelt'));
  check('black belt needs the cloaked one specifically',
    on({ handsOnByType: { phantom: 1 } }).includes('blackbelt')
    && !on({ handsOnByType: { knot: 9 } }).includes('blackbelt'));
  check('general is the top rank only',
    on({ maxRank: 15 }).includes('general') && !on({ maxRank: 14 }).includes('general'));
  check('K-KILL 0 needs a CLEARED sector, not just a clean run',
    on({ sectorCleared: true, hullsLost: 0 }).includes('kkill0')
    && !on({ hullsLost: 0 }).includes('kkill0'));
  check('I LOVE YOU needs an untouched heart',
    on({ sectorCleared: true, heartHits: 0 }).includes('iloveyou')
    && !on({ sectorCleared: true, heartHits: 1 }).includes('iloveyou'));
  check('half the shell needs three sectors',
    on({ sectorsCleared: 3 }).includes('halfway')
    && !on({ sectorsCleared: 2 }).includes('halfway'));
  check('desk officer needs a cleared sector with NO hands-on kills',
    on({ sectorCleared: true, tankKills: 0 }).includes('nohands')
    && !on({ sectorCleared: true, tankKills: 1 }).includes('nohands'));
  check('deepwatch needs a portal killed from orbit',
    on({ strikePortalKills: 1 }).includes('orbital'));
  check('the planet is its own thing', on({ planetCleared: true }).includes('planet'));
  check('quartermaster is a peak, not a total',
    on({ peakBiomass: 1000 }).includes('quartermaster')
    && !on({ peakBiomass: 999 }).includes('quartermaster'));
  check('the last berth means two hulls gone',
    on({ hullsLost: 2 }).includes('lasthull') && !on({ hullsLost: 1 }).includes('lasthull'));
}

console.log('freshness:');
{
  const list = ['streak100', 'streak200', 'orbital'];
  check('already-held ones are not re-announced',
    freshlyEarned(['streak100'], list).join(',') === 'streak200,orbital');
  check('order follows the table, so a ladder announces in order',
    freshlyEarned([], ['streak200', 'streak100']).join(',') === 'streak100,streak200');
  check('nothing new is an empty list', freshlyEarned(list, list).length === 0);
}

console.log('storage is untrusted input:');
{
  check('a non-array record does not throw', freshlyEarned({ a: 1 }, ['orbital']).length === 1);
  check('a null record does not throw', freshlyEarned(null, ['orbital']).length === 1);
  check('a non-array list does not throw', freshlyEarned([], null).length === 0);
  check('sanitise drops non-arrays', sanitiseRecord({ x: 1 }).length === 0);
  check('sanitise drops unknown and non-string ids',
    sanitiseRecord(['orbital', 'gone-in-v2', 7, null]).join(',') === 'orbital');
}

if (failures) { console.error(`\nachievements: ${failures} FAILED`); process.exit(1); }
console.log('achievements: all good');
