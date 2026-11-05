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

## Landmark sources

Models and animations by **jelaludo** — https://jelaludo.github.io/SentryTowers_A6/, reused with attribution under the upstream `ASSET-LICENSE.md`. `docs/astro-assets.lock.json` and `docs/astro-industry-assets.lock.json` pin the story's landmark sources at `b22a8c9a6e04d40819b68859624f362d6bff8680`: Stålheart (Terraformer 3000) and the HUGIN launchpad game versions, and the robotic assembly line. They keep authored metre scale, +Y up, +Z forward, rigs and clips. The Astro diorama's crew, SKYWARD array, warehouse, reactor, full solar complex and foundation tile retired with that lab on 2026-09-14; the crew will return as new lower-poly exports. D0 is an intact destruction state, not an LOD.

## Companions and reinforcements

Models by **jelaludo** — https://jelaludo.github.io/SentryTowers_A6/, reused with attribution under the upstream `ASSET-LICENSE.md` (credited in `ATTRIBUTIONS.md`, "Models by jelaludo"). Game tier LOD1 in the game, static LOD2 at distance; metres, +Y up, +Z forward, authored clips and pivots kept.

| unit | folder | revision | lock |
| --- | --- | --- | --- |
| C-07 Mechanical Cheetah | `assets/models/c07/` | `ab4642de` | `docs/companions-assets.lock.json` |
| RECKON K9 | `assets/models/reckon-k9/` | `ab4642de` | `docs/companions-assets.lock.json` |
| K0-TECH-01 | `assets/models/k0-tech/` | `cd0b1349` | `docs/companions-assets.lock.json` (per-entry `baseUrl`) |
| Nih-Dairia mech (tripad v1.1, no clips; `runtime.js` kept, ported as `src/domain/mech-pose.js`; creature reference kai-denrei/lab-creatures) | `assets/models/nih-dairia-mech/` | `cd0b1349` | `docs/companions-assets.lock.json` (per-entry `baseUrl`) |
| FEIDS-26 delivery capsule | `assets/models/feids26/` | `38eed564` | `docs/feids26-assets.lock.json` |
| MX-06 Ridgeback | `assets/models/ridgeback/` | `38eed564` | `docs/feids26-assets.lock.json` |

## The Dome City — the Dome Colony modules

Models by **jelaludo** — https://jelaludo.github.io/SentryTowers_A6/, the owner's own, reused with attribution under the upstream `ASSET-LICENSE.md` (credited in `ATTRIBUTIONS.md`, "Models by jelaludo"). Round 8 note 6 (2026-11-06): the second layout of the base, `?base=dome` (`src/content/dome-city.js`, placed by the pure `withBaseLayout` in `src/content/base-layout.js`). D0 only, game tier LOD1 near and the static one-draw LOD2 beyond `KIT.lod.metres`; plain GLBs, meshopt-packed into dist by the build; metres, +Y up, +Z forward, no baked clips (`MOUNT_YAW` / `CRADLE_PITCH` are engine pivots, not driven yet: the domes' sentry cradles are a follow-up). The connected port caps (`PORT_CAP_N` / `PORT_CAP_S`) are hidden by name on the linked side; the LOD2 files keep those names as empty nodes. The author's `layout.json` (nine domes on an 80 m grid, twelve bridges) is the reference, kept in the vault; the game places six domes and four bridges (the reading is in the module's header).

| module | folder | placed | revision | lock |
| --- | --- | --- | --- | --- |
| habitat dome (LOD1 5,880 tris, 8 draws; LOD2 2,304, 1) | `assets/models/dome-colony/` | `dome-nw`, `dome-sw` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| biosphere dome | `assets/models/dome-colony/` | `dome-w` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| fabrication dome | `assets/models/dome-colony/` | `dome-e` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| logistics dome | `assets/models/dome-colony/` | `dome-ne`, `dome-se` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| 52 m long bridge (`bridge_long`, LOD1 1,060 tris, 2 draws) | `assets/models/dome-colony/` | `bridge-w1`, `bridge-w2`, `bridge-e1`, `bridge-e2` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| research and power domes | `assets/models/dome-colony/` | pinned, not placed (the Stålheart is the power dome; the north centre is the mouth corridor) | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| YushiRover biomass recovery rover (LOD1 driven by its unchanged `runtime.js`, `src/fx/rover.js`; LOD2 pinned, not shown: a frozen pose) | `assets/models/yushi-rover/` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| Yūshi045 Bio-Pearl (LOD1 near, LOD2 far, the capacity shader through its unchanged `runtime.js`, `src/fx/bio-pearls.js`; ships UNPACKED: gltfpack drops its `_YUSHI` attribute, `scripts/build.mjs`) | `assets/models/yushi045/` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
| SAI-92 mining hopper and its service bay (LOD1 near, LOD2 far, static on the depot island this round) | `assets/models/sai92/` | `40c23fa4` | `docs/a6-settlement-assets.lock.json` |
