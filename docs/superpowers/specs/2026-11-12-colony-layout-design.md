# The colony as a dome city: a 3 x 3 grid, four courts, printed by the mobile Stålheart (design, 2026-11-12, revised the same evening)

Written by the design agent from the owner's words of 2026-11-12: "we want to overhaul the layout to be more like [the elevator-city
diorama], which probably necessitates updating stalheart to its mobile version [KIDOU]"; "Stalheart builds the dome, the player chooses the
order of what goes where, and some are meaningful, e.g. getting replenishment shells, or the radar calling in the Mech cavalry, or the
catapult launching an automated SOL"; and, reviewing the first version the same evening: **"dome city would be like this
https://jelaludo.github.io/SentryTowers_A6/dome-city/ or https://jelaludo.github.io/SentryTowers_A6/elevator-city-diorama/ this."**

The first version kept six domes in today's two columns; **the owner overturned it**. This version lays the colony on the dome-city's 3 x 3
grid with its four courts. It is a visual design: every position needs the owner's eye before it is built (section 9). Each call is a line
in `docs/DECISIONS.md`. Nothing here is built.

## 1. The two references, as read

**Dome City** (`SentryTowers_A6/dome-city/`, "Dome City / Four Squares", "Nine neighborhoods. Four working squares. One connected
settlement."; read from `assets/dome-city/layout.json`, its README and `validation-report.json`, and the dome-colony README and manifest):

- **Nine domes on a 3 x 3 grid at 80 m** (domes at full scale, ±14.6 m, 30 x 30 m plots), on a 220 x 220 m flat footprint. Ids are row then
  column: 11 habitat (-80, -80), 12 research (0, -80), 13 logistics (80, -80); 21 biosphere (-80, 0), **22 power (0, 0), the centre**, 23
  fabrication (80, 0); 31 habitat (-80, 80), 32 biosphere (0, 80), 33 logistics (80, 80).
- **Twelve skybridges** (`bridge_long`, 52 m between sockets, underside 7.5 m, four pylons at ±10 and ±26 m), between every pair of grid
  neighbours: the outer ring and the cross through the centre dome.
- **Four courts, 80 m on a side** (about 51 m clear between dome foundations), each framed by four domes: 01 LAUNCH COURT (-40, -40):
  "ARC-01 space catapult, packed collector and drilling support"; 02 FABRICATION COURT (40, -40): "Missile factory, robotic assembly line
  and MÖRK service garage"; 03 SOLAR SERVICES (-40, 40): "Solar power complex, heliostats, solar crucible and resource drill"; 04 CARGO
  COURT (40, 40): "Hauler, armored containers and reusable ore cassettes". "The machinery occupies the ground below the connected halls."
- One ground lane, the MÖRK's patrol at x = -40 (10 m wide, under three bridges), through the launch and solar courts. The viewer draws
  road markings; their coordinates are not published.
- **All six dome kinds share one envelope**: ±14.6 m, 35.85 m to the top of the sentry cradle on its mast, a 28 m shell. Habitat,
  biosphere and research have clear shells; power, fabrication and logistics opaque. The four corner domes carry a Railgun T3 on the
  cradle (35.6 m up); the other five cradles are empty.
- Status `diorama_candidate_not_game_integration`; no gate, no entrance, no front is defined beyond "+Z forward".

**The elevator-city diorama** (read earlier the same day, `assets/elevator-city-diorama/layout.json` and README): eight domes in a ring on a
3 x 3 at 48 m, the **centre left open as a plaza**, a closed ring of eight short hallways, and the space elevator's station outside the ring,
joined to the ring's front dome by a transfer hall. The owner's screenshot shows the elevator tower and tether on its own pad at a corner of
the slab.

**Not read:** either viewer's own JavaScript, the road markings' coordinates, the dome-city's `defense-report.json`, the tail of the
dome-colony manifest (cut off at 40 of 56 kB; nothing used from it), and the space-elevator station's footprint (not imported into the game).

## 2. The constraint that shapes everything: the gantry is as wide as a court

The game's domes are at 0.65 (the owner, 2026-11-07) and the bridges keep their 52 m span, so the grid is **70.2 m** (9.1 + 52 + 9.1), the
domes 19 m across, the courts **51 m clear**, the same as the dome-city's. The KIDOU is 42 m wide (a 48 x 28 m plot), 40 m tall, and must
**straddle** a dome to print it (the dome passes between its two beams, entering through an open end). It never passes under a bridge
(4.5 m clear). So the gantry cannot drive through a court that holds anything, and it cannot leave a court whose bridges stand. Every call
below follows from that.

## 3. The calls

### 3.1 The centre is an open plaza, the Stålheart's home (the elevator-city's centre, not the dome-city's power dome)

**Call.** The grid's centre cell holds no dome: it is the plaza, and the KIDOU lives there, on the Stålheart's island where the Stålheart
already stands (57 x 56 m at (4.5, 0)). POWER is a dome kind the player may put on any other cell.

**Why.** From the centre the gantry reaches the ring straight along the grid's lines without entering a court; with a power dome in the
centre, its four bridges would cut the plaza into four closed courts, and a 42 m gantry parked in one 51 m court could neither print the
centre nor leave. It also keeps the opening, the hull's hand-over, the repair under the gantry, DAY 42 and the camera's beats where they are.

### 3.2 The front-middle cell is the way in: the landing, the gate's corridor, and at the end the space elevator

**Call.** The grid's front-middle cell (the dome-city's 12, our mouth side, -Z) holds no dome. It is the city's entrance from the gate:
the landing pad (0, -60), where the SH02 came down, and the sightline (x ≈ 0) the base's view keeps toward the sinkhole. At the run's end,
once the Dyson sphere is finished (stage 18 of the flow), **the space elevator stands there**, on the landing's ground, joined to the two
front domes by the diorama's transfer hall: where we landed is where the city reaches orbit.

