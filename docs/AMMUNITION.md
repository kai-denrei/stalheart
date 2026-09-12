# Ammunition: what flies, what is modelled, and where it hooks

The workshop's ammunition library (`assets/ammunition` upstream, pinned by
family in `docs/ammunition-assets.lock.json`) ships every cartridge family in
three forms, `round` (complete, for racks and displays), `projectile` (the
part that flies) and `case` (the empty casing, for ejection and ground
dressing), each at a `game` and a `display` tier. This note is the verdict
per weapon: whether a modelled piece earns its triangles, what it costs, and
the code site it would hook into. The rule underneath all of it: on a
unit-sphere board a 22-triangle bullet is sub-pixel, so **rounds in flight stay
tracers**; modelled ammunition earns its place where it is stationary,
slow, or under the camera.

| Weapon | In flight today | Verdict | Cost (game tier) | Hook point |
| --- | --- | --- | --- | --- |
| Rotor (rotor_light) | dense tracer, 6 sub-rounds per round, package `rotor-tracer-dense` | **Do not model the projectile.** Eject the `case` in sentry control (done, see below); a `round` belt or drum later as the diegetic ammo count | case 94 tris, one instanced draw for the whole pool; round 94 | fire site in the tower loop (`tw.recoil = 1`), `src/fx/brass.js`; the drum node `Ammunition drum` for a belt |
| Needle (needle_50) | tracer head with a sampled path, "a round, not a ray" (`docs/SNIPER.md`) | **Not in flight.** A modelled needle50 only when time stretches or the camera sits on the gun: chambering and ejection in the manual range, a slow-motion cinematic, a magazine as the ammo readout | projectile 30, case and round 94 each | `src/sniper-tab.js` manual range (chambering), `src/sentry-pilot.js` optic for a magazine readout |
| Cannon 20 / 30 (Plasma, Lancer class mounts) | beam and burst effects | **No.** Nothing flies that a mesh would improve; a `case` pile as ground dressing under a mount is the only fit | case 94 | none today |
| Mortar (mortar_81) | the olive shell mesh from the derived shell (`makeOrdnanceShell`, 76 tris) | **Direct comparison.** The mortar81 `projectile` (126 tris) can replace the olive shell one for one; same flight code | 126 vs 76 today | `src/td-tab.js` `makeOrdnanceShell(cellSide*.28)` at the tower fire site; `src/shell.js` |
| MÖRK main gun (tank_arrow / tank_dart) | the Braille bullet cloud (`makeOrdnanceShell(2,'y')`) | **Rack, not flight.** The hull carries nine visible shells (`AMMO_PORT_LIGHT_00..08`): `round` meshes on those ports as the ammo readout; the flight stays a tracer | round 206 (arrow) / 94 dart; nine instances | `src/mork.js` `ammoNames` ports; `applyTankHealth` for the lit count |
| Quiver (TALON / DART) | the missile kit meshes already fly (guided, 6 s) | **Already modelled**, the one place a flying mesh is on screen long enough; unchanged | kit as pinned | `src/missiles.js` |
| Heavy / siege shells, missiles (SCOUT, KESTREL, MONOLITH, SKIMMER) | not in the roster | none until a launcher exists | 110 to 158 | none |

## The prototype: Rotor brass in sentry control

Every Rotor round ejects a spent case from the receiver's side while the
camera is within eight cells (so always in sentry control, never from the
map). The cases are one InstancedMesh of the pinned `rotor_light_case_game`
mesh, a pool of 48, each with a velocity and a spin; gravity is toward the
planet's centre, a case stops on the rock roof under the mount and shrinks
away after about three seconds. Cost: one draw for the whole pool, 94
triangles per case, no shadows. Size is scaled 2.5x from the authored 41 mm
so a case reads at the optic's distance.

## Not done, by design

- No projectile mesh for the Rotor or the Needle in flight (sub-pixel, and the
  muzzle sparks were once mistaken for bullets).
- No companion mounting: the library adds no ejection sockets, so the brass
  leaves from the ROTOR pivot's side rather than an authored port.
