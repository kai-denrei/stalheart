import { storage as localStorage } from './storage.js';
// score.js — points, as distinct from biomass. Biomass buys towers; points
// are the bragging number, and they lean the OTHER way on purpose: the
// economy already pays tank kills double, and the scoreboard triples them,
// so the leaderboard belongs to whoever fights hands-on. A field multiplier
// scales every kill by how swarmed the board was when it landed — killing
// under pressure is the skill being measured.
//
// Pure module: no DOM, no storage. The tab owns persistence of `best`
// (localStorage) and hands in the live enemy count.

export const POINT_SCALE = 10;              // bounty 3..45 -> chunky numbers
export const SRC_WEIGHT = { tank: 3, tower: 1, strike: 1 };
export const RAM_PREMIUM = 1.5;             // mirrors the economy's ruling
export const FIELD_STEP = 0.04;             // +4% per live enemy...
export const FIELD_CAP = 2;                 // ...capped at x2

export function fieldMult(alive) {
  return Math.min(FIELD_CAP, 1 + FIELD_STEP * Math.max(0, alive));
}

export function killScore(bounty, { src = 'tower', ram = false, alive = 0 } = {}) {
  return Math.round(bounty * POINT_SCALE * (SRC_WEIGHT[src] ?? 1)
    * (ram ? RAM_PREMIUM : 1) * fieldMult(alive));
}

// clearing a wave is worth more the deeper you are
export function waveScore(wave) {
  return 100 + 25 * wave;
}

export function makeScore(best = 0) {
  let points = 0;
  return {
    get points() { return points; },
    get best() { return best; },
    addKill(bounty, opts) {
      points += killScore(bounty, opts);
      if (points > best) best = points;
      return points;
    },
    addWave(wave) {
      points += waveScore(wave);
      if (points > best) best = points;
      return points;
    },
    // a fresh run: the counter clears, the best stays earned
    reset() { points = 0; },
  };
}
