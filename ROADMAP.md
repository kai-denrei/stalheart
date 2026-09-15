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
| Landmark LODs | Stålheart's LOD1/LOD2 pinned for game-camera review at `index.html?world=story&stage=6&landmarks=candidate#td`. HUGIN held back: its booster can no longer be hidden |
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

### Stålheart's runtime LODs — in the game camera, for review

The asset owner's roadmap (`jelaludo/SentryTowers_A6`, `docs/ROADMAP.md`) lists
the HUGIN and Stålheart landmark LODs as **candidate delivered, review active**,
with what remains being *game-camera, swap-threshold and reference-phone review*.
That remaining work is this repository's. Stålheart is now set up for it.

| `c827eda` | triangles | draws | plain | packed in the release |
| --- | --- | --- | --- | --- |
| shipped game tier | 40,506 | 105 | 4.1 MB | 555.5 KB |
| **LOD1 candidate** | **7,342** | **10** | 329 KB | **57.7 KB** |
| **LOD2 candidate** | **2,173** | **1** | 76 KB | **17.9 KB** |

Every figure agrees with the author's own README, counted the same way. The
budgets are read from the pinned `manifest-lods.json` rather than retyped, and
`scripts/assets.mjs` fails the check if a tier exceeds them. LOD1 keeps
`Terraforming_Cycle` on the nine machine controls — gantry, carriage, tool lift
and J1–J6 — and each still **carries geometry**, not just a name. The forty
flexible-feed segments are dropped by design.

**How to review it.** `?landmarks=candidate` turns the pinned candidates into
the structure through one mapping (`withLandmarkTiers` in
`src/content/base-layout.js`) and one parser, used by both the game world and
the story lab, so they cannot disagree about which files are under review:

- game camera: `index.html?world=story&stage=6&landmarks=candidate#td`
- story lab: `labs.html?stage=6&landmarks=candidate#story`

Without the switch, a plain story link still loads the shipped tiers; both
browser suites assert that. The review itself — swap distance, projected size,
and frame rate on the reference phone — is yours to do by eye.

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
- **Can HUGIN's booster be hidden again?** The story places the launchpad with
  `hide: ['REUSABLE_BOOSTER']`, and `docs/ASSET-COLLABORATION.md` names that part
  as one the game may hide. At `c827eda` both LOD1 and LOD2 keep the node, but it
  carries **no triangles** — against 6,572 in the shipped model — while 21.9% and
  24.5% of their triangles sit inside the booster's box, against 1.6% of the
  shipped model once the booster is removed. The geometry was merged into
  consolidated static meshes, so the hide would do nothing and the launchpad would
  show a booster the story deliberately removes. HUGIN is held back until a
  revision restores the booster as its own geometry; its motion is otherwise
  fine, with all six catcher joints still moving geometry.
- **Which swap threshold?** The game swaps landmark tiers at 150 m and back past
  **195 m** (`KIT.lod.hysteresis` is a ×1.3 multiplier). The author's provisional
  contract is 150 m with **20 m** of hysteresis. One of them should move, and the
  game camera and reference phone are what should decide which.

---

## Open in the log

<!-- deban:open:start -->

_Generated from `docs/log/entries/` by `npm run log -- render`. 25 open: `proposed` means the decision is not made, `observed` means it was seen and not yet resolved._

### Idea: the Mortar can lay suppressing fire on a chosen area to scare and herd the swarm

`2026-09-15-mortar-suppressing-fire-idea` · decision · **proposed**

Owner, 2026-09-15, while brainstorming the orbital laser: the impact scare (src/domain/impact-scare.js, confirmed in play: small rounds herd the swarm) suggests a deliberate use. The Mortar today picks its own targets on the normal wave ladder.

### The lab's explosions land at the gunship, strike, tank shell and TALON impacts; FLIR thermal; the white amoeba leads the first wave

`2026-09-14-explosions-flir-amoeba-landed` · change · **observed**

Owner: the new explosion effects in ~/Dev/lab-explosions, especially for the gunship, also the Quiver and tank shells; adopt FLIR; make the first enemy a white amoeba swapped with the phage. Spec docs/superpowers/specs/2026-09-14-explosions-flir-amoeba-design.md, plan docs/superpowers/plans/2026-09-14-explosions-flir-amoeba.md.

### Direction: leave the spherical Stålberg grid and go back to a flat world; the sphere may seed a spin-off

`2026-09-14-flat-world-direction` · decision · **proposed**

Owner, after the PoC cleanup and the concept audit (2026-09-14-concept-audit-first-pass, which found the sphere interesting but paying emotionally only in a few scale moments while costing everywhere): leaning towards a major reform and simplification; abandon the spherical Stålberg grid as a PoC that is interesting but not fun enough to justify its complexity; go back to flat for this project; the sphere might be used for a spin-off. The full FunMap audit is to be reviewed together first.

