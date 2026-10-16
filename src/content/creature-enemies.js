// CREATURES AS STORY-MODE ENEMIES (owner, 2026-10-12: "we're going to try in the regular stalheart story mode, to replace some of the
// enemies with the Reed and the Cutis-Maku, see how many we can afford at once without dropping fps"; then "swarms of smaller ones, medium
// swarm of medium sized, a few big ones, one huge ones, for both bosses"; spec docs/superpowers/specs/2026-10-12-creature-enemies-probe-design.md).
// Pure data: the four tiers of each family, the share of a sector wave a tier takes under ?creatures=<family>:<tier>, how a body follows its
// record, the death, and the probe's knobs (&ramp=1). The rules are src/domain/creature-ramp.js and src/domain/surface-projection.js.
//
// UNITS. `r0` is the kit's body radius in metres (the Cutis-Maku is ~2 x r0 wide), `hp` in the game's enemy scale (src/enemyspec.js: the
// soft belts 1-2, the solid cores 2-6, the knot boss 5, the jelly boss 9; a 40 mm round deals 4 over 2.2 cells, a sentry 1.15 a hit),
// `speed` in the record's cells a second (ENEMY_SPEC's own unit: x the sector's pace 1.5 x ~1 jitter, a cell is 10 m), `bounty` in kg.
// `size` is the record's (ENEMY_SPEC's unit, x 0.7 x cellSide): the tank's touch reach is 0.56 x size cells, so size = r0 / 5.6 makes the
// touch the body's own radius.
import { CUTIS_DEATH } from './cutis-maku.js';
import { STORY_RECIPE } from './story-defaults.js';
import { NIH_DAIRIA_PREDATOR } from './nih-dairia.js';
import { BOSS_FIGHT } from './boss-fight.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };
const CELL = STORY_RECIPE.metresPerCell;
const sizeOf = (r0) => +(r0 / (CELL * 0.56)).toFixed(3);

// The kit's hop at each size: the CUTIS_WAVE / CUTIS_BOSS configurations of src/content/cutis-maku.js scaled across the tiers (r0, reach in
// radii, cycle seconds, hunting urgency); the rest of the kit's numbers are CUTIS_WAVE's
const CUTIS_KIT = {
  cycleDuration: 4, aggression: 2, reach: 15, capAngle: 10, seekSweep: 0.85, seekCount: 3, seekRate: 1, transferAcceleration: 1, neckThin: 0.5, delaySpread: 0.25,
  cubenessPeak: 0.9, wobble: 0.5, r0: 0.2, noiseAmp: 0.2, breathRate: 1.5, cubenessRest: 0.25, pulseSpeed: 2, veinWidth: 0.1,
  skinTint: 12165524, veinTint: 3679278, pulseTint: 15497546, separation: 2, alignment: 0.35, cohesion: 0.15,
};

