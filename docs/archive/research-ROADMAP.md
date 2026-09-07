# Roadmap

Where this is going, and what is knowingly unfinished. Newest thinking at
the top of each section. This page is meant to be argued with — if an item
looks wrong, it probably is; use the ⧉ button and send it back.

Three honest labels are used throughout:

- **Committed** — decided, scoped, and next in line.
- **Candidate** — wanted, but the design call has not been made.
- **Question** — we do not yet know the right answer, and guessing would cost more than asking.

---

## The progression (settled 2026-08-31)

The run has ONE spine now, and it is sectors.

```
SECTOR 1 ──► SECTOR 2 ──► … ──► SECTOR 5 = THE PLANET

  THE PROGRAMME   the sector sends `wavesPerSector` waves. That is how
                  many it has; when they are spent, no more come.
  THE GATES       kill every one and the sector is yours — at ANY point.
```

**Nothing is immune.** The first cut sealed the gates during the wave phase
and that was wrong: walls breach, towers fall, the strike vaporises, and a
portal that shrugged off three well-placed shells was the only exception on
the board. Get close, put three in it, it is down.

It needs no rule to restrain it because it is **not free**. Every gate you
close early is a wave that never arrives — and the kills, the biomass and
the score in that wave never arrive either. Hold the line and you finish
rich; end it early and you finish alive. The game balances that on its own,
and the seal was not trusting it to.

This replaced the TOURS layer, which was a second answer to the same
question and did not nest with the first: a player could finish a tour while
a sector sat half-cleared, so the game announced TOUR 1 SURVIVED over a wave
counter marching into 16. The wave count is a phase clock now, not a
parallel career. Bank-and-press-on is gone with it — finishing a sector IS
the checkpoint, and the gamble it encoded can come back later as an optional
sixth sector if it is missed.

Clearing a sector pauses on a DEBRIEF that is dismissed by hand, never on a
timer, and offers a lap of the board as Isao before you breach the next one.

## Now

The tower-defence tab is the active front. Everything else is maintained,
not advanced.

| area | state |
| --- | --- |
| board + collision + nav | done; one grid serves all four roles |
| tank (mkcx), feel, sound | done; tuned against the unit viewer |
| towers, looks registry | done; swapping a tower's visual is non-destructive |
| tower silhouettes | done; all eight wear a distinct Braille-lab head matched to what they do |
| orbital strike | v1 done; ritual + rationing from DeepWatch, one strike kills one gate |
| waves, economy | wired but **untuned** — see Pacing below |
| tutorial | runs on a deliberately small board (400–600 points) |

---

## The rendering direction (decided)

**Dot clouds stay. Density is not the constraint; object count is.** Measured
on a live wave-4 board, across one whole frame:

| | wave 4 | wave 8 | +8 towers |
| --- | --- | --- | --- |
| main-view draw calls | 1022 | 1448 | 1026 |
| triangles | 36,654 | 48,494 | 36,654 |
| points drawn | 49,744 | 67,252 | 50,032 |
| scene objects | 437 | 586 | 454 |

Eight towers cost **four draw calls and 0.6% more points**. Meanwhile going
from wave 4 to wave 8 — more enemies, more projectiles, more objects — costs
**426 calls**. That is the whole picture: a frame here is priced in draw
calls, and draw calls scale with the number of *objects*, not with the
detail inside any one of them.

So:

- **Do not** switch towers to solid meshes for performance. It would not buy
  anything measurable, and it would cost the visual language.
- **Do** let shapes carry their authored detail. A head at 480 or 1200 dots
  is vertices added to a draw call that already exists.
- **The effects layer must be pooled.** "Lots of activity, fireworks,
  explosions" is precisely the thing that adds objects. One `Points` cloud
  with a rewritten buffer serves a thousand particles in one call; a thousand
  objects is a thousand calls and would end the frame budget on its own. The
  unit viewer's firing preview is built this way as the reference.
- **The minimap is culled** (done). It used to re-render the entire scene
  through its own `WebGLRenderer` — which, being a separate renderer with its
  own `info`, was invisible in the numbers above. Measured directly, at wave 4
  with eight towers it cost **686 draw calls**; as a marker layer it costs
  **14**. That is 672 calls, 39% of the whole frame, for a map nobody could
  tell had changed.

