# Foundation slab — asset brief

For the SentryTowers_A6 workshop. One scalable slab replaces per-tile foundations in the Stalheart story base.

## Game constraints

- Metres, +Y up, +Z forward, glTF 2.0 binary, self-contained: no external buffers, no images, no textures. Materials by name only.
- Three.js r160, one vendored renderer. The asset is loaded once and drawn as instances, one instance per island, scaled non-uniformly to the island's plot. Nothing on the top face may depend on scale.
- The 4 m cell is the logical unit for plots, sockets and the kit connection graph. The grid is drawn by the game's shader from world position, not modelled.
- Islands sit on a sphere of 753 m radius. An island up to 56 m across has under 1 m of drop at its corners, so the skirt must cover 1 m of fill.
- Budget: under 300 triangles, at most 2 materials, one mesh per material. Under 100 KB.
- Attribution: "Models by jelaludo", pinned by sha256 in a lock file, fetched from the repository at a fixed commit.

## Deliverable: `foundation_slab.glb`

One object at a reference size of **40 x 40 m**, origin at the plot centre on the top surface.

| Part | Spec |
| --- | --- |
| Top face | Flat, unmarked, exactly at Y = 0, spanning X and Z from -20 to +20. The game draws the 4 m grid, plot outline and print progress on it. |
| Rim | A bevel or lip along the four edges, at most 0.5 m wide and 0.4 m tall, so a scaled island still reads as poured. Keep it a constant-width band: the game scales the slab, so the rim's authored width is what the 40 m reference shows and it will stretch proportionally on larger islands. If that is unacceptable, author the rim as a separate `RIM` mesh and the game will instance it unscaled per edge. |
| Skirt | Vertical sides from Y = 0 down to Y = -1.2, slightly inset, one material, dark. Hides fill under the island. |
| Materials | `Slab / concrete` for top and rim, `Skirt / carbon` for the sides. Names are matched by the tint pass. |
| Nodes | `ROOT` at the origin. Optional `SUPPORT` empty at (0, -1.2, 0) for a later pier. No damage states, no animation. |

Do not include sockets on the top face, ground, scenery, or a printed-progress variant; progress is a shader value. A `foundation_slab_print.png` still from above is useful for review but not required.

## Islands it will be scaled to

| Island | Plot (cells) | Metres |
| --- | --- | --- |
| Landing site | 4 x 4 | 16 x 16 |
| Rotor socket | 2 x 2 | 8 x 8 |
| Armored gate | 3 x 2 | 12 x 8 |
| Solar complex | 5 x 5 | 20 x 20 |
| HUGIN arm | 10 x 10 | 40 x 40 |
| Stalheart | 12 x 14 | 48 x 56 |

## Acceptance in Stalheart

`npm run assets:check` verifies the checksum, GLB validity and self-containment. The story lab instances the slab under each island, scales it to the plot, and draws the grid; a browser test screenshots the Stalheart island at 48 x 56 m and the Rotor island at 8 x 8 m and asserts the top face stays at the island's pad height.
