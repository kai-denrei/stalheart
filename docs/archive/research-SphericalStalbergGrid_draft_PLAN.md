Goal : map the Stalberg Oskar Grid to a sphere.

Taking inspiration from 
/Users/minikai/Dev/oskar-procedure
And
/Users/minikai/Dev/n7-automata

Specifically Stålberg's Breakthrough:
Stålberg's insight was a separation of concerns that lets organic-looking shapes survive procedural placement.

Irregular quad grid
Voxel grids look stiff; pure Voronoi or triangle meshes don't tile with rectangular art. He gets the best of both: every cell is a quadrilateral — so a square-ish tile maps onto it — but the connectivity is organic. The trick is going through triangles: triangulate, randomly dissolve edges to merge triangle-pairs into quads, then subdivide every remaining face into quads (triangle → 3, quad → 4). That guarantees an all-quad mesh regardless of how the merge went. Relaxation then nudges each vertex toward the position that makes its incident quads most square.

Dual grid / corner-state
Instead of asking "is this cell land or water" — the marching-squares 2⁴ = 16-case problem, or 2⁸ = 256 in 3D — state lives on the corners, and a tile is chosen by its four corner values. Symmetry collapses the case count hard: 256 → 15 → 6. Six tile families cover everything; you author six meshes, not hundreds.

Deformation to fit
The six tiles are modeled in a unit cell, then squashed and stretched onto whatever irregular quad (or prism) they land in via interpolation — bilinear for quads, trilinear for cube tiles, barycentric for triangles. The grid's irregularity is hidden because the art deforms to it instead of fighting it. Multiple variants per family, plus pattern-triggered "special" multi-cell pieces, kill the repetition tell.

---




