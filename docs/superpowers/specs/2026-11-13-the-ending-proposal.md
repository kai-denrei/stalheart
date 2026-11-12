# The ending: the Queen, the finished base, a new planet (proposal, 2026-11-13)

The owner, 2026-11-12: "ending will be Queen dead and Dyson sphere finished. ability to run around the finished base and
observe, then start over on another procedurally generated planet. tbd."
The same day: THE KING is a male, so a Queen below; "The Arena; all the elements should be there already" (re-use before
new machinery); the colony is a 3 x 3 dome city printed by the KIDOU; "first we want the flow of stages", difficulty later.

Nothing here is built. Facts are read from the code and docs on main c8c4be48. Anything inferred, not read, says
**(assumed)**. Sizes: **small** (a day or less), **medium** (a few days), **large** (a week or more, or a second repo).

## The short version

1. **The Queen: she fights back, one charge (option 1B).** In the nursery she reaches for Isao with the King's
   tell-and-charge rules; flares make her flinch and turn, as the 40 mm does to the King. Isao still plants one charge
   and flies out. Her death is shown on the surface: the hole caves in, the swarm goes grey. Medium, mostly in the cave repo.
2. **The finished base: walk it as the recon dog (option 2A).** After the constellation and the campaign card, the
   player takes the K9 round the quiet colony he built. The sphere's ring is full in the sky. It ends at the LAUNCH
   court: the ARC-01 fires, Isao says "Ready for the next one?". Small to medium, almost all re-use.
3. **A new planet: a catalogue of baked seeds (option 3B).** Planet 1 stays seed 7 (the tutorial planet). Planets 2+
   come from a few pre-baked, checked seeds, each with its own name, ground and sky colours. Nothing carries over but
   the planet number and a logbook. Medium.

## What exists today, from BOTH WALLS to the end

| Step | What happens | Code |
| --- | --- | --- |
| BOTH WALLS secure | the descent's brief, the camera dives down the arena's hole | `src/fx/descent-host.js`, `src/fx/hole-door.js` |
| The cave | Isao flies by hand, places the charge by the Queen, flies out on a 100 s fuse | `below/` (repo `kai-denrei/stalheart-cave` at 55fbce5) |
| The outcome | `rescued`, `sacrifice` (ending) or `lost` (the cave's TRY AGAIN) | `below/src/handoff.js`, `src/domain/descent.js` |
| The rise | the camera climbs the same hole; Isao's decoding joke | `descent_back` / `descent_last` |
| The diorama | hull, Isao and the companions before the rivalry boards, 8 s (20 s with DAY 42) | `src/fx/finale-diorama.js` |
| The constellation | 48 HEL-01 heads from our own ARC-01 onto three rings, 26 s, Isao's three lines | `src/fx/orbital-finale.js` |
| The campaign card | THE COLONY HOLDS, THE RUN, THE BEST MOMENTS, THE COLONY RISES | `src/fx/sector-debrief.js` |
| After | KEEP HOLDING (generated sectors) or NEW RUN (`h.reload()`) | `src/fx/sector-run.js` |

---

## 1. The Queen

### Today, as the code has it

- Isao is a drone, flown by hand: W S fly, A D turn, Space Shift up and down. 15 flares (F, they stick to rock),
  the LiDAR (Q), a lamp that fails after the second hit.
- 12 points of airframe. Any touch (wall, tentacle, egg, her body) costs one, at most one every 1.4 s.
- The Queen is the Nih-Dairia kit's six-limb soft body ("ovum"), 620 x scale, anchored by 16 tethers in a chamber
  180 m wide and 116 m tall. She creeps about 6 m, breathes, lays an egg every 8 s.
- **She never aims at Isao.** Her motion target circles her own body on a 0.2 clock (`below/src/queen-motion.js`).
- The kill: hold E for 3 s anywhere within 70 m of her (`closeToQueen`). Then a 100 s fuse, hurried 4x if he is out early.
- The HUD already says QUEEN / CONFIRMED and SUBSURFACE DETONATION, COLONY / SOURCE DESTROYED.
- **On the surface her death shows nothing.** The game gets `rescued` or `sacrifice`, Isao's joke, then the diorama.
  The arena's hole stays open; any bodies still alive stay alive.
- On a phone the cave is skipped: the brief, then the ending.

### The King's rules, and what they need

`src/domain/king-fight.js` is pure and flat (points `[x, z]`), numbers in `ARENA_KING`:

| King rule | What it does | Needs |
| --- | --- | --- |
| `pickTarget` | lowest score of distance, less a bias for attackers and the bait | a list of targets |
| `stepKing` | stalk, **tell** 1.5 s, **charge** at the point locked at the tell, recover | a target and a speed |
| `shellHit` | a 40 mm burst near it: **stagger** (falls off), then **veer** away from the burst | a burst point |
| `nukeCall`, `nukeShare` | mark, 8 s to impact; on the mark it loses 30 % | a marked point, a blast radius |
| `friendlyHits` | your own blast hurts friends | units and radii |

**Underground there is no gunship.** What can stand in for it:

- **The 40 mm's job (stop it, turn it) → the flare.** A flare landing near her is the burst. She flinches and turns
  away from the light (assumed fiction: she lives in the dark). The flares already exist, are counted (15) and stick.
- **The MK-9's job (the big hit) → Isao's charge.** Today one, armed by hand. A real fight gives him more than one.
- **The mechs' job (targets that pull her) → lit flares as decoys** (`pickTarget` with a flare as a target, the way
  the hull is the bait in the arena).

