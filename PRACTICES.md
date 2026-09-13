# Practices

What this project has learned the hard way, kept so it is learned once. Each
rule carries the incident that earned it, because a rule without its reason
gets argued away the first time it is inconvenient. Newest lessons are folded
into their section rather than appended, so this stays a reference and not a
second devlog. It renders into `DEVLOG.md` and opens in `labs.html#notes`.

---

## One source of truth

**Source it, do not reimplement it.** The swarm lab grew a second tank — its
own x/z integration, a sine-driven yaw that read as skidding, no hover, no
engine — and it would have drifted from the game the first time anyone touched
`TANK_FEEL`. Movement is `domain/yard-drive.stepYardDrive`; hover and settle
are `tankfeel.js` through the persisted `FEEL`. `tankfeel.js` says why in its
own header: two places drive it, and a bench that differs from the board
defeats the bench.

**A scripted mode is an input to the one model, never a second path.** A
charge is a throttle, not a teleport. The ram bump scales the throttle, not the
position, so an impact reads as the engine losing its bite.

**When one side cannot run in Node, generate it from the other's constants.**
The dot wobble lives in `content/dot-wobble.js`; `creatures.waveJelly` reads
the numbers and the vertex shader is *generated* from them. Two hand-written
copies of `0.18` with no failing test between them is how a lab and a game end
up showing different creatures.

**A drop-in matches the exact surface a locked consumer writes to.**
`td-tab.js` is at its line budget and writes `material.opacity` and
`material.color.setHex()` every frame, so `fx/dot-material` exposes `color` as
the live uniform value and `opacity` as a defined setter. Close is not enough;
get it wrong and the slow field tints nothing and the dead never fade.

**Look for prior art before calling anything new work.** AUTO's six directives
and a proximity-weighted flee from the solid tier already existed, from an
operator ruling; the heavy gunship spec listed "tank AI that avoids hard cores"
as work to do. Search this codebase and `~/Dev/spherical-stalberg-grid` first.

## Measure, then decide

**A hypothesis is allowed to lose — record it when it does.** Merging the
crowd into one instanced draw call cut 1,256 calls to 146 and bought nothing.
The wall was point count: 1,200 bodies hold 60fps at 180,000 points and drop
22.5% of frames at 592,800, at identical draw calls.

**Trace the path the game actually runs.** A "17x win" from the shader port
was measured on the unit viewer's path; gameplay never ran it, because the
authored creatures had no idle entry and were static in the game.

**Measure the same quantity on both sides of a comparison.** A raw GLB parse
counts unique geometry (MÖRK 18,812); `mork.js` counts rendered meshes after
load (24,196). Both are right. A saving quoted across them is not. Measured in the same scope, LOW is 6,742 against 24,196 — and in 49
batches against 50, which is the dots lesson again: the win is vertex work, not
draw calls.

**`requestAnimationFrame` deltas measure vsync, not work.** A flat 16.6 ms for
every variant at every count is the display refreshing. Time the work itself.

**A probe can corrupt what it measures.** The readout's `gl.finish` cost probe
rendered six extra frames every 0.4 s and landed hitches inside the run it was
scoring; standing it down took late frames from 12% to 8%.

**Show two numbers when one of them can lie.** The GPU timer through ANGLE read
a 5.7 ms median where a direct probe read 0.8 ms, so the run card shows it as
*indicative* beside the wall-clock frame gap, which cannot be argued with.

**Stamp the build on every measurement.** Four runs were compared across a
stale service-worker cache and the only tell was `PEAK CALLS 0`. Every record
carries its build now. When in doubt, reload with `?sw=0`.

**Compare a series, not screenshots.** One build, one sitting, every leg kept.

**Pin a surprising measurement; do not widen the tolerance.** The MÖRK proxy's
first size test allowed 5% and failed at 7%. Widening it would have hidden a real
difference, and rescaling the proxy would have distorted what may be a deliberate
parked pose. The measured delta is held in the test instead, so a revision that
changes it fails and gets looked at rather than slipping through.

