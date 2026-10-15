# Local asset provenance

All assets are frozen local copies. No runtime hotlinks or source repositories are modified.

| Local file | Source |
| --- | --- |
| `vendor/three.module.js` | `../stalheart/vendor/three.module.js`, Three.js r160, MIT (license below) |
| `assets/fonts/ShareTechMono.woff2` | Stalheart's font bundle; Share Tech Mono, SIL Open Font License |
| `assets/fonts/VT323.woff2` | Stalheart's font bundle; VT323, SIL Open Font License |
| `assets/models/ovum.bin`, `ovum.json` | `../Jelly-Baby/src/assets/model/ovum.*`, manifest source `ovum-spider-v3`; used as the nursery mother with its native soft-body cage and six-limb behavior |
| `assets/models/reed.bin`, `reed.json` | `../Jelly-Baby/src/assets/model/reed.*`; original Reed cage and surface, driven by its native physical reach/plant/pull cycle |
| `src/fx/gorogoro/` | Jelly-Baby’s native Cutis-Gorogoro kit from `../Jelly-Baby/src/cutis/swarm/` and `src/cutis/creature/`: TypeScript transpiled to standalone JavaScript, imports adapted to vendored Three.js; original shaders retained, GPL-3.0 license included |
| `src/fx/reed/` | Frozen Creature Lab `../Jelly-Baby/src/monster/` behavior, pursuit, gait, traction and support modules plus `src/physics/` cage parser, soft-body solver and embedded WASM kernel. TypeScript stripped; math/geometry imports use vendored Three.js r160; unused WebGPU prey-rendering functions omitted. Original C kernel source and GPL-3.0 license included. `src/reed.js` owns Reed timing and surface-frame integration; `src/queen-motion.js` reuses the same native runtime with the Ovum cage and a slower clock. |
| `assets/audio/isao_hit_wall.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/IsaoHittingCaveWall.mp3`, copied unchanged |
| `assets/audio/isao_hit_enemy.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/IsaoHittingSlimeyEnemy.mp3`, copied unchanged; slime creatures, eggs and Queen contacts |
| `assets/audio/isao_hit_tentacle.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/IsaoHittingAWallTentacle.mp3`, copied unchanged |
| `assets/audio/queen_laying_eggs.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/IsaoCave_TheQueenLayingEggs.mp3`, copied unchanged; first Queen encounter |
| `assets/audio/alien_murmur.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/Stalheart_GenericCutisSounds.mp3`, copied unchanged; faint filtered distant calls |
| `assets/audio/alien_reverb.mp3` | User-provided `~/Downloads/IsaoCaveSoundsd/IsaoCaveSounds_AlienReverb.mp3`, copied unchanged; faint quiet-time atmosphere |
| `assets/audio/sinkhole_quake.mp3` | Stalheart's existing sinkhole sound |
| `assets/audio/isao_strike_countdown.mp3` | Exact copy of Stalheart’s `assets/audio/isao/sol_firing_03.mp3`: “Strike inbound. Three. Two. One.”; authored number onsets 1.2226, 2.2226, 3.2226 s, duration 3.869 s; starts with 4.2226 s left on the fuse |
| `assets/audio/blast_fire.mp3` | Stalheart's existing explosion sound |
| `assets/audio/rotor_spin.wav` | Stalheart's rotor sound, retained for comparison; current flight loop is synthesized |
| `src/stalheart/sinkhole-shape.js` | Exact copy of Stalheart’s shared sinkhole boundary and bowl contract |
| `src/stalheart/looks.js` | Exact copy of Stalheart’s look definitions; entrance uses `tronColors` |
| `src/sinkhole.js` | Open-bowl adapter extracted from `../stalheart/src/sinkhole-terrain.js`; same 192 × 24 bowl, UVs, 36 rim rocks, and seven cyan contours; bottom cap removed for flight |
| `assets/models/isao_birudoron_lod1.glb` | Actual ISAO-Birudorōn model and its rotor/face clips from `../stalheart/assets/models/isao/` |
| `vendor/GLTFLoader.js`, `BufferGeometryUtils.js`, `ConvexHull.js` | Three.js r160 utilities copied from Stalheart (MIT) |
| `src/fx/cutis-maku/` | Cutis kit copied from `../stalheart-bestiary/src/fx/cutis-maku/`, itself ported from Jelly-Baby; GPL-3.0 license included in that directory |
| `src/stalheart/pearl-enemies.js` | Exact bestiary tier definitions; the tunnel inhabitants use `Cutis-Soft Ivory` |
| `scripts/chrome-proc.mjs` | Stalheart's owned-process browser lifecycle utility |

Hashes are recorded in `assets.lock.json`. The game assets retain their source ownership; this experiment does not grant a new redistribution license. The prototype was requested for the owner's existing Stalheart world and local creature library.

## Three.js license

The MIT License

Copyright © 2010–2023 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
