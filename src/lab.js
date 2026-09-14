// lab.js — THE STRESS LAB, as data (operator, 2026-09-03).
//
// "An environment to stress-test our engine": infinite health, waves
// multiplied until the frame drops, a background that can be put in and
// taken out, and a
// number for all of it. It is a MODE on the real board (`?lab=1`), not a tab:
// a copy of the board would measure a copy, and the ROADMAP already names
// sibling tabs as the debt this repo pays for.
//
// This module is the part that is not three.js: what the lab's state looks
// like, how the URL seeds it, and what its console line says. The board
// consumes it under `lab.on && …` and nothing else — a run without the flag
// runs the code it ran yesterday.
import { clampParams, knobProblems } from './knobs.js';
import { SKY_PRESET } from './galaxyseed.js';

export const LAB_DEFAULTS = {
  waveMult: 1,           // × computeWavePlan's base, after the opening taper
  holdWaves: false,      // no automatic arming between waves
  freezeEnemies: false,  // updateEnemies skipped: the field stands still
  immortalHeart: true,   // heartHit never decrements
  immortalTank: true,    // playerHit returns before the hull counter
  // the sky opens on what the game does (SKY_PRESET); the seed is the run's
  bg: 'galaxy',          // scene.background: a baked sky, or the look's colour
  galaxySeed: 4414,      // replaced by the run's fresh seed unless the URL names one
  galaxyScale: SKY_PRESET.scale,      // the demo's zoom: 2 is twice as near and twice as wide
  galaxies: SKY_PRESET.galaxies,      // the home galaxy, plus this many minus one on the far sky
  galaxyCore: SKY_PRESET.coreScale,   // × the seeded core size (seeded small; a big bulge fights the board)
  bgIntensity: SKY_PRESET.intensity,  // scene.backgroundIntensity — "faint" is a number
  bloom: true,           // postfx on/off
};

export const LAB_KNOBS = [
  { key: 'waveMult', label: 'wave ×', group: 'waves', min: 1, max: 20, step: 1 },
  { key: 'holdWaves', label: 'hold waves', group: 'waves', bool: true },
  { key: 'freezeEnemies', label: 'freeze enemies', group: 'waves', bool: true },
  { key: 'immortalHeart', label: 'immortal heart', group: 'health', bool: true },
  { key: 'immortalTank', label: 'immortal tank', group: 'health', bool: true },
  { key: 'bg', label: 'background', group: 'sky', choices: ['none', 'galaxy'] },
  { key: 'galaxySeed', label: 'galaxy seed', group: 'sky', min: 0, max: 99999, step: 1 },
  { key: 'galaxyScale', label: 'galaxy size', group: 'sky', min: 0.25, max: 4, step: 0.05 },
  { key: 'galaxies', label: 'galaxies', group: 'sky', min: 1, max: 8, step: 1 },
  { key: 'galaxyCore', label: 'core size ×', group: 'sky', min: 0.25, max: 3, step: 0.05 },
  { key: 'bgIntensity', label: 'sky intensity', group: 'sky', min: 0, max: 1.5, step: 0.05 },
  { key: 'bloom', label: 'bloom', group: 'post', bool: true },
];

// The URL → the lab's opening state, or null when the flag is absent. Query
// keys are the knob keys prefixed `lab` (`labwave` is the one alias, because
// "labwaveMult" is not a thing anyone types). A bare `?lab=1` changes nothing
// about the board.
const ALIASES = { labwave: 'waveMult', labbg: 'bg', labseed: 'galaxySeed', labscale: 'galaxyScale', labgalaxies: 'galaxies', labcore: 'galaxyCore' };

export function parseLabQuery(search) {
  const q = new URLSearchParams(search || '');
  if (q.get('lab') !== '1') return null;
  const state = { on: true, ...LAB_DEFAULTS };
  const src = {};
  for (const [k, v] of q.entries()) {
    const key = ALIASES[k] || (k.startsWith('lab') && k.length > 3
      ? k[3].toLowerCase() + k.slice(4) : null);
    if (key && key in LAB_DEFAULTS) src[key] = v;
  }
  clampParams(LAB_KNOBS.filter((k) => !k.choices), state, src);   // choices have no range
  for (const k of LAB_KNOBS) {
    if (!k.choices || !(k.key in src)) continue;
    const want = typeof k.choices[0] === 'number' ? Number(src[k.key]) : src[k.key];
    if (k.choices.includes(want)) state[k.key] = want;
  }
  return state;
}

// One line, every couple of seconds, for the headless harness to grep. Every
// field a decision needs, in a fixed order, so two runs diff by eye.
export function labLine(s) {
  const n = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  return `LAB fps=${n(s.fps, 0)} ms=${n(s.ms)} gpu=${n(s.gpuMs)}`
    + ` calls=${s.calls ?? '—'} tris=${s.tris ?? '—'} pts=${s.pts ?? '—'}`
    + ` enemies=${s.enemies ?? '—'} wave=${s.wave ?? '—'} mult=${s.waveMult ?? 1}`
    + ` bg=${s.bg ?? 'none'} bloom=${s.bloom ? 1 : 0}`;
}

export function labKnobProblems() {
  return knobProblems(LAB_KNOBS, LAB_DEFAULTS);
}
