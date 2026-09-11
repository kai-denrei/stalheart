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
  tileMetres: 4,       // Fortification foundation tile
  padTiles: 16,        // 16 x 16 tiles = 64 x 64 m
});

// Sanity record for the pinned recipe; test/story-planet.mjs asserts it.
export const STORY_SANITY = Object.freeze({ cells: 71314, heart: 8123, cellSide: 0.013274480493795838 });

export const LANDING_DEFAULTS = Object.freeze({
  orbit: 4, descent: 8, startAltitude: 300, deployAltitude: 40,
  legsDeploy: 2.4, shock: 2, settle: 2, door: 1.8, isao: 5, dustSeconds: 1.2,
});

// Story-only cues; the lab merges these with the tank pneumatics from the
// shared manifest. Same budget fields as audiomanifest.js.
export const STORY_SOUNDS = Object.freeze({
  rocket_thrust: { file: 'assets/audio/rocket_thrust.mp3', bus: 'tank', gain: 0.9, maxVoices: 1, minInterval: 0, rateJitter: 0 },
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
export const STORY_SCALE = Object.freeze({ rocket: 1.5, isaoMetres: 1.8 });
