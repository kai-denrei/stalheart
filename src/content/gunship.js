// The KORP/GS01 heavy gunship: the platform the orbital strike always
// implied. Pure data; src/domain/gunship.js takes these as configuration.
// Design: docs/superpowers/specs/2026-09-13-heavy-gunship-design.md.

// The orbit. It cannot be influenced: the ship is low on fuel and passes
// over the base on a fixed schedule. `pass` is the time between passes,
// `station` how long the guns are yours.
export const GUNSHIP_ORBIT = Object.freeze({ pass: 60, station: 60 });   // owner, 2026-09-14: a pass must last long enough to feel meaningful, at least 45 s

// Where the platform rides while on station, in cells; the optic's pitch
// limits (radians, negative is down); the model's metre.
export const GUNSHIP_PLATFORM = Object.freeze({
  altitudeCells: 12,   // above the ground; the horizon dips 30° from here, and the pitch limits keep every aim on the planet
  trackShare: 0.5,     // the track's centre, as a share of the way from the heart to the lane's approach
  driftCells: 8,       // half the ground track crossed while on station
  zoom: 2,             // the optic's magnification when the seat opens
  pitchMin: -1.5, pitchMax: -0.7,
  metresPerCell: 10,   // the KORP is authored in metres; the story world is 10 m a cell
});

// The three guns. `rate` in rounds per second, `damage` per round at the
// centre of `blastCells`, `dangerCells` the readout ring. The heavy has no
// cadence here: it is the orbital strike, rationed by src/strike.js.
export const GUNSHIP_GUNS = Object.freeze({
  rotary: Object.freeze({ key: 'rotary', label: '25MM', cue: 'trrrrrrrrrr', rate: 30, damage: 0.22, blastCells: 0.45, dangerCells: 0.8, sound: 'minigun_fire', ringHex: 0xdfe8ee, clip: 'Rotary_Fire', strike: false }),
  bofors: Object.freeze({ key: 'bofors', label: '40MM', cue: 'TOH-TOH-TOH', rate: 2.4, damage: 2.6, blastCells: 1.1, dangerCells: 1.6, sound: 'blast_fire', ringHex: 0xffb347, clip: 'Rotary_Fire', strike: false }),
  heavy: Object.freeze({ key: 'heavy', label: '105MM', cue: 'sssshhh-BAAAM', rate: 0, damage: 0, blastCells: 3.2, dangerCells: 3.2, sound: null, ringHex: 0xff6a4d, clip: 'Heavy_Fire', strike: true }),
});
export const GUNSHIP_GUN_ORDER = Object.freeze(['rotary', 'bofors', 'heavy']);
