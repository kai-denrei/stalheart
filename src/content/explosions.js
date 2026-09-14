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
});
export const SCARE_FREEZE_S = 0.35;

// ordered by brightness; the lab's defaults
export const EXPLOSION_PALETTE = Object.freeze({
  white: '#fff5e1', hot: '#ffd04a', warm: '#ff8420', ember: '#c4300c', smoke: '#8e8983', soot: '#35312d',
});

// live explosions per size; at the cap the oldest of that size ends first
export const EXPLOSION_CAPS = Object.freeze({ small: 20, medium: 4, large: 2, nuclear: 1 });
