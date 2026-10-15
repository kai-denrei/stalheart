// looks.js — visual identities for the board tabs (maze / organic).
// A look owns every color decision: backgrounds, light rig, floor/wall
// vertex palettes, edge-line treatment, actor tints. Switching looks
// rebuilds geometry with the new palette; no shaders, no post-processing.
//
//   battlezone — vector-monitor wireframe (HokorobiTawaa's main look):
//                near-black green faces act as hidden-line occluders,
//                phosphor-green edges, white walker. Faces exist only to
//                block lines behind them — that IS the Battlezone trick.
//   tron       — neon: black world, additive cyan edges (additive blending
//                stands in for bloom), hot orange orbs, magenta heart.
//   solid      — the original palette.
//   clean      — solid without edge lines: plain surfaces, slightly
//                stronger jitter so faces still separate without outlines.

export const LOOKS = {
  battlezone: {
    bg: 0x000401, mapBg: 0x000300,
    hemi: [0x9dffb0, 0x001404, 0.9], sun: [0xd9ffe2, 0.35], fill: [0x2a5c38, 0.25],
    floors: {
      path: [0.010, 0.075, 0.030],
      room: [0.014, 0.095, 0.040],
      visited: [0.030, 0.140, 0.060],
      spawn: [0.055, 0.190, 0.110],
      heartFloor: [0.100, 0.240, 0.120],
      hintFlash: [0.75, 1.0, 0.80],
    },
    walls: { top: [0.004, 0.030, 0.012], side: [0.002, 0.014, 0.006] },
    jitter: 0,
    wallTopMode: 'black',
    edges: { show: true, color: 0x54ff7a, opacity: 1.0, additive: false },
    walker: 0xe8ffe8, walkerHi: 0x54ff7a, marker: 0xe8ffe8,
    enemy: 0xffffff, enemyHi: 0x54ff7a,
    orb: { color: 0xd9ffe2, emissive: 0x1d4d28 },
    heart: '#7dff9e',
  },

  tron: {
    bg: 0x010107, mapBg: 0x000004,
    hemi: [0x223a66, 0x050510, 0.55], sun: [0x8ab4ff, 0.25], fill: [0x33244d, 0.2],
    floors: {
      path: [0.014, 0.030, 0.055],
      room: [0.020, 0.040, 0.070],
      visited: [0.020, 0.075, 0.100],
      spawn: [0.000, 0.110, 0.140],
      heartFloor: [0.110, 0.015, 0.100],
      hintFlash: [0.55, 1.0, 1.0],
    },
    walls: { top: [0.010, 0.016, 0.034], side: [0.004, 0.007, 0.018] },
    jitter: 0,
    wallTopMode: 'black',
    edges: { show: true, color: 0x00e5ff, opacity: 0.9, additive: true },
    walker: 0x9ff8ff, walkerHi: 0xffffff, marker: 0x00e5ff,
    enemy: 0xff2d6f, enemyHi: 0xffffff,
    orb: { color: 0xffa02f, emissive: 0xb35a00 },
    heart: '#ff2df0',
  },

  tronColors: {
    // tron with WEATHER: a turquoise base broken by amber, white, green and
    // magenta zones — seeded accent centers on the sphere, gaussian falloff,
    // blended per cell, so areas melt into each other instead of tiling
    bg: 0x010107, mapBg: 0x000004,
    hemi: [0x223a66, 0x050510, 0.55], sun: [0x8ab4ff, 0.25], fill: [0x33244d, 0.2],
    floors: {
      path: [0.014, 0.030, 0.055],
      room: [0.020, 0.040, 0.070],
      visited: [0.020, 0.075, 0.100],
      spawn: [0.000, 0.110, 0.140],
      heartFloor: [0.110, 0.015, 0.100],
      hintFlash: [0.55, 1.0, 1.0],
    },
    walls: { top: [0.010, 0.016, 0.034], side: [0.004, 0.007, 0.018] },
    jitter: 0,
    wallTopMode: 'black',
    edges: { show: true, color: 0x00e5ff, opacity: 0.9, additive: true },
    zones: {
      base: 0x00e5ff, baseWeight: 0.6,
      accents: [
        [0xffb000, 2, 0.40], // amber
        [0xffffff, 2, 0.32], // white
        [0x54ff7a, 2, 0.40], // green
        [0xff2df0, 1, 0.30], // magenta, one small island
      ],
      floorLevels: { path: 0.055, room: 0.075, visited: 0.135 },
      wallSideLevel: 0.03,
    },
    walker: 0x9ff8ff, walkerHi: 0xffffff, marker: 0x00e5ff,
    enemy: 0xff2d6f, enemyHi: 0xffffff,
    orb: { color: 0xffa02f, emissive: 0xb35a00 },
    heart: '#ff2df0',
  },

  blueprint: {
    // cyanotype: white ink on drawing-blue paper; flat, even light — it's a
    // drawing, not a scene. The heart is the one thing allowed to be red.
    bg: 0x0e2a52, mapBg: 0x0a1f3d,
    hemi: [0xdce8ff, 0x33517e, 1.6], sun: [0xffffff, 0.25], fill: [0x9fc0ff, 0.2],
    floors: {
      path: [0.10, 0.21, 0.40],
      room: [0.13, 0.25, 0.45],
      visited: [0.18, 0.32, 0.53],
      spawn: [0.16, 0.42, 0.55],
      heartFloor: [0.42, 0.16, 0.22],
      hintFlash: [0.85, 0.95, 1.0],
    },
    walls: { top: [0.055, 0.135, 0.28], side: [0.035, 0.095, 0.21] },
    jitter: 0,
    edges: { show: true, color: 0xd8ecff, opacity: 0.95, additive: false },
    walker: 0xffffff, walkerHi: 0x9fd0ff, marker: 0xffffff,
    enemy: 0xff5252, enemyHi: 0xffffff,
    orb: { color: 0xdcedff, emissive: 0x2a4a7a },
    heart: '#ff5252',
  },

  amber: {
    // monochrome amber phosphor terminal: everything is one hue, hierarchy
    // comes from brightness alone
    bg: 0x070300, mapBg: 0x050200,
    hemi: [0xffc46b, 0x140a00, 0.8], sun: [0xffdf9e, 0.3], fill: [0x5c3a10, 0.25],
    floors: {
      path: [0.075, 0.038, 0.004],
      room: [0.095, 0.050, 0.006],
      visited: [0.140, 0.075, 0.010],
      spawn: [0.200, 0.115, 0.020],
      heartFloor: [0.260, 0.140, 0.020],
      hintFlash: [1.0, 0.80, 0.35],
    },
    walls: { top: [0.030, 0.014, 0.001], side: [0.014, 0.006, 0.000] },
    jitter: 0,
    edges: { show: true, color: 0xffb000, opacity: 1.0, additive: false },
    walker: 0xffe9c0, walkerHi: 0xffb000, marker: 0xffe9c0,
    enemy: 0xffdf9e, enemyHi: 0xffb000,
    orb: { color: 0xffcf6e, emissive: 0x664100 },
    heart: '#ffb000',
  },

  solid: {
    bg: 0x0d1017, mapBg: 0x080a10,
    hemi: [0xc8cfe0, 0x555060, 1.5], sun: [0xffe8c8, 1.1], fill: [0x8a96c8, 0.8],
    floors: {
      path: [0.80, 0.72, 0.52],
      room: [0.86, 0.80, 0.62],
      visited: [0.62, 0.68, 0.58],
      spawn: [0.45, 0.68, 0.80],
      heartFloor: [0.92, 0.45, 0.55],
      hintFlash: [0.55, 0.95, 0.75],
    },
    walls: { top: [0.36, 0.40, 0.47], side: [0.22, 0.25, 0.31] },
    jitter: 1,
    edges: { show: true, color: 0x171a22, opacity: 0.7, additive: false },
    walker: 0x54e0c8, walkerHi: 0xffd77a, marker: 0x54e0c8,
    enemy: 0xd94f4f, enemyHi: 0xffd77a,
    orb: { color: 0xffb84d, emissive: 0x4d2f00 },
    heart: '#ff5f7e',
  },

  clean: {
    bg: 0x0d1017, mapBg: 0x080a10,
    hemi: [0xc8cfe0, 0x555060, 1.5], sun: [0xffe8c8, 1.2], fill: [0x8a96c8, 0.8],
    floors: {
      path: [0.80, 0.72, 0.52],
      room: [0.86, 0.80, 0.62],
      visited: [0.62, 0.68, 0.58],
      spawn: [0.45, 0.68, 0.80],
      heartFloor: [0.92, 0.45, 0.55],
      hintFlash: [0.55, 0.95, 0.75],
    },
    walls: { top: [0.36, 0.40, 0.47], side: [0.22, 0.25, 0.31] },
    jitter: 1.8, // no outlines: per-cell tone variation does the separating
    edges: { show: false, color: 0x000000, opacity: 0, additive: false },
    walker: 0x54e0c8, walkerHi: 0xffd77a, marker: 0x54e0c8,
    enemy: 0xd94f4f, enemyHi: 0xffd77a,
    orb: { color: 0xffb84d, emissive: 0x4d2f00 },
    heart: '#ff5f7e',
  },
};

export const LOOK_NAMES = Object.keys(LOOKS);
