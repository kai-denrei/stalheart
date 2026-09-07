// sentryfx.mjs — THE GUARD ON THE SPLIT. towers.js keeps what a weapon does;
// sentryfx.js keeps how it looks. The migration moved five fields, and the
// failure mode is not a crash — it is somebody adding a tower next month by
// copying an old one, bringing `projPx` back onto the def, and two copies of
// one number quietly drifting from then on. That is the exact failure this
// codebase has already recorded, so it is a test rather than a comment.
import { ROSTERS } from '../src/towers.js';
import {
  SENTRY_FX, DEFAULT_FX, MOVED_FIELDS, fxFor, shotOf, muzzleOf, impactOf,
  tuneFor, formatSentryFx, formatAllSentryFx,
  resolveImpactColors, weaponColor, MATTER_FAMILIES, ENERGY_FAMILIES,
} from '../src/sentryfx.js';
import { IMPACT_FAMILIES, IMPACT_RECIPES, IMPACT_TUNE } from '../src/impactfx.js';

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { console.error(`  FAIL ${name} ${detail}`); failures++; }
};

const allTowers = ROSTERS[2].towers;

console.log('the split holds:');
for (const f of MOVED_FIELDS) {
  const offenders = allTowers.filter((d) => d[f] !== undefined).map((d) => d.key);
  check(`no tower def carries "${f}" any more`, offenders.length === 0,
    `still on: ${offenders.join(', ')} — it moved to sentryfx.js, do not re-add it`);
}
check('towers.js keeps `color` — that is identity, not an effect',
  allTowers.every((d) => typeof d.color === 'number'));

console.log('every tower resolves a profile:');
for (const d of allTowers) {
  const fx = fxFor(d);
  check(`${d.key} has one`, !!fx);
  check(`${d.key} is not silently falling back`, fx !== DEFAULT_FX,
    'no SENTRY_FX entry — it will draw a generic shot');
}
check('an unknown tower still resolves', fxFor({ key: 'nope' }) === DEFAULT_FX);
check('a missing def does not throw', fxFor(null) === DEFAULT_FX);

console.log('the profiles are well formed:');
for (const [key, p] of Object.entries(SENTRY_FX)) {
  check(`${key} has shot, muzzle and impact`, !!(p.shot && p.muzzle && p.impact));
  for (const slot of ['muzzle', 'impact']) {
    const fx = p[slot];
    const names = Array.isArray(fx.recipe) ? fx.recipe : (IMPACT_RECIPES[fx.recipe] || null);
    check(`${key}.${slot} names a real recipe or family list`, names !== null,
      `"${fx.recipe}" is neither a recipe nor a list`);
    if (names) {
      check(`${key}.${slot} names only families that exist`,
        names.every((n) => IMPACT_FAMILIES.includes(n)),
        names.filter((n) => !IMPACT_FAMILIES.includes(n)).join(','));
    }
    check(`${key}.${slot} size is a sane number`,
      Number.isFinite(fx.size) && fx.size >= 0 && fx.size <= 6, `${fx.size}`);
    for (const k of Object.keys(fx.tune || {})) {
      check(`${key}.${slot} tune key "${k}" is a real IMPACT_TUNE knob`, k in IMPACT_TUNE);
    }
    for (const k of Object.keys(fx.colors || {})) {
      check(`${key}.${slot} colour key "${k}" is a real family`, IMPACT_FAMILIES.includes(k));
    }
  }
}

console.log('a weapon that throws nothing draws nothing:');
for (const key of ['relay']) {
  const p = SENTRY_FX[key];
  const names = Array.isArray(p.impact.recipe) ? p.impact.recipe : IMPACT_RECIPES[p.impact.recipe];
  check(`${key} has no impact — a field weapon never lands anywhere`, names.length === 0);
}

console.log('who owns which colour:');
{
  // Operator: "the splash is green regardless of weapon, should not be the
  // case. Only green for laser." It was green because impactfx's makeSplash
  // carries a green FALLBACK and twelve of the sixteen profiles never name a
  // splash colour — so a per-family constant buried in the effect was
  // answering for almost every weapon on the board.
  const SURF = { spark: 0xaaaaaa, debris: 0xbbbbbb, scorch: 0xcccccc };
  const WEAPON = 0x123456;
  for (const [key, p] of Object.entries(SENTRY_FX)) {
    const c = resolveImpactColors(p.impact, { surface: SURF, weapon: WEAPON });
    const named = p.impact.colors || {};
    for (const f of ENERGY_FAMILIES) {
      const want = named[f] !== undefined ? named[f] : WEAPON;
      if (c[f] === want) continue;
      check(`${key}: ${f} is the weapon's, or the profile's own`, false,
        `got 0x${(c[f] || 0).toString(16)} want 0x${want.toString(16)}`);
    }
    for (const f of MATTER_FAMILIES) {
      const want = named[f] !== undefined ? named[f] : SURF[f];
      if (c[f] === want) continue;
      check(`${key}: ${f} is the surface's, or the profile's own`, false,
        `got 0x${(c[f] || 0).toString(16)} want 0x${want.toString(16)}`);
    }
  }
  check('every family resolves for every weapon', true);
  // the specific report: no weapon may inherit a colour it never asked for
  const GREEN = 0x9dffcf;           // impactfx's makeSplash fallback
  const leaked = Object.entries(SENTRY_FX).filter(([, p]) => {
    const c = resolveImpactColors(p.impact, { surface: SURF, weapon: WEAPON });
    return c.splash === GREEN && (p.impact.colors || {}).splash === undefined;
  }).map(([k]) => k);
  check('no weapon inherits the splash fallback green', leaked.length === 0, leaked.join(','));
  // ...and a weapon that DOES declare green keeps it
  check("the Lancer's splash is still its own green",
    resolveImpactColors(SENTRY_FX.lancer.impact, { surface: SURF, weapon: WEAPON }).splash
      === SENTRY_FX.lancer.impact.colors.splash);
  check('the Plasma keeps its cyan',
    resolveImpactColors(SENTRY_FX.plasma.impact, { surface: SURF, weapon: WEAPON }).splash
      === SENTRY_FX.plasma.impact.colors.splash);
  check('a weapon with no splash colour gets the WEAPON, not a constant',
    resolveImpactColors(SENTRY_FX.howitzer.impact, { surface: SURF, weapon: WEAPON }).splash
      === WEAPON);
  check('sparks still come off the SURFACE where unnamed',
    resolveImpactColors(SENTRY_FX.rotor.impact, { surface: SURF, weapon: WEAPON }).debris
      === SURF.debris);
}

