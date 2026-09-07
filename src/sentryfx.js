// sentryfx.js — HOW A WEAPON LOOKS. One table, separate from towers.js, which
// keeps what a weapon DOES.
//
// The split, and why it is worth a file: towers.js was half gameplay and half
// look, so "where do I change how the Lancer looks" had two answers and a
// tuning pass had to be pasted into a table full of damage numbers. Now:
//
//   towers.js   dmg, range, rate, cost, attack, splash, lock — and `color`,
//               which is IDENTITY (the range ring, the shop icon, the model's
//               tint), not an effect.
//   sentryfx.js how the shot is drawn, what leaves the barrel, and what
//               happens where it lands.
//   towerlooks  the tower's BODY — `shape` and `spin` stay with towers.js
//               because they describe the braille fallback's head geometry,
//               which is a different subsystem with its own tuner.
//
// THERE IS NO SECOND COPY. Nothing here is duplicated from towers.js; these
// fields were MOVED, and test/sentryfx.mjs fails if a tower def grows one
// back. That guard is the point — this codebase has been bitten before by two
// copies of one number drifting, and a half-migration is worse than none.
//
// Keyed by tower KEY rather than by model id, because roster 1 has no models
// at all and still has to draw its shots.
import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';
import { IMPACT_TUNE } from './impactfx.js';

// The fields that USED to live on a tower def. If you are looking for why a
// tracer is the size it is, it is here.
//   projPx     the tracer head's size in pixels
//   trail      ghost points dragged behind it, dimming to the tail
//   projSpeed  cells per second
//   beamColor  what a beam weapon THROWS, when that differs from its identity
//   plasma     the beam is a thrown spray rather than a straight line
const SHOT = (kind, projPx, trail, projSpeed, extra = {}) =>
  ({ kind, projPx, trail, projSpeed, ...extra });

// WHAT LEAVES THE BARREL — the weapon's shape, which had no single owner and
// so was answered differently in three places. towers.js knew `attack` (the
// board's behaviour), SENTRY_FAMILIES knew `lob` and `missile` (the range's),
// and neither knew about beams — so the sentry range drew a BULLET for the
// Plasma thrower and the Lancer, which are a spray and a light-lance and are
// the two weapons on the roster least like a bullet.
//
//   round   a tracer with a head and a trail
//   lob     a tracer on a parabola — it points UP, not at
//   seeker  a missile that locks first and then homes
//   throw   a wide jittery spray, thrown DOWN onto a body (Plasma)
//   lance   a thin straight held beam that pierces (Lancer)
//   field   nothing leaves it at all (Relay, Slow)
export const WEAPON_KINDS = ['round', 'lob', 'seeker', 'throw', 'lance', 'field'];

// MUZZLE and IMPACT are both `{ recipe, size, colors, tune }`:
//   recipe  a name from IMPACT_RECIPES, or an explicit list of families
//   size    ONE number scaling the whole effect (impactfx authors in local
//           space around the origin, so this is all it takes)
//   colors  per-family overrides — a laser's sparks are not a shell's sparks,
//           and colour is most of what says which weapon hit you
//   tune    deltas onto IMPACT_TUNE, so a family only names what it changes
const FX = (recipe, size, colors = {}, tune = {}) => ({ recipe, size, colors, tune });

