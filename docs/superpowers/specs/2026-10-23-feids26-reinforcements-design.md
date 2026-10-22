# FEIDS-26 REINFORCEMENTS — design (2026-10-23, overnight)

Owner, 2026-10-23: "the goal will be to have Isao call out planetary re-inforcements after having built the radar, and after a few in-game
days the FEIDS26 will come. ... we will reproduce the cinematic with the same scene, and they will land at the Arena (before the boss fight.),
2 will stay near the arena, 2 will roam the map." Then: "the Arena pair DOES join the boss fight, the roaming ones; 1 makes its way to the
main base, the other roams and hunts enemies. they are equipped with rotor + lancer + 2x quivers at max upgraded specs."

## The assets (owner's own, "Models by jelaludo"; survey in ~/Documents/kainode-vault/projects/stalheart-feids26-peek/)

- Upstream pages: https://jelaludo.github.io/SentryTowers_A6/feids26/ (the 28 s cinematic, `?play=1&seed=26`) and .../ridgeback-mech/.
  GLBs: `https://jelaludo.github.io/SentryTowers_A6/assets/feids26/feids26_d0_lod1.glb` (1,568 tri, 4 draws, 126 KB; clip `Shell_Separate` 4 s),
  `.../assets/ridgeback-mech/mx06_d0_lod1.glb` (8,016 tri, 38 draws, 967 KB plain; clips `Walk_Cycle` 4 s loop in place, `Airdrop_Land` 7 s one-shot),
  and the lod2 copies (`feids26_d0_lod2.glb` 30 KB one draw, `mx06_d0_lod2.glb` 201 KB one draw, static). Plain GLB is the source of truth; metres,
  +Y up, +Z forward, ground-centred roots (`FEIDS26_ROOT`, `MX06_ROOT`). Pin them under assets/models/feids26/ and assets/models/ridgeback/ with the
  upstream file names (the build packs every assets/models GLB with meshopt: scripts/build.mjs). Record their upstream commit/sha in a small
  README beside them (the manifests have sha256 values; copy the four lines you need).
- The capsule's cargo sockets: `SOCKET_CARGO_1` (0, 2.05, -2.2) and `SOCKET_CARGO_2` (0, 2.05, 2.2); two Ridgebacks at 0.75 scale, folded (the
  peek's timeline.js `packMech`: legs folded through runtime.js poseLeg/solveHydraulics; if porting the leg fold costs too much, hide the cargo inside
  the closed shell and show the mechs only from release: the shell is opaque).
- The cinematic (peek/feids26_timeline.js, pure functions of time): two capsules at x -6 / +6 m, entry from 480 m nose-down, split at 6.2 s (the second
  0.45 s later) about 300 m up (`Shell_Separate` or `applyShell` from peek/assets_feids26_runtime.js), four releases 6.2 / 6.38 / 6.65 / 6.83 s, each mech
  falls FALL_TIMES 6 / 6.25 / 6.55 / 11.6 s then brakes 0.8 s, touchdowns 13.0, 13.43, 14.0 and 19.23 s, landing spots (-6,-4), (-3,4), (4,-3), (7,5) m
  round the centre; the camera: wide on the falling group, hold the grounded trio 14-16.5 s, a fixed low ground camera (0.2 m) by 18 s for the
  laggard. Effects (peek/ridgeback-drop_effects.js): re-entry flames, smoke, ground cracks, shake. Port the timeline as a PURE domain rule
  (src/domain/reinforcements.js: capsuleState/cargoState/touchdowns as functions of t, seeded), the scene as src/fx/feids-drop.js (the models, the
  clip or applyShell, the flames/smoke from the game's own explosions/plume fx where they fit: src/fx/launch-plume.js, src/fx/explosions.js), the
  camera as the showcase's look (src/fx/descent-host.js uses `c.look(cell)` to hold the camera on the arena; src/fx/showcase.js `look`).
- Sounds (copy into assets/audio with flat names and list them in src/audiomanifest.js as the others are): `~/Downloads/FEIDS_26__Re_entrySound.mp3`
  (5.5 s) at each capsule's entry (the second 0.45 s later), `~/Downloads/10SecondsMechReentryWooshImpactAt4Seconds_Aftereffect.mp3` (10.1 s, the impact
  at 4.0 s) started 4 s before each mech's touchdown so the impact lands on it (the laggard's too), `~/Downloads/MechLandingImpact2_.mp3` (5.1 s) at each
  touchdown. Keep the capsule sound quieter than the mech impacts.

## Decisions

