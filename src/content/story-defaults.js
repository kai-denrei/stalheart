// Story planet, clearing, terrace and arrival tunables. Pure data; the
// domain modules take these as explicit configuration.
export const STORY_RECIPE = Object.freeze({
  seed: 7, points: 16000, k: 12, relaxIters: 80, pullRate: 0.25,
  rooms: 384, roomRadius: 4, extraCorridors: 192, corridorWidth: 1,
  metresPerCell: 10, wallMetres: 4,
});

export const STORY_CLEARING = Object.freeze({
  radiusMetres: 150,   // every cell inside is open floor
  padRadius: 46,       // the level-0 plane the pad tiles sit on
  step: 2,             // terrace step, metres
  blend: 20,           // metres over which the cut fades back to the sphere
  mouthBand: 1.5,      // cells outside the clearing rim that count as a mouth
  mouthMaxCells: 2,    // the open mouth must fit the armored gate
  mouthReachShare: 0.5, // the open mouth must lead to at least half of the reachable world
  terraces: false,     // islands level their own plots; the lattice stays natural
  tileMetres: 4,       // Fortification foundation tile
  padTiles: 16,        // 16 x 16 tiles = 64 x 64 m
});

// Sanity record for the pinned recipe; test/story-planet.mjs asserts it.
export const STORY_SANITY = Object.freeze({ cells: 71314, heart: 8123, cellSide: 0.013274480493795838 });

export const LANDING_DEFAULTS = Object.freeze({
  orbit: 4, descent: 8, startAltitude: 900, deployAltitude: 40,
  legsDeploy: 2.4, shock: 2, settle: 2, door: 1.8, isao: 9, isaoHold: 3.5, dustSeconds: 1.2,
});

// The SH02 as authored (assets/models/story/sh_rocket.glb, metres before STORY_SCALE.rocket): the engine bells over the touchdown
// plane, the cargo well's floor and its door rim. The lab's landing and the game's arrival hang plumes and lift Isao from these.
export const SH02_WELL = Object.freeze({ bell: 2.0, floor: 19.0, rim: 23.5 });

// THE ARRIVAL IN THE GAME (owner, 2026-09-25, from a playtest of the live build: "bring back the landing, short and sweet but
// showing the landing. Isao comes out, close up on his face; he's the narrator"; about eight seconds, at every story start, any key
// or click skips it). src/domain/arrival-shot.js is its clock, src/fx/arrival.js its picture. `landing` is the lab's timeline
// (src/domain/landing-sequence.js) cut short: no orbit, a `descent` from `startAltitude` metres with the legs out before touchdown,
// the door opening `shock` seconds after it while the authored shock and door clips play on (`shockClip`, `doorClip`), Isao
// climbing `door` seconds into the door for `isao` seconds, then `isaoHold` seconds flying clear. `rail`: the camera, in metres
// around the landing island (x and z along the ground, y up, +z toward the pole; src/core/rail.js). `isao`: his way out in the same
// metres, from `from` up the well to `rim` (over the door rim), then an arc `arc` metres higher on the way to his hover height
// `clear` metres toward the pole; `scale` of his game size while he climbs out (the game's Isao is a six metre drone, the SH02's
// well is not). `talk`: the cut to his face through a `fov` lens, held over all three of his lines
// (the lines are src/isaobriefs.js `brief`). `wait`: seconds the arrival waits
// for the rocket, its salvage, the foundry and Isao to load before it gives up and lets the opening run without it.
export const STORY_ARRIVAL = Object.freeze({
  landing: Object.freeze({ orbit: 0, descent: 2.6, startAltitude: 150, deployAltitude: 134, legsDeploy: 2.4, shock: 0.4, shockClip: 2, settle: 0, door: 0.3, doorClip: 1.8, isao: 1.1, isaoHold: 0.9, dustSeconds: 1.2 }),
  rail: Object.freeze([
    Object.freeze({ t: 0, pos: [70, 12, 70], look: [0, 105, 0], fov: 42 }),
    Object.freeze({ t: 2.6, pos: [48, 10, 48], look: [0, 15, 0] }),
    Object.freeze({ t: 3.4, pos: [30, 26, 26], look: [0, 28, 0] }),
    Object.freeze({ t: 4.4, pos: [24, 44, 18], look: [0, 37, 3] }),   // over the nose, looking down: the ground behind him as he comes out
    Object.freeze({ t: 4.85, pos: [23, 44, 22], look: [0, 33, 18], fov: 36 }),   // the lens closes on him as he flies clear and the rocket leaves the frame before the cut
    Object.freeze({ t: 5.3, pos: [17, 36, 24], look: [0, 20, 35], fov: 30 }),
  ]),
  isao: Object.freeze({ scale: 0.4, from: 15, rim: 39, arc: 4, clear: 35 }),
  talk: Object.freeze({ fov: 20, brief: 'arrival_talk' }),
  wait: 30,
});

