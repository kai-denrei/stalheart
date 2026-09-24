# Session pacing: sector 0, the clock and the back door

Owner, 2026-09-24: "fix the pacing of the game". Answers from the brainstorm, kept verbatim where they decide something:

- Sector loop: "too slow between enemies, not hectic enough."
- Back door: "should feel slightly foreshadowed, but really a chance for the tank to kill tons of rammable soft enemies for the
  first wave, and then the necessity to spend resources to quickly re-inforce that area with turrets."
- Opening: "just Isao coming out, and starting to build, diegetic ... The Tank is built by the Stalheart ... the first few waves
  before the Stalheart is ready could be more intense POV sentries and Gunship shooting from above to protect the construction
  of the Stalheart. Then with the Stalheart we get the first tank, which unlocks the ability to explore on the ground."
- Gunship: "already in orbit, not equipped to develop a colony but its purpose is to defend new colonies."
- Wave release: clock-driven and overlapping (chosen over clear-gated-faster and a continuous stream).
- Scope: A (the sector clock), B (the back door) and C (sector 0) as one piece of work. D (the settlement-industry and
  orbital-launcher unlocks, a self-sustaining colony, the Dyson-sphere end game) is recorded as direction in STATE only.

## What is measured today (why it is slow)

- A sector wave is released only once **every** non-guard body on the field is dead, then 7 s more (11.2 s for the first
  two). One straggler holds every breach; the story has no stall timer (`src/td-tab.js` wave clock, `params.waveCap` is off in
  the story).
- Gate-side breaches stand about 69 hops out and sector bodies march at pace 1.0 (only the tutorial fifty get 1.7): a wave
  walks 50-70 s before it arrives, having spawned in 3.2 s.
- Sector 1 sends 4 / 8 / 14 / 19 bodies per breach.
- A sector opens with a 6 s card, then `place()`, then 1.5 s stagger + 7 s breach opening + 7 s warning: about 15.5 s from the
  card to the first body, then the walk.
- The back door collapses the moment sector 2 begins, with nothing before it.

## A. The sector clock

1. **Waves on a clock.** In a story sector, a wave pulse ends when its release has left the queue, not when the field is
   clear. The next pulse arms `pulse` seconds later whatever is alive (the warning rings still play in the last WAVE_WARN of
   that gap). Waves stack when the player falls behind; that is the pressure. Two in-place edits in the board's wave clock:
   the clear test and the gap read the sector run's answer while a sector is running. The board's own campaign clock is
   untouched.
2. **A cap, not a stall.** `SECTOR_TIMING.aliveCap`: while that many sector bodies are alive the next pulse does not arm
   (the frame budget, and a floor under a player who is losing anyway: the gate wears and the swarm walks in).
3. **Faster, closer.** Sector bodies carry `SECTOR_TIMING.pace` (1.5) like the tutorial's fifty carry theirs, and gate-side
   breaches are placed on a ring of `SECTOR_PLACEMENT.ringHops` (about 45) instead of the field's 69, so a wave arrives in about
   30 s.
4. **No dead time at a sector's start.** Breaches are placed and open while the brief card is up (the card no longer delays
   `place()`); the first pulse may arm while a breach is still opening (the release path already holds a body until its
   breach is ready).
5. **Heavier.** The table moves up the ladder and down the clock:

   | Sector | Breaches | Waves | Ladder | Threat | Pulse | Per breach |
   |---|---|---|---|---|---|---|
   | 1 THE LANE | gate 2 | 6 | 1-6 | 2.5 | 16 s | 11 20 37 50 58 63, all rammable |
   | 2 THE BACK DOOR | back 1, gate 1 | 6 | 2-7 | 2.2 | 14 s | back wave 1 is the feast (B) |
   | 3 BOTH WALLS | gate 1, back 1 | 8 | 7-11 | 2.2 | 12 s | + 2 hard cores a wave |
   | 4+ | generated | 6 + n-3 | 7-11 | +0.2 | 12 s | |

   These are the first numbers; the probe (E) is what tunes them.
6. **Isao still builds.** A programme step marked `idle` waits only while a pulse is releasing, which with the clock is a few
   seconds in every pulse, so the base keeps growing through a hectic sector.

## B. The back door

