# The colony re-laid toward the elevator-city diorama, printed by the mobile Stålheart (design, 2026-11-12)

Written by the design agent while the owner was away, from his words of 2026-11-12: "we want to overhaul the layout to be more like [the
elevator-city diorama], which probably necessitates updating stalheart to its mobile version [KIDOU]"; and "Stalheart builds the dome, the
player chooses the order of what goes where, and some are meaningful, e.g. getting replenishment shells, or the radar calling in the Mech
cavalry, or the catapult launching an automated SOL." **This is a visual design: every position below needs the owner's eye before it is
built** (section 7). Each call is also a line in `docs/DECISIONS.md` under "Called by the design agent on 2026-11-12". Nothing here is built.

## 1. The diorama, as far as it could be read

Read on 2026-11-12 from the published page (`SentryTowers_A6/elevator-city-diorama/`) and its two linked files, `assets/elevator-city-diorama/
layout.json` and `README.md`. **Not read:** the viewer's own JavaScript (the fetch returned the page as text, without its script URLs), the
`validation.json` files, and any picture of the city: I have not seen it, only its numbers and captions.

- **Eight domes on a 3 x 3 grid, the centre cell empty.** Columns x = -48, 0, 48 m, rows z = 62, 110, 158 m, all at full scale (the dome
  module's ±14.6 m). Front row: habitat, logistics, research; middle: biosphere, (empty centre), fabrication; back: power, habitat, research.
- **A closed ring of eight hallways** between neighbours (`links` [[0,1],[1,2],[0,3],[2,4],[3,5],[4,7],[5,6],[6,7]]), each a 20 m span
  between sockets at y 9.7 m, so the domes stand 48 m apart. The empty centre is a civic plaza (utility banks, road markings).
- **One way in.** Outside the ring, on its front, the space elevator's surface station; a transfer hall runs from the station's observation
  level (z 23) to the logistics dome's front socket (z 48). The station has one hangar with a parked MÖRK; a second MÖRK patrols.
- Captions: "Eight domes. One city." "Homes, research, a biosphere, power, fabrication and logistics share an elevated hallway network."
  The rest of its 112 s is the climb to orbit, the KORP gunship crossing and SOL-82 and SOL-88 in orbit.
- Its status is a diorama, not a game layout: "interior transfer / collision / navigation" pending.

The reading I take from it: **a compact ring of domes round an empty plaza, linked to each other, entered from one side.** Our dome city
today has the domes but not the ring: two columns of three far out east and west (x ±80), the colony's other buildings scattered between
them and the Stålheart (`src/content/dome-city.js` `DOME_PLACEMENT`).

**The KIDOU** (published page `stalheart-kidou/`, its manifest and `runtime.js`; the vault copy `a6-2026-11-07/stalheart-kidou/`, and the
144 s construction diorama `a6-2026-11-07/stalheart-diorama/`): 42.1 x 39.9 x 24.0 m, two 24 m beams on eight steered wheels (x ±16 m),
plot 48 x 28 m. Modes park, drive, crab, turn, suspension, fabricate; the author's drive peaks at about 3.9 m/s, the pivot turns 0.39 rad/s.
In the construction diorama it rolls 52 m and prints a **half-scale** habitat dome between its beams in 28 s, the nozzle 0.8 m over the
layer, under a 25 m working-height limit. It is in the game as a parked look behind `?gantry=kidou` (`src/fx/kidou-rig.js`); the rail
terraformer is still the default.

## 2. The calls

### 2.1 The mobile Stålheart becomes the default on the dome base

**Call.** `?base=dome` (the default) stands the KIDOU; `?base=classic` keeps the rail terraformer. The systems that read the rail model are
already guarded (the base-from-scratch spec, call C). *Why:* the owner tied the layout to it, and the domes cannot be printed by a gantry
that does not move.

### 2.2 Six dome slots in today's positions, round a cleared plaza

**Call.** The ring is today's six dome positions: `dome-nw` (-80, -70.2), `dome-w` (-80, 0), `dome-sw` (-80, 70.2), `dome-ne` (80, -70.2),
`dome-e` (80, 0), `dome-se` (80, 70.2), 20 x 20 m islands, domes at 0.65, the four north-south bridges as today. They stop being six fixed
domes and become **six slots**. The centre is cleared into a **plaza**: nothing stands inside the ring but the Stålheart's island, which is
the KIDOU's home. The front of the ring, on the mouth's side, is the city's one way in (the diorama's station side): the gate, the landing pad
and the sightline. The back centre stays the bays.

*Why:* our clearing already has the diorama's shape (a 3 x 3 grid minus the centre) except that the front centre is the mouth and the back
centre is the bays; keeping the six positions keeps the bridges, their caps and `test/dome-city.mjs` as they are. What makes it read as the
diorama is the plaza and the functions inside the domes, not more domes.

