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
// ladderStart: the computeWavePlan ladder wave before a breach's first wave. The ladder does NOT add up across sectors; the
// sector's threat and its ladder window do the growing.
//
// THE CLIMB (owner, 2026-09-16: "slow start, then it should start getting hectic... hundreds of low levels, a few more hardcores").
// The old table capped every programme at ladder 8, BELOW computeWavePlan's invasion surge — and the surge is the only thing in the
// ladder that puts low-belt bodies on the ground in the hundreds (it re-floods amoeba and ghost on top of the wave). Capping under
// it meant the late waves SHRANK: a sector-3 wave went 90 bodies, then 66, because the headline turned non-rammable and its density
// rule halves instead of multiplying. So the windows now climb THROUGH the surge, and the hard cores are a small explicit count
// (`hardcores`) rather than the twenty-odd solid bodies the surge throws in on its own.
// hardcores: how many solid cores ride every wave once hardcoresEveryWave is on.
export const SECTORS = freeze([
  { n: 1, name: 'THE LANE', breaches: { gate: 2 }, waves: 6, ladderStart: 0, threat: 1.8, pulse: 16, held: { kg: 40, points: 400 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: 'the gunship call-in',
    brief: ['Two mouths out on the lane. They come six times each.', 'Close one early and you give up what it would have paid.'] },
  // THE BACK DOOR: THE FEAST, THEN THE SCRAMBLE (owner, 2026-09-24: "really a chance for the tank to kill tons of rammable soft
  // enemies for the first wave, and then the necessity to spend resources to quickly re-inforce that area with turrets"). `back`
  // is the first key, so the back breach is picked and opened first and the gate side waits. `feast` replaces the back breach's
  // first ladder wave with a flood of soft bodies at the tutorial's surge pace (the books still count it as its first wave), and
  // the clock holds while it is fought. The SCRAMBLE comes when no more than `scrambleShare` of it is left, or `timeout` seconds
  // after it rose: Isao asks for turrets behind the bays, the clock resumes, and the gate side opens `gateAfter` seconds later.
  { n: 2, name: 'THE BACK DOOR', breaches: { back: 1, gate: 1 }, waves: 6, ladderStart: 1, threat: 2.8, pulse: 14,
    feast: { entries: [{ type: 'amoeba', count: 40 }, { type: 'phage', count: 20 }], pace: 1.7, scrambleShare: 0.35, timeout: 50, gateAfter: 10 }, held: { kg: 50, points: 500 },
    gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: false, new: 'the back mouth opens; SOL-82 online',
    brief: ['The rock behind the bays gave way. Something is walking in there.', 'SOL-82 is ours now. Mind where you point it.'] },
  { n: 3, name: 'BOTH WALLS', breaches: { gate: 1, back: 1 }, waves: 8, ladderStart: 6, threat: 2.2, pulse: 12, held: { kg: 60, points: 600 },
    gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: true, hardcores: 2, new: 'hard cores in every wave',
    brief: ['Every wave brings hard cores now. Do not ram them.', 'One front each side. Split the tank and the sky between them.'] },
]);

// SECTOR 4 ONWARD is generated from the last authored sector: its flags carry over, `new` is null.
// waves = wavesBase + (n - SECTORS.length): 9, 10, 11 ... (one more than sector 3's eight, then one a sector; on the clock a
// wave is a pulse, so the programme is also the sector's length). threat climbs threatStep a sector from the
// last authored one. sides cycles by sector, (n - SECTORS.length - 1) % sides.length: 4 both on the gate, 5 both at the
// back, 6 the gate again. held grows heldStep a sector. Generated breaches start the ladder at ladderStart; ladderCap is
// the highest ladder wave any sector's wave is sized at (8: the last of the unlock ladder, before the invasion surge), so a
// long generated programme repeats its top wave at a climbing threat. The cap sits inside the invasion surge now (see SECTORS): 12
// is where a generated sector's last waves land in the mid-hundreds alive, which is the frame budget this machine holds, not past it.
export const SECTOR_GENERATOR = freeze({
  name: 'SECTOR', wavesBase: 8, threatStep: 0.15, ladderStart: 6, ladderCap: 11, held: { kg: 60, points: 600 }, heldStep: { kg: 10, points: 100 },
  sides: [{ gate: 2 }, { back: 2 }],
  brief: ['They are still coming, and there are more of them each time.', 'Hold both mouths. The colony is watching.'],
});

// THE BACK DOOR IS FORESHADOWED (owner, 2026-09-24: "slightly foreshadowed"). At these pulses of the sector before the door
// falls, the mouth behind the bays rumbles: a tremor contact on the radar at its bearing, a low quake, `dust` puffs of grit off
// the rock, and Isao's `brief`. pulse: the pulse it comes with, or 'last' for the sector's final one. The rule is
// src/domain/back-omens.js.
export const BACK_OMENS = freeze([
  { id: 'rumble', sector: 1, pulse: 2, brief: 'back_rumble', dust: 4 },
  { id: 'crack', sector: 1, pulse: 'last', brief: 'back_crack', dust: 10 },
]);
// THE SCRAMBLE'S MARKERS: the back sockets ring every `every` seconds for `seconds` once Isao asks for turrets there
export const BACK_SCRAMBLE = freeze({ seconds: 8, every: 1 });

// PLACEMENT, in cells (the caller converts to its own units): two breaches of a sector stand at least minSeparationCells
// apart, never within exclusionCells of a sealed breach (td-tab's gunshipFar uses 6), and are picked from the farthest
// open cells on their side, at random among those within bandHops of the farthest still valid
// ringHops: gate-side breaches stand on this ring of walking hops from the heart, not the field's far ring (about 69): at the
// sector pace a wave walks in about thirty seconds instead of a minute (owner, 2026-09-24: "too slow between enemies")
export const SECTOR_PLACEMENT = freeze({ minSeparationCells: 12, exclusionCells: 6, bandHops: 3, ringHops: 45 });

// LEFT IN THE FIELD: the estimate of what a closed breach's remaining waves would have paid. killShare is the share of a
// wave assumed killed (1: all of it), streak the multiplier assumed on the bounty (1: no streak credit, the economy's floor)
export const SECTOR_FORFEIT = freeze({ killShare: 1, streak: 1 });

// THE SECTOR'S CLOCK in the story (src/fx/sector-run.js): briefSeconds the brief card holds before the breaches open;
// staggerSeconds between two openings (one breach-opening spike at a time, QA 2026-09-16); backDoorLead the least time
// between the back mouth collapsing and a breach opening behind it; securePause the SECTOR SECURE callout before the debrief;
// lostHold the wreck on screen before LAST TRANSMISSION
// THE CLOCK (2026-09-24, docs/superpowers/specs/2026-09-24-session-pacing-design.md A): a sector's waves come on its `pulse`,
// the seconds from one release leaving the breaches to the next, whatever is still alive; waves stack when the player falls
// behind, which is the pressure. The brief card no longer holds the breaches: they open under it. pace: every sector body's
// march (the tutorial fifty carry 1.7); aliveBudget: a pulse arms only while the sector's live bodies plus the pulse it would
// send fit under it (the frame budget this machine holds, test/sectors.mjs); an empty field always takes the next pulse
export const SECTOR_TIMING = freeze({ briefSeconds: 6, staggerSeconds: 1.5, backDoorLead: 8, securePause: 3, lostHold: 2.5, pace: 1.5, aliveBudget: 520 });

// THE GATE TAKES THE PRESSURE (QA 2026-09-16: a closed gate held a pile of 116 forever and a sector could not be lost).
// Enemies within pressCells of the gate cell wear it down: dps per soft body, per solid core. At zero it breaks and stands
// open (the pathfinder lets them through). Isao mends it at repairPerSecond while no enemy is within quietCells; a broken
// gate closes again once it is back to closeAt of its hp. A dozen bodies break it in about eighteen seconds, a hard core
// alone in about forty: hp 110, not the first cut's 60, since the waves stack on the clock (2026-09-24). At 60 the towers
// alone lost the gate 38 s into sector 1 and the colony 15 s after that, under a player who had only driven off to a site.
export const SECTOR_GATE = freeze({ hp: 110, pressCells: 2.5, softDps: 0.5, coreDps: 3, repairPerSecond: 3, quietCells: 8, closeAt: 0.6 });

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
