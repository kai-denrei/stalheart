# Dev Log

Newest first. Each entry: what landed, then how it works, for programmers.

## 140ae57 — the sentry range's beam: 0.33 pixels, not a shader fault

The range's lance and throw are on the board's beam now. They had been a
doubled `THREE.Line` and a spray of `Points`, standing in for beamfx's
`createBeam`, which "rendered nothing in this scene".

**The diagnosis, and why two earlier ones missed it.** Both previous passes
verified the inputs — the geometry has 386 vertices and an `aU` attribute, the
uniforms read back correct, the program compiles, no GL error — and concluded
the shader was at fault. But "it renders nothing" is three separate failures:

1. never submitted (culled, hidden, not in the graph),
2. submitted and covering no pixels,
3. submitted, covering pixels, shaded to black.

Checking the inputs distinguishes none of them. Two measurements do.
`onBeforeRender` fires once per mesh per render pass, so counting it splits (1)
from the rest — it reads 600/s, identical to a control `THREE.Line` on the same
endpoints. And the ribbon's width projected onto the canvas splits (2) from
(3): `glowWidth * 2 / (2 * dist * tan(fov/2)) * canvasHeight`. It came to
**0.33 px**.

The cause is scale. The board's lance glow is 0.0041 world units — about a
twentieth of a cell — and the board watches it from roughly six cells away.
The range is metre-scale with its camera ~29 units out from a yard whose cell
equivalent is well under one unit, so the identical construction lands under a
pixel. Everything about it was valid; it simply had no area.

**The fix.** `shotfx.makeBeamShot(from, to, color, kind, { glowWidth })` — the
board preset, the shared `LANCE_LOOK` / `THROW_LOOK`, the board's five links,
its muzzle-to-target taper (normalised so the argument means the beam's widest
point), and caps on the two real ends only, because an interior cap pinches the
beam into a string of beads. The width is an explicit argument in world units.
That rule is already in shotfx's header for every other builder in it; the
range's beam predated the rule and was the last place deriving a size from
another scene's cell.

**A second bug fell out of it.** `stepBeams` faded a beam with
`material.opacity`, which does nothing on a `ShaderMaterial` — and beamfx's own
`update()` rewrites `uAlpha` from its burst envelope, so even a correct fade
set before it is discarded. `makeBeamShot` holds the fade and re-applies it
after `update`. `test/beamshot.mjs` pins that, the lance/throw ratio, the cap
placement and the link chaining.

**The instrument stays.** `?beamprobe=1` prints draws-per-second and the
projected pixel width: `draws=600 px=5.0` now, `draws=600 px=0.33` before. Both
numbers are needed — either alone reads as a healthy beam.


## df1364a — jelly: shelved, and the shelf is a flag

The mass is out of the wave programme and still in the units roster. The
interesting part is how, because there were two ways to do it and the obvious
one destroys a test.

The obvious way is to delete `{ wave: 16, type: 'jelly' }` from `INTROS`. That
also breaks `tdcore`'s "every spec type has an intro" — a real invariant, and
the failure is correct: `ENEMY_SPEC.jelly` now exists with nothing introducing
it, which is indistinguishable from a unit somebody forgot to wire up. Relaxing
the check to make the failure go away would have thrown away the only thing
that catches a forgotten unit.

So shelving is DATA: `shelved: true` on the spec. The invariant now reads from
both ends — an unshelved spec must appear in `INTROS`, and a shelved one must
NOT. A shelved unit cannot decay into a forgotten one, because the flag is
asserted in both directions.

The flag then has to be honoured wherever the roster is DERIVED rather than
listed. Three sites build their enemy list from `Object.keys(ENEMY_SPEC)`
filtered on `rammable`:

- `rescueWavePlan` (the rescue mission's waves)
- `spawnGarrison` (the raid's camp defenders)
- `REAL_TYPES` (the sniper range's movers)

All three are written that way on purpose, so a new enemy joins them the day
it is added. That property is symmetric and nobody had needed the other half
before: an unfiltered shelf would have left the jelly absent from the campaign
and present in both missions and the range — "not in the game" in the one place
it is easiest to check and nowhere else. This is the general hazard with a
derived roster: adding is automatic, and so is failing to remove.

`wavesPerSector` returns to 15. It only moved to 16 to give the sector a boss
ending, and `typesByWave` caps at the intro count, so a sixteenth wave now
introduces nothing and repeats the fifteenth.

Restoring the boss is two lines: uncomment the intro, set `wavesPerSector`
back to 16. `?enemy=jelly:1` still spawns it at the portal in the meantime,
and `#units?unitgroup=hostile&unit=jelly` still shows it.


## impact — what a hit looks like

The board has had exactly ONE impact effect since it was built: `makeDotBurst`,
a puff of tinted dots, reused for a run-over, a shell, a laser tick and a
portal collapse. Four very different events reading as the same puff is why
hits feel weightless, and it is not a tuning problem — a spark shower and a
flash are different phenomena and no number turns one into the other.

`src/impactfx.js` is seven families, each a factory returning an Object3D with
`userData.tick(dt) -> alive`, which is the contract `makeDebris` and
`makeDotBurst` already use — so td-tab's existing `debris` array can carry
these without learning anything. SPARKS fall and BOUNCE off the plane they
came from, because a spark that passes through its own wall tells the eye
there is no wall. The FLASH is the shortest-lived thing in the set on purpose:
a flash you can look at is a lamp, and the eye reads a lamp as a light source
rather than an event. The RING lies flat and thins as it grows. The SCORCH
does not shrink and outlives everything, because it is the only record of the
player's own aim. DEBRIS are the only family with faces — a chip catching the
light as it turns is the whole read. SPLASH is thrown like a spark but STICKS
and then sags, so a plasma hit ends as drips running down a wall rather than
as a cloud that went away. EMBERS outlast the bang, which is the cheapest way
to make a big hit feel bigger than a small one: the eye reads duration as size.

Everything is authored in LOCAL SPACE with +Z along the surface normal, and
`orientImpact` is the only place a basis is derived. Three call sites deriving
their own is three chances to pick a different sign convention, which is the
bug this project keeps paying for.

The lab (`#impact`) fires them at a wall that ANGLES, because incidence is the
control that changes the picture most — sparks only read when they spray away
from a surface. It uses the game's light rig and the board's sky as an
environment: a metal plate with nothing to reflect is black under this rig,
and a black plate makes every effect look good, which is the wrong instrument.

Two things the first render settled: everything was authored an order of
magnitude too large and swallowed the wall in one hit, and SIZE belongs on the
group rather than in the tune — the same effect has to serve a 3-unit wall
here and a cell on the sphere a fiftieth of that, and retuning twenty knobs
for each would give two effects that drift apart.

Not yet adopted by the game: td-tab still fires `makeDotBurst`. The recipes
are named after what fires them (`shell`, `laser`, `plasma`, `light`) so the
call sites can ask for one without knowing which families that turns out to be.

## shield — a hologram, four ways in, and a shove

The energy shield was one lucky pickup with a dot-cloud bubble. It is a
system now: `src/shield.js` (pure, 43 invariants in `npm test`) owns the
meter, the rack, both field sources and the shove vector; td-tab keeps the
mesh, the HUD and the keys.

**The seam is the feature.** `deploy()` refuses while the shield is up from
any source, which is what forces a naked window between charges — without
that refusal S is a hold-to-win button. The cooldown is stamped at the DROP,
not the deploy, so the window is a fixed 2s whatever fed the bubble, and 2 <
`RAM_COMBO_GAP`'s 4 means a player who keeps finding soft bodies through the
gap carries the multiplier across it. A test pins that relationship, because
it is the design and not a coincidence of two numbers.

**Four sources, one capped meter.** The dome pickup (12s); a Slow tower you
park in, which stops slowing anything while you drain it and stays out of
order 5s after you leave; a pad at the heart, 10s a wave, free in biomass
because the cost is being at the heart instead of the front; and `S`, two
charges of 10s — exactly one full meter, spent in two halves.

**The shove** pushes the not-rammable tier aside instead of killing it: no
damage either way, no shield time spent, and the ram combo untouched. A
shielded tank that killed the hard tier would make `rammable` stop being the
read the whole board is built on. It is an OFFSET applied after the path
interpolation, not a position write — `e.pos` is rebuilt from the cell path
every frame, the trap `?a6ram=1` already documents — and the stagger zeroes
`pace` rather than `e.prog`, so the body resumes where it was thrown.

**The bubble** stopped being 280 additive dots. It is a fresnel shell: bright
at the rim, near-absent through the middle, which is what matters in play
because you steer through it. The impact is a ripple from the contact point
rather than a global opacity spike, taken back through the shell's own
`worldToLocal` rather than re-derived.

Four things only running it could find, all of them checks that reported
success while measuring nothing: `?layout` could not see the new pad (its
element map is a fixed list); `?coarse=1` flipped ZERO media blocks because
it ran at init, before `cssRules` was populated — so the tool built to stop
`?layout` lying about phone rules was itself doing nothing; the shove probe
measured a frozen board because clearing `paused` leaves `driveFrozen` and
`player.next === -1`; and its decay check called a working shove a failure
because the still-driving tank kept re-shoving the body.

## The lance: from the muzzle tip, stopped by terrain, through the enemies

Operator: "fix the green laser's height, where the model is — the laser
should be aligned with the tip of the muzzle, and then only be stopped by
either the ground or walls (does not go through walls), perhaps an effect
that it is being stopped. It DOES go through enemies and damages them."

It was drawn from a point normalised onto the unit sphere and lifted back to
a nominal wall height, along a surface arc — so it was at the wrong altitude,
detached from the model, and stopped by nothing. It is now a straight ray in
the world from the muzzle's real position, marched against terrain.

Four things had to be fixed to get there, and every one of them was a real
misreading rather than a tuning number:

- **The trunnion height was in the wrong space.** `aimTower` summed the pitch
  node's local `position.y`, which is in the INNER model's units, against a
  target converted into the WRAPPER's — `fitModel` puts its scale on the
  child, so the two are off by that factor. The barrel aimed far below
  everything it was shooting at. Taken from the render now.
- **A gun does not shoot its own parapet.** The muzzle sits thousandths above
  the wall top it is bolted to, so a depressed barrel's first sample was
  already under its own cell's surface and the lance died a fifth of a cell
  out, every time. Its own cell cannot stop it.
- **Terrain needs clearance.** Enemies stand ON the ground, so a beam aimed
  at one is at ground level when it arrives; stopping the instant the ray
  touched r = 1 killed it a step SHORT of every target. A quarter-cell.
- **The muzzle empty's axis is not a contract.** The first cut took the
  direction from its world +Z — the model's stated forward — and *measured*
  it against the bearing to the target: 2° apart sometimes, 42° at others.
  The Workshop guarantees the muzzle's POSITION and the ROOT→BASE→YAW→PITCH→
  RECOIL chain, not an empty's local orientation. The beam leaves the tip, as
  asked, and runs toward the target; the on-target gate keeps tube and beam
  agreeing to within the drive's own tolerance.

Damage is measured to the SEGMENT now (`distToSeg`), not projected onto an
arc — it is a line through the world. And it sparks where it is stopped, in
the beam's own colour, because a beam that simply ends in mid-air reads as
one that is too short, where one splashing on rock reads as one that has hit
something the player can move the tower away from.

Measured: `struck 2` per burst, stopped by walls at 2.6 and 5.2 cells, once
running its full 7, beam origin 0.003 cells from the muzzle tip.

## The recurring third-person bug: the canvas is not what the player sees

Operator: "in TD mode it's still there; in TD2 it started fine but by the end
of the first sector it was back". Their screenshot carried the answer:

    VIEWWATCH #22 chrome 430,516 r77px 9.5% view=third build=false
    shot=-- deploy=false camToTank=15.9c

`view=third`, no shot, no deploy, tank 77 px across and 9.5% of the short
axis — the camera was never stuck. The verdict is `chrome`, which means the
tank's screen position is outside `visualViewport`. On a phone `innerHeight`,
and therefore the canvas, includes the strip behind the browser's own UI. The
third-person rig frames the tank a third up the CANVAS; when the chrome eats
the bottom, that lands below the fold. The tank is drawn, in frustum, the
right size, and invisible.

That is why five previous fixes did not hold. Every one of them asked "is the
camera pointed at the tank", and every time the answer was yes.

`applyViewportBias` pitches the camera by the angle that moves the target
from the centre of the canvas to the centre of the VISIBLE band. On a
desktop, and headless, `visualViewport` reports the full canvas and the bias
is exactly zero — which is the right no-op and the reason this can ship
without a device to test it on. Applied to the third-person rig and to build
mode, which has the same problem with the cell you tapped.

**And the arithmetic is testable after all.** `?vpbias=<offsetTop>:<height>`
injects a synthetic visible band; `?vpprobe=1` reports where the tank lands
and whether that is inside it. With a 430×900 canvas and a band ending at
500, the tank sits at y=572 uncorrected — outside — and at 434 with the bias
— inside. Measured, not asserted.

`chrome` is now an actionable verdict in the watchdog. It used to be filed
under "re-seating would not help", which was true while the rig aimed at the
middle of the canvas: snapping put the tank back in the same invisible strip.

The watchdog line also grew the things the last one lacked: WHICH edge the
tank crossed and by how many pixels, the canvas and visual viewport
rectangles, the applied bias, and `unitScale` — because the rig pulls back as
the tank grows, `camToTank=15.9c` is a large number, and "by the end of the
first sector" is exactly when the tank is biggest. If growth is a second
cause, the next screenshot will say so instead of needing another round.

## The hack overlay on a phone — full screen, and turned where turning helps

Operator: "on mobile, when reaching the server, the games are hard to play
because they're not full screen".

The overlay was already `fixed; inset: 0`. What was not full screen was the
GAME inside it: these are landscape-shaped boards and a phone held upright is
not, so the fit scaled a 560-wide board down to 77% with a hundred and fifty
pixels of letterbox above and below. It worked, and everything in it was too
small to hit.

**HDT is now turned.** On a portrait phone it is handed the phone's LONG axis
and rotated back into it — `translate(availW,0) rotate(90deg) scale(s)` with
the origin at the top left maps local (x, y) onto (availW − s·y, s·x), so
local x runs down the screen and local y back across it, filling both axes
exactly. Measured at 1:1: 430×861 becomes an 866×430 board with no
downscaling at all. Pointer events come through a CSS transform correctly, so
the games needed no idea it happened.

**The turn is per game, because the three genuinely differ.** HDT is a wide
circuit board — it already filled a 908×418 landscape phone at scale 1. The
two pazorukore puzzles are squarish boards with fixed side panels: handed a
2:1 viewport they clip their own grid *internally*, which the iframe cannot
detect, because the child reports no overflow — it simply lays out wrong. So
they stay upright, where they now fill the screen properly, and the ↻ TURN
button is there for either of them if the operator disagrees. It resets when
the game changes: a turn is an answer about one board.

Two smaller things the phone found:

- **The ☰ sat on top of the breach bar**, over the tab of the game you were
  playing. It is a child of `<body>` and the overlay a child of the tab, so
  their z-indexes are in different stacking contexts and never compare
  whatever numbers they are given. `body.hacking` hides it.
- **TURN never appeared on the one device it exists for.** Its enabling media
  query was declared ABOVE the base `display: none` and lost on source order
  — the same trap `#td-tut` has in this file. The bar also needed tightening
  at 430px, where it was pushing the active tab out one end and TURN out the
  other.

## TD2 — the lab's palette on the board, and towers that are machined not moulded

Operator: "the towers feel too big and bulky compared to the tank... smaller
and more detailed, more like precision engineering, feeling more believable
that they were created by Isao. The texture and colors look much better in
sentry lab mode."

**The lab looked better because the lab does nothing.** It loads these models
and lights them, and what you see is what the Workshop authored: blue-grey
armour, a lighter edge, copper fittings, an orange signal, a red
identification stripe — six materials designed to sit together. The board was
running them through `tintModel`, which re-hues every surface to the tower's
colour and keeps only lightness. That system is built for the mkcx tank,
whose four materials are all muddy olive and genuinely need pulling apart;
applied to a palette that was already good it threw the palette away and
returned a monochrome machine.

`dressSentry` keeps the authored colours, lifts them ×1.35 because the board
is a darker room than the lab's three-light studio, adds a faint emissive of
each material's OWN colour so a dark plate is a dark plate rather than a
silhouette, and spends the tower's identity colour where it costs nothing —
the SIGNAL and IDENTIFICATION surfaces, which are indicator panels and are
meant to be read. Families are still told apart at a glance.

**More detailed was free.** The Workshop draws each family three times —
Base, Reinforced, Maximum — and the board was only ever loading Base. A tower
now wears the equipment tier matching its own upgrade tier, so a tower you
have paid to upgrade twice visibly carries more hardware. Tier 1 loads up
front and the rest lazily (24 models is about 4 MB, and a board that
downloads the Maximum variant of a tower nobody upgraded is paying for
hardware that is not on the table); a tower wears the best tier it has bytes
for and starts the load for the one it wants. Measured: the Rotor goes
804 → 1000 → 1380 triangles.

`?alltowers=1` had to start printing TRIANGLES to check that at all — a
merged model has one mesh per material however much geometry is in it, so
the mesh count is identical across all three tiers.

**Smaller** is `?towerscale=`, default 0.72 of what it was. It is a knob
rather than a new constant because "how big should it be" is a look decision
and the operator should be able to argue with the number rather than have it
guessed at once. Detail reads better small: a bulky machine looks moulded, a
small one looks machined.

## TD2 — a green laser, and the Quiver fires the lab's missiles

**The lance is a laser, not a thrower.** Same shader, opposite settings:
`LANCE_LOOK` is a fifth of the thrower's width, zero jitter, and most of the
noise and flicker taken out — a plasma thrower is wide and unstable because
it is a spray of matter, a laser is a thin steady line because it is light.

Green via a new `def.beamColor`, kept separate from `def.color` on purpose:
the identity colour still drives the range ring, the shop icon and the model
tint, so a laser can have a colour of its own without repainting the machine
that throws it.

**The Quiver now fires the sentry lab's seekers** — `attack: 'seeker'`,
`lock: true`. Not a second implementation: the same `lockon.js` the sniper
aims by hand and the range aims by drive, put through the same
`scaleMissile` by dimension. The board's world is the unit sphere, so a
3.5-cell reach is 0.157 radians — four thousand times smaller than the
sniper's 700 m — and a tune in metres and seconds is simply wrong here.

It locks with its DRIVE (the gate is how far the barrel still is from where
it wants to be, in degrees — the quantity the range's tolerance is written
in), and the lock is stepped in `aimTower` rather than in the firing path,
because a lock fills whether or not the weapon is off cooldown and that IS
the mechanic. Fire-and-forget on launch, which is the lesson the range
taught: a Quiver that holds its lock empties itself into one walker while
the wave goes past.

One real bug on the way: **a seeker's ground cull has to sit below the
surface.** A top-attack round comes down on something standing ON the
ground, so the last part of its dive is under the radius the ground sits at.
Culling at exactly 1.0 killed three seekers in four — each still closing,
none more than a cell out. The floor is now a third of a cell down, under
the terrain and past any body on it. Four launched, four hit, none lost.

## TD2 — the towers aim like the sentries do, and the Lancer pierces

Operator: "the new towers should use the results from the Sentry Lab;
tracking the targets, shooting towards the acquired targets... the laser
could use a similar engine as the plasma, but more straight, and one long
burst... it shoots through targets, so it is meaningful to put it at an
angle that goes down a line".

**The rig survives the merge.** `mergeByMaterial(scene, ['YAW','PITCH',
'RECOIL'])` — the same mechanism the A6's legs use, pointed at the Workshop's
articulation contract. Merging those away is what made these towers scenery
with a gun painted on: they could not track, elevate or recoil.

**`aimTower` now drives the lab's answers.** Yaw and elevation are separate
drives at `SENTRY_TUNE`'s own degrees-per-second (not a lerp factor — a
proportional ease is fastest when it is most wrong, which is the opposite of
a motor), clamped to the elevation envelope, with elevation measured **from
the trunnion** (the range learned that the hard way: from the base, a level
gun aims nose-down at everything) and the one negation written once. Shots
leave a real `MUZZLE_nn`, cycling barrels, and kick RECOIL.

What is deliberately NOT imported is the lab's state machine. A tower already
has `pickTarget`, a cooldown and a range; a second opinion about what it is
shooting at would be two authorities on one question. **The lab owns how a
turret moves; towers.js owns what it moves toward.**

**The Lancer is a line, not a shot.** `attack: 'lance'`, one long burst every
2.2 s, out to its full seven cells, damaging everything standing on it. Three
things had to be got right and each was wrong first:

- **Terrain does not stop it.** Keeping the tank's wall-march killed the lance
  half a cell out every time — the tower stands ON the high ground, so its own
  wall is the first BLOCKED cell it finds. A Lancer shoots over the terrain.
- **`off` is measured on the unit sphere.** `projectToArc` returns a 3D
  distance to a point on the sphere, so an enemy sitting a wall-height above
  it was paying for its altitude out of a hit radius only 0.04 wide.
- **The bearing comes from the muzzle**, not the cell centre. The barrel is a
  fraction of a cell off the centre, and that parallax was enough to miss the
  very target it aimed at.

It shares the plasma's engine so the board has one plasma look, tuned the
other way: thin, straight, held, and along the ground arc rather than down
onto a body. The glow brightens with the body count, because the one thing a
piercing weapon should say out loud is how many it caught.

## TD2 — the walk reads as a walk, and the towers stop being pale blobs

Operator: "the A6 jumps instead of walking" and "every tower comes off as
monocolor instead of detailed, I suspect some lighting issue".

**The jump was mine.** The bob was a stand-in for a walk cycle the merged
model could not play; once the legs actually moved it was a hop laid over
them. Gone. Two things replace it, and both are why the gait did not read:

- **It now faces where it is walking.** Setting `up` alone left the heading
  at whatever the identity quaternion gives, so a machine with six legs and a
  clear front was crabbing sideways down its own path. Basis is
  `(up × forward, up, forward)` — the Workshop's models are +Y up, +Z
  forward. The heading is measured from the move it ACTUALLY made, not from
  its waypoint (which it may be walking around), eased so a turn is a turn.
- **The leg cadence tracks ground speed.** A clip at a fixed rate under a
  hull whose speed changes is what reads as skating, and the A6 genuinely
  changes speed — it walks out and runs home.

`?a6=1` now reports `facing Ndeg off`: the angle between the model's nose and
its heading. A screenshot cannot answer that, which is the whole reason the
check exists.

**The tint was not a lighting bug.** The authored materials span 0.46 in
lightness already, so the file was fine. `tintModel` with no `shades` does a
wash and nothing else — a flat `color × 0.28` emissive on every material —
and `def.color` for these towers is near-white (`0xeaf2ff`, `0xc4e6ff`,
`0xffffff`). A uniform near-white emissive at 0.28 over a dark model in a
dark scene swamps the lit contribution entirely: every surface arrives at the
same pale value, which is precisely the "single coloured mass" the function's
own comment warns about.

`SENTRY_TINT` is the ladder, keyed to the Workshop's contract material names
rather than to whatever an export happened to call things: Armor 1.0, Edge
0.86, Copper 0.52, Dark 0.14, over a 0.16–0.78 lightness range. Emissive is
now scaled by the rung (0.10 at the top instead of a flat 0.28). Signal and
Identification are the indicator surfaces and take the tower's colour at full
strength — `tintModel` grew an optional `glow` regex for that, since no
pattern for the word "glow" will ever match them.

Measured rather than squinted at: `?alltowers=1` prints each tower's rendered
lightness span. 0.53 across Armor 0.78 → Dark 0.25, per tower, on all eight.

## TD2 — a second tower roster, and a tower that walks

**A copied tab is not trivial.** `td-tab.js` is 15,193 lines and the repo
already carries four ~900-line cp+sed siblings as named debt. The roster is
160 lines of data, so the variant is a **roster**: one board, two tables,
chosen once at boot. Roster 1 is untouched — that is the history the operator
asked to keep.

`TOWERS` / `TOWER_BY_KEY` / `TOWER_ORDER` are exported `let` — live bindings —
switched by `src/roster.js`, which must be main.js's FIRST import so it runs
before td-tab's module body (ES modules evaluate depth-first in import order).

**The mapping**, Rapid removed and everything after shifted up: Single→Rotor,
Spread→Plasma Thrower, Homing→Quiver, Slow→Relay, AoE→Mortar, Sniper→Lancer,
Laser→Howitzer, plus the Heptapod A6 at 8. Three are more than renames and are
argued at their own line in the table: the **Rotor** takes Rapid's job (its
slot at a rotary cadence — revert is two numbers); the **Plasma Thrower** is a
beam and now the shortest-ranged thing on the board; the **Howitzer** is
artillery, not the beam its slot held, so the board has two lobbed weapons
that actually differ.

**A ?v= token is part of a module URL.** `./towers.js` and `./towers.js?v=ab`
are two modules and the browser loads both — ~27 pure modules are already
split that way (wasted bytes). For towers.js, which now holds mutable state,
`roster.js` switched the copy nobody read and the board came up as the
campaign. `bust.sh` only UPDATES tokens and never adds them, so nothing would
ever have noticed. `check-tokens.sh` now fails on a split import of any module
exporting `let` — verified by breaking it on purpose.

**Sounds.** `sfx.play('tower_' + key)` held only because the campaign's eight
keys and the manifest's eight tower samples were the same eight words. A def
may now name its own sample (`towerSound(def)`), and `test/audiomanifest.mjs`
asks the coverage question of both boards. The Rotor gets the minigun.

### The Heptapod A6

The only tower on either board that is not a position: you place a **patrol**.
`src/heptapod.js` — patrol a leash around its berth → engage → empty a
6/8/10-rocket cassette by tier → walk home → reload → repeat. Going home is
**unconditional**; an A6 that could be distracted on the way back would fight
forever on one magazine and the magazine is the design. The consequence worth
watching on a first play is a **rhythm**: the board's strongest unit is absent
for a fixed fraction of every cycle, and the player can see when.

Two things the tests found. The leash test has to be on where the A6 would
STAND, not on where the enemy is, or it refuses shots it could take over the
fence. And with a constant `rand` it re-picked the same waypoint and parked —
the test's bug (a stream re-seeded inside a per-frame object literal), but a
caller mistake worth surviving, so the bearing now turns by the golden angle
each leg regardless.

Its walk is a bob, not the model's `Walk` clip: the sentry look merges by
material (6 draw calls instead of 109) and merging discards the skeleton. The
clip needs an unmerged instance and a mixer — a draw-call decision, so it is
named debt rather than a five-minute fix.

`?a6=1` places one and logs the loop once a second. It clears the landing
brief first, because the board starts `paused` and the first cut of the probe
measured a frozen game for thirty seconds and reported a frozen unit.

## d0fcbd3 — the Javelin on the Quiver, and a voice for every sentry family

`missile: true` in `SENTRY_FAMILIES` makes the Quiver a launcher rather
than a gun with more muzzles: it must LOCK before it fires, and what leaves
the tube homes. Same weapon the sniper lab aims by hand, with the aiming
automated — the two ends of the same ladder.

The physics are not copied. `scaleMissile(tune, k, tau)` moves the metre
tune into model units **by dimension** — length `k`, time `tau`, velocity
`k/tau`, acceleration `k/tau²`, drag `1/k` — so the range flies the same
trajectory drawn smaller and faster, and a retune of the Javelin follows
for free. Asserted directly: a flight at `k=1/70`, divided by `k`, is the
metre flight.

A sentry locks with its **drive**, so the gate is in degrees of aim error —
the quantity `tolerance` is already written in — and `stepLock` is fed that.
`lockGate` / `lockTime` / `lockBreak` are knobs.

**Fire-and-forget** was not the first cut. Holding the lock after launch put
six rounds into one walker while the rest of the wave went past; dropping it
the instant a cell is away makes the launcher slow to its first shot and
quick after. The probe now reads 5 fired / 5 hit.

**Voices.** Every family names its own sound in the table; the tab knows only
that there is a `fire` key and maybe a `ready` one. The Rotor gets the
operator's two minigun samples, built through `scripts/audio-build.sh` —
which needed a **start-offset column**, because the roar has a tenth of a
second of nothing and a spin-up in front of the body worth slicing (and a
slice that does not start at zero also needs a fade IN, or the cut clicks on
every retrigger). The spin-up is the **downtime** voice, keyed to the moment
the gun decides rather than to the round: once per engagement, re-armed only
after the barrels wind down. The roar is per round and quiet — gain 0.22.

`?voiceprobe=1` logs every sound call with its count, which is the only way
a headless run can check any of this.

## 130bb1b — the Javelin: a lock is the mini-game, the missile flies itself

A fifth sniper weapon whose verb is different from the other four. The
ballistic weapons ask *where will it be*; this one asks *can you hold it
still*, and then stops caring.

`src/lockon.js` is DOM-free and Node-tested. **The lock** is a state
machine over one number: it fills inside a 12 mrad gate, drains slower
than it fills when it is not (so a wobble costs but does not reset — that
ratio is the difficulty), and once full it HOLDS out to a 34 mrad break
angle. The meter only fills for the target it has been filling for, so
sweeping across three enemies is not a lock on the third.

**The guidance** is proportional navigation, `a = N · ω × v`, clamped to
what the fins can pull. Its one property worth asserting directly: a
collision course commands nothing. Two bugs the tests caught, both fatal
and both about that virtue:

- PN says nothing on a level shot, so with no **gravity bias** the missile
  fell out of the sky at 640 m. Gravity is now added back outside the law.
- the first **top-attack** profile switched its lift off at a fixed
  fraction of the way in — a 200 m step in the aim point. It climbed to
  90 m, sailed over the target and buried itself 300 m past. The lift is
  now scaled by the range STILL TO RUN and retires itself.

Then the tune: at 314 m/s with 140 m/s² of fin, the turn radius is 704 m
and no top attack is geometrically possible. Subsonic and manoeuvrable
beats fast and straight for a weapon whose job is to come down on things.
Nine engagements, 200–1600 m, stationary / crossing / closing / opening /
up on a wall, all within a metre, all launched straight down the sight
line rather than led.

The seeker reticle replaces the mil-dot one rather than overlaying it (a
homing round has no holdover, which is also what `solution()` returns for
it). Four brackets walk inward as the meter fills and snap to the ring
with TARGET LOCKED; once locked the assembly rides the target, so a
drifting barrel shows as the sight leaving the middle of the screen.

`?javprobe=1` proves the wiring: unlocked fire is refused, the meter fills
from the frame loop, a missile launched down the barrel hits a target it
was never aimed at, and going past the break angle lets go.

## f078a84 — four sniper weapons, and one integrator they all obey

Scroll-wheel magnification, a REAL spawn on the board's enemy spec, and
laser / mortar / rail gun beside the Lancer — each stressing a different
part of the physics rather than being a velocity slider with a new name.

Adding them broke the sniper's one promise — dial what the HUD prints and
the round arrives — in four places, every one found by the probe:

- the **lofted hold was solved at t0=0 and memoised there**, then fired a
  second into a gust that had moved on: ten metres of drop over a 25 s
  arc. `refineAngle` re-solves for the launch time.
- correcting 172 mrad of drift while keeping the **straight-ahead
  elevation** put the round seventy metres short — swinging the barrel ten
  degrees lengthens the path. Elevation and azimuth are now solved
  together, iterating.
- the round flew at the **frame's dt** while the solver integrated at the
  weapon's fixed step: fifteen metres of disagreement, and a landing point
  that depended on the browser's frame rate. The flight carries a
  remainder and steps at the weapon's own `h`.
- a **lob was aimed along the sight line**. For a flat weapon the hold
  sits on top of where the optic points; for a mortar the hold IS the
  launch angle.

Plus a beam given a bullet's zero, and a rail gun whose charge could never
release under the probe (`fire()` re-armed it) — so the probe was fixed
first: it clears the cooldown between runs, because it measures physics
and not rate of fire.

`test/ballistics.mjs` now flies every weapon's own printed solution, at
three moments in the gust, and asserts it arrives. A lofted round that
falls short never crosses the plate's plane, so it reports the **fall of
shot** in metres instead — add/drop and left/right, how a mortar crew
corrects.
Demo links assume `npm run serve` (port 8144) or the
[Pages deploy](https://kai-denrei.github.io/spherical-stalberg-grid/).

---

## `65fe9d1` — the sniper gets a voice, a target, two phases, and a HUD

Four asks in one message, and the last of them found a bug the first three
had been hiding.

### The gun

`tank_main` at full presence — this **is** the board's cannon with a scope
on it — and the board's own recoil shape: a hard kick eased out, not a
constant offset. The kick is expressed in **milliradians of glass** rather
than world angle, so it reads the same at 4× and at 25×. A recoil in world
angle is invisible zoomed out and unusable zoomed in.

### Phase 1 is a calibration

*"It is unclear what we are shooting at"* — so a black-and-white bullseye,
dead ahead, at a known distance, with a fixed string of shots.

**Every shot is recorded, hit or miss.** A calibration is about the *group*,
and a string that only remembers its hits cannot tell you that all five went
two mils low together. The card reports two different things on purpose:

- the **correction** — the mean point of impact, negated, which is what you
  dial;
- the **group** — the extreme spread, which you *cannot* dial away and which
  is therefore the honest score.

Phase 2 puts the same targets on posts and crosses them, which is what the
time of flight was for all along.

### The HUD, from the onkochishin study

Built on `~/Dev/onkochishin/atelier/hud-targeting` on the operator's steer,
rebuilt in our own CSS rather than vendored. The craft worth stealing is
small and specific: **corner readouts carry only two borders each**, so they
read as brackets instead of boxes.

```css
#sniper-fcs .r-tl { left: 18px; top: 56px; border-left: 1px solid; border-top: 1px solid; }
```

Plus the two-tier label/value field, the bearing tape and the palette. The
assist ladder became the **ACQUISITION** panel's chips, which is what it
always was: four status lights for four things Isao has or has not printed.

### And the bug the HUD found

With the panels up it was suddenly obvious that the scope was looking at
nothing. The calibration target logged as **present, in frame and 84 px
across** — and could not be seen.

A three.js camera looks down its own **−Z**. The ballistics module, the
workshop's models and every target here are built on **+Z**. That is a rule
written in this project's own `CLAUDE.md` — *"three.js lookAt: plain
Object3D faces +Z, cameras −Z"* — and I walked straight past it. The scope
was aimed at the empty half of the range.

Half a turn fixes it with no other sign change anywhere, because with
`rotation.y = PI + yaw` the forward vector is `(sin yaw, 0, cos yaw)` —
exactly the module's own convention.

Two smaller ones fell out of the same look: the reticle's target test
measured elevation from the **ground** rather than from the optic, which put
a 500 m target 12.7 mrad off the cross it was sitting on; and the rifle is
hidden by default, because you do not see your own rifle down your own scope
and leaving it drawn fills the frame with grey metal.

### What the probe measures now

`?sniperprobe=1` fires the whole string with the sway off and the clock
advancing, so what is left in the group is the **gust and nothing else**:

```
with the alien wind:  5 shots · group 389 cm · correction -0.01 up 2.82 right
with the wind off:    5 shots · group 0 cm   · correction -0.01 up 0.00 right
```

That is the part of the spread no amount of dialling removes — and it is a
tuning number, not just a check. A 3.9 m group against a 5.5 m target may be
more weather than the mode wants.

### The chip ruling

Recorded in `docs/AUTOMATION-ARC.md`: **permanent per planet, bought with
biomass on the debrief.** Two consequences written down before anything is
built — the debrief's `SINK` table is already the ladder's UI, and
permanent-per-planet means a planet's *last* sector is the one where
everything is automated and its *first* is where nothing is. The arc's curve
therefore runs opposite to the wave curve, which is either the best thing
about it or the thing that needs a counterweight.

---

## `6670894` / `1c57ec6` — the SNIPER, and the arc it rehearses

### One integrator, used for everything

The round that flies, the drop the HUD prints, the hold the reticle marks
and the angle the zero solves for all come out of one `step` in
`src/ballistics.js`. The project's standing rule — values that must agree
are *derived* from one source, never computed twice — matters more here
than anywhere it has come up: **a sniper mechanic is a promise that the
number on the glass is the number the bullet obeys.** Two implementations
of "where does it land" is a scope that lies, and a scope that lies is not
difficult, it is broken.

So the zero is found by **bisection on the integrator** rather than by a
closed form that would agree with it only while the drag is nought:

```js
export function zeroAngle(range, tune) {
  let lo = 0, hi = 0.15;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = flyTo(range, mid, 0, tune, 0);
    if (!r.reached || r.drop < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
```

`?sniperprobe=1` is what keeps the promise honest — the same 806 m target,
fired twice:

```
SNIPERPROBE target 806 m · solution 8.81 up -11.45 right · 1.70 s
SNIPERPROBE no hold:  miss — SHORT — struck the ground at 542 m
SNIPERPROBE solution: HIT — 1 cm off centre
```

### Where the tests bite

Most of the physics can only be checked for *shape*, so the suite leans
hard on the few places an independent answer exists — and on the places
where the usual fudge would pass a shape test:

- a drag-free level shot falls **exactly ½gt²**, which is the only check
  the integrator itself can be held to;
- a rifle zeroed at 400 m is **on** the sight line at 400 and shoots
  **high** inside it (the mid-range rise) — the property that defines a
  zero, rather than a number that looks plausible;
- **wind acts through drag on the round's velocity relative to the air.**
  So a head wind barely deflects, and a drag-free round ignores the wind
  *entirely*. The common shortcut — wind as a flat lateral push — passes
  "a crosswind pushes it" and fails both of those.

### The breath, corrected by its own test

Holding shrinks the sway, never stops it, and runs out. The first cut let
it **refill while the button was still held**, which quietly made "hold it
down the whole time" the correct play — the cost of holding became a
stutter in the reticle instead of a decision about when to take the shot.
Recovery needs a release now.

### The assist ladder is the automation arc in miniature

Rangefinder → wind readout → firing solution → auto-dial. Four chips, all
**off**, each switchable. That is both the difficulty knob the brief asked
for and a rehearsal of `docs/AUTOMATION-ARC.md`, recorded the same day:
*"we land on the planet bare-bone, little by little Isao automates
processes."* Six of that arc's seven rungs are already code with both
halves written; the arc is mostly a matter of gating what is currently on
by default. The note also names the risk — **a chip should buy attention,
not performance** — or the game's arc becomes "it plays itself better than
you do".

The last rung is deliberately the one that stops the player doing the
interesting part, so it exists to be switched off again.

### The glass

The rifle is the workshop's Lancer under the same name contract the sentry
range uses, and the scope rides the **PITCH** node — so recoil kicks the
view and the sway moves the *shot*, not merely the crosshair. The reticle
is an SVG overlay drawn in CSS pixels **from milliradians**, because a mil
that scales with the scene is a mil you cannot range with; milling the
target by hand (1.9 m tall) is exactly what the rangefinder chip replaces.

Two things the first still forced: targets stand on posts with a plate,
because at 800 m a dot cloud is a handful of pixels with sky behind it and
nothing to mil from; and the ground grid went to 100 m squares at 0.07
opacity, since a fine grid at 10× piles into a solid band across the
horizon and hides the one thing a scope is for.

---

## `65e59d5` — the SENTRY RANGE, and TD's deep link

The small one first: **TD has the ↗ button**, beside the variables gear
rather than on the left edge with the labs' — that edge is the throttle, the
radar and Isao's caption, and a control the thumb can reach while steering is
a control that gets hit while steering. It writes the **seed** always, because
a board is only reproducible with it and it moves under you (a regenerate, a
new planet); the mission is diffed, so a campaign link simply has no mission
in it.

### The range

`#sentry`. Six modular turret families from the [Sentry
Workshop](https://jelaludo.github.io/SentryTowers_A6/), vendored to
`assets/models/sentries/` — eighteen files, 1.8 MB all told. They arrive with
a name contract, and this tab is a **client** of it rather than a second copy
of the rig:

```
ROOT → BASE → YAW → PITCH → RECOIL      the articulation, every family
MUZZLE_00 … MUZZLE_nn                   where a round actually leaves
ROTOR                                   the Rotor's barrel cluster
Armor / Edge / Dark / Copper / Signal / Identification
```

That is this project's own "a part is only addressable if it was named a
pivot *before* the merge" rule, honoured by somebody else's exporter. So the
muzzle count is **read off the model** — 1 for a Needle, 2 for a Kiln, 6 for a
Rotor, 18 for a Quiver's two pods — and the gun walks them round-robin instead
of firing every round out of the first one.

### The two invariants that are the whole thing

`src/sentry.js` is pure and `test/sentry.mjs` pins it. Two of those tests
carry the file.

**The yaw seam.** Slewing from +170° to −170° is twenty degrees, and the
naive `b - a` is wrong exactly there and nowhere else — so it passes every
test anybody writes by accident:

```js
check('the short way across the seam', deltaDeg(170, -170) === 20);
```

**The elevation sign.** The workshop's own viewer applies
`-degToRad(elev)`, because a +Z-forward node lifts its nose on a *negative*
rotation about +X. The module speaks elevation-positive-up and the tab does
that negation once, at the PITCH node. Two places deciding what "up" means is
how a turret ends up shooting at the floor.

### Three things only running found

**A sentry commits.** Re-picking the nearest target every frame whipped the
barrel between two and settled on neither. `pickTarget` keeps the one it has
while that one is up, alive and reachable — and it keeps it **by id**, because
the range's array is filtered and refilled every step, so an index means a
different target from one frame to the next. One bug that looked like a broken
drive and was a broken decision, twice over.

**Aim from the trunnion.** The pivot sits over a metre above the foundation on
every family. Aiming from the model's origin put a dead-on barrel's rounds
that far past the target — `err=0.00` in the log, and nothing ever hit.

**Multi-barrel mounts are boresighted.** Firing each cell along its own axis
is what a diagram says a launcher does; the Quiver's eighteen cells sit across
two pods, so parallel fire put every round a metre beside a target the gun was
dead on. They converge on the **boresight** — the point the trunnion's axis is
pointing at, at the target's range. Converging on the *axis* rather than on
the target keeps the aim honest: a drive three degrees off puts the boresight
three degrees off and every cell misses together.

Which is testable, and tested by hand: the Rotor scores **100% at a 2.5°
tolerance and 62% at 25°**. The knob measures something.

### Nothing new was drawn

The targets are the game's own dot-cloud units, popping out of the ground on a
seeded ring. The tracers are `makeBulletCloud`, the flashes and impacts are
`makeDotBurst`, the recoil is the model's own `RECOIL` pivot and the Rotor's
cluster spins up while the gun is hot and coasts down after.

```
SENTRY rotor t3: 6 muzzle(s) yaw=true pitch=true recoil=true rotor=true fixed=false
SENTRYPROBE t+6s rotor t3 muzzles=6 yaw=-173.2/-173.2 elev=22.2/22.2 err=0.00
                 target=12 up=5 fired=7 hit=7 killed=3
```

Every family verified to load, articulate and hit — including the **Relay**,
which is the workshop's own fixed structure and correctly engages nothing.

---

## `2aa7364` — the missions, selectable

Both missions were reachable only by typing a query parameter. They are
three buttons in the tab bar's play group now — **TD / rescue / raid** —
and three cards in the home launcher, each carrying the line you want to
have read *before* you start it.

### A mission button is a link, not a tab switch

`?mission=` is read once, when the board builds. Switching missions means
loading the page again; pretending otherwise gives a board that says "raid"
and plays the campaign. So the buttons navigate, through `paramLink` from
the deep-link module:

```js
export function paramLink({ base, hash, key, value = '', carry = '' }) {
  return deepLink({ base, hash, carry, params: { [key]: value }, defaults: { [key]: '' } });
}
```

The empty-string default is the load-bearing part: it makes the plain **TD**
button *clear* the key, so "back to the campaign" is the same code path as
"pick one" rather than a second branch. The seed you were on comes along in
`carry`.

### Two things it had to fix rather than add

**`activate()` used `querySelector`** to mark the active tab — which can
only ever find the *first* button for a tab. TD has three now, so the
campaign button would have been lit whichever mission you were in. It marks
all of them, and lights the one whose mission is running:

```js
for (const b of document.querySelectorAll(`#tabbar button[data-tab="${key}"]`)) {
  b.classList.toggle('active', on && (b.dataset.mission ?? missionNow) === missionNow);
}
```

The `??` is what leaves every other tab alone: a button with no
`data-mission` compares `missionNow` to itself and behaves exactly as before.

**The launcher's `go()` took an id**; it takes the entry, because an entry
can now carry a mission. Picking the mission you are already in does nothing
rather than reloading the board you are looking at, and its card reads
**· RUNNING** instead of offering itself as somewhere to go.

### The probe

The tab bar collapses behind the ☰ menu, so which button is lit is not
something a screenshot can show. `?tabprobe=1` logs every button with its
mission and its state:

```
?mission=rescue2 →  td mission=""        label="TD"     active=false
                    td mission="rescue"  label="rescue" active=false
                    td mission="rescue2" label="raid"   active=true
                    metal mission=-      label="metal"  active=false
```

Exactly one of the three in each of the three cases, and a tab with no
mission at all unaffected.

---

## `1b28304` — a deep-link button on every lab

Every lab tab is a tuning surface, and the answer a tuning session produces
is a set of numbers. Until this, the only way to carry one out of the tab
was to read the sliders off a screenshot — so a look that took twenty
minutes to find could not be handed to anyone, or to yourself tomorrow.

The ↗ button copies the whole panel as a URL **and** writes it into the
address bar. Both, deliberately: on a phone the clipboard refuses often
enough that a button which only copies is one that sometimes does nothing
at all (the metal lab already learned that — *"I cannot copy paste the
value"*), and an address bar is a fallback every device has.

### Two rules make it usable rather than merely correct

**Only what differs.** A link that restates every default is unreadable,
and worse, it *pins* values that should follow the code — open it in a
month and you are looking at last month's defaults on this month's model.
The diff is the message; everything else is inherited.

**Never a `#`.** Colours live in these params as `'#rrggbb'`, and a `#` in
a query string ends the query and starts the fragment. One unescaped hash
truncates the link at the first colour — which surfaces as *"the link only
carries half my settings"* and as nothing else, so it is a test rather
than a comment:

```js
check('a colour loses its hash', encodeValue('#4b5157') === '4b5157');
```

One-shot flags — a probe, a capture, a dump — are stripped through
`DROP_KEYS`. A shared address that re-runs somebody's probe is one nobody
trusts.

### Two labs could not have read one back

`beam` and `portal` each parsed four *named* URL keys and nothing else. A
link to either would have been an address the lab ignores, which is worse
than no button — so both now take the same generic pass over their own
panel that `astro` and `metal` already had. Their named parameters
(`?sweepmode`, `?labside`, `?portalfx`) keep their own handling. `portal`'s
own comment had already asked for this — *"so a look can be linked rather
than described"* — for a single parameter; it is true of the whole panel
now.

### The units viewer already had one

And I did not notice until the probe threw: adding mine put a second
`#units-link` in the document. Its button is better placed than mine would
have been — in the viewer chrome, with a label — so mine is gone and
theirs is untouched. Worth writing down as the general shape: **before
adding a control to a tab, grep the tab for the control.**

### The probe

`?dlprobe=1` presses whichever lab's button is open and logs the URL. One
probe for all of them, because they all come through one function — and it
is the only thing that actually checks the round trip:

```
DEEPLINK ASTRO:  …?seed=99&outline=0.6&path=straight&personH=1.2&tankLen=14#astro
DEEPLINK METAL:  …?gBase=aabbcc&repeat=3.5&seed=99&spin=0&unit=container#metal
DEEPLINK BEAM:   …?seed=99&exposure=1.4&reachCells=7#beam
DEEPLINK PORTAL: …?seed=99&radius=1.4&steps=64#portal
```

Note `unit=container` on the metal line: that lab's `subject` knob is read
from `?unit=` by its own parser, so the link has to emit it under that
name or it would not round-trip the model it was tuned on.

---

## `c5d3bc3` / `1f72484` — the study gets sliders, and RESCUE 2: the raid

Two asks in one message, and the second one is a second mission.

### The study (`#astro`)

*"Make the astronaut much smaller relative to the tank. Actually put a size
slider for the tank and astronaut, and use the model for the tank that has
the texture. For the loop animation, make the astronaut walk around the
perimeter of the tank, without touching it."*

**Both sizes are knobs.** The study's whole job is to settle a *ratio*, and
a ratio settled by editing a constant and reloading is a ratio nobody
settles. Person height and tank length are metres on sliders; the HUD
prints the ratio they are making; the opening default goes 0.34 → **0.180**.
`sizeAstro` and `sizeTank` both re-derive from the model's original box
every call, so dragging a slider back and forth does not compound.

**The hull is dressed the way a cinematic dresses it** —
`applyWeatheredMaterial` with neither colour nor emissive kept, the stage's
sky as `envMap`. The first still came out a paper cut-out with a textured
barrel, because the cast *also* wears the game's blueprint pass: a white
line on every edge at 0.85, which is its read at a cell's size on a black
board and a wall of white under a lens. `cine/tankscene.js` had already
solved exactly this, so the same treatment lands for the same reason — the
lines stay as a **rim** at 0.22, `M_Glow` takes the dim cyan, and the stage
drops to the cinematic's exposure.

**The walk is a lap.** A circle about the hull at its measured *plan
diagonal* plus a clearance — the diagonal, not the length, so "without
touching it" holds at the corners and at every ratio the sliders can make.
The heading comes from the path's own tangent, never a second sign
convention.

...and the frame and the floor follow the sliders, because a fixed 5.2 m
camera sits *inside* a 10 m tank. The grid stays one square per metre: it is
the ruler a stride is measured against.

### Rescue 2 — the raid

*"Larger map, more clearings… small groups of astronauts (with the 3D
rendering)… hiding in containers… large groups of rammable enemies… within
shot distance… walk animation… into the tank. Saved. If the tank is not
static, they can be ran over and die. A little splash of red on the floor."*

**The inversion is the whole design.** In Rescue 1, stopping is how you pick
someone up. Here, stopping is how you avoid **killing** them. `runOver` and
the save share one contact radius; the only difference between them is
whether the hull was moving:

```js
export function runOver(sv, tankPos, tankSpeed, cellSide, tune) {
  if (sv.state !== 'walking') return false;
  if (tankSpeed <= tune.runoverSpeed) return false;
  return groundDist(sv.pos, tankPos) <= tune.boardCells * cellSide;
}
```

Three beats per camp: drive in (ramming the garrison is free — that is what
it is *for*), get inside shot distance so the container opens, stand still
while they walk out. A walker re-aims at the tank's **current** position
every frame, so a player who repositions is followed rather than walked
past — which matters, because repositioning is exactly the temptation.

Two rulings taken on the operator's behalf. **No gate waves:** the brief
names the threat as pre-placed groups, and a wave clock on top of that turns
a puzzle back into the defence we already have. **Saved on boarding:** the
brief ends at "into the tank. Saved.", so there is no drive home and no seat
limit.

A **garrison holds its camp** until the tank comes to it, then hunts the
tank rather than the heart — it is guarding a container, and the thing that
came for the container is the thing it walks at. Both are four-line local
overrides of the exit choice in `updateEnemies`; neither is a second nav
field.

### The GLB, and a clone written rather than vendored

The objection that put Rescue 1 on dot clouds does not apply here, and the
reason is worth stating: it was about six separate **loads** of a 3.7 MB
file. One parse plus N clones that *share* the geometry and the materials is
one upload and nine GPU-skinned meshes of 25 bones — nothing.

What it needs is a correct clone. `Object3D.clone()` copies a SkinnedMesh's
`skeleton` **by reference**, so without a rebind every clone deforms *and
stands* as one body — it looks exactly like the model failed to load.
`cloneSkinned()` in `units.js` pairs source bones to clone bones by
traversal order (clone preserves child order, so the two walks line up index
for index) and re-`bind`s each mesh to a fresh Skeleton.

Written here, not vendored: `SkeletonUtils` sits in four sibling repos'
`node_modules` and all of them ship three **r180** against this project's
**r160**. "An addon from the sibling's node_modules" is already a recorded
dead end here, from the Line2 trio.

**The splash does not fade.** It is the record of a mistake, and a mission
about carrying people out should keep the ones it did not.

### The map, and the shared seam

`points 1600`, `rooms 26` — rooms is what "clearings" means on this
generator — and **every sector open from the first frame**, because sector
gating is the campaign's spine and a raid has nowhere to progress to. Camps
sit on `dungeon.seeds`, which is exactly the farthest-point set the carve
grew its rooms from: "a camp in a clearing" needs no second notion of what a
clearing is.

`missionOn` now guards the fourteen things the two missions **share** — the
suppressed campaign systems, the briefing, the endings — while each keeps
its own flag for its own rules. Writing `rescueOn || rescue2On` at fourteen
sites is how the third mission breaks one of them.

### One bug the regression caught, not the eye

`startRescue2` reset the shared `rescue` object **before** its own guard, and
it runs after `startRescue` — so it wiped Rescue 1's survivors on every board
it built. The probe said "nobody stranded"; nothing threw. A shared object is
reset by the owner of the mode, never by its neighbour.

### The probes

```
RESCUE2PROBE far   open=false out=0 SHUT — correct
RESCUE2PROBE call  open=true out=2/2 doors=1.00 models=1 OPEN, WALKING, RENDERED
RESCUE2PROBE hold  saved=2 lost=0 walking=0 THEY REACHED THE TANK
RESCUE2PROBE over  lost=2 splashes=2 speed=5.00 c/s RUN OVER, AND THE RED STAYS
RESCUE2PROBE end   ended=true saved=3 lost=4 THE CARD FIRED
```

`?campgo=N` parks the hull just inside camp N's shot distance and leaves it
there — the probe blows through the whole sequence in one tick, so there is
no frame in it where a container stands open with people walking out. It
fires at t+5 s, **after** the berth deploy, which drives the hull and would
otherwise undo it.

---

## `8a0825c`…`1c54f9d` — the RESCUE mission: six stranded, two seats, no resupply

`#td?mission=rescue`. The operator's brief was one paragraph — *"a handful
of astronauts stranded, requires smart use of limited mines and shells to
save; lots of rammable enemies and just a handful of more difficult one to
manage; more tactical"* — and every decision taken on top of it is flagged
in `docs/superpowers/specs/2026-09-05-rescue-mission.md` with the reason,
so it is cheap to overrule after a play.

### A variant, not a second game

Same planet, same tank, same gates, same mines. Two things change — the
**objective** and the **supply** — and everything else the board already
does is exactly what a rescue needs. `?mission=` is the seam every later
mission hangs on.

### The three rules that are the mode

**They strand on the LANES.** Six survivors, six to fourteen hops from the
Stalheart, on open cells with a finite heart distance — which in this
dungeon *is* the flow the horde walks. So the threat arrives without a
second BFS field, and the map reads: the people you must save are standing
in the road. An enemy within two cells of one peels off toward it — a short
local override of the heart-seeking exit choice, four lines inside
`updateEnemies`.

**The stop clause.** Boarding needs the tank NEAR *and* SLOW for a whole
second, and the clock resets the moment either stops being true:

```js
const slow = Math.abs(throttle) <= rescueTune.boardThrottle && !cruise
  && !keys.fast && !keys.slow;
```

Read off the CONTROL, not off the motion — a tank coasting with the
throttle open has not stopped, it is about to move again. Without the
clause a pick-up is something that happens while you drive past, which is
not a decision; standing still in the open with the horde coming is.

**The grab window.** An enemy reaching a standing survivor does not kill
them, it holds them for 1.5 s. Kill it inside that window and they stand
back up — and there is no bookkeeping at all, because the model is just
"is anything in contact right now", asked every frame. A rescue lost in a
frame you never saw is one nobody feels they lost fairly, and 1.5 s is
exactly one shell, one ram, or one mine you had the sense to lay earlier.

Two seats, and anyone in the hatch when a hull goes is lost with it. That
is the only way a survivor who was already *safe* dies, and it is what
makes carrying a pair a bet rather than an optimisation.

### The budget IS the mission

```
hulls 3   shells 8   mines 6   lasers OFF
```

Given once, never again: no towers, no orbital asset, no Terraformer, no
pickups. The beams are stripped because they cost **heat, not ammo** — with
them fitted "limited shells" means nothing and the mission is a driving
exercise. `?lasers=1` refits them; it is the most overrulable number in the
file.

The chrome for all four suppressed systems is *hidden*, not left lying: the
launch console (`display`, not a class — `syncArmUi` owns the class and
would put it back), the Terraformer line, ISAO's line, the portals/sector
objective row, and the key legend, which is the one line of chrome that
tells you what game you are playing. A HUD that reads out the wrong
objective is worse than a blank one.

### The placer degrades its spacing, not its party

The first live run stranded **four of six**: sector 1 is a deliberately
tight board (84 open cells) and three cells of spacing would not fit them.
That changes the mission's difficulty for a reason that has nothing to do
with the mission — so `apart` became a *preference*, tried and relaxed
3 → 2.5 → 2 → … until the whole party fits. The party size is the design;
the spacing is the taste. `short` now only reports a genuinely impossible
board, and the verdict scores out of what was actually **placed**.

### What you see

`personPts()` in `creatures.js` — a suited dot-cloud figure with **one arm
up**, because the wave is the only pose that says "over here" from orbit,
so it is built into the geometry rather than animated. `makeSurvivor()` in
`units.js` adds the beacon: a column of dots climbing out of the helmet and
fading. A static figure at twenty pixels is a smudge; a smudge with
something rising out of it is a person. Grabbed turns both red and *stops*
the column — the thing that says "over here" going still is the alarm. On
the radar, an orange chevron that does **not** decay with the sweep: a
survivor is not a contact you have to hunt for, and phosphor decay would
make a person flicker.

Deliberately NOT the astronaut GLB. It is 3.7 MB of skinned mesh with 25
bones; six of them animating at this scale is a phone-tier disaster for
something occupying twenty pixels.

### The probe

```
RESCUE stranded=6/6 apart=2c shells=8 mines=6 hulls=3 lasers=OFF
RESCUEPROBE past  throttle=1 aboard=0 boardT=0.00 NOTHING HAPPENS — correct
RESCUEPROBE load  stopped aboard=1 state=aboard ABOARD
RESCUEPROBE seats aboard=2/2 third=standing THE HATCH IS FULL
RESCUEPROBE home  saved=2 aboard=0 standing=4 DELIVERED
RESCUEPROBE end   ended=true saved=2 lost=4 THE CARD FIRED
```

`?survivors=N`, `?lasers=1`. `test/rescue.mjs` pins the rest with no
renderer, including the spacing degradation and the verdict scoring out of
what was placed.

### Three holes the verification found, and none of them by reading

Worth naming, because all three were invisible in the code and obvious the
moment something ran.

**The stop clause was desktop-only.** It read the throttle, and the phone
has no throttle — the stick and tap-to-go drive the hull with the lever
sitting at zero, so every drive-by would have boarded and the clause that
*is* the mode would have silently done nothing on the shell. It reads both
halves now: the control is not asking for speed, **and** the hull is
measurably under `boardSpeed` cells per second. The probe grew the beat
that catches it — lever at zero, hull rolling across the beacon — and that
beat passes only because of the second half.

**Killing the gates threw the campaign's victory modal** over a mission
with four survivors still standing in the road. Shutting the spawns off to
ferry at leisure is a legitimate plan and rather a good one; it just is not
a win. `checkVictory` belongs to the campaign.

**A 170-second soak ended "the heart is lost" at 0/6.** On this mission the
Stålheart is where you *deliver* people — making it a second thing to
defend adds an objective the brief did not ask for, and loses the run to
something the player was never there to stop. It takes no damage on a
rescue; the creature is still consumed, so the field clears the same way.
Re-run: "the field is clear", and no runtime errors across the whole three
minutes.

And the ending is now an ending: `endRescue` sets the same run-over flag
every other ending uses, and `loseGame` returns straight after it instead
of falling through to a verdict that counts sectors, towers and portals
this mission never had.

### And the astronaut question the handoff asked

`docs/RESCUE-MISSION-NOTES.md`, answered from the file rather than from
memory: `astronaut.glb`'s rig **is** a Mixamo skeleton with a rename
applied — same bones, same parenting, same T-pose rest — so a Mixamo clip
retargets by a *string map over the animation tracks*, no re-binding. One
trap, and it is the kind that silently produces a broken idle: **the spine
triple is named in reverse** (`Spine02` sits at the hips, `Spine` carries
the shoulders), so those three map by position, not by name.

---

## `f30d91d` — the mines: a claymore you place, not a shot you aim

The fourth way to put a shell's worth into the hordes, and the first one
that is a *decision made in advance*. The operator's rulings from
2026-09-04, built as written: **B — claymore, directional**. Instant on
trigger, damage in a forward arc, no fuse, an **arming window** after the
drop. Laid **one cell in front of the tank**, facing the tank's heading
at that instant — which is the whole reason the shape was chosen. Lay
them while driving *backwards* and every drop faces what you are
retreating from, and the field grows between you and it. The tank trips
its own mines and takes the damage; a claymore does not know whose it is.

### The rules are a pure module

`src/mines.js` has no DOM and no three.js: supply, arming, the trigger
fan, the blast arc, the chain, the rack cap, and every refusal
(`'empty' | 'blocked' | 'occupied'`). `test/mines.mjs` pins all of it
with no renderer.

The geometry is a **wedge in polar coordinates on the surface** — an
angular distance from the mine and a bearing off its axis:

```js
const a = dot3(p, n);                 // along the mine's normal
const flat = sub3(p, scale3(n, a));   // the tangential part
const dist = Math.atan2(len3(flat), a);            // = ARC LENGTH
const off  = Math.abs(Math.atan2(dot3(u, side), dot3(u, mine.dir)));
```

`dist` is the standing rule — arc length, never a chord — and on a unit
sphere the arc length from a point *is* the angle in radians, so
`cells * cellSide` converts with no factor at all. `inFan` is that wedge
cut short (1 cell); `inArc` is the full 2.5. Nothing behind a claymore
can be caught, and that falls out of the shape rather than out of a
special case: astern is more than 90° off the axis and the half-angle is
60. The suite pins it anyway, because the obvious wrong implementation —
an unsigned distance along the axis — fires the thing backwards and
passes every forward test.

The **drawing uses the same geometry backwards**. `minePoint(m, cells,
th)` is those polar coordinates inverted, and every dot of the disc and
every vertex of the fan is placed with it, so the picture and the hit
test cannot drift. The fan's rays are polylines along their own great
circles: one straight line to a tip 2.5 cells out sinks through the
ground, which is the mistake the beam made three times.

### The board owns the effects and four doors

A blast hands the module **one array of points** — enemies, then live
gates, then the tank — and gets back indices. That *order* is the
contract that routes each target, built in one place so the three cannot
disagree. A gate now takes a shell through **one function**,
`gateTakesShell`, extracted out of the projectile loop: "a mine hurts a
portal as one shell" is only true if it goes through the same code and
not through a second copy of it.

The chain is a **queue**, not a loop: mines caught in a blast trip on
*following frames*, nearest first, so a laid row goes off as a row rather
than as one flash.

Mines arm **through the build downtime**, deliberately outside the frozen
block. The brief is "place them at chokepoints during downtime"; a mine
that starts its two seconds when the next wave opens is a mine you cannot
pre-place. Nothing is moving to trip them there except the tank, which
does drive in build mode — and driving over your own mine going off is
correct.

### Supply, and where the case comes from

The Terraformer prints a case of five every third wave, on its own clock
**outside** the hull/container `else if` chain: a case is not a container
and does not occupy the print bed, and making it compete for the
milestone would starve the yard the player counts. The debrief sells a
case for 200 kg beside the spare hull and the strike. The rack caps at 20
and says out loud what was lost over the cap.

### What you see, and what you press

A dot-cloud disc with a ring — dim while arming, lit when live — a red
fan on the ground, and a friendly-blue arrowhead on the radar pointing
along the arc, hollow while arming, so a laid field reads across the
scope as a row of heads all facing the same way. `params.mineArcs` and
`?minearcs=0` hide the fan: the secret-field modes the operator named.

`N` lays one. On the phone a third pad sits **above** FIRE — a tap, not a
hold, because a held mine pad empties the rack in a second, and the
bottom row belongs to the two controls the thumb holds down.

### The probe

`?mineprobe=1` drives the board's own `stepMines`, three beats:

```
MINEPROBE A laid 1:laid 2:laid 3:laid rack=7 hp=3 arcs=on
MINEPROBE blast id=3 targets=1 kills=1 chain=[]
MINEPROBE A done blown=1/3 ONE trip, no chain — the arc points away from the row
MINEPROBE B laid 1:occupied 2:occupied 3:laid rack=6
MINEPROBE blast id=1 chain=[2,4] → blast id=2 chain=[4] → blast id=4
MINEPROBE B done blown=3/3 THE ROW WENT OFF AS A ROW
MINEPROBE C lay=laid behind=SAFE inFront hull 3->2 FRIENDLY FIRE LANDS
```

Beat A is the ordinary case and it is *supposed* to leave two standing.
Beat B walks the phage in from behind, so the near mine's arc holds the
other two. Beat C parks the hull at its own mine's back (safe) and then
in front of it (−1). `?minelay=N` lays a row and leaves it there — the
probe blows everything it lays, so there is no frame in it where a field
is standing to be looked at.

Not built, and named so they are not lost: fused mines (A), two kinds
from one pool (C), the Vulture that pops out and chases (D).

---

## `0506c0c` — the metal on the board, the tab bar in groups, the astronaut study

"Add the metal effect to the default game." Every cast the board makes is
dressed now — tank, containers, Terraformer, gates — at the tier's size,
*keeping* the grey ladder's colour and emissive, because the board is
lit at hemi 0.55 / sun 0.25 and the rungs are why the machines read. Two
stills said the maps did nothing at all, and both reasons were physical.
A metal shows what it *reflects*, and the board's materials had no
environment: the dressed materials take the board's own sky bake through
PMREM, on the casts only, so the wire stays what it is. And under that
light the rung's *emissive* is most of what you see, so a map that
modulates only the diffuse term is invisible — the emissive takes the
albedo as its map too. A `board` preset is a detail overlay, a near-white
base with a lighter oxide, so the mottle and the pits modulate a rung
instead of dimming it. `?metal=0` returns the flat cast.

The tab bar is five labelled groups — play, studies, cine, research,
tech — and collapses to home plus the active tab as before. `#astro` is
the astronaut study: `assets/models/astronaut.glb` is a Sketchfab rig
with one mesh, twenty-five bones and one 1.03 s walk clip, on the lab
stage with a clip picker, root motion, the skeleton, and the MK-CX/2
beside it at the game's ratio (1.8 m to 5.3 m) — the rescue mission's
first read.

---

## `c246c0e` — the tank is cast at its play size from the first frame

"The tank got enormous … and now it seems fixed, weird." `buildActors`
set a fresh cast to its *base* scale alone (~27× the tank) and relied on
`placeActors` to multiply the unit scale in; `placeActors` runs on
events, not per frame, so anything that skipped or threw between the two
left a giant on the board until the next regenerate. The cast takes
`unitScale × base` from the first frame now. A two-step size is a window;
the first step is the final value.

---

## `82880d8` — the shell watches its own camera

Build `42e61776`, two phone screenshots: the eye at deck height looking
down the corridor, the secondaries firing from the bottom edge, no tank
— "recurring", "a game stopper on mobile". Every reading of the code says
the shell cannot be in first person (`setView` folds it; only the `2` key
and a probe ask for it), and the pose cannot be read on the device. So
the shell watches for the *symptom*: in DRIVE with no shot, no deploy
and no pause, the tank out of the camera's frustum for 1.5 s is a stuck
camera, whatever stuck it. The watchdog ends any shot, forces third,
snaps the goal, and paints what it found — view, build, shot, deploy,
camToTank, cur/next — on the caption lane so the next screenshot carries
the cause. `?viewwatch=0` turns it off. Belt and braces: the pose folds
pov to third on the shell, and the mode button names its destination —
DRIVE ends any shot, sets third and snaps: the reset button.

One more, found by the watchdog's negative test: `?view=orbit` at boot
called `showBrief` before the director block's `let director` had run —
a TDZ ReferenceError, uncaught, the tab half-initialised. Every guard
that yields to the director is reachable from boot, so the declaration
lives with the early state now.

---

## `8148cc1` — the shell's chase eye looks nearer the tank

"On mobile I still do not see the tank — it's stuck too high or too
forward", on the build that fixed the tutorial's handoff. The pose
explains it: the shell's eye rides lower behind (0.78, the earlier ask)
but the look point stayed 1.4 cells *ahead* of the tank, and a low eye
looking far ahead puts the tank at screen-y −0.43 — the bottom fifth of
a phone's short landscape viewport, under the stick and the fire pad.
The look point decides where the tank sits in the frame, not the eye's
height: the shell looks 0.45 cells ahead now and the tank rides a third
up the frame; the replica after the handoff paints
`tankScreen=(0.00,-0.25)` on the caption lane. The desktop keeps its
look-ahead. Also today: the metal's default is the operator's read
(medium grey, half-metal oxide at 38%, their light), and COPY shows the
preset on screen.

---

## `283ba81` — the metal lab on a phone, and the sides of the metal

From the phone: "on mobile it's impossible to tweak" and "the sides
should be covered to display the texture, currently from the side it
looks paper thin". The panel is a bottom sheet on a coarse pointer or a
narrow screen — full width, under half the viewport, scrollable, rows a
thumb can hit — with a gear to hide it; the shell's coarse block hides
every `.lil-gui`, so this one says `display: block` back. Measured, not
eyeballed: 0..908 × 226..418 on the phone's landscape viewport, through
the TD tab's `?coarse=1` rewrite, which moved to `main.js` so any tab can
be verified that way. The sides: repeat 1 / normal 0.6 read as paper; 2 /
1.0 shows the plate, and a rim light from behind keeps a side against
the sky from going black. Every knob is a URL param and `?az=&el=&dist=`
aim the camera, so a still can test a setting. The red box with a
diagonal across the container was the outline slider un-hiding a line
set the cast ships hidden; the slider only touches line sets that were
visible when the cast was built.

---

## `a5e2259` — a bare part gets a box-projected uv at the merge

`mergeByMaterial` kept `uv` only when every part of a batch had one, and
the ring's pod parts came without: one bare part dropped `uv` for the
whole batch, so the pods wore the dark base while the plates wore the
weathered metal. A part without `uv` now gets a box projection in its own
frame — the two coordinates across its normal's dominant axis, one model
unit per repeat — the standard fallback, and every batch keeps `uv`. On
the ring: 35 materials dressed, `M_Steel` and `M_Rubber` with all five
maps. The launch-mode capture also retries a cold first frame once.

---

## `18e2b0a` — the tutorial's handoff hands back DRIVE on the shell

The operator's phone, build `1974eb11`, a fresh start: "the camera starts
too high, the 3rd person view does not work for drive." The screenshot
had BUILD lit and the eye over the board. The tutorial's build phase
calls `setView('orbit')` and nothing in the tutorial ever took the view
out of it; on the shell orbit *is* the build eye, so a fresh player who
finished the tutorial was parked 14.7 cells over the board. The handoff
sets third on the shell now; the desktop keeps its post-build framing.

Measured both ways, which took a replica that could reach the handoff at
all: `?tutstep` clears scripted pairs, but the build phase ends on a
*tower*, which no clear can stand in for — it places one on the nearest
legal cell now, and the state probe runs 140 s and names the tutorial
phase, the open modal and build mode. After the handoff: `view=third
build=false camToTank=3.5cells`. With `?handoff=0`, the negative control:
`view=orbit build=true camToTank=14.7cells` — the phone.

One thing the replica also showed on the way: a fresh shell start with
the tutorial off sits paused at the deploy under `#td-msg` — the
briefing, by design, waiting for PLAY.

---

## `ed67eaf` — GATE v2 and PLANET v2 on the director

**THE PLANET v2** — "lived-in, regular game elements going on" — is the
board under an orbit camera with the game on it: towers at the heart and
the gates, a wave down two lanes, drifters from the far gate, the tank on
AUTO; then a cut down to a graze beside the tank and a cut back out. Two
things the orbit needed. The board draws only the carved sector, so from
three radii out the world was a lit fragment on nothing: a script with
`globe: true` draws every quad edge of the board's *own* sphere mesh,
faint, under the sector — the game's pipeline, not a second one. It has
to sit **above the wall tops**: the uncarved cells are dark rock with
walls, and a globe at the planet's radius drew nothing at any opacity
through three probes — in scene, visible, radius 1, camera at three
units, far plane 60, all logged — until `?glober=1.6` filled the frame
and named the occluder. And the orbit frame faces the heart, z out
through it, so a key at `[0, 8, 40]` hangs above the action; world axes
had put the sector on the limb.

**THE GATE v2** — "a normal-sized portal on a built planet, with towers
and enemies and the tank; starts like a wormhole, then brings us into
the action" — is the cine tab's wormhole beats at 720p (CDP capture
works under the hang width; 240 frames in 63 s) cut to a director
script: one gate raised seven to eleven hops out, two rapid towers on
it, eighty phage and four drifters pouring out, the tank arriving to ram
it, a cut to the chase. `renders/gate-v2.mp4` is the two halves
concatenated, 30 s.

---

## `1295b08` — THE STRIKE v2: a dual portal, a large wave, the console, the fall, the crater

The operator's ruling: the strike hits a *dual portal* from which a large
wave emerged — dramatic. The director gained what that needs. A `gate`
verb raises gates side by side, N hops from the tank (`addSpawnPoint`
takes a cell now); `spawn` may pour from the raised pair alternately;
`strike` may target them. Rail keys carry `at`, the frame a key is
authored in — `tank` (the chase rig), `gates` (the raised pair's
midpoint, facing the tank) or `target` (the strike's cell) — and the
frame switches at the key, as a cut. **The rail holds across a cut**:
between two keys in different frames it keeps the earlier pose until the
later key's time, because blending a tank-relative pose toward a
target-relative one had walked the camera four cells ahead of the tank,
into the Terraformer.

The script runs 32 s: in front of the dual portal as 150 phage, ten
drifters and four coronas pour out at the lens; the cut to the tank and
the console; the safety and the launch at 12 s; the board's own strikecam
riding the munition down ("TGT CELL 1027 · 9780M"); two portals off the
board; the rail back on the crater as the survivors scatter under the
radar's red arcs. `renders/dir-strike.mp4`.

---

## `3b9afc1` — the metal lab

"Sliders to arrange the look and feel on large models of the Tank /
Container / Isao / Terraformer / Portal in a separate tab." `#metal` is
that tab, in the beam lab's idiom — a tuning surface that is a *client*
of the thing it tunes. It casts the same objects `units.js` makes,
normalised to lab scale on a floor that takes the shadow, under the
cinematics' light (the galaxy bake as sky and environment, a key, a fill,
ACES, bloom), and dresses them with the same `bakeWeatheredMetal` and
`applyWeatheredMaterial` the cinematics call. The sliders are the bake's
own knobs per preset, the binding's (repeat, normal scale, the tint
ladder, the outline rim, the glow parts) and the light's; a change
rebakes, debounced; the HUD reads the bake back the way the test does;
COPY emits the presets as source for `weathered.js`.
`?unit=tank|container|isao|terraformer|portal`.

---

## `3e7efe4` — the director: a cinematic is a scripted run of the board itself

The operator's second direction, after the night's three clips: 720p is
enough while the direction moves, and every cinematic they want is *the
game* — the tank ramming through two hundred phage with a torus boss and
the radar zooming on the proximity danger; an orbital strike with the
safety, the launch and a live target; a gate that opens as the wormhole
and lands in the action on a built planet; the tank starting engine-off
and spooling for the hydraulics. A scene that draws those from a
separate file is a second copy of the board, the one thing this project
has refused to copy. So the cinematics moved *into* the board.

`#td?director=NAME` runs a script from `src/cine/scripts.js` — pure data,
Node-tested: a rail in cells, in the tank's own frame at every frame (a
chase rig: "behind-left, low" stays behind-left as the tank drives), and
cues the board executes when its clock crosses them, the way the sound
rail's do. The verbs are the closure's own functions: `spawn` queues at a
gate, `goto` is `gotoCell`, `strike` presses the real safety and launch
buttons, `engine` is the spool-up and `stopEngine`, `radar` scales the
scope's canvas in place. With `?capture=1` the loop is *held* from the
first frame and the capture harness steps the sim at 1/30 s through
`installCine`'s `seek` — the cine tab's seam — and `Page.captureScreenshot`
takes the whole page, radar and console included, at 720p, under the
width that hung the M4. 900 frames in 100 s.

Four things the first RAM captures taught, each read off the state line
the director prints every two seconds (`?dirlog=1`), never off a still:
the tank stood at the berth because the pre-roll had not waited for a
berth exit that is staged *after* the models land (`deploysDone`); the
queue held 200 and the tank held still because **a shot freezes the
sim** — the cold open's rule, exactly wrong for a scripted run, so the
director's shot is exempt from both freeze gates; a `goto` from the
berth is refused for want of a path and now retries per frame; and two
hundred phage reaching the heart ended the run and the shot with it — a
scripted run cannot be lost (`heartHit`, `loseTank`, `destroyPlayer`,
`loseGame`, `checkVictory` all yield under the director), Isao's briefs
are silenced, and the rail comes back whatever ended it.

`renders/dir-ram.mp4` is the first run: the tank out of the berth, up the
lane through the crowd, through the gate with the knot on it, the radar
at 2.8× with the arcs red, then on to the heart.

---

## `69c6240` — phase 4: the sound rail, and the capture sizes its own frame

The ruling was that a cinematic re-uses the game's own sounds where one
fits and is space silence where none does; no new sound is authored.
`src/cine/sound.js` is the rail per scene — cues `{ t, key, gain }` over
`audiomanifest` keys — pure and Node-tested (in range, sorted, every key
in the manifest). Two clients read the one rail so they cannot drift:
the cine tab fires a cue through the game's own `sfx` the frame the
*live* clock crosses it, never on a seek (a capture is silent), and
`scripts/cine-mux.mjs` lays the same cues onto a finished clip with
ffmpeg — `adelay` per cue, `amix` without normalisation so each cue
keeps its level, trimmed to the picture. THE GATE: the throat's warning
as the march flies out, the tension under the pull-back, the alert as
the swarm comes through. THE PLANET: silence, then the tension under the
graze. THE TANK: the engine under everything, three mains, the spool,
the beam, the spool down, the thruster on the roll-out.

**The capture sizes its own frame now.** One clip's frames came out
1920×1167: headless Chrome's 87 px bar was inside the canvas that run
and not the others, so the scene composed at the wrong aspect and
libx264 refused the odd height. The page takes `?size=WxH` and sets the
drawing buffer to exactly that (`setSize` with `updateStyle` false,
pixel ratio 1); the capture script passes it. The canvas is the frame;
the window is irrelevant.

---

## `f3bd75d` — phase 4: the film pass

Letterbox, grain, vignette and a title card, drawn *in the canvas*. A DOM
overlay would be the easy way and the wrong one: the capture reads the
drawing buffer (`kit.js` `frame()`), so anything outside the canvas is
not in the clip. `src/cine/film.js` is a `ShaderPass` appended after the
`OutputPass` — `postfx` gained `addFinalPass`, and the composer renders
its last enabled pass to the screen, so appending is enough — in display
space: a 2.39:1 letterbox inside the 16:9 frame, a vignette, grain hashed
from `(pixel, floor(t·24))` so a seek lands on the same grain as a
play-through and two renders match, and a title card in the game's own
CRT face (VT323) drawn once on a 2D canvas and faded by an envelope that
is a function of t. The tab waits for the font to load before drawing
the card, and a capture's single draw waits for the card; a title drawn
before the face lands is the fallback font. `?film=0`, `?bars`, `?grain`,
`?vignette`, `?title=0`.

---

## `f2f5c67` — the wire survives at 4K

Phase 2's "done when" and the plan's item 10. The first 4K still of the
gate's landing showed the planet as a hairline: a 1-px GL line at 3840
wide is nothing, and the planet's identity goes with it. three's Line2
addons draw a line as screen-space quads with a width in pixels. The
sibling's `node_modules` carry three **0.180**, not the r160 the plan
assumed; every symbol the trio imports resolves in r160, so the three
files are vendored with their imports rewritten and loaded on demand
(`planet.js` `widenWire`) — a failure to load or compile leaves the 1-px
wire and says so in the console, and the still is the test. It loaded,
compiled and drew.

Two things it needed. The width is in pixels of the material's *own*
`resolution` uniform, which the first probe read off an unsized canvas
("3px at 300x150" for a 1280×720 frame), so every scene sets it from the
drawing buffer per draw. And the load is asynchronous: a capture draws one
frame when `ready()` says so, and the import lands after the ring does, so
the first gate 4K still still had the thin wire; every scene's `ready()`
waits for the wire now.

Width follows the frame height — 3 px at 1080p, 6 at 4K, 2 at 720p — on
THE PLANET, the gate's landing and the tank's world alike. `?wide=N`
overrides; `?wide=0` is the 1-px line. `renders/gate-4k-wide-t11.9/` is
the still, next to the thin one.

---

## `edb6022` — cinematics phases 2 and 3: THE PLANET and THE TANK

Two new scenes on the cine tab, `?scene=planet` and `?scene=tank`, both
drawing the game's own things at a cinema tier, both set from t.

**THE PLANET** (`src/cine/planetscene.js`) is the wire world at the
board's default resolution — `generateSphereMesh` + `relax`, the
`tronColors` edges and body — under the galaxy bake, with the one thing
the game lacks: an atmosphere, as two fresnel shells, a rim just off the
surface and a haze past the limb. Wide, then close, then a graze over the
cells, then back out to the silhouette THE GATE lands on. The planet is
7.8 m in radius, the gate's measured number, so the last beat here is the
last beat there minus the ring — a rhyme by construction.

**THE TANK** (`src/cine/tankscene.js`) is the MK-CX/2 by `buildCreature`,
on the beam lab's exact client contract — planet at the origin, tank at
the pole, +Z a tangent — on a 40 m world with 3.2 m cells, so the hull is
five metres and the ratio is the game's. Three shells as `makeBulletCloud`
tracers; the recoil as tankfeel's own `applyTankFeel`, its countdown
written from the shot times so a seek lands where a play-through would;
the plasma as beamdraw's rig at four times the board's plume points; a
muzzle flash as a sprite plus a point light that touches the hull; then
rolling out over the wire. The cast has no muzzle callout, so the tip is
measured off the barrel's own +Z extent and kept as an empty under
`Barrel_Pivot`, where it recoils and traverses with the gun.

**The merge keeps `uv` now.** The first tank still was a paper cut-out,
and `?matprobe=1` said why twice over: `mergeByMaterial` deleted every
attribute but position and normal so that batches could merge at all, so
*no* merged model — ring, tank, container — could wear a texture, and the
weathered metal had found every batch uv-less. A batch keeps `uv` if every
part has it; one part without would make `mergeGeometries` return null
and the model fall apart, so that batch drops it. The board binds no
maps, so a kept `uv` is inert there; on the cinema tier all ten of the
tank's hull materials take the maps. What was still white after that was
the game's own blueprint outline pass at 0.85 and the glow parts' white
emissive — both named by a `BRIGHT` probe line before anything was
touched. The outlines stay, as a rim at 0.22 (`?outline=N`); the lift
emitters, deck strips and turret drum take the CRT cyan, dim.

The dark base (`CINE_BASE`) lives in `cine/materials.js` now and applies
by name before any map, so a material without `uv` is a flat dark metal
rather than the board's emissive ladder.

---

## `5b68538`..`c5d46b0` — cinematics 1c: the crossing, and the landing

Beat 3 of THE GATE was a drift. It carries two things now.

**The crossing.** Five phage — the wave-1 swarm, white belt, "hunt its
source" — pour *out* of the gate toward the retreating camera from 7.5 s,
starts 0.3 s apart, on lanes inside the 1.8 m clearance that widen as each
body comes on, so the swarm spreads past the lens instead of converging on
it. The crossing is a depth composite and nothing more: the aperture's
disc is opaque on the plane z = 0, a body behind it is hidden and a body in
front is drawn, and a phage emerging is exactly the part of it that has
crossed. The plan's screen-space refraction was cut — new shader work on
the wide-canvas geometry that hung the M4 for thirty bisect runs.

`src/cine/cloud.js` draws a dot enemy at cinema density. The generator is
not touched (`creatures.js` is a verbatim port of the lab) and densifying
is a property of the cloud, not the shape: every base point becomes one
hard core point plus nine halo points scattered by a seeded gaussian, both
size-attenuated so the body grows as it comes at the camera. `units.js`
exports `dotShapePts` so the cinematic densifies the game's own creature
rather than carrying a copy. Judged on stills at 9.6 s and 11.4 s: the
first cut read as cotton, the lander's skeleton lost under its own glow;
the core is bigger and the halo tighter and dimmer now, and the legs and
capsid stay legible with the glow as a rim on them.

**The landing.** The operator's own open question: the ring should end at
the size it has in the game, in a game-world. `src/cine/planet.js` runs
`generateSphereMesh` + `relax` — the same two calls `td-tab.js` makes — at
420 points and draws the quads' edges in the `tronColors` look's own edge
material over a dark body that receives the sun's shadow. No dungeon, no
HUD, no enemies, no tank. **The scale is measured, not chosen**: the gate
scene already computes `k`, the factor that brings the cast's aperture to
1.8 m, and a unit-radius board sphere scaled by `k` *is* the board's
planet at this ring's scale. It came out 7.8 m in radius with 0.64 m
cells — the gate spans about three cells of a twelve-cell-radius world —
which is the game's real proportion, and not the forty-metre guess made
before the number was read. The rail's last key backs off to 22 m so the
disc reads as a planet and not a ball, the ring in the upper third, the
phage coming past it.

One thing the probe caught on the way: `applyWeatheredMaterial` now
dresses a material only if *every* mesh wearing it has a `uv`, and on the
ring that is 5 of 35 — the main batch. The other thirty are the pods'
cloned materials, whose meshes carry no `uv`; the earlier "35 dressed" had
them sampling one texel each.

---

## `161ac51` — cinematics 1b: weathered metal from a seed

The gate's ring wore flat greys because the game lights nothing, and a
cinematic lights its metal. The plan wanted the weathering to be a
material rather than a paint job — procedural and seeded, so it obeys
"deterministic everything" and ships in kilobytes. It does: nothing is
shipped, the maps are baked at load from a seed.

`src/weathered.js` is the baker, pure and Node-tested. Value noise on a
mulberry32 table (no SimplexNoise vendored: every other seeded field in
the project is one stream from one seed), fractal-summed, with integer
per-axis lattice periods so that every map tiles by construction — the
test measures the seam and holds it under 3/255. Per-axis periods are what
let the scratches be anisotropic (a 64:8 stretch) and still not show a
join. Three RGBA map sets come out: albedo, ORM, normal.

**The ORM packing is forced, not chosen.** three r160 reads `roughnessMap`
from the GREEN channel and `metalnessMap` from BLUE (`aoMap` from RED), so
the research note's single-channel `RedFormat` maps would have fed both a
hard zero — a texture with one channel samples as `(r, 0, 0, 1)`. AO,
roughness and metalness in one RGB texture is glTF's own convention, reads
correctly in all three slots, and is one upload instead of three.

The patina is teal-verdigris by the night's ruling: rust-orange is the
drifter's belt and violet is barbed, prime, and the throat light already in
the scene. Oxide takes patches, not the surface — the first cut covered 59%
of it, measured by the bake's own coverage number (counted from the mask,
because `metalnessMap` alone cannot tell corroded steel from rubber, which
is never metallic anywhere), and the threshold moved until it sat near a
sixth.

`src/cine/materials.js` is the three.js side. One bake per *preset*
(gunmetal / steel / rubber), cached by its knobs, and a walk that dresses
any model in place by the `M_Armour` / `M_Steel` / `M_Detail` / `M_Turret`
/ `M_Track` / `M_Rubber` names `units.js` already uses for the container,
the crane, the ring and the MK-CX/2 — one baker, every asset, no copies.
The ring's grey ladder survives as a per-name tint multiplying the albedo,
which is what a material's colour *is* once a map is bound; five bakes for
five rungs would be five seconds and sixty megabytes for a distinction a
multiplier makes. Two things a DataTexture does not do by itself: it
defaults to nearest filtering with no mipmaps (a lookup table's settings,
a screen-door under a raking light), and a map bound to a mesh with no
`uv` attribute samples one texel for the whole surface. The ring's
`M_Steel` and `M_Rubber` batches come out of `mergeByMaterial` without a
`uv` (`?matprobe=1` prints it now), so a material is dressed only if every
mesh wearing it has one; the honest fix — UVs surviving the merge — is
named in `glbmodels.js`.

Judged on stills at t=8 and t=11. Repeat 1 and normal 1 on the ring's UV
scale read as **brushed steel**, the machined finish the note itself warns
against; the scratches got shorter and shallower, the pits took more of
the height, and the gate binds at repeat 0.5 / normal 0.6. `?wrepeat=N`,
`?wnormal=N` and `?weather=0` are on the URL for the next judgement.

---

## `12c5c29` — the slow field keeps its reach and loses its cost

The operator's question from the stress probe — "do fps go down MORE with
huge waves AND lots of slow towers, because the tower effect must link to
all units?" — was yes, and `?stress=8:60&perf=26` says by how much. Eight
slow towers over a crowd: `towerXenemyInRange=231` predicted `liveBolts=190`
and `liveBursts=237`, and the scene carried 520 children. The tether drew a
lightning bolt *and* a 12-point dot burst per hostile per shot, so the
picture cost tower × enemy while the mechanic cost nothing — a slow is
`slowFactor` and `slowUntil` written on an enemy.

The split is the fix. The field stays universal; the picture becomes
bounded. Every hostile in range is still slowed, the nearest three get a
bolt, and nobody gets a burst at all. The nearest three are also the three
the player is watching, so the read improves rather than degrades: three
legible arcs onto the front of the crowd instead of forty overlapping ones
onto all of it.

```js
const near = [];   // { e, d }, ascending, at most SLOW_BOLTS
for (const e of enemies) {
  ...
  e.slowFactor = eff.slowFactor;
  e.slowUntil = tNow + eff.slowDur;
  let i = near.length;
  while (i > 0 && near[i - 1].d > d) i--;
  if (i < SLOW_BOLTS) { near.splice(i, 0, { e, d }); if (near.length > SLOW_BOLTS) near.pop(); }
}
for (const t3 of near) spawnLightning(muzzle, t3.e.pos, tw.def.color, tNow);
```

The nearest-three selection is a three-slot insertion inside the pass that
already walks the crowd to apply the field, so nothing is sorted and no
second traversal is added.

Same probe, same instant, after the change: `liveBolts=12`,
`liveBursts=1`, 107 scene children — against 244 tower-enemy pairs. The
effect's draw cost is bounded by the tower count alone now, and a crowd is
free. Measured both ways with the fix stashed and restored, so the
before-numbers are this machine's, not a memory of them.

---

## `a9b4d6f` — the katakana パ was Jekyll

The Bridge and Shikaku minigames showed only their パ mark on Pages while
HDT worked, filed since 2026-09-01 as unreproduced because localhost renders
them clean. Walking the app's 67-module graph against the live site found
seven modules returning 404, all under `src/skins/` and all named with a
leading underscore: GitHub Pages runs a site through Jekyll unless told not
to, and Jekyll drops every underscore-prefixed file. A `.nojekyll` at the
root turns that off. Localhost serves everything, which is why the bug could
never be seen here and read as a phone problem.

---

## `04ddc18` — the MK-CX/2 is the fielded tank

By the operator's ruling the MK-CX/2 is the default wherever the MK-CX was:
the board's player unit, the battle, heart and tank3 tabs, the beam lab, the
berth hulls, and the casting module's own defaults. The MK-CX stays castable
only as a relic in the units viewer. The same commit repaired the briefing
met on the shell after the tutorial: its glossary buttons had rendered as
full-width bars because their selector list had been cut off from the Play
button's rule by a block inserted between them, and its tank card now speaks
the shell's controls instead of keys.

---

## `ae5ca3b` — two views means two

The phone report of a tank below the frame and only the plasma tips in view,
from a camera that felt too high, was the drone view: Isao's camera. On the
shell one tap on Isao, who hovers beside the tank printing towers, offered
the ride in a toast whose button sits in the caption lane, and one more tap
took it, and the shell labels every non-orbit camera DRIVE. The shell now
folds first person, the drone ride and the bastion cam into third person,
offers no ride on a tap, and rides its chase eye 22% lower as asked. The
desktop keeps all its views and its pose.

---

## `10fa17c` — the announcement cards were sitting on the tank

A phone photo of DRIVE showed the NEW THREAT and NEW TOWER cards stacked on
each other in the middle of the frame, over the tank. The ruler had never
listed those cards, and its own viewport was 331px, a 418px window minus
Chrome's bar, so a lane placed for it landed mid-frame on a real phone. The
cards are one-line captions on the shell now, sprite inline, stacked
top-left under the HUD; the ruler lists them, pins both, and shell runs use
a window tall enough that the viewport is the phone's 418 or 390. Zero
overlaps in both modes. The tank-in-view report itself is still open: the
replica frames the tank at 2.5 cells, so the boot probe now paints its facts
onto the shell's caption lane for a phone screenshot to carry.

---

## `e6a4988` — the proximity sensor in cells and colour

The sensor graded contacts by thirds of the scope's reach, a fraction of
whatever the radar showed and not a distance a player feels. It grades in
cells now, only for the solid tier: nothing beyond four, blue at four,
orange at three, red at two or closer, each ring its level and its colour in
one table in radar.js, and the scope's reach no longer gates. Two small
things the probe caught: three cells computed as a hair over three fell into
the wrong ring until the comparison got a tolerance, and the probe's demo
contacts were world-fixed points that drifted as the tank drove, so the
first screenshot showed the right rule in the wrong sectors; they are
relative to the tank now.

---

## `c7bf443` — the four from the phone

The operator's second device session: no way to move the tank manually, the
radar under the fingers, a start that sits in the deploy view with nothing
moving, and the intro's name. The third explained the first. A real-time
headless runner (`scripts/headless-wait.mjs`, because the virtual-time
recipe stops the frame loop's clock and replicates any time-driven flow
wrongly) with `?stateprobe=1` showed the boot: the cold open ends, the
deploy starts, and the field manual pauses the game with the tank in its
berth at the deploy framing. After the manual, the tank stands with the
throttle at zero, and the shell has no throttle. The manual is skipped on
the shell now, and a floating stick on the left half of the board drives
the tank by hand: a ring under the finger, drag to drive and steer, release
to stop, and a plain tap is still tap-to-go. The radar moved under the BUILD
switch with the thumbs pinned to the corner, zero overlaps under the coarse
ruler in both modes, and every intro string says Stålheart.

---

## `69a4e9c` — cinematics: the governor

The live tier is measured on the device instead of read from a table. At
scene start one wormhole march at 512px is timed with a readback stall, the
median of three, which gives the device's sine-folds per second; the largest
target whose march fits 40% of a frame at the target fps is arithmetic. While
the scene plays, a smoothed frame time steps the target down after a second
over budget and up after five seconds of headroom, one step per three
seconds and never up during the full-frame beat. The look is never touched.
The HUD prints the rate, the fit and every step. On this machine the fit is
384px at 60 fps and 256 at 120, where the tier table said 512; no phone has
been measured yet, and the HUD line is how one will be.

---

## `70631c1` — cinematics, the capture path that renders

The CDP-driven harness hung on the M4 for any frame where the wormhole disc
filled a canvas wider than about 1500 px, and only there: 1920×1080 and
1600×1080 never returned, 1280×720 and 1080×1080 rendered, and the same
frame drawn by a plain headless page rendered at once. Some thirty bisect
runs removed each variable in turn: bloom, shadows, tone mapping, the
metrics override, Chrome's flags, the live loop, the disc's filter and
colour space and mipmaps, a fence after the march, the draw moved inside an
animation frame, the read-back instead of the compositor screenshot. A
flat-colour disc rendered every time; Chrome's stderr showed no GPU error.
The cause is not found, and the commit says so; the knobs stay for the next
attempt.

**What works: one plain Chrome per frame.** `--mode launch` opens the page
at `?t=T&once=1&dump=1`; it waits for its assets, draws the frame twice
(the post chain's first draw read back black), reads its own canvas in the
same task and emits the PNG as console chunks, which the harness reassembles
from stderr, the way the reverse export ships a GLB. The compositor is not
involved: a once-drawn frame never reached headless's own screenshot. At
the cinema tier a 1080p frame takes 1.5 s and is byte-identical across two
launches. A 12-second clip is about nine minutes; the CDP mode stays the
default below 1280 wide, where it is three times faster.

---

## `4f1b212` — cinematics, phase 0: the seam, the harness, and the number

The research and plan are `docs/CINEMATICS-PLAN.md`; the operator ruled on
all six questions per the plan's recommendations, with 16:9 and twelve
seconds per scene and in-game sounds or space silence. Phase 0 instruments.

**The fact everything is priced on.** Headless Chrome on this Mac uses the
real M4 through ANGLE Metal when the SwiftShader flags are left off. A new
`?bench=SIZE:FRAMES:STEPS:OCTAVES` on the portal bench times the wormhole at
a full-frame pixel count with the readback stall:

| GL | target | steps × octaves | ms / frame |
|---|---|---|---|
| M4 | 1440² (1080p) | 120 × 12 | 68.6 |
| M4 | 2880² (4K) | 200 × 16 | 575 |
| SwiftShader | 128² | 120 × 12 | 16.9 |

The M4 does about 45 G sine-folds a second, SwiftShader 1.4. A live
full-screen wormhole at 1080p is 14.6 fps at the preset, so the live tier
needs half resolution or fewer steps; a 12-second 4K clip is about three
and a half minutes offline.

**The seam and the harness.** `src/cine/kit.js` gives a scene `seek(t)`,
holds its own loop, hides the chrome and resolves one frame after the
render. `scripts/cine-capture.mjs` drives Chrome over CDP on the GPU, one
screenshot per seek, then ffmpeg. The portal bench is the first scene: a
3-second 1080p clip in 14 seconds.

**Determinism, caught by a diff.** Frame 1 from two Chromes differed in
4.6% of bytes and frames 1 and 2 of one run were identical. The rotors
accumulated rate × dt, so a zero dt froze them wherever the live loop had
left them, and the corona's update gate compared t to the live loop's last
render time, so an early seek rendered nothing. Every time-dependent thing
is now set from t. After: three distinct frames, each byte-identical across
two separate Chromes.

---

## `b368368` — the sky is in the game

Tried in the lab, then kept: **two galaxies, small (size 0.25) and far, small
cores (×0.25), at intensity 0.65, and a fresh seed on every reset.** That is
`SKY_PRESET` in `galaxyseed.js`; `regenerate()` draws the seed and bakes, so
a new game, a retry and a `?seed=` all get a new sky and a rebuild that keeps
the run keeps its sky. One bake per run (~90–110 ms of CPU including the first
shader compile, once), then the cubemap is `scene.background` at the preset's
intensity — measured at +0.2 ms a frame. postfx blacks the background out of
its weighted pass, so it does not bloom.

The seed is the one non-deterministic thing on the board, and it is on
purpose: the sky is dressing, not game logic, and the operator asked for a
different one each time. The lab's sky knobs drive the same bake and open on
the run's own sky, so `?lab=1` shows what the game shows and lets you turn it.

---

## `ff3c175` — the stress lab: `?lab=1` on the real board

The operator's ask, the same afternoon the background was measured: an
environment to stress-test the engine — Stålheart and tank immortal, a
slider that multiplies the wave until the frame drops, a background that
goes in and out, the teleport effect swapped, and a number for all of it.
Plus the PoC that prompted it: a galaxy drawn once from a seed, faint,
projected 360°.

**Shape.** A mode on the TD board, not a tab. `?lab=1` opens VARS on a LAB
page and turns the frame readout on; without the flag every lab branch is
dead (`lab.on && …`) and the board runs the code it ran before. A separate
tab would have measured a copy, and copies of the board are the debt the
ROADMAP already names.

**The page.** wave × (1–20), ⚡ spawn a wave now, hold waves, freeze
enemies, immortal heart, immortal tank, background (none / galaxy), galaxy
seed + ↻, sky intensity, portal effect (wormhole / corona), portal target
px, portal update Hz, march steps, turbulence octaves, bloom. Each is a
knob in `src/lab.js`'s table (validated by `knobProblems` like the feel
knobs), and each is reachable from the URL as `lab<Knob>=` — `labwave=8`,
`labbg=galaxy`, `labfx=corona`, `labseed=7`.

**The multiplier** is a fourth argument to `computeWavePlan`, applied to
`base` after the opening taper so every density rule scales together and
the headline type does not change. `mult = 1` is byte-identical to the game
and a test says so.

**Immortality** is one condition in each of `heartHit` and `playerHit` —
the tutorial's own "no damage" precedent for the heart, and an early return
that keeps the shove for the tank, so a hit still reads.

**GPU ms.** fps says whether the frame fits; it does not say which side of
the bus is full. `perfTick` now opens one `EXT_disjoint_timer_query_webgl2`
TIME_ELAPSED query around `frame()` and reads it back a few frames later.
One per frame, not one per draw: per-draw queries split the render pass on
Apple's tiled GPU and overcount about 4x (research.md, 2026-09-03). The
readout shows `gpu N ms` beside the CPU ms, and the lab prints a `LAB …`
line every 2 s for a headless run to grep.

**The sky.** `src/galaxyseed.js` is galaxy-forge's generators (Fable
Cabinet, `reference/FABLE-SHOWCASE/galaxy-forge`) on `mulberry32`: one seed
names arms, twist, bar, core, palette and every star. `src/galaxybake.js`
is its star and dust shaders on `THREE.Points` — the demo's `uVP` replaced
by three's matrices, the ignite pinned past its end — rendered by a
`CubeCamera` into a 1024/face cubemap (512 on the phone tier), once, with
no bloom and no composite. The board draws it as `scene.background` at
`scene.backgroundIntensity`, which is what "faint" means; postfx already
blacks the background out of its weighted pass, so it cannot bloom. One
lesson in the porting: at the cube camera's 90° the demo's sprites landed
under a pixel and its own sub-pixel attenuation faded the disc to nothing —
the galaxy was moved closer and the sprite scale raised until the stars
land at 1–3 px again.

**The portal.** The board's wormhole uniforms are now the union with the
corona's (the `#portal` bench's rule: a uniform a program declares and the
object lacks is a hard failure, so switching must never remove one), and
`setBoardEffect` swaps the fragment source. Target size goes through
`whRt.setSize`, which keeps the texture object so the gates stay bound.

**Two bugs found on the way, both fixed.** The VARS modal's GAME page
carried the `lil-gui` class, and the modal's stylesheet forces every
`.lil-gui` inside it visible — so it could never be hidden and every other
page had been drawing underneath it, out of sight. It is wrapped now. And
`?perf=` handed the renderer's counters back to auto-reset when it was done,
which zeroed the readout's draw count for the rest of the run.

**Added the same evening (`373c21b`): galaxy size and count.** Size is the
demo's zoom — the disc moves nearer rather than scaling up, so a bigger
galaxy is also a nearer, brighter one with larger sprites, as in the
Cabinet. Count (1–8) lays the extras out from the seed (`galaxyLayout`: no
two within ~35°, each with a seed of its own and 40% of the star budget);
the home galaxy stays where it was tuned. `labscale=` and `labgalaxies=` on
the URL; either change rebakes.

**And (`f2c40e9`): small cores by default.** A big bulge is a bright blot that
fights the board, so the seeded core range is 0.08–0.16 instead of the
demo's 0.08–0.42 — the same one draw from the stream, so every other seeded
value is unchanged for every seed. `core size ×` (0.25–3, `labcore=`) scales
it for anyone who wants the blot back.

**Measured, M4, 1600×1000.** ×12 with 95 enemies alive: 60 fps, 6.0 ms GPU.
The sky: +0.2 ms. The bake: 60–150 ms of CPU at boot including the first
shader compile.

---

## `40801df` — measured: a live background behind the planet, aurora vs galaxy-forge

The operator asked what it would cost to put something like the Fable
Cabinet's `#aurora` or `#galaxy-forge` behind the planet, which is a flat
near-black today (`mainBg` 0x0d1017 on the board, 0x05070d in tank2).
Measured rather than guessed, on this Mac mini's M4, with headless Chrome
on the real GPU (`--use-angle=metal`) and one `EXT_disjoint_timer_query`
per frame — the per-draw variant overcounts about 4x on Apple's tile-based
GPU because every query boundary splits the render pass, which is worth
knowing before anyone trusts a number from it.

**What each demo is.** The aurora is one fullscreen fragment shader: per
pixel it evaluates five-octave value noise about 25 times (four per curtain
for up to six curtains, plus the milky way, ridge and trees), three star
layers and a palette. Cost is pure fill, linear in pixels. Galaxy-forge is
the opposite shape: 300k star points (up to 420k) and 48k dust points,
positions computed in the vertex shader, additive point sprites, a
quarter-res bloom and a composite — ten draws. Its cost is vertex work and
sprite overdraw, and barely moves with resolution. Both ship an adaptive
quality loop, which is the authors saying they expected to miss 60 somewhere.

**GPU ms per frame, M4, whole-frame query, mean (p90):**

| target | aurora | galaxy-forge |
|---|---|---|
| 512×320 (0.16 Mpx) | 1.8 (3.0) | 4.6 (7.3) |
| 960×600 (0.58 Mpx) | 4.6 (6.3) | — |
| 1600×1000, desktop 1x | 10.9 (13.6) | 3.9 (6.7) |
| 3200×2000, desktop 2x | self-throttled to 2048×1280: 18.2, **50 fps** | 5.8 (8.2) |
| 585×1266, phone tier | 5.2 (7.6) | 3.2 (5.7) |

So the aurora is ~7 ms per megapixel plus ~0.6 fixed, on an M4. At a
Retina 2x it cannot hold 60 on its own, which its adaptive loop already
knows. Galaxy-forge floors at 3–5 ms whatever the size.

**What the board has to spare.** Same rig, `?cine=0#td`: 10.2 ms mean (p90
17.7) at 1x with 1,117 draws a frame; **45 ms at 2x, 29 fps**. tank2: 1.1 ms
at 1x, 2.7 at 2x. The 2x board number is the headline here and has nothing
to do with backgrounds: on this GPU the desktop tier at Retina (full-res
bloom mip chain over 6.4 Mpx, eleven hundred draws) is already GPU-bound.
Verify on the real screen with `?perf=1` before believing a headless
figure, but if it holds, the desktop tier's `bloomScale: 1.0` and
`dprCap: 2` are the two knobs, and `bloomScale` is the cheaper one to turn.

**How either would go in, and what it would then cost.** Not as a canvas
behind the canvas — as a render target the board draws into and reads as
`scene.background`, exactly the wormhole's arrangement (`WORMHOLE_RENDER`,
a size and an update rate, per tier).

- *Aurora, live.* It is time-driven, so it wants updates. 512×320 at 24–30
  Hz is 1.8 ms on the frames that render it, under 1 ms averaged, upscaled
  3x onto the board — soft ribbons survive that; the star layer does not
  (`uStars` to 0, or keep the stars in the game). Drop the ridge, trees, snow
  band and shooting star: a planet in space has no horizon, and those are
  ~15% of the shader. On a phone the same target is 5–9 ms per update once a
  phone GPU's 3–5x deficit to the M4 is applied, so the phone tier gets
  256×160 at 20 Hz or nothing. Verdict: affordable at 1x, marginal at 2x
  where the board is already over, and it needs a tier entry.
- *Galaxy-forge, baked.* Its motion is a slow spin and an intro; as a
  backdrop it is a texture rendered once at boot (4–6 ms, once) or refreshed
  at 1–2 Hz, and then a full-screen quad per frame at well under 0.2 ms.
  Bake at device resolution or the star points blur. It carries its own
  bloom, so give the background group a weight of 0 in `bloomweights` or
  the board's chain will bloom the core a second time. Verdict: effectively
  free at every tier, and it is a space picture, which is what is behind a
  planet.
- *Both.* A baked galaxy with one thin live aurora ribbon at 384×240 is
  under 1 ms a frame on the M4 and reads as a nebula.

Recommendation, if one is picked: galaxy-forge baked, behind everything,
excluded from bloom; the aurora only as a small live layer over it, and
only on the desktop tier. Neither should be started before the 2x board
number is understood, because that is where the frame budget actually is.

---

## `1bad331` — MK-CX/2: the tank with the top taken off

The operator's ask, from two screenshots: lose the dark turret block between
the hull and the shell rack, flatten the top into a supercar wedge, put the
nine shells straight on the flat hull rather than on a separate plate, and
keep large blue indicators on top. Tried as a second casting so the MK-CX
stays.

**The model** is a new subject in `blueprint-to-life` beside the MK-CX,
sharing its tub, nacelles, armament and hierarchy contract. The deck drops
and runs flat from the nose to a raked tail; the gun rides a blade a third
the old turret's height with a low cradle; nine flush sockets and a mount
empty sit in the rear deck; two glow strips run the roof's length on the
health-tinted material. Exported by a new Node script there, no browser
download needed: 459 KB, 57 meshes.

**The casting** generalises the mkcx path to two ids instead of copying
it: one URL table, one prototype per id, the preload and ready hooks take
an id. Two things branch on what the model has rather than on its name: a
rack mount present means the dots sit flush on the deck with no plate and
do not sweep with the gun, and a model that brings its own deck strips
gets none from the game.

Selectable, not default: `mkcx2` in the catalogue with lore, `?creature=mkcx2`
on the board, `?unit=mkcx2` in the viewer. **The viewer's framing changed
with it** (`?unit=`, "so I can see it in big"): the old fit put the longest
axis against the screen's height with a 1.9× margin, so a tank 10.8 long
and 2.9 tall filled a fifth of the frame. It now projects the box's eight
corners along the view direction and solves the distance at which the
widest sits at a horizontal limit and the tallest at a vertical one that
leaves the toolbar band free. The MK-CX/2 is twice the size it was; compact
units are unchanged in feel. `?zoom=N` scales the fit.

**Second pass (operator, same day): elevated, and longer gauges.** The main
gun clipped the secondaries on traverse, so the blade now stands on a
faceted pedestal 0.22 tall with the trunnion raised: bore at 2.02, barrel
underside 1.87, the secondaries' shells top out at 1.60. The sibling's test
rotates the turret through 360° in 3° steps and asserts the barrel's world
box never meets any secondary part, 720 checks, closest approach 0.27 m.
The three heat sleeves the game adds are 1.5× longer on this casting, from
a per-casting table; positions are sleeve centres, so the main one still
starts ahead of the cradle and the secondaries' end short of their muzzles.

**Reverse export.** The units viewer has an EXPORT button: the current unit
as the game dresses it, cast model plus shell rack, heat sleeves, tint and
edge outlines, as one `.glb` to hand back to `blueprint-to-life`.
`vendor/GLTFExporter.js` is three r160's, matching the vendored three, with
its texture-decompression import stubbed to the identity since nothing here
carries a compressed texture. `?export=1&dump=1` runs it headless and emits
the bytes as numbered base64 console chunks, since Chrome truncates one long
line; a shell reassembles them. The first one, the MK-CX/2, is 3.4 MB, 79
nodes, 30 meshes and 18 outline line sets, and lives in the sibling under
`design/game-exports/`. The viewer and board now preload
the casting they were asked for; before, both preloaded only the default
and a variant would have shown the procedural fallback forever.

---

## `1cf2b02` — the first phone screen: the ruler's blind spot, and a coach

The operator's first screen on a real phone: the radar filling the
top-right at 240px with the launch console and both thumbs under it, and
nothing saying how to move the tank. Two roots, both fixed on the shell only.

**The ruler could not see the phone.** Every shell rule was measured
headless, where `(pointer: coarse)` is false, so every rule in the phone's
own coarse blocks was invisible to `?layout`, which reported zero overlaps
on a layout the phone never shows. No headless flag makes the pointer
coarse. `?coarse=1` now rewrites the media conditions in the loaded
stylesheets so those blocks apply for real; its first run reproduced the
screenshot in numbers (radar × console 44×52px, console × mode button). The
shell now pins its geometry with two ids plus the class, outranking every
selector in those blocks, and each rule states the whole geometry: radar
bottom-left at 96px (a JS branch, since its size is written there), the
console centred and collapsed to its safety switch until armed, HUD, wave
clock, hack button, brief and lane restated.

| run | DRIVE | BUILD |
|---|---|---|
| 844×390 | 0 overlaps | 0 |
| 908×418 + `?coarse=1` | 0 | 0 |

**Nothing said how to move.** The tutorial now speaks the shell's language
at the one place every banner passes through (`shellWords`): tap the ground
beyond them, the plasma thumb, tap BUILD then high ground. Its throttle
lesson becomes a tap-to-go lesson, passed by a destination accepted. For a
phone that has already seen the tutorial, the operator's case, a **coach**
shows three marks once per browser, each holding until the thing it names
has happened: tap the ground (a target cell pulses three hops out), the
thumbs, then BUILD when a tower is affordable. `?coach=1` walks all three by
doing what each asks. The banner's shell slot is right of the console, above
the thumbs, the one slot at 303px that touches neither the console nor the
caption lane.

---

## `2c33c8f` — the mobile shell, phase 6: the budget as a table, a wake lock, the PWA hook

Phase 6 of `docs/MOBILE-PORT-PLAN.md`. Haptics are out by ruling; the rotate
prompt, `touch-action` and the viewport units landed in earlier phases.

**The render tier** (`src/perftier.js`, tested). The phone's savings had
accreted one at a time, each as a feeling in a different file. They are one
table now, picked once at boot, and `?perf=N` prints the tier it ran under
next to the draw stats:

| tier | pixel-ratio cap | MSAA | wormhole | bloom |
|---|---|---|---|---|
| desktop | 2 | on | 384@30 | 1.0 |
| phone | 1.5 | off | 256@24 | 0.5 |

The wormhole cost the table implies: desktop 212M sine-folds per frame,
phone 94M, a per-second ratio of 0.356. The look (steps, octaves, exposure)
is the preset's and untouched; the tier owns only what it costs. The pick is
the shell's own test so one detection feeds two consumers; `?mobile=1|0`
forces the matching tier, which is how a headless run measures what a phone
gets, and `?tier=` overrides on its own. Measured on the same board at
844×390: phone `aa=false wormhole=256@24 bloom=0.5`, desktop
`aa=true wormhole=384@30 bloom=1`. The tier buys per-pixel cost, which the
draw-call readout cannot see, so the honest number is the table's.

**The wake lock.** Shell only, requested at boot and on the first touch,
re-requested when the tab returns. `?wake=1` reports held on the shell and
"not requested, by design" on the desktop.

**The PWA hook.** The roadmap blocked installed-PWA on one conflict, a
worker whose cache is not keyed off the build token, and called the full
offline story a dedicated project. This is the hook only, in the shape of
`blueprint-to-life`'s solved `sw.js`: the cache name is the token,
`bust.sh` stamps it, `test/pwa.mjs` fails the suite if it drifts from the
page. Navigations network-first then cache, fingerprinted assets
cache-first, the rest stale-while-revalidate. No precache list, no
`skipWaiting` on the worker's own initiative, registered on the shell only
with `?sw=0` to opt out. Precaching for a cold offline boot remains the
dedicated item.

---

## `82c1e4e` — the mobile shell, phase 5: modals that fit a phone

Phase 5 of `docs/MOBILE-PORT-PLAN.md`: the briefing, both debrief stages,
the campaign screen and the variables modal, one scrollable column each
with buttons a thumb can reach.

**The ruler first.** `?modalprobe=1` opens each modal the phone will meet
and measures its box against the viewport and every button against the box
it must be tapped inside of. Unreachable includes *clipped*: a button past
an `overflow: hidden` edge is as gone as one past the screen's. A button
below the fold of a column that scrolls counts as reachable. The thumb
rule (40px) grades the shell only.

Before, at 844×303, five of seven failed for one reason: the message box
is `overflow: hidden` for the hologram sweep, capped at 295px, and the
proceed button, the orders, and "another planet" all sat below that line.

| modal | before | after |
|---|---|---|
| pause | clipped | scrolls |
| analysis | proceed unreachable | scrolls, reachable |
| verdict | 5 buttons unreachable | scrolls, reachable |
| campaign | 2 buttons unreachable | scrolls, reachable |
| variables | 6 buttons under 40px | full-screen, 44px |
| manual, record | fit | fit, and the manual shows the shell's controls |

**The fix**, under `body.mobile-shell`: the message box scrolls as a whole,
`box-sizing: border-box` (`max-height` on a padded content box overshoots
the viewport by the padding, and only a ruler notices), fills the height,
44px buttons. The field manual the same, with an `.fm-shell` line — tap to
go, hold a tower to upgrade — in place of the keyboard table. The
variables modal fills the screen with a 124px nav. Desktop, run through
the same ruler at 1280×800 with `?mobile=0`: seven of seven under its own
rules, untouched.

**`?whatsat=x,y`.** A screenshot of the verdict showed a "▸ home" chip
over the header that was none of the shell's pieces. The new hook names
the element stack under a point; one run said `button.nav-home` inside
`nav#tabbar` — the site's tab bar, hidden by `body.playing`, and a debrief
is not playing. On the shell it is behind ≡ in every state now, and the
layout ruler lists it.

---

## `e32e9ec` — the mobile shell, phase 3: BUILD on glass, and the raycast acquitted

Phase 3 of `docs/MOBILE-PORT-PLAN.md`. Most of it already existed on the
desktop — drag orbits, pinch zooms, a tap opens the tower radial at the tap
point, placement has a reason string — so the phone work is the finger and
the feedback, and a probe for the complaint that started it.

**The probe first.** PLAYTEST-TODO §1 ("clicking a buildable spot does not
work at all") named four suspects: the tap-vs-drag threshold, what the ray
hits, silent refusals, and camera distance. `?tapprobe=1` projects the roof
of every placeable wall-top that faces the build camera and lies in frame,
puts a synthetic tap there, and asks `cellAtScreen` what it resolves to —
eight poses 45° apart per zoom, taps pooled:

| zoom | taps | exact | placeable |
|---|---|---|---|
| default (dist 2.0) | 101 | 101 | 100% |
| whole-planet (dist 3.4) | 143 | 143 | 100% |

The ray is not the problem at either distance. That leaves the human
suspects, and the shell answers them.

**Finger-sized slop.** A tap was a press that travelled ≤ 8px. That is a
trackpad's idea of "never"; the shell uses 14 CSS px, through one
`tapSlop()` read by pointermove and the lift. Desktop keeps 8.

**Long-press upgrades.** In BUILD on the shell, 550ms on a tower orders its
upgrade through `orderUpgrade` — the U key without a key — and says what it
did, or why not, as a caption. The press is *spent*: the lift is not a tap,
so no radial opens under it. Travel past the slop, a second finger, or
lifting cancels the timer.

**Refusals speak.** The desktop deliberately shows nothing on an unbuildable
cell (a radial of greyed-out towers is a wall of no). On the shell a caption
is not a radial: a BUILD tap on bad ground shows NOT HERE with
`placeError`'s own reason, rate-limited so the same reason is said once per
1.5s. `?pressprobe=1` drives both gestures through real `PointerEvent`s on
the container: the hold put an upgrade on the book with the radial closed,
and the ground tap was refused with "towers need HIGH GROUND".

**What the probe taught, on record.** Its first cut chained `setTimeout`s
between poses. Virtual time burned all sixteen inside 13ms of real time
with no frame between them: one frozen camera at radius 1.16 — the deploy
framing, not the orbit — measured sixteen times, and reported as 100% of
16. Two fixes, both already known elsewhere in this file: step the frame
loop's easing by hand until it converges (the `?goto` rule), and clear the
deploy blend and any shot first, because `updateCameraGoal` answers those
before the orbit (the drone probe's rule). The number is real now.

---

## `2d249ac`..`14aa9d7` — the mobile shell, phases 1, 2 and 4

The plan is `docs/MOBILE-PORT-PLAN.md`; these two commits are its first
three phases on the board. Everything is scoped under `body.mobile-shell`,
so the desktop game is byte-identical — the shell is a second skin over an
untouched game, not a fork of it.

**Detection** (`2d249ac`). Coarse pointer AND a phone-class short side
(< 900px). `?mobile=1` / `?mobile=0` override it either way, which is how
the shell is looked at on a desktop and switched off on a phone.

**Tap-to-go.** On the shell, while driving, a tap on open ground is a
destination. A BFS field from the tapped cell becomes the walker's goal
exactly as `distToHeart` is the goal for `home` — one new directive,
`goto`, and `chooseNext` reads it like any other. Arriving hands control
back to manual, which stops the tank. The relay's own cells keep their tap.
Because the tank is commanded rather than driven, the steering pads and
the throttle are gone; the shell and plasma thumbs stay, and they are NOT
automatic (operator ruling: the plasma's 4.5s lockout makes *when* the
player's decision). `?goto=1` picks an open cell six hops out and drives
the walker: arrived in 5.1s, handed back.

**One switch.** `#mob-mode`, top-right, DRIVE ↔ BUILD. Build mode IS the
orbit view — `setView` owns `buildMode` — so the button calls the
desktop's own `toggleView`, and follows `buildMode` from every path that
sets it (a sector reveal auto-enters build). The first cut called a
`toggleBuild()` that did not exist; the probe had driven the tank and never
tapped the button, so a ReferenceError shipped on the one control the
shell has. Fixed in `14aa9d7`, and the ruler now enters BUILD *through*
the button (`?mobbuild=1`).

**Landscape only.** Portrait shows a rotate prompt over the game.

**Per-mode HUD sets** (`14aa9d7`). DRIVE shows what a sub-second read
needs: vitals + resources (two rows, 50px tall), the wave clock, the launch
console compacted to safety + status + button, the radar, the thumbs.
Score, the objectives row and the drones' status lines are hidden. BUILD
is the calm mode: the full panel, and no thumbs, no console, no radar
(orbit shows the whole planet), no hack button. The desktop key legend is
gone in both — there are no keys. Sizes are set on the shell rather than
inherited from the `(pointer: coarse)` block, because the headless ruler
is never coarse and would otherwise measure a layout no phone gets.

**Captions.** Isao's channel (`#td-brief`) and the announcement lane
(toast, sitrep, wave and tower cards) leave the sightline: both anchor to
the bottom edge beside the radar, Isao under the lane, nothing to dismiss.
Isao is wide and small on the shell so his long lines wrap to two.

**The ruler, and what it caught.** `?layout=N` gained the shell's pieces
and `?pin=1`, which puts a caption and Isao on screen when the ruler
fires, so the slots they take are measured rather than assumed. It found
the brief landing centred on its own left edge: `wave-pop`'s first
keyframe is `translateX(-50%)`, and CSS animations do not advance under
virtual time, so the ruler saw the brief frozen mid-entrance. The shell's
captions fade in with no transform. At 844×390 with both pinned:

| mode | overlaps |
|---|---|
| DRIVE | 0 (was 1: hud × launch, 42×89px) |
| BUILD | 0 |

**Not yet:** phase 3 (radial-at-the-finger building, long-press upgrade,
tap-vs-drag), phase 5 (phone modals), 6 (perf tier, PWA), 7 (device pass).

---

## `45d9c20`..`57f15e0` — the board learns to keep time, spend, warn, and debrief

Eight commits in one afternoon. The thread: the game stopped handing things
out and started making the player feel the clock and the purse.

**The Terraformer builds** (`8ddba0c`, `611efd0`). Every second wave a sealed
small container is printed into a yard at the pedestal's rim; every fifth wave
a new mk-cx is printed and racked in a berth. The yard *is* the clock — you
count it. First cut ran the idle rig 2.8× faster to look busy, and the nozzle's
print pattern thrashed ("erratic, jarring"); building is *slow*, so `working`
is a blend weight into a deliberate raster (travel 9s, traverse 3s, mast down,
arm low, nozzle nodding). The stores were measured **clear** of the pedestal
(2.0–2.7 cells vs a 1.43 pad) — "builds nothing" was placement plus a dropped
job when the model hadn't loaded, not occlusion. Doors are shut by **geometry**
(the leaf's flattest angle, depth 0.08), because the authored rest pose is
ajar; the open boxes near the heart are the three berths, open by design.

**The economy is measured, not felt** (`611efd0`). `economy.js` keeps a ledger
and the sim's `SIMRESULT` carries `earned, spent, held, peak, spendRatio,
affordable, perWave`. Before any tuning: ram policy seed 7 earned 2009, spent
618, affordable 80% — while the build policy on the same seed spent 98% and was
short half the time. The excess is the **ram loop**: tank 1.0 × premium 1.5 ×
streak cap 5 = 7.5× bounty. Cut to cap 3, premium 1.25 (3.75×). After: per-wave
income 402 → 349 on the long run; still a surplus. Per-run totals don't compare
(the cut changed how long the run lasted) — rates do.

**Sinks, on the one screen where the run pauses to spend** (`0d2e189`). A sector
**toll** that climbs (250 + 150/sector) gates the breach button; a spare hull
(400kg) and a strike missile (350kg) are for sale. Plus: plasma lockout 1.71s →
4.5s; the Terraformer's pad is **solid for the tank** (enemies must still reach
the heart) — closest approach 1.75 cells against a pad of 1.40.

**The slow tower only slows; ranks are twice as hard** (`8ddba0c`). It carried
4/90 damage — enough to steal kills — and, worse, `damageEnemy` at zero still
fires the on-hit reactions, so the slow tower was *accelerating* barbed.
`killReq` doubled to `r(r+3)`: gold 5 is 270 kills + 15 elite.

**A proximity sensor on the radar** (`1b41602`). Car-style arcs inside the rim,
one sector each for ahead / starboard / astern / port, one to three arcs by the
nearest **solid** contact in that sector — the same thirds the range rings
draw. Pure in `radar.js`, twelve checks. Reach is the scope's own: 15.3 cells,
about fifteen seconds of warning. Visual only.

**A second drone, and drones that upgrade on their own** (`904e079`). ISAO's
state machine became `stepWorker(w, dt)` over `workers()`; orders are claimed
by identity (`order.worker`) and released by splice, so the 114 sites that name
`isao` were untouched — he is `workers()[0]`. The assistant is amber, 500kg.
Auto-upgrade orders the cheapest affordable tier while holding a **150kg
reserve** — "excess" means what's left *after* paying — never more orders than
drones. `?drones=1`: both claimed, three orders drained in 14.1s.

**Two debriefs** (`45d9c20`, `57f15e0`). The sector debrief is now an analyst's
board first — roster with sprites, attribution, score tempo, records (most by
one shell, most by one strike), a canvas **replay** of the best strike recorded
at impact, defence tiles — and only then the orders. The planet debrief is a
**campaign**: a snapshot per cleared sector (deltas, taken at the clear), one
table with planet totals, records, achievements, then `INSERT COIN : 1` and a
blinking `CONTINUE?` — the win mints a persisted coin, YES spends it on a new
planet (new seed, +18% points, +2 rooms: 2236 → 2630 cells). No timer.

**The grey block in the portal's mouth** (`45d9c20`) was never a hub. The ring's
stators and rotors are `InstancedMesh` nodes, and `mergeByMaterial` keeps one
instance at the origin and drops the rest — so a single stator block sat on
the axis and every other instance around the ring was silently missing. Named
as pivots now. Two wrong diagnoses first, both from a "raw" dump that was the
cached, already-merged scene: `loadGlb` returns the same object every time.

**The probe lessons this span added to the pile:** `timeout` around headless
Chrome kills it before stderr flushes; an unquoted `$FLAGS` in zsh is one
malformed flag; a fixed timer racing a model preload reports "no drone"; a
door's *angle* is not its pose — measure the leaf, in the fixture's own
uniform frame, before any non-uniform placement scale.

---

## `aa072fa`..`d00a607` — a frame number, a cheaper wormhole, a panel you can navigate

Three commits after the operator felt the portal's fps hit.

**The pass took back the two costs that were pure waste.** The wormhole march
— 512px × 120 steps × 12 octaves at 60Hz, **377M sine-folds a frame** — ran
whether or not a gate was in view, and driving away from the gates is most
of the game. `updateWormhole` now sphere-tests every live gate against the
camera frustum and skips the render when none is inside it; the phase keeps
advancing, so a gate scrolling back into view is where it should be.
`?gateprobe2` checks that gate in *both* directions, because a gate on screen
and not marched is a black hole in the ring. And the cost knobs moved without
the look knobs: **384 @ 30Hz** — 0.56× the pixels at half the rate, ~3.6×
cheaper — while steps, octaves and exposure stay exactly the bench's export.
`test/portalfx.mjs` pins that split, so the board can get cheaper without the
bench lying about it. The third cost stays on purpose: eight pods per gate
outside the merged batch, the price of parts that blow off individually.

**One hotspot predated the portal.** The shell wall-impact test scanned
*every cell, per shell, per frame* — three shells on a 2,000-cell board is
6,000 distance checks a frame for an answer the voxel hash gives in one. It's
`cellIndex` now, like every other collision query; new `?breachprobe=1` lands
a shell on a wall cell and confirms the breach set grew by exactly that cell.
No full-cell scans remain in `td-tab`.

**What was not measured:** the fps. Headless SwiftShader cannot time a GPU,
and `?perf` never fires under these flags (two runs, then stopped). Verified
by behaviour instead — frustum gate consistent, breach on the right cell, hit
sequence unchanged. Which is the reason for the next thing.

**A frame readout.** `#td-perf` under the score panel: fps · ms · draw calls
· tris · pts, plus the wormhole's size@rate while a target exists. Half-second
EMA so the digits read. `renderer.info` is reset by hand each frame while it
is on (the `?perf` probe's own trick) and left alone when off, so an off
readout costs nothing. Toggle with **`` ` ``**, the panel checkbox, or
`?fps=1`; remembered in `localStorage`. "It feels slower" now has a number
the operator can take themselves — the wormhole's real-hardware cost is the
open question this closes.

**The variables panel is a modal.** Thirty root controls and four folders
were one right-edge column, scrolled by feel, and hidden while playing. The
lil-gui DOM is **moved, not rebuilt**, into `#td-vars`: root controls become
the GAME page, each folder its own page (hover, recoil, orbital strike,
plasma, bloom, sound), a nav column left, one page at a time right, × and
Esc, `?vars=1`. Every slider keeps its listeners because nothing about it
changed except where it lives. It opens mid-run — a toggle you cannot use
while playing is not a toggle. It has its **own ⚙ button** beside the ≡: the
first cut hung it off `body.chrome-open`, which also opens the game-mode tab
list, and that list sat straight over the modal's own nav.

**Three small dead ends, all placement or plumbing.** The ≡ renders at
x≈145, not the 10px its CSS declares (a badge holds that slot) — settled by
screenshot, which is why the readout sits under the score panel and not in
the toolbar row where it first overlapped. `perfTick` took its `dt` from a
`clock` td-tab does not have; it rides the loop's own `dt` *after* the loop
computes it, since a second delta there would have zeroed the sim. And
wrapping headless Chrome in `timeout` kills it before stderr flushes: a probe
that works bare prints *nothing*, indistinguishable from a page that never
ran.

---

## `a1acc6a`..`a596b7d` — the gates wear the portal ring

Fourteen commits. The thread through them: the portal bench got honest, then
the board got its model, then the model got everything a gate needs to do.

**The wormhole's sliders "had no effect", and one of them really didn't.**
Measured with `?fxprobe=1` — same frame twice, one knob moved, pixels diffed
— twist and hue spread came back at 30 and 40 mean delta. They were reaching
the shader all along. Travel speed was the defect, and it was in the shader:
`travel = T * uSpeed` multiplies *accumulated* time by the rate, so moving the
rate rewrites where the field has *been* rather than how fast it flows from
now on. One 0.02 step moved the image 12.1 at t=2s, 19.4 at t=20s, **28.1 at
t=200s** — a jump control that got more violent with page uptime. Into
turbulence that reads as a reshuffle, which is exactly "no effect". It also
made a ramp impossible. Travel and spin are integrated **phases** now (host
does `phase += rate * dt`); at a pinned phase a 0.02 step moves 0.000 at all
three times. The bench gained **⧉ copy / ⇩ save** for the whole construct.

**`src/portalfx.js`** holds the operator's bench export under the shader's own
uniform names, the render settings, the ring's rotor rates, and the ramp:
`travelRate(secs)` is the sentence "0 by default, 5 seconds before a wave it
rises to 6" as a function — eased, because a linear ramp puts a visible kink
at exactly the five-second mark and announces the mechanic instead of the
wave. Driven by `secsToWave()`, factored out of the boss omen, which was the
only thing on the board that knew that number. 26 checks.

```
7s:0.00  6s:0.00  5s:0.00  4s:0.62  3s:2.11  2s:3.89  1s:5.38  0s:6.00
```

**One target for the whole board.** Every gate samples the same 512px texture,
so the cost does not scale with gates — the bench's load-bearing claim, and
the only reason a **377M-sine-fold** march can sit under a live game. Named
cost: a hit lurches *every* gate's throat. Its real-hardware price is
unmeasured (headless SwiftShader says nothing about an M4); the levers are
`uSteps`, `uTurbOctaves`, `updateHz`.

**The ring, made into a gate.** Merged for the board (the bench leaves 72
meshes unmerged on purpose to report draw calls). Grounded — `fitModel` seats
the origin at the base, and the old dot-cloud offset had it hanging 0.63 cells
in the air. Gate-sized at 1.6 cells, 2× the tank. Facing the most *open*
neighbour, scored by that cell's own neighbourhood, so the mouth does not open
into rock two steps on. The operator's "we made the tank enormous" was
measured against the real mkcx: **0.75 cells, correct** — the gate had been
smaller than the tank and floating, which is what made the tank look huge.

**Grey, and lit.** The frame read black. Its materials were never black
(luminance 0.41–0.66); they read black under the 0.55 hemi / 0.25 sun. The
container's problem and the container's fix: a five-rung grey ladder, each
rung with its own emissive, cloned per gate because each gate dims and loses
pods independently.

**Two power cores per hit, then two more, then the tank's own death.** Pods
blow off with their own wreckage and a burst; the gate takes a **recoil** along
its normal, eased out over 0.22s, plus a concussion and a flash at the mouth
— the weight lives in the motion, not the particle count. The kill reuses
`destroyPlayer`'s three parts. The pre-wave **shake is removed**: a standing
ring is architecture, and a pulse on top of the wormhole ramp was the "two
things moving reads as noise" that comment already warned about.

```
HITPROBE hit 1:  hp=2  pods=6/8  debris +5  kick 0.0 → 9.0   recoil 0.22s
HITPROBE hit 2:  hp=1  pods=4/8  debris +5
HITPROBE hit 3:  hp=0  pods=4/8  debris +2  kick 9.0 → 14.4  | GATE DESTROYED
```

**The pods only work because it was measured first.** 0 of the model's 38
named nodes were meshes — `mergeByMaterial` had welded everything into the
batch, so `Pod_N_Mount` survived by name with no geometry. Hiding one would
have hidden nothing. The eight mounts are preserved pivots now (8/8 with
geometry, eight extra draw calls per gate). Third time this project has paid
for *name it as a pivot before the merge*.

**The giant white square** was `Base_Collision` — a proxy box **67% of the
model** — which the grey repaint painted, because the bench never hid it: its
authored material was simply invisible. Excluded at the merge now, with
`Callout_1` and the aux helpers, so no later repaint can light them.

**Also in this span.** Wave-2's "invisible enemies" were **ghosts drawn inside
the planet**: the idle tick opened with `pts.position.y = 0`, td-tab calls it
one line after writing the world position, and every hit test uses `e.pos`.
Measured 12.13 cells off, all buried; 0.00 after. Rule written into the file:
an idle may rotate or scale; position belongs to whoever placed the object.
And the opening garrison is **ISAO's order** now, sited 3–6 cells forward and
ranked by nearness to a live gate, through `orderTower` with a `quiet` flag so
the printer brief still fires on the *player's* first order.

**Probe bugs, all the same family.** A garrison probe waited on a wall-clock
timer for towers that are built in the *frame loop* — it measured headless's
frame rate and called it a build failure; then a 1200ms timer raced
`preloadFabricator` and reported "no drone". A size probe measured the
procedural fallback and nearly sent the fix after the wrong tank. And
wrapping headless Chrome in `timeout` kills it before stderr flushes — a
working probe prints *nothing*, indistinguishable from a page that never ran.

---

## `34b9746` — the beam lab gets the real weapon, and a drop-off bench

> "edit the BEAMS tweak page, including to test the different levels,
> lengths, and adding invincible enemies to test the drop off."

The lab could not do any of the three, and it was the same cause each time:
**it was drawing a different weapon than the game.** Two straight `beamfx`
ribbons of arbitrary world length on a flat floor, with no idea that the beam
pierces, chokes, or curves. So most of this commit is deleting copies.

**Two modules came out of `td-tab`, and both surfaces call them.**

`src/beamburn.js` — the drop-off. It pierces, but every body eats its
remaining reach; three solid cores stop it dead; a wall bites in the same
currency; mass slows the sweep per beam so the pair decouples. It sorts
nearest-first *itself*, because the order is the whole mechanic and no caller
should be trusted with it. 40 checks, including the one that matters: three
stop it and two do not, **at every rank step**.

`src/beamdraw.js` — the anatomy. The chained arc root plus the plasma plume,
the meshes, and the per-frame update. `td-tab` is a rig client now, and so is
the lab, so the lab *cannot* draw a weapon the board does not. That is the
anti-drift line this file keeps paying for: the beam preset was once tuned in
a lab whose tone mapping the game did not have.

**One unit is one cell, and the stage is a sphere.** The board runs a unit
sphere at `cellSide` 0.08, so its radius is **12.5 cells** — the lab's stage is
that exact curvature. `beamLength` in arbitrary world units is gone; reach is
in cells on both sides, free to drag from 0.5 to 14 as well as jump between
the four rank steps. The ground carries **ring markers at whole-cell
distances**, so a beam's reach can be read off the floor in the unit the game
talks in. Not a grid — a grid on a sphere is a projection argument.

The old lab scaled its widths down (`glowWidth` 0.055 against the preset's
1.0) because a cell meant nothing there. It means something now, and leaving
them drew the beam **eighteen times too thin to see** — which is exactly how
the first build of this looked on screen.

**The targets are invincible, as asked, and that is the point.** The drop-off
is a standing shape you want to look at *while moving sliders*; bodies that
die rearrange it every two seconds. Count, first distance, gap, body size and
which of them are the solid tier are all live. Colour carries the rammable
read, from `enemyspec`'s own belts. Burned bodies light up; the ones the beam
never reaches go ghostly — and that read **is** the mechanic, because what is
behind armour is never reached.

Two sizing mistakes worth recording, both caught by looking: bodies at
`size` 0.9 are larger than the tank and hide the beam they exist to measure
(the board's whole roster is 0.4–0.55), and an `emissiveIntensity` of 1.5
under the bloom chain becomes a white ball that swallows the same beam.

**`?labprobe=1`** reports the burn for all four rank steps against the current
line-up. Against the default row it prints the whole design in five lines:

```
rank=1  SODIUM reach=4c  ends=2.90c burned=2/4 missed=4.3,5.7 drag=65%
rank=5  CYAN   reach=6c  ends=2.90c burned=2/4 missed=4.3,5.7 drag=65%
rank=10 VIOLET reach=8c  ends=3.69c burned=2/4 missed=4.3,5.7 drag=65%
rank=15 IRON   reach=10c ends=4.30c burned=3/4 missed=5.7     drag=75%
```

Rank 1 and rank 5 both die in the solid body at 2.9 cells — more reach buys
nothing against armour you cannot get through. Rank 10 pushes 0.8 cells
further into it, and only rank 15 comes out the other side and reaches the
third body. That is the penetration-as-a-fraction decision from `f585653`,
visible.

**And the bench immediately found something.** `?beamprobe` walks the arc now,
and reports that at the shipped toe-in of 0.035 the twin beams' apex sits at
about 11.6 cells — so at rank 1's four-cell reach **they never converge**.
Whether the pair should meet inside the reach it actually has is a design
question for the operator; the point here is that a lab measuring in the
game's own units surfaced it in one line, and the old one could not have.

**Verified.** `npm test` EXIT=0, 31 suites / 966 checks. Both extractions are
transparent to the game: `?beamfire` burst, cooldown and live colour PASS at
every rank, and `?arcprobe` still reports 0.000 cells of core altitude over
6 links.

---

## `f585653` — the beam hugs the planet, and burns like plasma

> "the beam extends in the air, and for game play we should have hug the
> curvature of the planet, more like plasma flamethrower than pure laser."

The first half was a bug, and the rank ladder had just made it visible.

**The beam was a chord.** `drawBeam` built `from + dir*len` and lifted the
result, so the tip floated `sqrt(1+t²)-1` above the ground. Measured against
the board's own numbers (unit sphere, `cellSide` 0.08):

| reach | tip floats | wall walk under-reaches |
| --- | --- | --- |
| 2.6 cells (the original) | 0.27 cells | 0.05 cells |
| 4 cells (rank 1) | 0.62 cells | 0.21 cells |
| 6 cells (rank 5) | 1.37 cells | 0.53 cells |
| 8 cells (rank 10) | 2.34 cells | 1.02 cells |
| 10 cells (rank 15) | 3.51 cells | 1.77 cells |

At 2.6 cells that top row is invisible, which is exactly why it shipped and
sat there. At 10 it is the beam leaving the planet.

**Underneath, the sim had three disagreeing notions of "along".** This is the
part that cost damage rather than looks:

- the **wall walk** normalised a chord point (`norm3(from + dir*m)`) — it aims
  correctly but under-reaches, because `atan(t)` is not `t`;
- the **enemy test** used the raw chord, with no normalise at all. A body
  standing on the ground 8 cells out sits 0.19 world units off that line,
  against a hit radius of at most 0.13. **Every enemy past about five cells
  was unhittable** — the rank 5/10/15 beams from `31f1100` drew their full
  length and killed nothing at the far end;
- only the **drawing** lifted, and it lifted the wrong curve.

`src/arc.js` replaces all three with one parameterisation: **arc length**. On
a unit sphere arc length is the angle in radians, so a reach measured in world
units along the ground already *is* the angle — no conversion — and `arcPoint`
lands on the surface by construction rather than by a normalise that quietly
rescales the distance. `projectToArc` returns a **signed** `s` so a body behind
the muzzle is rejected rather than folded forward, and an `off` that counts
altitude as well as lateral offset, so the existing hit radii carry over
untouched. 19 checks, and the table above is pinned as assertions — the bug
cannot come back unnoticed.

**The plasma.** A flamethrower is two things, and the code says so now.

The **root** is the tuned `beamfx` ribbon — kept, not thrown away — chained in
three short straight links along the great circle. Three because `arcSegments`
solves it rather than guessing: at the rank-15 reach that is 0.02 cells of sag
per link, a fortieth of the 3.51 cells the single chord flew. The joints zero
their `capStart`/`capEnd`; leave those on and beamfx tapers each link to
nothing, so the root reads as three dashes with gaps instead of one beam.

The **plume** is a dot cloud — this codebase's native idiom (`creatures.js`,
the warn ring, the range ring all speak it) and one draw call per gun on a
frame already spending a thousand. Each dot rides muzzle→tip and recycles, so
the stream reads as something *thrown* rather than a shape *held*; it is
white-hot at the muzzle, the rank's colour through the body, and gutters out
at the tip; and it is flattened against the ground (`squash`) rather than
ballooning, because a plume that is round is a fireball. Phases, angles and
radii come off the run's seed, so two runs on one seed burn identically.

Every plume number is a live knob under **plasma** in the GUI. That is not
laziness — the shape of a flame is taste, and this repo's standing position is
that a derived value is a starting point and nothing more.

**Cost.** Six ribbon links plus two point clouds while firing, against two
ribbons before: +6 draw calls on a frame that spends ~1022 at wave 4. The
plume's inner loop shares one `cos`/`sin` pair between `arcPoint` and
`arcTangent` rather than paying four transcendentals per dot, and skips a
`norm3` on a cross product that is unit by construction.

**A probe bug on the way, and it is a shape worth naming.** `?arcprobe`
measured altitude *after* the trigger released — by then `hideBeams()` has run,
every mesh is invisible, the `visible` guard skipped all of them, the max
stayed 0, and the check read that as **PASS**. It samples mid-burst now, and
reports INCONCLUSIVE rather than PASS when it measured nothing. Same family as
the `?cine=0` lesson: a probe that can pass having observed nothing is worse
than no probe.

**Verified.** `npm test` EXIT=0, 29 suites. Headless at ranks 1 and 15: core
altitude **0.000 cells over 6 links**, plume drawn, against the 0.59 and 3.33
cells the old chord flew at those reaches. Framing the firing beam for a
screenshot defeated headless — the camera clips inside the hull at `pov` and
puts the tank off-frame at `third` — so the eye pass is the operator's, which
is what the knobs are for.

---

## `31f1100` — the beam wears the rank, and the pilot outlives the hull

Three operator rulings in one pass. The first is a number; the other two
change what the weapon and the ladder mean.

**The sweep is 0.2.** It shipped at 0.40 rad, read off "0 to 4 to 0" — about
23 degrees each side, and in play the pair spent the burst pointing away from
whatever was in front of it. 0.2 (~11 degrees) keeps the traverse legible with
the beams still on target. Moved in `td-tab.js` (`BEAM_SWEEP`) **and** in the
lab (`beam-tab.js`), because the beam lab is only worth having while what you
see there is what the tank does.

**The beam wears the rank.** `src/beamranks.js` is a four-row table read by
both surfaces:

| rank | colour | reach | dps |
| --- | --- | --- | --- |
| 1 | `#666100` SODIUM | 4 cells | 1.7 |
| 5 | `#006d8f` CYAN | 6 cells | 2.1 |
| 10 | `#d357fe` VIOLET | 8 cells | 2.6 |
| 15 | `#b51a00` IRON | 10 cells | 3.2 |

Colour and reach are the operator's numbers verbatim. The steps are **entry
plus each tier ceiling** (bronze 5, silver 5, gold 5) — the reward lands when
a tier is *finished*, not when it is entered, and gold 5 is the only
double-gated rank on the ladder, so there is nothing above it. Eleven of the
fifteen promotions stay badge-only, which is why `isBeamStep()` exists: the
toast says something different for the four that rearm the gun, and a player
who cannot tell those apart learns the ladder is cosmetic.

The dps column is **a proposal, not an operator number** — they said power
steps too and did not name it. 1.7 is what already ships and is pinned at
rank 1 so the opening of a run does not move; the climb is deliberately
*slower* than the reach climb (1.9x against 2.5x), because length is the
reward here and damage is the thing that turns a career into a cheat.

`LASER_DPS` and `LASER_REACH` are `let` now, rewritten by `applyBeamRank()`
off `refreshRankVisuals()` — the insignia and the gun are one readout. The
colour is written to the live `uGlowColor` uniform rather than baked into
`BEAM_PRESET` at construction, so a promotion landing mid-burst recolours the
beam already in the air, which is the whole point of putting the readout on
the weapon instead of in the corner.

**Penetration had to stop being a distance.** td-tab charges every body the
beam burns through against the reach it has left, in cells: `PEN_SOFT` 0.30,
`PEN_HARD` 1.10, tuned so *three solid cores stop it dead* against a 2.6-cell
reach. Leave those absolute and a rank-15 beam at 10 cells eats three cores
with 6.7 cells to spare — the choke mechanic dies silently at the exact moment
the weapon gets long. They are fractions of the live reach now
(`PEN_SOFT_FRAC`, `PEN_HARD_FRAC`), so the struggle is identical at every step
and length buys engagement **range** rather than smuggling in a penetration
buff nobody asked for. `test/beamranks.mjs` asserts three cores stop it and
two do not, at all four steps — and asserts that the naive version *would*
have broken at 15, so the reason the module exists is written down as a test
rather than as a comment.

**The pilot outlives the hull.** `loseTank()` used to call `resetTankRank()`
— "the insignia belonged to that hull". It does not any more. The tank is not
the pilot; the pilot is the player, a disembodied thing that occupies one
machine at a time, which is the only reason it cannot drive them all at once.
Burning a hull costs you the hull, and the MK-CX DOWN toast now says the rank
*carries over* where it used to say *insignia lost*. A new **run** still
starts unranked — `regenerate()` is the only caller of `resetTankRank()` left.
The ram combo still dies with the wreck; that one genuinely is the machine's
momentum and nothing carries it out.

**Two bugs surfaced verifying it.**

`?beamfire=1` was measuring the **boot defaults**. An async IIFE's body runs
synchronously up to its first `await`, and the `?rank=N` hook sits several
hundred lines further down init — so `?rank=15&beamfire=1` dutifully reported
a rank-0 beam and called it a PASS. It yields once before measuring anything
now. Worth noting as a shape, not a one-off: any probe written as a bare async
IIFE silently ignores every hook declared after it.

And `beamfx.js`'s own default glow is `#006d8f` — which is now the **rank 5**
colour. The lab would have opened on a silver-tier beam and called it the
base; `WORLD_SCALED` pins it to the rank-1 colour instead.

**Verifying it.** `npm test` is 28 suites now (`test/beamranks.mjs`, 24
checks). On the board:

- `?rank=N` reports the armed beam alongside the badge — the beam only exists
  while the trigger is held, so the numbers are the only headless evidence.
  Checked at 1 / 4 / 5 / 10 / 14 / 15: the steps land on the right side of
  every boundary.
- `?beamfire=1` reads the colour **off the live uniform**, not off the table
  it came from. The table is already Node-tested; what nothing else covers is
  whether `applyBeamRank()` ever reached the material — burst, cooldown and
  pierce all pass in any colour.
- `?rankprobe=N` forces a rank, burns the tank, and checks both the ladder and
  the beam are still standing. This is the invariant that would regress in
  silence: nothing else in the suite would notice a stray `resetTankRank()`
  creeping back into `loseTank()`, and the whole ruling is that it is not
  there.

The beam lab gained a **rank step** picker. Colour transfers exactly (it is
unit-free); length cannot, because the board measures reach in cells and that
stage measures it in world units against a 1-unit tank — so the picker scales
the lab's own length by the step's reach *relative to rank 1*. The proportions
are truthful, the absolute number is the lab's, and that is written in the
comment so nobody later copies 10 across as if it meant cells.

---

## `d88471c`..`e7b75d3` — Isao stops asking, and starts explaining

Two halves of playtest item 3, in the order the operator chose: fix the
channel, then write into it.

**The channel.** His lines used to wait for a tap — per LINE, so a four-line
beat was four taps over the board, and it never left on its own. `dwellFor()`
in `isaobriefs.js` is pure and Node-tested: 0.9s to notice the panel changed,
plus `words / 3.2` (an unhurried 190wpm, because these get spoken eventually
and a caption that outruns the voice is worse than one that lingers), floored
at 2.4s and capped at 7s. A drain bar rides under the text — without it a
player who has learned to tap keeps tapping and the auto-advance buys nothing.

The clock is a **frame-loop countdown, not a `setTimeout`** (this file has
already paid for deferred work outliving its run), and a **named function
rather than four lines inside `animate`**, because a probe never runs `animate`
and anything buried there is unverifiable by construction.

**The writing was already done.** `src/lore.js` is a 590-line codex covering
the vessel, the Stålheart, biomass and the gates — imported by `units-tab.js`
and nowhere else, so a TD player never saw a word of it. The four new beats
(`arrival`, `stalheart`, `harvest`, `motive`) are drawn from it so the game and
the book cannot drift. `harvest` is the economy taught at the first kill;
the pre-existing `biomass` beat only fires on a *refused* order, which is a
complaint arriving after the player needed to know.

**The codex was describing something not on the board.** Its `heart` entry was
a holographic anatomical heart. The Stålheart IS the Terraformer — and the
entry had hedged on exactly that ("a reactor readout, a terraforming seed, or
the vessel dreaming"), so landing settles the hedge instead of retconning it.

Three bugs surfaced on the way:

- `regenerate()` tore down a camera shot but **not a brief**, so a beat
  mid-sentence survived a reset. Third instance of that shape.
- `face: 'hungry'` is not an emotion. `emotionFrame` falls back to neutral
  **silently**, so "Biomass! ISAO happy!" has always been delivered with a
  blank face. The test now asserts every face is in the roster.
- `showBrief` marks a `once` beat seen the moment it appears, so two beats
  coming due together lost one **permanently**. Queue is now exactly one deep:
  enough that nothing is lost, shallow enough that Isao cannot become the wall
  of messages this work exists to remove.

`?briefprobe=1` fires each beat through its real seam (`setView`, `armWave`,
`noteWaveKill`) rather than through `showBrief`, so a mis-wired trigger fails
there. Negative control: stepping the clock by `dt=0` fifty times must leave it
exactly where it was, or a clock that ignored `dt` would pass everything else
by galloping to the end. 66 checks in `test/isaobriefs.mjs`.

Budget: **133s of Isao across a whole run**, longest single beat 23.6s.

## be4d6aa — the toe narrows, and rock bites the beam in proportion

`SECONDARY_TOE` 0.157 → 0.085 (operator: "less wide"). The catch was that the
**procedural fallback tank had its own hardcoded 0.09** instead of reading the
constant — and the fallback is what headless measures, because the mkcx GLB
rarely finishes loading inside a virtual-time budget. So the tuning was
invisible to every probe. Both tanks read one constant now, and `?beamfire=1`
prints which tank it measured.

Walls bog the beam like armour (operator), but **not** as the flat `DRAG_HARD`
the first cut applied. Measured: a beam standing on ground whose entire two-hop
neighbourhood is open still clips rock at 2.5 of its 2.6 cells — this map is
dense. A flat penalty therefore bogged the weapon everywhere and the sweep
never moved. Rock now bites proportionally, `wallBite = 1 - m / reach`: nothing
at the tip, full armour-grade drag point-blank into a corner.

That the flat version was wrong shows up in the neighbouring checks — `drag`'s
own clear baseline went 0.45 → 0.88 once it came off, and the two beams now
desync (0.33 vs 0.44) because the rock ahead of each differs.

`?beamfire=1` gained a wall check that **finds** clear ground rather than
assuming the spawn faces open air. It does not: that assumption was the
INCONCLUSIVE that exposed all of the above.

## `1f0b626`..`2bdeeca` — the First State

One canonical opening. Whatever ran beforehand, every reset now lands the tank
in the berth its hull count names and drives it **entirely out**, ending in the
player's hands. Brand-new game, browser reload, forced reset, retry after a
loss, hull lost mid-run — they differ only in which prelude ran, never in what
they land on.

### The two root causes

Berth cells were chosen **inside the container model's async callback**. So at
reset the game did not know where the camp was: it placed the tank beside the
Heart and teleported it into a berth once the bytes arrived. That teleport was
the jump cut.

And the teleport was gated on `t < 6`, where `t` is **page-lifetime** (`t += dt`
in `animate`, never reset by `regenerate`). Only the first six seconds of the
page's life ever staged the player at a berth. A retry three minutes in was left
standing beside the Heart. That is the whole of "every reset is different."

### The invariant

```
First page load:        CINEMATIC ──┐
Any full-life reset:  ──────────────┼──► DEPLOY_START(3) ──► DEPLOY ──► control
Hull loss:              DOWN DASH ──┴──► DEPLOY_START(2|1) ─► DEPLOY ──► control
```

`DEPLOY_START(N)` is one derived thing, and **every prelude's last frame is it**.
A browser reload still gets the cinematic — it *is* a first load — and that is
still consistent, because consistency lives in the state, not the prelude.

### Continuity by construction, not by tuning

The trick worth keeping. `updateCameraGoal()` gained a `camRaw` flag that makes
it yield the **plain gameplay pose** with every override skipped, wrapped as
`gameplayCameraPose(out)`. DEPLOY blends the doorway framing into that over its
own progress, so at `u = 1` the two poses are *the same object's output* rather
than two authored values that happen to agree. The cinematic's dive and the down
dash both land on `deployFramePoseFor(n)` for the same reason.

Measured: pos `1.57e-16`, angle `4.21e-8`. Negative control with the dive
endpoint scaled by 1.05: `4.11e-2` / `2.37e-1`.

This is the CLAUDE.md rule about deriving render-coupled values from the render
transform, applied to a camera hand-off: read the pose, never re-derive it.

### `camShot`

Every timed camera takeover — cinematic, sector reveal, down dash — is now one
primitive with **one teardown path**, latched on the shot itself rather than on a
clock the caller has already advanced past. That is exactly the bug that shipped
last week (`6d79bdd`), made structurally impossible.

The altitude review then found the same class one level up: `regenerate()` never
called `endShot()`. It is on the GUI *and* on Retry, so it can land mid-reveal,
and a surviving shot keeps its capture-phase keydown listener registered — the
keyboard dead after a reset, arriving by a third route. One line.

### `berths.js`

`computeBerths(dungeon, graph)` is a move, not a rewrite: same distToHeart 3–4
chain, same hard escape-lane requirement, same openness tie-break. Being pure and
DOM-free makes it the first part of this feature with real unit tests, and it was
proven faithful **before `td-tab.js` was touched at all** — on the game's own
defaults it returns cells `1002,1001,1069`, byte-identical to what the live game
logs. `berthIndexFor(hp)` carries the ordering rule (1st tank out of #3, 2nd #2,
last #1), tested because the array is 0-based while the paint is 1-based.

### Deleted

`respawnPlayerAtSpawn`, `exitCruise`/`releaseExitCruise` (a confirmed
dead-controls cause — a berth respawn left `cruise` engaged so the throttle lever
read as dead), `startCinematic`, `endCinematic`, `beginOpening`, `cinePending`,
`cineLeft`/`cineCi`/`cineAfter`/`cineOn`/`cineHold`, `CINE_WATCH`, `revealLeft`,
the `t < 6` staging window, `stagedRun`, and the `t > 5` safety net. That last
existed only to cope with berths landing late; nothing waits for the model now.

The cold open also lost its third beat — watching the hull drive itself out *is*
the game.

### What the probes caught that review would not have

Six probes, each negative-controlled. Two earned their keep immediately:

- `?deployprobe=1` caught `deployStart` landing in **`applyLook()`** instead of
  `regenerate()` — a look swap would have redeployed the tank, breaking this
  project's standing "cosmetics never reset the run" rule.
- `?shotprobe=1`'s negative control reproduced last week's keyboard-eating bug
  exactly: `cleared false, onEnd 0x, key reached false`.

**Lessons.** A verification flag that disables the feature under test is not a
verification — `?cine=0` is now banned from any run touching the cinematic. A
synthetic event dispatched *on* a target collapses capture and bubble into
at-target ordering and can reverse the very listener order under test; dispatch
on a descendant. And `node --check` does not resolve imports: a `vec3` import
edit silently missed because `bust.sh` had rotated the `?v=` token out from under
the match string, and only running the page caught it.

---

## `6d79bdd` — the cold open ate the keyboard

The operator, testing `e99da83a` on localhost: *"I still cannot move after the
cinematic intro."* Right — and the previous entry's verification could never
have caught it, because **every headless run passed `?cine=0`**, which skips
the exact feature in the repro path. Skipping the intro tears down correctly.
Finishing it did not.

```js
cineLeft -= dt;
if (cineLeft <= 0) endCinematic();   // already <= 0 by the time we call

function endCinematic() {
  if (cineLeft <= 0) return;         // ...so it returns, before the teardown
  removeEventListener('keydown', cineSkipKey, true);
```

When the cold open **runs to completion** rather than being skipped, the frame
loop drives the clock to `<= 0` and *then* calls `endCinematic()`, which bails
at its own guard. `cineSkipKey` is a capture-phase `keydown` handler that calls
`preventDefault()` and `stopImmediatePropagation()` — so from that moment it ate
**every key in the game, permanently**. Mouse and touch kept working, because
`click` is not the `pointerdown` the tap handler stops. That is the whole shape
of the report: WASD dead, AUTO frees it.

`cineAfter` never ran either, so the briefing the cold open fronts never
opened — no modal to explain the dead keyboard, and nothing to dismiss.

**The fix.** Latch teardown on its own flag, set when the listeners go on:

```js
function endCinematic() {
  if (!cineOn) return;
  cineOn = false;
  cineLeft = 0;
  removeEventListener('keydown', cineSkipKey, true);
  ...
```

A countdown the caller has already zeroed cannot also be the thing that decides
whether cleanup has run. The guard has to track *"are the listeners installed
and is the handoff still owed"*, which is not the same question as *"is there
time left"*.

**`?cineprobe=1`** asks the operator's question directly: can the player move
after the intro. It cannot wait the nine seconds out — under a virtual-time
budget `performance.now()` does not advance, so the frame loop's `dt` stays ~0
and the cinematic never ends on its own — so it reproduces the natural end
exactly as `animate` leaves it (`cineLeft` driven below zero, then
`endCinematic()`), dismisses the handoff the way a player does, and dispatches
a real `w`. Negative control on the old guard: `introUp=false`,
`move-after-intro=FAIL`, `handoff-ran=FAIL`. With the fix, all PASS.

**Two probe bugs, both worth keeping in mind.** The first cut dispatched the
keydown *on* `window` — which makes window the **target**, and at-target
listeners run in registration order with the capture flag ignored. That put the
game's own handler (registered at init) ahead of the cinematic's capture
handler (registered later) and reversed the very ordering under test: it
reported PASS on code that was broken. A real key lands on the focused element
and travels capture → target → bubble, so the probe dispatches on
`document.body`. The second cut asserted the key the instant the cinematic
ended, which tests the wrong moment — the briefing legitimately holds the
keyboard until dismissed.

**The watchdog was blind to this too.** It asked
`keys.fast || keys.slow || cruise || throttle !== 0` — the game's *belief* about
the input. So the one failure mode that matters most, something eating keydown
before the game ever sees it, made the watchdog go **quiet instead of loud**. It
now reads raw keydown from a listener registered at init (ahead of anything a
cinematic adds later) and prints `CTL-SWALLOWED` when the player is pressing a
drive key the game never receives. Verified firing on the buggy build.

**Lessons.** A teardown guard must track the resource, not a clock the caller
already advanced past. A verification flag that disables the feature under test
(`?cine=0`) is not a verification. And instrumentation that reads a *derived*
signal cannot see a fault in the layer that derives it — read the raw input.

---

## `e3d0713` — a run owns its deferred work

The two reset bugs the last session left open — **controls dead after a
reset** and **the cold open cuts to a repositioned tank** — turned out to be
one defect with two instances: *work started by one run landing on a later
one*. Neither was guessed at. `?ctlprobe=1` was written first, both were
measured, and the fix was written against the measurement.

**Instance 1 — the death timer crosses a run.** `loseTank()` arms a bare
`setTimeout` for `DEATH_HOLD` (1.15s) and RETRY sits on a modal the player can
hit inside that hold. The timer had no idea its run was over, so it fired
anyway: `respawnPlayerAtSpawn()` on a brand-new tank, `setView('orbit')`,
`snapCamera()`, and a *TANK LOST* toast on a run that had lost nothing. That
is a tank that is suddenly somewhere else.

**Instance 2 — the player was staged once per model, not once per run.**
`buildActors()` re-runs whenever an async model lands, and mkcx (the default
tank) always lands — so the berth callback fired **at least twice every run**,
and each firing restaged the player: `throttle = 0`, `stopEngine()`, and the
berth cruise nudge re-engaged, at whatever moment the bytes happened to
arrive. If the second staging lands after the cold open's beat three has begun
— beat three *is* the hull driving out — the tank is snapped back into the
box mid-shot. And the throttle lever the player had just set returns silently
to zero, which is what "the controls are dead, I fiddled with it and it came
back" looks like from the driver's seat. AUTO frees it because AUTO does not
read the lever.

**The fix, one idea both times.** A `runGen` counter, bumped by `regenerate()`.
Deferred work captures the generation it belongs to and bails if it moved:

```js
const deathGen = runGen;
setTimeout(() => {
  if (deathGen !== runGen) return;   // belonged to a run that is over
  ...
}, DEATH_HOLD * 1000);
```

Berth staging is keyed to the run rather than to the callback, so it happens
once however many models land:

```js
if (t < 6 && player.moves <= 1 && stagedRun !== runGen) {
  stagedRun = runGen;
  respawnPlayerAtSpawn('berths-landed');
}
```

`previewDestruction()` had the identical shape and got the identical guard.

Note the existing `serverGen` guard on the container callback did **not** catch
this, and looking at it explains why: it blocks a *stale board's* callback, but
a second `buildActors()` on the *same* board registers a fresh, legitimate
callback that passes its own check. The generation being guarded was the wrong
noun. Staging is a property of the run, not of the board or of the load.

**The probe self-asserts.** `?ctlprobe=1` loses a tank, presses RETRY inside
the hold, and prints two verdicts. Run as a negative control with both guards
disabled it reports `stale-death-timer=FAIL (1, want 0)` and
`berth-staging=FAIL (2 stagings, want 1)`; with them, both PASS. A check that
cannot fail proves nothing, so it was made to fail on purpose first.

**The watchdog ships on.** The dead-controls report has never reproduced here
— it lives on the operator's phone — so a probe behind a flag would never see
it. `ctlWatch()` runs every frame and watches for the symptom *as described*:
the player asking the tank to move (`keys.fast || keys.slow || cruise ||
throttle !== 0`) and the tank not moving for more than a second. When that
happens it prints the whole gate row in one line — `won / down / next / free /
auto / cruise / exitCruise / throttle / keys / paused / tutFrozen / reveal /
cine / buildMode / active` — so the next report names the latched gate instead
of describing the feeling. One line per episode, re-armed only once the tank
moves again, so a genuinely wedged hull cannot flood the console. `?ctl=1`
logs the same row at every respawn (each tagged with *why*) and on both sides
of a `regenerate()`.

**Lesson.** A `setTimeout` that repositions the player is a piece of the run's
state living outside the run. Any deferred work that writes game state needs
to carry the generation it was started under — and the generation has to name
the thing that actually changed.

---

## `573fbb7` — BOBBY builds everything now

The operator's fabricator `.glb`, cast as the machine that puts every tower
and every upgrade on the board. Placement stops being a purchase and becomes
an **order**: Bobby flies to the cell, hangs over it, and prints the
emplacement out of biomass. Two clocks now stand between wanting a tower and
having one — **travel** and **build** — which is the entire point. A defence
cannot be spammed any more; it has to be meant.

**The casting.** The file ships the drone hovering over a workpiece
(`Workpiece_Group`: a bed slab plus a printed bead) — the pose that shows
what the machine is *for*, and scenery on a board where it prints towers
instead. Dropped before the merge, because afterwards it would be welded
into a shared mesh and unaddressable. Preserved pivots are the things that
must move while it works: `Rotor_{FL,FR,RL,RR}_Spin`, `Boom_Yaw`,
`Boom_Pitch`, `Head_Pitch`, and `Nozzle_Tip` kept as an empty because the
print beam has to start somewhere. The boom's rest pose is read once and
animated as an offset from it — a model's rest pose is gameplay data, the
standing lesson from the mkcx and heptapod castings. The drone is parented
under `Airframe_Platform` at y=1.03 in file space (it was authored hovering
over the bed we just deleted); `fitModel` reseats it, so the offset never
reaches the board.

**The mechanic.**

- Biomass leaves the purse at **order** time. A queue you have not paid for
  is a queue you would spam.
- Cancelling refunds in full — nothing was printed. Except the order Bobby
  is already standing over: the biomass is in the nozzle by then and half of
  it does not come back. An ordered cell's radial offers exactly one thing.
- Travel is 2.6 cells/sec over the sphere. A print is `2.0s + cost/55`, so a
  60kg single takes ~3.1s and a 260kg laser ~6.7s. First guess — the whole
  feel of the mechanic lives in those two numbers.
- A queued site shows a ring of points in the tower's colour. When Bobby
  arrives, the tower itself **grows out of the wall top** as he prints it
  (`scale.y` is the print head), which beats a progress bar.
- The print beam is **one pooled `Line`**, rewritten in place. The effects
  rule here is that activity must not add objects.
- He re-checks the site on arrival: a strike or a sale that took the cell
  mid-flight returns the biomass instead of building into a hole.
- He works through the build downtime — the war is frozen there, but
  construction is the thing you came to do. A reveal or the cold open stops
  him; those are the game speaking.
- He flies where nothing on the ground reaches him. The operator's framing,
  shipped as a simplification rather than a physics claim.

The headless sim's builder AI moved onto the same path, so the next balance
batch measures the game as played. `placeTower` survives as the instant path
for two callers only: the opening garrison (pre-built, not ordered) and
`?tower=`.

**Verifying an asynchronous machine.** Bobby is async twice over — the model
loads async, and a tower taking wall-clock time to exist *is* the mechanic —
so `?tick` cannot reach either. `?order=key` puts orders on the book
(choosing sites itself, so no cell ids needed) and `?bobby=N` runs N seconds
of his shift. At 0.5s: `state=travel`. At 4s: `state=build t=2.50/2.73`. At
14s: `state=idle`, tower standing.

Lore: **BIOMASS** joins the world entries, and Bobby gets his own — including
why a machine with no crew aboard has a name stencilled on the tank.

---

## `1bc9d73` — The cold open, and berths you can drive out of

Three operator reports on the life containers, one of which was a real bug
with a cause nobody had guessed, plus the opening cinematic.

**The hull was invisible inside the box.** The spare sat at `z=0.05` — dead
centre of a fixture that runs z ±0.80 — so it hid behind the door frame in
its own shadow. It parks at `0.52` now: nose on the door plane, body lit.

**It could not get out.** Three independent causes, all live at once:

1. `respawnPlayerAtSpawn` aimed the fresh hull at `exits[0]`, and for a berth
   in a row of three that is usually *another berth*. On the graph the tank
   drives through a solid container; in free movement it noses into a wall.
   Sibling berths are filtered out of the choice.
2. **Manual is the default mode, and manual needs a held key.** So the hull
   sat there — the whole of the "cannot get out by itself" report. A hull
   leaving a berth now engages `cruise`, the existing rolls-forward-on-its-own
   state, and idles out of the doors; steering takes the wheel back.
3. The margin test in `freeBlocked` treats a solid neighbour as a no-go shell
   around the lane, and between three boxes in a row that leaves a gap the
   hull cannot thread. While the player is still IN a berth the boxes stop
   crowding; clear of it they go solid again.

And a placement rule the report earned: every berth must keep at least one
open neighbour outside the chain. Scoring for minimum openness was doing its
job too well and could pick a sealed garage — and each of the three becomes
the spawn as lives run down.

`?driveout=N` exists because the question could not otherwise be asked:
headless cannot drive, and `?tick` runs at init — *before* the container GLB
resolves. It simulates N seconds from the berth and logs the cells reached.
Six seeds: every one stuck at one cell before, every one out and moving
after.

**The repaint.** Industrial grey on the proto — walls brightest, frame a
shade under so the ribs still read, deck lighter so a parked hull has
something to be a silhouette against. Base colour alone did nothing: the
default look runs a hemi at 0.55 and a sun at 0.25, and a `MeshStandard`
under that light is near-black whatever you paint it, so each rung carries
its own emissive (the `tintModel` ladder, applied by hand — three material
names are the whole model). Yellow-black hazard tape on both sills and
around the doorway. A stencilled numeral on both flanks *and the roof*,
because the roof is the face the orbit camera actually sees.

The numeral runs on its own state, deliberately split from the lock lamps:
`setStocked` says "a spare is racked here", `setAlive` says "this life still
exists". Berth 3 stands empty from second one and still reads **3** — you
are driving it.

**The cold open** runs whether or not the tutorial does. Beat 1 pulls
straight out along the berth's own normal until the whole vessel is in
frame; beat 2 dives back onto the berth row; beat 3 lets go of the handbrake
and the hull drives itself out. Beat three is not animation — driving is
unfrozen and the tank is on its own nav, which is also the honest way to
prove a berth can be left.

The dive does **not** slerp between two camera framings. That swings the
subject out of frame halfway (the first cut did exactly this): it moves the
eye and keeps looking at the berth, so the box only ever grows. The seam
with beat 1 is invisible because the wide eye sits *on* the berth's normal —
from up there, looking at the planet's centre and looking at the berth are
the same direction. In beat 3 the look point drifts onto the hull, so the
shot ends on the tank rather than the box it left. Any key or tap skips it;
`?cine=N` parks it on a beat and holds the clock there for stills.

---

## `bb85201` — Credit becomes BIOMASS

The currency changed substance. Kills paid *credit*, an abstraction the HUD
printed; they now pay **biomass** — alien tissue rendered down, the one
thing the coming Construction Drone can print structures out of. The lore
change is the point; the code change is deliberately shallow.

**The math did not move.** HokorobiTawaa's bounty values, the 5%-per-kill
streak, the ×5 cap, the leak reset, the 75% reclaim on a sell, the ×1.5 ram
premium — all verbatim. That is what keeps the 2026-08-30 sim batch valid:
it still describes this build, because only the name and the unit changed.

`src/economy.js` keeps its filename — the economy is the system, biomass is
the currency inside it. `START_CREDIT` → `START_BIOMASS`, the getter
`.credit` → `.biomass`, `addCredit` → `addBiomass`, the `startCredit`
option → `startBiomass`. `creditTankKill` → `harvestTankKill`, because a
tank that kills does not get credited, it harvests.

The unit is **kg**, not a letter. `190c` reads as an abstraction and `190kg`
reads as rendered tissue, which is the entire reason for the change. It
surfaces in six places at once — the loud orange resource line, the radial
centre, the tower cost tiles, the sell and upgrade wedges, the black-market
prices, the sector-clear log — so the suffix was picked before anything was
edited. `.hud-credit` → `.hud-biomass`.

Debug hooks: `?biomass=N` is the name; `?credit=N` still works as an alias
so saved URLs and sim scripts survive. The sim row key and the sim table
header in `index.html` are `biomass`. Entries above this one and both
`simdata` batches keep the old word — they are records, not documentation.

Verified: `npm test` green (tdcore's economy block renamed alongside the
API), headless load clean, HUD reads `970kg` from `?biomass=800` on a 170
start.

---

## `01bd6db` — Shallow berths

The freight-length containers hid their cargo in their own shadow — the
operator could not see what was inside, which for a *display* is the
whole failure. v3: depth squashed to 0.55 (the racked hull
counter-stretched so it keeps its proportions), the tank parked at the
doorway, three berths in a row — a chained adjacent triple at
distToHeart 3–4, further out than before, scored to hug a wall. One
hull per berth; each death still commandeers the next hull at its own
container.

---

## `abc853b` — Two berths, four bays, and every spawn drives out

Containers v2, restaged to the operator's blocking: **two** containers
side by side on the *emptiest* flank of the heart's chamber — the
adjacent open pair at distToHeart 2–3 scoring the fewest open
neighbours, a wall-side berth clear of the lanes — doors toward the
heart, two hull bays each, spares racked nose to tail.

The display and the spawn system are one mechanism now: the opening hull
drives out of its bay in the first scene, and every death *commandeers*
the next hull at its own container — bay `k = HP−1` in the order
c0/0 → c1/0 → c0/1 → c1/1, so the pair reads symmetric while both are
stocked and each death visibly empties a bay. Lamps go red only over a
container's last empty bay.

Also: the close-call roster went trilingual with the operator's list
verbatim — *pt1 c'est chaud!*, *moins une!*, *ca passe ou ca casse*,
ギリギリ, 危機一髪, セーフ！ and friends.

---

## `8c1caee` — SNAFU, dossiers, commas, and the black market

The last transmission now opens with the operator's exact words: **LAST
TRANSMISSION / SNAFU · K-KILL ×N** — N being hulls destroyed, an honest
×0 when the heart fell with the tank intact — then the eulogy and the
numbers, every score wearing commas. Hover a killer's icon and its
dossier fills in: label, role, hp, speed, DO-NOT-RAM in red, bounty.

Missiles got their economy: the platform restocks **one round per
sector**, and the **second relay win opens the black market** — a buy
button on the launch console, 500c and climbing 250 per purchase,
feeding the *reserve* so bought missiles still ride the promotion
window and the re-orbit clock. The relay's ladder is now: win 1 = AOE,
win 2 = the market, wins 3+ = tower unlocks ahead of the clock.

---

## `5c7e1b6` — Lives you can walk up and count

The container GLB became the third diegetic instrument: health is the
glow strips, ammo is the shell rack, and LIVES are now three shipping
containers ringing the heart, doors jacked open facing it. Two hold a
cold MK-CX; one stands empty — a counter that starts at two, displayed
honestly. Lose a hull and a container's tank vanishes, its lock lamps
going red (private lamp materials per instance — the shared-material
lesson, third application). `Cargo_Group` dies at preload per the spec,
and the authored collision wireframes are hidden in both casted GLBs.

A guard bug worth the note: the placement's generation check was off by
one against `++serverGen` and silently never placed anything — caught
only because the placement logs `CONTAINERS placed=N`, the same
probe-or-it-didn't-happen rule everything else here lives by.

The viewer grew the world to match (operator's ask): the Antipode Relay
and the Life Container join the neutral group, the Gate joins the
hostiles, and the codex covers them all — the world entries now double
as unit entries via aliases, one text with two homes.

---

## `fd50584` — The balance, confirmed by rerun

Same 3 styles × 8 seeds, same seed ladder, new balance
(`docs/simdata-2026-08-30-post-balance.jsonl`). Before → after:

- **style1 (the operator's style): 5W/3L → 7W/1 timeout, zero losses.**
  Median heart: was 5 by wave 3 — now **10 flat through wave 6**. The
  garrison + taper removed the early executions entirely; the one long
  run rode 1 heart from wave 7 to 18, dangerous the whole way.
- **style2 (pure builder): 5L early → 7L LATE (median final wave 6 →
  10.5, heart 10 until ~wave 12, then collapse).** This is the AOE gate
  working as designed: tower-only turtling no longer scales into the
  invasion — without the relay's artillery you eventually drown. Fight
  hands-on or go hack.
- **style0 (floor): still dies at wave 2–3.** The metrics still tell bad
  play from good.

Honest flag: waves 1–6 may now be *too* safe for a competent hands-on
player (median damage zero). If playtests agree, the taper has room to
retreat from 55/70/85 toward 70/80/90. The credit flood persists
(wave 6–9 onset) — still the next lever.

---

## `d6eac40` — The relay holds the artillery now

The sim batch's levers, pulled as the operator ruled them:

- **The AOE gate.** The OP half of the slow+aoe combo never unlocks by
  the wave clock again — `HACK_GATED` removes it from the ladder, and the
  only source is winning a protocol at the Antipode Relay. The radial
  shows **⌁ RELAY** where its wave number used to be; sniper and laser
  each arrive a wave earlier in the reshuffled ladder. The tests assert
  the rules, not the lists: the clock never unlocks a gated tower, the
  first relay win always does.
- **The opening garrison.** Two free singles pre-built on the walls
  nearest the heart — it was paying half its total damage before any kit
  existed.
- **Gentler openings.** Waves 1–3 taper to 55/70/85% of scheduled size,
  and the first gap runs 1.6× — starting further away in *time*.

The before/after on one seed says it all: seed 1000 died at wave 2 with
heart 0 under the old balance; under the new one it reaches wave 13 on
**1 heart** — the early game bites without executing, and the mid-game
without AOE is no longer free. The credit flood is still there (3,465c by
wave 12); that lever stays on the ROADMAP list.

---

## `deba00f` — First real data out of the simulator

The harness needed two fixes before it could deliver, both worth keeping:
`frame()` was doing **DOM work per simulated step** — an innerHTML rebuild
×120 per painted frame taxed every batch ~2 seconds; gated behind the
paint flag, batches cost 6–8ms. And under a virtual-time budget rAF
starves while timers race — the house trap every probe documents, now
wielded on purpose: the sim loop rides `setTimeout(0)` while simming. A
300-sim-second run completes in **~7 wall seconds**; 24 runs in under
five minutes.

The batch (3 styles × 8 seeds, archived in `docs/simdata-2026-08-30.jsonl`)
quantified the operator's gut feel exactly:

- **Waves 1–3 deal essentially all the heart damage** — median 10 → 5 by
  wave 3, then flat to the end. The early game is the game.
- **Credit floods from wave 6–8**: median crosses 3× the priciest tower
  and compounds ~30–50% per wave once tower capacity saturates (placeable
  trunk walls run out at ~14–21 towers). A builder run sat on 34,000c by
  wave 18 with literally nothing to buy.
- **Hands-on play wins**: style1 (ram + chokepoints) took 5/8 sectors;
  the pure builder took 1/8. The credit split's intent, confirmed.

The tuning levers this points at, recorded as the working list (also in
the ROADMAP, where levers survive):

- **Early cliff**: soften waves 2–3, or fatten the opening kit — the
  heart pays half its total before slow/aoe exist.
- **Credit sinks**: per-copy tower price escalation; buyable orbital
  strike charges (already rationed — a perfect sink); the ally units the
  economy item already specs.
- **Operator's preferred lever — gate the strongest towers behind the
  HACKS.** Sniper/laser (and future top-tier kit) stop unlocking by wave
  and instead require winning a protocol at the Antipode Relay. This
  attacks both findings at once: the mid-game gets a reason to spend
  time (drive to the pole, breach the vault, win the duel) instead of
  passively banking bounties, and the strongest defense arrives by
  PLAYER ACTION rather than by the clock that currently trivializes
  wave 6+. The hack already grants +1 unlock; this would make it the
  ONLY source for the top of the tree.

---

## `0fc19cd` — Thirty-five entries, two registers each

The units viewer grew a CODEX (LORE button, `?lore=1`): every unit
described as it *exists* — survey-log register — and again as a
txt2img-ready visual prompt, each behind its own ⧉ with a copy-all in
the bar. The conceit that makes the whole game cohere: the dot-render is
the tank's **survey lattice** — lidar constellations standing in for
organisms that are wetter, brighter, and worse — and a SOLID in the
returns is a core the beam could not pass. The do-not-ram rule, written
in hull fragments.

Object Stålberg-9, the Cardion, the Antipode Relay, the Gates; the
six-axis arm that learned violence; the Obelisk we excavated and chose
not to ask about; the Shellback that measurably read our doctrine.
`test/lore.mjs` asserts the rule: every catalogue id has an entry with
real substance — the roster grows, the codex must grow with it.

---

## `a55ffe4` — Smaller, and never everything at once

An operator field screenshot settled it: on a real phone every HUD
element rendered at desktop scale, all visible at the same time —
unplayable. The fix is two principles, not twenty tweaks:

- **Smaller.** Mode row to single-line pills (mute button deleted on
  phones — the phone has a hardware mute), panel to 10px with a width
  cap, radar to 23vmin/138px (the armed targeting view keeps its size),
  cards/toasts/console/chip compacted, wheel and throttle scaled by
  uniform transform so spacing shrinks with the buttons.
- **Never everything at once.** The tower radial adds a `shopping` class
  and every transient element clears out from under it — placement is a
  focused task and gets a clean screen.

Zero overlaps by rectangle probe, verified at real 390px.

---

## `8a71ea4` — The catalogue earns its fullscreen

Two viewer passes (`63cdba7`, `8a71ea4`): fullscreen units read as sparse
fog because `frame()` magnifies the silhouette while the dots stay
battlefield-sized 2px squares — so the catalogue now builds enemies at
**6× density** and fattens every dot 2.2× through a round-dot sprite (a
`Points` vertex is a square unless given a map; at 4.6px the corners
read — the mortar's old lesson, relearned in the viewer). Battlefield
rendering untouched.

And the SWEEP toggle — named for the tank's turret — was always driving
every unit's own in-game tick. It is called **ANIMATION** now, and
hostiles default to it with the turntable OFF: a swimmer under an added
spin reads as neither. The spin default re-lands per unit shown;
friendlies and towers keep their turntable.

---

## `a12c6da` — The shell is an event

Nine to a rack, and the operator's brief was exact: spending one has to
*feel worth it* against just waiting for the towers. So: direct hits do
**4 damage** — a one-shot on everything up to and including the rolling
mine; only prime and the Thorus soak it. The splash grew to **2 cells**
at 2/1 damage (half-radius/edge), which means the blast's *edge* still
kills fodder — a shell into a pocket clears the pocket. And the
explosion earns the price: the strike's three-ring language at shell
scale, a doubled dot burst, and the heavy blast sample landing at the
impact — the shot already spoke at the muzzle; now it answers downrange.

---

## `1bb9b65` — The game plays itself, then eulogizes you

**The simulator** (`2a420d0`). Tier-1 as designed: the simulation IS the
shipping game. A SIM tab batches runs through one same-origin iframe
(sequential on purpose — 16GB machine), each run `?sim=<style>&seed=N&
simfast=K`: the animate loop split into `animate()` + `frame(dt,
simSkip)` so fast-forward is K honest fixed 1/30 steps per painted frame
— never one huge dt that tunnels enemies through collision — painting
every 30th frame, bloom off, audio muted. `style1` is the operator's
stated modus operandi (ram, SLOW/AOE at trunk chokepoints from greedy
portal→heart descent, snipers, upgrades); `style0` is the floor. **The
first completed run paid for the feature**: style1 lost at wave 2 with
zero towers — the preferred kit unlocks at waves 4–7 and the policy had
no opening. The fallback rule came from data, not intuition. Runs emit
`SIMRESULT` JSON (console + postMessage); the tab aggregates win rate
and medians on a fixed seed ladder so styles compare on identical
worlds.

**The last transmission** (`1bb9b65`). Game over opens with a verdict in
three tiers — low-key diss tracks for early deaths, salutes for the
middle, honors for wave 9+ — picked by score modulo so a replayed seed
gets the same eulogy. Under it: the run dashboard from new run-level
bookkeeping — kills by source, rams and best combo, strikes, max rank, a
tinted kill histogram, a score-tempo sparkline, and THE KILLERS: an icon
card for each enemy that took a tank, in order. A heart-fall death reads
"hull intact to the end — the heart fell first."

---

## `f3ec490` — The pedestal is the tier

Operator's spec, adopted whole: a tower's upgrade state is its
**foundation** — square slab when built, hexagon at the first upgrade,
circle at the second. Readable from any camera, no label, no bar.

It lives in the shared mast, so all eight towers (and every look)
inherit it: `userData.setTier(t)` swaps the base mesh in place.
`EdgesGeometry`'s default threshold does the aesthetics for free — it
culls the smooth walls of the round bases, so the hexagon keeps its six
corners and the circle reads as two clean neon rings. A look swap
re-applies the earned tier, since rebuilt objects are born square.

Verified by geometry, not squinting: the `?tower=` hook grew a
`key@ci@tier` arm and reports the mounted base — `BoxGeometry`,
`Cylinder seg=6`, `Cylinder seg=28` for tiers 0/1/2.

---

## `716d7d2` — The wheel learns digits

Desktop QoL: with the tower radial open, **1–8 place** — each option
wears a small green digit badge (hidden on coarse pointers), ESC closes,
and the digits are *claimed* even when a placement fails, so a miss on a
locked tower never falls through and flips the camera to O1 instead.

The catch that earns the entry: the wheel renders in `TOWERS` order,
which is **not** `TOWER_ORDER` — slow and homing swap. The first cut
numbered the badges by one and fired the keys by the other: badge ④ said
homing, key 4 placed slow. Caught in the verification screenshot before
it shipped. The rule that survives: the keys follow the wheel — what the
badge says is what the key does.

---

## `3d9ca55` — Demolition is permanent

Field report: pushing toward the server when a round ends, the sector
reassembly sometimes sealed the tank inside solid rock — `applySector`
rebuilds every round's tags from the full world, which quietly regrew
every wall the player had blasted.

The operator proposed the mechanic and it shipped verbatim: **breached
walls stay breached.** Every cell opened by a shell or a strike joins
`breachedCells`, re-applied on every reassembly *before* the reachability
seal — deliberate ordering, because a breach tunnel that connects to the
open network is thereby reachable and survives the seal on its own merit.
A new world clears the set; the server's cell and tower-anchored walls
stay unbreachable.

Persistence alone left one entombment path: a tank parked on a
*later-band* lane it reached through a breach — the band gate reseals
that ground regardless. So the safety net: after each reassembly, a tank
standing on BLOCKED redeploys beside the heart with a REDEPLOYED toast
that says why it moved. The frontier can shift; it cannot bury you.

---

## `10eb089` — The bubble, and the catalogue's budget

**The energy shield.** A fourth pickup (dome orb — it joins `PICKUPS`, so
the viewer's Neutral group and the glossary describe it without being
told): 12 seconds of a dot-shell bubble over the hull — a fibonacci
ellipsoid of 280 additive points, one draw call, bloom doing the energy
read. Touch damage bounces off while it holds (the impact still shoves —
armor stops damage, not physics), the shell flashes on each absorbed hit
and blinks urgent through its last quarter. Regrows like the other
consumables. One measurement mattered: the bubble is sized off the CELL —
the first cut rode `unitScale`, which carries the mkcx normalization, and
came out five cells wide.

**The viewer goes wild.** Every `DOT_SHAPES` entry takes a density factor:
game at d=1, unit viewer at **d=4** — one unit on screen at a time can
afford what a crowd cannot. The shellback's log spiral finally reads as a
nautilus at 1600 dots. Nothing was hand-added for the new roster: the
three invasion enemies and the shield orb all arrive in the viewer
through the derived lists.

---

## `36521a1` — Three ways to be dangerous

The invasion phase (waves 13+) gets its own roster, one behavior each:

- **SAUCER** (wave 13) — the lab's ufo shape, freed when the bacterium
  took scoutufo's slot. Rammable fodder, but `jink` stacks a second,
  faster weave on the erratic bursts — a dogfight, not a walk.
- **SHELLBACK** (wave 14) — the lab's seashell spiral under the wave
  animation. The tactician: it holds at the *edge* of tower coverage
  until three minions arrive as cover, then bursts through with them at
  1.9× — the first enemy that reads your towers. (Geometry lesson: a log
  spiral's mass sits in its outer whorl, so the cloud is centroid-
  recentred and pulled to 0.78 or the solid core floats beside the shell
  and the dots read as dust.)
- **PHANTOM** (wave 15) — the ghost shape under optical camo: a ~0.14
  opacity haze with a brief shimmer of presence every ~6 seconds, and the
  radar shares the same decloak window — no window, no blip. Non-rammable
  on purpose: the danger klaxon becomes the warning for the thing you
  cannot see.

The roster tests were pinned to 12 and failed exactly as the deban lesson
predicted; they now assert relationships (every intro ↔ spec ↔ tint,
`typesByWave` caps at `INTROS.length`) instead of counts.

---

## `49a8b2b` — Three protocols

The relay's breach bar grew tabs: HDT (the circuit duel) is joined by
**BRIDGE** (hashiwokakero) and **SHIKAKU** from the operator's
`pazorukore` engine. The second vendor was cheaper than the first:
pazorukore is vanilla ES modules with no build step — our own idiom — so
the vendor is a straight copy of `index.html + styles.css + src/` into
`minigames/pzk/`, with the manifest link stripped and `initPWA` stubbed
(no service worker inside an iframe). Game selection is its own `?game=`
query; the futuristic skin ships as-is, which is what "same look and
rendering" meant.

Win detection stays the same-origin read with one branch per engine:
`__cx.game().phase` (WON/LOST) for the duel, `__pazoru.phase === 'solved'`
for the puzzles — which cannot be lost, only abandoned, so ABORT is their
only exit without the prize. Any protocol's win patches the firmware.
`?hack=hdt|bridges|shikaku` boots each directly; both puzzles verified
rendering in-frame.

---

## `4703bca` — The vault

Two placement cuts died in the field ("inside a wall", then "ON a wall")
before the operator specified the pattern outright, and it is better than
either attempt: **carve an empty chamber at the true antipode, confirm it
is clear, then seat the server in its centre.**

So the world build now carves a floor disc — every cell within two hops
of the literal minimum-dot cell, 13 cells, five across — into the FULL
world, ringed by whatever rock was already there. The vault is exempt
from both of `applySector`'s gates (band and reachability), so it renders
as an open room inside the rock from round 1. Unreachable at first *on
purpose*: walls blast open, and a vault you have to breach is the fiction
working for us. Its cells keep `distToHeart = -1`, which quietly keeps
nav, rewards, and portal placement out of it. The `?server=1` probe now
prints `chamber=13/13 clear ground=OPEN` — the "confirm before seating"
step, made permanent.

Also: the dev-log copy affordance became a small ⧉ icon (token) plus ↗
(deep link to `?devlog=1`) — the whole-label click was the wrong
affordance.

---

## `e2c1d31` — The relay stands at the pole properly

Field report: "the server spawned inside a wall, and I cannot find how to
interact with it." Three faults, and a design fact discovered on the way:

- **Placement.** The pure minimum-dot cell was solid rock. The
  current-round walkable minimum sat at dot 0.46 — nowhere near a pole —
  because round 1 seals everything beyond the inner sector. Measurement
  settled it: the FULL world's lanes reach dot **−0.987**, so the server
  now stands on the full-carve cell nearest the true antipode — a real
  lane that a late round will reveal. The far pole is end-game territory
  by the game's own band-reveal design; the server leans into that
  instead of fighting it.
- **The lift.** While its band is sealed the relay is a landmark mounted
  ON the high ground (lifted by `wallHeight`); `syncServerLift` settles
  it onto the lane floor the round its band opens.
- **The silence.** `placeError` suppressed the tower radial on the
  server's cell — correctly — but nothing replaced it, which read as
  "cannot interact". Tapping the server or any neighbour now always
  answers: hack when awake, the one-per-round notice when patched,
  "beyond the frontier — push the rounds" while sealed, "drive closer"
  when open but undiscovered.

---

## `a328217` — The phone gets flicked

Three mobile rulings from live testing:

- **The NEXT WAVE chip is transient.** Mid-wave it read "clear the field"
  — permanent furniture stating what the board already shows. It appears
  at wave-clear with the countdown, leaves at spawn.
- **The console folds vertical.** Safety over readout over 発射, 128px in
  the right column under the radar, instead of a 296px bar across the left
  column. The lane moves left below the chip; the hack button docks under
  the console; the SitRep compacts to die above the throttle. Probe: zero
  overlaps.
- **Orbit is explorable.** `buildFollowTank` yielded only while a finger
  was DOWN — and phones explore in flicks, so every lift let the
  off-frame tank yank the camera home ("impossible to explore"). A pan
  now *suspends* the follow; driving again (steer, keys, cruise) or an
  explicit recenter re-arms it. The duty survives exactly where it is a
  duty: while you are actually driving from top-down.

---

## `1c9f81a` — THE SERVER, and the first hack

Something new: at the heart's exact antipode (minimum-dot cell, measured
−0.999) stands a server — the `server_ceb25b9d` GLB through the standard
fit pipeline, two cells tall, **invincible**: `breachWallCell` refuses its
cell (no strike or shell opens it) and `placeError` keeps towers off it.

Drive within three cells and it is FOUND: a pulsing HACK SERVER button
joins the console rail. The hack opens a full-screen breach overlay — the
dial-up handshake plays, six seconds of negotiation being exactly the
fiction of connecting — around the **HDT circuit duel** from the
`hacking-mini-games` repo, vendored as a static build under
`minigames/hdt/` (relative base, PWA bits stripped so it cannot register
a service worker at our scope).

Two integration moves carried the whole thing:

- **The deep link is a filename.** The minigame's router parses digits
  out of the URL path; serving the built index as `3.html` boots straight
  into game 3. Zero patching of a finished game.
- **Same origin beats a protocol.** The iframe is ours, so the parent
  simply reads the duel's own state — `window.__cx.game().phase` on a
  600 ms poll. WON patches the firmware: the next tower unlocks ahead of
  its wave gate (`unlockedTowerKeys(wave + hackedUnlocks)`). LOST drops
  the connection; the relay resets for another try. One successful hack
  per round; unlocks persist for the run.

`?server=1` reports antipode dot + async placement; `?hack=1` boots the
overlay directly — verified headless with the duel rendering in-frame.

---

## `c4530c0` — Consumables regrow

Health and heart-regen orbs respawn: each consumed one schedules a single
replacement on the far field 50 s after pickup, through the same `whim()`
stream and the same far-field placement rule as the opening spawn — so a
replayed seed regrows identically. Power stays one-shot on purpose: a
permanent speed buff that respawned would be a farm, not a reward. A new
board clears the queue.

---

## `7523a30` — Line of sight, the third heat gauge, and the lane

**The railgun respects walls now.** `losClear` samples the chord from the
mast's cell every ~0.45 cells; any BLOCKED cell along it — other than the
tower's own, since the mast stands ON high ground — refuses the shot, and
the sniper takes the nearest *visible* enemy instead. A shot along a wall
ridge is blocked by the ridge, which is exactly what "not through walls"
means for a gun at wall height.

**Secondary heat, attempt three, right mechanism.** Attempt one lerped a
material that `mergeByMaterial` had shared with half the hull. Attempt
two cloned it and drove emissive — provably changing, still invisible at
gameplay distance (operator confirmed on `1c834a26`). The realization:
the cannon's gauge is legible because it is a **dedicated
MeshBasicMaterial sleeve**, not the model's own PBR. The secondaries now
wear the same instrument — a small sleeve per tube, one shared material,
driven by the same lerp that provably works for the cannon. Lesson filed:
when a working reference exists (the cannon), copy its MECHANISM before
inventing a subtler one.

**The announcement lane.** SitRep, NEW THREAT/TOWER cards, and toasts
move off the sightline into one shared lane — desktop left rail, phone
right column — so they never fight each other and never cover the tank.
Callouts, the combo, and the danger warning stay centred on purpose. The
rectangle probe tracks the card now; zero overlaps at every width the
phone media block covers.

Also: the dev-log build token is click-to-copy, the affordance the
retired corner badge used to carry.

---

## `d2a1efa` — The wreck had agency

The operator's bug report — "respawned on the same spot with RED life
indicators, still ramping up the RAM ×" — decoded into one missing state:
**there was no down-state.** Through the death hold the invisible wreck
kept everything: auto kept driving it, it rammed for combo and pay and
rank, enemies touching it cost a second life (the red accents), and it
grabbed pickups. The "same spot" was wherever the ghost had driven itself
before the respawn timer fired.

`playerDown` now gates motion, touch/ram, the danger warning, both
weapons, the auto gunner, and pickups; it sets in `destroyPlayer` and
clears on every restore path. The ram combo dies with the hull — and at
`loseGame` too, where it used to hover over the last-light modal.

Also: the secondary bolts were `BoxGeometry` — the operator's "too
blocky" was literal. They are round tracers now, the idiom every tower
shot already speaks: hot 7px head, three cyan ghosts strung behind along
the flight line, per-bolt geometry disposed on kill.

---

## `69a4c6c` — Heat that glows, callouts that switch tongues

The secondary tubes clicked but never changed color on the mkcx model.
The root cause was worth the note: `mergeByMaterial` can hand the gun
meshes a material instance **shared with other hull parts** — heating the
shared instance tinted half the deck by an invisible hair — and a color
multiply on a dark textured PBR gun barely shows regardless. The guns now
carry a private clone of their material (shared between the pair only,
stashed as `userData.gunHeatMat`), and the tab drives its **emissive**
channel with heat — faint cyan to `0xff2200`, intensity 0.3 → 2.0 — which
is what the bloom chain amplifies into an actual glow. `?laser=1` now
reports where the heat lands (`GUNHEAT mat/col/emi/int`), because a color
no one can see is exactly the bug a probe must catch — position-only
lessons apply to materials too.

Also: the reckless callouts alternate languages — すげ〜！ ヤバイ！
接近だ！ 接近過ぎ！ interleaved with the English in the deterministic
rotation.

---

## `e34b4d4` — The HUD is an instrument panel now

Preceded by `fe71108` (three tweaks): every autopilot directive except RAM
and AVOID now carries a proximity-weighted flee vector away from the solid
tier — filed against seek-home driving the hull through a barbed; the
secondary's lockout is audible (a dry-fire click — the reload sample's
first transient pitched up, rate-limited by the manifest's `minInterval`
while the play call fires every frame) and legible (the red drains out of
the pad button bottom-up as the tubes cool, 4% steps); CORONAVIRUS → VIRUS
and SOLVING TORUS → THORUS, single-sourced in `INTROS`.

**The rework.** The five-line text block became a CRT panel in the
established console family — subtler than the manual and SitRep, because
this one never goes away. The design rule: three brightness tiers for
three reading distances — vitals bright (red hearts with dim sockets,
cyan tank HP, shells going red at zero), resources mid (orange credit,
the wave numeral largest on the panel), meta/objectives dim, alerts a
transient amber row.

Two ideas carry the rest:

- **Control state lives on the control.** The MANUAL/AUTO line left the
  panel; the AUTO button is amber while engaged and wears its directive's
  name. A state line you read *next to* a button you press was the same
  fact twice.
- **Grouping by tint, not by markup.** Camera buttons cyan (the tank's
  color), system buttons green. No separators, no extra width — the mode
  row still fits a 390px phone, which was the stated preoccupation. The
  phone panel tightens to hold all five rows (alert included) above the
  NEXT WAVE chip; the rectangle probe reports zero overlaps.

---

## `1e4d2f7` — Feel: splash, heat, bragging rights, and a report

Four commits in one playtest cadence (`92aa458`, `577f07a`, `1e4d2f7`):

**Shell splash, mortar class.** 1.6 cells (was 0.95) with falloff — 0.75
inside the half-radius, 0.4 to the edge — and the strike's ring language
at shell scale so the splash is READ, not inferred.

**The secondary's heat, on the pad.** The gun tubes already glowed; now
the laser button runs the same cycle — white → orange → red, blinking
through the lockout. Styled on band *changes* only; per-frame style writes
on a button are layout noise.

**Callouts + the ram combo.** Deterministic rotation (a counter, not
`Math.random`) through RECKLESS!/CLOSE CALL!/TIGHT!/FEARLESS! for
hands-on kills of solid units at arm's length; PROTECT THE HEART! and kin
for kills in the heart's yard, 6s-gated because sieges kill by the dozen;
STREAK ×N every fifth consecutive kill, dying with a leak like the streak
itself. The RAM ×N counter climbs a tier every 10 — size and color, white
through flickering magenta at ×50 — on a 4s window.

**The sniper fires a round, not a ray** (`577f07a`). The beam pair read
as a laser. Damage still lands the same frame, but the visible shot is a
fat slug crossing the line in 0.13s with the impact rings landing when
the slug does.

**End-of-wave SitRep** (`1e4d2f7`). The cleared toast became a report:
kills by source, a tint-coded histogram by type, kill tempo as a
block-glyph sparkline (3s bins), points + clear bonus + peak multiplier,
rams, leaks in red. Non-blocking, tap to dismiss, outranked by the next
telegraph. `?sitrep=1`, `?callout=1` render fabricated states through the
real pipeline — both PIN their displays, because under a virtual-time
budget every removal timer and every 1.2s animation outruns the first
painted frame.

---

## `ee47c12` — The field manual

One CRT screen before the tutorial: green phosphor, scanlines, and eleven
lines that are each a rule of play rather than a paragraph — the heart,
ramming (with the one red line: **do not ram solid elements**), shells,
portals as the win condition, the score's tank bias, insignia, the
orbital-strike ritual, cruise, and building. Below the fold, a keyboard
table that renders only where a keyboard exists (coarse-pointer paired
with a width clause, per the house rule) — touch loads get the thumb-zone
line instead.

Dismissal is anything: tap, or any key — ESC included, captured before
the pause menu can react. The sim is frozen while it is up, and whatever
was queued (tutorial on a first load, briefing otherwise) runs on
dismissal. `?intro=1` forces it under debug hooks for screenshots;
`?intro=0` skips it.

---

## `982a5a9` — The brass before the boss, and an alarm worth believing

Two sounds, one doctrine: a cue should hand over to the thing it warns
about, not stop dead before it.

**The boss omen.** `boss_tension` (21.4s of distorted brass, kept at full
length) starts the moment the remaining lead to the boss wave crosses 10
seconds. The boss wave is *derived* — `INTROS` × `ENEMY_SPEC.boss`, never a
hardcoded 12 — and the lead uses the same math as the NEXT WAVE countdown:
`waveIn` once armed, `waveGap − interClock` in the gap. From a cleared
field the entire lead is `waveGap`, so at the default 7s gap the omen owns
the whole pre-boss window and is still swelling as the knot clears the
gate. Once per run.

**The danger klaxon.** `danger_alert` (1s) plus a CRT-red ⚠ overlay —
phosphor bloom, scanlines, RGB misconvergence, coarse flicker (off under
`prefers-reduced-motion`) — the first time a dangerous (non-rammable)
enemy closes within 3.5 cells of the tank. **Once per wave, by design**: a
constant siren is the alarm you learn to ignore, and this one means STOP
TOUCHING THAT.

One probe lesson re-learned: `?danger=1` originally forced the warning
and let the real 1.9s hide-timer run — under a virtual-time budget the
timer fires before the first paint, so the screenshot showed nothing and
the overlay was fine. The forced path now PINS the overlay; the game path
keeps the timeout.

---

## `03f1d1a` — Points are not credits, and the top of the screen earns its keep

**The scoreboard** (`src/score.js`, pure + tested). Credits buy towers; the
score is the bragging number, and it leans the other way on purpose: tank
kills score **×3** (the economy already pays them ×2 — the leaderboard
belongs to whoever fights hands-on), rams keep their premium, and every
kill scales with how swarmed the field was when it landed (+4% per live
enemy, capped ×2 — pressure is the skill being measured). Wave clears pay
`100 + 25w`. BEST persists in localStorage and updates **live** when
beaten, so a crash can't eat a record; the lose modal reports the final
score and calls out a NEW BEST.

**Four layout rulings in the same pass:**

- The rank sprite over the hull is gone — in third person it hung directly
  in front of the camera, blocking exactly what the player steers toward.
  The insignia (22 px) now rides the HUD's new headline: `SCORE · BEST ·
  [badge] RANK`.
- The launch console is promoted to the top — centred under the mode row
  on desktop, third slot of the left column on phones. A stale mobile
  `bottom:` pin fought the new `top:` and stretched the console 500 px
  tall; the `?layout` rectangle probe caught it (headless lays out wide
  and crops, so rectangles are the only trustworthy phone check).
- The mobile NEXT WAVE chip sat at `top: 8px` centred — written straight
  over the mode row on a 390 px screen. The top now stacks as a left
  column (stats → NEXT WAVE → console) with the radar keeping the right;
  the probe tracks `#td-next` now and reports zero overlaps.
- The corner build badge is retired from the game view. The DEV LOG tab
  header shows the served token (it reads `meta[name="cb"]` itself);
  `?devlog=1` deep-linking survives.

---

## `f9614fa` — Insignia the hull has to live to wear

The operator's 15-rank sheet, in-game. `src/ranks.js` is pure and
Node-tested: bronze chevrons (1–5), silver chevrons over a filling core
diamond (6–10), gold stars in a laurel (11–15); tier is `floor((rank-1)/5)`,
never stored. The one change asked for by name: **4 and 5 stars sit as dice
pips** — a 2×2 square and a quincunx — and `test/ranks.mjs` pins the rule
that pips stay *narrower* than the row of three they replaced.

Three design decisions carry the feature:

- **Only hands-on kills count.** Shells, lasers, and rams credit the
  ladder; tower and orbital kills pay credits, not respect. The ram branch
  bypasses `damageEnemy`, so it credits at the treads.
- **Gold is double-gated.** Cumulative kills follow `r(r+3)/2` (2, 5, 9 …
  135), and each gold level also wants 2 elite (non-rammable) kills up
  close — the units that hurt to touch are the ones that count.
- **The ladder dies with the tank.** `loseTank()` strips it, and the TANK
  LOST toast says which insignia went down with the hull.

One SVG, two homes: inline on the HUD's tank line (13 px, next to YOU —
where the score display will land), and rasterized through
`data:image/svg+xml` → canvas → `CanvasTexture` onto a Sprite pinned over
the hull (0.3 cells — at 0.55 it read as a map marker, not a patch).
`?rank=N` grants exactly rank N's requirements and renders through the
normal path, so layout checks exercise the real pipeline.

---

## `34e3253` — Every shot has a name, and the gate finally has a throat

**Fire identity.** Each tower's shot now *reads* at a glance: the sniper is
a hitscan railgun — a white core beam inside a lingering tint, warn rings at
muzzle and impact; the homing missile chases (steer `k = min(1, 6·dt)`
toward the live target — the HokorobiTawaa feel, a missile that *commits*);
the mortar marks its landing cell the moment it fires, swells as it drops,
and lands with weight. All non-splash hits pop pooled sparks; tracers draw
through a shared round-dot texture (a bare `PointsMaterial` renders squares).

**Keymap.** `1/2/3` = O1/T1/T3 · `M`,`O` = map · `C` = missile cheat ·
`T` = T3 · `Q/E` = throttle ± with a detent · `U` = upgrade (W drives).

**The empty portal centre — root-caused at last.** Two independent faults,
which is *why* it survived several passes; fixing either alone changed
nothing visible:

1. **A gallery artifact ported as design.** The braille-lab horizon applies
   `rotY(t·0.45)` because the *lab gallery* rotates every card by exactly
   that — the disc counter-spins to stay inside the ring, and the lab's
   comment says so. Our ring never rotates, so the same rotY spun the disc
   edge-on inside a face-on ring: an invisible line, most of the time.
2. **A brightness array indexed from the wrong base.** `stargateHorizon`
   wrote `bri[k]` with `k` starting at `i0`. The lab passes `i0=0`; the
   game passes `i0=435` (ring first, horizon after, one buffer) with a
   174-long shimmer array — every write landed out of bounds, Float32Array
   dropped them **silently**, and the first idle tick multiplied every
   centre dot to `(0,0,0)`. The constructor's colors were correct for
   exactly one frame.

The forensic lesson: three geometry probes passed while the player saw an
empty ring, because they measured *positions* — and a rotY about the
vertical doesn't shrink the y-extent, and a black dot has a perfectly good
position. The probe that caught it dumped the **color attribute** and
projected dots through the **live camera** (`?gateprobe=1` keeps both).
Verified the honest way too: parked the strike fall-cam over a forced gate
and looked — empty before, filled after.

The horizon now churns in place — alternating per-ring drift, travelling
shimmer, z-breathe — and is densified 105 → 174 dots (the lab card draws
fat gallery dots on a small canvas; at game scale 105 read as sparse).
`test/stargate.mjs` pins both faults through the *game's* calling
convention (`i0 = ring length`), not the lab's: no dark dots, disc stays in
the ring plane, radii span the throat, and the centre must move between
ticks.

---

## `0e0d7ac` — The platform has to come back

Two stacked missiles could fire back-to-back: the ready cap rationed how many
you *hold*, but nothing rationed the **cadence**. Every launch now puts the
platform out of position for 12 s (knob: *re-orbit time*), and the console
narrates the return in DeepWatch's register — `ENTERING ORBIT 43%`, amber,
safety locked until it reads 100.

Two design points worth the note:

- The cooldown gates **arming**, not the strike already in the air — the
  ritual stays intact, the tube just will not accept the next round yet.
- It runs **independently of the promotion window**: a spent platform
  repositions while the next asset charges, so the two clocks overlap rather
  than queue. Waiting 12 s and *then* 40 s would have doubled the price of
  every shot.

Also this session: silence on unbuildable cells (`58909d0` — a radial whose
every option is disabled is a wall of no; `openShop` refuses at its own door
with the same `placeError` that used to grey the options).

---

## `cb407d4` — T1 / T3 / O1, and a radial instead of a cycle

The camera system is three views and two buttons now. The cycle reads
**T1** (first person) → **T3** (third) → **O1** (orbital) on the CAM button
itself; bastion left the cycle — tower-watching was a spectator mode nobody
drove from. Nothing auto-centres: two explicit CENTRE buttons aim the orbital
view on demand (♥ = heart + whole planet, ◉ = tank up close), each switching
you to O1 if needed. One courtesy kept: the *first* orbit entry still frames
the heart, because a free camera pointed at the dark side of a planet is not
a view, it is a bug report.

**HOLD is gone** (operator call). `buildFrozen()` answers `false` forever
rather than being unpicked from every gate it feeds — the constant carries
the history, the callers stay untouched.

**WANDER became TANK-AUTO**: a small radial of six directives instead of
blind-cycling — on a phone, cycling meant tapping through five states you
did not want to reach the one you did. Picking engages auto (unchanged rule),
and the directive-pick side effects (`steerHold`, cruise-kill) nearly got
lost in the migration — the old handler's tail had them below the anchor.

**The mortar** came down (apex 3.4 → 2.3 cells) and every tracer is round: a
`Points` vertex is a **square** unless given a map, and at 12 px the corners
read. One shared radial-falloff `CanvasTexture` rounds them all.

Nine playtest notes captured in ROADMAP as the operator's list, including
the two with teeth: HK-style *chasing* homing (theirs re-seeks every frame;
ours aims once), and a cooldown-gated danger alarm (no alarm for X seconds
AND a dangerous unit within Y — a proximity alarm, not a siren).

---

## `392833b` — The launch console

The ☄ chip is retired; the strike wears the instrument it came from. Ported
whole from DeepWatch: the hazard border (a repeating-gradient
`border-image` — no image asset), the metal safety toggle with its two PNG
sprites and lit ON/OFF chips, and the chunky 発射 button:

| state | button |
| --- | --- |
| cold | grey, dead cursor |
| armed, no target | orange pulse, label **TARGET** |
| authorised | red pulse, label **LAUNCH**, press-down on commit |

The narration is DeepWatch's register: `STANDBY`, `ORBIT 41%`,
`READY · FLIP TO ON`, `AWAITING TARGET`, `LAUNCH AUTHORIZED`,
`NO TARGET / TGT CELL 0408`.

Underneath, nothing moved — same `strike.js` machine, same refusals, same
radar promotion. The ritual gained an instrument, not new rules. `syncArmUi`
runs every frame, so it writes the DOM only when a state key changes.

Bottom-centre placement: the one band both thumb columns leave free, zero
overlaps at desktop and phone widths, and it stands aside for the munition
feed with the rest of the chrome.

---

## `4d5b494` — The AoE tower is a mortar, and its shell falls like one

The head is `half-dotted-mortar.json` — the lab's authored export, embedded
verbatim (252 points, an angled tube on a baseplate). The launcher read as
generic ordnance; this is the attack, sculpted.

The arc stopped being a sine hump. Symmetric flight floats down exactly as
gently as it rises; warping the flight fraction (`u^1.35`) pushes the apex
past 60% and compresses the descent into what remains — the shell hangs,
then **plummets**. Apex 2.2 → 3.4 cells, round fattened to 12 px with a
six-ghost trail.

The blast scales with the splash it deals, and the ground takes a shock
ring — the orbital strike's language one register down. Show and damage
radius agree, which is the lesson the strike taught.

One catch worth remembering: a shadowed `const v` inside the flight updater
parsed clean at module load — `import()` smoke checks pass — and threw
`Identifier 'v' has already been declared` only when the page actually
evaluated the script. The headless console caught it; the Node parse check
could not have.

---

## `252e89a` — The two tweaks were one scene

The report came as two items: "we spawn behind a portal" and "the portal is
missing its inner design". They were the same moment. The round start used
`dungeon.spawn`, which the carve often lands in the far band the gates seed
into — so a fresh player opened the game nose-to-nose with a forming portal.
And a forming portal genuinely had nothing inside: the horizon dots are
positioned by the idle tick, **which the dial-in skips**, so through the
whole draw-on they sat at the origin. The reveal's final act was a clump in
the gate's throat, then a snap as the first tick placed them.

Both ends fixed: the round start mirrors the death respawn (beside the
heart, aimed **outward** — from distance 1, "toward the heart" points you
into the thing you defend), and the horizon is positioned at t=0 in the
constructor, so the draw-on ends on the disc it was always supposed to end
on. Probed in-game: `drawRange 540, horizonR 0.098..0.580, zeros=0`.

### Guard the door, not the paths

The tower radial kept appearing during strike aiming even though the tap
dispatch routed around it — some path still reached it. Rather than hunt
paths, `openShop` itself now refuses while the strike is armed, flying, or
within 0.8 s of impact (the skip-tap and the landing race; the loser must
not buy a tower). A modal that must never appear mid-ritual is guarded at
its own door; every future tap path inherits the rule.

### The probe that reported a paused game

`?gateprobe=1` faithfully printed `dial=0` — on a game sitting paused at the
briefing, because a URL with no debugging param stops there. Two more
harness truths joined the pile: probes must count **real frames** (under a
virtual-time budget every timer can fire before the first paint), and
swiftshader cannot render 70 frames inside the watchdog, so the probe now
*forces* formation for its second report. The question was "does the game
path position the horizon", not "how fast can headless paint".

---

## `44bc639` — One mode, and a radar where the minimap was

Two structural changes in one sitting, both long promised.

### Cameras instead of modes

BUILD/MANUAL traded capabilities: enter build to place towers but lose the
fight, drive but lose the board. Gone. There are only **cameras** now —
orbit (the old build cam, the strategic pose), third, pov, bastion, cycled on
V — and every capability works under all of them: taps open the shop
anywhere, the tank drives anywhere, the auto-gunner fights anywhere, nothing
hides.

The migration trick: `buildMode` survives as a **derived** value
(`view === 'orbit'`) assigned in exactly one place. Its twenty read-sites —
drag-orbit, pinch, the free-cam branch, the follow-cam — all mean "is the
free camera up", and that meaning is unchanged. Only the write-sites carried
the mode, and those are what died.

The freeze BUILD used to smuggle in is an explicit **HOLD** switch now (same
button, same B key, same self-release when hostiles land) — a capability
with a name instead of a side effect of a camera. Double-tap in orbit pulls
back to the whole planet: strategy is one gesture from anywhere, which was
the point.

### The radar

The minimap stopped being a minimap the day it became a culled marker layer —
a shrunken second render that told you nothing the main view did not. It is
a **PPI scope** now, DeepWatch's idiom brought home: rotating beam, trailing
phosphor, contacts flaring as the beam passes and decaying behind it. Gates
pulse amber harder as a wave charges — the radar shows the telegraph.

It is a 2D canvas, and it **retires the second WebGL context outright**. The
scope math is pure and pinned (`src/radar.js`): heading-up, starboard-right,
out-of-range contacts pin to the rim instead of vanishing — orientation
conventions being exactly the kind of thing that flips silently.

Two details worth their comments: the sweep keeps turning while paused (a
dead scope reads as a crash; a turning one reads as a pause), and the old
YOU arrow had to be parked on the now-unrendered map layer — the map
renderer's absence would otherwise have made it suddenly visible **in the
world**.

### Playtest tweaks folded in

While a munition flies, the feed owns every tap — the retarget/skip tap had
been falling through to the shop dispatch and popping the tower modal under
the strike camera. And the tank's shell carries a small AoE now: half damage
to anything packed against its victim, no on-hit reactions, a clip of sparks
so it reads.

---

## `7a00bb5` — Hit like it looks

### "Within range yet unhurt" had two causes

Only one was the damage number. The rings drew at **2.2×** the damage radius,
so fodder standing visibly "inside the blast" was well outside it — the
visuals wrote a cheque the falloff did not honour. The outermost ring **is**
the damage radius now; the kill line and the drawn line are the same line.

And the falloff was thin: `(1 − d/r)²` pays a quarter of centre damage at
half radius. Fat-middle now — `1 − (d/r)²` — holding 75% at half radius,
zero exactly at the ring. With `dmgCenter` 6 → 10 and `blastCells` 2.4 → 3.2:

```
STRIKE ci=1143 portals 2->2 enemies 18->0 towers 0->0 walls 2152->2129
```

Eighteen enemies, one strike, on a measured cluster hit.

### The blast breaks the world, toggleably

`breakWalls` and `breakTowers`, both defaulting ON. Walls breach through the
same code the shell uses — split into `breachWallCell` + `rebuildAfterBreach`
so six breaches cost **one** BFS and one geometry build. Towers die first and
without refund (selling is a decision; this is a consequence) — and the order
matters, because a mounted tower anchors its wall: tower-first is what lets
one strike flatten a defended rampart.

Booleans joined the knob machinery properly — `bool: true` in the table, a
checkbox in the GUI, coerced-and-vetted on restore — rather than living
outside it and tripping the coverage test.

### Aim is two-fold

The paint chooses the area; **one vectoring burst** mid-fall re-aims onto
what the target drifted into. Tap the ground to spend it, tap the sky — or
anything after it is spent — to skip. Once by default: a second chance, not a
steerable missile, which would make the paint phase pointless. The feed
declares the mode (`VECTOR BURST ×1` / `VECTOR SPENT`), and the fall runs
3.5 s now — long enough to actually use it.

### The reporting bug that read exactly like a weapon bug

The proof line first sat **above** the kill loops and printed
`portals 2->2` on a direct hit. Twenty minutes of falloff suspicion — and the
weapon had been fine; the log was measuring before the work. It goes last
now, with the reason in a comment.

A measurement that runs at the wrong time is worse than no measurement: it
does not say nothing, it says the wrong thing with confidence.

---

## `5b26cd0` — The munition feed, and an inline style that beat the stylesheet

### Build mode follows the driver

Top-down is a real control mode only if the thing you are controlling cannot
escape the screen. When the tank projects outside ~78% of the frame, the free
camera swings its pole toward the tank's normal — keeping the current *up* so
the recenter never rolls the world underneath you — easing harder the further
out it is. A finger on the board owns the view outright; the follow never
fights a drag.

### The fall is a feed

Black-and-white for the ride down — a CSS `filter` on the WebGL canvas, so it
costs compositing only — under scanlines, vignette, corner brackets, a green
crosshair, and an ops HUD (`ORBITAL STRIKE · OTS-723 / WARHEAD 489KG ·
KINETIC / TGT CELL … / FEED SAT-CAM 2 · LIVE`). The game's chrome stands
aside; the feed is a takeover.

The red range counter is honest: it is the camera's own distance to the
target in fictional metres (planet radius ≙ ~4.8 km), so it rides the same
smoothstep as the fall and **decelerates hard as the ground arrives** — the
last 200 m read as a held breath, not a spinner.

The impact is a firework: four staged dot-burst shells, white core to ember
red, over the shock rings. One strike per gate means the set piece is
affordable.

### The bug worth writing down

`#tab-td.striking .minimap { display: none; }` matched the element — verified
with `el.matches()` — was present in the CSSOM — verified by walking
`document.styleSheets` — and the computed display was still `block`.

The probe that ended it printed the element's `style.cssText`:

```
inline=[display: block; width: 162px; height: 162px;]
```

**three.js `setSize` writes `display: block` inline on its canvas**, and an
inline style beats any sheet rule. That earned the stylesheet's one justified
`!important`, with the reason in a comment beside it.

The sequence matters more than the fix: selector matched → rule present →
still losing → *the only remaining suspect is inline*. Three probes, no
staring.

### Verification split by what each method can prove

`?strikecam=1` holds the feed open on a static frame — styling is a
screenshot's job. Engagement during a real fall is proven by `FEED ON/OFF`
log lines — a screenshot cannot reliably race a 2.5 s window under a
virtual-time budget, and this session has now hit that three times.

---

## `1980e32` — The orbital strike

DeepWatch's system (`~/Documents/Dev/centroid-defense`), carried over by its
design and not its code. The part worth carrying is the **ritual**:

```
cannot arm an empty tube
cannot paint unarmed
cannot launch without a lock
the safety re-engages on every launch   <- the design, in one line
```

All of it lives in `src/strike.js` — pure, no DOM — and was pinned in
`test/strike.mjs` **before any pixel existed**. The system's value is in its
refusals, and refusals are cheap to test headlessly and expensive to debug by
eye. The suite also pins the subtler rules: the window pauses at the ready
cap (hoarded time is not banked), and a second launch while one falls is
refused.

### Rationing

Budget arrives with the sector's gates — one strike per two portals, minimum
one — promoting one at a time through a 40 s window. DeepWatch grants per
*wave*, but its wave is the big battle unit, which for us is the **round**.
Later sectors have more gates and therefore more strikes, which is the point:
**one strike kills one gate.** Unspent strikes carry across sectors; a new
game empties the magazine.

### One button, three states

safe (count) → armed (amber, pulsing) → locked (solid: LAUNCH). One control
because the ritual is linear — a second would let the eye skip a step.
Arming promotes the minimap to a radar (same culled layer, more screen), and
while armed a board tap is a targeting act that outranks every other tap.

### The fall

The camera rides the munition down the target's normal, altitude easing on a
smoothstep — slow, then fast, which is what falling feels like — with shake
escalating hard past 85%. It **replaces** the main view rather than rendering
beside it, so it costs nothing: a corner panel would have been the
second-render trap the minimap culling just removed. A tap skips to impact;
the launching tap cannot skip its own cam (0.25 s grace).

### The blast

Gates die whole through `killPortal` — extracted so there is one place a gate
dies, however it died (shells ground it down before; the strike vaporises
it). Enemies take squared falloff through the existing `damageEnemy`, so
bounties and shrink-steps come free.

### The hook tests the honest path

`?strikefall=1` arms, paints the first live gate, launches — and then
**skips**, because under a virtual-time budget the fall clock barely moves
(the `performance.now` trap, again). The skip is also the path a pressed
player takes, so the headless run exercises the one that matters. Verified in
a single frame: `portals 2/2 → 1/2`, blast rings in flight, camera snapped
home, magazine spent.

---

## `59966ba` — Two routes to a wave, one of them silent

### The cues really did drift

There were two routes to `spawnWave`, and only one announced:

```js
} else if (waveAge >= params.waveCap && spawnPoints.some(s => s.alive)) {
  spawnWave();   // safety: the field is stalled
}
```

That branch sits **inside** `if (waveActive)`, while the whole telegraph lived
in the `else`. So a stalled field spawned with no charge, no rings and no
sound — and later rounds hit it more and more often, because bigger waves
take longer to clear. Exactly what "no 3 second delay before the wave
appeared" looks like from the outside, and it gets worse the further you get,
which is why it read as *drift*.

`armWave()` is the single entry point now: it starts a countdown, the
countdown drives the telegraph, and the countdown is the only caller of
`spawnWave`. Idempotent, because a stalled field re-asks every frame. Arming
happens `WAVE_WARN` early, so the total wait from cleared to spawned is
unchanged.

### The export was half the shape

The lab's card calls it **"chevrons + horizon"** and the JSON carried only the
chevrons — because the horizon is a separate `features` function, a function
of *time*, which a point export cannot hold. Ported from `stargateFeatures`:
six concentric rings inside the throat, each shimmering on its own phase, the
whole disc turning slowly on Y so it reads as a surface rather than a pattern.

435 ring points + 105 horizon dots. The horizon sits after the ring in the
buffer, so the existing draw-on reveals them in the right order for nothing:
ring sweeps, chevrons lock, throat lights up.

Worth keeping the lab's own note — `stargatePts` deliberately skips `fitUnit`
so the horizon can share its exact coordinates. Normalising the ring on import
would have silently moved the disc out of it.

### A lost tank is an event

It used to be neither an event nor a loss you could see: the hull counter
ticked down and the machine carried on driving. Now it explodes and you come
back in **build** — pulled up and out, looking at the whole board, with the
wall you did not have time to buy still unbought. That is the decision the
loss should hand you.

It returns to the spawn gate facing the heart, engine cold, throttle zeroed,
free-movement state cleared — or it would resume from wherever the wreck
stopped.

---

## `1b3228a` — The gate dials itself in, and the bacterium swims

### The point order was already the animation

`half-dotted-stargate.json` exported whole into `src/stargate.js`: 435
authored points against our generated 1150, and better ones — the chevrons
are *placed* rather than derived, so it reads as a ring with nine locks
instead of a bright blob.

The order turned out to be the gift:

| indices | what |
| --- | --- |
| 0–406 | one continuous stroke, mean gap 0.095 |
| 407–434 | the nine chevrons, each arriving as a jump |

Revealed in order it draws itself around the ring and then locks its
chevrons. So the draw-on effect is a `setDrawRange` and a bright head behind
it — no keyframes, no second geometry, no extra draw call. It dials over 1.6 s
and swells as it draws.

The head is the only part repainted each step (26 dots, brightest at the
tip); the tail keeps whatever the idle twinkle last wrote, so the two
animations do not fight over the colour buffer.

### `waveJelly` was the obvious thing and was wrong twice

It carries a spin about the body axis, and its squash is on **Y** — which for
a rod lying along Z means the creature lengthens and shortens instead of
flexing. A bacterium does neither.

`swimWave` instead: a travelling sine **along** the body, amplitude growing
toward the tail, plus a volume-preserving radial pulse. Measured:

```
max lateral swing — tail 0.450  head 0.042   (10.8x)
```

The flagella do the work and the head holds its heading, which is what it
looks like when something swims.

### Turned at build time, because lookAt wins

Enemies are oriented every frame by `lookAt`, which overwrites the object's
quaternion — so a rotation set on the object would be silently thrown away.
The model runs along X with flagella at −X, enemies face +Z, so the points are
remapped `(x, y, z) -> (-z, y, x)` **once, at birth**.

It deforms its *points* rather than its transform: 170 points a frame. A
transform can turn a creature; it cannot make one beat.

`portalPts()` is now unreferenced. Left in place — same call as the mesh
creature forms: removing it is a separate decision from replacing what uses
it.

---

## `e77f5b2` — The tank stays yours in BUILD mode

Two things stopped it, and only one was obvious.

**The build pause froze the whole tab**, driver included:

```js
const frozen = buildFrozen() || revealLeft > 0 || tutorial.frozen;
if (!frozen) advanceMotion(dt);
```

That pause exists to hold the *wave* still while you plan, so the world keeps
it and the driver no longer answers to it. A reveal or a tutorial hold still
stops everything, because those are the game speaking and should not be
driven over.

**The steering strips were hidden by CSS** in build mode. So even with the
driver live, the throttle sat there visible with no way to aim it — the
asymmetry was the real bug. They stay now; they are narrow edge strips, and
the middle of the board is still free for the drag that orbits the sphere.

The fire buttons stay hidden and the auto gunner still stands down: building
is not shooting. That is the line the mode draws, and it is a different line
from "you may not move".

The HUD said `BUILD · frozen`, which described the tab and became half true.
It now says what is actually held: `BUILD · wave held · you can drive`.

### Proving it, rather than looking at it

A screenshot cannot show that a thing *would* move. `simTime` only advances
inside `advanceMotion`, so it is the honest answer to "is the driver live":

```
build=true   frozenWorld=true   simTime=0.31
build=false  frozenWorld=false  simTime=0.31
```

Identical — with the world explicitly frozen. The equality is the proof; the
absolute value is small only because virtual time does not advance
`performance.now()`.

---

## `123d0ab` — The gates announce themselves three seconds out

`freezing_gush_01` from the Frost Mage set, through the usual pipeline:
trimmed to 3.70 s, peak-normalized to −1.5 dBFS, mono 96 kbps.

Kept at nearly its full length rather than cut to the 3.0 s lead. The gush is
meant to **still be running** as the first enemy clears the gate, so the cue
hands over to the thing it warned about instead of stopping a frame before
it. `WAVE_WARN` moves 3.2 → 3.0 so the sound starts exactly three seconds
out — long enough to break off, turn, and put distance between you and the
gate, which is the whole point of a warning.

Fired on the **edge** of the charge, once, at the nearest opening gate: it
carries a distance through the falloff, and two gates opening together
announce once rather than twice. `maxVoices: 1` backs that up in the mixer,
and a 2.5 s min-interval is longer than any legitimate re-trigger, so a
stalled wave clock cannot stack the loudest cue in the game on itself.

### The build table could not be annotated

Adding a comment row made the script fail with:

```
missing source: assets/audio/src/
```

The `|`-delimited table loop skipped blank keys but not `#` lines, so a
comment parsed as a key with an empty source path — and the error named the
empty path rather than the line that caused it. Both table loops now skip
comments (the LOOPS table had the same gap; fixing only the one that happened
to break would have left the trap for the next person).

---

## `32be0df` — The gates telegraph a wave before it lands

A wave used to simply appear. The countdown said so in a corner, but the
corner is not where you are looking — so the first you knew of it was enemies
already on the board, and the gate they came out of gave nothing away.

Over the last 3.2 seconds the gate now **charges**:

| | |
| --- | --- |
| its own idle | runs faster — not a second animation layered on top |
| scale + brightness | swell with the charge |
| shock ring | thrown across the floor each beat |
| beat spacing | closes from ~0.7 s to ~0.18 s |
| on spawn | one wide ring per gate, charge spent |

One thing accelerating reads as building pressure; two things moving reads as
noise. And the cadence **is** the countdown — legible without reading
anything.

It runs off the same clock that calls `spawnWave`, so the warning cannot
promise a moment the spawn does not keep.

The rings lie **on** the surface: the basis comes from the cell's own normal,
because a fixed up-vector degenerates wherever the sphere happens to face it.
They are one pooled `Points` cloud rewritten each frame — 144 particles alive
at mid-charge, one draw call. That is the effects direction recorded in
`acc9e3a`, applied.

72 points per ring, not the 34 I started with: the radius grows to several
cells, and 34 points spread across that is confetti rather than a shock front.

**No sound.** Nothing in the manifest belongs to a portal, and the nearest
candidates are the tank's own hydraulics — a wave warning that sounds like
your own vehicle is worse than silence. It wants a new asset.

### `?tick` does not drive the wave scheduler

Wound from 2 s to 10 s, the countdown read the same `in 4s` every time, which
looks exactly like a dead feature. `?tick` advances motion, not the wave
clock. `?charge=0..1` parks the clock inside the warning window instead, and
reports what the telegraph is actually doing:

```
CHARGE want=0    charge=0.06 ringParticles=68  beatIn=0.60s gateScale=1.018
CHARGE want=0.5  charge=0.56 ringParticles=68  beatIn=0.33s gateScale=1.040
CHARGE want=0.95 charge=0.00 ringParticles=136 beatIn=0.00s gateScale=1.000
```

The third line is the wave landing mid-sample — charge spent, gate back to
1.0, and the 136-particle release ring in the air. The whole cycle, in three
lines, from a feature a screenshot could not settle.

---

## `db3e3da` — Bands, and two reasons the first attempt did nothing

Three controls had piled into the phone's bottom-left corner — the primary
fire button, the left steering strip, and the throttle — so the lever sat on
top of the control it was meant to sit beside.

**Left side moves, right side shoots.** Both fire buttons go right, which is
where the hand that is not driving already is:

```
left edge   throttle
beside it   < steer
right edge  > steer, with both fire buttons above it
```

The top had the same problem horizontally: mode row centred, HUD left, map
right, all on one line of a 390 px screen. They stack now — modes on the
first band, HUD and map sharing the second — with the HUD's width capped by
the **map's own sizing expression**, so the wave line stops instead of running
underneath it. The callout clears all three.

Desktop had quietly acquired the same pile-up when the throttle moved left:
it was sitting on the fire button, and the left steering strip on the
minimap. Same reasoning, applied to the base rules.

### `@media (pointer: coarse)` is untestable

No desktop browser reports a coarse pointer, headless included. The entire
first round of fixes went into that block and **did nothing** — and looked
fine, because the screenshot showed rules that had never applied. The
rectangles said `fire x 16..94`: still on the left.

It now reads `@media (pointer: coarse), (max-width: 560px)`. A touch-only
query is a rule nobody can check.

Source order bit too: `#td-tut`'s base rule is declared *after* the mobile
blocks, so at equal specificity an override up there loses. That one moved to
the end of the file.

### Headless will not lay out below ~500px

It lays out wide and **crops**. `--window-size=390,844` produced a 390-wide
image of a 500-wide layout — `innerWidth` said 500 while the screenshot
measured 390 across. Every phone screenshot in this project has been showing
phone-sized pixels of a tablet-sized layout.

So `?layout=N` prints the box of every HUD element and every overlap between
them:

```
LAYOUT throttle  x 14..72   y 283..529
LAYOUT steerL    x 10..94   y 517..705
LAYOUT OVERLAP throttle x steerL — 58x12px
LAYOUT OVERLAP throttle x fire   — 56x78px
```

Rectangles do not lie. They found four collisions that three screenshots had
not, and they confirmed zero overlaps at 1400, 1000 and phone widths after.

---

## `bb95ffe` — The minimap cost 686 draw calls, and it was invisible

Last entry reported ~1020 calls on a wave-4 board and called that the frame.
It was half the frame. The minimap owns a **separate `WebGLRenderer`**, so it
has its own `info` — reading only the main one measured the main view and
made the map look free.

Measured properly, wave 4 with eight towers placed:

| | main | map | total |
| --- | --- | --- | --- |
| before | 1026 | **686** | 1712 |
| after | 1026 | **14** | 1040 |

672 calls — 39% of the whole frame — for a map nobody can tell has changed.

The map camera now sees only layer 1: the board's four merged meshes, the
hand-placed markers, and **one pooled `Points` cloud** carrying every enemy
and tower as a blip. A marker object per enemy would have reintroduced the
exact cost being removed; one buffer rewritten each frame is one draw call
for the lot, however many there are. Layers are per-object and not inherited
in three.js, so each participant enables it explicitly.

### Heads stand on their base, centred on their foot

Two separate mistakes, one after the other:

1. `fitUnit` normalises by *distance from the origin*. That keeps a shape
   inside the unit sphere and says nothing about where its **mass** sits, so
   off-origin shapes hung off the side of the collar.
2. Centring on the bounding box fixed that and broke something else: an arm
   reaches forward, so its silhouette's centre is well in front of its
   pedestal. Centring the **body** hangs the **foot** off the mast.

These are machines that stand on something. So the base is what gets centred,
and the base is what sits at the anchor — `headLift` is now the height of the
head's *foot* (0.86 rests it on the collar) rather than of its middle.

### Directional towers track, and which ones is derived

The arm, gripper and launcher swing onto the nearest target and ease round
the short way. The five symmetric heads keep their idle spin.

Crucially, *which heads have a direction* is read off the geometry — the
horizontal offset of a head's upper points from the mast axis:

| head | facing |
| --- | --- |
| sixaxis, gripper, launcher | ~90° (+X) |
| delta, ripple, broadcast, guyed, obelisk | none |

A hand-maintained list would be one more thing to forget when a shape is
reassigned — and it would have been wrong immediately, because **every ported
arm faces +X**. A tracker assuming +Z would aim ninety degrees off and look
deliberate about it.

The bearing itself comes from the render transform, per the house rule: put
the target into the tower group's local space, take the yaw that aims +Z at
it. No sphere trigonometry, so no sign convention to get wrong.

Ordering matters: aiming runs **after** the idle tick, which writes
`rotation.y` unconditionally and would otherwise win.

---

## `18f1cda` — Dot count was never the budget

The question was whether the dot granularity is a limit we impose for
efficiency, and whether towers should be solid instead. It deserved numbers.
`?perf=N` reports `renderer.info` across one whole frame:

| | wave 4 | wave 8 | wave 4 + 8 towers |
| --- | --- | --- | --- |
| draw calls | 1022 | 1448 | 1026 |
| triangles | 36,654 | 48,494 | 36,654 |
| points drawn | 49,744 | 67,252 | 50,032 |
| scene objects | 437 | 586 | 454 |

**Eight towers cost four draw calls and 0.6% more points.** Going from wave 4
to wave 8 — more enemies, more projectiles, more *objects* — costs 426 calls.

A frame here is priced in draw calls; draw calls scale with object count, not
with detail inside an object. 50k points is nothing to any GPU made this
decade. So raising a head from 190 to 480 dots adds vertices to a call that
already exists: free. 190 was an arbitrary default, never a measured limit.
Default 480 now, ceiling 1200.

Measuring it needs care: `info` resets on every `render()` and postfx runs
several passes, so a naive read reports the bloom's final fullscreen quad —
`calls=1` — and nothing else. Set `info.autoReset = false`, reset, and let one
frame accumulate.

**Decision, recorded in ROADMAP:** dot clouds stay, shapes carry their
authored detail, and the effects layer must be *pooled* — because "lots of
fireworks and explosions" is exactly the thing that adds objects. One `Points`
cloud with a rewritten buffer serves a thousand particles in one call.

### Heads sit on the pedestal now

`fitUnit` normalises by distance from the origin. That keeps a shape inside
the unit sphere and says nothing about where its **mass** sits — and several
lab shapes are deliberately off-origin, because an arm reaches forward from
its base. Mounted on a mast, the head hung off to one side of the collar
instead of standing on it. Ported shapes are recentred on their own bounding
box before resampling.

### FIRE draws what the tower does

Each attack shows its own pattern — a spread fans, a homing shot curves, a
mortar lobs on gravity and bursts where it lands, a beam arrives whole and
fades, a slow field pulses outward. It fires at the tower's **own rate** for
four seconds, because cadence is half of what you are judging, and the range
ring is scaled from `def.range` so reach is to scale rather than decorative.

Built as one pooled `Points` cloud rewritten in place — the same arithmetic as
above, and the reference shape for the effects layer.

---

## `36145b4` — Eight silhouettes, and arrows that hold still

Every tower now wears a distinct head from the Braille lab, matched to what
the tower **does** rather than to what looks good:

| tower | head | why |
| --- | --- | --- |
| single | six-axis arm | points at ONE thing, swings to the next |
| rapid | delta robot | three arms in parallel — the fastest mechanism on any line |
| spread | ripple ring | concentric rings travelling outward *is* a spread |
| homing | gripper arm | reaches out and takes hold of a specific thing |
| slow | broadcast antenna | emits over an area instead of aiming |
| aoe | rocket launcher | lobbed ordnance landing on an area |
| sniper | guyed mast | the tallest, thinnest thing here, built to reach |
| laser | obelisk | a monolith with no moving parts: a beam does not traverse |

Eight heads, eight towers, no repeats.

### The arrows moved in both axes

**Horizontally**: they flanked a caption block with only a `min-width`, so a
long note pushed them apart and every unit put them somewhere new — you had
to re-aim between clicks. Fixed by giving the stage a fixed width and letting
the arrows sit at its edges, plus reserving two lines on the note so wrapping
cannot change the block's height either.

**Vertically** was subtler and survived that fix. The bench row exists only
for units with a hover split, and `display: none` made the whole chrome stack
shorter for towers and pickups — so the arrows were pinned horizontally and
*still* landing somewhere new. `visibility: hidden` reserves the space.

Measured rather than eyeballed: the left arrow's ink spans rows 20–534 on
both a tank and a tower.

### Third time on the same rake

A test checked `formatTowerHeads({ aoe: 'launcher' })` for one "changed"
marker — and `aoe` now *ships* as `launcher`, so nothing was marked and the
suite went red on a correct change. That is the third assertion in this file
broken by a hardcoded shape name (`single: 'cone'` was the second).

The rule, written down properly this time: **assert the rule, derive the
data.** Every one of these tests is about a rule — "an override equal to the
shipped shape is dropped", "changed entries are marked" — and every failure
came from pinning the *example* instead. They now read the roster:

```js
const other = TOWER_HEAD_KINDS.find((k) => k !== TOWERS.find((t) => t.key === 'aoe').shape);
```

---

## `38d0dc9` — A global override that persisted, masking what it was meant to show

The report: the two new tower assignments were not showing in the viewer.
They resolve correctly — `single` → `sixaxis`, `slow` → `broadcast` — so the
bug was upstream of the shapes, in the panel I had shipped one commit before.

Its head picker was a **global** override, and it saved to localStorage.
Choose any shape once, and from then on every tower wears it — including two
that had just been assigned in `towers.js`. The tool built to judge the
shapes was hiding them.

### The control was wrong twice over

It could only ever answer *"does this shape work at all"*, never *"which
tower should wear it"* — and the second is the actual question. And a
per-tower map is the artefact you want to walk away with, because it pastes
straight back as `shape:`.

So the picker is scoped to the selected tower and labelled with it
(`HEAD · SINGLE SHOT`), with a default that reads `as shipped (sixaxis)`
rather than concealing what it would replace. Stepping to the next tower
rebuilds the row — the subject is still `'tower'`, but a row left standing
would assign to the tower you just left.

`copy code` emits both halves now, the second doubling as a checklist:

```
{
  single: "sixaxis",
  aoe:    "launcher",   // <- changed
  …
}
```

### Retiring the old blobs rather than migrating them

Storage moves to `towerfeel.v2` plus a separate `towerheads.v1`. A v1 blob
holds a global `headShape` whose meaning has changed entirely, so reading one
would silently reinstate the masking. `cleanHeads()` vets what comes back: an
assignment equal to the shipped shape is noise, an unknown tower or shape is
dropped.

### The test had a stale literal

`cleanHeads({ single: 'cone', … })` asserted that an assignment matching the
shipped shape is dropped — and passed only while `single` shipped as a cone.
It derives the shipped shape now. The assertion is about the **rule**;
hardcoding the data made it fail the moment a tower was reassigned, which is
precisely the operation it exists to permit.

---

## `d3aa228a` — The shape says what the tower does

`single` wears the six-axis arm, `slow` wears the broadcast antenna. Both
read as the mechanism doing the job rather than as decoration: an arm points
at **one** thing and swings to the next, which is a single-shot tower's whole
behaviour; an antenna emits over an area instead of aiming, which is what a
slow *field* does. The silhouette now says what the tower does before the
tooltip gets a chance to.

The tutorial banner moves from `top: 16%` to a fixed `134px`. At 16% it sat
over the middle distance — exactly where the thing it is telling you to look
at tends to be, so reading the instruction meant not watching the board.

134px clears both the mode row (`top: 52px`) and the four-line HUD block. The
first pass at 96px cleared the buttons and then clipped the wave line
underneath them, which is the sort of thing only a screenshot shows. The big
`.tut-flash` variant carried its own `42%` offset — that is what put the
opening RAM callout dead centre — so it moves too.

---

## `1cb7da6` — Nine shapes from the Braille lab

Source: `~/Dev/Braille`, `fun-shapes/index.html`. The lab and this project
already speak the same language — a generator returns `[x, y, z]` points, a
fourth element marks a half-dot highlight, `fitUnit()` normalises — which is
why `creatures.js` has said "ported from ~/Dev/Braille" at the top since day
one. A port is therefore the generator plus whatever primitives it stands on.

| wanted | generator | note |
| --- | --- | --- |
| six-axis arm | `armSixAxisPts` | asked for: single shot |
| delta robot | `armDeltaPts` | |
| gripper arm | `armGripperPts` | |
| guyed mast | `twGuyedPts` | |
| broadcast antenna | `twBroadcastPts` | asked for: slow |
| ripple ring | `wvRipplePts` | |
| egyptian obelisk | `obEgyptianPts` | |
| rocket launcher | `launcherPts` | |
| bacterium | `bacteriumPts` | an **enemy** candidate |

### Copied verbatim, on purpose

`src/braillelab.js` holds them unaltered, with the transitive closure of
their primitives — struts, joint balls, lattice and guy helpers, a
height-field surface: 17 in all. Rewriting them in our own hand would mean
maintaining a divergent second version of something the lab will keep
improving. Re-porting has to stay mechanical, not a merge.

Taking the closure by hand would have been guesswork; a script walked the
call graph from the nine and stopped when nothing new appeared. The four
names it could not resolve (`dir`, `fn`, `hi`, `prof`) are callback
parameters, not missing helpers.

### Resampled on the way in

They arrive at whatever density their author chose — **506 to 2689 points**
across the nine — and three carry no highlights at all. Left alone, the
dot-count knob would do nothing for them and several would read as flat dust
rather than half-dotted:

```js
const step = src.length / Math.max(1, n);
for (let i = 0; i < n; i++) emit(...src[Math.round(i * step)], i);
```

The authored highlight flags are dropped in the process. That is a real
trade — the lab marked a mast tip deliberately — but `hiEvery` is a knob, and
a knob that three of nine shapes ignore is the failure this file has now
recorded twice.

Adding another lab shape usually needs no new primitive: copy the generator,
add one line to `BRAILLE_SHAPES`.

### The flying saucer is a bacterium

Suggested tentatively, so it is wired the only way that lets it actually be
judged — seen in play. Reverting is one line in `units.js`
(`enemyDotPts('ufo')`).

### Both outside resources are now written down

`CLAUDE.md` records `~/Dev/Braille` and `~/Dev/blueprint-to-life`, including
that the latter has a **solved** service-worker + cache-bust pattern. The
ROADMAP lists our PWA item as blocked on exactly that problem — a SW must key
its cache names off the build token or it serves stale modules and defeats
the badge. Copy it; do not re-derive it.

---

## `101726b` — A bench for towers, and one machinery behind both

Towers get what the tank got: a knob table, a panel generated from it, and
values that *are* what the game builds.

### One machinery, not two

The tank tuner had already proved the shape — params object, clamp-on-restore,
copy-as-source — so rather than a second copy that drifts, `knobs.js` owns it
and each side declares a table:

```js
export const TOWER_FEEL_KNOBS = [
  { key: 'headShape', label: 'head shape', group: 'head', choices: HEAD_CHOICES },
  { key: 'headScale', label: 'head size',  group: 'head', min: 0.15, max: 0.9, step: 0.01 },
  …
];
```

`tankfeel` keeps its exported names — three files import them — but no longer
its own implementation. `knobProblems()` is new: it reports every way a table
can disagree with the constants it names (duplicate key, knob naming nothing,
tunable with no knob, default outside its own slider). That last one is the
trap — a slider whose range excludes the shipped value means the first drag
jumps you somewhere else.

### `headShape` is a choice, not a range

A slider over shape names would interpolate between things that do not.
`'per tower'` keeps each tower's own silhouette from `towers.js`, which is the
shipping behaviour; anything else overrides **every** tower with that head,
which is what a bench wants — the question there is "does this shape work at
all", not "does it suit the mortar".

### Five new heads, and the density bug

`lattice` (a guyed truss), `dish`, `arm` (shoulder, elbow, forearm,
three-finger gripper), `claw`, `sentry`. The arm is the only head in the set
with a **front**, which is what makes its rotation legible.

The first cut of the line-built ones ignored `n` entirely — their point count
fell out of their own structure. So the dot-count knob did nothing for exactly
the shapes that needed density most, and long members came out sparse while
short ones clotted. They now share a segment walker that spreads `n`
proportional to member **length**:

```js
const cnt = Math.max(2, Math.round((len[k] / total) * n));
```

### The panel serves both subjects

Which table it shows follows the selection. Tower knobs rebuild the head in
place — shape, dot count and highlight spacing are baked at build time — but
**without re-framing the camera**, because re-framing mid-drag throws away the
view you are judging in.

### What the test caught

`hiEvery` was decorative for the sphere head. `towerHeadPts` returned
`spherePts()` early, and that helper carries its own fixed highlight rule — so
the knob did nothing on the default head of the spread tower, the one shape
where it mattered most. It is re-emitted through the highlight rule now.

That is the second time in this file a knob has been wired to a panel and not
to the thing it names. Both times a test that asked "does changing it change
anything" found it, and looking at the panel did not.

---

## `eaa446a` — One way to ask for a creature

The viewer was fixed last commit; the tabs it documents were still building
the other thing. `heart` spawned mesh drifters, announced a mesh drifter on
its wave card, and drew mesh drifters as briefing icons — while `td` spawned
clouds and the viewer documented clouds.

`buildCreature(name, cols)` is now the single entry point:

```js
export function buildCreature(name, cols) {
  return ENEMY_SPEC[name] ? makeDotEnemy(name, cols) : buildUnit(name, cols);
}
```

The choice comes from the spec table, not a list at the call site, so adding
a creature does not mean remembering a second place.

| file | sites | what |
| --- | --- | --- |
| heart-tab | 4 | avatar, HUD icon, wave-intro unit, spawned hostiles |
| td-tab | 3 | avatar, HUD icon, wave-intro unit |
| battle-tab | 1 | avatar |
| organic-tab | 1 | avatar |
| maze-tab | 2 | spawn-at-walker, respawn |

Left alone deliberately: `buildUnit('tank')` in battle (the enemy tank) and
heart (the ally), and `buildUnit('mkcx')` in tank3. Those name machines, not
creatures, and have no cloud form to migrate to.

### The field that was one rename from being a trap

`battle` and `organic` branch on `UNITS[x].kind === 'cloud'` to pick the live
Wave × Jelly deform with phagocytosis. That flag selects an **animation
path**, not a representation. A `'mesh'` entry like `drifter` is now built as
a dot cloud and still — correctly — takes the transform-only idle path,
because what it needs is `userData.tick`, which the cloud has.

Read as "how does it move", it is right. Read as "what is it made of", it is
now wrong, and the next person to touch it would have read it the second way.
It says so in the source now.

The hostiles' `make` functions are kept, not deleted: the roster and its
dropdowns still name them, and removing them is a separate decision from
migrating to the form the game ships.

### Batch-patching the siblings

Per the house rule, anchored on code lines rather than comments, with each
file asserting its own match count before writing — so a mid-script abort
leaves earlier files committed and later ones untouched, which is the
designed outcome rather than a mess to unpick. The import rewrite was
asserted too: every file that gained a `buildCreature` call had to already
import `buildUnit`, or the script stops.

---

## `e4b8c53` — The reference screen was showing units the game never spawns

### Two representations, and the viewer picked the wrong one

`UNITS` still carries a **mesh** form for every creature — `makeSaturn`,
`makeCorona`, `makeMine` — that predates the dot clouds. `buildUnit()`
returns that. The tower-defence tab spawns `makeDotEnemy()` instead.

So the drifter on the reference screen was a torus and a sphere, while the
drifter on the board is a dot cloud — and none of the rammable/not tells were
visible there at all, because those live only on the cloud form. A reference
screen that describes something the player will never meet is worse than not
having one: it is confidently wrong.

Catalogue entries now carry `kind: 'enemy'` and the viewer dispatches to
`makeDotEnemy` in the creature's real `CREATURE_TINTS` colour, not the
player's. The caption leads with the tell:

| unit | caption |
| --- | --- |
| phage | RAMMABLE · 1 hp · speed 1.15 |
| drifter | solid core — will NOT ram · 2 hp · speed 0.85 |

### Neutral is no longer empty

The three reward pickups plus the shell rack, each with what it does and why
it matters — including the one thing about the regen charge that cannot be
read off its shape, which is that you have to **carry it home**. The rack is
built as three shells, the way it sits on the ground, and every entry plays
its own collect sound.

### One table, not two

`REWARD_TYPES` moves out of `td-tab.js` into `src/pickups.js`, read by both.
A second copy drifts the first time a colour or an effect changes, and then
the viewer teaches the player something that is not true — which is exactly
the failure this commit fixes, one level down. The pure-data module was
already the house pattern for `enemyspec` and `towers`; pickups just had not
been pulled out yet.

---

## `50d2f05` — Solid means it will stop you

### Bloom, softer and wider

| | was | now |
| --- | --- | --- |
| strength | 0.9 | 0.3 |
| radius | 0.4 | 0.5 |
| threshold | 0.85 | 0.2 |

A 0.85 threshold only ever caught near-white highlights, so bloom read as a
rim on a few bright edges rather than as light in the scene. Biting at 0.2
catches the body colours too — which is exactly why the strength has to come
*down*: the same total light, spread over far more of the frame.

This is the shared default in `postfx.js`, so td/battle/heart/tank3 take it.
The unit viewer passes its own `{strength: 0.5, threshold: 0.9}` and is
deliberately left alone — it is a lit studio on a near-black backdrop, not
the board.

### Rammable, at a glance

Half-dotted is this game's word for "enemy" and it stays that. But a player
has to know, *before* committing the tank, which ones go under the treads and
which stop them dead. So the ones that will not give way carry one piece of
**solid** geometry inside the cloud. Solid means mass, which is the thing
being communicated.

| type | core |
| --- | --- |
| drifter | octahedron |
| corona | ring |
| barbed | icosahedral shell |

Shaped per family so it also reads as part of that creature, and sized to
about a third of the cloud's span — the cloud is still the creature. The
first pass at 0.46 reached the drifter's own ring and the dots stopped
reading as the body at all. Driven off `ENEMY_SPEC.rammable` rather than a
hardcoded list, so a spec change moves the visual with it.

### Two traps worth naming

**The core is a child of the `Points`, not a `Group` wrapping both.** Callers
reach for `obj.geometry` and `obj.material` on the enemy directly:

```js
if (e.obj.material) e.obj.material.color.setHex(...)   // the slow tint
if (e.obj.geometry) e.obj.geometry.dispose();          // the wipe
```

A wrapper turns both of those into silent no-ops — the tint stops working and
the geometry leaks every wipe. This is the same trap the pickups fell into
when they went from `Points` to `Group`. As a child, every existing call site
keeps working and the core comes along for free.

**White is not neutral on a solid.** The slow tint clears itself by setting
white, which is correct on the cloud — its `PointsMaterial` uses
`vertexColors`, so white multiplies to no change. A solid has no vertex
colours to multiply, so white *erases* its body colour. The core records the
colour it was built with (`userData.baseColor`) and is restored to that.

---

## `cff89d2` — Beats between lessons, a bigger tank, leaders that point at it

### Three lessons in the time it takes to read one

Clearing a pair handed out the next instruction *and* the next pair in the
same frame. No pause to look at the HUD, no moment to notice which control
had just lit up — the pacing made the content unreadable regardless of what
it said.

Each lesson now ends in a **beat**:

```
kill lands -> confirmation line, pulse cleared -> 4 s of empty field
           -> next instruction, next pair
```

Instruction banners `hold` instead of auto-hiding after 4.5 s, so what you
are being asked to do is still on screen while you do it. The opening freeze
goes 4 s → 5.5 s; it is not only a banner, it is the first look at the board.

The beat is a `gapT` countdown with a `pending` thunk, checked before any
phase logic — so nothing spawns and nothing is asked while it runs.

### The tank, again

0.54 left it a quarter narrower than the procedural reference and it still
read as small. It now sits just over that width:

| | width | length |
| --- | --- | --- |
| tank (reference) | 0.508 | 0.729 |
| mkcx @ 0.75 | 0.531 | 1.460 |

### The health accents were invisible from above

Every authored glow strip is on the **flanks** — and half this game is played
looking straight down from the build camera, where the colour simply was not
present. Three strips added to the deck: a long one across the stern, a
smaller one behind each secondary. Placed from the model's own fittings
rather than by eye (`EngineDeck_Grille` y 1.57, `Driver_Hatch` y 1.56 → the
deck runs at 1.56–1.57; the secondaries sit at z 2.30). They share the cloned
`M_Glow` material, so they are health-coded for free.

The lift emitters are fattened 1.55× wide, 1.8× tall. At the authored
0.43 × 0.05 they were a hairline at play distance, and a gauge you have to
squint at is not a gauge.

### The leaders pointed away from the tank

The line must start at the label's **transform point**, because that is the
point the angle was measured from — the left edge for a right-hand label, and
the right edge for a left-hand one, where `translateX(-100%)` puts it:

```css
#units-callouts .callout s      { left: 0; }     /* right column */
#units-callouts .callout.left s { left: 100%; }  /* left column  */
```

Anchoring each to the *opposite* edge, as it did, draws every leader away
from the model and off the side of the frame. The columns also clear the
silhouette by 74 px instead of 34, so a label never sits on the part it names.

---

## `f08eed8` — One weapon per pair, a lever with its own beat, and the log tab

### The tank was 4.9x too narrow

The old `baseScale = 0.147` came from comparing the mkcx's **length** against
a corridor's **width**. The mkcx is 2.75:1 where the procedural tank is
1.44:1, so that mistake shrank it by most of that ratio and it read as a toy.

Re-measured against the procedural tank — the unit the board was actually
built around, and the only honest reference available. Both are multiplied by
the same `unitScale`, so `baseScale x raw size` compares world footprints
directly, with no board-density term to get wrong:

| unit | width | length |
| --- | --- | --- |
| tank (reference) | 0.508 | 0.729 |
| mkcx @ 0.147 | 0.104 | 0.286 |
| mkcx @ 0.54 | 0.382 | 1.051 |

A tank may be longer than a lane is wide. It may not be **wider**.

### The tutorial

Three scripted pairs, ordered by what each weapon costs you — treads free,
lasers free but needing aim, shell scarce and heating the barrel for three
seconds. Two enemies each, so a beat is a rehearsal and not a fight: the
player is never learning a control and losing at the same time.

The first pair comes in 7–11 hops out. **The walk is the lesson.** A pair
arriving at arm's length teaches nothing but panic; eight hops of empty
corridor is long enough to look around, find the lever, and decide.

The shell beat *hands over* three rounds as well as dropping pickups. A
tutorial step you can fail to even attempt is not a tutorial step — where
shells come from is the other half of the lesson, not the gate on it.

Then the field empties (the scripted gate collapses rather than being shot,
which was the old shell lesson) and the throttle gets a beat with nothing
else on screen. It advances when the lever is **moved**, not on a timer; the
16 s timeout only exists so a player who will not touch it is not stranded.

### The verification hook that failed twice

`?tutstep=N` clears N scripted pairs so the later beats can be screenshotted
without a pair of hands. The first two versions were wrong in the same way:

```js
setTimeout(step, 900);            // v1: fixed delay
if (phase !== before) next();     // v2: poll the loop
```

Under `--virtual-time-budget`, **timers run on virtual time while
`requestAnimationFrame` is throttled.** So v1's clears outran the ticks — two
landed between one pair of ticks, the phase advanced once, and the run ended
up short. v2 polled for a phase change that the starved loop never made, hit
its timeout, and ended up short in the same way, silently. Only a trace
showed step 3 firing while the phase was still where step 2 had left it.

The fix is to call `tutorial.tick()` directly. Poll the thing being driven,
never a clock — and when the loop is not reliable, drive it yourself.

### Furniture

The throttle moves to the left edge, stacked above the minimap, using the
minimap's own sizing expression so the two travel together — it had been
sitting in the centre, on top of the road ahead. BUILD/MAP/WANDER/CAM/sound
go to the top: they are mode switches, not thumb controls.

The dev log and the roadmap now share one tab as two panes — the same
document read in two directions — with the build token in the header,
because "which build am I looking at" is the first question anyone opening a
change log has. The corner badge remains the shortcut to it.

Worth knowing: **there is no global `.hidden` in this stylesheet.** Every use
is scoped, so a new one silently does nothing until it declares itself. The
roadmap pane showed through behind the dev log for exactly that reason.

---

## `7da0712` — The beam was square all along; the sweep was not

Five asks. The most persistent one turned out to be a measurement problem
rather than a modelling one.

### "The beam in the back is still tilted"

It is not, and has not been since the yaw fix. The **viewer's own idle tick**
sweeps the turret ~45 deg, and the stowage bin — the beam — goes round with
it. Dead-astern with the tick frozen, the tank is symmetric:

| turret | reads as |
| --- | --- |
| swept (default) | barrel out to one side, beam skewed |
| frozen (`sweep` off) | dome, bin and rack all on the hull centreline |

So the fix for the complaint IS the other request in the same message: a
`sweep` toggle (and `?sweep=0`) that stops the turret and returns it to rest.
That rest pose is the only state in which the model can be judged against the
hull axis at all — three separate "it looks tilted" reports were all this.

### The emitters were k² of their size

`attach()` preserves world transform. I attached them into a group that was
**not yet in the scene graph**, so its world matrix was identity — which
means the whole ancestor chain, including `fitModel`'s scale `k`, got baked
into each child's local matrix. Adding the group to the model afterwards
applied `k` a second time.

```js
modelRoot.add(emitters);            // parent FIRST
for (const n of MKCX_LIFTERS) emitters.attach(gear.getObjectByName(n));
```

They were present and correctly placed the whole time, at roughly a tenth
scale. The general rule: `attach()` is only meaningful once the destination
is where it will finally live.

They are six separate objects again rather than one welded batch, so they can
be spaced — the authored z values (−2.35, −0.40, 1.70) bunch at the rear and
overhang at the front. Now at 18/50/82% of the nacelle's span, measured off
the nacelle **batch**: `Nacelle_L` stops existing at the merge, so a lookup by
name finds nothing and quietly leaves the spacing untouched. A dead lookup
that returns `null` and skips is the failure mode to design against here —
nothing throws, the feature just does not happen.

### Labels were splitting on the wrong centre

Left/right was decided against the **canvas** centre. The tank is rarely
centred in frame, so nearly every part fell on one side and the greedy
declutter marched that column off downscreen. They now split on the model's
own projected centre and sit in two columns *outside* its projected
silhouette. Labels drawn over the tank hide the thing they are naming.

### Tuned values are the defaults

The operator's block replaces the derived guesses. Two knob ranges had to
grow to contain them (`rock` 0.06 was the old ceiling; `recoilPitch` 0.125
over the old 0.2) — caught by the schema test that asserts no default sits
outside its own slider, which is exactly the trap it was written for.

Three tests failed on the new values, and all three were **my assertions
encoding the old tuning as an invariant**: a rise rate, a slide distance, and
the secondaries' default share. Rewritten to assert shape rather than value —
the rise must ease over several frames (not at a stated rate), the slide is
measured from its own rest, and each share is tested by naming it explicitly
instead of leaning on the current default. A test that pins a tunable is a
test that fights tuning.

---

## `92597ef` — Three-tier hover, a whole shot in the bench, blueprint labels

Six asks. The first one explained three of the others.

### The hull was never in the body group

`mergeByMaterial` parents each batch to its **owner**, and anything outside a
preserved pivot is owned by the root it is handed — which was the glTF
**scene**, a *sibling* of `MKCX_Root` rather than its parent:

```
G (fit wrapper)
└ scene
  ├ MKCX_Root
  │ ├ Hover_Gear      ← pivot, owns its batches
  │ └ Turret_Pivot    ← pivot, owns its batches
  └ Mesh(root batches) ← hull, nacelles, details… OUTSIDE the model
```

The hover split walks `MKCX_Root`'s children, so it lifted only the
articulated pivots. "Body rise" raised the turret and secondaries off a
stationary hull, which is exactly what it looked like. `inner.attach(c)`
re-parents the batches without moving them.

### Three tiers, not two

Two tiers left nothing to measure the lift against — the whole thing rose in
one piece. The lore settles it: the machine levitates **on** the emitters, so
the emitters are the ground.

| group | motion | holds |
| --- | --- | --- |
| `HoverEmitters` | none, ever | the six lift emitters |
| `HoverGear` | settles by `gearDrop` | nacelles + pylons (the skirt) |
| `HoverBody` | rises by `rise` | everything above |
| ` HullVib` | vibration ×1 | hull and its furniture |
| ` Weapons` | vibration ×`vibWeapons` | turret + secondaries |

Splitting the emitters out of the gear needed no name list. The merge batches
per material and they are the only `M_Glow` parts down there — nacelles are
`M_Armour`, pylons `M_Steel`.

Vibration moved off the body and onto the hull because shaking the body shook
the guns just as hard, which read as the guns being **loose in their mounts**
rather than bolted to an idling machine. `vibWeapons` (0.3) is the share they
keep.

### Recoil immunity is spent, not withheld

The secondaries fire nothing when the main gun does, so the kick should not
read on them — but they sit inside the body that noses up. Immunity has to be
*spent*: their mount counters the body's pitch, and `recoilSecondary` is how
much of it they keep. This cancels their orientation, not the small arc the
body's rotation swings them through; at 0.05 rad that arc is sub-pixel.

### A whole shot in the bench

It had the kick and neither of the other two thirds. The barrel now takes the
same cool→hot lerp the game runs, on the same sleeve; the shell leaves the
muzzle **anchor** along the barrel's own world +Z, so it stays right once the
turret has swept. `?fire=N` fires one N seconds in, for stills.

### Blueprint callouts

Nineteen parts, named by the model's own node names, toggled with `labels`
(or `?labels=1`). Markers are dropped **before** the merge welds those nodes
away, and hung on the nearest surviving pivot, so a turret label sweeps with
the turret. Leader lines plus a one-pass vertical declutter per side; the
usable band stops above the control row.

This exists because "the bit at the back that looks tilted" cost a fortnight.
It was a 6 deg slew on `Turret_Pivot`, and neither of us could name the piece
we were each looking at.

### Two bugs only the browser probe could see

- **`preloadMkcx` was not idempotent.** `loadGlb` caches the *scene*, but
  every caller still ran the body against it — re-merging an already-merged
  scene and re-marking it. Every part whose node is a **Group** (and so
  survives a merge) collected one label per call: three of each. The promise
  is the guard now, not the scene.
- **The secondaries handle was looked up on the unit** while the body group
  was still detached from it, so it came back `undefined` and the recoil
  immunity silently did nothing. Unit tests passed throughout — they use
  stand-ins, and a stand-in cannot have the wrong parent.

---

## `77f2e5d` — One knob schema, a squared turret, and a roadmap tab

Three strands, all about the same thing: making what you judge and what
ships be the same object.

### The turret was six degrees off, and so were the shells

The beam out the back of the turret had read tilted since the mkcx landed.
Centring the sensor mast last time did not fix it, because the mast was
never the beam — it is a hull fitting at the rear-left deck corner. The tilt
is baked into `Turret_Pivot`, which the model ships slewed **6.00 deg** off
the hull axis (`rotation.y = -0.0523`).

That was not only cosmetic. This pivot is never rotated at runtime, and
`fire()` derives the shell's heading from its **world +Z**:

```js
turret.getWorldQuaternion(tmpQ);
tmpV.set(0, 0, 1).applyQuaternion(tmpQ);
```

So the authored yaw made the tank shoot six degrees off from where it
visibly points. `turret.quaternion.identity()` at build time squares the
silhouette and the aim together. The lesson generalises: when aim is derived
from a render transform — which is the house rule — the model's **rest pose
is gameplay data**, not decoration.

### Health moved onto the machine's own lights

The stretched mast read as an extra piece stuck to the deck, which is the
opposite of diegetic. The model puts every accent on ONE material, `M_Glow`:

| accent | count |
| --- | --- |
| lift emitters (nacelles) | 6 |
| hull glow strips | 4 |
| turret glow strips | 2 |
| secondary rings, headlights | 4 |

So the tint is a **single material write** that lands on all of them at
once, wrapping the hull instead of facing one way — legible from every
camera, which the mast never was. The material is cloned per unit first:
the merge preserves material identity and every mkcx descends from one
cached prototype, so painting in place would tint the whole field.

Two corrections the pixels forced. The hue belongs in **emissive** with the
diffuse held at 0.22 — these are running lights, and lit at full diffuse
they resolved to white under the key light. And the stops needed saturating:
the old sky-blue full-health stop read as "the lights are on", not "the
lights are blue", once emissive drove it.

### The bench now tunes the build

`units-tab` could show the tank but not change it in any way that shipped.
`td-tab` held a `params.hover*` mirror behind a hand-written GUI folder;
the viewer read the module defaults. Two sets of numbers that happened to
start equal — the drift `tankfeel.js` exists to prevent, one layer up.

`TANK_FEEL_KNOBS` describes each tunable once (key, label, group, range,
step). Both surfaces are generated from it and both write into `FEEL`, a
single live object in `feelstore.js`. No apply step, nothing to sync. The
four recoil constants get sliders for free, and `RECOIL_LEN` stops being a
second constant — it is a read of `FEEL.recoilLen` now.

`feelstore` is separate because `tankfeel` is pure and Node-tested and
`localStorage` is not available there. Restored blobs go through
`clampFeelParams` as untrusted input: a stored entry can predate a range or
a rename, and a corrupt one should cost the defaults, never a broken tab.

The copy button emits **source**, not JSON — otherwise a good setting lives
in one browser and never reaches the repo, which makes the bench a toy.

Tests assert schema coverage in both directions, that no default sits
outside its own slider range, and that the emitted block rounds to slider
precision rather than `0.13999999999`.

The panel is `position: fixed`. Its parent `#units-chrome` is a
bottom-anchored absolute strip, so an absolute panel hung off the *controls*
rather than the stage, and a percentage `max-height` resolved against that
strip and collapsed the list to zero. Both of which it did, visibly.
`?tune=1` opens it — headless has no pointer.

### And a ROADMAP tab

Three doc tabs now share one factory, so this cost a file and a
registration. It lists the uncomfortable items too — the five board tabs are
still copy-and-edit siblings, mobile has never been checked on a real
device, nothing tests the render layer — because a roadmap that only lists
wins is decoration.

---

## `155e08c` — Recoil moves into the feel driver, so the bench stops lying

The unit viewer exists so the tank can be judged in isolation instead of
mid-firefight. It could play the shell **sound** but never showed the
turret flinch, because the kick was written inline in `td-tab.js`'s frame
loop. A bench that shows a different tank than the game ships is worse
than no bench.

`src/tankfeel.js` now owns recoil next to hover and rock:

| call | does |
| --- | --- |
| `fireTankFeel(st)` | arms the kick (`st.recoil = recoilLen`) |
| `stepTankFeel(st, dt, running)` | decays it toward 0 |
| `applyTankFeel(unit, st)` | draws it onto `userData.turret` / `hoverBody` |

The slide is `baseZ - recoilSlide * rk`, where `rk = rf²` — squared so the
hit lands hard and lets go fast — plus a 70 Hz shudder scaled by the same
factor. It is applied **before** the `hoverBody` early return, so the
procedural tank (a turret, no suspension) still kicks.

Two traps are load-bearing here:

- **`td-tab` keeps the recoil clock.** It drives the camera shake and the
  shell's own flight, so it stays authoritative and hands `recoilLeft` to
  the driver each frame. Two independent clocks would drift.
- **Pitch goes on the body group, not the unit.** The unit's orientation
  comes from `lookAt`; `playerMesh.rotateX` *composes* onto that
  quaternion, but writing `.rotation.x` would *replace* it. tankfeel only
  ever writes rotation on `hoverBody`, a child group with no such
  constraint — and `td-tab`'s own `rotateX` is now gated to units that
  have no hover split.

Rock and recoil pitch are summed into `rx`/`rz` and assigned once. Firing
mid-landing should read as both; two writes to `rotation.x` would silently
keep only the second.

`test/tankfeel.mjs` (30 checks, wired into `npm test`) pins the gestures
rather than the numbers: the rise is gradual (no frame delivers >5% of it),
the *gap* between body and skirt opens rather than the tank levitating as
one lump, the turret returns to `baseZ`, a hover-less unit still kicks, and
recoil composes with rock instead of overwriting it. It also caught a real
wrinkle — the red health stop's blue channel sat *above* orange's, so the
beam dipped fractionally warmer before ramping cool. Two hundredths and
invisible, but the ramp now moves one way on every channel.

---

## `75cdd2d` — Three sounds for one engine, and a viewer that plays units

The tank's engine bed had never worked, and the cause was a design mistake
rather than a tuning one. `loop()` in audio.js returned a stub handle —
`{set(){},stop(){}}` — when it couldn't start. A stub *looks* successful,
so the caller stored it and never asked again. The tank's first move
reliably lands in the window where the AudioContext exists (the keypress
created it) but the mp3 hasn't decoded yet, so one latched stub silenced
the bed for the whole session. It returns `null` now and the caller retries
every frame, which is free: `start()` bails before touching the voice
budget when there's no buffer. Worth remembering as a general shape —
a failure that returns something truthy is worse than one that throws.

The engine is three sounds instead of one: hydraulics lift the tank as it
starts, a thruster bed carries it while it moves, hydraulics set it back
down when it stops. A single looping sample gave starting and stopping no
weight at all. `thruster.wav` is also a much better loop source than the
old teleport whoosh — its RMS holds within ~1 dB across the body against
2.5 dB for the old one — so the 2.90 s loop has no audible seam. The
build script grew a LOOPS table, since it now builds two crossfaded beds
rather than one hardcoded case. The old bed stays in the manifest to
compare against.

The heat sleeve is 3× longer at the same radius, pushed forward so the
longer band still sits on the barrel rather than starting inside the
mantlet. It's the most legible thing on the tank and it was too short a
band to read at gameplay distance.

And the units tab plays sound now, which makes it genuinely dual-use: a
tuning aid and a lore panel in the same control. Each catalogue entry
carries its own sounds, so a tank offers start/moving/stop/shell/lasers/
reload/pickup, a tower offers fire and upgrade, and every hostile offers
all three death sounds — hearing all three is the point, since the game
picks between them from the deterministic stream. `moving` is a loop and
its button toggles. The viewer builds its own mixer instance so nothing
there can disturb the game tab's levels or voice budget, and it latches a
loop handle only when `loop()` returns a real one. Same trap, not repeated.

---

## `8f9cb7f` — The tank you can drive is now a model

`mkcx` joins the unit roster, so it sits in the creature dropdown beside
the procedural tank rather than replacing it.

The interesting part is that the tank is the **opposite** case from the GLB
tower, and the difference is the whole design. A tower can be flattened to
about six draw calls because it holds still. A tank has to *aim* — so the
nodes that move have to survive the merge. `mergeByMaterial()` now takes a
list of pivots to preserve: meshes under one of them merge into *that*
node's local space and stay attached to it, everything else merges into
the root. `Turret_Pivot` and both `Secondary_*_Gun_Pivot`s come through
articulated, so aim still derives from their world quaternions and the
house rule about never re-deriving a render-coupled direction holds. 58
meshes becomes 13. The empty `Object3D`s left behind cost nothing and keep
the artist's transforms exact.

It's recentred on `Hull_Mesh`, not on its bounding box. That sounds fussy
until you measure it: the box centre is (0, 1.69, **1.46**) because the gun
barrel juts 6.87 units forward while the hull sits at the origin. Centring
on the box would have had the tank pivoting around a point out in front of
itself — the kind of bug that reads as "the controls feel wrong" rather
than as a transform error.

The GLB machinery moved into `glbmodels.js` — `loadGlb` (one cached
in-flight load per URL, resolving `null` rather than rejecting, so callers
always have a fallback), `mergeByMaterial`, `fitModel`, `tintModel` — with
`towerlooks.js` refactored onto it rather than keeping a second copy.

Verified the loaded state rather than merely that something built:
`loaded=true meshes=13 turret=true guns=2 baseScale=1.0`. The fallback
reports 17 meshes and 0.497, so those numbers are the real model with its
articulation intact — worth checking, because an earlier probe of mine sat
in the wrong function and would have reported success either way.

---

## `8f58801` — A smaller tutorial board, and a spider that became a tower

Two things, plus a loader.

The board first. The whole unlock run — every wave until the last tower
unlocks — is a guided tutorial, and it was being played on a sprawling
map. `points` went 3000 → 500. That knob is less direct than it looks, so
it was measured rather than guessed: `points` sets the sphere's
resolution, not the arena, and the room carve produces a roughly fixed
number of open cells regardless. The opening sector goes 146 cells at
3000, 118 at 600, **84 at 500**, 73 at 400 — so 600 would have been barely
a change and 500 is a real one. Cells come out ~2.4× wider too, so the
board reads chunky and legible instead of finely sprawling. The thing that
could have broken didn't: the world unseals by sector across rounds, and
round 2 still opens 278 cells against round 1's 84.

Then the GLB. `GLTFLoader` and `BufferGeometryUtils` are vendored at
r160 from the same 0.160.1 tree as the bloom chain, their bare `'three'`
specifiers rewritten to our single copy — the dual-instance trap that arc
already documented. The heptapod walker is now a third tower look.

The registry's `preload`/`lookReady` hook, added speculatively last commit,
earns itself here: choosing `heptapod` builds the braille fallback
immediately and re-applies once the bytes arrive, so the choice is instant
and a tower is never invisible. Both phases were caught in one run —
`meshes=6 points=2`, then `meshes=216 points=0` with `Heptapod_Root` in
the tree.

Three problems the feasibility pass had missed, because it measured local
accessor bounds and ignored node transforms. **Scale**: true world size is
4.83 × 2.51 × 5.34, nearly twice as wide as tall — fitting by footprint
made a squat smear that read as debris, fitting by height alone sprawled
it across neighbouring cells, so it fits to a target height with a span
cap. **Visibility**: a dark grey machine vanishes against a black board of
neon wire, so the def's colour goes on as emissive — full on the parts the
artist named "glow", a low wash elsewhere. **Draw calls**: the model is 109
separate meshes; eight towers would be ~870 draw calls, doubled again by
the bloom's second scene render. Merging per material takes it to 6 per
tower (216 → 12 for two), triangles intact. That costs the rig — a merged
mesh is one rigid body, so the turret can't turn. For a walker that has
dug in to be a tower, holding still is in character.

Also fixed: `?towerlook=` set the param without refreshing the lil-gui
controller, so the panel said `braille` while heptapods were on screen. A
panel that lies about what is rendering is worse than no panel.

---

## `3a762cf` — Towers get a look you can change

The tower visual was welded into `makeTowerUnit`, so trying a different
look meant editing the thing that also knows about mounting, scaling and
the head animation. `towerlooks.js` is the seam: a look is a named builder
that turns a tower def into an Object3D, and swapping one rebuilds only
`tower.obj` — key, def, tier, cell, cooldown and spend are game state and
never move. There's a `tower look` dropdown and a `?towerlook=` hook.

It ships with two looks, because a registry with one entry proves nothing.
Alongside the existing `braille` dot-cloud head there's `solid`: the same
mast, but a faceted tinted head with bright edges and a slower spin, so it
reads as machined mass rather than a hovering swarm. Both call a shared
`makeTowerMast()` split out of `makeTowerUnit()`, so every look is the same
family of machine and only the head differs — and `solid` maps each
`def.shape` to a primitive, so a tower keeps its silhouette identity when
you switch.

One latent coupling got fixed on the way. Tier bulk was applied as
`obj.scale.multiplyScalar(1.12)` — accumulated *onto the object*. That
meant the visual silently carried tier state, and the first look swap
would have quietly reset every upgraded tower to tier-0 size. It's derived
now, `baseScale × 1.12^tier`, inside a shared `placeTowerObj()` used by
placement, upgrade and swap alike.

The swap was verified live rather than at the builder: with two towers on
the board, `braille` renders 2 Points heads and 6 meshes, `solid` renders
0 Points and 8. The `?towerlook=` hook was deliberately moved to run
*after* `?tower=` so it exercises `applyTowerLook()` over existing towers
instead of only choosing at build time — the earlier ordering would have
left that path untested.

`buildTowerLook()` never returns null: an unknown name falls back to the
default rather than leaving an invisible tower on the board. The unused
`preload`/`lookReady` pair is the hook for looks whose assets load
asynchronously, so the heptapod GLB can arrive without reshaping this.

---

## `e8b70d2` — Per-group bloom, and the ally tanks that weren't there

The bloom was one dial for a scene full of different things. Turning it
down to calm the board flattened the enemies; turning it up to make
enemies pop smeared the board. There are five dials now — map, enemies,
tank, towers, effects — under `bloom > weights`, persisted so a tuning
session survives a reload.

The catch is that `UnrealBloomPass` is a full-screen post-process. It has
no idea what an object is, so "bloom per group" isn't a parameter you can
add; it's a render path you have to choose. Three chains, one per group,
would buy fully independent strength/radius/threshold for about 4 scene
renders and 3 mip chains. Scaling each group's material brightness would
be free but welds glow to brightness — you could never have a bright line
that barely blooms, which is exactly what the board needs.

So: one chain, fed a **weighted** render. Each object's colour is scaled
by its group's weight before the bloom pass, and the result is added to a
normal, unweighted render — `scene + bloom(scene × weights)`. A weight
changes how hard something *glows* without changing how brightly it
*draws*. Two scene renders instead of one; the mip chain, the expensive
half, is unchanged.

What makes the composite clean is where the bloom is read from. r160's
`UnrealBloomPass` blends its result additively over its input and ignores
`this.clear` at that step, so the pass output is always `input + bloom`
and can't be made bloom-only. But it leaves the *pure* bloom in
`renderTargetsHorizontal[0]` just before that blend, and that texture is
readable — so no scene term leaks into the add. That detail was checked in
the vendored source before the approach was settled, not after.

Group membership is read fresh each frame from the collections that
already exist — `enemies`, `spawnPoints`, `towers`, the four board meshes
— rather than tagged at creation. Enemies are built in several places, and
a tagging scheme would have meant every future spawn site remembering to
opt in. Anything unlisted falls through to `effects`.

Verified by A/B at a fixed seed: forcing `map` to 2.5 against the shipped
0.35 makes the board's halo appear and vanish while the lines stay equally
bright, and the enemy cluster is pixel-identical in both. Glow moved,
brightness didn't, nothing else was touched.

Also in here: ally tanks are gone from TD. Worth recording *why* that was
cheap — `params.friendlies` was already `0` and never exposed in the GUI,
so none had spawned in a long time. The array was permanently empty, which
meant `playerHit`'s "command jumps to the nearest ally" branch was
unreachable and death already fell through to `loseGame`. 207 lines of a
subsystem carrying full weight while doing nothing. The `C` key and the
"friendlies & pickups" glossary went with it.

The weights themselves have not been *seen*, only reasoned about. That's
what the sliders are for.

---

## `bfb7a2f` — The vertex blobs, and cutting the build camera loose

Two fixes and one of them was not where it looked.

The squarish glow beads on floor vertices read like a bloom setting. They
weren't. Every open cell emitted all four of its own boundary edges, so
every interior edge — which belongs to two cells — was drawn **twice**.
On seed 7: 4019 distinct undirected edges, 6016 segments emitted, and up
to **14 segment endpoints landing on a single vertex**. The edge material
is `AdditiveBlending`, so those overlaps sum. A vertex ran up to 14× the
base edge brightness while the midspans sat near 1–2×, so with
`threshold: 0.85` the bloom picked out vertices specifically and left the
lines alone. On the vertices, in every camera, worst top-down where the
most vertices are in frame — which is exactly how it was reported.

Fixed at the emission point with an order-independent segment key. Order
independence is the whole trick and is what `test/segkey.mjs` guards:
twin edges are wound opposite ways, so a direction-respecting key would
dedupe nothing and do it silently.

There was a real second defect underneath, found first and fixed in
`a1ca152`. `EffectComposer.setSize()` sizes every pass in device pixels;
`postfx.js` re-applied the bloom's size afterwards — to protect the phone
half-res path — but re-applied it in *CSS* pixels. At dpr 2 the bloom ran
on a quarter of the frame's linear resolution (composer 1600×914, mip0
400×229). That didn't create the blobs, it made them blockier. Both are
now tested: `bloomTargetSize` is pure and Node-checked, because a bug
that is invisible at dpr 1 and only bites on Retina is one that comes
back.

Build mode also got cut loose. It used to re-centre on the Heart every
single entry and hold you there on a 0.6 rad elastic tether. Now it
frames the Heart the first time and then stays put, and the drag rolls
the sphere all the way round. That needed more than deleting the clamps:
the camera's up was re-derived each frame as the Heart pole projected
into the tangent plane at the view centre, which collapses to zero at the
antipode — the ceiling was the only thing keeping us away from it. The
frame is carried as a quaternion now and rotated incrementally, so it is
well-conditioned everywhere. Double-tap anywhere rides the view home,
using the camera loop's existing slerp for the easing.

One worth recording: putting the first-entry centring in `toggleBuild()`
shipped a black screen, because `?mode=build` and the tutorial set
`buildMode` directly and the old `if (!buildCenter)` fallback that had
been covering them was gone. Nine passing unit tests didn't catch it; the
first screenshot did.

## `31a582b` — Sound

The game had no audio at all. It has seventeen sounds now, all in the TD
tab: one voice per tower, the tank's shell, twin lasers, both pickups and
a speed-driven engine bed, and three enemy deaths picked at random. A
`sound` folder sits next to `bloom` with master and four bus faders, plus
a mute chip in the touch row.

Most of the work was in the assets, not the code. An audit of the
shortlist against the actual fire rates in `towers.js` turned up three
things worth designing around. Laser and Slow shipped the *same*
`beam-05` file — identical size, identical 4.683900s duration — so the
two towers would have been indistinguishable; they're now two variants
cut from it, the laser a 0.45s head at pitch and the slow 0.80s at
`asetrate` 0.70 so it drags. Most samples outlived their own tower's
shot interval, badly at tier 2 where the `single` attack family
compounds to ×1.44: a fully upgraded rapid tower fires at 4.32/s against
a 1.54s source, 6.7× self-overlap. And the engine sample turned out to
be loopable — its RMS body holds within ~2.5 dB from 0.35s to 1.45s —
so the tank got a real bed instead of one-shots per cell crossing.

`scripts/audio-build.sh` solves the overlap at the source, trimming
every sample to fit its *tier-2* interval, then peak-normalizing in two
passes. Two traps there cost real time. `volumedetect` saturates its
report at 0.0 dB, so it structurally cannot see the overshoot it's being
used to measure — four files read "0.0 dB" and looked fine. `astats`
over float shows the truth: MP3 decoding reconstructs peaks *above* the
encoded sample peak, by +0.9 to +4.3 dB across this set, which Web Audio
clips at the output device. Pass one lifts to −1.5 dBFS, pass two
subtracts the measured overshoot; the script hard-fails if anything
lands at or above full scale. 176K for the set.

The code splits along a testability line. Every decision about *whether*
a sound may play is pure and lives in `audiomix.js` — per-key
min-interval, per-key voice caps, a global 24-voice ceiling, and
inverse-distance falloff — so it's Node-tested with no `AudioContext`
and no DOM. `audio.js` only carries those decisions out. `admit()`
returns an id to *steal* rather than stopping anything itself, because
the caller has to ramp it down over ~30ms first; a hard cut mid-waveform
clicks. The manifest cross-checks `TOWERS`, so adding a tower without a
sound is a test failure rather than a silent gap.

Two details worth knowing. The context is created on the first user
*gesture*, never at init — browsers reject one made earlier, and a
suspended context swallows everything silently, which reads as a bug in
the game rather than as policy. And audio URLs take their `?v=` from the
`<meta name="cb">` tag at runtime, because `fingerprint-urls.py`
rewrites HTML attributes and CSS `url()` but never JS string literals.

Levels were derived from durations, fire rates and RMS envelopes — not
heard. The faders are there partly to fix that.

---

## `0de457f` — The glow we owed the neon

The original looks arc ended on a deliberate deferral: additive Tron edges
shipped, but the bloom chain didn't — "the 6-module EffectComposer cost
deferred until a look earns it." Comparing feel against HokorobiTawaa found
the bill for that: HK runs UnrealBloom at 0.9 over additive everything, and a
real part of "it looks better" was post-processing we'd chosen not to build.
So the chain is vendored now — ten modules at exactly r160 to match our
three, their bare `'three'` specifiers rewritten to our copy so the browser
can't load a second one — behind a shared `postfx.js` that any tab opts into
with two lines. TD, battle, heart and tank3 all render through it, half-res
on phones, with live strength/radius/threshold sliders.

---

## `04eeb1c` — First impressions

The TD open got a rewrite for the first thirty seconds. The tutorial starts
frozen — tank by the heart, two enemies in the lane, the laser lit, "SHOOT TO
DEFEND THE HEART"; the first shot thaws it. All the guidance is transient
toasts now (no × buttons, no start-choice modal, nothing that pauses the
game). Drive is MANUAL by default and sticky — auto is opt-in through the
directive chip and any input reclaims the wheel, with the idle auto-resume
timer gone. And waves are clear-gated: clearing the field plays a WAVE OVER
beat, then an anticipation countdown (waveGap) before the next wave, with a
waveCap safety so the war never stalls.

---

## `5f4862d` — Deliberate waves, one true gate

TD progression collapses onto the wave counter: wave N = N enemy types + N
tower types (one new tower a wave, capped at the roster), the newest threat
headlining with a few older types folded in. A NEXT WAVE strip previews and
counts down what's incoming; a NEW TOWER card marks each unlock; the HUD
leads with the wave. Portals became type-agnostic neutral **stargate**
sources — a bounded set per sector, seeded spatially, pouring out whatever
the wave plan dictates — and the torii/moongate shapes and the shape
dropdown are gone. Sectors stay as pure spatial growth. The plan itself
(`computeWavePlan`) and the wave-keyed tower ladder are pure and Node-tested.

---

## `6f955b9` — Onboarding, patience, and a camera that roams

Four TD tweaks. The tutorial greets you with a real choice — play or skip —
and wears a × so you're never trapped in it. The auto-driver got patient:
~10 seconds of idle before it retakes the wheel, or instantly when you pick
a directive. "TANK" became "MANUAL", and taking manual drive now says so —
a card explaining the tank fights autonomously until you grab the controls.
And build mode unbolted its camera from the heart: flick to pan across the
planet (elastic within a radius of home), pinch to zoom, tap to place.

---

## `16b5be1` — Reach, zoom, and missiles

Three TD tweaks. The tutorial portal moved off the heart's doorstep to
20–30 cells down the hall, so the opening reads as a real approach you
drive out to stop. Build mode learned to zoom — it opens closer and takes
a two-finger pinch on mobile (the board captures the gesture so the page
holds still), while the tap-to-place raycast stays exact at any distance.
And the shells you pick up are missiles now — the finned dot-cloud from the
Braille lab, three to a triad, still +3 a grab; the towers' own tracers keep
their bullets.

---

## `a306ce8` — The first five minutes of TD, taught

TD now opens on a hand-held tutorial instead of a wall of glossary. You
start beside the heart with empty hands as three phage crawl in —
"PROTECT THE HEART!" — and you learn ramming is free. Shells appear; the
portal wants three of them. Then the drums pick up, a second wave lands,
and the BUILD button glows while the buildable high-ground flashes across
the shell. It can't be lost and it drives its own spawns until you plant a
tower, then steps aside. Under it, a by-round unlock ladder now paces the
arsenal — normal and rapid to begin, the laser five sectors deep — with
the shop showing locked towers dimmed behind the round that opens them.

---

## `41cf984` — Dimmer walls, and a planet that can grow

Two tank3 tweaks. The wall tops were pure black — occluders that read as
holes in the neon shell; now they wear the tron 'dim' treatment (a faint
dark-blue slab at 0.45× the base with its top wires dropped to 0.28×
opacity), so walls read as faint slabs. And the developer-ish "planet
cells" slider became a plain size picker — small (400 cells, the old
default), medium (900), large (1500) — more cells meaning more world to
duel across.

---

## `0fc5860` — Tank2's rules, Battle's clothes

Tank3 is the planet duel in neon. It reuses the whole `tanks2.js` core —
manual aim, great-circle shells, the ghost-gunner AI ladder, the
dead-zone orbit follow — and changes only what you see: a Tron world
(additive cyan wire-grid, near-black void, seeded zone-tinted floors,
black neon walls), Battle's mesh tanks with edge outlines (cyan you,
magenta the AI), Braille dot-cloud shells, and polygon-scatter deaths.
One new tab file; the core never moved.

---

## `2f8c555` — The Play button comes back on phones

TD's briefing was unstartable on mobile: the Play button was cropped off
the bottom of the modal with no way to reach it — and TD is the default
landing tab, so a phone visitor hit a dead end. The modal was built to
scroll tall briefings (max-height, overflow-y:auto, touch scrolling), but
a later `overflow: hidden` — added to clip the hologram sweep that slides
far past the box — silently reset the scroll axis, so the modal just
clipped its overflow instead. TD's briefing is taller than heart's (it
carries an extra gameplay-tips block), so its Play button fell past the
clip. Fix: the modal is now a flex column that keeps overflow:hidden for
the sweep, scrolls its body in an inner `.msg-scroll`, and pins the
glossary + Play buttons in a `.msg-foot` that's always visible. Both td
and heart briefings use it.

---

## `3d41c65` — One smooth sweep instead of a stutter

The orbit follow stopped stuttering. The old version nudged the camera a
little every frame while red sat near the edge — a staccato jitter. Now
the camera holds dead still while red drives across the face, and when red
reaches the leading edge it commits a single 0.7-second eased sweep that
overshoots: the camera swings so its facing point lands well AHEAD of red
along its heading, dropping red near the back of the frame with most of
the battlefield in front of it. Then it holds again until the next edge.
The trigger is directional — it only fires when red is driving away from
centre — so the big overshoot never re-fires from the trailing side, which
is what made it stutter before. Verified the geometry with a 40-second
drive simulation: leads fire about every five seconds and red never leaves
the visible face.

---

## `63c4730` — The planet turns to keep you in view

Reworked tank2's orbit from a hard lock into a dead-zone follow. Before,
the camera welded red to screen centre and the planet felt dragged along
under a motionless tank. Now the orbit pivots on the planet's centre, so
the globe spins freely and red drives across the visible face on its own.
Only when red nears the limb — measured as a fraction of the visible-cap
angle, which widens as you zoom out — does the camera swing around the
planet to bring it back toward the middle, then hold (with hysteresis so
it glides instead of jittering at the threshold). Free rotate and zoom
still work inside the dead zone.

---

## `7893731` — Orbit that keeps up, and a tidier top edge

Three play-feel changes on tank2. Orbit is the default camera now, and
it follows: each frame the orbit pivot and the camera both translate by
player 1's motion, so the red tank stays framed while you keep free
rotate and zoom — before, driving carried the tank off the far side of
the planet and out of view. And the mode chooser (grid/maze/organic/…)
finally collapses behind the ☰ on desktop the way it already did on
mobile; a game shouldn't wear the dev tab-row across its top. The ☰
sits right of the cache badge and drops the tabs down on click; the
settings panel stays put.

---

## `7322998` — Hands-free forward, both tanks

Double-tap the forward control on either tank tab and it latches
auto-forward — the same cruise gesture the heart and TD tabs use,
now on flat Combat and the planet. It frees a thumb for steering and
firing, which is the whole point on mobile. Reverse or a second
double-tap releases it; the up pad glows while it's on. Two guards make
it robust: leading-edge detection so held-key repeat doesn't false-
toggle, and an OR-then-restore around the step so a late keyup can't
leave forward jammed on after cruise ends. Double-tap zoom stays
suppressed by the global touch-action rule.

---

## `bb6eabf` — Debris pays its own GPU bill

Final-review sweep: each explosion cube now owns its material (the
shared one was disposed with whichever cube died first — the
below-ground early-exit made that reachable, leaving siblings on a
dead material), and the shell contract gained its two missing
assertions: the range budget spans bounces, and the third impact
kills at the two-bounce cap — proven in a two-wall pocket fixture.

---

## `c7071d2` — Gravity is local now

Hit feedback ported to the sphere: the explosion cubes fall toward the
planet's center (local down = minus the surface normal), victims spin
through their knockback slide, respawns blink. With that, planet combat
is complete — same cartridge, rounder world.

---

## `ff7de02` — Three ways to watch a planet fight

Chase rolls the horizon under you; POV puts the curve terrifyingly
close (the mutual horizon is ~28° — an enemy three seconds away is
invisible); orbit hands the whole ball to OrbitControls while the match
keeps running, a war in a snow globe. Ladder unlocks live in
tank2.unlocked — flat-arena wins don't transfer, the planet has to be
earned on the planet.

---

## `c7e1317` — A very small war on a very small world

The planet tab renders: ~400 relaxed quads as a vertex-colored olive
ball in black space, wall cells extruded into orange prisms, the same
six-box tanks riding the surface with up = surface normal (one
makeBasis from the core's pos/head pair — the tab adds no orientation
math of its own). The chase camera hangs off anchors parented inside
the tank group, so the horizon rolls underneath you as you drive.
Shared .combat-* HUD classes now dress both tank tabs.

---

## `3e1ca8c` — The gunner that shoots at where you were going

The planet AI ladder is in. L1–L3 port straight over (wander; track and
fire on sight; lead the target — the intercept solves on the sphere by
iterating flight-time against the target's angular velocity, three
rounds, converges to well under a cell). L4 could not port: bank shots
need mirror walls and a sphere has none. Its replacement is native to
the geometry — shells follow the surface, so L4 keeps a track of your
last seen position and velocity, extrapolates it along its great circle
while you hide behind the curve, and fires at the ghost. No line of
sight, no warning, just artillery from beyond the horizon. Ambush
unchanged: no shot worth taking, no movement worth making.

---

## `ab2a787` — Combat, bent around a sphere

The planet tank core is complete and Node-tested: a ~400-cell relaxed
Stålberg planet with seeded wall clusters, tanks that drive in tangent
frames (position and heading stay an exact orthonormal pair for
thousands of steps), and shells that fly great circles — which makes
over-the-horizon hits physical, no line of sight required. LOS itself is
two tests: does the turret-height chord clear the sphere, and does any
wall cell sit on the arc. Same input shape, same events, same match flow
as the flat core; the geometry is the only thing that changed.

---

## `aa20820` — The arena earns its viewport

The tank tab rendered in a 150px strip: #tank-app was absent from the
app-container CSS rule (position:absolute inset:0) that every other tab
sits in — the plan authored HUD styles but never the container itself.
One selector-list addition; headless canvas went 1280×150 → 1280×813.

---

## `db01069` — Death is eight cubes

Hit feedback landed: victims spin through their knockback slide,
explode into a fistful of gravity-obeying cubes, and both tanks
respawn blinking. The debris uses its own mulberry32 stream seeded
from sim time — visual chaos, deterministic core. With that, the
Combat homage is complete: core, cameras, ladder, feel.

---

## `bd5f3c3` — Same game, three eyes

The tank tab gained its camera set: authentic top-down ortho, a
lerped chase camera, and a turret POV. Both moving views are derived
from the tank group's world transform (`getWorldQuaternion` /
`getWorldPosition` on anchors parented inside the group) — the
same-source rule that already burned us twice elsewhere. Because the
controls are tank-relative, the game core never knows which camera is
live. The AI ladder wired in: beat your highest unlocked level and
the next one opens (localStorage), `?ai=N` forces a level for
headless runs.

---

## `c593885` — 1977 extruded

The tank tab renders: the Combat playfield pulled into 3D — olive
ground, orange slab obstacles, two six-box tanks, an orthographic
camera looking straight down. The tab is a thin consumer: it forwards
keys as an input object, steps the Node-tested core at a fixed 60Hz
accumulator, and copies poses onto meshes (`rotation.y = -heading`,
the one place the sign convention is allowed to live). `?tick=N` runs
the simulation synchronously for headless screenshots.

---

## `0bf5599` — Four brains, one input shape

The tank AI ladder is complete and Node-tested. Every level emits the
same input shape as the player's keys — the AI plays the same game.
L1 wanders and fires blind on a timer; L2 gates fire on a slab-test
line of sight; L3 solves the constant-velocity intercept quadratic to
lead a runner and slips sideways while its shell flies; L4 mirrors
the target across the perimeter walls to unfold one-bounce ricochet
solutions, and simply waits when it has no shot. Aim error shrinks
with level — the ladder is a difficulty dial made of behaviors, not
stat inflation.

---

## `7219824` — A second game grows in the test tube

The tank-combat core (Atari Combat homage) landed as a pure module:
`tanks.js` holds arenas (ASCII maps + a mirrored seeded generator),
tank kinematics with axis-slide collision, one-shell-in-flight
ballistics with exact-mirror ricochet, and the hit → knockback →
respawn → match-end loop. No DOM, no three.js — the whole game is
Node-tested (`test/tanks.mjs`), including a 10-second deterministic
replay. The render tab comes next and will be a thin consumer.

---

## `6083632` — The map teaches, the gates face forward

Two small legibility moves with the same philosophy: encode the rule
in the render. First, buildable ground announces itself — in black
wall-top mode, only the wall cells that BORDER a hallway fill with a
dim tint, which is precisely the set of cells towers may mount (the
placeError border rule, painted). The player reads 'build here' off
the terrain; the deep wall mass and the sealed frontier stay void, so
the contrast survives. One boolean per wall cell at build time, zero
per-frame cost.

Second, portals stopped standing sideways. The upright alignment
always left the gate's azimuth arbitrary, so a torii could face the
wall on both sides of its lane. Now the gate axis turns toward the
open neighbor nearest the Heart — the direction its creatures will
actually march — through the same up-plus-lookAt pattern every unit
uses. A doorway that faces its road: the kind of detail nobody
notices when it's right and everybody feels when it's wrong.

---

## `5d55b1b` — Density with intent

The portals doubled their dots (560 → ~1150), but the commit's real
content is that none of the new dots are noise. The stargate's ring
winds two tube passes so it has thickness; its chevrons became true
V-strokes meeting at inward tips; the horizon is a pool with a core
sparkle. The torii's beams are parallel strands — front and back
planes plus thickness offsets — so the timber reads as wood, not
wireframe, and it gained footing stones, a doubled crown, and the
little gakuzuka strut a real torii has. The moongate got seven
concentric masonry courses with a bright inner rim and rubble
between. Same lesson as ever from the dot-cloud work: granularity is
free at render time (a handful of gates reposing ~1.2k points is
still cheaper than one waveJelly hero) — the craft is in placing the
dots where the structure is.

---

## `75a7e72` — Three new doors, and a rule about cosmetics

Portal silhouettes became a selectable: alongside the original torus,
a STARGATE (nine all-hi chevron clusters on a ring around a dotted
event-horizon fill), a TORII GATE (pillars, upswept kasagi, the tie
beams — static, except a twist wave rolls through it once every five
seconds), and a MOONGATE (thick dotted annulus under the radial Wave
treatment). All half-dotted, all standing on the same +Y-to-normal
alignment the torus established.

The structural point is the swap rule: COSMETICS NEVER RESET THE RUN.
Changing the portal shape rebuilds every standing gate in place —
phases derived from cell indices so the gameplay rng stream is never
consumed, wounded state (shrink + dim) carried over — and the hero
dropdown now swaps the player unit through buildActors() instead of
regenerate(). Dim itself moved off the baked vertex colors onto
material.color, so position-based treatments dim exactly like
color-based ones. And a confession the log owes: the first headless
check of the new hook came back as a BLANK WORLD — the factoring had
left one reference to a removed local, and the whole init chain died
after it. One grep of the console found it; the screenshot alone
would have said 'renderer bug' for an hour.

---

## `7d4ec51` — Tempo is identity

The operator caught a flattening: "make tower shots faster" had been
implemented as one global projectile speed, which made everything
equally fast — and therefore nothing fast. In HK, the tempo IS each
tower's identity: singles and lasers snap, the slow field is a
deliberate electric shock, the mortar is a slow heavy verdict. That
contrast was the feel, and a single constant erased it.

Speeds are now per-tower data in towers.js, HK's exact projSpeed
values converted to cells/s: single 20, rapid 26, spread 15, homing
13 (guided things should glide), sniper 42 — a streak that crosses
its whole range in a sixth of a second — and the mortar dropped to
3.5 with its arc raised, a full second of flight before the splash
lands like a decision. Slow-field and laser stay hitscan. The test
suite gained an ordering invariant (sniper faster than single,
mortar slower than homing) so no future "speed pass" can flatten the
identity again without a red test saying so.

---

## `ad11600` — One key, in context

Small QoL from HK's keyboard map: W or ↑ upgrades the selected tower.
The interesting part is what "selected" means and what it protects —
the shortcut only fires with a selection context live (the tower's
radial open in build mode, or a tower being watched in the bastion
view), and it consumes the key there, so the same W keeps driving the
tank everywhere else. Refusals flash their reason in the radial's
note. Context-scoped rebinding: one key, two meanings, zero conflict.

---

## `276af67` — Opening the door behind you

The operator's note named the flaw precisely: sector reveals kept
opening DEEPER — past the frontier you'd just fought across — because
concentric distance rings can only ever grow outward. The ask: south
if the last reveal was north, east if it was west. Two schemes died
before the third worked, and the corpses are instructive. Raw azimuth
wedges fail on a lane world: a winding width-1 corridor crosses wedge
borders constantly, so everything past the first crossing re-seals as
unreachable — sectors 1 through 3 rendered identically. Gates at four
compass points feeding a multi-source BFS fail differently: when only
a couple of lanes exit the starting disk, the gates collapse onto the
same exits and two sectors own zero cells. The per-sector open-cell
log caught both — numbers, not squinting at screenshots.

The scheme that works is iterative directional growth: each sector
claims an equal share of the remaining land, grown breadth-first from
a seed chosen on the already-open frontier in that sector's compass
direction — one way, then BEHIND, then the perpendicular pair.
Connectivity is by construction (seeds touch open land), balance is
by construction (equal shares), and direction is honored at the seed
even when lane topology makes the growth snake. 146 → 455 → 764 →
1073 → 1380 open cells, four equal reveals, each somewhere new. The
meta-lesson: on graph worlds, geometric partitions (rings, wedges,
Voronoi gates) keep losing to grown partitions — grow the thing you
need connected, and connectivity stops being a constraint to check.

---

## `e3f6499` — The bastion view, and a slow you can see

The camera family grew its defensive seat: BASTION, third in the V
cycle, parks the eye behind the Heart facing the nearest live
portal's lane — the classic tower-defense vantage. The trick that
makes it a system rather than a preset: clicking any tower in view
re-anchors the camera behind THAT tower, facing outward along the
lane it guards (the heart→tower direction, tangent-projected — the
geometry answers "which way does this gun look" for free). Empty
ground hands the watch back to the Heart. It's HK's bastion/action
presets collapsed into one view plus one click.

The slow tower had been mechanically honest and visually mute: a
0.14-second lightning flicker for a 1.6-second debuff. Now the debuff
wears its duration — slowed enemies tint ice-blue for the whole
window via material.color, which multiplies over vertex colors, so
one hex write per enemy per frame recolors a whole dot cloud — and
the tethers linger 0.32 s. Tempo turned up to match the operator's
brief: enemies ×0.7 size at 1.0 cells/s, tower shots at 6.5 cells/s.
Verification had a nice moment: the HUD read 'cannon HOT' with a
×2.00 streak in a run with zero player input — the auto-gunner
confirming itself.

---

## `75420f1` — The reveal becomes a moment, the tank takes orders

Two systems that make the game legible at its two timescales. The
sector reveal stopped being a flash you might miss: clearing a round
now pulls the camera to a full-planet frame aimed at the centroid of
the newly-unsealed band — computed by diffing sealed→open across
applySector — and burns that band's floors hot orange for the length
of the beat, cooling to their true colors as build mode begins. You
see the whole world, and you see exactly what you just earned. The
war is frozen for the 3.2 seconds; strategy resumes where spectacle
ends.

And the auto-wanderer graduated from personality to SOLDIER: the
directive system (dropdown, cycling chip, `AUTO · NAME` in the HUD)
feeds one strong term into the existing exit-scoring — a chase/flee
vector for AVOID and RAM, a descending BFS field for HOME and SEEK
PORTAL (the portal field recomputes whenever one rises or falls).
The same pass gave auto mode a trigger finger: an auto-gunner that
shells the nearest threat in range, rate-limited by the cannon heat
that already existed, aim-overridden through the same tangent
flattening as the turret path. SAVE AMMO and RAM keep shells for the
unrammable tier. The design through-line: high-level orders, not
micro-management — the tank stays willful about the steps and
obedient about the goal.

---

## `7bae749` — The cushion that pinned the tank

The operator felt it before the code showed it: the tank wedging in
width-1 corridors, and if the shells were spent, wedging permanently.
The suspicion — "we increased the hitbox to remove clipping, and an
unintended consequence is getting stuck" — was exactly right. The
wall cushion was born on the open heart battlefield, where walls come
one clump at a time; in a corridor, opposing walls BOTH sit inside
the 0.95-cell band, the sequential pushes zigzag, and a push that
out-muscles the drive step is a pin, not a cushion.

The fix is three principles rather than one number. Margins now adapt
to passage width — a cell with ≤3 open neighbours is a hall, and
halls trade a little visual overlap for guaranteed passability (and
skip diagonal wall collection, which is what jams corners). Pushes
are net-summed then applied once, so opposing walls cancel into
centering instead of fighting. And the applied correction is capped
per frame well below drive speed: a cushion corrects over a few
frames; the moment it can outrun the player, it's a wall. Backstop
for the pathological pocket: if a step and its slide are both
blocked, the tank creeps toward its current cell's center — open
ground by definition. Un-stickable, shells or none. The general
lesson joins the log: any corrective force in a movement system
needs a cap relative to player speed, or geometry will find the spot
where correction becomes capture.

---

## `7961a33` — Seven small honesties

A tweak pass where each item is a tiny usability truth. The mode chip
now names where it takes you — BUILD from the tank, TANK from the
build view — because a button that names where you already are is a
lie of labeling. The app lands on TD, the game it has become. Corridors
narrowed to width 1 so ROOMS read as arenas again. Enemies run at 0.85
cells/s — fast enough that a lane without tower cover feels naked. The
opening purse is exactly one Rapid plus one Slow (170c): the first
build is a decision with no slack, which is a tutorial nobody has to
write. CREDIT became the loud line of the HUD — orange, bold, glowing
— because it is the number the whole TD loop turns on. And the how-to
text left the live HUD entirely: a GAMEPLAY section now lives in the
briefing and pause modals, and the HUD speaks only state words
(AUTO / CRUISE / BUILD · war on). Screens that teach while you fight
teach nothing; screens that teach while you're paused teach.

---

## `9c86d8c` — High ground, wide lanes, and a purge of tanks

The operator's playtest note cut deep: multiple friendly tanks CONFUSE
new players — they read as enemies. TD's answer is subtraction: no
allies at all, just you and your towers. The briefing now shows a
tower sprite where the ally card was, and the SWAP button simply
doesn't exist in TD's markup (the id-stable wiring made removal a
one-line guard).

The board itself went back to HokorobiTawaa's grammar. The open-field
clump carve is deleted — the DUNGEON carve is the map again, tuned
wide: sixteen rooms joined by four-cell corridors are the monster
lanes, and the wall mass between them is HIGH GROUND, the only place
towers may build (mounted on the wall roof, raycast against wallMesh).
The elegant dividend: the connectivity guard became unnecessary by
construction — walls never carry pathing, so no tower placement can
ever dam a lane. A rule that needed a simulated BFS under the old
scheme is now free. And the world is big and pre-decided: 3000 sample
points, ~10k cells, with sector 1 opening just 416 of them — the whole
map exists from frame one, unsealing 25→45→65→85→100% by
heart-distance as rounds clear. Sealed land renders as void, which
makes each white-flash reveal literally materialize new world.

The roster completed its migration into the house language: every
enemy is now a half-dotted static cloud — the original three creatures
posed once from their rich generators, the borrowed nine from new
enemyDotPts silhouettes (dome-ghost, saucer, blob, ringed saturn,
spiked spheres, trefoil knot) — sized ×0.85, transform-idled per
family, bursting into tinted dots on death. A hundred of them cost
what one waveJelly hero costs, which matters because fodder counts
went ×1.4 on top of the wave-and-sector ramp. Hectic, as ordered.

---

## `78838ea` — Towers in the house style, effects in HK's

The mesh-head towers never quite belonged — everything else alive in
this game is half-dotted. Now the towers are too: `towerHeadPts()` in
creatures.js generates one dotted silhouette per HokorobiTawaa tower
shape (cone, spiral, sphere, double helix, pyramid, gear, teardrop,
bipyramid), and `makeTowerUnit` mounts it on an elevated mesh pedestal
— slab, tapered column, tinted collar, neon edges. The operator's
particle-count worry dissolves by construction: the clouds are static
and the idle is transform-only spin+bob, so ~190 dots per tower cost
nothing per frame. The rule the roster taught months ago holds: dot
COUNT is free; per-dot CPU work is the thing that scales badly.

The attack effects now carry HK's identity system. Every projectile is
a tracer — a bright additive head dragging its tower's signature trail
(sniper 11 ghosts, homing 6, rapid 3, single none), implemented as one
tiny Points buffer per shot whose ghosts shift back a slot per frame.
The mortar lofts on a sine arc over its measured throw and detonates
at the end whether it hit or not. The slow field stopped drawing tidy
lines and started throwing LIGHTNING — jagged additive polylines to
every tethered victim plus impact sparks, with jitter computed from
segment index + time so the fx layer never consumes the gameplay rng
stream. Determinism discipline extends all the way into the sparks.

---

## `c5a815d` — The world learns to open

TD's biggest structural borrow yet: HokorobiTawaa's fraying, spherized.
A run now lives on ONE persistent 700-point world, but round 1 only
opens the inner 32% of it (by heart-distance) — the rest of the planet
reads as sealed wall mass, a frontier you can see. Clearing every
portal doesn't regenerate anymore: the screen FLASHES WHITE (HK's
reveal beat, a CSS pulse) and the next band unseals *in place* —
56%, 80%, then the whole sphere. The implementation is two arrays and
a fraction: the full carve is remembered at generation
(tdFullTags/tdFullDist), and applySector() re-derives the open set
from `dist > frac·maxD`; the existing wall renderer does the rest,
because sealed cells simply ARE walls to it.

What persists is the point: towers stand, credit carries, the wave
counter never resets (so the intro schedule flows across sectors), and
new portals rise in the fresh band — the liquidation-carry mechanism
from the new-board era is deleted outright. And the balance flipped to
match the operator's brief — low-hp enemies in flooding counts
(per-portal = waveSize + wave + 2·sector), 16-second wave cadence,
allies cut to two. Without towers you drown by wave three; with a few,
it's a mowing exercise. Sector 3 at wave 6 fields 259 hostiles — the
stress hook made the point better than any tuning argument.

## `f9238df` — The radial comes home

Two build-mode refinements from the operator. First, mode purity: in
build mode the driving controls — steer zones, rocker, both triggers,
SWAP/CAM — disappear entirely (a `.build` class on the tab root),
leaving the board and the BUILD/MAP pair. Planning and fighting are
different instruments; they now look it. Second, the tower shop
became HokorobiTawaa's radial menu instead of a list: circular options
ring the tapped cell at HK's exact sizing formula, key + cost on each
button with the tower's tint on the border, your credit (or the
refusal reason) in a non-interactive center chip, upgrade/sell as a
three-option ring on standing towers. The event delegation classes
survived the re-skin, so none of the buy/upgrade/sell logic moved.

The headless check earned its keep again: the first screenshot showed
the ring pinned to the top-left corner, clipped. Cause: anchoring
measured the *canvas* rect, and when a URL hook opens the shop before
the first `resize()`, the canvas is still at its default 300×150 —
the clamp then pinned everything to the corner. Real taps would never
have hit it, which is exactly why it would have shipped: measure the
container, which is laid out from init, not the canvas, which isn't.

## `5dab5a0` — Chrome learns when it isn't wanted

The iPhone screenshot showed the failure plainly: mid-battle, the
build-token badge and a horizontal tab row sat on top of the HUD, and
the row itself ran past the screen edge — the TD tab literally
unreachable on the device the game now targets. Two structural fixes.
The tab bar stops pretending a phone is a desktop: under the ☰ it's
now a vertical mode menu — column layout, full-width labels, nothing
clipped — and picking a mode closes it, because selection is the
dismissal. And visibility became a STATE, not a toggle the player must
manage: a `body.playing` class, driven per-frame by whichever game tab
is live (`active && !paused && !won`), hides everything non-essential
including the ☰ itself. The chrome returns exactly when the player is
idle — briefing, ESC pause, win/lose — which are precisely the moments
mode-switching makes sense. Leaving a game tab clears the class, so
the doc tabs never inherit a chrome-less screen. The design rule
underneath: don't ask players to close UI; know when they're playing.

## `cdf195d` — TD M2: the maze you buy

Towers are in, and the design's core bet with them: a placed tower is
SOLID and blocks **pathing** — on an open battlefield the towers ARE
the walls, so building is maze-shaping, HK's buildable-band translated
to the sphere. The guard that makes it fair: every placement is
simulated first (add the cell, BFS from the Heart, check every live
portal still reaches) and refused with a reason if it would dam the
flow entirely. blastWall proved per-event BFS affordable months of
commits ago; placement reuses the pattern.

Interaction is tap-first on the build camera: a press that travels
>8 px is an orbit, otherwise it raycasts the floor into the cellindex
oracle and opens the shop — eight towers, affordability locks, hover
previews a dotted Braille range ring; tapping a standing tower offers
HK's exact upgrade/sell economics. Firing runs through towers.js: pure
targeting with the chord metric injected, per-kind delivery (fans,
homing re-steer, mortar splash, slow-field tethers with a new
slowUntil debuff, hitscan beams as additive light). And the economy
breathes end-to-end: every kill from any weapon pays bounty × streak,
rams pay the premium, a Heart breach kills the streak, and round-clear
liquidates towers at 100% into the next round's purse. The headless
proof was pleasingly indirect: force-place three towers, simulate ten
seconds, and read the HUD — ×1.80 streak multiplier means sixteen
enemies died to autonomous fire and paid for themselves.

## `a795ef0` — TD M1: two cameras, one identity

The TD tab exists. It is knowingly the sixth cp+sed sibling — the spec
bounded that cost in advance by moving the shared facts into
enemyspec.js first, and the copy pre-empted the two recorded sibling
traps: every `#h-` CSS selector group got its `#td-` twin via an
anchored script (the organic-tab canvas-collapse bug, not repeated),
and all element ids are td-prefixed (no duplicate-id roulette).

On top of the full heart game, the mode pair the operator called the
differentiation: **B** toggles between ACTION (the heart rig,
untouched) and BUILD — a top-down planning camera over the Heart pole,
drag to orbit, wheel to zoom. The switch costs one boolean because the
camera system was already goal-based: updateCameraGoal computes a
different goal, and the existing lerp eases the transition with no
cut. **M** swaps the minimap for the fixed heart-top-down threat view.
The tempo rule from the spec is live too: build FREEZES the war only
when the field is clear — wave clock and combat stop, ambient life
keeps breathing — while mid-assault the toggle is camera-only, so
build mode can't be used as a combat pause. The HUD names the state
you're in. Towers arrive in M2 onto exactly this camera.

## `a1839ca` — TD M0: the data moves out before the sixth sibling is born

First TD commit, and it deliberately contains no TD gameplay. The
lesson from five cp+sed board tabs is that shared FACTS drift first,
so before td-tab.js exists, the facts moved into pure modules:
`enemyspec.js` (the 12-type roster — tints, specs, intro schedule, now
with HK bounty values), `towers.js` (HK's eight towers re-based to
cells and fractional hp, the exact 70%/120% upgrade economics, and
targeting as a pure function with an *injected* distance metric — the
module picks targets without knowing the world is a sphere), and
`economy.js` (HK's credit loop verbatim: streak++ then bounty ×
multiplier capped ×5, leak resets, 75% refunds — plus the design's ram
premium and wave-tempo bonuses). All Node-tested (26 checks in
test/tdcore.mjs, in the suite), because DOM-free math is the part of a
game you can actually regression-proof.

heart-tab now imports its roster instead of owning it — verified
zero-change headlessly (same waves, same round gating, same HUD).
When TD lands, a balance edit touches one file, not two siblings.

## `2ce7793` — touch-action does not inherit

The double-tap zoom "fix" from two commits back never worked where it
mattered, and the reason is worth engraving: **`touch-action` is not
an inherited property.** Setting it on `html, body` styles exactly two
elements; the WebGL canvases — where every gameplay double-tap
actually lands — never got it, so iOS kept zooming. The working fix is
the universal selector: `* { touch-action: manipulation }`. The one
place that must NOT be manipulation — OrbitControls' canvas on the
grid tab — is safe automatically, because three.js sets inline
`touch-action: none` there, and inline beats stylesheet.

Layered on top: `maximum-scale=1, user-scalable=no` in the viewport
meta (honored in standalone/PWA mode and on Android; Safari
browser-mode ignores it for accessibility — which is exactly why the
CSS does the real work), the full Safari gesture pipeline prevented
(`gesturestart/change/end`), and long-press callout + text selection
off across the play surface, re-enabled on `.mdview` so the in-app
docs stay copyable. The general lesson: when a CSS "fix" for a
browser behavior doesn't take, check inheritance before doubling the
workarounds — half the touch/scroll properties (`touch-action`,
`overscroll-behavior`) are per-element.

## `ccc9d20` — Controls learn to whisper

Second controls pass from the operator, and a philosophy shift: the
maneuvering controls stopped explaining themselves. Steering is now a
pair of tall, flat, unlabeled zones hugging the lower screen edges;
forward/back are two more flat zones stacked dead-center between them.
Their affordance is material, not textual — a translucent panel, a
faint chevron, and a press-glow (`holdButton` now toggles a `.pressed`
class, which matters because `preventDefault` on pointerdown makes
`:active` unreliable). The player discovers how to drive; nothing
tells them. Fire stays explicit and asymmetric by design: the shell is
a big round button on the left, the laser a smaller one on the right —
importance encoded in size. And every emoji left the game surface
(eye, lightning, skull, play, pause…): utilities became SWAP/CAM text
chips, modal buttons use plain glyphs. Emojis render as full-color
sprites on iOS and fought the mono-tron aesthetic everywhere they
appeared. All element ids survived again, so the JS wiring layer paid
for itself a second time — two full control-layout rewrites, zero
game-logic edits.

## `e846569` — The phone becomes a controller

iPhone playtest drove this one. The briefing was clipped under the
status bar and couldn't scroll — the modal's `top: 34%` centering plus
tall card content overflowed both ends of the viewport. Fix: true
centering with `max-height: min(86vh, calc(100dvh - 28px))` and
`overflow-y: auto`. The unit that matters is **dvh**: iOS's `vh`
includes the collapsed toolbar area, so a `vh`-capped modal still
clips; `dvh` tracks the real visible viewport.

Controls rebuilt around how a phone is actually held — two thumbs at
the corners. Left thumb: a big steer-left button at the corner with
the drive rocker above it (hold ▲ forward, double-tap ▲ cruise,
▼ reverse and cruise-kill). Right thumb: steer-right plus the two
tinted triggers, ⚡ laser above ✦ shell. Utilities (⇄ ⊙) shrink to a
centered pair. The reflow is pure HTML/CSS — every button keeps its
id, so the game code didn't change a line: the wiring layer earning
its keep. The HUD collapsed with it: the nine-dot shells row is gone
(the turret rack was already the ammo counter — the HUD copy was
redundant the day the rack shipped; a small ✦n survives for PoV where
the turret is hidden), alerts print only when true, and teaching text
left the HUD for the briefing, which owns it.

TD spec gained the operator's rulings: aura imported, one health
pool, ally tanks mortal AND purchasable (the shop will sell UNITS
next to TOWERS), and the identity pair — top-down build view,
third-person fray — as the differentiation to build first.

## `a9891fc` — The full dozen: HokorobiTawaa's roster comes across

Six more enemy types, completing the import of HokorobiTawaa's twelve
in their difficulty order and palette (hue = class, brightness =
threat): Wave Ghost and Scout UFO extend the yellow agile tier, Green
Slime brings the **regenerator** mechanic (healOOC port — hp knits
back after 1.2 s unhit, tracked by `e.lastHitT`; the counter is
ramming, which ignores hp entirely), Wave Saturn is the first
unrammable — yellow body, blue ring baked into the mesh per the
source's dual-coding — and Rolling/Prime Mine form the epic tier,
reusing the seamine mesh exactly as HK does: the tint carries the
tier, not the silhouette. Prime at 6 hp + regen is the pre-boss wall.

The schedule grew to 12 intros and rounds now unlock two types each —
round 1 fields four rammable types, the full roster stands by round 5,
with the boss at wave 12. A 'heavy' spawn tier keeps epics sparse
(base/3). Stress-tested at ?wave=12: 215 hostiles simulated, and the
round gate held — round 1 correctly refused to introduce past its
four. Operator dials: shell recoil to 8 (the max — the dial shipped
three commits ago and immediately got pinned), waveSize to 5.

## `d941e9d` — The game is the front door, and icons that are the thing

The heart tab is now the landing page — a bare URL opens the game;
hash deep-links still reach every other tab. With that, the mobile
posture tightened: the ☰-hidden chrome already made the whole screen
play surface, and now iOS's double-tap zoom is dead site-wide
(`touch-action: manipulation` at the root — non-negotiable once the
CRUISE gesture became a double tap), pinch is blocked via Safari's
`gesturestart`, and overscroll/tap-highlight are off.

The briefing's emoji icons are gone, replaced by the objects
themselves: `spriteShot()` builds the real half-dotted thing — heart
cloud, neon tank, bullet triad, each of the six enemies, the portal
torus, the reward orbs — renders one frame through the announce-card
sprite rig, and snapshots it to a data URL (`preserveDrawingBuffer`
turned on for `toDataURL`). Cached per key: every icon costs one
render per session, and the cards carry images, not live contexts.
The pattern to keep: when a UI needs to show a game object, render
the game object — hand-drawn stand-ins drift, snapshots can't.

Housekeeping with teeth: the ammo *sphere* died (redundant with the
bullet triad — two shapes meaning the same thing taught nothing), the
health sphere went green (color = meaning), and portals got denser
(560 dots) with a two-frequency shimmer — slow per-dot wave times fast
glitter — so a gate reads as continuously alive.

## `495a540` — Portals, glossaries, and walls that thud

The spawn points became what they always were narratively: **portals**.
A new `torusPts` generator in creatures.js (braille-lab's half-dotted
static torus — golden-angle tube winding, every 12th dot hi) feeds
`makePortalCloud`: an upright dotted gate, ring in local X-Y so
aligning +Y to the surface normal stands it up, twinkling in its
enemy's tint. Damage now reads in *light*: `setDim` scales the twinkle
brightness, so each shell visibly dims the gate before the third one
kills it — dying portals fade. Numerically checked in Node (unit
radius, real hole, sparkle layer) rather than screenshot-hunted.

The briefing grew into a real reference: every element is its own card
(tinted icon, name, one line) and two clickable glossaries branch off —
hostiles (generated from `INTROS` + `ENEMY_SPEC`, so copy can't drift
from data: role, hp, arrival wave, ram verdict) and friendlies &
pickups, which finally documents the four reward spheres (ammo +3,
power +8% permanent, health +1, regen carry-home +4). One delegation
handler drives all modal navigation; the sim stays frozen throughout.

Small but felt: mostly-head-on wall hits now fire the same suspension
bump as running over fodder — gated on the into-wall velocity fraction
and the bump timer, so grinding along a wall at a shallow angle doesn't
re-trigger the thud sixty times a second.

## `fc894a3` — The Euler stomp, solid allies, and recoil that fires

Best bug of the day: the bullet triads "rotating into the ground" were
an **Euler stomp**. The pickup group is aligned to its cell's surface
normal via `quaternion.setFromUnitVectors` — and then the idle tick
wrote `rotation.y = t`. In three.js, `rotation` and `quaternion` are
two views of ONE rotation; assigning either replaces the whole
orientation. So every triad actually spun about *world* Y, which looks
right at the pole and tilts shells into the ground everywhere else.
Fix: compose — hold the base alignment quaternion and multiply a
local-Y spin onto it per frame. Sibling of the lookAt-convention trap
already in this log: three.js orientation has more than one API, and
mixing them silently discards work.

Wall overlap at angled approach was margin arithmetic again: irregular
quads put some wall *faces* ~0.7·cellSide from their centers, so the
0.95 margin (up from 0.8, two convergence passes for corners) is what
actually clears the hull. Ally tanks became solid — hard block in
`freeBlocked` plus a softer cushion push, so an ally driving into YOU
separates instead of interpenetrating. And recoil was rebuilt on
operator feedback: whole-body translation read as sliding, not firing.
Now the **turret** takes the kick — slams back with a 70 Hz shudder —
while the hull rocks nose-up and barely shifts. The pitch applies
*after* the lookAt quaternion (rotateX on top of the derived frame),
so it composes with the same-source facing rather than fighting it.
`?recoil=1` freezes a mid-kick pose for screenshots.

## `db390f4` — Recoil as a dial, forward as a choice

Two control-feel changes. Shell recoil became a parameter instead of a
constant: `params.recoil` (GUI slider 0–8, default 3) scales the hull
jolt and camera kick together, and the recoil window widened to
0.35 s. The lesson folded in: when the operator says "more, but
tweakable", ship the dial, not another guess — the default is the
opinion, the slider is the escape hatch.

Manual driving lost its auto-roll. The always-rolls-forward manual was
a mobile-ergonomics bet that proved too aggressive in play — the tank
committed you to motion the moment you touched a steering key. Forward
is now player-triggered: hold W to drive, and a quick **double-tap**
of the forward control (W or ▲) toggles CRUISE — self-rolling until
S/▼ kills it, with W boosting on top. One wrinkle worth recording:
cruise pins the manual-mode clock, otherwise the idle auto-wander
would reclaim the tank three seconds into a hands-off cruise and the
two "auto forward" systems would fight over the throttle. The idle
wanderer itself is unchanged — it remains the tab's ambient mode, with
its own HUD line and `auto resume` slider.

## `197b4a2` — The game gets a shape: briefing, rounds, one win condition

Structure day. The heart tab had mechanics but no arc — now it has
both ends. At the front, a **briefing modal**: every element labeled in
its own color (heart, tank and its controls, allies, triads, fodder vs
spiked reds, spawn points) with the single win condition in bold. The
sim stays frozen until ▶ begin; debug hooks skip the briefing because
headless verification needs a live sim, not a modal. At the back,
**rounds**: round r plays a 100+50r-point board and fields only 2+r
threat types — round 1 is 150 points and pure rammable fodder, fast
and winnable in minutes; corona, barbed, and the knot boss join in
rounds 2, 3, 4 as the sectors grow. Clearing every spawn point offers
the next round on a fresh seed; losing retries the current one. And
the win condition became ONE sentence: destroy every spawn point. The
maze-legacy "found the heart" victory — which ended the battle by
accidentally wandering home — is deleted; the pole is home turf.

The cannon also gained consequence: firing kicks the hull back along
the heading (camera follows) and heats a collar around the barrel's
middle red-hot — 3 s to cool, no second shell until cold. Same
diegetic-gauge pattern as the shell rack and the laser tubes: the
state of your weapons is readable off the tank itself, the HUD only
echoes it. Ram bump strengthened to match (deeper dip, 65% pace loss).

## `248c442` — Pause, a smaller first stage, and the clipping arithmetic

The tank-in-the-wall bug fell to arithmetic, not screenshots. The hull
reaches ~0.5·cellSide from the position. Manual collision blocks at
0.62·cellSide from a wall's *center* — but the wall's face sits at
~0.5, so the guaranteed face clearance was ~0.12·cellSide. The auto
glide never had a margin at all, and corner-diagonal wall cells are
invisible to `graph.adj` (full-edge adjacency only). Conclusion: up to
~0.4·cellSide of visual penetration wasn't a glitch, it was guaranteed
by the numbers. The fix is a soft **wall cushion**: each frame the
player position gets a tangent-plane push out of a 0.8·cellSide band
around blocked centers — diagonals collected by walking the open
neighbours' own adjacency — applied in both modes, *after* travelDir
is derived so the push moves the body but never the aim. Positions are
recomputed from the chord every frame in auto mode, so the cushion
can't accumulate drift; in manual it converges instead of jittering.

Also: ESC pauses (sim fully frozen, both views keep presenting, and
`lastFrame` keeps updating so resume has no dt spike — clamping alone
would still lurch), and the first stage shrank 4000→800 sample points:
~2800 open cells, 61 hops pole-to-spawn, a board you can actually
learn, hunt, and win.

## `275731f` — Lasers earn a trigger, and the early game gets heavier

The mini-lasers looked free because they were free — always on, no
cost, no decision. Now they're a held trigger (Shift, or ⚡ on the pad)
with an overheat: 2.4 s of continuous fire locks the guns until fully
cold (~1.7 s), and there's no feathering the cap — heat is a commitment,
not a rhythm to cheese. The gauge is diegetic in the same spirit as the
turret shell rack: the gun tubes themselves lerp cyan→red with heat
(`lerpColors` on the shared tube material; both guns follow for free).
Bolts got the look pass too — the core shrank to a sliver and gained a
wider additive-blended halo child, which over a dark board reads as
glow without vendoring a bloom chain. The trigger key deliberately does
NOT claim manual control: Shift is a fire button like Space, not a
steering input, so lasering while auto-wandering stays possible.

Balance pass from playtest: heavier early waves (waveSize 2→3), longer
breath between them (18→26 s), and a richer ammo field to pay for it
(triads 10→14, respawn 8→6 s). `?laser=1` holds the trigger for
headless screenshots.

## `dabbb84` — The tank gets an identity: neon lines, a visible magazine, lasers

Three reads on one unit. **Look**: thin white/blue neon edge lines on
the slabs — `EdgesGeometry` line segments added as *children of the
meshes they outline*, so they inherit every part transform for free
(turret lines sweep with the turret; no per-frame sync code). This
exposed a latent test bug: the roster's world-radius check only applied
`matrixWorld` to meshes and points, so line children read untransformed
local coords and "escaped" the unit sphere — the check now transforms
`isLine` too. **Diegetic ammo**: the 3×3 dot rack on the turret roof IS
the shell counter — `updateHud` tints index `< ammo` neon white, the
rest faded grey. Allies never dim (infinite ammo — the rack telling the
truth is the whole point of diegetic UI). **Secondary weapon**: twin
toed-in mini-guns fire weak infinite laser bursts, alternating at ~7/s.
Bolt origin and direction come from the gun groups' world transforms
(the toe-in convergence falls out for free — same-source rule, third
use). The lasers are deliberately toothless where it matters: 0.4
damage, no wall carving, no spawn-point damage, and no on-hit
reactions, because a constant graze would otherwise keep barbed/knot
permanently accelerated. Shells remain the decision; lasers chew fodder
while you drive. Bolts share one geometry+material — at 7 spawns/s,
per-bolt allocation and dispose would thrash for nothing.

## `843e79e` — Announce sprites, the weight of a kill, and a focus bug

The announce card grew its missing centerpiece: a live spinning model of
the introduced enemy, rendered by one persistent 96px alpha-backed
renderer (WebGL contexts are scarce and leak on loss — build one up
front, never per-announcement; the canvas just gets re-inserted after
each `innerHTML` wipe). The card also states the load-bearing fact
outright — green `▼ RAMMABLE — run it over` vs red `✖ DO NOT RAM —
shells only`, generated from `ENEMY_SPEC` so copy can't drift from
mechanics. Running over fodder now *feels* like it: a tinted dot-splat
flattened against the surface (`makeDotBurst`, the Points counterpart
of `makeDebris`, which bakes triangles clouds don't have) and a 0.35 s
suspension bump — pace −50%, camera eye sinks quadratically. The bump
is countdown-seconds rather than a timestamp because the tab runs two
clocks (render `t`, sim `simTime`) and a countdown is valid under both.

The bug of the day: "the settings panel opens by itself, maybe when I
kill something." Actual cause, nothing to do with kills — lil-gui's
title bar is a `<button>`, buttons keep focus after a click, and
browsers re-activate the focused button on Space. Space is the fire
key. Every fix candidate that started from "what does killing an enemy
do?" was chasing a coincidence. Game keys now blur any focused button
before handling (inputs excepted — seed-typing keeps focus). When a UI
element acts "by itself" on a timing that correlates with gameplay,
check what has keyboard focus before auditing the game logic.

## `3870d3d` — The heart learns HokorobiTawaa's escalation grammar

The heart tab's gameplay reshaped around three ideas. **Introductions**:
enemies arrive one type per wave, each announce (`#h-wave` banner, tinted
per enemy) creating that type's spawn point far from the pole — the loop
is identify → hunt the source → destroy it. Schedule: phage, amoeba,
jellyfish (fodder), then the borrowed HokorobiTawaa tier — corona
(armored ×2, slows itself when shot), barbed (×3, *accelerates* when
shot), knot boss (×5, accelerates, 3 heart damage). The on-hit reaction
is one `behMult`/`behUntil` pair per enemy; erratic pace is a sine over
`phase`, so everything stays deterministic. Victory now demands all
types introduced first — early spawn kills just buy quiet. **Ramming**:
`ENEMY_SPEC.rammable` splits the roster; fodder dies on player/ally
contact for free, the dangerous tier survives and bites back on a 1.2 s
per-enemy cooldown (without the cooldown, overlap was a blender).
**Breaching**: a player shell that hits a BLOCKED cell carves it —
stand-in wall block fed to `makeDebris` for the tank-style burst, then
`bfsDist` re-lay and a full `buildGeometry()`; ~single-digit ms at
default density, fine per shot. Deliberate asymmetry: ally shots don't
carve (infinite ammo would strip-mine the map), and the re-laid distance
field means enemies exploit your shortcuts too.

Support: ammo pickups are now triads of `makeBulletCloud` (+3 shells) —
the pickup depicts its payload; minimap self-marker became a pulsing
arrowhead and found spawn points pulse in their tint, both sized against
the *sphere* (cell-relative sizes vanish on dense boards — the map
always frames the whole ball). New headless hooks: `?wave=N` force-runs
wave beats, `?found=1` reveals beacons, `?blast=N` exercises the carve
path. New mesh units keep the transform-tick crowd path; roster
invariants auto-cover them.

## `6db7bae` — Mobile chrome, wall margins, and a heart with moods

Three fixes with one lesson each. **Mobile**: game chrome hides behind
a ☰ on touch devices and the minimap moves top-right — thumbs own the
bottom corners. The debugging story is the entry's real content:
headless Chrome clamps windows to ~500px and CROPS screenshots to the
requested size, so a perfectly-positioned minimap looked clipped for a
whole cycle. When layout misbehaves only in headless, log
`innerWidth` from inside the page before touching CSS. **Collision**:
point-in-open-cell was never enough — the unit has a body. Free
movement now rejects positions within a margin of blocked-cell centers
and slides along walls by stripping the into-wall velocity component;
solid units (enemy tanks, spawn structures) use the same overridable
blocker hook. Creatures stay passable on purpose: their contact IS the
damage. **The heart**: the Braille implicit-surface heart (ray-marched
against `heartF` along a fib lattice) replaces the sprite in all four
tabs, cycling twinkle → breathe → jelly, flaring orange/red under Wave
when hit. State machine in the dot cloud's tick; `hit()` timestamps
against the last ticked time so the flare needs no external clock.

## `5d2eb5a` — The Heart becomes tower defense (and the walls become cover)

Terrain flipped inside-out: instead of carving corridors from solid,
the field opens everything and re-blocks ~20% as random-walk clumps —
the same tags, the same collision oracle, the opposite reading. Walls
are now COVER, and black wall-tops make their silhouettes the terrain
language. Enemies became creature waves from three destructible spawn
points (one per Braille species, 3 hits each), seeking the Heart by
walking the distance field downhill with a 15% wobble so streams braid
instead of queueing. Allies got infinite ammo and a 1.4s fire loop —
the player's job shifts from gunner to ECONOMY: range out for pickups,
carry regen home, and decide when to push a spawn point. Compute note
for the skeptical: a wave of 12 clouds ≈ 7k CPU-reposed points/frame —
fine; the cap to watch is ~40 concurrent creatures before the
mesh-conversion (or shader-pose) lever gets pulled.

## `dfa08b6` — The Heart: possession, return fire, and carried rewards

Sixth tab. Three mechanics worth noting. **Commandeering is a swap, not
a teleport**: the player possesses the nearest ally by exchanging full
kinematic state (position, cell, glide segment, heading), and the
abandoned body rejoins the patrol — so the ally count is conserved and
death becomes a command-transfer rather than an end (your tank dies →
command jumps to the nearest ally, defeat only when none remain).
**Enemies acquire targets symmetrically** — nearest of player, allies,
or the Heart itself within range — which makes the Heart's ♥10 a real
clock and turns ally positioning into the defense. **The regen reward
must be carried**: picking it up sets a flag, healing happens only
within 2 hops of the pole, so the risk/reward loop (rewards spawn at
≥55% of max distance) has a return leg. Also: the win/lose modals
across all tabs became CRT hologram cards (scanlines, sweep, flicker —
the HokorobiTawaa announce recipe) with a clickable regenerate.

## `98ca514` — Tidying pass: bullet, auto-forward, and an honest state of the code

The Braille Bullet (case, ogive, driving band) replaces the sphere
shell — oriented and rifled purely by object transform, zero per-point
work. Manual mode now always rolls forward (S reverses, W boosts): on
a phone, throttle was the finger we didn't have.

**Practices that have earned their keep** (each paid for by a recorded
mistake): derive render-coupled values FROM render transforms (camera
facing, turret aim — twice bitten by sign conventions); make invariants
Node-testable and screenshots deterministic via URL hooks (`?tick`,
`?walk`, `?look`, `?spawn`); fix discontinuities at the source signal
(smoothDir), not per consumer; make "who is in control" binary and
visible; extend data schemas (looks, units) instead of forking code;
when batch-patching sibling files, anchor on code lines — comments
drift first — and let asserts abort atomically.

**The named debt:** maze/organic/battle are ~900-line siblings from
cp+sed lineage. Two patch-script aborts came from their drift. The
extraction (a shared board-core module parameterized by game rules) is
understood but deliberately deferred — the tabs are still diverging,
and extracting a moving target locks in the wrong seams. Extract when
a fourth board tab appears or when the divergence rate drops.

**Roads not yet taken**, in rough order of leverage: the corner-state
dual layer (the actual Townscaper payoff — state on corners, ~6 tile
families, the grid is ready for it); enemies that shoot back + a lose
condition; InstancedMesh crowds; waveJelly as a vertex shader (dot-
cloud swarms); bloom for tron; cube/torus surfaces (the four-role
split makes movement portable to any of them); biolume (gameplay-
coupled zonal lighting); deliberate defect placement.

## `0f7dc78` — Free movement, and what the grid is actually for

The big one is the movement rework. The question was how to separate
Stålberg world generation from movement. The answer that emerged: the
grid plays four roles that were conflated — world-geometry generator,
collision oracle, semantic map (what's on this cell), and AI nav-graph
— and only KINEMATICS needed to leave. In manual mode the position is
now free on the sphere: W drives along your heading at any angle, the
grid answers exactly one question per frame ("which cell is under this
position, and is it open?") via a voxel-hash nearest-cell index, and
cell semantics (visited trail, orb absorption, heart win) key off that
answer. Auto-wander still routes over the graph — it's a navigator, and
navigators SHOULD think in cells. The handoff back is seamless via a
virtualStart glide origin: auto's first segment interpolates from your
actual free position, not a snapped cell center. Also in this commit:
orbs became Braille dotted spheres under five treatments (spin /
breathe / twinkle / wave / scatter — breathe is transform-only and
free; the others re-pose ~170 points, negligible at orb counts), and
destroyed tanks scatter their own polygons — world-space triangle soup,
per-triangle velocities, 1.15s fade. A coming-apart, not an explosion.

## `e066613` — Battle: the sweeping turret becomes the game

Fifth tab. The design seed: the tank's idle animation — a turret
sweeping left to right — is promoted from decoration to mechanic. You
don't aim; you TIME. Firing launches a shell along the turret's current
world heading, computed by taking the turret group's world quaternion,
transforming +Z through it, and flattening into the tangent plane — the
render transform IS the aim, so the visual sweep and the ballistic
truth cannot disagree (a lesson applied from the lookAt bug: derive
from the same source, never re-derive with your own signs). Three
shells to start; orbs switch from food to ammo (+1, cap 9). Enemy
tanks in per-look hostile tints wander the cell graph at 0.45 cells/s
with desynced sweeps; shells ride the surface, die on walls via a
nearest-cell lookup, and clearing the sector wins. AI is deliberately
inert — wander-only — to make the timing mechanic testable in
isolation before enemies learn to shoot back.

## `05f1891` — The unit roster, and dots vs polygons

`src/units.js`: the three dot-cloud creatures plus two new low-poly mesh
units (tank, drone), a spawn dropdown on the maze tab, and any unit as
the organic tab's main creature. The tank answered a design question:
for a battle game with hundreds of units, which construction wins —
half-dotted or polygons? The honest answer is that the axis isn't dots
vs polys, it's *where the animation runs*. Our clouds re-pose ~700
points in JS every frame per instance — charming at 1 unit, 210k
point transforms/frame at 300. Low-poly meshes are static geometry the
GPU transforms; animation is a handful of transform updates (turret
rotation, hover bob), and InstancedMesh collapses hundreds of units into
one draw call per type. So: mesh units for crowds, dot-clouds reserved
for hero units — or, later, waveJelly moved into a vertex shader, which
would let clouds scale too. The roster encodes the split as
`kind: 'cloud' | 'mesh'` so both coexist and the choice is per-unit.

## `f9fddfd` — Four visual identities

`src/looks.js` centralizes every color decision — backgrounds, light
rig, floor/wall vertex palettes, edge treatment, actor tints — and both
board tabs consume it; switching rebakes geometry in place with game
state untouched. The interesting ones: *battlezone* reproduces the
vector-monitor trick where near-black faces exist purely as hidden-line
occluders behind phosphor-green edges, and *tron* fakes neon without a
bloom pass by putting additive-blended pure-cyan lines over a near-black
world — at these edge densities additive overdraw reads as glow.
*clean* drops edge lines entirely and compensates with 1.8× per-cell
tone jitter so faces still separate. `?look=` deep-links a look.

## `a1aae5d` — 170× generation: incremental merge + voxel-hash sampling

Benchmarking showed per-frame costs were a non-issue at every size — the
wall was one-time generation, 92% of it in `mergeToQuads` rebuilding its
full edge-count map and rescanning the triangle list per accepted merge
(≈O(n²)). It now builds an edge→incident-triangles map once and keeps a
candidate pool with O(1) swap-remove uniform random picks; a merge
retires exactly the five edges of the dead triangle pair. Same tabu
semantics, ≈O(n) total. Sampling's O(n²k) nearest-neighbor scan became a
3D voxel hash over [-1,1]³ — points on a sphere need no cube-map seam
logic, and an expanding-shell search with an exact stopping bound keeps
it exact and deterministic. Numbers (M4): n=8000 went 33.4s → 197ms;
64,000 samples → 285k quads in 2.9s, near-linear. Sliders raised to
8,000 points (36k quads, ~1.4s all-in desktop). The new ceiling is the
maze tabs' 80-iteration pre-relax — O(quads) per iteration — and, past
~70k quads on the grid tab, per-frame normal recomputation. One honest
cost: the merge consumes the rng stream differently, so a given seed
produces a different (equally valid) board than pre-fix builds.

## `56d6d58` — Building Blocks: the by-concept companion

`HOW-IT-WORKS.md`, rendered in-app as the fourth tab (`/#how`): the
Stålberg tricks, the sphere port's substitutions and deletions, the
dungeon method's portability property, the motion arc, and what was
actually expensive. Same markdown converter as this overlay (now
exported from `devlog.js`), same `.mdview` styles, full-page article at
72ch. The devlog stays chronological; that document is organized by
concept — read it first if you're new here.

## `36a4b11` — The dev log, readable in-app

Clicking the cache-bust badge (bottom-right) now opens this document in
an overlay. `src/devlog.js` fetches `DEVLOG.md` with `cache: no-store`
and renders it with a ~30-line markdown converter that handles exactly
the constructs used here (headings, rules, paragraphs, code/bold/italic/
links) — HTML-escaped before any tags are introduced. The badge script
is toolkit-owned and reinstall-overwritten, so the click hook attaches
from outside in the capture phase and parks the original copy-token
action with `stopPropagation`. `?devlog=1` deep-links straight to it.

## `8815ba0` — Manual override: WASD claims control, auto resumes on idle

Any WASD/arrow press now switches auto-wander **off** — the walker stands
still unless driven. Release everything and the wanderer's own will resumes
after `auto resume (s)` seconds (default 3). This replaced the
weight-blending model from `acae9b5` the same day.

**Method.** A `manualClock` accumulates seconds since the last held key;
`manualActive()` compares it to the threshold. In manual mode the pace term
is `keys.fast || keys.slow ? speed × 1.5 : 0`, a fresh S press swaps the
current glide segment (turn-around-then-drive), and the smoothed view
direction chases the **steering heading** instead of the travel direction —
so turning in place looks around at a standstill. The design lesson worth
keeping: when the question is *who is in control*, a binary visible mode
(HUD says `MANUAL` / `auto-wander`) beats interpolated authority weights.
Users can feel a mode; they can't feel a coefficient.

## `acae9b5` — Held-key steering, no-jump camera, world-space motion

Three changes in one pass: keys became held-not-tapped (A/D rotate the
steering intent at 2.6 rad/s, with mid-glide U-turns), every visual consumer
switched from raw direction to a smoothed one, and motion was decoupled from
the grid.

**No-jump camera.** The root cause of every camera snap was that
`travelDir` is discontinuous — it changes instantly at each cell arrival and
flips 180° on a reversal. Rather than masking this with heavier camera lerp
(which adds lag everywhere), a `smoothDir` chases `travelDir` at a bounded
5 rad/s: project both into the tangent plane, take the signed angle via
`atan2(dot(cross(s,g),n), dot(s,g))`, clamp the step, rotate. Cameras, the
walker mesh, and the minimap up-vector all read `smoothDir`; none ever see a
discontinuity. Principle: fix the source signal, not each consumer.

**U-turn without teleporting.** When the heading swings behind the motion,
swap `cur↔next` and set `prog = 1−prog`. Same chord, opposite direction —
the position function is continuous through the swap, so reversing produces
zero visual artifact; only the direction changes, and that's smoothed.

**World-space motion** (see also the grid/motion separation note below):
progress advances as `(speed × cellSide × dt) / segLen`, where `segLen` is
the chord length of the current cell-to-cell segment, and leftover distance
carries across arrivals (`carry = (prog−1) × segLen`, next segment starts at
`carry / newSegLen`). Before this, "cells per second" made the walker
visibly lurch — fast across big cells, crawling across small ones. The grid
offers the space; the motion merely traverses it.

## `5e661dd` — Orb respawn, per-creature locomotion, phagocytosis

The maze regrows one orb every N seconds (timer lives inside the motion
step, so `?tick=` simulations regrow food too). Each creature gets a
locomotion profile — `speed(t)` and `hover(t)` — layered over the wander
pace: the amoeba crawls in surge/pause cycles, the phage creeps with rare
`sin¹⁰` darts, the jellyfish floats and thrusts **on the same `3t`
oscillator as the Jelly squash treatment**, so propulsion visibly coincides
with the bell squeeze.

**Phagocytosis.** `waveJelly` gained `reachDir`/`reachAmt`: after the
ripple/squash/spin, any point whose direction aligns with the target gets
pushed radially outward by `1 + amt × 1.15 × alignment⁵` (the 5th power
makes it a pseudopod, not a uniform swell; a small secondary ripple keeps it
reading as membrane). The orb's world direction is transformed into the
creature's local frame each frame via the inverse mesh quaternion.
Absorption switched from cell-arrival to membrane-contact distance, so the
engulf completes the moment the reaching membrane touches.

**Verification note:** instead of screenshot-hunting for a reach moment, the
seeded orb layout was replicated in Node to compute which `?walk=N` value
parks the amoeba beside an orb (N=14 on the default seed). Deterministic
beats lucky.

## `9426f84` — Organic tab: Braille dot-cloud creatures, absorb-and-grow

Third tab, a copy of the maze where the walker is a point-cloud organism
ported verbatim from the Braille *fun-shapes* generators (amoeba /
bacteriophage / jellyfish, ~500–700 points each, unit-normalized, highlight
dots tinted warm). Twelve amber orbs sit on seeded-random open cells;
absorbing one grows the creature ×1.13 and the chase camera pulls back
proportionally.

**Method.** The creatures render as `THREE.Points` with per-vertex color.
The Wave×Jelly treatment — Braille's radial ripple
`d = 1 + 0.14·sin(3θ + 3t − 2y)` composed with the volume-preserving
squash-stretch `sy = 1 + 0.18·sin 3t, sx = 1/√sy`, plus a slow spin —
re-poses the cloud **on the CPU every frame in local space**; the object
transform carries it to the sphere surface. At 700 points this is trivial
work, and it keeps the treatment code line-for-line identical to the Braille
reference instead of a shader translation. A faithful-port detail: the
jellyfish has no highlight dots in the source, so it has none here — the
test that asserted otherwise was fixed, not the shape.

## `58e197e` — The autonomous wanderer

The walker glides continuously and picks its own exits; the player steers a
bias, not a command. Defaults changed to third person over 0.03 walls.

**Method.** At each cell arrival, every open exit is scored:
`2.2 × dot(steeringHeading, exitDir)` + `1.1` if unvisited (curiosity) −
`2.4` for backtracking + seeded noise `±0.8`. Weighted-max-with-noise was
chosen over softmax sampling — same feel, one fewer tuning knob. The
steering intent decays 35% toward the actual travel direction per arrival so
stale input fades. Position interpolates along the chord between cell
centers and is re-normalized onto the sphere each frame.

**Headless testing gotcha:** Chrome's `--virtual-time-budget` does **not**
advance `performance.now()`, so dt-driven motion barely moves during a
screenshot run. `?tick=N` synchronously simulates N seconds of wandering
before the first frame — the only way this feature is screenshot-verifiable.

## `efd8c5b` — Mobile pass + third-person camera

Safe-area insets, `touch-action: manipulation` (kills the 300ms double-tap
delay), 44pt+ hit targets on coarse pointers, PWA manifest + iOS meta tags
+ icons (drawn as SVG, rasterized through headless Chrome since libcairo was
absent). The **service worker is deliberately deferred**: a SW sits between
the browser and the `?v=` cache-busting layer, and a stale SW silently
serves stale modules — if added later it must key cache names off the cb
token. Third person arrived here as a V-key/⊙ toggle: eye at
`wallHeight×2.6 + cellSide×1.1` above and 1.8 cells behind, sharing the
same goal-quaternion path as PoV so the lookAt fix covers both.

## `71a434a` — Walker scaled to wall height

At low walls the PoV camera (eye at `0.62 × wallHeight`) sank beneath the
cell-sized walker cone, which then filled the frame. The walker now scales
to `min(cellSide, wallHeight × 0.75)` — tip always below the eye line — and
below knee-height walls it hides from the first-person pass entirely (the
minimap keeps it). Mismatched scaling references are a classic: the cone was
sized by one length scale (cell width) while the camera used another (wall
height).

## `15ec66e` — The camera was mounted backwards

W appeared to walk backward. The movement was correct; the camera was
rotated 180°.

**Root cause.** three.js `lookAt` is convention-split: a plain `Object3D`
faces **+Z** toward the target, but anything with `isCamera` renders down
**−Z** and gets the opposite rotation. The camera's goal quaternion was
computed on a scratch `Object3D` and copied onto the real camera — exactly
180° wrong, permanently. Fix: derive the goal from a throwaway
`PerspectiveCamera`. Corollary recorded in the decision log: every earlier
"framing feels off" iteration had been tuning against a mirrored view.
When a 3D view "faces the wrong way," check the lookAt convention before
touching framing numbers.

## `e023958` — Tank controls + relative paths for Pages

A/D became rotate-in-place (the earlier exit-picking scheme moved the player
sideways and snapped the view every press). All asset references went
relative (`./…`) because GitHub Pages serves project sites under a sub-path
where absolute `/…` URLs 404. The cache-badge script already derives its
path from the favicon link, so it needed no change.

## `e7c70ca` — Maze tab: hallways found, not drawn

The HokorobiTawaa dungeon method transplanted onto the sphere: the quads are
the cell graph (adjacency only across a full shared edge — corner contact
doesn't count), every cell defaults to blocked/elevated, and corridors fall
out of BFS.

**Method.** Room seeds are farthest-point-sampled over the graph (repeated
BFS, take the most distant cell). Each new seed digs a shortest-path
corridor to the nearest already-carved cell; each seed then inflates into a
room (cells within `roomRadius` hops). Extra corridors run `bfsPath` with
the existing hallway interiors in an avoid set, forcing genuinely distinct
routes — cycles, so it's a maze, not a tree. Spawn and heart are the
double-BFS diameter endpoints of the *open* subgraph. Everything is hops on
the graph; no world-space distance is ever measured, which is exactly why
the method survives the transfer from a 2D Voronoi board to a spherical
quad mesh unchanged. Node invariants (`test/maze.mjs`): open subgraph fully
connected, deterministic per seed, spawn→heart 56–69 hops at n=300.

The trench camera cost two dead framings: eye level with the wall tops
reads as an empty plateau on a small sphere (the horizon is ~0.45 rad away —
the 2D "trench height" intuition doesn't transfer), and untextured walls at
close range read as void until an edge-line overlay (cell outlines, wall
rims, corner verticals) restored depth.

## `5fb496e` — The grid itself: Stålberg on a sphere

The founding PoC: Oskar Stålberg's organic quad grid (triangulate → merge
triangle pairs into quads → subdivide everything into quads → relax toward
squareness) ported from the plane to the surface of a sphere, from the
working 2D implementation in `oskar-procedure`.

**Spherical Delaunay = convex hull.** For points *on* a sphere every point
is extreme, and the 3D convex hull's faces are exactly the Delaunay
triangulation (empty-circumcircle ↔ hull face plane). three.js's quickhull
provides it, with globally consistent outward winding for free — the 2D
version had to normalize winding into existence. Blue-noise sampling uses
Mitchell best-candidate (Bridson's grid has no clean S² analogue).

**The topology code didn't change.** Merge and subdivision bookkeeping is
byte-for-byte the 2D algorithm; the only sphere-aware pieces are a
tangent-plane projection (quad legality and relaxation both operate on the
2D shadow of each quad in the tangent plane at its centroid), on-sphere
reprojection of new midpoints/centroids, and Newell-normal winding checks.
One 2D-ism had to be *deleted* rather than ported: the sliver-triangle
filter, because dropping faces on a closed surface tears holes — a bounded
patch can trim its boundary; a sphere has none.

**Relaxation with a constraint.** The 2D closed-form closest-square fit
runs per quad in its tangent plane; accumulated forces are applied in 3D
and every vertex is re-normalized to the sphere. This *defines* squareness
of a spherical quad: squareness of its tangent-plane shadow, subject to
staying on the surface. Converges 0.26 → 0.14 RMS error in 60 iterations.

**What the sphere forces.** A closed all-quad mesh cannot be valence-4
everywhere — Euler's formula demands `Σ(4 − valence) = 8`. About 21% of
vertices come out irregular (v3/v5/v6+), almost all in cancelling pairs
inherited from the construction; the net 8 is topological destiny. The
smoke test asserts watertightness, `V − E + F = 2`, and the defect law on
every seed.

---

## Cross-cutting notes

**Testing without a browser.** All grid, dungeon, and creature math lives
in DOM-free modules (`grid.js`, `dungeon.js`, `creatures.js`) tested by
plain Node scripts asserting invariants, not snapshots. The render layer is
verified with headless Chrome (software WebGL needs
`--use-angle=swiftshader --enable-unsafe-swiftshader`; `--disable-gpu`
kills context creation outright) plus the `?walk=` / `?tick=` / `?wall=` /
`?view=` / `?creature=` URL overrides that make any state screenshotable
deterministically.

**Cache busting.** Every asset and ES-module import carries a `?v=<token>`
bumped by `scripts/bust.sh`. Two hard-won rules: *never* token vendor
imports (ConvexHull imports `./three.module.js` bare — a tokened parallel
URL loads a second copy of three.js), and a stock fingerprinter that
rewrites HTML/CSS is not coverage when the app's real graph is ESM imports
— trace one URL of each asset class before trusting it.
