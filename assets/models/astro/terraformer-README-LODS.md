# Stålheart runtime LOD candidates

Stålheart now has separate LOD1 and static LOD2 files for every authored damage state. The original detailed GLBs remain preserved beside them. These are current-contract candidates, not a game-readiness claim: the game camera and reference phone must still establish the final swap distance and performance.

| State | LOD1 triangles / draws / plain bytes | LOD2 triangles / draws / plain bytes |
| --- | ---: | ---: |
| D0 | 7,342 / 10 / 329,364 | 2,173 / 1 / 75,836 |
| D1 | 7,342 / 10 / 329,980 | 2,167 / 1 / 76,276 |
| D2 | 7,177 / 1 / 227,376 | 2,171 / 1 / 76,780 |
| D3 | 7,146 / 1 / 210,524 | 2,196 / 1 / 73,052 |

LOD1 D0/D1 preserve the named 16-second `Terraforming_Cycle` on the nine primary machine controls: gantry, carriage, tool lift and J1–J6. Static geometry is consolidated separately under those controls. The forty individually keyed flexible-feed segments are intentionally omitted at this tier; they cost animation channels without reading at the intended distance. Reservoir feeds and the primary machine silhouette remain. D2/D3 have no clip, matching the disabled detailed states. LOD2 is one static vertex-colour mesh and one material; required lookup nodes remain but do not articulate its merged geometry.

Use LOD2 for initial map, loading and far views. The collaboration contract’s provisional landmark approach threshold is 150 m with 20 m hysteresis; confirm that in the game camera and on the reference phone before release. Use LOD1 before fabrication motion needs to read. LOD0 remains for recordings.

`manifest-lods.json` records hashes, source hashes, dimensions, exact metrics, selection metadata, sockets, colliders, clips and review state. Plain GLB is the source of truth. The `.meshopt.glb` files are optional derived copies and have also been decoded during validation.

Rebuild and validate from the project root:

```sh
node tools/asset-pipeline/build-landmark-lods.mjs
node tools/asset-pipeline/validate-landmark-lods.mjs
```

The reduction is a library-authored derivative of the preserved detailed plain GLBs. It uses topology-preserving Meshoptimizer simplification and a shared vertex-colour palette, then groups geometry by moving control. Do not replace the detailed originals.
