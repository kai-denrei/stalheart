# spherical-stalberg-grid — working notes for Claude sessions

Stålberg organic quad grid on a sphere, grown into a proto-game.
Five 3D tabs (grid / maze / organic / battle / heart) + an in-app docs tab.
Public: https://kai-denrei.github.io/spherical-stalberg-grid/ (Pages,
`max-age=600` CDN lag; the DEV LOG tab header shows the served build
token — the corner badge was retired from the game view).

## Orient first

- `.deban/` — decision log (decisions, dead ends, lessons). Read
  `_index.md` first. Sync it via /deban after meaningful sessions.
  It is gitignored: local working memory, never published.
- `DEVLOG.md` — per-commit technical log, newest first. Add an entry for
  every substantive commit (get the hash first, then append + commit).
- `HOW-IT-WORKS.md` — by-concept explainer. Both render in-app.

## Hard rules

- After editing any `src/*.js`, HTML, or CSS: run `./scripts/bust.sh --quiet`
  (rewrites `?v=` tokens incl. ES-module imports). NEVER put `?v=` on
  `../vendor/` imports — a tokened vendor URL loads a second copy of three.js.
  Bust output commits ATOMICALLY: stage everything it touched, never just
  your own files — a partial commit ships stale import tokens. A pre-push
  guard enforces this: `scripts/check-tokens.sh` fails on split tokens or a
  tokened vendor import, wired via `.githooks/pre-push`. Enable it once per
  clone with `git config core.hooksPath .githooks` (it's local config, not
  committed); run `./scripts/check-tokens.sh` by hand anytime.
- `npm test` = Node invariant suites (grid topology, dungeon, creatures,
  units). Keep green; they don't cover the render layer.
- THE SENTRY BOARD IS THE DEFAULT (roster 2). `DEFAULT_ROSTER_ID` lives in
  towers.js and roster.js applies the URL override — ONE default, stated once,
  because roster.js is DOM-aware and Node cannot import it: a default that
  lived only there would have the test suite running roster 1 while the game
  shipped roster 2. `?roster=1` still reaches the campaign (the "classic"
  button). Roster 1 is KEPT deliberately: ROSTERS exists to prove this tab is
  roster-agnostic, and with one table left that property is unexercised and
  rots. Flipping the default broke three suites, and each was a test naming no
  roster while asserting about one — tdcore and knobs now call `useRoster(1)`
  explicitly, and roster.mjs's "unknown board" rule says DEFAULT rather than 1.
- NO EMOJI, anywhere, ever (operator, 2026-09-06: the deep link's chain
  "stands out in a bad way"). The interface is built out of MONOCHROME
  dingbats — ⬢ ⬤ ✦ ⧉ ⇄ ♥ ⌖ ◉ ◈ ▮ ↗ ⊙ ↻ — and those stay; what is banned is
  anything a platform renders as a COLOUR pictograph, because one of those in
  a terminal-green HUD is louder than every deliberate thing on the screen.
  U+FE0F (the emoji-presentation selector) is banned with them: it is
  invisible in a diff and it is exactly how a dingbat silently becomes an
  emoji. `scripts/check-emoji.sh` enforces it, wired into `.githooks/pre-push`
  beside the token check.
- EVERY capture script kills its browser through `scripts/chrome-proc.mjs`.
  Do NOT `spawn` Chrome directly in a new script. On 2026-09-06 this machine
  reached 84% memory with leaked Chrome trees reparented to launchd, traced to
  these scripts: cleanup was one line on the happy path (`ws.close();
  chrome.kill()`), so any throw before it leaked the browser — and one did, an
  unwritable `--out` throwing EROFS. Three faults, all fixed in the helper:
  cleanup now runs on exit / SIGINT / SIGTERM / SIGHUP / uncaught / rejected;
  Chrome is spawned DETACHED so the whole process GROUP is signalled (killing
  only the top process is what orphaned its renderer and GPU children); and
  there is a hard watchdog, because a page that never loads used to hold a
  browser forever. The escalation to SIGKILL is a SYNCHRONOUS wait, not a
  timer — every caller exits immediately after killing, so a timer never
  fires and the first version of the watchdog reported a clean kill while
  leaving two live processes. Check for leaks with
  `ps -eo pid,ppid,args | grep -- --headless`.
- `#tab?a=1` AND `?a=1#tab` BOTH WORK NOW. `src/url.js` runs before anything
  else (before roster.js, which reads params during its own module evaluation)
  and lifts a fragment query into the real search string, search winning on a
  collision. Every tab reads `location.search`, so the hash form used to be
  silently ignored — the tab opened on its default and looked broken. That cost
  three debugging sessions (astro crew, shooting lab, units viewer) before it
  was fixed rather than explained. `test/url.mjs` pins the merge.
