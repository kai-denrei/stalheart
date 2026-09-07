# spherical-stalberg-grid

Proof of concept: the Oskar Stålberg organic irregular quad grid
(tri→quad merge → subdivide → relax), ported from the 2D plane to the
surface of a sphere. Standalone, vanilla ES modules, no build step.

Ported from the working 2D implementation in `~/Dev/oskar-procedure`.

**[Dev Log](DEVLOG.md)** — per-commit highlights and technical deep-dives.

## Run

```bash
npm run serve        # python3 -m http.server 8144
# open http://localhost:8144
```

```bash
npm test             # node test/smoke.mjs — pipeline invariants
./scripts/bust.sh    # bump the cache-bust token (assets + module imports)
```

## Pipeline (src/grid.js)

1. **Sample** — Mitchell best-candidate blue noise on S² (`sample.js`).
   Replaces 2D Bridson Poisson-disk.
2. **Triangulate** — spherical Delaunay = 3D convex hull of on-sphere
   points (`hull.js`, three.js quickhull). Replaces planar Delaunator.
   The 2D sliver filter is gone: dropping faces on a closed surface
   would tear holes.
3. **Merge** — random tabu-driven dissolve of triangle pairs into quads.
   Legality checked in the candidate quad's tangent plane. Identical
   bookkeeping to 2D.
4. **Subdivide** — every face → quads (tri→3, quad→4), midpoints shared,
   new vertices projected back onto the sphere. Winding normalized so
   Newell normals point outward.
5. **Relax** — the 2D closed-form closest-square fit, run per quad in
   its own tangent plane; vertices reprojected to the sphere after each
   step.

## Invariants (test/smoke.mjs)

- all faces are quads; mesh is watertight (every edge in exactly 2 quads)
- Euler characteristic V − E + F = 2
- defect law: Σ(4 − valence) = 8 — irregular vertices are *forced* by
  sphere topology; the dashboard marks them (orange v3, cyan v5,
  magenta v6+)
- relaxation reduces squareness error; vertices stay on the sphere

## Dashboard (grid tab)

seed / sample count / blue-noise k / merge bias · live relaxation
(pull rate, cell size, iters per frame) · face color modes: random
cells, squareness heatmap, plain · toggles for faces, wireframe,
defect markers.

## Maze tab (`/#maze`)

Second PoC: rooms-and-hallways carved over the grid's **cell graph**,
method ported from HokorobiTawaa — *we don't draw hallways, we find
them*. Cells connect only across a full shared edge; every cell starts
'blocked' (elevated wall); room seeds are farthest-point-sampled and
connected by BFS corridors; spawn and heart are the double-BFS diameter
endpoints of the open subgraph (`src/dungeon.js`, Node-tested in
`test/maze.mjs`).

- **Trench PoV** — the camera rides in the corridor slot below the wall
  tops, staring down the throat of the maze.
- **Minimap** — the whole sphere in a bottom-left inset, player-centred,
  heading-up, with breadcrumbs.
- A **half-dotted heart** pulses at the graph-farthest cell; walk to it
  with arrows/WASD or the on-screen D-pad. ☆ pulses the next cell of
  the shortest route. `?walk=N` auto-walks N hops (demo/debug).
