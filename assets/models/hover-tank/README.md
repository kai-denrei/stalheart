# MÖRK / Heavy hover tank

Long, narrow, low-profile armored hover tank with a long cannon and lean turret, two independently sweeping front plasma projectors, streamlined nacelles, cyan lift emitters and a diegetic 27-shell magazine on the rear hull. The vehicle has ground-contact skids, not tracks or wheels. It lifts only 0.55 m to retain a heavy silhouette.

The plasma mounts sit below the main gun's swept envelope. The full 360° yaw check at maximum gun depression leaves at least 0.150 m of vertical clearance between the main recoiling assembly and the plasma housings in the nominal suspension pose.

[Interactive workshop](../../hover-tank/) includes power on/off, cannon fire, plasma flashes, independent aiming controls, ammo reload, a rear magazine inspection view, neutral materials and D0–D3 selection. [Editable Blender source](../../source/blender/a6-hover-tank.blend) contains the four states and named NLA animation tracks; the intact presentation uses `Hover_Idle`.

## Operating clips

| Clip | Length | Behavior |
|---|---:|---|
| Power_On | 2 s | Deliberate lift, slight overshoot, settle at 0.55 m; lift fields expand into view. |
| Power_Off | 1.2 s | Rapid descent to ground at 0.7 s, suspension compression and brief settling bounce; lift fields vanish. |
| Fire_Heavy | 1.4 s | 0.82 m cannon/breech recoil in about 0.067 s, hull compression/kick, slow recovery. |
| Turret_Aim | 8 s | Loop demonstrating turret traverse and -5° to +25° elevation. |
| Plasma_Sweep | 4 s | Independent opposed lateral arcs of ±12°. |
| Hover_Idle | 3 s | Very small vertical motion around the 0.55 m powered height. |

The operating clips are included in D0/D1 only. Play power and fire clips once with their final pose held or explicitly applied. Aim controls may be driven directly by the engine instead of playing the demonstration clips. The recoil animation moves the barrel/breech and compresses the hull suspension; the azimuth ring remains the aiming pivot.

## Magazine display

Nine single lenses sit in a compact 3×3 bezel on the upper rear deck. `AMMO_PORT_00` through `AMMO_PORT_08` hold `AMMO_PORT_LIGHT_00` through `AMMO_PORT_LIGHT_08`. Each lens represents three shells: cyan = 3, amber = 2, red = 1, black = 0. Update its material color/emission per shot; no separate sub-indicators are used. The workshop depletes the highest indices first and clones each lens material so its state is independent. Plasma fire does not consume shells.

Ammo depletion/reload is runtime state, not baked into `Fire_Heavy`. The workshop demonstrates the logic and a 27-shell capacity. A game should own the authoritative ammunition value.

## Hierarchy and coordinates

GLB units are meters, +Y up, +Z forward. Detailed mesh parts are batched within their existing moving assemblies. Named control roots and sockets are retained:

- `ROOT → HOVER_RIG → HULL_SUSPENSION → TURRET_YAW → GUN_PITCH → GUN_RECOIL → MUZZLE_00`
- `PLASMA_YAW_L/R` and `PLASMA_MUZZLE_L/R` under the hull suspension.
- `NACELLE_L/R` under the hover rig, with `LIFT_EMITTER_*` controls.
- Rear `AMMO_PORT_* → AMMO_PORT_LIGHT_*` under the hull suspension.

In GLB, turret/plasma yaw rotates about local Y; positive elevation uses negative local X on `GUN_PITCH`; main recoil translates along negative local Z. Turret yaw supports ±180°, elevation -5° to +25°, and each plasma mount ±12°. The packed GLB rest pose is grounded with the lift fields collapsed. The Blender presentation defaults to hovering.

## Destruction and integration

D0 is intact. D1 has armor gouges but remains operational. D2 has a shortened damaged cannon, scorched hull penetration and a severed service line; D3 has a fallen turret, sheared gun, separated right nacelle and armor debris. D2/D3 have dark lift fields and magazine indicators and no operating animation.

The physics collider is a coarse placeholder. Runtime driving/terrain following, dynamic collision checks, physical suspension, damage switching, ballistics and persistent effects belong to the consuming engine. The workshop uses short muzzle flashes to make the firing controls readable. Suspension movement is a visual animation rather than a physics solver.

Rebuild and validate:

```sh
blender --background --python-exit-code 1 --python tools/blender/build_hover_tank.py
node tools/asset-pipeline/pack-hover-tank.mjs
node tools/asset-pipeline/validate-hover-tank.mjs
```

Outputs: four GLBs and a manifest under `assets/hover-tank/`, `mork-preview.png`, and `source/blender/a6-hover-tank.blend`. Validation checks the triangle budget, nine four-state ammo lenses, six operating clips, recoil recovery, power timing, ground clearance and gun/plasma separation.

The revised silhouette narrows the running body by 18% and stretches it lengthwise by 27%, with sloping glacis surfaces, pointed nacelles, fitted segmented shields, cyan panel seams and a swept, flattened turret. The barrel was lengthened to retain its reach beyond the longer hull. Geometry proportions are baked into meshes; the turret and weapon axes remain orthogonal.

## Piece callouts

Enable **Labels / callouts** in the tank workshop, choose an assembly, and search or select a numbered piece. **Copy part reference** includes its exact Blender object name and semantic ID. Markers follow animated parents; overlapping markers are suppressed while every piece remains selectable in the list. Markers can show through armor to identify internal or underside fittings.

The `*-callouts.json` files are generated from individual source objects before material batching. Rebuilds regenerate them automatically; to refresh just the labels, run `blender --background source/blender/a6-hover-tank.blend --python tools/blender/hover_tank_callouts.py`.

The exposed nacelle saddles, hinges, cylinders, rods and hoses have been removed, along with the cannon recoil cylinders and rods. The turret pivot moved 0.8 m forward to open the rear deck for the magazine. Recoil remains animated.
