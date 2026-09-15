# SOL-82 orbital laser: asset brief

For the 3D assets manager. SOL-82 is the orbital laser platform in Stalheart. The name is the owner's homage to SOLD 740 and 1982. This brief covers the platform model only: the beam, the scorch, the smoke and the HUD are drawn by the game.

Read [ASSET-COLLABORATION.md](ASSET-COLLABORATION.md) first; its export contract applies to everything below.

## What SOL-82 is in the game

An orbital platform working for the gunship. It passes over the base on a timer. While it is overhead, the player holds a continuous beam from orbit and drags it across the planet to burn a line through the swarm.

| Capability | Value (`src/content/orbital-laser.js`) |
| --- | --- |
| Pass | every 180 s, overhead for 20 s |
| Energy | 10 s of burn per pass; unused energy is lost when the pass ends |
| Beam | continuous, white core in a blue-violet glow (`#ffffff` core, `#6f7cff` glow) |
| Footprint | 6 m radius on the ground |
| Movement | slow and heavy: top speed 10 m/s, 5 m/s² acceleration; it brakes onto the aim, never snaps |
| Range | 320 m from the base; the scope warns beyond it but does not stop the beam |
| Destroys | bodies on contact; walls and rock in 0.5 s; towers in 1.5 s; seals a sinkhole in 1 s; the Stalheart in 3 s (misuse can lose the colony) |
| Telemetry (fiction) | 1.064 µm Nd:YAG, continuous wave, 120 MW |

## Where it is seen

- **The satellite scope.** The player aims through SOL-82's own optics: a round view looking straight down from 4 planet radii (about 3 km above the 753 m planet). The platform is not visible in its own scope.
- **The sky.** In the ground view, the beam comes down from a point 400 m above the contact, almost vertical. At the start and end of a pass, a camera or cut-in will show the platform arriving and leaving, so it must read at a distance as a silhouette and a glint.
- **Close-ups.** Rare: pass arrival, firing and cooldown, for a lab or a short cinematic.

## Game constraints

- Metres, +Y up, +Z forward, glTF 2.0 binary, self-contained: no external buffers, no images, no textures. Vertex colours or a small palette. Materials are matched by name only.
- Three.js r160, one vendored renderer. The game packs every model with meshopt at release; deliver plain GLB.
- Monochrome vocabulary: dark hull (carbon, gunmetal), white-cyan light for "ours", amber only for warnings. No colours outside that set without asking.
- Bloom is applied by the game. Anything that should glow is its own named material, and the engine drives its intensity. Do not bake glow into vertex colours.

## Deliverables

Two files per the tier rules, with the same node names in both.

| File | Tier | Budget |
| --- | --- | --- |
| `sol82_platform_game.glb` | LOD1, close-ups and arrival | ≤ 8k triangles, ≤ 10 draws, ≤ 400 KB |
| `sol82_platform_distance.glb` | LOD2, the silhouette in the sky | ≤ 3k triangles, 1 draw, ≤ 250 KB |

**Size.** Main bus about 18 m long, overall span with arrays deployed at most 60 m.

**Origin.** At the centre of the beam's exit aperture. The beam leaves along **-Y**, toward the planet. +Y points away from the planet and +Z is the direction of flight.

| Part | Spec |
| --- | --- |
| `ROOT` | At the origin. |
| `APERTURE` | Empty at the beam exit, -Y is the fire direction. The engine anchors the column here. |
| `OPTICS_YAW`, `OPTICS_PITCH` | The gimbal that points the aperture. Engine-driven: do not bake tracking into clips. |
| `ARRAY_L`, `ARRAY_R` | Solar arrays, pivots on their hinge axes. The engine may rotate them to track the sun. |
| `RADIATOR_*` | Panels that heat up while firing; their material glows. |
| `NAV_LIGHT_*` | Small emitters for the distance read. |
| Materials | `M_Hull_Carbon`, `M_Hull_Gunmetal`, `M_Ours_Cyan` (accents), `M_Warning_Amber` (hazard marks), `M_Radiator_Glow` and `M_Aperture_Glow` (emissive, engine-driven), `M_Nav_Light` (emissive). |

**Clips.** Named and with explicit durations:

| Clip | Kind | What it shows |
| --- | --- | --- |
| `Arrays_Deploy` | one-shot, about 2.5 s | arrays and radiators unfold on arrival |
| `Aperture_Open` | one-shot, about 0.6 s | the optics iris opens before the first burn |
| `Aperture_Close` | one-shot, about 0.6 s | the iris closes when the pass ends or energy runs out |
| `Idle_Cycle` | loop | slow panel creep and nav-light rhythm between burns |

**Damage.** `d0` only. SOL-82 cannot be damaged yet; if that changes we will ask for `d1` to `d3` with the same origin and names.

## Do not model

- The beam, the footprint ring, the red aiming pointer, the ground glow, scorch, embers or smoke: the game draws them from `src/fx/orbital-laser.js`.
- Planet, clouds, stars or any scenery.
- Text, logos or insignia that need textures. A shape-based mark is welcome.

## Hand-off and acceptance

- A commit hash and a folder upstream, with `manifest.json` (`file`, `lod`, `damage_level`, `bytes`, `triangles`, `draw_calls`, `clips`, `credit`) and a short README naming the engine-driven nodes and the clip durations.
- Stalheart pins both files by sha256 in a `docs/*.lock.json`; `npm run assets:check` verifies checksum, GLB validity and self-containment.
- The laser lab (`labs.html#laser`) will show the platform at the beam's sky anchor during a pass, play `Arrays_Deploy` on arrival and `Aperture_Open` on the first burn, and drive `M_Radiator_Glow` from the burn. Review screenshots come from the lab's ground camera and a close orbit camera.
