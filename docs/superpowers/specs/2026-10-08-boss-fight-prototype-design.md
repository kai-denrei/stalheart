# The boss fight prototype in the Nih-Dairia lab: design

Owner, 2026-10-08, after seeing the lab: "1) add the tank driving feel from the main game; it accelerates while not hitting
anything. 2) allows the tank to shoot. 3) health bar for the boss 4) the gunship and SOL fire from above. goal of the player
is to avoid where the shots will be landing (they show as red laser spots on the ground). goal: if the player avoid the
creature for about 30 seconds the friendlies should have landed enough hits to kill it." Decided in the brainstorm:
friendlies only take the health down (the tank provokes and distracts, it does not wound); caught means a lost hull and the
round resets; a red spot shows about 1.5 s before its shot lands. The creature's preset is the owner's slower one (speed
0.1, reach x10, arms stretched and spread; `src/content/nih-dairia.js`, 2026-10-08). Builds on branch `refactor-run`, in
the lab; the game controller is untouched. The mode idea it prototypes is `2026-10-08-boss-mode-idea-draw-it-off-the-base`.

## Scope

In: the game's drive feel on the lab's plane; the tank's cannon; the boss's health bar and the round; the gunship's Bofors
and SOL-88 firing from above with red landing spots; the fight rules as a pure domain module with a node test; knobs and a
readout for tuning the 30 s; a `--boss-fight` browser step. Out: the base and the creature's attention between base and
tank (the lab has no base; the mode's "draw it off the base" is the next step once this dodge loop feels right); the MK-9
nuke; the gunship's hull in the sky; sound beyond the game's existing cues; the game's magazine and reloads; mobile pad input.

## 1. Files and ownership

| File | Layer | Owns |
| --- | --- | --- |
| `src/content/boss-fight.js` | content | `BOSS_FIGHT`: the fight's numbers (below) |
| `src/domain/boss-fight.js` | domain | pure rules: the fight state, the strike schedule and its warnings, landing resolution and damage, the round's cards |
| `src/labs/boss/drive.js` | labs | the game's drive feel on a flat plane: `createPlaneDrive({ feel, tune })` |
| `src/labs/boss/cannon.js` | labs | the tank's shells: `createCannon(scene, host)` |
| `src/labs/boss/friendlies.js` | labs | the gunship's rounds, SOL's beam, the red spots: `createFriendlies(scene, host)` |
| `src/labs/boss/round.js` | labs | the health bar, the clock, the cards, the reset: `createRound(stage, host)` |
| `src/labs/boss-tab.js` | labs | wires the four above to the creature, the frame and the readout; it also holds the body's own lab rules (the blocker, the shell's hit test, the shove, the circle controller) and the round's reset. Moving the body's rules to `src/labs/boss/body.js` is the next refactor |
| `test/boss-fight.mjs` | test | the domain rules |
| `scripts/browser-test.mjs` | scripts | the `--boss-fight` step |

