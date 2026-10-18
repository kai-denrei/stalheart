# THE ARENA — the Nih-Dairia boss far from the base — design

Owner, 2026-10-16 (third round, notes 7, 11 and 12): "sector 9 wave cutis; there was a misunderstanding, the set-up is supposed to be a giant
opening very far from the base, with a giant Nih Daira creature. /Users/minikai/Dev/stalheart-cutis-boss, that is the premise we tested here.
The 'autopilot' will be Isao driving around and avoiding both the monster and friendly fire, as the user shoots from above in a longer gunship
session." "The BOSS didn't work yet, Nih-Daira, and the Descent mostly worked, but both should have their place on the planet. Dedicated spot on
the planet." "Create an ARENA far away from the base; the story is some small REEDs and small NiDaira emerge here and there in the early waves,
new type of enemies… then a GIANT ONE emerges, we decide that it absolutely cannot get close to the base, so we need to team-up; the tank acts
as LURE, while the gunship fires from above."

THE BOSS sector of 2026-10-15 (spec `2026-10-15-boss-sector-design.md`: the Cutis-Maku and twenty small Cutis up the gate lane, the tank on
`avoid`, the player in the gunship) was the wrong creature in the wrong place. This design keeps its machinery (the row, the choice card, the
run module, the phase scale, the hunter plans, the strip row, the harness) and changes what it is about.

## Decisions

