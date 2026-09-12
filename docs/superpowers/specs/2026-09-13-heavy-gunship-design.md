# Heavy Gunship — design

Date: 2026-09-13. Status: **design agreed in session, not implemented.**
Scope: the gunship as a mount. The resupply mission, swarm rendering and the
half-dotted enemy question are separate specs.

## Why this exists

`src/strike.js` works and the owner finds it satisfying, but the orbital
strike has no home: no fiction, no body, no seat. The module already implies
a platform — *"the platform must re-enter orbit"* — and never shows one. The
KORP/GS01 heavy gunship is that platform.

This spec gives an existing, tested mechanic a referent. It does not change
the mechanic.

## The fiction

The KORP/GS01 heavy gunship (MÖRK manufacturer family) is in orbit and low on
fuel. It cannot manoeuvre and it cannot land. It passes over the base on a
fixed orbit. While it is overhead its guns are yours; the rest of the time you
watch it come around.

The fuel state is the diegetic reason the player is a gunner and never a
pilot. Position is not a player input because the aircraft has no fuel to
change it — not because the UI withholds it.

When the planet can refuel it, it lands VTOL. That is a later unlock and is
out of scope here, but the design must not foreclose it.

## Player role

Gunner only. The player takes the optic, selects among three guns and aims.
The player never controls the aircraft's position, altitude or orbit.

## 1. Architecture

`AGENTS.md` forbids new top-level `src/` modules, puts pure logic in layer
directories, and enforces both through `npm run architecture` alongside the
`src/td-tab.js` line budget in `docs/architecture-budget.json`.

| Module | Layer | Owns |
| --- | --- | --- |
| `src/domain/gunship.js` | pure | Orbit schedule, on-station state, per-gun cadence and reload, danger evaluation. No DOM, no three.js. |
| `src/content/gunship.js` | pure data | The three weapon profiles: rate, damage, blast, danger radius, reach. |
| `src/fx/gunship-optic.js` | render | The thermal pass and its material. |
| `src/sentry-pilot.js` | host, existing | GUNSHIP joins the mount strip. Adapter only; no second implementation. |

Reused unchanged:

- `src/fx/story-monitor.js` (29 lines) already renders a scissored second
  camera into a corner box and already has an `optic` mode that frames a
  target through a long lens when no round is in flight. Only its head label
  changes.
- `src/fx/story-scope.js` (47 lines) is host-fed: the caller passes `on`,
  `meter`, `locked`, `target`, `max`, `zoom`, `box` once a frame. The gunship
  is another caller.

`src/strike.js` is **not modified**. The gunship calls its existing
arm → paint → launch API. The ritual, the rationing and the blast rules stay
where they are and stay tested.

Budgets only go down: no growth in `src/td-tab.js` is acceptable for this
work. The mount lives in `sentry-pilot.js` and the new layer modules.

## 2. The platform: an orbital schedule

The gunship is not always available and is never called. It orbits.

- A fixed, visible cycle: **next pass** counting down, then **on station**
  counting down, then next pass again.
- Overhead, the mount strip's GUNSHIP button is live and the guns are yours.
- Not overhead, the button is dark and the countdown is readable.
- The player cannot advance, extend or delay the pass.

There is no fuel meter in this spec. Fuel is the stated reason the schedule
cannot be influenced; it becomes a spendable resource only if and when the
VTOL landing progression arrives, at which point accumulating it has an
obvious meaning.

Two resources come off one airframe:

- **105mm / orbital strike** — rationed by `strike.js` exactly as today.
  Conserved to close sinkholes and breaches.
- **25mm and 40mm** — free while on station. Spent on hordes.

The intended decision is: *burn the heavy on this wave, or keep the platform's
window for the breach?*

## 3. The three guns

| Gun | Cue | Role | Danger ring |
| --- | --- | --- | --- |
| 25mm rotary, 1800 rpm | `trrrrrrrrrr` | Sustained. Herds bodies in a direction. | Tight |
| 40mm Bofors | `TOH-TOH-TOH` | Mid-tier explosive. Breaks a bunched mass apart. | Wider |
| 105mm M102 | `sssshhh-BAAAM` | One shell, slow reload. **This is the orbital strike.** | Widest |

