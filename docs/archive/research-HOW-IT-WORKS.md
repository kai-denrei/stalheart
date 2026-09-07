# Building Blocks

How this thing works, what we decided, and what it actually costs.
Companion to the [Dev Log](?devlog=1) (chronological); this one is by concept.

---

## The Stålberg idea

Oskar Stålberg (Townscaper, Bad North) solved a problem most procedural
systems dodge: handmade art dies on procedural grids. Voxel grids look
stiff. Voronoi and triangle meshes look organic but won't accept
rectangular art — nothing square maps onto them. His breakthrough is three
tricks stacked, and the order matters.

**Trick 1: every cell is a quad, but the connectivity is organic.** You
can't lay out irregular quads directly. He goes *through* triangles:
scatter points, triangulate, randomly merge adjacent triangle pairs into
quads where the result is convex-ish, then subdivide every remaining face
into quads (a triangle becomes 3, a quad becomes 4). That last step is the
load-bearing one — it guarantees an all-quad mesh *no matter how the random
merge went*. You get to be sloppy in the merge because subdivision forgives
everything. Then relaxation nudges each vertex toward the position that
makes its quads most square. The result reads as hand-drawn.

**Trick 2: state lives on corners, not cells.** Ask "is this cell land or
water" and tiling needs 2⁴ = 16 marching-squares cases (256 in 3D). Put
the state on the *corners* and pick each tile by its four corner values,
and symmetry collapses the count to ~6 families. Six meshes to author, not
hundreds. This is the trick that makes the art budget survivable.

**Trick 3: the art deforms to the grid, not the reverse.** Tiles are
authored in a unit cell and bilinearly stretched onto whatever irregular
quad they land in. The grid's irregularity is *hidden inside the art*
instead of fighting it. Variants and multi-cell specials kill repetition.

This repo implements trick 1 on a sphere, plus a game-shaped consumer of
the grid. Tricks 2 and 3 are the obvious next phase and everything is
shaped to receive them: state-on-quads is already how the dungeon works,
and corner-state is one index-map away.

## Taking it to a sphere

The port's central discovery: **the topology code doesn't care about the
plane.** Merge bookkeeping, subdivision with shared midpoints, the
watertightness guarantees — byte-for-byte the 2D algorithm. Geometry is the
only thing that changes, and it changes in exactly four places:

**Triangulation.** Planar Delaunay doesn't exist on S², but for points on
a sphere the 3D convex hull *is* the Delaunay triangulation — every point
is extreme, and the empty-circumcircle property maps to hull faces. We use
three.js's quickhull. Free bonus: the hull gives globally consistent
outward winding, which the 2D version had to normalize into existence.

**Sampling.** Bridson Poisson-disk needs a background grid; there's no
clean grid on a sphere. Mitchell best-candidate (draw k uniform candidates,
keep the farthest from the existing set) gives comparable blue noise with
zero spatial structure. It's O(n²k) and we simply don't care at n ≤ 2000.
Knowing when the asymptotically wrong algorithm is the right choice is a
skill; this is what it looks like.

**Relaxation.** "Squareness" of a spherical quad is undefined — the corners
aren't coplanar. We *define* it: project each quad onto the tangent plane
at its centroid, run the 2D closed-form closest-square fit on the shadow,
apply the forces in 3D, then re-normalize every vertex onto the sphere.
Constraint projection, the oldest trick in physics sims. It converges
(0.26 → 0.14 RMS in 60 iterations) and nobody had to derive spherical
trigonometry.

**One deletion, no substitute.** The 2D pipeline drops sliver triangles at
the boundary. A sphere has no boundary, and dropping a face on a closed
surface tears a hole. The filter is simply gone; slivers get relaxed
instead of culled. Porting isn't only translation — sometimes the correct
port of a feature is its absence.