---

## Committed

### The mobile shell — planned 2026-09-02, not started

A second shell over the same game rather than media-query overrides on the
desktop HUD, which is what "simply ported" produced. Two modes (DRIVE / BUILD),
view follows mode, tap-to-go driving on the nav graph, radial-at-the-finger
building, HUD by subtraction, captions not modals, then a real device pass.
Desktop stays byte-identical. The plan, its phases, its probes and the
decisions the operator still owns: **`docs/MOBILE-PORT-PLAN.md`**.


### The Construction Drone, and BIOMASS — operator direction, 2026-08-31

A lore-and-gameplay change, handed down whole: **nothing the player builds
is built by the player any more.** An **Industrial Construction Drone**
raises every tower and performs every upgrade, and it works in **BIOMASS**
— alien tissue rendered down — which replaces *credit* as the one currency.

Two commitments, one small and one structural.

**1. Credit becomes Biomass.** — **SHIPPED** (2026-08-31). The unit suffix
landed as **kg**, the substance the fiction points at. What follows is the
plan as it was written, kept because it is the record of what the pass had
to touch: a rename with teeth: the resource stops
being an abstraction the HUD prints and becomes a *substance* the fiction
can point at. Kills already pay it; now what they pay is the thing that
died. Touch points, all of them known: `src/economy.js` (12 refs — the
module name and every `credit` symbol), `src/td-tab.js` (29 — HUD
`${eco.credit}c`, the radial centre, the shop notes, the sim rows), plus a
mention each in `score.js`, `ranks.js`, `enemyspec.js`, `sim-tab.js` and
the sim table header in `index.html`. Decide the unit suffix (`c` → `b`?
a mass unit — `kg`? a glyph?) before touching the HUD, because it lands in
three brightness tiers and the radial centre at once. The `?credit=N`
debug hook should keep working under the old name as an alias — the DEVLOG
and the two `simdata` batches are historical records and are NOT rewritten.

**2. The drone builds.** — **SHIPPED** (`?order=`/`?isao=` verify it; the
old `?bobby=` still works as an alias). He is **ISAO** — he shipped as BOBBY
and was renamed with the CRT face — cast from the operator's fabricator .glb:
order a tower and he
flies to the cell, hangs there, and prints it out of biomass. Two clocks
now stand between wanting a tower and having one — travel and build — and
biomass leaves the purse at order time, so a queue cannot be spammed for
free. What follows was the argument for building it, and it held up:

- It is the **mode incentive** we have been looking for. A build order is a
  thing happening *on the board*, at a place, over time — worth flying the
  camera to, worth defending with the tank, and losable.
- It explains the tower fiction we already wrote. Every emplacement in the
  codex is a factory machine converted to violence — a six-axis arm, a
  delta picker, a mortar tube. **The drone is what converted them**, and
  biomass is what it prints with. The codex needs no retcon; it needs the
  agent that was implied all along.
- It gives upgrades a physical read. A tier is currently a pedestal shape
  changing on the spot; under the drone it is a machine that came back.

**Still open — do not guess these:**

- **Is ISAO killable?** He currently flies at an altitude nothing reaches,
  which was the operator's own framing ("typically too high to take any
  damage") and is shipped as a simplification, not a physics claim. A
  vulnerable ISAO makes every build a risk and turns a leak into a real
  setback; an invulnerable one is a timer with a body.
- **Clones.** The operator's idea: ISAO spends his downtime printing
  copies of himself, and a fleet builds in parallel. This is the best
  version of the biomass sink the sim batch asked for — it costs the
  resource, it buys throughput rather than power, and it is self-limiting
  because every clone competes with a tower for the same slurry. Unbuilt.
  The queue is already FIFO with one worker, so a second worker is a loop
  over workers, not a rewrite.
- **The timing curve is a first guess.** 2.6 cells/sec of travel, and
  2.0s + cost/55 of print — a 60kg single takes ~3.1s to print, a 260kg
  laser ~6.7s. Nothing about those numbers has been played against a real
  wave, and they are the whole feel of the mechanic.
