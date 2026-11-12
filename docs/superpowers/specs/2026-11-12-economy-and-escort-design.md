# The flow of stages, the economy made to bind, and the tank escorting the rover (design, 2026-11-12, revised the same evening)

Written by the design agent from the owner's direction of 2026-11-12 (`docs/DECISIONS.md`): no start bank; Isao and the Stålheart build from
local resources; biomass bonds to itself, and what is not gathered seeps into the ground and is partly lost (the fiction for chain kills); the
automated gunship and SOL stay; "leaning towards the tank doing sorties and protection missions of the yushi-rover collecting biomass".

**Revised after the owner's review (2026-11-12, evening):** "sounds good about the economy. let's raise prices 10x not 20x, we will tune the
difficulty later, first we want the flow of stages." The economy is approved in direction; every re-based price below is now **x10** (the
first version said x20); a new first section lays out the run as a flow of stages; the build order puts the stages' hand-offs first and the
difficulty tuning last. Each call stays a line in `docs/DECISIONS.md` so the owner can overturn it. Nothing here is built.

## 0. The flow of stages

The whole run, in the order a player passes through it. For each stage: what he does, what he must have built or earned to reach it, what
it unlocks. **Exists** means it is in the game today (possibly in another place in the run); **new** means it is work. The colony's own stages
(the domes, the courts) are drawn in `docs/superpowers/specs/2026-11-12-colony-layout-design.md`.

| # | Stage | The player does | To reach it | It unlocks | Today |
| --- | --- | --- | --- | --- | --- |
| 1 | **The landing** | flies the SH02 down (or lets it land); a total CRASH ends the run | START | the salvage by grade (2,400 / 1,800 / 960 kg) | exists (CRASH merged today) |
| 2 | **The recon dog's survey** | Isao prints RECKON K9; the player drives it to three marked points | landed | 3 x 150 kg; the last point wakes the pack | new (being built, branch `recon-dog-opening`) |
| 3 | **First contact** | runs the dog home ahead of 12 whites and yellows | the third survey | the wall | new (same branch) |
| 4 | **The wall and the Rotor** | Isao prints the gate and walls, then the Rotor; the player takes the Rotor's seat and holds the first wave | the dog home | the first bodies on the ground | exists (the gate step, the gated Rotor opening), re-ordered by the dog branch |
| 5 | **The first harvest** | watches Isao print the depot, flag the bodies and send the rover; its gauge fills | the wave cleared | the first pour (~300 kg) | rover and depot exist; the depot after the first fight is new (dog branch) |
| 6 | **The first orders** | spends salvage + survey + harvest on two of four cards | the first pour | the pad, the foundry's work, the array or a second Rotor | exists (THE SETTLING's card); the second Rotor card and the prices are new |
| 7 | **The Stålheart** | watches Isao print it (75 s) while the Quiver's wave and sector 0 play; the hull is handed over | the first orders closed | the hull, the gunship's arm, sector 1 | exists (rail model); the wheeled KIDOU as the default is new |
| 8 | **Sectors 1-2: hold the lane** | fights pulses at the gate with the hull, the Rotor and bought sentries; flags bodies between pulses | the hull | the build board after each sector | exists |
| 9 | **The first domes** | buys a dome on the board, chooses its kind and its cell; the KIDOU drives out and prints it | the first board (before sector 2) | each dome's function (shells, the cavalry's radar, hull rebuilds, the farm, SOL's pace) | domes printed by Isao exist; kinds, cells and the KIDOU printing are new |
| 10 | **Rover sorties** | drops flares and escorts the rover beyond the walls while sentries and automation hold the gate | the depot, enough defence to leave the gate | income at full value; the flare stock restocked at base | rover and flares exist; the rover hunted and the escort are new |
| 11 | **The radar and the mech cavalry** | builds the RESEARCH dome; four Ridgebacks drop 8 days later | a RESEARCH dome (a choice: skipped, no cavalry) | the reinforcements, for the arena | exists (radar automatic at sector 2); as the player's choice it is new |
| 12 | **The catapult and the automated SOL** | after two manned SOL passes, buys the ARC-01 launcher; SOL-88 goes up and SOL fires on its own | sector 4, two manned passes, the card | SOL automated; the orbital works' collectors | exists |
| 13 | **The canyon** | sector 3 THE CANYON, the column under SOL's beam; again before the door | sector 3 | sector 4 THE PRESS, sector 5 THE SIDE WALL | exists |
| 14 | **The back door** | sectors 6-8: the feast, the scramble, sentries behind the bays | the mouth held | the back gate (its sockets) | exists |
| 15 | **THE ARENA and THE KING** | drives out to the tremor; the arena's creature, THE KING (a male by its chatter, so a Queen below), fought from the gunship's seat with the cavalry if called | the door sector secure | Isao's decoded chatter; BOTH WALLS; the descent's brief | exists (renamed today, captions); the re-made fight (tactical mechs, the two-action gunship seat) is new |
| 16 | **The cave and the Queen** | BELOW: Isao flies the descent; the Queen is killed in the nest | THE KING dead | the Dyson sphere's completion | the descent exists; the Queen and her kill are new |
| 17 | **The Dyson sphere finished** | the constellation finale: the planet connected to the sphere | the Queen dead | the walk | the finale animation exists (`src/fx/orbital-finale.js`); its place after the Queen is new |
| 18 | **Walking the finished base** | walks or drives the city he built (the space elevator standing at its entry, see the colony design) | the finale | a new run | new |
| 19 | **A new planet** | a new run on another generated planet | the walk | stage 1 again | the generator exists; the run-to-run hand-off is new |

