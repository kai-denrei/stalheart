# The story mode with the Cutis-Maku Pearl set as its enemies — design

Owner, 2026-10-13: "let's try regular story mode, but we replace the enemies with the Cutis-Maku-Pearl set", pointing at Jelly-Baby's
handoff note (`~/Dev/Jelly-Baby/docs/STALHEART-CUTIS-PEARL-HANDOFF.md`, source `src/cutis/` at 3a985e1, "use PEARL_TIERS"). On the
belt clash (the game's orange is the first solid core; the Pearl set's orange is soft): "we can trivially edit the set to reflect orange
as the first pearl-hardcoded. do so." Balance: the game's own numbers (the recommended default; the owner answered only the orange question).

Branch `pearl-enemies`, cut from `creature-enemies` at e3f6ace3 (worktree `~/Dev/stalheart-pearl-enemies`). Local only until the owner says.
Jelly-Baby is not edited: the orange change lives in Stalheart's copy of the set.

## The switch

`index.html?creatures=pearl#td` (any other flags as usual, e.g. `?skip=defence&sector=2&creatures=pearl&fps=1#td`). Without it the game
is unchanged. With it, the regular story runs as it does (its waves, breaches, types, counts, pacing), and every enemy of a mapped type is
drawn as its Pearl tier instead of its dot cloud. Nothing else about the enemy changes.

## The set (Stalheart's copy, `src/content/pearl-enemies.js`)

PEARL_TIERS ported as data (skin, core tint, r0 ratio, seekCount, cycleDuration, aggression, reach, transferAcceleration, membrane
opacity, core size), with **orange given a pearl core**. The belts then match the game's rule exactly:

| Pearl tier | body | game types |
|---|---|---|
| white | soft | amoeba, phage |
| yellow | soft | ghost, scoutufo |
| blue | soft | saucer, jellyfish, gslime |
| orange | **pearl core** (owner's edit) | drifter |
| green | pearl core | corona, shellback |
| purple | pearl core | barbed, prime |
| brown | pearl core | rolling |
| black (red core, smallest relative core) | pearl core | phantom; knot (the boss, larger) |

`rammable` is the game's (ENEMY_SPEC), and it now agrees with the body: soft tiers are rammable, cored tiers are not (asserted by a test).
The jelly (shelved, a mesh boss) and the creature families (cutis, reed) are not mapped.

## The fight: the game's numbers

Each record keeps its type's ENEMY_SPEC: hp, speed, heart damage, bounty, regen, erratic/jink, tactician, cloak, slow/accel on hit,
heavy, boss. The Pearl set's prototype `health` and `contactDamage` are not used. Body size from the game's size: `r0 = size x 5.6 m`
(the record's touch radius, as src/content/creature-enemies.js's `sizeOf`), the knot x1.5 for its boss presence (still its own record
size for hits). Hop cadence from the tier, scaled so the body keeps up with its record's speed (the existing follow rule,
CREATURE_FOLLOW). A cloaked phantom fades its membrane and core with the cloak, as its dot cloud does.

## The kit (src/fx/cutis-maku, updated from Jelly-Baby 3a985e1)

- Config gains membraneOpacity, coreShape, coreSize, pearlVariant, coreTint (contactDamage and health ported as data, unused).
- Shaders: `uOpacity`; `uHardRadius` (the rest shape held clear of the core, one shared transfer clock for a cored body, the padded
  shell round the synchronized core centre); the per-palette multicolour stays as our port has it.
- Swarm: `getCoreContact(i)` (the core's centre and radius on the shared transfer path); a cored body's `position` is its core centre.
- Hard cores: one instanced sphere mesh per cored tier (MeshPhysicalMaterial as the source's pearl), placed every frame from
  `getCoreContact` and **bent onto the planet with the same mapping the membrane shader uses** (`uPlanetR`), so core and shell never part.
- One swarm per Pearl tier (the stable per-tier pool the handoff asks for: identity never shifts with index compaction), through the
  existing src/fx/creature-bodies.js seam; the death deflates the membrane into its puddle and the core sinks and fades with it.

## Performance

Eight tiers -> eight swarms, about 2 LODs x (membrane + inner core) draws each plus one core mesh per cored tier: ~40 draw calls at most,
CPU per body as the Cutis small (~0.002-0.006 ms). Measured headed on the M4 with the perf overlay over a real sector.

## Testing

Node: the set's table (eight tiers, orange cored, every mapped type's ram verdict equals its tier's body), the mapping covers every type
in the wave programme, the core contact path (core inside the padded shell over sampled phases, as Jelly-Baby's verify-cutis), the
planet bend of the core equals the shader's. Browser step `--pearl-story`: a story sector with `creatures=pearl` boots, enemies of
several tiers spawn as Pearl bodies and no dot clouds, they take damage and die (puddle), cloak fades a phantom, 0 page errors. `npm test`,
`check`, `build`, `architecture`; `--creature-probe` and `--sector-probe` still pass. Then one headed M4 run for the fps.
