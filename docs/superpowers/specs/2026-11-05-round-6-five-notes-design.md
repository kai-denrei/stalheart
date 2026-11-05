# ROUND 6 — the owner's five notes on 19ca9a43 (2026-11-05, four streams from `overnight-2026-10-23` at the commit that adds this file)

Owner, 2026-11-05, after round 5 shipped (`docs/superpowers/specs/2026-11-05-round-5-ten-notes-design.md`), answering the director board's
question "what is KO-TECH": K0-TECH is the small feline (https://jelaludo.github.io/SentryTowers_A6/k0-tech-01/, "I suppose we do not have it
yet"), and after the Nih-Dairia fight Isao prints himself a pet, a Nih-Dairia mech about the tank's size (https://jelaludo.github.io/SentryTowers_A6/nih-dairia-mech/),
"like he does with the other pets". Then: 2) the main large change, an economy: after each round Isao proposes six things he can build and the
player chooses two, given enough biomass; 3) controlling the gunship while Isao is close to the boss sinkhole makes the gunship face the sky;
4) the streak callouts should not sit centred on the tank but slightly offset, alternating left and right; 5) Isao's controls in the last mission
(BELOW) changed from a quadcopter scheme to something the owner does not recognise, the mouse flips Isao sideways: bring back quadcopter controls.

The operator was not present for the design pass: the decisions below are the agent's reading, each written down so the owner can overturn it
with one line. Five read-only scouts and one page fetch mapped the code and the assets first; their findings are "what is there now". Both
asset sets are already downloaded and hash-checked at `/private/tmp/claude-501/-Users-minikai-Dev-stalheart/80d512a1-4181-4948-8e75-bb4dc9058d44/scratchpad/r6-assets/`
(k0-tech-01: manifest, README, LOD0/1/2 GLBs, quadruped-patterns.json; nih-dairia-mech: manifest, README, runtime.js, tripad LOD0/1/2 GLBs;
ASSET-LICENSE.md: reuse with attribution to jelaludo, credit line "Models by jelaludo — https://jelaludo.github.io/SentryTowers_A6/").

The round runs as rounds 4 and 5 did: worktree branches off the integration branch, one browser at a time under the lock
(`node ~/scripts/stalheart-browser-lock.mjs acquire|release|status <name>`, HELD ONLY ACROSS ONE SUITE RUN, one waiter per stream), a port each
(18181 / 18182 / 18183 / 18184), a scratch subfolder each, one commit per note (or coherent half), a decision entry per stream, a STATE paragraph
per stream under `## What landed on 2026-11-05 (round 6, stream X)`, nothing pushed by a stream. `~/Dev/stalheart` serves :8155 live: never edit it.

## Stream A — the pets (branch `round-6-pets`, port 18181): note 1 (K0-TECH, the Nih-Dairia mech)