The intended loop: the rotary walks the horde off the wall, the Bofors splits
the mass, the 105 lands where nothing of yours is standing.

Herding requires no new enemy AI. It is existing knockback and pathing
reacting to sustained fire; if that does not read as herding in a prototype,
that is a tuning finding, not a licence to add a steering behaviour.

The KORP/GS01 asset ships rotary cannons, a heavy cannon, lateral-aiming
weapons and engine-tilt clips across LOD1 / GameLOD0 / LOD2 with forward,
hover and landed poses. Downloads must be pinned and hash-validated through
`npm run assets:check` per `AGENTS.md`; do not hotlink the upstream viewer.

## 4. The optic

Main view: thermal, from the orbit. Enemies read as heat; walls, towers and
the tank read as cold geometry.

Corner monitor: the real render of the impact point, through
`story-monitor.js`.

The player aims in abstraction and watches the consequence in ground truth.
The gap between the two views is where the theme sits — the player is killing
heat signatures belonging to something whose language has not been decoded.

## 5. Collateral

Soft warning. Every gun fires wherever it is pointed.

- The three danger rings draw on the thermal view as **readouts, never
  refusals**. The player sees exactly how much of their own base is inside the
  105's blast.
- `STRIKE_TUNE.breakWalls` and `breakTowers` remain `true`. The player really
  will open their own wall, and the monitor will show it happening.
- No lockout, no safety, no confirmation on any gun.

This matches what `strike.js` already does, so it is also the least new code.

## 6. Isao

His voice is pinned at the top of `src/isaobriefs.js`: stoic builder, two
short lines at most, the second line is always what he does next, curiosity
over dread, a loss is a fact and then a plan.

That register already carries the "wanton destruction, language not decoded"
note without a new one. He observes; he does not moralise. Lines are data in
`src/isaobriefs.js`. No new system.

## 7. Testing

Per `AGENTS.md`: `npm test`, `npm run check` (includes the architecture guard
and the line budget), `npm run build`, and `npm run test:browser` for the
render and input changes.

Pure-module coverage that must exist:

- The orbit schedule advances, opens and closes the window deterministically,
  and cannot be influenced by any player input.
- Gun cadence and the 105's reload behave under the clock.
- Danger evaluation reports friendlies, walls and towers inside each gun's
  ring, and reporting never blocks a shot.
- Taking and leaving the mount while off station is refused; while on station
  it is allowed.

## 8. Out of scope

- The resupply / escort mission (tank out of ammo, crossing to fetch rockets,
  tank AI that avoids hard cores). Its own spec, written after the guns have
  been held and tuned.
- Any change to `strike.js` numbers or rules.
- The VTOL landing and any fuel economy.
- The half-dotted enemy representation question.
- Large swarm rendering.

## 9. Assumptions and risks

**Swarm scale is unverified.** Section 3 assumes hordes large enough to be
worth decimating are renderable today. Every enemy is currently a `Points`
cloud built in `src/creatures.js` and `src/units.js`, and `docs/STATE.md`
records the inherited formula reaching 5,334 scheduled bodies at wave 75. A
weapon whose purpose is killing hundreds at once is the exact workload that
makes per-enemy dot clouds expensive.

This is an explicit dependency on the separate large-swarm exploration, not a
settled premise. Before tuning any gun against horde sizes, measure the
current cost of the target population and record the number. If the swarm
work changes enemy representation, the gunship's damage and blast numbers are
retuned against whatever ships, and the danger rings are unaffected.

**Delivery order.** `docs/STATE.md` pins architecture → visual/sound labs and
clean exports → UX → playability, and `td-tab.js` is mid-extraction. This work
is playability. It is kept inside the current phase by living entirely in
layer modules and the existing pilot host, adding nothing to `td-tab.js`, and
changing no balance outside the new weapons.