// Story-only cues; the lab merges these with the tank pneumatics from the
// shared manifest. Same budget fields as audiomanifest.js.
export const STORY_SOUNDS = Object.freeze({
  rocket_thrust: { file: 'assets/audio/rocket_thrust.mp3', bus: 'tank', gain: 0.9, maxVoices: 1, minInterval: 0, rateJitter: 0 },
  gate_hydraulics: { file: 'assets/audio/gate_hydraulics.mp3', bus: 'ui', gain: 0.7, maxVoices: 1, minInterval: 0.5, rateJitter: 0.02 },
  gate_slam: { file: 'assets/audio/gate_slam.mp3', bus: 'ui', gain: 0.8, maxVoices: 1, minInterval: 0.5, rateJitter: 0.03 },
});

// Six engines under the skirt, each with its own cadence, so the cluster
// never flickers as one lamp.
// UNDER THE SKIRT, NOT BESIDE IT (owner, 2026-09-13: some thrusters appeared outside the rocket). The hull is 2.1 m in radius; a plume
// is a camera-facing sheet `width` wide centred `radius` off the axis, so radius + width / 2 has to stay inside the skirt
export const PLUME_CLUSTER = Object.freeze([
  { angle: 0, radius: 0.8, width: 2.4, height: 24, phase: 0.0, cadence: 11, depth: 0.14 },
  { angle: 60, radius: 0.8, width: 2.1, height: 21, phase: 1.7, cadence: 13, depth: 0.2 },
  { angle: 120, radius: 0.8, width: 2.3, height: 23, phase: 3.1, cadence: 9, depth: 0.16 },
  { angle: 180, radius: 0.8, width: 2.4, height: 25, phase: 4.4, cadence: 12, depth: 0.12 },
  { angle: 240, radius: 0.8, width: 2.1, height: 20, phase: 0.9, cadence: 15, depth: 0.22 },
  { angle: 300, radius: 0.8, width: 2.3, height: 22, phase: 2.3, cadence: 10, depth: 0.18 },
]);

// Presentation scale. The SH02 is authored at 21.4 m; the story shows it
// larger so a game-sized Isao reads small and clears the cargo well.
// The story hull is 10 m long (the kit's MÖRK is authored at 13.28 m, so kit containers scale to match);
// tankUnit is the game's unit scale per lattice cell that gives that length: 10 m / (10 m cells x 1.95 span x 0.75 base).
export const STORY_SCALE = Object.freeze({ rocket: 1.5, isaoMetres: 1.8, tankMetres: 10, tankUnit: 0.684 });

// The breach seen from orbit: the whole planet stays in frame through the ground opening and the first fodder emerging
// dive: after the pre-roll the camera drops fast from orbit to a close view over the sinkhole (in cells above it, pulled toward the base by `back`),
// in `diveSeconds`, and holds there while the fodder emerge
// THE FIRST WAVE (owner, 2026-09-13): fifty weak ones in a single wave, all out of the sinkhole almost at once so it reads as a swarm, and
// none of them can hurt the tank or the gate. every 0 spawns one a frame; each rises within `stagger` seconds, scattered `spread` cells across the crater
// `pace` multiplies the swarm's march (src/enemyspec.js amoeba speed): the tutorial's fifty rise in a moment and then WALK, and the
// player watched that walk for 28 s before the override (QA 2026-09-16). They surge instead; the pile is the beat, not the stroll.
export const STORY_FODDER = Object.freeze({ total: 50, alive: 50, every: 0, harmless: true, spread: 0.8, stagger: 1.2, pace: 1.7 });
// emergeHold: the orbit camera holds over the crater after the breach FX. The fifty are all up within `stagger` (1.2 s), so holding
// six more seconds over a finished pile was watching, not reading: three is the pile seen and the camera released.
// preRoll: the story's own orbit beat before the dive, overriding the shared breach preset's 1.6 (immutable, and the breach lab
// shares it). The whole planet has already been in frame since the tremor: a second and a half more of it before the camera moves
// is the purest dead time in the opening. The 1.4 s dive itself is untouched.
export const STORY_BREACH = Object.freeze({ preRoll: 0.7, emergeHold: 3, tail: 1.8, diveSeconds: 1.4, height: 5, back: 4 });
// THE SECOND FRONT (owner, 2026-09-16: "protect the other side of the base"): the sealed clearing mouth nearest +Z, at most
// `maxCells` wide, collapses with up to `flank` rock cells beside it; back breaches open `hops` steps out from it on lanes at
// least `margin` hops shorter through the back than through the gate. The collapse shot dives after `preRoll` and holds `hold` seconds at
// `dive`: `height` cells up and `back` cells from the mouth toward the pole, negative = out over the rock, so the mouth sits in the
// middle of the frame with the bays and the Stalheart beyond it (the swarm's way in)
export const STORY_BACK_DOOR = Object.freeze({ maxCells: 2, reachShare: 0.5, flank: 4, hops: Object.freeze([25, 35]), margin: 20, preRoll: 0.3, hold: 3.5, dive: Object.freeze({ height: 3, back: -6, diveSeconds: 1.4 }) });

