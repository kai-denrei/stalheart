# Roadmap

Where this is going, and what is knowingly unfinished. `DEVLOG.md` is the
backward view — what happened, generated from `docs/log/entries/`. This is the
forward one, and unlike the devlog most of it is written by hand, because a
roadmap is meant to be argued with and a generator cannot argue. If an item
here looks wrong, it probably is.

Three labels, used throughout:

- **Committed** — decided, scoped, and next in line.
- **Candidate** — wanted, but the design call has not been made.
- **Question** — we do not know the right answer, and guessing would cost more than asking.

One section is generated: [Open in the log](#open-in-the-log) is rebuilt from
the entries by `npm run log -- render`, and `npm run check` fails if it drifted.
Everything else is prose.

---

## Now

Owner-directed sequence, unchanged: **architecture → visual/sound labs and
clean exports → UX → playability**. `docs/STATE.md` holds the detail.

| area | state |
| --- | --- |
| `src/td-tab.js` extraction | active. 17,608 lines against a 17,609 budget — it can only go down |
| FX package workflow | active. Weapons and audio done; beams, materials, portals and cinematics pending |
| Enemy representation | **unblocked** — see below. Rendering and simulation both measured, neither is the constraint |
| Heavy Gunship | designed, not built (`docs/superpowers/specs/2026-09-13-heavy-gunship-design.md`) |
| Asset tiers | MÖRK LOW and the distance proxy pinned at `771e166` for review — `labs.html?unit=mork-low#units`. Shipped hull unchanged |
| Isao-Birudorōn | production alpha upstream; review before integration |
| Sniper range / first-map Sentry Control | open playtest failure, unreproduced |
| HUD, tutorial, off-screen threats | queued behind the architecture work |
| Difficulty, economy, progression | explicitly last. Not a balance pass yet |

## Committed

### The enemy representation decision — now an aesthetic call

Measured 2026-09-13, twice, and both measurements overturned an assumption.

```
rendering   2000 static clouds   1.6 ms      2000 merged   <0.1 ms, ONE draw call
            2000 jelly bodies    2.0 ms      (5.6M triangles)
simulation  505 concurrent in the real game: locked 60fps, GPU flat
            (7.3 ms at 12 enemies, 7.4 ms at 504)
```

Dot count is not a cost axis. Per-instance colour is free, so the BJJ belt
ladder scales to thousands at no charge. Resolution LOD by crowd size buys
nothing on this class of GPU. **Pick the representation on how it looks.**

Two caveats that are not yet closed: concurrency above ~505 was never reached
(`waveMult` caps at 20 and enemies die as fast as they spawn), and all of it is
an M4. `labs.html#swarm` exists to answer both — run the lane and read the card.

### The phage

Diagnosed, not fixed. It is the white belt and the wave-1 swarm, and it is the
only one of the three authored creatures without its own movement treatment —
`waveJelly` is a blob squash-stretch applied to a rigid lunar lander. The
jellyfish already has `swimWave`.

Two ways out, both small. Give it a lander gait of its own; or swap the
silhouette in `DOT_SHAPES`, which is **one line** and touches no story beat,
cinematic, lore entry or test, because the type id stays `phage` — the
precedent is `scoutufo`, already a bacterium, and `saucer`, already a `ufo`.
The owner's instinct is a white amoeba at wave 1.

### Heavy Gunship

The spec is written and the decision recorded. KORP/GS01, in orbit, low on
fuel: it cannot manoeuvre or land, so it passes on a fixed schedule and the
player is a gunner, never a pilot. The 105mm **is** the orbital strike, which
finally gives `src/strike.js` a home; `strike.js` itself is not modified.
Collateral is soft warning only. Nothing is added to `td-tab.js`.

Blocked on nothing. Its damage and blast numbers cannot be tuned until swarm
scale above 500 is known, but the mount can be built before that.

### Asset tiers: Full / Game-ready / Static distance

Every asset family ships three ways, and they are three different jobs:

| tier | job | loads when |
| --- | --- | --- |
| **Full** | close shots, cinematics, recording | chosen by hand |
| **Game-ready** | anything articulated, damaged or fighting | near, and always before combat |
| **Static distance** | background, bays, orbital views, loading | far, intact, and still |

D0–D3 are **damage states**, a second axis — never read a LOD off a D-number.
The distance proxy exists for D0 only.

Landmarks already work this way through the `asset` / `far` pair in
`src/content/base-layout.js`, which prefers an owner-authored far tier over a
derived one. This convention names what that schema was already doing.

### MÖRK moves to its LOW tier

Upstream moved from our pin `8de41ec` to `771e166`, and the tank is now a
tier × damage matrix. **We ship the tier the page calls "Original detail"** —
our pin predates a game tier existing.

| `771e166` | KB | triangles | prims | nodes | clips | callouts |
| --- | --- | --- | --- | --- | --- | --- |
| original d0 | 984 | 18,596 | 44 | 109 | 6 | 142 |
| **LOW d0** | **448** | **5,208** | 43 | **109** | **6** | **142, byte-identical** |
| LOD2 d0 | 218 | 1,706 | 1 | 41 | 0 | 0 |

Measured through `prepareMork` itself — the scope `test/mork.mjs` pins — the
game tier is **24,196 triangles in 50 batches and LOW is 6,742 in 49**: 3.59×
less vertex work at the same draw-call count. The GLB table above counts unique
geometry and is not the number a re-pin uses.

LOW is **verified as a drop-in**: every node and clip `src/mork.js` reaches for
resolves in it, checked through three.js's name sanitization (the raw node
`"Long cannon barrel"` is what the heat sleeve hangs on). The only node lost
since our pin is `Turret cheek armor`, which nothing references.

