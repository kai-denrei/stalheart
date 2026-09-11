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
  tileMetres: 4,       // Fortification foundation tile
  padTiles: 16,        // 16 x 16 tiles = 64 x 64 m
});

// Sanity record for the pinned recipe; test/story-planet.mjs asserts it.
export const STORY_SANITY = Object.freeze({ cells: 71314, heart: 8123, cellSide: 0.013274480493795838 });

export const LANDING_DEFAULTS = Object.freeze({
  orbit: 4, descent: 8, startAltitude: 300, deployAltitude: 40,
  legsDeploy: 2.4, shock: 2, settle: 2, door: 1.8, isao: 3, dustSeconds: 1.2,
});
