# THE DROP, ROUND 2 — the mandatory five seconds and the heavy gait (2026-10-23, branch `drop-round-2` from `overnight-2026-10-23`)

Owner, 2026-10-23 10:40 JST, second test: "1) it is too easy to skip the animation without meaning to, let's have the first 5 seconds mandatory,
then a skip with spacebar is feasible. 4) the Mechs style glide too much in their locomotion, the https://jelaludo.github.io/SentryTowers_A6/ridgeback-mech/
default animation does it better; no gliding, feeling of heaviness."

## Decisions

1. **The drop's cut (note 1).** src/fx/camera-shot.js `start` takes two more options: `lockFor` (seconds during which nothing skips) and `skipKey`
   (when set, only that key skips; taps do not). The drop's cut (src/fx/reinforcements-host.js) passes `lockFor: REINFORCEMENTS.shot.lock` (5) and
   `skipKey: ' '` (content: `shot.lock: 5, shot.skipKey: ' '`). Every other shot keeps today's rule (any key, any tap, modifier chords excepted).
   From the lock's end to the cut's end a hint line reads `SPACE · SKIP` at the bottom centre of the screen in the gunship briefing footer's style
   (src/fx/gunship-briefing.js: its `<footer><span>SPACE OR CLICK · NEXT</span>` markup and class names, no new colours, no emoji), created by the
   host when the lock ends and removed at the cut's end or skip. The node test of the skip rule (test/camera-shot*.mjs, if one exists; else add
   one) covers: inside the lock nothing skips; after it only the skipKey skips; a tap does not; other shots unchanged. The browser step
   `--reinforcements` checks: a plain key at drop t 2 s leaves the cut running, Space at 6 s ends it (today's check at 27 s moves).
2. **The heavy gait (note 4).** The in-place `Walk_Cycle` clip goes as the mechs' walk (it stays in the GLB; the landing clip `Airdrop_Land`
   stays as it is). The walk is the demo's procedural gait ported into a new fx module `src/fx/mech-gait.js` from
   `~/Documents/kainode-vault/projects/stalheart-feids26-peek/assets_ridgeback-mech_runtime.js` (LEGS, STANCE_DUTY, UPPER, LOWER, DURATION,
   policy(0), walkSpeed, poseLeg, solveHydraulics, the body/legs part of applyMech — NOT its gun lines: MINIGUN/LASER/MISSILE/SENSOR pivots stay
   the squad's own aim) plus the demo's heaviness rule from `ridgeback-mech_behavior.js` `pose()`: a stance foot is anchored to the world point
   where it landed and poseLeg aims at that anchor (so a planted claw never slides whatever the body does), a swing foot leaves its anchor over
   (1-q)^2. The gait phase advances at `rate = groundSpeed / (walkSpeed(0) * REINFORCEMENTS.scale)` (the demo's walkSpeed is 0.2778 m/s at scale 1;
   at 0.75 it is 0.208 m/s). The pace drops to make the gait heavy: `REINFORCEMENTS.pace` 0.25 -> 0.08 cells/s (0.8 m/s, rate ~3.8, one leg cycle
   about 1.05 s; the demo's aggressive pursuit tops at rate 2.9); `gaitCap` goes (no clip to cap). Say in the report how long the base mech's
   march to the gate takes at 0.08 (it was 263 hops from the heart in the overnight run) so the owner can weigh the pace against the look.
   The anchors live in the drop's tangent frame as world points (THREE.Vector3 on the unit sphere, scaled by metres: the squad already stands
   each mech on src/domain/surface-frame.js); the stance test is `u < STANCE_DUTY` with u from the phase and the leg's phase offset, as the demo.
   Body bob and roll as the demo's `walking` branch (weight 1). Standing still: the demo's park pose (six feet planted, legs at leg.fx/leg.fz).
   The instancing after landing (one InstancedMesh a part, the parts lending world matrices) and the far tier keep working: posing the hidden
   rig's nodes is all the gait does. A node test on the pure part (the stance/swing schedule and the anchor rule, in test/mech-gait.mjs):
   over 10 s at rate 3.8 every stance foot's world point is constant to 1e-9 while the body advances 8 m; the swing foot lands at the body's
   new target; the phase offsets keep three feet down at every instant of the cycle (the tripod).
   Browser: `--reinforcements` adds, 30 game s after landing, for the hunt mech: the gait rate reported in `state().reinforcements.mechs[i].gait`
   ({ rate, contacts }) is within 10 % of groundSpeed/(0.2778*0.75), and contacts >= 3 at every sample; `--feids-shots` adds a frame at 40 s
   (the base mech walking) for the owner.

## Out
Mech damage, the leg fold in the shell, the hunt behaviour, any change to the drop cinematic itself.

## Order
1 (skip + hint, tests) -> 2 (gait: the pure module + test, then the squad's hook, then the browser checks) -> records (deban entry, STATE paragraph).
