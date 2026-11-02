# ROUND 4 — the owner's fifteen notes on b9434246 (2026-11-02, three streams from `overnight-2026-10-23` d3af839e)

Owner, 2026-11-02 (the playtest of b9434246, pasted verbatim in the session; `0)` "the first wave of yellow enemies for the rotor is better now"
is the one note that asks nothing). The operator was not present for the design pass: the decisions below are the agent's reading of each note,
each one written down so the owner can overturn it with one line. Where a note names a number ("8 days") the number is the note's; where it
names a feel ("much more aggro") the first version takes a measured step and records what it measured.

The round runs as the previous ones did (`docs/superpowers/specs/2026-10-26-round-3-*.md`): three worktree branches off the integration branch,
one browser at a time (`node ~/scripts/stalheart-browser-lock.mjs acquire|release|status <name>`), a port each (18181 / 18182 / 18183), each
agent its own scratch subfolder, one commit per note (or per coherent pair), a decision entry per stream, a STATE paragraph per stream under
`## What landed on 2026-11-02 (round 4, stream X)`, nothing pushed. The integration branch `overnight-2026-10-23` is what :8155 serves.

## Stream A — the bodies and the hull (branch `round-4-bodies`): notes 1, 3, 6, 7, 9

**1) Cutis-Soft Ivory: more aggressive, more numerous, faster.** Content first (`src/content/pearl-enemies.js`): `aggression` white 1.3 -> 2.4
(the set's top is black's 2.5; the kit shortens a hunting body's cycle by 0.3 x a / (1 + a)). Faster: the body's hop pace is capped by the motion
audit (`test/pearl-motion.mjs`: ~1.2 radii a second before the hops pop; white sits at 1), so the ivory's ground speed rises through (a) the
record's walk `PEARL_PACE.white.speed` 1.08 -> up to the audit's ceiling, (b) the soft hunt's approach multiplier for white (`SOFT_HUNT`), and
(c) if those are not enough, `PEARL_BODY.scale.white` 0.6 -> 0.7 (a bigger body covers more metres a radius). Run the audit after every step;
stop at the last green value. More numerous: the ivory share of the first three sectors (`src/content/sectors.js` rows 1-3, `bodies` pulses)
up ~50 % (sector 1 [10, 20, 30, 50] -> [15, 30, 45, 75], 2 and 3 in proportion); the opening's waves (story-defaults, the Rotor's first wave) are
NOT touched (note 0 says they are right). Verify: `--pearl-story`, `--pacing` (the ideal defender must still hold sector 1), `--story-world`'s
aim wait (90 s) still passes; record the before/after of the nearest-ivory-in-range probe from 2026-10-30 if cheap.

**3) The purple reads white again (sector 1's barbed, not the Quiver chapter's).** THE SKY MODEL (2026-10-30) set every membrane to .65 and
retired the full skin, the pearl drawn over and the depth twins that round four of day-42 (2026-10-19) put on purple and brown exactly for this
note. The Quiver's single barbed stands alone at night on dark floor and reads purple; sector 1's barbed walk among 40-60 ivories on the daylit
pad and read as the round-4 finding (a .65 skin covers .29 of what lies behind it). Decision: purple and brown take the full skin back
(`PEARL_MEMBRANE` opacity gain 1.35, `pearl` .55 drawn over, the depth twins via `pearlShow`) while keeping the Sky body (stalks, cycle, pace, size).
Measure first and after, as 2026-10-19 did: a paused daylight frame of a site's guards among the ivories, the share of the purple body's box that
is saturated purple (before ~31 %, the 2026-10-19 fix reached 79 %). Also rule out a second cause with a probe: read the pool/tier of sector 1's
barbed bodies (`state().enemyRecords`) and compare the Quiver chapter's spawn (`here`, pace, scale) with a site guard's; if they differ in dressing,
say so in the entry.

