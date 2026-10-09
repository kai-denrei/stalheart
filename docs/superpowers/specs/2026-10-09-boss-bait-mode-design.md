# The boss lab's bait mode: Isao as bait, the player in the gunship (design and plan)

Owner, 2026-10-08: "next we will test another mode; Isao the drone is flying low and acting as the bait, and we control the
gunship, we must kill the creature without hurting Isao." Brainstorm (2026-10-08/09): Isao on autopilot (A); the game's
gunner seat (A); Isao has a small health bar (A), "and we record some basic new lines: 'It's just a fleshwound', 'This but a
scratch', 'Come at me bro!', 'What do we say to death?', 'Not Today'." Builds on the boss lab on branch `refactor-run`
(specs `2026-10-08-boss-fight-prototype-design.md`, `2026-10-08-boss-fight-next-round-design.md`,
`2026-10-08-boss-lab-game-camera-design.md`); the game controller and `src/fx/nih-dairia/*` are untouched.

## Design

**The mode.** A panel switch `mode: tank | bait` (default `tank`, so every existing step is unchanged). In bait mode: no
tank (hidden, not driven, not prey, no cannon), no automatic friendlies (the schedule makes no plans), SOL off; the player
is the gunship. The creature, its fright and stun (from the player's 40 mm and MK-9 landings), the arena, the obstacles, the
health bar and dead-stays-dead (R restarts) carry over.

**Isao on autopilot.** The game's model (`makeIsaoDrone` in `src/units.js`, as `src/labs/story-landing.js` uses it, scaled
to his game size), flying at 3.4 m (the game's `ISAO_ALT` in cells x the lab's 10 m cells if it is in cells: read
`src/fx/isao-worker.js` ~26 and convert) over the surface. The pure stepper `stepBait(bait, dt, creature, tune)` in
`src/domain/boss-bait.js`: Isao keeps `bait.keep` (20 m) outside the creature's front edge toward himself (the edge as
`lineOf` computes it, from Isao's side), circling it counter-clockwise at `bait.speed` (14 m/s), backing straight off at
`bait.flee` (24 m/s) when any floor contact comes within `bait.panic` (12 m); his heading eases at 3 rad/s; the lab routes
his target round obstacles with the arena's `route`. The creature's pursuit target is Isao (his ground point), through
the same target writer as the tank (fear, routing, `targetHeld` rules unchanged: Isao is always "held", never captured by
the feeding; a capture is the domain's own test below).

**Isao's health.** `bait.health` 12. Every landing resolves against Isao with the creature's falloff on his distance to
the landing point (`splashDamage(d, radius, damage)`): a 40 mm direct hit 4, the 25 mm stream `rotary.dps` x dt while he is
inside its ring, the MK-9 60 (fatal). At 0: LOST `Isao down`. A floor contact within `bait.caught` (3 m) of his ground
point for 0.5 s: LOST `Isao taken`. The bar sits under the creature's (`ISAO` label, the integrity HUD's row markup). The
KILLED card adds `Isao <hp>/<max>`.

**The gunner seat.** The gunship lab's (`src/labs/gunship-tab.js`) controls and lens on the boss arena: point to aim inside
the lens, `1/2/3` select the 25 mm, 40 mm, MK-9, hold to fire, wheel to zoom, WASD pan; the gunship on station overhead
(the domain's `makeGunship(GUNSHIP_ORBIT, { station: true })`). The rounds are the fight's rules, aimed by the player: a
new domain entry `playerShot(state, gun, at, now, tune) -> plan` makes the same plan kinds the schedule makes (`rotary` as
a stream that follows the reticle while held, `bofors` a round, `nuke` the MK-9 at its reload), with their rings, and the
friendlies' existing presentation draws and resolves them (its `tick` gains the player's plans; no second presentation
path). The port lives in `src/labs/boss/seat.js` (the lens, the input, the reticle); where the gunship lab's code is
copied, the header says from where; sharing it with the gunship lab is a later refactor.

