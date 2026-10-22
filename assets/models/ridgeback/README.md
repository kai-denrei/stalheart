# MX-06 Ridgeback (D0, LOD1 + LOD2)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/ridgeback-mech/`, revision 38eed564831b1be30e406f261da7052485eeeb87). Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z forward, ground-centred `MX06_ROOT`, 8 x 8 m plot. Clips on LOD1: `Walk_Cycle` (4 s loop, in place: root speed 0.27778 m/s at rate 1) and `Airdrop_Land` (7 s one-shot, touchdown at 2.6 s, drives `DROP_ROOT`). Weapon pivots `MINIGUN_YAW/PITCH/SPIN`, `LASER_YAW/PITCH`, `MISSILE_ELEVATION` are engine-driven. LOD2 is one static draw.

| file | sha256 | bytes | tris | draws |
| --- | --- | ---: | ---: | ---: |
| mx06_d0_lod1.glb | 6ed3777ce5935f117dfc3d2585db005ad6f105450f247d32673468faab059306 | 967,180 | 8,016 | 38 |
| mx06_d0_lod2.glb | 655d21aca433b7a36402e40cfa76bec45f35cacf9f025e8e435a43bdacfbe25c | 201,112 | 2,936 | 1 |

Used by the FEIDS-26 reinforcements (src/fx/feids-drop.js, src/fx/mech-squad.js). Pins: docs/feids26-assets.lock.json (`npm run assets:check`).