**6) Bodies walking in the centre of sinkholes; the hole reads as a flat transparent surface.** Two halves. (a) Placement: a body's drawn point
(`src/fx/creature-pearl.js` place(), `creature-bodies.js` point) is kept off every open crater (`game-breaches.js craters()`: centre + radius,
the hull's own rule) except the one it is rising from (`e.emergeOff` / `riseAt`); a record whose path crosses another hole's cell is nudged to the
rim as the EMERGENCE rim offset does, without touching the kernel's topology (`docs/kernel-provenance.json` stays). (b) The look: measure with a
screenshot straight down on a sector breach under the default wireframe look, then make the interior read as depth: a dark throat (the breach
surface shader darkening to black toward the centre, or an inner cone mesh below the lip) so the hole is a hole from the tank's view and from
orbit. The quiet breach's plate rule (2026-10-30) stays. Verify: `--sinkhole`, `--rim-holes`, `--story-world`.

**7) Hitting a hard core must be explicit.** Extract the dent branch of `playerHit` (src/td-tab.js: the `hull-dent` class flash, the bump, the
danger_alert, applyTankHealth) into `src/fx/hull-dent.js` (td-tab's budget is paid by the extraction) and there: (a) a much stronger red halo
(styles.css `.hull-dent::after`: ring 3 -> 6 px, inner glow 60 -> 160 px, 0.35 -> 0.6 s, plus a short red vignette) and a recoil: `bumpLeft`
0.6 -> 1.0 of BUMP_LEN and a camera jolt through `src/fx/ram-jolt.js`; (b) the callout `HULL DAMAGE` (showCallout, a red class; `HULL LOST` is the
existing path); (c) the gauge's colour on more of the hull: `applyTankHealth` (src/tankfeel.js) paints only the `healthBeam` running lights; add
the wireframe hull's armour-plate parts (model-fixture's wireLook PLATE names) so their wire colour mixes toward the gauge's teal/orange/red as
dents accrue, under both `?wire=1` (the default) and the solid look. Measure the tinted pixel share of a hull screenshot before/after at 3 dents.
Verify: `--tank-shell`, `--grow` (the real handover path), a headless hit through the harness (`faultOnce()`/a cored contact).

**9) Sector 10, an aberration through the ground near the base (the owner's screenshot did not reach the machine).** A probe, not a fix, unless
the probe finds it: `?skip=defence&sector=10#td` (the generator's sectors), frames from the hull's view at the base and from above the base at
t = 10 / 30 / 60 s (`artifacts/browser/sector10-*.png`), looking for a slab, a plate, a crater's stone or a wireframe showing through the floor.
The first lead: the generator's breaches stand on the nearer ring (`SECTOR_GENERATOR`, the nearer-ring note beside it in sectors.js) and a NON-quiet
breach's reference plate (the dark slab the 2026-10-30 black-square fix hides only for quiet breaches) or its crater stone may intersect the base's
slab. If found, fix and pin it; if not, write the frames' paths in the entry and leave the note open for the screenshot.

## Stream B — the companions and the story (branch `round-4-story`): notes 2, 4, 5, 8, 14

**2) "Keep the chain going" explained.** `streak_lore` exists (src/isaobriefs.js, once, at x1.5 through `briefs.want`); the owner has not heard
it or wants it earlier and in the bestiary. Decision: say it at the FIRST streak callout (the fifth consecutive kill, `noteStreak`), not at x1.5,
still once; rewrite the two lines as believable technobabble, e.g. "When they die within a few metres of each other the cells cross-link before
they break down: a lattice. The mass stays on the surface, where I can pull it back in." / "One alone just liquefies and seeps into the rock.
Keep the chain going." (check lineDwell; captions until recorded). The bestiary (`src/content/bestiary.js`): the same explanation as an Isao line
on the CUTIS-SOFT IVORY and LEMON entries (the chain's bodies) and a short `BIOMASS · THE CHAIN` note where the terminal's copy allows one.

**4) The antenna, printed on screen; the reinforcements eight days later.** The radar is the programme step `radar` (src/content/base-programme.js,
sector 2, 12 s, brief `build_radar`, perk `uplink`); FEIDS-26 drops `REINFORCEMENTS.days` (3) after it, which is also when RECKON K9 is printed
(3 days after C-07 once `uplink` stands): the two collide. Decision: (a) `REINFORCEMENTS.days` 3 -> 8, and every line that names the wait reads
the knob (`reinforcements_called`, `build_radar`'s second line: "Printing the antenna. Once it stands I can call for reinforcements. Eight days
out." — the two-line rule of test/build-programme.mjs; a test ties the spoken number to the knob as the cave's fuse test does); (b) a skippable
antenna close-up: when the radar step prints, a live cut round the rising structure through four close angles (the pet-print rail: 5 s mandatory,
Space skips, `SPACE · SKIP`, the near plane lowered and put back), Isao's line over it; the step's own print (`base-print.js`) is the animation,
the cut only frames it. Shared code: lift the four-angle rail out of `src/fx/pet-print.js` into `src/fx/print-closeup.js` (domain rule
`printCamera` already pure) and use it from both. Verify: `--pet-print` still green, a new `--antenna-print` step (frames
`artifacts/browser/antenna-print-1..4.png`), `--reinforcements-timer` with 8 days.

**5) The companions get out of the tank's way.** They come to investigate (the `greet` rule: a trot to the hull, a sit 3 m off) and the hull drives
through them. Decision (pure rule, `src/domain/companion-play.js`): a new `flee`-from-hull: when the hull is within `fleeM` (6 m) AND moving
(speed over 0.5 m/s) toward the unit, the unit flees the hull at its top speed until `clearM` (12 m) away, then rests; `greet` only when the hull
is still (speed under 0.3 m/s for 1 s) and never while the hull moves; the flee pre-empts every mode but the party's dance (stream B note 8). The
ctx gains the hull's speed and heading (src/fx/companions.js from two samples of `host.hull()`). Test in test/companions.mjs (a hull driven at a
sitting unit never reaches within 2 m of it); `--companions` adds a drive-at check through `placeTank`/the harness drive.

