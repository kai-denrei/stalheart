# Sector shapes: pulses with a breath, then the filled lane (design, 2026-10-15)

Owner, 2026-10-15: "we will re-work 1) the difficult progression, 2) the timing of waves (since they are smaller), 3) confirm that we can have up to 1200 enemies as in our dev lab tests, 4) progression and story line." Asked what a late sector should feel like under the Pearl set, he chose **both by sector**: early sectors as pulses with gaps, late sectors as a filled lane, the switch the story's own escalation; the switch at **sector 4, THE PRESS** (its brief already says "The lane is never empty now."). Approach chosen: shape tables with absolute sizing in bodies (over capping today's multiplying ladder, or a rate-based spawner that would lose the breach books). Item 3 is answered by `2026-10-15-pearl-crowd-measured-headed`: a column of 1,200 Pearl bodies holds the frame, a pile at the hull does not.

## 0. What the sectors do today (the baseline the design starts from)

A wave's count is the ladder's plan (`computeWavePlan` at the breach's ladder wave, times the sector's `threat`), times the soft factor (`SECTOR_TIMING.soft`: x2 at sector 1, +1 a sector, x8 from sector 7), times the invasion surge inside the ladder (wave 9 and past), times the stampede (every second wave: a trickle capped at 24, or a flood x3), then the Pearl build-up keeps 15% to 100% of the single bodies (squads kept whole). On paper (`scratchpad/paper-baseline.mjs`, 2026-10-15), per breach per wave after the build-up:

| sector | waves | sector total |
| --- | --- | --- |
| S1 THE LANE | 2 / 10 / 26 / 158 | 392 |
| S2 THE LONG LANE | 5 / 10 / 67 / 326 | 816 |
| S3 THE CANYON | 16 / 10 / 115 / 542, the swarm 360 | 683 |
| S4 THE PRESS | 37 / 10 / 102 / 422 | 1,142 |
| S5 THE SIDE WALL | side 266 / 78 / 130 / 744, gate 266 / 10 / 130 / 2,162 | 3,786 |
| S7 THE BACK DOOR | 9 / 8 / 133 / 761 / 1,103 / 24 a side | 4,447 |
| S8 BOTH WALLS | 36 / 7 / 889 / 3,640 / 1,556 / 20 / 1,645 / 4,996 a side | 25,578 |
| S9, S10 | up to 5,452 a wave | 30,000 to 32,000 |

Three findings. **The sizes are multiplied, not designed:** from sector 8 a wave is 4,000 to 5,600 bodies and a sector 30,000; the crowd cap (`CROWD_CAP`, 1,500 at best, a 400 floor under a pile) and the Pearl pool then drip them out, so a late sector is a long undifferentiated stream whose length nobody chose ("the waves are smaller"). **The build-up skips squads:** every squad is kept whole, so sector 5 opens with 266 bodies on a wave meant to be at 15%. **Every other late wave is a non-event:** the trickle's 24-body cap against 12-second pulses leaves sector 8 alternating floods of thousands with drips of 7.

Measured headless with `--sector-probe` and `PLAY=1` (an ideal defender culling the field every 2 s, 2026-10-15): pulses every 15 s whatever the field; at sector 5 a queue of 816 released at once put 1,014 alive, at sector 6 a queue of 858 put 1,573; at sector 8 the cap and the pool held the floods to 400-617 alive with hundreds queued.

## 1. Two shapes, one table

Every sector row in `src/content/sectors.js` says its shape and its numbers **in bodies**, so the owner reads the progression off the table. The ladder keeps choosing **which types** a wave brings (the new-contact cadence, the headline, the sprinkle) and nothing else.

