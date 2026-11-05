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
    // a nimble top of 3.2 m/s (not C-07's 7); its own wander band (its walk is 0.24 m/s: play.wander would put it on the gallop at the rate's floor);
    // Pounce carries 1.6 m of root travel on MOTION, so it is a trick played in place, never a gait
    { id: 'k0', name: 'K0-TECH', kind: 'feline', model: 'assets/models/k0-tech/k0_tech_d0_lod1.glb', far: 'assets/models/k0-tech/k0_tech_d0_lod2.glb',
      idle: 'Watch_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw', 'Pounce'], top: 3.2, accel: 7, turn: 3.6, trot: 1.6, wander: [0.2, 0.34], shotScale: 0.5, born: 'pet_born_k0',
      gaits: [{ clip: 'Stalk_Cycle', mps: 0.0893, max: 0.12 }, { clip: 'Feline_Walk_Cycle', mps: 0.2383, max: 0.5 }, { clip: 'Gallop_Cycle', mps: 2.6889, max: 4 }] },
  ],
  play: {
    idle: [1.5, 4], wander: [0.45, 0.65], dash: [0.75, 1], trot: 2.3, sitSecs: [3, 6], trick: 0.25, wanderMax: 14,
    chase: { secs: [8, 14], tagM: 1.6, flee: 0.75, every: [20, 45], first: 8, startM: 25, awayM: 20 },
    greet: { nearM: 3, every: [40, 90], first: 25 },
    dance: { dash: [0.45, 0.7], dashS: 3, sitSecs: [1.5, 2.5], floorM: [5, 13], hullM: 9 },
    dodge: { nearM: 6, rangeM: 60, laneM: 5, leadS: 3, movingMps: 0.5, closingMps: 0.3, stillMps: 0.3, stillS: 1, clearM: 12, maxS: 6 },
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
  //                    secure or not begun); past `patience` seconds a fight no longer holds it (the rest still do); `brief` Isao's line as it starts
  //   print            the scene: `spotCells` the bed's least distance from the heart (hops; up to two more), `slabClear` the metres its plot keeps
//                    off a raised island's slab (tried in turn: a bed beside a slab hid behind its edge), `bedM` its radius and `hoverM` Isao's height over it (metres),
  //                    `colour` the print's wireframe, `band` the bright fresh layer above the finished skin (share of the height), the timeline
  //                    in seconds (`arrive` Isao comes down, `print` the body rises slice by slice, `skin` its own wireframe closes over the print,
  //                    `wake` its first idle while Isao goes back up), `angles` the camera's four cuts in the bed's metres (x right of the
  //                    unit's facing, y up, z its facing; each eye and look eased from the first to the second over [from, to] s, fov in degrees),
  //                    scaled by the body's length over `refLength`; `shot` the live cut (5 s mandatory, then Space skips, as the FEIDS-26 drop)
  prints: {
    order: ['c07', 'k9', 'k0'],
    triggers: [
      { phase: 'expedition', delay: 20, patience: 150, brief: 'pet_print_first' },   // the colony up, the first wave dealt with, the hull the player's: the first quiet moment after
      { phase: 'expedition', perk: 'uplink', days: 3, delay: 10, patience: 150, brief: 'pet_print_second' },   // "later": three days on and the radar up
      { phase: 'expedition', perk: 'farm', days: 2, delay: 10, patience: 150, brief: 'pet_print_third' },   // K0-TECH (round 6): the greenhouse up (sector 3) and two days on
    ],
  },
  print: {
    spotCells: 2, slabClear: [8, 4, 0], bedM: 1.9, hoverM: 2.4, colour: 0x7fe9ff, band: 0.12, refLength: 2.78,
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
