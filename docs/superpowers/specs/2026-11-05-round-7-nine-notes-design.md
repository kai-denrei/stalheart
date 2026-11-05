# ROUND 7 — the owner's nine notes on b14ed61f (2026-11-05, four streams from `overnight-2026-10-23` at the commit that adds this file)

Owner, 2026-11-05, after round 6 shipped (`docs/superpowers/specs/2026-11-05-round-6-five-notes-design.md`), nine notes on b14ed61f:
1) a lag between clearing a nest and the cargo being available; 2) fade every HUD element except the radar to 80 % transparency, unless the mouse
hovers on the area, which brings it to 20 % transparency for a few seconds ("a more immersive experience"); 3) remove the "note" icon for turning
the sound off ("the user can do that in their system"); 4) the build board gets small wireframe thumbnails like the glossary's; 5) the second
commandeering of SOL: the command should be almost immediate once announced, Isao's later comms about it happen while we control the satellite;
6) the satellite launch from the base: "I insist" the lights on the side of the catapult launcher are NOT on at the beginning, they light up with
the payload moving, "giving the impression that it is a magnetically powered launch"; 7) the mechs at THE MOTHER's site should be more aggressive
and shoot more often; 8) before BELOW, Isao prints something but we have no time to see it; 9) BELOW's controls are still wrong: moving the mouse
or A or D makes the cave flip around, none of that should happen; ISAO is a quadcopter inside a cave: W tilts forward, S backward, A and D rotate
for the next W and S, Space and Shift for up and down.

The operator was not present for the design pass: the decisions below are the agent's reading of the code, each written down so the owner can
overturn it with one line. "What is there now" is from reading the files named; no scout ran. Where a note names a lag or a flip the agent could
not reproduce by reading, the stream MEASURES FIRST and the fix follows the measurement, not this document's guess.

The round runs as rounds 4 to 6 did: worktree branches off the integration branch, one browser at a time under the lock
(`node ~/scripts/stalheart-browser-lock.mjs acquire|release|status <name>`, HELD ONLY ACROSS ONE SUITE RUN, one waiter per stream, chain the
run with `&&` so a failed acquire never runs unlocked), a port each (18181 / 18182 / 18183 / 18184), a scratch subfolder each, one commit per note
(or coherent half), a decision entry per stream, a STATE paragraph per stream under `## What landed on 2026-11-05 (round 7, stream X)`, nothing
pushed by a stream. `~/Dev/stalheart` serves :8155 live: never edit it.

## Stream A — the HUD (branch `round-7-hud`, port 18181): notes 2, 3, 4

### Note 2, the HUD fades unless hovered

What is there now: the game tab's HUD is a set of absolutely placed elements under `#tab-td` (index.html lines 40-128 and a few made in JS):
`#td-stats`, `#td-wave`, `#td-tower`, `#td-next`, `#td-launch` (the caution frame: safety, readout, launch button), `#story-views` (the views strip,
src/fx/story-views.js), `.tc-util` (CTR / MAP / AUTO / TANK / ORBIT buttons), `#td-throttle`, `.tzone` pads, `.tfire` buttons, `#td-hint`,
`#td-combo`, `#td-sitrep`, `#td-order` (src/fx/order-callout.js), `#td-shop`, the hull console over the radar (src/fx/hull-console.js), and the
radar itself, a `<canvas class="minimap">` made in src/td-tab.js (~line 520). Styles live in styles.css and app.css (both carry the HUD rules;
app.css is the later layer). Nothing dims today.

Decision: a `hud-dim` module, desktop only.
- `src/domain/hud-dim.js` (pure): `hudOpacity({ hovered, since, now, hold, rest, lit })` -> opacity: `lit` (0.8) while the pointer is over an
  element or within `hold` seconds (3) of leaving it, else `rest` (0.2); `hudDimTargets` the list of selectors the rule applies to (one place).
  Tests in `test/hud-dim.mjs`: rest, lit on hover, lit held `hold` s after leaving, back to rest; the exclusion list never contains the radar,
  the hull console, Isao's panel, the callouts, the danger sign, the modals, the cards or the strikecam.
