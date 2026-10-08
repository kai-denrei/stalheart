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
| `src/labs/boss-tab.js` | labs | composition only: wires the four above to the creature, the frame and the readout |
| `test/boss-fight.mjs` | test | the domain rules |
| `scripts/browser-test.mjs` | scripts | the `--boss-fight` step |

The four lab files import `src/fx`, `src/content`, `src/domain`, `src/labs`, the vendored three and the shared top-level
builders the labs already use (`tankfeel.js`, `shell.js`, `units.js`); never `td-tab.js`. `src/domain/boss-fight.js`
imports nothing (the numbers come in as a `tune` argument, the project's domain rule: content stays out of domain).

## 2. The drive: the game's feel on the plane

The lab's `stepYardDrive` is the astro yard's model (a linear speed approach, flat yaw) and goes. `createPlaneDrive` keeps
the lab's `{ x, z, yaw, speed }` in local metres and composes the game's own rules, all pure and already in the tree:

- steering: `stepSteerEase(steer, dt, turnAxis, TANK_STEER)` gives the yaw rate, `steerBank(steer, TANK_STEER)` the roll;
- the run-up: `stepDriveRamp(ramp, dt, drive, turning, TANK_DRIVE)` gives the multiplier, 1.35 rising to 2.6 with a 4 s
  constant while the throttle is held, scrubbed by turning; `drive` is +1 forward, -0.55 reverse (the game's values), 1.45
  on cruise (double-tap W, as the game);
- pace: `v = 1.1 * 1.6 * 10 * drive * mul` m/s (the game's `params.speed` x `cellSide * 1.6` x drive x ramp, at ten metres a
  cell): about 24 m/s at the first touch, 46 m/s after four seconds held, 13 m/s in reverse;
- the hover, idle vibration, touchdown rock and recoil pitch: `stepTankFeel` / `applyTankFeel` with the stored `FEEL`,
  `feel.bank` from the steer ease, `fireTankFeel` on a shot;
- "while not hitting anything": the creature's body is a blocker. Each frame the tank's local position is tested against
  the creature's floor contacts (`body.contact[i] > 0`, scaled); inside the hull radius of any contact the tank is pushed
  out along the contact's outward direction, its speed set to zero and the ramp scrubbed head-on (`scrubDriveRamp(ramp,
  1, TANK_DRIVE)`). No walls on the cap; the tank may drive off the cropped planet, where the readout says so and `reset`
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
  `lay` and a burn of `sol.burn` seconds following the contact (`aim` each frame, the `laser_burn` loop, `laser.ignite` once
  and `laser.contact` every eighth), then `lift`. The footprint is the game pass's 8 m.

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
  three seconds (the feeding plays out meanwhile; a landing hides the hull with a `tank.shell` burst), then the reset.
- **The reset**: the tank respawns 40 m out on the side away from the creature, the creature resets to its rest
  (`creature.reset()`) at the frame's origin, `hp = max`, the clock at zero, the schedule cleared, the spots gone.
- **Balance** (why the numbers below): Bofors at 2.4 rounds/s in 2.6 s bursts with 1.4 s rests is 1.56 rounds/s; a creature
  30 m across under a 22 m scatter takes nearly every round somewhere on the body, at the falloff's mean about 0.6 of 4
  damage, so about 3.7 hp/s; SOL at 2 s of burn every 8 s at 10 hp/s is 2.5 hp/s; together about 6 hp/s, so a creature
  that stands in it dies in about 30 s with `health = 230`. Every term is a knob and the readout shows the measured
  `hp/s` and the projected time to kill, so the owner tunes by eye.

`BOSS_FIGHT` (content): `{ health: 230, warn: 1.5, lead: 1, bofors: { burst: 2.6, rest: 1.4, damage: 4, radius: 22,
travel: 2.6 }, sol: { every: 8, aim: 1.5, burn: 2, dps: 10, radius: 8 }, hull: { radius: 4.2 }, card: 3, respawn: 40 }`.
**Corrected by Task 0's measurement:** a round landing anywhere on a dense body does near-full damage (the falloff is
measured to the nearest contact, not to the centre), so the Bofors deal about 6 hp/s, not 3.7; with health 180 the node
proof killed a standing creature in 24.7 s. Health is 230: the node proof kills a standing creature in 30.62 s; the node test's
bound stays 24 to 36 s.
The gun's own rate, travel and damage are read from `GUNSHIP_GUNS.bofors` where the lab fires it; the content holds the
fight's copies for the domain so the rule stays pure.

## 6. The domain module

`src/domain/boss-fight.js`, pure, arrays and plain objects in and out, time in seconds, positions in local metres on the
plane `[x, z]`:

- `makeFight(tune) -> state` with `{ phase: 'idle' | 'fight' | 'lost' | 'killed', hp, max, clock, card, hits, damage,
  provokes, strikes: [], seed }`.
- `startFight(state)`: idle to fight, clock 0.
- `schedule(state, now, creature: { centre: [x, z], velocity: [x, z], radius }, tune) -> plans[]`: advances the Bofors
  burst/rest cycle and SOL's clock and returns the new plans, each `{ kind: 'bofors' | 'sol', at: [x, z], radius, showAt,
  fireAt, land, until }` (`until` = `land` for a round, `land + burn` for SOL); the aim is the centre led by the velocity
  over `land - now`, scattered by the golden-angle sequence from `state.seed`.
- `resolveLanding(state, plan, creature: { contacts: [[x, z], ...] }, tank: { pos: [x, z], radius }) -> { damage,
  tankHit }`: the falloff on the nearest contact; `tankHit` when `dist(tank.pos, plan.at) < plan.radius + tank.radius`;
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

- `test/boss-fight.mjs`: with the content's numbers, a stationary creature of radius 15 m at the origin: `schedule` over 30
  s yields the expected count of plans (within one burst's worth) with `showAt = land - warn` and `fireAt = land -
  travel`; every Bofors plan lands within half the radius of the centre; `resolveLanding` on a contact at the landing point
  gives full damage and at the ring's edge zero; the tank at the ring's edge plus its radius is not hit, one metre inside
  is; a 30 s run of schedule + resolve on a 15 m contact disc brings `hp` to zero between 24 and 36 s (the balance claim,
  as a bound); `capture` then `tick` returns `'reset'` after the card; the seeded scatter is repeatable.
- Browser `--boss-fight`: open the lab with `acceptance=1`, turn the fight on, drive away and circle at 40 m for 35 s with
  the harness's `driveTank`, assert the readout's `hp` fell below half within 20 s, that at least one `bofors` and one `sol`
  plan showed (`readout().strikes`), and that `hits > 0`; then park the tank at the creature and assert `phase` becomes
  `lost` within 15 s and `'reset'` follows. The handle gains `fight()` (the state readout), `setFight(on)` and
  `circle(seconds, radius)`.

## Open questions for the boss spec (after this prototype)

The base and the creature's attention between it and the tank (the kit pins stimulus while a target is set); the gunship
seen in the sky and the MK-9; what the tank's shells should do to a boss in the real game (nothing, per this prototype);
the creature's death look beyond v1's collapse (the kit has none); the cost of the laser and the explosions on a
phone next to the solver.

## Records

`2026-10-08-boss-fight-prototype-design` (decision, proposed) when the plan starts; the landing as a change entry.