The cave already copies game files into `below/src/stalheart/` (pearl tiers, the sinkhole's shape, the carcass tube).
`king-fight.js` has no imports, so it can be copied the same way; its numbers would be a cave table like `ARENA_KING`.

### The options

| | **1A. Her death, staged** | **1B. She fights back, one charge** | **1C. The King's fight, underground** |
| --- | --- | --- | --- |
| The player | as today: find her, plant, fly out | as today, but she reaches for Isao; flares make her flinch | she tears free and hunts Isao round the chamber; he herds her onto charges with flares |
| The kill | the one charge | the one charge | three charges, each a third of her |
| The tell | she wakes as the charge arms: a scream, her arms rise | the King's tell before every reach: a red ring, THE QUEEN REACHES | as the King: tell, charge, recover |
| The escape | the 100 s fuse, as today | the fuse; her arms still reach until the blast | after the third blast the chamber collapses: the fuse |
| Re-uses | the cave whole; the rise; the dead grey; the hole's floor | 1A, plus `stepKing` and `shellHit`, the flares, the airframe points | 1B, plus `pickTarget`, `nukeCall`, `nukeShare`, `friendlyHits`; the arming hold |
| New | a wake-up cue in the cave; the surface proof (below) | her arms aimed at Isao (the kit's pursuit, given a target); a flinch and a turn; a QUEEN row | her tethers break; she walks the chamber at full clock; charges as timed mines; her points |
| Size | **small** (half of it game-side) | **medium** (cave repo) | **large** (cave repo; her body at full clock not measured) |

**The surface proof, for every option** (game side, small). After the rise:

- the arena's hole **caves in** (the hole that "never closes" closes now, for a reason);
- every body still on the planet stops and goes to **the dead grey** (exists, round 4 of DAY 42);
- a row on the strip and a line: QUEEN · DEAD; Isao's joke stays (`descent_back`).

On a phone, where the cave is skipped, this is the whole of her death. It is also what a player sees if Isao is lost
(`sacrifice`): the charge did its work.

**1B in a few numbers** (start values by analogy to `ARENA_KING`, to be measured): she reaches when Isao is within
40 m, after 2 s; the tell 1.5 s; the reach goes to where he was at the tell; a reach that touches him costs 2 points
(of 12); a flare within 8 m of her body or a reaching arm staggers her 1.2 s (halving on repeats, like the 40 mm) and
turns her reach away for 2.5 s. Planting still takes 3 s holding still: the player plants in her recovery, or behind
a flare.

**1C in a few numbers:** she is the King's size of problem in a smaller room (the chamber is 180 m, the arena 280 m).
Isao carries 3 charges; a charge dropped is the mark, it blows 8 s later; within its blast she loses a third; Isao
inside it loses 4 points. Unknown: whether her soft body holds the frame at full clock and 620 x scale (today 0.2).

### The tie to the King

- Isao's `arena_decoded` already says it: "A King means a Queen. She is down there, in the nest."
- The King's carcass lies at the hole's lip; the cave builds it from the hand-off. In 1B and 1C her first tell can
  come as Isao passes it: one new line, "She knows what we did to him." (caption until recorded).
- Same words, same readout: the strip's row THE QUEEN like THE KING; the red tell ring and a callout THE QUEEN REACHES
  like THE KING CHARGES; 1C's charges read MARKED · IMPACT IN n S like the King's nuke.

### Recommendation

**1B, with 1A's surface proof built first.** It turns "fly to a spot, hold E" into a short fight with the verbs the
player has (fly, flare, plant) and the King's grammar (tell, flinch, turn), and keeps the cave's escape, which the
owner has tuned three times. 1C is the real boss fight, but it changes the cave's best part (the dark, the search, the
climb out) into an arena, and it is the one option with a frame-rate unknown. Keep it for after a playtest of 1B.

### The owner decides

- 1B or straight to 1C.
- Does she flinch from light (the flare as the 40 mm)? The fiction is mine.
- Does the hole cave in at her death? (It was kept open on 2026-10-26, for another reason.)
- Does `sacrifice` (Isao lost) stay as an ending, and then who speaks in the walk?

---

## 2. The finished base

### The ending's order, proposed

1. The cave; the Queen dies (part 1).
2. The rise; **the surface proof** (the hole caves in, the swarm goes grey).
3. The diorama and **the constellation** (exist, as now): this is "the Dyson sphere finished". Its third line,
   "Ready for the next one? AH AH!", moves to the launch (step 6).
4. The campaign card (exists). Its buttons: **WALK THE COLONY**, KEEP HOLDING, NEW PLANET.
5. **The walk** (new).
6. **The launch** from the LAUNCH court, then the next planet (part 3).

### Who the player is

| | **2A. The recon dog (K9)** | **2B. The tank (MÖRK)** | **2C. Isao, the drone view** |
| --- | --- | --- | --- |
| Exists | the dog's seat: a chase camera 8 m back, 3.1 m/s trot, 6.5 sprint, stopped by rock and buildings (`src/fx/dog-scout.js`) | the free drive | "flying him yourself" in the drone view (`src/fx/isao-worker.js`); the campaign board's VICTORY LAP already parks a debrief and flies Isao |
| The scale | ground level among 19 m domes and 23 m masts: the city looks big | a war machine on a victory walk | from above: the plan, the courts, the ring in the sky |
| Phones | yes: the stick writes the same keys | yes | no: phones turn the drone view into third person |
| Bookend | the dog's survey opened the run; the dog closes it | | Isao built every piece |
| New | a free mode: no survey points, no pack, no knock-downs | a quiet mode (no ram readout, no shells) | an ending mode on the story page (assumed: the story never uses the drone view today) |
| Size | **small** | **small** | **small to medium** |

### What there is to see

| Thing | Today | For the walk |
| --- | --- | --- |
| The domes and courts he built | they stand where printed | a plate on approach: kind, the sector it was printed in, its price (new, small) |
| Each dome "alive" | the dome models are still (assumed) | lights at night, a turning antenna on RESEARCH, the pad working on LOGISTICS (new, medium; later) |
| The empty cells | plots | stay empty: his city, his choices (a call, below) |
| The units that survived | sentries in place; the companions; the hull | as they are; Ridgebacks still standing walk home (down ones stay wrecks, as in the fight) |
| The sphere | the orbital works' ring: a light per SEED-01 collector, capped at 20 (`src/fx/orbital-ring.js`) | the ring full in the sky for the walk (small; whether it reads in daylight is not measured) |
| The swarm | | gone grey (the surface proof) |
| The ledger | the campaign card: kills, score, combos, rams, hulls lost, biomass, leaks, kills by source per sector; the best moments as clips; the colony's stills at every print | re-open it from the walk (a key or the scoreboard); add a page **THE LOG** (below) |

**THE LOG**, one page, the run in order. What is kept today and what is new:

- kept: the outcome of the cave (`story.descent`), per-sector books (`src/domain/sector-stats.js`), the stills at
  every print (`src/fx/colony-lapse.js`);
- new, small: **the landing grade** (the arrival knows it, the run's books do not keep it (assumed));
  **the build order with times** (the stills show it as pictures; a list of picks is not kept (assumed));
  **losses**: hulls (kept), Ridgebacks down, Isao (rescued or not).

### How long, and how it ends

No clock: the walk lasts until the player leaves. After about 90 s Isao says the launch is ready (one line, a caption).

| | **The card's button** | **The ARC-01 launch** | **The space elevator** |
| --- | --- | --- | --- |
| The player | presses NEW PLANET | walks the dog into the LAUNCH court, presses E | walks into the entry cell, rides up |
| Re-uses | the card | the ARC-01 and its launch beat (`src/fx/arc-launch.js`), the launcher in the LAUNCH court (colony design 3.3) | the entry cell kept for it (colony design 3.2) |
| New | the button | the trigger, the camera following the sled up, the third line | the station and tether imported from SentryTowers_A6, a ride |
| Size | small | small | large |

### Recommendation

**The dog (2A), ended by the ARC-01 launch.** It re-uses a seat the owner already likes, works on a phone, keeps the
player on the ground where the city is big, and bookends the run. The launch is a piece that already exists and stands
in the LAUNCH court, and "Ready for the next one?" becomes the hand-over to the next planet instead of a line before
the score. The elevator stays the long-term picture for that cell, built later or never.

### The owner decides

- The dog, the tank, or Isao's drone.
- "Finished base": what the player built, or does Isao print the empty cells as the sphere finishes?
- The exit: the ARC-01 launch, or wait for the space elevator.
- The constellation where it is (after the Queen), or as the launch's own shot.
- KEEP HOLDING: keep it on the card, or cut it now that the run has an end.

---

## 3. A new planet

### What makes a planet today

- `STORY_RECIPE` (`src/content/story-defaults.js`): **seed 7**, 16,000 points, 384 rooms, 10 m cells, 4 m walls.
- The pinned kernel turns that into the lattice and its maze. The result is baked (`assets/story/planet.bin`, 1.07 MB).
  A live build measured 8.8 s in Node and about 5 s in Chrome (entry `2026-09-12-planet-bake`); the bake loads in 0.8 s.
- `?seed=N` exists, but it changes **the run's dice**, not the planet: breach picks, the landing's drift. The story
  world always builds from `STORY_RECIPE` (`src/platform/story-world.js`).
- `STORY_SANITY` pins seed 7's cell count, heart cell and cell side; two labs read the planet's radius from it.

### What the generator can and cannot vary

| Thing | Follows the seed? | How | Note |
| --- | --- | --- | --- |
| The terrain, the maze, the rock | yes | kernel + carve | the main change you would see |
| The clearing and the base | no, by design | always 150 m round the pole; the base in pad metres | the colony looks the same on every planet: good |
| The gate's mouth | yes | the first usable mouth (`story-planet.js`) | a seed can fail: no mouth that fits the gate |
| The arena's place | yes | the farthest reachable cell (`pickArenaCell`) | |
| The back door's mouth | yes | the sealed mouth nearest +Z (`findBackMouth`) | a seed can fail |
| The canyon | yes | cut at the antipode (`canyonPlan`) | |
| Breach cells | yes | rings of hops, the run's dice | |
| The landing sites (rocket-a..d) | **no** | fixed x, z in `base-layout.js`, "anchor: open" | assumed to snap to open floor; must be checked per seed |
| The galaxy sky | already random | a fresh galaxy seed each run (`?sky=N` pins it) | |
| The black hole, the nebulae | no | fixed directions (`SKY_HOLE`, `SKY_VEIL`, `SKY_BLOOM`) | a per-planet turn is small |
| Day, dusk and night colours | no | `STORY_DAY` constants | a palette row per planet: small |
| The ground's colours | no | the look's floor and wall palettes (`src/looks.js`) | same |
| The enemies | no | the Pearl set; `SECTORS` and the arc are fixed tables | other families exist (`?creatures=`), never the story default since 2026-10-14 |
| The cave | no | its tunnels are fixed curves (`below/src/mission.js`) | a seeded cave is cave-repo work: medium |
| The planet's size | barely | radius = 10 m / cell side; same point count, near the same size (assumed) | keep it |

### The options

| | **3A. Live seed** | **3B. A catalogue of baked seeds** | **3C. A planet recipe** |
| --- | --- | --- | --- |
| How | any new seed, built at load | 4-6 seeds chosen and checked offline, baked like seed 7 | 3B, plus per-planet tables: palette, sky turn, enemy family mix, sector rows |
| Load | +5 s on every new planet, on the main thread (assumed: no worker today) | as today | as today |
| Safe | no: a seed can lack a gate mouth or a back mouth | yes: a seed is checked before it ships (`npm run bake` per seed, a test per bake) | yes |
| Feels new | terrain only | terrain, a name, colours | a different place and a different fight |
| Size | small, risky | **medium** | large |

**The smallest version that feels like another planet** (3B):

1. Planet 1 is always seed 7: the tutorial planet, every chapter page and every browser suite unchanged.
2. Four to six more seeds, picked by a script that rejects any seed without a gate mouth, a back mouth, an arena in
   reach and the landing sites on open floor. Each baked (about 1 MB each).
3. Each planet a row: a name, its seed, its day and dusk colours, its ground tint, a turn of the black hole.
4. The landing card and the HUD say **PLANET 2 · (its name)**. The welcome already says START A NEW PLANET.
5. The new run is a page load: `index.html?planet=2`. The architecture already says a document owns one game and
   route changes reload; the URL is read before consumers load, like the roster.

Honest limits: the colony, the cave, the King, the Queen, the sectors and the story beats are the same on every planet.
A second run is "the same war somewhere else", not a different game. That is what 3C is for, later.

### What carries over

| | **Nothing** | **A keepsake** | **The Stålheart itself** |
| --- | --- | --- | --- |
| What | the planet number and a logbook of past planets | one choice at the launch: e.g. one more salvage barrel at the next landing | the KIDOU lands already printed |
| Changes play | no | a little, at the start | the whole opening (the dog, the wall, the Rotor all wait on the print today) |
| Size | small (`src/storage.js`) | small | large |

**A harder curve** has a knob already: the sector run takes a threat multiplier (`threatMult`). Planet N could raise
it. That is difficulty, so it waits, as the owner asked.

### Recommendation

**3B with nothing carried over but the number and the logbook.** It is the smallest change that makes the second
landing look like somewhere else, it keeps planet 1 and every test on seed 7, and it puts no new rule into the
opening while the flow of stages is still being set. A keepsake and a harder curve are one line each later.

### The owner decides

- A catalogue (safe) or any seed (endless, risky).
- How many planets, and named by hand or by a generator.
- Does planet 2+ replay the tutorial chapters and the dog's survey, or open at THE FIRST ORDERS?
- Carry-over: nothing, a keepsake, or later.

---

## Build order

Each stage leaves the game playable and shippable on its own.

| # | Stage | Part | Size | Where | Leaves the game |
| --- | --- | --- | --- | --- | --- |
| 1 | **The surface proof**: the hole caves in, the swarm goes grey, QUEEN · DEAD; also on phones | 1A | small | game | the Queen's death seen, the rest as today |
| 2 | **The log**: the landing grade, the build order, losses kept; THE LOG page on the card | 2 | small | game | a fuller card |
| 3 | **The walk**: WALK THE COLONY on the card; the dog's free mode on the quiet base; the ring full; ESC back to the card | 2A | small to medium | game | an ending you can walk |
| 4 | **The launch**: the LAUNCH court's trigger, the sled followed up, "Ready for the next one?"; NEW PLANET reloads planet 1 for now | 2 | small | game | a closed loop, still one planet |
| 5 | **The catalogue**: the seed checker, 4-6 bakes, a test per bake, `?planet=N`, the name and colours, the logbook | 3B | medium | game | a second run on another planet |
| 6 | **She fights back**: tell, reach, flare flinch and turn, the QUEEN row; re-import `below/` | 1B | medium | cave repo, then the game | the cave as a short fight |
| 7 | Later, each on a playtest: domes alive; the King's fight underground (1C); a keepsake; a harder curve per planet; a seeded cave; the space elevator | | | | |

Stages 1-4 touch only the game and can run in one round. Stage 6 is the cave repo's round, with its own suite.

## Open questions for the owner

1. The Queen: she fights back with one charge (1B), or the full fight with three (1C)?
2. Does she flinch from flares?
3. At her death, does the arena's hole cave in?
4. If Isao is lost in the cave, is the walk silent, or is there no walk?
5. Walk as the dog, the tank, or Isao's drone?
6. The finished base: only what you built, or Isao fills the empty cells?
7. Leave by the ARC-01 launch, or wait for the space elevator?
8. The constellation: after the Queen as now, or as the launch's shot?
9. Keep KEEP HOLDING after the end?
10. New planets: a checked catalogue, or any seed?
11. Planet 2+: replay the tutorial, or open at THE FIRST ORDERS?
12. Carry anything over beyond the planet number?

## Read for this proposal

`AGENTS.md`; `docs/STATE.md` (THE DESCENT, THE ENDING, the orbital works, the V1 session); `docs/FLOW.md`;
`docs/DECISIONS.md` (the calls of 2026-11-12, the arena fight, C, N); the economy spec's section 0; the colony layout
spec; `below/src/{mission,main,queen-motion,nursery,handoff,cave-pacing}.js`; `src/fx/{descent-host,ending-host,
finale-diorama,orbital-finale,dog-scout,isao-worker,colony-lapse,moment-reel}.js`; `src/content/{arena-king,descent,
dog-scout,story-defaults}.js`; `src/domain/{king-fight,world-recipe,story-planet,arena,back-door,expeditions}.js`;
`src/core/{planet-bake,run-recap}.js`; `src/platform/story-world.js`; `scripts/bake-planet.mjs`; `src/isaobriefs.js`.