> **Third version (2026-10-16, evening; owner: "a message to go investigate a different tremor somewhere far… we reach the beacon with the tank… it opens up,
> phase 1 the player controls the tank as the gunship helps with the reeds (avoid and shoot with shells), then phase 2 the monster is too enormous… Being
> bait is the only way… Now we FORCE the player to take the gunship. Isao quips 'I am the better driver, I'll lure it'"): decision 4's choice card is
> gone. The sector's brief sends the player to a tremor far out (`storyApi.tremor` at `story.arena.cell`); the arena's breach opens once the hull is within
> `ARENA.reachCells` of the cell (`api.arenaDue`, src/fx/sector-run.js; the `ARENA.waitMax` fallback, 150 s after the start, was removed on 2026-10-18, owner's note 6: "waiting for the tank to be physically there, is what triggers the Boss"); phase one the player drives and shoots the
> small Reeds and the pups while the gunship flies itself overhead (`story.gsAuto`, its call refilled off station); phase two, as the Nih-Dairia rises,
> Isao takes the hull on the `lure` directive, the gunship's autopilot is turned off and the player is put in its seat once the gunship's track is over the
> arena (`ARENA.seatCells`) or `ARENA.seatWait` seconds later. Lines: `arena_open`, `arena_force` (src/isaobriefs.js). The same spot is the stage for the
> boss and the cave (decision 6). Everything below that speaks of the choice card reads with this note.

1. **The arena is a place on the planet**: one cell far from the base — the farthest band of the cell graph that is reachable and outside
   the walls (`SECTOR_PLACEMENT.arenaHops` below the farthest hop count) — fixed for the run the moment the story world is built
   (`story.arena = { cell }`, src/platform/story-world.js, by the same field the sector loop places breaches with). Its opening is a
   GIANT sinkhole (`ARENA.craterRadius` 3 cells; the breach adapter already opens a hole of a given radius: the boss lab opened two cells)
   that opens when THE ARENA sector begins and stays open: it is the nest's mouth, and THE DESCENT goes down it (decision 6).
2. **THE ARENA sector replaces THE BOSS** at the same slot (`doorAt + 1`; BOTH WALLS stays at `doorAt + 2`): `ARENA_SECTOR` in
   src/content/sectors.js, `boss.family 'reed'`, the wave `{ tier 'small', count 12 }` (small Reeds) and `{ tier 'pup', count 6 }` (the
   small Nih-Dairia, decision 3) as hunters, then the boss `{ tier 'huge' }` — the NIH-DAIRIA (`CREATURE_TIERS.reed.huge`, r0 20 m) at
   `hp 180`. One breach, the arena's (`breaches: { arena: 1 }`: a new side kind the sector loop places on `story.arena.cell`). The phase
   scale (`creatures.damageScale`) stays the Cutis family's; a Reed takes full damage (the family has no phases yet).
3. **A new tier: the pup**. `CREATURE_TIERS.reed.pup` { label 'NIH-DAIRIA · PUP', r0 3.5, hp 6, speed 0.42, variant 'nih-dairia' }: the
   boss's own cage at a sixth of its width, a hunter. "New type of enemies" in the early waves: HUNTERS (src/content/creature-enemies.js)
   gains a `mix` ([reed:small, reed:pup]) that alternates from `from` (sector 5): "small REEDs and small NiDaira emerge here and there".
   The ramp test's four-key assumption becomes "at least the four".
4. **The lure**: a new drive directive `lure` (src/fx/hull-drive.js chooseNext; the rule pure in src/domain/lure.js): with a target cell
   (the arena) and a quarry (the boss record, or the nearest hunter until it is up), the hull goes TOWARD the arena while the quarry is
   farther than `LURE.far` cells, kites AWAY while it is nearer than `LURE.near`, and otherwise circles it (the tangent); and it never
   walks into a cell inside `LURE.blast` cells of a danger point: the MK-9's painted or falling cell, SOL's painted cell, a Bofors shell's
   target (the gunship rig's `heavyState().ci`, the laser station's target, `G.state.rounds` of the bofors) — "avoiding both the monster and
   friendly fire". Isao drives the hull on `lure` for the sector (boss-run sets `params.directive = 'lure'`, the autopilot re-asserted each
   frame as today); the choice card stays as it is.
5. **The player's session is long**: the gunship's call meter is filled at the sector's start as today; its track already steers to the
   breach with bodies round it (src/domain/gunship-track.js breachLoads), so it flies the 40-odd cells out to the arena by itself (about
   35 s at GUNSHIP_TRACK.speedCells) and loiters there; the seat is taken as today. The session ends with the boss (SECURE) or the hull
   (LOST). Isao's lines: `boss_rises` becomes "That is not a wave. That is the nest's mother.", `boss_hit_me` and `boss_dead` stay, a new
   `arena_lure` ("I'll take it for a drive. Keep your rounds off the hull.") at the seat's first shot.
6. **THE DESCENT's place**: the descent brief says the nest is under the arena's opening ("The nest is under that hole in the arena. I go
   down it."); the host first pans the camera to the arena's cell (the showcase look, 3 s) and then opens the cave. One line in the brief,
   one call in the host; the cave's own sinkhole stays its own.
7. **Out**: the Nih-Dairia's fear and stun from the player's guns (the boss lab's temperament; a later pass), the Cutis boss (the row is
   gone; the family's phase scale stays for the Cutis records the waves still bring), a carcass, difficulty beyond the counts above,
   the arena's obstacles (the lab's rocks), SOL's beam steering the boss.

## Components

| Piece | Where | Responsibility |
| --- | --- | --- |
| `story.arena` | src/platform/story-world.js | the arena cell: the farthest reachable outside cell band, picked once with the world's rng; `?arena=<cell>` overrides |
| `ARENA_SECTOR` | src/content/sectors.js | the row (replaces BOSS_SECTOR): name THE ARENA, `breaches: { arena: 1 }`, `boss: { family: 'reed', waves: [{ tier: 'small', count: 12, hp: 4 }, { tier: 'pup', count: 6, hp: 6 }], boss: { tier: 'huge', hp: 180 }, choice }`, `arena: { craterRadius: 3 }` |
| `CREATURE_TIERS.reed.pup`, `HUNTERS.mix` | src/content/creature-enemies.js | the pup tier; the hunters' alternating mix |
| `src/domain/boss-sector.js` | domain | `bossWaves(row)` takes `boss.waves[]` (two wave plans before the boss: 3 plans) |
| `src/domain/lure.js` (new, pure) | domain | `lureStep({ hull, quarry, arena, dangers, dist }, LURE) -> 'toward' | 'away' | 'tangent'`, `dangerCells(points, centers, radius)` |
| `src/fx/hull-drive.js` | fx | the `lure` directive: toward/away/tangent on the cell graph, danger cells excluded |
| `src/fx/sector-run.js` | fx | the `arena` side: the breach on `story.arena.cell` with the row's crater radius, kept open at SECURE (not sealed) |
| `src/fx/boss-run.js` | fx | directive `lure` with the arena cell and the quarry; the danger points from the rigs each frame; the new lines |
| `src/fx/descent-host.js` | fx | the pan to the arena before the cave |
| `src/td-tab.js` | controller | `story.arena` into the sector loop's field and boss-run's host; the harness `state().arena` |
| tests | `test/lure.mjs`, `test/boss-sector.mjs`, `test/sectors.mjs`, browser `--arena` (the old `--boss-sector`), `--boss-start` | |

## Data flow

1. The world is built → `story.arena.cell` chosen (far band, outside, reachable).
2. Sector `doorAt + 1` begins → the ARENA row → the choice card → `place()` opens the arena breach (radius 3) on the arena cell → `bossBegin`:
   `params.directive = 'lure'`, the lure's target = the arena cell, Isao docked, the call meter full, the seat taken when overhead.
3. The breach sends wave 1 (small Reeds, hunters), wave 2 (pups), then the boss, by the row's breath. They hunt the tank; the tank lures.
4. Each frame boss-run hands the drive the danger points (the painted/falling MK-9 cell, SOL's cell, Bofors targets); the lure keeps out of
   their blast and keeps the quarry between `near` and `far`.
5. The boss dead → SECURE; the arena hole stays open (the nest's mouth). `bossEnd` restores the hull.
6. BOTH WALLS secured → the descent: the brief, the pan to the arena, the cave.

## Testing

- Node: `lure.mjs` (toward beyond far, away within near, tangent between, a danger cell never chosen), `boss-sector.mjs` (three plans: 12
  small, 6 pups, the boss; tiers and hp), `sectors.mjs` (the slot unchanged), `story-world` (the arena cell: outside, reachable, far).
- Browser `--arena`: `?skip=defence&sector=<doorAt+1>&boss=1`: the choice, the hull's directive `lure`, the arena breach's cell equals
  `state().arena.cell` and its radius 3, the gunship on station over it within 90 s, the small Reeds then the pups then the huge one up,
  the harness kills the boss → SECURE with the hole still open, the hull back to manual.
