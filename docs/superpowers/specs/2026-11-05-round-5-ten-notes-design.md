# ROUND 5 — the owner's ten notes on 00163b90 (2026-11-05, four streams from `overnight-2026-10-23` at the commit that adds this file)

Owner, 2026-11-05, pasted verbatim after the white-amethyst fix (`1)` "purple amethyst fixed" is the one note that asks nothing: entry
`2026-11-05-the-amethyst-reads-white-after-the-first-gunship-seat-one-writer-of-the-membranes-heat`). The operator was not present for the
design pass: the decisions below are the agent's reading of each note, written down so the owner can overturn any one with one line. Six
read-only scouts mapped the code first; their findings are folded into each note as "what is there now". Where a note names a feel, the first
version takes a measured step and records what it measured, before and after.

The round runs as round 4 did (`docs/superpowers/specs/2026-11-02-round-4-fifteen-notes-design.md`): worktree branches off the integration
branch, one browser at a time (`node ~/scripts/stalheart-browser-lock.mjs acquire|release|status <name>`), a port each (18181 / 18182 / 18183 /
18184), each agent its own scratch subfolder, one commit per note (or per coherent pair), a decision entry per stream, a STATE paragraph per
stream under `## What landed on 2026-11-05 (round 5, stream X)`, nothing pushed by a stream. `~/Dev/stalheart` serves :8155 live: never edit it.

## Stream A — the ground and the bodies (branch `round-5-ground`, port 18181): notes 6, 8

**6) Waves emerging from sinkholes: an overhaul.** What is there now (`src/fx/enemy-step.js:245-259, 331-335, 440-475`;
`src/content/story-defaults.js:132` EMERGENCE `{ rim .95, scatter .5, settle 8, facing π/2, out 1.35, climb 1.1, pop .3 }`;
`src/fx/emerge-blob.js`, `src/domain/emerge-climb.js`): a released record is placed outside the lip (out 1.35 x the crater radius, on the
half-plane facing its exit) and waits hidden under the ground for `delay + 1.1 s` while a dark unit sphere in its type's tint (the "simplified
shape", darkened to 55 %) climbs out of the throat over 1.1 s, crests at ~0.55 s and fades from 0.72 s; then the record pops in 0.3 s from the
throat's depth (-0.55 x the crater radius). After the pop it glides onto its path over `settle` 8 s. A body over an open hole floats: its lift is
`size x 0.85 + sinkholeGroundHeight`, which never reaches the bowl's floor, so it hovers over the dark part. The owner's three guidelines, in order:
- (a) *the sinkhole is a hole; nothing hovers over it.* Measure first: over one sector-4 wave (the flow shape) count per frame the bodies whose
  drawn point lies inside an open hole's rim and their height over the bowl at that point (a probe like round 4's crater-dodge count, 25 samples).
  Then: a body whose drawn point is inside a rim takes the bowl's depth at that point (`bowlHeight`, `src/core/sinkhole-shape.js`), so a body that
  is over the hole is IN it, sinking as it crosses, never floating; and `CRATER_DODGE` (`zone 2.5, pad .25, ease .6`) widens its zone for the hole
  a wave is emerging from so the released crowd walks round its own hole, not back across it. The blobs crest over the lip by design (`climbPose`
  h = -0.5(1-t) + 0.45 sin πt): see (c).
- (b) *emerge faster, never in the dark part for long.* The record's hidden wait `delay + 1.1 s` becomes `delay + climb`; `climb` 1.1 -> 0.5;
  `pop` .3 -> .25; the rise starts at the bowl's wall under the lip (the height of `bowlHeight` at `rim` .95), not at the throat's -0.55: a body is
  seen rising out of the lit wall of the bowl, not out of the black throat. Measure: the time from a release to a visible body at the lip, before
  (~1.4 s + delay) and after (~0.75 s + delay); the first-contact time of sector 1 (`--pacing`: first contact 15.5 s, longest gap 16 s) must not
  move by more than a second (the delays are the queue's, not the emergence's).
