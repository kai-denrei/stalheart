# Orbital laser: brainstorm

Status: brainstorm, not a spec. Written 2026-09-15 while the owner was away, so the clarifying questions are asked here with a proposed answer each. Answer, strike or replace them and this becomes the design.

The idea (owner, `2026-09-14-orbital-laser-idea`): an Akira-style weapon in space. It comes online on a timer, carries limited energy, and for a satisfying ten seconds or so the player guides a continuous beam that burns everything in its path, friendly towers, walls and sinkholes included. A replacement for, or an add-on to, the Heavy Gunship. It needs a lab pass first, with impact and explosion effects.

## What the game already has

- **A beam ribbon with a moving contact point.** `src/beamfx.js` `createBeam(start, end, overrides)` returns `setEndpoints(a, b)`; called every frame it already draws a beam whose ground end slides. The recipe is `docs/beam-2026-09-01.recipe.md`; presets are raw JSON (`assets/beam-2026-09-01.json`), not yet in the FX package schema.
- **A top-down guidance input.** `src/sentry-pilot.js` map mode reads the pointer into `G.cellAt(px, py)`, a screen-to-cell pick on the sphere. The shelved Orbital Gunship Top View (`2026-09-14-orbital-gunship-top-view-shelved`) is this view with the KORP firing down; the owner's note: "entertaining potential, but not the look we are after" for the gunship.
- **A guided, timed weapon pattern.** The gunship's 105: paint, launch, one nudge, land (`paintHeavy`, `launchHeavy`, `nudgeHeavy`, `stepHeavy` in `src/domain/gunship.js`). The strike state machine behind it survived the hidden ORBIT console.
- **Explosions and scare by use key.** `src/content/explosions.js` `EXPLOSION_USES` maps `'strike.orbital'` to the `orbital-strike` module at 135 m; `EXPLOSION_SCARE` gives it 12 cells for 3 s. `explode(use, p)` in the controller applies the scare, then spawns.
- **Destruction hooks.** `breachWallCell(ci)` breaches a wall (refuses a cell with a tower); `destroyTower(tower)` is a hard kill; `playerHit()` hurts the tank; a 105 on a sinkhole seals it and `sealedBreachCells` keeps it sealed; towers have a flat `hp` pool (the D0 to D3 meshes are an asset convention, not live damage tiers).
- **The HUD meter.** The gunship HUD's `bar`, `barHot`, `barLabel` already draw heat, magazine and reload; an energy bar is the same widget.
- **The call-in meter** (`src/domain/gunship-call.js`) earns the gunship from kills and cleared waves after the handover.
- **Thermal.** `src/fx/thermal-heat.js` can mark structures hot; the seat opens in FLIR.
- **Labs.** `labs.html#beam` is `src/beam-tab.js`, 1073 lines. New labs register in `src/main.js` routes with a `#tab-<name>` div. The FX package (`stalheart-fx-8`) has no beam section yet.

## The questions, with a proposed answer each

**Q1. Replacement or add-on?** Proposed: **add-on, on a different economy.** The gunship is earned (the meter); the laser is *time*: a satellite in a fixed orbit whose window opens every N seconds whether or not the player has done well. Two call-ins with two rhythms make the seat decision ("where do I need to be now") richer than one. If it proves better than the gunship in play, replacing it is a one-line change to the strip.

**Q2. What is the window?** Proposed: the satellite comes overhead every **180 s** for a **20 s** window; the beam has **10 s of energy** inside it. The player chooses when to open fire within the window, and can lift and re-lay the beam (energy only drains while it burns). Unused energy is lost when the window closes. Numbers are content, tuned in play.