1. **The call.** When the radar programme step is printed (src/content/base-programme.js step `radar`, perk `uplink`; src/fx/programme-host.js
   `printed(step)`), Isao says a new brief `reinforcements_called` (src/isaobriefs.js: two short lines, e.g. "Uplink's up. I've asked the colony for
   planetary reinforcements." / "They'll take a few days to fall."; captions until recorded, as other new lines) and the callout REINFORCEMENTS CALLED.
   `story.reinforcements = { calledDay: daylight.day(), due: calledDay + REINFORCEMENTS.days }`.
2. **The drop.** Content `REINFORCEMENTS` (src/content/reinforcements.js): `days: 3`, the landing at `story.arena.cell` (the arena plain is carved
   at world build; the hole is NOT open yet: the drop comes before THE ARENA sector, so the four land on the plain beside where the hole will open;
   keep the landing spots clear of ARENA.craterCells round the centre: offset the group 5 cells toward the base along the planned road, or scale the
   spots x3 so they sit outside the crater's 3 cells), `scale` (the capsule 20 m long = 2 cells; the mech plot 8 m = 0.8 cell: use the game's unit
   scale as other models do, src/glbmodels.js fitModel / src/fx/model-fixture.js). The drop starts at the first lull after `due` (as DAY 42 does:
   src/fx/disco-party.js waits for a lull between waves; reuse its lull rule) and never during a manned seat, a brief, or the arena sector itself
   (if THE ARENA is reached first, drop at once as the sector begins, before the beacon's drive: the owner wants them before the boss fight).
   Isao: `reinforcements_inbound` ("Here they come. Look at the other side of the planet.") as the camera cuts to the arena; the camera holds the
   cinematic 28 s (game running, the base's towers fire on their own as during DAY 42's ball), then back. `?reinforce=1` (src/url.js style flags)
   forces the drop as soon as the world stands, for the harness and the owner's test; `?reinforce=0` disables it.
3. **The mechs are walking batteries.** An MX-06 has one minigun, one laser and two missile pods: that IS rotor + lancer + 2x quivers. Each mech owns
   four tower records at the max tier (the sentry defs in src/content/sentries.js: `rotor`, `lancer`, `quiver`; tiers/effectiveStats in td-tab: find
   the max tier and set it), pushed into `towers` so src/fx/tower-combat.js aims and fires them as it does any sentry (autoTower true for them:
   `host.autoTower(tw)` reads `story.autoTowers` by cell today; add `tw.mech` as a second reason), but NOT drawn as sentries (`obj` hidden or none:
   check what tower-combat needs from `tw.obj` for muzzle/beam origins and give it the mech's weapon nodes: `MINIGUN_YAW`/`MINIGUN_PITCH`/`MINIGUN_SPIN`,
   `LASER_YAW`/`LASER_PITCH`, `MISSILE_ELEVATION` are engine-driven pivots in the GLB), NOT in `towerByCell` (not placeable blockers; the hull and
   the enemies walk through their cell), not in the shop, not sold, not damaged by walkers (enemy-step's tower hits read `tw.a6`: keep them off it)
   and never counted by the programme/achievements as prints. Their `pos`/`ci` follow the mech each frame. Heat and cooldown as the sentries'.
4. **The four roles** (src/fx/mech-squad.js, a host module ticked each frame): after `Airdrop_Land` ends each mech walks the cell graph (reuse the
   enemy walker's shape: cur/next/prog along exits from `host.openNeighbors`, a pace in cells/s `REINFORCEMENTS.pace` 0.25; the `Walk_Cycle` clip
   plays at a rate scaled to the ground speed, capped x4: the gait will slide at game pace; note it for the owner). Roles: `arena` x2: patrol
   within ARENA.radiusCells of the arena cell (random walk that never leaves the plain) and, once THE ARENA's boss phase runs, they are simply there
   firing: tower-combat targets the boss record like any enemy (she is a hunter record with hp); `base`: walk the heart field (`dungeon.distToHeart`,
   toward the base) and park outside the gate on the open cell nearest the gate (never inside the walls: the hull's own rule), then stand and fire;
   `hunt`: walk toward the nearest alive enemy by the hunters' field if one exists (src/domain/hunters.js has the tank-centred field; a field from
   the enemy's cell is the same call) else random walk; it keeps at least 2 cells from the hull. All four: a model each (lod1; lod2 beyond 140 m if time
   allows), facing their walk direction, standing on the surface frame (src/domain/surface-frame.js as isao-worker / creature bodies do).
5. **Harness.** `state().reinforcements` { called, calledDay, due, phase: idle|dropping|landed, t (the cinematic's clock), mechs: [{ role, cell,
   hp?, firing }] }. Browser step `--reinforcements`: `?reinforce=1&skip=defence#td` (or the opening skipped as --day-42 does): the drop runs
   (phase dropping within 10 s, the four touchdowns at the rule's times +- 0.5 s on the game clock, the three sounds heard: the harness `sounds`
   hook exists, see memory "harness sounds/achievements"), the camera held on the arena then released, four mechs `landed`, their 16 tower records
   alive and autoTower, after 30 s the base mech nearer the heart and the hunt mech moved; the arena pair still within the plain.

## Out

Mech damage/death (D1-D3), weapon aiming beyond what tower-combat does, the capsules' wreck shells after the drop (fade them out 20 s after landing),
the lod swap if time is short, the voice recordings (captions).

## Order of work (commit each step tested; stop where the clock stops)

1. Pin the four GLBs + sounds; a node test that the manifest lists them; `npm run build` packs them. 2. The pure timeline rule + its test.
3. The drop scene at the arena with the sounds and the camera, on `?reinforce=1` (first browser check with the boot probe, then the step).
4. The call (radar + days) and the lull trigger. 5. The four as walking batteries (decision 3), standing first, then the roles (decision 4).
6. Records: a deban entry (`npm run log -- add FILE`), STATE's paragraph, this spec filed under docs/superpowers/specs/2026-10-23-feids26-reinforcements-design.md.