- (c) *the simplified shapes read odd at close range.* The blob was the announce when a record waited 1.4 s under the ground; with (b) the body
  itself is the announce (it is drawn in its own tier colour as it rises). Decision: the Pearl bodies emerge without the blob (the blob pool stays
  for `?creatures=dots`, whose dot cloud has no body to rise); the boss's rubble (`BOSS_RUBBLE`) is untouched. If the first measurement shows the
  rise alone reads as a body appearing from nowhere at the tank's distance (~22 m), the fallback is the blob kept beyond 40 m from the camera only.
  Screenshots before/after at 6 m, 22 m and 60 m from a hole mid-wave (the probe camera hook of round 4's `probe-r4a.mjs`, in the stream's scratch).
  Tests: EMERGENCE's numbers and the rise start asserted (test/breach-surface.mjs or a new test/emergence.mjs), the blob not spawned for a Pearl body
  (test/enemy-step.mjs's harness), the in-hole depth rule pure (test/crater-dodge.mjs or sinkhole-shape). Browser: `--pearl-story`, `--pacing`,
  `--sinkhole`, `--rim-holes`.

**8) Enemy differential speeds back: the white fastest, the yellow second; masses sort themselves by speed and behaviour.** What is there now
(`src/domain/pearl-bodies.js:47` `pearlSpeed = min(speed x 1.08 x 15, radii x r0)` m/s; `PEARL_PACE` radii 1 for white/yellow/blue, 0.9 for the
cored; `PEARL_BODY.scale` 0.65 / 0.7 / 0.75 / 0.8 / 0.9 / 1.0 / 1.1 / 1.2): the cap binds for every tier, so metres a second follow body size and
the small ivory WALKS slower (amoeba 1.82 m/s, phage 1.46) than the blue gslime (2.24) and every cored tier (2.0 to 3.3); only the soft hunt
(`SOFT_HUNT.pace` white 1.6, yellow 1.25) makes the ivory the fastest HUNTER. THE SKY MODEL (2026-10-30, ed18be84) is where the differential went:
before it the ivory and lemon glided at x1.3 / x1.2. Decision: the ladder by tier, in metres, white > yellow > blue > orange > green > purple > brown
> black, through two knobs the audit allows: (i) `PEARL_PACE[tier].radii` descending with size (white up to the audit's ceiling, ~1.2, yellow 1.1,
blue 1.0, orange 0.9, green 0.8, purple 0.7, brown 0.65, black 0.6; the audit's pop rule is 0.25 radii a frame so a small body's cap in radii can
sit higher) and (ii) if (i) does not order the metres (white 1.82 x 1.2 = 2.2 m/s against blue's 2.24), the hop cycle per tier (`cycleDuration`,
Sky's 4.5 for all: the set's own rows ran 6 / 5.5 / 5 / 4.5 / 4 / 5 / 4.5 / 4): shorter for the soft small tiers (white 3.4, yellow 3.9, blue 4.5)
and longer for the cored (5 to 6), keeping the Sky look (two stalks, the gait). Run `test/pearl-motion.mjs` after every step and stop at the last
green value; record the m/s table before/after in the entry. Then the sorting: a probe that releases a mixed column (40 white, 20 yellow, 10 blue,
6 purple) from one hole toward the hull and reads, at 20 s and 40 s, the mean distance covered per tier: the owner's "masses sort themselves" is
true when the tiers' means are in ladder order with gaps over a body radius. `ENEMY_SPEC.speed` for the dot path (`?creatures=dots`): amoeba and
phage over ghost and scoutufo, in the same order, so the A/B agrees. Fix the two stale comments the scout found (test/pearl-motion.mjs:90 "1.35",
pearl-enemies.js:186 "0.4 / 0.6"). Browser: `--pearl-story`, `--pacing` (the ideal defender must still hold sector 1; if the faster ivory breaks it,
the first three sectors' counts give a little, not the speed), `--story-world`.

## Stream B — the base and the prints (branch `round-5-base`, port 18182): notes 2, 4, 5, 9

**2) The Stalheart's base is not under it; half the rails are off.** What is there now (`src/content/base-layout.js:24` island `stalheart`
`{ w 48, d 56, x 0, z 0 }`; `:55` the structure's `offset: [14.5, 0, 0]`, a deliberate shift of 2026-09-11 that centres the gantry on the plot;
the GLB's rails are static children of ROOT spanning x ±16.4 and z ±25 round the model's origin): in the pad's frame the rails run from -1.9 to
+30.9 m while the slab spans ±24, so ~7 m of the rails' +X end, sleepers and all, hang off the slab; z (±25 against ±28) is inside. Measure first:
a story-lab frame from the +X side (`labs.html?acceptance=1&stage=6#story`, `__stalheartStoryTest.frame({ pos: [60, 40, 60], look: [14.5, 0, 0],
fov: 40 }, { x: 0, z: 0 })`) and the same from -X, screenshots kept; confirm the overhang and read the model's -X extent (the gantry) off the frame.
Decision: the pad under the whole model. Preferred: the island grows toward +X without moving the model or its -X edge: `x: 4, w: 56` (the slab
then spans -24..+32) with the structure's `offset` 14.5 -> 10.5 so the model's world position is unchanged (island x + offset = 14.5 as before);
the board (x -38, w 12: -44..-32) and the assembly (x 56, w 20: 46..66) stay clear. If the -X frame shows the gantry past -24, widen there too.
Check what reads the island's rectangle: `parkHull('stalheart')`, the plots (`base-print.js plotOf`), the foundry's `over` bed, the bays' doors,
the footprints (test/body-footprint.mjs), the walls' ring; `test/base-plan.mjs`, `test/story-bays.mjs`, `test/build-programme.mjs`. Browser:
the story lab's stage-6 step (`browser-test.mjs:188`), `--story-world`, `--grow` (red on the base at the assembly print timeout: baseline it).

