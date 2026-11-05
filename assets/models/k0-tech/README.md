# K0-TECH-01 / Felis (D0, LOD1 + LOD2)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/k0-tech-01/`, revision cd0b1349168beef51fef2601f93a8e4d612072c3; https://jelaludo.github.io/SentryTowers_A6/k0-tech-01/). A compact lynx-point feline robot: faceted beige and porcelain armour, an industrial sensor head with a blue-coated optical cassette (`KHR_materials_clearcoat`, opaque; the game's wireframe replaces the materials anyway), paddle antennas, a short ringed tail. Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z forward, ground origin under the torso, standing 0.30 x 0.41 x 1.05 m (48.9 % of C-07's height). Clips on LOD1 at 120 fps, in place unless noted: `Watch_Idle` (3 s loop), `Feline_Walk_Cycle` (1.6 s, 0.2383 m/s), `Stalk_Cycle` (2.4 s, 0.0893 m/s), `Gallop_Cycle` (0.4 s, 2.6889 m/s), `Sit_Down` (2.4 s, holds), `Pounce` (3.2 s, 1.6 m of root travel on MOTION: played as a trick, never a gait), `Roll_Over` (5.6 s), `Give_Paw` (4.4 s). `SENSOR_YAW` is engine-driven. Clone with SkeletonUtils (the game's cloneFixture). LOD2 is one static draw, no clips.

| file | upstream | sha256 | bytes | tris | draws |
| --- | --- | --- | ---: | ---: | ---: |
| k0_tech_d0_lod1.glb | k0_tech_01_d0_lod1.glb | 9c1844d47c3953f4b456190459a1ca9bcc4778effed1166a787c2ac18d937754 | 1,852,732 | 14,878 | 7 |
| k0_tech_d0_lod2.glb | k0_tech_01_d0_lod2.glb | 8693a1d93da2b65bcd4499847d243d0ec1f02a7ca20d289732a6353f9d2649df | 241,540 | 2,980 | 1 |

Used by the base companions (src/content/companions.js unit `k0`, src/fx/companions.js), printed by Isao after the greenhouse (src/fx/pet-print.js). Pins: docs/companions-assets.lock.json (`npm run assets:check`).
