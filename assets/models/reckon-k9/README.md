# RECKON K9 (D0, LOD1 + LOD2)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/reckon-k9/`, revision ab4642deb90836628ee5f7c8b0049ec9a7b5dfae). Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z forward, ground-centred origin, standing 0.48 x 0.96 x 1.42 m. Clips on LOD1, in place unless noted: `Alert_Idle` (3 s loop), `Walk_Cycle` (1.4 s, 0.357 m/s), `Run_Cycle` (a trot, 0.5 s, 2.182 m/s), `Pace_Cycle` (0.9 s, 0.9 m/s), `Canter_Cycle` (0.45 s, 2.24 m/s), `Gallop_Cycle` (0.4 s, 3.1 m/s), `Sprint_Cycle` (0.3 s, 4.43 m/s), `Sit_Down` (2.4 s, holds), `Roll_Over` (4.8 s), `Fetch_Return` (8 s, root motion), `Give_Paw` (4 s), `Jump` (2 s). `SENSOR_YAW` is engine-driven. LOD2 is one static draw, no clips.

| file | sha256 | bytes | tris | draws |
| --- | --- | ---: | ---: | ---: |
| reckon_k9_d0_lod1.glb | ff120abd7ff1db5d40e137aba17696cf980f97be968e62ef165571723a99c0fa | 1,630,292 | 9,732 | 6 |
| reckon_k9_d0_lod2.glb | 95eb20786426bc40796c3f3bcc40b1eb0a5bc8ad5237b1846045942f55551a3e | 190,764 | 2,484 | 1 |

Used by the base companions (src/fx/companions.js). Pins: docs/companions-assets.lock.json (`npm run assets:check`).
