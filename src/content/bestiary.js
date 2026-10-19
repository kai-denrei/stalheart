// THE TERMINAL AND THE BESTIARY (owner, 2026-10-14: "re-vamp the Units section; Vivarium, Bestiary, Compendium, we will find it a better name
// and 1) display all the unlocked units in their full glory, enemies at high resolution with smooth animations displaying their movement
// patterns ... All this as if was accessed from a Terminal as a screen-within-a-screen, with HUD elements and a border and CRT like display
// effects."; spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md). Pure data: the terminal's copy, the entries' text in Isao's
// voice, the stage's numbers and the terminal's CRT settings. THE OWNER EDITS THE TEXT HERE. The working name is THE BESTIARY until he finds
// a better one: the code calls the screen the terminal and the page the bestiary, so the name changes here alone.
// The rules are src/domain/bestiary.js; the screen src/fx/terminal-screen.js; the stage src/fx/bestiary-stage.js.
import { CREATURE_TIERS, tierSize } from './creature-enemies.js';

const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

// the screen's copy. `header` the HUD lines across the top; `hint` the console's one-line prompt under the Stålheart's gantry; `footer` the key
// hints; `warning` a cored entry's line (amber, blinking once on open); `silhouetteNote` an entry met in an earlier run only ({date} its last
// logged day); `unseenName` / `unseenNote` an entry never met; `ram` the data line's RAM words; `consoleFirst` Isao's line the first time a run
// passes under the gantry with the terminal never opened (text only: no recording yet, the trigger key `console_first`)
export const TERMINAL = freeze({
  name: 'THE BESTIARY',
  header: ['STÅLHEART · FIELD TERMINAL', 'ISAO · CONTACT ARCHIVE', 'SAT-3 UPLINK · NOMINAL'],
  hint: 'TERMINAL · B',
  footer: '↑↓ ENTRIES · ⏎ PACK 3/6 · ESC CLOSE',
  warning: '⚠ SOLID CORE · CANNOT BE RAMMED · the hull is stopped and pushed back',
  silhouetteNote: 'NO RECENT READING · last logged {date}',
  unseenName: '— — —',
  unseenNote: 'NO READING · NOT YET MET',
  noStage: 'NO LIVE STAGE FOR THIS ENTRY · CARD ONLY',
  ram: { soft: 'goes under the treads', cored: 'SOLID CORE' },
  consoleFirst: 'There is a terminal under the gantry. It has a bestiary. I wrote most of it; do not read it in my voice.',
  consoleTrigger: 'console_first',
});