- **Does the drone harvest?** The honest version of biomass is that it is
  *collected from bodies*, not granted at the instant of a kill — corpses
  drop, and something drives out to pick them up. That is a much larger
  change (it re-times the whole income curve, and the 2026-08-30 sim data
  stops describing the game). Possible middle: kills pay as they do now,
  and *bonus* biomass pools on the field for whoever collects it.
- **What does build time scale with?** Flat, tower cost, tier, or travel
  distance. Travel distance is the most interesting and the most punishing.
- **Where does it live between orders?** A pad by the Heart, the nearest
  container berth, or wherever it last worked.
- ~~**Which model?**~~ — settled: **the operator is supplying a .glb for the
  base**. Same casting pipeline as mkcx and the heptapod tower (vendor into
  `assets/models/`, register in `glbmodels.js`, `fitModel` gotchas apply, and
  the model's rest pose is gameplay data — inspect the node names before
  deciding what articulates). Open until the file lands: whether the working
  end (arm, printer, whatever it has) articulates or the whole thing merges
  to one draw call.

Sequencing: the rename is independent and can land first (a mechanical
pass, tests green throughout). The drone is a gameplay change and should
not be started before the questions above are answered.


### ~~One mode: the camera overhaul~~ — DONE

Shipped as T1/T3/O1 with two centre buttons (heart/tank), buildMode derived,
tank steerable everywhere, HOLD removed, WANDER became the Tank-Auto radial.


### Tank feel, tuned rather than derived

Model scale, tint strength, bloom weights and audio levels were *derived* —
reasoned from durations, fire rates, RMS envelopes and measured geometry —
not judged by eye or ear. Several have already been corrected on sight.
Every one is now a live control, because a derived value is a starting
point and nothing more. What remains is a deliberate looking-and-listening
pass with those controls in hand.

### One knob schema for the whole feel layer

Today the game holds its own hover parameters and the unit viewer reads the
module defaults, so tuning in the viewer changes nothing that ships. The
knob *schema* moves into `tankfeel.js` and both surfaces build their UI from
it, mutating one shared object — with a copy-as-code button so a good
setting reaches the repo instead of dying in one browser.

### Wave pacing as a curve

Cadence and intensity are hand-set constants (`waveEvery` 16 s, a size
formula) that have never been tuned *as a curve*. The tutorial board is
also assumed to suit the whole unlock run, when only its opening sector has
actually been examined — whether waves 5–8 feel cramped on it is untested.

---

## Candidate

### Operator's list (captured 2026-08-31, second playtest)

Five items, in the order they were handed down. Two are bugs, three are
design. Only the first is done.

- ~~**Minigame seeds**~~ — DONE. Both engines shipped a constant seed, so
  every breach served the identical puzzle. Fixed at the source in
  pazorukore and through the duel's own bridge; the seed is derived from
  the run's stream, so a replay breaches the same puzzles in the same
  order.
- ~~**A real win condition**~~ — DONE. A TOUR is 15 waves (tunable, and the
  number is a first guess). Survive one and you have won; then bank it and
  the run ends with the clear on the board, or press on for another tour
  with everything at stake — dying on tour two costs you tour one, which is
  the only way "more waves" is a decision rather than a free extra. The
  second win is the planet: every portal dead with all five sectors open,
  which is the only reading of "the entire map free" this world supports,
  since sectors are how the shell unseals. `?tour=N` and `?planet=1` stand
  on the cards. What is NOT built is the operator's third beat — portals
  eating the map as you continue — and the achievements roster below is
  where the rest of the reward for a clear should live.

- **[superseded] A real win condition.** Endless is a placeholder. The shape the
  operator wants, in three stages: (1) a FINITE wave count — survive them
  all and you have won; (2) among survivors, the ranking is by score, so
  the game is "clear it, then clear it better"; (3) an optional
  continue-and-enjoy-your-build mode afterwards, where each new portal
  eats part of the map, and the true planet-level win is the board with
  almost no walls left — the whole sphere under control.
  **Unstarted, and it needs numbers before code**: how many waves is a
  round, does score carry across rounds, and does continuing risk the win
  already banked. It also retires the current sector-expansion loop, which
  is today's substitute for an ending.
- **Audio lags after the second game.** Reported on a MacBook Pro
  AirPlay-casting to a TV — so a suspect chain of three: voices or nodes
  accumulating across a regenerate, AirPlay's own latency, and a sample
  rate mismatch when the output device is a TV. Not yet reproduced.
  First thing to measure is whether the voice count climbs across runs.