What is there now (`src/content/companions.js` is the single source: two units, C-07 `c07` and RECKON K9 `k9`, each a GLB with baked clips,
gaits by speed, idle/sit/tricks; `prints.order` and `prints.triggers` (phase expedition + 20 s; perk uplink + 3 days), `print` the bed 1.9 m,
refLength 2.78, the timeline arrive 1.6 / print 9 / skin 1.4 / wake 3.5, the four-angle close-up rail `src/fx/print-closeup.js`;
`src/fx/companions.js`, `src/domain/companion-play.js` (greet, sit, flee the hull), `src/fx/pet-print.js` + `src/domain/pet-print.js`; the
assets under `assets/models/<unit>/<unit>_d0_lod1.glb` + `_lod2.glb` + README, pinned in `docs/companions-assets.lock.json` with sourcePath,
sha256, bytes, clips and checked by `scripts/assets.mjs check` and `test/companions.mjs`; a bestiary entry per unit `src/content/bestiary.js`
UNIT_ENTRIES (section colony, needs.pet, two Isao lines, a fact, a swatch); briefs `pet_print_*`, `pet_born_*` in `src/isaobriefs.js`; the
director's map `src/content/director.js` (petPrint at pet:0, pet:1); DAY 42's dance iterates the units; the finale diorama's side table is
hard-coded (`src/fx/finale-diorama.js:21`). ATTRIBUTIONS.md has no entry for any workshop model (C-07, K9, FEIDS-26, MX-06): fix that here.

**1a) K0-TECH-01, the third companion.** The asset: a 0.30 x 0.41 x 1.05 m feline (48.9 % of C-07's height), +Y up +Z forward, origin at
ground, palette-only; LOD1 (1,852,732 B, 14,878 tris) is the game tier and LOD2 (241,540 B, 2,980 tris, one draw, no clips) the far tier, as
for the others; eight clips at 120 fps: Watch_Idle 3 s, Feline_Walk_Cycle 1.6 s (0.2383 m/s), Stalk_Cycle 2.4 s (0.0893 m/s), Gallop_Cycle 0.4 s
(2.6889 m/s), Sit_Down, Pounce (1.6 m root travel on MOTION: do not use as a gait), Roll_Over, Give_Paw; the optics use KHR_materials_clearcoat
(check the loader draws it; the wire look replaces materials anyway). Decision: unit `k0` "K0-TECH" under `assets/models/k0-tech/k0_tech_d0_lod1.glb`
+ `_lod2.glb` + README (sha256 table), the lock extended (sourcePath `assets/k0-tech-01/k0_tech_01_d0_lod1.glb` etc. at the workshop's current
revision), gaits walk 0.2383 / stalk as the slow creep / gallop 2.6889 with `max` bands bracketing `top` ≈ 3.2 (a small cat: nimble, not C-07's
7), `accel` 7, `turn` 3.6, `idle Watch_Idle`, `sit Sit_Down`, tricks Roll_Over, Give_Paw, Pounce (a trick, played in place); `born
'pet_born_k0'`. Print trigger (third in `prints.order`): perk `farm` (the greenhouse, sector 3) + 2 days, delay 10, patience 150, brief
`pet_print_third` ("A small one. For the mice we do not have."); the print's size clamp (0.55) and bed fit as they are. Bestiary entry
(colony: the K0-TECH / LYNX-POINT SIAMESE series, "faceted armor, blue-coated sensors"), director `pet:2`, DAY 42 dances (it is a cat), the
diorama's side table gets a third place or the cat sits on the hull's deck (your call, say which). Stream B may later sell this print on the
build board (`offer`): keep the time trigger as the fallback so the cat always arrives.

**1b) The Nih-Dairia mech, Isao's own pet after the fight.** The asset: 6.6 x 1.8 x 7.6 m hexapod ("Six limbs. One borrowed idea." / "Isao
watched a Nih-Dairia and the Builder Robot translated it"), +Y up +Z forward, origin at ground, plot 9 x 9 m, root `NIH_DAIRIA_MECH_ROOT`,
49 control bones (`BODY_HEAVE`, `LEG_01..06` with `_YAW _HIP _KNEE _SLIDE _ANKLE _CLAW_1..3`), 27 sockets; LOD1 954,016 B / 19,104 tris (game),
LOD2 76,908 B (far). NO baked clips: the motion is `runtime.js` (`applyPose(root, time, mode, reachScale)`, motions Observation_Idle 6 s loop,
Tripod_Walk_Cycle 3 s loop at 0.3 m/s, Reach_Cycle 8 s, Anchor_Deploy 8 s with 0.55 m body advance), a planar study in metres. The story hull is
10 m long (`STORY_SCALE.tankMetres`), so 7.6 m is "about the size of the tank" as the asset stands: scale 1. Decision: unit `mech` "NIH-DAIRIA
MECH" under `assets/models/nih-dairia-mech/nih_dairia_mech_d0_lod1.glb` + `_lod2.glb` + README + `runtime.js` kept beside the model as the
reference, ported as `src/fx/mech-pose.js` (the add-module skill: a procedural animator the companions use when a unit has `pose: 'mech'`
instead of clips: idle = Observation_Idle, moving = Tripod_Walk_Cycle at a rate scaled to the body's speed over 0.3 m/s, capped where the gait
still reads as a walk (measure: the rate at which the feet start to skate or blur; expect 2.5 to 3.5, so `top` ≈ 0.8 to 1.0 m/s), a sit/trick =
Anchor_Deploy or Reach_Cycle). It is a slow, heavy study, not a runner: its own play rules (`src/domain/companion-play.js`: a `heavy` kind):
it roams within 6 cells of the Stalheart, walks to the hull when the hull has been still for 3 s and stops 6 m off (keepFromHull 6: a body this
size must not stand in the hull's way), never flees (it cannot), never dances at DAY 42 (it watches from the edge, idle), and the hull's dodge
rule treats it as an obstacle the pets avoid, not one that avoids the hull. Print: trigger kind `boss` (THE ARENA's Nih-Dairia dead: boss-run's
`deadAt`; `src/domain/pet-print.js printGates` learns the kind), at the first quiet moment after it (patience 150), brief `pet_print_mech`
("I watched her for a long time. I built what I understood."), `born 'pet_born_mech'`; the print on a 9 x 9 m plot by the base (a per-unit
`bedM` 9 and `refLength` 7.6 over the print's defaults; the close-up rail's angles and distance scale with the bed; timeline print 20 s, skin
2 s, wake 4 s), wire-first as the pets already are. Bestiary entry (colony: "ISAO FIELDWORK / BIOMIMETIC SERIES 001"), director `pet:3`, the
diorama: the mech stands behind the boards if it fits the frame, else left out (say which). Credit: ATTRIBUTIONS.md gets one "Models by
jelaludo" section listing C-07, RECKON K9, K0-TECH-01, the Nih-Dairia mech, FEIDS-26 and MX-06 with the workshop URL and the licence's terms, and
docs/ASSETS.md the same list; the mech's credit line names kai-denrei/lab-creatures as the creature reference, as its manifest does.
Tests: `test/companions.mjs` (lock, clips, gait order for `k0`; the mech's `pose` kind instead of clips), `test/pet-print.mjs` (order of four,
triggers of four, the `boss` gate, the per-unit bed), `test/bestiary-units.mjs`, a new `test/mech-pose.mjs` (the ported poser against
runtime.js's numbers: foot radius, leg phases, the body advance; the rate cap), `test/director-board.mjs` (pet:2, pet:3). Browser:
`--companions`, `--pet-print` (extend: the third print and the mech's print, a frame of each mid-print and born), `--arena-carcass` (the mech
printed after the kill: a frame with the carcass and the mech both in view would be the owner's picture), `--day-42` (the cat dances, the mech
does not), `--finale`. Memory: load LOD1 only in the game as the others do.

## Stream B — the economy, THE BUILD BOARD (branch `round-6-economy`, port 18182): note 2

What is there now: biomass is one bank (`src/domain/economy.js`, start 190 kg, streak x1.05 a kill capped x3) earned from kills, held sectors
(`sectors.js held.kg` 40-45), the farm (40 kg a sector) and refunds, spent only on sentries (the radial shop on an empty cell, 45-260 kg, upgrades
0.7x / 1.2x, sell 75 %) and shown as `620kg` in the HUD; the base programme prints its 16 steps for free in a fixed order at their `when` gates
(`src/content/base-programme.js`, `src/domain/build-programme.js`); the between-sector seam `api.interlude(go)` in `src/fx/sector-run.js next()`
exists and is a retired no-op (`src/fx/ending-host.js:12`); the two-button picker `src/fx/choice-card.js`; the sector debrief card with CONTINUE /
KEEP HOLDING / NEW RUN; two unbuilt proposals of 2026-10-26 (`docs/superpowers/specs/2026-10-26-economy-plan.md`: the player should feel slightly
constrained, prices and levers, a ledger probe first; `2026-10-26-base-development-plan.md`: phase 1 "choose order", a build board at the idle
gate, paid in biomass, a small tech tree). Decision, the first playable version:
- **When.** After every sector's debrief, on CONTINUE (the `interlude` seam, before `begin(n+1)`): THE BUILD BOARD, a card over the paused game
  with Isao's face and one line ("I can build two of these before the next sector. Choose."), not before sector 1 (the opening is frozen until the
  tour). KEEP HOLDING skips the board for that sector (the hold is its own choice).
- **The offers: six cards.** Drawn from the eligible pool, in this priority: (i) the non-spine structures not yet standing whose `when` gate
  would hold (board, garage, armory, farm, chips, launcher): THESE LEAVE THE AUTOMATIC PROGRAMME and are printed only when bought (their
  `when` still says when Isao prints them after the purchase: idle, manned...); the spine stays automatic because the arc depends on it (gate,
  Stalheart, landing, foundry, solar, bays, HUGIN, radar, assembly, back gate); (ii) a sentry Isao prints himself at a lane of his choosing (the
  radial's prices; he picks the emptiest lane's best cell, the sentry build pointer's rule), one or two kinds among the unlocked; (iii) an upgrade
  of the weakest standing sentry (`upgradeCost`); (iv) the hull: a repair of its dents now (free of the gantry queue) or a spare hull
  (`SINK.hull` 400 as the story's price to start); shield charges (250); (v) the pets when stream A's `offer` field exists (K0-TECH for ~90 kg
  from sector 2: `petPrint.force(i)` on purchase; if the field is not there yet, leave the slot to (ii)-(iv)). Never two of the same card; a pool
  short of six shows what it has.
- **The pick.** Up to two, keys 1-6 toggle, Enter confirms, Esc or SKIP takes none; an unaffordable card is drawn dim with "(short)" and cannot
  be picked; the second pick re-checks the bank after the first. Paid at the pick (`eco.spend`), the purchase recorded (`build-programme` gets a
  `bought` set and a `board` kind: a non-spine step is `due` only when bought; pure, tested), Isao's "ordered" line, then the next sector begins.
- **Prices.** Measure FIRST: the economy plan's ledger probe (`scripts/browser-test.mjs --ledger` or a scratch probe over `--pearl-story`'s run:
  income by source and spend per sector, the bank at each sector's end) on the base commit, before pricing. Then price so that two picks a sector
  are "slightly constrained": a player who held the sector and banked its kills can afford two mid cards, not the two dearest; the economy plan's
  target "less than two sentries' worth banked at a sector's end" is the check. Starting table (to be re-based on the measurement, in the
  entry): structures at 8 kg a print second (board 48, garage 80, armory 128, farm 128, chips 112, launcher 160), sentries the radial's, the
  upgrade `upgradeCost`, hull repair 60, spare hull 400, shield 250, the cat 90. Record before/after bank curves over sectors 1-5.
- **The card.** `src/fx/build-board.js` (the add-module skill), plain DOM in the debrief's style (the labs' CSS tokens), a tile per offer: name,
  price, one-line effect ("+40 kg a sector" for the farm, the perk's words), a swatch; no 3D thumbnails this round. Isao's panel keeps lines only.
  The HUD's biomass stays. The radial shop stays (sentries mid-sector as today).
- **Removing the six structures from the automatic programme changes the arc:** the director board (`src/domain/director-board.js`) must show
  them in a BOARD lane ("offered from sector n") rather than at a fixed print; `test/director-board.mjs` follows. The farm's 40 kg and the chips'
  period only exist once bought: the economy plan's "should the farm be economic" is answered yes by the board.
- Tests: `test/build-board.mjs` (the pool by sector and standing structures, six max, no duplicates, affordability, the pick of two, the spine
  never offered, the bought set gating `due`), `test/build-programme.mjs` (the `bought` gate), `test/economy.mjs` if it exists. Browser: a new
  `--board` step (sector 1 held → debrief CONTINUE → the board with six tiles → pick two → the next sector begins and Isao prints the bought
  structure at its gate; a screenshot of the board), `--pearl-story`, `--pacing`, `--story-world`, `--grow` (red on the base at gunship_overhead:
  baseline it). td-tab: pay every added line by extraction (the interlude wiring is one line; the card lives in its module).

## Stream C — two fixes (branch `round-6-fixes`, port 18183): notes 3, 4

**3) The gunship faces the sky when controlled while Isao is close to the boss sinkhole.** What is there now (`src/sentry-pilot.js:64-78`,
`:185-197`): the seat's `up` is the platform's normal, the pitch is fixed at -1.45 and clamped to [-1.5621, -0.95] by every writer, so the seat's
own direction always has a downward component; nothing in the seat, optic, rig or glide reads the sinkhole's depth or the hull; the glide into
the seat (`src/fx/seat-glide.js`) starts from the LAST PAINTED PICTURE (`seenQuat`) and slerps to the seat over 1.8 s, advancing only while
`dt > 0`; the hole-door shots (`src/fx/hole-door.js:38-80`) look UP at the sky from under the lip; the arena's forced hand-over puts the player
in the seat (`src/fx/boss-run.js`). Reading: the one path that faces the sky near the boss hole is a glide that starts from an up-looking
picture (a hole-door shot, or the hull's chase camera tilted up on the hole's rim as Isao drives the avoid road) and either stalls (dt 0 under a
shot) or is re-entered each time the player touches the mouse (a new `begin` from the half-way picture). Reproduce FIRST on the real route
(`--arena-fight` / `--arena-drive`): sample each frame the camera's forward against the platform's normal (`gunshipCam()`, `state().seat`,
`state().glide`, `state().camJump`); a frame with forward · up > 0 in the seat is the bug; move the mouse (Input.dispatchMouseEvent) during the
glide and after it, with the hull on the rim and off it. Then fix the cause found: if the glide, start every seat glide from a picture that
already looks down (when the last picture's forward · up > -0.2, the glide's start quaternion is replaced by the same eye looking at the seat's
ground point), advance the glide on wall time when the frame's dt is 0, and never re-begin a glide from inside a glide (mouse input during the
glide steers the GOAL, not a new start); if the seat (an `up` from a stale `state.tower` or the hull), say so and fix that instead. If the
headless route does not reproduce it, instrument: `state().camSky` counts frames in the seat whose forward · up > 0 with the hull's distance to
the hole, report it in the entry and ask the owner for the exact moment (which view they were in, which key). Tests: `test/seat-glide.mjs` (a
start looking at the sky ends on the goal and passes no frame facing up after the first 0.3 s; a dt-0 run still completes; a begin during a glide
keeps the start), `test/gunship-seat-pitch.mjs`. Browser: `--gunship` (red on the base at the program count: baseline), `--arena-fight`,
`--arena-drive`.

**4) The streak callouts: not centred on the tank, slightly offset, alternating left and right.** What is there now: `#td-callouts` is a
screen-centred DOM column (`styles.css:2716`, top 44 %, left 50 %), not tracked to the hull; `showCallout(text, cls)` (`src/td-tab.js:2087`)
appends up to three; the streak ones are `co-streak` from `noteStreak` (`:2118`) every fifth kill ("STREAK ×1.25"), "A6 POSTED" shares the class
(`:3488`); the `co-pop` keyframes own `transform`, so an offset must be `left`, not a transform; praise-off mode moves the column to the left
third. Decision: the streak callouts alone take a side class, alternating `co-streak-l` / `co-streak-r` per streak callout (a module-level
toggle), `left: -9vw` / `+9vw` relative in the normal layout, none in praise-off mode (that column is already off-centre); "A6 POSTED" keeps the
centre (its own class). Keep the first two lines of `showCallout` as they are (`test/voice-hooks.mjs:25` regexes them). Test: `test/tdcore.mjs` or a
small new test (two streak callouts in a row carry opposite sides; a dent callout carries none). Browser: `--pearl-story`'s SEEN_LOG still reads
the text; a frame with a streak callout up.

