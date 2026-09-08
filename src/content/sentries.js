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
