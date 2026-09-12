# Working with the 3D assets manager

How Stalheart consumes models, what an export needs so it drops in without
rework, and how we hand feedback back. The solar power export set
(`assets/solar-power/README-LODS.md` upstream) is the reference example: it
already follows every rule below.

## What the game does with a model

- Loads plain GLBs with Three.js `GLTFLoader` (r160), meshopt decoder wired.
  Every model is packed with gltfpack at release time (`-cc -kn -km -ke`:
  meshopt compression, quantised attributes, named nodes, materials and
  extras kept). Plain GLB is the source of truth; we do the compression, so an
  upstream `meshopt/` copy is welcome but not required.
- Pins every file by upstream commit hash and sha256 in `docs/*.lock.json`
  and re-fetches from that commit. A hand-off is a commit hash plus a folder,
  never a loose file.
- Places models by name: pivots, sockets, hidden parts and the nodes a clip
  drives are all looked up by node name. Names must be stable across damage
  states and detail tiers of the same module.
- Swaps detail tiers by camera distance (`src/fx/story-base.js`): the
  distance tier loads first and stands until the camera comes within 150 m,
  then the game tier is fetched and swapped in with hysteresis. From the map
  and orbit views the whole base is drawn at the distance tier.
- Batches static tiers by material and instances repeated pieces (island
  slabs, wall segments), so one material per tier is the cheapest shape.

## Export contract (per module)

| Item | Rule |
| --- | --- |
| Units and axes | Metres, +Y up, +Z forward, origin on the ground at the plot centre; the same origin in every state and tier of a module. |
| Self-contained | One `.glb` per variant, no external buffers or images. Vertex colours or a small palette; no textures unless agreed. |
| Tiers | Separate files, same node names: **LOD1 / game** for anything the camera can approach, **LOD2 / distance** merged to one static mesh and one material for the far view. **LOD0 / detailed** is for recordings only. |
| Damage | `d0` to `d3` are damage states, not detail. Every damage state exists at every tier it is meant for. |
| Clips | Named, either a loop (`*_Cycle`, `*_Idle`) or a one-shot (`Doors_Open`, `Tank_Roll_Out`) with an explicit duration. Bake nothing that the engine drives (tracking pivots, turrets). |
| Nodes | Every pivot, socket, and part the game may hide has a unique, meaningful name (`TURRET_YAW`, `VEHICLE_03`, `REUSABLE_BOOSTER`). Loader-sanitised names drop dots: `DOOR_01_L.001` becomes `DOOR_01_L001`, so prefer names without dots. |
| Geometry hygiene | No coplanar floors (z-fighting), no degenerate triangles, hidden internals removed in closed states, consistent winding. |
| Manifest | A `manifest.json` per module with `file`, `lod`, `damage_level`, `bytes`, `triangles`, `draw_calls`, `plot_m`, `sockets`, `clips`, `credit`. |
| README | Runtime contract in a few lines: what each clip does, which nodes the engine may drive, what the plot reserves, any floor heights. |

## Budgets we design against

| Category | Game tier | Distance tier |
| --- | ---: | ---: |
| Landmark (Stalheart, HUGIN pad, solar, assembly line) | ≤ 8k triangles, ≤ 10 draws, ≤ 400 KB plain | ≤ 3k triangles, 1 draw, ≤ 250 KB |
| Base kit piece (wall, gate, slab, container) | ≤ 1.5k triangles, ≤ 5 draws | instanced, no separate tier needed |
| Unit (tank, sentry) | ≤ 25k triangles with articulated pivots | not swapped; keep one tier |

Numbers are targets, not gates. The solar LOD1 at 3,856 triangles and 7 draws
and LOD2 at 2,752 and 1 draw are the model answer; the Terraformer and HUGIN
pad "game" exports at ~40k triangles are the ones still over budget.

## How we give feedback

- Every asset we take gets an entry in `ATTRIBUTIONS.md` and a lock file with
  the commit, path and hash. Ask us for the lock if in doubt which revision is
  live.
- Measured numbers, not impressions: triangles, draws and bytes as loaded, fps
  on the reference phone, and a screenshot from the game's own camera.
- One request per module, stated as the contract above plus the budget row it
  should meet, and the game view it is seen from (map, third person, optic).
- Anything we derive ourselves (a simplified far tier via gltfpack, a packed
  release copy) is marked derived and never sent back as if it were authored.

## Open requests

1. Terraformer 3000 and HUGIN launch pad: game tier ≤ 8k triangles and a
   distance tier, same node names as today so `Terraforming_Cycle` and
   `Cargo_Recovery_Cycle` still bind. Until then the game runs derived far
   tiers from `npm run tiers`.
2. Robotic assembly line: same, currently 97k triangles at 7.2 MB.
3. SH02 rocket: a distance tier for the landing island as seen from the map.
