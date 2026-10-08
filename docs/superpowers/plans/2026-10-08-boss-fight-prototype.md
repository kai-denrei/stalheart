# The boss fight prototype: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** turn the Nih-Dairia lab into the dodge loop of the mode idea: the game's drive feel, a cannon that provokes, the gunship and SOL-88 firing from above with red landing spots, a health bar, and a round the player wins by staying out of the rings for about thirty seconds.

**Architecture:** the fight's rules are one pure domain module (`src/domain/boss-fight.js`, numbers from `src/content/boss-fight.js` passed in as `tune`) with a node test; the lab gets four files under `src/labs/boss/` (drive, cannon, friendlies, round) and `src/labs/boss-tab.js` stays composition. Everything reused is already in the tree: the game's drive rules and tankfeel, the ordnance shell, the explosions, the gunship's gun model and optic, the orbital laser, the integrity HUD's bar markup. The game controller is untouched.

**Tech Stack:** native ESM, vendored three r160, lil-gui, the browser harness.

Spec: `docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md` (read it first; it is the contract, numbers included). Lab as it stands: `src/labs/boss-tab.js` (575 lines: the frame, the rig, the tank on `stepYardDrive`, the lures, the readout, the acceptance handle `window.__bossLab`). The exploration that found the reusable pieces is summarised in the spec's sections 2 to 4; the file paths and signatures named there are real — read each before using it.

## Global Constraints

- Worktree `/Users/minikai/Dev/stalheart-refactor-run`, branch `refactor-run`. Never push, never merge. One commit per task; the message in the project's register, then a blank line, then the session's two attribution lines. `git config user.email` must be `270854086+kai-denrei@users.noreply.github.com`.
- Layers: `src/domain/boss-fight.js` imports nothing. `src/content/boss-fight.js` imports nothing. `src/labs/boss/*.js` and `src/labs/boss-tab.js` import `src/fx`, `src/content`, `src/domain`, `src/labs`, the vendored three, `vendor/lil-gui.esm.js`, and the shared top-level builders the labs already import (`../tankfeel.js`, `../feelstore.js`, `../shell.js`, `../units.js`, `../audio.js`); never `td-tab.js`. `npm run architecture` enforces it. No new top-level `src/*.js`. `src/fx/nih-dairia/*` is not modified by this plan (if a task needs a change there, it stops and reports NEEDS_CONTEXT).
- Local metres on the frame's plane everywhere in the lab's logic: x east, z north, yaw 0 drives +z, as the lab already does; world placement only through `toWorld(frame, [x, y, z], 1)` dropped to the surface (the lab's `tankWorld()` shows how). Creature-native units only inside the shove and the hit tests (divide by `scale`).
- Time in seconds from the lab's own clock `t`; the fight's clock is the domain's.
- After every edit of a `src` file: `node --check <file>`. Before each commit: `npm test`, `npm run check`, `npm run build` green. The browser step (Task 5) runs from a snapshot through the lock, one Chrome, memory checked first.
- No console logging. No colored emoji; monochrome vocabulary; the cards use the swarm lab's `.sw-card`. Tests are node programs with named bounds, one summary line, no digests.
- The game's numbers are read from their owners (`TANK_DRIVE`, `TANK_STEER` in `src/content/tank.js`; `GUNSHIP_GUNS`, `GUNSHIP_ORBIT` in `src/content/gunship.js`; `LASER_*` in `src/content/orbital-laser.js`; `CANNON_COOL = 3`, shell speed 90 m/s and reach 120 m from `src/content/tank.js` `SHELL_SPEED`/`SHELL_REACH` if they exist there, else the spec's literals), never re-typed with different values.

---

### Task 0: Content and the fight's rules

**Files:**
- Create: `src/content/boss-fight.js`
- Create: `src/domain/boss-fight.js`
- Create: `test/boss-fight.mjs`

