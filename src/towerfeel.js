// towerfeel.js — what a braille tower LOOKS like, as data.
//
// Same bargain as tankfeel: the numbers that decide a look are knobs rather
// than constants buried in a builder, described once so the game's GUI and
// the unit viewer's panel are generated from the same table and write to the
// same object. Tuning on the bench is then tuning the build, which is the
// only reason a bench is worth having.
//
// Pure: no DOM, no three.js.

import { TOWER_HEAD_KINDS } from './creatures.js';
import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';

// 'as shipped' means "use whatever shape towers.js gave this one".
export const HEAD_AS_SHIPPED = 'as shipped';
export const HEAD_CHOICES = [HEAD_AS_SHIPPED, ...TOWER_HEAD_KINDS];

// Which head each tower wears, BY TOWER KEY. This used to be one global
// override on TOWER_FEEL, and that was wrong twice over: it could only ever
// answer "does this shape work at all", never "which tower should wear it",
// and because it persisted, picking any shape once silently masked every
// tower's own head from then on — including two that had just been assigned
// in towers.js. A per-tower map is both the honest model and the thing you
// actually want to end up with, since it pastes straight back as `shape:`.
export const TOWER_HEADS = {};

export const TOWER_FEEL = {
  headScale: 0.42,   // cloud scale inside the head group
  // The mast's collar top is at 0.83, and a head now sits on its BASE, so
  // this is the height of the head's FOOT above the mast base. 0.86 rests
  // it on the collar; raise it to float the head clear, as it used to.
  headLift: 0.86,    // where the head's base sits, in mast units
  // MEASURED, not guessed. At wave 4 the frame costs ~1020 draw calls and
  // 50k points; the calls scale with OBJECT count, the points with density.
  // Raising a head from 190 to 480 adds ~290 vertices to a draw call that
  // already exists — under 1% of points drawn, and zero extra calls. The
  // old 190 was an arbitrary default, never a budget.
  dots: 480,         // points in the cloud — density IS the read at distance
  dotSize: 2.1,      // px, unattenuated: a dot is the same size at any range
  hiEvery: 12,       // every Nth dot is a white highlight
  spin: 0.6,         // radians/s
  bob: 0.045,        // vertical float, model units
  bobRate: 1.9,      // and how fast it floats
};

export const TOWER_FEEL_KNOBS = [
  { key: 'headScale', label: 'head size', group: 'head', min: 0.15, max: 0.9, step: 0.01 },
  { key: 'headLift', label: 'head height', group: 'head', min: 0.6, max: 1.8, step: 0.02 },
  { key: 'dots', label: 'dot count', group: 'dots', min: 60, max: 1200, step: 20 },
  { key: 'dotSize', label: 'dot size', group: 'dots', min: 1, max: 5, step: 0.1 },
  { key: 'hiEvery', label: 'highlight every', group: 'dots', min: 4, max: 24, step: 1 },
  { key: 'spin', label: 'spin', group: 'motion', min: 0, max: 2, step: 0.05 },
  { key: 'bob', label: 'bob height', group: 'motion', min: 0, max: 0.15, step: 0.005 },
  { key: 'bobRate', label: 'bob rate', group: 'motion', min: 0, max: 4, step: 0.1 },
];

export const makeTowerParams = (src = TOWER_FEEL) => makeParams(TOWER_FEEL_KNOBS, src);
export const clampTowerParams = (p, src) => clampParams(TOWER_FEEL_KNOBS, p, src);
export const formatTowerFeel = (p) => formatKnobs('TOWER_FEEL', TOWER_FEEL_KNOBS, p);
export const towerKnobProblems = () => knobProblems(TOWER_FEEL_KNOBS, TOWER_FEEL);

// Which head a given tower should wear: its assignment if it has one, else
// the shape towers.js gave it.
export function headKindFor(def, heads = TOWER_HEADS) {
  const want = heads && heads[def.key];
  if (want && want !== HEAD_AS_SHIPPED && TOWER_HEAD_KINDS.includes(want)) return want;
  return def.shape || 'sphere';
}

// Only real overrides survive: an assignment equal to the shipped shape is
// noise, and an unknown name would ask the generator for a shape it does not
// have and quietly get a sphere back.
export function cleanHeads(raw, defs) {
  const out = {};
  if (!raw) return out;
  for (const def of defs) {
    const want = raw[def.key];
    if (want && want !== def.shape && TOWER_HEAD_KINDS.includes(want)) out[def.key] = want;
  }
  return out;
}

// The assignments as source, ready to paste back into towers.js — which is
// where they belong once chosen. Emitting the whole roster (not just the
// overrides) makes it a checklist of what is settled and what is not.
export function formatTowerHeads(heads, defs) {
  const w = Math.max(...defs.map((d) => d.key.length));
  const body = defs.map((d) => {
    const want = (heads && heads[d.key]) || d.shape;
    const mark = want === d.shape ? '' : '   // <- changed';
    return `  ${(d.key + ':').padEnd(w + 1)} ${JSON.stringify(want)},${mark}`;
  }).join('\n');
  return `// paste each into its tower's \`shape:\` in towers.js\n{\n${body}\n}`;
}
