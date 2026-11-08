# THE SETTLING — time to settle, the first orders, the first contact on a clock (2026-11-08, from `overnight-2026-10-23` at 39f98d63)

Owner, 2026-11-08, on THE LANDING's third look: "4) we will delay the arrival of the first enemies, first we leave time to settle, 5) the
player chooses what to build first with limited building material, the Stalheart being non-negotiable. 5) Isao tells the player that we
will need to scout for more building material, rocks, crystals, liquid, biomass... essentially we delay the first encounter."

Two calls put to him and taken (2026-11-08): the first choice is made on the EXISTING build board with its two picks (not a new card), and
the first enemies come on a TIMER after the landing (not when the scouting happens). The scouting is Isao's line only this round.

## 1. What the code says today

- A story start lands the SH02 (`src/fx/arrival.js`), Isao says his three lines, and on the cut to his face the beats deploy the AFR-01
  (`src/domain/story-beats.js` deploy). With `arrival` and `STORY_BEATS.earlyBreach: 0` the sinkhole opens QUIET at that same deploy
  (`early`), the fifty lemons rise as a column up the lane during the landers' tour, Isao prints the Rotor from the landing's stock the
  moment the AFR-01 is down (`foundry` → `printing`), and the Rotor is handed to the player the moment the tour ends (`rotor-ready && opened
  && !touring`): no tremor, no breach, no override on a landing (owner, 2026-10-05: "straight to the action"). The first enemies are on the
  field about 20 s after the deploy and the seat about 45 s after the page is ready. That is what notes 4 and 5 undo.
- The gate, the Stålheart (75 s), the landing pad and the recycler beat wait on `when: { phase: 'rotor-ready' }` (`src/content/base-programme.js`);
  the solar array on `expedition`. The foundry pays a barrel at a time (`stepFoundry` → `api.grant(perBarrel)`; a CLEAN landing grants its
  bonus barrel at the deploy, spec 2026-11-07 section 6): 3 x 60 kg over about a minute, 2 x 48 after a WRECK.
- THE BUILD BOARD (`src/fx/build-board.js`, rules `src/domain/build-board.js`, numbers `src/content/build-board.js`) opens only on the sector
  loop's break before sector 2 and after (`interlude(go, { n, via })`: `via === 'continue' && n >= 2`), over the paused game: six tiles,
  two picks within the bank, ORDER pays and places them. A structure pick is `buy(programme, step)`; a sentry pick is Isao's order on the
  emptiest lane's socket.