- `?enemy=<type>[:N][@D]` PUTS ONE ON THE BOARD NOW, beside the hull, alive, on the
  real path, camera in third person — for looking at a unit next to the tank at
  the game's own scale rather than on the viewer's turntable or after playing
  to its wave. IT SPAWNS AT THE PORTAL by default, where everything else on
  this board comes from — a boss that materialises next to the hull has
  skipped the entire journey the player defends against. `@D` is a ring D
  cells from the hull instead, for a close look. `?enemykill=1` kills what it
  spawned and reports whether the BODY left the scene: makeDebris read
  `material.color` straight, a ShaderMaterial has none, so it THREW inside
  killCreature before the scene.remove that follows — the boss died, no debris
  appeared, and the corpse stood on the board forever — it used to
  land on a neighbouring cell, which is a boss nobody has seen walk.
  `?enemy=jelly:1` is the boss.
  A UNIT'S `tick` TAKES ABSOLUTE TIME, not dt: the board calls
  `userData.tick(tNow + e.phase)`. The jelly took dt and accumulated it, so it
  added the whole elapsed time every frame — ~2 SECONDS of sine phase per
  frame — and the mass juddered. It looked like a bad animation; it was a unit
  disagreeing with its host about what the argument means. A unit that needs a special tint
  path declares `userData.setTint(hex|null)`; the board prefers it over writing
  `material.color`, which a ShaderMaterial does not have.