- **The build radial outstays its welcome.** Known from before: the tower
  shop stays open when it should close — while driving in tank mode, and
  when a missile is dropped. `closeShop()` exists and is called from view
  changes; the gap is that nothing calls it on drive input or on a launch.
- ~~**Achievements**~~ — DONE. Twenty-one, in `src/achievements.js`: pure
  table plus a pure evaluator over one flat record of run facts, so every
  condition is asserted in `test/achievements.mjs` both ways — fires on the
  state it should, silent on the state it should not. The record persists;
  the run's facts reset. Shown as THE RECORD from the briefing, unearned
  entries keeping their name and losing their note, because the name is the
  hint. `?record=all` lights every row. Original list below, all of it
  built, plus ten more in the codex's voice.

- **[built] Achievements.** The operator's list: STREAK 100/200/300/400/500;
  **K-KILL0** (won without losing a tank); **GENERAL** (reached the
  highest rank); **IT'S PERSONAL** (killed the boss with no tower
  assistance); **I LOVE YOU** (won with the heart untouched); **HACKER**
  (found the server); **RETRO-GAMER** (won at all three minigames) — plus
  more in the same voice. Wants a persistence story (BEST already uses
  localStorage) and a place to display them; the rank insignia in
  `ranks.js` is the drawing idiom to copy.

### Operator's list (captured 2026-08-31, evening)

Five notes, none started. Two are design questions with a real tension in
them, and the tension is worth naming before either gets built.

**Kika-centroid as a fourth protocol.** A quick skill game where each
PERFECT pays one orbital missile, four attempts.

Source found: **`kai-denrei/KikaCentroid`** (the operator's own repo, live at
kai-denrei.github.io/KikaCentroid). Build-free — `index.html`, `game.js` as
one ES module, `styles.css` — so it vendors exactly the way the duel and the
pazorukore games did. Two things it needs on the way in, both known:

- **No bridge.** The duel exposes `window.__cx`, pazorukore exposes
  `window.__pazoru`, and the parent reads the child's state through them
  because same-origin means it can. KikaCentroid keeps its state in module
  scope with nothing hung off `window` — its `phase` is
  `idle|countdown|playing|downtime|recap` and it already tracks
  `perfectStreak`, so the whole win condition is *there*, just not reachable.
  One line upstream (`window.__kika = state`) and the existing poll pattern
  works unchanged. It is the operator's repo, so upstream is the right place
  — the same call that was made for pazorukore's seed.
- **It registers a service worker** (`sw.js`, scope `./`). Vendored into a
  subdirectory of a site that has its own cache-busting, that SW would claim
  a scope and start serving its own stale copies — which is precisely the
  conflict the PWA item further down is blocked on. Strip or neuter the
  registration when vendoring, and note it in the copy so a re-vendor does
  not quietly restore it.

The design question it raises is not "does it fit" but **what it does to the
missile economy**. A missile currently has two sources — the orbital charge
clock, which is a rationing mechanism, and the black market, which is a
biomass sink. A skill game paying missiles is a THIRD source answering to
neither: not rationed by time, and it costs no biomass, so a player good at
it is playing a different economy from one who is not. That may be exactly
the intent (skill should pay) — but the four-attempt cap suggests the
operator already senses it needs a bound. Decide what it competes with
before wiring it in.

**Isao's exposition scenes.** The cinematic register the CRT was designed
for. Four beats named:

0. how the drone's industrial 3D printing works — the tutorial for a
   mechanic the game currently explains only by doing it slowly
1. leaving one portal alive to the last wave, then dismantling/hacking it
   for tower tech
2. "I spotted a server room! You should check it out, it might have
   interesting data for me to use"
3. "bring me more Biomass!"

Beats 0, 2 and 3 are cheap and want building: they are text plus a held
face, and both halves already exist. Beat 2 in particular solves a real
problem — the relay is at the far pole and nothing tells you it is there.

