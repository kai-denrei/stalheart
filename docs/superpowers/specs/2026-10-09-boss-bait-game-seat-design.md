# The bait mode in the game's own gunship seat (design and plan)

Owner, 2026-10-09, after trying the bait mode: "why are we re-inventing the wheel? just re-use the EXACT Same views from
the Gunship in the main game; a) thermal, b) smaller ground view on the bottom right. c) same sound effects, etc. except we
want multiple nukes." Replaces the lab's own seat (`src/labs/boss/seat.js`, a port of the gunship lab) in the bait mode
(spec `2026-10-09-boss-bait-mode-design.md`); everything else of the bait mode stays.

## Design (option A of the survey: host the game's seat in the lab)

- **The seat is the game's.** `createSentryPilot` (`src/sentry-pilot.js`) is instantiated by the lab in bait mode with a
  lab `pilotHost` (the ~20 hooks `td-tab.js:6067-6075` supplies: `mobile`, `select`, `views`, `thermal`, `leave`,
  `pause`, `map`, `wake`, `cellSide`, `cone`, `zoom`, `lens`, `round`, `visible`, `aimPoint`, `cameraPose`, ...) and a
  gunship bag `G` built like `src/fx/gunship-rig.js:88-138` `pilotBag` from lab state. The seat's own pose, lens, zoom,
  keys (1-3, V, Space, pointer lock, wheel), HUD (`src/fx/gunship-hud.js`) and every sound cue are therefore the game's.
  The seat is mounted only in bait mode and disposed on leaving it (its capture-phase key handlers swallow other keys).
  `Esc`/leave in the lab returns to the tank mode.
- **The rig.** Reuse `src/fx/gunship-rig.js` as is if its host is suppliable by the lab (it steps the platform on
  station, the MK-9 body, the call meter and calls `pilot.gunshipTick`); otherwise the lab steps the same pieces in the
  same order and says why in the adapter's header. The platform stays on station for ever (the lab's `stationForever`).
- **The world.** The seat works in cell indices (`G.cell`, `cellAt`, `centers`, `normals`, `paintHeavy(ci)`); the lab's
  planet is built by the game's own planet builder — use its real `cellSide` (fix every literal `10` the lab passes where
  the planet's `cellSide` is meant: `boss-tab.js` ~269/298/305/341, `seat.js` ~43, and anything else; confirm by measuring
  the platform's altitude in metres equals the game's 34 cells x 10 m). If the lab's planet has a cell lattice the seat
  can index, use it; else a fine lattice adapter mapping lab-local points to indices and back.
- **The rules.** Every round the seat fires lands through the boss fight's rules: `G.fire`/`G.step`/`G.landed`,
  `G.damage`, `G.blast(ci)` route to the lab's fight (the creature's damage by the same falloff to the nearest contact;
  Isao's `hurtBait`; the arena's destruction and the fear/stun on the 40 mm and the MK-9) instead of the game's
  `damageEnemy`/`executeStrike`; `G.enemies()` presents the creature's floor contacts (or its centre) as the game's enemy
  shape so the HUD's contacts/nearest and the danger report work; `G.bodies()` gives Isao (and the arena's obstacles if
  the danger report lists structures) so the HUD warns before a round lands on him.
- **Thermal.** The game's FLIR (`src/fx/flir-pass.js` `createFlir`) through a small post shim (`addFinalPass`,
  `setEnabled`, the renderer; or the lab's render to a target + the pass), and the game's heat tagging
  (`src/fx/thermal-heat.js`) with the creature, Isao and the MK-9 body as the warm parts; on in the seat (the seat calls
  `host.thermal(on)`), off in the tank mode.
- **The ground view.** The game's GROUND TRUTH monitor (`src/fx/story-monitor.js`), rendered after the lab's main render
  exactly as `td-tab.js:5222-5230` does (the falling MK-9 if any, else `pilot.gunshipOptic()`), its CSS scoped so the lab
  gets the game's box (`styles.css` ~3968-3975, the `gunship-seat` variant) without the game's `#tab-td` id — scope by a
  class both the game and the lab can carry, the game's look unchanged.
- **Multiple nukes.** `src/domain/gunship.js`: `perPass` becomes a count (`heavySpent` counts releases this pass;
  `perPass: 0` = unlimited); the game's content keeps `perPass: 1` and its 20 s reload, so the game is unchanged (node
  test). The lab's gunship content copy sets `perPass: 0` and `reload` from a lab knob `MK-9 reload (s)`, default 6.
- **Isao's voice.** Call `isaoSay(audio, ...)` once at the lab's audio start so the seat's `isaoSpeak('mk9_release')`
  has a sink (`src/fx/isao-voice.js:56-57`); the bait lines keep their caption fallback.
- **Out.** The game's orbit/arrival/departure of the platform; touch pads; the auto-fire; `src/labs/boss/seat.js` and
  its handle methods are removed (the handle's `aim`/`gun`/`fire` re-pointed at the game seat: `aim` sets the seat's
  yaw/pitch toward a local ground point, `gun` selects, `fire(on)` holds the trigger).

## Plan

1. **Domain:** `perPass` as a count, node test (game unchanged at 1; 0 unlimited; 3 = three); commit.
2. **Units:** find and fix the lab's literal cell sides; measure the platform altitude; `--boss`, `--boss-fight`,
   `--boss-cam`, `--boss-bait` green; commit.
3. **The game seat in the lab:** the host adapter (`src/labs/boss/game-seat.js`), the rig, the routing of rounds to the
   fight, thermal through the shim, the monitor with the scoped CSS, the voice sink; remove `seat.js`; the handle
   re-pointed; `--boss-bait` adapted (same assertions); one screenshot in the seat (thermal on, the monitor showing a
   falling MK-9) looked at; commit.
4. **Records:** an entry (accepted, superseding nothing — the bait mode's own entries stand) with the reuse, the
   multiple-nuke rule and the silent `gunship_nuke_call`/`gunship_nuke_hello` cues found in the game (no sound files; the
   game's auto-fire callout is silent — a game bug for the owner); STATE.md; commit.
