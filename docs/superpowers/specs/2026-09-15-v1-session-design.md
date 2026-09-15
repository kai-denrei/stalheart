# V1 session: hold the Stalheart

Status: design for the overnight build of 2026-09-15/16. Owner brief (paraphrased): package a playable V1 session for the owner and friends: story, then sectors of two breaches each with exciting end-of-sector debriefs; pickups that are seen and heard; a gunship that creeps toward the breaches; the orbital laser in the arsenal; a tank shield that recharges at the array station but not forever, with the ram bonuses live; a second front on the other side of the base; Isao building all the time. Creative license granted.

Identity check (`docs/FUNMAP.md`): **resourceful joy under pressure.** The sectors, the forfeit rule and the second front are the pressure; Isao growing the colony, the flags and crates coming home and the debrief's celebration are the joy.

## 1. The session, start to finish

| # | beat | owner |
| --- | --- | --- |
| 0 | Arrival, foundry, Rotor, first fodder, Quiver, hard cores, study: the existing story beats | `src/domain/story-beats.js` (unchanged) |
| 1 | Handover: towers turn automatic. **Sector 1 brief** card (two lines of Isao, the two breach bearings, the forfeit rule in one line) | sectors (new) |
| 2 | **Sector loop** (section 2) with expeditions, the gunship call-in and, from sector 2, SOL-82 passes | sectors + existing systems |
| 3 | **SECTOR SECURE** callout, then the **debrief** (section 4), dismissed by hand, never on a timer | sector debrief (new) |
| 4 | Next sector brief. Sector 2 opens the **back door**; sector 3 fights on both sides | sectors content |
| 5 | After sector 3: **THE COLONY HOLDS** campaign card with per-sector totals; KEEP HOLDING continues with generated sectors (alternating sides, growing waves); NEW RUN restarts the story | sector debrief |

Loss stays what the game already does (the Stalheart and the three hulls in the bays); the debrief shows a LAST TRANSMISSION variant on loss with the same data.

## 2. Sectors

A sector opens **two breaches** at once. Each breach carries its own **wave programme**: `waves` waves, sized by the existing `computeWavePlan` ladder with the sector's `threat`. Waves release from every live breach on the wave clock.

- **Closing a breach early** (a 105 round, three seconds of SOL-82, tank shells, the existing strike/seal paths) seals it; its remaining waves never come. What those waves would have paid is estimated from the programme (expected kills x bounty, clear bonuses, score) and booked as **LEFT IN THE FIELD** in kg and points. Closing early is safety bought with income.
- **A breach held to the end** collapses on its own after its last wave has emerged (the existing `programmeSpent` seal) and pays a **HELD** bonus (content number).
- **The sector is secure** when both breaches are closed or spent and no enemy of the sector is alive. Guards at expedition sites do not count.
- Content (`src/content/sectors.js`), first numbers, tuning later:

| sector | name | breaches | waves each | threat | new |
| --- | --- | --- | --- | --- | --- |
| 1 | THE LANE | 2 on the gate side | 3 | 1.0 | the gunship call-in |
| 2 | THE BACK DOOR | 1 gate side, 1 behind the bays | 4 | 1.3 | the back mouth opens; SOL-82 online |
| 3 | BOTH WALLS | 1 each side | 5 | 1.7 | hard cores in every wave |
| 4+ | generated | 2, alternating sides | 5 + n | +0.35 per sector | none |

Breach placement: far open cells on the sector's side (gate side toward `dungeon.spawn`, back side toward the reopened back mouth), at least a minimum arc apart, never within the sealed-breach exclusion radius.

## 3. The arsenal and the colony

**Pickups that are seen and heard.** When a site's guards are down, our flag is **raised** there (upstream SentryTowers_A6 CTF flag, `Raise` then `Flutter`) with the gate hydraulics as the hoist. When the tank reaches it, a **crate** swings onto the hull's back deck (clunk + `tank_pickup`, callout PART SECURED · <PART>) and rides there with a little sway. Home at the foundry the crate **drops** off the back (fall, bounce, `gate_slam` as the thud), Isao flies over to it, and a card reads <TOWER> UNLOCKED with `tower_upgrade`; a trophy flag goes up on the landing island, one per part home. A lost hull throws the crate off (tumble) and the site's flag lowers; the part is back at its site.

**The gunship creeps toward the breaches.** On station, the platform's ground point moves toward the live breach with the most enemies near it (ties: the nearest) at a slow capped arc speed with ease-in and braking (reuse the laser's slew-with-inertia idea), never cutting: the seat's view stays relative to a heading that turns slowly. No live breach: it drifts back over the base.

