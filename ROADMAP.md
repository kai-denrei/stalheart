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

---

## Open in the log

<!-- deban:open:start -->

_Generated from `docs/log/entries/` by `npm run log -- render`. 5 open: `proposed` means the decision is not made, `observed` means it was seen and not yet resolved._

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