- `src/fx/hud-dim.js`: `createHudDim(root, { mobile })` puts `hud-dim` on `#tab-td` when not mobile and tags each target element with
  `data-hud`; pointerenter / pointerleave on the targets (one delegated listener each) set `hud-lit` on the element for `hold` s (a timer per
  element, reset on re-entry). Nothing changes pointer events or layout: opacity only, `transition: opacity .35s`.
- CSS in app.css (the later layer): `#tab-td.hud-dim [data-hud] { opacity: .2; transition: opacity .35s }` and `#tab-td.hud-dim [data-hud].hud-lit { opacity: .8 }`.
  A hidden element stays hidden (`.hidden` wins). The mobile shell keeps full opacity (its pads are the controls).
- What stays at full: the radar canvas and the hull console over it (the owner's "except the radar"), `#td-brief` (Isao speaking), `#td-callouts`,
  `#td-danger`, `#td-msg` / `#td-toast` / `#td-sitrep` modals and status, the build board, the debrief, the strikecam, the mother's card, the
  pet-skip hint, `#td-lap`. `#td-sitrep` is read as a status, not a control: full. `#td-launch` (the launch console) dims: it is a control.
- Wire-up: td-tab calls `createHudDim(container, { mobile: mobileShell })` once after the HUD is built (one line; a host literal is not needed).
  The dev panel (src/platform/dev-panel.js) gets a `hud dim` toggle only if it costs nothing; a URL knob `?huddim=0` turns it off for the harness
  screenshots that read HUD text (check `scripts/browser-test.mjs` steps that read `#td-stats`/`#td-wave` text: opacity does not change
  textContent, so most need nothing).
- Browser step `--hud-dim`: on the SKIP TUTORIAL route, after the first frame, `#td-stats` computed opacity is 0.2; dispatch pointerenter on it
  -> 0.8 within 0.5 s; pointerleave, after 3.5 s -> 0.2; the radar canvas's opacity is 1 throughout; on `?phone=1` nothing is dimmed.

### Note 3, the sound button goes

What is there now: `<button id="td-pad-sound" title="mute / unmute sound">&#9834;</button>` in index.html line 126, wired in
src/platform/dev-panel.js line 146 (`soundBtn`), styled with the `.tc-util` buttons.

Decision: remove the button from index.html, its wiring in dev-panel.js and any CSS rule naming it; `grep -rn "pad-sound"` must come back empty
across src, scripts, test and the css. The mute itself (src/audio.js `muted`, the M key if there is one, the dev panel's own control) stays:
only the HUD button goes. Tests that clicked it (grep first) move to the dev panel's control or go.

### Note 4, wireframe thumbnails on the board's cards

What is there now: src/fx/build-board.js renders six `.bb-tile` buttons (key, name, price, effect; lines ~100-112). The glossary's cards
(src/fx/glossary-modals.js, src/fx/briefing-cards.js `glossCard`) carry an image from td-tab's `spriteShot(key, build)` (td-tab ~line 2041): a
synchronous render of a built THREE object through `waveSpriteRenderer` to a data URL, cached by key. The bestiary draws every colony unit as a
tinted wireframe (src/fx/unit-bench.js, `setWireframe(unit, true, { tint: true })` from src/fx/model-fixture.js) from `UNIT_ENTRIES` in
src/content/bestiary.js, whose base entries name the structures' models (`built('armory', 'armory')`, the scoreboard's GLB, the launcher).

Decision: every tile gets a `.bb-thumb` image, wireframe, in the glossary's style.
- A `thumb(offer)` builder in a new `src/fx/board-thumbs.js`: for a `structure` offer the bestiary entry's model through `loadModelFixture` +
  `cloneFixture` + `setWireframe(obj, true, { tint: true })`, fitted to the sprite frame (the glossary's objects are ~1 unit tall: scale by the
  box); for a sentry (`tower`) `buildTowerLook(params.towerLook, def)` set to wireframe; for an `upgrade` the same look at the next tier; for a pet
  the unit's model wireframe; for `hull` the DEFAULT_TANK's `unitIcon`; for `shield` the shield's own look or a drawn ring if none exists. GLB loads
  are async: the tile shows an empty frame and the `<img>` gets its src when the model lands (the token pattern of unit-bench: a load landing
  after the board closed is dropped). Sprite keys `bb-<kind>-<id>` go through the same `spriteShot` cache so a thumbnail renders once per session.
- The board's host (td-tab's `api.interlude` wiring) passes `spriteShot` and the look builders; keep the td-tab delta to the host literal.
- CSS: `.bb-thumb` 56x56 at the tile's top, the glossary's dark frame; the tile grows no wider than it is.
- `--board` gains an assertion: six `.bb-tile img.bb-thumb` with a non-empty `src` within 5 s on the sector-1 board; the state() reports
  `thumbs: n`. Unit test for the fit rule (`test/board-thumbs.mjs`: the box-fit scale for three box sizes).