// count: { share, max } a share of the wave's bodies (at most max), or { count } a fixed number per wave share. probeStep: the bodies the
// probe adds per step. capacity: the tier's instance budget (the probe's hard cap bounds it too).
export const CREATURE_TIERS = freeze({
  cutis: {
    small: { label: 'CUTIS · SMALL', r0: 1.5, hp: 2, speed: 0.4, bounty: 12, count: { share: 0.5 }, probeStep: 25, capacity: 2000, multicolored: true,
      config: { ...CUTIS_KIT, r0: 1.5, reach: 15, cycleDuration: 3 } },
    medium: { label: 'CUTIS · MEDIUM', r0: 4, hp: 6, speed: 0.45, bounty: 24, count: { share: 0.5, max: 40 }, probeStep: 10, capacity: 2000, multicolored: true,
      config: { ...CUTIS_KIT, r0: 4, reach: 14, cycleDuration: 3 } },
    big: { label: 'CUTIS · BIG', r0: 8, hp: 16, speed: 0.45, bounty: 60, count: { count: 3 }, probeStep: 3, capacity: 600, multicolored: false,
      config: { ...CUTIS_KIT, r0: 8, reach: 12, cycleDuration: 5, aggression: 1.5 } },
    huge: { label: 'CUTIS-MAKU', r0: 20, hp: 60, speed: 0.35, bounty: 150, count: { count: 1 }, probeStep: 1, capacity: 200, multicolored: false,
      config: { ...CUTIS_KIT, r0: 20, reach: 8, cycleDuration: 7, aggression: 1.5 } },
  },
  // THE NIH-DAIRIA FAMILY (pass two, src/fx/creature-reed.js: each body one soft body of the ported kit, src/fx/nih-dairia, the boss lab's
  // `variant`, `r0` x 2 metres wide, on a frame of its own). The kit walks in body lengths a second whatever its size (measured offline,
  // 2026-10-12, a target always a metre of native ahead: the bait predator's motion 0.73 body lengths a second, chase speed 4 with the pause
  // 0.3 and the reach 2 1.38), so the small ones get a quick motion and the records of the small and medium tiers walk a little slower
  // than pass one's table (0.35 and 0.4 cells a second, 5.3 and 6 m/s at the sector's pace). Simulated through src/fx/creature-reed.js (a
  // record walking straight at its speed, 30 s): the small one 4.1 m behind on average (7.2 at most, none re-placed), the medium 4.4, the
  // big 3, the Nih-Dairia 10 (its leash 60 m); twelve small ones at 120 Hz 3.9 (2 re-placed in 15 s). Reeds cost: ~0.6 ms a solver step each (the boss
  // lab's probe, 2026-10-09), so a wave takes a low share of them (`count`).
  reed: {
    small: { label: 'REED · SMALL', r0: 2, hp: 3, speed: 0.35, bounty: 14, count: { share: 0.2, max: 6 }, probeStep: 3, capacity: 400, variant: 'reed', ramAt: 120,   /* rammable only by a hull at 120 km/h or more (owner, 2026-10-16: "the player must manoeuver to ram them") */
      motion: { speed: 5, pauseTime: 0.2, reachTime: 1.5 } },
    medium: { label: 'REED · MEDIUM', r0: 4, hp: 8, speed: 0.4, bounty: 28, count: { share: 0.15, max: 4 }, probeStep: 2, capacity: 200, variant: 'reed',
      motion: { speed: 4, pauseTime: 0.5, reachTime: 3 } },
    big: { label: 'REED · BIG', r0: 7.5, hp: 20, speed: 0.4, bounty: 60, count: { count: 2 }, probeStep: 1, capacity: 100, variant: 'reed', motion: {} },
    huge: { label: 'NIH-DAIRIA', r0: 20, hp: 60, speed: 0.35, bounty: 150, count: { count: 1 }, probeStep: 1, capacity: 20, variant: 'nih-dairia', motion: {}, fine: true },
    // THE PUP (owner, 2026-10-16: "small REEDs and small NiDaira emerge here and there in the early waves, new type of enemies"): the Nih-Dairia's own cage at a
    // sixth of its width, a hunter among the Reeds (HUNTERS.mix) and THE ARENA's second wave; after `huge` so the four sizes still grow in order
    pup: { label: 'NIH-DAIRIA · PUP', r0: 3.5, hp: 6, speed: 0.42, bounty: 24, count: { share: 0.1, max: 4 }, probeStep: 2, capacity: 100, variant: 'nih-dairia', motion: {} },
  },
});

// the record's size for a tier (ENEMY_SPEC's unit)
export const tierSize = (t) => sizeOf(t.r0);

