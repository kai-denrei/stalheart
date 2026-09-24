# Refactor round: robustness first, then simplification

Owner, 2026-09-25: "launch a round of refactoring; simplifying and making the code base more robust". Built on branch `pacing`
(branch `refactor`). Inputs: the architecture review of the pacing branch (`2026-09-25-pacing-architecture-review`) and two
read-only surveys of 2026-09-25 (robustness hazards across src/; extraction targets in src/td-tab.js).

Every task: node tests for the pure part, the browser suite that covers the touched path (through `scripts/browser-lock.sh`),
`npm test`, `npm run check` (td-tab stays at or under its line budget), one commit per task, no behaviour change unless the task
names it. Global constraints from `docs/superpowers/plans/2026-09-24-session-pacing.md` apply.

## Robustness

1. **Dead enemies are freed.** `killCreature` only marks a record dead; nothing but a regenerate empties `enemies`, so every
   per-frame loop walks every body ever spawned and each dead record keeps ~28 KB of heap (~100 MB by sector 3). Compact the
   array in place at the end of `updateEnemies`. Proof: `state().enemyRecords` stays at alive + queued after `sectorClearField()`
   in `--sectors`.
2. **A fault in the frame never freezes the page silently.** Guard the simulation part of `frame()` so a throw is recorded once
   per distinct message and the frame still draws; `record()` folds a repeated event into a count so a looping fault cannot push
   the boot record out of the 300-entry ring. Proof: `test/diagnostics.mjs`; the default suite.
3. **P in a seat shows the pause card.** The Rotor/Quiver/gunship seats and SOL-82's seat flip the raw `paused` flag with no card
   and leaving the seat leaves the world frozen. Route them through `togglePause()`, which also refuses while a debrief, briefing
   or modal owns the pause. Proof: `--seats`.
4. **Game-time timers.** `src/fx/back-omen.js` staggers its dust with `setTimeout` (runs while paused, outlives a restart, and
   most puffs are culled by the medium-burst cap): a `tick(dt)` on the game clock. The controls card re-arms a 25 s timer every
   frame when storage is blocked: an in-memory once. Proof: `test/back-omens.mjs` on `tick`; `test/controls-card` if one exists.
5. **One sector clock.** The sector's timers read the global `t`, which runs through frozen shots while the sector tick is
   skipped, so openings, the feast timeout and the first-sector grace run out under a dive shot: the sector keeps its own clock,
   advanced by its tick. Proof: `test/sector-run.mjs`.
6. **Sector starts do not hitch.** The placement field recomputes the rim BFS (the clearing never changes) and the back-breach
   candidates (the same answer before and after the collapse) at every sector start: once per world. Proof: node tests; `--sectors`,
   `--backdoor`.
7. **The pacing probe reads game time** (`state().shieldClock`), not the wall clock, so a slow machine does not inflate the
   numbers STATE says to tune with; the probe's `undefined` events go.
8. **The HUD paints once a frame.** `updateHud()` rebuilds the objectives panel's HTML on every call (46 sites, one per kill), so a
   strike on a pile rebuilds it dozens of times in one frame: mark it dirty and paint in the frame. Proof: default suite, `--gunship`.
9. **NEW RUN leaves nothing behind.** `loseGame`'s card timer goes through `runTimers`; the story's loss card reloads the page as
   a lost sector already does; the daylight rig takes its night from the look, not from the lights' current colours. Proof:
   `test/daylight.mjs`; `--laser-game`.

## Simplification

10. **Dead code with no caller** (the review's list: `showOverrideModal`, `bfsDistFromSpawn`, `distToSeg`, `roundDot`/`roundDotTex`,
    `anyHostiles`, `VIEW_TAG`, `TRACK_RATE`, write-only variables, `storyApi.openSite`, the stale header): deleted, per the
    `remove-dead-code` skill. The ~84 untested URL-flag probes (3,064 lines) are a flagged-experiment class and wait for the
    owner's answer (asked on Telegram 2026-09-25).
11. **Long lines stop growing.** The line budget counts lines, so appending to a one-liner is free; `npm run architecture` gains a
    ratchet on the number of controller lines over 500 characters (budgets only go down).
12. **Extractions, line-neutral or better** (the survey's ranking, as the budget allows): the showcase's hooks to
    `src/fx/showcase-hooks.js`; the gunship rig to `src/fx/gunship-rig.js` with its lane queries in `src/domain`; the first hull's
    roll-out host into `src/fx/hull-issue.js` and the deploy path's pose maths to `src/domain/deploy-path.js`.