**Interfaces:**
- Produces: `BOSS_FIGHT` (frozen): `{ health: 180, warn: 1.5, lead: 1, scatter: 0.5, bofors: { burst: 2.6, rest: 1.4, rate: 2.4, damage: 4, radius: 22, travel: 2.6 }, sol: { every: 8, aim: 1.5, burn: 2, dps: 10, radius: 8 }, hull: { radius: 4.2 }, card: 3, respawn: 40, deathGravity: 10 }`.
- Produces (domain): `makeFight(tune) -> state`, `startFight(state)`, `schedule(state, now, creature, tune) -> plans[]`, `resolveLanding(state, plan, creature, tank) -> { damage, tankHit }`, `burn(state, plan, dt, creature, tank) -> { damage, tankHit }`, `capture(state, reason)`, `kill(state)`, `tick(state, dt) -> null | 'reset'`, `readout(state)`, exactly as the spec's section 6 defines them. `state.strikes` keeps every plan made this fight (for the readout and the browser step); `state.phase` is `'idle' | 'fight' | 'lost' | 'killed'`; `state.reason` holds the capture reason.

- [ ] **Step 1: the test first.** `test/boss-fight.mjs` per the spec's section 8: import `BOSS_FIGHT` and the domain; a creature `{ centre: [0, 0], velocity: [0, 0], radius: 15, contacts: <a disc of 60 points within 15 m> }`; run `schedule` at 1/60 s steps for 30 s collecting plans; assert the Bofors plan count is within one burst (6) of `floor(30 / (burst + rest)) * round(burst * rate)` and the SOL count is `floor(30 / every)` or one more; every plan has `showAt === land - warn` (Bofors) and `fireAt === land - travel`, SOL has `showAt === land - aim` and `until === land + burn`; every Bofors `at` is within `scatter * radius` of the centre; `resolveLanding` with a contact at `plan.at` gives `damage === bofors.damage`, with the nearest contact at the ring's edge gives 0; the tank at distance `radius + hull.radius + 0.01` is not hit, at `radius + hull.radius - 1` is; a 30 s loop of schedule + resolve on the disc + `burn` for SOL plans brings `hp` to 0 at a time between 24 and 36 s (print the time in the summary); `capture(state, 'caught')` then `tick` by `card + 0.01` returns `'reset'`; two fights from the same seed produce identical plans. One summary line.
- [ ] **Step 2:** run it: fails on the missing modules.
- [ ] **Step 3: content**, then **the domain**. Scatter: the golden-angle sequence `k -> (r = scatter * radius * sqrt((k + 0.5) / N), a = k * 2.399963)` with `N = 8` cycling, or any deterministic sequence from `state.seed` — document it. `schedule` advances a Bofors cycle `{ phase: 'burst' | 'rest', left, nextRound }` and a SOL clock; a plan's `land = now + max(warn, travel)` for Bofors (`fireAt = land - travel`, `showAt = land - warn`), `land = now + aim` for SOL. `resolveLanding` uses the nearest contact distance `d` with `damage * max(0, 1 - (d / radius)^2)`. `burn` applies `dps * dt` while any contact is within `sol.radius` of `plan.at`. `tick` runs the fight clock and the card; `readout` computes `hpPerSecond = (max - hp) / clock` and `timeToKill = hp / hpPerSecond` (`Infinity` before any damage).
- [ ] **Step 4:** test green; `npm test`, `npm run check` (the guard lists the new domain module), `npm run build`.
- [ ] **Step 5: Commit** — `The boss fight's rules are a pure domain module with its numbers in content: the strike schedule and its warnings, the landings' falloff, the burn, the round; thirty seconds to kill proven in node`.

---

### Task 1: The game's drive feel on the plane