export const SENTRY_FX = {
  // --- roster 1, the campaign ---------------------------------------------
  single:   { shot: SHOT('round', 5, 0, 20),
    muzzle: FX('light', 0.5, { flash: 0xffe6b0 }),
    impact: FX('shell', 0.7, { spark: 0xffd08a }) },
  rapid:    { shot: SHOT('round', 4, 3, 26),
    // a fast gun's muzzle has to be SMALL: at four shots a second a big flash
    // is a strobe, and the eye stops reading individual shots
    muzzle: FX('light', 0.32, { flash: 0xfff0cc }, { flashLife: 0.07 }),
    impact: FX('light', 0.5, { spark: 0xffd08a }) },
  spread:   { shot: SHOT('round', 3.5, 0, 15),
    muzzle: FX('light', 0.55, { flash: 0xffdca0 }, { sparkSpread: 1.2 }),
    impact: FX('light', 0.45, { spark: 0xffc888 }) },
  homing:   { shot: SHOT('seeker', 5, 6, 13),
    muzzle: FX(['flash', 'ember'], 0.6, { flash: 0xcfe0ff, ember: 0xff9a5c }),
    impact: FX('shell', 0.85, { spark: 0xcfe8ff }) },
  slow:     { shot: SHOT('field', 0, 0, 0),
    // a field weapon has no muzzle and no impact: nothing leaves it
    muzzle: FX([], 0), impact: FX([], 0) },
  aoe:      { shot: SHOT('lob', 12, 6, 3.5),
    muzzle: FX(['flash', 'ember'], 0.9, { flash: 0xffd9a0, ember: 0xff8a44 }),
    impact: FX('shell', 1.3, { spark: 0xffb066 }, { ringEnd: 0.95, debrisCount: 14 }) },
  sniper:   { shot: SHOT('round', 7, 11, 42),
    muzzle: FX('light', 0.7, { flash: 0xdff2ff }, { flashLife: 0.09 }),
    impact: FX('shell', 0.8, { spark: 0xdff2ff }, { sparkSpeed: 3.2 }) },
  laser:    { shot: SHOT('lance', 0, 0, 0),
    muzzle: FX(['flash'], 0.4, { flash: 0x9dffcf }),
    impact: FX('laser', 0.6, { spark: 0x9dffcf, splash: 0x9dffcf }) },

  // --- roster 2, the sentry board -----------------------------------------
  rotor:    { shot: SHOT('round', 4, 2, 24),
    // the minigun. Same reasoning as `rapid`, harder: six barrels at speed
    muzzle: FX('light', 0.3, { flash: 0xffe4a8 }, { flashLife: 0.06, sparkCount: 10 }),
    impact: FX('light', 0.45, { spark: 0xffd08a }) },
  plasma:   { shot: SHOT('throw', 0, 0, 0, { plasma: true }),
    muzzle: FX(['flash', 'ember'], 0.5, { flash: 0x2fe6d0, ember: 0x2fe6d0 }),
    // a thrower SPLASHES: it is matter, not light, and it should cling
    impact: FX('plasma', 0.75, { splash: 0x2fe6d0, ember: 0x7ffff0 }) },
  quiver:   { shot: SHOT('seeker', 5, 6, 13),
    // a launch is smoke and fire, not a flash — the round is leaving slowly
    muzzle: FX(['flash', 'ember'], 0.75, { flash: 0xdfe8ff, ember: 0xff9a5c },
      { emberCount: 26, emberLife: 2.4 }),
    impact: FX('shell', 1.0, { spark: 0x9dc4ff }, { ringEnd: 0.8 }) },
  relay:    { shot: SHOT('field', 0, 0, 0), muzzle: FX([], 0), impact: FX([], 0) },
  mortar:   { shot: SHOT('lob', 12, 6, 3.5),
    muzzle: FX(['flash', 'ember'], 0.95, { flash: 0xffd9a0, ember: 0xff8a44 },
      { emberCount: 24 }),
    impact: FX('shell', 1.25, { spark: 0xffb066 }, { ringEnd: 0.95, debrisCount: 14 }) },
  // TUNED IN THE LAB (operator, 2026-09-06) and pasted back, which is the
  // whole point of the export existing. A tight, fast, near-gravityless
  // spark that does not bounce; a small brief flash with one ring; and no
  // scorch or debris — a lance burns a spot, it does not break the plate.
  lancer:   { shot: SHOT('lance', 7, 11, 42, { beamColor: 0x4dff86 }),
    muzzle: FX(['flash'], 0.45, { flash: 0x4dff86 },
      { flashLife: 0.1 }),
    impact: FX(['spark', 'flash', 'ember'], 0.7,
      { spark: 0x4dff86, splash: 0x4dff86, ember: 0xb8ffd0 },
      { sparkCount: 20, sparkSpeed: 3, sparkSpread: 0.45, sparkGravity: 20,
        sparkBounce: 0, sparkSize: 1, flashLife: 0.1, flashSize: 0.05,
        flashRings: 1, ringEnd: 0.2, ringWidth: 0.01, scorchSize: 0.05,
        debrisSpeed: 3.9, splashCount: 90, splashLife: 4.9, splashCling: 1,
        splashSag: 12, emberCount: 20, emberLife: 1, emberRise: 1,
        emberDrag: 0.55 }) },
  howitzer: { shot: SHOT('lob', 15, 8, 3.0),
    // the loudest gun on the board should have the biggest muzzle on it
    muzzle: FX(['flash', 'spark', 'ember'], 1.25, { flash: 0xfff0d0, ember: 0xff8a44 },
      { flashLife: 0.18, emberCount: 30 }),
    impact: FX('shell', 1.7, { spark: 0xffc38a }, { ringEnd: 1.25, debrisCount: 18 }) },
  heptapod: { shot: SHOT('seeker', 6, 7, 12),
    muzzle: FX(['flash', 'ember'], 0.7, { flash: 0xffd0a0, ember: 0xff9a5c },
      { emberCount: 22 }),
    impact: FX('shell', 1.0, { spark: 0xffb45e }) },
};

