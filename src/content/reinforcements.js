// FEIDS-26 REINFORCEMENTS (owner, 2026-10-23: "the goal will be to have Isao call out planetary re-inforcements after having built the radar, and
// after a few in-game days the FEIDS26 will come. ... we will reproduce the cinematic with the same scene, and they will land at the Arena (before the
// boss fight.), 2 will stay near the arena, 2 will roam the map." Then: "the Arena pair DOES join the boss fight, the roaming ones; 1 makes its way
// to the main base, the other roams and hunts enemies. they are equipped with rotor + lancer + 2x quivers at max upgraded specs.")
// Spec: docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md. The numbers of the drop and the four after it:
//   days        in-game days from the call (the radar step printed) to the drop's earliest moment
//   pace        a mech's walk in cells a second; `gaitCap` the Walk_Cycle's rate cap (the clip's own ground speed is 0.27778 m/s at rate 1)
//   roles       the four in drop order (capsule 1 slot 1, capsule 1 slot 2, capsule 2 slot 1, capsule 2 slot 2: the laggard hunts)
//   offsetCells the group's centre from the arena's cell, down the heart's field toward the base (the crater is ARENA.craterCells round the centre)
//   scale       the mechs' cargo scale in the cinematic (0.75 of the MX-06's 8 m plot); the capsule is drawn at 1
//   weapons     the sentry records a mech carries (src/content/sentries.js keys), at the sentries' top tier
//   keepFromHull the hunter's least distance from the hull in cells; `lodMetres` the far tier beyond (the README's 140 m); `fade` the shells' wreck
//   seconds after landing before they go
// `timeline` is the owner's cinematic (SentryTowers_A6 feids26/timeline.js), metres and seconds: two capsules at x -/+capsuleX entering from
// `entry` m nose-down, split at `release` s (the second `capsuleGap` later) at `split` m sinking `splitSink` m/s, each slot released `slotGap` later,
// the cargo falling `fallTimes` to `fallTo` m, braking `brake` s, landing at `landings` round the centre; the quarters gone `shellGone` s after the
// split; the camera wide, then the demo's fixed ground camera at `ground` (9.75, 0.2, 7 m: the "ant" view, the laggard's leg in the foreground; the
// owner, 2026-10-23: "I insist on having the same ant-view extreme low angle ... as in the demo") from groundCamera[0] to [1] s. The game camera's near
// plane (0.004 units, ~3 m at the story's scale, src/td-tab.js) clipped the floor under a lens 1 m up, so the cut lowers it: `shot.near` world units
// (~0.19 m) and the rule's fov while the cut runs, both put back at its end (src/fx/reinforcements-host.js); `shot.shake` scales the demo's shake (1 = the demo)
// THE MANDATORY FIVE SECONDS (owner, 2026-10-23: "it is too easy to skip the animation without meaning to, let's have the first 5 seconds mandatory,
// then a skip with spacebar is feasible"): `shot.lock` seconds of the cut nothing skips, then only `shot.skipKey` does (src/fx/camera-shot.js), the
// `shot.hint` line shown from the lock's end to the cut's end
const freeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) freeze(v); return Object.freeze(o); };
export const REINFORCEMENTS = freeze({
  days: 3, pace: 0.25, gaitCap: 4, roles: ['arena', 'arena', 'base', 'hunt'], offsetCells: 5, scale: 0.75,
  weapons: ['rotor', 'lancer', 'quiver', 'quiver'], bossShare: 0.1,   // THE PAIR JOINS, THE GUNSHIP DECIDES (2026-10-23, the merge of the two overnight branches: two Ridgebacks' TALON volleys took her 180 in 34 s): their rounds deal this share to a body-led boss (src/td-tab.js damageEnemy); every other enemy takes the full round
  keepFromHull: 2, lodMetres: 140, fade: 20, patrolCells: 14,
  timeline: {
    duration: 28, release: 6.2, capsuleGap: 0.45, slotGap: 0.18, brake: 0.8, entry: 480, split: 300, splitSink: 4, fallTo: 12, capsuleX: 6,
    landings: [[-6, -4], [-3, 4], [4, -3], [7, 5]], fallTimes: [6, 6.25, 6.55, 11.6], shellGone: 3.5, groundCamera: [16.5, 18], ground: [9.75, 0.2, 7],
  },
  sounds: { entry: 'feids_reentry', woosh: 'mech_reentry_woosh', impact: 'mech_landing_impact', wooshLead: 4 },
  models: { capsule: 'assets/models/feids26/feids26_d0_lod1.glb', mech: 'assets/models/ridgeback/mx06_d0_lod1.glb', mechFar: 'assets/models/ridgeback/mx06_d0_lod2.glb' },
  shot: { id: 'feidsDrop', easeIn: 1.2, near: 0.00025, shake: 1, lock: 5, skipKey: ' ', hint: 'SPACE · SKIP' },
  briefs: { called: 'reinforcements_called', inbound: 'reinforcements_inbound' }, callout: 'REINFORCEMENTS CALLED', landedCallout: 'REINFORCEMENTS LANDED',
});
