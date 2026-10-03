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

// THE HULL GETS UNSTUCK (owner, 2026-10-02; src/domain/hull-stuck.js): after `after` seconds of driving that moves the hull less than
// `share` of the drive, it is eased toward its cell's centre, the ease rising over `ramp` seconds to `rate` cells a second
export const HULL_STUCK = Object.freeze({ after: 0.25, ramp: 0.35, share: 0.3, rate: 2.4 });   // sooner and firmer (owner, 2026-10-02: "still too easy to get stuck in small corridors"; was 0.45 / 0.6 / 0.15 / 1.4)

// THE PLASMA COSTS BIOMASS (owner, 2026-10-02: "using the plasma throwers on the tank costs some biomass"): kilograms a second while
// the twin plasma fires in the story; with nothing in the bank the trigger is dry and the panel says so (once every few seconds)
export const TANK_PLASMA = Object.freeze({ kgPerSecond: 3, dry: '<div class="wave-num">PLASMA DRY</div><div class="wave-role">no biomass to burn</div>' });

// A WALL IS FRICTION, NOT A THUD (owner, 2026-10-03: "bumping into walls with the tank feels wrong… repeated jagged staccato movements,
// which loses the feeling of weight and mass"). A head-on hit used to fire the run-over thud: a 65% drag, a camera dip and the run-up
// wiped, then the run-up rebuilt into the same wall, again and again. Now the into-wall share of each step bleeds the run-up at `scrub`
// per second and turns the heading toward the slide at `align` per second, so the hull scrapes along and comes round parallel. Against a
// building (no rock cell to slide off) the step is tried `glance` radians either side.
// `width`: the flank probes' distance off the centre line as a share of the nose's (owner, 2026-10-03: "Mork still clips on some walls too easily");
// 0 turns them off: the next playtest found the handling worse ("unnatural staccato bumping ... it got worse in the last updates")
export const TANK_WALL = Object.freeze({ scrub: 2.5, align: 3.5, glance: Object.freeze([0.5, -0.5, 1.0, -1.0]), width: 0 });