- Headless verification: Chrome with `--use-angle=swiftshader
  --enable-unsafe-swiftshader` (NOT `--disable-gpu`, it kills WebGL).
  Headless WITHOUT those flags uses the real M4 through ANGLE Metal
  (measured 2026-09-03: ~45 G sine-folds/s vs SwiftShader's 1.4) — that is
  the path for RENDERS, not for correctness runs: `scripts/cine-capture.mjs
  --url … --seconds N --fps 30 --size 1920x1080 --out renders/x` drives a
  scene that called `installCine` (src/cine/kit.js) one frame per
  `__cine.seek(t)` over CDP and encodes with ffmpeg; `#portal?bench=SIZE:FRAMES:STEPS:OCTAVES`
  times the wormhole at a full-frame pixel count; `?gl=1` names the GL.
  Console lines (e.g. the `?tick` state logs) only surface with
  `--enable-logging=stderr` — without it they're absent, not broken.
  Virtual time does not advance `performance.now()` → use the URL hooks:
  `?tick=N` (simulate N seconds), `?walk=N`, `?points=`, `?look=`,
  `?walltops=`, `?creature=`, `?spawn=`, `?view=`, `?devlog=1`, `?unit=`,
  `?tune=1` (opens the unit viewer's feel tuner), `?labels=1`, `?sweep=0`,
  `?fire=N`, `?tutstep=N` (clear N scripted tutorial pairs), `?log=roadmap`,
  `?perf=N` (TD: report draw calls / tris / points for one whole frame —
  set `info.autoReset=false` first; the minimap is a 2D canvas radar now,
  so the main renderer is the only WebGL context), `?layout=N` (TD: print every HUD box and every overlap —
  headless will not lay out below ~500px, it lays out wide and CROPS, so
  rectangles are the only trustworthy way to check a phone layout),
  `?cine=N` (park the cold open N seconds in — beats at ~1 / ~5 / ~7, and
  it HOLDS there so the still lands on the beat you asked for; `?cine=0`
  skips it), `?driveout=N` (TD: after the berths land, simulate N seconds
  of motion from the berth and log the cells reached — `?tick` runs at init,
  BEFORE the container model loads, so it cannot answer this),
  `?charge=0..1` (TD: park the wave clock inside the warning window —
  `?tick` drives motion, NOT the wave scheduler, so winding it forward
  leaves the countdown where it was),
  THE SHIELD IS ON **T** (Tate, 盾), not S. S is REVERSE — it lives in
  `CTL_DRIVE_KEYS` beside w/a/d — so the shield spent a charge every time the
  player backed up. A grep for `k === 's'` finds nothing and says the key is
  free: the drive keys are read through a MAP, not a literal, so a binding
  conflict is invisible to source search. `?keyprobe=1` dispatches REAL
  KeyboardEvents and reports what each key actually moved, which is the only
  way to ask. Third person kept `3` and `v`; it lost its `t`.
  the SHIELD: `?shield=N` (ignite the bubble for N seconds), `?shieldrack=N`,
  every `SHIELD_TUNE` knob by name (`?coolSecs=`, `?tapOutage=`, `?shoveCells=`
  …), `?shieldprobe=1` (the ladder as log lines: the cap, one S chain with the
  SEAM refusing in the middle, the tower tap going offline and coming back,
  the heart pad's budget running dry and refilling — add `&stress=6:0` for
  beat C, which needs a slow tower), and `?shoveprobe=1` (a hard core into a
  shielded hull: thrown out of its lane, back in it, hull and ram combo
  untouched). The seam is INVISIBLE to a screenshot — a shielded tank and a
  cooling one differ by a greyed pip — which is why the probes are the
  deliverable. Mind what freezes a probe: `advanceMotion` returns early on
  `player.next === -1` and `driveFrozen` is `(shotActive() && !dirShot) ||
  tutorial.frozen`, so clearing `paused` alone leaves `simTime` at 0.00 and
  measures a frozen game — `?shoveprobe` clears all three itself.
  the MINES: `?mines=N` (rack size), `?minelay=N` (lay a row ahead and leave
  it standing — the only way to photograph a field, since the probe blows
  everything it lays), `?minearcs=0` (hide the red fan), `?mineprobe=1`
  (three beats: a row from the front — ONE trip and no chain is the correct
  answer, a claymore's arc points away from the row behind it; the same row
  from behind for the chain; the hull in front of its own mine for the
  friendly fire),
  the RESCUE mission: `?mission=rescue` (the seam every mission hangs on),
  `?survivors=N`, `?lasers=1` (refit the secondaries — they are stripped by
  default, and that is the mission's load-bearing number),
  `?rescueprobe=1` (drive-by at speed, the phone's drive-by with the lever
  at zero, the stop, both seats, delivery, the end card),
  the missions are SELECTABLE now — three buttons in the tab bar's play group
  (TD / rescue / raid, `data-mission` on each) and three cards in the home
  launcher; a mission is read once at boot so those are NAVIGATIONS built by
  `paramLink`, and the empty string is what clears it back to the campaign.
  `?tabprobe=1` logs every tab button with its mission and whether it is lit —
  the tab bar collapses behind ☰, so a screenshot cannot show this.
  RESCUE 2, the raid: `?mission=rescue2` (a LARGER board — it sets points
  1600 / rooms 26 unless the URL already named them — every sector open, no
  waves at all), `?camps=N`, `?garrison=N`, `?rescue2probe=1` (shut out of
  range, open inside it, the doors, the emerge, the walk home, the run-over
  and its splash, the end card), `?campgo=N` (park the hull just inside camp
  N's shot distance and LEAVE it — the probe blows through the sequence in
  one tick, so this is the only way to photograph an open container with
  people walking out of it; it fires at t+5 s, AFTER the berth deploy, which
  drives the hull and would undo it),
  `?hangprobe=shot|deploy` (TD: deliberately stall one of the two machines
  that OWN the camera — freeze the cold open's clock, or take the drive speed
  to zero mid-deploy — and report whether the game gets itself back. This is
  the failing test for the recurring "stuck in neither 3rd person nor top
  view" report; without it the liveness checks are a claim, and it caught the
  first cut writing `Infinity` for a zero-speed deploy, which made the one
  case the check exists for the one case it could never catch),
  `?modeprobe=1` (TD: press the shell's DRIVE/BUILD switch four times with
  REAL pointer events — `.click()` skips them, so any capture-phase handler
  that swallows a pointerdown is invisible to a probe and lethal to a thumb),
  `?viewlog=1` (TD: every setView transition with its caller),
  `?vpbias=<offsetTop>:<height>` (TD: PRETEND THE BROWSER IS EATING THE
  SCREEN — a desktop cannot produce a `visualViewport` that differs from the
  canvas, so the camera correction that matters most on a phone could
  otherwise only be tested on the device that reports the bug) with
  `?vpprobe=1` (report the tank's screen y and whether it is inside that
  band). THE CANVAS IS NOT WHAT THE PLAYER SEES: `innerHeight` includes the
  strip behind the browser chrome, so a rig that frames the tank a third up
  the CANVAS can land it below the fold — drawn, in frustum, right size, and
  invisible. `applyViewportBias` pitches the camera by the angle that moves
  the target from the canvas centre to the VISIBLE band's centre; it is
  exactly zero on a desktop and headless, which is why it can ship without a
  device. `chrome` is now an ACTIONABLE verdict in `viewWatch` for the same
  reason — before the bias, re-seating put the tank back in the same
  invisible strip.
  `?tankseen=1` (TD: CAN A PERSON SEE THE TANK, once a second — not "is it in
  the frustum", which is what the view watchdog used to ask and what four
  camera fixes answered while the reports kept coming. It separates
  behind / off-canvas / under the browser chrome / covered-by-<element> /
  too small, and the same verdict is now the DIAG panel's FIRST line, so one
  phone screenshot says which. Headless can model neither `visualViewport`
  nor `env(safe-area-inset-*)`, so a desktop replica can only ever return
  `ok` or a pose fault — which is precisely why the phone reports outlived
  the replica).
  the SNIPER (`#sniper`): `?spawn=N` (N inbound enemies at load — the SPAWN
  button / E key does the same), `?closeup=0` and `?scan=0` (the spotting
  monitor and the PPI), `?phase=calibrate|contact` (phase 1 is a
  black-and-white target and a fixed string; phase 2 is movers), `?allotted=N`,
  `?moverSpeed=`, `?showRifle=1` (you do not see your own rifle down your own
  scope — the camera sits AT the optic, inside the receiver), and
  every `BALLISTICS_TUNE` knob by name (`?zero=`,
  `?wind=`, `?muzzleVel=`, `?gravity=`, `?drag=`, `?swayFast=` …), `?mag=`,
  `?range=`, and the ASSIST LADDER — `?rangefinder=1`, `?windRead=1`,
  `?firingSolution=1`, `?autoHold=1`, each one a chip Isao has not printed
  yet (docs/AUTOMATION-ARC.md). `?sniperprobe=1` fires the same target twice,
  with no hold and with the HUD's own solution, and reports where each landed
  — the whole promise of the mode is that those two numbers come out of ONE
  integrator, so the probe is the thing that keeps them honest.
  the SENTRY RANGE (`#sentry`): `?family=needle|rotor|kiln|quiver|lancer|relay`,
  `?tier=1|2|3`, `?count=N` (a battery, on a ring), `?mount=N` (on a wall —
  and mind the DEAD ZONE it buys: the range's `elevMin` is -35, not the
  workshop viewer's -10, because the trunnion sits ~1.4 units up and at -10
  even a floor-mounted gun is blind out to 7.9 units. The HUD prints the
  blind radius and the ground draws it in red), `?mode=waves|pop`, plus every knob in `SENTRY_TUNE` by name (`?tolerance=25`
  makes it miss, which is the point of the knob), and `?sentryprobe=1` — the
  error falling, the rounds leaving and the targets going down, once a second.
  ELEVEN families now (railgun / howitzer / mortar / plasma / heptapod_a6
  added). A LOB (`lob: true`, `arcCells`) points UP, not AT: the barrel angle
  is `lobAngle(range, arc)` = atan(4h/d) from the shell's own parabola, so
  tube and round are one number apart — and it needs its own ceiling (85°,
  not the envelope's 65, which was silently eating twenty degrees). The round
  flies the ground BEARING taken from the boresight (so a shot fired mid-slew
  still misses), DESCENDS along the path to the impact height (leave that out
  and every shell hovers at muzzle height and misses by exactly that), and
  the parabola is added to the DRAWING only — an arc that moved the path
  would make the picture change the accuracy.
  Models are the Sentry Workshop's, vendored to `assets/models/sentries/`
  under their own name contract: `ROOT→BASE→YAW→PITCH→RECOIL`, `MUZZLE_nn`,
  and six material names. `?tabprobe=1` also lists this tab.
  Each family has a VOICE (`SENTRY_FAMILIES.fire`, plus `ready` for the
  Rotor's minigun spin-up, which plays on the ENGAGEMENT EDGE and not per
  round) — `?voiceprobe=1` logs every sound call with its count, since
  headless cannot hear. The QUIVER is the Javelin: `missile: true` means it
  LOCKS before it fires (`?lockGate=`, `?lockTime=`, `?lockBreak=`, in
  degrees of drive error) and what leaves the tube then homes —
  `src/lockon.js`, the same tune the sniper lab uses, put through
  `scaleMissile` into model units. Fire-and-forget: the lock drops the
  instant a cell is away, or one launcher empties itself into one walker
  while the wave goes past.
  A LASER HUGS THE PLANET. The lance is drawn AND measured along a great
  circle at the muzzle's own radius (`arcPoint` / `projectToArc`, arc.js), not
  as a straight world chord. A great circle IS the straight line on a sphere,
  so nothing bends that should not — but a chord across the lance's seven
  cells dives 0.49 CELLS below the surface at its midpoint, which is what
  "the beam pierces the curvature" looks like. It was not only cosmetic: the
  sag is 0.0389 against a hit radius of `cellSide * 0.5` = 0.04, so a body
  standing on the ground at mid-range sat 97% of the way out of a beam the
  picture showed going straight through it. test/arc.mjs pins those numbers.
  `src/shotfx.js` OWNS WHAT A SHOT LOOKS LIKE IN FLIGHT — the tracer, the
  slow-field bolt, the seeker cone, the ballistic `arcLift`, and the board's
  LANCE_LOOK / THROW_LOOK. These were private to td-tab's closure, so the
  shooting lab could only REIMPLEMENT them, and a reimplementation drifts: the
  Mortar flew straight in the lab while the game arced it, the Relay drew
  nothing, the Plasma looked like a different weapon. Both the board and the
  lab call these builders now, so the lab's baseline IS the game — which is
  the only thing that makes a tuning lab worth having. They BUILD and return;
  the caller owns the lifetime, which is the one thing the two really differ
  about. Sizes are explicit arguments because the board is a unit sphere with
  cellSide 0.08 and the lab is in metres: the same object at two scales.
  the SHOOTING LAB (`#impact` — the route keeps its old name so existing deep
  links work; the tab reads "shooting"): ONE WEAPON, END TO END. Muzzle, then
  FLIGHT (`?showShot=0` to hide it), then impact, for any of the sixteen
  families. The flight is drawn from the same `weaponKind` the board and the
  sentry range read — lance / throw / round / lob / seeker / field — so a
  weapon cannot be light in one tab and a bullet in another. The MACHINE is
  articulated off the Workshop's contract (YAW / PITCH / RECOIL / ROTOR /
  MUZZLE_nn): only a rotary spins, recoil is a decaying spike, and a beam
  barely kicks because nothing leaves it. `?curveR=12.5` puts the whole thing
  on the BOARD'S OWN CURVATURE (12.5 = 1/cellSide) — a lance fired seven cells
  across a sphere is fired over a horizon, and a flat stage quietly answers a
  different question. `?impactprobe=1` also reports the rig and samples its
  MOTION, because a still of a spinning barrel and a stopped one are the same
  picture. The BEAM lab stays separate on purpose: it tunes the TANK's
  secondary (ranks, burn-through, sweep, toe-in), which this stage cannot ask
  about.
  the IMPACT lab is the SENTRY FX WORKBENCH: pick a sentry, tune its muzzle
  and its impact, export the result as the default. `?sentry=<key>` selects
  one of the 16 (both rosters), `?slot=muzzle|impact` picks which half the
  knobs edit, `?recipe=profile` (the default) fires that family's own recipe
  rather than a generic one, and the EXPORT button emits the exact source of
  its entry in `src/sentryfx.js` — paste over it and the tuning is the
  default. Only DELTAS from `IMPACT_TUNE` are written, so a family that never
  overrode a knob keeps tracking the base when the base moves. WHAT A WEAPON
  LOOKS LIKE LIVES IN `src/sentryfx.js`, not in towers.js: `projPx`, `trail`,
  `projSpeed`, `beamColor` and `plasma` moved there, and `test/sentryfx.mjs`
  FAILS if a tower def grows one back — towers.js keeps what a weapon does
  plus `color`, which is identity, and `shape`/`spin`, which are the body.
  the IMPACT lab (`#impact`): WHAT A HIT LOOKS LIKE. `src/impactfx.js` holds
  seven families (spark / flash / ring / scorch / debris / splash / ember) and
  four recipes (`shell` / `laser` / `plasma` / `light`); the tab fires them at
  a wall you can angle and re-material. `?recipe=`, `?source=tank|sentry`,
  `?surface=armour|rock|hull`, `?wall=0`, `?wallAngle=`, `?size=` (ONE number
  scales a whole hit — the same effect serves a 3-unit wall here and a cell on
  the sphere), `?slow=` (an impact is 400 ms; without a time scale you cannot
  see one), `?auto=0`, `?trail=0`, every `IMPACT_TUNE` knob by name, and
  `?impactprobe=1` — which fires one of every recipe and then checks at 1 s
  that they are still running and at 6 s that they all returned false and were
  reaped. A particle effect cannot be checked from a still: a spark shower and
  a dead emitter are the same photograph one frame after the flash.
  EVERY EFFECT IS AUTHORED IN LOCAL SPACE with +Z along the surface normal, so
  `orientImpact(obj, point, normal)` is the only place a basis is derived —
  three call sites deriving their own is three chances to pick a different
  sign convention. The lab uses the game's light rig AND the board's sky as an
  environment: a metal plate with nothing to reflect is black under this rig,
  and a black plate makes every effect look good, which is the wrong
  instrument.
  every LAB's deep link: the ↗ button copies the tab's current panel as a
  URL and writes it into the address bar (astro / metal / beam / portal /
  cine; the units viewer has had its own since before this). Only what
  DIFFERS from the defaults is written, colours lose their `#` (one in a
  query truncates the link at the first colour), and one-shot flags are
  stripped — `src/deeplink.js`, `DROP_KEYS`. `?dlprobe=1` presses the button
  on whichever lab is open and logs the URL, which is the only way the
  round-trip gets checked.
  the ASTRONAUT study's CREW WANDER: `?path=crew` puts two astronauts on a
  ring of three stations — the tank's flank, a turret, an open container —
  walking and running between them and DISAPPEARING inside the container.
  `?crew=N`, `?runMul=`, `?dwell=`, `?crewSeed=` (NOT `seed`, which is the board’s), `?turret=0`, `?cargo=0`, and
  `?crewprobe=1`, which logs every leg with its gait AND its route verdict.
  THE STAGE IS SOLID: the tank, turret, container and dish are discs on the
  ground derived from their own bounding boxes, and the walkers route around
  them (`?showSolids=1` draws them). The dish is bounded by its PEDESTAL, not
  its reflector — an antenna is overhead, and bounding it by the dish would
  wall off a third of the yard. BOTH ENDPOINTS of a leg are exempt: the props
  stand at their stations, so a walker leaving the turret is inside the
  turret's own disc by construction and the planner spends the leg escaping a
  building it is already in. The probe SAMPLES each route against every disc
  rather than counting waypoints — a path can have seven waypoints and still
  clip a hull, and that is what caught the missing origin exemption. The sequence is the
  feature and a screenshot cannot show it: measured over 100 s the mix is
  ~10 walks to 9 runs, alternating with streaks of two to four. ONE CLIP,
  TWO GAITS — the file carries a 1.03 s walk and nothing else, so a run is
  that cycle at higher cadence over a longer stride, and cadence rides WITH
  the stride (`setCadence`, units.js) or the feet skate. Params go in the
  SEARCH, not after the hash: `/?path=crew#astro`.
  the ASTRONAUT study (`#astro`): `?tankLen=` and `?personH=` in metres (the
  ratio is the study's whole output and the HUD prints it), `?path=perimeter|
  straight|spot`, `?clear=` (metres of daylight on the lap), `?outline=`
  (the cast's blueprint edges — 0.22 is the cinematic's rim; at the game's
  0.85 a dressed hull reads as a paper cut-out), `?exposure=`, `?env=`,
  `?dist=`/`?az=`/`?el=` (dist is DERIVED from tankLen unless given),
  the mobile shell's own: `?mobile=1|0` (force the shell on/off — a headless
  run is never coarse), `?goto=1`, `?mobbuild=1` + `?pin=1` (with `?layout`:
  enter BUILD through the button, pin a caption + Isao), `?tapprobe=1`,
  `?pressprobe=1`, `?modalprobe=1`, `?wake=1`, `?tier=phone|desktop`,
  `?sw=0`, `?whatsat=x,y` (name the element stack under a point),
  `?coarse=1` (apply the phone's coarse-pointer CSS headless), `?coach=1`,
  `?stickprobe=1`, `?stateprobe=1` (the boot's state every 2 s — run it
  through `scripts/headless-wait.mjs --url … --seconds N`, a REAL-TIME
  headless runner: `--virtual-time-budget` stops the frame loop's clock
  after the first moments, so a cold open, a deploy or a countdown
  replicates wrongly under it),
  `#cine?govprobe=1` (log the device calibration and the wormhole size the
  governor fit; `?fps=N` target, `?gov=0` off, `?t=N` park, `?tier=cinema`),
  `#units?unit=X&export=1&dump=1` (reverse-export the unit as the game
  dresses it: the .glb arrives as `GLBCHUNK i/n <base64>` console lines —
  reassemble from stderr; the EXPORT button in the viewer downloads it),
  `#tabname`.
  Headless clamps windows to ~500px wide and CROPS screenshots — for
  layout bugs, log `innerWidth` from the page before touching CSS. And
  headless=new keeps ~87px of its own bar: `--window-size=908,505` gives a
  908×418 viewport (a phone's), `844,477` gives 844×390 — the `?layout`
  line prints the real viewport; rule against THAT, never the window.
- THE HACK OVERLAY ON A PHONE. `?hack=hdt|bridges|shikaku` opens it and
  `HACKFIT` logs the fit; `?hackrot=0|1` forces the TURN off/on. The three
  games differ and the turn is PER GAME (`HACK_LANDSCAPE`): HDT is a wide
  circuit board and fills a landscape phone at scale 1, so on a portrait
  phone it is rotated 90° and given the long axis at 1:1. The two pazorukore
  puzzles are squarish boards with side panels — handed a 2:1 viewport they
  clip their own grid INTERNALLY, which the iframe cannot detect (the child
  reports no overflow, it simply lays out wrong) — so they stay upright. The
  ↻ TURN button overrides either way and resets when the game changes.
  `body.hacking` hides `#chrome-toggle`: the ☰ is a child of <body> and the
  overlay a child of the tab, so their z-indexes are in different stacking
  contexts and never compare.
- A `@media (pointer: coarse)` rule cannot be exercised by any desktop
  browser, headless included — pair it with a width clause
  (`, (max-width: 560px)`) or the rules inside are unverifiable and can
  silently do nothing. The TD tab has the inverse tool: `?mobile=1&coarse=1`
  rewrites the coarse media conditions in the loaded sheets so the ruler
  measures the phone's blocks for real (a phone screenshot found the radar
  over the console while `?layout` said 0 overlaps — measure with `?coarse=1`
  BEFORE trusting a shell layout). Also mind source order: `#td-tut`'s base rule is
  declared after the mobile blocks, so an override up there loses.
- TWO TOWER ROSTERS, ONE TAB. `towers.js` holds `ROSTERS[1]` (the campaign,
  untouched) and `ROSTERS[2]` (the sentry board: Rotor / Plasma Thrower /
  Quiver / Relay / Mortar / Lancer / Howitzer, each naming a GLB in
  `assets/models/sentries/`). `TOWERS`/`TOWER_BY_KEY`/`TOWER_ORDER` are
  exported `let` — LIVE bindings — switched once by `src/roster.js`, which
  must be main.js's FIRST import so it runs before td-tab's module body.
  `?roster=2` selects it; the TD2 tab button is a navigation, like a mission.
  `?rosterprobe=1` waits for the look's preload and then reports every tower
  with its model and whether it fell back to a braille mast. `?a6=1` places a
  HEPTAPOD A6 and logs its loop once a second (it clears the landing brief
  first — the board starts `paused` and a probe that does not will measure a
  frozen game and report a frozen unit). A tower's sample is `towerSound(def)`,
  NOT `tower_${key}` — the second roster's keys have no samples of their own.
- The A6 takes ORDERS and can DIE. `postWalker(ci)` moves its berth — the
  "post A6 here" item on any empty buildable cell's radial, free, not a build
  (nothing printed, nothing queued: the machine simply walks) — with a marker
  left on the cell, because an order you cannot see is one you give twice.
  `hullHp` contacts from the not-rammable tier kill it (`killWalker`: wreck,
  burst, removed from towers/towerByCell/scene, no refund, no run-ending
  consequence). Probes: `?a6post=N`, `?a6kill=1`, and `?a6ram=1` — which
  walks the MACHINE onto the enemy, because an enemy's position is recomputed
  from its cell path every frame and planting one on the A6 lasts one tick.
- The A6 targets ONLY the not-rammable tier (a rocket spent on something the
  tank could have run over is the board's worst trade), LOCKS before it fires
  (`ctx.ready` in heptapod.js — a gate that costs time, never rockets; the
  state says `lockon` so a HUD can explain an aimed machine that is not
  shooting), and throws lockon.js SEEKERS rather than the board's homing shot
  — the top-attack arc IS the weapon. Its ammo is diegetic: a lamp at each
  MUZZLE cell, extinguished as the cell is spent. Not the Workshop's own
  readiness rings — those do not survive `mergeByMaterial`, the muzzle
  empties do (they are the articulation contract).
- The A6 (`src/heptapod.js`, roster 2 slot 8) is the only tower that is not a
  position: patrol a leash around its berth → engage → empty a 6/8/10-rocket
  cassette → walk home → reload. Going home is unconditional, or the magazine
  is decoration. Arc length in radians throughout, so `cells * cellSide`
  compares directly. Its `Walk` clip runs for real: the sentry look merges
  everything the CLIP DOES NOT TOUCH (pivot names read off the animation's own
  tracks, never guessed from names), so the 24 leg joints stay articulated and
  the hull collapses — 70 draw calls against 89 fully unmerged and 4-5 for a
  static tower. Legs run while patrolling / engaging / returning, stop while
  firing and reloading (`userData.setGait`). `applyTowerLook()` runs AT BOOT:
  it used to be reachable only from the panel and `?towerlook=`, so a board
  whose default look has async assets never started the load and every tower
  stayed a braille fallback forever. `?alltowers=1` places one of each and
  says whether any fell back, and prints each tower's LIGHTNESS SPAN — a
  model whose materials all sit at one lightness arrives as a pale mass
  however good the mesh is. `tintModel` with no `shades` does a wash and
  nothing else, and `def.color` for these towers is near-white, so a flat
  0.28 emissive of it drowned a dark model in a dark scene. `SENTRY_TINT`
  (towerlooks.js) is the ladder, keyed to the Workshop's own six material
  names, with Signal / Identification as the glow surfaces via `tintModel`'s
  new `glow` option. The A6 does NOT bob — the clip is the walk — and it
  FACES its heading (basis `up × forward, up, forward`; the models are +Y up,
  +Z forward), with the leg cadence scaled by its measured ground speed. Never address a
  tower by a literal key (`'single'`) — use `starterTower()` or find it by
  `attack`; a literal is a call site that silently does nothing on one board.
- A `?v=` token is part of the module URL, so `./x.js` and `./x.js?v=ab` are
  TWO modules and the browser loads both. ~27 pure modules are already split
  that way (wasted bytes, no bug); for a module with mutable state it is a
  silent correctness bug — the write lands on the copy nobody reads, which is
  how the second roster first came up as the campaign. `bust.sh` only UPDATES
  tokens, never adds them, so an untokened import stays untokened forever.
  `check-tokens.sh` now fails on a split import of any module exporting `let`.
- TD2 towers keep the Workshop's AUTHORED palette (`dressSentry` in
  towerlooks.js) — NOT `tintModel`, which re-hues every surface to the
  tower's colour and is built for the mkcx tank's four muddy olive materials.
  Applied to a palette that was already good it returned a monochrome
  machine, which is why the lab looked better than the game. The identity
  colour is spent only on the SIGNAL / IDENTIFICATION indicator surfaces.
  The board is a darker room than the lab's three-light studio, so the
  authored colours get a x1.35 lift and a faint emissive of their OWN colour.
- A tower wears the Workshop EQUIPMENT TIER matching its upgrade tier
  (t1/t2/t3) — the detail already existed and was being thrown away. Tier 1
  loads up front and the rest lazily (24 models is ~4 MB); a tower wears the
  best tier it has bytes for and starts the load for the one it wants.
  `?towertier=1|2|3` pins one, `?towerscale=` sizes them (default 0.72 —
  detail reads better small; a bulky machine looks moulded, a small one
  machined). `?alltowers=1` prints TRIANGLES, because a merged model has one
  mesh per material however much geometry is in it and the mesh count cannot
  tell a Base tier from a Maximum one.
- TD2's towers use the SENTRY LAB's answers. The look keeps the Workshop's
  pivots through the merge (`mergeByMaterial(scene, ['YAW','PITCH','RECOIL'])`)
  and exposes `head`/`pitchNode`/`recoilNode`/`muzzles`; `aimTower` drives yaw
  and elevation at `SENTRY_TUNE`'s own rates (degrees/second, not a lerp — a
  proportional ease is fastest when it is most wrong), clamps to the envelope,
  measures elevation FROM THE TRUNNION, and carries the one negation
  (`pitch.rotation.x = -elev`). Shots leave a real `MUZZLE_nn` and kick RECOIL.
  The lab owns how a turret MOVES; towers.js still owns what it moves toward.
- PLASMA and LANCE share one beam engine (beamfx `createBeam`, board preset) —
  the thrower is wide, jittery, and thrown DOWN onto a body six times a
  second; the lance is thin, straight, and held for one long burst along the
  ground arc, piercing everything on the line. A lance is NOT stopped by
  terrain (it stands on the high ground and shoots over it — keeping the
  tank's wall-march killed it half a cell out on its own wall), it measures
  `off` on the UNIT sphere (or an enemy pays for its altitude out of a 0.04
  hit radius), and it takes its bearing FROM THE MUZZLE, not the cell centre.
  A LOBBING TOWER (`def.arc`) elevates to the ballistic launch angle rather
  than the line of sight — the two differ by seventy degrees, and the mortars
  were aiming DOWN at things they were lobbing over. Same derivation as the
  lab's, from the same `arcH` `spawnTowerShot` flies, with its own 20–85°
  envelope. The QUIVER's seeker is a cone pointed along its velocity, not
  `makeBulletCloud` (which is the board's idiom for a ROUND and read as
  "half-dotted" on a Javelin).
  The LANCE is a straight ray in the WORLD: it leaves the muzzle's real
  position (`towerMuzzle` records the barrel it used), runs toward the
  target, and is stopped by terrain via `rayToTerrain` — walls and ground
  stop it, enemies do not, and it damages every body within a hit radius of
  the SEGMENT (`distToSeg`, not `projectToArc` — it is a line through the
  world, not an arc across the surface). Its own cell cannot stop it (a gun
  does not shoot its own parapet) and terrain needs a quarter-cell of
  clearance before it counts (enemies stand ON the ground, so a beam aimed at
  one is at ground level when it arrives). It fires only when the drive is
  within `SENTRY_TUNE.tolerance`. Do NOT aim it with the muzzle empty's world
  +Z: measured, that disagrees with the bearing to the target by 2° sometimes
  and 42° at others — the Workshop's contract covers the muzzle's POSITION
  and the ROOT→BASE→YAW→PITCH→RECOIL chain, not an empty's local axis.
  The lance is GREEN, thin and jitter-free (`def.beamColor`, separate from
  `def.color` so a laser can have a colour without repainting the machine;
  `LANCE_LOOK` vs `THROW_LOOK` — a thrower is a spray of matter, a laser is
  light). The QUIVER fires the sentry lab's own seekers (`attack: 'seeker'`,
  `lock: true`) — lockon.js through `scaleMissile` into unit-sphere radians,
  locked with the DRIVE's error in degrees, fire-and-forget. A seeker's
  ground cull sits a third of a cell BELOW the surface: a top-attack round
  dives onto something standing on the ground, and culling at exactly 1.0
  killed three in four while they were still closing.
  `?plasmaprobe=1` reports beams lit, whether the throw descends, every rig's
  yaw/elev/recoil, how many bodies a lance went through, and each Quiver's
  lock plus the seekers hit/lost tally.
- maze/organic/battle/heart tabs are ~900-line siblings (cp+sed lineage).
  When batch-patching them: anchor on CODE lines (comments drift first),
  assert per file, treat a mid-script abort as the designed outcome.
  Extraction of a shared board core is named debt — deferred while the
  tabs still diverge.
- Derive render-coupled values (camera facing, turret aim) FROM the
  render transforms (`getWorldQuaternion`), never re-derive with your own
  sign conventions. three.js lookAt: plain Object3D faces +Z, cameras −Z.

## Outside resources

- `~/Dev/Braille` — the dot-cloud shape lab these models come from
  (`fun-shapes/index.html`, ~200 generators). Same idiom as `creatures.js`:
  a function returning `[x,y,z]` / `[x,y,z,1]` points ending in `fitUnit`.
  Porting = copy the generator + its primitives into `src/braillelab.js`
  and add the name to `BRAILLE_SHAPES`. Copy VERBATIM; the lab keeps
  improving and re-porting should stay mechanical.
- `~/Dev/onkochishin` — a gallery of UI studies (`atelier/<name>/index.html`,
  each self-contained). `atelier/hud-targeting` is the fire-control HUD the
  sniper's readout is built on, on the operator's steer: corner readouts
  carrying only TWO borders each so they read as brackets, a two-tier
  label/value `field`, and the palette (`--cyan #5fe6d6`, `--lock #ffb43d`,
  `--alarm #ff4d4d`, `--phosphor #e8f4f2`). Rebuilt in our own CSS rather
  than vendored — the study is a reference, not a dependency.
- `~/Dev/blueprint-to-life` — sibling repo. Source of the `cb-badge`
  cache-bust toolkit we share, the blueprint/callout idiom behind the unit
  viewer's `labels`, and a **solved** service-worker + cache-bust pattern
  (copy it rather than re-deriving when the PWA item comes up).

## Architecture in one breath

Pure math modules (`grid.js` sphere pipeline, `dungeon.js` BFS carve +
open-field variant, `creatures.js` Braille dot-clouds, `cellindex.js`
voxel-hash) are DOM-free and Node-tested. `units.js` + `looks.js` are
data-driven factories (unit kinds cloud|mesh; looks own all colors, incl.
zonal fields). The grid plays four roles — geometry generator, collision
oracle, semantic map, AI nav-graph — and only kinematics is decoupled:
manual mode is free movement querying `cellindex` for collision; auto
navigates the graph; handoff eases via `virtualStart`. Manual defaults to
rolling forward (mobile ergonomics); who-controls is binary and shown in
the HUD.

## Conventions

- Deterministic everything: mulberry32 streams from `params.seed`;
  no `Math.random` in game logic.
- Serve: `npm run serve` (python http.server :8144 — often already
  running in the background from a prior session).
- Commits: explain the why; end with the Co-Authored-By + Claude-Session
  trailer; push to `origin main` (repo: kai-denrei/spherical-stalberg-grid).
- Telegram the operator (see ~/CLAUDE.md) on milestones, not chatter.