**4) + 5) The radar prints as a wireframe first, the texture after; anything printed does.** What is there now: sentries already do it
(`src/fx/tower-print.js` `printGhost` a clipped, depth-off wire of the sentry at the print colour, `skinIn` the solid's materials clipped by a plane
rising over 0.8 s while the ghost fades; `src/fx/isao-worker.js:336-351, 205`); companions do it (`src/fx/pet-print.js`); base structures do NOT:
every programme step (the radar `base-programme.js:33`, KO-TECH, the garage, the armory, the farm, the chips, the launcher, the Stalheart itself,
the foundry, the bays, HUGIN) goes through `base-print.js progress()` -> `story-base.js grow(id, k)`, a Y-scale rise of the solid holder from
0.02 to 1 (`rise(k)`, `lift`), no ghost, no skin. Decision: generalise the sentry's look to the structures. In `story-base.js grow` (or a small
`src/fx/structure-print.js` it calls, per the add-module skill): on the first k > 0 for a structure, make its wire ghost (the holder's meshes
cloned as `printGhost` does, the print's colour, clipped by the same rising plane the ghost's `cut` uses, so the wireframe is drawn up from the
plot as the beam rasters) and hide the solid; the Y-scale rise is replaced by the clip (a structure is printed layer by layer, not inflated); at
k = 1 (`finish` / the step's last tick) `skinIn` the solid over 0.8 s and drop the ghost. The far tier (`far:` GLBs) and LOD swaps keep working
(the ghost is a child of the holder; the solid's tiers are hidden together). Islands, walls and the gate are instanced meshes shared by every
island: they keep their grow this round (say so in the entry; the owner's "anything printed" is read as the structures). The radar's close-up
(`ANTENNA_CLOSEUP`, 12 s step): the camera must see the wire rising and the skin coming in before it cuts away; hold the close-up through the
skin's 0.8 s if its end falls before (`antenna-print.js` end rule). Tests: test/build-programme.mjs or a new test/structure-print.mjs (a ghost on the
first tick, the solid hidden, the plane at k, the skin at 1, the ghost gone after; the far tier's visibility untouched), test/antenna-print.mjs for
the hold. Browser: `--antenna-print` (screenshots mid-print and at the skin), `--grow`, `--story-world`.

**9) DAY 42: driving the tank must not skip the party; only Esc skips.** What is there now (`src/fx/disco-party.js:209` `startShot({ id:
'discoReveal', dur, skippable: true })`; `src/fx/camera-shot.js:25` `skipsShot`: a shot with `skipKey` is skipped by that key alone, after
`lockFor` seconds; the print close-ups use it): any key or tap ends the reveal, WASD and the throttle included, so a player who keeps driving skips
the party without meaning to. Decision: `discoReveal` takes `skipKey: 'Escape'`, `lockFor: 0`; the tank's keys reach the tank as usual during the
reveal (the shot's capture handler only eats the skip key: check `camera-shot.js:31-46` consumes nothing else once `skipsShot` is false) and the
party's clock runs on (`disco-party.js` is clock-driven). Escape must not also pause the game (`tank-input.js:71`): the shot's handler takes it
first; assert it. The reveal's card (if any) names `ESC · SKIP`. Tests: test/camera-shot.mjs or the party's test (a 'w' keydown during the reveal
leaves it running; Escape ends it; the tank got the 'w'). Browser: `--day-42`.

## Stream C — the boss and BELOW (branch `round-5-below`, port 18183; the cave repo `~/Dev/stalheart-cave`, branch `round-5-below` off its
`round-4-below`, then `node scripts/import-below.mjs`): notes 7, 10

**7) When we kill Nih-Dairia, leave its corpse for longer: intact, with only one leg cut.** What is there now: the story arena's boss
(`src/fx/creature-reed.js`, knobs from `src/content/boss-fight.js` through `creature-enemies.js:80`) collapses for 2 s, then sinks and fades over
3 s and is disposed: "No carcasses in the game for now" (its header). The lab (bait mode, `src/labs/boss/remains.js`, `src/domain/boss-carcass.js`,
`src/labs/boss/carcass.js`) lays a carcass from the collapsed live nodes 1.5 s after the kill, cross-fades the skin out over 0.8 s, cools over
120 s, and lies until reset; fire severs limbs segment by segment (INTACT, then LIMBS SEVERED n/6, the piece hops off: distance 8, up 3, 1.1 s,
and crumbles over 90 s). Decision: the game lays the lab's carcass. After the collapse the arena boss does not sink or fade: `layRemains` from its
collapsed nodes where it died, then ONE leg severed at the lay (the domain's severance at the limb's root segment, the piece's hop as the lab's;
the piece does not crumble: the owner wants the body intact but for the one cut, so `crumble` is off for this piece, or its span is longer than the
chapter), the body matte grey as the lab's dead grey, cooling as the lab's. It stays through BOTH WALLS, the descent and the ending (no timer; the
finale's diorama is a separate scene). The layering: `remains.js` and `carcass.js` are lab modules; the game may not import a lab controller
(`npm run architecture`): move what the game needs into `src/fx/boss-carcass/` (the lab imports it from there; the add-module skill) and keep the
domain pure. Check the carcass against the hull's road and the hole's door (the hull must not be stopped by a corpse across the arena's road:
no collider, or a clear lane), and the frame cost (one mesh). The brood's bodies keep their deaths. Tests: test/boss-carcass*.mjs extended (laid
with one limb severed, no crumble, no fade), test/creature-reed or boss-run for the no-sink. Browser: `--boss-sector`/`--arena` to the kill, a frame
10 s and 60 s after it (the carcass in both), `--boss-carcass`.

**10) THE DESCENT: entering and leaving feel like loading a different game; it should feel like exactly the entrance where the boss fight was;
the cave's carcass is a Reed, it should be the Nih-Dairia from the chapter before.** What is there now (`src/fx/descent-host.js`,
`src/content/descent.js`; the cave `below/src/main.js:240`, `world.js:110`, `door.js:22-25, 82-84`): the game looks at the hole 2.5 s, freezes,
loads the iframe hidden (`below/index.html?stalheart=1`), waits for `belowReady`, dives the camera down the hole over `door.settle` 0.5 s and
shows the frame with no fade; the cave then plays ITS OWN dive from a sky mouth down the throat (its door), under its own sky and rim tones (round
4's note 13 gave `?stalheart=1` the game's night sky, the planet's rock tone and a carcass over the lip, built from the cave's Reed rest pose,
`reed.json`, named `nih-dairia-carcass`). Leaving: the frame is removed, the game resumes with the camera rising up the hole over 2.5 s, no fade.
Decision, two halves. (a) ONE PLACE: the game's dive is the only dive. The host posts the cave, before `belowReady` is awaited, the pose its dive
ends on in hole units (depth into the throat as a fraction of the hole's radius, the bearing the camera faces, the hole's radius in metres, the
daylight/night state) and the cave starts its camera THERE, its own sky-to-throat dive dropped in `?stalheart=1` (kept standalone); the cave's
rim torus, sky disc and ground tone take the handoff's values (night or day as the game shows it at that moment: the game's `daylight` state, not
always night). A cross-fade covers the renderer change: the host draws the game's last frame (`renderer.domElement.toDataURL`, one call) into an
`<img>` over the frame and fades it over 0.6 s once the cave has drawn its first frame; on the way out the cave's climb ends looking up the throat
at the sky disc, the host starts the game's rise from the matching depth (the cave posts its final pose with the outcome) and fades from a capture
of the cave's canvas (or from black if cross-origin capture fails: same origin here) over 0.6 s. Measure: the camera positions at the handoff in
both directions (log them), two frames either side of each cut kept as screenshots. (b) CONTINUITY: the carcass the cave shows over the lip is THE
body from note 7: the host serialises the laid carcass (its node positions and the segment list relative to the hole's centre and radius, the
severed leg's piece included) into the handoff message, and the cave builds its carcass mesh from those nodes (vendor the carcass geometry builder
the game uses, `remains.js:48-57`'s successor in `src/fx/boss-carcass/`, into `below/src/`; the Reed rest pose is the fallback when the message
has no body: standalone play). Placed at the same bearing and distance from the hole in hole units, scaled by the cave's hole (HOLE_SCALE 24), the
same grey. Tests: the cave's door.test.mjs (a carcass from a node list, the fallback), a host test for the message's shape (test/descent-host or
test/descent.mjs), the pose round-trip pure (domain). Browser: `--descent` (extend: the handoff message seen by the frame, the fade elements present
and gone, the rise from the posted depth), the cave's own suite on its port (stale steps: the round-4 entry names nursery.tentacles 64 vs 60; do not
chase them). The cave's repo gets its own commits on `round-5-below`; `import-below.mjs` refuses a dirty cave tree: commit there first.