## Stream B — the base (branch `round-7-base`, port 18182): notes 1, 6

### Note 1, the lag from a cleared nest to the cargo

What is there now (src/fx/expedition-glue.js `step()`, every frame while `automated()`): a site goes `guarded -> cleared` when
`h.guardsLeft(id)` is false; `guardsLeft` (the glue's own hook, src/fx/expedition-glue.js line 259) counts enemies `alive` with `guard.site === id` plus queued
spawns for the site, cleared below `STORY_EXPEDITIONS.clearBelow` (3: the owner's 2026-10-07 note, "the first nest cleared took 20 s+ as if an
invisible enemy remained"). The next step raises the flag (`raiseFlag`, the crate beside it) and the pickup (`pickUp`) needs the hull within
`max(cellSide * (clear/10 + 1.3), standReach)` of the spot and the site `cleared`. Guards are 2-4 barbed, 40-80 amoebas, 12-20 phages and one small
Reed (src/content/story-defaults.js lines 294-300). `e.alive` is cleared in src/fx/enemy-step.js line 573 (`host.creatures?.()?.kill(e, fx)`: a
creature's body deflates after). Nothing in the glue waits on time, so the lag is in who still counts as alive or queued, or in `automated()`.

Decision: measure, then fix the biggest gap; no knob is touched before the measurement.
- A probe (scratch, then a harness step `--nest-lag`): on the STUDY / expedition route (`?skip=expedition`, or SKIP TUTORIAL with the hull
  driven to rocket-a by the harness's hands), record per frame for the first site: alive guards, queued guards, the state, hasFlag, the hull's
  distance to the spot, `automated()`. Report `tLastKill` (the frame the live guard count first drops below `clearBelow`), `tCleared`, `tFlag`,
  `tPickup` (the hull parked in reach before the kill). The gap the owner feels is `tPickup - tLastKill`; also report the count of guards that are
  `alive` but dead-looking (deflating bodies: `creatures().kill` called, `alive` still true) and guards that wandered beyond the site's radius.
- Hypotheses, in order: (a) dying bodies keep `alive` until their deflate ends and count as guards; (b) strays: guards off chasing the hull far from
  the site still count, so the nest never drops below 3 until they are killed elsewhere; (c) the `spawnQueue` share: queued guards for a site whose
  spawn is held by the crowd gate (src/fx/crowd-gate.js) count for seconds; (d) `automated()` false while the player drives by hand in a phase
  before `settled` (src/domain/automation.js), so the step never runs until the hand-over.
- The fix per finding: (a) count a guard as left when its death is booked, not when its body is gone (a `dying` flag, or `alive` false at the kill
  and the deflate on the fx record); (b) a guard beyond `guard.r * 2` of its site no longer holds the cargo (the domain rule `guardsHolding(...)`
  in src/domain/expeditions.js, tested); (c) queued guards count only while their site's spawn is live; (d) the expedition step runs whenever the
  story's expeditions exist, the pickup itself never needing `automated()`. Target: `tPickup - tLastKill` under 1.5 s with the hull in reach,
  measured headless and written in the entry. The flag's hoist (2 s clip) is cosmetic and never gates the pickup (it does not today: keep it so).
- The step asserts the gap; the entry carries before/after numbers.

### Note 6, the launcher's magnets light with the payload

What is there now (src/fx/arc-launch.js `apply`, src/domain/light-sequence.js, src/content/orbital-works.js `LAUNCHER_LIGHTS`): the ARC-01's
sixteen passage gates and status lights (`PASSAGE_GATES`, `ACCELERATOR_LIGHTS`, one mesh each, split per magnet for the launch) carry
`emissive 0x00eaff` at `emissiveIntensity = 0.25 + 2 * level`: a floor of 0.25 keeps every magnet lit cyan from the first frame, at idle, and
through the loading phase; the round-3 "one by one" sequence (owner, 2026-10-19) lights them from the breech up over the 4 s charge BEFORE the
sled moves (`lightLevels(t - chargeAt, ...)`), then all fall together after the release. The standing launcher between launches wears the GLB's
own emissive on those meshes (src/fx/story-base.js places it; nothing dims them).

Decision: dark until the sled moves; each magnet lights as the sled reaches it.
- Idle and loading: `emissiveIntensity 0` on both meshes (the floor goes; the standing structure's two meshes are set dark when the launcher is
  placed, in story-base or at `createArcLaunch` construction, whichever runs first on both the printed and the pre-built base: check
  `?skip=defence` where the launcher stands from the first frame).
- Charging (chargeAt..start): still dark; a faint breech glow is allowed (the first magnet at 0.15) so the charge is not invisible: the owner's
  words are "light up with the payload moving", so nothing beyond the breech before motion.
- Accelerating (start..RELEASE): the sled's own arc index (`arcIndex(sled.y, sled.z, RAIL_CENTRE, LAUNCH.sweep, 16)`, the same rule that splits the
  mesh) is the head of the wave: a new pure rule `lightsBySled(index, count, { ahead, trail })` in light-sequence.js gives the magnet at the sled
  and `ahead` (2) magnets past it full, the magnets behind it fading over `trail` (3) magnets, the rest dark. Tests: the wave at the breech, mid
  rail, at the exit; nothing lit before the sled moves.
- After the release: every magnet fades to dark together over 2 s (the charge's fall, as now), then `merge()` and the merged mesh stays at 0.
- `LAUNCHER_LIGHTS` gains `ahead`, `trail`, `breech` (0.15) and `idle: 0`; the round-3 `step`/`ramp` sequence goes (its test moves to the new rule).
  The owner asked for both "one by one" (round 3) and "with the payload moving" (now): the wave is one by one, so both hold.
- `--launch-lights` (new, or an assertion in the step that already runs the SOL-88 launch, `--laser-game` / `--colony`: grep for `sol88Launch`):
  at t < start every emissiveIntensity on the two meshes is <= 0.15; at mid acceleration exactly 3 magnets are >= 0.9 and the breech ones are
  below 0.3; 3 s after the release all are 0. The `state()` of arc-launch reports `lit: [levels]` for the step.

## Stream C — the arena and the canyon (branch `round-7-arena`, port 18183): notes 5, 7, 8

### Note 5, SOL's second commandeering is immediate

What is there now (src/fx/sector-run.js ~lines 372-394, src/content/sectors.js `CANYON`): THE CANYON (sector 3) and THE CANYON AGAIN (the held
sector before the back door, sector `SECTOR_DOOR.earliest - 1` = 6, the nav route `canyon-again`) announce with `canyon_rises` / `canyon_again` as the
swarm rises (`firstPulse` 3 s), then wait for the column to be up (or `queueWait` 10 s after the first body) plus `seatAfter` 2 s, then lay the
pass (`canyonPass`, overhead 45 s), put the player in SOL-82's seat (`laserStation.passOver` -> `sit()`) and brief `canyon_pass`. With 2,000 bodies
(`bodies.again`) the column takes long to rise, so the seat comes well after the announce. The owner's "second commandeering" is THE CANYON AGAIN.

Decision: in THE CANYON AGAIN the seat comes `CANYON.again.seatDelay` (2 s) after the announce, the column still rising under the beam.
- `CANYON.again = { seatDelay: 2, overhead: 60 }` (content): the pass is laid and the seat taken `seatDelay` s after `canyon_again` is shown, not
  after the column is up; the pass's overhead for the again-sector is 60 s so the beam still covers the last bodies up (measure how long the 2,000
  take to rise on the `canyon-again` route headless and set `overhead` to cover it plus 10 s; write the number in the entry).
- `canyon_pass` (the comms) is shown AFTER the seat is taken, over the seat (Isao's panel shows while seated: confirm on the route; if the panel is
  hidden in the seat, the seat's own strip carries the line). The first canyon (sector 3) keeps its order (the owner named the second only), but
  its `seatAfter` path is untouched.
- The pure rule: `canyonSeatDue({ again, announcedAt, upAt, firstAt, t, tune })` in src/domain/canyon.js, tested for both sectors.
- `--canyon-again` asserts `seated` within 4 s of the `canyon_again` brief and the `canyon_pass` brief after the seat; `--canyon` unchanged.

### Note 7, the Ridgebacks at THE MOTHER's site are more aggressive

What is there now (src/fx/mech-squad.js, src/fx/tower-combat.js ~line 136, src/content/reinforcements.js): the four Ridgebacks carry sixteen
sentry records (rotor, lancer, quiver, quiver at MAX_TIER) that tower-combat aims and fires exactly as it fires a mounted sentry: the sentry's
`cooldown`, `range` and `prefers` at the top tier; `bossShare` 0.1 makes their rounds deal a tenth to the mother. The arena pair random-walks the
arena floor off the crater (`patrolCells` 14), the base mech walks home, the hunter chases. Nothing makes a mech fire faster or farther than a
mount, and a mech on the far side of the plain is out of range of the fight for long stretches.

Decision: a mech is a battery, not a mount.
- `REINFORCEMENTS.fire = { cadence: 1.8, range: 1.35, bossShare: 0.2 }`: a mech record's cooldown runs `cadence` times faster and its range is
  `range` times the sentry's (applied where tower-combat reads `effectiveStats` for a `tw.mech` record: one branch, the numbers content's), and its
  rounds deal `bossShare` to the mother (0.2, up from 0.1; the gunship still decides the fight: the merge note of 2026-10-23 measured two
  Ridgebacks at 0.1 taking her in 34 s with TALON volleys, so check the fight's length on `--arena-fight` before and after and keep her death in
  the gunship's hands: if the pair alone kills her under 60 s, lower `bossShare`).
- The arena pair closes: while the mother is up (`sectorRun().defNow().boss` and not `bossDown`) the pair's walk targets the ring at
  `REINFORCEMENTS.engageCells` (8) from her, not the random plain (src/domain/mech-roles.js `nextCell` gets a `quarry` cell for the arena role,
  tested); after her death they return to the plain.
- Measure on `--arena-fight`: shots per mech per minute and the share of frames with a target, before and after; the entry carries them. The step
  asserts the pair's shots per minute at least doubled and the fight still ends by the gunship (or within the current step's bound).

### Note 8, the print before BELOW is seen

What is there now: the Nih-Dairia mech prints on the `boss` trigger (src/content/companions.js line 120: `{ boss: true, delay: 10, patience: 150,
brief: 'pet_print_mech' }`), gated by src/domain/pet-print.js `printReady`: no shot, no seat, no card, Isao free, the fight in a breath, until
`patience`. THE ARENA is `doorAt + 1`; its SECURE sets `bossDownAt` (src/fx/sector-run.js line 450), then the debrief and the board come up (cards
hold the print), then BOTH WALLS (`doorAt + 2`, the final sector) begins: a flow sector with no breath, so the print waits `patience` 150 s into the
fight, or lands at its SECURE, where the descent (`api.descent`, src/fx/descent-host.js `begin`) starts at once: `say(DESCENT.brief)`, the look
glide (a shot: `c.look(arena)`), the still frame. The print's close-up (src/fx/pet-print.js `cu.begin`) is ended by any other shot, so the owner
sees a print start and the cave take it.

Decision: the mech's print is a beat of THE ARENA's SECURE, before its debrief.
- In sector-run's end for `def.boss && outcome === 'secure'`: after `bossEnd`, the host's `api.printNow?.('mech', then)` runs the mech's print
  forced (pet-print's `forced` path, its close-up on, Isao's `pet_print_mech` line as the brief, the game live and paused for nothing else), and
  `then` shows the debrief. The trigger's `delay`/`patience` stay as the fallback for a run where the print could not go (the hull lost, a skip
  route without the arena: `printNow` returns false and the debrief shows at once). The securePause (`SECTOR_TIMING.securePause`) runs first so the
  SECURE callout is read, then the print.
- descent-host `begin` waits while a print runs (`c.printing?.()`, capped at `DESCENT.printCap` 45 s) before `say(DESCENT.brief)` and the look:
  a print that somehow starts at BOTH WALLS' SECURE is seen to its end, then the descent goes.
- A skip of the print's close-up (Space, the FEIDS rule) ends it at once as today.
- `--pet-print` or `--arena-carcass` asserts on the boss route (`?skip=defence&sector=8&boss=1`): after SECURE the mech's print starts within
  `securePause + 2` s, its close-up runs to `printEnd` (or the skip), and the debrief shows after `done`; `--descent` asserts the descent's brief
  is said with no print running.
- Record the order in the director board's data if its lane for pets names the mech's trigger (src/content/director.js): "after THE ARENA's
  SECURE, before its debrief".

## Stream D — BELOW's chase camera and hands (branch `round-7-below`, port 18184; the cave repo `~/Dev/stalheart-cave` branch `round-7-below`
off `round-6-below` 0de7405, imported into `below/` with `node scripts/import-below.mjs` from a clean cave tree): note 9

What is there now (cave `src/main.js` lines 134-138, 243-246; `src/isao.js` lines 30-52; `src/flight.js`): the keys ARE the quadcopter scheme
(A/D and the arrows yaw at 1.3 rad/s, W/S fly where ISAO faces, Space/Shift climb and sink, no strafe; round 6 made the tilt come from the keys
alone). The mouse yaws ISAO (`yaw -= movementX * .002`) under pointer lock, taken on a mousedown on the view, and pitches the camera within the
round-6 clamp. The chase camera (`isao.update`) sits 4 m behind ISAO at his yaw, 1.1 m up, lerped at rate 10 (near-instant), looking at him; when
the boom would pass through the cave wall `clipBoom` shortens it, and if the shortened boom is under 1.8 m the camera is moved to the best of five
candidate azimuths (`yaw + 0, ±0.8, ±1.6` rad): the camera jumps to ISAO's side or ahead of him, and the whole cave swings. In a tunnel, every turn
of the heading (A/D or the mouse) puts the boom in a wall, so a turn reads as "the cave flips around". The round-6 import is in `below/` (verified:
`below/src/flight.js` matches the cave's), so this is a second cause, not a missed import.

Decision: the camera never leaves ISAO's back; the mouse does nothing.
- The mouse: no yaw, no pitch, no pointer lock (the `mousemove` and `mousedown` handlers and the `pointerlockchange` pause go; a click on the
  view does nothing). The start card's control line becomes `W S FLY · A D TURN · SPACE SHIFT UP DOWN`; the harness's `look(y, p)` stays as the
  test's hand.
- The chase camera: its azimuth is ISAO's heading followed with a lag (`CHASE.follow` 6 /s: the camera's yaw eases toward the heading, so a turn
  swings the view over ~0.4 s, not in a frame), its pitch the clamped arrow pitch; when the boom meets the wall it SHORTENS (down to `CHASE.minBoom`
  1.2 m) and rises (`+0.4 m` per metre lost) but never changes azimuth: the five candidates go. The camera's up stays +Y. Position lerp rate 10
  stays (the smoothing is in the yaw now).
- Pure rule in `src/flight.js` (or a new `src/chase.js`): `chaseYaw(camYaw, heading, dt, follow)` and `boomFor(clearance, { boom, minBoom, rise })`,
  node tests in the cave's `test/` (the eased yaw crosses no frame step over `follow * dt * (heading - camYaw)`; the boom never swings; the up is +Y).
- The cave's browser suite (`npm run test:browser` on the cave, its own port) gets a step: fly W 2 s, hold D 1.2 s, release, fly W 2 s, in the
  first corridor; per frame the camera-to-ISAO azimuth minus ISAO's yaw stays within 0.6 rad, no frame changes it by more than 0.15 rad, the camera
  up is +Y, and a `mousemove` of 400 px changes nothing (yaw, pitch, camera).
- Import into the game (`below/`) from the clean cave tree, `--descent` and `--descent-carcass` green on the game's port under the lock.

## Shared rules for the four agents

- Branch from `overnight-2026-10-23` at the commit that adds this file, in your own worktree (`~/Dev/stalheart-r7-<stream>`, `node_modules`
  symlinked from `~/Dev/stalheart`); never edit `~/Dev/stalheart` (served live on :8155) and never run a browser suite against it.
- Measure before you change; keep before/after numbers and frames in your scratch folder, summarised in the entry.
- `node --check` every edited file; `npm test`, `npm run check`, `npm run architecture` before every commit. Browser steps on your own port
  under the lock: acquire immediately before one run, release immediately after it, one waiter per stream, `acquire ... && run; release` so a
  failed acquire never runs unlocked; never hold the lock while reading or editing. Baseline a red step on the base commit before blaming your
  change: `--gunship` (program count), `--grow` (gunship_overhead), `--story`, `--story-world` ("a piloted round met the terrain", flaky) are
  known reds on the base. Empty suite output is a failure. Never `pkill` by pattern.
- td-tab: at most +20 lines net per stream (5,349 under 5,450 now); bytes and long lines ratchet down only; pay additions by extraction in the
  same commit. Host literals: write the module's reads first (test/host-contracts). Domain imports core/domain only; content imports nothing of
  domain/fx; no bare `window`/`document` words in domain/content comments. New files go where `.claude/skills/add-module` says.
- One decision entry per stream (`npm run log -- add FILE` from a file outside docs/log/entries, then `npm run log -- render`, `npm run
  log:check`), one STATE paragraph under `## What landed on 2026-11-05 (round 7, stream X)` at the top of the "What landed" sections; keep STATE
  short. Commits carry the session's Co-Authored-By and Claude-Session lines; nothing pushed; no `git add -A` at the root.
- Report at the end (under 60 lines): the commits, what each note measured before and after, what you left open and why, which browser steps
  passed and which were red on the base, and any decision above you overturned and why.
- Memory: a 16 GB machine with three other streams running. One Chrome at a time (the lock), closed between steps, no headed runs.
