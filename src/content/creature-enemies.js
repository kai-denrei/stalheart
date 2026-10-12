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
  // the Nih-Dairia family (pass two: src/fx/nih-dairia, the boss lab's `reed` variant, one soft body each on a frame of its own); the
  // table is here so the tiers are one decision, the body adapter is not built yet
  reed: {
    small: { label: 'REED · SMALL', r0: 2, hp: 3, speed: 0.45, bounty: 14, count: { share: 0.5 }, probeStep: 5, capacity: 400 },
    medium: { label: 'REED · MEDIUM', r0: 4, hp: 8, speed: 0.45, bounty: 28, count: { share: 0.5, max: 30 }, probeStep: 3, capacity: 200 },
    big: { label: 'REED · BIG', r0: 7.5, hp: 20, speed: 0.4, bounty: 60, count: { count: 3 }, probeStep: 2, capacity: 100 },
    huge: { label: 'NIH-DAIRIA', r0: 20, hp: 60, speed: 0.35, bounty: 150, count: { count: 1 }, probeStep: 1, capacity: 20 },
  },
});

// the record's size for a tier (ENEMY_SPEC's unit)
export const tierSize = (t) => sizeOf(t.r0);

// HOW A BODY FOLLOWS ITS RECORD. The record walks the cell graph (src/fx/enemy-step.js); the body hunts the record's point `lead` seconds
// ahead along the record's walk, and hops faster the further behind it is: its hop's duration x 1 / (1 + lag / (catchRadii x r)), no
// faster than `fastest` (the boss lab's full lunge is 0.375). Simulated (a body on a wandering record at the tier's speed x the sector's pace
// 1.5, 60 s): 0 to 2 re-placements per ten bodies a minute, the body 1.2 to 2.4 radii behind on average. Behind by more than the leash, max(leashRadii x r, leashMin m), for `grace` seconds, or by
// twice the leash at once, it is put on the record's point (counted: the probe reports how often). `emergeRadii`: rising out of a breach it starts that many radii under the ground.
export const CREATURE_FOLLOW = freeze({ lead: 1.8, catchRadii: 1.5, fastest: 0.3, leashRadii: 3, leashMin: 8, grace: 1.5, emergeRadii: 3 });

// THE DEATH (CUTIS_DEATH, the boss lab's): its hop held, it deflates over `deflate` s, then fades and sinks `sink` radii over `fade` s, then
// its slot is free. The game's puddles fade faster than the lab's 20 s: a sector kills hundreds.
export const CREATURE_DEATH = freeze({ deflate: CUTIS_DEATH.deflate, fade: 6, sink: 0.25 });

// THE PROBE (&ramp=1): first `baseline` s of the sector alone (no probe bodies: its mean and p95), then on top of the running sector,
// `step` bodies of the tier (the tier's probeStep) every `hold` seconds, at the sector's live breaches (round-robin; none open yet, on a
// ring of cells `ringHops` hops from the heart); the frame's real ms in a `span` s sliding mean; done when that mean stays above the
// limit for `overSeconds` (or `hardCap` bodies, or `maxSeconds`). The limit (`relative`, src/domain/creature-ramp.js rampLimit): the most
// of `thresholdMs`, the baseline x (1 + `overRatio`) and the baseline + `overMs` (2026-10-12: the sector alone ran at ~20 ms on the M4,
// so a fixed 16.7 ms said "fits 0" for every tier; the question is what the bodies add). A step's first
// `settle` s (the spawn's own hitch) are not in its numbers. Up to `perFrame` bodies spawn a frame while the tier is under the target
// (towers kill them: the probe keeps the count up). Its bodies are harmless (they do not hurt the heart, and the sector does not wait
// for them). `test`: the browser step's overrides (&ramp=test; headless frame times mean nothing, the counts are not asserted).
export const CREATURE_PROBE = freeze({
  hold: 4, settle: 1, span: 1, thresholdMs: 16.7, overSeconds: 3, hardCap: 2000, startDelay: 6, maxSeconds: 900, perFrame: 40, ringHops: 18, gapMs: 250,
  baseline: 8, relative: true, overRatio: 0.1, overMs: 1.5,
  // headless: a short baseline and the fixed tiny budget (the frames mean nothing there; the run only has to end)
  test: { hold: 1.5, settle: 0, span: 0.5, thresholdMs: 0.5, overSeconds: 1.5, startDelay: 1, maxSeconds: 60, gapMs: 5000, baseline: 1, relative: false },
});