// The fallback for a tower with no entry — visible rather than invisible, so a
// missing profile shows up as "that looks generic" and not as "nothing fires".
export const DEFAULT_FX = {
  shot: SHOT('round', 5, 0, 16),
  muzzle: FX('light', 0.5, {}),
  impact: FX('light', 0.6, {}),
};

// Resolve a tower def to its profile. The ONE door — a call site that reads
// SENTRY_FX directly will miss the fallback and crash on a roster-1 tower.
export function fxFor(def) {
  if (!def) return DEFAULT_FX;
  return SENTRY_FX[def.key] || DEFAULT_FX;
}

// THE SENTRY RANGE speaks family ids, the board speaks tower keys, and they
// are the same word for every family that exists on both — except the A6,
// whose model is `heptapod_a6` and whose tower key is `heptapod`. One alias
// rather than a second table: a second table is how the range came to
// disagree with the board about what a Plasma throws.
const FAMILY_ALIAS = { heptapod_a6: 'heptapod' };
// ...and the range carries four families the board has no tower for. They are
// entries here rather than a special case at the call site, so `weaponKind`
// answers for everything the range can select.
const RANGE_ONLY = { needle: 'round', kiln: 'throw', railgun: 'round' };

export function weaponKind(idOrKey) {
  const key = FAMILY_ALIAS[idOrKey] || idOrKey;
  const p = SENTRY_FX[key];
  if (p && p.shot && p.shot.kind) return p.shot.kind;
  return RANGE_ONLY[key] || 'round';
}
export const fxForFamily = (id) => SENTRY_FX[FAMILY_ALIAS[id] || id] || DEFAULT_FX;

// Convenience readers, so call sites keep the `?? default` in ONE place
// rather than each re-deciding what a missing tracer size means.
export const shotOf = (def) => fxFor(def).shot || DEFAULT_FX.shot;
export const muzzleOf = (def) => fxFor(def).muzzle || DEFAULT_FX.muzzle;
export const impactOf = (def) => fxFor(def).impact || DEFAULT_FX.impact;

// The tune a family actually fires with: IMPACT_TUNE with this profile's
// deltas folded on. Built fresh per call rather than cached, because the lab
// mutates the deltas live and a cache would show the operator yesterday's
// effect while the panel says otherwise.
export function tuneFor(profile, base = IMPACT_TUNE) {
  return { ...base, ...(profile && profile.tune ? profile.tune : {}) };
}

// --- WHO OWNS WHICH COLOUR ------------------------------------------------
//
// Operator: "the splash is green regardless of weapon, should not be the
// case. Only green for laser."
//
// It was green because impactfx's makeSplash carries a green FALLBACK, and
// twelve of the sixteen profiles never name a splash colour — so the fallback
// was the answer for almost every weapon on the board. A per-family constant
// buried in the effect is the wrong place for that decision.
//
// The rule, which is the actual fix rather than twelve more colour entries:
//
//   MATTER comes off the SURFACE. Sparks are chips of what you hit, debris is
//   the plate breaking, a scorch is the mark left on it. Shoot rock and you
//   get rock; shoot hull metal and you get hull metal. The weapon does not
//   decide what the wall is made of.
//
//   ENERGY comes from the WEAPON. A flash, a shockwave ring, molten splash
//   and embers are the round's own; they are the same whatever they land on,
//   and their colour is how you know which gun fired. A lance is green
//   because the LANCE is green.
//
// A profile may still name any of them explicitly and that always wins — the
// Plasma's cyan splash and the Lancer's green are exactly that.
export const MATTER_FAMILIES = ['spark', 'debris', 'scorch'];
export const ENERGY_FAMILIES = ['flash', 'ring', 'splash', 'ember'];

