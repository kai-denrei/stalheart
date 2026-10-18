// THE SECTORS (docs/superpowers/specs/2026-09-15-v1-session-design.md, section 2). A sector opens two breaches at once,
// each with its own programme of `waves` waves sized by the computeWavePlan ladder at the sector's `threat`. First
// numbers, tuning later. Pure data: the rules live in src/domain/sectors.js and src/domain/sector-stats.js.
import { SENTRY_ORDER } from './sentries.js';
import { GUNSHIP_GUN_ORDER } from './gunship.js';
import { BOSS_FIGHT } from './boss-fight.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };

// breaches: how many open on each side (gate: toward dungeon.spawn; back: through the reopened back mouth behind the bays)
// the flags switch systems on and stay on once a sector has turned them on: gunshipCall (the call-in meter), backDoor (the
// sealed clearing mouth nearest +Z reopens), laser (SOL-82 passes), hardcoresEveryWave (a hard core joins every wave)
// held: what a breach held to its last wave pays when it collapses on its own. brief: Isao's two lines on the brief card
// ladderStart: the computeWavePlan ladder wave before a breach's first wave. The ladder does NOT add up across sectors; the
// sector's threat and its ladder window do the growing.
//
// THE CLIMB (owner, 2026-09-16: "slow start, then it should start getting hectic... hundreds of low levels, a few more hardcores").
// THE SHAPES (owner, 2026-10-15, asked what a late sector should feel like under the Pearl set: "both by sector"; spec
// docs/superpowers/specs/2026-10-15-sector-shapes-design.md, rules src/domain/sector-shape.js). Every row sizes its waves IN BODIES here;
// the ladder (computeWavePlan at the breach's ladder wave) chooses only which types a wave brings. Before this the count was the ladder's
// plan times the threat, times a soft factor (x8 by sector 7), times the invasion surge, times the stampede's flood: 4,000 to 5,600 a
// wave and 30,000 a sector from sector 8, which the crowd cap dripped out (2026-10-15-pearl-crowd-measured-headed: a column of 1,200
// holds the frame, a pile at the hull does not).
// shape 'pulse' (S1-S3): `bodies` is the count per wave PER BREACH (the last entry repeats past the list); the next wave arms `pulse`
//   seconds after the last release once the field is at or under breath.at of that pulse's size (a breath to build and repair), or
//   breath.max seconds after it whatever is alive (a player who falls behind is stacked). The stampede marks wave 2 a trickle and
//   wave 4 a flood (SECTOR_STAMPEDE) without multiplying.
// shape 'flow' (THE PRESS and after: its brief already said "The lane is never empty now."): `flow` is for the WHOLE FIELD: every pulse
//   sends `burst` bodies from every open breach, streamed over `pulse` seconds, and the next pulse arms as soon as the field is under
//   `alive` (clamped by the crowd cap); the books count ceil(total / breaches / burst) waves a breach, so HELD, QUICK HANDS and the
//   forfeit work as before. The lane sits between the target and the target plus a burst a mouth and never empties.
// coreShare: the share of a sized wave that is hard cores (the plan's cored types in their proportions, one of each while it fits);
//   the flood's cores and `hardcores` ride on top.
// hardcores: how many solid cores ride every wave once hardcoresEveryWave is on.
// THE RAMP, THEN THE SIDE WALL, THEN THE BACK DOOR (owner, 2026-10-01: "Backdoor wave too aggressive. Let's delay it. First we run
// more regular waves. Ramp up the difficulty. Then after 4 waves there's a « side breach » ... The backdoor breach comes towards the
// end, once the player has unlocked all options"; asked, he chose four shorter sectors, SOL-82 at sector 3, the back door once
// everything is unlocked with a latest sector, SKIP ALL at sector 1 on the finished base). SECTORS are the fixed opening of the
// arc: four regular sectors on the gate side, four pulses each, climbing; then sector 5. Past them the run holds on SECTOR_HOLD
// sectors until the back door is due (SECTOR_DOOR), then THE BACK DOOR, BOTH WALLS, and SECTOR_GENERATOR's sectors from there.
export const SECTORS = freeze([
  { n: 1, name: 'THE LANE', shape: 'pulse', bodies: [10, 20, 30, 50], breath: { at: 0.25, max: 60 }, coreShare: 0, breaches: { gate: 2 }, waves: 4, ladderStart: 0, threat: 1.2, pulse: 12, held: { kg: 40, points: 400 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: 'the gunship call-in',
    brief: ['Two mouths out on the lane. They come four times each.', 'Close one too early and we lose the biomass it would have paid.'] },
  { n: 2, name: 'THE LONG LANE', shape: 'pulse', bodies: [20, 35, 50, 90], breath: { at: 0.25, max: 55 }, coreShare: 0, breaches: { gate: 2 }, waves: 4, ladderStart: 1, threat: 1.5, pulse: 10, held: { kg: 45, points: 450 },
    gunshipCall: true, backDoor: false, laser: false, hardcoresEveryWave: false, new: null,
    brief: ['More of them this time, and closer together.', 'Keep the lane clear and the gate whole.'] },
  // THE CANYON (owner, 2026-10-01: "let's have it used the first time at the antipode, far from all other sentries; a huge number of
  // ennemies, 5x the usual, in a long canyon, easy target for the SOL. a satisfying use of its immense power"; asked, he chose this
  // sector for it, survivors marching on the base, the player seated with a glide). One gate breach keeps the base busy; the swarm
  // comes up at the far end of a canyon cut at the antipode (CANYON) and SOL-82's first pass is laid over it
  { n: 3, name: 'THE CANYON', shape: 'pulse', bodies: [30, 50, 70, 120], breath: { at: 0.25, max: 50 }, coreShare: 0.03, breaches: { gate: 1 }, waves: 4, ladderStart: 2, threat: 1.8, pulse: 10, held: { kg: 50, points: 500 }, canyon: true,
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'SOL-82 online',
    brief: ['A tremor on the far side of the world. A swarm, massing in a canyon.', 'The gate waits for you. The far side does not.'] },
  // nearFirst (owner, 2026-10-19, round three, note 3): the lane is never empty. The first gate breach of sectors 4 and 5 stands on the near ring
  // (SECTOR_PLACEMENT.flowFirstHops), the ring behind it (ringHops); no other sector has it
  { n: 4, name: 'THE PRESS', shape: 'flow', flow: { alive: 450, total: 1800, burst: 150, pulse: 6 }, coreShare: 0.03, breaches: { gate: 2 }, nearFirst: true, ladderStart: 4, threat: 2.1, pulse: 6, held: { kg: 55, points: 550 },
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: null,
    brief: ['They are pressing harder. The lane is never empty now.', 'Spend what you have. The colony can print more.'] },
  // THE SIDE WALL (owner, 2026-10-01: "after 4 waves there's a « side breach ». Problem, but still within range of some of the existing
  // towers so easier to manage. This is a chekov's gun of sorts, it reveals that the walls can be breached"). `side` is the first key,
  // so the side breach is picked and opened first: it comes up outside the gate's wall, inside the front sentries' reach, and cuts
  // its way to the wall (SIDE_BREACH). Isao prints the wall shut again once the lane is quiet.
  { n: 5, name: 'THE SIDE WALL', shape: 'flow', flow: { alive: 550, total: 2400, burst: 180, pulse: 6 }, coreShare: 0.05, breaches: { side: 1, gate: 1 }, nearFirst: true, ladderStart: 5, threat: 2.2, pulse: 6, held: { kg: 60, points: 600 },
    gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'a breach through the wall',
    brief: ['Something is digging beside the gate. Close to the sentries.', 'One mouth on the lane, and one where it comes up.'] },
]);

// THE STAMPEDE (owner, 2026-10-02: the ramming is the fun, so more waves of weak bodies, bigger ones, a few hard cores to force the
// shield): in a PULSE sector every `every`-th wave of a gate or back breach is a stampede, alternating a TRICKLE (the wave's bodies one
// every `trickleGap` seconds, so a steady rammer can keep the combo alive; `trickleCallout`) and a FLOOD (`cores` x `core` riding in it;
// `callout`) (src/domain/stampede.js). THE SIZE IS THE ROW'S (2026-10-15): neither kind multiplies the wave any more
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
export const SQUADS = freeze({ over: 600, unpackUnder: 100, single: 60,   /* unpackUnder: with fewer than 100 bodies alive a squad is set down as its singles (owner, 2026-10-16: packs of five walking to the base looked odd) */   /* over 600 (was 300; owner, 2026-10-16): squads only in huge waves, hidden among the mass */ share: 0.2, runs: 3, size: 5, dens: 0.6, spacing: 0.55, stagger: 0.7, reach: 1.6, area: ['strike', 'laser'] });
export const CROWD_CAP = freeze({ start: 1500, min: 400, max: 3500, slowMs: 36, fastMs: 24, down: 0.85, up: 1.06, every: 1 });
export const SECTOR_STAMPEDE = freeze({ every: 2, cores: 2, core: 'barbed', callout: 'STAMPEDE — RAM THEM', trickleGap: 1.3, trickleCallout: 'SOFT ONES — KEEP THE CHAIN' });

// THE CANYON, in cells: `length` long and open `halfWidth` either side of its centre line, `wall` cells of rock beyond that and
// across its deep end (src/domain/canyon.js). THE SWARM IS A COLUMN (owner, 2026-10-15: "the first batch of aliens with SOL, should be 5x to
// 10x more numerous, and from an open sinkhole that we will close with the SOL, educate the player"; and of the canyon again: "much too few
// enemies, and they are all stuck behind the rock and the walls, need more to feel satisfying, push the limits within our understanding of fps
// cost, knowing that soon they will be obliterated by the laser"): `bodies.first` bodies the first time and `bodies.again` the second, in the
// ladder wave `ladder` past the sector's start's mix (src/domain/sector-shape.js sizeWave, the row's coreShare), every one up at once along the
// deepest `fill` of the floor from the hole outward (one body a cell, deep end first, then the next cell: a column the pass sweeps down), each
// `spread` cells of scatter as it rises, drawn with `dens` of a body's dots. Was: five two-breach pulses of the ladder wave (360 bodies) in a
// 2.4-cell trench, where the walls held the first hundred at the deep end. The trench is 5 cells wide now and 56 long: fifteen hundred bodies
// have room to walk, and the frame's own guard (CROWD_CAP, 1,500 at best) holds what it cannot draw. THE HOLE STAYS OPEN: the sinkhole the
// swarm rose from is not collapsed once its swarm is out; it stands open at the deep end for SOL-82's beam to seal (the pass starts over it),
// and collapses on its own when the pass is over if the beam never touched it (src/fx/sector-run.js). `seatAfter` seconds after the last is up
// (or `queueWait` seconds after the first, when the crowd gate on a slow machine still holds part of the column in the queue: owner, 2026-10-16,
// 'sector 3, the canyon: it fails to unlock and give us the SOL control'; the pass is not kept waiting for a queue that only drains as the base kills)
// the pass is laid over the canyon with `pass` (overhead and energy in seconds, radius in metres, slew m/s), the player in its seat.
// The base's own breach opens `gateAfter` seconds after the pass's overhead ends (the player is in SOL-82's seat until then).
// Isao: `brief` as the swarm rises, `passBrief` as SOL-82 comes over it
// (owner, 2026-10-03: "Canyon announce to control of SOL too long, 2x faster exposition, same for Canyon round 2") the swarm is released
// `firstPulse` seconds into the sector instead of after a whole pulse (14 s), and SOL comes over it `seatAfter` seconds after its last body
// is up (was 6). Compressing the rise itself left the swarm bunched at the deep end and the beam's first pass took half as many
// THE TRENCH IS THE BEAM'S WIDTH (owner, 2026-10-15: "the first SOL manual control, the corridor should be smaller, so the enemies cannot escape to
// the sides"): `halfWidth` 1.5 (3 cells, 30 m) under a pass whose footprint is `radius` 15 m (was a 5-cell trench under a 12 m footprint: the
// bodies along either wall stood outside the beam and walked out of the pass). The column stands fifteen to a cell deeper for it.
export const CANYON = freeze({ length: 56, halfWidth: 1.5, wall: 3, bodies: freeze({ first: 1500, again: 2000 }), fill: 0.6, ladder: 2, spread: 0.8, dens: 0.35, firstPulse: 3, seatAfter: 2, queueWait: 10,
  pass: { overhead: 45, energy: 25, radius: 15, slew: 16, drainedAfter: 3 }, gateAfter: 4, charge: 2, strayHops: 60, brief: 'canyon_rises', passBrief: 'canyon_pass', briefAgain: 'canyon_again' });
// NO LULL AFTER THE PASS (owner, 2026-10-07: 'after the second SOL manual canyon there is a downtime in action; nothing happens for
// too long; the enemies who survived the canyon take a long time to reach the base'; measured: the base's own bodies dead a minute
// after the gate, then sixty seconds of nothing while 318 survivors walked, the debrief 104 s after SECURE waiting them out).
// pass.drainedAfter: the laid pass closes this long after its energy is spent, not at its overhead's end; gateAfter: the gate side opens
// this long after the pass closes; charge: the survivors' pace from then on (they rush the base); strayHops: a survivor still this many
// walking hops from the heart is a stray: it holds neither the sector's end nor the debrief, and comes in during the next

// WHERE THE SIDE BREACH COMES UP (src/domain/side-breach.js), in cells: on open ground outside the clearing, between minWall and
// maxWall from the nearest wall, within reach of a sentry socket (the Rotor and the Quiver reach 3.5 to 3.6, src/towers.js) and at least
// gateClear from the gate, so it is beside the gate and not in its mouth. It opens with a blast of clearRadius (a breach's own is 6,
// which would take the base's rim with it), cuts a lane one cell wide through the rock to the wall, and breaks `gap` wall cells there
export const SIDE_BREACH = freeze({ minWall: 2.5, maxWall: 5, reach: 3.5, gateClear: 3.5, clearRadius: 0.6, gap: 2, brief: 'side_breach', callout: 'THE WALL IS BREACHED' });

// BETWEEN THE RAMP AND THE BACK DOOR: while the door is not due, each sector past SECTORS is a held one on the gate side, its threat
// climbing threatStep a sector from the last of SECTORS, its programme starting at ladderStart; its flow (the lane's target and the
// sector's total) climbs aliveStep and totalStep a held sector from `flow`
export const SECTOR_HOLD = freeze({ name: 'SECTOR', shape: 'flow', flow: { alive: 650, total: 3000, burst: 200, pulse: 6 }, aliveStep: 40, totalStep: 300, coreShare: 0.05, breaches: { gate: 2 }, ladderStart: 5, threatStep: 0.15, pulse: 6, held: { kg: 60, points: 600 },
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
export const BACK_DOOR_SECTOR = freeze({ name: 'THE BACK DOOR', shape: 'flow', flow: { alive: 700, total: 3600, burst: 220, pulse: 6 }, coreShare: 0.05, breaches: { back: 1, gate: 1 }, ladderStart: 4, threat: 2.6, pulse: 6,
  feast: { entries: [{ type: 'amoeba', count: 40 }, { type: 'phage', count: 20 }], pace: 1.7, scrambleShare: 0.35, timeout: 50, gateAfter: 10 }, held: { kg: 70, points: 700 },
  gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: false, new: 'the back mouth opens',
  brief: ['The rock behind the bays gave way. Something is walking in there.', 'Soft ones first. Then build behind the bays.'] });
// the sector after the door: both sides, hard cores in every wave. THE COLONY HOLDS after it
export const BOTH_WALLS_SECTOR = freeze({ name: 'BOTH WALLS', shape: 'flow', flow: { alive: 850, total: 4800, burst: 250, pulse: 5 }, coreShare: 0.08, breaches: { gate: 1, back: 1 }, ladderStart: 6, threat: 2.4, pulse: 5, held: { kg: 80, points: 800 },
  gunshipCall: true, backDoor: true, laser: true, hardcoresEveryWave: true, hardcores: 2, new: 'hard cores in every wave',
  brief: ['Every wave brings hard cores now. Do not ram them.', 'One front each side. Split the tank and the sky between them.'] });

// THE BOSS (owner, 2026-10-15: "bring in this boss fight ... replacing ISAO as a lure, with ISAO-Controlling the Tank as lure, while we control
// the Gunship ... a funny choice; ISAO offering to either drive the tank, or let the gunship on autopilot. they land on the idea that since it's a
// new target, a round of manual-override of the gunship is needed. This Boss fight will be somewhere around round 8"; spec
// docs/superpowers/specs/2026-10-15-boss-sector-design.md). The sector after THE BACK DOOR (doorAt + 1; BOTH WALLS moves to doorAt + 2): one
// gate breach sends two waves, `boss.wave` (count of the family's `wave.tier`, each at `wave.hp`) and then `boss.boss` (one of `boss.tier` at
// `boss.hp`), every one a hunter of the tank (src/domain/boss-sector.js); the breath sends the boss once the wave is mostly dead. Isao drives the
// hull on its avoid autopilot, the player takes the gunship by manual override after `choice` (src/fx/boss-run.js, src/fx/choice-card.js).
// THE ARENA (owner, 2026-10-16, third round: "a giant opening very far from the base, with a giant Nih Daira creature ... the tank acts as LURE, while the gunship
// fires from above"; spec docs/superpowers/specs/2026-10-16-arena-design.md; it replaced THE BOSS of 2026-10-15, the Cutis-Maku on the gate lane): one
// breach, the arena's own (`breaches.arena`: on story.arena.cell, ARENA.craterCells wide, kept open as the nest's mouth), three waves: the small Reeds,
// the Nih-Dairia pups (CREATURE_TIERS.reed.pup), then the NIH-DAIRIA itself (`boss.boss`), every one a hunter of the tank.
// THE DRIVE OUT, THEN THE HAND-OVER (owner, 2026-10-16, third version: "a message to go investigate a different tremor somewhere far… we reach the beacon
// with the tank… it opens up, phase 1 the player controls the tank as the gunship helps with the reeds, then phase 2 the monster is too enormous…
// Being bait is the only way… Now we FORCE the player to take the gunship. Isao quips 'I am the better driver, I'll lure it'"): the brief sends the
// player to a tremor at the arena, its breach opens when the hull arrives (ARENA.reachCells; since 2026-10-18 only then, no clock), the player drives and shoots the small
// waves with the gunship on its own autopilot overhead, and as the mother rises Isao takes the hull as the lure (the `lure` directive) and the player is
// put in the gunship's seat (src/fx/boss-run.js). The choice card of 2026-10-15 is gone; its machinery came back on 2026-10-19 as THE MOTHER (ARENA_HANDOVER), one button.
export const ARENA_SECTOR = freeze({ name: 'THE ARENA', shape: 'pulse', bodies: [12, 6, 1], breath: { at: 0.15, max: 90 }, coreShare: 0, breaches: { arena: 1 }, waves: 3, ladderStart: 6, threat: 2.4, pulse: 8, held: { kg: 120, points: 1200 },
  // THE SMALL REEDS THREE TIMES THE SIZE (owner, 2026-10-18, note 8b: "make the smaller reeds 3x bigger, same health"): `size` multiplies the record (its touch
  // and ram radius, src/fx/enemy-step.js) and the drawn body (src/fx/creature-reed.js) together; hp stays 4
  boss: { family: 'reed', waves: [{ count: 12, tier: 'small', hp: 4, pace: 1, size: 3 }, { count: 6, tier: 'pup', hp: 6, pace: 1 }], boss: { tier: 'huge', hp: 180, pace: BOSS_FIGHT.arenaBoss.pace } },   /* the mother's pace: more aggro toward the tank (owner, 2026-10-18, note 8c; BOSS_FIGHT.arenaBoss) */
  gunshipCall: true, backDoor: false, laser: true, hardcoresEveryWave: false, new: 'a boss',
  // THE MESSAGE (owner, 2026-10-18, note 6: "sector 9, it's not quite clear what we must do. We should message it better ... 'Go investigate that area, I'll clear a
  // way there'"): the sector's brief is Isao's order, `arena_go` (src/isaobriefs.js, src/fx/sector-run.js briefOf), and the debrief's next-sector page reads the same
  // THE OWNER'S WORDS (2026-10-19, third round, note 7: "sector 9, we need a voice by Isao to announce : 'other side of the planet, you must check it out.', 'seems
  // big'"): the order is his two lines now; the callout INVESTIGATE THE TREMOR still names the job on screen (src/fx/boss-run.js)
  brief: ['Other side of the planet. You must check it out.', 'Seems big.'] });
export const BOSS_SECTOR = ARENA_SECTOR;   // the arc's boss row, by its old name

// PAST BOTH WALLS the sectors are generated from it: its flags carry over, `new` is null. With `past` the sectors after BOTH WALLS
// (1, 2, ...): the flow's alive climbs aliveStep a sector from BOTH WALLS' up to aliveCap (the column the frame holds, 1,200 Pearl
// bodies measured headed on 2026-10-15) and its total totalStep; threat climbs threatStep a sector from BOTH WALLS', sides cycle by
// sector ((past - 1) % sides.length: both on the gate, then both at the back), held grows heldStep a sector. Generated breaches start
// the ladder at ladderStart; ladderCap is the highest ladder wave any sector's wave takes its types from
export const SECTOR_GENERATOR = freeze({
  name: 'SECTOR', aliveStep: 75, aliveCap: 1200, totalStep: 600, threatStep: 0.15, ladderStart: 6, ladderCap: 11, held: { kg: 80, points: 800 }, heldStep: { kg: 10, points: 100 },
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
// sector pace a wave walks in about thirty seconds instead of a minute (owner, 2026-09-24: "too slow between enemies"). That was the dots' walk; it is
// now the ring of the second and later breaches (the first of sectors 4 and 5 is nearFirst, flowFirstHops): the Pearl column takes about 79 s from 45
// hops (measured headless, 2026-10-19)
// rimCells: and never within this many cells of the clearing. A breach blows out every rock cell within its clearRadius (6), so
// one opened near the base's rim carved a way in beside a gate that still stood at 100% (measured with --pacing --passive: the
// heart lost its first life 20 s into sector 1). The far ring never came that close; the near one can
// flowFirstHops (owner, 2026-10-19, third round, note 3: "sector 4 and sector 5 have the tremor, but the first wave seems empty? There is a long delay
// before enemies arrive"): the first gate breach of a row with nearFirst (THE PRESS and THE SIDE WALL, sectors 4 and 5, and no other: not the hold
// sectors, THE BACK DOOR, BOTH WALLS or the generator's, whose tuned timing was not probed with it) stands on this nearer ring. Measured headless on sector 4 at ringHops (the Pearl
// column walks slower than the dots this ring was set for): the burst left the holes 7 s after the first opened, nothing held, and walked 29-30
// hops for 47 s before its front was within 10 cells of the gate (the gate reached ~80 s after the release). The other breaches keep ringHops,
// so the lane still fills from far out behind the first
export const SECTOR_PLACEMENT = freeze({ minSeparationCells: 12, exclusionCells: 6, bandHops: 3, ringHops: 45, flowFirstHops: 30, rimCells: 10 });
// THE ARENA'S PLACE (owner, 2026-10-16: "a giant opening very far from the base"; src/domain/arena.js, src/platform/story-world.js story.arena): the
// farthest reachable cell outside the walls within `farHops` of the farthest; its opening `craterCells` wide (the sinkhole scaled, src/game-breaches.js)
// reachCells: the hull this near the arena's cell opens it (the drive out to the beacon), and nothing else does: the waitMax fallback (150 s after the start) is gone
// (owner, 2026-10-18, note 6: "waiting for the tank to be physically there, is what triggers the Boss"; it opened the hole with the hull at the base); seatWait: seconds after the
// boss rose the gunship seat is taken whether or not the gunship is over the arena yet (src/fx/boss-run.js, owner 2026-10-16: the drive out, then the forced hand-over)
// seatAfter: the least seconds after the boss rose before the seat is forced, and only once Isao's panel is free (arena_force read first; 2026-10-18)
// remind: seconds between INVESTIGATE THE TREMOR callouts while the hull has not reached it (owner, 2026-10-18, note 6: "not quite clear what we must do"), and only
// when the hull's road distance has not dropped since the last one (a driving player is not nagged; review, 2026-10-18)
// remindMax: after this many reminders Isao drives the hull out himself on the lure directive (`arena_drive`; review of note 6, 2026-10-18): with no clock, a
// hull that never came (a wedge, the player's own walls, AUTO on another order) hung the sector for good; the arrival stays the trigger, about 120 s at remind 40
// THE MOTHER (owner, 2026-10-19, third round, note 8a: "Arena fight; we lost the scene explaining that we need to manually control the gunship while Isao plays Lure
// with the tank"): the card over the paused game as the NIH-DAIRIA rises (src/fx/boss-run.js, src/fx/choice-card.js): this title, Isao's arena_force lines, the
// seat's own controls (quoted from its footer, src/sentry-pilot.js: the gunship flies its own track, the player aims and fires) and one button into the seat
export const ARENA_HANDOVER = freeze({ title: 'THE MOTHER', take: 'TAKE THE GUN',
  hint: 'Click to lock the mouse, move it to aim · Space or the button fires · rounds take seconds to land: lead them · 1 rotary · 2 bofors · 3 MK-9 mini nuke (paint, then release)',
  hintTouch: 'Drag to aim · ◉ fires · the gun buttons above · rounds take seconds to land: lead them · MK-9: paint, then release' });
// decodedCap: seconds after boss_dead before arena_decoded clears a panel other lines keep busy and is shown (review, 2026-10-19: it waited on a free panel, and the
// boss sector's debrief waits on it, up to STORY_CALM.maxHold, 120 s; src/fx/boss-run.js sayDecoded)
export const ARENA = freeze({ farHops: 4, craterCells: 3, radiusCells: 14, seatCells: 14, reachCells: 8, seatWait: 45, seatAfter: 1, remind: 40, remindMax: 3, decodedCap: 20,
  // THE ROAD SOL CUTS (owner, 2026-10-16; src/domain/arena.js roadAhead, src/fx/boss-run.js): every `every` seconds of the drive out, the first rock cell within
  // `ahead` hops of the hull worth a shortcut of `saves` cells on the open walk to the arena (crossed up to `through` rocks deep), else with `flank` the first rock
  // beside the route ahead, never within `clear` cells of the hull by the chord (the beam keeps LASER_AUTO.safeMetres off a friend: 25 m and its radius, 3.1 cells) (second version, 2026-10-16: the cheapest-walk rule fired at 2% of the route, all at the rim), is burned by SOL for `burn` seconds;
  // a pass is laid over it (overhead, energy in seconds, radius in metres, slew m/s) when none is up
  // THE PLANNED ROAD (owner, 2026-10-18, note 6: "a clear fast path (cleared by nukes and SOL)"; src/domain/arena.js roadField/roadRock, src/fx/boss-run.js): the road
  // planned from the arena with a rock cell at `rockCost` (on the shipped planet 214 cells and three rocks, against 282 open), its rocks SOL's first cuts from
  // the sector's start within `plan` cells of road; `every` 7 -> 4 (a simulated drive at the hull's 1.6 cells/s reached the first planned rock before a 7 s
  // cadence had cut it; 4 cut all three ahead of it); its cells `marks` ahead of the hull ringed every `markEvery` seconds
  // overhead 45 -> 3.5, the burn and a second (review of note 6, 2026-10-18): a road pass is a special pass, which the automated aim never takes, and the last one
  // laid on the drive out stayed overhead up to 45 s after the hole opened, so SOL never fired on the small Reeds; each ask lays its own pass anyway
  // aheadMetres: THE BEAM LEADS THE HULL (owner, 2026-10-19, third round, note 7b: "SOL should be destroying the paths much ahead, so that the path is already clear,
  // should be always 50m ahead of the tank clearing the path"): after the first cut (at once, the nearest rock on the planned road, wherever it lies) SOL only takes
  // the cells within aheadMetres of the hull (METRES_PER_CELL, the chord), so the beam is seen working down the road in front of the hull as it drives instead
  // of the whole road burned in the first ten seconds; a planned rock inside that reach is asked for the moment the beam is free (or from a flank burn), the flank
  // on the `every` cadence; clear 4 -> 3.2 cells, just outside the beam's own guard (LASER_AUTO.safeMetres and its radius, 3.1 cells, which roadSafe still checks):
  // between 40 m and 50 m the band was one cell, crossed in about half a second, and road rocks slipped through it to the hull (probe r3-f)
  road: freeze({ aheadMetres: 50, every: 4, ahead: 12, burn: 2.5, saves: 4, through: 2, flank: true, clear: 3.2, overhead: 3.5, energy: 40, radius: 6, slew: 16, rockCost: 2, plan: 400, markEvery: 1, marks: [4, 8, 12] }) });   // radiusCells: the plain carved round the arena's cell when the world is built (owner, 2026-10-16: 'an enormous arena'; the lab's bound was 12 cells)   // seatCells: the gunship this near the arena before the seat opens (owner, 2026-10-16)

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
// `stall`: seconds a fighting sector may go without a kill, a wave or a breach opening before it moves itself on (2026-10-05)
export const SECTOR_TIMING = freeze({ stragglers: 20, stall: 20, briefSeconds: 6,   /* stragglers: a sector is SECURE with up to this many bodies still alive (owner, 2026-10-16: "a sector could be closed while a few stragglers remain") */ staggerSeconds: 1.5, backDoorLead: 5, securePause: 3, lostHold: 2.5, pace: 1.5, aliveBudget: 2500, firstGrace: 90 });   // aliveBudget: the campaign board's clock guard (pulseFits); the story's sectors are sized by their shape (2026-10-15)

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
  knot: 'red', jelly: 'red', cutis: 'brown', reed: 'green',
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
