# Reusable missile kit

Three stylized game projectiles with a longer unpowered upward pop, a visible arcing crest and fall followed by ignition, a steep climb, curved crest, nose-down hook, and a fast dive with a small authored lateral correction. No launcher geometry is included. The workshop's launch ring and arrival marker are preview aids.

| Mesh | Triangles, including optional exhaust | Material batches | Intended use |
|---|---:|---:|---|
| DART | 188 | 4 | Repeated shots, distant sentries |
| NEEDLE | 456 | 6 | General sentry projectile |
| TALON | 1,340 | 7 | Single special tank rounds / close views |

All meshes share a 1.49 m nose-to-tail body envelope, four swept fins, +Y up and +Z forward in GLB. Scale the asset to fit the game's muzzle. These are separately selectable assets, not an automatic LOD chain. Each GLB includes all three clips; mesh detail and flight timing are independent.

| Clip | Duration | Character |
|---|---:|---|
| Flight_swift | 1.35 s | Compressed arc for rapid-fire towers |
| Flight_hook | 2.70 s | Clear standard climb/hook/dive |
| Flight_heavy | 4.00 s | More deliberate launch and higher crest |

## Using the GLBs

`ROOT → MISSILE_MOTION` holds the body. `TIP_SOCKET` identifies the nose and `EXHAUST_SOCKET` identifies the nozzle. `EXHAUST_SOCKET → EXHAUST_FX` contains an optional emissive exhaust mesh. Socket nodes carry role metadata so packing preserves them.

Spawn a fresh instance at a muzzle's world transform, then detach it from the launcher so later turret movement does not drag the projectile. Play one `Flight_*` clip on the instance, once, and release the instance at the clip's end. The baked paths start at local origin and end at the same local elevation. They are fixed presentation arcs; the caller selects the placement/orientation. No launcher is required.

If using engine particles, hide `EXHAUST_FX` and attach an effect to `EXHAUST_SOCKET`. Ignition begins during the fall at 32% of normalized flight time. The exhaust is off during ejection, the initial arc and fall and at arrival. A subtle lateral terminal motion is baked into the path. The preview trail and arrival pulse are runtime effects, not additional exported meshes.

## Reusing the motion sampler

`missile-lab/flight.mjs` exports `profiles`, `phases`, `position(u, profile)` and `sample(u, profile)`. `u` is clamped to 0–1; `sample` returns local position, normalized nose direction (independent of travel during the unpowered arc), ignition state and phase name. The same sampler generates the baked Blender animation, avoiding divergent preview/export motion.

For custom runtime placement, transform the returned local position and direction by a fixed launch frame, set the projectile orientation from local +Z to that direction, and drive the optional exhaust from `ignition`. Do not simultaneously play a baked flight clip and drive `MISSILE_MOTION` from the sampler. Runtime targeting, collision events, damage and pooling remain owned by the game. The terminal correction here is authored visual motion rather than target tracking.

The [workshop](../../missile-lab/) lets you mix mesh/profile choices, scrub each phase, slow playback, inspect a stationary mesh, follow the projectile and replay the full arc. All mesh counts include the small exhaust effect; materials are untextured.

## Rebuild

```sh
node tools/asset-pipeline/sample-missile-flight.mjs
blender --background --python-exit-code 1 --python tools/blender/build_missile_kit.py
node tools/asset-pipeline/pack-missile-kit.mjs
node tools/asset-pipeline/validate-missile-kit.mjs
```

Editable source: `source/blender/a6-missile-kit.blend`. Each projectile has three muted NLA tracks per animated control; enable the matching track on both `MISSILE_MOTION` and `EXHAUST_FX` to preview a flight in Blender. Blender coordinates are Z up / −Y forward; export converts to GLB Y up / +Z forward. The three roots are spaced apart in the editable source; exported roots are at the origin.

Validation checks glTF errors, per-mesh triangle budgets, all three clips, socket preservation, coast/ignition behavior, independent nose attitude, increasing speed through the powered crest and agreement between baked positions and the reusable sampler.

The revised opening follows an unpowered parabola to a small apex at 20% of flight time. It falls until ignition at 32%, continues downward briefly as thrust catches it, and climbs again after 35.5%. The final dive occupies the last 10% of the clip and accelerates into arrival. Total clip lengths are unchanged.

During the opening, the missile holds a nose-up attitude through the apex and falling segment. Its position falls independently; the nose does not follow the downward travel direction. After the thrust catch, attitude smoothly blends toward the powered heading with a small visual lag. Powered motion is timed by distance along the curve, with continuously increasing speed through the high crest and into the dive. Geometric phase boundaries are mapped through that timing, so phase labels can occur at slightly different normalized times across profiles.