**Q3. From where is it guided?** Three looks:
- (a) the shelved top view: satellite look-down, pointer is the contact point;
- (b) the gunship's PoV from the platform, watching the column come down beside you;
- (c) a ground-level "spectator" that follows the contact point (Akira's SOL seen from the street).

Proposed: **(a) for guidance, with (c) in the monitor.** Guiding a line is a top-down task, and the owner already said the top view "might have a place"; a laser from orbit is that place. The corner monitor (the seeker feed) shows the ground-level column so the scale is felt. (b) is a later option if the gunship and the satellite share a window.

**Q4. How does it steer?** Proposed: the contact point **chases the pointer with a maximum slew rate** (metres per second, content), so the beam draws lines rather than teleporting. A slow, heavy sweep is what makes the ten seconds satisfying; jerking the pointer only makes the beam lag behind. No path pre-drawing, no auto-sweep.

**Q5. What does it burn?** Proposed table, per second of contact within the beam's footprint (a circle, 6 m):

| Target | Effect |
| --- | --- |
| soft bodies (white to blue belts) | die on contact |
| hard cores (purple, black) | take beam damage per second; die after ~1 s |
| walls | `breachWallCell` after 0.5 s of contact (a molten cut) |
| own towers | take beam damage; a tower dies after ~1.5 s, `destroyTower` |
| sinkholes | sealed after 1 s, as the 105 seals them |
| the tank | `playerHit` once per second of contact |
| the Stalheart | takes hull damage like a tower; the beam does not spare it |

The point of "everything" is that the player can hurt themselves. A path that cuts through your own wall to reach the swarm is a real decision.

**Q6. What does it leave behind?** Proposed: a **scorch trail**, a ribbon of dark glassy decals along the path that fades over 60 s, plus the permanent breaches and wrecks the rules above create. Small explosion bursts (`'laser.contact'`, a sized `rotary-pop`) ride the contact point at ~8 per second; one `'laser.ignite'` blast (`orbital-strike` module, half scale) where the beam first touches down. The scare radius follows the contact point so the swarm scatters from the line, which is the herding the owner liked.

**Q7. Sound?** Proposed: a charge whine while the satellite arms, a continuous roar with a low sub layer while burning, crackle at the contact, a fading hum when energy runs out. Package cues in the audio lab, same as the gunship's weapon sounds.

**Q8. Look?** Proposed: the beam is **white-hot core, thin, with a wide cyan-violet glow**, nearly vertical (the satellite is overhead), with the recipe's interference noise and a burst envelope at ignition. From the top view the column is a bright point with a bloom halo and the scorch trail behind it; the monitor shows the column against the sky. Monochrome HUD: a ring for the footprint, an energy bar, the window countdown.

**Q9. Where does it lab?** Proposed: a **new lab `labs.html#laser`** (`src/labs/orbital-laser-tab.js`), not a panel in the beam lab. It shows a patch of planet with a wall, a tower, a sinkhole and a swarm of stand-in bodies, and lets you drag the pointer to burn a path with the effects above. It exports a beam preset and an explosion use, and its numbers land in `src/content/orbital-laser.js`.

## Approaches

**A. A full satellite seat** (like the gunship: a new view, HUD, briefing, sounds, the strip button). The most complete. Cost: a fourth seat's worth of fx, a new adapter in the controller, and the td-tab budget has zero lines left. Weeks.

**B. A guided strike from the map view** (recommended). The strip gains a `LASER` button that lights when the window is open; pressing it opens the existing top view with a laser reticle; the player holds the button or pointer to burn; the window closes and the view returns. Domain module for the state machine, content for the numbers, one fx module for the beam and trail, one lab. Reuses the map input, the HUD bar, the explosion and scare tables, the breach and destroy hooks. Days.

**C. Mark two points, the beam sweeps itself.** Smallest. Loses the guiding, which is the whole feel.

Recommendation: **B**, built so A's satellite PoV can be added as a view later.

## Design sketch for B

- `src/domain/orbital-laser.js` (pure): `makeLaser(cfg) → { phase: 'away'|'overhead', windowLeft, energy, burning, contact, slew }`, `stepLaser(st, dt, cfg)` returns `'arrive'|'close'|null`, `aimLaser(st, target, dt, cfg)` moves `contact` toward `target` at the slew rate, `burnLaser(st, held, dt)` drains energy, `contactsOf(bodies, contact, radius)`. Node-tested.
- `src/content/orbital-laser.js`: `LASER_ORBIT = { period: 180, window: 20 }`, `LASER_BEAM = { energy: 10, radius: 6, slew: 40, dps: {...}, wallSeconds: 0.5, towerSeconds: 1.5, sealSeconds: 1 }`, the beam preset, the explosion uses.
- `src/fx/orbital-laser.js`: the ribbon (`createBeam` with a sky anchor above the contact), the scorch trail decals, the footprint ring, contact bursts through `explode`.
- Controller: a `host.laser` adapter next to `host.gunship` on existing lines; the tick runs inside the existing gunship clock line; the strip gets the button through `storyViews`. Test hooks: `state().laser`, `openLaser()`, `burnAt(ci)`.
- Browser suite step in `--defense`: open the window, burn a wall cell, assert it breached and a body died.

## Open decisions for the owner

1. Q1 add-on vs replacement.
2. Q3 the guidance view; the top view was rejected for the gunship, accepted here?
3. Q5 whether the Stalheart itself can be hit.
4. The numbers in Q2 (period, window, energy).
5. Lab first (Q9) or straight to the game with the lab as the tuning room.
