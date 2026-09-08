// Historical numerical fixtures for integrator regression tests. Not a runtime roster.
export const WEAPONS = {
  // `maxTime` and `step` are the INTEGRATOR's allowance, per weapon, and the
  // mortar is why they are here: a lobbed round at 79 degrees is in the air
  // for half a minute, so a six-second allowance never reaches the target and
  // the high branch simply does not exist as far as the solver is concerned.
  // A slow round also does not need a 4 ms tick to be accurate.
  lancer: { id: 'lancer', label: 'Lancer', muzzleVel: 700, gravity: 9.81, drag: 0.0009,
    cooldown: 0.0, splash: 0, charge: 0, hitscan: false, loft: false, sound: 'tank_main',
    maxTime: 6, step: 0.004 },
  laser: { id: 'laser', label: 'Laser', muzzleVel: 700, gravity: 9.81, drag: 0.0009,
    cooldown: 0.35, splash: 0, charge: 0, hitscan: true, loft: false, sound: 'tank_beam',
    maxTime: 6, step: 0.004 },
  mortar: { id: 'mortar', label: 'Mortar', muzzleVel: 150, gravity: 9.81, drag: 0.0004,
    cooldown: 2.2, splash: 14, charge: 0, hitscan: false, loft: true, sound: 'blast_fire',
    maxTime: 60, step: 0.02 },
  railgun: { id: 'railgun', label: 'Rail gun', muzzleVel: 2400, gravity: 9.81, drag: 0.0002,
    cooldown: 1.2, splash: 0, charge: 1.6, hitscan: false, loft: false, sound: 'tank_secondary',
    maxTime: 6, step: 0.002 },
};
// THE JAVELIN. Its physics are not here — a homing round is `lockon.js`,
// with its own integrator and its own guidance — but it lives in this table
// because it is a weapon the picker has to offer and the HUD has to name.
// The ballistic fields are what the panel shows and what the shell falls
// back to if the flight ever asks this module a question; the flight does
// not, and `solution()` says so rather than printing a hold for a round
// that ignores it.
WEAPONS.javelin = {
  id: 'javelin', label: 'Javelin', muzzleVel: 40, gravity: 9.81, drag: 0.0016,
  cooldown: 3.2, splash: 6, charge: 0, hitscan: false, loft: false,
  homing: true, lock: true, sound: 'tank_secondary', maxTime: 30, step: 0.008,
};

export const WEAPON_IDS = Object.keys(WEAPONS);

// Fold a weapon's numbers onto a tune. The tune keeps everything the weapon
// does not own — the wind, the sway, the zero, the plate — so switching
// weapons changes the ROUND and nothing else about the range.
export function applyWeapon(tune, id) {
  const w = WEAPONS[id] || WEAPONS.lancer;
  for (const k of ['muzzleVel', 'gravity', 'drag', 'maxTime', 'step']) tune[k] = w[k];
  return w;
}