**Pulse** (S1 THE LANE, S2 THE LONG LANE, S3 THE CANYON): `shape: 'pulse'`, `bodies: [n, n, n, n]` per wave **per breach** (the list's last entry repeats past its end), `pulse` seconds, `breath: { at, max }`. The next wave arms only once `pulse` seconds have passed since the last release **and** the field's live sector bodies are at or under `at` of the last pulse's size (the wave is mostly dead: the breath to build and repair), or once `max` seconds have passed since the last release whatever is alive (a player who falls behind still gets stacked, which is the pressure). The stampede keeps **marking** wave 2 a trickle (its `trickleGap` spacing, the combo game, its callout) and wave 4 a flood (its callout, its `cores` barbed) but no longer multiplies: the list is the size. The canyon's swarm (`CANYON.swarm` pulses of its ladder wave, out of sight at the antipode) is unchanged.

**Flow** (S4 THE PRESS and every sector after it): `shape: 'flow'`, `flow: { alive, total, burst, pulse }` for the **whole field**. Each pulse sends `burst` bodies from every open breach, streamed over the pulse (queue offsets spread evenly across `pulse` seconds) rather than dropped at once; the next pulse arms as soon as the field's live sector bodies are under `alive` (the target, clamped by the crowd cap). The lane sits between the target and the target plus one burst a breach and never empties. The breach's books count `ceil(total / breaches / burst)` waves planned, so HELD, QUICK HANDS, the forfeit and the Pearl pace climb keep working unchanged. The back door's feast (its back breach's first wave) and the canyon again's swarm are untouched; `hardcoresEveryWave` / `hardcores` stay as an explicit add on every wave.

## 2. The numbers to start from

Field-level, under the measured 1,200-body column. A starting point: the owner tunes them on :8159.

| sector | shape | per breach per wave, or alive / total / burst | pulse | coreShare |
| --- | --- | --- | --- | --- |
| S1 THE LANE (2 gate) | pulse | 10 / 20 / 30 / 50 | 12 s, breath at 25%, max 60 s | 0 |
| S2 THE LONG LANE (2 gate) | pulse | 20 / 35 / 50 / 90 | 10 s, 25%, max 55 s | 0 |
| S3 THE CANYON (1 gate + the swarm) | pulse | 30 / 50 / 70 / 120 | 10 s, 25%, max 50 s | 0.03 |
| S4 THE PRESS (2 gate) | flow | 450 / 1,800 / 150 | 6 s | 0.03 |
| S5 THE SIDE WALL (side + gate) | flow | 550 / 2,400 / 180 | 6 s | 0.05 |
| held sectors, THE CANYON AGAIN (gate + the swarm) | flow | 650 / 3,000 / 200, +50 alive and +300 total a held sector | 6 s | 0.05 |
| S7 THE BACK DOOR (feast first) | flow | 700 / 3,600 / 220 | 6 s | 0.05 |
| S8 BOTH WALLS (2 barbed every wave) | flow | 850 / 4,800 / 250 | 5 s | 0.08 |
| generated | flow | +75 alive a sector to `aliveCap` 1,200, +600 total | 5 s | 0.08 |

Sector 1 opens under 30 on the field (two breaches of 10), as `test/sectors.mjs` holds today.

## 3. Hard cores by share

Each row carries `coreShare`. A sized wave of `n` bodies is `round(n x coreShare)` cored bodies drawn from the ladder plan's cored types in their own proportions and the rest soft from its soft types in theirs, each count by largest-remainder rounding so the total is exact; a type the plan brings is kept at one body at least while the budget allows (so a new contact still shows); a plan with no cored type sends soft bodies only. Today the ladder at wave 7 is a third hard cores before the soft factor dilutes it to about 2%: the share makes that dilution a chosen number. The flood's `SECTOR_STAMPEDE.cores` and the row's `hardcores` ride on top.

## 4. What retires