// THE NIH-DAIRIA FAMILY'S BODIES (src/fx/creature-reed.js): `motion` the kit's base motion (the boss lab's bait predator; a tier's `motion`
// over it), `batch` bodies made a frame (the boss lab's BATCH: a wave of Reeds does not freeze a frame), `coarse` the solver at 1 / `hz` s
// while more than `above` of the family's bodies stand (the boss lab's switch; a `fine` tier, the Nih-Dairia, always at the kit's 1/240 s),
// `budget` ms of solver a frame for the family outside the probe (the boss lab's wave budget: past it every body's clock runs slower
// alike; the probe runs without it, it measures the true cost), `reanchor` metres from its frame's origin before a body's frame moves
// under it (at least `reanchorSizes` of its width). THE DEATH (the v1 death, the boss lab's): its motion off, the gravity to
// `deathGravity`, it collapses `collapse` s, then its solver stops and it sinks `sink` of its height and fades over `fade` s, and goes
// (no carcasses in the game yet).
export const CREATURE_REED = freeze({
  motion: NIH_DAIRIA_PREDATOR, batch: 3, coarse: { on: true, above: 10, hz: 120 }, budget: 10, reanchor: 20, reanchorSizes: 1,
  deathGravity: BOSS_FIGHT.deathGravity, collapse: BOSS_FIGHT.wave.corpse, fade: 3, sink: 0.35,
});

// HOW A BODY FOLLOWS ITS RECORD. The record walks the cell graph (src/fx/enemy-step.js); the body hunts the record's point `lead` seconds
// ahead along the record's walk, and hops faster the further behind it is: its hop's duration x 1 / (1 + lag / (catchRadii x r)), no
// faster than `fastest` (the boss lab's full lunge is 0.375). Simulated (a body on a wandering record at the tier's speed x the sector's pace
// 1.5, 60 s): 0 to 2 re-placements per ten bodies a minute, the body 1.2 to 2.4 radii behind on average. Behind by more than the leash, max(leashRadii x r, leashMin m), for `grace` seconds, or by
// twice the leash at once, it is put on the record's point (counted: the probe reports how often). `emergeRadii`: rising out of a breach it starts that many radii under the ground.
// `flash` (owner, 2026-10-15: "maybe we need a slight hit-animation to register the hit, the body lightly flashing white"; then "enemies hit by something
// but not dying should register the hit visually, with a temporary red halo"): seconds a Pearl body stays lit red after a hit lands on its record (src/fx/creature-bodies.js lookInto -> the kit's tint channel, src/fx/cutis-maku/shaders.js)
export const CREATURE_FOLLOW = freeze({ lead: 1.8, catchRadii: 1.5, fastest: 0.3, leashRadii: 3, leashMin: 8, grace: 1.5, emergeRadii: 3, flash: 0.35 });

// THE DEATH (CUTIS_DEATH, the boss lab's): its hop held, it deflates over `deflate` s, then fades and sinks `sink` radii over `fade` s, then
// its slot is free. The game's puddles fade faster than the lab's 20 s: a sector kills hundreds.
export const CREATURE_DEATH = freeze({ deflate: CUTIS_DEATH.deflate, fade: 6, sink: 0.25 });