// A day on the story planet: five minutes, three of them daylight at the pole, the sun's orbit leaning 60 degrees off the pole so
// noon stands 60 degrees up. The night rig is the look's own; the day set is the lab's warm sun and pale fill. No shadows.
export const STORY_DAY = Object.freeze({ seconds: 300, dayShare: 0.6, tilt: 60, skyDim: 0.15, day: Object.freeze({ hemi: [0xc8cfe0, 0x555060, 1.5], sun: [0xfff0dc, 1.6], bg: 0x0b1524 }) });

// The Quiver's introduction after the first wave: Isao prints it on the wall across the lane, two hard-cored enemies come one
// after the other, and the piloted Quiver fires the lab's TALON (a heavier, slower guided round) instead of the game's dart
// hold: the hard cores stop short of the gate and mill about between these lane hops outside the forward cell, within the Quiver's
// reach but never at the wall (while the lock is being tuned); nearCells: how close to the gate one must come for the override
// coneDeg: the half-angle of the LOCK BOX drawn on the optic. Anything inside it is the target, it stays the target while it stays
// inside (no flicker between bodies), a timer runs, and at full it is locked. No minimum or maximum range: on a 753 m planet the
// horizon from a 4 m mount is about 80 m, so a 400 m reach is no limit at all, and the range test can never reset the timer.
export const STORY_QUIVER = Object.freeze({ key: 'quiver', delay: 0.3, hardcore: 'barbed', secondDelay: 3, hold: [5, 9], nearCells: 12, zoom: 3, studyDelay: 1.5, coneDeg: 14, missile: Object.freeze({ mesh: 'talon', profile: 'heavy', duration: 6, length: 1.0, dmgMul: 25, minRange: 0, maxRange: 400, lockTime: 0.6, lockGate: 1e4, lockBreak: 1e4, aimTolerance: 180 }) });   // the box is the gate; the code's mrad gates are opened out of the way   // a heavy payload (one round, one solid core), a long reach (the hard cores hold 50 to 90 m out), and a quick first-encounter lock: 0.4 s inside a 5 degree cone

// THE BEAT CLOCK (owner, 2026-09-18: "everything must feel faster"). Every wait in src/domain/story-beats.js that the player only
// watches, gathered here as content. `faceDelays` are Isao's two landing lines; `rotorDelay` the pause before he deploys the AFR-01;
// `tremorDelay` the beat between the gate standing and the contact on the radar; `breachDelay` the beat between the contact and the
// ground opening; `spawnDelay` the pause after the breach before the first body rises; `overrideDelay` the beat between Isao's line
// and the seat; `overrideCells` how close to the gate the swarm must come for that line. The override used to wait for a body within
// 2.2 cells of the door — the whole march up the lane. It fires when the pile is visibly ON the lane instead.
export const STORY_BEATS = Object.freeze({
  rotorDelay: 2.5, faceDelays: Object.freeze([0.6, 2.0]), controlDelay: 1.5,
  tremorDelay: 0.8, breachDelay: 2, spawnDelay: 0.4, overrideDelay: 1.5, overrideCells: 13,
});