**The alternative the owner may prefer (closer to the diorama): seven slots and a closed U.** A back-centre dome where the bays are (the
bays moved to the outer east belt), columns moved in from x ±80 to x ±70.2 so east-west bridges can join the back row: a ring open only on
the mouth's side. It moves the bays, the hull's roll-out and every column, so it is a second round, not this one.

### 2.3 What stands where (the plan, checked)

Everything that is not a dome leaves the plaza, because the KIDOU (42 m wide) must drive from its home to any slot; each straight corridor
from the Stålheart's island to a slot, 46 m wide (the KIDOU plus 2 m a side), must be clear. A scratch check on these numbers (4 m between
islands, every corner inside 142 m of the centre, nothing under a bridge, the sightline x ±6 m free, the six KIDOU corridors clear) passes:

| Island | Size (m) | Today (dome base) | Called | Note |
| --- | --- | --- | --- | --- |
| stalheart | 57 x 56 | (4.5, 0) | (4.5, 0) | the KIDOU's home, the plaza's centre |
| landing | 16 x 16 | (0, -60) | (0, -60) | the way in |
| bay | 36 x 32 | (0, 62) | **(0, 66)** | 4 m back so the corridor to `dome-sw` clears it |
| launcher | 16 x 30 | (-50, -92) | **(-50, -104)** | still fires -Z over the north rim |
| depot | 36 x 16 | (42, -86) | **(34, -108)** | beside the gate: the rover's road short |
| solar | 20 x 20 | (44, -60) | **(-24, -106)** | front-left of the way in, a short drive for the hull's charges |
| hugin | 40 x 40 | (-52, -36) | **(-118, 0)** | outside the west column; the gunship flies |
| board (scoreboard) | 12 x 36 | (-36, 6) | **(-40, 104)** | back belt |
| garage | 12 x 18 | (31, 62) | **(40, 100)** | back belt |
| radar, armory, farm, chips, assembly | | various | **not placed** | their roles move into domes (2.4); classic keeps them |

The plan at 6 m a character, printed by the scratch check on the table above (the mouth and gate `G` at the top, -Z; `K` the Stålheart's
island, `D` the dome slots, `=` the bridges, `P` the landing, `B` the bays, `L` launcher, `R` depot, `S` solar, `H` HUGIN, `b` scoreboard,
`g` garage; `:` the clearing's last 8 m):

```
                         G
                  :::::::G:::::::
                ::::           ::::
              :::                 :::
            :::                     :::
          :::                         :::
         ::     LLL SSS     RRRRRR      ::
        ::      LLL SSS     RRRRRR       ::
       ::       LLL SSS     RRRRRR        ::
      ::        LLL SSS                    ::
     ::         LLL                         ::
     :                                       :
    ::    DDDD                       DDDD    ::
    :     DDDD                       DDDD     :
   ::     DDDD          PPP          DDDD     ::
   :        =           PPP           =        :
  ::        =           PPP           =        ::
  :         =                         =         :
 ::         =                         =         ::
 ::         =                         =         ::
 :          =                         =          :
 :          =        KKKKKKKKKK       =          :
 :HHHHHHH   =        KKKKKKKKKK       =          :
 :HHHHHHH   =        KKKKKKKKKK       =          :
 :HHHHHHH DDDD       KKKKKKKKKK      DDDD        :
::HHHHHHH DDDD       KKKKKKKKKK      DDDD        ::
 :HHHHHHH DDDD       KKKKKKKKKK      DDDD        :
 :HHHHHHH   =        KKKKKKKKKK       =          :
 :HHHHHHH   =        KKKKKKKKKK       =          :
 :          =        KKKKKKKKKK       =          :
 :          =                         =          :
 ::         =                         =         ::
 ::         =                         =         ::
  :         =                         =         :
  ::        =         BBBBBBB         =        ::
   :        =         BBBBBBB         =        :
   ::     DDDD        BBBBBBB        DDDD     ::
    :     DDDD        BBBBBBB        DDDD     :
    ::    DDDD        BBBBBBB        DDDD    ::
     :                                       :
     ::           bb                        ::
      ::          bb           gg          ::
       ::         bb           gg         ::
        ::        bb           gg        ::
         ::       bb                    ::
          :::     bb                  :::
            :::                     :::
              :::                 :::
                ::::           ::::
                  :::::::::::::::
                         :
```

The builder re-runs the real rule in `test/dome-city.mjs` (which gains the corridor check) and prints the true plan into the entry; the
scratch check samples island rectangles against straight corridors and does not model the sphere's sag or the models' own footprints.

### 2.4 The six kinds of dome, and what each gives

**Call.** The player orders a dome by its **kind**; the kind is the module the KIDOU prints and the function it carries. The colony's old
standalone buildings fold into the kinds, their perks unchanged and moved:

| Kind (module) | Gives | Was | Base price |
| --- | --- | --- | --- |
| LOGISTICS | **Shells and flares**: its pad (12 m, on the plaza side of the dome) refills the hull's shells two a second and restocks the flares; **+2 sentries** to the cap | the armory and its ammunition dump | 3,200 |
| RESEARCH | **The uplink**: the radar's mast on the dome's roof cradle; the mech reinforcements drop 8 days after it stands, as today | the radar (an automatic step today) | 3,000 |
| FABRICATION | **The assembly line**: one lost hull rebuilt at each sector start; **+2 sentries** to the cap | the assembly line (automatic today) | 2,800 |
| BIOSPHERE | **The farm**: +800 kg at each sector start; the three bio cassettes beside it | the greenhouse | 3,200 |
| POWER | **SOL's passes a fifth sooner** | the chip plant | 2,800 |
| HABITAT | nothing mechanical: the colony's people, counted for the finished city | a habitat dome | 2,400 |

Each kind once; six kinds for six slots. Prices are base prices times the board's index (the economy design calls the index [1, 2, 4,
4.5, 5]), so an early dome is cheap and a late one dear: **when** you build is a price, not only an order.