**Beat 1 is the one to think hard about**, and the operator flagged it
themselves. It cuts directly across what was just settled: gates are killable
at any moment, and closing one early costs you the biomass and score that
wave would have paid. Beat 1 adds a *second* reason to leave a gate standing,
which turns a preference into a genuine dilemma — kill it for safety, keep it
for income, keep it for TECH — and that is a better shape than what is there
now. The cost is that it is a third rule to hold in your head about an object
whose current rule is admirably short ("shoot it three times"). If it goes
in, it should replace something rather than stack on top.

**Voice, via fish audio on the operator's Ubuntu box.** The pipeline is
already mechanical on this side: audio lands in `assets/audio/`, gets a line
in `src/audiomanifest.js` (file, bus, gain, maxVoices, minInterval), and
`sfx.play(key)` plays it. Voice lines want their own bus so they can duck
the rest rather than fight it, and a `voice` bus is one entry in BUSES.
Worth generating one line first and hearing it against a live wave before
committing to a script — a delivery that works in isolation and not over a
klaxon is the usual way this goes wrong.

### MANUAL OVERRIDE — specced, then SHELVED (2026-09-01)

Losing your last tank stops being the end of the run: if the defences hold
and the biomass is there, ISAO prints a replacement hull, and while it prints
you may take **MANUAL OVERRIDE** — a Kika-centroid calibration ISAO runs to
speed the print, higher score cutting more time. Full design, including the
rejected pass/fail-gate version and the reasons, in
`docs/superpowers/specs/2026-09-01-manual-override-design.md`.

**Shelved deliberately, not dropped.** It closes three loose threads at once —
it gives the Terraformer a mechanical job, answers the *Mode incentives* item
below, and unblocks Kika-centroid by making it an accelerator rather than a
third missile source (which is the objection recorded under the operator's
evening list above — consider that one answered). But it adds a countdown
panel, a button and an embedded minigame to a board that the 2026-09-01 device
session found too busy already. It goes in after the subtraction pass in
`docs/PLAYTEST-TODO.md`, not before it.

### Rank-gated tank upgrades — *nice to have* (operator, 2026-08-31)

The ladder in `ranks.js` currently pays in **respect only**: 15 ranks, hands-on
kills exclusively, gold gated on elite kills, reset with the hull. It is a
read-out, not a reward. The idea is to make **experience effective** — a
veteran hull genuinely fights better than a fresh one.

Candidate effects, cheap end first: higher DPS, faster reload, then real
kit — better weapons, a rechargeable shield. And visible: **a larger cannon,
a shield emitter that reads at a glance**, so an enemy tank crest tells you
what you are looking at before it fires.

The shape this wants: rank is already `rankFor(kills, eliteKills)` and tier
is derived, never stored, so an upgrade table keyed by rank drops in beside
it as pure data — same registry idiom as `looks.js` / `towerlooks.js`, where
changing what a thing LOOKS like never edits what it DOES. Stat effects
belong next to `TANK_FEEL`; the visual escalation belongs in the unit's look.

Two hazards, named now:

- **It compounds the balance problem we already measured.** The 2026-08-30
  sim batch has hands-on style winning 5/8 against builder 1/8. Paying the
  tank *again* for doing the thing it already wins with widens that gap.
  Whatever this costs the builder, the drone should return.
- **It doubles the value of not dying.** The ladder resets with the hull, so
  rank-gated power turns each life into a much bigger loss — which the LIFE
  CONTAINERS now display three at a time. That is either the best thing about
  the idea or the thing that makes deaths feel unrecoverable. Untested.

Nice to have. Not scheduled, and behind the drone.


### Operator's list (captured 2026-08-30, playtest notes)

- **More minigames** brought into the collection (the home launcher already
  frames the app as a set of PoCs).
- **A Server Rack / Terminal model** — presumably a lab or GLB casting; target
  unstated, likely a board fixture or look.
- ~~**Review every tower's shooting pattern**~~ — DONE (`34e3253`,
  `577f07a`): sniper heavy slug, homing chase steer, mortar drop + landing
  mark, pooled hit sparks, round tracers.
- ~~**Homing missiles must CHASE**~~ — DONE: steer k=min(1,6·dt) re-seeks
  the live target each frame, the HokorobiTawaa feel.
- ~~**Bring the missile system to the top**~~ — DONE: the launch console sits
  top-centre under the mode row (desktop) / in the left HUD column (phone).
