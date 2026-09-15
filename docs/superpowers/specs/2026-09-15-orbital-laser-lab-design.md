# Orbital laser: the rules and the lab

Owner decisions (2026-09-15, from `2026-09-15-orbital-laser-brainstorm.md`): an **add-on** to the gunship, on a **timer**; the satellite view must feel **high**; a **split view**, the ground reality of the destruction full screen and the satellite far view as a large inset where the pointer steers; the **Stalheart can be destroyed** if misused; **build the lab first**, with real map elements and a line of enemies in a trench.

This spec covers sub-project 1: the rules as a pure module, the look and the destruction in a lab. Sub-project 2 (the strip button, the window in the story, the acceptance step) gets its own spec once the lab has been judged.

## 1. The weapon

A satellite passes over the base on a fixed period. While it is overhead the player can burn: a continuous beam from orbit whose contact point on the ground chases the pointer at a capped slew rate, so it draws heavy lines. The beam has a fixed energy budget per pass, drained only while it burns; the player can lift and re-lay it inside the window. Unused energy is lost when the pass closes.

It burns everything in its footprint. Bodies, walls, the player's own towers, sinkholes, the tank and the Stalheart itself. A path that cuts through your own wall to reach the trench is a real decision, and a beam dragged across the Stalheart ends the colony.

### Content (`src/content/orbital-laser.js`, first values, tuned in the lab)

```
LASER_ORBIT   = { period: 180, window: 20 }          // seconds between passes, seconds overhead
LASER_BEAM    = { energy: 10, radius: 6, slew: 40 }   // seconds of burn, footprint radius in metres, contact speed in m/s
LASER_BURN    = { soft: 0, hard: 1.0, wall: 0.5, tower: 1.5, seal: 1.0, tank: 1.0, heart: 3.0 }   // seconds of contact to destroy
LASER_VIEW    = { altitude: 1.2, fov: 18, inset: 0.34, groundBack: 28, groundUp: 9 }
LASER_EXPLOSIONS: 'laser.ignite' → orbital-strike at scale 0.5, scare 8 cells / 2 s
                  'laser.contact' → rotary-pop at scale 0.6, scare 3 cells / 0.6 s, ~8 per second while burning
```

`LASER_VIEW.altitude` is in planet radii above the surface; at 1.2 radii with an 18° field the base is a small target and the planet's limb shows in the corners, which is what "feel higher" means. `groundBack`/`groundUp` are metres behind and above the contact point for the ground camera.

### Rules (`src/domain/orbital-laser.js`, pure, Node-tested)

- `makeLaser(orbit, beam) → { phase: 'away'|'overhead', left, energy, burning, contact: [x,y,z]|null, contacts: Map }`
- `stepLaser(st, dt, orbit, beam) → 'arrive'|'close'|null`: the clock; on `close`, `energy` resets to `beam.energy`, `burning` false, `contact` null.
- `aimLaser(st, target, dt, beam)`: moves `contact` toward `target` along the sphere at most `beam.slew * dt` metres; the first aim after arrival snaps.
- `burnLaser(st, held, dt) → boolean`: burning is `held && overhead && energy > 0`; drains energy; returns whether it burned this frame.
- `burnContacts(st, things, dt, burn) → [{ thing, kind, done }]`: `things` are `{ id, kind, pos }` inside `radius` of `contact`; accumulates seconds per id in `st.contacts`, reports each id whose accumulated time reached `burn[kind]` exactly once, and forgets ids that left the footprint.
- `laserProgress(st, orbit, beam) → { window: 0..1, energy: 0..1 }` for the HUD.

`impact-scare.js` is reused unchanged for the scatter.

## 2. The look