// THE ENTRIES (section 6). One per Pearl tier (its types are PEARL_OF's: test/bestiary.mjs holds the two equal), then the kit creatures as
// entries of their own once met. `stage` false: the card shows without a live stage (the Reeds' kit simulates on a frame of its own on the
// unit sphere, src/fx/creature-reed.js, and does not seat on the stage's bent disc in this piece; the Nih-Dairia's stage is out of this piece).
// `isao` his lines, dry, slightly humorous, a science-fiction reference here and there, not overdone. A creature's `label` is its card's
// tier line and `swatch` its colour in the list.
export const ENTRIES = freeze([
  { id: 'white', name: 'CUTIS-SOFT IVORY', kind: 'tier', types: ['amoeba', 'phage'], stage: true, isao: [
    'Small, soft, and in no hurry to be anything else. They come in numbers because one of them is not an argument.',
    'The amoeba hunts whatever opened the ground. The phage crawls. Both go under the treads with a sound I have stopped finding funny.',
    'If you see one, you are looking at the wrong one.',
  ] },
  { id: 'yellow', name: 'CUTIS-SOFT LEMON', kind: 'tier', types: ['ghost', 'scoutufo'], stage: true, isao: [
    'Fast, light, and convinced it is a fighter pilot. It is not.',
    'The scout maps you. The ghost just wants to see what happens. Neither has a plan for the treads.',
    'Rammable. Satisfyingly so.',
  ] },
  { id: 'blue', name: 'CUTIS-SOFT SKY', kind: 'tier', types: ['saucer', 'jellyfish', 'gslime'], stage: true, isao: [
    'Three bad ideas in one belt: a saucer that weaves, a jellyfish that pulses, and a slime that heals if you let it.',
    'Do not let it. Ram the slime first, admire the jellyfish later.',
    'Still soft. Still ours.',
  ] },
  { id: 'orange', name: 'CUTIS-CORE PUMPKIN', kind: 'tier', types: ['drifter'], stage: true, isao: [
    'The first one with something hard inside. You will notice. The hull will notice more.',
    'It drifts like it has nowhere to be, then it is in front of you. Shoot it; do not drive at it.',
    'A pearl, I think. Nobody asked it to be beautiful.',
  ] },
  { id: 'green', name: 'CUTIS-CORE EMERALD', kind: 'tier', types: ['corona', 'shellback'], stage: true, isao: [
    'Armoured twice over and slowed by what it takes. The shellback waits at the edge of the sentries\' range like it has read the manual.',
    'It has not read the manual. It has read you.',
    'Solid core. The Bofors has opinions about it.',
  ] },
  { id: 'purple', name: 'CUTIS-CORE AMETHYST', kind: 'tier', types: ['barbed', 'prime'], stage: true, isao: [
    'The barbed one speeds up when hit, which is the opposite of what I would do. The prime regenerates, which is the opposite of what I can do.',
    'Hit it harder than it heals. There is no other note.',
    'Cored. Do not test the hull on it; I have the recording.',
  ] },
  { id: 'brown', name: 'CUTIS-CORE UMBER', kind: 'tier', types: ['rolling'], stage: true, isao: [
    'A boulder with intent. Slows when shot, which is less comfort than it sounds.',
    'Epic, the tactical display says. The tactical display did not have to drive round it.',
    'Solid core. Stops the hull dead and keeps the change.',
  ] },
  { id: 'black', name: 'CUTIS-CORE ONYX', kind: 'tier', types: ['phantom', 'knot'], stage: true, isao: [
    'Optical camouflage, a ghost on the radar, and a boss at the end of it that accelerates when you hurt it.',
    'The phantom is there when the radar says it is not. Trust the ground, not the screen.',
    'Cored. If the thorus is in the log, so was a very long night.',
  ] },
  { id: 'cutis', name: 'CUTIS-MAKU', kind: 'creature', types: ['cutis'], stage: true, label: 'KIT CREATURE', swatch: 0xd9c7a8, isao: [
    'A hunter that walks on its stalks and thinks with its skin. The lab calls it Cutis-Maku; I call it the reason the gate stays shut.',
    'It is cheap in hundreds and that is the problem.',
  ] },
  { id: 'reed', name: 'THE REEDS', kind: 'creature', types: ['reed'], stage: false, label: 'KIT CREATURE', swatch: 0x76a76a, isao: [
    'Pulled itself out of a sinkhole by its arms. I watched. I would like to stop watching.',
    'Small, medium, big. The big one is not small.',
  ] },
  { id: 'nih-dairia', name: 'NIH-DAIRIA', kind: 'creature', types: ['nih-dairia'], stage: false, label: 'KIT CREATURE · BOSS', swatch: 0xb9354a, isao: [
    'Thirty metres of it. The gunship has three guns and I have twelve hit points; we have discussed the division of labour.',
    'Fear works on it. So does SOL. So does leaving.',
  ] },
]);

// the card's names and data rows for the types the game's ENEMY_SPEC and INTROS do not carry: the Cutis-Maku and the Reed have ENEMY_SPEC
// rows (src/enemyspec.js); the Nih-Dairia is the Reed family's huge tier (src/content/creature-enemies.js CREATURE_TIERS.reed.huge)
export const CREATURE_LABELS = freeze({ cutis: 'CUTIS-MAKU', reed: 'REED', 'nih-dairia': 'NIH-DAIRIA' });
const HUGE = CREATURE_TIERS.reed.huge;
export const CREATURE_SPEC = freeze({ 'nih-dairia': { hp: HUGE.hp, speed: HUGE.speed, size: +tierSize(HUGE).toFixed(2), rammable: false } });

