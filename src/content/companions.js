// THE BASE COMPANIONS (owner, 2026-10-27: "import the C-07 and Reckon K9 from SentryTowers_A6. for now we just import them as companions who
// are there early on, built by Isao. default WIREFRAME look. they move around the base freely, sometimes accelerating, sometimes playfully
// chasing each other ... just a test for a cute feline and canine presence"). The owner's two quadrupeds (assets/models/c07, assets/models/reckon-k9,
// pinned in docs/companions-assets.lock.json) live on the clearing once Isao has printed them (2026-10-30, below), drawn at their true size (metres) as the game draws
// every colony machine. Their play is the pure rule in src/domain/companion-play.js; the scene part is src/fx/companions.js.
//   units[].gaits  the model's in-place locomotion clips in order of speed: `mps` is the clip's authored ground speed at rate 1 (the manifest's
//                  clips.speed_mps), `max` the top of the speed band the clip covers; the body translates at its speed and the clip plays at
//                  speed / mps, so the paws never slide. `top` is the unit's top speed (m/s), `accel` how fast it gets there (m/s^2), `turn`
//                  the heading's rate at rest (rad/s; a galloping body turns at a third of it, so a dash draws an arc)
//   units[].idle / sit / tricks  the loop at rest, the one-shot that holds seated, the one-shots played in place for fun; units[].trot its own
//                  trot speed (the greet, the approach before a game) where play.trot would fall under its fastest clip's band
//   play.idle      seconds at rest between moves, [min, max]; play.wander the walk's speed band; play.dash the burst's share of `top`
//   play.chase     a game of tag: the chaser at `top`, the one fleeing at `flee` of its own top, a tag within `tagM` metres swaps the roles,
//                  the game over after `secs`; `every` seconds between games, `first` the delay before the first one; a pair further than
//                  `startM` apart trots together first; the fleer picks its next point within `awayM` of itself (it dodges, it does not cross the base)
//   play.greet     the trot to the hull, sitting `nearM` metres from it, `every` seconds apart; only once the hull has stood still `dodge.stillS`
//   play.dance     DAY 42 ON THE DANCE FLOOR (owner, 2026-11-02, round 4 note 8): during the party a dash at `dash` of the top speed for `dashS`
//                  seconds at most to a point `floorM` metres from the ball's foot and `hullM` off the hull (the first --day-42 frame had the parked
//                  hull between C-07 and the cut's lens), then a trick or a sit (`sitSecs`) in place, in turn, until the klaxon
//   play.dodge     OUT OF THE TANK'S WAY (owner, 2026-11-02, round 4 note 5): a hull moving faster than `movingMps` and closing faster than
//                  `closingMps` on a unit within `nearM` metres, or within `rangeM` and `laneM` of its line and due on it inside `leadS` seconds,
//                  sends the unit off its line at its top speed; it rests once the hull is past, slower than `stillMps` or `clearM` off (or
//                  after `maxS` with no threat left); the greet waits for the hull to stand `stillS` seconds under `stillMps`
//   roamCells      how far from the heart cell (hops) they roam; keepFromHull metres they keep off the hull's point when not greeting
//   units[].born   Isao's line as the printed unit wakes (src/isaobriefs.js)
//   units[].wander its own walk band (m/s) over play.wander (round 6, K0-TECH: a 0.24 m/s walk); units[].shotScale the share of the close shots'
//                  distances for a small body (DAY 42's cut, the harness's look; absent, 1)
// THE THIRD (round 6, 2026-11-05): K0-TECH, the small feline (assets/models/k0-tech), printed after the greenhouse; tag is a game of two among the
// printed ones (src/domain/companion-play.js)
//   lodMetres / fade  beyond lodMetres from the eye the static distance tier (one draw) stands in, back inside lodMetres - fade
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };
export const COMPANIONS = freeze({
  scale: 1, roamCells: 6, keepFromHull: 2.5, lodMetres: 90, fade: 15, startCells: 2,
  units: [
    { id: 'c07', name: 'C-07', kind: 'feline', model: 'assets/models/c07/c07_d0_lod1.glb', far: 'assets/models/c07/c07_d0_lod2.glb',
      idle: 'Watch_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw'], top: 7, accel: 7, turn: 3.2, trot: 4, born: 'pet_born_c07',   // no middle gait: the trot is a lope on the gallop clip at 0.65
      gaits: [{ clip: 'Feline_Walk_Cycle', mps: 0.5417, max: 1.1 }, { clip: 'Gallop_Cycle', mps: 6.111, max: 9 }] },
    { id: 'k9', name: 'RECKON K9', kind: 'canine', model: 'assets/models/reckon-k9/reckon_k9_d0_lod1.glb', far: 'assets/models/reckon-k9/reckon_k9_d0_lod2.glb',
      idle: 'Alert_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw', 'Jump'], top: 5.5, accel: 5, turn: 2.8, born: 'pet_born_k9',
      gaits: [{ clip: 'Walk_Cycle', mps: 0.3571, max: 0.7 }, { clip: 'Run_Cycle', mps: 2.182, max: 2.7 }, { clip: 'Gallop_Cycle', mps: 3.1, max: 3.8 }, { clip: 'Sprint_Cycle', mps: 4.43, max: 7 }] },
    // K0-TECH-01 (owner, 2026-11-05, round 6 note 1a: "the small feline"): 0.30 x 0.41 x 1.05 m, half C-07's height; the stalk is the slow creep,
    // a nimble top of 4.2 m/s (not C-07's 7) and a quick 14 m/s^2: the design's 3.2 and 7 left the hull 0.82 m from it in --companions' drive (the
    // hull 8 -> 27 m/s over 20 m), 4.2 is as fast as its gallop plays without sliding (2.69 m/s x the 1.6 rate clamp); its own wander band (its walk is
    // 0.24 m/s: play.wander would put it on the gallop at the rate's floor);
    // Pounce carries 1.6 m of root travel on MOTION, so it is a trick played in place, never a gait
    { id: 'k0', name: 'K0-TECH', kind: 'feline', model: 'assets/models/k0-tech/k0_tech_d0_lod1.glb', far: 'assets/models/k0-tech/k0_tech_d0_lod2.glb',
      idle: 'Watch_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw', 'Pounce'], top: 4.2, accel: 14, turn: 3.6, trot: 1.6, wander: [0.2, 0.34], shotScale: 0.5, born: 'pet_born_k0',
      offer: { price: 1800, fromSector: 2, effect: 'a small feline companion, printed now instead of after the greenhouse' },   // THE BUILD BOARD's card (round 6, stream B reads a unit's `offer`): the farm is a board purchase now, so the cat can be bought before it
      gaits: [{ clip: 'Stalk_Cycle', mps: 0.0893, max: 0.12 }, { clip: 'Feline_Walk_Cycle', mps: 0.2383, max: 0.5 }, { clip: 'Gallop_Cycle', mps: 2.6889, max: 4.4 }] },
    // THE NIH-DAIRIA MECH (owner, 2026-11-05, round 6 note 1b: "a Nih-Dairia mech about the tank's size", Isao's own, printed after THE ARENA's kill):
    // 6.6 x 1.8 x 7.6 m (the hull is 10 m long: scale 1), NO baked clips. `pose: 'mech'` drives it through src/fx/mech-pose.js (the workshop's
    // runtime.js ported, src/domain/mech-pose.js); its idle, sit and trick name the runtime's motions, `rig` holds that script's numbers (metres, s).
    // `kind: 'heavy'` is its own play (src/domain/companion-play.js): a slow roam, a walk to a still hull that stops `play.heavy.greet.nearM` off,
    // no tag, no flight, no dance; `padM` its half width against the structures (the pets keep `padM` + 0.6 m off it), `keepFromHull` its centre's
    // least distance from the hull's (metres; the hull is 10 m long and the mech 7.6 m, so the design's "6 m off" is a gap, not a centre distance),
    // `turnRadius` its heading turns as a vehicle does (the walk has no turn solve: a turn on the spot would slide all six feet), `lodMetres` its
    // far tier's distance (its manifest's 150 m)
    //   rig.rateCap   the walk's playback rate cap: the body at rig.walk.mps x the rate keeps every stance foot fixed at any rate (measured: drift
    //                 under 1e-12 m/s), so the cap is how fast the step still reads as a step: at 3 the swing lasts 0.35 s (21 frames at 60 fps) and
    //                 the pad moves 0.07 m a frame, 7 % of its 1.03 m width (test/mech-pose.mjs; scratch ratecap.txt 2026-11-05); `top` is mechTop
    //   rig.blend     seconds a change of motion eases from the last pose (the runtime has no transitions: idle <-> walk popped six feet)
    { id: 'mech', name: 'NIH-DAIRIA MECH', kind: 'heavy', pose: 'mech', model: 'assets/models/nih-dairia-mech/nih_dairia_mech_d0_lod1.glb', far: 'assets/models/nih-dairia-mech/nih_dairia_mech_d0_lod2.glb',
      idle: 'Observation_Idle', sit: 'Anchor_Deploy', tricks: ['Reach_Cycle'], top: 0.9, accel: 0.25, turn: 0.3, turnRadius: 10, trot: 0.8, wander: [0.45, 0.75], padM: 4, keepFromHull: 12, lodMetres: 150, born: 'pet_born_mech',
      gaits: [{ clip: 'Tripod_Walk_Cycle', mps: 0.3, max: 0.9 }],
      rig: {
        upper: 1.15, lower: [1.85, 2.43], slack: 0.12, slideBase: 0.35, footOffset: 0.38, footRadius: 3.28, hipRing: 0.62, contactY: 0.16, stroke: 0.58, height: 1.42, heave: 0.018, clawTilt: 0.2,
        reach: { pair: ['02', '06'], distance: 1.15, lift: 0.68, advance: 0.55, drop: 0.1, times: { lift: 0.8, reach: [0.8, 2], retract: [4, 2], lowerExtend: [6, 1.2], lowerAnchor: [2.8, 1.4], pull: [4.2, 2.6] } },
        walk: { secs: 3, mps: 0.3, duty: 0.65, lift: 0.34 },
        motions: { idle: { name: 'Observation_Idle', secs: 6, loop: true }, walk: { name: 'Tripod_Walk_Cycle', secs: 3, loop: true }, extend: { name: 'Reach_Cycle', secs: 8, loop: true }, anchor: { name: 'Anchor_Deploy', secs: 8, loop: false } },
        rateCap: 3, blend: 0.6, stopS: 0.4,
      },
      // its print (over COMPANIONS.print's): a 9 x 9 m plot, the body 7.6 m long, a 20 s print, its own four angles in the bed's metres over 27.6 s
      print: {
        spotCells: 3, bedM: 4.6, refLength: 7.6, hoverM: 3.2, timeline: { arrive: 1.6, print: 20, skin: 2, wake: 4 },
        angles: [
          { from: 0, to: 5, eye: [[24, 9, 26], [20, 8, 22]], look: [[0, 3, 0], [0, 2.4, 0]], fov: 55 },   // wide, three-quarter front: the plot and Isao coming down
          { from: 5, to: 12, eye: [[9.5, 3.2, -5], [9.5, 3.6, 4]], look: [[2.4, 0.6, -2], [2.4, 0.9, 1.5]], fov: 50 },   // beside it, along the rising flank and two legs
          { from: 12, to: 19.5, eye: [[3.5, 1.4, 11], [2.2, 2.2, 9.5]], look: [[0, 0.8, 1], [0, 1.2, 0]], fov: 55 },   // low in front, up past the reaching pair to the beam
          { from: 19.5, to: 27.6, eye: [[-11, 5, -9], [-12.5, 4, 3]], look: [[0, 0.8, -0.6], [0, 0.9, 0]], fov: 50 },   // three-quarter rear, round to its side as it wakes
        ],
      } },
  ],
  play: {
    idle: [1.5, 4], wander: [0.45, 0.65], dash: [0.75, 1], trot: 2.3, sitSecs: [3, 6], trick: 0.25, wanderMax: 14,
    chase: { secs: [8, 14], tagM: 1.6, flee: 0.75, every: [20, 45], first: 8, startM: 25, awayM: 20 },
    greet: { nearM: 3, every: [40, 90], first: 25 },
    dance: { dash: [0.45, 0.7], dashS: 3, sitSecs: [1.5, 2.5], floorM: [5, 13], hullM: 9 },
    dodge: { nearM: 6, rangeM: 60, laneM: 5, leadS: 3, movingMps: 0.5, closingMps: 0.3, stillMps: 0.3, stillS: 1, clearM: 12, maxS: 6 },
    // THE HEAVY ONE (round 6, the mech): seconds at rest, the share of rests that end in a walk (else the anchor or the reach, `trick` of them the
    // reach), how long a walk may last, the walk to a hull that has stood still `greet.stillS` s, stopping `greet.nearM` m off its point (centres)
    heavy: { idle: [5, 11], walk: 0.6, trick: 0.4, wanderMax: 45, sitSecs: [3, 6], greet: { nearM: 15, every: [70, 130], first: 40, stillS: 3 } },
  },
  crossfade: 0.25, rate: [0.45, 1.6],   // the blend between clips, and the clip rate's clamp (a gait asked for beyond its band plays no faster than this)
  // ISAO PRINTS THEM (owner, 2026-10-30: "the robot cat should not already be on the planet when we land, let's spawn it after; include a skippable
  // scene where Isao whimsically prints the cat because he wants a companion. Close up on the creation, showing various angles." / "same with the
  // Cheetah later."). Neither stands on the clearing at landing; each is born by Isao's print (src/fx/pet-print.js, the rules src/domain/pet-print.js).
  //   prints.order     the units' ids in the order Isao prints them: SWAP THE TWO IDS to print the dog first (the triggers stay in place: the first
  //                    trigger is always the first print's)
  //   prints.triggers  one per print, in order: `phase` the story beat reached (src/domain/automation.js STORY_PHASES: 'expedition' is the handover
  //                    done, the Stålheart up, the hull the player's and the sites shown), `perk` a programme perk held ('uplink': the radar printed,
  //                    sector 2's step), `days` in-game days since the print before it; then `delay` game seconds with every gate held, then the
  //                    first quiet moment (no shot, seat, card or line of Isao's, the hull alive, no win, not the arena, the sector in a breath or
  //                    secure or not begun); past `patience` seconds a fight no longer holds it (the rest still do); `brief` Isao's line as it starts;
  //                    `boss` (round 6, the mech) THE ARENA's Nih-Dairia killed (src/fx/sector-run.js bossDown: the arena's SECURE); the arena's own hold is lifted once she
  //                    is dead (the sector's fight still holds it, as any). Each print still waits for the one before it (strictly in order)
  //   units[].print    a unit's own print over `print` (round 6, the mech: its spot, plot radius `bedM`, refLength, Isao's hover, timeline and angles)
  //   print            the scene: `spotCells` the bed's least distance from the heart (hops; up to two more), `slabClear` the metres its plot keeps