// SECTOR 0: THE FOUNDATION (owner, 2026-09-24: "the first few waves before the stalheart is ready could be more intense POV sentries
// and Gunship shooting from above to protect the construction of the stalheart"). On a growing page, once the Quiver's two hard cores
// are down and the Stålheart is still printing, a wave rises from the sinkhole `first` seconds in and then every `every` seconds,
// cycling through `waves` until the Stålheart stands (src/domain/story-beats.js `construction`). Each body marches at `pace` (the
// sector loop's pace, not the tutorial surge), rising over `stagger` seconds scattered `spread` cells across the crater. Soft bodies
// with a hard core every other wave: the Rotor, the Quiver and the gunship each have work. `harmless`: sector 0 cannot be lost — the
// bodies pile at the gate, the gate does not wear outside a sector, and the MÖRK that rolls out into the leftovers is not hurt.
// A wave waits while `alive` bodies stand (the frame budget, and a ceiling on what the new hull rolls out into). The handover comes
// when the Stålheart stands and the field is down to `mopUp`: the automatic towers fire without the seats' multipliers and would
// take minutes over what the seats and the MÖRK's rams clear in seconds, and a live body holds every wave clock after it.
// `mopUpSeconds`: or once the hull has been out this long, whatever is left: unmanned towers do not fire before the handover, so a
// player who drove off would otherwise stall the story for good (--pacing, 2026-09-24); the harmless leftovers roll into sector 1.
// `studyDelay`: once sector 0 is over, the player drives the new hull this long before Isao's study takes the camera.
export const STORY_CONSTRUCTION = Object.freeze({
  first: 3, every: 11, alive: 60, mopUp: 0, mopUpSeconds: 20, studyDelay: 8, pace: 1.5, spread: 0.9, stagger: 2.5, harmless: true,
  waves: Object.freeze([
    Object.freeze([Object.freeze({ type: 'amoeba', count: 22 })]),
    Object.freeze([Object.freeze({ type: 'amoeba', count: 16 }), Object.freeze({ type: 'phage', count: 8 }), Object.freeze({ type: 'barbed', count: 1 })]),
    Object.freeze([Object.freeze({ type: 'amoeba', count: 26 })]),
    Object.freeze([Object.freeze({ type: 'amoeba', count: 18 }), Object.freeze({ type: 'phage', count: 10 }), Object.freeze({ type: 'barbed', count: 1 })]),
  ]),
});

// THE FIRST MÖRK ROLLS OUT OF THE STÅLHEART (owner, 2026-09-24: "Then with the Stalheart we get the first tank"). The Stålheart is a
// gantry over a slab with its rails along the plot's Z; the hull starts `start` metres from the plot centre along `heading` (the side
// the bays' doors face, toward the gate), under the gantry, and drives out to `end` metres, clear of the slab and short of the landing
// pad. `lead` is the camera's run from wherever the player was to the roll-out's framing before the hull moves (src/fx/hull-issue.js).
export const STORY_ROLLOUT = Object.freeze({ heading: Object.freeze([0, -1]), start: 4, end: 40, lead: 1.6 });

// The piloted sentry in the story: a denser stream of rounds, each one
// heavy enough that cannon fodder drops in two hits.
export const STORY_PILOT = Object.freeze({ rateMul: 2.5, dmgMul: 60 });   // a piloted round is worth one first-wave body before the kill combo (owner, 2026-09-14: fish in a barrel must be annihilated): the base is 0.0167 a round, measured on the story swarm, see 2026-09-14-piloted-rotor-annihilates

// the handover (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): the first automated phase and the Defend stage
export const STORY_HANDOVER = Object.freeze({ from: 'settled', defendStage: 8 });

// SKIP TUTORIAL (owner, 2026-09-16; 2026-09-16-skip-tutorial-into-the-back-door): where ?skip=defence drops a player who
// wants the fight and not the opening. The finished base at `stage` (through the bays, so the three hulls read as lives),
// the beats already at `phase` so the towers are automatic, `sector` the back-door sector so the collapse behind the bays
// and its breach are the first thing seen (the sector's own flags bring SOL-82 online and refill the array), `parts` the
// two expeditions taken as though they came home — the Relay and the Mortar — and `biomass` enough for a few towers
// before the first wave lands. `brief` is Isao's two lines on arrival (src/isaobriefs.js).
export const STORY_SKIP = Object.freeze({ stage: 8, phase: 'expedition', sector: 2, biomass: 450, brief: 'skip_defence', parts: Object.freeze(['rocket-a', 'rocket-b']) });

