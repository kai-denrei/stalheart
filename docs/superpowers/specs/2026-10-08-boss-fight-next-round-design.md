# The boss fight's next round: airborne friendlies protect the tank (design)

Owner, 2026-10-08, after the fight prototype's final review: "1) include all strikes from the gunship, including the nuke.
2) the SOL fires for longer, and tries to shoot in front of the creature, to protect the tank. 3) the creature is afraid the
SOL laser and large explosions, it avoids them. 4) gunship also shoots #2 weapons in front. goal: airborne friendlies try to
protect the tank. the user is just in survival mode. 5) we add some obstacles in the arena. 6) we need to figure out how to
have the creature deal with walls." In the brainstorm (2026-10-08): "for the gunship, it fires straight at the creature with
#1, in front with #2 to steer it away from the tank, and a bit behind with #3 the nuke to not cause friendly fire"; the nuke
always drops and its ring kills the tank like any other (B); the creature fears what has landed, not the warnings (B); SOL's
beam tracks during its burn (A); obstacles are terrain that strikes ignore (A); the creature steers round obstacles and a
lab-side push-out keeps its nodes out of them (A); "nuke should slightly stun it"; "the nuke destroy the small
rock/obstacles".

Builds on the fight prototype (`docs/superpowers/specs/2026-10-08-boss-fight-prototype-design.md`, everything there holds
unless this file says otherwise) on branch `refactor-run`, in the lab; the game controller and the ported kit
(`src/fx/nih-dairia/*`) are untouched. Records the proposed entry
`2026-10-08-boss-fight-next-round-airborne-friendlies-protect-the-tank`.

## Scope

In: the gunship's three guns (rotary, Bofors, MK-9) on the fight's schedule with one aim rule each; SOL's longer, tracking
burn; the creature's fright and the nuke's stun; six obstacles (two permanent, four breakable by the nuke) blocking the tank,
steered round by the creature and pushed out of its body; the body rules moved out of `boss-tab.js`; the balance re-measured
on a survival run; node tests and two browser steps. Out: kernel walls (the recorded fallback, the owner's lab-creatures);
fear of the warnings (rings); cover from strikes; the base; the gunship's hull in the sky (only the MK-9's body falls).

## 0. First: the body rules move out (no behaviour change)

`src/labs/boss-tab.js` is 878 lines. Before anything else, the body's lab rules move to `src/labs/boss/body.js`: the
blocker against the body (`bodyBlocker`, `projectBody`), the shell's hit test, the shove, the circle controller. Same
behaviour, own commit, `--boss` and `--boss-fight` green before and after.

## 1. The friendlies

**Cadence.** The gunship's guns run the game's auto pattern (`GUNSHIP_AUTO`): a burst of `burst` (2.6 s), a rest of `rest`
(1.4 s), the next gun, alternating rotary and Bofors, rotary first. The MK-9 drops every `nuke.every` (20 s, the gun's
`reload`), the first at 20 s into the fight. SOL strikes every `sol.every` (8 s) and burns `sol.burn` (6 s, was 2 s).

