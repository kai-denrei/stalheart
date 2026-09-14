// achievements.js — the record of things worth having done.
//
// Pure data and one pure function. The game hands in a flat description of a
// run and gets back the ids it earned; nothing in here touches storage, the
// DOM, or the clock. That is deliberate and it is the reason this can be
// tested: every condition below is a line in test/achievements.mjs asserting
// it fires on the state it should and stays quiet on the state it should not.
//
// The voice is the codex's: survey-log register, and the belt ladder the
// roster is painted in. An achievement that reads like a checklist item is a
// checklist item; one that reads like a line from the log is a reason to go
// back out.

export const ACHV_GROUPS = ['streak', 'combat', 'campaign', 'curiosity'];

export const ACHIEVEMENTS = [
  // --- the streak ladder ---------------------------------------------------
  // One condition, five rungs. The operator's own list, and it is the purest
  // thing in here: a number, held.
  { id: 'streak100', name: 'STREAK 100', group: 'streak',
    note: 'a hundred kills without a single leak',
    test: (s) => s.bestStreak >= 100 },
  { id: 'streak200', name: 'STREAK 200', group: 'streak',
    note: 'two hundred. the lattice is keeping count',
    test: (s) => s.bestStreak >= 200 },
  { id: 'streak300', name: 'STREAK 300', group: 'streak',
    note: 'three hundred. nothing has reached the Heart in a very long time',
    test: (s) => s.bestStreak >= 300 },
  { id: 'streak400', name: 'STREAK 400', group: 'streak',
    note: 'four hundred, and the multiplier stopped climbing long ago',
    test: (s) => s.bestStreak >= 400 },
  { id: 'streak500', name: 'STREAK 500', group: 'streak',
    note: 'five hundred. this is no longer a defence, it is a policy',
    test: (s) => s.bestStreak >= 500 },

  // --- combat --------------------------------------------------------------
  { id: 'personal', name: "IT'S PERSONAL", group: 'combat',
    note: 'killed the boss with no tower assistance — treads only',
    test: (s) => s.bossHandsOn },
  { id: 'redbelt', name: 'RED BELT', group: 'combat',
    note: 'the boss wears the red belt, and you took it off him yourself',
    test: (s) => s.bossHandsOn },
  { id: 'blackbelt', name: 'BLACK BELT', group: 'combat',
    note: 'a hands-on kill on the cloaked one. you have to see it first',
    test: (s) => (s.handsOnByType && s.handsOnByType.phantom > 0) || false },
  { id: 'general', name: 'GENERAL', group: 'combat',
    note: 'reached the highest rank the ladder has',
    test: (s) => s.maxRank >= 15 },
  { id: 'nohands', name: 'DESK OFFICER', group: 'combat',
    note: 'took a sector without a single hands-on kill. the towers did it all',
    test: (s) => s.sectorCleared && s.tankKills === 0 },

  // --- campaign ------------------------------------------------------------
  { id: 'surveyed', name: 'SURVEYED AND HELD', group: 'campaign',
    note: 'took a sector. held the waves, then broke every gate in it',
    test: (s) => s.sectorCleared },
  { id: 'kkill0', name: 'K-KILL 0', group: 'campaign',
    note: 'took a sector without losing a single hull',
    test: (s) => s.sectorCleared && s.hullsLost === 0 },
  { id: 'iloveyou', name: 'I LOVE YOU', group: 'campaign',
    note: 'took a sector with the Heart untouched. it beat sixty the whole way',
    test: (s) => s.sectorCleared && s.heartHits === 0 },
  { id: 'halfway', name: 'HALF THE SHELL', group: 'campaign',
    note: 'three sectors of five. the far side is not far any more',
    test: (s) => s.sectorsCleared >= 3 },
  { id: 'planet', name: 'STÅLHEART IS YOURS', group: 'campaign',
    note: 'every portal on the shell, all five sectors. there is nothing left to breach',
    test: (s) => s.planetCleared },

  // --- curiosity -----------------------------------------------------------
  { id: 'orbital', name: 'DEEPWATCH', group: 'curiosity',
    note: 'took a portal off the board with a munition from orbit',
    test: (s) => s.strikePortalKills > 0 },
  { id: 'foreman', name: 'ISAO HAPPY', group: 'curiosity',
    note: 'four orders on the book at once. he prints them one at a time regardless',
    test: (s) => s.maxQueue >= 4 },
  { id: 'quartermaster', name: 'QUARTERMASTER', group: 'curiosity',
    note: 'a thousand kilos of rendered biomass in hand at one moment',
    test: (s) => s.peakBiomass >= 1000 },
  { id: 'lasthull', name: 'THE LAST BERTH', group: 'curiosity',
    note: 'drove out of berth 1. two containers standing empty behind you',
    test: (s) => s.hullsLost >= 2 },
];

export const ACHV_IDS = ACHIEVEMENTS.map((a) => a.id);
const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achievement = (id) => BY_ID.get(id) || null;

// A run's facts, with every field at its zero. The game builds one of these
// and mutates it; having the shape declared in ONE place is what stops a
// condition quietly testing undefined >= 100, which is false forever and
// looks exactly like an achievement nobody has earned yet.
export function blankRun() {
  return {
    bestStreak: 0,
    tankKills: 0,
    handsOnByType: {},
    bossHandsOn: false,
    maxRank: 0,
    hullsLost: 0,
    heartHits: 0,
    sectorCleared: false,
    sectorsCleared: 0,
    planetCleared: false,
    strikePortalKills: 0,
    maxQueue: 0,
    peakBiomass: 0,
  };
}

// Everything this run qualifies for. Pure: the caller decides what is NEW by
// diffing against what it has already stored.
export function earned(run) {
  const s = { ...blankRun(), ...run };
  return ACHIEVEMENTS.filter((a) => {
    try { return !!a.test(s); } catch { return false; }
  }).map((a) => a.id);
}

// The ids in `list` that are not already in `have` — the ones worth telling
// the player about, in table order so a streak ladder announces in order.
export function freshlyEarned(have, list) {
  // `have` comes from storage, which is untrusted input — a blob of the
  // wrong SHAPE (an object where an array was expected) took the whole tab
  // down with "object is not iterable", from a Set() constructor three calls
  // away from anything that mentions storage. A pure function handed
  // outside data defends itself.
  const had = new Set(Array.isArray(have) ? have : []);
  const want = Array.isArray(list) ? list : [];
  return ACHV_IDS.filter((id) => want.includes(id) && !had.has(id));
}

// What a stored record should be reduced to before anything trusts it:
// an array, of ids this build still has. An id retired from the table stops
// counting rather than sitting in storage forever as a name nothing knows.
export function sanitiseRecord(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id) => typeof id === 'string' && BY_ID.has(id));
}
