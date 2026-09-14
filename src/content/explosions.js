// Which explosion lands where, as data. The modules are the owner's lab, pinned in src/fx/explosions/
// (docs/explosion-assets.lock.json); scale multiplies the module's own metres. This table is what a later
// FX-package section replaces.
export const EXPLOSION_MODULES = Object.freeze(['rotary-pop', 'bofors-burst', 'howitzer-blast', 'orbital-strike']);

export const EXPLOSION_USES = Object.freeze({
  // radii from the owner's brief (a cell is 10 m), then doubled in the seat: the rotary a cell across, the Bofors two, the 105 about six
  'gunship.rotary': Object.freeze({ module: 'rotary-pop', scale: 1.1 }),     // 25 mm: 4.5 m module, ~5 m, 0.4 s
  'gunship.bofors': Object.freeze({ module: 'bofors-burst', scale: 0.9 }),   // 40 mm: 11 m module, ~10 m, 1.2 s
  'gunship.heavy': Object.freeze({ module: 'howitzer-blast', scale: 0.94 }), // 105 mm: 32 m module, ~30 m, 3 s
  'tank.shell': Object.freeze({ module: 'bofors-burst', scale: 0.27 }),      // ~3 m, the Bofors' ratio kept
  'quiver.talon': Object.freeze({ module: 'bofors-burst', scale: 0.36 }),    // ~4 m, the Bofors' ratio kept
  'strike.orbital': Object.freeze({ module: 'orbital-strike', scale: 1 }),   // 90 m, 10 s
});

// ordered by brightness; the lab's defaults
export const EXPLOSION_PALETTE = Object.freeze({
  white: '#fff5e1', hot: '#ffd04a', warm: '#ff8420', ember: '#c4300c', smoke: '#8e8983', soot: '#35312d',
});

// live explosions per size; at the cap the oldest of that size ends first
export const EXPLOSION_CAPS = Object.freeze({ small: 20, medium: 4, large: 2, nuclear: 1 });