// THE STAGE (section 4): `packSizes` the pack (Enter toggles); `lure` the lemniscate (`radius` m to each tip, a turn each `period` s; it
// turns up to 1 + `boost` times faster as the nearest body closes and is never left within `ahead` m of it); `pack` the seats, `ring` m round
// a spot `back` m behind the lure's start; `orbit` the camera (`radius` m out, `height` m up, a turn each `period` s, `fov` degrees) round
// its focus, `lookUp` m over the ground: the pack's middle with `lure` of the way to the lure, followed over `smooth` s (the disc's centre
// while the stage is empty), so the pack stays in the frame as it hunts; `disc` the bent ground (radius m, colour); `lureColour` the lure's glow; `level` the kit's level forced
// (0 the high hull, src/fx/cutis-maku/geometry.js lod.force) with the high cap lifted; `creatureTier` the kit creature's tier staged (src/content/creature-enemies.js CREATURE_TIERS.cutis);
// `silhouette` the flat colour of a pack met in an earlier run only, in linear light (near black: the lit ground is ~0.02-0.03 linear)
// THE STAGE LARGER (owner, 2026-10-14: "the 'playground' they are displayed on larger, so that we can see their appendages extending further,
// that is key. it's ok if they are shown smaller because of that"): the disc 36 -> 54 m, the lure's loop 15 -> 24 m and its lead 6 -> 9, the pack
// seated wider, the camera's orbit 34 -> 52 m at 32 m up.
// SLOW AND FAR (owner, 2026-10-14, after looking at it: "bestiary; still unsatisfactory with how we represent the enemy locomotion, the
// appendage extend a tiny bit, instead of the ominous slow feeling around, everything is too rushed. we need; slower animation; longer reach,
// wider view - they have to reach further to catch the prey."). ON THE STAGE ONLY: the game's bodies keep their pace (src/fx/bestiary-stage.js
// makes the stage's family from its own copies of the tables). `body`, each a named multiplier or value over the game's, for the owner to tune:
//   cycle   x every tier's hop cycle (PEARL_TIERS cycleDuration; the Cutis-Maku's too). A CEILING: the kit's pace only ever shortens a hop
//           (pearlPace, at most 1), so a body's hop takes its stride over its walk once the cycle is long enough, and with a cycle shorter
//           than that the body outruns its record and its stalk is cut short (measured: the black tier at x2 stretched 0.8 of a body length)
//   reach   x the stride (PEARL_GAIT.hop, the kit's reach in body radii, 2.4): the stalk stretches this many times as far before the body moves
//   speed   x the record's walk (its type's paced walk): the pack's march, and with the stride the hop's real length in time; the lure's
//           boost x it
//   lead    x how far ahead of its record a body hunts (PEARL_FOLLOW.leadHops, 0.6 of a hop): a stalk is never longer than the way to the point
//           it hunts, so without a farther point the longer reach would not show
//   timing  the hop's stages as shares of its cycle (the game's PEARL_GAIT.config.timing: coil .1, extend .22, anchor .03, transfer .52, settle
//           .13): here a long, deliberate extend, then the body pouring along the stalk
// `lure.aheadReach`: the lure keeps this many times the pack's full stalk from every body (at least `lure.ahead` m), so a body stretches for it
// and nearly never gets it; `lure.pace` its mean speed as a share of the pack's walk (its `period` then follows from its loop; `period` is the
// empty stage's), so the pack closes on it slowly until it bolts.
// THE VIEW WIDER with the reach: the disc 54 -> 84 m, the lure's loop 24 -> 36 m, the pack seated 13 -> 34 m behind the lure's start (outside
// the lure's bolt, twice its lead, so it closes first), 9 m round, the camera's orbit 52 -> 76 m at 32 -> 50 m up, a turn in 140 s, its focus
// 0.4 of the way to the lure, followed over 2.5 s.
export const BESTIARY_STAGE = freeze({
  packSizes: [3, 6],
  body: { cycle: 4, reach: 1.8, speed: 0.6, lead: 2, timing: { coil: 0.08, extend: 0.4, anchor: 0.04, transfer: 0.36, settle: 0.12 } },
  lure: { radius: 36, period: 36, ahead: 9, boost: 2.5, aheadReach: 1.15, pace: 0.9 },
  pack: { back: 34, ring: 9 },
  orbit: { radius: 76, height: 50, period: 140, fov: 38, lookUp: 1.5, lure: 0.4, smooth: 2.5 },
  disc: { radius: 84, colour: 0x2a3440, rim: 0x3c4b58 },
  lureColour: 0x8ff3ff,
  level: 0,
  creatureTier: 'small',
  silhouette: [0.003, 0.004, 0.006],
  // THE LAB'S SKIN (owner, 2026-10-19, round four, note 5: the story's purples "should look like they do in our specimen lab"): the stage keeps the
  // membrane opacity the owner named as the reference look, over its near-black stage, and the pearl under the skin (no PEARL_MEMBRANE `pearl`);
  // the planet's full skin (PEARL_MEMBRANE purple, brown: 1.35) is what it takes to read the same over lit ground
  skin: { purple: 0.45, brown: 0.45 },
});

// the terminal's CRT (src/fx/crt-pass.js): colour, not the feed's mono green; a faint cool phosphor cast and a little more light
export const TERMINAL_CRT = freeze({ mono: false, tint: [0.95, 1.0, 0.97], floor: [0.012, 0.02, 0.018], gain: 1.25 });

// the sightings across runs, through src/storage.js's wrapper under its prefix (a `td.` key, so exportRecords / importRecords carry it)
export const BESTIARY_STORE = 'td.bestiary';
