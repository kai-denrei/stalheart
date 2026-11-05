# Nih-Dairia / Isao mechanical study, tripad v1.1 (D0, LOD1 + LOD2, runtime.js)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/nih-dairia-mech/tripad/`, revision cd0b1349168beef51fef2601f93a8e4d612072c3; https://jelaludo.github.io/SentryTowers_A6/nih-dairia-mech/). Creature concept reference: kai-denrei / lab-creatures, https://kai-denrei.github.io/lab-creatures/?specimen=nih-dairia (no creature geometry or reference images redistributed). Isao watched a Nih-Dairia and built a mechanical analogue: a low radial chassis, six articulated limbs with carbon hydraulic sleeves, ivory armour petals, three ivory pads a foot. Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z forward, `NIH_DAIRIA_MECH_ROOT` at ground level and the plot centre; the observation pose is 6.60 x 1.82 x 7.59 m on a 9 x 9 m plot.

NO baked clips (`clips: []` is intentional): the motion is `runtime.js` (`applyPose(root, time, mode, reachScale)`), kept here unchanged as the reference and ported as src/domain/mech-pose.js (test/mech-pose.mjs holds the port to it), written onto the bones by src/fx/mech-pose.js. Motions: `Observation_Idle` (6 s loop), `Tripod_Walk_Cycle` (3 s loop, in place, 0.30 m/s translation contract: the caller moves the body), `Reach_Cycle` (8 s loop, the front pair 02 + 06), `Anchor_Deploy` (8 s one-shot, BODY_HEAVE carries 0.55 m of advance). 49 control bones (`BODY_HEAVE`, `LEG_01..06` with `_YAW _HIP _KNEE _SLIDE _ANKLE _CLAW_1..3`), 27 sockets. LOD2 is one static draw (`DISTANCE_GEOMETRY`), not posed.

| file | upstream | sha256 | bytes | tris | draws |
| --- | --- | --- | ---: | ---: | ---: |
| nih_dairia_mech_d0_lod1.glb | tripad/lod1/nih_dairia_mech_tripad_d0_lod1.glb | c4ebc598274064f41023a07a6537d6a9a6c2a6a8cfd9a00750b49ab81b1f77aa | 954,016 | 19,104 | 3 |
| nih_dairia_mech_d0_lod2.glb | tripad/lod2/nih_dairia_mech_tripad_d0_lod2.glb | b5f88cba9c9b5762e4c7fc450ed6cb5327a10bc8355c9e69fdf01150eabfae59 | 76,908 | 2,256 | 1 |
| runtime.js | runtime.js | 1d7c81cc9c114d5331049b9417e59327adc6ea92b681504981f8f73a1cc6cd60 | 4,802 | | |

Used by the base companions (src/content/companions.js unit `mech`, src/fx/companions.js), printed by Isao after THE ARENA's kill (src/fx/pet-print.js). Pins: docs/companions-assets.lock.json (`npm run assets:check`).
