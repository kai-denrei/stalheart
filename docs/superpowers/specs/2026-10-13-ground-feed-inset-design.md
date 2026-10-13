# Ground events shown in a satellite-feed inset instead of a camera cut — design

Owner, 2026-10-13 (after the creature-enemies playtest): "we have too many cuts. I propose that we replace most instances of the camera
cutting the current action to show a Tremor/sinkhole be replaced by a temporary screen-within-the-screen, like a temporary satellite or
gunship view, clearly marked with HUD info and maybe static/CRT lines that it is a video feed." Then: "next I insist on fixing the Camera
jump cuts with screen-within-screen to show the sinkholes." Choices (the owner, the same day): **ground events** become the inset (sinkhole
breaches, the back door's rock collapse, the rock-wall reveal); the story's own scenes keep their cuts (arrival, Isao's talks, the rollout,
the SOL-88 launch, the sites tour, victory, the finale); the look is a **satellite** feed; it sits in the **corner box, ~30 % of the width**,
where the TALON seeker monitor is.

Branch `feed-inset`, cut from `pearl-enemies` at da4475cc (worktree `~/Dev/stalheart-feed-inset`). Local only until the owner says.

## What changes for the player

A sinkhole opening no longer takes the camera. The quake sounds as now; the main view stays where the player has it, under their control,
and a box opens in the corner: **SAT-3 · ORBITAL FEED**, a burst of static, then a top-down view from orbit over the sinkhole, a fast zoom from
a regional frame to a close one, held while the fodder emerge, a slow drift, static again, and the box closes. Its length is the old shot's
(pre-roll + the breach's duration + emergeHold), so the beat is the same, only off to the side. The back door's collapse and the rock-wall
reveal do the same with their own labels (SEISMIC ALERT · ROCKFALL; SURVEY · ROCK OPENING).

## The feed (src/fx/ground-feed.js, knobs in content)

- **Render:** the story monitor's way (src/fx/story-monitor.js): one renderer, the same scene drawn a second time through a feed camera,
  scissored into the box and copied out to the box's own 2D canvas (so the seat's CSS looks don't tint it). The feed camera looks straight
  down along the point's normal from orbit, its field of view easing from a regional span (~25 cells) to a close one (~4 cells) over ~1.2 s,
  with a slight drift and a slow roll during the hold.
- **Look:** monochrome (CSS grayscale/sepia/hue-rotate/contrast on the feed canvas, a green-amber phosphor), scanlines (a CSS gradient
  overlay), a light moving noise (a small pre-made noise tile scrolled), a vignette, static bursts at the open, at a retarget and at the
  close (~0.25 s). Plain CSS filter functions only (Safari ignores url() filters on WebGL; these are on a 2D canvas).
- **HUD:** label and a blinking ● REC; a target box over the point (projected each frame); GRID as a latitude/longitude of the point
  relative to the heart; ZOOM ×N from the field of view; SEISMIC (a number from the breach's size); T+mm:ss from the open.
- **Scheduling:** one feed per group of new sinkholes (as the shot was once per group). A new group while a feed is up retargets it (a
  static cut). The TALON / MK-9 seeker feed and the SOL-82 optic own the same box: while one is up the ground feed waits and opens after it
  if its event is still young (within its hold), else it is dropped. The schedule is pure (src/domain/feed-schedule.js) and node-tested.
- **Guards:** the old shot's guards were about the camera being taken; the feed takes nothing, so it also shows while a seat is manned
  or the gunship flies, unless that seat's own feed holds the box. It is not shown while the game is paused or a modal is up. The
  `quiet` breaches stay quiet.
- **The Pearl bodies:** creature-bodies' culling is turned off while a second view is up; the ground feed counts as one (the host's
  `wide()`), so bodies emerging show in it.
- **Back to the old cut:** `&cuts=dive` restores the camera dives (the A/B and the tutorial's safety net). The debug `viewBack` stays a
  camera shot.

## In the code

- td-tab.js (6141 of 6400 lines, long-line budget): the breach call site swaps `startDiveShot` for `groundFeed.show(...)` behind the flag,
  the per-frame render beside the story monitor's, and the frozen/driveFrozen tests that name `breach` keep working for `&cuts=dive`. No
  new lines if it can be helped; extract before adding.
- back-door.js and the reveal shot: the same swap.
- The main camera's shot latch (`shotActive`) is not taken by a feed, so nothing that waits on `!shotActive()` (the automation, the
  briefs) is held by it any more.

## Cost

The second render is only while a feed is up (~4-12 s a sinkhole group), into a box about 9 % of the screen's pixels, without the bloom
pass. Measured headed on the M4 with `&creatures=pearl` (the worst case) over a sector with breaches: the frame time with the feed up
against without.

## Testing

Node: the schedule (open, retarget, wait behind a seeker feed, drop when stale, close), the HUD numbers (grid, zoom), the feed camera's
pose (looks down the normal, the target at the centre). Browser step `--ground-feed`: a story sector's breach opens the box, the main
camera's pose and `shotActive()` are unchanged through it, the box closes after its length, the back door's collapse uses it, `&cuts=dive`
gives the old shot, 0 page errors. `npm test`, `check`, `build`, `architecture`; the story suites that expect a breach shot are updated
(story-world acceptance is flaky on main at the Rotor kill: baseline before blaming the branch); `--pearl-story`, `--sector-probe` still
pass.

## Deviations (the build, 2026-10-13)

Where the code said otherwise, the closest sensible behaviour; each one is in the commits on `feed-inset`.

- **The render is not the story monitor's copy.** Drawing the scene a second time and copying the box's rectangle out to a 2D canvas
  (`drawImage` from the WebGL canvas, as `story-monitor.js` does) measured +2-3 ms a frame on its own and pushed the p95 frame from ~31 to
  ~48 ms (headed M4, see Cost). The feed camera draws into its own render target at **30 Hz** (a video feed's rate, `GROUND_FEED.feedHz`),
  reusing the main pass's world matrices, and one shader quad samples it into the box's rectangle of the game canvas every frame. The look
  (luminance, green phosphor, scanlines, grain, vignette, the static bursts) is in that shader, not in CSS filter functions; the box is
  transparent (its frame, the HUD's text, a small 2D canvas for the target box). Safari draws it the same by construction. The seats' CSS
  looks on `#td-app`'s canvases would tint it, but every seat with one (the gunship's FLIR, SOL-82) holds the box anyway.
- **Length.** The old shot's whole length is pre-roll + hold + **tail** (`startDiveShot`'s `dur`); the spec's parenthetical left the tail
  out. The feed keeps the whole length: 12.48 s for the story's sinkhole, 5.6 s for the back door, the reveal's 3.2 s.
- **The box's size.** 30 % of the width, capped where its top would reach the shield pad (`.tfire-tertiary`, `min(26vh, 230px) + 92px` up
  from the bottom): 403 px wide at a 900-px-high window (28 % of 1440), 16:10.
