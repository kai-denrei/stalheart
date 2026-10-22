# FEIDS-26 delivery capsule (D0, LOD1 + LOD2)

"Models by jelaludo", the owner's own (SentryTowers_A6 `assets/feids26/`, revision 38eed564831b1be30e406f261da7052485eeeb87). Plain GLB is the source of truth; the build meshopt-packs it. Metres, +Y up, +Z nose, ground-centred `FEIDS26_ROOT`, shell axis at Y 3.8 m; cargo sockets `SOCKET_CARGO_1` (0, 2.05, -2.2) and `SOCKET_CARGO_2` (0, 2.05, 2.2); quarters `SHELL_QUADRANT_1..4`, clip `Shell_Separate` (4 s, LOD1 only; LOD2 is static and closed).

| file | sha256 | bytes | tris | draws |
| --- | --- | ---: | ---: | ---: |
| feids26_d0_lod1.glb | 1c57a8eedaa3fbc2b14c9b481c936a86b06edf2988ecc5885dda3db635166472 | 126,428 | 1,568 | 4 |
| feids26_d0_lod2.glb | 85ee908ef693d0183c819d9fe7b0eb791cc2dab0e84f7bf787110ecf8246c4fd | 30,324 | 864 | 1 |

Used by the reinforcements drop (src/fx/feids-drop.js, src/domain/reinforcements.js). Pins: docs/feids26-assets.lock.json (`npm run assets:check`).