**The catapult stays its own building.** The ARC-01 launcher (46 m rail) cannot be a dome. It keeps its card (4,000 kg, from sector 4, after
the player's two manned SOL passes) on its own plot, and when it stands SOL fires on its own. The owner's three meaningful examples are
thus LOGISTICS (shells), RESEARCH (the cavalry) and the launcher (the automated SOL).

*Why:* the smallest change that makes the choice real is to give the six domes, which today "do nothing" (E9), the perks the scattered
buildings already carry; no new perk is invented. Two automatic steps (radar, assembly line) become the player's choice, so skipping one
costs something real: no research dome, no cavalry, ever; no fabrication dome, no rebuilt hulls and a cap of 8 at most.

*What the owner may prefer:* the old buildings kept as models beside their dome (the greenhouse beside the biosphere dome, the armory
beside logistics): richer, but the plaza has no room for them, so they would go on the outer belt.

### 2.5 The player's choice: what, when and where

- **What and when (stage 2):** the build board gains a second row, **THE COLONY**, one card for every kind not yet built while a slot is
  open. The two picks are shared with the first row: a dome is one of the board's two picks. *Why a second row:* the board's six cards are
  drawn (`structuresMax` 4), and a draw would choose the order for the player, which is the one thing the owner said is his.
- **Slots open in pairs**, as today's dome steps do: the front pair (`dome-nw`, `dome-ne`) from the first board (before sector 2), the
  middle pair from the second, the back pair from the third.
- **Where (stage 4):** after the kind, the camera cuts to the base from above with the free open slots ringed and numbered; a number or a
  click picks one. Until stage 4 the KIDOU takes the nearest free open slot.
- **Where it matters:** the logistics pad is where the hull refills shells and flares, so a front slot means a short trip from the gate and
  from a sortie; a back slot a long one. Everything else is the player's city, laid out as he likes. Placement is mostly looks; order is
  the meaningful choice. If the owner wants more of "where", the next lever is that a dome on the mouth's side takes damage in a breach.

### 2.6 How the mobile Stålheart moves and prints

**Call.** One job at a time, queued from the board's picks; it works during play, not only between waves (Isao's own prints keep their
`idle` gates).

1. **Leave home.** It turns in place to face the slot (`applyKidou` `turn`, 0.39 rad/s, at most 8 s) and drives straight there along its
   corridor (`drive`, **4 m/s**, the author's peak; 76-85 m to a middle slot, 103-110 m to a corner: 19-28 s). The driver is the rover's (the
   body moved over the sphere, the wheels' spin from the root's actual displacement), as the base-from-scratch spec planned.
2. **Straddle.** It stops with the slot's centre between its beams, under the fabrication origin, and lowers its arm (`fabricate`, the
   tool parked 10.45 m down).
3. **Print.** The dome grows under the nozzle as the diorama's does: the structure-print's clip plane climbs, the nozzle rides 0.8 m over
   it, the beam across the gap; **30 s** a dome (today's dome step is 18 s by Isao; the diorama takes 28 s for a half dome).
4. **Home.** It raises the arm and drives back the way it came. A job is about 90 s door to door.
5. **The bridges** are Isao's as today, due when both their domes stand **and the KIDOU is home** (it is 40 m tall and never passes under
   one).