**A tolerance measures one thing; it does not travel.** Packing the release
removed 114 triangles from the 24,196-triangle hull (0.47%), 104 from the
6,742-triangle LOW tier (1.54%), and none from the one-draw proxy. The existing 1%
floor, written for the hull, passed the hull and failed LOW. The floors are per
tier now, taken from those measurements, against the lockfile-pinned gltfpack.

## Look at it

**Render it and look before calling it done.** Every automated check passed on
a lane where the bodies were scaled like trees beside the tank, the HUD sat
under the menu button, the file was a field rather than a column, and most of
the crowd was seated at z -396 in a lane spanning ±150. Screenshots found all
four. No test did.

**A prepared mesh is not the unit — test what the consumer builds.** The proxy's
footprint matched the hull to 1% at the prepare stage, and the Units viewer still
showed it 1.33x off. The builders differed in `userData`, not in geometry:
`makeMork` set `baseScale: 0.75` and the proxy builder set nothing, and every
consumer sizes a unit by that factor. A real browser render caught it; no unit
test could see it. The remedy is one contract object both builders read.

**Hold the subject still before you measure it.** An axis-aligned box around a
spinning hull is not a size. A probe meant to read a frozen tank saw its width
drift two thirds of a metre in a second and a half, and reported the proxy 14%
wider than the hull. Only the height — immune to rotation about the vertical —
told the truth throughout. Once the turntable really stopped, all three tiers
agreed to 0.01%.

**An explicit override must outrank a default, down to assignment order.** The
viewer's `?yaw=` switched the turntable off, then the per-unit spin default ran on
the next line and switched it straight back on for every tank. The deep link had
never frozen a tank. Nobody noticed until a test depended on it.

**Say which mode the screen is in.** A ram count of 2,400 against 1,000 alive
read as a bug; it was free play recycling every kill, and nothing said so.

## Generated things fail loudly

**Anything generated must fail a check when it goes stale.** `DEVLOG.md` and
the roadmap's open-items block are rebuilt by `npm run log -- render`, and
`npm run check` fails if either drifted. Verified by drifting one on purpose.

## Assets

**Three tiers: Full, Game-ready, Static distance.** MÖRK at `771e166`: original
18,596 triangles; LOW 5,208 with the same 109 nodes, six clips and a
byte-identical 142-entry callout file; LOD2 1,706 triangles in a single
primitive with no clips at all.

**The distance tier is a proxy, never a driven hull.** In the author's words:
*"Static D0 proxy only; swap to the articulated game tier before combat or
visible damage."* LOD2 has no barrel node and no clips, so handing it to
`mork.js` would throw.

**D0–D3 are damage states, not LODs.** Tier and damage are two axes of one
matrix, and the distance proxy exists for D0 only. Never infer a LOD from a
D-number.

**Landmarks swap by distance; characters swap by projected screen size.** Isao's
manifest: *"do not assume the landmark 150 m threshold."* A small drone up close
and a large building far away are not the same problem.

**Check an asset through the loader's eyes.** three.js sanitizes node names on
load — `"Long cannon barrel"` becomes `Long_cannon_barrel` — so a raw-name check
reports misses that are not there, and would have blocked a safe adoption.

**A new revision needs checksums, a visual and animation acceptance pass, and a
decision entry.** Tests that pin exact counts (`test/mork.mjs` expects 24,196
triangles) are tripwires: they make a tier swap deliberate instead of silent.

## Architecture

**Line budgets only go down.** `td-tab.js` sits at 17,608 of 17,609. New
behaviour goes into layer modules, and the best extraction is one that pays the
ratchet — AUTO's steering still lives inline while its firing half is already
the pure `src/autofire.js`.

## Spirit

A loss is a fact and then a plan. Curiosity over dread, resources over blame.
It is exciting to create — that is Isao's voice, and it is a fair description
of how this gets built.
