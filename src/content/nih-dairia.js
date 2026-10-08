// Origin: the export's motion-settings.json (version 1) from lab-creatures f2a4f89 (kai-denrei, export of 2026-10-08; GPL-3.0, see src/fx/nih-dairia/LICENSE).
// Nih-Dairia: the soft-body creature's preset, size, look and model URLs.
export const NIH_DAIRIA_MOTION = Object.freeze({
  speed: 1.8, reachTime: 2.4, pullTime: 2, pauseTime: 1.25, erratic: 2, stretch: 2.2, spread: 1.6,
  stepHeight: 0.032, stepDuration: 0.12, stepSpacing: 0.035, stride: 0.022, recoil: 1,
  grip: 1.5, sweep: 1,
});
export const NIH_DAIRIA_VARIANT = 'nih-dairia';
export const NIH_DAIRIA_SIZE_METRES = 30;
export const NIH_DAIRIA_LOOK = Object.freeze({
  pale: '#b8b99a', dark: '#374237', roughness: 0.26, metalness: 0, transmission: 0.65, thickness: 0.012, ior: 1.37,
  attenuationColor: '#939b72', attenuationDistance: 0.035, clearcoat: 0.65, clearcoatRoughness: 0.16,
  preyRed: '#c94d38', preyEmissive: '#751e16',
});
const model = (name) => Object.freeze({ bin: `assets/creatures/nih-dairia/${name}.bin`, json: `assets/creatures/nih-dairia/${name}.json` });
export const NIH_DAIRIA_MODELS = Object.freeze({
  'nih-dairia': model('nih-dairia'), brood: model('brood'), reed: model('reed'), crown: model('crown'),
});
