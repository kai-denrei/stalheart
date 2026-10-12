# Cutis-Maku boss scenario — design

Owner, 2026-10-12: "for the boss, we will try same scenario as the current one, but with the Cutis-Maku from our local project
/Dev/Jelly-Baby/?specimen=cutis-maku. Same idea, start with wave 1 of 20 or so smaller one, and then a larger boss emerges. Isao the drone
avoid them, while the player shoots from above from the gunship." Then: "no replacing, we add" and "separate scenarios, picked by the switch";
the gameplay rules "essentially same as the other boss".

Branch `cutis-boss`, cut from `refactor-run` at 7d71f381 (worktree `~/Dev/stalheart-cutis-boss`).

## Owner's choices (brainstorm 2026-10-12)

- **Damage: the reach is its weak spot.** Full damage while it coils, reaches and grips (COIL, EXTEND, ANCHOR; the stretched stalk and the
  cup count as body), half at rest and SETTLE, none while the body pours through the cup (TRANSFER), with a small "absorbed" flash. Knobs.
- **The boss is just a bigger Cutis-Maku** for v1: longer reach, slower heavier hops, three seeking stalks, 180 hp. No splitting, no absorbing.
- **Death: deflates into a puddle.** ~1.5 s collapse into a translucent flat skin with the dark core showing, then fades and sinks over ~20 s.
  Blocks nothing, nobody's target. A new wave clears them.
- **A creature switch, additive.** `labs.html?creature=cutis#boss` (and a panel dropdown that reloads with the parameter) picks the Cutis
  scenario. Nih-Dairia stays the default and its code path is not changed or refactored. Separate scenarios, never both in one fight.

## 1. Where the code lives (all new except one hook)

- `src/fx/cutis-maku/` — the kit ported from Jelly-Baby @0a23df8 (`src/cutis/`) to plain JS on the vendored three r160: `config.js`,
  `swarm.js` (the controller), `geometry.js`, `material.js`, `shaders.js` (GLSL as strings), `convex.js` (ConvexGeometry over the
  vendored `ConvexHull.js`), `LICENSE` + derivation header as `src/fx/nih-dairia` carries (the owner's own creature, licence closed —
  `2026-10-08-nih-dairia-is-the-owners-own-creature`).
- `src/content/cutis-maku.js` — the wave's and the boss's sizes, kit configs, palette, health, phase multipliers, death timings.
- `src/domain/cutis-hits.js` — pure: the phase's damage multiplier, the distance from a point to a creature's hittable shape (body disc,
  stalk segment, cup), the creature's floor contacts and reach nodes for the existing rules.
- `src/domain/cutis-emerge.js` — pure: the climb out of the sinkhole (planted lip anchor, lift through the transfer).
- `src/labs/boss/cutis-scenario.js` (+ helpers under `src/labs/boss/cutis-*.js` as needed) — the scenario: its wave, its boss, its
  puddles, its sinkhole sequence; it answers boss-tab exactly what the Nih-Dairia wave and boss answer today.
- `src/labs/boss-tab.js` — the only edited existing file: read `?creature=cutis`, build the Cutis scenario instead of the Nih-Dairia wave
  and boss when set, and the panel dropdown. Isao, the seat, the fight round, friendlies, chatter, HUD, sinkhole host shared unchanged.

## 2. Gameplay (the same as the Nih-Dairia boss except where marked)

- **Flow (bait mode):** sinkhole opens at the centre → the wave comes up one by one (20 default, slider 0–100, `?cutis=N`) → they hunt Isao,
  his autopilot keeps away, the player shoots from the gunship seat → last one dead, the boss's sinkhole opens, the boss comes up → KILLED
  wins; `Isao down` / `Isao taken` lose. Bar label `CUTIS-MAKU`, wave bar `WAVE 1 · CUTIS n/N`.
- **Health:** small 20 hp, boss 180 (knobs). The fight's own guns, falloff (`splashDamage`), streams (`burn`), SOL, nuke, MK-9. A round
  resolves against the nearest point of the hittable shape, times the phase multiplier (Cutis only).
- **Catching Isao (same rule):** a floor contact within 3 m of his ground point for 0.5 s. Contacts = points on the body footprint rim + the
  gripping cup (ANCHOR/TRANSFER). His planner keeps out of the reach envelope: nodes = the body centre + a ring at its current reach.
- **Fear and temperament (same domain rules):** a frightened Cutis plans its next hops away from the threat; the nuke's stun freezes its
  phase for 1.5 s; the temperament's lunges shorten its hop cycle (4 s → ~1.5 s at a full lunge for the small ones; boss base slower).
- **Coming up (same flow, Cutis motion):** hidden below the hole until its turn; its first hop's cup is planted on the lip toward its fan
  direction and the TRANSFER pours the body up through it; not hittable, not hunting until settled on the surface. The boss the same, bigger.
- **Death (Cutis only):** deflate → puddle → fade (above). The fight's KILLED / R restart unchanged.
- **Chatter:** Isao's existing lines and director unchanged.

## 3. Rendering, performance, testing

- **Sizes:** small r0 1.5 m (reach 15 radii ≈ 22 m); boss r0 6 m (reach ~12 radii ≈ 72 m). The kit's absolute constants (swarm
  separation 1.5 m, ground heights .009–.045 m, shadow) scale with r0 / 0.2.
- **On the planet:** one instanced mesh set per swarm (wave, boss), its group on the lab's frame origin. The vertex shader bends each local
  point onto the sphere exactly (`uPlanetR`; 0 = flat): angle = d / R along the ground direction, height R + y. Normals come from the bent
  `deform`, so they are right. Lab frame re-anchors shift the swarm's arrays (`shift(dx, dz)`).
- **Per-instance additions to the kit:** own target per creature, pace multiplier (temperament), hold (stun), active/hidden, `lift`
  (metres, emergence), `deflate` 0..1 (death), a forced next anchor (emergence).
- **Thermal:** the material exposes `color`-free `emissive`/`emissiveIntensity` bound to a uniform so `src/fx/thermal-heat.js`
  heats it unchanged (lerp toward white).
- **Performance:** no solver; CPU = steering + phases for ≤ 101 instances. Expect well under 1 ms CPU; two draw calls per LOD per swarm.
- **Testing:** node tests for the port (timing, hop commit, anchors locked, per-instance target/pace/hold, shift, scaled separation) and
  for `cutis-hits` / `cutis-emerge`; a browser step `--boss-cutis` (wave comes up, rounds hurt only by the phase rule, wave clears, boss
  enters, a kill deflates it, 0 page errors); `npm test`, `npm run check`, `npm run build`, `npm run architecture`; the Nih-Dairia
  `--boss-wave` / `--boss-bait` steps still pass (baseline flakiness noted in the records). Then published to the test site.