// THE PROBE (&ramp=1): first `baseline` s of the sector alone (no probe bodies: its mean and p95), then on top of the running sector,
// `step` bodies of the tier (the tier's probeStep) every `hold` seconds, on THE GROUND BEYOND THE GATE (`ground`, below); the frame's
// real ms in a `span` s sliding mean; done when that mean stays above the
// limit for `overSeconds` (or `hardCap` bodies, or `maxSeconds`). The limit (`relative`, src/domain/creature-ramp.js rampLimit): the most
// of `thresholdMs`, the baseline x (1 + `overRatio`) and the baseline + `overMs` (2026-10-12: the sector alone ran at ~20 ms on the M4,
// so a fixed 16.7 ms said "fits 0" for every tier; the question is what the bodies add). A step's first
// `settle` s (the spawn's own hitch) are not in its numbers. Up to `perFrame` bodies spawn a frame while the tier is under the target
// (towers kill them: the probe keeps the count up). Its bodies are harmless (they do not hurt the heart, and the sector does not wait
// for them). `test`: the browser step's overrides (&ramp=test; headless frame times mean nothing, the counts are not asserted).
// THE GROUND AND THE DEFENCE (owner, 2026-10-12: "don't spawn the enemies straight into the base without defense, it should be tested
// against sentries. spawn them beyond the gate, not inside the base, with some sentries already built"; src/domain/probe-ground.js).
// `ground`: the probe's bodies come up outside the walls, `lo`..`hi` hops out from the front gate over the outside ground, on cells
// whose way to the heart is the gate (`slack` hops of give), spread over up to `cells` cells at least `apartCells` apart, in turn.
// `sentries`: `count` sentries stand at boot (the chapters' own build, commitTower; &sentries=N overrides, 0 none, at most the story's
// ten), on rock touching the outside ground within `reach` hops of the gate, the story's two lane sockets first, `apartCells` apart
// where the wall allows; their types in `mix` order: the four earned by ?skip=defence (the base's Rotor and Quiver, the Relay and the
// Mortar of its two expeditions): two Rotors and two Quivers for the single bodies, a Mortar for the swarms' splash, a Relay's slow
// field to hold them in the others' reach. THE HEART IS HELD while the probe runs (it takes no damage and the sector can neither be
// lost nor secured: the probe kept stepping only while the sector did, and the unprotected sector fell at ~40 s).
// `test`: a long run (the browser step checks the probe keeps stepping for a minute of wall time), a budget it never crosses.
// THE HUNTERS (owner, 2026-10-15: "a handful of Reeds and small ni-dhaira once in a while during the waves, giving diversity. Non rammable, they
// actively try to hunt the tank, not too big, smaller in height than the height of the walls"; src/domain/hunters.js): from sector `from`, every
// `every`-th pulse of a breach adds `count` of the `family`'s `tier` to the wave, never over `alive` alive at once; a hunter walks the exits
// nearer the tank's cell (src/fx/enemy-step.js, a walking-distance field from the tank once a second) and hurts it on touch as any hard core.
// The small Reed (r0 2 m, 4 m wide) under a wall of 0.03 planet radii; the family's solver is held to its `budget` ms a frame past which the
// bodies' clocks slow (CREATURE_FAMILY). Measured on this machine (2026-10-12): ~0.6 ms a solver step a Reed at 240 Hz, so two are ~5 ms a frame
// at 60 fps before the budget bites: the owner measures on his (?creatures=reed:small&ramp=1&fps=1). ?hunters=0 turns them off; count 0 too.
// `mix` (2026-10-16): the hunters alternate through it, a pulse's batch at a time (the small Reed, then the Nih-Dairia pup, ...); `family`/`tier` stay the first
export const HUNTERS = freeze({ from: 2, every: 3,   /* from sector 2 (owner, 2026-10-16; was 5) */ count: 1, alive: 2, family: 'reed', tier: 'small', pace: 1, mix: [{ family: 'reed', tier: 'small' }, { family: 'reed', tier: 'pup' }] });

export const CREATURE_PROBE = freeze({
  hold: 4, settle: 1, span: 1, thresholdMs: 16.7, overSeconds: 3, hardCap: 2000, startDelay: 6, maxSeconds: 900, perFrame: 40, gapMs: 250,
  baseline: 8, relative: true, overRatio: 0.1, overMs: 1.5,
  ground: { lo: 8, hi: 20, slack: 2, cells: 24, apartCells: 3 },
  sentries: { count: 6, max: 10, mix: ['rotor', 'quiver', 'mortar', 'rotor', 'quiver', 'relay'], reach: 3, apartCells: 2 },
  // headless: a short baseline, a step every 4 s for 75 s of wall time and a budget it never crosses (the frames mean nothing there)
  test: { hold: 4, settle: 0, span: 0.5, thresholdMs: 1e6, overSeconds: 1.5, startDelay: 1, maxSeconds: 75, gapMs: 5000, baseline: 1, relative: false },
});
