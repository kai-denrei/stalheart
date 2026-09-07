import { makeParams, clampParams, formatKnobs, knobProblems } from '../core/knobs.js';

export const IMPACT_TUNE = {
  // SPARK SHOWER — hot chips thrown off the surface, falling under gravity
  sparkCount: 34,
  sparkSpeed: 2.4,        // units/s at birth
  sparkSpread: 0.85,      // radians off the normal — 0 is a needle, 1.5 a fan
  sparkLife: 0.55,        // seconds
  sparkGravity: 5.5,      // units/s^2, along -Z (into the surface's floor)
  sparkBounce: 0.35,      // how much of the speed survives hitting the surface
  sparkSize: 2.2,         // px
  // FLASH — the brief pop at the contact point
  flashLife: 0.13,
  flashSize: 0.17,
  flashRings: 2,
  // SHOCKWAVE — an expanding ring lying ON the surface
  ringLife: 0.42,
  ringEnd: 0.62,          // final radius
  ringWidth: 0.08,
  // SCORCH — the mark that outlives the hit
  scorchLife: 3.0,
  scorchSize: 0.17,
  // DEBRIS — solid tumbling fragments knocked off the surface
  debrisCount: 9,
  debrisSpeed: 1.7,
  debrisLife: 1.4,
  debrisSize: 0.028,
  // PLASMA SPLASH — molten matter that clings, sags and drips
  splashCount: 22,
  splashLife: 1.1,
  splashCling: 0.72,      // how much of the throw is killed on contact
  splashSag: 2.2,         // units/s^2 of droop once it has stuck
  // EMBERS — the slow bright motes that trail after everything else
  emberCount: 16,
  emberLife: 1.9,
  emberRise: 0.75,        // units/s upward drift
  emberDrag: 0.86,
};

export const IMPACT_KNOBS = [
  { key: 'sparkCount', label: 'sparks', group: 'spark', min: 0, max: 160, step: 1 },
  { key: 'sparkSpeed', label: 'speed', group: 'spark', min: 0.2, max: 20, step: 0.1 },
  { key: 'sparkSpread', label: 'spread (rad)', group: 'spark', min: 0, max: 1.57, step: 0.01 },
  { key: 'sparkLife', label: 'life (s)', group: 'spark', min: 0.05, max: 3, step: 0.05 },
  { key: 'sparkGravity', label: 'gravity', group: 'spark', min: 0, max: 30, step: 0.5 },
  { key: 'sparkBounce', label: 'bounce', group: 'spark', min: 0, max: 1, step: 0.05 },
  { key: 'sparkSize', label: 'size (px)', group: 'spark', min: 0.5, max: 10, step: 0.1 },
  { key: 'flashLife', label: 'life (s)', group: 'flash', min: 0.02, max: 1, step: 0.01 },
  { key: 'flashSize', label: 'size', group: 'flash', min: 0.05, max: 4, step: 0.05 },
  { key: 'flashRings', label: 'rings', group: 'flash', min: 1, max: 5, step: 1 },
  { key: 'ringLife', label: 'life (s)', group: 'ring', min: 0.05, max: 3, step: 0.05 },
  { key: 'ringEnd', label: 'radius', group: 'ring', min: 0.2, max: 8, step: 0.1 },
  { key: 'ringWidth', label: 'width', group: 'ring', min: 0.01, max: 1, step: 0.01 },
  { key: 'scorchLife', label: 'life (s)', group: 'scorch', min: 0.2, max: 20, step: 0.1 },
  { key: 'scorchSize', label: 'size', group: 'scorch', min: 0.05, max: 4, step: 0.05 },
  { key: 'debrisCount', label: 'chunks', group: 'debris', min: 0, max: 60, step: 1 },
  { key: 'debrisSpeed', label: 'speed', group: 'debris', min: 0.2, max: 20, step: 0.1 },
  { key: 'debrisLife', label: 'life (s)', group: 'debris', min: 0.1, max: 6, step: 0.1 },
  { key: 'debrisSize', label: 'size', group: 'debris', min: 0.01, max: 0.6, step: 0.005 },
  { key: 'splashCount', label: 'blobs', group: 'splash', min: 0, max: 90, step: 1 },
  { key: 'splashLife', label: 'life (s)', group: 'splash', min: 0.1, max: 5, step: 0.1 },
  { key: 'splashCling', label: 'cling', group: 'splash', min: 0, max: 1, step: 0.02 },
  { key: 'splashSag', label: 'sag', group: 'splash', min: 0, max: 12, step: 0.1 },
  { key: 'emberCount', label: 'embers', group: 'ember', min: 0, max: 80, step: 1 },
  { key: 'emberLife', label: 'life (s)', group: 'ember', min: 0.1, max: 8, step: 0.1 },
  { key: 'emberRise', label: 'rise', group: 'ember', min: -3, max: 6, step: 0.05 },
  { key: 'emberDrag', label: 'drag', group: 'ember', min: 0.5, max: 1, step: 0.01 },
];

export const makeImpactParams = (src = IMPACT_TUNE) => makeParams(IMPACT_KNOBS, src);
export const clampImpactParams = (p, src) => clampParams(IMPACT_KNOBS, p, src);
export const formatImpactTune = (p) => formatKnobs('IMPACT_TUNE', IMPACT_KNOBS, p);
export const impactKnobProblems = () => knobProblems(IMPACT_KNOBS, IMPACT_TUNE);

export const IMPACT_FAMILIES = ['spark', 'flash', 'ring', 'scorch', 'debris', 'splash', 'ember'];

// A hit is not one effect, it is a RECIPE. These are the three the game
// actually needs, named after what fires them rather than after what they
// look like — so a call site asks for "what a laser does to a wall" and does
// not have to know which families that turns out to be.
export const IMPACT_RECIPES = {
  shell:  ['flash', 'spark', 'ring', 'debris', 'scorch'],
  laser:  ['flash', 'spark', 'splash', 'ember', 'scorch'],
  plasma: ['flash', 'splash', 'ember', 'ring'],
  light:  ['flash', 'spark'],          // a small-arms tick: cheap, still reads
};