Acceptance is test-enforced, which is the point. `test/mork.mjs` pins
`triangles === 24196` and the browser test pins `batches === 50`, so the swap
cannot land silently — those get re-pinned to what `mork.js` itself measures
on LOW. The heat-sleeve and articulation tests must pass **unchanged**. Concretely: `24196` becomes `6742`, and `batches === 50` becomes `49`.

**Status, 2026-09-14.** Pinned in `docs/hover-tank-tiers-assets.lock.json` and
guarded by `scripts/assets.mjs`, which now demands all 17 sockets and six clips
of LOW rather than of the shipped file alone. Reviewable beside the shipped hull
at `labs.html?unit=mork-low#units` and `?unit=mork#units`. As built units in the
viewer the two render `1.14 × 0.59 × 2.60` — the same size, so the swap will not
pop. **What remains is a look by eye** at the lift, recoil and plasma sweep, then
the re-pin and a decision entry to make it the default.

Measured as built units with the viewer's pose frozen (`?yaw=0&sweep=0`), they
agree to the fourth decimal: the shipped hull `1.1405 × 0.5905 × 2.6000`, LOW
`1.1404 × 0.5900 × 2.6000`. Packing for the release removes 114 triangles from
the hull and 104 from LOW, and the release acceptance run holds both to per-tier
floors taken from those numbers.

Needs its own lock at `771e166`: the existing lock pins the shipped model at
`8de41ec`, and one lock is one revision. Then a visual and animation pass by
eye, and a decision entry.

### The distance proxy in the bays and the orbital views

The owner's proposal, and it is the asset's written policy: *"Recurring intact
tank displays in containers and other background views. Static D0 proxy only;
swap to the articulated game tier before combat or visible damage."*

- **Classic base bays** — `td-tab.js` builds a full hull at 0.32 scale inside
  each container and never animates it. The proxy is a pure win: three hulls,
  one primitive each.
- **Story bays** — already on `mork_container_low_diorama.glb`, whose own
  `Tank_Roll_Out` clip plays the roll-out; the game hands over at the end
  (*"the authored hull hides, ours stands where it stopped"*). Nothing to change.