1. **Foreshadowed in sector 1.** At sector 1's second and last pulses the back mouth rumbles: a tremor contact on the radar at
   the mouth, a low quake cue, a puff of dust and grit off the rock (a cheap burst, not the sinkhole's dust pass), and Isao:
   first "Did you feel that? Behind the bays." / "That rock is not as solid as I thought.", then "It is cracking back there." /
   "Whatever is out there wants in." A pure schedule (`src/domain/back-omens.js`) says which omen is due; the numbers are
   `BACK_OMENS` in `src/content/sectors.js`; a small fx module plays them.
2. **The feast.** Sector 2 opens the back breach first. Its first wave replaces the ladder with `feast`: a flood of soft,
   rammable bodies (about 60 amoeba and phage) at the tutorial's surge pace. Isao: "The back wall is down. They're soft. Go
   through them!" The gate breach opens `gateDelay` (about 25 s) later, so the tank has the back to itself for one wave.
3. **The scramble.** When the feast is mostly dead (or the gate breach opens, whichever comes first), Isao: "More are coming
   through the back and I can't hold both sides. Put turrets behind the bays, now." The back sockets pulse on the ground for a
   few seconds and are mountable from the moment the mouth falls (their perch direction is set at the collapse, no longer
   at the back gate's print). The feast's rams pay for two or three towers; the back gate itself still prints once the
   back breach is held or closed.
4. The collapse shot stays: it is the reveal. The `sector_2` line is no longer lost behind `old_breach` and `back_door` in the
   one-deep brief queue.

## C. Sector 0: THE FOUNDATION

The bare page's opening becomes the defence of the Stålheart's construction.

| About | Beat |
|---|---|
| 0 s | The SH02 lands, Isao comes out; the AFR-01 recycles the wreck (its clip's 15 s to the first barrel is the floor). |
| 20 s | The Rotor, then the gate and walls, then the Quiver: all printed in the world. |
| 40 s | **Isao begins the Stålheart**: one long print (about 75 s) with a HUD readout, `STÅLHEART 34%`. The tremor and the breach come with it. |
| 45-80 s | The fifty surge; manual override on the Rotor; when they are down the Quiver's two hard cores. |
| 80 s | **The gunship arrives from orbit**: it is a colony-defence platform, not a builder. Isao's line, a free first pass, the meter from then on. Waves come on a clock from the sinkhole until the Stålheart stands; the player hops between the Rotor, the Quiver, the gunship and the map. |
| 120 s | **The Stålheart stands.** The sinkhole caves in, the towers go automatic (the handover), and **the first MÖRK rolls out of the Stålheart** in a short hero shot. The player is in the tank. |
| 130 s | The study, the expedition sites; sector 1 when the expedition phase is reached, as today. |

- There is no hull before the roll-out: not drawn, not driven, not offered in the views strip.
- Sector 0 cannot be lost: its bodies can pile at the gate but the gate does not wear outside a sector, as today.
- `STORY_CONSTRUCTION` (content) holds the construction waves; the story beats run them in a new `construction` phase between
  the Quiver's cores and `settled`, and leave it when the host says the Stålheart stands.
- The SKIP TUTORIAL entry, explicit `stage=N` / `story=N` links and the static stages are unchanged: they start past sector 0
  with the tank.
- SOL-82 stays a sector 2 system for now; it is the natural orbital-launcher unlock when D is designed.

## D. Direction only

The colony becomes self-sustaining: new structures to unlock (SentryTowers_A6 settlement-industry and orbital-launcher
assets), a production chain, and the end game of building elements for a Dyson sphere. Recorded in STATE; its own spec later.

## E. Evidence

- A `--pacing` browser step plays a bare page from landing through sector 2's first back wave with the towers automatic and
  the tank parked, and prints a timeline: every beat, every pulse, alive counts per 5 s, and the **dead time** (seconds in a
  sector during which no live body is within 8 cells of the gate or the back mouth). Targets: Stålheart standing and the
  MÖRK out by 150 s; the first body of a sector at the gate within 40 s of its card; dead time under 10 s a minute once the
  first body has arrived.
- Node tests for the pure pieces: the pulse rule, the cap, the feast override, the omen schedule, the construction beat.
- The existing suites stay green: default, `--story-world`, `--grow`, `--sectors`, `--backdoor`, `--skip-tutorial`, `--defense`,
  `--seats`, `--showcase`, `--dist`. Where a step measured the old pacing rather than what it asserts, it is retimed, never
  weakened.
