# THE ARENA FIGHT ON THE LAB'S ENGINE — design (2026-10-23, overnight)

Owner, 2026-10-23: "the Nih-Dairia fight; there is a well-tuned version in the lab and we keep reproducing something that does not work.
a) not enough nukes on the gunship, b) nih-dairia aggro is different, c) the whole idea is the monster aggro on the tank, acting as a lure,
and it leaves time for the player to use the gunship to hit it, d) it should stay in the arena, e) the gameplay is that it tries to aggro on
the tank, but fears the 40mm, so the gunship fires 40mm between the boss and the auto-moving tank, leaving room for a clean nuke."

## Diagnosis (verified by reading the code; do not re-derive)

- In the game the Nih-Dairia body is the kit (src/fx/creature-reed.js) but THE RECORD OWNS THE POSITION: the kit's pursuit hunts the record's
  aim point, and the record is a cell-graph walker (src/fx/enemy-step.js: `hunter` records take `huntExits` over the whole graph) at tier
  speed 0.35 cells/s x BOSS_FIGHT.arenaBoss.pace 1.4. A body a leash behind is snapped back onto the record (`track` in creature-reed.js).
- The lab's bait fight (src/labs/boss-tab.js `step`, src/labs/boss/{fear,temperament,bait,arena,game-seat}.js) runs the kit's OWN pursuit of
  the prey point, the temperament's lunges (src/domain/boss-temperament.js), the fear per gun (src/domain/boss-fear.js barrage/scare/flightNow),
  the 120 m bound (BOSS_FIGHT.bounds, src/domain/boss-arena.js clampTo) and a seat whose MK-9 has `perPass: 0` and a 6 s reload
  (src/labs/boss/game-seat.js RELOAD). None of that runs in the game. The motion preset is the predator's in both (src/content/creature-enemies.js
  reed family `motion: NIH_DAIRIA_PREDATOR`), so the preset is not the difference.
- a) GUNSHIP_GUNS.heavy is perPass 1 / reload 20 (src/content/gunship.js), GUNSHIP_ORBIT.station 120 s: one MK-9 a pass. The rig
  (src/fx/gunship-rig.js) reads the GUNSHIP_GUNS constant everywhere (select, step, paintHeavy, launchHeavy, heavyState, dangerPoints).
- d) src/domain/lure.js `lureMode` has no arena term once a quarry exists (the hull kites 'away' through the maze); the walker has no bound.
- e) src/domain/boss-fear.js frightRecord/stunRecord write the walk's scare fields (3.2 s, flee 3x pace, none while `b.ground`): the record
  moves along `awayExits`, the puppet trails it. The arena spec (docs/superpowers/specs/2026-10-16-arena-design.md, item 7) left fear,
  temperament and obstacles "out, a later pass"; note 8c of 2026-10-18 put the fright on the walker instead.

## Decisions