- **SEISMIC's size.** The game's breaches share one radius, so a sinkhole group's size is its count of sinkholes; the back door's is the
  cells that fell, the reveal's the cells that opened. Each kind has its own base magnitude (GROUND_FEED.seismic).
- **Framing per kind, and the lens.** The sinkhole keeps ~25 to ~4 cells; the feed camera sits 60 cells up (lenses 23.5 to 3.8 degrees). The
  rockfall frames 30 to 11 cells (the mouth, its rock and the lane in one picture: at 4 cells it was floor and black rock), the reveal 40 to
  28 (the campaign board's planet is ~27 cells across, so it is the whole band, as the old orbit frame was).
- **The reveal keeps its beat.** The rock opening exists only on the campaign board (the debrief's next sector). Its 3.2 s shot freezes the
  world ("the game speaking"), and the sim's fast-forward ends it at once to run its `onEnd` (the band repainted, the orbit view). That
  shot stays, frozen beat and `onEnd` and all; only its pose changed: the main camera holds where it was (`gameplayCameraPose`) while
  SAT-3 shows the band. `&cuts=dive` restores the orbit frame.
- **Who holds the box.** Besides the TALON / MK-9 monitor and the SOL-82 seat, any live camera shot other than the reveal (a story scene,
  the showcase's) holds it: the feed waits behind it exactly as behind a seeker. The seat's glide and the showcase montage hide it
  (`styles.css`), and the module treats them as blocked so its quad does not draw without its frame. The feed is not skippable: it takes
  nothing.
- **The world runs under the rockfall.** The old `backdoor` dive was not one of the controller's live shots, so it froze the world for its
  5.6 s; the feed takes nothing, so the fight goes on while the box shows the collapse (`--backdoor` now counts the wall cells against the
  moment of the call, since the sector's sinkholes may clear rock meanwhile).
- **The campaign board's breaches** use the feed too (their old shot was the orbit-only one, no dive), with the shared preset's pre-roll.
- **The static bursts** are 0.35 s at the open and a retarget and 0.3 s at the close (full for their first half), not ~0.25 s: at 0.25 s a
  burst read as a flicker.
- **Harness.** `__stalheartTest.feedAt(ci, hold)` opens a feed over a cell; `state().groundFeed` carries the schedule's counts, the event,
  the HUD's numbers, the box and the feed camera.

### Cost, measured

Headed Chrome on the M4, 1440 x 900, vsync and the frame limit off, `index.html?skip=defence&sector=2&fps=1&hold=1&creatures=pearl#td`
after the sector's own first feed: three cycles of 8 s with no feed and 8 s with the feed held over a breach (`feedAt`), the same main view
(scratchpad `feed/ab.mjs`).

| render path | frame mean off / on | p50 off / on | p95 off / on | feed CPU |
|---|---|---|---|---|
| scene every frame, `drawImage` copy (the story monitor's way) | 19.1 / 26.6 ms | 22.8 / 26.2 | 31.5 / 49.5 | 3.1 ms |
| same at 30 Hz | 19.2 / 24.8 | 22.7 / 26.9 | 31.3 / 48.4 | 3.2 |
| render target at 30 Hz, shader quad (shipped) | 18.9 / 22.1 | 22.2 / 26.1 | 31.8 / 37.2 | 1.1 |

So the feed costs ~3 ms a frame on average while it is up (~4-12 s per sinkhole group). Turning the Pearl bodies' culling off for it
(`wide()`) measured within noise of leaving it on (24.4 against 24.8 ms on the copy path).
