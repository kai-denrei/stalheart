// THE BASE COMPANIONS (owner, 2026-10-27: "import the C-07 and Reckon K9 from SentryTowers_A6. for now we just import them as companions who
// are there early on, built by Isao. default WIREFRAME look. they move around the base freely, sometimes accelerating, sometimes playfully
// chasing each other ... just a test for a cute feline and canine presence"). The owner's two quadrupeds (assets/models/c07, assets/models/reckon-k9,
// pinned in docs/companions-assets.lock.json) live on the clearing from the first frame, drawn at their true size (metres) as the game draws
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
//   play.greet     the trot to the hull, sitting `nearM` metres from it, `every` seconds apart
//   roamCells      how far from the heart cell (hops) they roam; keepFromHull metres they keep off the hull's point when not greeting
//   lodMetres / fade  beyond lodMetres from the eye the static distance tier (one draw) stands in, back inside lodMetres - fade
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };
export const COMPANIONS = freeze({
  scale: 1, roamCells: 6, keepFromHull: 2.5, lodMetres: 90, fade: 15, startCells: 2,
  units: [
    { id: 'c07', name: 'C-07', kind: 'feline', model: 'assets/models/c07/c07_d0_lod1.glb', far: 'assets/models/c07/c07_d0_lod2.glb',
      idle: 'Watch_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw'], top: 7, accel: 7, turn: 3.2, trot: 4,   // no middle gait: the trot is a lope on the gallop clip at 0.65
      gaits: [{ clip: 'Feline_Walk_Cycle', mps: 0.5417, max: 1.1 }, { clip: 'Gallop_Cycle', mps: 6.111, max: 9 }] },
    { id: 'k9', name: 'RECKON K9', kind: 'canine', model: 'assets/models/reckon-k9/reckon_k9_d0_lod1.glb', far: 'assets/models/reckon-k9/reckon_k9_d0_lod2.glb',
      idle: 'Alert_Idle', sit: 'Sit_Down', tricks: ['Roll_Over', 'Give_Paw', 'Jump'], top: 5.5, accel: 5, turn: 2.8,
      gaits: [{ clip: 'Walk_Cycle', mps: 0.3571, max: 0.7 }, { clip: 'Run_Cycle', mps: 2.182, max: 2.7 }, { clip: 'Gallop_Cycle', mps: 3.1, max: 3.8 }, { clip: 'Sprint_Cycle', mps: 4.43, max: 7 }] },
  ],
  play: {
    idle: [1.5, 4], wander: [0.45, 0.65], dash: [0.75, 1], trot: 2.3, sitSecs: [3, 6], trick: 0.25, wanderMax: 14,
    chase: { secs: [8, 14], tagM: 1.6, flee: 0.75, every: [20, 45], first: 8, startM: 25, awayM: 20 },
    greet: { nearM: 3, every: [40, 90], first: 25 },
  },
  crossfade: 0.25, rate: [0.45, 1.6],   // the blend between clips, and the clip rate's clamp (a gait asked for beyond its band plays no faster than this)
});
