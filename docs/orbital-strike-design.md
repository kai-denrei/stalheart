# Orbital strike — design

Status: **v1 built 2026-08-30.** Logic in `src/strike.js` (pure, tested in
`test/strike.mjs`); presentation in `td-tab.js`. Numbers live in the
`orbital strike` GUI folder, generated from `STRIKE_KNOBS`.

One deliberate translation: DeepWatch grants its budget per *wave*, but its
wave is the big battle unit — ours is the ROUND. The budget scales with the
sector's gates (one per two, minimum one), which is the user's own framing:
strong but limited, and later rounds have more portals. Adapted from DeepWatch
(`~/Documents/Dev/centroid-defense`).

---

## What DeepWatch actually does

Read from `main.js`, `scope.js`, `hud.js`, `contacts.js`. The system is worth
copying because of its *ritual*, not its rendering — the rendering is 2D
canvas and none of it ports.

**Strikes are rationed twice over.** A wave has a hard `strikeBudget`, and the
budget does not arrive at once: reserved strikes promote to *ready* one at a
time, each taking `GAUGE_TIME = 6s` to fill, announced with an `armedChime`.
So the question is never "do I have a missile" but "do I spend the one I have
now, or wait 6s for the next".

**Firing is a three-phase ritual, and the safety re-engages every time.**

| phase | gate | feedback |
| --- | --- | --- |
| safety off | needs ≥1 ready missile — you cannot arm an empty tube | `safetyClick` |
| target lock | needs safety off; taps outside the scope are ignored | `targetLock`, reticle drawn |
| launch | needs all of the above | `launchPress` |

Then: `state.safetyOff = false` — *"auto-reset — every shot earns its own
arming ritual."* That single line is the design. It makes each strike a
deliberate act rather than a button you can lean on.

**The reticle and the crosshair are drawn differently on purpose**, so the
player can tell "this is where the missile *will* go" from "the missile is in
the air and descending".

**The munition cam** is a small always-on panel that shows one of three
things, in priority order: a recent impact linger (0.55s), the oldest pending
strike in flight, or no-feed. In flight it eases the view radius from far to
near on a smoothstep — *"feels like falling"* — with shake that escalates
sharply past 85% of the fall, and it draws the live contacts, so you watch
your target drift out from under the warhead. There is a fullscreen takeover
variant. Crucially, the sim keeps running underneath it.

`STRIKE_DELAY = 2.4s`, `STRIKE_RADIUS = 80px` against a `SCOPE_R = 320`
scope — a blast a quarter of the play radius, and 2.4 seconds in which you
cannot take it back.

---

## What ports, and what does not

**Ports whole:** the two-stage rationing, the three-phase ritual, the
auto-re-engaging safety, the reticle/crosshair distinction, the falling
camera with escalating shake, the sim running underneath.

**Does not port:** everything about the rendering. DeepWatch draws a 2D PPI
scope; we have a sphere, a real camera, and a minimap that is already a
culled marker layer. Our version is *easier* here, not harder — the missile
POV can be an actual camera falling toward a real surface rather than a
faked zoom.

---

## Proposed design

### The radar is the minimap, promoted

We already have the pieces: a marker layer on layer 1, a pooled blip cloud
carrying every enemy and tower, and a map camera. Arming promotes that from
the corner disc to a large centred view — same scene, same layer, different
size and camera distance. No new render path.

### The ritual, kept intact

1. **ARM** — a switch in the HUD, next to the throttle. Refuses with a
   flicker if no strike is ready.
2. **PAINT** — tap a cell. Reuse the build-mode raycast→cell picking that
   already exists; it returns a cell index, which is exactly what a blast
   needs. A ring shows the blast radius in cells.
3. **LAUNCH** — commit. Safety re-engages immediately.

### The fall

A second camera, starting on the target cell's outward normal at high
altitude and falling to the surface over ~2.5s, easing on a smoothstep, with
shake escalating past 85%. It replaces the main view rather than rendering
beside it — a second full-scene render is exactly the cost the minimap
culling just removed, and a takeover costs nothing extra.

### The payoff

**One strike destroys a portal.** That is the reason the system exists: a
gate is otherwise a grind, and this makes closing one a decision with a
budget attached rather than a chore. Against enemies it is falloff damage in
a radius.

### Rationing

Strikes accrue on an orbital window, as in DeepWatch. Exact numbers are a
tuning question, and the tuning bench pattern already in the repo
(`knobs.js`) is where they belong.

---

## Costs and risks

- **The takeover is the risky part.** Two and a half seconds where the player
  cannot steer, while the wave keeps coming. DeepWatch gets away with it
  because its sim is slow. Ours is not: it may need to be skippable, or the
  cam may need to stay a corner panel with fullscreen as an option.
- **The strike must not trivialise the board.** One-shotting a portal is
  strong. The rationing is the balance, and it is untested.
- **It is a new input mode** on a HUD that has had two layout passes already.
  It should reuse the build-mode picking rather than invent a third way to
  select a cell.

---

## Decided (2026-08-30)

**Time runs on while you arm and paint.** As DeepWatch does. Arming under
pressure is the cost, and it stops a strike doubling as a free pause button —
which is what any of the slow/pause options would have made it.

**Per-wave budget plus the orbital window.** DeepWatch's model unchanged: N
per wave, promoting one at a time on a timer. The tension worth having is
"spend the one I have, or wait for the next" — a credit purchase would have
replaced that with a shop decision the game already has eight of.

Consequence: a strike costs a **slot, not credits**. The budget is the price.

**Fullscreen takeover, skippable.** It swaps for the main view rather than
rendering beside it, so it costs nothing extra — the second-render trap the
minimap culling just removed. Tap to skip to impact when a wave is on top of
you, which is the release valve that makes an unskippable 2.5s blind spot
survivable in a game that moves faster than DeepWatch's.

## Still open

- Numbers: strikes per wave, window length, blast radius in cells. Tuning,
  and it belongs in a knob table (`knobs.js`) rather than in constants.
- Whether the skip should cost anything (skip = no cam, but the strike still
  lands) or be free.

## Build order, when it starts

1. Strike state + rationing, headless-testable, no UI. The budget and window
   are pure logic and want a test suite before a single pixel.
2. The ARM switch and the refusals. Wrong-state feedback first, because that
   is what the ritual is made of.
3. Radar promotion — the minimap is already the right object.
4. Paint a cell, reusing build-mode picking. Blast ring.
5. The fall camera, and the skip.
6. Portal one-shot, damage falloff, and the tuning pass.