## Stream D — BELOW's controls (branch `round-6-below`, port 18184; the cave repo `~/Dev/stalheart-cave` branch `round-6-below` off its
`round-5-below`, then `node scripts/import-below.mjs`): note 5

What is there now (the cave's `src/flight.js` "Stabilized quadcopter", `src/main.js:133-138, 243-244`, `src/isao.js:34`): the KEYS are already
the owner's 2026-10-16 scheme (W/S thrust along the heading, A/D and ←/→ turn in place at 1.3 rad/s, Space/Shift climb and descend, ↑/↓ the
camera's pitch); no commit replaced it. The MOUSE: x yaws the body (`yaw -= movementX*.002`) and y sets the chase camera's orbit pitch, clamped
to ±1.565 rad, i.e. the boom can swing almost straight under or over Isao, and the world turns over on screen; and the body banks up to 0.32 rad
from the WORLD-FRAME acceleration (`flight.js:15-18`), so a mouse turn while moving rolls the body. Together: "the mouse makes the entire Isao
flip sideways". Decision: (a) the camera's orbit pitch is clamped to [-0.75, +0.55] rad (looking down at Isao from above is the chase view;
never under him; measure the two extremes in frames), the mouse's y stays a camera control only; (b) the body's tilt comes from the keyed
command alone: pitch from W/S thrust, roll zero (side is always 0 since 2026-10-16), the yaw from the mouse or A/D banks nothing; gravity-down
is the rig's yaw-only rotation about world up, as now; (c) the words: the pause help (`index.html:46` "WASD controls horizontal flight" is
wrong), README.md lines 20-22, 33, 48, the start card if it names keys (`src/mission.js:139-141`: add a second line `W S FLY · A D TURN · SPACE
SHIFT UP DOWN · MOUSE LOOK`; `test/mission.test.mjs:100-102` and the cave's `scripts/browser-test.mjs:36` pin the card's words: update both); (d)
remove the dead `lookDelta`. Tests: `test/flight.test.mjs` (a yaw change alone leaves pitch and roll at zero; thrust pitches; the camera clamp),
`test/mission.test.mjs`. Browser: the cave's own suite on your port (it stops at the stale nursery.tentacles 64 vs 60 on its base: do not chase),
then in the game `--descent-carcass` after the import (the controls card in the frame). Commit in the cave repo first, then import, then
commit the import here. Nothing pushed in either.

