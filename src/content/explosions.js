// Which explosion lands where, as data. The modules are the owner's lab, pinned in src/fx/explosions/
// (docs/explosion-assets.lock.json); scale multiplies the module's own metres. This table is what a later
// FX-package section replaces.
export const EXPLOSION_MODULES = Object.freeze(['rotary-pop', 'bofors-burst', 'howitzer-blast', 'orbital-strike']);

export const EXPLOSION_USES = Object.freeze({
  // radii from the owner's brief (a cell is 10 m), doubled in the seat, then half again for effect (owner, 2026-09-14)
  'gunship.rotary': Object.freeze({ module: 'rotary-pop', scale: 1.65 }),    // 25 mm: 4.5 m module, ~7.5 m, 0.4 s
  'gunship.bofors': Object.freeze({ module: 'bofors-burst', scale: 1.35 }),  // 40 mm: 11 m module, ~15 m, 1.2 s
  'gunship.heavy': Object.freeze({ module: 'howitzer-blast', scale: 1.41 }), // 105 mm: 32 m module, ~45 m, 3 s
  'tank.shell': Object.freeze({ module: 'bofors-burst', scale: 0.405 }),     // ~4.5 m, the Bofors' ratio kept
  'quiver.talon': Object.freeze({ module: 'bofors-burst', scale: 0.54 }),    // ~6 m, the Bofors' ratio kept
  'strike.orbital': Object.freeze({ module: 'orbital-strike', scale: 1.5 }), // 135 m, 10 s
  // THE ORBITAL LASER (owner, 2026-09-15): the touchdown of a lay is the orbital strike's cloud, and the contact
  // point sheds rotary pops at LASER_CONTACT_RATE per second while it burns, so a line drawn across the ground is a
  // line of small blasts with one big one where the beam came down.
  // 0.18, not the half size first written: the strike's own 1.5 is 135 m, so a half-size cloud is 45 m across a
  // 6 m footprint — wide enough to swallow the lab's ground camera, which stands 28 m back (browser round, Task 7).
  // 0.18 is ~16 m: still twice the footprint, and the column and the burning ground stay visible through it.
  'laser.ignite': Object.freeze({ module: 'orbital-strike', scale: 0.18 }),
  // 1.3, not 0.6 (owner, 2026-09-15: "more explosion or smoke where it hits"): ~6 m, the footprint's own radius
  'laser.contact': Object.freeze({ module: 'rotary-pop', scale: 1.3 }),
  // the burning ground's fire and smoke, LASER_SMOKE_RATE per second: a Bofors burst at ~6 m and 1.2 s, so the line the
  // beam draws smokes behind it
  'laser.smoke': Object.freeze({ module: 'bofors-burst', scale: 0.55 }),
});

// THE IMPACT SCARES (owner, 2026-09-14): bodies within `cells` of a landing freeze for SCARE_FREEZE_S, then turn from it
// and take exits leading away until `seconds` after the impact, then resume for the heart. A player can herd a swarm
// into one place with small rounds before the big hit.
export const EXPLOSION_SCARE = Object.freeze({
  'gunship.rotary': Object.freeze({ cells: 2, seconds: 1.2 }),
  'gunship.bofors': Object.freeze({ cells: 3, seconds: 1.8 }),
  'gunship.heavy': Object.freeze({ cells: 6, seconds: 2.5 }),
  'tank.shell': Object.freeze({ cells: 2, seconds: 1.2 }),
  'quiver.talon': Object.freeze({ cells: 2.5, seconds: 1.5 }),
  'strike.orbital': Object.freeze({ cells: 12, seconds: 3 }),
  'laser.ignite': Object.freeze({ cells: 8, seconds: 2 }),
  'laser.contact': Object.freeze({ cells: 3, seconds: 0.6 }),
  'laser.smoke': Object.freeze({ cells: 2, seconds: 0.8 }),
});
export const SCARE_FREEZE_S = 0.35;

// ordered by brightness; the lab's defaults
export const EXPLOSION_PALETTE = Object.freeze({
  white: '#fff5e1', hot: '#ffd04a', warm: '#ff8420', ember: '#c4300c', smoke: '#8e8983', soot: '#35312d',
});

// live explosions per size; at the cap the oldest of that size ends first
export const EXPLOSION_CAPS = Object.freeze({ small: 20, medium: 4, large: 2, nuclear: 1 });