### Next, not yet started: an audit of the game's concepts, not its code, through Rosewater's lessons, and a FunMap kept beside the roadmap

`2026-09-14-concept-audit-and-funmap-proposed` · decision · **proposed**

Owner, at the end of the 2026-09-14 session: after the gunship, the foundry and the Rotor fixes, try something new. An audit, but of the concepts of the game rather than the code, inspired by https://kai-denrei.github.io/game-design-lessons/#rosewater: a reflection, through the early development, on where the game is going. Possibly a separate roadmap kept as a FunMap, logging what feels satisfying and what can be improved.

### An explosion research brief for outside artists: procedural Three.js r160 modules built in their own lab, imported by contract

`2026-09-14-explosion-research-brief` · change · **observed**

Owner wants satisfying explosions, first from the gunship's seat, then in the ground game, with mini nuclear clouds for the orbital strike; asked whether artists could research procedural r160 explosions and we import the best. The researcher's first pass came back with six open questions (field of view, bloom, the device, the deciding load, scorches, the palette) and three risks (replays, rings on a curved planet, a cloud at a kilometre).

### Still open after the story-opening playtest: the breach freeze, the Rotor's sound by ear, Rotor shots into the wall, and ISAO-Birudorōn's review

`2026-09-14-story-playtest-open-items` · issue · **observed**

The story-opening playtest batches (commit 89b81b5) fixed what could be measured and verified headlessly. Several items were changed or partly addressed without an acceptance the owner can rely on, and should be picked up rather than assumed done.

### The gunship's own 105, separate from the orbital strike; heat, magazine and reload downtime for all three guns read on the HUD; the piloted Rotor's rounds seen as bigger, longer tracers with a wider hit and hit counters

`2026-09-14-gunship-own-105-downtime-bars-and-rotor-tracers` · change · **observed**

Owner's seventh brief (2026-09-14): the gunship should get its own strike, separate from the orbital strike; overheating and reloading of weapons 1, 2 and 3 must be communicated better, with infinite ammo while testing but downtime; the Rotor's PoV still feels off, add more tracer so where the bullets go is seen; enemies that look hit are not dying, cause unknown (landing wrong, hitbox, the wall under, the angle).

### Idea: an orbital laser as its own weapon; the orbital strike console is hidden meanwhile

`2026-09-14-orbital-laser-idea` · decision · **proposed**

Owner, playing the gunship: the orbital strike console (the ORBIT percentage, the arm switch and the LAUNCH button) is redundant with the gunship, whose 105 already lands through the strike's code. They would like to try an Akira-style weapon in space instead: a powerful continuous laser fired at the planet for brief periods.

### The gunship seat 340 m up looking straight down, M cycling normal / night vision / thermal, the owner's weapon 1 sample looped, a click that fires at once, the 105 honest about its re-orbit and never cutting away from the seat

`2026-09-14-gunship-higher-straight-down-three-views-and-the-105-from-the-seat` · change · **observed**

Owner's sixth brief (2026-09-14): the view should feel much higher and straight down; try GunShip_Weapon01_Test2.mp3 for weapon 1; weapon 2 needed a long click; weapon 3 launched unreliably and read 'paint the target' while a cooldown ran; the camera MUST start from the same PoV for weapon 3, no jump cut to the orbital strike, the gunship gets its own animation; M did nothing and should cycle normal, night vision (dark, enemies white) and thermal (enemies in yellow/red heat).

### HUGIN's runtime LODs merge the booster into static geometry, so the story can no longer hide it

`2026-09-14-hugin-booster-not-hideable` · issue · **observed**

The story places the HUGIN launchpad with hide: ['REUSABLE_BOOSTER'], and docs/ASSET-COLLABORATION.md names REUSABLE_BOOSTER as a part the game may hide. The author's README for the c827eda candidates says static geometry is consolidated separately from the six moving groups, and that LOD2's lookup nodes remain but do not articulate its merged geometry.

### Ship Stålheart's LOD1 and LOD2 as its landmark tiers

`2026-09-14-stalheart-lods-as-shipped` · decision · **proposed**

Stålheart's runtime LODs are pinned at c827eda and verified in the story lab and the real game camera (2026-09-14-stalheart-lods-in-game-camera-review). The author and the owner both mark them pending game-camera and reference-phone review.

### Three reticles and a fire-control HUD for the gunship, per-gun zoom, the owner's 40 mm report and the Rotor's own muffled firing sound from its optic, impacts that land seconds after the report, and the 105's paint-then-guide flow; FX package base 8

`2026-09-14-gunship-reticles-hud-sounds-and-the-rotor-optic-firing-sound` · change · **observed**