## Shared rules for the four agents

- Branch from `overnight-2026-10-23` at the commit that adds this file, in your own worktree (`~/Dev/stalheart-r6-<stream>`, `node_modules`
  symlinked from `~/Dev/stalheart`); never edit `~/Dev/stalheart` (served live on :8155) and never run a browser suite against it.
- Measure before you change; keep before/after numbers and frames in your scratch folder, summarised in the entry.
- `node --check` every edited file; `npm test`, `npm run check`, `npm run architecture`, and `npm run assets:check` when you add assets, before
  every commit. Browser steps on your own port under the lock: acquire immediately before one run, release immediately after it, one waiter per
  stream, never hold it while reading or editing. Baseline a red step on the base commit before blaming your change: `--gunship` (program count),
  `--grow` (gunship_overhead), `--story`, `--story-world` ("a piloted round met the terrain", flaky) are known reds on the base. Empty suite output
  is a failure. Never `pkill` by pattern.
- td-tab: at most +25 lines net per stream (5,357 under 5,450 now); bytes and long lines ratchet down only; pay additions by extraction in the same
  commit. Host literals: write the module's reads first (test/host-contracts). Domain imports core/domain only; content imports nothing of
  domain/fx; no bare `window`/`document` words in domain/content comments. New files go where `.claude/skills/add-module` says.
- Assets: under `assets/models/<unit>/`, pinned in a lock under `docs/` with sourcePath/sha256/bytes/clips, credited in ATTRIBUTIONS.md and
  docs/ASSETS.md; LOD1 in the game, LOD2 far; nothing larger than the LOD1 files named above enters the repo.
- One decision entry per stream (`npm run log -- add FILE` from a file outside docs/log/entries, then `npm run log -- render`, `npm run
  log:check`), one STATE paragraph under `## What landed on 2026-11-05 (round 6, stream X)` at the top of the "What landed" sections; keep STATE
  short. Commits carry the session's Co-Authored-By line; nothing pushed; no `git add -A` at the root.
- Report at the end (under 60 lines): the commits, what each note measured before and after, what you left open and why, which browser steps
  passed and which were red on the base, and any decision above you overturned and why.
- Memory: a 16 GB machine with three other streams running. One Chrome at a time (the lock), closed between steps, no headed runs.
