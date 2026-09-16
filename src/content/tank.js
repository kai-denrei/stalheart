// Default presentation shared by gameplay, fixtures and Workshop stages.
export const DEFAULT_TANK = 'mork';
// the idle turret sweep: the authored Turret_Aim clip swings almost 180 degrees; the hull shows this share of it (owner: 90)
export const TURRET_SWEEP = 0.5;
// the main gun's shell, in cells per second (owner: 3.4 was much too slow) and how far it flies
export const SHELL_SPEED = 9, SHELL_REACH = 12;
// the hull's forward pace on top of the game's speed (operator, 2026-09-13: faster from the first moment, and ramping for a while so a
// long drive stops being tedious): base at once, toward top with time constant tau (s); steering hard gains `turn` s/s less, idling or
// reversing bleeds `stop` s/s, and a wall keeps `keep` of the run-up on a head-on hit (a graze keeps more)
export const TANK_DRIVE = Object.freeze({ base: 1.35, top: 2.6, tau: 4, turn: 0.6, stop: 3, keep: 0.25 });
// the hull's steering (owner, 2026-09-16: "the tank turns too sharply = unnatural"): `rate` is the top yaw rate in rad/s — the pace
// the tank always turned at — now taken up over `attack` seconds and released over `release` instead of switching on and off with the
// key, and `bank` is how far the hull rolls into the turn at that full rate, in radians. Not a slower tank: the same rate, eased.
export const TANK_STEER = Object.freeze({ rate: 2.6, attack: 0.28, release: 0.16, bank: 0.1 });