- ~~**Rework the entire HUD**~~ — DONE: the 5-line text block became a CRT
  instrument panel (three brightness tiers for three reading distances);
  control state moved ONTO the AUTO button; camera/system button clusters
  encoded by tint; NEXT WAVE chip joined the idiom; phone bands re-verified
  by rectangle probe with the alert row accounted for.
- ~~**Scores**~~ — DONE: `src/score.js` — tank kills x3, ram premium, field
  multiplier (+4%/live enemy, cap x2), wave-clear points; BEST persists in
  localStorage and updates live; final score on the lose modal.
- ~~**Ranks**~~ — DONE (`f9614fa`): 15-rank insignia (bronze/silver/gold,
  dice-pip stars), hands-on kills only, gold gated on elite kills, resets
  with the hull. Shown on the tank and the HUD tank line; `?rank=N` to check.
- ~~**A WARNING system**~~ — DONE: `danger_alert` klaxon + CRT-red warning
  on the first dangerous (non-rammable) contact within 3.5 cells, once per
  wave. Plus the boss omen: `boss_tension` brass starts when the lead to the
  knot's wave crosses 10s. `?danger=1` forces the visual.



### Tuning levers (from the 2026-08-30 sim batch — data in docs/simdata-2026-08-30.jsonl)

Measured: waves 1–3 deal essentially all heart damage (median 10→5, flat
after); credit floods from wave 6–8 and compounds ~30–50%/wave once
placeable walls saturate (~14–21 towers); hands-on style1 wins 5/8 vs
builder 1/8. Levers, in the operator's preference order:

- ~~**Gate the strongest towers behind the HACKS**~~ — DONE (`d6eac40`),
  refined by the operator to gate **AOE** (the OP half of slow+aoe).
- ~~Early cliff~~ — DONE (`d6eac40`): waves 1–3 taper 55/70/85%, first
  gap 1.6×, two free singles garrison the heart.
- Credit sinks: per-copy tower price escalation; buyable strike charges;
  the ally units specced under Economy; **additional construction drones**
  (a sink that also buys parallelism — see Committed).

### ~~Container lives display~~ — DONE (`5c7e1b6`)

`assets/models/container.glb` (650KB, vendored 2026-08-30): three shipping
containers near the Heart AS the lives counter — one empty, two each
holding a spare MK-CX. Diegetic: lose a tank, a container stands empty.
The rig is ready for it (node names inspected):

- **Empty the cargo**: delete/hide `Cargo_Group` (`Pallets_Instanced` +
  `Loads_Instanced`) — the boxes the operator wants gone.
- **Articulated doors**: `Door_L_Pivot`/`Door_R_Pivot` swing — the empty
  container can stand OPEN; a spent life can open its doors as the
  respawned tank 'drives out'.
- Extras worth using: `Lock_Lamp_*` (green=stocked/red=spent?),
  `Telemetry_Readout`, `ID_Plate`; `Callout_*` markers; a
  `Container_Collision` node for the cell blocker.
- Place an MK-CX clone (static, engine cold) inside two; sync with
  playerHP. Same casting pipeline as mkcx/server (fitModel gotchas in
  the glb memory).

### Mode incentives

Nothing currently *forces* meaningful switching between the macro layer
(building, top-down) and the micro layer (the tank in the fray). The fear
is players camping one mode for the whole run. Levers on the table:
build-only information such as range previews and threat-map detail;
tank-only income; wave events only the tank can answer.

The Construction Drone above is now the leading candidate for this: a build
order that takes time and happens *somewhere* is the first thing the macro
layer has produced that the micro layer has a reason to care about.

### Teaching through the world

The systems exist but teach themselves unevenly — the briefing text carries
far too much of the load and the world carries too little.

### Economy

Credit caches and purchasable ally units are specified and unbuilt. The
income and cost curves are untuned. An early-call bonus and a wave-clear
drip are already wired but no UI uses them. All of it is now downstream of
the Biomass rename and the drone — cost curves priced against a currency
that is about to change name and possibly acquisition model would be tuned
twice.

### Larger boards, after the tutorial

The tutorial's small board is a deliberate choice. Post-tutorial scale is
named but not designed, and it runs into the generation cost below.

### Raymarched gates — PoC LANDED, and the operator likes it (2026-09-02)

