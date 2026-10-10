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
    keep: 20,              // he keeps this far outside the creature's reach toward himself (the outermost body node, arms included, when the lab gives the nodes; else the floor contacts' front edge)
    envelopeTime: 1,       // seconds: that reach is smoothed over this long, so a sweeping arm does not yank him back and forth
    speed: 14, flee: 32,   // his cruise round the creature, and the straight back-off when an arm closes (m/s); the flee 32 (24 before wave B, 2026-10-09) so he outruns the creature's base pace
    panic: 12,             // a floor contact, or a body node under `panicHeight`, this close makes him flee
    panicHeight: 6,        // metres: a body node below this is an arm near the ground for his panic
    panicExit: 2,          // metres: the panic ends only once every low arm is this far beyond `panic` (hysteresis: it no longer flickers at the ring)
    panicDwell: 0.25,      // seconds: and once it has lasted this long
    panicAccel: 50,        // m/s2: the most his velocity changes by in a second fleeing an arm or a ring, or escaping from under the creature (owner, 2026-10-10: the shake when close; finite, so no zigzag); other hops take `accel`
    climbAccel: 35,        // m/s2: a hop's climb and descent ease their vertical speed (at most `hopClimb`) by this much a second
    turn: 3,               // his heading eases at this many radians a second
    altitude: 17.75,       // metres above the surface: src/fx/isao-worker.js ISAO_ALT 3.4 is in wall-heights (td-tab wallHeight 0.03), so 0.102 world units, plus half a cell (cellSide 0.08 / 2) = 0.142; a 10 m cell is 0.08, so 125 m a world unit
    caught: 3, caughtFor: 0.5,   // a floor contact within this many metres of his ground point for this long takes him
    // the erratic flight (2026-10-09-boss-bait-arena-and-feel-design.md, item 3): `erratic` 0..1 scales every swing below, 0 is the smooth flight above
    erratic: 1,            // default on in bait mode
    speedMin: 8, speedMax: 26,   // bursts and brakes: his speed target is drawn from this band (at erratic 1; the cruise `speed` is the centre of the scale)
    accel: 30,             // m/s2: the most his velocity changes by in a second cruising (a burst, a brake, a turn: every change of the wanted point) and hopping; fleeing takes `panicAccel`
    surgeMin: 0.5, surgeMax: 1.5,   // seconds: a new speed target this often
    jink: 40 * Math.PI / 180,       // radians: his course is turned off the wanted point by up to this much, eased at `turn`
    jinkMin: 0.6, jinkMax: 2,       // seconds: a new jink target this often
    bob: 1.5,              // metres: the altitude bob's amplitude, for the lab to add to his altitude
    bobPeriod: [1.7, 1.05],   // seconds: the bob is two sines of these periods (weights 0.6 and 0.4)
    // the fly-over (owner, 2026-10-09: "Isao gets stuck between an invisible wall (the boundaries) and the creature too often. once in a while have Isao fly
    // OVER it"): trapped (the bound within `trapBound` m of him and a floor contact on the inside within `trapNear` m, for `trapFor` s) or at random
    // (`hopChance` a second, not while he panics), he climbs to `hopAlt`, crosses to the creature's far side and comes back down; one per `hopCooldown` s.
    // Under the creature (owner, 2026-10-09: "Isao gets stuck too easily under the creature"): his ground point within `underCore` of its half-width from
    // its centre (at once), or floor contacts within `underNear` m of him on opposite sides (more than 120 degrees apart round him) held `underFor` s (the
    // predator's long sweeping arms had him escaping 54 to 85 per cent of a run at 15 m, wave B), he escapes, up and out through the near side, cooldown and
    // chance ignored
    trapBound: 12,         // metres from him to the bound
    trapNear: 25,          // metres: a floor contact this close on the inside: at the bound with the creature at his keep (20 m from its edge) he cannot circle out
    trapFor: 0.8,          // seconds trapped before he hops
    hopChance: 0.03,       // a second: about once in 30 s at random
    hopCooldown: 8,        // seconds after a hop lands before the next
    hopAlt: 30,            // metres above the ground: clear of the body's top, about 14 m at 40 m (the rest pose's mesh), with the arms' lift
    hopClimb: 20,          // metres a second up and down
    hopSpeed: 22,          // metres a second across
    hopCross: 8,           // seconds at most across before he comes down where he is
    reachHeight: 18,       // metres: above this the creature's floor contacts cannot take him (the hold does not count)
    underCore: 0.5,        // a share of the creature's half-width (`radius`): his ground point this near its centre is under it
    underNear: 8,          // metres: floor contacts this near him on opposite sides have him under it
    underFor: 0.5,         // seconds: the contacts must hold him so long, unbroken, before he escapes (his ground point under the core is at once)
    // the MK-9 in flight (owner, 2026-10-10: "Have Isao more actively avoid where the Nuke will fall"): from its release to its landing its ring (`nuke.radius`) is a no-go zone for his autopilot, kept to this many metres beyond the ring
    nukeMargin: 10,
    nukeAvoid: true,       // false: the autopilot ignores the MK-9s in flight (the acceptance's, which aims them at him; the zones are empty)
  },
  nukeClear: 8,            // the bait mode's NUKE CLEAR cue (wave B, 2026-10-09: "create an opportunity for a clean nuke"): lit while Isao is beyond the MK-9's radius plus this many metres from the creature's centre
  // THE BAIT MODE'S FEAR PER GUN (owner, 2026-10-09: "we want 'fear'... #2 or #3 hits gets it wild temporarily, hurrying away from the impact ... the user learns that he
  // can place strikes to separate the predator from Isao, and create an opportunity for a clean nuke. #1 registers a little as a barrage, #2 a lot"). The 25 mm fills a
  // barrage meter `amount` a round landing within reach, drained `drain` a second, and at 1 the creature flinches; the 40 mm sends it wild, the MK-9 into a panic. Each
  // flight runs from the newest impact for `duration` seconds, its flee point `flee` metres ahead (as the tank mode's `fear.flee`), at `speed` times the base chase speed,
  // the kit's erratic motion up by `erratic`. `nuke.stun` is the bait mode's own MK-9 stun (0: the panic at once; the tank mode keeps `nuke.stun` above)
  gunFear: {
    rotary: { amount: 0.06, drain: 0.5, flee: 10, duration: 0.8, speed: 1.3, erratic: 0 },
    bofors: { flee: 35, duration: 2.5, speed: 2, erratic: 2 },
    nuke: { flee: 50, duration: 3.5, speed: 2.5, erratic: 1, stun: 0 },
  },
  // THE BAIT MODE'S TEMPERAMENT (owner, 2026-10-09: "chase speed we need basic speed and a measure of sudden accelerations once in a while, the threatening look comes from
  // the tentacles lengthening/reaching, and from sudden bursts of speed"): the base is the mode's own motion (the panel's knobs, chase speed 1.2); every `everyMin`..`everyMax`
  // seconds (seeded) a lunge of `forMin`..`forMax` seconds at chase speed `lungeSpeed` (the owner's 3), the arms' reach duration, stretch and spread times `reach` within the
  // kit's ranges, eased in and out over `ease` seconds; `lunges` false keeps the base
  temperament: { lunges: true, lungeSpeed: 3, everyMin: 3, everyMax: 8, forMin: 0.6, forMax: 1.2, reach: 1.5, ease: 0.2 },
  // ISAO'S CHATTER (owner, 2026-10-09: "Isao is too verbose with the three lines about elevation. reduce the frequency ... and add more diversity"): a director says one line
  // at a time, at least `gap` seconds apart. Per line: `priority` (the highest wanted line goes first; the situational lines above the fly-over's chatter), `cooldown` (seconds
  // between two of it), `per` (at most this many a round), `ttl` (seconds a want waits for its turn before it is dropped; none: until said), `variants` (its takes:
  // `ordered` in turn, else at random never the same twice running), `chance` (the share of its triggers that ask), `then`/`after` (a line wanted `after` seconds once it is said)
  chatter: {
    gap: 6,
    // the lab's triggers (src/labs/boss/bait.js): a landing within `closeRing` m outside his ring, or an escape from an arm that came within `closeEscape` m, is a close
    // call; a body node within `barrageNear` m and no player fire for `barrageQuiet` s asks for a barrage; no 40 mm for `fortyQuiet` s with a node within `fortyNear` m asks
    // for the 40 mm; an MK-9 landing within `faceNear` m that he survives is in his face
    triggers: { closeRing: 6, closeEscape: 5, barrageNear: 25, barrageQuiet: 5, fortyQuiet: 20, fortyNear: 30, faceNear: 70 },
    lines: {
      death: { priority: 10, per: 1, then: 'notToday', after: 2 },
      notToday: { priority: 10, per: 1 },
      nukeFace: { priority: 8, cooldown: 20, ttl: 4 },
      help: { priority: 7, cooldown: 15, ttl: 3 },
      closeCall: { priority: 7, cooldown: 12, ttl: 2.5 },
      hurt: { priority: 6, per: 2, ttl: 5, variants: 2, ordered: true },
      stagger: { priority: 6, per: 1, ttl: 5 },
      nukeCareful: { priority: 5, cooldown: 20, ttl: 3 },
      useForty: { priority: 4, cooldown: 30, ttl: 5 },
      barrage: { priority: 4, cooldown: 25, ttl: 5 },
      taunt: { priority: 3, per: 1, ttl: 6 },
      flyover: { priority: 1, cooldown: 12, ttl: 2, variants: 3, chance: 1 / 3 },
    },
  },
  // THE BAIT MODE'S FIRST WAVE (owner, 2026-10-09: "let's test something with the fps; wave 1 is 5 to 50 (slider) Reed - four limbs, creatures, smaller (size 15) and
  // with only 20 hp, not 180. once they are defeated, the bigger Nih Dairia shows up"; src/domain/boss-wave.js). `count` Reeds (the panel's slider and ?reeds=N; 0 is the
  // boss at once) of `reedHealth` hit points and `size` metres; a dead one lies collapsing `corpse` seconds before it is laid down as a carcass
  // (`carcass`, below). The last one dead, the boss lands at the arena's centre and Isao is put out to `clear` metres from it if he is nearer. `budget` is the lab's: the
  // milliseconds of solver a frame the whole wave may take (past it the Reeds' clock runs slower, never a catch-up spiral), `lod` its off-screen Reeds at half rate (off: at
  // fifty Reeds in the seat it ran the wave's clock at 0.053 and 0.068 against 0.048 and 0.044 with 13 and 27 off-screen, every one crawling, and at ten none or two are off-screen, 2026-10-09)
  // THE SECOND PASS (owner, 2026-10-10: "Have the Reed and the boss come out of a tremor in the center ... start with 120 HZ when there are more than 10 Reeds, and
  // switch back to 240HZ when there are fewer ... a low-poly dead Reed Carcass that stays and decays"). `emerge`: each Reed comes up at the arena's centre (`jitter` m
  // off it), `gap` s after the one before, out of the game's own sinkhole (owner, 2026-10-10: "the initial Tremor is not just the ground shaking, it is our sinkhole
  // animation from the game mode"; src/game-breaches.js, opened at the centre `sinkhole.reeds` cells wide for the Reeds and `sinkhole.boss` for the boss, the first
  // turn once it has opened by the game's own rule, `breaches.ready`; the Reeds' sealed with the game's rubble once every one is up), `lead` s, then it rises out of the ground
  // over `rise` s (drawn from `depth` times its height below), walks out to `fan` m from the centre for at most `fanFor` s and hunts; Isao's planner keeps `keep` m off
  // the centre while any Reed is still to come up (`clear` while the boss rises). `coarse`: the Reeds' solver steps at 1 / `hz` s while more than `above` stand (`on`, the
  // panel's switch), the kit's 1/240 s otherwise; the boss always at the kit's. `carcass`: laid down, a dead Reed darkens by `dark` and sinks `sink` of its height
  // over `decay` s, its thermal warmth gone by `cold` of the decay; then it goes; at most `max` lie, the oldest going first. THE TENTACLES (owner, 2026-10-10: "the
  // low-poly reeds carcasses are too low poly, they look blocky. can we have them more simple renditions of tentacles? barebone tentacles, and they disintegrate with
  // further explosions or time"; src/domain/boss-carcass.js): `chain` each limb's nodes in `bins` bands out from the axis (the kit's limb rule: the torso within
  // `torso`, a limb from `root`, native units), a smooth tube through the bands' centres in `segments` pieces of `sub` rings of `radial` sides, `thin` of the nodes'
  // spread across the limb's thinner axis and tapering to `tip` of the root's (`taper` the power of the taper); the core an ellipsoid `core` of the torso's spread. `crumble`: the pieces go from each tip inward between `from` and
  // `to` of the decay (`jitter` of a slot seeded), each shrinking and sagging `drop` m over `time` s. `blast`: an impact breaks the pieces within `radius` m (0: the
  // round's own), at most `cap` (0: every one): the 25 mm a few, the 40 mm a limb or two, the MK-9 its whole ring; a broken piece is `fling`ed outward at `speed`
  // and up at `up` m/s under `gravity`, tumbling at `spin` rad/s, whole for `whole` of its flight, gone in `time` s
  wave: { count: 20, reedHealth: 20, size: 15, corpse: 2, clear: 45, budget: 10, lod: false,
    emerge: { gap: 0.6, lead: 0.35, rise: 1.5, depth: 1.15, jitter: 4, fan: 20, fanFor: 2.5, keep: 25 },
    sinkhole: { reeds: 1, boss: 2 },   // the game's sinkhole's scale in cells (the game opens every breach one cell wide: a 10 m hole); the boss, 40 m across, comes out of one twice that
    coarse: { on: true, above: 10, hz: 120 },
    carcass: { decay: 60, max: 30, dark: 0.75, sink: 0.35, cold: 0.6,
      chain: { torso: 0.022, root: 0.03, bins: 10, segments: 8, sub: 3, radial: 8, thin: 0.6, tip: 0.1, taper: 1.2, core: 0.9 },
      crumble: { from: 0.15, to: 0.9, jitter: 0.8, time: 1.2, drop: 0.6 },
      blast: { rotary: { radius: 3, cap: 3 }, bofors: { radius: 8, cap: 0 }, nuke: { radius: 0, cap: 0 } },
      fling: { time: 0.8, whole: 0.4, speed: 18, up: 12, gravity: 30, spin: 9 } } },
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
