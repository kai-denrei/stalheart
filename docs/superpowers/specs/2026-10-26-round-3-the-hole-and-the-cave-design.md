# ROUND 3 C — the arena's hole is the cave's door, in and out; the flares stick (2026-10-26, branch `round-3-c` from `overnight-2026-10-23` 0df35698)

Owner, 2026-10-26: "4) sector 9, after defeating the boss, the sinkhole DOES NOT CLOSE, it is the very entrance we must use for the Cave mission.
6) the Cave: Flares. I insist that Flares must stick to the surface they have been dropped to, but not float in the air. They are subject to
gravity, but if they hit a wall, they stick to it. Otherwise we cannot identify the long vents. 7) both the entrance to the Cave and when coming
out should read as exactly the same sinkhole where the Boss fight took place."

The cave is vendored: below/ is a copy of the repo kai-denrei/stalheart-cave (below/BELOW.lock.json: commit 6e18948c, 2026-10-18; scripts/import-below.mjs
empties below/ and copies the cave page's files from a local checkout). Cave changes are made in the cave repo, NOT by hand in below/: clone
it if ~/Dev/stalheart-cave is missing (`gh repo clone kai-denrei/stalheart-cave ~/Dev/stalheart-cave`; the gh account is kai-denrei), work on a
branch `flares-and-the-door` there, commit there (same trailer lines, NO push), then run `node scripts/import-below.mjs ~/Dev/stalheart-cave`
(read the script's usage first) in this worktree so below/ and its lock follow; commit the re-import here. `npm run check` validates the lock
and the assets: run it after the import.

## Decisions

1. **The hole never closes (note 4).** src/fx/sector-run.js 435 says THE NEST'S MOUTH STAYS OPEN (the arena's breach is spent, not sealed), but
   src/game-breaches.js opens sinkholes "one at a time (the earlier sealed with the game's rubble)": CHECK whether a later opening (the endless
   waves after doorAt+1, the brood, any breach after SECURE) seals the arena's hole, and whether anything else caps it (rubble, a collapse,
   the cave's return). Rule: the arena's hole (story.arena.cell's breach) is never sealed or capped by any later opening, for the rest of the
   run; a test in test/game-breaches*.mjs or test/sector-run*.mjs (the arena's breach marked `keep`, a second opening leaves it open) and
   `--arena` asserts after SECURE + one more opening (spawn a breach through the harness) that the arena's hole is still open (expose it in
   `state().boss` or the breaches' state).
2. **The door, in (note 7).** The descent's entrance reads as going DOWN the arena's hole: src/fx/descent-host.js holds a look at the arena's
   cell for DESCENT.lookHold; make that look a dive: over the hold, the camera moves from the rim view down the hole's axis to just under the
   lip (the hole's cell centre, 1.5 cells below the surface along -normal), the view narrowing into the dark, then the frame shows (the cave
   page). In the cave repo: the cave's opening (below/src/main.js `start`: where the player appears and what the first seconds show) begins
   with the player under a mouth of sky: a disc of the planet's sky light above the start point (a sky-coloured disc light/sprite at the shaft's
   top, the sinkhole's rim silhouette as a ring of dark rock) and the camera tilting down from it over 2 s to the cave ahead; the player
   stands on rubble the size of the game's sinkhole rubble. Keep it cheap: a sprite disc + a torus of rock, not a modelled shaft.
3. **The door, out (note 7).** When the cave posts its outcome and the frame goes (descent-host `take`), the game's camera rises from under the
   lip to the rim over 2.5 s on the hole's axis (the reverse of 2), the hull waiting at the rim where it was, THEN the ending's sequence
   continues as today. The cave side: its ending (below/src/main.js `end`) with the 'return' action shows the climb out as a 2 s fade to the
   same sky disc overhead before posting. Both directions use the same hole cell and axis; a harness check in `--finale` or the descent's step
   (memory: the cave is an iframe after BOTH WALLS; find the step that runs the descent) asserts the camera's pose at the hand-over is
   within 2 cells of the hole's centre and looking along -normal, and on return within 2 cells of the rim.
4. **The flares stick (note 6).** below/src/flares.js (33 lines) with below/src/world.js: a dropped flare falls under gravity (9.8 m/s2 in the
   cave's metres, a terminal speed), tests the cave's surfaces each step (world.js: find its collision/height/SDF query the player already uses;
   if the player uses a capsule vs. mesh test, reuse it with a 0.15 m radius), and on contact STOPS and sticks: position frozen at the contact
   point pushed 5 cm along the surface normal, the normal stored, the flare's light oriented from the surface; a wall hit sticks to the wall
   (no sliding down), a floor hit lies on the floor; a flare that hits nothing within 30 m keeps falling until it does. The light radius and
   life unchanged. A node test in the cave repo if it has tests (check its package.json), else a small deterministic test added there:
   a flare dropped above a floor stops on it; one thrown at a wall sticks at the wall's point; none floats.

## Out
The cave's gameplay otherwise, the ending's content, the finale's skip (another branch does it).
## Order
1 -> 4 (cave repo) -> 2 -> 3 -> the re-import, `npm run check` -> records (deban entry, STATE paragraph; the cave repo's own commit referenced).
