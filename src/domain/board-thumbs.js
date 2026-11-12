// THE BUILD BOARD'S THUMBNAILS, the rules (owner, 2026-11-05, round 7 note 4: "the build board gets small wireframe thumbnails like the
// glossary's"; the page's half src/fx/board-thumbs.js). What each card draws and how big:
//   thumbSource(offer) -> { draw, ... } the picture a card asks for: 'structure' the bestiary model of its step (`step`), 'sentry' the sentry's
//     own look (`key`, tier 0), 'upgrade' the look of the sentry it upgrades one tier up (`ci`), 'pet' the companion's model (`index`),
//     'repair' and 'spare' the hull, 'shield' a drawn dome; null for a kind it does not know (the card keeps its empty frame)
//   thumbKey(source) -> the sprite cache's key for a source once its sentry is resolved (`look`, `key`, `tier`): 'bb-<draw>-<what>', one render a
//     session per picture (a sentry's key carries its look and tier, so an upgraded sentry's next card is drawn again)
//   fitScale(size, frame) -> the scale that brings a box of `size` { x, y, z } to `frame` units on its largest side (0 for an empty box)
export function thumbSource(offer) {
  switch (offer?.kind) {
    case 'structure': return { draw: 'structure', step: offer.step };
    case 'sentry': return { draw: 'tower', key: offer.key, up: 0 };
    case 'upgrade': return { draw: 'tower', ci: offer.ci, up: 1 };
    case 'pet': return { draw: 'pet', index: offer.index };
    case 'repair': case 'spare': return { draw: 'hull' };
    case 'shield': return { draw: 'dome' };
    case 'dome': return { draw: 'kind', kind: offer.dome };   // a colony card: its kind's dome (2026-11-12 night)
    default: return null;
  }
}

export function thumbKey(src) {
  if (src.draw === 'structure') return `bb-structure-${src.step}`;
  if (src.draw === 'tower') return `bb-tower-${src.look}-${src.key}-${src.tier}`;
  if (src.draw === 'pet') return `bb-pet-${src.index}`;
  if (src.draw === 'kind') return `bb-kind-${src.kind}`;
  return `bb-${src.draw}`;
}

export function fitScale(size, frame = 1) {
  const m = Math.max(size?.x || 0, size?.y || 0, size?.z || 0);
  return m > 0 && Number.isFinite(m) ? frame / m : 0;
}
