// enemyspec.js — the enemy roster as DATA, shared by the heart tab and the
// TD tab (M0 extraction: one source of truth ends the sibling-drift risk
// for roster facts). Pure module: no DOM, no three.js, Node-testable.
//
// Colors are HokorobiTawaa's palette (hue = class, brightness = threat
// rank) for the borrowed types; our original three keep their tints.

// COLOUR IS THE SAFETY RULE, AND THE RULE IS BELTS (operator, 2026-08-31).
//
// The first thing a player needs from a contact is whether it goes under the
// treads, and they need it before they have parsed a shape. So the roster is
// painted up the jiu-jitsu belt ladder: white at the bottom, red at the top,
// and the line between "free kill" and "solid core" falls exactly where the
// operator drew it.
//
//   WHITE · GREY · YELLOW · BLUE      → rammable. Free under the treads.
//   ORANGE · GREEN · PURPLE · BROWN
//   · BLACK · RED                     → solid core. Hurts to touch.
//
// Rank inside each side is threat order, so the ladder reads as a ladder:
// the white belt is the wave-1 swarm and the red belt is the boss. Green
// changed sides to make it work — it used to mean "slime" and now it means
// "do not touch", which costs the green slime its name colour and is worth
// it. The split is enforced by test/tdcore.mjs rather than trusted: a new
// enemy painted from the wrong side is a lie the player pays for in hulls.
export const SAFE_HUES = {
  white: 0xf4f8ff,
  grey: 0xa4b2c2,
  yellowPale: 0xfff07a,
  yellow: 0xffe14a,
  bluePale: 0x8fe8ff,
  blue: 0x5ea8ff,
};
export const ALARM_HUES = {
  orange: 0xff9a2e,
  green: 0x3fbf5a,
  greenDeep: 0x2a8f47,
  purple: 0xb44bff,
  purpleDeep: 0x7a2ecc,
  brown: 0x8a5a2b,
  black: 0x3a3a46,
  red: 0xd11414,
};

export const CREATURE_TINTS = {
  // --- rammable, up the safe belts -----------------------------------------
  amoeba: SAFE_HUES.white,         // wave 1 swarm — the white belt (owner, 2026-09-14: the amoeba leads)
  phage: SAFE_HUES.grey,           // slow crawler
  ghost: SAFE_HUES.yellowPale,     // agile flyer
  scoutufo: SAFE_HUES.yellow,      // fast scout
  saucer: SAFE_HUES.bluePale,      // interceptor — jinks
  jellyfish: SAFE_HUES.blue,
  gslime: SAFE_HUES.blue,          // 2 hp and regenerates: the top safe belt
  // --- solid core, up the alarm belts --------------------------------------
  drifter: ALARM_HUES.orange,      // the first thing you must NOT ram
  corona: ALARM_HUES.green,
  shellback: ALARM_HUES.greenDeep, // tactician — waits for cover
  barbed: ALARM_HUES.purple,       // accelerates when hit
  prime: ALARM_HUES.purpleDeep,    // epic-rare, 6 hp, regenerates
  rolling: ALARM_HUES.brown,       // epic, heavy
  phantom: ALARM_HUES.black,       // optical camo — dark by trade and by rank
  knot: ALARM_HUES.red,            // the boss wears the red belt
  // the jelly wears the red belt too — it is a boss and the belt is the rule —
  // but its BODY colour is the shader's, not a dot tint. This entry exists so
  // the radar, the sitrep roster and the debrief have something to draw with.
  jelly: ALARM_HUES.red,
};