Owner's brief 2026-09-14: from the Rotor's PoV add the supplied HeavyMachineGun_RotorGunPOVSound.mp3 only while it fires, muffled, over the spin-up and spin-down, separating the rotors turning from the barrels firing; in the gunship PoV three reticles to tell the selected weapon apart, more HUD (distance, contacts, planet coordinates, calibres), each gun its own zoom, the rotary closer with lots of impact feedback and rotor-like sounds slightly deeper, the 40 mm with the supplied GunshipWeapon2Blast.mp3 and small area explosions that decimate groups, the 105 keeping the strike's sounds and effects but starting from the seat with its own reticle as a one-two: paint a red laser area, then launch and guide as the current strike does; fire 1 and 2 with a lag between the report at the gunship and the impact on the ground.

### Make MÖRK's LOW tier the default hull

`2026-09-14-mork-low-as-default` · decision · **proposed**

LOW is pinned at 771e166 and verified as a drop-in for src/mork.js by tests, by a real render and against the packed release (see 2026-09-14-mork-tiers-pinned-for-review). ASSETS.md requires a visual and animation acceptance pass before a pinned revision becomes what ships, and the owner's upstream candidates are marked pending game-camera and reference-phone review.

### The gunship seat shows its contacts: white screen-sized markers per enemy, the map framed between the base and the swarm, a contacts and nearest-range readout, and a two-minute window while we debug

`2026-09-14-gunship-seat-contacts-framing-two-minutes` · change · **observed**

Owner's third playtest (2026-09-14): the briefing is not bad, the map view is right, but the enemies were black on black and could not be seen, nothing moved, the enemies were out of range with no way to track them, and the window was too short to test. Enemy markers on the map exist only for spawn points; the swarm is its dot clouds at orbit distance, which the surveillance filter drowns.

### The arrival recycled, first pass: the foundry beat between landed and printing, the SH02 cut into its salvage layout beside the AFR-01, barrels paying for the Rotor and the Quiver

`2026-09-14-arrival-foundry-beat-landed` · change · **observed**

Design agreed in 2026-09-14-arrival-foundry-recycles-the-sh02. Plan: docs/superpowers/plans/2026-09-14-arrival-foundry.md. Branch heavy-gunship, alongside the gunship work, while the owner playtests.

### First swarm-cost number under the gunship: 72 phage in view pulled the headless acceptance run to 28 fps

`2026-09-14-gunship-swarm-cost-first-number` · issue · **observed**

Spec §9 named the horde render cost as the unverified premise. The skip panel now keeps waves coming while the platform is overhead, so the number falls out of the acceptance screenshot.

### The pre-A6 terraformer heart (the wide machine on a round pad) is purged; the Sentry Terraformer 3000 is the Stalheart everywhere and the story world always has the empty heart

`2026-09-14-pre-a6-terraformer-heart-purged` · change · **observed**

Owner saw enemies attacking the old heart model after the gunship's pass ended in the story world and ruled it a relic that must never appear again. Classification before deleting: not dead code. It was the classic mode's default heart look (params.heartLook 'terraformer' unless ?terraformer=a6), listed in the metal lab, and probed by ?heartprobe=1. The story world had built it because the gunship skip URL did not carry heart=none: only ?story=N implied the empty heart.

### Skip-to markers beside the build tag: GUNSHIP opens the seat on station with a breach and enemies up; the pass runs over the approach and the seat settles its aim after the platform takes its track

`2026-09-14-story-skip-markers-and-gunship-test-route` · change · **observed**

Owner asked where to test the gunship and for skip-to-scene markers next to the [dev] tag (rotor, quiver, study, gunship) so a beat can be tested without playing up to it, with a way to raise more enemies. Only the gunship needed to be reliable now.

### Open after the gunship mount: untuned guns, unmeasured horde cost, herding unverified, no seat on the practice map, and the story-world Rotor-kill acceptance step fails on main

`2026-09-14-heavy-gunship-open-items` · issue · **observed**

The gunship mount landed (2026-09-14-heavy-gunship-mount-landed) against a stage-6 story world with no enemies up, so nothing about its guns has been held against a horde.

### The heavy gunship mount landed: a fixed pass on the game clock, a gunner-only seat on the story strip, three guns with the 105 as the strike, a thermal optic and soft-warning rings

`2026-09-14-heavy-gunship-mount-landed` · change · **observed**

Owner set the Heavy Gunship as the session's priority per docs/superpowers/specs/2026-09-13-heavy-gunship-design.md and 2026-09-13-heavy-gunship-mount-design. Constraints: no new top-level src module, src/td-tab.js may not grow (budget 17605), src/strike.js unchanged, danger rings are readouts never refusals, no fuel meter, the KORP asset pinned and hash-validated. Plan: docs/superpowers/plans/2026-09-13-heavy-gunship.md, executed on branch heavy-gunship.

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