**What the sphere forces on you.** Euler's formula makes `Σ(4 − valence)
= 8` mandatory for any closed quad mesh. You cannot have a regular grid on
a sphere; the only question is where the defects go. Our construction
scatters ~21% irregular vertices (mostly cancelling v3/v5 pairs from
triangle centroids and merge corners) — which is arguably *why* it looks
organic. The honest open question: that same irregularity is exactly where
trick-2 tile authoring will hurt, because multi-cell special pieces care
about valence even when corner-state doesn't. We deferred it knowingly.

## The dungeon: hallways are found, not drawn

Borrowed wholesale from our HokorobiTawaa method. The board is a graph —
two cells adjacent only if they share a *full edge* (corner contact would
create diagonal leaks through wall joints). Everything defaults to blocked.
Room seeds are farthest-point-sampled; each digs a BFS shortest-path
corridor to the nearest carved cell; extra corridors run BFS with prior
hallways in an avoid-set, which forces genuinely distinct routes and gives
you cycles — a maze, not a tree. Spawn and heart are the double-BFS
diameter endpoints of the open subgraph.

The insight worth stealing: **no world-space distance is ever measured.**
Everything is hops. That's the entire reason the method transplanted from a
flat Voronoi board to a spherical quad mesh without modification. Code that
only asks "which cells touch which" is portable across geometry it has
never heard of; code that measures positions is married to its coordinate
system.

## Motion, and who owns it

Three generations in one day, each correcting the last:

Discrete tank moves (snap per keypress) → a continuous wanderer with
blended steering authority → **a binary mode switch**: any WASD press kills
auto-wander, idle N seconds restores it. The blended version was
mathematically nicer and felt terrible. Users can feel a mode; they can't
feel a coefficient. If "who is in control" is ever the question, make the
answer discrete and print it on screen.

Two mechanisms under the hood do the actual work:

**smoothDir.** Raw travel direction is discontinuous — it snaps at every
cell arrival and flips 180° on reversal. Every visual consumer (cameras,
creature orientation, minimap up-vector) reads a rate-limited chase of it
instead (bounded 5 rad/s, signed-angle-around-normal). One smoothed source,
zero per-consumer masking. Fix discontinuities at the signal, not at each
subscriber — the alternative (heavier camera lerp) adds lag everywhere and
still jumps on big flips.

**Grid/motion separation.** Progress advances as world-distance over the
current segment's chord length, leftover distance carried across arrivals.
Cells-per-second made the walker lurch — fast over big cells, crawling over
small — because it let the grid's sampling density leak into kinematics.
The grid offers space; motion traverses it. This also quietly future-proofs
free movement (tangent-plane physics with the grid as collision only).

## The creatures

Dot-cloud organisms ported *verbatim* from our Braille fun-shapes
generators — amoeba, bacteriophage, jellyfish, ~500–700 points each. They
animate by re-computing every point on the CPU each frame: Wave (radial
ripple keyed to azimuth) composed with Jelly (volume-preserving
squash-stretch, `sy = 1+0.18·sin 3t`, `sx = 1/√sy`).

The deliberate anti-optimization: no vertex shader. 700 points is nothing,
and keeping the treatment as plain JS means it stays line-for-line
identical to the reference implementation and trivially composable — the
phagocytosis reach is one more multiplicative term (`1 + amt ×
alignment⁵`, direction transformed into the creature's local frame per
frame), not a shader rewrite. Micro-optimizing that loop would have cost
the feature that made it worth having.

One detail that carries the feel: the jellyfish's propulsion pulses on the
*same* `3t` oscillator as its squash treatment. Thrust coincides with the
bell squeeze, so the motion looks caused rather than coincidental.
Synchronizing animation and kinematics oscillators is cheap and reads as
life.

## What was actually expensive

Not the math. The conventions and the layers:

**The lookAt convention bug.** three.js `Object3D.lookAt` faces +Z at the
target; cameras render down −Z and get the opposite rotation. We computed
the camera's goal quaternion on a scratch Object3D — 180° wrong,
permanently. Cost: every camera-framing iteration before the fix was tuned
against a *mirrored view*, and the bug masqueraded as "W goes backward."
When a 3D view feels inverted, audit conventions before touching numbers.

**Cache layers wearing a trench coat.** Browser cache, CDN cache
(`max-age=600` on Pages), ES-module identity, and a fingerprinting tool
that covered HTML/CSS but not import specifiers. Two rules paid for in
debugging time: never version-token vendor imports (a tokened URL is a
*different module* — we loaded three.js twice), and coverage claims from
cache tooling are unverified until you trace one URL of each asset class.

**Headless verification.** Chrome's `--virtual-time-budget` fast-forwards
rAF but not `performance.now()`, so dt-driven motion is invisible to
screenshots. Software WebGL needs `--use-angle=swiftshader
--enable-unsafe-swiftshader`; `--disable-gpu` kills context creation. Our
answer was URL hooks (`?tick=N` simulates N seconds synchronously,
`?walk=N` teleports along the shortest path) — and once, instead of
screenshot-hunting for the amoeba near an orb, replicating the seeded orb
layout in Node to *compute* the right `?walk` value. Determinism beats
luck, and building it in costs a dozen lines.

**Relaxation never finishes.** It's an iterative global solve, O(quads)
per step, and "converged" is a judgment call. We run it live and let you
watch — which turned a cost into the grid tab's whole appeal. When a
computation is inherently iterative, consider shipping the iteration as
the experience.

## Decisions we'd defend, briefly

Port the working 2D code, don't rebuild from the paper — re-solving solved
problems is how projects stall. Vanilla ESM with vendored three.js, no
build step — the whole pipeline is inspectable with view-source, and cache
busting substitutes for a bundler's hashing. Node-testable math modules
with invariant tests (watertight, Euler = 2, defect law, determinism) and
zero DOM — the render layer is verified separately with screenshots.
Every scope cut recorded with its reason in a decision log, including the
ones that were wrong — half this document is transcribed from it.

## Tank combat (the break-time tab)

A 3D homage to Atari 2600 Combat. Everything that decides the game —
arena maps and their mirrored procedural cousin, tank kinematics,
one-shell-in-flight ballistics with mirror ricochet, the L1–L4 AI
ladder — lives in `tanks.js`, a DOM-free module with its own Node
suite. The AI emits the same `{left,right,forward,reverse,fire}`
input shape as the keyboard: four brains, one contract. The tab
(`tank-tab.js`) is a projector: it steps the core at a fixed 60Hz,
copies poses onto box-built meshes, and derives the chase and POV
cameras from the tank group's world transform. Beat your highest AI
level to unlock the next; `C` cycles top-down / third-person / POV.

## Planet combat (tank2)

The flat tank duel bent around a sphere. `tanks2.js` is a sibling core,
not a fork: same input contract, same events, same match flow — but
positions are unit vectors, headings tangent vectors, and every speed a
radian rate. Shells fly great circles at surface height, which quietly
changes the game: a shot needs no line of sight to land, so cover is
the planet itself. LOS is two questions — does the turret-height chord
clear the sphere, and is any wall cell on the arc. L4 exploits the
first answer: it dead-reckons your last-seen track and shells the ghost
from beyond the horizon. The planet is a ~400-cell relaxed Stålberg
mesh; walls are seeded cell clusters; the cellindex voxel hash answers
"which cell am I over" for tanks and shells alike.

## Tank3 (planet combat, Battle skin)

The same planet duel as Tank2 — identical `tanks2.js` core, manual aim,
great-circle shells, the L1–L4 AI ladder with the ghost gunner — wearing
the Battle tab's Tron dress. The tab swaps only the render: the world is
built from `LOOKS.tronColors` (additive neon-cyan edge wires, near-black
void, a seeded zonal colour field over the floors, black-topped neon
walls), the tanks are Battle's `buildUnit('tank')` meshes with their neon
edge outlines (barrel along +Z, turret locked forward because aim is
manual), shells are `makeBulletCloud` Braille dot-clouds, and a hit scatters
the struck tank into its own polygons via `makeDebris`. No core changes —
Tank3 is a skin over proven rules.

## TD tutorial + tower unlocks

New TD games open on a scripted tutorial (skippable once seen, or
`?tutorial=0`): it starts you a few hops from the heart with no shells,
spawns one phage portal and three fodder — "PROTECT THE HEART!" — and you
ram them; then three shell pickups appear to teach that the portal takes
three shots; then a second wave arrives and the BUILD button pulses with
"towers go on high ground, near the edge," the legal cells flashing so you
see where. It's failure-proof (the heart can't fall) and drives every
spawn itself (the normal wave clock is paused) until you place your first
tower, then hands off to normal play. Tower availability is a by-round
ladder (`towers.js` `unlockedTowerKeys`): normal+rapid at round 1, up to
the laser at round 5; the shop dims locked towers with the round they open.

## TD refinements: portal reach, build zoom, missiles

The tutorial's portal no longer sits on the heart — it spawns 20–30 hops
down the corridor, so the fodder march in and you drive out to meet them.
Build mode zooms: it opens closer (so cells are tappable), desktop keeps
wheel-zoom, and mobile gets two-finger pinch (the board owns the gesture in
build mode, so the page doesn't zoom) — the tap-to-place raycast stays
pixel-accurate at any zoom. And the shell pickups are now missiles: a triad
of the finned `missilePts` dot-cloud (ported from the Braille fun-shapes
lab), still +3 per pickup. Fired tower tracers keep the bullet shape.

## TD onboarding, calmer auto-drive, and a roaming build camera

The tutorial now opens with a choice — play it or skip straight to the
briefing — and you can bail any time from the × on the tutorial banner.
The tank's auto-driver waits longer before taking back the wheel (~10s
idle), and picking an Auto directive hands command over at once. The old
"TANK" mode is now "MANUAL": switching to it pops a card reminding you the
tank fights on its own until you grab the controls. And the build camera
is no longer bolted to the heart — flick to pan across the sphere (within
reach of home) and pinch to zoom, so you can mount towers anywhere.

## Deliberate waves + stargate gates

Progression now reads off one number — the wave. Wave N fields N enemy
types and unlocks N tower types (one new tower each wave, cheap → laser by
wave 8); the newest threat headlines each wave with a few older types mixed
in. A NEXT WAVE strip previews what's coming and counts it down, a NEW
TOWER card marks each unlock, and the HUD leads with the wave. Sectors still
grow the sphere when you clear every gate, but they no longer gate towers or
types — they're spatial now. And the gates are all one shape: the stargate,
a neutral source that pours out whatever the wave dictates.

## First impressions: a frozen opening, patience, and manual by default

The tutorial now opens on a held tableau — your tank just ahead of the heart,
two enemies in the lane, the laser pulsing, "SHOOT TO DEFEND THE HEART." Your
first shot unfreezes it into live combat, then shells and towers follow.
Guidance is transient now: brief toasts that fade on their own, no × to
dismiss and no modal to stop the game. Drive starts in MANUAL and stays there
— the tank is yours until you tap a directive to hand it to auto, and taking
the wheel always takes it back. And waves breathe: clear the field and a
"WAVE OVER" beat plays, then a countdown of anticipation before the next
wave — with a safety timer so a stalled field can't freeze the war.

## The bloom the neon was waiting for

The looks arc built additive, vertex-coloured edges and then stopped short of
the thing that makes them glow — a post-processing chain was judged too
expensive until a look earned it. It had. The four combat tabs (td, battle,
heart, tank3) now render through an EffectComposer: the scene, then UnrealBloom,
then an output pass that puts the colour back where it belongs. The bloom
runs at reduced resolution on phones, because the mip chain is the expensive
part, and each tab carries live sliders for strength, radius and threshold so
the look can be dialled in while you watch it. Compositing costs you the
renderer's own antialiasing, so the composer asks for MSAA back — on a board
made of glowing wireframe, that edge quality is the whole picture.

## Sound, and keeping it from becoming noise

Seventeen sounds, TD only for now. The interesting problem isn't playing
them — it's stopping them piling up.

A tower defense fires *a lot*. Eight tower kinds, several of each on the
board, all shooting at once, and a cleared wave is a dozen deaths inside
a second. Play every event naively and you get a smear. So the budget is
handled in four layers, cheapest first, and all four are pure functions
in `audiomix.js` with no `AudioContext` anywhere near them — which is
why they're Node-tested:

1. **Per-key min-interval.** A retrigger inside the window is dropped
   outright. Each window sits *below* that tower's tier-2 shot interval
   on purpose, so one upgraded tower is never gated — the window only
   bites when several towers of the same kind fire together, which is
   exactly the pile-up worth culling.
2. **Per-key voice caps.** Over the cap, the oldest copy of that sound is
   stolen. `admit()` only *names* the voice to steal; the caller ramps it
   down over ~30ms before stopping it, because a hard cut mid-waveform is
   an audible click.
3. **A global 24-voice ceiling**, a backstop independent of any one key —
   it bites when many *different* sounds are live at once.
4. **Distance attenuation**, `1/(1+d/k)`, measured from the *active
   camera's* world position rather than the player's. In bastion view the
   two are far apart, and what you hear should follow what you're looking
   through. It's plain gain, deliberately not a `PannerNode`: true 3D
   panning on a sphere you orbit is disorienting, and a panner per voice
   is real cost for a cue you already read visually.

The trims matter as much as the caps. Every sample is cut in
`scripts/audio-build.sh` to fit its tower's **tier-2** fire interval, not
its base rate — `effectiveStats` gives ×1.2 at tier 2 and another ×1.2
for the `single` attack family, so a fully upgraded rapid tower fires at
4.32/s. Solving overlap in the encode is cheaper and far more
predictable than fighting it at runtime.

Normalization is peak, never loudness or compression: peak is the only
one that leaves the transient intact, and the transient is what makes a
blast read as a blast. It runs in two passes, because MP3 *decoding*
reconstructs peaks above the encoded sample peak and Web Audio clips
those at the output device.

The engine bed is the one continuous sound. Its speed comes from the
actual per-frame position delta rather than from the drive inputs — one
call site then covers manual driving, auto navigation and the
`virtualStart` handoff between them, and it obeys the house rule about
deriving render-coupled values from the render state instead of
re-deriving them with a second set of conventions.

**Where to change things.** Live, by ear: the `sound` folder in the TD
panel (master + four buses + mute), which persists to `localStorage`.
Permanently: `src/audiomanifest.js`, where each sound carries its own
gain, voice cap, min-interval and pitch-jitter width. The levels that
shipped were derived from durations and fire rates, not heard, so expect
to move them.

## Making different things glow by different amounts

A bloom pass is a full-screen effect. It receives a finished image and
knows nothing about objects — which is why "make the enemies glow more
than the floor" is not a setting you can turn up. It's a decision about
how you *render*.

The cheap-looking option is to dim the floor. It doesn't work: glow and
brightness would move together, so calming the board's halo would also
grey out its lines, and the board is meant to read as bright cyan wire.

So the scene is rendered **twice**. Once weighted — every object's colour
scaled by its group's weight — which is what the bloom pass sees. Once
normally, which is what you see. Then the pure bloom from the first is
added to the second:

```
output = scene + bloom(scene × weights)
```

A weight now changes only how hard a thing glows. The board can sit at
0.35 and stay exactly as bright as before while its halo nearly vanishes.

One subtlety makes that add clean. `UnrealBloomPass` blends its result
additively over its own input, so its output is `input + bloom` — feed it
the weighted scene and you'd get the weighted scene back in the mix,
brightening everything you meant only to make glow. But the pass leaves
the pure bloom in an intermediate target just before that final blend,
and reading *that* gives the glow with no scene attached.

Groups are `map`, `enemies`, `tank`, `towers` and `effects`. Membership
isn't tagged onto objects at creation — it's read each frame from the
collections the game already keeps (`enemies`, `spawnPoints`, `towers`,
and the four board meshes). Enemies get built in several different
places, and tagging would have meant every future spawn site remembering
to opt in; reading the collections can't be forgotten. Anything not
listed falls through to `effects`, so a new kind of particle glows
normally rather than vanishing.

The cost is the second scene render. The mip chain — the expensive half —
runs once either way. Phones are the thing to watch: they already halve
the bloom resolution, and this adds a full geometry pass.

**Where to change things.** Live, by eye: `bloom > weights` in the TD
panel, which persists to `localStorage`. Permanently:
`DEFAULT_BLOOM_WEIGHTS` in `src/bloomweights.js`.

## Changing how a tower looks without touching what it does

A tower is two separate things wearing one name: a set of numbers (range,
damage, rate, cost, upgrade curve) and a thing you can see. The numbers
live in `towers.js` and are the game. The appearance is taste, and taste
changes often.

So they're kept apart. `towerlooks.js` holds a registry of named
*builders* — give one a tower def, get back an Object3D. Switching looks
rebuilds only `tower.obj`; the tower's key, def, tier, cell, cooldown and
accumulated spend are untouched. You can swap the look of a fully upgraded
board mid-game and lose nothing.

Every look must satisfy a small contract, because the tab reads specific
things off whatever it's handed: an Object3D containing meshes (tap-to-
select raycasts against it), a `userData.baseScale` that placement divides
by, and an optional `userData.tick(t)` for idle animation. All the looks
share one `makeTowerMast()` — base, column, collar — so they read as
variants of the same machine rather than unrelated objects, and a look
only supplies the head.

There's a trap worth knowing about here, because it nearly bit. Upgrading
a tower used to make it bigger with
`obj.scale.multiplyScalar(1.12)` — the size was *accumulated onto the
object*, which meant the visual was quietly storing tier state that
existed nowhere else. Rebuild the object for any reason and a
twice-upgraded tower would snap back to its original size. Derived state
that lives only in a render object is a bug waiting for the first
refactor; it's computed from `tower.tier` now.

Looks can also declare a `preload()` returning a promise, for assets that
arrive asynchronously. Nothing uses it yet — it exists so a loaded model
can become a look without the registry changing shape.

## Putting an authored 3D model into a game made of wireframe

Everything in this project is generated — dot clouds, extruded quads,
primitives. Dropping in a model somebody built in a 3D package raises
three problems that have nothing to do with loading the file, and all
three are handled in `glbmodels.js`.

**It's the wrong size, in the wrong place.** Exported models carry
whatever units the artist worked in. Fitting matters in a specific way
here: these models are much wider than they are tall, so fitting by
footprint makes a squat smear you read as debris, and fitting by height
alone sprawls them over neighbouring cells. They're fitted to a target
height with a cap on span. Position is worse — a tank's bounding box is
dragged forward by its gun barrel, so its box centre sits well in front of
its hull. Centre on the box and the tank pivots around a point in mid-air
ahead of itself. So a model can name a node to centre on instead.

**It disappears.** The board is black with neon wire; a dark grey machine
is invisible on it. Rather than replacing the model's materials, the game
colour goes on as *emissive* — full strength on parts the artist named
"glow", a low wash elsewhere — so the piece reads as its type while
keeping its own material identity. Unlit materials have no emissive
channel, so they take the colour directly.

**It costs too much to draw.** These models are 60–110 separate meshes.
Eight of them on the board would be several hundred draw calls, and the
bloom pass renders the scene twice, so double it. Merging by material cuts
that by roughly an order of magnitude.

Merging is where the interesting trade lives, because it destroys
articulation — a merged mesh is one rigid body. So the merge takes a list
of nodes to **preserve**: meshes underneath one of those merge into *that*
node's space and stay attached to it, everything else collapses into the
root. That's why the same function serves two opposite cases. The tower is
a walker that has dug in, so nothing needs to move and it flattens
completely. The tank has to aim, so its turret and both secondary guns
stay articulated and everything else merges around them. Aim still reads
those pivots' world quaternions, which is the same rule the procedural
tank follows.

Models load asynchronously, which the game cannot wait for. Every
model-backed piece therefore has a procedural fallback it renders
immediately, and swaps itself when the bytes arrive. A failed load
resolves to `null` rather than throwing, so the fallback simply stays.