**Why.** A dome there would stand in the gate's corridor and on the sightline (round 8 left the same cell out for that reason), and the
elevator-city puts its station exactly here, on the front, joined to the ring. The elevator is not imported; its footprint will decide
whether it fits the 51 m cell.

So the city is **seven dome cells** round the plaza and the entry:

```
                  gate (-Z)
                     :
     NW        [ENTRY: landing]        NE        front row, z -70.2     (no bridges on this row)
     #                                  #
     W  . . . . [PLAZA: the KIDOU] . . . E       middle row, z 0
     #                  .               #
     SW ############    S    ########### SE      back row, z +70.2

     # a bridge       . a road the KIDOU drives (also the column lines, until their bridges stand)
```

### 3.3 The plan, checked

Cells at x, z ∈ {-70.2, 0, 70.2}. A scratch check on these numbers passes: 4 m between islands, every corner within 142 m of the centre,
nothing under a bridge, the sightline free, and the KIDOU's roads and turning circles clear (section 5).

| Piece | Size (m) | Where | Note |
| --- | --- | --- | --- |
| dome cells NW, NE, W, E, SW, S, SE | 20 x 20 | (±70.2, -70.2), (±70.2, 0), (±70.2, 70.2), (0, 70.2) | the domes at 0.65, empty until bought |
| plaza: the Stålheart (KIDOU) | 57 x 56 | (4.5, 0) | unchanged |
| entry: landing pad | 16 x 16 | (0, -60) | unchanged |
| **01 LAUNCH COURT** (front-left): ARC-01 launcher | 16 x 30 | (-36, -46), firing -Z | over the north rim between `dome-NW` and the entry |
| **04 CARGO COURT** (front-right): depot (pearls, rover pad, SAI-92) | 16 x 36 | (29, -50), turned a quarter | beside the gate: the rover's road short |
| **03 SOLAR SERVICES** (back-left): solar array | 20 x 20 | (-35, 42) | a first-orders card, as today |
| **02 FABRICATION COURT** (back-right): the garage | 12 x 18 | (35, 42) | the paint bay; parked in it the hull mends |
| HUGIN (outer belt, west) | 40 x 40 | (-119, 0) | the gunship's arm; it flies |
| tank bays (outer belt, back) | 36 x 32 | (0, 110) | doors toward the gate; the hull drives round `dome-S` |
| scoreboard (outer belt, back) | 12 x 36 | (-44, 104) | |
| radar, armory, farm, chip plant, assembly line | | **not placed on the dome base** | their roles are dome kinds (3.4); `?base=classic` keeps them |

