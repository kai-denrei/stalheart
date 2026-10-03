// THE PAINT SHOP (src/content/dyes.js, src/domain/dyes.js). A card over the paused game at the break between sectors, when Isao has
// extracted a dye the player has not been offered: his two lines, then a row of swatches per paintable surface (the factory paint and
// every dye extracted; the locked ones dim, with how many more of that belt it takes). A swatch paints the hull at once, so the hull in
// the background is the preview. DONE closes it and the sector goes on. Also the paint itself: applyLivery recolours the hull's named
// surfaces, cloning each material once so a shared cached hull is never touched.
import { DYES, DYE_BY_ID, DYE_SLOTS, DYE_SHOP } from '../content/dyes.js';
import { paint, progress } from '../domain/dyes.js';

// recolour `root`'s named surfaces from a livery { armour, edge } of dye ids ('factory' restores the model's own colour)
export function applyLivery(root, livery) {
  if (!root) return 0;
  let n = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m, i) => {
      const slot = DYE_SLOTS.find((s) => m?.name === s.material); if (!slot) return;
      let mat = m;
      if (!m.userData.livery) { mat = m.clone(); mat.userData.livery = true; mat.userData.factory = m.color.getHex(); if (Array.isArray(o.material)) o.material[i] = mat; else o.material = mat; }
      const id = livery?.[slot.id] ?? 'factory';
      mat.color.set(id === 'factory' ? mat.userData.factory : DYE_BY_ID[id]?.paint ?? mat.userData.factory);
      n++;
    });
  });
  return n;
}

// host: { root (DOM parent), book, save(book), hull() (the player's hull root), lines: [two strings], onClose() }
export function openPaintShop({ root, book, save, hull, lines, onClose, title = DYE_SHOP.title }) {
  const el = document.createElement('div');
  el.id = 'paint-shop';
  const row = (slot) => {
    const p = progress(book, DYES);
    const sw = (id, color, label, locked = false, note = '') => `<button type="button" data-slot="${slot.id}" data-dye="${id}" class="ps-sw${book.livery[slot.id] === id ? ' on' : ''}${locked ? ' locked' : ''}" ${locked ? 'disabled' : ''} title="${label}${note}" style="--c:${color}"><i></i><span>${locked ? note : label}</span></button>`;
    return `<div class="ps-row"><div class="ps-slot">${slot.label}</div><div class="ps-sws">${sw('factory', '#2b3a44', 'FACTORY')}${DYES.map((d) => { const q = p.find((x) => x.id === d.id); return sw(d.id, d.paint, d.label, !q.unlocked, q.unlocked ? '' : `${q.need - q.have} MORE`); }).join('')}</div></div>`;
  };
  const draw = () => {
    el.innerHTML = `<div class="ps-card"><header>${title}</header><p>${lines.map((l) => `<span>${l}</span>`).join('')}</p>${DYE_SLOTS.map(row).join('')}<footer><button type="button" data-done>DONE</button></footer></div>`;
  };
  draw();
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.done !== undefined) { close(); return; }
    if (b.dataset.dye && paint(book, b.dataset.slot, b.dataset.dye)) { applyLivery(hull(), book.livery); save(book); draw(); }
  });
  root.append(el);
  let open = true;
  function close() { if (!open) return; open = false; el.remove(); onClose?.(); }
  return { close, isOpen: () => open, element: el };
}
