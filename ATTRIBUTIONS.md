# Third-party assets

Everything else in `assets/` is ours. This file records what is not, and on
what terms — checked before the asset was committed, not after.

## meshoptimizer — GLB decoder

- **File:** `vendor/meshopt_decoder.module.js`
- **Source:** meshoptimizer, by Arseny Kapoulkine (shipped with three.js as
  `examples/jsm/libs/meshopt_decoder.module.js`)
- **Terms:** MIT.
- **Why it is here:** every packed release model uses
  `EXT_meshopt_compression`, and GLTFLoader throws on the first compressed
  buffer view without a decoder — the model does not degrade, it vanishes.
  Safe to vendor in a way a versioned three.js addon is not: standalone code
  with embedded WASM and no three.js imports, so it cannot disagree with our
  r160.

## Sentry Workshop — Terraformer 3000 and sentry models

Source: https://github.com/jelaludo/SentryTowers_A6 at commit `90da0f2e45f69d3fab51318e16c70c39e335e97a`. The project owner's requested asset source. Exact transferred files and hashes are recorded in `docs/sentry-assets.lock.json`; upstream Terraformer integration notes are retained with the models. Stalheart adapts these assets to the sphere and preserves authored animation/pivots. No endorsement is implied.


## Sentry Workshop — DART missile kit and motion sampler

Source: https://github.com/jelaludo/SentryTowers_A6 at commit `4a75269d325c8ec12b87e38667d81bae124adeb4`, the owner's requested projectile source. `docs/missile-assets.lock.json` pins DART, its upstream README and the unmodified `missile-lab/flight.mjs` sampler (stored locally as `src/core/a6-missile-flight.js`). The Sentry range adapts the sampled motion for its own launch frames and targets; it does not play a second baked clip simultaneously.

## MÖRK hover tank test asset

Intact MÖRK GLB and accompanying documentation from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/8de41ecf6405ee46ca0cba3c51dc1c78a00c7043/assets/hover-tank), revision `8de41ecf6405ee46ca0cba3c51dc1c78a00c7043`. Pinned checksums: `docs/hover-tank-assets.lock.json`. The upstream Blender source stays in its authoring repository.

## Needle — dedicated Sentry sniper

Three Needle tiers from the owner's [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/722e49d59772597c7addd6db1de1880afd516885) source, revision `722e49d59772597c7addd6db1de1880afd516885`. Exact files and hashes: `docs/needle-assets.lock.json`. Needle replaces Howitzer in slot 7, preserving its authored articulation and muzzle sockets.

## Sinkhole study — Monolith Rift

Adapted from [LinearAbiltyCastingExtendedThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingExtendedThreeJS/tree/364c9ce70ba784809291e87981ca83a19560f73d), revision `364c9ce70ba784809291e87981ca83a19560f73d`, by mohamedachrefelouafi, MIT. License retained at `src/fx/sinkhole/LICENSE`. The four cathedral stone textures accompany the upstream import. Original and adapted checksums are recorded in `docs/sinkhole-assets.lock.json`. Local changes remove kinetic warp, force zero monoliths, use the existing Three r160, trim settings, and adapt texture paths. The host adds a floor opening and central subsidence; see `docs/SINKHOLE.md`.

## Sinkhole quake sound

Owner-provided `freesound_community-quake-and-break-99034.mp3`, retained unchanged as `assets/audio/sinkhole_quake.mp3`. Original filename, duration and checksum are recorded in `docs/breach-audio.lock.json`.

## Derived ordnance and sustained beam

`assets/models/ordnance/olive-shell.glb` and `src/content/shell-geometry.js` derive from the pinned SentryTowers_A6 DART asset credited above: body and band only, fin/nozzle assembly removed, olive recolour. See `docs/shell-assets.lock.json` and `scripts/derive-shell.mjs`.

`assets/audio/sentry_beam_sustain.wav` derives from the existing `Tower_Laser_beam-05.wav` source, using a sustain-only crossfade loop. It retains the source's asset terms; source and derived hashes are in `docs/beam-audio.lock.json`.

## SH02 rocket — jelaludo

Standalone SH02 vehicle with its five authored clips from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/d39f3a78e7d7022c532d8428dd4e1bcea4fb54e2/assets/sh-rocket), revision `d39f3a78e7d7022c532d8428dd4e1bcea4fb54e2`. Models and animations by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksum: `docs/sh-rocket-assets.lock.json`. The story lab plays the clips as authored and adds descent, effects and Isao at runtime.

## Launch plume shader — pulkitxm/claude-directory

`src/fx/launch-plume.js` ports the raymarched plume from [pulkitxm/claude-directory](https://github.com/pulkitxm/claude-directory) (`shaders/launch-shader`), MIT, as studied in the local onkochishin atelier (`atelier/launch`). The march loop and its constants are kept; the ray setup is rewritten for a camera-facing quad in a Three.js scene and an intensity uniform is added.

## Rocket thrust sound

Owner-provided `jci21-rocket-launch-sfx-253937.mp3`, retained unchanged as `assets/audio/rocket_thrust.mp3`. Original filename, duration and checksum are recorded in `docs/rocket-audio.lock.json`. The story lab loops it under the SH02 descent and cuts it at touchdown; the tank's own spool-up and spool-down pneumatics cover leg deployment, landing and the door.

## Game-ready base kit and island slab — jelaludo

Lightweight foundation, wall (D0-D3), corner and vehicle gate exports plus the scalable 28-triangle island slab from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/2de929660f014b5e56a66bce04d9a9707958b4fe/assets/base-kit-game), revision `2de929660f014b5e56a66bce04d9a9707958b4fe`. Models by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksums: `docs/base-kit-assets.lock.json`. The slab is scaled per island in X and Z with Y kept at 1, and the 4 m grid is drawn by the game's shader as specified in `docs/FOUNDATION-SLAB-BRIEF.md`.

