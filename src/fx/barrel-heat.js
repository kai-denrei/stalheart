// Paints a sentry's barrels with its heat. The Rotor's barrels are the
// 'Edge' meshes under its ROTOR pivot; their materials are cloned once per
// model so one hot mount never tints another.
import { heatGlow } from '../core/heat.js';
export function paintBarrelHeat(obj, heat) {
  const mats = obj.userData.heatMats ??= (() => { const out = []; obj.getObjectByName('ROTOR')?.traverse((o) => { if (o.isMesh && o.material && (o.material.name === 'Edge' || /barrel/i.test(o.name))) { o.material = o.material.clone(); out.push(o.material); } }); return out; })();
  if (!mats.length) return;
  const { rgb, intensity } = heatGlow(heat);
  for (const m of mats) { if (!m.emissive) continue; m.emissive.setRGB(rgb[0] * intensity, rgb[1] * intensity, rgb[2] * intensity); m.emissiveIntensity = 1; }
}
