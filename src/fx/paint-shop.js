// THE PAINT SHOP (src/content/dyes.js, src/domain/dyes.js): a card over the paused game when the hull parks on the bays' purple pad
// (src/fx/paint-pad.js). Isao's two lines, then the palettes, every one open (2026-10-03: the belt dyes and their break-between-sectors
// card are retired); a swatch paints the hull at once, so the hull behind the card is the preview, and DONE closes it. Also the paint
// itself: applyLivery recolours the hull's two named surfaces, cloning each material once so a shared cached hull is never touched.
import * as THREE from '../../vendor/three.module.js';
import { DecalGeometry } from '../../vendor/DecalGeometry.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { createAppearance, browserTexture } from '../../assets/models/livery/runtime.js';
import { PALETTES, PALETTE_BY_ID, LIVERY_LOOKS, LIVERY_IDS, ACCENT, DYE_SHOP } from '../content/dyes.js';
import { paint } from '../domain/dyes.js';

// THE PAINT IS THE A6 LIVERY RUNTIME (2026-10-03): one appearance context per hull root, a recipe per choice. A look is the upstream preset
// file; a palette is a plain recipe of its two paints; the factory paint is the upstream factory preset. HAZARD's stripes: the recipe asks
// for its pattern textures (a trace of wear does that) and the texture factory hands it diagonal black-and-yellow bands instead.
const presets = new Map(), contexts = new WeakMap();
const preset = (id) => { if (!presets.has(id)) presets.set(id, fetch(`assets/models/livery/presets/${id}.json`).then((r) => r.json())); return presets.get(id); };
const HAZARD = (a, b) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="${b}"/><g fill="${a}">${[-256, -128, 0, 128, 256].map((x) => `<polygon points="${x},256 ${x + 64},256 ${x + 320},0 ${x + 256},0"/>`).join('')}</g></svg>`;
async function recipeFor(id) {
  if (id === 'factory' || LIVERY_LOOKS.some((l) => l.id === id)) return preset(id);
  const p = PALETTE_BY_ID[id]; if (!p) return preset('factory');
  return { schema_version: 1, asset_family: 'mork_hover_tank', preset_id: p.id, label: p.label, paint: { primary: p.armour, secondary: p.edge, accent: ACCENT }, pattern: 'solid', finish: 'satin',
    wear: p.stripes ? 0.02 : 0, name: 'MORK', number: '01', message: '', decals: ['turret', 'badge', 'message'].map((zone) => ({ zone, symbol: 'none', scale: 1, rotation: 0 })) };
}

// paint `root` (the player's hull) as the book says; resolves to the number of painted meshes (0 without a hull or a DOM)
export async function applyLivery(root, book) {
  if (!root || typeof document === 'undefined') return 0;
  const id = book?.palette ?? 'factory', stripes = PALETTE_BY_ID[id]?.stripes ? PALETTE_BY_ID[id] : null;
  let ctx = contexts.get(root);
  if (!ctx) { ctx = createAppearance(THREE, root, { lod: 1, damage: 0, DecalGeometry, mergeGeometries,
    textureFactory: (svg, options) => browserTexture(THREE, ctx.stripes && (options?.key === 'primary' || options?.key === 'secondary') ? HAZARD(ctx.stripes.armour, ctx.stripes.edge) : svg, options) }); contexts.set(root, ctx); }
  ctx.stripes = stripes;
  try { await ctx.apply(await recipeFor(id)); } catch (e) { console.warn('LIVERY failed', id, e); return 0; }
  let n = 0; root.traverse((o) => { if (o.isMesh && o.material?.userData?.paint_role) n++; });
  return n;
}

// host: { root (DOM parent), book, save(book), hull() (the player's hull root), lines: [two strings], onClose(), title }
export function openPaintShop({ root, book, save, hull, lines, onClose, title = DYE_SHOP.title }) {
  const el = document.createElement('div');
  el.id = 'paint-shop';
  const sw = (id, a, e, label, look = false) => `<button type="button" data-dye="${id}" class="ps-sw ps-pal${look ? ' ps-look' : ''}${book.palette === id ? ' on' : ''}" title="${label}" style="--c:${a};--e:${e}"><i></i><span>${label}</span></button>`;
  const draw = () => {
    el.innerHTML = `<div class="ps-card"><header>${title}</header><p>${lines.map((l) => `<span>${l}</span>`).join('')}</p><div class="ps-row"><div class="ps-slot">LOOKS</div><div class="ps-sws">${sw('factory', '#2b3a44', '#4d5a63', 'FACTORY', true)}${LIVERY_LOOKS.map((l) => sw(l.id, l.swatch[0], l.swatch[1], l.label, true)).join('')}</div></div><div class="ps-row"><div class="ps-slot">PAINT</div><div class="ps-sws">${PALETTES.map((p) => sw(p.id, p.armour, p.edge, p.label)).join('')}</div></div><footer><button type="button" data-done>DONE</button></footer></div>`;
  };
  draw();
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.done !== undefined) { close(); return; }
    if (b.dataset.dye && paint(book, b.dataset.dye, LIVERY_IDS)) { applyLivery(hull(), book); save(book); draw(); }
  });
  root.append(el);
  let open = true;
  function close() { if (!open) return; open = false; el.remove(); onClose?.(); }
  return { close, isOpen: () => open, element: el };
}
