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