// --- ACCENTS -------------------------------------------------------------
// The dot clouds take a body colour and a HIGHLIGHT, and until now every
// enemy's highlight was white. That works right up to the dark end of the
// alarm ladder: the phantom is near-black by trade and by rank, and in a
// crowd of white-belt phage it simply disappears — the operator could not
// pick the dangerous one out of a group of harmless ones, which is the exact
// job colour is doing here.
//
// So the dark belts carry a RED accent. Red is not on either palette as a
// body colour, so it never reads as a belt; it reads as a warning light on
// something you cannot otherwise see, which is what it is.
export const ACCENT_RED = 0xff2a2a;
export const ACCENT_DEFAULT = 0xffffff;
// what a dark body is allowed to highlight with: warning colours, and
// nothing a safe belt could be mistaken for
export const ACCENT_ALARM = [ACCENT_RED, 0xff9a2e];

// Relative luminance, so "is this too dark to read in a crowd" is measured
// rather than eyeballed. Pure, and the test below uses the same number.
export function hueLuma(hex) {
  const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
// Measured across the palette, the dark cluster (black .23, red .24,
// deep purple .29) sits clear of everything else — brown is next at .38.
export const DARK_LUMA = 0.32;

// THE RULE: a DARK alarm body may not highlight in white. White is a safe
// belt, and a white-flecked dark cloud in a crowd of white-belt phage reads
// as one of the phage — which is precisely the report. Dark bodies take an
// accent from the ALARM side instead, so the warning survives the crowd.
// Brighter alarm bodies (orange, green, purple, brown) carry their own read
// and keep the white highlight.
export const CREATURE_ACCENTS = {
  phantom: ACCENT_RED,     // black belt, optical camo — the one that vanished
  prime: ACCENT_RED,       // deep purple, 6 hp, regenerates
  knot: ALARM_HUES.orange, // the boss is already red; red on red is no accent
  jelly: ALARM_HUES.orange,
};

// What a type's dot cloud should highlight with. Default white; the dark
// belts get the warning light.
export const accentFor = (key) => CREATURE_ACCENTS[key] ?? ACCENT_DEFAULT;

// Pure predicates, so the rule can be asserted instead of remembered.
export const isSafeHue = (hex) => Object.values(SAFE_HUES).includes(hex);
export const isAlarmHue = (hex) => Object.values(ALARM_HUES).includes(hex);

// per-type combat spec. speed multiplies the tab's base enemy speed; size
// multiplies cellSide; rammable types die under the tank's treads for
// free, the rest hurt to touch and shrug the ram off. slowOnHit /
// accelOnHit are HokorobiTawaa's on-hit reactions (1.2 s); regen is their
// healOOC (hp/s while unhit for 1.2 s); heavy = epic tier, spawns sparse.
// bounty = HK's credit values, verbatim — the TD economy pays them as biomass.
export const ENEMY_SPEC = {
  amoeba:    { hp: 1, speed: 1.15, size: 0.5,  rammable: true,  heartDmg: 1, erratic: true, bounty: 3 },
  ghost:     { hp: 1, speed: 1.25, size: 0.42, rammable: true,  heartDmg: 1, erratic: true, bounty: 6 },
  scoutufo:  { hp: 1, speed: 1.4,  size: 0.42, rammable: true,  heartDmg: 1, erratic: true, bounty: 7 },
  phage:     { hp: 1, speed: 0.75, size: 0.4,  rammable: true,  heartDmg: 1, bounty: 16 },
  jellyfish: { hp: 1, speed: 0.95, size: 0.45, rammable: true,  heartDmg: 1, bounty: 14 },
  gslime:    { hp: 2, speed: 0.7,  size: 0.5,  rammable: true,  heartDmg: 1, regen: 0.25, bounty: 12 },
  drifter:   { hp: 2, speed: 0.85, size: 0.52, rammable: false, heartDmg: 1, erratic: true, bounty: 15 },
  corona:    { hp: 2, speed: 0.8,  size: 0.5,  rammable: false, heartDmg: 2, slowOnHit: 0.6, bounty: 15 },
  barbed:    { hp: 3, speed: 0.7,  size: 0.55, rammable: false, heartDmg: 2, accelOnHit: 1.9, bounty: 20 },
  rolling:   { hp: 4, speed: 0.65, size: 0.6,  rammable: false, heartDmg: 2, slowOnHit: 0.55, heavy: true, bounty: 28 },
  prime:     { hp: 6, speed: 0.55, size: 0.65, rammable: false, heartDmg: 2, regen: 0.35, heavy: true, bounty: 45 },
  knot:      { hp: 5, speed: 0.6,  size: 0.8,  rammable: false, heartDmg: 3, accelOnHit: 1.7, boss: true, bounty: 34 },
  // THE JELLY MASS — the second boss, and the first hostile that is a MESH
  // rather than a dot cloud. Slower and fatter than the knot: it does not
  // accelerate when hit, it just keeps coming, which is a different problem to
  // solve than a thing that speeds up. `mesh: 'jelly'` is the flag the board
  // reads to build it out of UNITS instead of dotShapePts.
  // `shelved` is the flag, not the missing INTROS line: a spec with no intro
  // is otherwise indistinguishable from one somebody FORGOT to introduce,
  // which is the bug the tdcore invariant exists to catch. Shelved means
  // deliberately not in the wave programme — reachable from the viewer, the
  // lore and `?enemy=`, absent from play.
  jelly:     { hp: 9, speed: 0.42, size: 1.15, rammable: false, heartDmg: 4, boss: true, bounty: 52, mesh: 'jelly', shelved: true },
  // --- the invasion roster (waves 13+): three styles the ladder never had.
  // jink stacks a second, faster weave on top of erratic; tactician holds
  // at the edge of tower coverage until minions arrive as cover, then
  // bursts; cloaked runs optical camo — hazy on screen, a radar contact
  // only in brief decloak windows.
  saucer:    { hp: 1, speed: 1.55, size: 0.36, rammable: true,  heartDmg: 1, erratic: true, jink: true, bounty: 9 },
  shellback: { hp: 3, speed: 0.9,  size: 0.55, rammable: false, heartDmg: 2, tactician: true, bounty: 24 },
  phantom:   { hp: 2, speed: 1.05, size: 0.48, rammable: false, heartDmg: 2, cloaked: true, bounty: 28 },
};

// one new threat per wave, in HokorobiTawaa's difficulty order (agile →
// support/regen → armored → dangerous → epic → boss); its spawn point is
// created at announce time. role = flavor only; the announce card's ram
// badge (from ENEMY_SPEC) owns the run-over verdict.
export const INTROS = [
  { wave: 1,  type: 'amoeba',    label: 'THE AMOEBA',          role: 'agile swarm · hunt its source' },
  { wave: 2,  type: 'ghost',     label: 'WAVE GHOST',          role: 'agile flyer' },
  { wave: 3,  type: 'scoutufo',  label: 'SCOUT UFO',           role: 'fast scout' },
  { wave: 4,  type: 'phage',     label: 'THE PHAGE',           role: 'crawler · destroy the spawn' },
  { wave: 5,  type: 'jellyfish', label: 'THE JELLYFISH',       role: 'pulse drifter' },
  { wave: 6,  type: 'gslime',    label: 'GREEN SLIME',         role: 'regenerator — ram it before it heals' },
  { wave: 7,  type: 'drifter',   label: 'WAVE SATURN',         role: 'erratic drifter' },
  { wave: 8,  type: 'corona',    label: 'VIRUS',         role: 'armored ×2 · slows when shot' },
  { wave: 9,  type: 'barbed',    label: 'BARBED MINE',         role: 'SPEEDS UP when shot' },
  { wave: 10, type: 'rolling',   label: 'ROLLING MINE',        role: 'epic · slows when shot' },
  { wave: 11, type: 'prime',     label: 'PRIME MINE',          role: 'epic-rare · REGENERATES' },
  { wave: 12, type: 'knot',      label: 'THORUS · BOSS', role: 'accelerates when hit · 3 heart damage' },
  { wave: 13, type: 'saucer',    label: 'SAUCER',        role: 'small · agile · weaves like a dogfight' },
  { wave: 14, type: 'shellback', label: 'SHELLBACK',     role: 'waits at tower range for cover · then bursts' },
  { wave: 15, type: 'phantom',   label: 'PHANTOM',       role: 'optical camo · a ghost on the radar' },
  // THE MASS IS SHELVED (2026-09-06, operator). Its wave-16 line is commented
  // out, NOT deleted, and `ENEMY_SPEC.jelly` stays: the unit is finished, it
  // is in the viewer, the lore and `?enemy=jelly:1`, and it is the board's
  // only mesh-bodied hostile — which is the thing worth keeping alive, since
  // deleting it would take the one exercise of that path with it. Restoring
  // the boss is this line plus `wavesPerSector` 15 -> 16 in td-tab.
  // { wave: 16, type: 'jelly',     label: 'THE MASS · BOSS', role: 'slow · 9 hp · 4 heart damage · does not accelerate, does not stop' },
];

// deterministic per-wave RNG (no Math.random — keeps the plan reproducible
// for both the preview and the actual spawn)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// enemy types available at a wave: the first min(wave,12) INTROS, in order
export function typesByWave(wave) {
  const n = Math.max(1, Math.min(INTROS.length, Math.floor(wave) || 1));
  return INTROS.slice(0, n).map((iv) => iv.type);
}

// per-wave spawn plan: the NEWEST type in bulk + a seeded sprinkle of ≤2
// earlier types. Counts use the same density tiers as the live spawner so
// the preview never lies. Pure + deterministic.
export function computeWavePlan(wave, round = 1, waveSize = 4, mult = 1) {
  const avail = typesByWave(wave);
  const headline = avail[avail.length - 1];
  const earlier = avail.slice(0, -1);
  const rnd = mulberry32((Math.floor(wave) || 1) * 2654435761);
  const pool = earlier.slice();
  const supports = [];
  const k = Math.min(2, pool.length);
  for (let i = 0; i < k; i++) supports.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  let base = waveSize + wave + 2 * (Math.max(1, round) - 1);
  // GENTLER OPENINGS (sim batch 2026-08-30: waves 1-3 deal essentially
  // all heart damage — median 10->5 before the kit exists). The first
  // three waves taper: 55% / 70% / 85% of their scheduled size.
  if (wave <= 3) base = Math.max(2, Math.round(base * (0.4 + 0.15 * wave)));
  // THE LAB'S MULTIPLIER (?lab=1). Applied after the taper so the opening
  // waves stay proportionally gentle, and to `base` rather than to each
  // count so every density rule below scales together. 1 is the game.
  if (mult !== 1) base = Math.max(1, Math.round(base * mult));
  const density = (t) => {
    const s = ENEMY_SPEC[t];
    return s.boss ? 1
      : s.heavy ? Math.max(1, Math.ceil(base / 3))
      : s.rammable ? Math.round(base * 1.4)
      : Math.max(1, Math.ceil(base / 2));
  };
  const entries = [{ type: headline, count: density(headline) }];
  for (const t of supports) entries.push({ type: t, count: Math.max(1, Math.round(density(t) * 0.4)) });
  // THE INVASION. Waves 1..8 are the unlock ladder — one tower per wave, the
  // count kept learnable. Once the kit is complete the gloves come off: every
  // count surges (fodder hardest), and the earliest rammable types return in
  // flood numbers on top. It must FEEL like an invasion, and the player now
  // has eight tower kinds and an orbital strike to answer it with.
  if (wave > 8) {
    const surge = 1 + (wave - 8) * 0.25;
    for (const e of entries) {
      const sp = ENEMY_SPEC[e.type];
      e.count = Math.round(e.count * (sp.rammable ? 1.6 * surge : Math.sqrt(surge)));
    }
    for (const t of ['amoeba', 'ghost']) {
      if (avail.includes(t)) entries.push({ type: t, count: Math.round(base * 1.2 * surge) });
    }
  }
  return { headline, entries };
}
