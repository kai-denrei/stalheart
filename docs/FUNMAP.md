# FunMap

**Identity: resourceful joy under pressure** (owner, 2026-09-14, `2026-09-14-identity-resourceful-joy-under-pressure`). The pressure is the swarm, the clock and the hardware; the joy is Isao, the builder who rebuilds, and a colony grown out of the wreck it arrived in. Every component answers to one or the other.

A companion to `ROADMAP.md`. The roadmap lists open items; this page is about how the game feels. Each line is a felt observation, dated, tagged with the lesson it touches. It is not a task list. Diagnoses come from the owner's playtests; the prescriptions stay with the design (Rosewater 19).

Lenses: Mark Rosewater's twenty lessons (R1–R20, from `~/Dev/game-design-lessons`) and Sid Meier's test that a game is a series of interesting decisions (M). `docs/PLAYFEEL.md` still holds the owner's raw notes; this page reads them together with the log.

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

## Felt observations

Newest first. Each line: date, what was felt, the lesson it touches. Add a line and keep the date. Don't turn a line into a task here; the roadmap owns tasks.

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
