# Sentry asset adoption

MÖRK intact D0 is an optional test tank: `labs.html?unit=mork#units` and `index.html?creature=mork&cine=0#td`. `docs/hover-tank-assets.lock.json` pins revision `8de41ecf6405ee46ca0cba3c51dc1c78a00c7043`. `src/mork.js` retains 24,196 triangles, reduces 70 source batches to 50, preserves every animated pivot and muzzle, and clones instance resources for safe Workshop disposal. Authored power poses follow the existing game hover progress; recoil uses the authored 1.4-second sequence. The game still carries nine shells (one lens each). D1–D3 are not imported; this is presentation testing, not a default replacement or a capacity/balance change. Device frame-time comparison remains pending.

Preferred upstream: [Sentry Workshop](https://jelaludo.github.io/SentryTowers_A6/) / [source repository](https://github.com/jelaludo/SentryTowers_A6), pinned initially to `90da0f2e45f69d3fab51318e16c70c39e335e97a`.

`docs/sentry-assets.lock.json` is the reproducible download/checksum boundary. Existing sentry files are matched to the upstream Git blob IDs before assigning provenance. Terraformer assets were downloaded from that exact commit, checked as self-contained GLB 2.0 files and retain the upstream README and manifest beside them. `docs/asset-inventory.json` inventories all inherited runtime/source assets; unknown upstream provenance is explicitly inherited, not guessed.

The current adapter in `src/terraformer.js` preserves every animated track's node before merging stationary geometry by material. The game retains its outer sphere-normal transform; the asset keeps its own animation hierarchy. D1–D3 use D0's fit transform, so destruction cannot enlarge a collapsed machine. Only the active damage state is loaded on demand; use the existing default for the small initial download.

The upstream README describes D0/D1 as functional and D2/D3 as disabled. For this first asset-only adoption, those are visual states: switching models does not change the Terraformer's supply mechanics or win condition. Turning functional state into a gameplay rule is a separate balance decision.

Priority reuse path:

1. Verify current tower articulation/muzzle contracts and Terraformer prototype in the real board lighting and curvature.
2. Produce an upstream optimized Terraformer/LOD while retaining all animated joints and common-origin damage states. Re-measure draw calls, geometry, loading, frame time and legibility.
3. Consider upstream logistics containers, station crew and construction props where they replace existing roles. Import through adapters with explicit scale, collision, sockets, animation and material contracts.
4. Adopt damaged building states as presentation first; introduce new supply/collision/gameplay effects only through deliberate mission rules.

Do not use the upstream viewer's CDN Three.js modules in Stalheart; the GLBs are renderer-independent inputs, and the game remains on one vendored renderer. Never infer LOD from a file's D-number. Never switch a pinned revision without checksums, a visual/animation acceptance pass and a decision entry. Keep bulky source `.blend` files in the authoring project rather than this release.
