# THE BASE FROM SCRATCH — the dome city printed in play, and the wheeled Stålheart (2026-11-07, from `overnight-2026-10-23` at 2ca0c418)

Owner, 2026-11-07, going to sleep: "1. The base should not be built yet. Isao comes out and starts a base from scratch, first scavenging the
rocket, then building the stalheart, then the stalheart and isao keep building. But they need biomass to do so. We have a new Stalheart that has
wheels instead of being on rails, it will be printing the Domes, which need to be resized, but still must leave room for the tank to go under the
bridges. 2. We import the new yushi-rover and stalheart-kidou, the moving gantry. 3. This initial animation is close to what we want
(stalheart-diorama). 4. We import the sai93 miner, and the lab-crystals for a test."

Items 2 and 4 landed on branch `a6-imports-2026-11-07` (entry `2026-11-07-the-a6-imports-...`; the KIDOU and the SAI-93 pinned with their
facts, the rover unchanged upstream, the crystals pinned as code). Item 3 is summarised in the vault (`projects/stalheart/a6-2026-11-07/
stalheart-diorama/`). This spec is item 1, read against the code; the operator was not present for the design pass, so every decision is
written for the owner to overturn with one line.

## 1. What the code says today

- A story start on the bare page is ALREADY a base from scratch: the SH02 lands (`src/fx/arrival.js`), the AFR-01 foundry scavenges it
  into barrels (`src/content/foundry.js`), and Isao prints the base step by step on his programme (`src/content/base-programme.js`: the gate and
  walls, the Stålheart (75 s), the landing pad, the solar, the bays, HUGIN, the depot, the radar, the assembly ...). Some steps left the
  automatic programme for THE BUILD BOARD (`board: true`; prices in `src/content/build-board.js`, paid in kg of biomass at the pick between
  sectors). The economy the owner asks for exists.
- What is NOT from scratch is the DOME CITY (round 8, `src/content/dome-city.js`): the six domes and four bridges are `founded: true`, which
  `src/domain/base-plan.js` never marks pending, so a growing base stands them from its first frame ("the colony arrived with its domes").
  That is the thing the owner means by "the base should not be built yet".
- The Stålheart today is the rail terraformer (`assets/models/astro/terraformer_3000_d0_game.glb`, 49 animated nodes in `Terraforming_Cycle`)
  printed by Isao as the `stalheart` step. Several systems lean on that model: the disco party's crane-hook pose and the ball under the
  extrusion tip (`src/fx/disco-party.js`), the hull repair under the gantry's footprint (`src/domain/hull-repair.js`), the terraformer yard's
  containers (`src/fx/terraformer-yard.js`), the sky disk aimed toward it (`galaxyseed.js` `SKY_HOLE`), the far tier and the batching.
- The KIDOU (`assets/models/stalheart-kidou/`): the same gantry raised onto two 24 m beams with eight steered wheels (42.1 x 39.9 x 24.0 m, a
  48 x 28 plot that turns with it), the arm's nodes named as the old gantry's, NO baked clips: `runtime.js` `applyKidou(THREE, scene, {...})`
  drives wheels, dampers and hoses from a mode and a distance, never the root. The diorama prints the gantry wireframe bottom-up as Isao's
  beam does, then the arm prints a MÖRK, the gantry rolls 52 m and prints a half-scale dome.
- The dome model is ±14.6 m on a 30 x 30 plot, its ports 14 m out at y 9.7; the 52 m bridge_long's sockets ±26 m at y 9.7, its deck's
  underside 7.5 m; the MÖRK is 3.016 m tall.

## 2. The decisions

**A. The domes and the bridges are printed in play, paid on the board.** `founded` goes. A static page at stage 2 or above still stands them
(their stage stays 2); a growing base (the story's default) prints them: six board steps, one a dome, each an island plus its module; the four
bridges print themselves once both their domes stand (a new `when.stand` condition on the programme: the step is due when every named structure
stands; no price, 8 s). Isao's beam prints them exactly as it prints the garage or the armory today (`src/fx/structure-print.js`'s wireframe
ghost then the skin). The SH02 now comes down on an empty plain, which the landing mini-game wants anyway.

Prices, in the board's scale (`BUILD_BOARD.structures`, kg; the farm is 3,200 and gives +40 kg a sector; a dome has no mechanical effect
yet, so it is priced below the farm and its effect line says what it is): habitat 2,400 ("a habitat dome of the colony"), biosphere 3,000
("the colony's biosphere dome"), fabrication 2,800, logistics 2,400. `when`: the two domes on the mouth's side (`dome-nw`, `dome-ne`) from
sector 1, the middle pair from sector 2, the far pair from sector 3, all `idle: true`. The board's `structuresMax` stays 4, so a board never
fills with domes.

