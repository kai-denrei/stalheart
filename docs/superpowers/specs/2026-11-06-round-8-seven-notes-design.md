# ROUND 8 — the owner's seven notes on 9625441f, the A6 settlement models (2026-11-06, four streams from `overnight-2026-10-23` at 9b9171eb)

Owner, 2026-11-05, going to bed after round 7 shipped (`docs/superpowers/specs/2026-11-05-round-7-nine-notes-design.md`), seven notes on 9625441f:
1) when SOL burns with the laser, the burned marks that remain for a few seconds should be on the ground level; currently they hover at the
higher level of where the rocks used to be; 2) cheetah and other pets clip through the ground, at least through the base under the Stalheart,
they should be above; 3) collision between friendly units: the tank bumping into mechs, cheetah, etc. should push them aside; 4) the final
sinkhole mission, BELOW: moving the mouse should move the camera but without hindering the Isao movement; 5) we import new models: dome-city,
yushi-rover, sai92, yushi045 (https://jelaludo.github.io/SentryTowers_A6/); 6) we introduce a new layout for the main base: the dome city, which
includes our existing elements in between; 7) a new mechanic: the tank drops temporary flares like Isao, which dispatches the Yushi Rover to
come collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl, these are where the biomass is
stored; the yushi rover is also a buildable unit, but not used for now. "Dispatch sub agents as needed to tweak the existing game to fit the new
models, for pacing and cost of units too. Going to bed now, I want to wake up to a testable version with all the new units."

The operator was not present for the design pass: the decisions below are the agent's reading of the code (five read-only scouts, 2026-11-06
00:30-01:10, their findings folded in), each written down so the owner can overturn it with one line. Where a note names a thing the agent could
not reproduce by reading, the stream MEASURES FIRST and the fix follows the measurement, not this document's guess.

Note 5 is done before the streams start: `docs/a6-settlement-assets.lock.json` (commit 9b9171eb) pins, at upstream 40c23fa4, LOD1 + LOD2 of the
six Dome Colony dome modules and the 52 m `bridge_long`, the YushiRover (+ its `runtime.js` adapter), the SAI-92 unit and bay, and the Yushi045
Bio-Pearl (+ its `runtime.js`), under `assets/models/{dome-colony,yushi-rover,sai92,yushi045}/`; `npm run assets:check` verifies them. The author's
manifests, READMEs, the city's `layout.json` and the rover's `mission.js` are kept in the vault (`~/Documents/kainode-vault/projects/stalheart/
a6-2026-11-05/`) for reference. Facts the streams need: all four are D0 only, no baked clips (engine-driven named nodes; `clips: []` in the lock);
metres, +Y up, +Z forward; the dome's bounds are ±14.6 m on a 30 x 30 plot, its E/W/N/S ports 14 m out at y 9.7, walking floor 7.9 m, sentry
platform 32 m; the bridge_long's ends are ±26 m on a 54 x 4.4 plot, underside 7.5 m; the rover is 5.43 x 3.53 x 10.30 m (6 x 11 plot), wheel
radius 0.76, sockets SOCKET_INTAKE (0, 0.25, 4.93) and SOCKET_OFFLOAD (-2.14, 1.93, -3.92); the SAI-92 unit is 6.32 x 3.99 x 4.58 m (7 x 5 plot),
its bay 10 x 9 m, 3.4 m tall, landing datum y 0.215; the Yushi045 is 3.74 x 3.15 x 3.49 m (4 x 4 plot), SOCKET_FILL (-1.41, 1.9, 0) facing -X,
SOCKET_DISPENSE (0, 0.57, 0.93). THE YUSHI045'S FILL IS A CUSTOM `_YUSHI` VERTEX ATTRIBUTE and gltfpack drops it even with -kv (measured
2026-11-06): `scripts/build.mjs` must copy `assets/models/yushi045/*.glb` unpacked (63 + 27 KB plain) or the capacity shader throws on the
dist page. Stream D owns that build change.