- **Orbital and gunship views** — the tank is a few pixels, cold geometry in
  thermal. Exactly what a proxy is for.

The rule that keeps it honest: LOD2 has no barrel and no clips, so it can never
be the hull the player drives. Swap before anything moves, fires or takes damage.

Built in the viewer with the pose frozen, the proxy's footprint matches the hull
to 0.01% — `1.1404 × 2.6000` against `1.1405 × 2.6000`. Only its height differs,
by the authored 6.5% raised under Question. Packing removes nothing from it: it
is one draw with no degenerate triangles to lose.

### Isao-Birudorōn — review before integration

*"Flying construction specialist that assembles the Stålheart Terraformer before
it fabricates MÖRK vehicles."* ビルドローン — build drone. The author marks it
**production alpha, for art-direction and gameplay review**, so it goes into a
review surface first, not the game.

| tier | KB | triangles | prims | clips |
| --- | --- | --- | --- | --- |
| LOD0 detailed | 3,284 | 45,780 | 99 | 17 |
| **LOD1 game** | 1,534 | **17,264** | 49 | 17 |
| LOD2 distance | 173 | 1,800 | 1 | 0 |

LOD1 lands under its own 25,000-triangle target. Clips: `Hover_Idle`,
`Rotor_Cycle`, `Tool_Fabricate`, and fourteen `Emotion_*` performances, each an
LED glyph **with** a body or tool gesture — *"the screen alone is not the
performance."*

It must swap by **projected screen size**, not by metres: the manifest says
outright not to assume the landmark 150 m threshold. That is new machinery; the
landmark system only knows distance.

## Candidate

### Large swarms above 500 concurrent

The ceiling was not found. The stock harness cannot force accumulation while
enemies remain mortal, and `freezeEnemies` removes the very simulation being
measured. Wanted: a way to hold a large live population without turning the
game off. Note that `docs/STATE.md`'s 5,334 bodies at wave 75 are **scheduled
across a wave, not concurrent** — concurrency is what costs.

### The board, not the crowd

With one enemy alive the scene is already **1,120 draw calls and 375,000
triangles**. Enemies add 250–800 on top. If anything on this board wants
optimising it is the static base, the towers and the postfx — and nobody has
looked at that yet.

### Merging the dot clouds

A 16× win on paper (1,092 calls → 1) that is currently saving 1.5 ms nothing is
short of. Worth doing when a weaker device says so, not before.

### The autopilot is steering, and half of it is already pure

AUTO carries six directives — `wander` / `avoid` / `ram` / `conserve` / `home`
/ `portal` — and the firing half is already a pure module (`src/autofire.js`,
"rules, not effects"). The steering half is not: the goal vectors and the
solid-tier flee vector live inline in `src/td-tab.js` around line 3055.

That asymmetry is the next obvious extraction, and it is the rare one that
*helps* the ratchet: `td-tab.js` sits at 17,608 against a 17,609 budget that
can only go down, so moving ~60 lines of pure vector rules into
`src/domain/autopilot.js` pays the budget rather than spending it. It also
makes the gunship's GET TO SAFETY beat a call rather than a copy.

Not urgent. Worth doing the next time anything touches auto mode.

## Question

- **Does the shader wobble read well on the phage?** It deforms now; whether it
  looks right is a judgement nobody has made. `labs.html#swarm`, body: phage.
- **Is the jelly the small-enemy idiom?** 2000 of them cost 2.0 ms, so the
  answer is no longer "too expensive". It is now a taste question.
- **What does a weak device do?** Every number in this file is an M4.
  `docs/STATE.md` has listed device performance review as open throughout.
- **Where does simulation actually break?** Rendering is settled; pathing,
  collision and the hard-core proximity sensor at swarm counts are not.
