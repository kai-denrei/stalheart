// knobs.mjs — the shared tuning-panel machinery, and both knob tables that
// are built from it. A knob table is a UI contract: if it disagrees with the
// constants it names, the panel silently stops covering something or offers
// a slider that cannot reach the shipped value.
import { makeParams, clampParams, formatKnobs, roundToStep, knobProblems } from '../src/knobs.js';
import { TANK_FEEL, TANK_FEEL_KNOBS, tankKnobProblems, formatFeelCode, makeFeelParams } from '../src/tankfeel.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

console.log('the shared machinery:');
{
  const KN = [
    { key: 'a', label: 'A', group: 'g', min: 0, max: 10, step: 0.5 },
    { key: 'b', label: 'B', group: 'g', choices: ['x', 'y'] },
  ];
  const D = { a: 4, b: 'x' };
  check('no problems in a sound table', knobProblems(KN, D).length === 0);
  const p = makeParams(KN, D);
  check('makeParams copies', p.a === 4 && p.b === 'x');
  p.a = 9;
  check('and is a copy', D.a === 4);

  clampParams(KN, p, { a: 999 });
  check('clamps above max', p.a === 10);
  clampParams(KN, p, { a: -5 });
  check('clamps below min', p.a === 0);
  clampParams(KN, p, { a: 'junk' });
  check('ignores non-numeric', p.a === 0);
  clampParams(KN, p, { nonesuch: 1 });
  check('ignores unknown keys', !('nonesuch' in p));

  check('rounds to step', roundToStep(0.13999999999, 0.005) === 0.14);
  check('integers stay integers', roundToStep(190.0000001, 10) === 190);

  const src = formatKnobs('X', KN, { a: 2.5, b: 'y' });
  check('emits a pasteable block', src.startsWith('export const X = {') && src.endsWith('};'));
  check('quotes a choice value', src.includes('"y"'), src);
  check('does not quote a number', /a:\s+2\.5,/.test(src), src);
}

console.log('bool knobs:');
{
  const KN = [{ key: 'walls', label: 'walls', group: 'g', bool: true }];
  const D = { walls: true };
  check('bool table is sound', knobProblems(KN, D).length === 0, knobProblems(KN, D).join('; '));
  check('a non-boolean default is flagged',
        knobProblems(KN, { walls: 1 }).some((m) => m.includes('non-boolean')));
  const p = makeParams(KN, D);
  clampParams(KN, p, { walls: false });
  check('restores a boolean', p.walls === false);
  clampParams(KN, p, { walls: '1' });
  check("accepts '1' as true", p.walls === true);
  clampParams(KN, p, { walls: 'junk' });
  check('ignores junk', p.walls === true);
  check('formats as bare true/false', formatKnobs('B', KN, { walls: false }).includes('false'));
}

console.log('problem detection:');
{
  const bad = [
    { key: 'a', label: 'A', group: 'g', min: 0, max: 1, step: 0.1 },
    { key: 'a', label: 'A', group: 'g', min: 0, max: 1, step: 0.1 },
    { key: 'ghost', label: 'G', group: 'g', min: 0, max: 1, step: 0.1 },
    { key: 'c', label: '', group: '', min: 0, max: 1, step: 0.1 },
  ];
  const probs = knobProblems(bad, { a: 5, c: 0.5, orphan: 1 });
  const has = (frag) => probs.some((p) => p.includes(frag));
  check('spots a duplicate key', has('duplicate key'));
  check('spots a knob naming nothing', has('ghost'), probs.join('; '));
  check('spots a default outside its range', has('outside'), probs.join('; '));
  check('spots a missing label', has('missing label'));
  check('spots a tunable with no knob', has('orphan'), probs.join('; '));
}

console.log('the shipped tables:');
{
  // The invariant that matters most: a slider whose range excludes the value
  // the game actually ships means the first drag jumps you somewhere else.
  check('tank table is sound', tankKnobProblems().length === 0, tankKnobProblems().join('; '));
  check('tank block round-trips', formatFeelCode(makeFeelParams()).includes('rise:'));
}

console.log(failures ? `\n${failures} FAILURES` : '\nall knob invariants hold');
process.exit(failures ? 1 : 0);
