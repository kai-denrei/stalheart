// Shared firing presentation timing. Rotor subdivisions preserve total damage per second.
export const FIRING = Object.freeze({
  rotor:Object.freeze({duration:4,rounds:6,spinUp:.25,ready:'minigun_ready',stop:'minigun_ready'}),
  plasma:Object.freeze({duration:4,beamHold:.3,loop:true}),
  lancer:Object.freeze({duration:3,beamHold:3,loop:true}),
});
export const firingFor=key=>FIRING[key] || {duration:0};