While it is away, its gantry's jobs go with it: the hull mends under its beams wherever it stands (as the repair rule reads the holder's
box), and the flares restock there. Its footprint is solid wherever it stands; the hull and the rover path round it.

**A check before building: the domes' height.** The diorama fits a half-scale dome (17.9 m tall) under the 25 m working height with 7 m to
spare. Ours are 0.65: the habitat is then about 23.3 m tall, 0.9 m under the limit with the nozzle's 0.8 m, and centred 2.6 m behind the
fabrication origin it overhangs the beams' ends by about 0.1 m. The other five modules' heights were not read. Measure all six at 0.65
first; if one does not fit, that kind is printed at 0.6 or the slot's dome is centred under the gantry rather than its tool.

## 3. What stays as it is

The gate and walls, Isao's prints (gate, walls, repairs, sentries, bays, HUGIN, depot, launcher, the bridges), the bays' doors toward the
gate, the four bridges and their caps, the domes' 0.65 scale, the clearing's 150 m, the classic base behind `?base=classic` (its programme
and islands untouched). The opening is frozen until the tour: the KIDOU's own print (Isao's 75 s `stalheart` step) is unchanged in
time; giving it the diorama's order (left leg, right leg, the span, the roof, the arm) is a later look.

## 4. Staged build plan

1. **KIDOU default on the dome base** (`?base=dome`, parked). Suites: `--story-world`, `--base-look`, `--opening`, `--chapters`, `--rover`,
   the party and the repair's suites. Measure the six modules' heights at 0.65 (2.6's check) and record them.
2. **The plan.** `DOME_PLACEMENT` moves (the table in 2.3); radar, armory, farm, chips and assembly leave the dome layout; `test/dome-city.mjs`
   gains the KIDOU corridor rule (46 m wide, from the Stålheart's island to each slot) and the plan print. Isao's programme drops the
   steps whose islands are gone on the dome base, and their perks move to the kinds (stage 3). `--story-world`, `--base-look`, `--hull`
   drive through the plaza, `--launch` (the launcher's shot from its new plot), `--rover` (the new road).
3. **Kinds and the colony row.** Content `src/content/colony.js` (the slots and their pairs, the six kinds: module, perk, base price,
   effect line); the perks read from the kind's dome (`BASE_PERKS` unchanged in value; `sentryCap` from the economy design); a dome job's
   step is generic (slot, kind) instead of six fixed steps. The board's second row (the domain picks, the card draws). The KIDOU still
   parked: Isao prints the dome as today. `test/build-board.mjs`, `test/base-programme.mjs`; browser `--board` (buy LOGISTICS, the pad
   refills; buy RESEARCH, the reinforcements' clock starts), `--colony`, `--dome-print`.
4. **The KIDOU drives and prints.** The driver, the turn, the straddle, the print under the tool, the way home, `when.home` on the bridges,
   the footprint moving. Browser `--dome-print` (two domes printed by the gantry, the bridge after both and after the gantry is home, a still
   mid-print), `--repair` (the hull mends under the gantry away from home).
5. **Where.** The slot picker. Browser `--board`: a real click picks the back slot, the dome prints there.
6. **The plaza dressed** (the diorama's utility banks and road markings), only once the owner has seen 1-5.

## 5. Story checks the builders must make

- The reinforcements: today the radar is automatic at sector 2. With RESEARCH a choice, a player may never call them; the arena then has no
  mechs and is fought with the gunship (A1: the MK-9s kill it in 34-40 s on their own). Confirm the arena does not wait on the Ridgebacks.
- The antenna close-up (`ANTENNA_CLOSEUP`, step `radar`) follows the research dome's print.
- Day 42's ball hangs under the gantry's tip: if the party falls while the KIDOU is out, it plays where the KIDOU stands.
- Chapters and SKIP TUTORIAL (stage 8 pages): which domes stand there. Call: none (an empty ring, the player builds his own), except on the
  acceptance pages that need a perk.

## 6. What could not be established

The elevator city's viewer code and a picture of it; the heights of five of the six dome modules at 0.65; the rover's road length from the
new depot (the economy design's measure reads it); whether the hull fits comfortably through the plaza with the KIDOU out on a corner job
(corridor 46 m; the plaza between the Stålheart's island and the domes is 37 m wide on the east and 46 m on the west).

## 7. For the owner's eye

The plan in 2.3, above all HUGIN outside the west column and the launcher, depot and solar at the gate; the six kinds' functions and
whether habitat should give anything; the radar mast on the research dome's roof; whether the diorama's look needs the closed U (2.2's
alternative); the KIDOU's 30 s print and 4 m/s drive; a dome printed at 0.65 under a gantry built for 0.5.