**8) DAY 42: the companions on the dance floor, in the cut.** During the party both companions go to the clearing under the ball and dance
(a `dance` mode: tricks and sits alternating with short dashes round the ball's foot, until the klaxon); the reveal cut (`DAY_42.shot`, 10 s live)
grows to 14 s with two highlights: ~6-10 s a close shot on C-07, ~10-14 s on RECKON K9 (the pet-print angles' close framing), the skip rule as it
is. Unprinted companions are simply absent (the cut stays 10 s). The replay in the finale (20 s) takes the same highlights if the shot time allows.
Verify: `--day-42` (frames with a companion in the highlight), `--finale`.

**14) The final frame has both companions.** The diorama (src/fx/finale-diorama.js) stages copies of the hull and Isao before the boards; add
copies of C-07 and RECKON K9 (cloneFixture, their sit clip) beside the hull, in the camera's frame for the whole shot, when they are born.
Verify: `--finale` with `?pets=born` (a frame `artifacts/browser/finale-pets.png`).

## Stream C — BELOW (branch `round-4-below`; the cave repo `~/Dev/stalheart-cave`, branch `round-4-below`, then `node scripts/import-below.mjs`): notes 10, 11, 12, 13

**10) 17 fps in the tank view before BELOW: the cave boots behind the game.** `descent-host.js begin()` creates the iframe hidden at once, so
the cave's world build and first frames share the GPU and the main thread with the live game while Isao's brief plays. Decision: pause the game
(sim AND render: one last frame drawn, then no `renderer.render` while `descentLoading`) behind the static exposition: Isao's brief panel is DOM
and keeps reading over the frozen frame of the hole's rim view; the cave posts `{ belowReady: true }` (handoff.js `postReady`, after its world is
built and its first frame drawn) and the host waits for it (cap 25 s, then as today); then the game runs again for the dive (cheap: the cave is
idle, loaded) and the frame shows. Measure: the frame time during the load before/after (the harness `state().fps` or a frame-time probe), the
brief still readable (a frame).

**11) A callout for the controls and the mission; a GREEN flare at the entrance.** In the cave at the start (both modes): a card/alert
`MISSION · PLACE THE CHARGE BY THE QUEEN · GET BACK OUT` then `F · FLARE   Q · LIDAR (NOT READY YET)` for ~8 s (the Q part reads `Q · LIDAR` once
`lidar-ready`, where PRESS Q already takes the alert line); a green flare (a distinct colour in flares.js: the drop key's flares stay as they are)
pre-dropped at the start beside ISAO's start point, resting on the rubble (flare-physics), marking the way out. Tests: the flare at the start lands
and is green, the words in the card, mission.test.

**12) The countdown accelerates when Isao is out early.** On `extracted` with the fuse's remaining over 15 s, the fuse runs at x4 until 10 s
remain, then real time to `detonated` (the audio countdown, keyed on remaining, is unchanged). Pure in mission.js (tickMission's dt for the fuse);
test: extracted at 80 s remaining detonates in ~27.5 s of real time.

**13) The entrance belongs to the planet; the Nih-Dairia carcass outside.** In `?stalheart=1`: the sky disc over the mouth takes the game's night
(the near-black sky with the game's star field tone, not tronColors' hemisphere), the rim torus the planet's rock tone, and a carcass at the rim: a
still, matte-grey Reed/Nih-Dairia body (the cave's own reed.js body, the lab's dead grey of 2026-10-19, at the mother's size relative to the hole,
HOLE_SCALE 24) lying over the lip, seen up the throat from the start and from the surface on the climb out. Tests in door.test.mjs (the carcass
over the lip, outside the throat's clearance, not in the flares' way); headless frames of the start view and the climb.

## Shared rules for the three agents

- Branch from `overnight-2026-10-23` at d3af839e in your own worktree; never edit `~/Dev/stalheart` (it is served live on :8155).
- `node --check` every edited file; `npm test`, `npm run check`, `npm run architecture` before every commit; the browser steps named above on
  your own port under the browser lock. Empty suite output is a failure. Never `pkill` by pattern (it kills another session's tests).
- td-tab: at most +25 lines net per stream (5,353 under 5,450 now); bytes and long lines ratchet down only; pay additions by extraction in the same
  commit; hosts in programme-host / expedition-glue / showcase-hooks are free. Host literals: write the module's reads first (test/host-contracts).
- Domain modules import core/domain only (the tunables come in as parameters); no bare `window`/`document` words in domain/content comments.
- One decision entry per stream (`npm run log -- add FILE`, written outside docs/log/entries, then `npm run log -- render`), one STATE paragraph
  under `## What landed on 2026-11-02 (round 4, stream X)` at the top of the "What landed" sections; keep STATE short.
- Commits carry `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; nothing pushed; no `git add -A` at the root.
