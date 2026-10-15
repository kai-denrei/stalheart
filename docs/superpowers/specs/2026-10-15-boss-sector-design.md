# THE BOSS sector — design

Owner, 2026-10-15: "next we will investigate how to bring in this boss fight; /Users/minikai/Dev/stalheart-cutis-boss, replacing ISAO as a lure,
with ISAO-Controlling the Tank as lure, while we control the Gunship. (Actually we could make it a funny choice; ISAO offering to either drive
the tank, or let the gunship on autopilot. they land on the idea that since it's a new target, a round of manual-override of the gunship is
needed. This Boss fight will be somewhere around round 8."

The Cutis-Maku boss scenario (branch `cutis-boss`, merged into main; spec `2026-10-12-cutis-maku-boss-design.md`) lives in the boss lab
(`labs.html?creature=cutis#boss`, `src/labs/boss/cutis-scenario.js`): Isao the drone as the bait, the player in the game's gunship seat
hosted by the lab. This design brings that fight into the campaign as a sector, with the TANK as the bait.

## What exists that this builds on

- **The Cutis bodies already run in the story** through the creature seam (`src/fx/creature-cutis.js`, `?creatures=cutis:<tier>`), the huge
  tier `CUTIS-MAKU` (r0 20 m, hp 60) among them. A boss record is a story enemy with a body, the game's own damage, kill, bounty and card.
- **The hunters (2026-10-15-hunters-first-version)**: a record marked `hunter` walks the exits nearer the tank by a distance field from the
  tank's cell (`src/domain/hunters.js`, `src/fx/enemy-step.js huntField`). The boss and its wave are hunters.
- **The hull's autopilot** (`src/fx/hull-drive.js chooseNext`): `params.directive = 'avoid'` with `autoMode` on flees the nearest live enemy
  within 14 cells, on the cell graph, off the sinkholes. Isao driving the tank IS the hull on `avoid`.
- **The gunship seat and its autopilot** (`src/sentry-pilot.js`, `src/fx/gunship-rig.js`, `src/fx/gunship-auto.js GUNSHIP_AUTO`): the strip's
  GUNSHIP button takes the seat; `story.gsAuto` is the switch the ARC-01 step throws.
- **A special sector** is a row over SECTOR_HOLD slotted by `sectorDef` (`src/domain/sectors.js`: the door at `doorAt`, BOTH WALLS at
  `doorAt + 1`, the canyon again at `doorAt - 1`) and a run module the sector loop calls through `storyApi` (`src/fx/canyon-run.js` is the
  model: a plan, a pass, a cut; `src/fx/sector-run.js` the phases).
- **The lab's rules worth carrying**: the boss's health 180 (`CUTIS_BOSS`), the wave of 20 small ones first, the phase damage multipliers
  (`CUTIS_HITS`: full while it reaches, half at rest, none through the transfer), the fear per gun and the MK-9's stun
  (`src/domain/boss-temperament.js`, `src/labs/boss/fear.js`). v1 carries the health, the wave and the phase multipliers; fear and stun are
  a second pass (the family's bodies have `hold` and a pace already, so the hooks exist).

## Decisions (the owner's words, and the assumptions made for tonight; each assumption is a knob or one line to change)

1. **Where: `doorAt + 1`, between THE BACK DOOR and BOTH WALLS**, which moves to `doorAt + 2` and stays the final sector. With the door at 7
   or 8 the boss is at 8 or 9 ("somewhere around round 8"). The alternative, before the door (at `doorAt - 1`, displacing the canyon again to
   `doorAt - 2`), is one line in `sectorDef`.
2. **The lure is the tank on autopilot** (`autoMode` on, `directive 'avoid'`) for the whole sector, Isao's drone docked over the hull
   (his model following the hull's position at his altitude, propellers on: he is "driving"). The player cannot drive while the sector runs
   (the keys are the seat's). The hull takes the boss's touch damage as any hard core's; the hull lost is the sector lost as any sector.
3. **The player is the gunship, manual override**: the sector opens with the funny choice (below), and whichever the player picks the
   outcome is the seat: `gsAuto` off for the sector (the autopilot resumes after), the strip's GUNSHIP lit and taken through the existing
   entry (`installPilot('gunship')`), no briefing (seen by then). SOL-82 stays available as in any late sector (`laser: true`); the MK-9 is
   the seat's own.
4. **The funny choice**: a card with two buttons over the paused game at the sector's brief — Isao: "New contact. Big. Two ways: I drive the
   tank and keep it busy, or I put the gunship on autopilot and you drive." Button A "YOU DRIVE THE TANK" → Isao: "Then it's me in the hull.
   Gunship is yours: new target, manual override." Button B "GUNSHIP ON AUTOPILOT" → Isao: "The autopilot has never seen this one. Manual
   override, you. I'll drive." Both land in the seat with Isao in the hull. The lines are captions until the owner records them (the voice
   project's section 16, listed in the plan); the card is `src/fx/choice-card.js` (new, the debrief's panel markup).
5. **The fight**: the boss's sinkhole opens on the gate lane at the sector's start (one breach, `breaches: { gate: 1 }`); the wave comes
   first — 20 `cutis:small` hunters at `CUTIS_WAVE.health` 20 hp — then the boss, one `cutis:huge` record at `CUTIS_BOSS.health` 180,
   hunter, cored, its speed the huge tier's. The sector is SECURE when the boss is dead (the books: the breach's waves are the wave and the
   boss, 2 planned). The phase multiplier applies to every hit on a Cutis record (`damageEnemy` × `CUTIS_HITS` by the body's phase, read from
   the family: `phaseOf(record)`), with the lab's "absorbed" flash for a transfer hit (`src/labs/boss/cutis-flash.js` reused).
6. **The bar**: the integrity strip gains a boss row (`CUTIS-MAKU` 180/180, the gate-row markup, `ih-low` under a quarter) while the boss
   lives; the wave shows as `WAVE · CUTIS n/20` in the same row before it.
7. **Isao's lines** (captions first): `boss_choice` (the offer), `boss_tank` and `boss_auto` (the two replies), `boss_rises` ("That is not
   a wave."), `boss_hit_me` (the hull touched: "It's got a hold of the hull!"), `boss_dead` ("Target down. I need a car wash."). The bait lab's
   `bait_*` lines are Isao-as-drone's and are not reused.
8. **Out (this round)**: fear and stun from the player's guns on the boss (the second pass), the lab's arena obstacles, the Nih-Dairia as an
   alternative boss, a boss-specific death carcass (the puddle is the family's death), the tank's cannon used by Isao (he drives, he does not
   shoot), difficulty tuning (the owner's playtest: health, count, the sector's threat).

## Components

| Piece | Where | Responsibility |
| --- | --- | --- |
| `BOSS_SECTOR` row | `src/content/sectors.js` | name THE BOSS, shape pulse (one breach, two waves: the wave, the boss), `boss: true`, flags (laser true, gunshipCall true, backDoor false), brief lines, `wave: { count: 20, tier: 'small', hp: 20 }`, `boss: { tier: 'huge', hp: 180 }`, `choice` texts, `held` |
| `sectorDef` | `src/domain/sectors.js` | slot THE BOSS at `doorAt + 1`, BOTH WALLS at `doorAt + 2`; `finalSector` in sector-run follows (`doorAt + 2`) |
| `src/domain/boss-sector.js` (new, pure) | domain | `bossWaves(row)` the two queue plans (the wave entries, the boss entry) with `hunter: true`, `tier`, `spec` overrides (hp); `bossPhaseMultiplier(phase, CUTIS_HITS)`; `bossDone(enemies)` |
| `src/fx/boss-run.js` (new) | fx | the sector's run: the choice card at the brief, the hull on `avoid` + Isao docked, `gsAuto` off, the seat taken, the bar row, the lines; restores everything at the sector's end (`restore()`); `state()` for the harness |
| `src/fx/choice-card.js` (new) | fx | a paused modal with a line and two buttons; `show({ line, a, b }) -> Promise<'a'|'b'>` |
| `src/fx/sector-run.js` | fx | at `begin` of a `boss` row: `api.bossBegin?.()`; the wave hook marks the two waves; at SECURE/LOST: `api.bossEnd?.()`; `finalSector = doorAt + 2` |
| `src/fx/creature-enemies.js` | fx | `phaseOf(e)` (the Cutis family's body phase for a record), the hit multiplier applied in `hit(e, src, dmg)`'s caller (`damageEnemy` reads `creatures.damageScale(e)` before applying) |
| `src/fx/creature-cutis.js` | fx | `phase(handle)` from the kit's swarm (the lab reads it the same way) |
| `src/td-tab.js` | controller | wire `bossRun` into storyApi (`bossBegin`, `bossEnd`), the host literal; `damageEnemy` × `creatures.damageScale(e)` |
| voice | `~/Dev/seiyu_voice/ISAO-VOICE-LINES.md` section 16 | the six triggers' texts for the owner to record; `src/content/isao-voice.js` gets them on import |
| tests | `test/boss-sector.mjs`, `test/sectors.mjs` (the slot), `test/sector-run.mjs` (the boss row's books), browser `--boss-sector` | |

## Data flow

1. `sector-run.begin(n)` → `sectorDef` returns the BOSS row (`boss: true`) → the card and brief as any sector → `api.bossBegin()`.
2. `boss-run.begin()`: pause; `choiceCard.show(...)` → the reply caption; unpause; `setAutoMode(true)`, `params.directive = 'avoid'`;
   Isao docked (his worker's order book paused, his drone's position each frame = the hull's + altitude); `story.gsAuto = false`;
   `installPilot('gunship')` once the gunship is on station (`gunshipRig.call` filled by the sector's `gunshipCall`, as the back door does;
   if it is not overhead yet the strip's button lights when it is and the run takes the seat then).
3. The breach opens (the sector's one gate breach, as any pulse sector); `sendWave` → the wave hook gives `bossWaves` for wave 1 (20 small
   hunters, hp 20) and wave 2 (the boss, hp 180); the breath rule sends wave 2 when the wave is mostly dead (the row's `breath`).
4. The bodies hunt the tank (`huntField`), the tank flees (`avoid`), the player shoots from the seat; every hit on a Cutis record is scaled by
   its phase; the bar row follows the boss's hp.
5. The boss dead → the sector's SECURE as usual (the debrief) → `api.bossEnd()` restores the hull to manual, undocks Isao, `gsAuto` back to
   what it was, leaves the seat if still in it. The hull destroyed → LOST as any sector → `bossEnd` the same.

## Testing

- Node: `boss-sector.mjs` (the two plans' counts, tiers, hp and the hunter mark; the multiplier by phase; done), `sectors.mjs` (the slot:
  with doorAt 7 the sectors are 7 door, 8 boss, 9 both; the canyon again stays at 6), `sector-run.mjs` (the boss row's two waves and
  SECURE on the boss's death).
- Browser `--boss-sector`: `?skip=defence&sector=<doorAt+1>` with a late start that decides the door (`SECTOR_DOOR.earliest`), the choice
  card up and clicked, the hull on auto, the seat taken, 20 small bodies then the huge one up (`creatureProbe` counts by tier), a scripted
  burst of the 40 mm at the boss (`fireRound` through the seat's bag as the gunship-auto test fires), its hp down by the phase rule
  (the multiplier shows in `killsBySrc`/the boss row), the sector SECURE once the harness kills it (`damage` hook), the hull back to manual.
- The frame: one huge Cutis body is one instance of the kit's swarm (the lab draws the 20 + 1 at 60 fps); the probe `?creatures=cutis:huge&ramp=1`
  measured it on 2026-10-12. No new renderer.