**The line.** Every aim below works on the line from the creature's centre `c` toward the tank `t` (unit `u = (t - c) /
|t - c|`; if `|t - c| < 1 m`, `u = [0, 1]`). `front edge` is the floor contact with the largest projection on `u`; its
projection is `e = max(contacts · u - c · u)` (0 if no contacts).

- **#1 Rotary (25 mm), straight at the creature.** A burst is one *stream* plan (`kind: 'rotary'`), not 63 rings: its ring
  of the gun's danger radius (`rotary.radius`, 8 m = 0.8 cells) shows `warn` (1.5 s) before the burst opens and stays for
  the burst's `burst` seconds; its point is the floor contact *farthest* from the tank, re-chosen every frame (it walks with
  the foot). During the burst: `rotary.dps` (6.6 = the game's 30 rounds/s x 0.22) while any contact is inside the ring; a
  tank inside the ring is lost. Tracers: the gunship optic's `flight` from the sky point, one every 0.1 s, `0xdfe8ee`;
  impacts `gunship.rotary` every 0.1 s at the point; the `gunship_rotary_fire` loop while the stream runs.
- **#2 Bofors (40 mm), in front.** As the prototype's rounds (22 m ring, 4 damage under the falloff, six a burst), but each
  round's point is `c + u * (e + front)` (`front`, 10 m), fixed when the round is planned (the ring is the promise). Clamp:
  if that point lies within `radius + hull + margin` (22 + 4.2 + 2 m) of the tank, it slides back along `u` toward `c`
  until clear; if it cannot clear before `c`, it lands at `c`. The scatter keeps the golden-angle jitter (half the radius)
  *across* the line only (perpendicular to `u`), so the jitter never walks a round onto the tank. The clamp is re-checked
  against the tank at planning only.
- **#3 MK-9, behind.** One plan (`kind: 'nuke'`): point `c - u * behind` (`behind`, 15 m), fixed at release, no tank clamp
  (owner: B). Its ring (`nuke.radius`, 55 m = 5.5 cells) shows from the release, `nuke.travel` (4.2 s = `freeFall` +
  `drive`) before it lands. At landing: `splashDamage(d, 55, nuke.damage)` (`nuke.damage` 60) on the nearest contact; a
  tank inside the ring is lost; the stun (section 2); the destruction (section 3). Presentation: the MK-9 body falls through
  `createGunshipDrop(sphere, { cellSide })` released from the sky point toward the landing, with its release and ignite cues;
  the blast is `explosions.spawn('gunship.nuke', ...)`.
- **SOL-88, a tracking wall.** The pointer shows `sol.aim` (1.5 s) at the strike's first point, then the burn of `sol.burn`
  (6 s). Its point is re-solved every frame of the burn: `c + u * (e + front)`, clamped as the Bofors' (radius 8 + hull +
  margin from the tank); when it cannot clear, it hugs the front edge (`c + u * e`) and burns the creature. The ring moves
  with the beam (the ring is what burns). Damage as before: `sol.dps` (10) while any contact is inside.

**Plans.** `schedule` returns plans of four kinds; a stream and a burn carry `moving: true` and the lab asks the domain for
their point each frame (`aimNow(plan, creature, tank, tune)`); a round and the nuke carry a fixed `at`. The lab never
computes an aim.

## 2. The fright and the stun

**What it fears.** A Bofors landing, a live SOL beam. Not the rotary, not the tank's shells (still a provoke). The nuke
stuns instead of frightening.

- **A Bofors landing** within its radius + `fear.reach` (8 m) of any floor contact: a fright of `fear.bofors` (1.2 s).
- **A live SOL beam** whose point is within its radius + `fear.reach` of any contact: a fright renewed every frame, lasting
  `fear.after` (0.8 s) after the beam leaves that range or lifts.
- **The nuke's landing** within its radius + `fear.reach` of any contact: a stun of `nuke.stun` (1.5 s).

**A fright.** For its duration the creature's pursuit target is the flee point: `c + flee * normalize(sum of w_i * (c -
threat_i) / |c - threat_i|)` over the live threats (`fear.flee` 20 m; weight 2 for SOL, 1 for a Bofors landing; a zero sum
falls back to `-u`). Each new fright (not a renewal) calls the kit's `motion.disturb()` at most once per `fear.cooldown`
(1 s). The frights' timers overlap; the latest end wins.

**The stun.** `motion.disturb()`, then `motion.active = false` for `nuke.stun` seconds (no pursuit, gait or traction; the
body sags on the floor), then `motion.active = true`. A stun during a fright pauses nothing: when the stun ends, a fright
still running steers.

**Limits.** No fright or stun while feeding is locked (a capture plays out), after KILLED, or while the fight is off.

## 3. The arena: obstacles and walls

**The layout** (`BOSS_FIGHT.arena`, local metres, the frame's origin at the creature's rest). The tank respawns 40 m out
on the side away from the creature (the prototype's rule); a respawn point inside a live shape's footprint plus the hull
turns round the origin in 10 degree steps to the nearest clear bearing (`clearSpawn` in `boss-arena.js`).

| id | kind | at | size | breakable |
| --- | --- | --- | --- | --- |
| r1 | rock | [0, 55] | radius 8 | no |
| r2 | rock | [-40, -45] | radius 8 | no |
| r3 | rock | [35, 30] | radius 5 | yes |
| r4 | rock | [-30, 25] | radius 6 | yes |
| w1 | wall | [25, -40] | 20 x 3, yaw 30 deg | yes |
| w2 | wall | [-55, 0] | 20 x 3, yaw 90 deg | yes |

Rocks are vertical cylinders of height 6 m (a flat-shaded displaced icosahedron for the eye, the cylinder for the rules);
walls are boxes 20 m long, 3 m thick, 3 m high. `fight.obstacles` (on) switches the arena. Meshes: lab-made, the lab's
ground palette; no new asset.

**The tank.** The drive's blocker becomes the body's blocker or the arena's, whichever pushes deeper: a hull centre within
`hull` (4.2 m) of a live shape's footprint is pushed out along the footprint's outward normal by the overlap, stopped, its
run-up scrubbed head-on (the drive's existing response).

**The creature, steering.** `route(c, target, shapes, clear)`: if the segment from `c` to the target passes within `clear`
(`wall.clear`, 6 m) of a live shape's footprint, the target becomes a waypoint: the tangent point of that shape's footprint
inflated by `clear`, on the side with the shorter path, the nearest such shape first. One waypoint at a time; recomputed
every frame. Applied to the tank and to a flee point alike.

**The creature, push-out.** The lab wraps the body's `step` on the creature's instance (the kit's `creature.update` calls
`body.step(P.step)` through the property, so the port is unchanged): after each fixed step, every node whose height is
under the shape's height and whose ground position (local metres: native x scale through the frame) lies inside a live
shape's footprint is moved to the footprint's surface along the outward normal, and the inward normal part of its velocity
is removed. Positions and velocities are the kernel's shared `x` and `velocity` arrays; the conversion is the lab's existing
native-to-local mapping.

**Destruction.** At the nuke's landing, every breakable whose footprint comes within the nuke's radius of the landing point
is destroyed: hidden, a `tank.shell` burst at its centre (`explosions.spawn('tank.shell', ...)`), and gone
from the blocker, the routing and the push-out. The fight's reset restores every obstacle.

**The measurement (required).** The `--boss-walls` browser step routes the creature's target into w1's middle (the tank held
behind it, routing off) for 10 s of fight clock and logs: the push-out's cost per frame (ms), the number of nodes pushed per
step, and the jitter (the mean frame-to-frame displacement of the pushed nodes over the last 3 s, in metres). Acceptance:
cost under 1 ms; the jitter number is recorded in the landing entry for the owner's judgement. If either is bad, the
recorded fallback is walls as constraints in lab-creatures' kernel (the owner's project), not more lab code.

## 4. Files

| File | Layer | Owns |
| --- | --- | --- |
| `src/content/boss-fight.js` | content | the numbers: `rotary`, `nuke`, `fear`, `wall`, `arena`, `front`, `behind`, `margin`; SOL's `burn` 6 |
| `src/domain/boss-fight.js` | domain | the schedule of four kinds, `aimNow`, the clamps, the stream and the nuke's resolution |
| `src/domain/boss-fear.js` | domain | `makeFear()`, `frighten(fear, threat, now, tune)`, `stun(fear, now, tune)`, `fearNow(fear, now, c, u, tune) -> { mode: 'hunt' \| 'flee' \| 'stun', point, newFright }` |
| `src/domain/boss-arena.js` | domain | footprints (cylinder, box), `blockAt(x, z, r, shapes)`, `route(c, target, shapes, clear)`, `pushOut(points, shapes)` over plain arrays, `destroyIn(shapes, at, radius)`, `restore(shapes)`, `clearSpawn(point, shapes, r)` |
| `src/labs/boss/body.js` | labs | the body's rules moved out of `boss-tab.js` (section 0) |
| `src/labs/boss/friendlies.js` | labs | the rotary stream, the Bofors, the MK-9 drop, SOL's moving point; split SOL to `src/labs/boss/sol.js` if the file passes 300 lines |
| `src/labs/boss/fear.js` | labs | collects the threats from the friendlies' landings and the live beam, applies `fearNow` to `motion.target` / `motion.active` |
| `src/labs/boss/arena.js` | labs | the obstacle meshes, the tank's blocker, the step wrap and the push-out's conversion, destruction's bursts |
| `test/boss-fight.mjs`, `test/boss-fear.mjs`, `test/boss-arena.mjs` | test | the rules |
| `scripts/browser-test.mjs` | scripts | `--boss-fight` extended, `--boss-walls` new |

Domain imports only domain (`./gunship.js`'s `splashDamage`); numbers come in as `tune`. The lab files follow the
prototype's import rules (never `td-tab.js`).

## 5. Knobs and readout

The panel's `fight` folder gains: `front`, `behind`, `rotary.dps`, `nuke.damage`, `nuke.every`, `nuke.stun`, SOL's `burn`,
`fear.reach`, `fear.flee`, `fear.bofors`, and switches `rotary`, `bofors`, `nuke`, `fear`, `obstacles`. The readout adds
`rot <hp> · bof <hp> · nuke <hp> · sol <hp>` (damage dealt per shooter), `frights <n> · stuns <n>`, and `nuke in <s>`.

## 6. Balance

The prototype's "a creature standing in the fire dies in 30 s" no longer describes the fight. Two measurements, both in node
(on the 44 real floor contacts, the creature moved by a scripted path) and confirmed in the browser:

1. **Held still** (instinct off, every shooter on, no fear): the time to kill at the new health, a regression anchor.
2. **The survival run**: the browser's `circle` controller at 45 m with every shooter, the fear and the arena on: the fight
   clock at KILLED.

`health` is set so the survival run kills in about 30 s (the owner's goal: avoid it about thirty seconds and the friendlies
kill it); the node bound on the held-still case is derived from the measured number, +/- 20 %. Both numbers go in this spec's
landing entry.

## 7. Tests

- **Node** (`test/boss-fight.mjs` extended): the cadence alternates rotary and Bofors from the game's auto numbers; the
  first nuke at 20 s and every 20 s; the rotary's point is the contact farthest from the tank; a Bofors round lands at
  `c + u (e + front)` and, with the tank close, never within `radius + hull` of the tank; its scatter is perpendicular to
  `u`; the nuke lands at `c - u * behind` with no clamp and hits the tank inside 55 m; SOL's `aimNow` tracks a moving
  creature and hugs the front edge when the gap is small; the stream's dps; the shooter switches.
- **Node** (`test/boss-fear.mjs`): a Bofors landing within reach frightens for 1.2 s, outside does not; a live beam renews;
  the flee point points away from the threats and falls back to `-u`; `newFright` honours the cooldown; the stun runs 1.5 s
  and a fright outlives it; nothing during feeding or after KILLED.
- **Node** (`test/boss-arena.mjs`): `blockAt` on a cylinder and a rotated box; `route` picks the shorter tangent and passes
  an unobstructed segment untouched; `pushOut` moves an inside node to the surface and zeroes only the inward velocity, and
  leaves nodes above the height alone; `destroyIn` takes only breakables in range; `restore`; `clearSpawn` turns a blocked
  respawn to the nearest clear bearing and leaves a clear one alone.
- **Browser** `--boss-fight` (extended): rotary, Bofors, nuke and SOL plans all showed; at least one fright and one stun;
  a nuke destroyed a breakable and the reset restored it; the survival time logged; the existing asserts kept.
- **Browser** `--boss-walls` (new): section 3's measurement.

## Records

`2026-10-08-boss-fight-next-round-design` (decision, accepted) with this spec; the proposed next-round entry marked accepted
by it; a landing entry with the balance numbers and the walls measurement when built.
