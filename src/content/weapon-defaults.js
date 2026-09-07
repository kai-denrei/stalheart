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
//   field   nothing leaves it at all (Relay)
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
  rotor:    { shot: SHOT('round', 4, 2, 24),
    // the minigun. six barrels at speed
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