- **Which emotion system is the source of truth?** The game has
  `src/emotions.js`: twenty-one 8×8 faces ported verbatim from the Braille lab,
  with a rule never to hand-edit them. The new Isao carries fourteen *original*
  8×6 LED glyphs, each paired with a body gesture. Twelve names overlap. The
  model adds `working` and `alarm`; the game's `awe`, `scared`, `frustrated`,
  `focused`, `unimpressed`, `suspicious`, `blink`, `scan` and `grin` have no
  performance. The sharp end: **`focused` is Isao's most-used face in the
  briefs, six times, and the model has no `focused`** — `working` is the
  nearest. And `emotion()` falls back to `neutral` without a word, so an
  unmapped face would go blank silently rather than fail.
- **Is the MÖRK proxy's lower height deliberate?** In its own metres it stands
  2.819 against the hull's 3.016 — 6.6% shorter, base about 2 cm higher and top
  about 18 cm lower — while its footprint matches to 0.1%. That reads like a
  parked hull settled for a bay, which would be right for where it goes. If it is
  not deliberate, the fix belongs in the A6 source rather than here. The test
  pins the measured value instead of widening a tolerance, so either answer is a
  one-line change.

---

## Open in the log

<!-- deban:open:start -->

_Generated from `docs/log/entries/` by `npm run log -- render`. 6 open: `proposed` means the decision is not made, `observed` means it was seen and not yet resolved._

### Make MÖRK's LOW tier the default hull

`2026-09-14-mork-low-as-default` · decision · **proposed**

LOW is pinned at 771e166 and verified as a drop-in for src/mork.js by tests, by a real render and against the packed release (see 2026-09-14-mork-tiers-pinned-for-review). ASSETS.md requires a visual and animation acceptance pass before a pinned revision becomes what ships, and the owner's upstream candidates are marked pending game-camera and reference-phone review.

### Sniper modes remain unsatisfactory and require further playtesting and fixes

`2026-09-08-sniper-modes-playtest-unresolved` · issue · **observed**

After delivery of the first-map Sentry Control experiment, the owner explicitly reports that the sniper modes are not quite working yet and asks that this be captured in the development log. This applies to the Sniper range and the new actual-map manual-sentry experiment.

### Curved breach waves, wall clearance and rendering comparisons

`2026-09-08-breach-planet-wall-preview` · experiment · **observed**

The owner wants ground breaches to replace wave portals eventually, with short wide fissures, wall destruction, and creatures climbing out on the spherical world.

### Sinkhole ground-breach genre in Portal Lab

`2026-09-08-sinkhole-portal-lab` · experiment · **observed**

The owner intends enemies to breach from the ground and requested an initial effect study using the Monolith Rift import guide. Gameplay spawn replacement is later work.

### Evaluate promotion pacing and strategic build capacity after wave-42 playtest

`2026-09-08-playtest-progression-build-capacity` · decision · **proposed**

Owner reports rapid tank promotion, plentiful biomass with too few meaningful spending choices, and potential tower overload after a 42-wave playtest. Owner explicitly framed prepared sites and power prerequisites as ideation.

### Prototype an earned automation opening and a dedicated sniper Sentry

`2026-09-08-earned-automation-sniper-proposal` · decision · **proposed**

Owner wants a satisfying sniper tower and suggests replacing Howitzer with Needle or Railgun. Owner proposes a slow opening with only Isao and Tank, manual turret operation inspired by Sniper Lab, Isao constructing the Terraformer/Stalheart, and chip production subsequently enabling turret automation. This extends the prior build-capacity ideation without selecting its final rules.

<!-- deban:open:end -->

---

## Conventions

- Record decisions with the project `/deban` skill or `npm run log -- add FILE`.
  Entries are immutable; `DEVLOG.md` and the block above are generated from them.
- `docs/STATE.md` is the short current-state page and stays short.
- `docs/IMPROVEMENTS.md` holds detailed completion criteria for the backlog.
- `docs/PLAYFEEL.md` is the owner's playtest register and renders into the devlog.
