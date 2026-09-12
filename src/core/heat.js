// Radiative cooling: the hotter the barrels, the faster they shed heat.
export const coolHeat = (heat, dt, { cool, ambient }) => Math.max(0, heat - dt * cool * (ambient + heat));
// Red to white hot: an emissive colour and intensity for a heat in 0..1+.
export function heatGlow(heat) {
  const h = Math.max(0, Math.min(1.2, heat));
  if (h < 0.25) return { rgb: [0.3 * h / 0.25, 0, 0], intensity: 0.6 * h / 0.25 };          // first dull red
  if (h < 0.7) { const t = (h - 0.25) / 0.45; return { rgb: [0.3 + 0.7 * t, 0.12 * t, 0], intensity: 0.6 + 1.2 * t }; }   // red to orange
  const t = Math.min(1, (h - 0.7) / 0.3); return { rgb: [1, 0.12 + 0.7 * t, 0.55 * t], intensity: 1.8 + 1.2 * t };   // orange to white hot
}