// THE TUTORIAL IN CHAPTERS (owner, 2026-09-25: "Skip tutorial should have 2 options. 1) Showing 1/x in tutorial, where we are, skip
// to next phase. 2) skip entire tutorial. it will make it easier to troubleshoot the tutorial and more user-friendly"). The opening
// is cut where its beats change hands, and the card over it says which chapter is playing and goes to the next (src/fx/tutorial-card.js).
// `phases` are the story beats a chapter covers (src/domain/automation.js STORY_PHASES). ?skip=<id> opens a page at the chapter's
// start (src/platform/story-world.js readStoryQuery): a growing base at stage 1 with the beats at `from`, and the world a run has
// there, built at boot (src/fx/story-entry.js). `printed` are the steps of Isao's programme that stand (src/content/base-programme.js),
// `towers` the sentries on their story sockets, `head` a print already under way (the share done), `foundry` the rocket sections the
// AFR-01 has already cut (absent: all of them). The numbers are the opening's own timeline (--pacing, 2026-09-25: the Rotor stands at
// 30 s, the gate at 44.7, the Stålheart's 75 s print starts at 52.8, so it is a third done at the first wave's clear, 77.7, and half
// done when sector 0 starts, 91.8; the landing pad follows it). LANDING is the page itself, whose NEXT is the landing's own skip.
// STORY_CHAPTER_END is where NEXT goes from the last chapter: sector 1, on the base the tutorial grew. SKIP ALL is STORY_SKIP.
export const STORY_CHAPTERS = Object.freeze([
  { id: 'landing', label: 'LANDING', phases: ['landed'], from: null },
  { id: 'rotor', label: 'ROTOR', phases: ['foundry', 'printing', 'rotor-ready'], from: 'foundry', foundry: 0 },
  { id: 'wave', label: 'FIRST WAVE', phases: ['tremor', 'breach', 'approach', 'override', 'piloting'], from: 'rotor-ready', printed: ['foundry', 'gate'], towers: ['rotor'], foundry: 2 },
  { id: 'quiver', label: 'QUIVER', phases: ['cleared', 'quiver-piloting'], from: 'cleared', printed: ['foundry', 'gate'], towers: ['rotor', 'quiver'], head: { stalheart: 0.33 } },
  { id: 'stalheart', label: 'STÅLHEART', phases: ['construction'], from: 'construction', printed: ['foundry', 'gate'], towers: ['rotor', 'quiver'], head: { stalheart: 0.5 } },
  { id: 'expedition', label: 'EXPEDITION', phases: ['settled', 'study-talk', 'study', 'expedition'], from: 'settled', printed: ['foundry', 'gate', 'stalheart', 'landing'], towers: ['rotor', 'quiver'] },
].map((c) => Object.freeze({ printed: [], towers: [], head: {}, ...c })));
export const STORY_CHAPTER_END = Object.freeze({ id: 'sector-1', label: 'SECTOR 1', phases: [], from: 'expedition', printed: ['foundry', 'gate', 'stalheart', 'landing', 'solar'], towers: ['rotor', 'quiver'], head: {} });

// EXPEDITIONS (docs/superpowers/specs/2026-09-14-handover-gunship-call-expeditions-design.md): the landing sites, the tower each
// part unlocks, the guard nest, and when a later site reveals (after N parts are home). The Rotor and Quiver are the base.
export const STORY_EXPEDITIONS = Object.freeze({
  base: Object.freeze(['rotor', 'quiver']),
  deliverCells: 3,   // how close to the landing (the foundry) a carried part counts as home, in cells
  sites: Object.freeze([
    { id: 'rocket-a', tower: 'relay', part: 'field coil', reveal: null, guards: [{ type: 'barbed', count: 2 }, { type: 'amoeba', count: 8 }] },
    { id: 'rocket-b', tower: 'mortar', part: 'breech', reveal: null, guards: [{ type: 'barbed', count: 2 }, { type: 'amoeba', count: 10 }] },
    { id: 'wreck', tower: 'lancer', part: 'lens', reveal: null, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 12 }] },
    { id: 'rocket-c', tower: 'plasma', part: 'coil stack', reveal: { after: 3 }, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 14 }] },
    { id: 'rocket-d', tower: 'needle', part: 'optic', reveal: { after: 3 }, guards: [{ type: 'barbed', count: 3 }, { type: 'amoeba', count: 14 }] },
    { id: 'wreck-b', tower: 'heptapod', part: 'walker core', reveal: { after: 5 }, guards: [{ type: 'barbed', count: 4 }, { type: 'amoeba', count: 18 }] },
  ].map(Object.freeze)),
});