The four lab files import `src/fx`, `src/content`, `src/domain`, `src/labs`, the vendored three and the shared top-level
builders the labs already use (`tankfeel.js`, `shell.js`, `units.js`); never `td-tab.js`. `src/domain/boss-fight.js`
imports only `./gunship.js`'s falloff (`splashDamage`, so a landing hurts exactly as the game's splash); the numbers come in
as a `tune` argument (the project's domain rule: content stays out of domain).

## 2. The drive: the game's feel on the plane

The lab's `stepYardDrive` is the astro yard's model (a linear speed approach, flat yaw) and goes. `createPlaneDrive` keeps
the lab's `{ x, z, yaw, speed }` in local metres and composes the game's own rules, all pure and already in the tree:

- steering: `stepSteerEase(steer, dt, turnAxis, TANK_STEER)` gives the yaw rate, `steerBank(steer, TANK_STEER)` the roll;
- the run-up: `stepDriveRamp(ramp, dt, drive, turning, TANK_DRIVE)` gives the multiplier, 1.35 rising to 2.6 with a 4 s
  constant while the throttle is held, scrubbed by turning; `drive` is +1 forward, -0.55 reverse (the game's values), 1.45
  on cruise (double-tap W, as the game);
- pace: `v = 1.1 * 1.6 * 10 * drive * mul` m/s (the game's `params.speed` x `cellSide * 1.6` x drive x ramp, at ten metres a
  cell): about 24 m/s at the first touch, about 38 m/s after four seconds held (Task 1 measured 26.5 to 37.8; the ramp's
  ceiling of 46 m/s takes about twenty seconds), 13 m/s in reverse; cruise is the game's: a second W tap within 0.35 s
  toggles it, it keeps the hull rolling with no key held, S cancels it;
- the hover, idle vibration, touchdown rock and recoil pitch: `stepTankFeel` / `applyTankFeel` with the stored `FEEL`,
  `feel.bank` from the steer ease, `fireTankFeel` on a shot;
- "while not hitting anything": the creature's body is a blocker. Each frame the tank's moved position is tested against
  the creature's body nodes that sit in the hull's height band (scaled local height under 3 m, so the raised torso does
  not block and a hull cannot slip between floor contacts); within the hull radius (4.2 m) of the nearest such node the
  tank is pushed away from that node by the overlap, its speed set to zero and the ramp scrubbed head-on
  (`scrubDriveRamp(ramp, 1, TANK_DRIVE)`). A parked tank is not shoved (the drive consults the blocker only when it
  moved), so a meal can close on it (Task 1's review). No walls on the cap; the tank may drive off the cropped planet, where the readout says so and `reset`
  brings it back.

The engine loop (`tank_engine`) and the drive keys are the swarm lab's (held keys, not key events); the lab gains audio
through `makeAudio({ base: '../' })` resumed on the first gesture, exactly as the swarm lab does.

## 3. The cannon

Space fires when `heat <= 0`: the shell is `makeOrdnanceShell(2, 'y')` scaled by `cellSide * 0.16`, launched from the
hull's muzzle (`unit.userData.muzzle`, else the hull's position) along the turret's forward (`unit.userData.turret`'s world
+Z flattened into the plane, else the drive's heading), 90 m/s, 120 m reach, spinning as the game's shells do; `heat =
CANNON_COOL` (3 s) and the sleeve's colour reads it (`sleeve.material.color.lerpColors(cool, hot, heat / CANNON_COOL)`
on `unit.userData.heatSleeve` when the model has one); `fireTankFeel(feel, FEEL)`; `sfx.play('tank_main')`. No magazine.

A shell meets the body when its local position comes within the hull-hit radius (the blast's half, 2 m scaled to native)
of any body node: it bursts (`explosions.spawn('tank.shell', point, normal, cellSide)` and `blast_fire`), gives the body a
radial shove (the exploration's impulse: strength capped, in native units, `v /= scale`) and `motion.disturb()`, and
counts a `provoke` on the readout. It does no damage (owner, brainstorm). A shell past its reach bursts on the ground.

## 4. The friendlies and the red spots

Two shooters, both standalone pieces of the game already in the tree:

- **The gunship's Bofors**: the domain's gun model (`makeGunship(GUNSHIP_ORBIT, { station: true })`, `mountGunship`,
  `fireRound(gs, 'bofors', point, travel)`, `stepRounds(gs)`), on station for ever (no orbit, no hull in the sky). The
  cadence is the game's auto pattern copied, not imported: a burst of `BOSS_FIGHT.bofors.burst` seconds at the gun's rate
  (2.4 rounds/s, six rounds), a rest of `rest` seconds, repeat. Tracers are `createGunshipOptic(scene, {...}).flight(from,
  to, 0xffb43d, travel, 0.5)` from a fixed sky point 340 m up (the platform's altitude) at the station's bearing; the
  landing is `explosions.spawn('gunship.bofors', point, normal, cellSide)` and the gun's impact cue.
- **SOL-88**: `createOrbitalLaser(scene, { cellSide: 10, metresPerCell: 10 })`, standalone as the laser lab uses it: every
  `BOSS_FIGHT.sol.every` seconds a strike: `aim` for the warning time with the laser's own red pointer (`guideAt`), then
  `lay` and a burn of `sol.burn` seconds on that same spot (the `laser_burn` loop, `laser.ignite` once and `laser.contact`
  every eighth), then `lift`. The footprint is the game pass's 8 m. **Decision (the code):** the burn stays on the spot the
  pointer showed and does not follow the creature: the spot is the promise, the red ring is where it burns, so a player who
  is out of the ring is safe for the whole burn.

**Aim.** Both shooters aim at the creature's centre led by its velocity over the time to landing (`lead` knob, default 1),
scattered by the game's rule: a golden-angle jitter within half the blast radius (Bofors) or the footprint (SOL), from a
seeded sequence so a run is repeatable.

**The red spots.** Every planned landing shows a ring on the ground of its blast radius from `warn` seconds (1.5) before
it lands until it lands: an additive ring like the seat highlight's, `0xff2a1a`, pulsing at 6 Hz, flat on the surface
normal, lifted 0.1 m. The Bofors' travel (2.6 s) is longer than the warning, so a round is fired at `land - travel` and
its ring appears at `land - warn`; SOL's pointer is its ring. What you see is what kills: the ring's radius is the damage
radius for the tank and the creature alike.

**Landing.** The domain resolves each landing: the creature takes `damage * (1 - (d / r)^2)` for the distance from the
landing point to the nearest body contact (the game's `splashDamage` falloff), zero outside the ring; SOL burns `sol.dps`
per second of contact while any body contact is inside the footprint. The tank inside a Bofors ring at landing, or inside
SOL's footprint during the burn, is a lost hull.

## 5. The round and the health bar

- **The bar**: in the stage's HUD (`.sw-hud`), the integrity HUD's own gate-row markup and classes (`ih-lbl`, `ih-bar`
  with its `<i>` fill, `ih-num`): `NIH-DAIRIA`, the fill at `hp / max`, amber at 25 % as the game's gates; beside it the
  fight clock (`0:00.0`) and `hits <n>`.
- **The fight**: starts when the tank first moves. `hp` starts at `BOSS_FIGHT.health`. Hits and SOL contact bring it down.
- **KILLED**: `hp <= 0`: the v1 death (owner, 2026-10-08: "set its gravity to 10 (max) and stop all movements"): every
  movement stops (`motion.active = false`, feeding off, the pursuit, gait and traction forces no longer applied, so only
  the solver's own elasticity and the floor act) and `creature.phys.gravity = 10` (the lab's gravity knob's maximum; the
  kit's is 2.4), so the body collapses under its own weight; a card `KILLED <time>` with the hits, three seconds, then the
  reset restores the preset's gravity.
- **LOST**: the creature captures the tank (feeding leaves `hunting`), or a landing ring takes it: a card `LOST <reason>`,
  three seconds (the feeding plays out meanwhile; a landing hides the hull with a `tank.shell` burst, and a lost hull is
  nobody's prey until the reset: it does not drive, the lure is not fed, the shooters see it a world away and the creature's
  feeding is off), then the reset. A creature reloaded mid-fight (a variant switch) starts a new round, so no strike is owed
  for the seconds the load skipped.
- **The reset**: the tank respawns 40 m out on the side away from the creature, the creature resets to its rest
  (`creature.reset()`) at the frame's origin, `hp = max`, the clock at zero, the schedule cleared, the spots gone.
- **Balance** (why the numbers below): the Bofors fire 2.4 rounds/s in 2.6 s bursts with 1.4 s rests, 1.56 rounds/s, at 4
  damage under the falloff `1 - (d / r)^2` over 22 m measured to the nearest floor contact; SOL burns 10 hp/s for 2 s every
  8 s. A first estimate (a 30 m body taking about 0.6 of each round, about 6 hp/s with SOL) set `health = 230`; the
  measurements replaced it. The standing creature's floor contacts, read in the lab with the instinct off, are 44 nodes in
  six feet of seven or eight, 12.5 to 16.2 m from the centre and none under the middle, so a round near the centre is far
  from every contact: at 230 the standing body died in 43.86 s in the lab (5.24 hp/s) and in 43.85 s in node on the same 44
  contacts. Health is therefore **155**: a standing creature dies in 30.62 s in node and in 30.62 s in the lab (`KILLED
  0:30.6`, 43 hits, 5.06 hp/s); the node test's bound is 24 to 36 s. Every term is a knob and the readout shows the
  measured `hp/s` and the projected time to kill, so the owner tunes by eye.

`BOSS_FIGHT` (content): `{ health: 155, warn: 1.5, lead: 1, scatter: 0.5, bofors: { burst: 2.6, rest: 1.4, rate: 2.4,
damage: 4, radius: 22, travel: 2.6 }, sol: { every: 8, aim: 1.5, burn: 2, dps: 10, radius: 8 }, hull: { radius: 4.2 },
card: 3, respawn: 40, deathGravity: 10 }`.
The gun's own rate, travel and damage are read from `GUNSHIP_GUNS.bofors` where the lab fires it; the content holds the
fight's copies for the domain so the rule stays pure, and the node test holds the copies to the game's (`burst` and `rest`
to `GUNSHIP_AUTO`, `rate` and `travel` to `GUNSHIP_GUNS.bofors`, `radius` to its `blastCells` at ten metres a cell);
`damage` is the fight's own knob.

## 6. The domain module

`src/domain/boss-fight.js`, pure, arrays and plain objects in and out, time in seconds, positions in local metres on the
plane `[x, z]`:

- `makeFight(tune) -> state` with `{ phase: 'idle' | 'fight' | 'lost' | 'killed', hp, max, clock, card, hits, damage,
  strikes: [], seed }` (the cannon's provokes are the lab's count, not the fight's).
- `startFight(state)`: idle to fight, clock 0.
- `schedule(state, now, creature: { centre: [x, z], velocity: [x, z], radius }, tune) -> plans[]`: advances the Bofors
  burst/rest cycle and SOL's clock and returns the new plans, each `{ kind: 'bofors' | 'sol', at: [x, z], radius, showAt,
  fireAt, land, until }` (`until` = `land` for a round, `land + burn` for SOL); the aim is the centre led by the velocity
  over `land - now`, scattered by the golden-angle sequence from `state.seed`.
- `resolveLanding(state, plan, creature: { contacts: [[x, z], ...] }, tank: { pos: [x, z], radius }) -> { damage,
  tankHit }`: `splashDamage` (from `./gunship.js`) on the nearest contact; `tankHit` when `dist(tank.pos, plan.at) < plan.radius + tank.radius`;
  applies the damage to `state.hp` and counts a hit.
- `burn(state, plan, dt, creature, tank) -> { damage, tankHit }` for SOL's footprint while `now < plan.until`.
- `capture(state, reason)`: fight to lost with the reason; `kill(state)`: fight to killed; `tick(state, dt)`: the clock
  while fighting, the card countdown while lost/killed, returning `'reset'` once the card expires.
- `readout(state) -> { hp, max, clock, hits, hpPerSecond, timeToKill }` (the rate over the fight so far).

The lab only translates: plans to rings, tracers and the laser; landings to bursts and sounds; `tankHit` and the feeding
phase to `capture`; `state.phase` to the cards and the reset.

## 7. Knobs and readout

Knobs in the panel's new `fight` folder: `health`, `warn`, `lead`, the Bofors `burst`, `rest`, `damage`, `radius`, SOL's
`every`, `burn`, `dps`, `radius`, `scatter` (the half-radius fraction, default 0.5), and switches `gunship`, `sol`,
`cannon`, `fight` (off = the lab as before: no shooters, no bar). The readout line adds `hp <n>/<max> · hits <n> · <hp/s>
hp/s · ttk <s> · provokes <n>`.

## 8. Tests

- `test/boss-fight.mjs`: with the content's numbers, a stationary creature at the origin whose contacts are the real body's
  44 floor contacts as the lab measured them (six feet, 12.5 to 16.2 m out): `schedule` over 30 s yields exactly the
  expected count of Bofors plans (whole cycles of `round(burst * rate)` rounds plus the partial cycle's) with the exact gaps
  inside and between bursts, SOL's lands at `every + aim` and `2 * every + aim`, `showAt = land - warn` and `fireAt = land -
  travel`; every Bofors plan lands within the scatter of the centre; the lead aims ahead of a moving creature; a switched-off
  shooter makes no plans; `resolveLanding` on a contact at the landing point gives full damage and at the ring's edge zero;
  the tank at the ring's edge plus its radius is not hit, one metre inside is; a run of schedule + resolve + burn on the 44
  contacts brings `hp` to zero between 24 and 36 s (the balance claim, as a bound; 30.62 s); the guards (no damage outside
  the fight, `startFight` only from idle, no strikes after capture); `capture` then `tick` returns `'reset'` after the card;
  the seeded scatter is repeatable; the fight's copies of the gun's numbers equal the game's.
- Browser `--boss-fight`: open the lab with `acceptance=1`, turn the fight on, circle at 45 m with the handle's `circle`
  until 22 s of fight clock (90 s of real time at most: headless advances the game clock slowly, so every wait is on the
  fight's clock with a real-time cap); assert the hp fell below half by 24 s of fight clock or its rate would take it there
  (`hpPerSecond >= max / 2 / 24`), logging the measured time; that at least one `bofors` and one `sol` plan showed
  (`fight().strikes`), and that `hits > 0`; then park the tank at the creature and assert `phase` becomes `lost` within
  20 s and the reset follows (within 30 s); then the creature held still (instinct off) dies between 24 and 36 s of fight
  clock (90 s of real time at most). The handle gains `fight()` (the state readout), `setFight(on)` and
  `circle(seconds, radius)`.

## Open questions for the boss spec (after this prototype)

The base and the creature's attention between it and the tank (the kit pins stimulus while a target is set); the gunship
seen in the sky and the MK-9; what the tank's shells should do to a boss in the real game (nothing, per this prototype);
the creature's death look beyond v1's collapse (the kit has none); the cost of the laser and the explosions on a
phone next to the solver.

## Records

`2026-10-08-boss-fight-prototype-design` (decision, proposed) when the plan starts; the landing as a change entry.
