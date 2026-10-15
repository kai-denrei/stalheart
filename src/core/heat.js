// Radiative cooling: the hotter the barrels, the faster they shed heat.
export const coolHeat = (heat, dt, { cool, ambient }) => Math.max(0, heat - dt * cool * (ambient + heat));
// Red, redder, blazing red: an emissive colour and intensity for a heat in 0..1+ (owner, 2026-10-15: "the Rotor overheating should
// display as red"; it used to run on to white hot, which read as anything but hot)
export function heatGlow(heat) {
  const h = Math.max(0, Math.min(1.2, heat));
  if (h < 0.25) return { rgb: [0.3 * h / 0.25, 0, 0], intensity: 0.6 * h / 0.25 };          // first dull red
  if (h < 0.7) { const t = (h - 0.25) / 0.45; return { rgb: [0.3 + 0.7 * t, 0.05 * t, 0], intensity: 0.6 + 1.2 * t }; }   // to a full red
  const t = Math.min(1, (h - 0.7) / 0.3); return { rgb: [1, 0.05 + 0.08 * t, 0.04 * t], intensity: 1.8 + 1.6 * t };   // blazing red at the overheat
}