## Stream D — the director board (branch `round-5-director`, port 18184): note 3

**3) A visual timeline of all the sectors and triggers: when KO-TECH prints, when the cutscenes play, a full director board.** What is there
now: the schedule is mostly data (`src/content/sectors.js` SECTORS and the door's `earliest 7 / latest 8`; `base-programme.js` steps with `when`
`{ sector, idle, phase, perk, days }`; `companions.js`; `reinforcements.js` (8 days after the uplink); `day-42.js` (day 42, at a lull);
`story-defaults.js` STORY_BEATS / STORY_CHAPTERS; `nav.js` STORY_JUMPS; `isaobriefs.js` BRIEFS; `isao-voice.js` ISAO_TRIGGERS, `voice-hooks.js`) and
three things are code: the door's sector (7 or 8 at runtime, `src/domain/sectors.js:52`), the beats' state machine (`src/domain/story-beats.js`),
and the shots' starts (ids: arrival, arrivalTalk, rollout, isaoTalk, takeControl, sitesTour, sol88Launch, antennaPrint, petPrint, feidsDrop, mechLook,
descentLook, boss, discoReveal, diorama, breach, canyon, cargoView, backview). The voice lab (`src/labs/voice-tab.js`, `voiceCoverage()`) is the
nearest existing pattern: a page that reads the content tables and reports. Decision: a new lab tab `labs.html#director` (`src/labs/director-tab.js`
+ a pure `src/domain/director-board.js` that turns the tables into rows; no td-tab change; the data stays where it is and the board imports it).
The board: a horizontal axis of the story's time, left to right: the prologue's phases (landed .. expedition, as the chapters `?skip=<id>` cover
them), then sector 1, 2, 3 THE CANYON, 4 THE PRESS, 5 THE SIDE WALL, 6, [7 | 8 the door: drawn as a shaded range with "7 if every site is delivered
and nothing owed, else 8"], doorAt-1 CANYON AGAIN, doorAt THE BACK DOOR, doorAt+1 THE ARENA, doorAt+2 BOTH WALLS, then the descent and the ending,
then "endless". Lanes under it: SECTORS (the row's name, its shape, its `new` unlock, its brief id), PRINTS (each programme step at its `when`,
`idle` drawn as "at the lull", passable steps marked, perks named: KO-TECH, the radar, the garage...), DROPS & COMPANIONS (the FEIDS-26 drop at "radar
uplink + 8 days", C-07 at expedition + 20 s quiet, RECKON K9 at uplink + 3 days, DAY 42 at "day 42, first lull": the day-gated items in a lane of
their own with the day rule written on them, since days do not map to sectors), CUTSCENES (each shot id at its trigger, with its source file), ISAO
(the briefs by the trigger that fires them where the hook table names it; a count with an expandable list, not 113 rows), JUMPS (STORY_JUMPS'
landmarks as links that open the game there: the director's "go to" buttons). Hover shows the source (`file:line`) and the raw `when`; a toggle
draws doorAt as 7 or 8 (the sectors past the door shift). Plain DOM + CSS in the labs' style (no new dependency), the lab's own lil-gui not needed.
Tests: test/director-board.mjs (the rows from the real tables: 16 programme steps placed, the door range, every shot id present, the two doorAt
renderings consistent with `sectorDef`). Browser: a `--director` step (the tab opens, the lanes and the row counts, a screenshot kept). Record in the
entry what the board could not place from data (a trigger that lives only in code), as the list for the owner.

## Shared rules for the four agents

- Branch from `overnight-2026-10-23` at the commit that adds this file, in your own worktree (`~/Dev/stalheart-r5-<stream>`); never edit
  `~/Dev/stalheart` (it is served live on :8155) and never run a browser suite against it.
- Measure before you change (the note's "what is there now" is from reading; confirm it on screen or in a probe first), and keep the before/after
  numbers and frames in your scratch folder, summarised in the entry.
- `node --check` every edited file; `npm test`, `npm run check`, `npm run architecture` before every commit; the browser steps named above on
  your own port under the browser lock (`node ~/scripts/stalheart-browser-lock.mjs acquire <name>` .. `release <name>`; wait if held). Baseline a
  red browser step on the unfixed tree (stash, or the base commit in a second worktree) before blaming your change: `--gunship`, `--grow` and
  `--story` are known reds on the base. Empty suite output is a failure. Never `pkill` by pattern.
- td-tab: at most +25 lines net per stream (5,356 under 5,450 now); bytes and long lines ratchet down only; pay additions by extraction in the same
  commit; hosts in programme-host / expedition-glue / showcase-hooks are free. Host literals: write the module's reads first (test/host-contracts).
- Domain modules import core/domain only (the tunables come in as parameters); content may not import domain or fx; no bare `window`/`document`
  words in domain/content comments. New files go where `.claude/skills/add-module` says.
- One decision entry per stream (`npm run log -- add FILE`, written outside docs/log/entries, then `npm run log -- render`, `npm run log:check`),
  one STATE paragraph under `## What landed on 2026-11-05 (round 5, stream X)` at the top of the "What landed" sections; keep STATE short.
- Commits carry `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; nothing pushed; no `git add -A` at the root. Report at the end: the
  commits, what each note measured before and after, what you left open and why, and which browser steps were red on the base.
- Memory: this is a 16 GB machine with three other streams running. One Chrome at a time (the lock), close it between steps, no headed runs.
