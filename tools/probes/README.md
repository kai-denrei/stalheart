# Probe tools

Offline measurements on the shipped planet (the bake), outside `src/` and not a dependency of the repo. Run from any worktree: `node tools/probes/<tool>.mjs <worktree> <args>`.

- `road-measure.mjs <worktree> <hullCell> <arenaCell>` — the shipped `roadAhead` with `ARENA.road` at every cell of the open route from the hull to the arena: the fire rate and the shortcut share (2026-10-16, the road SOL cuts).
- `road-rules-sweep.mjs <worktree> <hullCell> <arenaCell>` — the shortcut rule sketched and swept over `ahead`/`saves`/`through`, and the flank rule, on the same route.
