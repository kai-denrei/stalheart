import { SHIELD_ARRAY } from './shield-array.js';
// Default presentation shared by gameplay, fixtures and Workshop stages.
export const DEFAULT_TANK = 'mork';
// the idle turret sweep: the authored Turret_Aim clip swings almost 180 degrees; the hull shows this share of it (owner: 90)
export const TURRET_SWEEP = 0.5;
// the main gun's shell, in cells per second (owner: 3.4 was much too slow) and how far it flies
export const SHELL_SPEED = 9, SHELL_REACH = 12;
// THE SHELL'S BLAST (owner, 2026-10-13: "the tank shell should feel and be more powerful. a) give it a stronger AoE and dmg"; then, the same
// day, replacing b): "make the Tank Shell impact/explosion the same as the 40mm from the Gunship, more intensity, it must feel powerful"). Every
// body within `radius` cells of the impact takes `peak` x (1 - (d / radius)^2), the 40 mm's own falloff (src/domain/gunship.js splashDamage),
// and the body struck takes the full `peak` (src/domain/shell-blast.js): the tank's strongest single hit, short of the Thorus's 5 hp. `radius`
// is the 40 mm's visible burst (its 11 m module at 2.7: ~30 m, 3 cells), so the burst drawn at the radius is the 40 mm's own size and the visual
// is the damage. The landing (src/fx/shell-blast.js) is the 40 mm's: its two shock rings at `rings` [colour, seconds, x radius] (the 40 mm's
// 0.7 s and 0.35 s, held longer), its burst ('tank.blast': the 40 mm's module, hotter and slower, src/content/explosions.js) with a white-hot
// `flash` pop at the core ('tank.flash'), and its report, blast_fire, at `rate` (the 40 mm's 0.7, lower). `kick`: the hull's jolt (src/fx/ram-jolt.js,
// presentation only: a pitch, a roll and a camera dip, no drag) as a body of `metres` radius would give it, for a landing on the hull, fading to
// nothing `cells` away (the shot itself already kicks the hull and the camera at the muzzle: the recoil, td-tab FEEL.recoil).
// Was: 4 to the body struck, 2 within 1 cell, 1 within 2 cells, the 'tank.shell' burst (~4.5 m) and three small rings, blast_fire at 1.
// The reload (3 s) and the rack (9) are unchanged.
export const SHELL_BLAST = Object.freeze({ radius: 3, peak: 4.5, floor: 0.45, rate: 0.6,   /* floor: 0.45 of the peak anywhere inside the radius (owner, 2026-10-16: "the AOE should be more impactful, not just direct hits"); the peak stays short of a Thorus's 5 hp */
  rings: Object.freeze([Object.freeze([0xffb347, 0.95, 1.6]), Object.freeze([0xffffff, 0.5, 0.7])]), flash: true,
  kick: Object.freeze({ metres: 3.5, cells: 8 }) });
