// lab.mjs — the stress lab's pure half: the URL seeds it, the knob table is
// sound, the console line carries every field. No DOM, no three.js.
import { LAB_DEFAULTS, LAB_KNOBS, labKnobProblems, labLine, parseLabQuery } from '../src/lab.js';
import { computeWavePlan } from '../src/enemyspec.js';
import { SKY_PRESET } from '../src/galaxyseed.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

console.log('lab:');
check('knob table validates against its defaults', labKnobProblems().length === 0, labKnobProblems().join('; '));
check('no flag, no lab', parseLabQuery('') === null && parseLabQuery('?fps=1&perf=2') === null);
check('the lab opens on the game\'s own sky', LAB_DEFAULTS.bg === 'galaxy' && LAB_DEFAULTS.galaxies === SKY_PRESET.galaxies
  && LAB_DEFAULTS.galaxyScale === SKY_PRESET.scale && LAB_DEFAULTS.galaxyCore === SKY_PRESET.coreScale && LAB_DEFAULTS.bgIntensity === SKY_PRESET.intensity);
check('?lab=0 is not the lab', parseLabQuery('?lab=0') === null);
const bare = parseLabQuery('?lab=1');
check('bare ?lab=1 opens on the defaults', bare && bare.on === true
  && LAB_KNOBS.every((k) => bare[k.key] === LAB_DEFAULTS[k.key]));
const seeded = parseLabQuery('?lab=1&labwave=8&labbg=galaxy&labseed=77&labHoldWaves=1&labBloom=0');
check('labwave= seeds the multiplier', seeded.waveMult === 8);
check('labbg= picks a choice', seeded.bg === 'galaxy');
check('labseed= seeds the galaxy', seeded.galaxySeed === 77);
const sky = parseLabQuery('?lab=1&labscale=2.5&labgalaxies=5');
check('labscale= / labgalaxies= size and count the sky', sky.galaxyScale === 2.5 && sky.galaxies === 5);
check('galaxy count clamps to 8', parseLabQuery('?lab=1&labgalaxies=40').galaxies === 8);
check('labcore= scales the core', parseLabQuery('?lab=1&labcore=0.5').galaxyCore === 0.5);
check('lab<Key>= reaches any knob', seeded.holdWaves === true && seeded.bloom === false);
const clamped = parseLabQuery('?lab=1&labwave=999&labbg=nebula&labGalaxies=-4');
check('out-of-range clamps, unknown choices are ignored', clamped.waveMult === 20 && clamped.bg === 'galaxy'
  && clamped.galaxies === 1);
const line = labLine({ fps: 59.6, ms: 16.78, gpuMs: 4.21, calls: 1117, tris: 400000, pts: 90000, enemies: 240,
  wave: 7, waveMult: 8, bg: 'galaxy', bloom: true });
check('the console line names every field', ['fps=60', 'ms=16.8', 'gpu=4.2', 'calls=1117', 'enemies=240', 'wave=7',
  'mult=8', 'bg=galaxy', 'bloom=1'].every((f) => line.includes(f)), line);
check('a missing gpu number prints as a dash, not NaN', labLine({}).includes('gpu=—') && !labLine({}).includes('NaN'));

console.log('wave multiplier:');
const total = (p) => p.entries.reduce((n, e) => n + e.count, 0);
check('mult 1 is the game, byte for byte', [1, 2, 3, 5, 8, 12, 20].every((w) =>
  JSON.stringify(computeWavePlan(w, 1, 4, 1)) === JSON.stringify(computeWavePlan(w, 1, 4))));
for (const w of [2, 5, 9, 14]) {
  const r = total(computeWavePlan(w, 1, 4, 4)) / total(computeWavePlan(w, 1, 4));
  check(`mult 4 at wave ${w} is ~4x the bodies (${r.toFixed(2)})`, r > 3.2 && r < 5);
}
check('mult never empties a wave', total(computeWavePlan(1, 1, 1, 0.01)) >= 1);
check('the headline type does not change with the multiplier',
  computeWavePlan(6, 1, 4, 10).headline === computeWavePlan(6, 1, 4).headline);

if (failures) { console.error(`lab: ${failures} FAILED`); process.exit(1); }
console.log('lab: all green');