The round runs as rounds 4 to 7 did: worktree branches off 9b9171eb, one browser at a time under the lock (`node
~/scripts/stalheart-browser-lock.mjs acquire|release|status <name>`, HELD ONLY ACROSS ONE SUITE RUN, chain the run with `&&` so a failed acquire
never runs unlocked), a port each (18181 / 18182 / 18183 / 18184 through `STALHEART_BROWSER_PORT`), a scratch subfolder each, one commit per
note (or coherent half), a decision entry per stream (`docs/log/entries/<id>.json`, schema in `scripts/log.mjs`; `npm run log:check` validates;
`npm run log` renders DEVLOG.md), a STATE paragraph per stream under `## What landed on 2026-11-06 (round 8, stream X)` at the top of the
"What landed" list in `docs/STATE.md`, nothing pushed by a stream. `~/Dev/stalheart` serves :8155 live: never edit it. `node --check` every
edited file before running a suite (every suite timing out at load = a syntax error). `npm run architecture` guards `src/td-tab.js`'s 5,450-line
ceiling (5,329 now: host literals only in td-tab, the behaviour in src/domain, src/fx, src/content) and the frozen top-level module list: new
modules go in a layer directory (use the project skill `add-module`). Domain modules import nothing from src/fx or src/content.

## Stream A — the ground and the friendlies (branch `round-8-ground`, port 18181): notes 1, 2, 3

### Note 1, the laser's burn marks hover where the rock was