- `SECTOR_TIMING.soft`, `softStep`, `softBase` (the soft factor) and `aliveBudget`'s role in the sector clock: a pulse sector's stacking is bounded by its list, a flow sector's by its target. `aliveBudget` stays as `pulseFits`' ceiling for the campaign board.
- `SECTOR_STAMPEDE.size`, `trickle`, `trickleMax`, `tierSize`, `tierCores` as multipliers; `every`, `cores`, `core`, `fallback`, the callouts and `trickleGap` stay (the kinds). The automation tier's "crazier waves" (`api.tier`) no longer sizes anything; `api.swell` (the automations' envelope) multiplies a pulse list's counts and the flow's `alive` and `total`, so that hook stays in one place.
- `PEARL_WAVES.scale` (the count thinning, which skipped squads). `PEARL_WAVES.pace` stays: a breach's waves still climb 0.6 to 1 of the plan's march over its planned waves, which in a flow sector is the sector's own build-up.
- `threat` stays on the rows: the ladder's mix ratios and the forfeit estimate read it.

The crowd cap (`CROWD_CAP`) stays as the machine's safety and clamps the flow target (`min(alive, cap)`). The Pearl pool's room rule is unchanged.

## 5. Where it lives

- **`src/domain/sector-shape.js`** (new, pure; the `add-module` skill's checklist): `sizeWave(entries, spec, { bodies, coreShare })` (section 3), `pulseBodies(list, index)`, `flowWaves({ total, burst }, breaches)`, `pulseDue({ alive, lastSize, sinceRelease, pulse, breath })`, `flowDue({ alive, target })`, `flowTarget(alive, cap)`, `streamOffsets(n, seconds)`. Tables in, decisions out; no content import.
- **`src/content/sectors.js`**: the rows gain `shape`, `bodies` / `flow`, `breath`, `coreShare`; `SECTOR_HOLD`, `BACK_DOOR_SECTOR`, `BOTH_WALLS_SECTOR`, `SECTOR_GENERATOR` gain their flow numbers and steps (`aliveStep`, `totalStep`, `aliveCap`); the retired fields go. `src/domain/sectors.js sectorDef` carries the shape fields through the held and generated sectors (the steps applied as `threatStep` is) and sets a flow sector's `waves` from `flowWaves`.
- **`src/fx/sector-run.js`**: `waveOf` sizes the ladder plan through `sizeWave` (a pulse's count from its list, a flow's from `burst`), the stampede marks the kind; `queueOf` spreads a flow burst with `streamOffsets`; `canRelease` asks `pulseDue` or `flowDue` (the stall rule stays on top; a sector's first pulse is always due); `pulseGap` returns the row's pulse for a pulse sector and 0 for a flow one (the stream itself is the gap: the controller's clock arms the next pulse as soon as the last stream has left the queue, so the cadence is the pulse plus the telegraph, not twice the pulse); `nextPulseSize` reads the shape. Flow bursts are packed into squads (`packSquads`) when the sector's `alive` target is at or past `SQUADS.over`, with the burst as the packing's threshold. No change in `src/td-tab.js`.

## 6. Tests

- `test/sector-shape.mjs`: sizing keeps the mix and the exact total, the core share, one of each type while it fits, no cored type means all soft; the pulse rule (the breath, the ceiling, the first wave of a sector), the flow rule, the clamp, the stream's spacing, the flow's wave count.
- `test/sectors.mjs`: the climb re-based on the tables (every sector's peak field beats the one before, the canyon aside; flow targets never past 1,200; sector 1 under 30); the forfeit and the books unchanged.
- Browser: `--sectors`, `--pearl-story`, `--sector-probe` on 2, 5 and 8 (the baseline's shape against the new one: the breath visible at S2, the lane filled at S5 and S8), `--pacing` (its 40 s first-contact contract is about the opening, not a sector's size), `--backdoor`, `--canyon`, `--canyon-again`, `--squads`, then the full suite before the push.

## 7. The story line (item 4)

The arc is unchanged: THE LANE, THE LONG LANE, THE CANYON, THE PRESS, THE SIDE WALL, the held sectors with THE CANYON AGAIN before the door, THE BACK DOOR, BOTH WALLS, the generated sectors. The switch from pulses to the filled lane is THE PRESS, and its brief already says it. No new copy in this round; the debrief's books, stamps and records are unchanged.

## Deviations

Recorded here as the build finds them.
