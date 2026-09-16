// The KORP/GS01 heavy gunship: the platform the orbital strike always
// implied. Pure data; src/domain/gunship.js takes these as configuration.
// Design: docs/superpowers/specs/2026-09-13-heavy-gunship-design.md.

// The orbit. It cannot be influenced: the ship is low on fuel and passes
// over the base on a fixed schedule. `pass` is the time between passes,
// `station` how long the guns are yours.
export const GUNSHIP_ORBIT = Object.freeze({ pass: 60, station: 120 });   // owner, 2026-09-14: two minutes overhead while we debug; a pass must last long enough to feel meaningful

// the post-handover call-in meter: biomass earned from kills fills it one for one, a cleared wave adds a bonus; the
// first call comes within a few waves, later ones cost more (owner, 2026-09-14: an earned call-in)
export const GUNSHIP_CALL = Object.freeze({ perBiomass: 1, perWaveClear: 40, firstThreshold: 150, threshold: 300 });

// Where the platform rides while on station, in cells; the optic's pitch
// limits (radians, negative is down); the model's metre.
export const GUNSHIP_PLATFORM = Object.freeze({
  altitudeCells: 34,   // much higher (owner, 2026-09-14): 340 m up, the eye straight down
  zoom: 2,             // the optic's magnification when the seat opens
  pitchMin: -1.5708, pitchMax: -0.95,   // straight down to 54° down; the horizon dips 42° at 34 cells, so every aim lands
  metresPerCell: 10,   // the KORP is authored in metres; the story world is 10 m a cell
});

// THE GROUND TRACK (owner, 2026-09-15: the gunship feels too static, it should move slowly towards the breaches).
// src/domain/gunship-track.js flies the platform's ground point toward the live breach with the most enemies near it,
// else back over the base. Distances in cells, speeds in cells/s (a cell is 10 m on the story planet), yaw in deg/s.
export const GUNSHIP_TRACK = Object.freeze({
  speedCells: 1.2,        // top ground speed, 12 m/s: about 35 s from over the base to a breach 45 cells out
  accelCells: 0.2,        // cells/s²: six seconds from rest to top speed, and the same curve to brake onto the circle
  loiterCells: 8,         // the orbit round the target: the breach stays in the optic's cone, never straight under the eye
  loiterSpeedCells: 0.6,  // round the circle, anticlockwise from above (the left pylon turn): a lap in about 80 s
  yawRateDeg: 8,          // the hull turns no faster than this
  nearCells: 6,           // enemies within this many cells of a breach count toward it
  switchMargin: 3,        // another breach needs this many more enemies near it to take the ship off its current one
});

// WEAPON 3 IS A REAL MISSILE (owner, 2026-09-16: "the Gunship should fire an actual missile, one of our large ones. We see it drop,
// then it ignites after 2 seconds and heads down (for Weapon #3, mini nuke)"). The 105's instant strike is retired: the third gun is
// now the MK-9, a modelled round on the TALON body — the missile kit's LARGE mesh (1,340 triangles against the DART's 188), authored
// for "single special rounds / close views", already pinned and already pooled for the Quiver's own heavy shot, so no asset is added.
// It is let go from the belly with the aircraft's own velocity, falls unpowered for `freeFall` seconds, then the motor lights —
// exhaust, plume, sound — and `drive` seconds of powered dive put it on the painted cell. `gravity` is m/s²; `metresPerCell` above
// turns all of it into the planet's units. src/domain/missile-flight.js takes every one of these as a parameter.
export const GUNSHIP_NUKE = Object.freeze({
  mesh: 'talon', profile: 'heavy', length: 4, exhaust: true,   // four metres nose to tail: a body you can read falling away from the belly, not a dart
  freeFall: 2, drive: 1.8,   // two seconds of nothing but the fall, then the burn: the owner's own number
  gravity: 9.81,             // the fall is real metres in real seconds, not an authored curve
  arrivalLead: 1.5,          // the powered dive's arrival tangent, as a multiple of the distance left: speed climbs into impact
  // the two moments worth hearing: the shackles letting go at the belly, and the motor catching two seconds later. Both are keys
  // already in src/content/audio-defaults.js — no sample is added for this. seeker_fire IS the missile motor the Quiver uses.
  releaseSound: 'tank_shells', igniteSound: 'seeker_fire',
});

// The three guns. `rate` in rounds per second, `damage` per round at the
// centre of `blastCells`, `dangerCells` the readout ring, `travel` the
// seconds a round takes to reach the ground from orbit: the gunner leads.
// Downtime: the rotary overheats after `heatSeconds` of fire and cools for
// `coolSeconds`; the Bofors reloads for `reload` s after `magazine` rounds;
// the MK-9 is one per pass (`perPass`) and locks out for `reload` s after the
// blast. Ammo is otherwise unlimited. The heavy has no cadence here: its
// release is the paint-then-fire ritual in src/domain/gunship.js.
export const GUNSHIP_GUNS = Object.freeze({
  rotary: Object.freeze({ key: 'rotary', label: '25MM', cue: 'trrrrrrrrrr', rate: 30, damage: 0.22, blastCells: 0.45, dangerCells: 0.8, travel: 2.0, zoom: 2.6, heatSeconds: 12, coolSeconds: 3.5, sound: 'gunship_rotary_fire', loop: true, pitch: 1, impact: 'kinetic_fire', ringHex: 0xdfe8ee, clip: 'Rotary_Fire', strike: false }),
  bofors: Object.freeze({ key: 'bofors', label: '40MM', cue: 'TOH-TOH-TOH', rate: 2.4, damage: 2.6, blastCells: 1.1, dangerCells: 1.6, travel: 2.6, zoom: 1.9, magazine: 6, reload: 2.8, sound: 'gunship_bofors_fire', pitch: 1, impact: 'blast_fire', ringHex: 0xffb347, clip: 'Rotary_Fire', strike: false }),
  // the heaviest tool the seat owns: a 55 m killing radius against the 105's 32, one release a pass, and it takes our own walls
  // and sentries with it exactly as the orbital strike does — the ring goes red before the release, it is never made safe
  heavy: Object.freeze({ key: 'heavy', label: 'MK-9', cue: 'clunk … ssshhhh-WHUMP', rate: 0, damage: 0, blastCells: 5.5, dangerCells: 5.5, zoom: 1.3, freeFall: GUNSHIP_NUKE.freeFall, travel: GUNSHIP_NUKE.freeFall + GUNSHIP_NUKE.drive, reload: 20, perPass: 1, sound: GUNSHIP_NUKE.releaseSound, ringHex: 0xff6a4d, clip: 'Heavy_Fire', strike: true }),
});
export const GUNSHIP_GUN_ORDER = Object.freeze(['rotary', 'bofors', 'heavy']);
