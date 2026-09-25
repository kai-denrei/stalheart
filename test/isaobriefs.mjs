// isaobriefs — the script is data, so the invariants that matter are shape
// (a beat the presenter cannot paint is a crash, not a typo) and the dwell
// curve that now decides how long each line holds without a tap.
import { EMOTION_IDS } from '../src/emotions.js';
import { BRIEFS, BRIEF_IDS, brief, dwellFor, lineDwell, BRIEF_MIN, BRIEF_MAX, BRIEF_LEAD, BRIEF_WPS } from '../src/isaobriefs.js';

let n = 0, bad = 0;
const ok = (label, cond) => { n++; if (cond) console.log('  ok  ', label); else { bad++; console.log('  FAIL', label); } };

// --- shape: the presenter reads title/face/lines unconditionally
for (const id of BRIEF_IDS) {
  const b = BRIEFS[id];
  ok(`${id} keys its own id`, b.id === id);
  ok(`${id} has a title`, typeof b.title === 'string' && b.title.length > 0);
  ok(`${id} has a face`, typeof b.face === 'string' && b.face.length > 0);
  ok(`${id} has at least one line`, Array.isArray(b.lines) && b.lines.length > 0);
  ok(`${id} lines are all non-empty strings`,
    b.lines.every((l) => typeof l === 'string' && l.trim().length > 0));
}
ok('brief() returns null for an unknown id', brief('nope') === null);

// FACES MUST EXIST. `hungry` sat in the biomass beat and is not an emotion —
// emotionFrame falls back to neutral SILENTLY, so Isao delivered "Biomass!
// ISAO happy!" with a blank face and nothing ever said so.
for (const id of BRIEF_IDS) {
  ok(`${id} uses a real emotion (${BRIEFS[id].face})`, EMOTION_IDS.includes(BRIEFS[id].face));
}
ok('the face check can fail — a made-up id is not in the roster',
  !EMOTION_IDS.includes('hungry'));

// --- the dwell curve
ok('an empty line still holds the floor', dwellFor('') === BRIEF_MIN);
ok('a null line does not throw', dwellFor(null) === BRIEF_MIN);
ok('a short line holds the floor, not less',
  dwellFor('Empty.') === BRIEF_MIN);
ok('a very long line is capped',
  dwellFor(new Array(400).fill('word').join(' ')) === BRIEF_MAX);
ok('longer lines hold longer, in the band',
  dwellFor('one two three four five six seven eight nine ten eleven twelve')
  > dwellFor('one two three four five six seven'));
ok('the curve is the stated reading speed',
  Math.abs(dwellFor(new Array(16).fill('w').join(' ')) - (BRIEF_LEAD + 16 / BRIEF_WPS)) < 1e-9);
// NEGATIVE CONTROL: the band must actually bind, or these assertions are
// measuring a straight line and would pass for any curve at all.
ok('the floor really is below the cap', BRIEF_MIN < BRIEF_MAX);
ok('a 16-word line lands strictly inside the band — the curve is live, not clamped',
  dwellFor(new Array(16).fill('w').join(' ')) > BRIEF_MIN
  && dwellFor(new Array(16).fill('w').join(' ')) < BRIEF_MAX);

// --- a beat's own faces and dwell (the arrival's close-up, the study's): a real face per line, and each authored time a readable
// moment for one of its own lines. lineDwell reads that time and falls back to the curve, so a beat without it is unchanged
for (const id of BRIEF_IDS) {
  const b = BRIEFS[id];
  if (b.faces) ok(`${id} has a real face for each line`, b.faces.length === b.lines.length && b.faces.every((f) => EMOTION_IDS.includes(f)));
  if (b.dwell) ok(`${id} times only its own lines, each a readable moment`, b.dwell.length <= b.lines.length && b.dwell.every((s) => s >= 1 && s <= BRIEF_MAX));
}
ok('lineDwell reads a beat\'s own time', lineDwell({ lines: ['a', 'b'], dwell: [1.2] }, 0) === 1.2);
ok('and the reading curve past it', lineDwell({ lines: ['a', 'b'], dwell: [1.2] }, 1) === dwellFor('b'));
ok('a beat without dwell holds exactly as before', BRIEF_IDS.filter((id) => !BRIEFS[id].dwell).every((id) => BRIEFS[id].lines.every((l, i) => lineDwell(BRIEFS[id], i) === dwellFor(l))));
ok('the arrival says its three lines at every story start, not once per browser', BRIEFS.arrival_talk?.lines.length === 3 && !BRIEFS.arrival_talk.once);

// --- every real beat is readable inside the cap without feeling clipped
for (const id of BRIEF_IDS) {
  const total = BRIEFS[id].lines.reduce((a, l) => a + dwellFor(l), 0);
  ok(`${id} plays itself out in a sane time (${total.toFixed(1)}s)`, total > 2 && total < 45);
}

console.log(bad ? `isaobriefs: ${bad} FAILED of ${n}` : `isaobriefs: all good (${n} checks)`);
process.exit(bad ? 1 : 0);