What is there now (scout): `src/fx/laser-arsenal.js` `groundAt(p)` (line ~69) is live — `onSphere(p, 1 + (BLOCKED ? host.wallHeight() : 0))`
from the cell's current tag — and `burn()` (line ~213) lays and aims the contact at that ground BEFORE it breaks the rock in the same call
(`inFootprint`/`burnContacts`/`host.breakCells` at ~246-252; `LASER_BURN.rock` is 0.5 s). `src/fx/orbital-laser.js` `lay`/`aim`/`tick` stamp
the scorch (`src/fx/scorch-trail.js` `stamp(point, normal)` writes the instance matrix once at `point + normal * lift`, never rewritten; `tick`
only ages). `breachWallCell` (`src/td-tab.js` ~2958) flips the tag to PATH; nothing re-seats the stamps laid at rock height. `LASER_TRAIL.seconds`
is 60 (the char's fade), `hot` 4 (the ember glow): "a few seconds" is the ember.

Decision: re-seat the live stamps when the rock under them breaks. `scorch-trail.js` keeps each slot's point and normal and gains
`reseat(groundAt)` that rewrites the matrix at `groundAt(point) + normal * lift` for every live slot, ages and seeds untouched;
`orbital-laser.js` exposes it; `laser-arsenal.js` calls it right after `host.breakCells(cells)` with its own `groundAt`. Marks laid on floor are
unchanged (groundAt returns the same point). Test `test/scorch-trail.mjs` (or the laser's existing test): a stamp at radius 1.03 re-seats to 1.0
when groundAt says floor; one on floor keeps its matrix; ages unchanged. Measure first on the game path (`--laser-game` or a scratch probe on
`?sector=…` with SOL's seat): record the instance matrices' radii before and after a rock burn; after the fix every live stamp's radius equals
groundAt's. Keep the fix in the three fx files; td-tab does not change.

### Note 2, the pets clip through the base under the Stalheart

What is there now (scout): companions are placed on the bare unit sphere (`src/fx/companions.js` spawn ~69, `place(u)` ~130-134, the print ~226,
the step ~172-178) with no lift. The islands' slabs are flat plates on the tangent plane (`src/domain/base-plan.js` `top: 0, sag: drop(...)`,
`src/fx/story-base.js` `place`/`islandMatrix` ~71-88): the sphere falls away under the slab toward its edges (`src/core/terrace-profile.js`
drop), about 1.1 m at the Stalheart's 57 x 56 m slab's edge, 2 m at its corners, which the slab's 1.2 m skirt covers. So a cat on the sphere
at the slab's edge is a metre inside the slab. The hull is a hover tank 10 m long drawn `MORK_UNIT.lift` above the sphere; Isao flies.
`story-base.js` `slabAt(p, padM)` (~328) only says which island a point is on (`top` is always 0).

Decision: a `floorAt(p)` on the story base: for a point inside a grown island's plot (the slab's rectangle in frame metres, the same test
`slabAt` makes), the radial factor that lifts the point to the slab's tangent plane, `1 / dot(p, c)` with `c` the island's unit centre (plus the
slab's top thickness if the slab mesh has one: measure the kit's `foundation_slab.glb` top surface and use that number); 1 elsewhere. Pure
helper in `src/domain/base-plan.js` or a new `src/domain/slab-floor.js` (tested: centre 1, edge of a 57 m slab on a 753 m planet ≈ 1 + 1.1/753,
outside 1). `companions.js` applies it in `place()` and the print bed (the wrap's position = `u.pos * floorAt(u.pos)`), through the host
(`src/td-tab.js` ~2395 hands `floorAt` beside `solidAt`). Measure first with `--companions` or a scratch probe: each pet's wrap radius against
`floorAt` of its position while it walks across the Stalheart's slab and off it; before the fix the difference is up to ~1.1 m at the edge,
after it is 0. Check the Ridgebacks (`src/fx/mech-squad.js`) and the nest guards do not need the same lift (they walk the open ground, not the
slabs; if the hull itself reads under the slab's edge on a screenshot, note it for the owner rather than fix it — note 2 is the pets).

### Note 3, the tank pushes the friendlies aside

What is there now (scout): the hull slides along `solidAt` (`src/fx/hull-drive.js` ~186-196) and exchanges contact with the Pearl bodies
through `host.bodyContact` (`src/fx/hull-contact.js`); companions are not in it. A pet only refuses its own step into `keepFromHull`
(`companions.js` ~172-174; 2.5 m for the cats in `src/content/companions.js`, 12 m for the mech), skipped in `greet`/`greeted`, and the cats'
greet stops `nearM` 3 m off the hull's point — inside the 10 m hull. The pure rule (`src/domain/companion-play.js`) owns mode and speed; the
scene (`companions.js` `stepUnit` ~155-187, `resolve` ~94-123) owns `u.pos`. Friendly mechs (`src/fx/mech-squad.js`) keep off the hull by cells.

Decision: the hull is a solid the friendlies are pushed out of. A pure rule `src/domain/friendly-push.js` `pushOut(point, hull, {halfLength,
halfWidth, pad})` returns the point moved out of the hull's oriented box (centre `hull.pos`, heading `hull.dir`; `src/domain/hull-bodies.js`
`boxContact` already does the oriented test — reuse it) by the shortest way, plus the pad; tested on the four sides and a corner, a point
already outside unchanged. `companions.js` applies it after `stepUnit` for every born, loaded unit (the cats, K0-TECH, the mech `padM`), so a
greeting cat is shoved too, and raises the cats' `greet.nearM` in `src/content/companions.js` to the hull's half length + pad + 1 (about 7.5
m), with the owner's quote. The Ridgebacks (`mech-squad.js`): the same `pushOut` on their drawn position after their step, when the hull's box
overlaps them (they walk cells; a push off their cell is fine as long as their cell logic reads the pushed position or re-targets; if that is
intrusive, push the DRAWN mesh only and say so). Measure first: `--companions` drive (the hull drives through the pets) and a scratch probe that
parks a pet in the hull's path and drives: before, the pet is inside the hull's box for N frames; after, never (distance from the hull's centre
line ≥ halfWidth + pad every frame). The hull itself is not slowed or deflected by a pet (the owner: "push them aside").

## Stream B — BELOW's mouse orbits the camera (branch `round-8-below`, port 18182): note 4

What is there now (scout): the cave lives in `~/Dev/stalheart-cave` (branch `round-7-below`, HEAD ace9566 = `below/BELOW.lock.json`; the game
re-imports it with `node scripts/import-below.mjs` from the game root, which refuses a dirty cave tree). Round 7 D removed the mouse entirely
(`src/main.js` ~240 "THE MOUSE DOES NOTHING"; the removed pointer-lock drag is in `git show ace9566 -- src/main.js`). Movement reads only `yaw`
(`src/flight.js` `fly(f, dt, input, yaw, loaded)` ~22-35); the chase camera (`src/isao.js` `update` ~32-56) follows `camYaw = chaseYaw(camYaw,
yaw, dt)` at `CHASE.follow` 6 /s, pitch clamped to `[CHASE.above, CHASE.below]`, the boom clipped along ISAO's own ray, `lookAt` along the
camera yaw. Tests pin the removal: `test/flight.test.mjs` ~53-56 (no mousemove/pointerlock strings in main.js) and `scripts/browser-test.mjs`
~63-69 (a 400 px CDP drag must change nothing). Copy says "the mouse does nothing" in `index.html` ~46, `src/mission.js` ~142 (FLIGHT_KEYS),
the start card and README.

Decision: the mouse orbits the camera round ISAO; it never writes `yaw` or `pitch`. In the cave repo, branch `round-8-below` off `round-7-below`:
- `src/flight.js`: `ORBIT = { yawRate, pitchRate, hold: 0.8, k: 2.6, maxYaw: π }` and a pure `orbitStep(orbit, dx, dy, dt, { dragging })`:
  while the pointer moves, the orbit yaw and pitch take the deltas (pitch clamped so camera pitch + orbit pitch stays in `[above, below]`);
  after `hold` seconds without input both decay to zero at `1 - exp(-k dt)` (the camera returns behind him on its own). Tests: clamp, decay,
  no decay while dragging.
- `src/main.js`: `orbit` state beside `yaw`/`pitch`; `mousedown` on `#view` starts a drag, `mousemove` feeds `orbitStep` with movementX/Y
  times a sensitivity (0.0045 rad/px, a 400 px drag ≈ 1.8 rad), `mouseup`/`blur` end it; NO pointer lock (its loss paused the game, and a CDP
  drag cannot exercise it; if a hovering-pointer orbit without a button feels better in the headed check, use it, but say so). Pass `orbit`
  in the flightData to `world.update` → `isao.update`.
- `src/isao.js`: `az = camYaw + orbit.yaw`, pitch = clamp(orbitPitch + orbit.pitch); the rest unchanged (the boom still clips along his ray,
  the lift, the lookAt). The door frames (`doorLook`, main.js ~162-168) keep ignoring the orbit.
- Tests: `flight.test.mjs` asserts main.js never assigns `yaw` or `pitch` from a mouse event (grep the handler text); `browser-test.mjs`: a 400
  px drag changes the camera azimuth and leaves `yaw`, `pitch` and the player's position unchanged (W for 1 s during the drag still moves him
  along HIS heading), and the azimuth returns within 0.05 rad of `yaw` 2 s after the drag ends; the chase loop measures against `yaw +
  orbit.yaw` or with the orbit at zero. Copy updated (index.html, FLIGHT_KEYS "MOUSE · LOOK AROUND", the start card, README).
- Ship: `npm test`, `npm run check`, `npm run test:browser` in the cave under the lock; commit on the cave's `round-8-below`; in the game
  worktree `node scripts/import-below.mjs ../stalheart-cave` (the cave checkout at `~/Dev/stalheart-cave` must be ON that branch and clean),
  then the game's `--descent` suite under the lock, commit `below/` + `BELOW.lock.json`. Say in the entry which commit of the cave is pinned.

## Stream C — THE DOME CITY, the new base (branch `round-8-dome`, port 18183): notes 5 (the dome, the SAI-92 on the base) and 6

What is there now (scout): one layout, `src/content/base-layout.js` (`ISLANDS`, `STRUCTURES`, `KIT`, `SOLID_STRUCTURES`), planned by the pure
`planBase` (`src/domain/base-plan.js`) on a 150 m clearing (`STORY_CLEARING.radiusMetres`, `src/content/story-defaults.js`; the planet's radius
~753 m; the mouth at -Z; the sightline cut at x≈0 from the forward cell out through the gate to the sinkhole), consumed by
`src/platform/story-world.js` (`buildWorld` → `planBase` → `createStoryBase`), the labs (`src/labs/story-tab.js`, `laser-tab.js`,
`gunship-tab.js`) and the programme (`src/content/base-programme.js`, steps print islands and structures; `board: true` steps are bought).
`test/base-plan.mjs` pins: islands 4 m apart, inside radius - 8, sag ≤ 1.2 m (a 60 m slab is the limit), a hard-coded stage-1 list, the gate on
the mouth. Two tiers per structure (`asset` near, `far` beyond `KIT.lod.metres` 150). The hull is stopped by `SOLID_STRUCTURES` footprints
(`src/domain/footprint.js`: the triangles near the ground, so a dome's shell stops it and a bridge's columns do, not its 7.5 m deck). The
author's city: nine domes on an 80 m grid (x, z ∈ {-80, 0, 80}), twelve 52 m bridges between neighbours at (±40, row) and (col, ±40), four
courts between; status `diorama_candidate_not_game_integration`; four corner domes carry a Railgun T3 on a 32 m cradle (a sentry socket on a
dome is NOT this round: note it as a follow-up).

Decision: THE DOME CITY is a second layout of the same base, chosen by `?base=dome|classic`, DEFAULT dome on the story page once green (below).
- `src/content/dome-city.js` (content, pure data): the dome islands (30 x 30, ids `dome-nw`, `dome-ne`, `dome-w`, `dome-e`, `dome-sw`,
  `dome-se` at (-80,-80), (80,-80), (-80,0), (80,0), (-80,80), (80,80) with their roles habitat / logistics / biosphere / fabrication / habitat /
  logistics as the author's layout gives them), their structures (asset `assets/models/dome-colony/<role>_d0_lod1.glb`, far `_lod2`, scale 1,
  solid), the four side bridges (`bridge-w1` (-80,-40), `bridge-w2` (-80,40), `bridge-e1` (80,-40), `bridge-e2` (80,40); the author's yaw
  -π/2 for the N-S links; islands 54 x 4.4 → a 56 x 8 plot, or no island at all if a bridge needs no slab — decide by how its columns meet the
  sphere's sag over 52 m (the drop over ±26 m is 0.45 m; the author's columns stand on a flat datum) — and the dome's port caps hidden on the
  linked side (`open_ports`, hide the named cap nodes at LOD1 per the dome-colony README; LOD2 keeps its silhouettes). The Stalheart stands in the
  centre dome's place (THE TERRAFORMER IS THE POWER DOME: the author's `DOME_22` power dome is not placed). The north-centre dome (`DOME_12`,
  research) is not placed: the mouth corridor, the landing island and the sightline run there. The south-centre dome (`DOME_32`) is not placed:
  the bays stand behind the Stalheart with their doors toward the gate and the hull's roll-out lane. So six domes, four bridges — write this
  reading in the file's header with the owner's words, so he can overturn it.