//                    off a raised island's slab (tried in turn: a bed beside a slab hid behind its edge), `bedM` its radius and `hoverM` Isao's height over it (metres),
  //                    `colour` the print's wireframe, `band` the bright fresh layer above the finished skin (share of the height), the timeline
  //                    in seconds (`arrive` Isao comes down, `print` the body rises slice by slice, `skin` its own wireframe closes over the print,
  //                    `wake` its first idle while Isao goes back up), `angles` the camera's four cuts in the bed's metres (x right of the
  //                    unit's facing, y up, z its facing; each eye and look eased from the first to the second over [from, to] s, fov in degrees),
  //                    scaled by the body's length over `refLength`; `shot` the live cut (5 s mandatory, then Space skips, as the FEIDS-26 drop)
  //                    `nowWait` (round 7, note 8: the mech's print as a beat of THE ARENA's SECURE, src/fx/pet-print.js printNow) the game seconds a
  //                    print asked for now may wait on a running shot before the debrief goes without it: past the FEIDS-26 drop's 28 s cut, which
  //                    takes the camera as the arena's seat is left when the four were held by it (measured on ?boss=1)
  prints: {
    order: ['c07', 'k9', 'k0', 'mech'],
    triggers: [
      { phase: 'expedition', delay: 20, patience: 150, brief: 'pet_print_first' },   // the colony up, the first wave dealt with, the hull the player's: the first quiet moment after
      { phase: 'expedition', perk: 'uplink', days: 3, delay: 10, patience: 150, brief: 'pet_print_second' },   // "later": three days on and the radar up
      { phase: 'expedition', perk: 'farm', days: 2, delay: 10, patience: 150, brief: 'pet_print_third' },   // K0-TECH (round 6): the greenhouse up (sector 3) and two days on
      { boss: true, delay: 10, patience: 150, brief: 'pet_print_mech' },   // THE MECH (round 6): THE ARENA's Nih-Dairia dead, then the first quiet moment; since round 7 printed at THE ARENA's SECURE before its debrief (src/fx/sector-run.js printNow), this the fallback
    ],
  },
  print: {
    spotCells: 2, slabClear: [8, 4, 0], bedM: 1.9, hoverM: 2.4, colour: 0x7fe9ff, band: 0.12, refLength: 2.78, nowWait: 35,
    timeline: { arrive: 1.6, print: 9, skin: 1.4, wake: 3.5 },
    angles: [
      { from: 0, to: 3.4, eye: [[11, 2.6, 12], [9, 2.4, 10]], look: [[0, 4.6, 0], [0, 4, 0]], fov: 55 },   // wide, three-quarter front: Isao comes down over the bed
      { from: 3.4, to: 7, eye: [[2.8, 0.95, -2], [2.8, 1, 1.1]], look: [[0, 0.25, -0.8], [0, 0.35, 0.3]], fov: 50 },   // beside it and a little over, along the rising flank: the glowing slice
      { from: 7, to: 10.6, eye: [[1.2, 0.3, 3.4], [0.7, 0.35, 2.9]], look: [[0, 0.55, 0], [0, 0.75, -0.3]], fov: 55 },   // low in front, up past the head to the beam
      { from: 10.6, to: 15.5, eye: [[-3.2, 1.6, -3], [-3.6, 1.3, 1.2]], look: [[0, 0.4, -0.4], [0, 0.45, 0]], fov: 48 },   // three-quarter rear, round to its side as it wakes
    ],
    shot: { id: 'petPrint', lock: 5, skipKey: ' ', hint: 'SPACE · SKIP', near: 0.00025 },
  },
});
