// Authoritative identity and radial order. Model IDs retain the pinned upstream filenames.
export const SENTRIES = Object.freeze([
  {
    "number": 1,
    "key": "rotor",
    "model": "rotor",
    "name": "Rotor",
    "label": "1. Rotor",
    "note": "rotary barrels \u2014 four muzzles, fed from drums",
    "fire": "sentry_rotor",
    "ready": "minigun_ready"
  },
  {
    "number": 2,
    "key": "plasma",
    "model": "plasma",
    "name": "Plasma",
    "label": "2. Plasma",
    "note": "perforated nozzle \u2014 a thrower, not a gun",
    "fire": "sentry_plasma"
  },
  {
    "number": 3,
    "key": "quiver",
    "model": "quiver",
    "name": "Quiver",
    "label": "3. Quiver",
    "note": "missile cells \u2014 six capped tubes \u00b7 locks on, then homes",
    "fire": "sentry_quiver",
    "missile": true
  },
  {
    "number": 4,
    "key": "relay",
    "model": "relay",
    "name": "Relay",
    "label": "4. Relay",
    "note": "a mast, not a weapon: fixed, no articulation",
    "fire": "sentry_relay",
    "fixed": true
  },
  {
    "number": 5,
    "key": "mortar",
    "model": "mortar",
    "name": "Mortar",
    "label": "5. Mortar",
    "note": "tube and baseplate \u2014 the steepest arc on the range",
    "fire": "sentry_mortar",
    "lob": true,
    "arcCells": 4.6
  },
  {
    "number": 6,
    "key": "lancer",
    "model": "lancer",
    "name": "Lancer",
    "label": "6. Lancer",
    "note": "rail and focusing collars \u2014 one aperture",
    "fire": "sentry_lancer"
  },
  {
    "number": 7,
    "key": "needle",
    "model": "needle",
    "name": "Needle",
    "label": "7. Needle",
    "note": "dedicated sniper — long range, one precise heavy shot",
    "fire": "sentry_needle"
  },
  {
    "number": 8,
    "key": "heptapod",
    "model": "heptapod_a6",
    "name": "Heptapod",
    "label": "8. Heptapod",
    "note": "six legs, vertical launch cells \u2014 walks, fixed turret",
    "fire": "sentry_heptapod",
    "fixed": true
  }
].map(Object.freeze));
export const SENTRY_BY_KEY = Object.freeze(Object.fromEntries(SENTRIES.map(s => [s.key,s])));
export const SENTRY_ORDER = Object.freeze(SENTRIES.map(s => s.key));

// THE QUIVER'S ROUND BURSTS WHERE IT LANDS (owner, 2026-10-02: "AOE effect even if they land on a missing target, AND explosion and dust
// even if they miss"): every body within `cells` of the landing takes `share` of the round's damage, hit or miss
export const QUIVER_SPLASH = Object.freeze({ cells: 1.2, share: 0.5 });

// FEWER SENTRIES, STRONGER ONES (owner, 2026-10-02: "difficulty and fps tuning idea; make towers harder to build, maybe fewer spots to build
// on, but more powerful. Reduce numbers, keeps the intensity. Or simply limited availability"; and "some sort of maximum range of where
// we can build towers"). In the story Isao keeps at most `cap` sentries running (standing and ordered), every sentry hits `dmgMul` times
// harder, and with `buildCells` set an order farther than that many cells from the Stålheart is refused (null: no limit, the owner is
// still weighing it); dmgMul 1.4 -> 1.15 (2026-10-03: "it feels a bit too easy"). `full` and `far` are the refusals the build menu shows; `rock` and `deep` say the terrain rules in the story's words.
export const STORY_SENTRIES = Object.freeze({ cap: 10, dmgMul: 1.15, buildCells: null, full: 'Isao keeps 10 sentries running: sell one to build another', far: 'too far from the Stålheart',
  rock: 'sentries stand on ROCK: pick a rock cell beside the open ground', deep: 'too deep in the rock: a sentry needs open ground beside it' });