Unparked. `#portal` is a temporary bench: the operator's authored ring
(`assets/models/portalring.glb` — clear aperture, counter-rotating rotors, 8
power cores) with the effect running inside the aperture. **WORMHOLE is the
preferred candidate over Corona** — same raymarch and same singularity,
retargeted to a tunnel, which is the more literal reading of a gate you travel
through. `?portalfx=corona|wormhole` switches; `?portalperf=1` sweeps the cost.

**The cost objection in the old note was wrong, and that changes the decision.**
It assumed "per-pixel cost per portal", which is what a `ShaderMaterial` on a
quad would give you. Rendered ONCE into a small target shared by every gate,
the cost is FIXED — independent of portal count, of how large a gate is on
screen, and of display resolution. Measured: 1 → 4 portals took the scene from
165 to 341 draw calls while the effect pass did not move. So "affordable
because there are never more than a few gates" was the wrong reason to be
comfortable; the right one is that gates are identical and can share one
texture.

Cost, exactly, and hardware-independent:

| target | sine-folds/frame | | march | sine-folds/frame |
|---|---|---|---|---|
| 128² | 3.9M | | 40 × 6 (default) | 62.9M |
| 256² | 15.7M | | 24 × 6 | 37.7M |
| 512² | 62.9M | | 40 × 4 | 41.9M |
| 1024² | 251.7M | | 24 × 4 | 25.2M |

There is also an update-Hz knob: the effect need not run at display rate, and
30Hz halves everything above.

**Open, and only the operator can close it: the effect pass in ms at 512² on
the M4.** `performance.now()` does not advance under headless virtual time, so
CI cannot produce that number and the probe says so rather than printing zeros.
That single figure decides cinematic-only vs sometimes vs always.

Then the integration questions, none of them started: does the gate carry it
always or only while dialling; does it die with the gate (the gates already dim
as they are wounded, and the effect has an exposure knob that would ride that);
and does the authored ring replace the current portal cloud on the board or
stay a set piece.

### Raymarched creatures — for the CODEX, not the board (2026-09-02)

`organic-jelly.frag` (same sandbox) renders amoeba, adenovirus, jellyfish and
bacteriophage as translucent refracting bodies. Our `creatures.js` opens with
"fun-shapes (half-dotted > organic): amoeba, bacteriophage, jellyfish" — the
same three specimens, from the same lab, by the other philosophy.

**It is not a candidate for the board.** A dot cloud costs per VERTEX (amoeba
692 points, phage 494, one draw call, fixed however large it gets); the jelly
costs per PIXEL — 110 march steps + 28 refraction steps + 6 map() calls for the
normal, so ~144 SDF evaluations per covered pixel, growing with the square of
apparent size. One amoeba at 200×200px is ~5.8M SDF evaluations, against a
whole wave-8 board that draws 67,252 points total. And the shared-target trick
that makes the gates cheap does not apply, because creatures differ in pose.

**Where it belongs is the codex.** `lore.js` already states the dot render is
an in-fiction APPROXIMATION — "the tank does not see. It samples… the real ones
have surfaces, membranes." A raymarched, refracting specimen is literally what
the codex claims is behind the constellation, and every entry carries a
`visual:` field that is a txt2img prompt nobody has generated. One hero
specimen, still camera, on demand: that is the shape the effect is cheap in.

### Attract mode

A lock-screen cinematic flythrough of the sphere. Deferred until the TD
tutorial is settled — it should show the game as it will actually be.

### Installed-PWA / offline mode

True offline and no browser chrome. Was blocked on a known conflict: a
service worker must key its cache names off the build token or it silently
serves stale modules and defeats the version badge. **The hook landed**
(`2c33c8f`, mobile shell phase 6): `sw.js` keys its cache off the token,
`bust.sh` stamps it, `test/pwa.mjs` guards the match, registered on the
shell only. What remains is the dedicated part — a precache list for a cold
offline boot (GLBs, audio, fonts, minigames) and an update toast — and it
should still not be bolted onto TD work.

---

## Potential roadmap — the META WORLD (operator note, 2026-09-03)

Filed as a direction, not a commitment. The operator's words, lightly arranged:

