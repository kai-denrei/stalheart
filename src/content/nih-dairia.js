// Nih-Dairia: the soft-body creature's preset, size, look and model URLs.
// The twelve base motion values are the owner's tuned preset. grip and sweep
// are in the export's motion-settings.json; they equal the kit's DEFAULT_MOTION (grip 1.5, sweep 1).
export const NIH_DAIRIA_MOTION = Object.freeze({
  speed: 3, reachTime: 4, pullTime: 2, pauseTime: 2.7, erratic: 3, stretch: 2.5, spread: 3,
  stepHeight: 0.05, stepDuration: 0.08, stepSpacing: 0.015, stride: 0.05, recoil: 1,
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
