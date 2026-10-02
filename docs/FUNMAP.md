# FunMap

**Identity: resourceful joy under pressure** (owner, 2026-09-14, `2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. Every component answers to one or the other.

A companion to `ROADMAP.md`. The roadmap lists open items; this page is about how the game feels. Each line is a felt observation, dated, tagged with the lesson it touches. It is not a task list. Diagnoses come from the owner's playtests; the prescriptions stay with the design (Rosewater 19).

Lenses: Mark Rosewater's twenty lessons (R1–R20) and Sid Meier's test that a game is a series of interesting decisions (M), both from `~/Dev/game-design-lessons`, which since 2026-10-02 also lends the ledger below its other four sources: Falstein & Barwood's 400 Project (F), Raph Koster (K), Soren Johnson (J) and Jesse Schell's lenses (S). `docs/PLAYFEEL.md` still holds the owner's raw notes; this page reads them together with the log.

Two tabs. **The first pass** (below, 2026-09-14) is a reflection and a concept walk. **The ledger** (further down, 2026-10-02) is the trackable one: every lesson of the greats with a standing, the evidence, and what would move it, re-marked after each playtest.

First pass 2026-09-14. It is subjective by design: an opinionated reading of eight days and 117 log entries, meant as food for thought, not a verdict.

---

## Where the game is going: a reflection

**It started as a proof that something could be done.** The research README opens with "Proof of concept: the Oskar Stålberg organic irregular quad grid … ported to the surface of a sphere." The game grew out of a technical achievement, and the log still reads that way. Of 117 entries, roughly a dozen are about how something feels. The rest cover asset tiers, locks, FX schemas, labs, bake files, budgets and measurements. That was a deliberate choice (architecture → labs → UX → playability), and a sound one for the codebase. Still, R12 ("don't design to prove you can do something") is the lesson this project is most exposed to. The proof habit reaches past the code: the sphere, the LOD verification, the swarm lab that measures 1.38M dots. Each one is a real accomplishment, and each can quietly stand in for asking "what is this for, emotionally?"

**The sphere is interesting. It is not yet fun.** From a 2 m eye on the 753 m planet the horizon is 55 m away (explosion brief). From the ground the curvature mostly can't be seen, yet it shapes every rule: arcs, sag tables, rings on a curved planet. Where does the player *feel* the sphere? The breach dive from orbit, the gunship's pass, the whole-planet pull-back before the expedition. The sphere earns its place in those moments of scale and should be spent there. Elsewhere it is a cost with no emotional return (R5, R6).

**The genre is drifting, and that is probably good, but it should be named.** Classic Stalheart was tower defense: you chose where to build, and that was the Meier decision. In the story, Isao's script chooses where the towers go, and the player's decisions have moved into their hands: aim, lead, hold, overheat, paint, launch. The game is becoming an **operator** game. You are the one person in a colony who takes the seat that matters right now. The owner's satisfaction list confirms it: the manual minigun, the Rotor annihilating the pile, the gunship's paint-then-launch, ramming. None of those involve placing anything.

**The risk of that drift is a box of excellent minigames with no spine.** Rotor, Quiver, gunship, tank, sniper, mortar feed, three hacking games, rescue, raid, astro. Every one is piggybacked (R4) and polished one detail at a time (R8). What links them? Today, the story's script. A script is a tour, and a tour runs out. There are three candidates for a spine, all already in the game:

1. **Attention: which seat to be in.** The view strip (TANK · ROTOR · QUIVER · GUNSHIP · MAP) looks like chrome, but it may be the game's central decision. Auto sentries hold the line where you are not, and your presence multiplies one post by 60 (`STORY_PILOT.dmgMul`). "Where do I need to be *now*?" is a real Meier decision with an unclear right answer, and it only works with several threats at once. Tellingly, the 2026-09-01 playtest said switching views was *too hard* and asked for fewer views. If seat-switching is the core verb, it has to be the most fluid thing in the game, not the most friction-laden.
2. **Growth: what the colony becomes.** Barrels, biomass, stages, prints. Today this is automatic (the foundry runs on its own, the stages are set, Isao picks the sockets). The only economy playtest (wave 42) found "plentiful biomass with too few meaningful spending choices." So the growth spine is currently hollow.
3. **The mystery: the vibration language.** This is the only long-horizon curiosity hook in the game, and it is the most original idea in it. It currently lives in a modal that pauses the game. R10 ("leave room for your players to explore") says this should be something the player pulls on, not something shown to them.

**Two emotional registers pull against each other.** Isao is protopian: "Oh no! They destroyed my RADAR!" … "Oh well. Rebuild." The hardware is military: an AC-130 in all but name (25 / 40 / 105 mm), thermal, night vision, danger-close rings, Javelin-style locks, a fire-control HUD. Played as contrast, this could be the game's identity. Deep Rock Galactic pairs cheerful dwarves with horrifying bugs; Wall-E's world is a ruin. Played without intent, it is just two borrowed moods. R6 asks which emotion the game is *for*. A candidate worth testing: **resourceful joy under pressure.** The builder rebuilds, the gunner clears the way, and the colony grows out of the wreck it arrived in (the foundry recycling the SH02 is exactly this). Under that reading, the military register is the pressure and Isao is the point.

**Your own read, "fitting the game to expected behaviour, piggybacking, honing proven fun", is accurate and mostly a strength.** R1, R3 and R4 all tell you to do it. The trap is R11: piggybacking gets you *liked*. People already know the AC-130 pass and the minigun spool, so they will enjoy them on arrival. Nobody *loves* a game for its borrowed parts. They love it for what they have never felt elsewhere. The parts only Stalheart has, so far:

- recycling your own rocket into the first gun's ammunition;
- a cheerful LED-faced builder who never complains;
- three hulls in three bays as the lives, no counter;
- enemies ranked by **BJJ belt colours**, with the solid core as the tell;
- keeping low-belt enemies alive on purpose to farm the ram combo. The owner discovered this while playing, and it is emergent play, which is precious;
- aliens that talk in vibration, and a colony trying to decode them with machine learning.

Those are where love could come from. They get a fraction of the attention the borrowed parts get.

---

## The concepts, one by one

For each: the emotion it is for (R6), whether it is fun or merely interesting (R5), the decision and whether it is real (M), and what playtests said.

### The arrival and the foundry
- **Emotion:** wonder, then resourcefulness. "Rough landing!" → "So much to build!" The wreck becomes the first gun.
- **Fun or interesting:** neither, and that is fine. It is resonance (R3), a story beat. It is at risk only if it runs long.
- **Decision:** none. The foundry cuts automatically every 24 s.
- **Felt:** the reveal was cut down after the owner saw "there is little to see" inside the rocket, so a held medium-close shot replaced the zoom. Restraint already worked once here (R17).
- **Thought:** the foundry is the best emblem of the game's emotion, and nobody has seen it in the game camera yet. It could be the one detail people remember (R8), or background noise. Which one depends on whether the player ever *wants* the next barrel.

### Isao printing
- **Emotion:** companionship, optimism, momentum.
- **Fun or interesting:** endearing. The faces are the detail (R8). The owner asked for *less* animation, one held face per emotion, which is the right instinct: a face that changes constantly stops meaning anything.
- **Decision:** in the story, none. The script places the sockets. In classic, placement was the core decision.
- **Felt:** Isao's messages "crowd the place, always need to dismiss" (09-01). The comms box was "much too long" (09-14, flagged as a recurring request). The character is loved; the delivery of the character is resented.
- **Thought:** R1. Players won't read long cards mid-combat. Isao's voice note already says "two short lines at most", and the UI has fought it three times.

### The piloted sentries: Rotor and Quiver
- **Rotor, emotion:** raw, tactile power. The spool, the heat glow, the brass, the streaks.
- **Rotor, fun:** yes. This is the most consistently satisfying thing in the game (09-13 and 09-14). The decisive change was one number, 5 → 60 (R17). Hit detection was fine; the rounds just weren't worth anything.
- **Rotor, decision:** thin but real. Where to sweep, and how far to push the heat before lockout. Overheat is a good decision generator. Keep it.
- **Quiver, emotion:** precision, the held breath.
- **Quiver, fun:** it was "the opposite of satisfying; frustrating, seemingly random, no skill, no agency." It became tolerable once the lock became a visible, sticky rule (the box). The lesson is not "make it easier". It is that **agency is legibility**: the player accepts a slow lock when they can see why it is slow.
- **Quiver, decision:** so far there is only one target at a time, so no decision. It becomes a decision once there are several hard cores and one round in flight.
- **Thought:** "fish in a barrel" is the log's own title for the Rotor fix. That is great for an opening beat (R14, teach by forcing the fun). It becomes R16 boredom if the barrel never fights back.

### The wall and the gate
- **Emotion:** safety, a line held.
- **Fun or interesting:** the gate's animation is a named love (09-13, "small animations: the gate opening").
- **Decision:** none yet. Walls don't break in the story, and the fodder is harmless.
- **Thought:** a gate the player never worries about is decor. The tension a gate can carry, like "will it hold?", hasn't been spent. `breakWalls` stays true for the gunship, so the first time a player opens their own wall with a 105 could be a strong emotional moment. That could be horror, or dark comedy in Isao's voice ("Oh well. Rebuild.").

### The swarm and the hard cores
- **Emotion:** dread turned into relief. A boiling crater, then a clean sweep.
- **Fun:** fifty rising at once "so it feels like a swarm" was the owner's call, and it is right. The belt ladder and the solid-core tell "playtested well" (09-13).
- **Decision:** belts carry the real decisions: ram this one, shoot that one, leave that one alive for the combo. This is the best Meier content in the game, and it lives in the tank, not the story.
- **Felt:** the phage animation was "bad" (a squash on a rigid silhouette). The thing the player kills most should be the most delightful thing to kill (R8). Explosions are being briefed, which is the right direction.
- **Thought:** the swarm lab measures cost beautifully. Does it also measure delight? The owner's lane request ("make it feel more real": the splat, the slowdown, the RAM shout) was a request for delight, and it worked.

### The orbital strike and the gunship's pass
- **Strike, emotion:** catharsis, the big red button earned.
- **Strike, fun:** yes. It is on the satisfying list from the start, and it is scarce, which is why it lands.
- **Gunship, emotion:** god's-eye power with a clock. You can't make the pass come sooner.
- **Gunship, fun:** in progress. The first cut (thermal, grey, 35 s, no waves) failed on legibility. The map top view was "not at all what was in mind." The belly PoV with travel time came from the owner's own picture. Eight briefs in one day: the owner knew the *feeling* and the build hunted for the *form*.
- **Gunship, decision:** real if something competes for the window. Rotary to herd, Bofors to decimate, 105 to seal, *or* leave the seat for the Rotor. With nothing else at stake it is a shooting gallery on a timer. Leading a swarm through a 2 s round flight is good skill play (M-adjacent: the answer isn't obvious, but execution rather than choice is doing the work).
- **Thought:** a fixed pass the player can't influence is a lovely constraint (R18). It creates anticipation, the dark button counting down. The best version of the gunship may be the one the player *plans around*: "hold the gate for 40 more seconds, the ship is coming."

### The tank
- **Emotion:** momentum, bravado.
- **Fun:** ramming, shield timing, and the drive ramp (the long run-up was asked for because exploring was "tedious", an R16 flag caught early).
- **Decision:** the richest in the game. Ram or shoot, shield now or later, keep the fodder alive. The three lives in bays give it stakes.
- **Thought:** in the story the tank has been demoted to a courier ("fetch material at the rocket sites"). The expedition is the first open-ended invitation in the story (R10). It could return the tank to its strength: a place where the player decides a route and a risk.

### The economy: barrels and biomass
- **Emotion:** the colony's pulse. It should feel like growth.
- **Fun or interesting:** so far only interesting on paper. Wave-42 playtest: biomass plentiful, spending choices few. Rank promotion came too fast.
- **Decision:** hollow, as the owner observed. The foundry's barrels make the money *diegetic*, a very good move, but not *contested*.
- **Thought:** R13. When the winning path is "spend everything on more towers", the fun path (piloting) and the winning path diverge, because towers auto-fire. The earned-automation proposal is the most R13-sensitive idea on the roadmap: if chips make sentries autonomous and autonomy wins, the game will have designed its best verb out of relevance. The piloted multiplier already points at an answer (your presence is worth 60 of them). Worth deciding *on purpose*.

### Modes and labs
- **Emotion:** none for a player; everything for the owner.
- **Thought:** the labs are where the *owner* has ownership (R9): tuning, reviewing, applying, making the game personal. The *player* has almost no ownership in the story yet. There is nothing they chose, customized or named. R7 and R9 are the least-served lessons in the game today. The labs show how much the owner enjoys making things their own, which suggests players would too.
- The mode list (classic, rescue, raid, three hacks, sniper, sentry control, astro, story, defend) is also an R6 question: which of these contribute to the one emotion, and which are kept because they were built?

---

## Tab 2: the ledger. Our game against the lessons of the greats

Started 2026-10-02 after the fifth playtest round, 237 log entries in. The point is not a score. It is a place where a lesson that the game is exposed to stays visible until a playtest moves it, and where a lesson the game meets is written down with the evidence, so it is not quietly undone later.

**How to keep it.** One row per lesson. `Standing` is one of: **met** (evidence in play), **partly**, **exposed** (the game is working against it), **untested** (only a playtest can say). `Since` is the date the standing was last confirmed or changed; the arrow in `Moved` says which way it went since the first pass (↑ better, ↓ worse, → same, new). `Evidence` names log entries or playtest dates, never opinions. `Would move it` is phrased so one playtest or one change could flip the row. Re-mark rows after each owner playtest; add a line to Felt observations at the same time. Do not add tasks here; the roadmap owns them.

**Summary, 2026-10-02:** of 41 rows, 17 met, 15 partly, 5 exposed, 4 untested. The exposed rows are what the player owns (R7, R9), the generator's lesson curve (K2), the optimising player past SOL-88 (J1) and complexity discipline (J3); R13 is marked partly and is the one that moved down. The met rows cluster in what the owner's playtests drove: the Rotor and the ram (R17, R13), the canyon (R16, M), legibility (R2, R19). The untested rows all need a second player or one specific playtest.

### Rosewater, twenty lessons

| # | Lesson | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Fit the game to people, not people to the game | partly | 10-01 | ↑ | The phone seats say less; Isao two lines at most; the controls card once; the way back to the tank on Esc/7/TANK after the owner could not find it (09-25). Still: the HUD was "way too busy" (09-01) and has only been trimmed on phones. | A desktop HUD pass judged by what a first-time player looks at, not by what the systems want to say. |
| R2 | Aesthetics: balance, symmetry, pattern completion | met | 10-01 | ↑ | Rounds land where the tracer ends (09-25); the lance stops on its curve (10-01); the integrity strip in every view (09-30); the Safari right-shift found and fixed (09-24). Felt fairness is visual truth. | A playtest that finds a hit that did not kill or a beam that lies. |
| R3 | Resonance: preloaded emotion | met | 10-01 | → | The AC-130 pass, the orbital laser, the mass driver launch, the mini nuke seen from the ground ("very satisfying", 10-01). Borrowed well. | Nothing; the risk is R11, not R3. |
| R4 | Piggyback on what players know | met | 09-14 | → | WASD hull, mouse seats, 7 8 9 0, tower defence vocabulary. | Nothing. |
| R5 | Interesting is not fun | partly | 10-01 | ↑ | SOL-82's first form was "not fun; does not stay long enough, not accessible, not meaningful" (10-01) and became THE CANYON, which was "very satisfying". The economy is still interesting on paper. | The farm's biomass and the armory's shells read as a pulse the player wants, or they do not. One playtest. |
| R6 | Know the emotion, cut what does not serve it | partly | 10-02 | ↑ | The identity is named (09-14) and the PoC modes were cut (missions, mines, hacks, sniper, astro: 09-14). But the colony grew four buildings and an orbital ring in one night; each has a perk and a line, none has yet been asked "is this joy under pressure or decoration?" | The owner's verdict on the colony: keep, cut, or fold. |
| R7 | Let players make it personal | partly | 10-02 | ↑ | The scoreboard Isao prints (`2026-10-02-the-scoreboard-and-the-rank-flag-and-the-bench-range`): the player's own count against Isao's sentries and the sky, and the rank flag in their tier's colour. It is theirs, but it is a mirror, not a choice: Isao still places every socket. | One thing the player chooses that stays: a hull livery (the A6 package is waiting on a hull-asset decision), where the first sentry stands, a named collector. |
| R8 | The details are where they fall in love | met | 10-02 | ↑ | The gate heard both ways, the landing heard, the brass, the paint-then-launch ritual, the feast, Isao's faces held one per state; the owner's own list of small loves (09-13, 09-30). | Nothing; keep adding one at a time. |
| R9 | Ownership through customisation | exposed | 10-02 | → | None yet. The owner's answer (2026-10-02) is the A6 livery workshop: primary, secondary and accent paint, four presets, a name, a number and a message on the glacis. It needs the customization lod1 hull and two Three add-ons, and the hull swap was shelved on 09-14. | The livery pinned and offered in the bays, persisted across runs. |
| R10 | Leave room to explore | partly | 10-01 | ↑ | The expedition sites, the landing's orbit camera (09-30), SKIP ALL as a URL per chapter, the canyon on the far side of the world. Still no secret and no mystery the player pulls on; the vibration language is gone with the PoC. | One thing on the planet that is not announced and pays when found. |
| R11 | Liked by all, loved by none, fails | untested | 10-02 | → | One player so far (the owner), and he reports love for specific moments (Rotor, SOL canyon, strikes seen from the ground). Nobody else has played. | A second player. Nothing in the code moves this row. |
| R12 | Do not design to prove you can | met | 10-02 | ↑ | The first pass called this the most exposed lesson. Since then every round began with the owner's notes from a live build (09-25, 09-30, 10-01, 10-02) and shipped as fixes to felt problems. The budgets and extraction rounds are hygiene, not proof. | A week that ships systems no playtest asked for. |
| R13 | The fun path is the winning path | partly | 10-02 | ↓ | Ram farming (fun = win) and the piloted Rotor (x60) still hold. But SOL-88 now fires on its own, the farm pays biomass for free, and the works add beam for free: the colony is earning automation. The first pass's Q3 asked what keeps the player in the seat; this week built more reasons to leave it. | A playtest past SOL-88: does the owner still take a seat, and why? If not, the automated pass should be weaker than a manned one. |
| R14 | Sometimes force a behaviour so they learn it | met | 10-01 | ↑ | The canyon puts the player in SOL's seat with a glide; the Rotor and Quiver hand-overs; the first wave that cannot hurt. Taught by forcing, then released. | Nothing. |
| R15 | Design each component for its audience | partly | 10-01 | → | Phone and desktop diverge on purpose (10-01). The tutorial chapters and SKIP ALL serve two audiences. The debrief's five pages are for a reader who stays. | Knowing who the second audience is. |
| R16 | Fear boring more than challenging | met | 10-01 | ↑ | Waves on a clock (09-24), the opening cut 123 → 89 s by removing waits (09-18), the back door delayed so the ramp has teeth (10-01), the canyon as a set piece; the owner: "feels challenging in a good way" (09-25). | A sector the owner calls dull. The held sectors before the door are the candidates. |
| R17 | Change little, change everything | met | 10-02 | → | 5 → 60 on the Rotor; the door's earliest 6 → 7 made the second canyon exist; 0.54 → 0.7 on the Quiver's burst. Numbers in content files, one each. | Nothing; keep the numbers in content. |
| R18 | Restrictions breed creativity | met | 10-02 | → | The 16 GB machine, a controller at every budget, a 520-body frame budget, a 30 s launch choreography reused for two beats. Every constraint produced a design (passable steps, the ring as one draw). | Nothing. |
| R19 | Players spot problems, not solutions | met | 10-02 | → | Every round took the owner's diagnosis and found its own form: "SOL is not fun" → the canyon, not a bigger beam; "stuck between walls" → an ease, not wider lanes; "a spot to replenish shells" → one pad, not two. | A round that ships the owner's literal fix without asking what it is for. |
| R20 | All the lessons connect | partly | 10-02 | → | The identity sentence connects most rows; the colony and the works were built in a night and not yet read against it. | This ledger being re-read after the next playtest. |

### Meier, interesting decisions

| # | Lesson | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | A game is a series of interesting decisions | partly | 10-02 | ↑ | The tank has them (ram, shoot, shield, keep the fodder alive). Which seat to be in is the story's decision and it is alive while four threats compete. Isao's programme makes none for the player. | Counting the decisions a sector asks for, by hand, in one playtest. |
| M2 | Not interesting if everyone picks the same option | untested | 10-02 | → | Close a breach early or hold it to the end: the roadmap's open Question since 09-16, still unanswered. | One playtest watching which the owner does, and whether he ever does the other. |
| M3 | Visible consequences, real trade-offs | met | 10-01 | ↑ | LEFT IN THE FIELD and HELD on the books, the gate's hp strip, a burned building's perk going out, the debrief's five pages. | Nothing. |
| M4 | Testers are right about what, wrong about how | met | 10-02 | → | Same evidence as R19. | Same as R19. |

### Falstein & Barwood, the 400 Project (selection)

| # | Lesson | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | Fight player fatigue | untested | 10-02 | new | A full run is 283 s to sector 1 and then open-ended; nobody has measured when the owner stops. The debrief is a rest; the clock between sectors is not. | The owner noting when he quit and why, once. |
| F2 | Provide clear short-term goals | met | 10-01 | new | The sector card, the brief's two lines, the construction readout, the integrity strip, the tutorial card. | Nothing. |
| F3 | Begin at the middle | met | 09-16 | new | SKIP TUTORIAL, the chapter URLs, `sector=N`. | Nothing. |
| F4 | Make the AI's effects visible | met | 10-01 | new | The omens before the door, the radar tremor, the side breach's callout, the gate breaking out loud. | Nothing. |
| F5 | Don't take hard-won possessions away | partly | 10-01 | new | SOL can burn the player's own buildings and their perks go out, deliberately, with a warning on the scope and a bill on screen. The hulls are three lives, rebuilt by the assembly line. A lost sector loses nothing but time. | Whether a player who burned his own radar laughs or quits. |
| F6 | Maintain a consistent level of abstraction | partly | 10-02 | new | Metres everywhere, one grid, one belt ladder. But a 2 m collector bus stands in for a 40 m platform, and three missiles on the ground stand in for an armory's stock. | Real assets, or the fiction naming the stand-in. |

### Koster, a theory of fun

| # | Lesson | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| K1 | Fun is mastering a pattern | met | 10-01 | new | Leading a swarm through a 2 s round flight, the Rotor's heat, the Quiver's sightline, walking the beam down the canyon. Each seat has a pattern to learn and the owner reports the learning as the fun. | Nothing. |
| K2 | A learned game becomes boring; the generator must keep teaching | exposed | 10-02 | new | Past BOTH WALLS the generator only scales counts and sides. The works ring and the collectors add nothing to learn. KEEP HOLDING is where Koster's destiny arrives first. | One new pattern per generated sector (a side, a timing, a body type), or an ending. |
| K3 | Dressing is not the mechanic | partly | 10-02 | new | The colony's buildings are perks with dressing; the owner asked for the dressing (missiles on the ground) and it is honest about being dressing. The ring is dressing with one number attached. | Nothing yet; watch that dressing is not mistaken for progress. |

### Johnson, water finds a crack

| # | Lesson | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| J1 | Players optimise the fun out of a game | exposed | 10-02 | new | Towers alone hold sector 1 for 56 s; a player who parks on the armory's pad and lets SOL-88 and the farm work is the optimisation to watch for. Ram farming is the counter-example where optimising is the fun. | `--pacing --passive` past SOL-88: if the colony holds itself, the crack is found. |
| J2 | Protect players from themselves | partly | 10-01 | new | SOL's three-second drag on the Stålheart, the breach rim exclusion, the gate that mends itself. | Same playtest as J1. |
| J3 | Add something, take something out | exposed | 10-02 | new | 09-14 cut nine modes. Since then: four buildings, two sectors, a platform, a ring, a dump, with nothing removed. The controller's budgets enforce this for code and nothing enforces it for the game. | The next addition names its removal in the log entry. |

### Schell, five lenses

| # | Lens | Standing | Since | Moved | Evidence | Would move it |
| --- | --- | --- | --- | --- | --- | --- |
| S1 | Essential experience: is the game delivering it? | partly | 10-02 | new | "Resourceful joy under pressure": the pressure is well built (waves, clock, the door). The joy is Isao and the colony growing; the colony grew this week and has not been played. | The owner's verdict on the colony round. |
| S2 | Surprise: what surprises the player? | met | 10-01 | new | The back door, the side wall ("a chekov's gun"), the canyon at the antipode, SOL-88 going up. Each was built as a surprise and then foreshadowed. | The second run, when none of them surprise. |
| S3 | Fun: what should be more fun? | partly | 10-02 | new | The owner's lists name it each round; this week: the mortar and Quiver bursts, the stuck hull. The economy is the standing answer nobody has given. | A round that starts from "what should be more fun" instead of "what is wrong". |
| S4 | The player: what do they want and not know they want? | untested | 10-02 | new | One player, who is also the designer. | A second player. |
| S5 | Flow: is the challenge tracking the skill? | partly | 10-01 | new | The ramp climbs; the automation and the perks raise the player's power at the same time. Nobody has plotted the two curves against each other. | `--pacing` as an ideal defender past the door, with the perks on. |

### Our own lessons, mapped onto theirs

Drawn from the log's dead ends and the five playtest rounds. Each is written to be read cold, and each names the great it echoes.

| Ours | Where it came from | Echoes |
| --- | --- | --- |
| Agency is legibility: a slow lock is accepted once the player sees why it is slow. | The Quiver, 09-13 → 09-14 | R1, R2 |
| One number can be the whole fix; look for it before building a system. | Rotor 5 → 60; door 6 → 7; Quiver burst 0.54 → 0.7 | R17 |
| A set piece beats a stat: SOL went from "not fun" to "very satisfying" by changing where and when, not how much. | THE CANYON, 10-01 | R5, R16 |
| Foreshadow, then surprise, then make the surprise a place: the back door became a sector with omens, a feast and a gate. | 09-18 → 10-01 | S2, F4 |
| The owner names the feeling; the build hunts the form. Eight briefs in a day for the gunship's view was not indecision. | 09-14 | R19, M4 |
| Felt fairness is visual truth: the picture and the rule must agree or the player calls the game a liar. | Rounds that looked hit, 09-14; rounds from the barrel, 10-01 | R2 |
| Pressure without a clock is a pile; waves on a clock are pressure. | 09-24 | R16 |
| What the player earns by hand should not be given away by automation in the next round without asking what keeps them in the seat. | SOL-88, 10-01; the first pass's Q3 | R13, J1 |
| Say less in the seat; a readout the player cannot act on is noise. | Phone seats, 10-01; the Isao card, 09-14 | R1 |
| Subtraction works: removing allies fixed TD; cutting nine modes sharpened the identity; the HUD improves by removal. | 08-24, 09-14 | R6, J3 |
| A stand-in asset is a promise; write the promise down or the fiction fills it wrongly. | SEED-01 for SOL-88; missiles for an armory | F6, K3 |
| Measure the thing, do not photograph it; and a probe that stops early looks exactly like a probe with nothing to say. | Dead ends 09-06, 10-01 | (method, not design: the 400 Project's spirit) |

### Movement since the first pass (2026-09-14 → 2026-10-02)

- **R12 flipped.** The first pass named "designing to prove you can" as the exposed lesson. Four playtest rounds later every change traces to a felt note from the live build. The budgets kept the code honest while the owner kept the game honest.
- **The sphere found its moment.** The canyon at the antipode is the sphere spent where it pays: the far side of the world, a glide round it into the seat, the pass laid over it. Elsewhere it is still a cost.
- **The economy moved from hollow to half-built.** The farm pays, the armory reloads, the chip plant buys passes, the works buy beam. None of it is yet contested: nothing competes for the biomass, and nothing is lost by taking a perk. The first pass's Q4 (what could the player refuse?) is still open.
- **The automation question got worse before it got asked.** Q3 of the first pass warned that autonomous sentries would design the best verb out of relevance. SOL-88 is that, built on purpose and with the seat kept open. It needs the playtest that R13 names.
- **Ownership did not move.** R7 and R9 were the least-served lessons on 09-14 and still are. Everything that was added belongs to Isao or the colony, nothing to the player.

### Questions the ledger adds

11. After SOL-88 is up, what does the owner do during a pass: take the seat, or watch? The answer decides R13 and J1 at once.
12. Which one of this week's six additions (armory, farm, chip plant, launcher, works, second canyon) would be cut first, and what does that say about the other five?
13. What is the first thing a second player should own?
14. What does a generated sector past BOTH WALLS teach that the one before it did not?

---

## Felt observations

Newest first. Each line: date, what was felt, the lesson it touches. Add a line and keep the date. Don't turn a line into a task here; the roadmap owns tasks.

- 2026-10-02 · "Like Gimli and Legolas joking about who has the more kills": the first thing the owner wanted the player to own was a comparison with Isao, not a possession. Ownership here is a relationship. · R7, R8
- 2026-10-02 · "The tank gets stuck too often between walls where it looks like it should fit": the rule was right and the feel was wrong; what looks like it should fit, should. · R1, R2
- 2026-10-02 · "Add missiles of various sizes on the ground near the robotic assembly": the owner asked for dressing and named the place; a reload spot wants to look like one. · R8, K3
- 2026-10-01 · "SOL first pass; very satisfying, let's add a second round of that": a set piece asked for again is the clearest love signal the log has. · R11, R16
- 2026-10-01 · "Very satisfying to see the remaining nuclear explosion strikes from the ground after they happened from the gunship": the same event seen from two seats is two events. · R8, R3
- 2026-10-01 · "The SOL usage is not fun; does not stay long enough, not accessible enough, not meaningful enough": three diagnoses, no prescription, and the canyon came out of them. · R5, R19
- 2026-10-01 · "Backdoor wave too aggressive. Let's delay it": the surprise landed too early to be a reward; the ramp now earns it. · R16, S2
- 2026-09-30 · The owner's third round was all sound and health: the landing heard, the gate heard, the heart's strip. Nothing was asked about rules; everything about whether the world answers back. · R2, R8
- 2026-09-25 · "It runs, pacing is better, feels challenging in a good way": the first verdict on the whole session rather than a part of it. · R16, M
- 2026-09-25 · The way back from the gunship to the tank was not findable: a seat you cannot leave is a trap, however good the seat. · R1
- 2026-09-14 · The piloted Rotor clearing all fifty in a four-second burst: the first unambiguous power moment in the story. It came from one multiplier, not a new system. · R17, R13
- 2026-09-14 · Rounds "that looked hit but didn't die": the picture and the rule disagreed (surface-flying rounds versus a reticle in space). Felt fairness is visual truth. · R2, R1
- 2026-09-14 · The gunship took eight briefs in a day to find its view; thermal and the top view were rejected. The owner knew the feeling and not the form, which is exactly R19 working as intended. · R19
- 2026-09-14 · The gunship's paint-then-launch: a two-step ritual for the big gun reads as weight. · R8
- 2026-09-14 · The grey seat, black enemies on black, no readable impacts: the monochrome look failed at its first job, which is showing the player what matters. · R2
- 2026-09-14 · The Isao comms box "much too long", a recurring request: the character is liked and the delivery is resented. · R1, R8
- 2026-09-14 · The Quiver locked only close: the cause was sightline, not range. What feels like a rule is often geometry. · R19
- 2026-09-14 · Fifty harmless phage boiling from the whole crater at once reads as a swarm; a trickle didn't. · R3
- 2026-09-13 · The Quiver lock: "the opposite of satisfying; frustrating, seemingly random, no skill, no agency." Agency is legibility. · R1, R13
- 2026-09-13 · The swarm lab as a grid "teaches nothing"; as a canyon lane with the splat, the slowdown and the RAM shout, it became a feel test. Measurement without feel wasn't what was wanted. · R5, R12
- 2026-09-13 · Satisfying: ramming bonuses; timing a shield and *leaving low enemies alive* to keep the combo. That is a player-invented strategy where the fun path and the winning path coincide. · R13, R10
- 2026-09-13 · Satisfying: the gate opening, the revolving barrels, the spool that follows them. The small mechanical truths. · R8
- 2026-09-13 · The phage's animation, a blob squash on a rigid lander silhouette, felt wrong. The most-killed thing should be the most pleasing to kill. · R2, R8
- 2026-09-13 · The breach seen from a static orbit felt distant; the fast dive to the sinkhole as it opens felt like an event. · R16
- 2026-09-12 · The zoom inside the rocket showed "there is little to see"; a held medium shot on Isao's face said more. · R17
- 2026-09-08 · Wave-42 playtest: rapid promotion, plentiful biomass, too few meaningful spending choices, tower overload. The economy is interesting on paper and hollow in play. · R5, M
- 2026-09-08 · Both sniper modes "not quite working yet". A game inside the game with no reason to exist inside *this* game. · R6
- 2026-09-01 · The HUD "way too busy"; Isao's messages need dismissing; switching views too hard. Three of four issues were the game putting things in front of the player. · R1, R6
- 2026-08-24 · Removing allies from TD fixed the problem outright. Subtraction worked. · R17, R6

---

## Questions worth sitting with

These are not decisions. Each one is phrased so a single playtest could move it.

1. If the game had to name its one emotion, is it *resourceful joy under pressure*? If not, what?
2. Is seat-switching the core decision? If so, what would it take for it to feel like the most fluid verb in the game?
3. When the sentries learn to shoot on their own, what keeps the player in the seat? Is the answer designed, or left to happen?
4. What does the colony *want* from the player that the player could refuse, delay or do differently?
5. Where does the sphere pay emotionally, and should it be spent only there?
6. Which borrowed moods (AC-130, thermal, minigun) serve Isao's optimism, and which just come along with the assets?
7. Of Stalheart's own inventions (recycled rocket, belt ladder, bays as lives, vibration language, ram farming), which gets the next week of attention?
8. What could a player *own*: a named hull, a painted gunship, a base layout, a decoded word?
9. The first wave cannot hurt anything. When is the first moment a player could lose something they care about?
10. Of the modes and labs, which would you cut if the game had to be one thing?