- **Beam** (`src/fx/orbital-laser.js`, `createOrbitalLaser(scene, { cellSide, metresPerCell })`): `createBeam` from `src/beamfx.js` between a sky anchor 400 m above the contact and the contact point, `setEndpoints` every frame. Preset: white-hot core (width 0.6 m), a wide cyan-violet glow (5 m), interference noise, a burst envelope on ignition, alpha fading with energy. Near-vertical, so from the satellite it reads as a bright point with a bloom halo.
- **Footprint ring** on the ground at the contact, radius `LASER_BEAM.radius`, monochrome.
- **Scorch trail**: a ribbon of dark glassy decal quads laid every 2 m of contact travel, each fading over 60 s; capped at 400 quads, oldest recycled.
- **Bursts**: `laser.ignite` where the beam first touches down on each lay; `laser.contact` riding the contact point at ~8 per second while burning. Both through `createExplosions` and the existing `EXPLOSION_USES`/`EXPLOSION_SCARE` tables, so the scare herds the swarm away from the line.
- **Destruction reads**: a wall cell burns out (its instance drops, a dot burst, a permanent gap); a tower dies with the existing dot burst and disappears; a sinkhole seals with the rubble pile; the Stalheart bursts and its holder goes dark, then a `COLONY LOST` line on the HUD. Structures under the beam go hot in thermal (`createThermalHeat` hot set) for the seconds they burn.
- **Sound**: a charge whine at arrival, a continuous roar with a sub layer while burning, crackle at the contact, a fading hum when energy runs out. Cues authored in the audio lab as package keys `laser_arrive`, `laser_burn`, `laser_contact`, `laser_out`; until the package carries them the lab plays nothing.
- **HUD** (DOM, monochrome, inside the lab and later the game): window countdown, energy bar (the gunship HUD's `bar`/`barHot`/`barLabel` contract), the state word `AWAY · ss` / `OVERHEAD · ss` / `OUT`.

## 3. The split view

One renderer, one scene, two cameras, the seeker monitor's scissor pattern (`src/fx/story-monitor.js:13-25`).

- **Ground view, full screen**: a perspective camera `groundBack` metres behind and `groundUp` above the contact point, looking at it, trailing the contact with a short lag so the column is always framed with the trench, the base or the wall it is cutting. Between lays it holds on the last contact.
- **Satellite inset**: a box `LASER_VIEW.inset` of the width, bottom-right, aspect 1, drawn with the far camera straight down from `altitude` radii with `fov` degrees, up vector held to the base's north so the map does not spin. Pointer events on the inset only: a screen-to-sphere pick on the far camera gives the target; the ground pane ignores the pointer. A reticle in the inset marks the pointer, a bright point marks the contact.
- Portrait widths: the inset becomes a band across the top, 40% of the height.

## 4. The lab (`labs.html#laser`, `src/labs/laser-tab.js`)

**Scene**: the real base. `buildStoryPlanet(STORY_RECIPE, STORY_CLEARING, planetBake())`, `planBase(planet, LAYOUT, 6)`, `createStoryBase(scene, { plan, placer, metres: 1, kit: KIT, skip: ['sh02'], sfx })` as the story lab does (`src/labs/story-tab.js:82-83`), so the walls, the Stalheart, the foundry and the structures are the shipped ones. Two sentry models (Rotor, Quiver) on their story sockets through `loadGlbWithClips`. One sinkhole outside the gate through `createSinkhole(scene, camera)`, open.

**Trench**: new geometry in the lab, a strip 4 m wide and 1.5 m deep from the sinkhole toward the gate along the sightline, dark inner faces, built from the sphere's local frame so it follows the curvature. Twenty enemy bodies (`makeDotEnemy`, the amoeba and phage forms from `src/units.js`) queue in it in single file, shuffling forward on the lab's own integrator, scared by the lab's `applyScare` calls when a burst lands near them, dying with `makeDotBurst` when burned.

**Panel** (`#laser-app`, the labs' usual panel style): sliders for period, window, energy, radius, slew, altitude, fov, inset, the burn seconds per kind, the beam preset numbers; buttons `PASS NOW` (jump the clock to arrival), `RESET` (rebuild the base, the sinkhole and the trench), `COPY PRESET` and a deep link, as the beam lab has. A readout: bodies burned, walls cut, towers lost, Stalheart state, energy left.

**Destruction in the lab**: walls by dropping the instance from `createStoryBase`'s wall `InstancedMesh` (a zero matrix) plus a burst; structures by hiding the holder plus a burst; the Stalheart the same plus the `COLONY LOST` line; the sinkhole through `rubble.add`. None of this touches the game's `breachWallCell`, `destroyTower` or `sealedBreachCells`; sub-project 2 wires those.

**Skips the FX package**: the beam preset and the burn numbers live in `src/content/orbital-laser.js` and the lab's `COPY PRESET` prints them; the beam section of the package does not exist yet and this lab does not create it.

## 5. Tests and gates

- `test/orbital-laser.mjs`: the clock (arrive, close, energy reset), slew (a far target is reached at `slew` m/s, a near one snaps), burn accumulation (soft dies at once, a wall after 0.5 s of contact, a body that leaves the footprint forgets), energy drain, progress.
- `test/nav-content.mjs` keeps passing with `laser` in `LABS` and the `main.js` route.
- `npm run check`: layer purity (`src/domain`, `src/content`), no new top-level `src/*.js` (the controller is `src/labs/laser-tab.js`), the td-tab budget untouched (this sub-project does not edit `src/td-tab.js`).
- Browser: a `--laser` lab step in `scripts/browser-test.mjs` that opens `labs.html#laser`, presses `PASS NOW`, drives the pointer across the inset over the trench for 2 s through a test hook, and asserts bodies burned > 0 and a wall cut; a screenshot for the owner.

## 6. Out of scope here

The strip button and the story window, the call-in sharing with the gunship, the game's destruction hooks, the audio cues themselves, the D1 to D3 damage meshes, phone cost. All in sub-project 2 or later, after the owner judges the lab.
