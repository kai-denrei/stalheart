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

// Story-only cues; the lab merges these with the tank pneumatics from the
// shared manifest. Same budget fields as audiomanifest.js.
export const STORY_SOUNDS = Object.freeze({
  rocket_thrust: { file: 'assets/audio/rocket_thrust.mp3', bus: 'tank', gain: 0.9, maxVoices: 1, minInterval: 0, rateJitter: 0 },
  gate_hydraulics: { file: 'assets/audio/gate_hydraulics.mp3', bus: 'ui', gain: 0.7, maxVoices: 1, minInterval: 0.5, rateJitter: 0.02 },
  gate_slam: { file: 'assets/audio/gate_slam.mp3', bus: 'ui', gain: 0.8, maxVoices: 1, minInterval: 0.5, rateJitter: 0.03 },
});

// Six engines under the skirt, each with its own cadence, so the cluster
// never flickers as one lamp.
export const PLUME_CLUSTER = Object.freeze([
  { angle: 0, radius: 1.25, width: 7, height: 24, phase: 0.0, cadence: 11, depth: 0.14 },
  { angle: 60, radius: 1.25, width: 6, height: 21, phase: 1.7, cadence: 13, depth: 0.2 },
  { angle: 120, radius: 1.25, width: 6.5, height: 23, phase: 3.1, cadence: 9, depth: 0.16 },
  { angle: 180, radius: 1.25, width: 7, height: 25, phase: 4.4, cadence: 12, depth: 0.12 },
  { angle: 240, radius: 1.25, width: 6, height: 20, phase: 0.9, cadence: 15, depth: 0.22 },
  { angle: 300, radius: 1.25, width: 6.5, height: 22, phase: 2.3, cadence: 10, depth: 0.18 },
]);

// Presentation scale. The SH02 is authored at 21.4 m; the story shows it
// larger so a game-sized Isao reads small and clears the cargo well.
// The story hull is 10 m long (the kit's MÖRK is authored at 13.28 m, so kit containers scale to match);
// tankUnit is the game's unit scale per lattice cell that gives that length: 10 m / (10 m cells x 1.95 span x 0.75 base).
export const STORY_SCALE = Object.freeze({ rocket: 1.5, isaoMetres: 1.8, tankMetres: 10, tankUnit: 0.684 });

// The breach seen from orbit: the whole planet stays in frame through the ground opening and the first fodder emerging
export const STORY_BREACH = Object.freeze({ emergeHold: 6, tail: 1.8 });

// The piloted sentry in the story: a denser stream of rounds, each one
// heavy enough that cannon fodder drops in two hits.
export const STORY_PILOT = Object.freeze({ rateMul: 2.5, dmgMul: 5 });
