# Stålheart / Celebration Disco Gantry Diorama

A diegetic in-game congratulation scene where the canonical **Stålheart / Terraformer 3000** gantry hoists the **DSC-01 Celebration Disco Ball** (`assets/disco-ball/`) from its 6-DOF extrusion tip and swings it like a giant celebratory balance ball above the fabrication bay. Models by jelaludo.

## Composition and runtime contract

- **No duplicated or mutated source binaries**: Each tier loads the canonical intact D0 Stålheart (`assets/terraformer/terraformer_3000_d0.glb`, `terraformer_3000_d0_lod1.glb`, `terraformer_3000_d0_lod2.glb`) and the canonical DSC-01 Disco Ball (`assets/disco-ball/lod{0,1,2}/disco_ball_d0_lod{0,1,2}.glb`), pinned by SHA-256 in `layout.json`.
- **Gantry attachment**:
  - `STANDALONE_CRADLE` on the Disco Ball is hidden (`visible = false`).
  - Stålheart’s six-joint arm is raised into a centered crane-hook configuration inside the 36 m portal arch (`CARRIAGE_TRAVEL_X.x = 0`, `TOOL_LIFT_Z.y = -2.4`, `J2_SHOULDER.z = -1.05`, `J3_ELBOW.z = 2.10`, `J5_WRIST_PITCH.z = -1.05`), placing `EXTRUSION_TIP` at `(-0.3471, 11.6283, 2.6) m` in rest pose.
  - `SOCKET_GANTRY_HOOK` `(0, 6.2, 0)` on `DISCO_BALL_ROOT` locks directly to `EXTRUSION_TIP` with zero coupling drift across all 64 sampled frames of the 16-second `Stalheart_Celebration_Cycle`.
- **16-second `Stalheart_Celebration_Cycle` (`runtime.js`)**:
  - `GANTRY_TRAVEL_Y` glides `±3.2 m` along the main rails while `CARRIAGE_TRAVEL_X` sweeps `±2.4 m` across the arch and `J1_BASE_YAW` swivels `±0.25 rad`.
  - `DISCO_PENDULUM_PIVOT` swings around the top hook (`±0.24 rad` roll, `±0.11 rad` pitch) like a suspended balance ball while `DISCO_SPHERE_SPIN`, `LIGHT_HALO_YAW` and `LASER_RING_YAW` counter-rotate and sweep four laser beams and four party floodlights across the bay.
  - Optional celebrating ground guests (`assets/hover-tank/mork_hover_tank_low_d0.glb` and `assets/isao-birudoron/isao_birudoron_lod1.glb`) salute on the bay floor with at least `3.214 m` of overhead clearance (`6.540 m` minimum sphere-to-ground height).
- **`LOD2` static distance behavior**: Keeps both Stålheart (`1 draw`) and the DSC-01 Disco Ball (`1 draw`) in their static merged single-material representations at the rest suspension point (`2 draws` total for the core diorama).

## Measured scene metrics (Stålheart + suspended DSC-01)

| Tier | Active triangles | Active draws | Plain GLB bytes (sum) | Meshopt bytes (sum) | Min ground clearance |
| --- | ---: | ---: | ---: | ---: | ---: |
| LOD0 detailed | 170,788 | 789 | 11,732,328 | 11,293,580 | 6.543 m |
| LOD1 game | 10,222 | 17 | 690,940 | 213,924 | 6.540 m |
| LOD2 distance | 4,417 | 2 | 322,812 | 103,292 | 7.049 m |

Active triangles and draws exclude the hidden `STANDALONE_CRADLE` in `LOD0`/`LOD1` and exclude the optional MÖRK/ISAO celebration guests (reported separately in `layout.json` and the viewer). These are measured geometry counts, not FPS claims.

## Source, validation and hand-off

Rebuild layout metadata with `node tools/asset-pipeline/build-stalheart-disco.mjs` and validate SHA-256 hashes, socket coupling and swing clearances with `node tools/asset-pipeline/validate-stalheart-disco.mjs`. Hand-off is the delivery commit hash plus `assets/stalheart-disco/`, `assets/disco-ball/` and `assets/terraformer/`.