- **A generated system, not a single sphere.** Something in the manner of the
  Fable Cabinet's `#starforge` (`localhost:8777/#starforge`, in
  `~/Dev/onkochishin/reference/FABLE-SHOWCASE/`) generates the meta world:
  a star system of planets and moons.
- **One game = one moon.** A single session is the fight for one moon, which
  is what the board already is — a sphere with a portal on it.
- **A longer game conquers several.** Moons first, then the planets they
  orbit, across the system. Clearing STÅLBERG-9 stops being the end and
  becomes one node.
- **A dashboard / meta map in between.** Between sessions the player is on
  the system view: what is held, what is next, what it costs to go there.
  That screen is where a campaign lives, and where the ranks, lore and
  achievements that already exist would finally have somewhere to be read.

What it would touch, if picked up: the board generator gets a seed from the
system rather than from a slider; the win condition becomes "this node";
persistence grows from a single save to a campaign; and the perf tiers gain a
third render site (the map). Nothing here needs deciding until the mobile
shell and the drone have landed.

Related, measured the same day: the cost of a live procedural background
behind the planet (the Cabinet's `#aurora` and `#galaxy-forge`) — see the
2026-09-03 DEVLOG entry once written.

---

## Ideas to test

- **Deliberate defect placement.** A closed quad sphere is topologically
  forced to contain irregular-valence vertices. Right now the merge
  scatters them. Seeding from a subdivided cube or icosahedron and
  jittering would trade organic randomness for controlled placement — worth
  building as a straight comparison.
- **Curvature-adaptive density.** Uniform cell area, or density varied by
  region for gameplay zones?
- **Incremental `mergeToQuads`.** Maintaining edge→triangle adjacency and
  updating per merge, instead of a full recount per pass, is the single
  biggest scale lever — expected ≥50× at n=4000, which brings 17k-quad
  boards into ~1 s. Prerequisite for 10k+ cell boards on mobile.
- **Generation in a Web Worker**, so the UI never freezes regardless of
  board size.
- **Surfaces other than the sphere.** Cube (curvature at eight corners),
  torus (zero net defect), arbitrary closed meshes. A domain abstraction
  would need exactly four operations: `samplePoints`, `triangulate`,
  `surfaceNormalAt`, `projectToSurface`.

---

## Known debt

- **The five board tabs are siblings, not a shared core.** grid, maze,
  organic, battle and heart are ~900-line cousins by copy-and-edit descent.
  Extracting a shared core is named debt, deliberately deferred while the
  tabs still diverge — extracting too early would freeze the wrong seams.
  Batch-patching them is a known-hazardous operation.
- **Mobile is verified by headless screenshots at 390 px, not by hand.**
  No real-device pass has happened. Headless also clamps windows to ~500 px
  and crops screenshots, so layout bugs must be diagnosed by logging
  `innerWidth`, never by looking.
- **Render-layer tests do not exist.** `npm test` covers grid topology,
  dungeon carving, creatures, units and the pure feel/audio/bloom modules.
  Nothing covers what is actually drawn.
- **At 30k+ quads**, per-frame `Float32Array` rebuilds (~8 MB/frame of
  allocation churn) become the render-side bottleneck before draw calls do.
  In-place buffer writes are the fix, if we go there.

---

## Questions

These are open on purpose. None has a default answer we are happy with.

- **Is the game the project now?** This began as a standalone grid proof of
  concept and is now a proto-game: six tabs, combat, a unit roster, several
  visual identities, a published site. The original phase-2 goals —
  corner-state dual layer, non-sphere surfaces, engine adaptation — have had
  no work since day one, and nothing in the current direction advances them.
  That is entirely fine if it is a decision. It is not fine as drift.
- **Is high defect density a feature or a problem?** Measured at n=600:
  ~21% of vertices are irregular, but most defects are *paired* and cancel.
  It is plausibly exactly what makes the grid look organic. Downstream
  corner-state tiling does not care about valence — multi-cell "special"
  pieces might.
- **What density is the target?** "Works on a sphere" at 200 cells and at
  20,000 cells are different engineering problems, because relaxation is
  iterative and global. No target has ever been stated.
- **Does relaxation stay stable near defect clusters over long runs?**
  Smoke tests run 60 iterations; the live view runs indefinitely. Quad
  flipping and creasing at high iteration and pull rates is unwatched.
