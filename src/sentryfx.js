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
//   towerlooks  the authored Sentry body, tier and animation pivots.
// Identity and display order live in content/sentries.js. Profiles use stable keys.
import { IMPACT_TUNE } from './content/impact-schema.js';

import { SENTRY_FX } from './content/runtime.js';
import { DEFAULT_FX, WEAPON_KINDS } from './content/weapon-defaults.js';
export { SENTRY_FX, DEFAULT_FX, WEAPON_KINDS };

// Resolve a tower def to its profile. The ONE door — a call site that reads
// Unknown diagnostic subjects receive a neutral fallback profile.
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
export function weaponKind(idOrKey) {
  const key = FAMILY_ALIAS[idOrKey] || idOrKey;
  const p = SENTRY_FX[key];
  if (p && p.shot && p.shot.kind) return p.shot.kind;
  return 'round';
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
// otherwise its identity. Unknown keys retain the supplied identity colour.
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