console.log('tune folding:');
{
  const folded = tuneFor(SENTRY_FX.howitzer.impact);
  check('a delta wins over the base', folded.ringEnd === SENTRY_FX.howitzer.impact.tune.ringEnd);
  check('everything else is the base', folded.sparkLife === IMPACT_TUNE.sparkLife);
  check('the base is not mutated', IMPACT_TUNE.ringEnd !== folded.ringEnd);
  check('no profile is required to have a tune', Object.keys(tuneFor(SENTRY_FX.relay.impact)).length > 0);
}

console.log('the export ACTUALLY round-trips:');
{
  // THE ONLY CHECK THAT COULD HAVE CAUGHT A BROKEN EXPORTER. Every value was
  // correct and the SHAPE was wrong: `kind` moved into SHOT's signature as
  // the first positional argument and the writer was not moved with it, so
  // the emitted line kept the old form and wrote `kind: lance` unquoted
  // inside the extras. Pasting it is a ReferenceError; surviving that, it
  // sets kind to a NUMBER and the weapon silently becomes a round.
  //
  // So: emit the source, EVALUATE it with the same SHOT and FX helpers the
  // file uses, and compare field for field against what went in.
  const SHOT = (kind, projPx, trail, projSpeed, extra = {}) =>
    ({ kind, projPx, trail, projSpeed, ...extra });
  const FX = (recipe, size, colors = {}, tune = {}) => ({ recipe, size, colors, tune });
  let bad = 0;
  for (const [key, p] of Object.entries(SENTRY_FX)) {
    const src = formatSentryFx(key, p);
    let back;
    try {
      // the emitted text is `  key: { ... },` — wrap it into an object
      // eslint-disable-next-line no-new-func
      back = new Function('SHOT', 'FX', `return { ${src} };`)(SHOT, FX)[key];
    } catch (e) {
      check(`${key} emits source that PARSES`, false, e.message + ' :: ' + src);
      bad++;
      continue;
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const shotOk = back.shot.kind === p.shot.kind
      && back.shot.projPx === p.shot.projPx
      && back.shot.trail === p.shot.trail
      && back.shot.projSpeed === p.shot.projSpeed
      && back.shot.beamColor === p.shot.beamColor
      && back.shot.plasma === p.shot.plasma;
    if (!shotOk) {
      check(`${key} shot survives the round trip`, false,
        `${JSON.stringify(back.shot)} != ${JSON.stringify(p.shot)}`);
      bad++;
    }
    for (const slot of ['muzzle', 'impact']) {
      if (same(back[slot].recipe, p[slot].recipe)
        && back[slot].size === p[slot].size
        && same(back[slot].colors, p[slot].colors)
        && same(back[slot].tune, p[slot].tune)) continue;
      check(`${key}.${slot} survives the round trip`, false,
        `${JSON.stringify(back[slot])} != ${JSON.stringify(p[slot])}`);
      bad++;
    }
  }
  check(`all ${Object.keys(SENTRY_FX).length} families round-trip exactly`, bad === 0, `${bad} broken`);
}

console.log('the export round-trips:');
{
  // the whole promise of the lab is "tune it, paste it, it is the default".
  // If the emitted source does not parse back to the same profile, that
  // promise is broken silently — the operator pastes and the values move.
  const src = formatSentryFx('lancer', SENTRY_FX.lancer);
  check('emits a single object entry', src.trim().startsWith('lancer: {') && src.trim().endsWith('},'));
  check('keeps beamColor as hex', src.includes('beamColor: 0x4dff86'), src);
  // NOT a specific recipe NAME. This pinned `'laser'`, and the moment the
  // Lancer was tuned in the lab its impact became an explicit family list —
  // which is a legitimate export and made a passing test fail on correct
  // data. What matters is that the shot's KIND is quoted, since writing it
  // bare is the bug that made the export unpasteable; the round-trip above
  // covers the rest properly.
  check('quotes the weapon kind', src.includes("SHOT('lance'"), src);
  const all = formatAllSentryFx();
  check('the whole table emits one line per family',
    all.split('\n').filter((l) => /^  \w+: \{ shot:/.test(l)).length === Object.keys(SENTRY_FX).length);
}

console.log(failures ? `\n${failures} FAILURES` : '\nall sentry-fx invariants hold');
process.exit(failures ? 1 : 0);
