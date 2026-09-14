// THE BASE RUNS WARM IN THERMAL (owner, 2026-09-14): the gunship's FLIR view maps brightness onto the ironbow ramp, so
// heat is drawn as brightness. While thermal is on, every part of the base is pushed toward white, the Stalheart, the
// foundry, the assembly line and Isao further (yellow-white), the rest part way (orange). Turning it off restores each
// material's own colour and glow. Materials are shared between clones and LOD tiers, so the originals are kept per
// material; parts that load while thermal is on are picked up by a slow re-apply.
import * as THREE from '../../vendor/three.module.js';

export const HEAT = Object.freeze({ warm: 0.55, hot: 1 });
const WHITE = new THREE.Color(1, 1, 1);

// one material toward white by `level` (0..1), remembering where it started
export function heatMaterial(material, level, saved) {
  if (!material || (!material.color && !material.emissive)) return;
  if (!saved.has(material)) saved.set(material, { color: material.color?.clone(), emissive: material.emissive?.clone(), emissiveIntensity: material.emissiveIntensity });
  const o = saved.get(material);
  if (material.emissive) { material.emissive.copy(o.emissive).lerp(WHITE, level); material.emissiveIntensity = Math.max(o.emissiveIntensity ?? 1, level); }
  else material.color.copy(o.color).lerp(WHITE, level);
}

export function restoreMaterial(material, saved) {
  const o = saved.get(material);
  if (!o) return;
  if (o.color && material.color) material.color.copy(o.color);
  if (o.emissive && material.emissive) { material.emissive.copy(o.emissive); material.emissiveIntensity = o.emissiveIntensity; }
  saved.delete(material);
}

// parts(): { warm: Object3D[], hot: Object3D[] }; hot wins where a part is in both
export function createThermalHeat(parts, { every = 1000 } = {}) {
  const saved = new Map();
  let timer = 0;
  const each = (roots, fn) => { for (const r of roots) r?.traverse?.((o) => { for (const m of [].concat(o.material ?? [])) fn(m); }); };
  function apply() {
    const { warm = [], hot = [] } = parts() ?? {};
    each(warm, (m) => heatMaterial(m, HEAT.warm, saved));
    each(hot, (m) => heatMaterial(m, HEAT.hot, saved));
  }
  function set(on) {
    clearInterval(timer); timer = 0;
    if (on) { apply(); timer = setInterval(apply, every); return; }
    for (const m of [...saved.keys()]) restoreMaterial(m, saved);
  }
  return { set, dispose: () => set(false), heated: () => saved.size };
}