1. **The guns in the arena (a).** The rig takes its guns from the host: `host.guns?.() ?? GUNSHIP_GUNS` once at the top of createGunshipRig
   is NOT enough (the arena starts later): read them through a getter each call. td-tab passes `guns: () => bossRun.guns()`; boss-run returns
   `{ ...GUNSHIP_GUNS, heavy: { ...GUNSHIP_GUNS.heavy, perPass: 0, reload: BOSS_FIGHT.arenaGuns.reload } }` while its phase is `boss` or `over`,
   else GUNSHIP_GUNS. New content `BOSS_FIGHT.arenaGuns = { reload: 6, station: true }` (the lab's RELOAD). While she lives the station does not
   end: boss-run exposes `orbit()` -> `{ ...GUNSHIP_ORBIT, station: Infinity }` in the boss phase and td-tab's rig host `orbit` getter reads it
   before the tune panel's (`tune.orbit ?? bossRun.orbit() ?? GUNSHIP_ORBIT`). The seat's readout must not show a NaN/Infinity countdown: check
   `phaseLeft` consumers (src/fx/gunship-hud.js?) and show "ON STATION" when not finite.
2. **The bound (d).** The arena disc: BOSS_FIGHT.bounds.radius (120 m) round `story.arena.cell`, in cells via METRES_PER_CELL (12 cells), inside
   ARENA.radiusCells 14 (the carved plain). The lure: in src/domain/lure.js add `insideArena(p, centre, radiusUnits)`; hull-drive's lure branch
   filters exits to those inside `bounds.radius - bounds.baitMargin` of the arena centre when the hull itself is inside (so it never leaves; if it
   is outside, 'arena' mode drives it in as today). The creature: her target point is clamped to `radius - creatureMargin` (decision 3) and, as a
   backstop, the record's walk exits are filtered the same way while she is `bodyLed` (decision 3) or a walker.
3. **The body owns her position (b, c, e).** For the boss record only (tier 'huge', hunter, in THE ARENA's boss phase): a `bodyLed` flag set by
   boss-run the first frame she is seen (where `ownFear` is set today). creature-reed.js: a body-led body's `aim` is NOT the record's point but the
   prey point the host hands in (`host.prey(h)` -> the hull's unit point, or the fear's flee point, or null for stun), clamped to the arena disc
   (decision 2), with `targetHeld` as the lab's rule (held except on the hull when the hull is moving... keep it simple: held = true always, the
   touch rule in enemy-step hurts the tank as today). After the kit's update the record's `pos` is written from the body's centre (toWorld of the
   frame; the inverse of toPlane) and `cur`/`next` from `host.cellIndex(pos)`; enemy-step skips the walk, the scare turn and the emergence offset for a
   `bodyLed` record (its pos is the body's) but keeps the touch, the damage and the death paths. The leash/re-place logic is off for a body-led body.
   Speed: the kit's own (the predator preset) at the body's scale; measure her ground speed in m/s in the probe and report it against the hull's
   lure speed (she must not out-run the hull on the lure: the owner wants a kite, not a catch; if she does, the lab's bait `keep`/hops are the knobs).
4. **Fear and temperament (e).** Move src/labs/boss/fear.js and src/labs/boss/temperament.js to src/fx/boss/fear.js and src/fx/boss/temperament.js
   (git mv; the lab imports them from the new place; they import only domain and fx/nih-dairia, so the layer rule holds: run `npm run architecture`).
   boss-run owns one `createFear` (gunFear true) and one `createTemperament` for her: `landed(gun, point)` feeds `fear.landed({ kind: 'bofors'|'nuke',
   radius })` with the point in the body's local metres (the body adapter exposes `toLocal(h, unitPoint)`), the seat's rotary rounds feed `fear.round`
   (the rig's `landed()` already reports every shell with its gun: 'rotary' too?: check stepRounds' output; if rotary rounds are not reported, add
   them). Each frame boss-run steps fear and temperament before the creature's update and hands the body the prey/flee/stun through `host.prey`.
   The lab's numbers (BOSS_FIGHT.gunFear, temperament) are the arena's; the old frightRecord/stunRecord path is kept only for a row whose boss is
   not body-led (the Cutis), so `arenaBoss.weight/flee/trail` stay for it.
5. **Harness.** `state().boss.fear` gains the lab's counts (scares by level, meter, flight, stunned), `state().boss.led` (bodyLed), `state().boss.dist`
   { hull: the hull's cells from the arena centre, boss: hers, gap: hull-to-boss cells }, and `state().boss.speed` (her m/s over the last second).
   A new browser step `--arena-fight`: from `?skip=defence&sector=<doorAt+1>&boss=1#td` with `arenaNow()`, take the gun, then (a) the seat's MK-9 is
   ready again within 12 s of a launch (reload 6 + fall), (b) over 60 s neither the hull nor the boss leaves the disc (dist <= 12 cells), (c) a 40 mm
   landed within reach produces a `wild` scare and her gap to the hull grows within 3 s, (d) an MK-9 within blast stuns her, (e) the station does
   not end in 150 s. The existing `--arena` must stay green.

## Out

The lab's obstacles (rocks/walls), the carcass, the Cutis row, SOL steering her, difficulty.

## Order of work (commit each step tested; stop where the clock stops)

1. Decision 1 (guns + station) with a node test on the rig's gun getter. 2. Decision 2 (the lure's bound) with test/lure.mjs cases. 3. Decisions 3-4
with node tests on the pure parts and the `--arena-fight` step. 4. Records: a deban entry (`npm run log -- add FILE`), STATE's paragraph, the spec filed
under docs/superpowers/specs/2026-10-23-arena-lab-fight-design.md (this file).
