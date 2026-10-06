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
// THE RAMP, THEN THE SIDE WALL, THEN THE BACK DOOR (owner, 2026-10-01: "Backdoor wave too aggressive. Let's delay it. First we run
// more regular waves. Ramp up the difficulty. Then after 4 waves there's a « side breach » ... The backdoor breach comes towards the
// end, once the player has unlocked all options"; asked, he chose four shorter sectors, SOL-82 at sector 3, the back door once
// everything is unlocked with a latest sector, SKIP ALL at sector 1 on the finished base). SECTORS are the fixed opening of the
// arc: four regular sectors on the gate side, four pulses each, climbing; then sector 5. Past them the run holds on SECTOR_HOLD
// sectors until the back door is due (SECTOR_DOOR), then THE BACK DOOR, BOTH WALLS, and SECTOR_GENERATOR's sectors from there.
export const SECTORS = freeze([
  { n: 1, name: 'THE LANE', breaches: { gate: 2 }, waves: 4, ladderStart: 0, threat: 1.2, pulse: 16, held: { kg: 40, points: 400 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: 'the gunship call-in',
    brief: ['Two mouths out on the lane. They come four times each.', 'Close one too early and we lose the biomass it would have paid.'] },
  { n: 2, name: 'THE LONG LANE', breaches: { gate: 2 }, waves: 4, ladderStart: 1, threat: 1.5, pulse: 15, held: { kg: 45, points: 450 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: null,
    brief: ['More of them this time, and closer together.', 'Keep the lane clear and the gate whole.'] },
  // THE CANYON (owner, 2026-10-01: "let's have it used the first time at the antipode, far from all other sentries; a huge number of
  // ennemies, 5x the usual, in a long canyon, easy target for the SOL. a satisfying use of its immense power"; asked, he chose this
  // sector for it, survivors marching on the base, the player seated with a glide). One gate breach keeps the base busy; the swarm
  // comes up at the far end of a canyon cut at the antipode (CANYON) and SOL-82's first pass is laid over it
  { n: 3, name: 'THE CANYON', breaches: { gate: 1 }, waves: 4, ladderStart: 2, threat: 1.8, pulse: 14, held: { kg: 50, points: 500 }, canyon: true,
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'SOL-82 online',
    brief: ['A tremor on the far side of the world. A swarm, massing in a canyon.', 'The gate waits for you. The far side does not.'] },
  { n: 4, name: 'THE PRESS', breaches: { gate: 2 }, waves: 4, ladderStart: 4, threat: 2.1, pulse: 13, held: { kg: 55, points: 550 },
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: null,
    brief: ['They are pressing harder. The lane is never empty now.', 'Spend what you have. The colony can print more.'] },
  // THE SIDE WALL (owner, 2026-10-01: "after 4 waves there's a « side breach ». Problem, but still within range of some of the existing
  // towers so easier to manage. This is a chekov's gun of sorts, it reveals that the walls can be breached"). `side` is the first key,
  // so the side breach is picked and opened first: it comes up outside the gate's wall, inside the front sentries' reach, and cuts
  // its way to the wall (SIDE_BREACH). Isao prints the wall shut again once the lane is quiet.
  { n: 5, name: 'THE SIDE WALL', breaches: { side: 1, gate: 1 }, waves: 4, ladderStart: 5, threat: 2.2, pulse: 13, held: { kg: 60, points: 600 },
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'a breach through the wall',
    brief: ['Something is digging beside the gate. Close to the sentries.', 'One mouth on the lane, and one where it comes up.'] },
]);

// THE STAMPEDE (owner, 2026-10-02: the ramming is the fun, so more waves of weak bodies, bigger ones, a few hard cores to force the
// shield): every `every`-th wave of a gate or back breach is its plan's rammable bodies `size` times over with `cores` x `core` in them
// (src/domain/stampede.js); `callout` as it leaves the mouth
// trickle / trickleGap / tierSize / tierCores / trickleCallout (2026-10-03): the soft trickle between floods and the automation's ramp (src/domain/stampede.js stampedeWave)
// THE CROWD FITS THE MACHINE (src/domain/crowd-cap.js): bodies alive at once start at `start` and follow the frame between `min` and
// `max` (the gunship's own aliveBudget, 3500); under 28 fps (36 ms) it comes down 15% a second, over 42 fps (24 ms) it goes up 6%
// THE SQUADS (owner, 2026-10-05: "one unit 'representing' 5 or so, maybe elongated shape, and every n unit is one of those, visually
// looks almost similar, if hit by a tank, it registers as 5 kills"). A wave with `over` or more soft bodies keeps `single` of them as
// themselves (the front of it, the ones a player meets one by one) and packs the rest `size` to a body: one entity, one draw call,
// `size` bodies of health, a member shed (and paid) at each body's worth of damage, `size` rams in one (src/domain/squads.js,
// src/fx/squads.js). `dens`: a member's dots against a single body's; `reach`: the clump's contact radius against a body's; `area`:
// the damage sources that hit every member at once (the gunship's rounds and strikes, SOL's beam).
// ONLY THE BIG WAVES, AND MIXED (owner, 2026-10-06: "not for the earlier waves, which are not that big; only when there are hundreds or
// thousands, and mix regular single bodies with the 5x ones"): `over` is the wave that packs at all; the singles are `single` or `share`
// of the wave, whichever is more, dealt among the squads in `runs` alternating runs. CLOSER AND STAGGERED ("their clusters should be
// closer together and slightly staggered; otherwise how they move looks unnatural"): members `spacing` apart in two rows `stagger`
// apart, each with its own wobble phase
export const SQUADS = freeze({ over: 300, single: 60, share: 0.2, runs: 3, size: 5, dens: 0.6, spacing: 0.55, stagger: 0.7, reach: 1.6, area: ['strike', 'laser'] });
export const CROWD_CAP = freeze({ start: 1500, min: 400, max: 3500, slowMs: 36, fastMs: 24, down: 0.85, up: 1.06, every: 1 });
export const SECTOR_STAMPEDE = freeze({ every: 2, size: 3, cores: 2, core: 'barbed', fallback: 'amoeba', callout: 'STAMPEDE — RAM THEM', trickle: 2, trickleGap: 1.3, trickleMax: 24, tierSize: 1, tierCores: 2, trickleCallout: 'SOFT ONES — KEEP THE CHAIN' });

// THE CANYON, in cells: `length` long and open `halfWidth` either side of its centre line, `wall` cells of rock beyond that and
// across its deep end (src/domain/canyon.js). The swarm is `swarm` times a sector pulse of the ladder wave `ladder` past the sector's
// start, every one up at the deep end at once (`spread` cells of scatter as they rise, each drawn with `dens` of a body's dots: hundreds
// of full clouds packed under SOL-82's camera took the frame from 60 to 18 fps); `seatAfter` seconds after the last is up the
// pass is laid over the canyon with `pass` (overhead and energy in seconds, radius in metres, slew m/s), the player in its seat.
// The base's own breach opens `gateAfter` seconds after the pass's overhead ends (the player is in SOL-82's seat until then).
// Isao: `brief` as the swarm rises, `passBrief` as SOL-82 comes over it
// (owner, 2026-10-03: "Canyon announce to control of SOL too long, 2x faster exposition, same for Canyon round 2") the swarm is released
// `firstPulse` seconds into the sector instead of after a whole pulse (14 s), and SOL comes over it `seatAfter` seconds after its last body
// is up (was 6). Compressing the rise itself left the swarm bunched at the deep end and the beam's first pass took half as many
export const CANYON = freeze({ length: 48, halfWidth: 1.2, wall: 3, swarm: 5, ladder: 2, spread: 1.2, dens: 0.35, firstPulse: 3, seatAfter: 2,
  pass: { overhead: 45, energy: 25, radius: 12, slew: 16 }, gateAfter: 4, brief: 'canyon_rises', passBrief: 'canyon_pass', briefAgain: 'canyon_again' });

// WHERE THE SIDE BREACH COMES UP (src/domain/side-breach.js), in cells: on open ground outside the clearing, between minWall and
// maxWall from the nearest wall, within reach of a sentry socket (the Rotor and the Quiver reach 3.5 to 3.6, src/towers.js) and at least
// gateClear from the gate, so it is beside the gate and not in its mouth. It opens with a blast of clearRadius (a breach's own is 6,
// which would take the base's rim with it), cuts a lane one cell wide through the rock to the wall, and breaks `gap` wall cells there
export const SIDE_BREACH = freeze({ minWall: 2.5, maxWall: 5, reach: 3.5, gateClear: 3.5, clearRadius: 0.6, gap: 2, brief: 'side_breach', callout: 'THE WALL IS BREACHED' });

// BETWEEN THE RAMP AND THE BACK DOOR: while the door is not due, each sector past SECTORS is a held one on the gate side, its threat
// climbing threatStep a sector from the last of SECTORS, its programme starting at ladderStart
export const SECTOR_HOLD = freeze({ name: 'SECTOR', breaches: { gate: 2 }, waves: 5, ladderStart: 5, threatStep: 0.15, pulse: 13, held: { kg: 60, points: 600 },
  brief: ['They are still coming, and there are more of them each time.', 'Hold the gate. The colony is watching.'] });

// THE BACK DOOR IS DUE once everything is unlocked (every landing site's part home, Isao's programme printed but for the back gate,
// which needs the door) and never before `earliest`; it comes at `latest` whatever is unlocked. It is decided at the start of the
// sector before it, so the omens (BACK_OMENS) can rumble in that sector.
export const SECTOR_DOOR = freeze({ earliest: 7, latest: 8 });

// THE CANYON AGAIN (owner, 2026-10-01: "SOL first pass; very satisfying, let's add a second round of that as the penultimate wave").
// The held sector just before THE BACK DOOR is the canyon a second time: the same canyon re-cut and re-filled at the antipode, the
// pass laid over it with CANYON's numbers, and the player glided into the seat; the base's own mouth waits for the pass as before.
// The door is never earlier than 7 so this sector always exists (sector 6 at the earliest). These fields lie over SECTOR_HOLD's.
export const SECTOR_CANYON_AGAIN = freeze({ name: 'THE CANYON AGAIN', breaches: { gate: 1 }, canyon: true, new: 'SOL-82 over the canyon again',
  brief: ['The canyon on the far side is filling again. More than last time.', 'SOL-82 is on its way over it. You know what to do.'] });

// THE BACK DOOR: THE FEAST, THEN THE SCRAMBLE (owner, 2026-09-24: "really a chance for the tank to kill tons of rammable soft
// enemies for the first wave, and then the necessity to spend resources to quickly re-inforce that area with turrets"). `back`
// is the first key, so the back breach is picked and opened first and the gate side waits. `feast` replaces the back breach's
// first ladder wave with a flood of soft bodies at the tutorial's surge pace (the books still count it as its first wave), and
// the clock holds while it is fought. The SCRAMBLE comes when no more than `scrambleShare` of it is left, or `timeout` seconds
// after it rose: Isao asks for turrets behind the bays, the clock resumes, and the gate side opens `gateAfter` seconds later.
// `n` is the sector it falls in, set by the schedule.
export const BACK_DOOR_SECTOR = freeze({ name: 'THE BACK DOOR', breaches: { back: 1, gate: 1 }, waves: 6, ladderStart: 4, threat: 2.6, pulse: 14,
  feast: { entries: [{ type: 'amoeba', count: 40 }, { type: 'phage', count: 20 }], pace: 1.7, scrambleShare: 0.35, timeout: 50, gateAfter: 10 }, held: { kg: 70, points: 700 },
  gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: false, new: 'the back mouth opens',
  brief: ['The rock behind the bays gave way. Something is walking in there.', 'Soft ones first. Then build behind the bays.'] });
// the sector after the door: both sides, hard cores in every wave. THE COLONY HOLDS after it
export const BOTH_WALLS_SECTOR = freeze({ name: 'BOTH WALLS', breaches: { gate: 1, back: 1 }, waves: 8, ladderStart: 6, threat: 2.4, pulse: 12, held: { kg: 80, points: 800 },
  gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: true, hardcores: 2, new: 'hard cores in every wave',
  brief: ['Every wave brings hard cores now. Do not ram them.', 'One front each side. Split the tank and the sky between them.'] });

// PAST BOTH WALLS the sectors are generated from it: its flags carry over, `new` is null. With `past` the sectors after BOTH WALLS
// (1, 2, ...): waves = wavesBase + past, threat climbs threatStep a sector from BOTH WALLS', sides cycle by sector
// ((past - 1) % sides.length: both on the gate, then both at the back), held grows heldStep a sector. Generated breaches start the
// ladder at ladderStart; ladderCap is the highest ladder wave any sector's wave is sized at: 11 is where a generated sector's last
// waves land in the mid-hundreds alive, which is the frame budget this machine holds, not past it.
export const SECTOR_GENERATOR = freeze({
  name: 'SECTOR', wavesBase: 8, threatStep: 0.15, ladderStart: 6, ladderCap: 11, held: { kg: 80, points: 800 }, heldStep: { kg: 10, points: 100 },
  sides: [{ gate: 2 }, { back: 2 }],
  brief: ['They are still coming, and there are more of them each time.', 'Hold both mouths. The colony is watching.'],
});

// THE BACK DOOR IS FORESHADOWED (owner, 2026-09-24: "slightly foreshadowed"). At these pulses of the sector before the door
// falls (whichever sector that is: the schedule decides it a sector ahead), the mouth behind the bays rumbles: a tremor contact on the radar at its bearing, a low quake, `dust` puffs of grit off
// the rock, and Isao's `brief`. pulse: the pulse it comes with, or 'last' for the sector's final one. The rule is
// src/domain/back-omens.js.
// sector: 'before', the sector the door is scheduled after (SECTOR_DOOR)
export const BACK_OMENS = freeze([
  { id: 'rumble', sector: 'before', pulse: 2, brief: 'back_rumble', dust: 4 },
  { id: 'crack', sector: 'before', pulse: 'last', brief: 'back_crack', dust: 10 },
]);
// THE SCRAMBLE: Isao's `brief` and the `callout` when he asks for turrets behind the bays; the back sockets ring every `every`
// seconds for `seconds` after that (src/fx/back-omen.js, src/fx/sector-run.js)
export const BACK_SCRAMBLE = freeze({ seconds: 8, every: 1, brief: 'back_scramble', callout: 'BUILD BEHIND THE BAYS' });

// PLACEMENT, in cells (the caller converts to its own units): two breaches of a sector stand at least minSeparationCells
// apart, never within exclusionCells of a sealed breach (the gunship's far breach uses 6, GUNSHIP_FAR), and are picked from the farthest
// open cells on their side, at random among those within bandHops of the farthest still valid
// ringHops: gate-side breaches stand on this ring of walking hops from the heart, not the field's far ring (about 69): at the
// sector pace a wave walks in about thirty seconds instead of a minute (owner, 2026-09-24: "too slow between enemies").
// rimCells: and never within this many cells of the clearing. A breach blows out every rock cell within its clearRadius (6), so
// one opened near the base's rim carved a way in beside a gate that still stood at 100% (measured with --pacing --passive: the
// heart lost its first life 20 s into sector 1). The far ring never came that close; the near one can
export const SECTOR_PLACEMENT = freeze({ minSeparationCells: 12, exclusionCells: 6, bandHops: 3, ringHops: 45, rimCells: 10 });

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
// backDoorLead 8 -> 5 (2026-09-25): the lead is sector time now, and the collapse's own frozen shot (5.6 s) no longer counts in it,
// so 8 put sector 2's first arrival past the spec's 40 s (--pacing: 40.3 s)
// firstGrace: the first sector's wait after the story is ready for it, unless a part comes home first (src/domain/sectors.js
// firstSectorDue): the expedition Isao has just sent the tank on
// `soft` (2026-10-03): every rammable entry of a sector's waves is multiplied by up to it, climbing `softStep` a sector from x1 at sector 1
// (x2 from sector 5: the lane's first sectors held by sentries alone fell at x2); the alive budget rose with it (520 -> 900)
// (2026-10-03, second pass: "still very comfortable 50fps constant ... not enough enemies. Canon fodder! more!") x4 at most, +0.5 a
// sector (x2 at sector 3, x4 from sector 7), the alive budget 900 -> 1500
// `stall`: seconds a fighting sector may go without a kill, a wave or a breach opening before it moves itself on (2026-10-05)
export const SECTOR_TIMING = freeze({ stall: 20, briefSeconds: 6, staggerSeconds: 1.5, backDoorLead: 5, securePause: 3, lostHold: 2.5, pace: 1.5, aliveBudget: 2500, firstGrace: 90, soft: 8, softStep: 1, softBase: 2 });   // HUNDREDS (owner, 2026-10-05: "dozens of enemies, there should be hundreds"): x2 soft bodies from sector 1, +1 a sector, to x8; room for 2500

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