What is still open in this flow is pacing between stages 8 and 15 (S1, the curve): it waits for this flow to stand, then is tuned.

## 1. What the code says today (this is where the documents disagree)

`docs/DECISIONS.md` E1 says "a sector earns 11k-78k kg while a structure costs 1,500-4,000". That is the round-6 ledger (2026-11-05), taken
before round 8 put kills on the ground. The code has moved on, and the code wins:

- A kill's kg are booked (the streak, the score, the ledger) but **lie on the ground** as a pile on the kill's cell once the depot stands
  (`src/fx/rover-glue.js` `payKill`, `src/domain/economy.js` `award(..., { hold: true })`). Only the rover's pour reaches the bank.
- The rover carries 6,000 kg a trip at 16 m/s, rakes 400 kg/s, pours 1,000 kg/s (`src/content/rover.js`). Measured on the classic base's
  473 m road: 31 s out, 30 s raking, 35 s back, 5 s pouring, about 63 kg a second at best.
- The `--ledger` probe with the rover (ideal defender, reference flagger) banked **1,031 / 12,086 / 24,186 kg** in sectors 1-3 (2,585 in
  sector 1 once the break settles the hold and the flagged ground), against **11,996 / 36,380 / 107,019 kg** laid on the ground. From sector 1
  on, the rover's trips, not the kills, set the income.
- Still on the old small scale is everything that predates the build board: the sentries' radial 45-260 kg (`src/towers.js`), upgrades at
  0.7x and 1.2x, the salvage 96 / 180 / 240 kg (`src/content/landing-game.js` `salvage`), the first orders 40-120 kg, the foundry's barrel
  60 kg, the farm's 40 kg a sector, the held breach's 40-60 kg (`src/content/sectors.js` `held`).
- The start bank is 170 kg (`GAME_START_BIOMASS`, `src/domain/campaign.js`) under the salvage, so the landing's grade barely matters.
- The rover cannot be hurt; it goes home from 6 bodies within 4 cells (`ROVER.retreat`). Nothing hunts it (`src/domain/soft-hunt.js`).
- Piles rot whole after 240 s untouched (`FIELD.decaySeconds`). At a sector's end the rover's hold **and every pile under a standing flare**
  are banked at once (`settleBreak`, `src/domain/rover-run.js`).
- The streak is +0.05 a kill to x3, reset by a leak (`src/domain/economy.js`); in a crowd it reaches x3 in 40 kills and stays.

## 2. The calls

### 2.1 Kill pay (E1): kill pay stays; the old small prices rise ten times (owner, 2026-11-12: 10x, not 20x)

Bounties and `KILL_PAY` (tank 1.0, tower 0.5, strike 0.5, ram x1.25) do not change. Everything still priced on the small scale is
multiplied by 10:

