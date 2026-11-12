# The economy made to bind, and the tank's new job: escorting the rover (design, 2026-11-12)

Written by the design agent while the owner was away, from his direction of 2026-11-12 (`docs/DECISIONS.md`, both sets of answers): no start
bank; Isao and the Stålheart build from local resources; biomass bonds to itself, and what is not gathered seeps into the ground and is partly
lost (the fiction for chain kills); the automated gunship and SOL stay; "leaning towards the tank doing sorties and protection missions of the
yushi-rover collecting biomass". Every call below is listed again in `docs/DECISIONS.md` under "Called by the design agent on 2026-11-12", one
line each, so the owner can overturn any of them in one line. Nothing here is built.

## 1. What the code says today (this is where the documents disagree)

`docs/DECISIONS.md` E1 says "a sector earns 11k-78k kg while a structure costs 1,500-4,000". That is the round-6 ledger (2026-11-05), taken
before round 8 put kills on the ground. The code has moved on, and the code wins:

- A kill's kg are booked (the streak, the score, the ledger) but **lie on the ground** as a pile on the kill's cell once the depot stands
  (`src/fx/rover-glue.js` `payKill`, `src/domain/economy.js` `award(..., { hold: true })`). Only the rover's pour reaches the bank.
- The rover carries 6,000 kg a trip at 16 m/s, rakes 400 kg/s, pours 1,000 kg/s (`src/content/rover.js`). Measured on the classic base's
  473 m road: 31 s out, 30 s raking, 35 s back, 5 s pouring, about 63 kg a second at best.
- The `--ledger` probe with the rover (ideal defender, reference flagger) banked **1,031 / 12,086 / 24,186 kg** in sectors 1-3 (2,585 in
  sector 1 once the break settles the hold and the flagged ground), against **11,996 / 36,380 / 107,019 kg** laid on the ground. From sector 1
  on, the rover's trips, not the kills, set the income: between two thirds and four fifths of what dies is never banked.
- What is still on the old small scale is everything that predates the build board: the sentries' radial prices 45-260 kg (`src/towers.js`),
  upgrades at 0.7x and 1.2x, the landing's salvage 96 / 180 / 240 kg (`src/content/landing-game.js` `salvage`), the first orders 40-120 kg,
  the foundry's barrel 60 kg, the farm's 40 kg a sector, the held breach's 40-60 kg (`src/content/sectors.js` `held`). On a 12,000 kg sector a
  45 kg Rotor is free, which is why "nothing is a real choice" is still true even though the board's own prices are about right.
- The start bank is 170 kg (`GAME_START_BIOMASS`, `src/domain/campaign.js`) under the salvage, so the landing's grade barely matters.
- The rover cannot be hurt. It goes home from 6 bodies within 4 cells and goes back out once its ground is down to 2 (`ROVER.retreat`).
  Nothing hunts it: whites and yellows hunt the hull or the gate (`src/domain/soft-hunt.js` `huntGoal`).
- Piles rot whole after 240 s untouched (`FIELD.decaySeconds`). When a sector ends, the rover's hold **and every pile under a standing flare**
  are banked at once (`settleBreak`, `src/domain/rover-run.js`).
- The streak is +0.05 a kill to x3, reset by a leak (`src/domain/economy.js`). In a crowd of hundreds it reaches x3 in 40 kills and stays.

## 2. The calls

### 2.1 Kill pay (E1): kill pay stays; the old small prices rise twenty times

**Call.** Bounties and `KILL_PAY` (tank 1.0, tower 0.5, strike 0.5, ram x1.25) do not change. Everything still priced on the small scale
is multiplied by 20, so the game has one price table, measured in tonnes:

| Constant | Today | Called |
| --- | --- | --- |
| Sentries, `src/towers.js` `cost` (Rotor, Plasma, Quiver, Relay, Mortar, Lancer, Needle, Heptapod) | 45, 80, 90, 100, 110, 130, 220, 260 | 900, 1,600, 1,800, 2,000, 2,200, 2,600, 4,400, 5,200 |
| Salvage, `LANDING_GAME.salvage` `feedstockPerBarrel` (CLEAN and HARD / WRECK) | 60 / 48 | 1,200 / 960 |
| The barrel, `src/content/foundry.js` `feedstockPerBarrel` | 60 | 1,200 |
| The foundry's work pays back, `base-programme.js` `pays` | 60 | 1,200 |
| A held breach, `src/content/sectors.js` `held.kg` (sectors 1-5 and later) | 40, 45, 50, 55, 60 | 800, 900, 1,000, 1,100, 1,200 |
| The farm, `BASE_PERKS.farmKg` | 40 a sector | 800 a sector |
| A skipped opening, `STORY_SKIP.biomass` | 450 | 4,000 |

**Why.** Cutting kill pay to a twentieth (E1's own remedy, computed before the rover) would make the kills the limit again and leave the
rover with nothing to fetch; the rover is now the one place where gathering is a skill, which is what the owner asked for. The board's
prices were re-based on a ledger and already sit near the rover-era income; the sentry radial and the opening were never re-based. x20 is
E1's own factor and puts the cheapest sentry (900) just under the cheapest board card (1,500) and the dearest (5,200) level with the spare
hull (4,800): one table a player can read.

**Proven wrong if** the `--ledger` escort run (section 4, step 6) shows the afford ratio (below) over 70 % or under 30 % in sectors 1-3.

The alternative the owner may prefer: cut kill pay to about a third (not a twentieth), so the ground holds roughly what the rover can carry
and how the player kills (chains, rams) moves income as much as how he harvests.

### 2.2 The constraint target (E2)

**Call.** Two targets, both read off the `--ledger` probe (the economy-plan's own measure; `ecoAffordT` and `ecoClockT` already exist in
`src/td-tab.js`):

1. The bank affords the cheapest sentry the player can still build (under the cap) for **40-60 % of the fighting time** in sectors 1-3.
2. At each board before sectors 2, 3 and 4, the reference bank buys **one** mid-priced card (the median base price, 2,800 kg, times that
   board's index) plus a sentry, **not two** mid cards.

**Why.** The first is the only definition already measured by the code; the second makes the board's two picks a real choice, which is the
complaint in E1. Round 6's bar ("two mid cards at the first board") is retired because it described a board that cannot bind.

### 2.3 The streak (E5): unchanged in numbers, re-told as bonding

**Call.** The step (0.05), the cap (x3) and the reset on a leak stay. No spatial second step. Isao's exposition calls it bonding: bodies
killed in quick succession bind into one mass and keep more of themselves. The spatial half of the owner's fiction ("bonds to itself,
otherwise it seeps into the ground") is carried by the piles themselves, through seepage (2.6): kills on the same cell share one pile, and a
big pile loses a smaller share of itself than a lone kill.

**Why.** In a crowd sector any kill counter saturates at x3 inside a minute, so changing the step or adding a second step changes almost
nothing; and since the rover, not the ground, limits income from sector 1 on, the streak's effect on the bank is small either way. One new
rule (seepage) carries both halves of the fiction instead of two.

**Proven wrong if** the owner plays and does not feel chains matter. The alternative: the economy plan's 0.04 step plus a second step for a
kill within 2 cells of the previous one.

### 2.4 The sentry cap (E3): 6, plus 2 and 2 from the colony

**Call.** Isao keeps **6** sentries running at the start; **+2** when the fabrication dome stands (the assembly line's role, see the colony
design), **+2** when the logistics dome stands (the armory's role). Ten is still the ceiling. On `?base=classic` the assembly line and the
armory give the same +2 each. The refusal reads the live cap ("Isao keeps 6 sentries running: sell one to build another").

**Why.** At the new prices six sentries cost 6,000-15,000 kg, about what sectors 2-3 bring in, so the cap starts to bind around sector 3,
exactly when the colony's choices open; it makes two colony structures economic, which E10 asks for, with a rule the code already has
(`STORY_SENTRIES.cap`).

The alternative: the flat 10 as today.

### 2.5 Upgrades and refunds (E4)

**Call.** Upgrades cost **0.8x** then **1.5x** of the sentry's base price (today 0.7x and 1.2x); selling refunds **60 %** (today 75 %).
A Heptapod at level 3 is then 5,200 + 4,160 + 7,800 = 17,160 kg: the luxury.

**Why.** The economy plan's numbers; with the cap at 6 the upgrade is the other way to spend, and it must cost more than a new sentry
does at the top.

### 2.6 The rover loop is the income

**Trip size: unchanged.** 6,000 kg a trip, 16 m/s, a 400 kg/s rake, a 1,000 kg/s pour, a 3-cell reach. They were measured into place on
2026-11-06 and they are the income's clock; changing them reopens a balance that was measured. The dome city's depot stands nearer the gate
than the classic base's (measured road unknown: step 6 reads it).

**Seepage replaces the rot (new rule, `src/domain/biomass-field.js` `tick`).** A pile loses `max(0.5 kg, kg / 400)` every second: under 200
kg it seeps at a flat 0.5 kg/s (a lone 6 kg kill is gone in 12 s, a 50 kg pile in 100 s); over 200 kg it loses a quarter of a percent a
second (half of it in about 4.6 minutes). `FIELD.decaySeconds` goes; a pile ends at zero. The ledger gains `seeped`.
*Why:* this is the owner's sentence as a rule: what is not gathered is partly lost, and what is bonded keeps better. *Proven wrong if* the
reference flagger without escort loses less than 40 % or more than 60 % of what is laid on the ground over sectors 1-3; tune the 400.

**The break banks half the flagged ground.** At a sector's end the rover's hold is banked as today; the piles under standing flares are
banked at **50 %** (`settleBreak` gains `breakShare: 0.5`). *Why:* banking the whole flagged ground for free at the break made the trip, and
so the escort, pointless at every sector's end; the half keeps sector 1's first board alive (it was the only sector the break helped:
1,031 to 2,585 kg).

**Kills lie on the ground from the story's first kill**, not from the depot's perk. *Why:* the recon dog opening's first harvest is the
Rotor fight's bodies, and with no start bank "biomass from local resources" must be visible from the first fight. Before the depot stands they
simply seep.

**What threatens the rover (new rule).** While the rover is outside the walls, it is a hunt goal for the soft tiers (white, yellow): in
`huntGoal` the choice is hull, rover or gate by walking distance, the hull keeping its 2-cell bias (the tank stays priority 1). Bodies that
choose the rover ring round it with the hull's own ring and jab (`SOFT_HUNT` ring 1.2 cells, a jab every 3.6 s); **each jab's peak on the
rover eats 100 kg from its hold** (lost, not dropped). The retreat stays at 6 bodies within 4 cells. The rover has **no hit points and cannot
be destroyed**. A callout ROVER UNDER ATTACK (at most every 15 s) and Isao's line `rover_bitten` the first time.
*Why:* the soft hunt and its ring already exist, so the threat is one more goal, not a new enemy behaviour; five bodies eat about 140 kg a
second, about 4,200 kg of a 6,000 kg trip over the 30 s it rakes, while the rover still outruns them home (16 m/s against their ~3). No wreck means no
rebuild flow, no friendly-fire rule for the automated gunship and SOL, and no fail state for a support unit.
The alternative: hit points and a wreck, rebuilt on the board at its catalog price (3,600 kg).

**What the tank does on an escort sortie.** Nothing new to learn: it drops a flare where the bodies lie (F), drives out with the rover and
stays near it. Because the hull outranks the rover by 2 cells in the hunt, the tank near the rover **draws the hunters off it**; the tank's
own kills there pay full (1.0) and fall inside the rover's reach, so they are raked before they seep. A sortie is the flare stock: **4 flares,
restocked at the base** (the gantry, the garage, and the logistics dome's pad in the colony design), so a sortie is up to four harvest sites
and then home, where the hull also mends.

**What the player gains by escorting, against staying at the gate.** Escorted, the rover rakes through a pulse without retreats or bites
and the tank's kills bank at full; unescorted it only works in the breaths and the lulls and comes home light. Staying at the gate, the
player keeps the wall: the gate is held by sentries, the Rotor and the automation alone. In sector 1 towers alone lose at about 61 s (F1), so
early on the escort is only possible in the breaths; every sentry, the automated SOL (the launcher) and the automated gunship buy time away
from the gate. That is the loop: defence pays for sorties, sorties pay for defence.
**Proven wrong if** the `--ledger` escort run does not bank at least 1.5 times the no-escort run in sectors 2-3 (then raise the bite or lower
the retreat to 4 bodies), or if an unescorted trip during a pulse still comes home over 4,500 kg.

**The pearls' cap (E8): unchanged.** 36,000 kg in three pearls, a fourth on the board (2,000 kg, +12,000). At the new prices only a
hoarder meets STORAGE FULL, which is the cap's job.

### 2.7 The first minutes, with no start bank

The order is the recon dog opening's (`docs/superpowers/specs/2026-11-12-the-recon-dog-opening-design.md`). The Rotor is Isao's, free.

| Source | CLEAN | HARD or automatic | WRECK |
| --- | --- | --- | --- |
| Salvage at the deploy (sections x barrel + bonus) | 4,800 | 3,600 | 1,920 |
| Survey, 3 points x **300 kg** (the dog spec's 30, x10) | 900 | 900 | 900 |
| First harvest: the Rotor fight's 62 bodies after seepage (estimate) | ~300 | ~300 | ~300 |
| **Bank at THE FIRST ORDERS** | **~6,000** | **~4,800** | **~3,120** |

A total CRASH ends the run (the owner's call, O1-O3). `GAME_START_BIOMASS` is 0 on the story's start (the TD tab and the simulator keep
theirs). The survey is x10, not x20, so the dog's walk is a nudge and not worth more than the gap between two landing grades.

**THE FIRST ORDERS** opens when the first harvest has been poured. Two picks from four cards:

| Card | Price | What it gives |
| --- | --- | --- |
| LANDING PAD | 1,200 | the pad on the SH02's ground (as today) |
| SEED FOUNDRY | 800 | Isao works the AFR-01: one more barrel, **+1,200** when it stands |
| SOLAR ARRAY | 2,400 | the hull's shield charges on its island (as today) |
| SECOND ROTOR | 900 | a second Rotor on the wall's other socket (new card; the radial's price) |

What the grade then means: a WRECK (~3,120) cannot pair the array with any other card (the cheapest such pair, with the foundry, is
3,200): it takes the array alone, or two of the pad, the foundry's investment and the second Rotor. HARD affords any pair and keeps 1,200-3,100 for sector 1. CLEAN affords any pair and keeps
2,400-4,300, two to four sentries in sector 1. The grade carries into the first sector's defence, which is what the owner asked of it.
*Proven wrong if* a WRECK cannot hold sector 1 at all (then the second Rotor becomes Isao's on a WRECK), or CLEAN and HARD end sector 1
with the same bank.

**Isao's exposition** (captions, his voice, unrecorded), three lines across the deploy and the first harvest:
`no_bank` "We brought nothing to build with. The Stålheart prints from what this planet gives us." ·
`biomass_bonds` "Their tissue is the best feedstock I have seen. It binds to itself: kill them close together and it holds." ·
`biomass_seeps` "What we leave lying seeps into the ground. The rover brings it in; what it does not reach, we lose."

### 2.8 The board's index

**Call.** `BUILD_BOARD.index` becomes **[1, 2, 4, 4.5, 5]** (today [1, 2.2, 5.5, 6, 7], derived from the pre-rover ledger's income ratios),
then is re-derived in step 6 by round 6's own rule (the income of the sector before each board over sector 1's, smoothed) on the escort
run. *Why:* the rover flattened income from sector 3 on (12,086 to 24,186, x2, where the old ledger went x2.9), and with sentries now
priced in tonnes the board shares the bank with the radial; at 5.5 the board before sector 4 would buy nothing.

### Not called here

E6 (who earns what; the Ridgebacks' pay): with the rover as the bottleneck it barely moves income; the ledger's split by source will say.
E11 (close a breach early or hold it): the held pay is only re-scaled (x20) to stay in proportion. E9, E10: the colony design.

## 3. What changes, in one list

Content: `src/towers.js` costs and `upgradeCost`; `src/domain/economy.js` `REFUND_FRACTION`; `src/domain/campaign.js`
`GAME_START_BIOMASS` on the story start; `src/content/landing-game.js` salvage; `src/content/foundry.js`; `src/content/base-programme.js`
`pays`, `BASE_PERKS.farmKg`, a new `BASE_PERKS.sentryCap { fabrication: 2, logistics: 2 }` (classic: assembly, armory);
`src/content/sentries.js` `STORY_SENTRIES.cap` 6; `src/content/sectors.js` held kg; `src/content/story-defaults.js` `STORY_SKIP.biomass`;
`src/content/build-board.js` first-orders prices, the second Rotor card, the index; the dog scout's survey pay; `src/content/rover.js`
`FIELD.seep { floor: 0.5, share: 1 / 400 }` (decaySeconds gone), `ROVER.threat { bite: 100, every: 15 }`, `ROVER_WORDS.bitten`.
Rules: seepage (`biomass-field.js`), `breakShare` (`rover-run.js` `settleBreak`), a `bite(kg)` on the run, the rover as a hunt goal
(`soft-hunt.js` `huntGoal`, the ring centred on the rover in `src/fx/soft-hunt.js`), kills held from the first kill (`rover-glue.js` `live`),
the live cap (a pure `sentryCap(perks)`).

## 4. Build order (each step testable on its own)

The opening's numbers wait for the recon dog opening to merge (it is being built now and owns those suites).

1. **The price table, content only.** Sentries x20, upgrades 0.8x / 1.5x, refund 60 %, held pay, farm, `STORY_SKIP` 4,000, the index.
   Test: `npm test` (the tower-cost and board tests re-pinned); browser `--board` (a board before sector 2 offers sentry cards at 900+),
   `--colony`, `--debrief`.
2. **The sentry cap.** `sentryCap(perks)` pure and node-tested (6, 8, 10); the refusal text. Browser `--board` or a scratch probe: a seventh
   order refused before the fabrication dome (classic: the assembly line), accepted after.
3. **Seepage and the half break.** `test/biomass-field.mjs` (a 6 kg pile gone in 12 s, a 1,000 kg pile at 2.5 kg/s, the ledger's
   `seeped`), `test/rover-run.mjs` (`settleBreak` at 0.5). Browser `--rover` (its 4,000 kg field and trip still pass), `--ledger`
   (record seeped kg per sector).
4. **Kills on the ground from the first kill.** After the recon dog merge: the first fight's bodies lie at the gate, the bank does not move
   until the first pour. Browser `--dog-scout` (its first-harvest step), `--rover`.
5. **The rover hunted and bitten.** `test/soft-hunt.mjs` (`huntGoal` picks the rover when it is nearest and outside, the hull still wins
   within its bias), `test/rover-run.mjs` (a bite takes kg off the hold, never below 0). Browser `--rover` gains two pages: an unescorted
   rover raking under a pulse (bitten, it retreats, it comes home under 4,500 kg) and an escorted one (the harness parks the hull at the flare:
   the bodies ring the hull, the rover comes home over 4,500 kg).
6. **The measure.** `--ledger` gains an escort policy (the harness drives the hull to the rover's flare whenever the rover is out and the
   field at the gate is under the breath) beside today's flagger. Read: banked, laid, seeped, lost, the afford ratio, the bank at each board,
   the road's length. Set the index from it (2.8); check 2.1, 2.2, 2.6 against their "proven wrong" lines; write the numbers into the entry.
7. **The opening.** No start bank, the salvage, the survey, the first orders' four cards, Isao's three lines. Browser `--dog-scout`,
   `--landing` (the salvage printed by grade), `--chapters`, `--skip-tutorial`.

## 5. Risks

- Sector 1 gets harder: today a player fills ten sentries for about 1,000 kg; at the new prices sector 1 starts with the Rotor, perhaps a
  second, and one or two bought. F1 (towers alone lose at ~61 s) says the tank must fight sector 1; that is intended, but run
  `--sector-probe` on sector 1 with the new bank before calling it.
- The board's tests and several suites pin prices and the 170 kg start bank; expect re-pins, not bugs.
- The rover as a hunt goal changes where whites and yellows walk; `--pearl-story` and the soft-hunt suites must be re-read, not re-pinned
  blindly.