// the hull's forward pace on top of the game's speed (operator, 2026-09-13: faster from the first moment, and ramping for a while so a
// long drive stops being tedious): base at once, toward top with time constant tau (s); steering hard gains `turn` s/s less, idling or
// reversing bleeds `stop` s/s, and a wall keeps `keep` of the run-up on a head-on hit (a graze keeps more)
// MORE OF THE PULL (owner, 2026-10-15: "we will increase the hover tank's speed system whereby going forward and not hitting anything increases the
// speed, since there is no friction with the ground. We will display its speed in KM/H in small on the HUD above the RADAR"): top 3.2 (was 2.6)
// reached over tau 6 s (was 4); a wall, a stop or a hard turn still spends it (src/domain/drive-ramp.js). The readout: src/td-tab.js hullSpeed
export const TANK_DRIVE = Object.freeze({ base: 1.35, top: 3.2, tau: 6, turn: 0.6, stop: 3, keep: 0.25 });
// FOUR HITS A HULL (owner, 2026-10-16: "Mork dying to a single hard-core is too punishing, it should be able to get several hits. 4 hits. Ramming a
// hardcore pushes it out of the way and damages the tank"): a hard core's touch dents the armour by one, the hull is lost on the `hits`-th; a killer
// in `whole` (the MK-9's burn) takes the hull in one. A new hull comes out with its armour whole (src/td-tab.js playerHit, hullArmour).
export const HULL_ARMOUR = Object.freeze({ hits: 4, whole: Object.freeze(['laser']) });
// THE HULL MENDS UNDER THE STÅLHEART (owner, 2026-10-18: "when the Mork is damaged, sitting under the Stalheart should repair it, same repair time as
// the shield recharge"; src/domain/hull-repair.js, src/fx/hull-repair.js): a hull parked under the Stålheart's gantry (the box the terminal's console
// uses, src/fx/story-base.js inside) gets a whole armour back in `seconds`, the shield array's recharge (ARRAY 30s, SHIELD_ARRAY.reserve), so a dent
// every seconds / hits (7.5 s at four). Parked: slower than `maxSpeed` m/s (the array pad's own rest). The next dent's fraction is kept `keep` s off
// the spot, then dropped; a dent taken holds the mend `hitHold` s and drops the fraction.
// spots: the landmarks whose footprint mends the hull (owner, 2026-10-18, third round: "either standing under the stalheart, or the paint-job garage"), first match wins
export const HULL_REPAIR = Object.freeze({ seconds: SHIELD_ARRAY.reserve, maxSpeed: SHIELD_ARRAY.maxSpeed, keep: 5, hitHold: 1, spots: Object.freeze(['stalheart', 'garage']) });
// THE LURE (owner, 2026-10-16, THE ARENA: Isao drives the hull as bait "avoiding both the monster and friendly fire"; src/domain/lure.js, the drive's `lure`
// directive in src/fx/hull-drive.js): the quarry kept between `near` and `far` hops (nearer: kite away; farther: close in; between: circle), and no
// exit within `blast` cells of a danger point (a painted or falling MK-9 cell, SOL's burn, a Bofors shell's target) while another remains
// `nuke` (2026-10-23, THE FIGHT ON THE LAB'S ENGINE: "leaving room for a clean nuke"): the MK-9's own ring, its painted or falling cell, kept off by this many cells
// (its blast is 5.5; `blast` 4 is the shells' and SOL's), and a hull already inside it flees straight out of it (the first --arena-fight run with the hull moving:
// an MK-9 painted on her with the hull 2.2 cells off took the hull whole)
export const LURE = Object.freeze({ near: 5, far: 10, blast: 4, nuke: 7 });
// the hull's steering (owner, 2026-09-16: "the tank turns too sharply = unnatural"): `rate` is the top yaw rate in rad/s — the pace
// the tank always turned at — now taken up over `attack` seconds and released over `release` instead of switching on and off with the
// key, and `bank` is how far the hull rolls into the turn at that full rate, in radians. Not a slower tank: the same rate, eased.
export const TANK_STEER = Object.freeze({ rate: 2.6, attack: 0.28, release: 0.16, bank: 0.1 });

// THE HULL GETS UNSTUCK (owner, 2026-10-02; src/domain/hull-stuck.js): after `after` seconds of driving that moves the hull less than
// `share` of the drive, it is eased toward its cell's centre, the ease rising over `ramp` seconds to `rate` cells a second
// thread: the cells of room the hull's centre keeps from a rock face once it is squeezed (src/domain/hull-contact.js threadClearance; 2026-10-16:
// its full clearance, 0.3 of a cell at most, could not thread the waist before rocket-b's clearing); the nose and tail probes keep 0.04 too
export const HULL_STUCK = Object.freeze({ after: 0.25, ramp: 0.35, share: 0.3, rate: 2.4, span: 0.25, thread: 0.04 });   // span: the seconds the progress is judged over (a creep back and a step forward cancel)   // sooner and firmer (owner, 2026-10-02: "still too easy to get stuck in small corridors"; was 0.45 / 0.6 / 0.15 / 1.4)

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

// THE HOVER KICK (src/domain/hover-kick.js; owner, 2026-10-03: "a lateral bump, as if the hovering system got miscalibrated"): a hit with
// more than `headOn` of the step into the rock starts a kick of `seconds` to a free point `back` cells off the wall and `along` cells along
// it (the target checked free, or just `back`, or no kick), rolling up to `roll` radians and settling; `cool` seconds before the next;
// `keep` of the run-up survives it
// (2026-10-03, "a forward bias ... it almost glides on the walls") the kick goes mostly ALONG (back 0.32 -> 0.18, along 0.35 -> 0.8) and keeps
// more of the run-up (0.55 -> 0.8); `ahead` cells in front the hover glide turns a hull meeting rock within `glideAngle` of parallel toward
// it at `glide` rad/s; a hit is head-on past `headOn` (0.45 -> 0.7: the glide takes the shallow ones)
export const TANK_KICK = Object.freeze({ headOn: 0.7, seconds: 0.55, back: 0.18, along: 0.8, roll: 0.22, cool: 0.6, keep: 0.8, ahead: 0.9, glide: 4, glideAngle: 1.2 });
