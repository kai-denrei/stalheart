# C-07 Mechanical Cheetah (D0, LOD1 + LOD2)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/mechanical-cheetah/`, revision ab4642deb90836628ee5f7c8b0049ec9a7b5dfae). Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z forward, ground origin under the torso, standing 0.48 x 0.85 x 2.78 m. Clips on LOD1, in place unless noted: `Watch_Idle` (3 s loop), `Feline_Walk_Cycle` (1.6 s, 0.5417 m/s), `Stalk_Cycle` (2.4 s, 0.203 m/s), `Gallop_Cycle` (0.4 s, 6.111 m/s), `Sit_Down` (2.4 s, holds), `Pounce` (3.2 s, 1.2 m of root travel on MOTION), `Roll_Over` (5.6 s), `Give_Paw` (4.4 s). `SENSOR_YAW` is engine-driven. LOD2 is one static draw, no clips.

| file | sha256 | bytes | tris | draws |
| --- | --- | ---: | ---: | ---: |
| c07_d0_lod1.glb | 6b93f1efb2e888499666106438b268bb53af88de8e2657f5efb664a8099c83e7 | 1,537,756 | 12,760 | 6 |
| c07_d0_lod2.glb | 64a4f6a97e3f1f285f5ba6400c9da1e02c405beae20b3e67b71019794762e6e8 | 232,288 | 2,848 | 1 |

Used by the base companions (src/fx/companions.js). Pins: docs/companions-assets.lock.json (`npm run assets:check`).
