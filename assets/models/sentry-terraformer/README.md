# Terraformer 3000 / Stålheart

A towering planetary construction machine in the A6 industrial palette. Approximately 36 m high, with a 32 m rail gauge and 50 m tracks. Includes braced twin towers, flanged bogie wheels, roof catwalks, access ladders, two pressure silos, animated material feeds and three side monitoring balconies.

Four authored destruction states share a ground-centered origin:

- **D0 / Intact:** operating gantry, carriage, vertical ram and six-joint extrusion arm.
- **D1 / Damaged:** armor gouges, debris and warning telemetry; machinery still operates.
- **D2 / Critical:** ruptured second silo with exposed shell and ribs, folded arm, broken nozzle feed and dead monitors; disabled.
- **D3 / Destroyed:** collapsed named bridge, detached tanks, broken arm, tower stumps and torn cables; disabled.

[Interactive preview](../../terraformer/) includes state selection, animation playback/scrubbing, neutral materials and collision/socket overlays. [Editable Blender scene](../../source/blender/a6-terraformer.blend) contains all four variants arranged side by side. The presentation collection includes a 1.8 m maintenance worker and printed regolith courses for scale; those are excluded from the machine GLBs. Only D0 is enabled for the hero render by default; enable the other state collections for rendering their gallery positions.

Rebuild from the project root:

```sh
blender --background --python-exit-code 1 --python tools/blender/build_terraformer.py
node tools/asset-pipeline/validate-terraformer.mjs
```

The builder runs in a separate background scene, leaving an open artist scene untouched. Outputs: `source/blender/a6-terraformer.blend`, four `terraformer_3000_d0.glb` through `terraformer_3000_d3.glb` files, `manifest.json` and `stalheart-preview.png`.

Motion hierarchy: `ROOT → GANTRY_TRAVEL_Y → CARRIAGE_TRAVEL_X → TOOL_LIFT_Z → J1_BASE_YAW → J2_SHOULDER → J3_ELBOW → J4_FOREARM_ROLL → J5_WRIST_PITCH → J6_TOOL_ROLL → EXTRUSION_TIP`. Axes in these names refer to Blender Z-up coordinates; GLB exports convert to Y-up. The six arm joints are independent revolute transforms, with rail translation, carriage translation and vertical ram as additional axes. D0/D1 contain a 16-second `Terraforming_Cycle` demonstration. Preserve the transform hierarchy when importing.

Destruction uses authored replacement states, not fracture simulation. Runtime state switching, inverse kinematics, collision avoidance, extrusion deposition and physical hose simulation remain engine integration work. The animated hoses are segmented visual approximations. Collision metadata is a coarse reserved envelope, not a walkable machine collider. Meshes remain modular for editing and are not production-optimized.
