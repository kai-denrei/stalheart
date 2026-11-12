# THE RECON DOG: the opening re-paced (design)

Owner, 2026-11-10, playtest of THE SETTLING (f55e80e3), note 2: "there is nothing to do until the Stalheart is built, that does not work; we need a
better story pacing. A) we land, b) ISAO builds the Recon Dog c) the player can control the dog to go explore in 3rd person. d) it bumps into low
level White and Yellow enemies. e) Isao decides to build a wall f) we need to build a Rotor Gun, too much for the recon dog g) we man the rotor (as
before) etc." And: "Overall, we need to overhaul our pacing, and test dispatching the industrial rover to gather the biomass. We have many good
elements to use, now they must all fit together into a coherent whole."

His three calls (2026-11-10, asked one at a time):
1. The Stålheart prints AFTER the Rotor fight, not from the deploy.
2. The dog's job is to SURVEY MARKED POINTS; the last one wakes the first Whites and Yellows. The player sets the pace, not a clock.
3. (The flares' stock restocks at the base: built with the small notes, not part of this spec.)

## 1. What the player sees, in order (the story's own start; chapters and SKIP TUTORIAL keep their starts)

| # | Beat | What happens | Who acts |
|---|------|--------------|----------|
| 1 | LANDED | The SH02 lands (flown or automatic), Isao's three lines, the AFR-01 deploys, the whole salvage is granted (as THE SETTLING). No gate, no Stålheart yet. | cinematic |
| 2 | THE DOG | Isao prints RECKON K9 with the existing skippable print close-up (`src/fx/pet-print.js`), line `dog_print`: "First, eyes on the ground. I print a scout." | Isao |
| 3 | SCOUT | The player drives the dog in third person. Three survey points stand marked outside the clearing. Line `dog_scout`: "Rock, crystals, biomass. Take the dog and look." | player |
| 4 | SURVEY x3 | Standing in a point's ring for `survey.seconds` surveys it: a toast (ROCK · SURVEYED +30 KG), a line of Isao's on the first two. | player |
| 5 | CONTACT | Surveying the last point: the tremor, a small pack of Whites and Yellows rises `contact.hops` cells beyond it. Line `dog_contact`: "Movement. That is not rock. Bring the dog home!" | game |
| 6 | RUN HOME | The pack walks for the clearing at the Pearl pace; the dog is faster. A body that touches the dog knocks it down for `knock.seconds`; it gets up. No fail state. | player |
| 7 | THE WALL | The dog inside the clearing (`home.cells` of the heart): Isao prints the gate and walls (the programme's `gate` step). Line `dog_wall`: "They follow you. We need a wall." The dog's seat is released; it is a base companion from here. | Isao |
| 8 | THE ROTOR | Line `dog_rotor`: "Too much for the dog. I print the Rotor. Get ready." The Rotor is printed (Isao's grant, as the emergency Rotor). | Isao |
| 9 | THE SEAT | The existing gated opening from `rotor-ready`: the override, the Rotor's seat, the wave (the pack plus the fodder). | player |
| 10 | FIRST HARVEST | The wave cleared: Isao prints the depot (rover and pearls, moved up from sector 1), drops his own flare on the bodies at the gate; the rover's first run, its gauge filling. Line `first_harvest`. | Isao, watched |
| 11 | THE FIRST ORDERS | The build board's card, as THE SETTLING, now after the first fight and paid from salvage + survey + harvest. | player |
| 12 | THE STÅLHEART | Isao prints the Stålheart (75 s). The Quiver's wave and sector 0 (GS01 on station, NUKE THE ENTRANCE, the hull handed over on the lane) play during the print, as before THE SETTLING. | both |

The 120 s settle clock no longer runs on the default opening. `?settle=N` and `STORY_SETTLE` stay for the chapters' acceptance pages only if they
still need them; otherwise they are removed with the rule (the plan decides after reading the suites).

## 2. The pieces

**A. The dog's seat (new, `src/domain/dog-scout.js` pure + `src/fx/dog-scout.js` host).** The domain holds the scout's state machine
(`idle → driving → knocked → home`), the survey rule (inside a ring for N seconds), the knock-down, and the dog's motion (speed, accel and turn
from `COMPANIONS.units` k9, sprint its `top`). The host reads the keys the tank's free drive reads (WASD / arrows, Shift the sprint, the phone's
stick), moves the K9 body `src/fx/companions.js` already draws (a `driven(id, pose)` hand added there: while driven the play rule leaves that unit
alone), and holds the camera on a chase rig behind it (the seat-view pattern, a shot of its own so no other shot takes it). The dog walks the
lattice's open floor only (the tank's wall test at the dog's radius).

**B. The survey points (content `src/content/dog-scout.js`).** Three points chosen once per planet from the story world: on open floor,
`points.cells` [8, 12] hops from the heart, at least 60 degrees apart round it, the last one on the lane's side (so the pack comes home up the
lane the Rotor covers). Each has a kind (rock, crystals, biomass), a ring (`src/fx/site-ring.js`), a HUD marker with its distance, and a pay.

