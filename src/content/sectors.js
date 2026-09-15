// THE SECTORS (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 2). A sector opens two breaches at once,
// each with its own programme of `waves` waves sized by the computeWavePlan ladder at the sector's `threat`. First
// numbers, tuning later. Pure data: the rules live in src/domain/sectors.js and src/domain/sector-stats.js.
import { SENTRY_ORDER } from './sentries.js';
import { GUNSHIP_GUN_ORDER } from './gunship.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

// breaches: how many open on each side (gate: toward dungeon.spawn; back: through the reopened back mouth behind the bays)
// the flags switch systems on and stay on once a sector has turned them on: gunshipCall (the call-in meter), backDoor (the
// sealed clearing mouth nearest +Z reopens), laser (SOL-82 passes), hardcoresEveryWave (a hard core joins every wave)
// held: what a breach held to its last wave pays when it collapses on its own. brief: Isao's two lines on the brief card
// ladderStart: the computeWavePlan ladder wave before a breach's first wave. The ladder does NOT add up across sectors:
// summed, sector 3 would fight ladder waves 8 to 12, about 670 bodies a breach once the invasion surge starts at wave 9.
// The sector's threat does the growing instead, and SECTOR_GENERATOR.ladderCap keeps every programme below the surge.
export const SECTORS = freeze([
  { n: 1, name: 'THE LANE', breaches: { gate: 2 }, waves: 3, ladderStart: 0, threat: 1.0, held: { kg: 40, points: 400 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: 'the gunship call-in',
    brief: ['Two mouths out on the lane. They come three times each.', 'Close one early and you give up what it would have paid.'] },
  { n: 2, name: 'THE BACK DOOR', breaches: { gate: 1, back: 1 }, waves: 4, ladderStart: 1, threat: 1.3, held: { kg: 50, points: 500 },
    gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: false, new: 'the back mouth opens; SOL-82 online',
    brief: ['The rock behind the bays gave way. Something is walking in there.', 'SOL-82 is ours now. Mind where you point it.'] },
  { n: 3, name: 'BOTH WALLS', breaches: { gate: 1, back: 1 }, waves: 5, ladderStart: 3, threat: 1.7, held: { kg: 60, points: 600 },
    gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: true, new: 'hard cores in every wave',
    brief: ['Every wave brings a hard core now. Do not ram them.', 'One front each side. Split the tank and the sky between them.'] },
]);

// SECTOR 4 ONWARD is generated from the last authored sector: its flags carry over, `new` is null.
// waves = wavesBase + (n - SECTORS.length): 6, 7, 8 ... (the spec's "5 + n" read with n counted past the authored table,
// so the programme grows by one wave a sector instead of jumping from 5 to 9). threat climbs threatStep a sector from the
// last authored one. sides cycles by sector, (n - SECTORS.length - 1) % sides.length: 4 both on the gate, 5 both at the
// back, 6 the gate again. held grows heldStep a sector. Generated breaches start the ladder at ladderStart; ladderCap is
// the highest ladder wave any sector's wave is sized at (8: the last of the unlock ladder, before the invasion surge), so a
// long generated programme repeats its top wave at a climbing threat.
export const SECTOR_GENERATOR = freeze({
  name: 'SECTOR', wavesBase: 5, threatStep: 0.35, ladderStart: 3, ladderCap: 8, held: { kg: 60, points: 600 }, heldStep: { kg: 10, points: 100 },
  sides: [{ gate: 2 }, { back: 2 }],
  brief: ['They are still coming, and there are more of them each time.', 'Hold both mouths. The colony is watching.'],
});

// PLACEMENT, in cells (the caller converts to its own units): two breaches of a sector stand at least minSeparationCells
// apart, never within exclusionCells of a sealed breach (td-tab's gunshipFar uses 6), and are picked from the farthest
// open cells on their side, at random among those within bandHops of the farthest still valid
export const SECTOR_PLACEMENT = freeze({ minSeparationCells: 12, exclusionCells: 6, bandHops: 3 });

// LEFT IN THE FIELD: the estimate of what a closed breach's remaining waves would have paid. killShare is the share of a
// wave assumed killed (1: all of it), streak the multiplier assumed on the bounty (1: no streak credit, the economy's floor)
export const SECTOR_FORFEIT = freeze({ killShare: 1, streak: 1 });

// who closes a breach, and how the debrief names it
export const BREACH_CLOSERS = freeze({ gunship: '105', laser: 'SOL-82', shells: 'SHELLS', strike: 'STRIKE', held: 'HELD' });

// kill attribution: the sources the accumulator counts, and their bar labels
export const KILL_SOURCES = freeze({ tank: 'TANK GUN', ram: 'RAM', towers: 'TOWERS', gunship: 'GUNSHIP', laser: 'SOL-82', other: 'OTHER' });

// THE BELT LADDER (src/enemyspec.js CREATURE_TINTS): white to blue is rammable, orange to red is a solid core. Each enemy
// type's belt, with the pale/deep hue variants folded into their belt; test/sectors.mjs holds this to the tints.
export const BELTS = freeze(['white', 'grey', 'yellow', 'blue', 'orange', 'green', 'purple', 'brown', 'black', 'red']);
export const BELT_OF = freeze({
  amoeba: 'white', phage: 'grey', ghost: 'yellow', scoutufo: 'yellow', saucer: 'blue', jellyfish: 'blue', gslime: 'blue',
  drifter: 'orange', corona: 'green', shellback: 'green', barbed: 'purple', prime: 'purple', rolling: 'brown', phantom: 'black',
  knot: 'red', jelly: 'red',
});

// what makeSectorStats counts from zero: tempoBin is the sparkline's bin in seconds (the spec: kills per 5 s), and the
// towers, belts and gunship guns start at zero so every bar is on the card before its first kill
export const SECTOR_STATS = freeze({ tempoBin: 5, towers: [...SENTRY_ORDER], belts: [...BELTS], guns: [...GUNSHIP_GUN_ORDER] });

// THE STAMPS thump in on the first debrief page. A stamp is earned when every rule holds; a rule is
// [metric, op, value] over the report's metrics (src/domain/sector-stats.js reportMetrics), and a string value names
// another metric. ops: eq ne gte lte gt lt.
export const SECTOR_STAMPS = freeze([
  // no leaks and no heart damage
  { id: 'flawless', label: 'FLAWLESS', note: 'nothing got through', rules: [['secure', 'eq', 1], ['leaks', 'eq', 0], ['heartDamage', 'eq', 0]] },
  // every breach held to its last wave
  { id: 'held-the-line', label: 'HELD THE LINE', note: 'every breach fought to its last wave', rules: [['secure', 'eq', 1], ['breaches', 'gt', 0], ['held', 'eq', 'breaches']] },
  // every breach closed before half its waves had come
  { id: 'quick-hands', label: 'QUICK HANDS', note: 'both mouths shut before half their waves', rules: [['secure', 'eq', 1], ['breaches', 'gt', 0], ['quick', 'eq', 'breaches']] },
  { id: 'ram-king', label: 'RAM KING', note: 'a combo of twenty under the treads', rules: [['bestCombo', 'gte', 20]] },
  { id: 'sharpshooter', label: 'SHARPSHOOTER', note: 'six in ten rounds on target', rules: [['shotsFired', 'gte', 30], ['accuracy', 'gte', 0.6]] },
  { id: 'scorched-earth', label: 'SCORCHED EARTH', note: 'twenty-five burned from orbit', rules: [['laserKills', 'gte', 25]] },
  // the tank fought and came home clean: ten kills by gun or tread, no damage taken, no hull lost
  { id: 'not-a-scratch', label: 'NOT A SCRATCH', note: 'the hull came home clean', rules: [['secure', 'eq', 1], ['tankKills', 'gte', 10], ['damageTaken', 'eq', 0], ['hullsLost', 'eq', 0]] },
  // a landing-site part brought home this sector
  { id: 'special-delivery', label: 'SPECIAL DELIVERY', note: 'a part came home on the back deck', rules: [['partsHome', 'gte', 1]] },
  // the gunship made thirty kills in one sector
  { id: 'close-air-support', label: 'CLOSE AIR SUPPORT', note: 'thirty kills from the gunship', rules: [['gunshipKills', 'gte', 30]] },
]);

// THE RECORDS: bests kept across runs under `key` (the caller persists them). better: which way is a record; secureOnly:
// only a secure sector sets it (a lost sector's short clock is not a fast one). {n} in a key is the sector number, for
// records that only compare like with like.
export const SECTOR_RECORDS = freeze([
  { key: 'sector.score', label: 'SECTOR SCORE', metric: 'score', better: 'higher' },
  { key: 'sector.kills', label: 'KILLS IN A SECTOR', metric: 'kills', better: 'higher' },
  { key: 'sector.bestCombo', label: 'BEST RAM COMBO', metric: 'bestCombo', better: 'higher' },
  { key: 'sector.gunshipKills', label: 'GUNSHIP KILLS', metric: 'gunshipKills', better: 'higher' },
  { key: 'sector.laserKills', label: 'SOL-82 KILLS', metric: 'laserKills', better: 'higher' },
  { key: 'sector.{n}.fastest', label: 'FASTEST SECURE, S', metric: 'seconds', better: 'lower', secureOnly: true },
]);
