// THE PAINT SHOP (src/content/dyes.js, src/domain/dyes.js): a card over the paused game when the hull parks on the bays' purple pad
// (src/fx/paint-pad.js). Isao's two lines, then the palettes, every one open (2026-10-03: the belt dyes and their break-between-sectors
// card are retired); a swatch paints the hull at once, shown on a turntable in the screen (2026-10-03), and DONE closes it. Also the paint
// itself: applyLivery recolours the hull's two named surfaces, cloning each material once so a shared cached hull is never touched.
import * as THREE from '../../vendor/three.module.js';
import { DecalGeometry } from '../../vendor/DecalGeometry.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';
import { createAppearance, browserTexture } from '../../assets/models/livery/runtime.js';
import { PALETTES, PALETTE_BY_ID, LIVERY_LOOKS, LIVERY_IDS, ACCENT, DYE_SHOP } from '../content/dyes.js';
import { paint } from '../domain/dyes.js';
import { createLiveryPreview } from './livery-preview.js';

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

// THE MARKS ON THE ARMOUR, NOT OVER IT (owner, 2026-10-03: Bunny Overdrive and Field Notes "display poorly, some parts are hovering too
// high"). The runtime builds its decals in world units, with a projection box and a lift off the surface written for a hull in metres
// (a 1.35 m box, a 4 mm lift). On the planet a metre is ~0.008 units, so the box spanned ~170 m and the lift was ~0.5 m: every look's
// marks floated over the hull, plainest on the bright ones. MetreDecal scales the box into world units; settleDecals takes the extra
// lift back out once the decals exist. The runtime is the pinned upstream file and stays untouched. Metres per unit come from the
// decal parents' world scale: nothing between them and the asset's ROOT is scaled.
const LIFT = 0.004;   // the runtime's lift along each decal normal (assets/models/livery/runtime.js buildDecals), world units
const worldScale = (o) => o.getWorldScale(new THREE.Vector3()).x;
const rigOf = (o) => { while (o && o.name !== 'HULL_SUSPENSION') o = o.parent; return o; };
export class MetreDecal extends DecalGeometry {
  constructor(mesh, position, orientation, size) { const rig = rigOf(mesh); super(mesh, position, orientation, rig ? size.clone().multiplyScalar(worldScale(rig)) : size); }
}
export function settleDecals(ctx) {
  for (const o of ctx.decalMeshes) {
    const k = worldScale(o.parent), drop = LIFT / k - LIFT, p = o.geometry.attributes.position, n = o.geometry.attributes.normal;
    if (!(Math.abs(drop) > 1e-9)) continue;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) - n.getX(i) * drop, p.getY(i) - n.getY(i) * drop, p.getZ(i) - n.getZ(i) * drop);
    p.needsUpdate = true; o.geometry.computeBoundingSphere(); o.geometry.computeBoundingBox();
  }
}

// paint `root` (the player's hull) as the book says; resolves to the number of painted meshes (0 without a hull or a DOM)
export async function applyLivery(root, book) {
  if (!root || typeof document === 'undefined') return 0;
  const id = book?.palette ?? 'factory', stripes = PALETTE_BY_ID[id]?.stripes ? PALETTE_BY_ID[id] : null;
  let ctx = contexts.get(root);
  if (!ctx) { ctx = createAppearance(THREE, root, { lod: 1, damage: 0, DecalGeometry: MetreDecal, mergeGeometries,
    textureFactory: (svg, options) => browserTexture(THREE, ctx.stripes && (options?.key === 'primary' || options?.key === 'secondary') ? HAZARD(ctx.stripes.armour, ctx.stripes.edge) : svg, options) }); contexts.set(root, ctx); }
  ctx.stripes = stripes;
  try { if (await ctx.apply(await recipeFor(id))) settleDecals(ctx); } catch (e) { console.warn('LIVERY failed', id, e); return 0; }
  let n = 0; root.traverse((o) => { if (o.isMesh && o.material?.userData?.paint_role) n++; });
  return n;
}

// the hull's livery context goes (its clones and textures), as when the turntable's hull is put away
export function releaseLivery(root) { const ctx = contexts.get(root); if (ctx) { ctx.dispose(); contexts.delete(root); } }

// THE SCREEN (owner, 2026-10-03: "the modal becomes a larger screen, like the Unit View, to display the skins and colors"): Isao's lines,
// the hull on a turntable (src/fx/livery-preview.js) and the looks and paints beside it; a swatch paints the turntable and the hull outside.
// host: { root (DOM parent), book, save(book), hull() (the player's hull root), lines: [two strings], onClose(), title }
export function openPaintShop({ root, book, save, hull, lines, onClose, title = DYE_SHOP.title }) {
  const el = document.createElement('div');
  el.id = 'paint-shop';
  const sw = (id, a, e, label, look = false) => `<button type="button" data-dye="${id}" class="ps-sw ps-pal${look ? ' ps-look' : ''}" title="${label}" style="--c:${a};--e:${e}"><i></i><span>${label}</span></button>`;
  const labels = new Map([['factory', 'FACTORY'], ...LIVERY_LOOKS.map((l) => [l.id, l.label]), ...PALETTES.map((p) => [p.id, p.label])]);
  el.innerHTML = `<div class="ps-card"><header>${title}</header><p>${lines.map((l) => `<span>${l}</span>`).join('')}</p><div class="ps-body"><div class="ps-stand"><canvas></canvas><div class="ps-name"></div></div><div class="ps-pick"><div class="ps-row"><div class="ps-slot">LOOKS</div><div class="ps-sws">${sw('factory', '#2b3a44', '#4d5a63', 'FACTORY', true)}${LIVERY_LOOKS.map((l) => sw(l.id, l.swatch[0], l.swatch[1], l.label, true)).join('')}</div></div><div class="ps-row"><div class="ps-slot">PAINT</div><div class="ps-sws">${PALETTES.map((p) => sw(p.id, p.armour, p.edge, p.label)).join('')}</div></div></div></div><footer><span>DRAG TO TURN</span><button type="button" data-done>DONE</button></footer></div>`;
  const draw = () => {
    for (const b of el.querySelectorAll('[data-dye]')) b.classList.toggle('on', b.dataset.dye === (book.palette ?? 'factory'));
    el.querySelector('.ps-name').textContent = labels.get(book.palette ?? 'factory') ?? '';
  };
  draw();
  let open = true, stand = null;
  el.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.done !== undefined) { close(); return; }
    if (b.dataset.dye && paint(book, b.dataset.dye, LIVERY_IDS)) { applyLivery(hull(), book); stand?.paint(book); save(book); draw(); }
  });
  root.append(el);
  // the turntable's hull is the live one cloned in the factory paint (the clone keeps none of the paint), then both take the book's paint
  const live = hull();
  if (live) applyLivery(live, { palette: 'factory' }).then(() => {
    if (!open) return;
    try { stand = createLiveryPreview(el.querySelector('.ps-stand canvas'), live, { paint: applyLivery, release: releaseLivery }); } catch (e) { console.warn('PAINT stand failed', e); }
    stand?.paint(book); applyLivery(live, book);
  });
  function close() { if (!open) return; open = false; stand?.dispose(); stand = null; el.remove(); onClose?.(); }
  return { close, isOpen: () => open, element: el, stand: () => stand };
}
