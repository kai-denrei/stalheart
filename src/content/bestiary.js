// THE TERMINAL AND THE BESTIARY (owner, 2026-10-14: "re-vamp the Units section; Vivarium, Bestiary, Compendium, we will find it a better name
// and 1) display all the unlocked units in their full glory, enemies at high resolution with smooth animations displaying their movement
// patterns ... All this as if was accessed from a Terminal as a screen-within-a-screen, with HUD elements and a border and CRT like display
// effects."; spec docs/superpowers/specs/2026-10-14-bestiary-terminal-design.md). Pure data: the terminal's copy, the entries' text in Isao's
// voice, the stage's numbers and the terminal's CRT settings. THE OWNER EDITS THE TEXT HERE. The working name is THE BESTIARY until he finds
// a better one: the code calls the screen the terminal and the page the bestiary, so the name changes here alone.
// The rules are src/domain/bestiary.js; the screen src/fx/terminal-screen.js; the stage src/fx/bestiary-stage.js.
import { CREATURE_TIERS, tierSize } from './creature-enemies.js';
import { SENTRIES } from './sentries.js';
import { BASE_PROGRAMME } from './base-programme.js';
import { STRUCTURES, KIT } from './base-layout.js';
import { REINFORCEMENTS } from './reinforcements.js';
import { LASER_PLATFORMS, LASER_ORBIT } from './orbital-laser.js';
import { GUNSHIP_ORBIT } from './gunship.js';
import { SHOWCASE_ELEMENTS } from './showcase.js';
import { ISAO_MODEL, ISAO_IDLE_CLIPS } from './isao-faces.js';
import { STORY_SCALE, STORY_RECIPE } from './story-defaults.js';

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
  footerUnit: '↑↓ ENTRIES · ⏎ WIRE / SOLID · ESC CLOSE',   // a colony entry: Enter swaps the drawing for the solid (THE WHOLE TERMINAL, 2026-10-27)
  lockedNote: 'NO ENTRY · NOT YET ON THE COLONY\'S BOOKS',   // a colony entry the run has not reached (never met: the same dim row)
  loading: 'LOADING',
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

// THE WHOLE TERMINAL (owner, 2026-10-27: "expand the B Bestiary to have ALL the units, including the friendlies and neutral, buildings, etc."):
// after the hostile contacts, the colony's own machines, the eight sentries, the air and orbit, the base's structures and the field's neutral
// things, each an entry with Isao's lines, a few facts and, where a model exists, a stage: the unit drawn as the game now draws the colony's
// units (the tinted wireframe, src/fx/model-fixture.js wireLook; Enter shows the solid) at its true size on the stage's 6 m rings, its own
// clip playing where it has one (src/fx/unit-bench.js). The list's sections, in order, after the hostiles' (the hostile entries keep ENTRIES).
export const SECTIONS = freeze([
  { id: 'hostile', label: 'HOSTILE · CONTACTS' },
  { id: 'colony', label: 'COLONY · MACHINES' },
  { id: 'sentries', label: 'SENTRIES · THE EIGHT' },
  { id: 'sky', label: 'AIR AND ORBIT' },
  { id: 'base', label: 'THE BASE' },
  { id: 'field', label: 'THE FIELD · NEUTRAL' },
]);