| Constant | Today | Called (x10) |
| --- | --- | --- |
| Sentries, `src/towers.js` `cost` (Rotor, Plasma, Quiver, Relay, Mortar, Lancer, Needle, Heptapod) | 45, 80, 90, 100, 110, 130, 220, 260 | 450, 800, 900, 1,000, 1,100, 1,300, 2,200, 2,600 |
| Salvage, `LANDING_GAME.salvage` `feedstockPerBarrel` (CLEAN and HARD / WRECK) | 60 / 48 | 600 / 480 |
| Salvage by grade (CLEAN 3 sections + 1 bonus barrel, HARD 3, WRECK 2) | 240 / 180 / 96 | 2,400 / 1,800 / 960 |
| The barrel, `src/content/foundry.js` `feedstockPerBarrel` | 60 | 600 |
| The foundry's work pays back, `base-programme.js` `pays` | 60 | 600 |
| A held breach, `src/content/sectors.js` `held.kg` (sectors 1-5 and later) | 40, 45, 50, 55, 60 | 400, 450, 500, 550, 600 |
| The farm (now the BIOSPHERE dome), `BASE_PERKS.farmKg` | 40 a sector | 400 a sector |
| A skipped opening, `STORY_SKIP.biomass` | 450 | 2,000 |
| Survey pay, a point (recon dog) | 30 | 150 (x5, see 2.7) |
| THE FIRST ORDERS: pad, foundry's work, array; a second Rotor | 60, 40, 120; (none) | 600, 400, 1,200; 450 |

