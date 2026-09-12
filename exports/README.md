# Exports for the assets team

Files here are exported from the running game for rework elsewhere. They
are snapshots, not sources: the game keeps building these at runtime, and a
reworked asset comes back through a pinned lock like every other model.

## isao_drone.glb

ISAO, the builder drone, as the game assembles him: the pinned fabricator
body with the game's own additions (the face panel, tint, lights), exported
through Three.js's GLTFExporter from the Units workshop bench. Metres, +Y up,
+Z forward, at the game's model scale (the fabricator's authored size). The
face is a canvas texture baked at the moment of export (one expression); in
the game it is drawn live from `src/emotions.js`.

As exported: 66 nodes, 28 meshes, 4,174 triangles, one baked face texture,
no animations; about 1.4 m tall and 1.2 m long. The named nodes the game
drives: `Fab_Root` (the fabricator body), `AuxScene` (the game's additions)
and `Isao_CRT` (the face panel the expressions are drawn on). What the
rework should keep so the game can wear it unchanged: those three names, the
pivot at the hull centre, and a single self-contained GLB with no external
files. The ask: make him read as one family with the MÖRK hull and the KORP
pieces.
