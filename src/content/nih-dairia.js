// Origin: lab-creatures f2a4f89 (kai-denrei, export of 2026-10-08; see src/fx/nih-dairia/LICENSE). The motion is the OWNER'S
// preset, tuned in the boss lab and pasted on 2026-10-08 ("slower creature by default": speed 0.1, a ten-times reach, the
// arms stretched and spread wide); the export's own defaults were speed 1.8, reachTime 2.4, stretch 2.2, spread 1.6.
// Nih-Dairia: the soft-body creature's preset, size, look and model URLs.
export const NIH_DAIRIA_MOTION = Object.freeze({
  speed: 0.1, reachTime: 10, pullTime: 2, pauseTime: 1.25, erratic: 2, stretch: 5, spread: 3.5,
  stepHeight: 0.032, stepDuration: 0.12, stepSpacing: 0.035, stride: 0.022, recoil: 1,
  grip: 1.5, sweep: 1,
});
// The bait mode's predator (docs/superpowers/specs/2026-10-09-boss-bait-arena-and-feel-design.md, item 4; the owner judges the feel): the
// slower preset above made dangerous, loaded when the lab enters bait mode (tank mode keeps the slower one; the panel's knobs tune either
// live). Chase speed 0.22 (0.1), surge duration 3 (2), the pause between bursts 0.8 (1.25), the arms' spread 4.5 (3.5) and the erratic
// motion 3 (2) a step up; the stretch stays 5, the panel's maximum (src/fx/nih-dairia/motion-settings.js MOTION_CONTROLS)
export const NIH_DAIRIA_PREDATOR = Object.freeze({
  ...NIH_DAIRIA_MOTION, speed: 0.22, pullTime: 3, pauseTime: 0.8, erratic: 3, stretch: 5, spread: 4.5,
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