**Isao's lines.** In the owner's voice project `~/Dev/seiyu_voice` (`ISAO-VOICE-LINES.md`, the `isao` CLI, README "Daily
loop"): a new section `## 14. Bait (the boss lab)` with triggers `bait_hurt` ("It's just a flesh wound." / "This is but a
scratch."), `bait_taunt` ("Come at me, bro!"), `bait_death` ("What do we say to death?"), `bait_not_today` ("Not today.");
`isao import`, `isao render --stale --todo`. Approval is the owner's (`isao serve --port 8766`), then `isao export` and
`node scripts/import-isao-voice.mjs` in Stalheart. The lab plays them through the game's Isao voice when the trigger has an
exported line, else shows a caption: `bait_hurt` on his first and second hits; `bait_taunt` when a contact first comes
within 25 m; `bait_death` when he first drops below 30 %; `bait_not_today` 2 s after `bait_death` if he is alive; at most
one line every 4 s.

**Out.** Tuning the creature's health for a player's aim (the owner's playtest); the tank and the bait together; SOL in
bait mode.

## Plan

### Task 0: make room (behaviour-neutral)
`src/labs/boss-tab.js` is 970 lines. Move the acceptance handle (`const lab = {...}` and its helpers, ~95 lines) to
`src/labs/boss/handle.js` behind a factory taking getters, as Task 0 of the previous round moved the body rules. `--boss`,
`--boss-fight`, `--boss-walls`, `--boss-cam` green before and after. Commit.

### Task 1: the bait's rules (content + domain, node test)
`src/content/boss-fight.js` gains `bait: { health: 12, keep: 20, speed: 14, flee: 24, panic: 12, turn: 3, altitude: <Isao's
game altitude in m>, caught: 3, caughtFor: 0.5 }`. New `src/domain/boss-bait.js`: `makeBait(at)`, `stepBait(bait, dt,
creature, tune)` (the autopilot above; returns the wanted ground point and heading), `hurtBait(bait, plan, dt)` (falloff;
streams by dt), `baitCaught(bait, creature, dt, tune)`. `src/domain/boss-fight.js` gains `playerShot(state, gun, at, now,
tune)`. Node test `test/boss-bait.mjs`: the keep distance holds within 3 m over 30 s round a scripted creature; panic backs
off; a direct 40 mm costs 4, the nuke kills, a stream costs dps x dt; caught after 0.5 s within 3 m, not before; `playerShot`
plans match the schedule's shapes (radius, damage, timings) for each gun and respect the MK-9's reload. Commit.

### Task 2: bait mode in the lab (Isao, the creature hunting him, the bar, the cards, the lines' hooks)
`src/labs/boss/bait.js` (Isao's model, the autopilot wiring, the health row, the line triggers with captions) and the mode
switch in `boss-tab.js`. In bait mode the schedule's plans are not made (pass every shooter disabled) and the tank is out.
The handle gains `bait()` → `{ pos, hp, max, heading }` and `mode(m)`. Commit.

### Task 3: the gunner seat
`src/labs/boss/seat.js`: the lens, the input and the reticle from `gunship-tab.js`; firing calls `playerShot` and hands the
plan to the friendlies; the friendlies resolve every plan against the creature and Isao (`hurtBait`). The handle gains
`aim([x, z])`, `gun(key)`, `fire(on)`. Commit.

### Task 4: the voice lines (in ~/Dev/seiyu_voice)
Add the section and triggers to `ISAO-VOICE-LINES.md`, `isao import`, `isao render --stale --todo`; check `isao status`
(no "!" over-length). Commit there (the project's own register, the Kai Denrei identity). Do not approve or export: the owner
approves. Report the render ids.

### Task 5: the browser step and the records
`--boss-bait`: bait mode on; Isao keeps 17-23 m from the front edge for 10 s of lab clock; `aim` at the creature's far side
(away from Isao) with the 40 mm for 3 s: hits > 0 and Isao's hp unchanged; `aim` at Isao with the 40 mm: his hp falls; the
MK-9 aimed on him: LOST `Isao down`; R restarts; a scripted kill (aim the 25 mm at the creature's far foot until KILLED, 90
s real-time cap) holds KILLED 5 s. Records: a design entry (accepted) and a landing entry; STATE.md's boss line. Commit.
