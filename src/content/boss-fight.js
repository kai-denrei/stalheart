// The boss fight prototype's numbers (the Nih-Dairia lab). Pure data; src/domain/boss-fight.js takes them as `tune`.
// Design: docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md, sections 4 and 5, and the next round's
// 2026-10-08-boss-fight-next-round-design.md, section 1 (the balance is set from a survival run, Task 7). The guns' own rates, travel
// and damage live in GUNSHIP_GUNS; these are the fight's copies so the rule stays pure. Times in seconds, distances in local metres.
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') freeze(v); return Object.freeze(o); };

export const BOSS_FIGHT = freeze({
  health: 180,        // the creature's hit points, set from the browser's survival run (next-round spec, section 6): a tank that circles at 45 m and widens to clear each MK-9 ring kills it in 26.26 s and 26.03 s (mean 26.15) at 155 and in 31.03 s at 180; a held creature (tank far) dies in 27.80 s in node with the four guns (the real feet), 24.22 s at 155
  warn: 1.5,          // a red spot shows this long before its shot lands
  lead: 1,            // the aim leads the creature's velocity by this fraction of the time to landing
  scatter: 0.5,       // the jitter's reach as a fraction of the blast radius (Bofors) or the footprint (SOL)
  front: 10,          // the Bofors and SOL aim this far beyond the creature's front edge, on the line toward the tank
  behind: 15,         // the MK-9 lands this far behind the creature's centre, away from the tank
  margin: 2,          // the slack beyond a ring and the hull that the Bofors and SOL keep from the tank
  rotary: { radius: 8, dps: 6.6 },   // GUNSHIP_GUNS.rotary: dangerCells 0.8 at ten metres a cell; 30 rounds a second x 0.22 a round
  bofors: { burst: 2.6, rest: 1.4, rate: 2.4, damage: 4, radius: 22, travel: 2.6 },   // GUNSHIP_AUTO's burst and rest; GUNSHIP_GUNS.bofors' rate, blast (2.2 cells) and travel
  nuke: { every: 20, radius: 55, damage: 60, travel: 4.2, stun: 1.5 },   // GUNSHIP_GUNS.heavy: reload 20, blastCells 5.5, travel = freeFall 2.4 + drive 1.8; the damage and the stun are the fight's own
  sol: { every: 8, aim: 1.5, burn: 6, dps: 10, radius: 8 },   // a strike every 8 s: the pointer, then a burn of 6 s (was 2); the footprint and dps are the fight's own
  fear: { reach: 8, bofors: 1.2, after: 0.8, flee: 20, cooldown: 1, weight: { sol: 2, bofors: 1 } },   // what frightens it (next-round spec, section 2): a landing within radius + reach of a foot frightens it 1.2 s, a SOL beam keeps it running until 0.8 s after; it flees 20 m, SOL twice a Bofors landing; a new fright disturbs the kit at most once a second
  hull: { radius: 4.2 },   // the tank's hull for the rings and the creature's capture
  bait: {                  // bait mode (2026-10-09-boss-bait-mode-design.md): Isao the drone flies on autopilot as the creature's prey, the player in the gunship
    health: 12,            // his hit points
    keep: 20,              // he keeps this far outside the creature's front edge toward himself
    speed: 14, flee: 24,   // his cruise round the creature, and the straight back-off when an arm closes (m/s)
    panic: 12,             // a floor contact this close makes him flee
    turn: 3,               // his heading eases at this many radians a second
    altitude: 17.75,       // metres above the surface: src/fx/isao-worker.js ISAO_ALT 3.4 is in wall-heights (td-tab wallHeight 0.03), so 0.102 world units, plus half a cell (cellSide 0.08 / 2) = 0.142; a 10 m cell is 0.08, so 125 m a world unit
    caught: 3, caughtFor: 0.5,   // a floor contact within this many metres of his ground point for this long takes him
    // the erratic flight (2026-10-09-boss-bait-arena-and-feel-design.md, item 3): `erratic` 0..1 scales every swing below, 0 is the smooth flight above
    erratic: 1,            // default on in bait mode
    speedMin: 8, speedMax: 26,   // bursts and brakes: his speed target is drawn from this band (at erratic 1; the cruise `speed` is the centre of the scale)
    accel: 30,             // m/s2: the most his speed changes by (the panic dash at `flee` is exempt)
    surgeMin: 0.5, surgeMax: 1.5,   // seconds: a new speed target this often
    jink: 40 * Math.PI / 180,       // radians: his course is turned off the wanted point by up to this much, eased at `turn`
    jinkMin: 0.6, jinkMax: 2,       // seconds: a new jink target this often
    bob: 1.5,              // metres: the altitude bob's amplitude, for the lab to add to his altitude
    bobPeriod: [1.7, 1.05],   // seconds: the bob is two sines of these periods (weights 0.6 and 0.4)
  },
  bounds: { radius: 120, baitMargin: 10, creatureMargin: 15 },   // the arena disc round the origin: Isao's wanted point stays radius - baitMargin in, the creature's target radius - creatureMargin, the body's nodes are pushed back inside radius
  orbit: { radius: 200, lap: 120, bank: 0.12 },   // the gunship platform's ground track round the origin: 200 m, one lap per 120 s (10.5 m/s); the bank in radians is about twice the coordinated 0.056 (v squared over r g) so the roll reads on the seat's camera without lurching
  card: 3,                 // the KILLED / LOST card's seconds before the reset
  respawn: 40,             // the tank respawns this far out, away from the creature
  deathGravity: 10,        // the v1 death: the lab's gravity knob's maximum, the body collapses
  wall: { clear: 6 },      // the creature's routing keeps this far from a live shape's footprint (next-round spec, section 3)
  arena: [                 // the obstacles, local metres at the creature's rest; a wall's yaw in degrees, its length along (cos yaw, sin yaw) in [x, z]
    { id: 'r1', kind: 'rock', at: [0, 55], radius: 8, height: 6, breakable: false },
    { id: 'r2', kind: 'rock', at: [-40, -45], radius: 8, height: 6, breakable: false },
    { id: 'r3', kind: 'rock', at: [35, 30], radius: 5, height: 6, breakable: true },
    { id: 'r4', kind: 'rock', at: [-30, 25], radius: 6, height: 6, breakable: true },
    { id: 'w1', kind: 'wall', at: [25, -40], size: [20, 3], yaw: 30, height: 3, breakable: true },
    { id: 'w2', kind: 'wall', at: [-55, 0], size: [20, 3], yaw: 90, height: 3, breakable: true },
  ],
});
