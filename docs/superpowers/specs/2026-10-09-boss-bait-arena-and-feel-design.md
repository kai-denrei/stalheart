# The bait mode's arena, its gunship pattern and its feel (design and plan)

Owner, 2026-10-09: "1) let's define the large arena size. a) The Gunship flies over in a slow regular pattern, it forces
the player to adjust the aim, but there are not wild camera cuts. b) Isao and the creature are also bound to this area,
they do not go beyond. 2) the rocks as obstacles display poorly on the thermal, flickering. 3) we need Isao to fly more
erratic too, acceleration, deceleration, changing angles, 4) we want the default movements and speed of the creature to
feel predatory, dangerous." Defaults proposed and approved ("go ahead"). Bait mode only unless stated; tank mode unchanged.

## Design

1. **The arena.** A disc of `arena.radius` 120 m round the frame's origin (the creature's start), in `BOSS_FIGHT.arena`'s
   neighbour `bounds: { radius: 120, baitMargin: 10, creatureMargin: 15 }`. A faint boundary ring on the ground (an
   additive line ring like the red spots, a cool colour, warm enough to read in the FLIR: tag it as a warm part in the seat's
   heat parts). Re-anchors shift it like every other positional thing (the lab's frame moves; the bound stays fixed on the
   ground — keep it in the lab's world-fixed coordinates the arena's shapes use).
   - **The gunship's pattern.** The platform orbits the arena's centre on a circle of `orbit.radius` 200 m at the game's
     altitude (34 cells, 340 m), one lap per `orbit.lap` 120 s (about 10 m/s), banked into the turn, its heading along the
     circle; on station the whole time: the seat never leaves, no departure, no arrival, no cut. The game seat's camera rides
     the platform (its pose is relative to the platform, `holdAim` keeps the world aim as the hull turns — verify), so the
     player only corrects drift. A pure `orbitAt(t, tune) -> { pos, heading, bank }` in the domain; the lab feeds it to the
     seat's platform (the `G`/rig's platform state) instead of `stationForever`.
   - **The bound.** Isao's wanted point is clamped to `radius - baitMargin`; the creature's pursuit target to
     `radius - creatureMargin` (after the fear's flee point and the routing); and a backstop: the body's nodes beyond
     `radius` are pushed back inside along the inward normal, inward velocity kept, outward removed — the arena's push-out
     with an inverted circle (`pushOut` gains an `outside` shape kind, node-tested).
2. **Rocks flicker in thermal.** A bug: systematic debugging first (reproduce with a frame sequence in the seat, find the
   cause — candidates: z-fighting of the rocks' bases with the ground, the flat-shaded jittered geometry under the FLIR's
   luminance map, `thermal-heat.js` re-applying materials every 1000 ms to shapes it does not own, the rocks' material
   switching between lab and seat scale), fix the cause, and add a frame-sequence assertion that catches it.
3. **Isao erratic.** `bait.erratic` 0..1 (default 1 in bait mode; 0 = today's smooth flight): speed swings between
   `bait.speedMin` 8 and `bait.speedMax` 26 m/s with sudden bursts and brakes (an acceleration limit `bait.accel` 30 m/s²),
   the heading jinks by up to ±40° every 0.6-2 s, the altitude bobs ±1.5 m; a seeded sequence (repeatable runs); the
   stand-off band holds on average (the planner's keep distance stays the anchor) and the panic break-away wins over the
   jinks. Pure, in `src/domain/boss-bait.js`, node-tested (median keep within 4 m over 30 s with erratic 1; speed and turn
   statistics in their ranges; deterministic for a seed).
4. **A predatory creature.** A `predator` preset in `src/content/nih-dairia.js` (beside the owner's slower preset, which
   stays the tank mode's default): chase speed 0.22 (was 0.1), surge duration 3 s (2), pause between bursts 0.8 s (1.25),
   probing arm stretch and spread up one step, erratic motion up (read the kit's knob ranges in the lab's panel and the
   preset format; pick values inside the ranges); bait mode loads it by default, the panel's knobs still tune it. The
   owner judges the feel.
5. **Bait health.** A `bait mode boss health` knob (default 180 until the owner's play says otherwise) so the owner can tune
   the kill length for his own aim without touching the tank mode's health.

## Plan

- **Task A (bug, in parallel):** the rocks' thermal flicker (item 2) — `src/labs/boss/arena.js` and whatever the cause
  touches in `src/labs/boss/game-seat.js`; the frame-sequence assertion in `--boss-bait`. Commit.
- **Task B (domain, in parallel):** `orbitAt` (new `src/domain/boss-orbit.js` or in `boss-bait.js`), the erratic flight
  (item 3), `pushOut`'s outside circle and a `clampTo(point, radius)` (item 1's bound), the content (`bounds`, `orbit`,
  `bait.*` erratic numbers); node tests. Commit.
- **Task C (lab, after A and B):** the boundary ring, the clamps and the backstop, the orbiting platform in the seat, the
  predator preset as bait mode's default (item 4), the bait health knob (item 5), the erratic knob; `--boss-bait` extended
  (Isao and the creature stay inside 120 m over 30 s; the platform moves ~1/4 lap in 30 s with the seat mounted
  throughout; Isao's speed and turn statistics); screenshots in the seat and of the creature hunting, looked at. Commit.
- **Review, fixes, records.**
