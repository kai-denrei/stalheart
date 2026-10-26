# PROPOSAL — the economy that constrains (2026-10-26; owner's note 9: "The user must feel slightly constrained in what they can build, and feel the need to optimize biomass gathering")

Status: a plan to react to, nothing built. The facts below are the code's today (src/domain/economy.js, src/towers.js, src/content/sentries.js,
src/domain/campaign.js, src/td-tab.js KILL_PAY).

## What the economy is today
- Start 190 kg (STORY_SKIP hands 450 to a skipped opening). One bank, no upkeep, nothing decays.
- Income: a kill pays its bounty x the streak multiplier (1 + 0.05 x streak, capped x3; a leak to the heart resets the streak) x who killed
  (tank 1.0, tower 0.5, strike 0.5) x 1.25 for a ram. Wave-clear and early-call bonuses on top; breach grants and sector tolls at the debrief.
- Spend: sentries 45 to 260 kg, upgrades 0.7x then 1.2x of the base cost, selling refunds 75 %. Isao keeps at most 10 sentries running (STORY_SENTRIES.cap).
  Structures are printed free by the programme in a fixed order. No price on anything but sentries.
- Nothing measures whether the player is constrained. The controller keeps `ecoAffordT` (seconds the bank could buy the cheapest sentry) against the
  run clock: that ratio is the first KPI and it already exists.

## The target, in numbers
- "Slightly constrained" = the player can afford the next sentry (cheapest standing choice) for about 40-60 % of the fighting time, never under 25 %
  for more than a wave, and ends a sector with less than two sentries' worth banked. Today's ratio must be measured first (a ledger probe below).
- "Optimize gathering" = the choices that change income are visible and real: streaks (now with the lore), who kills (the tank's full pay vs the
  towers' half), where they die (close together), and timing (early call). Each must move income by >= 20 % to be felt.

## Levers, smallest first (pick a package, measure, repeat)
1. **Bounties down 20 %** (CREATURE_TIERS bounty, the Pearl set): the cheapest and most honest. Expected: the afford ratio drops ~20 points.
2. **The streak is the gathering game**: step 0.05 -> 0.04 and the cap 3 kept; a kill within 2 cells of the previous kill's point adds a second step
   (the lore of note 5: cells binding); a lone kill far from the last one adds none. Streaks become a spatial skill, not a counter.
3. **Towers pay half, the tank pays full** stays; a strike's kill pays 0.35 (the gunship and SOL are the expensive tools; their kills should not
   fund the next tower as well as the tank's ram does).
4. **Prices**: upgrades 0.7x / 1.2x -> 0.8x / 1.5x (the top tier is the luxury); selling refunds 60 % (rebuilding the line is a real cost).
5. **The cap by the base**: 10 sentries -> 6 at the start, +2 with the assembly line, +2 with the armory (the structures become economic, which note 10 needs).
6. **A trickle with a choice**: the greenhouse's bio cassettes yield +N kg a day (daylight.day(), 30 s) while the base holds; a breach near them halves
   it. Gives a reason to defend the farm side. Only if 1-5 are not enough: a trickle weakens the constraint.
Recommended first package: 1 + 2 + 4 + 5, then measure.

## The ledger probe (before any lever)
A harness step `--ledger` over a normal run (the opening skipped, sectors 1-5 on the pacing route): income by source per sector (tank/tower/strike/
ram/bonus/grant), spend by kind (sentry/upgrade/sell/toll), the afford ratio per sector, bank at each debrief, the streak's distribution (mean,
max, resets), and the sectors where the player bought nothing. The numbers go in the entry; the levers are tuned against them, not by feel.

## Questions for the owner
- Should the farm and the chip plant be economic at all (lever 6), or stay story props?
- Is a sentry cap by structure (lever 5) welcome, or should the cap stay a flat 10?
- The reinforcements: do the Ridgebacks' kills pay (today they pay as towers, 0.5)? A free army that also earns weakens the constraint; proposal: 0.