export function resolveImpactColors(profile, { surface = {}, weapon = 0xffd08a } = {}) {
  const out = {};
  for (const f of MATTER_FAMILIES) if (surface[f] !== undefined) out[f] = surface[f];
  for (const f of ENERGY_FAMILIES) out[f] = weapon;
  // whatever the profile states beats both, because a tuned colour is a
  // decision somebody made on purpose
  return { ...out, ...((profile && profile.colors) || {}) };
}

// A weapon's own colour: what it THROWS if that differs from its identity,
// otherwise its identity. Falls back rather than throwing, because roster 1
// has towers this table does not model.
export function weaponColor(key, identityHex = 0xffd08a) {
  const p = SENTRY_FX[FAMILY_ALIAS[key] || key];
  return (p && p.shot && p.shot.beamColor) || identityHex;
}

// THE FIELDS THAT MOVED. test/sentryfx.mjs asserts no tower def carries one of
// these, which is what stops the migration from silently half-reverting the
// next time someone adds a tower by copying an old one.
export const MOVED_FIELDS = ['projPx', 'trail', 'projSpeed', 'beamColor', 'plasma'];

// --- the export -----------------------------------------------------------
// "Fine-tune it, then make it the default" is the whole point of the lab, and
// a tuning that lives in one browser is a tuning that never ships. This emits
// the profile as the exact source it came from, ready to paste back over the
// entry in this file.
const hex = (v) => `0x${(v >>> 0).toString(16).padStart(6, '0')}`;
const isHexKey = (k) => /color$/i.test(k);

function fmtColors(colors) {
  const e = Object.entries(colors || {});
  if (!e.length) return '{}';
  return `{ ${e.map(([k, v]) => `${k}: ${hex(v)}`).join(', ')} }`;
}
function fmtTune(tune) {
  const e = Object.entries(tune || {});
  if (!e.length) return '';
  return `,\n      { ${e.map(([k, v]) => `${k}: ${Number(v.toFixed ? v.toFixed(3) : v)}`).join(', ')} }`;
}
function fmtFx(name, fx) {
  const recipe = Array.isArray(fx.recipe)
    ? `[${fx.recipe.map((r) => `'${r}'`).join(', ')}]`
    : `'${fx.recipe}'`;
  return `    ${name}: FX(${recipe}, ${Number(fx.size.toFixed(2))}, ${fmtColors(fx.colors)}${fmtTune(fx.tune)})`;
}

// A LITERAL, not a toString. `kind` is a string and was being written bare —
// `kind: lance` — which is a ReferenceError the moment it is pasted, and the
// export's entire promise is that pasting it works. Booleans and numbers pass
// through; strings get quoted; colours become hex.
const lit = (k, v) => {
  if (isHexKey(k)) return hex(v);
  if (typeof v === 'string') return `'${v}'`;
  return String(v);
};

export function formatSentryFx(key, profile) {
  const s = profile.shot || {};
  // KIND IS POSITIONAL and comes FIRST — SHOT(kind, projPx, trail, projSpeed,
  // extra). It used to be an `extra`, and when it moved into the signature
  // this writer was not moved with it: the emitted line kept the old shape,
  // so a pasted profile set kind to a NUMBER and the weapon silently became a
  // round. test/sentryfx.mjs round-trips every family now, which is the only
  // check that could have caught a broken exporter — the values were all
  // correct, it was the SHAPE that was wrong.
  const extra = Object.entries(s)
    .filter(([k]) => !['kind', 'projPx', 'trail', 'projSpeed'].includes(k))
    .map(([k, v]) => `${k}: ${lit(k, v)}`);
  const shot = `SHOT('${s.kind || 'round'}', ${s.projPx ?? 0}, ${s.trail ?? 0}, ${s.projSpeed ?? 0}`
    + (extra.length ? `, { ${extra.join(', ')} }` : '') + ')';
  return `  ${key}: { shot: ${shot},\n`
    + `${fmtFx('muzzle', profile.muzzle)},\n`
    + `${fmtFx('impact', profile.impact)} },`;
}

export const formatAllSentryFx = () =>
  Object.entries(SENTRY_FX).map(([k, p]) => formatSentryFx(k, p)).join('\n');
