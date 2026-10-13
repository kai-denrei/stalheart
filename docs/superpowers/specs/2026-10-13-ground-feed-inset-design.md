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
