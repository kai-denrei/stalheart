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
  { id: 'white', name: 'AMOEBA · PHAGE', kind: 'tier', types: ['amoeba', 'phage'], stage: true, isao: [
    'Small, soft, and in no hurry to be anything else. They come in numbers because one of them is not an argument.',
    'The amoeba hunts whatever opened the ground. The phage crawls. Both go under the treads with a sound I have stopped finding funny.',
    'If you see one, you are looking at the wrong one.',
  ] },
  { id: 'yellow', name: 'GHOST · SCOUT', kind: 'tier', types: ['ghost', 'scoutufo'], stage: true, isao: [
    'Fast, light, and convinced it is a fighter pilot. It is not.',
    'The scout maps you. The ghost just wants to see what happens. Neither has a plan for the treads.',
    'Rammable. Satisfyingly so.',
  ] },
  { id: 'blue', name: 'SAUCER · JELLYFISH · SLIME', kind: 'tier', types: ['saucer', 'jellyfish', 'gslime'], stage: true, isao: [
    'Three bad ideas in one belt: a saucer that weaves, a jellyfish that pulses, and a slime that heals if you let it.',
    'Do not let it. Ram the slime first, admire the jellyfish later.',
    'Still soft. Still ours.',
  ] },
  { id: 'orange', name: 'DRIFTER', kind: 'tier', types: ['drifter'], stage: true, isao: [
    'The first one with something hard inside. You will notice. The hull will notice more.',
    'It drifts like it has nowhere to be, then it is in front of you. Shoot it; do not drive at it.',
    'A pearl, I think. Nobody asked it to be beautiful.',
  ] },
  { id: 'green', name: 'VIRUS · SHELLBACK', kind: 'tier', types: ['corona', 'shellback'], stage: true, isao: [
    'Armoured twice over and slowed by what it takes. The shellback waits at the edge of the sentries\' range like it has read the manual.',
    'It has not read the manual. It has read you.',
    'Solid core. The Bofors has opinions about it.',
  ] },
  { id: 'purple', name: 'BARBED · PRIME', kind: 'tier', types: ['barbed', 'prime'], stage: true, isao: [
    'The barbed one speeds up when hit, which is the opposite of what I would do. The prime regenerates, which is the opposite of what I can do.',
    'Hit it harder than it heals. There is no other note.',
    'Cored. Do not test the hull on it; I have the recording.',
  ] },
  { id: 'brown', name: 'ROLLING MINE', kind: 'tier', types: ['rolling'], stage: true, isao: [
    'A boulder with intent. Slows when shot, which is less comfort than it sounds.',
    'Epic, the tactical display says. The tactical display did not have to drive round it.',
    'Solid core. Stops the hull dead and keeps the change.',
  ] },
  { id: 'black', name: 'PHANTOM · THORUS', kind: 'tier', types: ['phantom', 'knot'], stage: true, isao: [
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
// a spot `back` m behind the lure's start; `orbit` the camera (`radius` m out, `height` m up, a turn each `period` s, `fov` degrees, looking
// `lookUp` m over the centre); `disc` the bent ground (radius m, colour); `lureColour` the lure's glow; `level` the kit's level forced
// (0 the high hull, src/fx/cutis-maku/geometry.js lod.force) with the high cap lifted; `walk` the share of its type's paced walk a body's
// record keeps behind the lure; `creatureTier` the kit creature's tier staged (src/content/creature-enemies.js CREATURE_TIERS.cutis);
// `silhouette` the flat colour of a pack met in an earlier run only
export const BESTIARY_STAGE = freeze({
  packSizes: [3, 6],
  lure: { radius: 15, period: 36, ahead: 6, boost: 2.5 },
  pack: { back: 9, ring: 5 },
  orbit: { radius: 44, height: 17, period: 96, fov: 38, lookUp: 1.5 },
  disc: { radius: 36, colour: 0x2a3440, rim: 0x3c4b58 },
  lureColour: 0x8ff3ff,
  level: 0,
  walk: 1,
  creatureTier: 'small',
  silhouette: [0.035, 0.04, 0.05],
});

// the terminal's CRT (src/fx/crt-pass.js): colour, not the feed's mono green; a faint cool phosphor cast and a little more light
export const TERMINAL_CRT = freeze({ mono: false, tint: [0.95, 1.0, 0.97], floor: [0.012, 0.02, 0.018], gain: 1.25 });

// the sightings across runs, through src/storage.js's wrapper under its prefix (a `td.` key, so exportRecords / importRecords carry it)
export const BESTIARY_STORE = 'td.bestiary';