**C. The beats (`src/domain/story-beats.js`).** New phases before `foundry`'s orders: `dog-print`, `scouting`, `contact`, `walled`; then the
existing `printing → rotor-ready → tremor → breach → …`. The gate and the Stålheart leave `when: { phase: 'foundry' }`: the gate is ordered at
`walled`, the Stålheart after the first orders close. The contact pack is `STORY_FODDER`'s kind at a small count; the gated tremor that follows
is the same breach, so the pack and the fodder are one wave at the Rotor.

**D. The first harvest.** The depot's step gets a `when` the beats can satisfy at `cleared`; Isao's flare uses `rover.flareAt` on the richest
ground. The pearls' cap then applies from the first fight (today from sector 1): the start bank and the salvage are well under 36,000 kg.

**E. The companions' order.** `COMPANIONS.prints.order` becomes `['k9', 'c07', 'k0', 'mech']`; the K9's print is driven by the beats at
`dog-print`, the other triggers stay (C-07 at the first quiet moment of the expedition).

## 3. Numbers (content, the owner's to turn)

`DOG_SCOUT`: points 3, cells [8, 12], survey.seconds 2, pay 30 kg each, ring 6 m; contact.bodies 12 (8 white, 4 yellow), contact.hops 6;
knock.seconds 1.5, knock.push 4 m; home.cells 3; sprint the K9's top 5.5 m/s (a run home of 100 m takes about 18 s; the pack at ~2 m/s arrives
about 30 s later, the time of the wall's and the Rotor's prints).

**Revised 2026-11-12 evening** (owner's playtest: "dog recon beginning is cute but much too slow; we accellerate for now, maybe reduce to scouting two
spots, much closer, rather than 3 far apart"; and on the landing: "focus on the rocket, no cuts, it opens, isao comes out"). `DOG_SCOUT` now: points
**2** (the rock and the crystals one point, ROCK AND CRYSTALS; the biomass the lane's), cells **[5, 7]**, spread **50-80 degrees** (`spreadMax`),
survey.seconds **1.5**, pay **150 kg** each (the economy's x10; unchanged, so the opening bank is 150 kg lower than with three), ring 6 m;
contact unchanged (12 bodies, 6 hops beyond the gate), recall **40 s**; the seat's sprint **6.5 m/s** (`drive.sprint`; the K9's companion top
stays 5.5), accel 7. RECKON K9's own print **7.2 s** on one wide angle at the game's lens (`COMPANIONS.units` k9 `print`; was 15.5 s over four
cuts). The landers' tour no longer plays on this opening (section 4 below is superseded on that line): the landing's held shot hands to the
K9's print and the print to the dog's chase without a cut (src/fx/arrival.js `hand`). Table rows 3-4 read two points, SURVEY x2; Isao's line
on the first survey only ("Good rock, and crystals. I can print with that. One more mark."). Measured in `docs/STATE.md` (THE OPENING PACED UP).

## 4. What it replaces and what must keep working

- THE SETTLING's settle clock and Isao's emergency Rotor line on the default opening (the Rotor is always Isao's now; THE FIRST ORDERS loses its
  Rotor card and offers the pad, the foundry's work and the array).
- The landers' tour: it plays after the dog's print and before the scouting, as today's first free camera.
- Chapters (`?skip=rotor|wave|quiver|stalheart|expedition`), SKIP TUTORIAL and acceptance pages open as today: the dog stands as a companion,
  the surveys are counted as done. A new chapter `?skip=dog` opens at beat 3.
- A phone: the tank's stick drives the dog; the survey is automatic in the ring.

## 5. Tests

- `test/dog-scout.mjs`: the survey rule, the knock-down, the motion's speed and turn, the points' choice (distance, spread, lane side) on the
  baked story planet, the state machine.
- `test/story-beats.mjs`: the new phases' order; the gate ordered at `walled`; the Stålheart after the first orders; chapters unchanged.
- Browser `--dog-scout`: the print, real keys drive the dog to three points, the pay, the pack, the knock-down, the wall, the Rotor, the seat,
  the rover's first run, the card, the Stålheart's print with a construction wave.
- Rewritten to the new order: `--settling`, `--grow`, `--opening-cuts`; run unchanged: `--chapters`, `--skip-tutorial`, `--landing`,
  `--story-world`, `--rover`, `--companions`.

## 6. Open, the owner's calls after he plays it

The dog able to be taken again later (a seat at the base); survey points beyond the first three; whether the dog can die; the pack's size;
the mid-game's timing (sectors, the arena, the cave, the ending), which waits for this opening's playtest.
