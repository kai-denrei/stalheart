# The flow of stages, as it plays (audit 2026-11-13)

The owner, 2026-11-12: "first we want the flow of stages". This page is the run as it plays on main e4e9cefb,
measured end to end, and what breaks the flow. No game change was made for it.

**How it was measured.** `--dog-scout` (real keys, the automatic landing) for the opening to sector 0. The new
`--flow` probe (one story page, harness hands that do what a plain player does at each hand-over: aim a seat, take
two cards, release the MK-9, read a screen 3 s, kill everything in a sector, flag the richest pile, press the real
CONTINUE) from the deploy to sector 3, and from a jump to sector 6 (`?skip=defence&sector=6`) until the run was lost
in sector 7. `--king`, `--descent`, `--finale` for the end. Times are seconds of game clock unless marked "wall".
The runs' JSON (`flow-open-to3`, `flow-open1` with Isao's said log, `flow-s6`) are kept in `.superpowers/flow/`, the
stills in `artifacts/browser/flow-*.png` (both local, not committed).

## The timeline

| # | Stage | Starts on | Length | The player | Told what to do by | Hands over to | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Landing (auto or flown) | START | ~20 s touchdown to the dog | watches (or flies) | the held shot, Isao's 3 lines | the deploy | works |
| 2 | Recon dog | the deploy, K9 printed 7.4 s | 39 s (2 points) | drives | Isao, ring markers, hint strip | the 2nd survey | works |
| 3 | First contact | the 2nd survey | 7 s to home | drives home | "Bring the dog home!", HOME marker | the dog home | works |
| 4 | Wall, Rotor, first wave | the dog home | gate 5.6 s, Rotor print 11 s, seat at 66.7 s; wave 7.6 s | waits 20 s, then seated | callout ROTOR MANUAL OVERRIDE | the wave cleared | works; 20 s wait |
| 5 | First harvest | the wave cleared | **48 s** (depot 24 s, rover 24 s) | **still in the Rotor's optic, no target** | **nothing visible** (see 1) | the rover home | **rough: dead time** |
| 6 | THE FIRST ORDERS | the rover home | a card, paused | chooses 2 of 4 | the card | the Quiver | works |
| 7 | Quiver | the card closed | 12-18 s | seated | callout QUIVER MANUAL OVERRIDE | its two cores down | works |
| 8 | Sector 0 (Stålheart prints) | the Quiver clear | gunship seat 7 s, then 72 s in the tank, mop-up 20 s: **99 s** | nukes, then drives | NUKE THE ENTRANCE!, TANK IS READY; then **nothing for 72 s** | the Stålheart stands | rough |
| 9 | Isao's study | sector 0 over | 21 s calm wait + 7 s talk + screen | watches, reads | close-up, screen | CONTINUE | works |
| 10 | Expedition | the screen closed | **98.5 s** to sector 1 (C-07's print close-up 15 s in it) | drives to the sites, or waits | "Take the tank to the landing sites" | 90 s grace or a part home | rough |
| 11 | Sector 1 THE LANE | grace / part | 115 s (ideal defender) | fights | brief, callouts | SECURE, debrief, board | works |
| 12 | Build board | the debrief's CONTINUE | paused | 2 picks | the card | the next sector at once | works |
| 13 | Sector 2 THE LONG LANE (radar) | the board | 153 s; the antenna's close-up 12 s mid-fight | fights | brief; REINFORCEMENTS CALLED | debrief, board | works; a cut in the fight |
| 14 | Sector 3 THE CANYON (SOL) | the board | not measured here | fights, SOL seat | brief | | not measured today |
| 15 | Sectors 4-5 (PRESS, SIDE WALL) | | 84 / 95 s (ledger of 2026-11-06, ideal cull) | fights | brief | | not measured today |
| 16 | Sector 6 THE CANYON AGAIN | the board | 280 s fighting, then **123 s held at SECURE** | fights, SOL's seat | brief, SOL's card | debrief after the 120 s cap | **broken** (see 2) |
| 17 | Sector 7 THE BACK DOOR | the board | 190 s fighting, SECURE, then **LOST 102 s later** | fights, builds behind the bays | omens, BUILD BEHIND THE BAYS | the arena (not reached) | **broken** (see 2) |
| 18 | THE ARENA, THE KING | the board after the door | drive ~52 s (Oct), fight 72.9 s (`--king`) | drives, then the gunship seat | THE KING card | SECURE, mech print, debrief | works |
| 19 | BOTH WALLS | the board | not measured | fights | brief | SECURE | not measured |
| 20 | THE DESCENT (the cave, the Queen) | BOTH WALLS SECURE | open 5 s after the hand-off (19.5 s wall); the cave itself by hand | flies Isao in, places the charge, flies out | the cave's card | the cave's outcome | works (not timed) |
| 21 | THE ENDING | the cave's outcome | diorama 8 s (17 s with DAY 42), Dyson constellation 26 s (skippable) | watches | Isao's 3 lines | the campaign card | works |
| 22 | After | the campaign card | | KEEP HOLDING (endless) or NEW RUN | the card | | walk and new planet missing |

## The problems, ranked

Each: what, the evidence, a fix and its size, and whose it is (**bug**: safe to fix without a call; **design**: the owner's).

1. **Isao talks to a hidden panel in every seat.** A seat hides `#td-brief` (`app.css` line 84, `.sentry-pilot-mode`),
   but the queue still runs and spends each `once` line. Said with the panel hidden on the opening: `alien_comms`,
   `harvest_biomass`, `wave_cleared`, `first_harvest` and **all three economy lines the owner asked for**
   (`no_bank`, `biomass_bonds`, `biomass_seeps`, captions only, never recorded), `quiver_cleared`. No line shows
   from the tremor (30.7 s) to the tank (127.2 s). Evidence: `--flow` said log (`flow-open.json`, rows `said ... (panel
   hidden: a seat)`, `flow-open1.json`). Fix: hold a non-urgent line (`want`, and `once` lines) until the panel can be seen, or give the
   seat a one-line caption strip. Small to medium. **Bug.**
2. **SECURE is not the end of a sector.** Sector 6 read SECTOR SECURE at 297 s and its debrief came at 420 s: the
   debrief waits for calm (`STORY_CALM.maxHold` 120 s) and in that wait the gate went to half, failing, and down
   ("They pushed the gate in"). Sector 7 read SECURE at 610.7 s; 26 s later "One of them reached the Stålheart!", and
   the run was LOST at 712.3 s, after the win was shown. Caveat: the probe's defender stops at SECURE, as a player
   who believes the screen would; `sectorCull` never removed the bodies that did it (it skips guards and bodies still
   emerging), so which bodies these were is not yet known. Evidence: `flow-s6.json` rows and Isao's lines. Fix: find
   them (a probe on `aliveBodies()` at SECURE), then either clear the field at SECURE or call SECURE only when it is
   clear; `lose()` should not accept the `secure` phase. Medium. **Bug.**
3. **The first harvest is 48 s of nothing, in the Rotor's optic.** The wave clears at 74.7 s; the depot stands at
   98.6, the rover is home at 122.8, then the card. The player keeps the Rotor's seat the whole time, NO TARGET,
   the depot and the rover out of his view, and (1) hides every word about it. Evidence: `--dog-scout` DOG TIMELINE;
   still `flow-open-harvest.png`. Fix: let go of the seat at the clear and give a view of the depot and the rover
   (or open the card at the flare and let the pour land in the bank live). Small. **Design** (what to show).
4. **Sector 0 runs 99 s, 72 of them with no instruction.** The gunship seat lasts 7 s (one MK-9, then the tank at
   +1.6 s: works on the default opening). Then TANK IS READY and GS01's two lines, and nothing until the Stålheart
   stands (133 to 205 s), the mop-up's 20 s, then 21 s waiting for calm before the study. Three waves of harmless
   bodies came (73) and stood there: ramming them is the only verb, and nothing says so (the MK-9 released where the
   seat looked did not fill the sinkhole: no `sinkhole_sealed`). Fix: a line or order ("ram them",
   or "hold the lane while I print"), or end the mop-up early when the field is harmless. Small. **Design.**
5. **The expedition hands over on a clock, not on the player.** Sector 1 opens 98.5 s after the study (90 s grace
   or the first part home), whether the player is out at a site or idle at the gate; C-07's print close-up takes 15 s
   of it. A player who follows "Take the tank to the landing sites" meets sector 1's brief far from the gate.
   Evidence: `flow-open.json` expedition 253.5 to sector 1 352.0; `SECTOR_TIMING.firstGrace` 90. Fix: open sector 1
   when the hull is home (or on a READY), keep the grace as the cap. Small. **Design.**
6. **Close-ups cut into a live fight.** The antenna's print (`antennaPrint`, 5 s mandatory then Space) took the camera
   for 12 s in sector 2's fight (487.7-499.6 s, 18-22 bodies alive); in sector 6's fight the FEIDS-26 drop took it for
   28 s (243-271 s) and K0-TECH's print for 15 s (a jump page: on a played run C-07 and K0 come earlier). Fix: hold
   `antennaPrint`, the prints and `feidsDrop` for a lull (`STORY_CALM`). Small. **Bug** (the owner's rule of
   2026-10-05: "never interrupt a player in a dangerous situation").
7. **A first-orders card skipped is gone for the run.** The pad, the foundry's work and the solar array are offered
   only at THE FIRST ORDERS; no later board offers them (`src/content/build-board.js` structures; `--board` asserts
   it). After a WRECK (960 salvage, ~1,580 kg at the card) the array can only be taken alone. Nothing a later stage
   needs was found to depend on the pad. Fix: offer the unbought three on the first build board, at their price.
   Small. **Design.**
8. **THE KING card teaches the old nuke.** Its hint is `GUNSHIP_SEAT_HINT.aim`: "MK-9 mini nuke (paint, then release:
   it drops two seconds before it burns)"; in the King's fight one press marks the spot and it lands 8 s later
   (`src/content/sectors.js` ARENA_HANDOVER, `src/content/gunship.js` 82-83). Fix: a hint of its own. Small. **Bug.**
9. **"Ten auto-sentries."** The cap refusal plays a random `sentry_overload` line; `sentry_overload_01` says "We can't
   manage more than ten auto-sentries" while the cap is 6 (+2, +2) (`src/content/isao-voice.js` 453). Fix: drop it
   from the pool, or re-record. Small. **Bug.**
10. **Sector 0's MK-9 reads DANGER CLOSE where the seat opens.** At the seat the readout already lists IN BLAST:
   TANK; released where it looks it says DANGER CLOSE · TANK · ISAO (stills `flow-open-sector-0-gunship.png`, `flow-open-construction.png`). Whether Isao or
   the hull is hurt was not measured. A player who fires at once, as NUKE THE ENTRANCE! says, may nuke his own base.
   Fix: open the seat on the entrance, with the tank's berth outside the blast. Small. **Bug, to check first.**
11. **"Mother" is left only off screen.** No player-facing text says mother: the cave says the Queen, the King card
    and Isao's lines say King. Left: the director board's row (labs, `src/content/director.js` 39: "THE MOTHER card"),
    `docs/ISAO-VOICE-LINES.md` 304-313 (descent_brief "the one the mother came out of", unrecorded), many comments.
    Small. **Bug** (labs and docs).

What works, checked: every hand-over from the deploy to sector 3 fired once and in order; no stage waits for the
landers' tour; THE FIRST ORDERS is reachable and affordable (2,421 kg after HARD; any pair 850-1,800); NUKE THE
ENTRANCE plays on the default opening and hands the tank over 1.6 s after the blast; the debrief's CONTINUE opens the
build board and the next sector starts as it closes; the King dies in 72.9 s with the Ridgebacks there; the cave
opens 5 s after BOTH WALLS' hand-off and hands back; the ending runs the diorama, the Dyson constellation and the card.

## The design's 19 stages that do not exist yet

- 9 **domes by kind and cell, printed by the KIDOU**: the board sells fixed domes (HABITAT NW 2,400 ...); Isao prints them.
- 11 **the radar as a choice**: it prints on its own in sector 2 (REINFORCEMENTS CALLED at 499.5 s).
- 16 **the Queen's kill**: the cave has it as the charge Isao sets by her (QUEEN / CONFIRMED, SUBSURFACE DETONATION); no fight.
- 17 **the Dyson sphere after the Queen**: the constellation plays after the cave, before the score: in place, as an animation.
- 18 **walking the finished base**: missing. After the card: KEEP HOLDING (endless) or NEW RUN.
- 19 **a new planet**: NEW RUN reloads the page (`h.reload()`); a run-to-run hand-off does not exist.

## Not reached or not measured

- Sectors 3, 4, 5 and BOTH WALLS under today's code (the 2026-11-06 ledger had S4 84 s, S5 95 s with every body culled).
- The cave's own length (it is flown by hand; `--descent` hands an outcome back).
- The arena's drive out on today's code (52 s on 2026-10-16, `--arena-drive`), and the door-to-arena hand-over (the
  sector 7 run was lost first). BOTH WALLS to the cave was seen only from `--descent`'s jump.
- Sector lengths here are the ideal defender's (every body killed every 2 s): the floor a schedule allows, not a
  player's time. Difficulty was not looked at (the owner's order).
- The dog's lines `dog_wall` and `dog_rotor` were dropped by the one-deep panel on the acceptance page, where the dog
  surveys at once; on a played opening they are 6 s apart and were not checked.