**SOL-82 in the arsenal.** Online from sector 2 (or once Isao has printed the uplink; see Isao below). Passes on the lab's clock (`src/content/orbital-laser.js`: every 180 s, 20 s overhead, 10 s of beam). The views strip shows SOL-82 counting down and lights when overhead; the seat is the satellite scope with the ground inset (the lab's layout). Drag to steer with the lab's inertia, hold to burn. Bodies die on contact, a breach seals after its burn time (the forfeit applies), and it burns our own walls, towers and the Stalheart too: misuse can lose the colony.

**Shield and rams.** The shield keeps its rules (`src/domain/shield.js`). The **array station** is the solar complex's island: parking on its pad transfers shield at a content rate from a **station reserve** that refills at each sector start and runs dry (the HUD shows the reserve; Isao notices when it is empty). Relays keep their tap. Rams keep the combo; the story HUD shows the combo callouts and the ram premium as floating kg.

**The second front.** Sector 2 reopens the sealed clearing mouth nearest the back of the base (+Z, behind the bays) with a rock collapse and the orbit shot; the back breach's swarm walks in through it. The player answers with orders there.

**Isao keeps building.** A build programme prints the base the player does not order: between waves and at sector starts Isao flies to the next structure and prints it, and the structure's perk switches on. Order and perks (subject to the base-growth investigation): solar complex -> array station; walls and gate; HUGIN arm -> gunship meter bonus; the bays -> the hulls; assembly line -> rebuilds one lost hull per sector; radar/antenna -> SOL-82 uplink. Player orders keep priority over the programme.

## 4. The debrief

Dismissed by hand. Sequence with count-ups (numbers roll with a soft tick), stamps that thump in (FLAWLESS, HELD THE LINE, QUICK HANDS, RAM KING, SHARPSHOOTER, SCORCHED EARTH, ...), records that turn rainbow over 1000 (existing), monochrome vocabulary, no colour emoji. Pages, each one screen, NEXT/BACK and keys:

1. **SECTOR N SECURE** - time, score, biomass earned, left in the field, stamps.
2. **THE BREACHES** - one column per breach: side, waves fought of planned, kills, closed by (105 / SOL-82 / SHELLS / HELD), seconds open, left in the field.
3. **THE KILLS** - attribution bars (tank gun, ram, each tower kind, gunship 25/40/105, SOL-82), belt ladder histogram, tempo sparkline.
4. **THE TANK** - accuracy, rams, best combo, shield seconds used and drawn at the array, damage taken, hulls lost, parts home (crate glyphs).
5. **THE COLONY** - Isao's prints this sector, biomass in/out, gunship passes and kills, SOL-82 passes, seconds and kills, records, and Isao's two lines about the next sector. CONTINUE.

### The report contract (shared by the stats accumulator and the card)

```js
{
  sector: 1, name: 'THE LANE', seconds: 312, outcome: 'secure' | 'lost',
  score: { total, kills, rams, bonuses },
  biomass: { earned, spent, bank, leftInField },
  breaches: [{ id, side: 'gate' | 'back', wavesPlanned, wavesFought, kills, closedBy: 'gunship' | 'laser' | 'shells' | 'strike' | 'held' | null, openSeconds, leftInField: { kg, points } }],
  kills: { total, bySource: { tank, ram, towers, gunship, laser, other }, byTower: { rotor: 0 }, byBelt: { white: 0 }, tempo: [/* kills per 5 s bin */] },
  tank: { shotsFired, shotsHit, rams, bestCombo, shieldSeconds, stationSeconds, damageTaken, hullsLost, partsHome },
  colony: { prints: ['solar'], leaks, heartDamage, gunshipPasses, gunshipKills, laserPasses, laserSeconds, laserKills },
  stamps: ['flawless'], records: [{ key, label, value, best, isNew }]
}
```

## Ownership and constraints

- Pure rules: `src/domain/sectors.js` (programme, placement policy inputs, forfeit estimate, secure test), `src/domain/sector-stats.js` (event accumulator -> report, stamps, records), `src/domain/gunship-track.js`, `src/domain/build-programme.js`; tunables in `src/content/sectors.js` and siblings. Node tests for each.
- Presentation: `src/fx/sector-debrief.js`, `src/fx/cargo.js`, `src/fx/laser-seat.js`. No controller imports.
- `src/td-tab.js` is at its line budget: each hookup is net zero or negative; extract a block (the old campaign debrief builders are the obvious first) to make room. Long one-liners take `/* */` comments only.
- Browser suites run one at a time through `scripts/browser-lock.sh`.
- New assets pinned by sha256 in a `docs/*.lock.json` and listed in `scripts/assets.mjs`.