- SECTOR 0 (`construction`): if the Stålheart is still printing when the Quiver's two cores are down, the gunship comes on station
  (`api.gunshipArrive`, GS01 OVERHEAD), waves rise on a clock, NUKE THE ENTRANCE hands the hull over on the lane (`tankAfterNuke`). The
  hull otherwise rolls out of the Stålheart when it stands (`src/fx/hull-issue.js`, waiting up to 60 s for the Rotor's first wave).
- Acceptance: `--grow` plays the whole opening and asserts its order (the Rotor within 120 s, "the Rotor waits for the tour while the gate
  prints", the Stålheart straight after the gate, the pad behind it); `--opening-cuts` wants the Rotor seat within 150 s of the load;
  `--story-world` plays the opening from a tremor; `--board` plays a sector board; `--landing` the mini-game. Every harness run has
  `acceptance=1`.

## 2. The decisions

**A. The settle clock.** On an arrival that starts the beats at `landed` (the story's default start, flown or automatic; not a chapter, not
SKIP TUTORIAL), the beats run a SETTLE of `STORY_SETTLE.seconds` (120) game seconds from the deploy. Until it runs out nothing comes up: no
quiet breach at the deploy (`early` is off when the settle is on). When it has run out, the gated opening that already exists plays, in
order: the tremor (Isao's `tremor` line, the radar contact), the breach `breachDelay` later, the first fodder, the override line, the
Rotor's seat `overrideDelay` later. The breach is quiet (no cut-away, as since 2026-10-04) and its column rises up the lane with the head
start (`STORY_FODDER.headStart`, as the quiet breach does today), so the Rotor has them in reach when the seat is taken (owner, 2026-10-30).
The tremor also waits for the gate to stand (as today), for the Rotor to stand (section C) and for no camera shot to be playing (the
landers' tour, the hull's roll-out: `api.shot()`), so the first contact never cuts into a cut. The settle clock is the beats' clock: it does
not run while the game is paused (the first orders, section B, hold it). `?settle=N` sets the seconds (acceptance runs use it: the opening's
suites add `&settle=10`); `?settle=0` is a settle that has run out from the deploy.

**B. The first orders.** Once the beats have deployed (past `landed`) and the landers' tour is over (`!touring()`), the build board opens
ONCE as THE FIRST ORDERS, over the paused game (the same card, the same keys, the same two picks), with its own pool and words:
- the Rotor: a sentry card, the radial's price (45 kg), Isao's order on the plan's Rotor socket (`beats.state().socket`, not the emptiest
  lane); not offered when it already stands or is on the book;
- LANDING PAD (`landing`), SEED FOUNDRY (`foundry`: Isao works the AFR-01), SOLAR ARRAY (`solar`): the three opening steps become `board: true,
  first: true`, priced in the salvage's scale in `BUILD_BOARD.first.structures` (not index-scaled): landing 60 ("a landing pad on the SH02's
  ground"), foundry 40 ("Isao works the AFR-01: one more barrel, +60 kg"; the step carries `pays: 60`, granted when it stands), solar 120
  ("the array: the hull's shield charges on its island"). Their `when` becomes `{ phase: 'foundry' }`: a bought one prints as soon as its turn
  comes. They are offered at the first orders only: `BUILD_BOARD.structures` has no entry for them, so no sector board carries them; not
  bought is not built. A skipped opening (`jumpBought`) and a chapter's `printed` list stand them as before.
- the words: title THE FIRST ORDERS, line "The rocket is all we have. The Stålheart I print whatever you choose. Two more things: choose.",
  the hint and the buttons the board's.
- the budget is the bank. On a settled opening the deploy grants the whole salvage at once (sections x a barrel's worth, plus the bonus
  barrel): 180 kg after an automatic or HARD landing, 240 after CLEAN, 96 after a WRECK; the barrels the AFR-01 cuts afterwards are the
  picture of it and grant nothing more. The Rotor's stock is no longer granted free: it is bought like the rest (a WRECK buys the Rotor and
  the foundry's work, not the pad; CLEAN buys the Rotor and the array).
- when the card closes (ORDER or SKIP) Isao says `scout_material`: "That was the rocket. For the rest we scout: rock, crystals, liquid,
  biomass." / "The rover goes out once the Stålheart stands." The game unpauses; the settle clock runs.
- an acceptance run (`acceptance=1`) skips the first orders unless the query says `&first=1` (a headless page would wait on the card for
  ever); the `--settling` suite asks for it.

**C. The Stålheart first, the Rotor the player's.** The Stålheart is non-negotiable: it stays Isao's own step and its `when` becomes
`{ phase: 'foundry' }`, as does the gate's: Isao prints the gate (4 s) then the Stålheart (75 s) from the deploy, no longer waiting for the
Rotor. The beats no longer order the Rotor on a settled opening: `foundry` goes to `printing` with nothing ordered, and `printing` ends
when the socket is built, whoever ordered it. A Rotor bought at the first orders is Isao's next job after the gate (a tower order on the
book holds the programme's next step), so it stands before the Stålheart's long print. If the settle runs out with no Rotor standing or
on the book, Isao orders it himself (`api.pending(socket)` false → `api.grant(api.cost(key))`, `api.order(key, socket)`, his line
`rotor_emergency`: "Contact on the radar and no sentry up." / "Printing the Rotor myself. Get ready."); the tremor follows once it stands.
The 'rotor' chapter (`?skip=rotor`) and every later one start late and keep today's flow (the Rotor ordered at `foundry`).

**D. The consequence for sector 0.** With the Stålheart printing from the deploy it stands at about 95 s on a bought Rotor (gate 4 s, the
Rotor's print, 75 s, the flights) and its hull rolls out before the first contact at 120 s. The Quiver's clear then finds it standing, so the
construction phase (the gunship's station, NUKE THE ENTRANCE, the tank handed over on the lane) does not play on the story's default
opening; the beats go to `settled`. So that the gunship still comes: when a growing base skips construction, the `settled` entry calls
`api.gunshipArrive()` once (GS01 OVERHEAD, its line). The hull is the Stålheart's own roll-out (the views unlock at the first wave's clear
as today, so TANK is offered after it). Sector 0 remains in the STÅLHEART chapter (`?skip=stalheart`), in `--round23`, and on any opening
whose settle is shorter than the Stålheart's print (the acceptance pages with `&settle=10` play it as before). This is the owner's call to
overturn: a longer Stålheart print, or a settle shorter than it, brings sector 0 back on the default opening.

## 3. What this round builds

- `src/content/story-defaults.js`: `STORY_SETTLE = { seconds: 120 }`; the comment on `STORY_BEATS.earlyBreach` (the settle supersedes it on a
  settled opening; chapters keep it). `src/platform/story-world.js` `readStoryQuery`: `settle` (seconds, `?settle=N`, default null → the tune)
  and `first` (`?first=1`); the beats get `settle: arrives && phase == null ? (settle ?? STORY_SETTLE.seconds) : null`.
- `src/domain/story-beats.js`: the `settle` option (seconds or null): `early` off; `foundry` → `printing` with no order; `printing`'s
  emergency order at the settle's end (`api.pending`), `emergency` in `state()`; the tremor branch waits for the settle, the Rotor and
  `!api.shot?.()`; the settled breach quiet with the head start; the deploy's grant of the whole salvage (`advance`), the barrels granting
  nothing; `gunshipArrive` at the `settled` entry when construction is skipped on a growing base; `settle` and `settleLeft` in `state()`.
- `src/content/base-programme.js`: `gate` and `stalheart` `when: { phase: 'foundry' }`; `landing`, `foundry`, `solar` `board: true, first: true,
  when: { phase: 'foundry' }`, `foundry.pays: 60`. `src/fx/programme-host.js` `printed(step)`: `step.pays` granted (`eco.addBiomass`, category
  'grant').
- `src/content/build-board.js`: `BUILD_BOARD.first = { structures: { landing, foundry, solar }, words: { title, line } }`. `src/domain/build-board.js`:
  `firstOffers(w, tune) -> offers`: the Rotor sentry (`site: w.rotorCell`) unless `w.rotorBuilt || w.rotorPending`, then the `first` steps not
  done or bought, priced from `tune.first.structures`; `pickable`/`toggle` unchanged.
- `src/fx/build-board.js`: `show` takes the offers and the words; `apply` of a sentry with `o.site` orders there; `first(go) -> bool`
  (`show` with `firstOffers`, `n: 1`, the first words); `state().first` (true while the first orders are up), the history row `n: 'first'`.
- `src/fx/first-orders.js` (new, small): `createFirstOrders({ board, story, touring, pause, brief, acceptance, wanted })`, `tick()`: once, when the
  story runs a settle, the beats are past `landed`, `!touring()`, and (`!acceptance || wanted`): `pause(true)`, `board.first(go)`; `go` unpauses
  and says `scout_material`. Ticked from `storyApi.build()` after `colonyTick.open()` (one line in `src/td-tab.js`; the file stays ≤ 5,450 lines,
  no line over 500 chars). `storyApi.pending: (ci) => orderByCell.has(ci)` and `shot: shotActive` on existing lines.
- `src/isaobriefs.js`: `scout_material` (face 'focused'), `rotor_emergency` (face 'determined'), both `once: true`, COMMS · ISAO.
- Tests (node): `test/story-beats.mjs` (a settled opening: nothing spawns before the settle; the Rotor bought by the "player" (the fake's
  `order` from outside) ends `printing`; the emergency order at the settle's end, once, not when pending; the tremor waits for the shot; the
  settled breach's head start; `gunshipArrive` at `settled` when construction is skipped; a late start untouched), `test/story-beats-salvage.mjs`
  (the whole salvage at the deploy on a settled opening, nothing per barrel; today's drip without `settle`), `test/base-programme.mjs` (the three
  `first` steps' shape and `when`, the gate's and Stålheart's `when`, `pays`), `test/build-board.mjs` (`firstOffers`: the four cards, the Rotor's
  site, none when built or pending, the `first` prices, no `structures` entry for them; `BOARD_STEPS` updated), `test/story-query.mjs` or the
  story-world test (`settle`, `first`).
- Browser: a new `--settling` suite (`scripts/browser-test.mjs`): page 1 `index.html?sw=0&acceptance=1&cine=0&world=story&stage=1&grow=1&settle=12&first=1#td`:
  the arrival lands and the tour ends; the first orders open (`state().board.open && state().board.first`), paused, four offers
  (`sentry:rotor`, `build:landing`, `build:foundry`, `build:solar`) at their prices, the bank up by 180 from the page's start, no enemy on the
  field, the beats at `printing`; still `settling-board`; `board.toggle('sentry:rotor')`, `board.toggle('build:landing')`, `board.confirm()`: the
  bank down by 105, `programme.bought` has `landing`, Isao's `scout_material` on the panel, unpaused; the Rotor printed (`towers === 1`) with
  `story.emergency === false`; the gate printed; the Stålheart's print begins (`programme.active === 'stalheart'`); then the tremor
  (`story.said` has `tremor`), the breach, the override, the Rotor's seat (`seatKey === 'rotor'`), stills `settling-stalheart`, `settling-seat`.
  Page 2, `&settle=8&first=1`: the board skipped (`board.skip()`): no Rotor on the field until the settle; then `story.emergency === true`, the
  Rotor printed, the tremor after it. `--grow`'s opening rewritten to the settled order (with `&settle=10`, no `first`: the gate prints at
  `printing`, the emergency Rotor comes at 10 s, the Stålheart after the Rotor, the tremor path instead of the quiet breach, the pad only if
  bought — the grow page buys nothing, so its late checks on `landing` and `solar` go; sector 0 still plays there); `--opening-cuts` and
  `--story-world`'s opening pages add `&settle=10`; `--board` and `--landing` unchanged.
- `docs/STATE.md` (the opening's new order, the settle, the first orders, the sector-0 consequence as an owner call), a log entry
  (`node scripts/log.mjs add`), the 2026-11-07 landing spec's section 16 pointing here.

## 4. Not in this round

The scouting as play (the rover's trips to rock, crystals, liquid; the materials as currencies); a settle readout on the HUD (the first
contact's countdown); the first orders re-offered on a sector board; the Stålheart's print length; sector 0 re-timed to the new opening; the
KIDOU printing anything (spec 2026-11-07 base-from-scratch 2.D).

## 5. Open calls for the owner

- The settle's 120 s (the Stålheart stands at ~95 s on a bought Rotor; a 90 s settle would bring the first contact as the hull rolls out).
- The first orders' pool and prices (the Rotor 45, the pad 60, the foundry's work 40 paying 60, the array 120 against 96 / 180 / 240).
- Sector 0 not playing on the default opening (section D).
- The first orders only once: a pad or array not bought at the landing is never built on that run.