## MÖRK transport container diorama, game tier — jelaludo

The three-bay armored transport container deployment scene at its game tier (17,456 triangles, 18 draws) with its `Tank_Roll_Out` clip, from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/de6c7d38d022598d796d505f024bd50cb454b02b/assets/hover-tank/containers), revision `de6c7d38d022598d796d505f024bd50cb454b02b`. Models and animations by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksum: `docs/container-assets.lock.json`. It stands on the story base's tank bay island; the game hides each parked hull as it is driven out and opens the sealed bay with a door swing authored from the model's own open bay.

## Solar power complex, game and distance tiers — jelaludo

The intact solar power complex at its LOD1 (game: 3,856 triangles, 7 draws) and LOD2 (distance: 2,752 triangles, 1 draw) tiers from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/b9dc51ad8294aa4ebe2e74d9eceeced71d401ac8/assets/solar-power), revision `b9dc51ad8294aa4ebe2e74d9eceeced71d401ac8`. Models by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksums: `docs/solar-lod-assets.lock.json`. The story base swaps the two by camera distance.

## A6 ammunition library — jelaludo

The Rotor's spent case at its game tier (94 triangles, one vertex-colour material) from the [ammunition library](https://github.com/jelaludo/SentryTowers_A6/tree/8ae723dfe91d437c817ae73cff0d5dcca3e16b46/assets/ammunition), revision `8ae723dfe91d437c817ae73cff0d5dcca3e16b46`. Models by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksums: `docs/ammunition-assets.lock.json`. The game instances it as ejected brass in sentry control; the per-weapon verdict on the rest of the library is `docs/AMMUNITION.md`.

## SYNTHETIC LEARNING x58 — the owner's CRT neural-net panels

`vendor/synthetic-learningx58/` holds the seven Canvas 2D visualisations and their CRT helper from the owner's own [synthetic-learningx58](file:///Users/minikai/Documents/Dev/synthetic-learningx58) (commit `7a627f5`, pure ES modules, no dependencies), unmodified. The story shows them as Isao's study screen after the Quiver beat.

## Packed release copies and derived far tiers

The release build packs every model with [gltfpack](https://github.com/zeux/meshoptimizer) (MIT, Arseny Kapoulkine): meshopt compression and quantisation, geometry otherwise unchanged. `assets/models/far/*.glb` are simplified copies of the story landmarks above, derived with the same tool at a tenth of the triangles and pinned in `docs/far-tier-assets.lock.json`; the same authors and licence as their sources apply.

## Single SKYWARD antenna, game tier — jelaludo

The 18 m steerable antenna at its low/game detail (1,632 triangles) with its `Array_Slew` clip, from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/e846906954abc1c3600c2bccd812857a75874073/assets/antenna-array), revision `e846906954abc1c3600c2bccd812857a75874073`. Models and animations by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksum: `docs/antenna-assets.lock.json`. It stands on the story base's radar island; the seven-dish array remains an Astro-only diorama.

## Gate sounds

Two operator clips reused from the karyoku project, unchanged: `assets/audio/gate_hydraulics.mp3` is karyoku's `assembly_hydraulics.mp3` (built there from the operator's hydraulic master) and `assets/audio/gate_slam.mp3` is karyoku's `crush_slam.mp3` (universfield 123784, trimmed, mono). Checksums in `docs/story-audio.lock.json`. The armored gate plays the hydraulics when it starts opening and the slam when it has closed.

## SOL-82 orbital laser platform — jelaludo

The detailed master tier (LOD0) and manifest of the SOL-82 orbital laser combat satellite from [SentryTowers_A6](https://github.com/jelaludo/SentryTowers_A6/tree/b3fe793e35cf94b10c481e262fb2e3324b4dfce4/assets/sol82), revision `b3fe793e35cf94b10c481e262fb2e3324b4dfce4`, the owner's requested source. Models and animations by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksums: `docs/sol82-assets.lock.json`. Used for the laser lab's SOL-82 briefing (`src/fx/sol82-briefing.js`), drawn as cyan wireframe.

## Capture flag and cargo crate — jelaludo

The Void banner from the [capture-the-flag kit](https://github.com/jelaludo/SentryTowers_A6/tree/4a75269d325c8ec12b87e38667d81bae124adeb4/assets/ctf-flags) (skinned cloth with its `Flutter`, `Gust`, `Raise` and `Lower` clips) and the intact stackable cargo crate from the [warehouse props](https://github.com/jelaludo/SentryTowers_A6/tree/4a75269d325c8ec12b87e38667d81bae124adeb4/assets/warehouse-props), revision `4a75269d325c8ec12b87e38667d81bae124adeb4`. Models and animations by jelaludo, reused with attribution under the upstream `ASSET-LICENSE.md`. Pinned checksums: `docs/cargo-assets.lock.json`. The game recolours the banner's cloth to its own white and cyan at runtime (`src/fx/cargo.js`) and uses the pair for the expeditions: a flag over a cleared landing site, the part's crate on the MÖRK's back deck, and a trophy flag on the landing island for each part brought home.
