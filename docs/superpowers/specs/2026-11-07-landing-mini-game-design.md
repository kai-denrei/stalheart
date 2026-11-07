# THE LANDING — the manual override in the arrival (2026-11-07, from `overnight-2026-10-23` at 387ee717)

Owner, 2026-11-07, from `~/Documents/StalheartLandingMiniGame_ideas.md` ("To create a landing-the-rocket mini game instead of the
initial cinematic. I especially like the full-screen booster rocket effects. Main story: the landing starts, but there's a problem and it
requires a manual override. Hectic 20 seconds or so of adjusting trajectory, angle, booster fuel, re-entry speed, etc. for a smooth
landing") and his four calls on the agent's reading of the options: **(1) the player can lose**, "but just in that the rocket crashes and
there's less to salvage. Slightly harder start"; **(2) skippable after the first start**; **(3) curvature is fine**, "ideally I'd want the
large cinematic wormhole in the background"; **(4) the cockpit view deferred**.

The method chosen (the agent's recommendation, agreed): the brief's Idea 1 built INSIDE the existing arrival, in the game's own 3D, with
Idea 2's instruments as a HUD. Not the owner's 2D game in a frame (Idea 0: BELOW showed what a second app costs, and the owner's round 5
note 10 said what it feels like), not a modelled cockpit (nothing to build it from; the HUD already speaks the game's monochrome
vocabulary). Every decision below is written so the owner can overturn it with one line.

## 1. What exists and is reused

- **The arrival is already a timeline-driven landing of the real SH02 on the real landing island.** `src/domain/landing-sequence.js`
  (pure: altitude, the legs, shock and door clips, the plume, dust, scorch, Isao's rise, by one clock) under `STORY_ARRIVAL.landing`
  (`src/content/story-defaults.js`: a 2.6 s descent from 150 m), the camera rail `STORY_ARRIVAL.rail`, Isao's way out
  (`src/domain/arrival-shot.js`), and the host `src/fx/arrival.js` (the shot, the plumes, the swap of the intact rocket for its salvage
  and the foundry off camera, the thrust bed and the pneumatics, the start gate it waits behind, the key or tap that skips). The
  manual window is cut INTO this clock: the approach before it and the touchdown after it are the arrival as it is.
- **The plume the owner likes is already in the game.** `src/fx/launch-plume.js` is the Onkochishin ray-marched launch plume on six
  camera-facing quads under the skirt (`PLUME_CLUSTER`), with an intensity uniform; the throttle drives it. The full-screen version of the
  same shader (the 2D game's `launch-plume.js`, MIT, attributed in `ATTRIBUTIONS.md`) is the override beat's glare (section 4).
- **The flight model is the 2D game's, ported.** `Stalsfar_Landing/landing/lander.js` `flightStep` (throttle spool, gravity, drag, fuel),
  `evaluateTouchdown` (sink, drift, tilt, slope grades) and `predictImpact` are about eighty lines, pure, tested in node
  (`tests/physics.mjs`). They become `src/domain/manual-landing.js`. Nothing else of the 2D game comes over: no Canvas view, no six-entry
  director, no wreck break-up, no site chips.
- **The accretion disk is already in the sky**, world-fixed planes beyond the planet (`src/fx/sky-rig.js`, `galaxyseed.js` `SKY_HOLE`),
  aimed low behind the Stålheart as seen from the bays. The landing island (`base-layout` `landing`, x 0, z -60) lies on the far side
  of the base from the Stålheart (x 4.5, z 0): a chase camera behind the rocket on the island's -z side, looking +z across the base,
  has the disk low in the frame behind the pad. This is a lab tuning of the approach heading, not new sky code.
- **The seat and input patterns**: `src/platform/tank-input.js` (the keys, the throttle lever), `src/fx/camera-shot.js` (a shot with
  `passKeys` and `skipKey`, so a shot can let the flight keys through and keep one key as the skip), the start gate
  (`src/fx/start-gate.js`: the landing waits behind START), the tutorial card's `skipLanding`, the harness (`window.__stalheartTest`).
- **The economy the grade feeds**: the AFR-01 foundry (`src/content/foundry.js` `FOUNDRY_TUNE`: three salvage sections consumed in
  order, a 60-biomass barrel a cycle, 24 s cycles, the first barrel 9.4 s in) is the opening's whole feedstock.
- **The rules of the house**: pure modules in `src/domain` and `src/content` tested in node, hosts in `src/fx`, nothing new in
  `src/td-tab.js` (its budget is 0 lines), tunables in one content literal, the story lab (`labs.html#story`, `src/labs/story-landing.js`)
  for the feel before the game.

## 2. The beat, in order

```
APPROACH -> OVERRIDE -> MANUAL -> FLARE -> TOUCHDOWN -> RESULT
   (auto)    (alarm)   (player)  (auto)    (clips)    (the arrival's talk, graded)
```

1. **APPROACH** (auto, about 6 s). The arrival's orbit shot as it is, from higher: the rocket burning in from `start.altitude` on the
   sequence's own eased altitude. The start gate's START is still the first gesture.
2. **OVERRIDE** (`override.seconds`, 3 s). At `approach.overrideAt` (3.5 s into the approach, the sequence at ~380 m) the auto-lander
   faults: the alarm, the HUD's annunciator `AUTO-LAND FAULT · MANUAL OVERRIDE`, Isao's caption line (section 7), the full-screen
   plume glare swelling over the frame and clearing (2.4 s), and the hand-over: under the glare the flight state is the planet's seeded
   entry (`seedEntry`: 300-400 m, sink 30-40 m/s, drift ±8-12, tilt ±0.25-0.35, 18-22 s of fuel; section 3), not the sequence's own
   altitude and rate; the chase camera takes over from the rail and the HUD instruments come up. The rocket holds where it is through
   the beat; the throttle keys and L already set the throttle and arm the legs. There is no offer here: a later start's offer is the
   start gate's (section 8).
3. **MANUAL** (the player, 15-25 s by the tune). Throttle and tilt (section 5). Fuel is the clock (`vehicle.fuelSeconds` of full burn,
   starting around 20 s so a hover is a losing move). The reticle on the ground, the instruments, the plume under the throttle, the
   thrust bed under the burn.
4. **FLARE** (auto, the last metres). When the rocket is below `flare.altitude` AND inside the corridor (sink under `flare.sink`, drift
   under `flare.drift`, tilt under `flare.tilt`), the auto-lander takes back: the legs are already down (section 5), it kills the
   residual drift and tilt and settles at `flare.sinkFinal` over the remaining height. Outside the corridor the player keeps the
   stick to the ground and gets what they flew. The take-back is announced (`AUTO-LAND RESUMED`) so the player knows the rest is not
   theirs.
5. **TOUCHDOWN**. The sequence resumes at its `touchdown` with the real contact state: the shock clip plays at a rate from the sink
   (clean: as authored; hard: faster, a camera jolt; wreck: the clip at its hardest, the crash sound, the dust doubled, the scorch
   wider). There is no toppled SH02 model and none is made: the owner's rule from 2026-09-25 stands, the state change happens off
   camera. On every grade the door opens, Isao rises and flies clear, and the cut to his face swaps the rocket for its salvage and the
   foundry where no camera looks.
6. **RESULT**. The grade is read on the HUD (`LANDING · CLEAN / HARD / WRECK`, sink, drift, tilt) through the cut, Isao's talk is the
   graded one (section 7), and the foundry's salvage is set from the grade (section 6). The game runs on from here exactly as today.

A key or tap skips the shot today; during MANUAL only the skip key does (section 5). A skipped landing at any point lands itself at the
sequence's end as today, graded CLEAN for the record (the auto-lander never crashes), with the plain talk, and pays no grade: the
foundry is left as today, no salvage set (2026-11-07, the final review; the owner's call 1, the grade is for a flown landing: a skip
paid the CLEAN bonus barrel, so taking the offer and pressing Esc beat a flown HARD landing).

**Changed in the build (2026-11-07).** Three calls after the first browser flights (Task 7's report):

- **A. The flight is seeded from the entry, under the glare.** The sequence's eased descent could not hand over a flyable state: at the
  plan's tune (7 s from 900 m, the override at 4.2 s) it was 144 m sinking at 102 m/s with a 590 m stopping distance, and every flight
  ended in a wreck. The override now hands over the seeded problem (`seedEntry`: 300-400 m, 30-40 m/s, the drift, the tilt, the fuel),
  placed under the glare's 2.4 s; the approach before it is only the picture of a rocket coming in from orbit, retuned to
  `{ descent: 10, startAltitude: 900, overrideAt: 3.5, deployAltitude: 700 }` so the sequence stands at ~380 m at the override and
  the cut is small. The eased ~117 m/s there is dropped for the entry's sink: the auto-lander's braking burn is what failed.
  "Velocity and attitude carry across untouched" in item 2 no longer holds.
- **B. The offer moves to the start gate.** A later start shows a second, smaller call to action beside START A NEW PLANET:
  `FLY THE LANDING`, its key `SPACE`. Taking it opens the gate as START does and the arrival flies the landing on the manual tune (the
  arrival's `start()` chooses the tune). There is no offer during the approach any more (`override.offerSeconds` is gone). The harness's
  `landing('override')` takes the offer before START; `?landing=offer` shows it on an acceptance page (which otherwise never offers).
- **C. The chase camera looks at the predicted impact point.** The look target is the reticle's ground point (blended toward the rocket's
  own ground point when the prediction is more than `camera.lookReach` m off the pad), the eye behind along -z, above, and a little to
  +x for a three-quarter view (the tilt is about x and would lie along the line of sight from straight behind). The eye's distances
  grow with the height so the rocket stays in the upper half of the frame with the reticle below it from 350 m to the ground.
- **D. The review of the build (2026-11-07).** A flight key held through the contact auto-repeated into the resumed rail's skip within
  ~30 ms, so the door, Isao's rise and the graded talk's lead-in were lost: the rail after a flown touchdown is now locked
  (`touchdown.lockSeconds`) and skips on `Esc` alone, and an auto-repeated key never skips any shot. The ground off the pad was the flat
  tangent plane, so a far wreck stood in the air over the curving planet: `floorAt` now follows the sphere (the drop, the normal; the
  slope and the tilt against the local normal in the verdict). The touchdown's numbers moved into `LANDING_GAME.touchdown`.

## 3. The flight model (`src/domain/manual-landing.js`, pure)

Fixed-step, deterministic: the same seed and input timeline give the same outcome. Metres around the landing island as the arrival's
clock already measures them (x and z along the ground, y up, +z toward the pole); the host maps that onto the planet. The planet's
curvature is not simulated in the 15 s of flight; the ground is the island's tangent plane with the terrain height under the impact
point read from the host (section 4).

```
state:  { x, y, z, vx, vy, vz, tilt (rad, about the approach's lateral axis), tiltRate, throttle (0-1, the set point reached),
          fuel (s of full burn left), legs (0-1), phase, t }
step(state, input, dt, tune) -> state'   input: { throttle: set point 0-1, tiltRate: -1..1, legs: boolean }
```

- Throttle follows its set point at `vehicle.spool` per second; no fuel, no thrust. Thrust `vehicle.thrust` m/s² at full along the
  rocket's axis; gravity `sim.gravity` down; drag `sim.drag` quadratic (thin air, small). Mass is not simulated (the 2D game does
  not either; the hoverslam reads the same with a fixed T/W).
- Tilt rate from the input at `vehicle.torque`, damped at `vehicle.damping`. The tilt aims the thrust: forward tilt pushes +z. Lateral
  motion is one axis (z, along the approach). A crosswind term `entry.wind` on x exists in the model and STARTS AT 0: with it on the
  reticle slides sideways and the player has no stick for it, so the flare cancels x inside its corridor and x counts in the drift
  only outside it. Whether the wind is turned on, or a second tilt axis added, is the lab's call once the one-axis flight reads.
- **The corridor at the override** (`entry`): altitude, sink, drift, tilt and fuel are the entry's, seeded from a per-planet seed so
  every new planet's landing is its own problem: `entry.altitude` 300-400 m, `entry.sink` 30-40 m/s, `entry.drift` ±8-12 m/s,
  `entry.tilt` ±0.25-0.35 rad, `entry.fuelSeconds` 18-22. Starting values; the lab decides.
- **The stopping distance** is the instrument the player flies by: `hStop = v² / (2 (T − g))` at full throttle, recomputed every
  step; the HUD's T/W and the reticle's inner ring are built on it.
- **The predictor** `predictImpact(state, tune)`: the state integrated at the current throttle to the ground; its point is the
  reticle's centre and its time the ping's interval.
- **The verdict** `verdict(state, slope, tune)` at the first ground contact (any foot, legs down or not), the 2D game's thresholds as
  starting values: CLEAN sink ≤ 2.5 m/s, drift ≤ 1.5, tilt ≤ 4°; HARD sink ≤ 6, drift ≤ 4, tilt ≤ 11°, legs down; WRECK anything worse,
  or legs up, or slope over 9°, or off the pad's island by more than `pad.reach` metres. The worst axis names the verdict's reason
  (`sink`, `drift`, `tilt`, `legs`, `slope`, `off-pad`): the HUD says why, never "the game decided".
- **The flare rule** `flareDue(state, tune)`: below `flare.altitude` and inside the flare corridor (section 2.4).

The tune is one frozen literal `LANDING_GAME` in `src/content/landing-game.js` (`sim`, `vehicle`, `entry`, `flare`, `verdict`, `pad`,
`hud`, `skip`, `salvage`), every number with its rationale beside it, nothing tunable hidden in logic.

## 4. The host (`src/fx/manual-landing.js`), driven from the arrival

`src/fx/arrival.js` owns the phases and keeps the sequence; the new host is handed the rocket, the plumes, the camera, the HUD root,
the sound, the input and the ground query, and the arrival's tick calls it while OVERRIDE, MANUAL and FLARE are on. It writes:

- **The rocket's pose**: position from the flight state in the island's basis, the tilt about the lateral axis; the sequence's
  `altitudeAt` is not read while the player flies. Legs: the `Legs_Deploy` clip scrubbed by `state.legs`.
- **The plumes**: intensity from the throttle (0 at idle, 1 at full), the cluster's own cadence kept; the thrust bed (`rocket_thrust`)
  loops under any throttle above `hud.audibleThrottle` and cuts with it; the alarm on OVERRIDE; the crash sound on a WRECK; the
  altitude ping (a short UI cue at an interval from the predictor's time to impact, `hud.ping`: from 1.2 s at the override to 0.15 s at
  10 m).
- **The chase camera**: behind and above the rocket along the approach, looking at a point ahead of it on the ground, with the disk
  low in the frame (section 1); the lens `camera.fov`; a small lag so the rocket leads the frame; the shake on a hard contact
  (`camera.jolt`). It is a shot (`startShot`, `skipKey`) so the seat and chase rules stay out of it as they do for every shot; the
  host's capture listener, registered before the shot's, takes the flight keys, the shot eats every other key and keeps `Esc` as the
  skip (`passKeys: false` since the final review, 2026-11-07; the reduced-motion preference also drops the rail's jolt).
- **The reticle**, a real projection on the terrain, not a sprite: a ring on the ground under the predicted impact point (the host's
  `floorAt`/`groundAt` query gives the height and the normal, as the pets and the burn marks use), its radius the altitude at
  `reticle.metresPerMetre`, stretched along the ground velocity, with the three fixed rings at 100 / 50 / 10 m that shrink past it and
  the hard square at 10 m. Drawn in the game's wireframe vocabulary (the lattice's cyan, a line loop), projected on the terrain normal
  so a slope skews it. On the pad it is green; off the island it is the alarm red.
- **The HUD** (section 5's instruments), a panel in the existing HUD style (`styles.css`, the `arrival-on` class hides the game's
  chrome today; the landing panel is the one thing shown).
- **The full-screen glare** at OVERRIDE: the 2D game's full-screen launch shader as one full-screen quad, shaped by the
  `override.glare` block `{ seconds, dim, peak }` (the beat's length, the exposure when nothing shows, the exposure at the glare's
  height; 2026-11-07, it was a number of seconds in the first draft), exposure up then down, under the alarm. On `prefers-reduced-motion` the glare is a plain fade.

## 5. Controls and instruments

Throttle is SET, not held (the brief's rule): `W` / `S` step the set point by `input.step` (0.1), `Shift+W` to full, `Shift+S` to
idle; `A` / `D` tilt back and forward (held: a rate); `L` legs (auto at `legs.autoAltitude` 200 m unless the player already did);
`Space` does nothing in flight (so a reflex from the 2D game cannot cut the burn); it is the start gate's FLY THE LANDING key, before
START only (section 8). Under FLARE the flight keys are eaten and do nothing (the auto-lander has the stick; none reaches the tank).
`Esc` is the skip (section 8). Touch: a throttle slider on the right rail, two tilt buttons on the left, LEGS, SKIP; the same seven
things, nothing more. Six touchable things, a dozen readable:

| Instrument | Reads | From |
| --- | --- | --- |
| ALT tape | altitude above the pad, rolling, overshooting on a rate spike | state.y, terrain |
| SINK tape | vertical speed, red above the HARD sink | state.vy |
| DRIFT needle | ground speed along and across, centred when straight down | vx, vz |
| TILT | the attitude ball, the CLEAN and HARD cones drawn on it | tilt |
| T/W | thrust over weight at the set point; `CAN STOP IN` hStop against ALT | throttle, hStop |
| FUEL | burn seconds left; red under the stopping time | fuel |
| ANNUNCIATOR | AUTO-LAND FAULT · MANUAL · LEGS DOWN · AUTO-LAND RESUMED · the verdict | phase |
| RETICLE | on the ground (section 4) | predictor |

## 6. The grade and the start

The verdict sets the foundry's salvage for the run (`LANDING_GAME.salvage`, applied through the foundry's configuration at deploy, not
by touching the clips):

| Grade | Sections the arm consumes | Biomass a barrel | The start |
| --- | --- | --- | --- |
| CLEAN | all three, plus one extra barrel at the first cycle | 60 | a little easier than today |
| HARD | all three | 60 | today's start |
| WRECK | two (the tank section is crushed) | 48 | slightly harder, the owner's call (1) |

The salvage layout model shows the same sections on every grade (no crushed variant is made); the arm simply never cuts the lost one.
~~and the HUD's `SALVAGE · 2 OF 3 SECTIONS` says so~~ (2026-11-07, the final review: not built; the verdict line and the wreck's fourth
caption are what say it). Nothing else of the opening changes: the Stålheart print, the beacons, the first
Rotor come as they do, later by one or two barrels on a wreck.

## 7. Isao

The lines run on the panel and the drone's face as today (`src/isaobriefs.js`), captions until recorded (the voice list gets a
section for them, the recording order as before):

- OVERRIDE: `override` — "Auto-lander's gone. You have the stick."
- CLEAN: `arrival_talk_clean` — "Textbook landing!", then the two existing lines.
- HARD and WRECK: `arrival_talk` as it is — "Rough landing!", "So much to build!", "I'll cannibalize the rocket …"; a WRECK adds a fourth
  caption after the third: "Less to cannibalize than I'd hoped."
- A skipped or automatic landing: `arrival_talk` as today.

## 8. The first start, the skip, the entries

- **The first start on this browser flies the landing** (owner's call 2). `src/storage.js` keeps `td.landing.flown` once the OVERRIDE
  has begun (skipped or not). After that every story start is the arrival as today, and the start gate offers the flight: beside
  START A NEW PLANET a second, smaller button `FLY THE LANDING` with its key `SPACE` (`src/fx/start-gate.js`; Space is taken in capture,
  never pressing the focused START). Taking it opens the gate as START does and the arrival flies the landing on the manual tune;
  START alone lands itself. `?landing=1` forces the mini-game, `?landing=0` never, `?landing=offer` shows the gate's offer on an
  acceptance page.
- **The skip inside the flight** is `Esc` or the on-screen SKIP, not any key: the sequence resumes at its touchdown on the pad, grade
  CLEAN for the record, no salvage (the foundry as today, section 2), the plain talk, the rail back in the same frame. Before the override (the approach) any key or tap skips the whole arrival as
  today (a flown landing: Esc alone, section 13; 2026-11-07, section 14 C: no approach on a flown landing, so its Esc before the override is the
  signature's skip, and only past the signature, while the flight waits for the disk's aim, the whole arrival's), ungraded. After a flown touchdown the resumed rail is locked for `touchdown.lockSeconds` (1.5 s, the keys held at the
  contact), then `Esc` alone skips it (on a phone, after the lock, a tap: 2026-11-07); an auto-repeated key never skips any shot (`src/fx/camera-shot.js`). The tutorial card's skip
  and the chapter links are unchanged (a chapter starts past the landing, as today).
- **Acceptance runs** (`?acceptance=1`) land automatically unless they ask (`?landing=1`), and show the gate only with `?gate=1`.
- **Phones** (`(pointer: coarse)`) fly it with the touch rail; the plume stays on quads as today and the glare is the plain fade (the
  `reducedMotion` path): a phone never builds the WebGL2 glare.

## 9. The harness and the suites

- `window.__stalheartTest`: `landing('input', { throttle, tiltRate, legs })` (the throttle and legs consumed by the next step, the tilt
  rate held until the next call; true once the flight has begun), `landing('skip')` (Esc's skip), `landing('override')` (takes the
  gate's offer before START); `state().arrival.landing` (in flight `{ phase, grade, reason, sink, drift, vz, tilt, fuel, altitude, x, z,
  throttle, legs, t }`, after the contact `{ phase: 'done', grade, reason, sink, drift, tilt, landed }`, `landed` the island metres
  where it stood to 0.1, null on a skip), and beside it `manual`, `offer`, `offered`, `flown`, `talkBrief`, `view` (NDC of the feet,
  the hull's top and the reticle).
- Node: `test/manual-landing.mjs` — determinism (two runs, one timeline, one outcome), the spool, the fuel clock, the predictor
  against the integrator, each verdict reason reached by a constructed state, the flare rule's corridor edges, `hStop` against a
  braked integration; `test/landing-game.mjs` — the tune's shape and that every grade's salvage is a valid foundry configuration.
- Browser `--landing`: a scripted timeline (throttle set at the override, tilt to cancel the drift, legs, full burn at the stopping
  distance) to a CLEAN landing, asserting the grade, the extra barrel, the clean talk, the swap and the foundry; a second timeline
  that never burns to a WRECK, asserting the reason `sink`, two sections, the fourth caption; the skip mid-flight to a CLEAN; a still
  mid-flight with the disk in frame (`artifacts/browser/landing-manual.png`). `--story` (the arrival cine) stays green: it runs
  without `?landing=1`, so it lands automatically as today.

## 10. The modules

| File | Layer | Holds |
| --- | --- | --- |
| `src/content/landing-game.js` | content | `LANDING_GAME`, the tune |
| `src/domain/manual-landing.js` | domain | `createLanding(seed, tune)`, `step`, `predictImpact`, `verdict`, `flareDue`, `hStop`, `seedEntry` |
| `src/fx/manual-landing.js` | fx | the host: pose, plumes, camera, reticle, HUD, sounds, the glare |
| `src/fx/landing-hud.js` | fx | the panel and its tapes (DOM, the HUD style) |
| `src/fx/arrival.js` | fx | the phases OVERRIDE / MANUAL / FLARE cut into the clock, the offer, the grade handed to the foundry and the talk |
| `src/labs/story-landing.js` | labs | the manual window in the story lab with the keys, for the feel |
| `src/isaobriefs.js`, `src/content/foundry.js`, `src/storage.js`, `styles.css` | | the lines, the salvage table's application, the flag, the panel |

`src/td-tab.js` does not grow: the arrival already has the host's hooks (storyApi: brief, camera, startShot, drone, sfx, the foundry
deploy); the ground query and the input come through it.

## 11. Build order

1. The tune and the domain module, test-first (node): the step, the predictor, the verdict, the flare, `hStop`, the seeded entry.
2. The story lab: the manual window on the existing arrival timeline with the keys and a plain HUD, the owner tunes the entry, the
   fuel, the corridor and the camera there.
3. The game host: the phases in the arrival, the chase shot, the plumes and the thrust bed, the reticle, the glare.
4. The HUD panel and the sounds (alarm, ping, crash).
5. The grade into the foundry, Isao's lines, the first-start flag and the offer.
6. The harness hooks and the suites; `npm test`, `npm run check`, `--landing`, `--story`, the default suite.

## 12. Not in this spec

The cockpit interior and the first-person seat (owner's call 4, deferred); a toppled or broken SH02 (no model, the off-camera rule
stands); multiple entries or boosters (the 2D game's six); a landing-site choice (one pad, the island the base is built on; the
corridor and the fuel are the problem, not the map); mass loss; a retry loop (the arrival never replays in a run); any change to the
chapters, the skip links or the acceptance routes beyond `?landing`.

## 13. The owner's morning (2026-11-07): the exhaust signature and the stick

*Superseded 2026-11-07 by section 14 for the stick, the bank axis and the mouse; the signature stands.*

Owner, after the first look, with a still of his 2D game's opening: "the beginning is not working as intended. 1) we want the 'exhaust
signature' effect in full screen, a close up of the boosters firing, as in the stalheart landing fleet 2d mini game. 2) the space bar
must be the booster, and some form of wasd + mouse to orient the rocket and try to smooth the landing." Two things change; the rest of
this spec stands.

**A. THE EXHAUST SIGNATURE opens the flown landing.** The 2D game's opening (`Stalsfar_Landing/landing/lander.js` `openingCameraY`,
`CONFIG.cinematic { opening: 8, ignitionHold: 3, launchYEnd: -1048576 }`): the launch shader full-screen on an OPAQUE canvas over the
page, the exposure held at the shader's 1000, only the camera's Y animated: 2 for `hold` s (the boosters close up), then down to -8 on a
smoothstep over 55 % of the remaining 4.6 s, held to 70 %, then geometrically down to `yEnd` where the frame is black; drawn at up to
30 Hz, capped at 1600 x 1000 as the 2D game. Over it the 2D game's plate: the eyebrow `SH02 / EXHAUST SIGNATURE`, the subtitle
`STÅLHEART · ARRIVAL CORRIDOR`, the credit `LAUNCH SHADER · PULKIT · MIT` and a `SKIP CINEMATIC →` button. It plays once START (or
FLY THE LANDING) has opened the gate and the landing is to be flown, BEFORE the approach: the arrival's clock holds at 0 under it, the
rocket's thrust bed plays under it at full (the boosters firing; the 2D game's is silent only because its audio is not yet unlocked),
and when it ends (black) the approach runs as today, then the override (2026-11-07, section 14 C: no approach on a flown landing; the black
opens on the flight at the override). `Esc` or the button skips the cinematic only (to the approach; since section 14 C, to the flight);
every other key is eaten under it (the rail's any-key skip must not fire under the black). After the signature the approach's rail skips on Esc alone (2026-11-07, section 14 C: no approach on a flown landing; the flight shot skips on Esc alone) (2026-11-07, the final review: a Space tapped through the black would otherwise end the flown landing at the first fresh press); an automatic landing's approach skips on any key as today. Reduced motion or no WebGL2 skips it
outright (the 2D game's rule); a phone plays it (the 2D game does, at its cap). The tune: `LANDING_GAME.signature { seconds: 8, hold:
3, yEnd: -1048576 }`. The override's glare is no longer the shader: the plain fade (`landing-glare.js`'s CSS path, `override.glare
{ seconds: 1.2 }`), so the shader shows once, as the 2D game shows it. An automatic landing (START on a later run, `?landing=0`, the
acceptance suites without `?landing=1`) has no signature.

**B. The stick.** Space HELD is the burn (the set point 1 while held, 0 on release; the spool is the model's, so the engine takes
`vehicle.spool` to light and to die, the 2D game's feel); the stepped W/S throttle goes. Two tilt axes: `tilt` about x as today
(forward toward +z, away from the chase camera) and a new `bank` about z (toward +x, the chase camera's right). The thrust direction
is `d = (sin bank · cos tilt, cos bank · cos tilt, sin tilt)`, unit; the pose that maps the hull's up to it is `Rz(-bank) · Rx(tilt)`
(a node test checks the two agree). The verdict's, the flare's and the HUD's tilt are the TOTAL angle from vertical, `acos(d.y)`; the
flare eases the bank out as it does the tilt. Keys: `W` / `S` tilt forward / back, `A` / `D` bank left / right (held: rates, as A / D
were), `L` legs, `Esc` the skip; the arrows as W / S / A / D. The mouse: a floating stick, the 2D game's touch-pilot with the mouse
allowed: a press anywhere on the scene (not on a button) and a drag; the displacement from the press point past a `stick.dead` px
dead zone up to `stick.full` px is the rate, dx the bank rate (right is +x), dy the tilt rate (drag UP is forward: pushing the stick
away is the nose away); a ring drawn at the press point, the knob at the clamped displacement; release, blur or resize reset it. A
phone's rail is the same floating stick on the scene plus `BURN` (held), `LEGS`, `SKIP`; the throttle slider and the two tilt
buttons go. The harness's `landing('input', { throttle, tiltRate, bankRate, legs })`: the throttle is now HELD until the next call
(as the key is), `bankRate` beside `tiltRate`; `state().arrival.landing` adds `bank`. The story lab's status line names the new keys.
`vehicle.minThrottle` stays (the spool's tail still burns at least 0.2); fuel, the entries, the flare and the grades are unchanged.

Not changed: the approach, the override beat (its alarm, Isao's line, the hand-over under a plain fade), the chase, the reticle, the
HUD rows, the grades, the salvage, the gate's offer, `?landing`. Open for the owner: whether the signature should also precede an
automatic landing (today it does not), and the mouse's sense (a drag up is the nose away).

## 14. The owner's second look (2026-11-07): the side view, three controls, the hand-over in motion

Owner, with a still of a drifted flight low over the island's rim: "it is not working, as it is too easy for the user to entirely drift
and miss the landing zone, which makes no sense game-wise. there is also a display problem whereby being too close to the ground while
drifting reveals a secondary layer of ground mapping, perhaps the other side? 2) let's try this. a) we force a fixed camera view,
essentially making a temporary 2D game from our 3d Assets. It is a fixed camera angle with the large Black Hole in the background. b)
the user has limited controls, space bar for thrusters, A and D for the angle adjustement, we simplify the game to these three
variables. 3) small change but when transitioning from the thruster animation full screen to the 2D game, we want both the motion to
be already occuring and the boosters to be on, for continuity". Section 13's stick, bank axis and mouse go; its signature stays.

**A. The side view.** The flight is a 2D game again, in the plane the camera looks across. The camera's ANGLE is fixed: level, looking
along the island's ground toward the accretion disk (the world's `sky-hole` planes, `api.scene`, their `userData.hole.dir` turned into
the island's frame: the look azimuth), so the disk is the background of every frame (the brief's call 3, now met by design). Only its
POSITION moves, a dolly on that fixed line of sight: `camera.back + camera.backPerMetre × altitude` behind the rocket's ground point and
`camera.up + camera.upPerMetre × altitude` above the pad, the numbers chosen so the rocket and the pad share the frame from the entry's
altitude down to the contact (starting values back 20 + 0.95/m, up 10 + 0.5/m, fov 58; measured in the browser with the harness's
`view()` and re-priced). The flight frame is turned about the pad's up by that azimuth: the model's +x is the camera's right, the
model's z the line of sight, so the drift and the tilt read as screen motion; the host converts to island metres at its boundary
(`pose()`, the reticle, `landed`). The reticle stays on the ground under the predicted point. Off-island ground is the planet's sphere
as before; the camera never looks down at it from above, which is what showed the lattice under the rim.

**B. Three variables.** Space held is the burn (as section 13); `A` / `D` (and the arrows) tilt the rocket left / right in the camera's
plane, a held rate as before; `L` legs, `Esc` the skip. Nothing else: no W/S, no bank, no stick, no mouse. The bank axis leaves the
flight model, `src/fx/landing-stick.js` goes, the harness's `bankRate` and `lean` go, `state().tilt` is the signed tilt. A phone's rail
is `◂` `▸` `BURN` (held) `LEGS` `SKIP`. The entry is retuned so a miss is the player's doing, not the entry's: drift 4-7 m/s (was
8-12), tilt 0.15-0.25 rad (was 0.25-0.35); the rest of the entry as before.

**C. The hand-over in motion.** A flown landing has no approach rail from orbit any more: the signature's black opens directly on the
side view with the rocket already sinking and drifting at the entry's state and the boosters LIT. The flight begins when the signature
ends (or is skipped); for `override.seconds` (now 1.5 s) the auto-lander's last burn runs: the physics step with the throttle forced to
1, under the alarm, the annunciator and Isao's line; then MANUAL, where the burn follows Space. The flight shot (the fixed camera) is
started under the signature so the first visible frame is the flight. The automatic landing (START on a later run, `?landing=0`, the
acceptance suites without `?landing=1`) keeps the whole arrival sequence from orbit as today.

Not changed: the signature, the verdict, the flare, the touchdown, the salvage, the gate's offer, `?landing`, the touch rail's BURN.
Open for the owner: the entry ranges above; whether the camera should pitch down a few degrees so more ground shows under the pad.
