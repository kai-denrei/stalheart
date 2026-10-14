# The swarm lab's Pearl mode: where a Pearl crowd's frame goes (design, 2026-10-14)

Owner, 2026-10-14: "brainstorm possibilities to show more pearl-enemies in swarms without breaking fps, we can adapt our current SWARM lab in dev to also display pearl-enemies, and play with variables in how they are rendered to see where we could gain the most. overall idea: strong full resolution animations when there are few and we can appreciate them, and simplifications when they are in swarms." What must still read in a swarm, in the owner's order: the hop rhythm, the stalks for motion, the colour inside. What may go first: the membrane's lumps and wobble, the contact shadow, the hull's resolution. No count target: "we will push the limit depending on the solutions we find". Chosen approach: measure first in the lab, then build the level ladder from the numbers (the alternatives, a ladder built blind and merged cluster bodies, are in the brainstorm's record).

## 1. The lab's Pearl mode

`src/labs/swarm-tab.js` (the lane study for the dot enemies) gets a **bodies** switch: *dots* (today, unchanged) or *Pearl*. The Pearl side lives in its own module, `src/labs/swarm-pearl.js`, a sibling the tab mounts, not a mode bolted into the dot code. In Pearl mode:

- a **tier** picker (white, yellow, blue, orange, green, purple, brown, black, and *mix*: the sector's shares as `PEARL_OF` maps the wave programme's types) and the existing **count** slider (1..1,200), density and file width;
- the bodies are seated through the game's own family, `createPearlFamily` (`src/fx/creature-pearl.js`) with the game's tables (`PEARL_TIERS`, `PEARL_FOLLOW`, `PEARL_PACE`, `PEARL_GAIT`, `pearlBodies` over `ENEMY_SPEC`), and driven by its plane-metre `track(id, { x, z, ax, az, dt, speed })`: each body walks the lane toward the tank's end at its record's speed and loops back to the top when it reaches the end, so the lane is always full and always moving. The lab pays what the game pays: the follow, the gait, the kit's step, the draw;
- the planet bend is on with the game's radius (the kit's `uPlanetR`), and the camera has a **game height** preset (the gameplay pose's distance and tilt over the lane, from `src/domain/story-shots.js` / the controller's numbers, copied as a constant with its source named) beside the free orbit, so pixel sizes and so the levels match the game;
- the tank stands at the lane's end as the target; its drive, the ramming and the hull contact are off in this round. Sound off.

## 2. Two readings on the cost line

The dot lane's cost line (a tight render loop blocked on `gl.finish()`) reads the GPU. Pearl mode reads two things, each a mean over the last second:

- **step**: `performance.now()` around `family.step(dt, camera, height)` (the follow, the gait, the kit's planning and solver, the geometry packing);
- **draw**: the existing cost line (render + `gl.finish()`).

And the counters, from `family.stats()` and the geometry's `lodCounts`: bodies alive, bodies drawn at each level (high / mid / low) and culled, `renderer.info.render.triangles` and `.calls`. The line reads like: `300 alive · step 2.1 ms · draw 4.8 ms · levels 12/80/180 +28 culled · 1.1M tris · 9 calls · 41% of a 60 fps frame`.

## 3. The knobs (live, each alone)

Every knob changes one thing and the line answers at once. Sliders and checkboxes in a KNOBS block of the Pearl panel:

| knob | what it changes | where |
| --- | --- | --- |
| high px | the radius in device pixels above which a body draws the high hull (`CUTIS_LOD.high`, 70) | the lod object passed to `createSwarmGeometry` (the lab owns a mutable copy; the family takes it through `tune.lod`) |
| low px | the radius below which a body draws the lowest hull (`CUTIS_LOD.low`, 12) | same |
| high cap | the most high-hull bodies in a frame (`highCap`, 24) | same |
| force level | auto / 0 high / 1 mid / 2 low for every body | the geometry's `levelFor` takes a forced level when the lod object says so (a small change in `geometry.js`, default off) |
| lumps | the membrane's noise lumps on/off (`uNoise` 0) | the material uniforms |
| breath | the breathing on/off (`uBreath` 0) | the material uniforms |
| shadow | the contact shadows on/off (`shadows.visible`) | the geometry's shadow mesh |
| core mesh | the inner core mesh on/off (the colour then only as the membrane's tint) | the geometry's core level meshes |
| step every | the family stepped every 1 / 2 / 4 frames with the accumulated dt (what the whole step is worth; the per-size split is a later round) | the lab's frame loop |

The knobs are read from the panel, never from the URL; a RESET puts the game's values back.

## 4. The sweep

A **sweep** button runs the current knob set at 100, 300, 600 and 1,000 bodies (each seated, settled two seconds, read over three), and prints a table under the panel, as text that copies clean into a log entry:

```
bodies  step ms  draw ms  high/mid/low/culled  tris   calls
100     0.7      1.9      24/40/36/0           0.6M   9
...
```

The owner flips a knob, sweeps again, and the difference between two tables is what that knob is worth. That is the whole method of this round; the ladder (hero / swarm / far bodies) is designed from the tables in the next one.

## 5. Tests and the guards

- `test/swarm-lab-pearl.mjs` (node): the lane seating is pure (`laneSeats(count, dens, spread, LANE)` → targets, spread like the dot lane's, deterministic for a seed; the loop-back when a body reaches the end); the knob → uniform/lod mapping (`applyKnobs(knobs, { lod, uniforms, geometry })` sets exactly the named field and nothing else; RESET restores `CUTIS_LOD`'s values); the sweep table's formatter (fixed columns, the four rows, `M` for millions).
- `scripts/browser-test.mjs --swarm-pearl`: labs.html#swarm, bodies → Pearl, tier white, count 300, run: within five seconds `family.stats()` says 300 live, the line shows finite step and draw, the level counts plus culled sum to 300; lumps off → `uNoise` 0 on every level's material; sweep → a table with four rows. The lab exposes `window.__stalheartSwarmPearl.state()` for it (the readings, the counts, the knobs).
- `npm run architecture`: the lab is a controller (labs may import fx); `geometry.js` keeps its kit-port header and names the forced-level change as a change from the kit. No td-tab change.
- Records: this spec; a decision entry for the brainstorm (the three approaches, the owner's picks); the landing's entry with the first sweep table on the Mac mini (headless numbers are not the owner's M4's; the table's value is the deltas).

## Out of this round

The level ladder itself (hero / swarm / far impostor), the per-size step rate, the solver rate knob, the tank's ramming in Pearl mode, a Pearl mode in the units tab.