**Why kill pay stays.** Cutting kill pay to a twentieth (E1's remedy, computed before the rover) would make the kills the limit again and
leave the rover nothing to fetch. The board's prices were re-based on a ledger; the sentry radial and the opening never were. The factor is
the owner's (10x); at 10x the cheapest sentry (450) is a third of the cheapest board card (1,500) and the dearest (2,600) about the
fabrication dome's base price. Difficulty is tuned later, against the measure in step 9 of section 4.

**Proven wrong if** the afford ratio (2.2) lies over 70 % or under 30 % in sectors 1-3; the owner has said that tuning comes after the flow.

### 2.2 The constraint target (E2)

Read off the `--ledger` probe (`ecoAffordT` and `ecoClockT` already exist in `src/td-tab.js`):

1. The bank affords the cheapest sentry the player can still build (under the cap) for **40-60 % of the fighting time** in sectors 1-3.
2. At each board before sectors 2, 3 and 4, the reference bank buys **one** mid-priced card (2,800 kg times that board's index) plus a
   sentry, **not two** mid cards.

Why: the first is the only definition the code already measures; the second makes the board's two picks a choice.

### 2.3 The streak (E5): unchanged in numbers, told as bonding

The step (0.05), the cap (x3) and the reset on a leak stay; no spatial second step. Isao calls it bonding. The spatial half of the fiction
is carried by the piles themselves through seepage (2.6). Why: in a crowd any kill counter saturates at x3 inside a minute, and with the rover
limiting income the streak's effect on the bank is small either way. Alternative: the economy plan's 0.04 step plus a second step for a kill
within 2 cells of the previous one.

### 2.4 The sentry cap (E3): 6, plus 2 and 2 from the colony

Isao keeps **6** sentries running at the start; **+2** with a FABRICATION dome, **+2** with a LOGISTICS dome (the colony design). Ten is the
ceiling. On `?base=classic` the assembly line and the armory give the +2 each. The refusal reads the live cap. Why: six mid sentries cost
about 6,000-7,500 kg at 10x, roughly half of sector 2's income, so the cap binds from about sector 2-3, when the colony's first choices
are open, and it makes two dome kinds economic. Alternative: the flat 10.

### 2.5 Upgrades and refunds (E4)

Upgrades cost **0.8x** then **1.5x** of the sentry's base price (today 0.7x and 1.2x); selling refunds **60 %** (today 75 %). A Heptapod
at level 3 is then 2,600 + 2,080 + 3,900 = 8,580 kg.

### 2.6 The rover loop is the income

**Trip size: unchanged.** 6,000 kg a trip, 16 m/s, 400 kg/s rake, 1,000 kg/s pour, 3-cell reach. They are measured and they are the
income's clock. The road from the new depot (the colony design's cargo court, beside the gate) is unmeasured; step 9 reads it.

**Seepage replaces the rot (new rule, `src/domain/biomass-field.js` `tick`).** A pile loses `max(0.5 kg, kg / 400)` every second: under
200 kg a flat 0.5 kg/s (a lone 6 kg kill gone in 12 s, a 50 kg pile in 100 s); over 200 kg a quarter of a percent a second (half in about
4.6 minutes). `FIELD.decaySeconds` goes; the ledger gains `seeped`. Why: the owner's sentence as a rule; a bonded pile keeps a larger
share than a lone kill. Proven wrong if the reference flagger without escort loses under 40 % or over 60 % of what is laid in sectors 1-3.

**The break banks half the flagged ground.** At a sector's end the rover's hold is banked as today; piles under standing flares at **50 %**
(`settleBreak` gains `breakShare: 0.5`). Why: banking it all for free made the trip, and the escort, pointless at every sector's end.

**Kills lie on the ground from the story's first kill**, not from the depot's perk: the first harvest is the Rotor fight's bodies.

**What threatens the rover (new rule).** Outside the walls the rover is a hunt goal for whites and yellows: `huntGoal` chooses hull, rover
or gate by walking distance, the hull keeping its 2-cell bias. Bodies that choose the rover ring round it with the hull's ring and jab
(`SOFT_HUNT` ring 1.2 cells, a jab every 3.6 s); **each jab's peak eats 100 kg from its hold** (lost). The retreat stays at 6 bodies within 4
cells. **No hit points; it cannot be destroyed.** A callout ROVER UNDER ATTACK (at most every 15 s), Isao's `rover_bitten` the first time.
Why: the soft hunt and its ring exist; five bodies eat about 140 kg a second, about 4,200 kg of a trip over the 30 s it rakes, while the
rover outruns them home (16 m/s against their ~3). No wreck: no rebuild flow, no friendly-fire rule. Alternative: hit points and a wreck
rebuilt for 3,600 kg.

**The escort.** The tank drops a flare where the bodies lie (F), drives out with the rover and stays near it; the hull outranks the rover in
the hunt, so it draws the hunters off; its kills pay full and fall in the rover's reach. A sortie is the stock of **4 flares**, restocked at
the base (the gantry, the garage, the LOGISTICS dome's pad). Escorted, the rover rakes through a pulse; unescorted, only in the breaths. The
gate is then held by sentries, the Rotor and the automation alone (towers alone lose sector 1 at about 61 s, F1), so early sorties fit only
in the breaths, and every sentry, the automated SOL and the automated gunship buy time away from the gate: defence pays for sorties, sorties
pay for defence. Proven wrong if the escort ledger does not bank 1.5 times the no-escort ledger in sectors 2-3.

**The pearls' cap (E8): unchanged.** 36,000 kg in three pearls, a fourth on the board (2,000 kg, +12,000).

### 2.7 The first minutes, with no start bank

The order is the recon dog opening's (`docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md`). The Rotor is Isao's, free.

| Source | CLEAN | HARD or automatic | WRECK |
| --- | --- | --- | --- |
| Salvage at the deploy | 2,400 | 1,800 | 960 |
| Survey, 3 points x **150 kg** | 450 | 450 | 450 |
| First harvest: the Rotor fight's 62 bodies after seepage (estimate; kill pay is unchanged) | ~300 | ~300 | ~300 |
| **Bank at THE FIRST ORDERS** | **~3,150** | **~2,550** | **~1,710** |

A total CRASH ends the run. `GAME_START_BIOMASS` is 0 on the story's start (the TD tab and the simulator keep theirs). The survey is x5,
not x10: the three points together (450) stay under the gap between two grades (600 and 840), so the dog's walk is a nudge, not a grade.

**THE FIRST ORDERS** opens when the first harvest has been poured. Two picks from four cards:

| Card | Price | What it gives |
| --- | --- | --- |
| LANDING PAD | 600 | the pad on the SH02's ground |
| SEED FOUNDRY | 400 | Isao works the AFR-01: one more barrel, **+600** when it stands |
| SOLAR ARRAY | 1,200 | the hull's shield charges on its island |
| SECOND ROTOR | 450 | a second Rotor on the wall's other socket (new card; the radial's price) |

The pairs cost 850 to 1,800. What is left for sector 1's sentries: CLEAN 1,350-2,300 (three to five Rotors), HARD 750-1,700 (one to
three), WRECK 0-860 (none or one; a WRECK cannot take the pad with the array). The grade carries into the first fight.

**Isao's exposition** (captions, unrecorded): `no_bank` "We brought nothing to build with. The Stålheart prints from what this planet gives
us." · `biomass_bonds` "Their tissue is the best feedstock I have seen. It binds to itself: kill them close together and it holds." ·
`biomass_seeps` "What we leave lying seeps into the ground. The rover brings it in; what it does not reach, we lose."

### 2.8 The board's index