- The existing elements "in between": a placement table in `dome-city.js`, `DOME_PLACEMENT = { <islandId>: { x, z, heading? } }`, applied by a
  pure `withBaseLayout(islands, structures, mode)` in `src/content/base-layout.js` (one place, like `withLandmarkTiers`): every classic island
  keeps its size and its structures; only centres move. Keep the Stalheart (4.5, 0), the landing (0, -60), the bays (0, 62; check the south
  bridges — there are none now — and that the roll-out lane is clear), the boards (-38, 2) and HUGIN (-52, -40) where they can stay (HUGIN's
  40 m slab vs `dome-nw` at (-80,-80) r 14.6 and `bridge-w1` at x -82.2..-77.8: measure); move what collides: the launcher (-74, 2) sits on
  `dome-w` → into the launch court (NW) beside HUGIN or the SW court (its rail must still fire out over the rim between domes, `heading`; check
  `src/fx/arc-launch.js` for the sled's path and that the satellite clears the domes and bridges), the assembly (56, 6) pokes into `dome-e` →
  x 50, the chips (60, 40), the solar (44, -60), the farm (48, -30), the radar (-56, 34), the armory (-34, 62), the garage (31, 62), the depot
  (stream D's new island, `depot`, 36 x 16, classic site (-70, -78): in the dome city put it in the NE court beside the solar/farm, the rover's
  road to the gate short). Rule: 4 m between islands (the test), no island under a dome's 14.6 m or a bridge's strip unless the structure is
  lower than the 7.5 m deck, the sightline x≈0 toward -Z free, every court reachable by the hull (drive it round with the harness). Print an
  ASCII plan from a scratch script (`node` on the pure data, 2 m per character) and keep it in the entry's evidence.
- `planBase` and the tests take the layout mode: `story-world.js` reads `?base=` through one parser (`baseLayoutMode(search)` beside
  `landmarkTierMode`), the labs too. `test/base-plan.mjs` runs on BOTH layouts (the stage-1 list is the same). `SOLID_STRUCTURES` gains the
  domes and bridges. The domes and bridges are stage 2 (foundations: the colony arrived with its domes; the owner: "the main base"), printed by no
  step, standing from the start — unless the structure-print test or the opening's reveal (`src/fx/arrival.js`, the foundry beat) needs them
  later: measure, decide, write it down. The domes are 32 m tall: the chase camera behind the hull (`src/fx/hull-drive.js`, the camera's own
  clip) will meet them — drive the hull through each court and the corridor in the harness and screenshot (`artifacts/`), and if the camera
  goes inside a dome, say so in the entry (fixing the camera's clip against structures is a follow-up unless small).
- Performance: six domes at LOD1 are ~36k triangles / 48 draws, four bridges ~4k / 8; far tier 150 m. Read the frame cost with the existing
  render-workload probe (`src/render-workload.js`, `--probe`): before/after draw calls and ms on the base camera at the start; report them.
- The SAI-92 and its bay stand on the depot island (stream D defines `depot`; stream C only MOVES it in the dome layout). Stream C does NOT add
  structures to `STRUCTURES` for the SAI-92: stream D does (one owner of the depot). Stream C adds THE DOME CITY to the terminal
  (`src/content/bestiary.js` colony section: one entry, "DOME CITY", the six domes' roles, the bridges, Isao's line; its thumbnail the habitat
  dome's lod2) and `docs/ASSETS.md` + `ATTRIBUTIONS.md` rows for the dome-colony family (stream D writes the rover/pearl/SAI-92 rows).
- The default flip is the LAST commit of the stream, after `npm test`, `npm run check`, `npm run architecture`, and under the lock the browser
  suites `--story-world --colony --companions --board --opening --sector-probe --canyon --descent --gunship --laser-game` (one chain) pass on
  `?base=dome`; if a suite that is green on `?base=classic` goes red on dome, do not flip: leave dome opt-in, list the red suites and why in the
  entry and STATE. Either way the entry states which it is. `?base=classic` always stays.

## Stream D — THE ROVER AND THE BIO-PEARLS, biomass is collected (branch `round-8-rover`, port 18184): note 7, and the SAI-92 on the base

What is there now (scout): every kill pays the bank at the moment of death (`src/domain/economy.js` `award`, called from `src/td-tab.js`
`damageEnemy` ~2801-2811 (KILL_PAY tank 1 / tower 0.5 / strike 0.5) and `src/fx/enemy-step.js` ~546 for rams); non-kill credits go through
`addBiomass(n, {category})` (grant, refund, breach-grant, sector-held, farm — the farm's 40 kg a sector in `src/fx/colony-tick.js`); the HUD
reads `eco.biomass` (`td-tab.js` ~2176), the debrief "IN THE BANK" (`src/fx/sector-debrief.js`), the build board (`src/fx/build-board.js`).
No flare exists in the main game (the cave's is the reference: `below/src/flares.js`, `flare-physics.js`, F key, 15 red + 1 green, a light + halo
+ core that sticks where it lands); F is unbound in `src/platform/tank-input.js`; the controls card is `src/fx/controls-card.js` CONTROLS_PAGE.
No carcass pays. The farm's three bio cassettes (`bio-a/b/c` on the farm island) are cosmetic. The catalog is `src/unitcatalog.js`
(PLAYER_UNITS / STRUCTURE_UNITS, `kind: 'model'` with a url), the terminal `src/content/bestiary.js` (colony section; `needs` gates; Isao's
lines) and `src/fx/unit-bench.js`; a unit's `offer` puts a card on the build board (`src/content/companions.js` ~48). Pathing primitives:
`bfsPath(adj, start, goal, avoid)` in `src/dungeon.js` ~69 (the hull's `gotoCell`, `td-tab.js` ~1043), the Ridgebacks' `nextCell`
(`src/domain/mech-roles.js`), Isao's `stepDir` slerp (`src/fx/isao-worker.js`). The expedition crate (`src/fx/cargo.js`, `expedition-glue.js`)
is the closest existing loop: a thing waits on the ground, a unit fetches it, it is carried home.

Decision: KILLS LEAVE BIOMASS ON THE GROUND; THE ROVER BRINGS IT TO THE PEARLS; THE PEARLS ARE THE BANK.
- Pure rules, new `src/domain/biomass-field.js`: `createField({ decaySeconds, maxPiles })` — `drop(cell, kg, now)` adds to the pile on that cell
  (aggregated per cell, `pile.kg`, `pile.at`), `piles()`, `near(cells, reach)`, `take(cell, kg)`, `tick(now)` (a pile not touched for
  `decaySeconds` rots away, so the field is not a stockpile), `total()`. `src/domain/rover-run.js`: a finite state machine like the author's
  `mission.js` (kept in the vault as the reference; not vendored — it has its own field and depot): `idle` at home → `dispatch(flare)` → `out`
  (a cell path to the flare's cell) → `harvest` (piles within `reach` cells of the flare, nearest first, `harvestRate` kg/s, until `capacity` or
  none left) → `home` (path to the pearl with the most room; `unload` at `unloadRate` into it; `storage full` waits) → `idle`. Pure: paths come
  from a `host.path(from, to)` the scene gives it (bfsPath on the dungeon's PATH cells avoiding `solidAt` footprints, through the gate; the rover
  may leave the clearing — the player's flare decides the risk; it is not shot at this round). `src/domain/bio-pearls.js`: n pearls with
  `capacity` each, `stored`, `room()`, `fill(kg)` (into the pearl with the most room), `spend(kg)` (from the fullest); THE BANK IS THEIR SUM:
  `eco.biomass` stays the number the HUD, the board and Isao's prints read, so `economy.js` gets a `cap` (the pearls' capacity) and `addBiomass`
  clamps to it (what does not fit is lost at the pearl with "STORAGE FULL" on the rover's readout; the rover waits home with its cargo).
  Tests for all three (`test/biomass-field.mjs`, `test/rover-run.mjs`, `test/bio-pearls.mjs`): drop/aggregate/decay/take, a full trip's states
  and kg on a fake path, the full-pearl wait, the cap.
- Numbers, `src/content/rover.js` (content): from the `--ledger` probe (round 6: 11.4k, 25.3k, 70.0k, 61.3k, 77.6k kg in sectors 1-5 on the
  base, the reference player half) the rover must bring a sector's kills home in a few trips with time left for the next: `capacity` 2,000 kg,
  `harvestRate` 150 kg/s, `unloadRate` 300 kg/s, `speed` 9 m/s (the hull's cruise for reference in `src/content/tank.js`), `reach` 3 cells (30
  m) round the flare, `turn` rate like the author's 0.8 rad/s; the field's `decaySeconds` 240 (a sector's kills must be flagged within four
  minutes); three pearls of 12,000 kg (36,000 kg bank cap — above a reference player's sector 5 income, below the ledger's; the board's prices
  are unchanged this round; write the reasoning in the file). A fourth pearl is a board card (`pearl`, price 2,000, "+12,000 kg of storage";
  `src/content/build-board.js` structures gain it; the programme step `pearl-d` prints it on the depot island). The rover's own card is NOT on
  the board this round ("buildable unit, but not used for now"): its catalog/terminal entry carries a price (3,600 kg) and the line "a second
  rover: not yet".
- The flare, `src/fx/hull-flare.js` + `src/content/rover.js` FLARE: F drops a flare at the hull's position (the cave's look at the game's
  scale: a light, a halo, a core that stands on the ground, amber `0xffb43c` like the cargo pad — not the cave's red, not Isao's green), lifetime
  `FLARE.seconds` 90, at most `FLARE.max` 3 standing (the oldest replaced), each with a readout ring (`src/fx/site-ring.js` `dropSiteRing`) at
  `reach`; a flare is the rover's order (the newest flare while it is idle; a flare dropped while it works queues one). Key in
  `src/platform/tank-input.js` (F), the line on CONTROLS_PAGE, Isao's callout the first time ("drop a flare where the bodies lie; the rover
  comes"; `src/content/...` voice/callout tables as the companions' prints do). Flares drop on the ground under the hull, on the sphere (the
  pearls stand on the depot slab: stream A's `floorAt` lifts things on slabs; the rover's wheels take the slab through its `terrain` callback).
- The scene, `src/fx/rover.js`: loads the rover's LOD1 through the story base's loader (cached scenes must be CLONED), drives it along the run's
  path on the sphere (slerp like Isao's `stepDir`, heading from the path, a turn-in-place at the ends), the author's `runtime.js` adapter
  (`assets/models/yushi-rover/runtime.js` `createRoverController(T, scene)`, dependency-injected with the game's Three — imported from the asset
  path like the garage's `runtime.js` is) for the wheels, the suspension on a `terrain(x, z)` that returns the slab lift, the belt while
  harvesting, the tank gauges at `fill`; the LOD2 beyond `KIT.lod.metres` like a structure's far tier (static, no swap mid-trip per the author:
  swap only while idle at home, or skip the swap and say so). `src/fx/bio-pearls.js`: the three pearls as structures (`pearl-a/b/c` on the
  depot island, asset `assets/models/yushi045/yushi045_container_d0_lod1.glb`, far lod2; SOCKET_FILL faces -X toward the rover's dock) with the
  author's `createYushiController(T, root)` (`assets/models/yushi045/runtime.js`) for the fill level and the `filling`/`ready` state; BUILD:
  `scripts/build.mjs` copies `assets/models/yushi045/*.glb` unpacked (the `_YUSHI` attribute; see the top of this document), and a dist check in
  `test/` or the build asserts the attribute survives in `dist/`. The field's piles: one instanced mesh (`src/fx/biomass-piles.js`), an olive
  blob (`0x71863c`, the author's slurry colour) scaled by kg (cube root), on the ground at the pile's cell, capped `maxPiles` 400; a
  piles-on-the-rock pile after a rock breach stands on the floor (the cell's live tag, as stream A re-seats the scorch).
- The base: a new island `depot` (36 x 16, stage 8, classic site (-70, -78): HUGIN's slab ends at z -60; check `test/base-plan.mjs` margins
  and the clearing radius) carrying `pearl-a/b/c` in a row along its east edge (4 x 4 each), the rover's home pad (not a structure: the run's
  home cell is the island's west half) and the SAI-92 bay (`sai92-bay`, 10 x 9) with the unit (`sai92`, 7 x 5) landed on its SOCKET_LANDING at
  rest (static this round; "we import new models": it stands, the terminal says what it is and that mining is to come). Stage 8 = standing at
  the game's start with the assembly line and the radar (the programme's `reach`). Stream C moves the `depot` island in the dome layout — do
  not touch `src/content/dome-city.js`. The farm's `bio-a/b/c` cassettes stay (the farm is the greenhouse's).
- The economy's hooks: `damageEnemy` (`td-tab.js` ~2811) and the ram (`enemy-step.js` ~546): `eco.award(...)` still computes the kg (the streak,
  the ledger's `earned` by source, the gunship's feed) but the kg go to `field.drop(cell, kg, now)` instead of `eco.biomass` — through one
  function `payKill(kg, cell)` on the economy host so td-tab's diff is small. `sector-held`, refunds, grants and the farm's 40 kg stay direct
  (`addBiomass`, now capped). The ram readout keeps its number. The HUD: a second number beside the bank, `FIELD n kg` (`td-tab.js`'s stats
  line or `src/fx/hull-console.js`), and the rover's state on the hull console (`ROVER · OUT 1,240 kg`, `STORAGE FULL`). The debrief's "IN THE
  BANK" is the pearls' sum; add "ON THE GROUND n kg" when the field holds any. The `--ledger` probe (and `test/`'s economy fixtures) must read
  the field: re-run it and put before/after kg in the entry.
- The units: `src/unitcatalog.js` + `src/content/bestiary.js` colony entries for YUSHI ROVER (needs: the depot), YUSHI045 BIO-PEARL and SAI-92
  (name it as the author does, 採掘 in the facts), each with its model url and Isao's line; `docs/ASSETS.md` + `ATTRIBUTIONS.md` rows.
- Measure: a browser suite `--rover` (new, in `scripts/browser-test.mjs` beside `--companions`): `?skip=defence&sector=2` (or the harness's
  quickest route to bodies dying on the lane), kills accrue in the field, the bank does NOT move, F drops a flare at the hull, the rover
  leaves home within 2 s, reaches the flare, harvests (the field falls, its cargo rises), returns, the pearl's fill rises and the bank rises by
  the cargo; a pearl at capacity holds the rover. Then `npm test`, `npm run check`, `npm run architecture`, `npm run build` (the `_YUSHI`
  check), and under the lock `--colony --companions --board --ledger --debrief --opening` green.

## Pacing and cost, across the streams (the owner: "tweak the existing game to fit the new models, for pacing and cost of units too")

Income is no longer instant: the player flags fields and the rover's trips are the income's clock. The board's prices stay (round 6 re-based
them on the ledger; the rover's capacity and rates above are sized so a sector's reference income lands within the sector), the pearls' cap is
the one new ceiling, the fourth pearl the one new price, the rover's catalog price the one new unit cost. Stream D runs `--ledger` before and
after and writes both into its entry; if a reference player's sector 2 board cannot buy two mid cards after the change (round 6's bar: ~6.3k
kg in hand), the stream lowers `decaySeconds`' pressure (not the prices) first and says so. The dome city changes no enemy pacing (the clearing
stays 150 m).

## Merge

The integrator merges A, B, C, D onto `overnight-2026-10-23` in that order, resolves `base-layout.js` / `bestiary.js` / `browser-test.mjs`
overlaps, runs `npm test`, `npm run check`, `npm run architecture`, `npm run build` and the union of the streams' browser chains under the lock on
the merged tree, renders DEVLOG, writes the day's vault entry, and pushes the integration branch (the owner: "wake up to a testable version")
— not main.