The cargo and fabrication courts are swapped against the dome-city's numbering (its cargo court is back-right): the rover's road to the
gate decides it. Bridges: the six of a **U open toward the gate**: `NW-W`, `W-SW`, `NE-E`, `E-SE` along the columns, `SW-S`, `S-SE` along
the back row. The dome-city's other six (through the centre, and the front row to its research dome) have no dome to meet.

The plan at 6 m a character, from the scratch check (`G` the gate at the top, `D` dome cells, `=` bridges, `K` the plaza's Stålheart, `P`
landing, `L` launcher, `R` depot, `S` solar, `g` garage, `H` HUGIN, `B` bays, `b` scoreboard, `:` the clearing's last 8 m):

```
                         G
                  :::::::G:::::::
                ::::           ::::
              :::                 :::
            :::                     :::
          :::                         :::
         ::                             ::
        ::                               ::
       ::                                 ::
      ::                                   ::
     ::                                     ::
     :                                       :
    ::      DDD                     DDD      ::
    :       DDD                     DDD       :
   ::       DDD         PPP  RRR    DDD       ::
   :         =    LLL   PPP  RRR     =         :
  ::         =    LLL   PPP  RRR     =         ::
  :          =    LLL        RRR     =          :
 ::          =    LLL        RRR     =          ::
 ::          =    LLL        RRR     =          ::
 :           =                       =           :
 :           =       KKKKKKKKKK      =           :
 :HHHHHHH    =       KKKKKKKKKK      =           :
 :HHHHHHH    =       KKKKKKKKKK      =           :
 :HHHHHHH   DDD      KKKKKKKKKK     DDD          :
::HHHHHHH   DDD      KKKKKKKKKK     DDD          ::
 :HHHHHHH   DDD      KKKKKKKKKK     DDD          :
 :HHHHHHH    =       KKKKKKKKKK      =           :
 :HHHHHHH    =       KKKKKKKKKK      =           :
 :           =       KKKKKKKKKK      =           :
 :           =                       =           :
 ::          =    SSS         gg     =          ::
 ::          =    SSS         gg     =          ::
  :          =    SSS         gg     =          :
  ::         =                       =         ::
   :         =                       =         :
   ::       DDD         DDD         DDD       ::
    :       DDD=========DDD=========DDD       :
    ::      DDD         DDD         DDD      ::
     :                                       :
     ::          bb                         ::
      ::         bb   BBBBBBB              ::
       ::        bb   BBBBBBB             ::
        ::       bb   BBBBBBB            ::
         ::      bb   BBBBBBB           ::
          :::    bb   BBBBBBB         :::
            :::       BBBBBBB       :::
              :::                 :::
                ::::           ::::
                  :::::::::::::::
                         :
```

The builder re-runs the real placement rule in `test/dome-city.mjs` (which gains the KIDOU's roads) and prints the true plan; the scratch
check uses rectangles on a flat plane and does not model the sphere's sag or the models' own footprints.

**No single slab.** The dome-city stands on one 220 m square; on our 753 m sphere a slab sags past its 1.2 m limit beyond about 60 m, so
the city stays a set of islands. The square reads through the grid, the bridges and (stage 6) the road markings.

**The gate, the walls, the lane.** The walls ring the clearing's rim (150 m) with the gate at -Z; outside it the lane the bodies walk.
Inside, the gate's corridor runs down the entry cell, between the launch court and the cargo court, to the plaza and the Stålheart. A
breach at the gate meets the plaza first, not a dome.

### 3.4 The dome kinds, and what each gives

The player orders a dome by its **kind**; the kind is the module printed and the function it carries (unchanged from the first version,
which the owner did not overturn; the farm's pay is now 400 kg a sector at the owner's 10x):

| Kind (module) | Gives | Base price (x the board's index) |
| --- | --- | --- |
| LOGISTICS | **Replenishment shells**: its pad (12 m, at the dome's foot toward the plaza) refills the hull's shells two a second and restocks the flares; **+2 sentries** to the cap | 3,200 |
| RESEARCH | **The radar calls the mech cavalry**: the antenna on the dome's mast cradle; the Ridgebacks drop 8 days after it stands | 3,000 |
| FABRICATION | **The assembly line**: one lost hull rebuilt at each sector start; **+2 sentries** to the cap | 2,800 |
| BIOSPHERE | **The farm**: +400 kg at each sector start | 3,200 |
| POWER | **SOL's passes a fifth sooner** (the chip plant's perk) | 2,800 |
| HABITAT | nothing mechanical: the colony's people, counted for the finished city | 2,400 |

Each kind once, HABITAT up to twice: five kinds and two habitats fill the seven cells, as the dome-city has two habitats.
**The catapult** is its own building in the launch court (4,000 kg, from sector 4 after two manned SOL passes; SOL then fires on its own),
so the owner's three meaningful choices are LOGISTICS (shells), RESEARCH (the cavalry) and the catapult (the automated SOL). Skipping a kind
costs for good: no RESEARCH, no cavalry; no FABRICATION, no rebuilt hulls and a cap of 8.

### 3.5 What the player chooses: kind, cell, order

- The build board gains a second row, **THE COLONY**: a card for every kind still buildable. A dome is one of the board's two picks.
- After the kind, the base seen from above, the legal free cells ringed and numbered; a number or a click picks the cell.
- **All cells open from the first board** (before sector 2), with **one rule the gantry imposes**: the KIDOU reaches a corner through the
  middle cell of its column (3.6), so **W is printed after NW and SW, and E after NE and SE**. A locked cell says why: "the Stålheart drives
  through here to reach the corners".
- Order is the main choice (the index makes a late dome dear); where matters for the LOGISTICS pad (a front cell is a short trip from the
  gate and from a sortie) and for the city's look.

**The default city** (Isao's suggestion, highlighted on the card, and what an acceptance page stands), as near the dome-city as our grid
allows: **NW RESEARCH, NE LOGISTICS** (the dome-city's 13), **W BIOSPHERE** (21), **E FABRICATION** (23), **SW HABITAT** (31), **S POWER**
(the dome-city's centre, moved to the back middle), **SE HABITAT**. **The first dome Isao proposes is NE, LOGISTICS**: beside the cargo
court and the gate, the shells a sortie needs.

### 3.6 How the mobile Stålheart moves and prints

**At the start** nothing of the city stands: the SH02 lands on the entry's pad, Isao prints the gate and walls, the Rotor, the depot after
the first fight, and then the Stålheart itself on the plaza, its home (stage 7 of the flow; the KIDOU's 75 s print as today's Stålheart
step). No dome is printed in the opening; the first dome is the first board's pick, before sector 2.

**A dome job** (one at a time, queued from the board, worked during play):

1. Turn in place on the plaza (`applyKidou` `turn`, 0.39 rad/s) and drive (`drive`, **4 m/s**, the author's peak) along a road:
   - **the middle road** (z = 0) to W or E: 66-75 m, about 18 s;
   - **the back road** (x = 0) to S: 70 m;
   - to a corner: to W or E first, turn a quarter there (4 s), then along **the column road** (x = ±70.2) 70 m to the corner: about 45 s.
2. Straddle the cell, the dome between the beams under the fabrication origin; lower the arm (`fabricate`).
3. Print: the dome grows under the nozzle (the structure-print's clip plane, the nozzle 0.8 m over the layer, the beam across), **30 s**.
4. Drive home the same way. A middle cell is about 70 s door to door, a corner about two minutes.

**The roads are the grid's lines** (z = 0 across the plaza, x = 0 behind it, the two columns), 46 m wide (the gantry and 2 m a side), with
turning circles of 28 m at the plaza and at W and E. The dome-city runs its ground lane through the courts' centres; ours run on the dome
lines because the gantry straddles domes, and the courts sit between the roads. The column roads lie where the column bridges will stand,
which is why a column's middle cell waits for its corners: once W stands, both its bridges can print and the column road closes.

**The bridges** are Isao's, as today: due when both their domes stand and the KIDOU is home.

**What stays clear.** Until a road's last dome stands, the courts keep their pieces off it: the front courts are 37.7 x 37.7 m usable, the
back courts 24.2 x 37.7 m (the back road takes their inner side until `dome-S` stands). Pieces added later may use the freed ground.

**Its other jobs go with it.** The hull mends under its beams wherever it stands, the flares restock there; its footprint is solid wherever it
is, and the hull and the rover path round it.

**It fits the domes.** All six kinds share one envelope (the dome-colony's data): at 0.65 a dome is 19 m across, its shell 18.2 m tall and
its mast cradle 23.3 m. The KIDOU's beams stand about 28 m apart and it works under a 25 m height: the shell has 6 m to spare, the cradle
0.9 m. Check it in the engine (the cradle's last layer with the nozzle's 0.8 m) before the first print; if it fails, Isao prints the mast.

## 4. What stays as it is

The gate and walls, Isao's prints (gate, walls, repairs, sentries, depot, bays, HUGIN, launcher, solar, garage, the bridges), the domes'
0.65 scale and the bridges' length, the clearing's 150 m, the landing pad's place, the Stålheart's island, `?base=classic` untouched.

## 5. Story and flow checks the builders must make

- The reinforcements: with RESEARCH a choice, a player may never call them; the arena must not wait on the Ridgebacks (A1: the gunship's
  MK-9s kill THE KING in 34-40 s alone).
- The antenna close-up (`ANTENNA_CLOSEUP`, step `radar`) follows the RESEARCH dome's print.
- Day 42's ball hangs under the gantry's tip, wherever it stands.
- Chapters and SKIP TUTORIAL pages: they stand the default city's domes that their perks need, and nothing else.
- The rover's road from the cargo court to the gate (unmeasured; the economy design's measure reads it).

## 6. Staged build plan

1. **The KIDOU default on the dome base**, parked on the plaza. Suites: `--story-world`, `--base-look`, `--opening`, `--chapters`,
   `--rover`, the party's and the repair's. Check the cradle's height under the gantry (3.6).
2. **The grid.** `src/content/dome-city.js`: the seven cells on the 70.2 m grid (the columns move in from x ±80), the six bridges, the court
   placements (3.3); radar, armory, farm, chips and assembly leave the dome layout. `test/dome-city.mjs` gains the roads and turning circles
   and prints the plan. Browser `--story-world`, `--base-look`, `--launch`, `--rover`, a hull drive round the city.
3. **Kinds, cells and the colony row**, Isao still printing the domes: content `src/content/colony.js` (cells, kinds, prices, the corner rule);
   the perks read from the kind; a generic dome step (cell, kind). `test/build-board.mjs`, `test/base-programme.mjs`; browser `--board`
   (LOGISTICS bought: the pad refills; RESEARCH bought: the reinforcements' day set), `--colony`, `--dome-print`.
4. **The KIDOU drives and prints**: the driver, the turns, the straddle, the print under the tool, home, the bridges after it. Browser
   `--dome-print` (NE printed by the gantry; then NW, SW and W, the column's bridges after W; a still mid-print), `--repair`.
5. **The cell picker.** Browser `--board`: a real click puts a dome on SE.
6. **The dressing**: road markings on the roads, the courts' small props from the dome-city (collector, drills, heliostats, cassettes,
   containers) where they fit; the corner domes' cradles as sentry mounts is a later defence choice.
7. **The space elevator** at the entry, at the run's end: import the station and tether (SentryTowers_A6 `space-elevator/`), its transfer
   hall to NW and NE; it waits for the ending's design (the cave and the Queen).

## 7. What could not be established

The viewers' JavaScript and their road markings; the space-elevator station's footprint; the rover's road length from the cargo court; whether
the hull and the rover move comfortably round the KIDOU while it is out on a corner job (the column roads are 46 m, the plaza between the
Stålheart's island and the column roads 14-23 m a side). No picture of either reference was seen by me; the owner's descriptions of his two
screenshots and the published numbers are what this design rests on.

## 8. The alternatives the owner may prefer

- **A power dome in the centre** (the dome-city exactly): then the gantry cannot live on the plaza; it would print the centre first, from the
  plaza, and move to a home outside the grid (the outer belt has no 48 m room at the corners: the back belt behind `dome-S` is the only place).
- **A dome on the entry cell** (nine domes): the gate's corridor and the sightline would have to move off x = 0.
- **The KIDOU at 0.75**: courts would keep more room (its width 32 m), but its 18.8 m working height no longer clears a dome's mast cradle.

## 9. For the owner's eye

The plaza instead of the power dome; the entry cell and the elevator on it at the end; the courts' contents and the cargo/fabrication swap;
HUGIN, the bays and the scoreboard on the outer belt; the default city; the corner rule (W and E after their corners); the U of six bridges
instead of twelve; the KIDOU's 4 m/s and 30 s print.