**Files:**
- Create: `src/labs/boss/drive.js`
- Modify: `src/labs/boss-tab.js` (replace the `stepYardDrive` use; add audio and the engine loop; the blocker from the body's contacts)

**Interfaces:**
- Produces: `createPlaneDrive({ feel, tune = { drive: TANK_DRIVE, steer: TANK_STEER, pace: 1.1 * 1.6 * 10 } }) -> { state: { x, z, yaw, speed, cruise }, step(dt, input: { throttle, turn, cruiseTap }, blocker) -> { moving, blocked }, heading() -> [dx, dz], reset(x, z, yaw) }` where `throttle` is -1, 0 or 1, `turn` -1, 0 or 1 (+1 left), `cruiseTap` true on a double-tap of forward; `blocker(x, z) -> null | { nx, nz, depth }` is the lab's test (a push-out direction and depth in metres); `speed` is the signed pace in m/s after the ramp; `feel` is the lab's tankfeel state and the module writes `feel.bank` from `steerBank`.
- Consumes: `makeDriveRamp`, `stepDriveRamp`, `scrubDriveRamp` (`src/domain/drive-ramp.js`), `makeSteerEase`, `stepSteerEase`, `steerBank` (`src/domain/steer-ease.js`), `TANK_DRIVE`, `TANK_STEER` (`src/content/tank.js`), `stepTankFeel`, `applyTankFeel`, `makeTankFeel`, `landTankFeel` (`src/tankfeel.js`), `FEEL`, `loadFeel` (`src/feelstore.js`), `makeAudio` (`src/audio.js`) as the swarm lab uses them (read `src/labs/swarm-tab.js` lines 180-240 and 360-380 and `src/fx/hull-drive.js`'s manual branch for the exact composition and constants: `drive` +1 forward, -0.55 reverse, 1.45 cruise; `v = pace * drive * mul`).

- [ ] **Step 1:** read the four sources above and `src/content/tank.js`.
- [ ] **Step 2:** write `drive.js`: per `step`: `rate = stepSteerEase(steer, dt, turn, tune.steer)`; `yaw += rate * dt`; `dr = throttle > 0 ? (cruise ? 1.45 : 1) : throttle < 0 ? -0.55 : 0` with cruise set by `cruiseTap` and cleared by reverse or a turn-free stop as the game does (read `hull-drive.js` for the cruise rule and copy it); `mul = stepDriveRamp(ramp, dt, dr, turn !== 0, tune.drive)`; `v = tune.pace * dr * mul`; `x += sin(yaw) * v * dt; z += cos(yaw) * v * dt`; then the blocker: `const b = blocker(x, z); if (b) { x += b.nx * b.depth; z += b.nz * b.depth; v = 0; scrubDriveRamp(ramp, 1, tune.drive); }`; `feel.bank = steerBank(steer, tune.steer)`; return `{ moving: |v| > 0.2 || dr !== 0, blocked: !!b }`.
- [ ] **Step 3:** in `boss-tab.js`: `const drive = createPlaneDrive({ feel })` replaces the yard drive and its state (keep the local-metres convention and the `tankWorld()` placement); keys map to `throttle`/`turn`/`cruiseTap` (double-tap W within 300 ms); `stepTankFeel(feel, dt, moving, FEEL); applyTankFeel(tank, feel, FEEL)` each frame; audio: `makeAudio({ base: '../' })` resumed on the first gesture, `tank_engine` looped while moving (the swarm lab's `engineOn` pattern); the blocker: from the creature's floor contacts (`body.contact[i] > 0`), the nearest contact's local xz scaled; if the tank's centre is within `hull.radius` (4.2 m) of it, return the push-out away from the creature's centre with `depth = hull.radius - d`. Keep `targetHeld` fed from the new drive (`moving` or a key held).
- [ ] **Step 4: verify by hand** on the dev server already running on port 8156 from this worktree (`http://localhost:8156/labs.html#boss`; if it is not running, start `node scripts/serve.mjs --port 8156` in the background and stop it when done): the hull accelerates over seconds, banks in turns, stops dead against the body, reverses slowly, cruises on a double tap. `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `The boss lab drives with the game's feel: the steering ease, the acceleration ramp that scrubs on a turn or a hit, the hover and the engine; the creature's body stops the hull`.

---

### Task 2: The cannon

**Files:**
- Create: `src/labs/boss/cannon.js`
- Modify: `src/labs/boss-tab.js` (wire; Space fires; the sleeve; the shove)

**Interfaces:**
- Produces: `createCannon(scene, { sphere, surface: (x, z) -> { point: THREE.Vector3, normal: THREE.Vector3 } (world, dropped to the ground), cellSide: 10, explosions, sfx, feel, cool: CANNON_COOL }) -> { fire(from: [x, z], dir: [dx, dz]) -> bool, tick(dt, hitTest: (x, z) -> null | { x, z }), heat() -> number, shells() -> number, dispose() }`; `hitTest` returns the hit point when a shell at `(x, z)` meets the body, else null; the cannon bursts there and calls `onHit` passed at creation (`onHit(x, z)`), counted by the lab as `provokes`.
- Consumes: `makeOrdnanceShell(2, 'y')` (`src/shell.js`), `explosions.spawn('tank.shell', point, normal, cellSide)` (the lab already has `explosions`? if not, `createExplosions(scene, { onError })` from `src/fx/explosions.js` added to the lab with its `tick(dt)`), `fireTankFeel` (`src/tankfeel.js`), sfx `tank_main` on fire and `blast_fire` on a burst.

- [ ] **Step 1:** read `src/fx/tank-laser.js`'s `fire` and `src/td-tab.js`'s `updateProjectiles` for the shell's spin, orientation and burst; `src/units-tab.js` `fireShell` for the muzzle.
- [ ] **Step 2:** write `cannon.js`: `fire` refused while `heat > 0`; a shell record `{ x, z, dx, dz, dist, mesh }`, the mesh scaled `cellSide * 0.16`, placed by `surface(x, z)` lifted 1.2 m along the normal, oriented `quaternion.setFromUnitVectors(Y, dirWorld)` and spun `rotateY(dist * 60)`; `tick`: `x += dx * 90 * dt`, `dist += 90 * dt`; at `dist >= 120` burst on the ground; `hitTest(x, z)` non-null: burst at the hit, `onHit`; `heat = max(0, heat - dt)`.
- [ ] **Step 3:** in `boss-tab.js`: Space (and a `fire` button for touch later, not now) calls `cannon.fire([drive.x, drive.z], drive.heading())` from the hull's muzzle if `tank.userData.muzzle` exists (its world position mapped `toLocal`), else the hull's position; the sleeve: if `tank.userData.heatSleeve`, `color.lerpColors(cool 0x232833, hot 0xff2a10, heat / CANNON_COOL)`; the `hitTest`: nearest body node (`body.x` triples, scaled, in local metres) within 2 m of the shell → the hit; on hit: the radial shove from the spec (strength capped at 0.08 native, radius 0.04 native, lift 0.02) on `creature.body.velocity` (re-read after a variant switch) and `creature.motion.disturb()`, `provokes++` on the readout.
- [ ] **Step 4:** verify by hand (shell flies, bursts on the body and the ground, the body flinches, the sleeve glows and cools over 3 s); `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `The boss lab's tank fires the game's shell: the three-second barrel, the burst, a shove and a flinch on the body, no wound (the tank provokes)`.

---

### Task 3: The friendlies and the red spots

**Files:**
- Create: `src/labs/boss/friendlies.js`
- Modify: `src/labs/boss-tab.js` (wire; the fight state from Task 0 lives in the lab from here: `fight = makeFight(BOSS_FIGHT)`, `startFight` on the first movement)

**Interfaces:**
- Produces: `createFriendlies(scene, { sphere, surface, cellSide: 10, explosions, sfx, tune: BOSS_FIGHT, fight: () => state, creature: () -> { centre: [x, z], velocity: [x, z], radius, contacts: [[x, z], ...] } (local metres; contacts from body.contact > 0), tank: () -> { pos: [x, z], radius }, onTankHit: (reason) -> void, enabled: () -> { gunship, sol } }) -> { tick(dt, now), rings() -> number, dispose() }`.
- Consumes (domain): `schedule`, `resolveLanding`, `burn` (`src/domain/boss-fight.js`); (gunship) `makeGunship(GUNSHIP_ORBIT, { station: true })`, `mountGunship`, `fireRound(gs, 'bofors', point, travel)`, `stepRounds(gs)` (`src/domain/gunship.js`; read `src/labs/gunship-tab.js` for the standalone pattern and the `impact()` helper), `GUNSHIP_GUNS.bofors` (`src/content/gunship.js`), `createGunshipOptic(scene, { cellSide, metresPerCell })` `.flight(from, to, 0xffb43d, travel, 0.5)` and `.fade(dt)` (`src/fx/gunship-optic.js`), explosions `gunship.bofors` and the gun's `impact` cue; (laser) `createOrbitalLaser(scene, { cellSide: 10, metresPerCell: 10 })` with `guideAt`, `hideGuide`, `lay`, `aim`, `lift`, `tick(dt, energy01)`, `clear` (`src/fx/orbital-laser.js`; read `src/labs/laser-tab.js`'s `applyBurn` around line 945 and the lab's `laser.guideAt` use at line 1033), explosions `laser.ignite` once and `laser.contact` every eighth, the `laser_burn` loop via `sfx.loop` with `.stop()` (`LASER_AUDIO` must be in the audio's sounds: read how `laser-tab.js` makes its audio and add `LASER_AUDIO` to the lab's `makeAudio` sounds).

- [ ] **Step 1:** read the sources above; note the planet-centred metre convention (`sphere` group at `(0, -R, 0)`, `toCentre = v => [v.x, v.y + R, v.z]`) the laser's domain functions expect.
- [ ] **Step 2:** write `friendlies.js`: each `tick`: `plans = schedule(state, now, creature(), tune)` → push each plan to `pending`; for each pending plan: at `showAt` make its ring (an additive `RingGeometry(r * 0.94, r, 64)` in `0xff2a1a`, `depthWrite false`, `renderOrder 8`, lifted 0.1 m on the surface normal at `surface(at)`, opacity pulsing at 6 Hz; SOL uses `laser.guideAt(point, normal)` for the pointer AND a ring of its radius so the kill area is visible); Bofors: at `fireAt` `fireRound(gs, 'bofors', <planet-centred point of at>, travel)` and `optic.flight(sky, point, 0xffb43d, travel, 0.5)` from the sky point (the station's bearing, 340 m up: `surface(0, 0)` normal x 340 plus a fixed 120 m offset east); when `stepRounds(gs)` lands it (or at `land` if the domain's rounds and ours disagree, trust `land`): remove the ring, `explosions.spawn('gunship.bofors', point, normal, cellSide)`, `sfx.play(GUNSHIP_GUNS.bofors.impact ?? 'blast_fire')`, `resolveLanding(state, plan, creature(), tank())` → `onTankHit('a Bofors round')` if `tankHit`; SOL: at `land` `laser.lay(point, normal)`, `laser.ignite` burst, the burn loop started; while `now < until`: `laser.aim(point, normal)` (the contact stays where it landed: the spot is the promise), `burn(state, plan, dt, creature(), tank())` → `onTankHit('SOL-88')` if `tankHit`, `laser.contact` every 0.125 s; at `until`: `laser.lift()`, the loop stopped, `hideGuide`, the ring removed. `laser.tick(dt, energy)` and `optic.fade(dt)` every frame. `enabled()` gates each shooter (a disabled shooter makes no plans: pass `{ gunship, sol }` into `schedule`'s `tune` as `tune.bofors.enabled`/`tune.sol.enabled`, which Task 0's `schedule` must honour — if Task 0 did not, add the two booleans to `schedule` now with a one-line test).
- [ ] **Step 3:** in `boss-tab.js`: `fight` state, `startFight` when the drive first reports `moving`; `creature()` and `tank()` providers; `onTankHit` → Task 4's `capture` (until Task 4 lands: `capture(fight, reason)` directly and a readout line); the `creature()` provider's `velocity` from `motion.velocity` scaled, `radius` from the body's extent, `contacts` from `body.contact`.
- [ ] **Step 4:** verify by hand: rings appear 1.5 s before each landing, tracers arc down, bursts land on the rings, the beam lays on its pointer and burns, the health in `readout(fight)` falls (print it on the readout line now: `hp <n>/<max> · hits <n> · <hp/s> hp/s · ttk <s>`); `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `The gunship's Bofors and SOL-88 fire on the boss from above, every landing shown as a red ring 1.5 s ahead; the fight's rules decide the damage and the hull's loss`.

---

### Task 4: The round, the health bar, the knobs and the readout

**Files:**
- Create: `src/labs/boss/round.js`
- Modify: `src/labs/boss-tab.js` (wire; the fight folder of knobs; the readout; the handle)

**Interfaces:**
- Produces: `createRound(stage, { tune, fight: () -> state, onReset: () -> void, onKilled: () -> void, onLost: (reason) -> void }) -> { tick(dt) , dispose() }`: owns the bar (`.sw-hud` gets a row with the integrity HUD's `ih-lbl` / `ih-bar > i` / `ih-num` classes: `NIH-DAIRIA`, the fill `hp / max`, `ih-low` (or whatever class the HUD uses at 25 %: read `src/fx/integrity-hud.js` and `styles.css` `.ih-*` rules) below a quarter, the clock `m:ss.t` and `hits <n>`), the cards (`.sw-card`: `KILLED <time> · <hits> hits` / `LOST · <reason>`), and calls `tick(state, dt)` from the domain, invoking `onKilled` when `hp <= 0` first happens (the lab stops the creature and sets gravity 10), `onLost(reason)` on capture, `onReset` when the domain returns `'reset'`.
- The lab's reset: `creature.reset()`, `creature.phys.gravity = params.phys.gravity`, `motion.active = params.instinct`, feeding back on, re-anchor to the origin (`frame = frameAt(...)` as at start, `placeRig()`), the tank at `respawn` metres on the side away from the creature's centre, `drive.reset`, `fight = makeFight(BOSS_FIGHT)` (keep the seed advancing so runs differ unless a knob pins it), friendlies' pending plans and rings cleared (`friendlies.reset()`: add it to Task 3's interface if missing).
- Capture: when `motion.feeding.phase` leaves `'hunting'` (the lab already detects the meal for `taken`), `capture(fight, 'caught')`; a landing's `onTankHit(reason)` → `capture(fight, reason)` and the hull hidden with a `tank.shell` burst until the reset.
- Knobs: a `fight` folder: `health`, `warn`, `lead`, `scatter`, Bofors `burst`, `rest`, `damage`, `radius`, SOL `every`, `burn`, `dps`, `radius`, switches `fight`, `gunship`, `sol`, `cannon` (bound to a lab-owned copy of `BOSS_FIGHT` that `makeFight` and `schedule` read; a change to `health` applies at the next reset).
- Readout: the line gains ` · hp <n>/<max> · hits <n> · <hp/s> hp/s · ttk <s> · provokes <n>`; `window.__bossLab` gains `fight()` (the domain's `readout` plus `phase`, `reason`, `strikes: state.strikes.map(p => p.kind)`), `setFight(on)`, `circle(seconds, radius)` (drives the tank in a circle of that radius around the creature's centre for that long, with the game's drive: a scripted `input` each frame), `park()`.

- [ ] **Step 1:** read `src/fx/integrity-hud.js` and the `.ih-*` rules in `styles.css`; read the swarm lab's `.sw-card` use.
- [ ] **Step 2:** write `round.js`; wire; the killed look: `motion.active = false; motion.feeding.enabled = false; creature.phys.gravity = tune.deathGravity` (10) — the spec's v1 death — and the readout's state line reads `killed`; the reset restores all three.
- [ ] **Step 3:** verify by hand: stand still: the bar falls and in about 30 s the creature collapses, KILLED card, reset; get caught: LOST, reset; drive into a ring: LOST with the reason; the knobs change the cadence live; `copy settings` unchanged.
- [ ] **Step 4:** `npm test`, `npm run check`, `npm run build`.
- [ ] **Step 5: Commit** — `The boss lab's round: the health bar and the clock, KILLED (the body collapses under gravity 10) and LOST (caught, or under a landing), the reset, the fight's knobs and readout`.

---

### Task 5: The browser step and the records

**Files:**
- Modify: `scripts/browser-test.mjs` (a `--boss-fight` branch beside `--boss`)
- Modify: `docs/STATE.md` (the 2026-10-08 section gains the fight: what it proves, the numbers)
- Create: `docs/log/entries/2026-10-08-boss-fight-prototype-design.json` (decision, proposed), `docs/log/entries/2026-10-08-boss-fight-prototype-landed.json` (change, accepted)

- [ ] **Step 0: balance from the real body.** Task 4 measured a creature held still (instinct off) dying in 44.2 s at 5.19 hp/s, not the node proof's 30.6 s: the proof's 60-point disc is denser than the real floor contacts, so real rounds land farther from a contact and the falloff bites. Do: (1) in the browser (the harness's headless Chrome on the dev server, `__bossLab.readout()`/`creature()`), read the real contact set while the creature stands: the count of floor contacts and their distances from the centre (expose `contacts` in the handle's `fight()` or `readout()` as `[[x, z], ...]` if not there); (2) rebuild `test/boss-fight.mjs`'s fixture from it (the same count and radii, not a 60-point disc) and re-run the sweep script from Task 0's fix (`scratchpad/ttk.mjs`, or rewrite it) to pick the `health` that kills the standing real-shaped body in 29–31 s in node; (3) confirm in the browser with instinct off that the kill lands within about 3 s of 30 (`KILLED 0:3x`); set `BOSS_FIGHT.health` to that value; keep the node bound 24–36 s; record the contact fixture's origin in the test's comment and the measured times in the spec's section 5 (replace the 230 / 30.62 s sentence).
- [ ] **Step 1:** the step per the spec's section 8: open `labs.html?sw=0&acceptance=1#boss`, wait for the handle and steps > 0, `setFight(true)`, `circle(35, 45)`; poll `fight()` every second: assert `hp < max / 2` within 20 s, `strikes` includes both `'bofors'` and `'sol'`, `hits > 0`; print `BOSS-FIGHT <json>`; then `park()` beside the creature and `until(fight().phase === 'lost' || 'killed', 20000)`; `delay(tune.card * 1000 + 500)`; assert the phase is back to `'idle'` or `'fight'` (the reset ran); `current = 'boss-fight-reset'; await finish()`.
- [ ] **Step 2:** run it from a snapshot through the lock; green or fix the lab (a lab bug found here is fixed in the lab's files by this task, since it is the integration test; name it in the report).
- [ ] **Step 3:** the two entries (`2026-10-08-boss-fight-prototype-design` proposed, pointing at the spec; the landed entry with the numbers: time to kill standing still from the readout, the measured hp/s), the STATE.md paragraph, `npm run log -- render`, `npm run log:check`.
- [ ] **Step 4:** `npm test`, `npm run check`, `npm run build`; commit — `Records: the boss fight prototype landed (--boss-fight green: the rings, the hits, the loss and the reset), STATE.md current`.

Then stop and report: per task the commit, the hand-verification observations, the readout numbers (time to kill standing still; hp/s), the suite's line, and anything left open.
