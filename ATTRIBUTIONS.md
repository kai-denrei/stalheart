# Third-party assets

Everything else in `assets/` is ours. This file records what is not, and on
what terms — checked before the asset was committed, not after.

## NASA — 70-metre Deep Space Network dish

- **File:** `assets/models/dish70.glb`
- **Source:** <https://science.nasa.gov/3d-resources/70-meter-dish/>
  (repo: <https://github.com/nasa/NASA-3D-Resources>)
- **Credit:** NASA / Ames Research Center
- **Terms:** NASA-3D-Resources states *"These assets are free and without
  copyright."* NASA's media guidelines add that *"NASA content – images,
  audio, video, and media files used in the rendition of 3-dimensional
  models, such as texture maps and polygon data in any format – generally are
  not subject to copyright in the United States."*

Three conditions come with that, and all three were checked:

1. **No insignia.** *"The NASA Insignia, Logotype, identifiers, and imagery
   are not in the public domain… protected by law."* The real 70-metre dishes
   at Goldstone wear the meatball, so the model's texture was extracted and
   inspected before committing: a single greyscale baked-lighting atlas
   (webp, with a jpeg fallback), one material, no logo, wordmark or text of
   any kind. Nothing to strip.
2. **No endorsement.** NASA must not appear to endorse anything. The dish is
   set dressing; nothing in the game claims a NASA association, and the
   credit here is factual attribution rather than a badge.
3. **No third-party rights.** NASA marks material it does not own. This one
   is credited NASA/Ames throughout, so it is NASA's own.

Technical notes for whoever touches it next: 14,852 triangles, 1 material,
and it uses `EXT_texture_webp` — supported by our vendored GLTFLoader, but
worth knowing if the loader is ever replaced.

## meshoptimizer — GLB decoder

- **File:** `vendor/meshopt_decoder.module.js`
- **Source:** meshoptimizer, by Arseny Kapoulkine (shipped with three.js as
  `examples/jsm/libs/meshopt_decoder.module.js`)
- **Terms:** MIT.
- **Why it is here:** `assets/models/astronaut-compact.glb` uses
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