**B. The domes are resized to 0.65; the bridges keep their length and lose a third of their height.** `DOME_SCALE` 0.65 in
`src/content/dome-city.js`: the dome's envelope ±9.5 m on a 20 x 20 island, its ports 9.1 m out at y 6.3. The bridge is scaled 0.65 in height
ONLY (its local Y; its 54 m length and 4.4 m width unchanged): the deck's underside 4.9 m, the MÖRK's 3.0 m plus its hover with 1.4 m to spare
(the owner's rule), the sockets at y 6.3 meeting the scaled ports. The domes move in toward their bridges so socket meets port: the bridge's
end is 26 m from its centre and the port 9.1 m from the dome's, so a dome pair sits 70.2 m apart, not 80 (the middle domes stay at z 0, the
outer ones at z ±70.2, the bridges at z ±35.1); the columns stay at x ±80. `lift` is re-derived for the new spacing from the sphere's sag
(`d² / 2R`, R 753 m: the dome 0.82 m low at 35.1 m, the bridge's end 0.45 m low at 26 m) and the dome-city test checks the end columns on the
slabs within a decimetre. The placement rule (`test/dome-city.mjs`: 4 m between islands, nothing under a dome or a bridge's strip, the
sightline free, every island reachable) is run on the new numbers and the classic islands that fail it are nudged by the least amount, each
nudge recorded in the entry.

**C. The wheeled Stålheart, this round: a look, behind a flag.** `?gantry=kidou` swaps the `stalheart` landmark's two tiers for the KIDOU's
(`stalheart_kidou_d0_lod1.glb` / `_lod2.glb`, scale 1, `clips: []`) and runs its adapter parked, wheels on the slab, through a small host
(`src/fx/kidou-rig.js`: `applyKidou` with the game's THREE each frame in `park` mode). The systems that read the old model's clip or pose are
guarded so a Stålheart without `Terraforming_Cycle` or the crane-hook pose does nothing rather than throwing (the party hangs its ball under
`EXTRUSION_TIP`, which the KIDOU keeps; the repair's footprint reads the holder's box as before). The owner looks at it in the base in the
morning; the default stays the rail terraformer until he says.

**D. The wheeled Stålheart printing the domes: designed, not built.** Written here so the next round starts from it:
1. The KIDOU parks on the Stålheart island facing +z. A dome step bought on the board becomes a KIDOU job: the gantry drives to the dome's
   plot (the island's centre, its 48 x 28 plot turned to the approach), parks straddling it, and its arm prints the dome layer by layer as the
   diorama does (the structure-print's clip plane climbs; the nozzle rides the plane's height over the plot's centre, `EXTRUSION_TIP`
   0.8 m above it, the beam across the gap), then drives back. Isao prints everything else as today.
2. The drive is the YushiRover's (`src/fx/rover-glue.js` drives a body between points on the sphere on the lattice's cells, round 8): the
   same driver on the KIDOU's root, the wheels from `applyKidou({ mode: 'drive', distance, steerDeg })` with the odometry from the root's
   actual displacement (the adapter's `stateAt` is a demo generator; the game owns the path). Turning in place is `mode: 'turn'`.
3. The roads: a dome column is reached along the courts (x ±80 is free ground between the islands and the clearing's rim); the KIDOU is 24 m
   tall, so it never passes under a bridge: it prints the two domes of a pair before their bridge is due, and leaves by the court side. The
   programme gates a bridge on both domes standing AND the gantry back home (`when.stand` plus `when.home`).
4. The MÖRK: the bays print hulls today; the diorama's gantry-printed tank is a later choice.
5. Day 42, the repair and the yard move with the gantry: the party's ball under the tip wherever it parks, the repair under its beams.

## 3. What this round builds

- `src/content/dome-city.js`: `DOME_SCALE`, the islands 20 x 20, the structures at 0.65 (the bridges `scale: [1, 0.65, 1]` if the base's placer
  takes a vector, else a `scaleY`), the new z's and `lift`, `founded` gone, `DOME_PLACEMENT` nudges.
- `src/fx/story-base.js` `place()`: a non-uniform scale if it only takes a scalar today.
- `src/content/base-programme.js`: six dome steps (`board: true`) and four bridge steps (`when: { stand: [...] }`, `plot: BRIDGE_PLOT` at the
  bridge's frame x, z; `src/fx/base-print.js` learns a frame-anchored plot); `src/content/build-board.js` the prices and effects; the board's
  thumbnails (`src/fx/board-thumbs.js`) get the dome.
- `src/domain/build-programme.js`: `when.stand` → `standing(id)` from the host (the story base's record visible and grown).
- Isao's briefs: `build_dome`, `build_bridge`.
- `?gantry=kidou`, `src/fx/kidou-rig.js`, the guards in the party, the repair and the yard.
- Tests: `test/dome-city.mjs` (the scale, the spacing, the clearance under the deck ≥ MÖRK height + 1 m, the sockets on the ports, the
  placement rule), `test/build-programme.mjs` (`when.stand`), `test/base-programme.mjs` (the ten steps' shape, the board's prices), a node
  test that the KIDOU swap's landmark entry resolves to pinned files.
- Browser: `--dome-look` and `--base-look` green (a skipped sector stands the domes at their new size); a new `--dome-print` step: a grown base
  at stage 1 with `?skip=...` not used: `index.html?sw=0&acceptance=1&cine=0&world=story&grow=1#td`, buy `dome-nw` and `dome-w` through the
  harness's board hooks (read `--board`), assert both print and `bridge-w1` follows, and a still of a dome mid-print; `--base-look` once with
  `&gantry=kidou` for the owner's still.

## 4. Not in this round

The KIDOU driving or printing (section 2.D); the MÖRK printed by the gantry; the crystals in the game (the kit targets three 0.186 and needs the
game's three passed in, ConvexGeometry vendored, and r160 has no dispersion: a lab test first); the SAI-93 in play; any change to the classic
base (`?base=classic`).