`BUILD_BOARD.index` becomes **[1, 2, 4, 4.5, 5]** (today [1, 2.2, 5.5, 6, 7], from the pre-rover ledger's income ratios), re-derived in
step 9 by round 6's own rule (the income of the sector before each board over sector 1's, smoothed). It does not depend on the 10x: the
rover flattened income from sector 3 on (12,086 to 24,186, x2, where the old ledger went x2.9).

### Not called here

E6 (who earns what): with the rover as the bottleneck it barely moves income. E11 (close early or hold): only re-scaled. E9, E10: the colony.

## 3. What changes, in one list

Content: `src/towers.js` costs and `upgradeCost`; `src/domain/economy.js` `REFUND_FRACTION`; `GAME_START_BIOMASS` on the story start;
`src/content/landing-game.js` salvage; `src/content/foundry.js`; `src/content/base-programme.js` `pays`, `BASE_PERKS.farmKg`, a new
`BASE_PERKS.sentryCap`; `STORY_SENTRIES.cap` 6; `src/content/sectors.js` held kg; `STORY_SKIP.biomass`; `src/content/build-board.js` first
orders, the second Rotor card, the index; the dog scout's survey pay; `src/content/rover.js` `FIELD.seep { floor: 0.5, share: 1 / 400 }`,
`ROVER.threat { bite: 100, every: 15 }`, `ROVER_WORDS.bitten`. Rules: seepage, `breakShare`, a `bite(kg)` on the run, the rover as a hunt
goal, kills held from the first kill, a pure `sentryCap(perks)`.

## 4. Build order: the stages' hand-offs first, the tuning last

The owner's priority is the flow of stages. Steps 1-6 make each stage hand to the next; 7-9 make the economy bind; tuning follows the
measure. The opening's steps wait for the recon dog branch to merge (it owns those suites).

1. **The opening hands off without a bank (stages 1-6).** After the dog merge: `GAME_START_BIOMASS` 0 on the story start, the salvage by
   grade, survey pay, kills held from the first kill, the first orders opening on the first pour, the four cards at their prices, Isao's three
   lines. Browser `--dog-scout`, `--landing` (salvage by grade), `--chapters`, `--skip-tutorial` (`STORY_SKIP` 2,000).
2. **The Stålheart is the KIDOU and the domes are chosen (stages 7, 9).** The colony design's stages 1-3 (the KIDOU default, the plan, the
   kinds and the colony row), Isao still printing the domes. Browser `--story-world`, `--board`, `--colony`, `--dome-print`.
3. **The radar is a choice (stage 11).** The RESEARCH dome starts the reinforcements' clock; without it none come, and the arena runs without
   them (check its waits). Browser `--board` (RESEARCH bought, the Ridgebacks' day set), the arena's suite with and without.
4. **The rover sortie (stage 10).** The rover hunted and bitten; the escort. `test/soft-hunt.mjs`, `test/rover-run.mjs`; browser `--rover`
   gains an unescorted page (bitten, it retreats, home under 4,500 kg) and an escorted one (the harness parks the hull at the flare; home over
   4,500 kg).
5. **The ending's order (stages 15-19).** THE KING's kill hands to the descent; a Queen in the cave (design to come); the finale after her
   death; the walk; a new planet. This step is a design of its own (the cave and the Queen are not designed yet); listed so the flow has its
   end.
6. **The KIDOU drives and prints (stage 9 complete).** The colony design's stage 4.
7. **The price table** (content only): sentries x10, upgrades 0.8x / 1.5x, refund 60 %, held pay, farm, the index. `npm test` re-pins;
   browser `--board`, `--colony`, `--debrief`.
8. **The cap and seepage.** `sentryCap(perks)` (6, 8, 10), seepage, `breakShare`. `test/biomass-field.mjs`, `test/rover-run.mjs`; browser
   `--rover`, `--ledger`.
9. **The measure.** `--ledger` gains an escort policy beside today's flagger. Read banked, laid, seeped, lost, the afford ratio, the bank
   at each board, the road's length. Set the index; check 2.1, 2.2, 2.6 against their "proven wrong" lines. Difficulty tuning starts here.

## 5. Risks

- Sector 1 gets harder: a player who filled ten sentries for ~1,000 kg now starts with the Rotor, perhaps a second, and one to five bought.
  The tank must fight sector 1 (F1); run `--sector-probe` on sector 1 with the new bank.
- Many suites pin prices and the 170 kg start bank; expect re-pins, not bugs.
- The rover as a hunt goal changes where whites and yellows walk; re-read `--pearl-story` and the soft-hunt suites, do not re-pin blindly.