// a colony entry: `section` one of SECTIONS; `model` { url, scale, clip, fit: { height, maxSpan }, hide: [node names] } a pinned GLB (metres, +Y up),
// `tower` a sentry key (built through the game's own look at the top tier), `build` a builder's name (src/fx/unit-bench.js), none of them a card
// alone; `needs` what the run must have reached for the entry to open (src/domain/bestiary.js unitState: `always`, `perk` a programme perk, `sentry`
// an unlocked key, `mechs` the four landed, `sector` a sector number reached, `sol88` the launch, `ball` the DAY 42 party); `facts` the card's
// rows; `isao` his lines. THE OWNER EDITS THE TEXT HERE.
const CELL_M = STORY_RECIPE.metresPerCell, SWATCH = { colony: 0x9ad7ff, sentries: 0xbfe6ea, sky: 0xe8f1ff, base: 0xd9c7a8, field: 0xa8b8a0 };
const structure = (id) => STRUCTURES.find((s) => s.id === id), step = (id) => BASE_PROGRAMME.find((s) => s.id === id);
const printed = (stepId) => { const s = step(stepId); return s ? [['PRINT', `${s.seconds} s · ${s.metres} m of filament`], ...(s.perk ? [['UNLOCKS', s.perk]] : [])] : []; };
const built = (structureId, stepId, extra = {}) => { const st = structure(structureId); return { url: st.asset, scale: st.scale ?? 1, clip: st.clips?.[0] ?? null, hide: st.hide ?? [], ...extra }; };
const SENTRY_LINES = {
  rotor: ['Four muzzles fed from drums. The first thing I print and the last thing that stops firing.', 'Cheap, fast, and it will sit on any rock. You can sit in it too.'],
  plasma: ['A thrower, not a gun. Short reach, long burn; anything soft that walks into the cone stops walking.', 'Keep it close to the gate. It has no opinion about range.'],
  quiver: ['Six capped tubes. It locks on, then the missile does the thinking, which is more than I can say for the target.', 'Two of them on a Ridgeback. That was not my idea; it was a good one.'],
  relay: ['A mast, not a weapon. Everything inside its field moves slower, which is a weapon by another name.', 'Fixed, no articulation, nothing to sit in. Print it where the crowd gathers.'],
  mortar: ['Tube and baseplate, the steepest arc on the range. The shell comes down on a cluster and the cluster becomes a smaller cluster.', 'Slow. Patient. Not for the fast ones.'],
  lancer: ['A rail and focusing collars, one aperture, one long line through whatever stands in it.', 'Reach is the point. Put it high and let it look down the lane.'],
  needle: ['A dedicated sniper. One heavy shot, a long way, and it chooses the hard cores first because somebody has to.', 'Expensive. Worth it the night the thorus comes.'],
  heptapod: ['Six legs and vertical launch cells; it walks to where the firing is and stays there. The turret is fixed, the legs are not.', 'Watch it cross the yard once. Then stop watching and build.'],
};
export const UNIT_ENTRIES = freeze([
  // --- the colony's machines -------------------------------------------------------------------------------------------------------------------
  { id: 'mork', section: 'colony', name: 'MÖRK · HOVER TANK', label: 'COLONY · THE HULL', needs: { always: true },
    model: { url: SHOWCASE_ELEMENTS.find((e) => e.id === 'mork').url, fit: { height: 4, maxSpan: STORY_SCALE.tankMetres } },
    facts: [['LENGTH', `${STORY_SCALE.tankMetres} m`], ['ARMAMENT', 'ram prow · shell turret · twin plasma'], ['LIVES', 'the racked hulls in the bays']], isao: [
      'Ten metres of hover skirt with a ram prow, a shell turret, and me in the passenger seat whether I like it or not.',
      'It does not steer so much as agree with you. Keep the speed up: the ground is not the friction, the enemies are.',
    ] },
  { id: 'isao', section: 'colony', name: 'ISAO-BIRUDORŌN', label: 'COLONY · CONSTRUCTION DRONE', needs: { always: true },
    model: { url: ISAO_MODEL, clip: ISAO_IDLE_CLIPS[0], fit: { height: STORY_SCALE.isaoMetres, maxSpan: 3 } },
    facts: [['HEIGHT', `${STORY_SCALE.isaoMetres} m`], ['PRINTS', 'every sentry, every structure on the plan'], ['HIT POINTS', 'twelve, discussed']], isao: [
      'That is me. Construction drone, one point eight metres, a CRT for a face because the face earned it.',
      'I print every sentry and every building on the plan. I also wrote this entry, so take the modesty as read.',
    ] },
  { id: 'mx06', section: 'colony', name: 'MX-06 RIDGEBACK', label: 'COLONY · REINFORCEMENT', needs: { mechs: true },
    model: { url: REINFORCEMENTS.models.mech, scale: REINFORCEMENTS.scale, clip: 'Walk_Cycle' },
    facts: [['WEAPONS', `${REINFORCEMENTS.weapons.join(' · ')} · top tier`], ['WALK', `${+(REINFORCEMENTS.pace * CELL_M).toFixed(1)} m/s`], ['ROLES', REINFORCEMENTS.roles.join(' · ')]], isao: [
      'Six legs, a minigun, a laser and two missile pods: a rotor, a lancer and two quivers that walk. The colony sent four.',
      'Two stay at the arena and join the fight. One walks home. One hunts. None of them answer the radio.',
    ] },
  { id: 'feids26', section: 'colony', name: 'FEIDS-26 · DROP CAPSULE', label: 'COLONY · REINFORCEMENT', needs: { mechs: true },
    model: { url: REINFORCEMENTS.models.capsule, clip: null },
    facts: [['LENGTH', '20 m'], ['CARGO', 'two MX-06, folded'], ['DUE', `${REINFORCEMENTS.days} days after the call`]], isao: [
      'Twenty metres of heat shield that comes apart in four quarters three hundred metres up. The cargo falls the rest of the way on purpose.',
      'Two Ridgebacks a capsule, folded. Do not stand where it lands; I have the footage of the rubble.',
    ] },
  // --- the eight sentries, through the game's own look at the top tier (the stats rows come from src/towers.js on the card, not here) -----------
  ...SENTRIES.map((s) => ({ id: s.key, section: 'sentries', name: `${s.name.toUpperCase()} · SENTRY ${s.number}`, label: 'SENTRY', needs: { sentry: s.key }, tower: s.key,
    model: { fit: { height: 5, maxSpan: 5 } }, facts: [['BUILD', s.note]], isao: SENTRY_LINES[s.key] ?? [] })),
  // --- air and orbit ----------------------------------------------------------------------------------------------------------------------------
  { id: 'korp', section: 'sky', name: 'KORP / GS01 · HEAVY GUNSHIP', label: 'AIR · GUNSHIP', needs: { perk: 'gunship' },
    model: { url: SHOWCASE_ELEMENTS.find((e) => e.id === 'korp').url, clip: null },
    facts: [['GUNS', '25MM rotary × 2 · 40MM bofors · MK-9'], ['ON STATION', `${GUNSHIP_ORBIT.station} s a pass`], ['CREW', 'none. the guns are yours']], isao: [
      'No crew. Two rotary guns, a Bofors, and the MK-9 from the belly. It creeps toward the busiest breach and the guns are yours for the pass.',
      'Fire the 40 mm between her and the hull. She fears it. Then the nuke.',
    ] },
  { id: 'sol82', section: 'sky', name: LASER_PLATFORMS.sol82.head, label: 'ORBIT · LASER', needs: { sector: 3 },
    model: { url: LASER_PLATFORMS.sol82.url, clip: null },
    facts: [['ENERGY', '1.2 GJ a pass'], ['OVERHEAD', `${LASER_ORBIT.overhead} s every ${LASER_ORBIT.period} s`], ['ONLINE', 'from sector 3']], isao: [
      'One point two gigajoules a pass, from orbit. Twenty seconds overhead every three minutes; make them count.',
      'Online from the third sector. Before that it is a light in the sky, like everything else.',
    ] },
  { id: 'sol88', section: 'sky', name: LASER_PLATFORMS.sol88.head, label: 'ORBIT · LASER', needs: { sol88: true },
    model: { url: LASER_PLATFORMS.sol88.url, clip: null },
    facts: [['CAGES', 'three, rotating'], ['LAUNCHED', 'by the ARC-01, on your calibration'], ['FIRES', 'on its own at the densest pile, or yours']], isao: [
      'Three rotating containment cages and a lens the size of this base. The ARC-01 puts it up once I have your calibration.',
      'It fires on its own at the densest pile, or on yours in the seat. I prefer yours.',
    ] },
  // --- the base: each structure as the layout pins it, at the layout's scale, its first clip looping where it has one --------------------------
  { id: 'stalheart', section: 'base', name: 'STÅLHEART · TERRAFORMER', label: 'THE BASE · THE HEART', needs: { perk: 'stalheart' },
    model: built('stalheart', 'stalheart', { url: structure('stalheart').candidate.asset }), facts: [['PLOT', '48 × 56 m · drive under the gantry'], ...printed('stalheart')], isao: [
      'The heart of it. Forty-eight metres of terraformer with a gantry you can drive under, and the terminal you are reading this on.',
      'If it stops, we stop. The sentries know this better than you do.',
    ] },
  { id: 'foundry', section: 'base', name: 'SEED FOUNDRY', label: 'THE BASE · THE WORKS', needs: { always: true },
    model: built('foundry', 'foundry', { clip: 'Foundry_Process_Cycle' }), facts: [['TAKES', 'every kilo the treads collect'], ...printed('foundry')], isao: [
      'Every kilo of biomass the treads collect goes through here and comes out as something I can print.',
      'The recycle panel to the barrel, the barrel to the works. Feed it.',
    ] },
  { id: 'sh02', section: 'base', name: 'SH-02 · THE LANDER', label: 'THE BASE · THE LANDING', needs: { always: true },
    model: built('sh02', 'landing', { clip: null }), facts: [['HEIGHT', `${+(STORY_SCALE.rocket * 20).toFixed(0)} m, legs down`], ['FROM DAY 2', 'a salvage layout']], isao: [
      'The rocket we came down in. From the second day it is a salvage layout; I am not sentimental about it.',
      'Legs deployed, top door open, landing shock absorbed. Everything after that was the plan.',
    ] },
  { id: 'solar', section: 'base', name: 'SOLAR ARRAY', label: 'THE BASE · POWER', needs: { perk: 'station' },
    model: built('solar', 'solar'), facts: [['PLOT', '20 × 20 m · the pad between the panels is open'], ...printed('solar')], isao: [
      'Twenty metres of panels and a charging pad between them. The panels block; the pad does not.',
      'The station perk. SOL listens once this stands.',
    ] },
  { id: 'hugin', section: 'base', name: 'HUGIN ARM', label: 'THE BASE · THE GUNSHIP\'S', needs: { perk: 'gunship' },
    model: built('hugin', 'hugin'), facts: [['PLOT', '40 × 40 m'], ...printed('hugin')], isao: [
      'The launch and recovery arm. The gunship comes home on it and goes out on it, and the booster is somebody else\'s problem.',
      'Sixteen metres of filament. The gunship is the reason.',
    ] },
  { id: 'bays', section: 'base', name: 'TANK BAYS', label: 'THE BASE · THE HULLS', needs: { perk: 'hulls' },
    model: built('bays', 'bays', { clip: null }), facts: [['BERTHS', 'three · one hull each'], ...printed('bays')], isao: [
      'Three shallow berths, one hull each. The racked spares are your lives; the bays are where they roll out.',
      'Behind the Stålheart, doors toward the gate. Do not block them.',
    ] },
  { id: 'radar', section: 'base', name: 'RADAR', label: 'THE BASE · THE UPLINK', needs: { perk: 'uplink' },
    model: built('radar', 'radar'), facts: [['ARRAY', 'skyward, slewing'], ['CALLS', `the colony: reinforcements ${REINFORCEMENTS.days} days later`], ...printed('radar')], isao: [
      'A skyward array that slews. With it the uplink is up and I can ask the colony for help.',
      'They sent four mechs. That was all they could spare; I asked twice.',
    ] },
  { id: 'assembly', section: 'base', name: 'ASSEMBLY LINE', label: 'THE BASE · REBUILDS', needs: { perk: 'rebuild' },
    model: built('assembly', 'assembly'), facts: [['REBUILDS', 'a burned sentry, a burned structure'], ...printed('assembly')], isao: [
      'A robotic line that rebuilds what breaks. A burned sentry comes back; a burned radar comes back slower.',
      'The rebuild perk. Print it before you need it, which is always.',
    ] },
  { id: 'armory', section: 'base', name: 'ARMORY', label: 'THE BASE · SHELLS', needs: { perk: 'armory' },
    model: built('armory', 'armory'), facts: [['LIFTS', 'shells to the hull within 12 m, two a second'], ...printed('armory')], isao: [
      'Shells, lifted to the hull within twelve metres, two a second. The missiles on the pad are decoration until they are not.',
      'The main gun is scarce by design. This is where the scarcity ends.',
    ] },
  { id: 'greenhouse', section: 'base', name: 'GREENHOUSE', label: 'THE BASE · THE FARM', needs: { perk: 'farm' },
    model: built('greenhouse', 'farm'), facts: [['YIELD', '40 kg of biomass a day'], ...printed('farm')], isao: [
      'Forty kilos of biomass a day from three bio cassettes and a glass house. Slower than the treads, quieter than the treads.',
      'The farm perk. It does not shoot. It feeds the things that do.',
    ] },
  { id: 'chips', section: 'base', name: 'CHIP PLANT', label: 'THE BASE · THE WRITER', needs: { perk: 'chips' },
    model: built('chips', 'chips'), facts: [['WRITES', 'the sentries\' chips: a faster reload'], ...printed('chips')], isao: [
      'A chip writer. The sentries think faster with it, which shows in their reload.',
      'Small building. Large difference. I say this about myself too.',
    ] },
  { id: 'garage', section: 'base', name: 'PAINT GARAGE', label: 'THE BASE · THE PAINT', needs: { perk: 'garage' },
    model: built('garage', 'garage', { clip: null }), facts: [['BAY', 'open roof · a paint arm'], ...printed('garage')], isao: [
      'An open-roof bay east of the tank bays with a paint arm. The hull goes in one colour and comes out another.',
      'Purely cosmetic. I have opinions about the colours; I keep them.',
    ] },
  { id: 'launcher', section: 'base', name: 'ARC-01 LAUNCHER', label: 'THE BASE · THE RAIL', needs: { perk: 'launcher' },
    model: built('launcher', 'launcher'), facts: [['PUTS UP', LASER_PLATFORMS.sol88.name], ...printed('launcher')], isao: [
      'Twelve metres of rail that puts SOL-88 in orbit once two seats have been manned and I have your calibration.',
      'To infinity, and then a bit beyond. The second part is the orbit.',
    ] },
  { id: 'gate', section: 'base', name: 'GATE AND WALLS', label: 'THE BASE · THE RIM', needs: { perk: 'gate' },
    model: { url: KIT.gate, clip: null }, facts: [['WALLS', `${KIT.wallsPerSide} a side, ${KIT.wallLength} m each`], ['PLOT', `${KIT.gatePlot[0]} × ${KIT.gatePlot[1]} m`], ...printed('gate')], isao: [
      'A vehicle gate and six walls a side, inset from the rock. They hold until they do not; the integrity is on the HUD.',
      'The back gate comes later, at the back. Its entry is the next one.',
    ] },
  { id: 'backgate', section: 'base', name: 'BACK GATE', label: 'THE BASE · THE RIM', needs: { perk: 'backgate' },
    model: { url: KIT.gate, clip: null }, facts: [['WHERE', 'the back of the rim, where the canyon ends'], ['PASSABLE', 'the hull drives through it both ways'], ...printed('backgate')], isao: [
      'The second gate, at the back, where the canyon ends. The hull drives through it both ways once it holds.',
      'I named the first one the gate, so this one had to be the back gate. I stand by it.',
    ] },
  { id: 'board', section: 'base', name: 'SCOREBOARD', label: 'THE BASE · THE BOARD', needs: { perk: 'board' },
    model: { url: 'assets/models/scoreboards/beacon_rivalry_d0_lod1.glb', clip: null }, facts: [['SHOWS', 'your name, the rivals under it'], ...printed('board')], isao: [
      'A beacon with your name on it and the colony\'s rivals under it. It does nothing. Everyone looks at it.',
      'KICK ASS, the owner wrote on it. I did not argue.',
    ] },
  // --- the field: nobody's soldiers -----------------------------------------------------------------------------------------------------------
  { id: 'container', section: 'field', name: 'LIFE CONTAINER', label: 'THE FIELD · BERTHS', needs: { always: true },
    build: 'container', model: { fit: { height: 4, maxSpan: 14 } }, facts: [['BERTHS', 'three in a row by the heart'], ['HOLDS', 'the racked hulls: your lives']], isao: [
      'Three berths in a row by the heart and the racked hulls inside them. Your lives, in a box.',
      'Nobody\'s soldier. Keep it standing anyway.',
    ] },
  { id: 'shells', section: 'field', name: 'SHELL RACK', label: 'THE FIELD · PICKUP', needs: { always: true },
    build: 'shell', model: { fit: { height: 1.6, maxSpan: 2 } }, facts: [['GIVES', '+3 shells'], ['SPAWNS', 'on its own clock, in threes']], isao: [
      'Three shells on a rack, on their own clock, somewhere on the open ground. The main gun eats them.',
      'Drive over it. That is the whole instruction.',
    ] },
  { id: 'rocket', section: 'field', name: 'HUGIN · DEPLOYED', label: 'THE FIELD · A SITE', needs: { always: true },
    model: built('rocket-a', null, { clip: null }), facts: [['SITES', 'four, far out'], ['HOLDS', 'a sentry to salvage']], isao: [
      'A deployed Hugin, far out, with a sentry to salvage inside. Four of them, two a long way off.',
      'The expedition finds them. The hull brings them home. I print the rest.',
    ] },
  { id: 'wreck', section: 'field', name: 'HUGIN · WRECK', label: 'THE FIELD · A SITE', needs: { always: true },
    model: built('wreck', null, { clip: null }), facts: [['STATE', 'tilted, lifted, still worth the drive']], isao: [
      'What a Hugin looks like when the landing goes the other way. Tilted, lifted, and still worth the drive.',
      'The shells inside did not mind the crash.',
    ] },
  { id: 'ball', section: 'field', name: 'DAY 42 · THE BALL', label: 'THE FIELD · ONCE A RUN', needs: { ball: true },
    model: { url: 'assets/models/disco-ball/disco_ball_d0_lod1.glb', clip: null }, facts: [['WHEN', 'the forty-second day, at the first lull'], ['LASTS', 'thirty seconds nobody shoots']], isao: [
      'On the forty-second day the crane-hook pose, a disco ball, and thirty seconds nobody shoots. Once a run.',
      'I do not dance. The arm does.',
    ] },
].map((e) => ({ swatch: SWATCH[e.section], ...e })));

// THE BENCH (src/fx/unit-bench.js): the camera's orbit round a unit's box: `radius` and `height` in the box's half-extent, a turn each `period` s,
// the orbit eased over `smooth` s as a new unit lands; `wire` the stage opens on the drawing (Enter swaps)
export const BESTIARY_BENCH = freeze({ orbit: { radius: 3.1, height: 0.85, period: 60, smooth: 1.2 }, wire: true });
