// THE PAINT SHOP (src/content/dyes.js, src/domain/dyes.js): a card over the paused game when the hull parks on the bays' purple pad
// (src/fx/paint-pad.js). Isao's two lines, then the palettes, every one open (2026-10-03: the belt dyes and their break-between-sectors
// card are retired); a swatch paints the hull at once, so the hull behind the card is the preview, and DONE closes it. Also the paint
// itself: applyLivery recolours the hull's two named surfaces, cloning each material once so a shared cached hull is never touched.
import { PALETTES, PALETTE_BY_ID, DYE_SLOTS, DYE_SHOP } from '../content/dyes.js';
import { paint } from '../domain/dyes.js';

// recolour `root`'s named surfaces from a book's palette ('factory' restores the model's own colours)
export function applyLivery(root, book) {
  if (!root) return 0;
  const pal = PALETTE_BY_ID[book?.palette];
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      const slot = DYE_SLOTS.find((s) => m?.name === s.material); if (!slot) return;
      let mat = m;
      if (!m.userData.livery) { mat = m.clone(); mat.userData.livery = true; mat.userData.factory = m.color.getHex(); if (Array.isArray(o.material)) o.material[i] = mat; else o.material = mat; }
      mat.color.set(pal ? pal[slot.id] : mat.userData.factory);
      n++;
    });
  });
  return n;
}

// host: { root (DOM parent), book, save(book), hull() (the player's hull root), lines: [two strings], onClose(), title }
export function openPaintShop({ root, book, save, hull, lines, onClose, title = DYE_SHOP.title }) {
  const el = document.createElement('div');
  el.id = 'paint-shop';
  const sw = (id, a, e, label) => `<button type="button" data-dye="${id}" class="ps-sw ps-pal${book.palette === id ? ' on' : ''}" title="${label}" style="--c:${a};--e:${e}"><i></i><span>${label}</span></button>`;
  const draw = () => {
    el.innerHTML = `<div class="ps-card"><header>${title}</header><p>${lines.map((l) => `<span>${l}</span>`).join('')}</p><div class="ps-row"><div class="ps-sws">${sw('factory', '#2b3a44', '#4d5a63', 'FACTORY')}${PALETTES.map((p) => sw(p.id, p.armour, p.edge, p.label)).join('')}</div></div><footer><button type="button" data-done>DONE</button></footer></div>`;
  };
  draw();
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.done !== undefined) { close(); return; }
    if (b.dataset.dye && paint(book, b.dataset.dye, PALETTES)) { applyLivery(hull(), book); save(book); draw(); }
  });
  root.append(el);
  let open = true;
  function close() { if (!open) return; open = false; el.remove(); onClose?.(); }
  return { close, isOpen: () => open, element: el };
}
