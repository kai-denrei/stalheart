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

## Round 2 (owner's playtest, 2026-10-13)

The owner: "promising, but 1) there are still a mix of half-dotted and new cutis enemies. the fps gets very low. hard to tell if it's just because of
Cutis, or the mix. 2) the cutis getting rammed by the tank is not a satisfying animation, we need some sense of stagger on the enemy, and bump on the tank.
3) the cutis animation clips through walls ... we need a method to have their feeling/scouting appendage be constrained by the rocks/walls ... these
enemies look better, but fps wise we maybe cannot afford them as is." Headed M4 soaks (vsync off, `&hold=1&sentries=6`, sector 4): the Pearl bodies cost
~0.04 ms each more than the dot clouds, all of it GPU: 8.8-11.7M triangles (13k-triangle hulls drawn twice for transparency, plus an inner core of the
same resolution) for every body on the planet, seen or not; the creatures' own CPU was 0.5-2 ms.

### Performance (src/fx/cutis-maku/geometry.js, hard-core.js; CUTIS_LOD in config.js, PEARL_FOLLOW.lod in content)

- **Culling.** update() packs only the bodies that can be seen: inside the camera's frustum (a sphere round the body's origin wide enough for its
  longest stalk) and above the planet's horizon (the eye's horizon distance plus the body's, the body 3 radii tall). A culled body draws no membrane,
  core, pearl or shadow. While a second view of the scene is up (the story monitor, the SOL-82 scope) nothing is culled (`wide()` on the host).
- **Three levels.** The kit's high hull (~13k triangles, double-sided: two passes) only above 70 device pixels of radius and at most 12 a tier (the
  largest on screen); the kit's low hull (~2.2k, one pass) above 12 px; a third hull of ~450 triangles below. 12 % hysteresis on both thresholds.
- The soft tiers' inner core is drawn one resolution down (it is inside the membrane), none at the lowest level; the pearls at two resolutions (24 x 16
  under a high hull, 10 x 7 otherwise); the contact shadows 4 x 4. The swarms cast and receive no shadow map; they are drawn in the bloom's weighted pass
  and the final pass like every object (kept: their glow is part of their look).
- Soak, sector 4, 150 s (means after 20 s; at the peaks 420-630 enemies): dots 22.7 ms (25-27 at the peaks), 1.75M triangles; Pearl before 34.4 ms
  (42-49 at the peaks), 6.5M (8.8-11.7M); Pearl after 20.5 ms (20.6-21.8 at the peaks), 2.1M (2.0-2.7M), draw calls ~1.8k in all three; with the
  whole round in (the hubs, the reach, the ram): 20.7 ms (21-23 at 400-610 enemies), 2.1M. In the soak's view the bodies were at the two low levels
  or culled; the high hull is for a body the camera is right on.

### No dot clouds (src/domain/surface-hubs.js, src/fx/creature-bodies.js)

Twelve projection hubs, the icosahedron's vertices with the first at the heart: every point of the sphere is within 0.65 rad of one (a shape pressed by
at most 7.5 %). A record is on its nearest hub (0.03 rad of hysteresis) and its plane coordinates are that hub's; one swarm per tier still draws them all:
each instance carries its hub's quaternion (`iHub`) and the kit turns its bent body about the planet's centre (HUB_TURN in the membrane and shadow
shaders; hubPoint for the pearls and the culling). Walking into another hub's region, the family re-projects the body's origin, anchor, hunt point,
planted anchor and heading into the new plane at the same sphere pose (the hop goes on; at the bisector both hubs see the point at the same arc, so the
shape changes by the hysteresis only); bodies on different hubs are never each other's neighbours. The hub index rides in iState.w (hub x 16 + probes
x 4 + chosen) and the shadow's float, the twelve turns are a uniform table (uHubs): a first cut with a vec4 attribute of its own passed WebGL's sixteen
vertex attributes with three's declared ones and failed to link ("Too many attributes (iHub)", caught by --boss-cutis). `maxArc` is gone: every mapped record is dressed. A
body that cannot be made (its tier's pool full) is refused and spawnOne makes the record again as its own dot cloud (`undressed`); a creature probe's
record is not made at all. Sector 6 soak (final): 0 dot clouds (was 373), 465 Pearl records on average on hubs 0, 1, 2, 7 and 11, 1583 hand-overs, 19.7 ms, no shader error.

### The rock and the walls (src/domain/body-reach.js, src/fx/cutis-maku/swarm.js)

`freeReach` samples a plane direction on a fixed grid (1.5 m, `PEARL_FOLLOW.reachStep`; the grid does not depend on the length asked, so a shorter look
samples a subset of a longer one) and bisects the boundary; `nearestCellFrom` walks the cell graph greedily from the record's cell to each sample, looking
at the neighbours' neighbours before it stops (a plain greedy walk stopped on a local best of the irregular cells now and then, so the same stalk read
clear from one record cell and blocked from the next);
the seam answers `hubs.reach(hub, x, z, dx, dz, max, cell)` against the board's BLOCKED cells (ROCK and WALL). The kit's plan, given a `reachLimit`:
every seeking stalk is held 0.6 radii (its cup) short of the first blocked point, so its anchor and the straight transfer are clear; a heading whose
stalks are all blocked within 3/4 of their reach turns (up to 1.35 rad) to the way whose best stalk most nears the target. Without a limit (the boss
lab, the probe) the plane is open as before. Not constrained: the stalks' sideways sweep while seeking (up to about a radius) and the membrane itself (a
body follows its record, which walks the floor). --pearl-story audits every live stalk and anchor over ten seconds of sector 2: 0 crossing (thirty audits
a second apart in a longer diagnostic run: 0, and 0 bodies standing on the rock).

### The ram and the touch (src/fx/creature-pearl.js, src/fx/ram-jolt.js; PEARL_IMPACT)

Presentation only: who dies, damage, combo and bounty are untouched. The ram (enemy-step calls `rammed(e)` before the kill): the body's stalks snap back,
it is knocked 1.4 radii along the tank's heading and 0.6 aside, squashed flat (0.55) and rebounding taller (the deflate channel, signed) for 0.45 s, then
deflates. A cored body's touch (the touch damage or the shield's shove: `touched(e)`): pushed 0.8 radii back, a harder wobble, its hop held 0.5 s, alive.
The hull: a damped pitch (2 degrees for a 2.5 m body, x1.8 for a cored one), a roll toward the side, a camera dip; kicks within 80 ms add 30 %, a load
that drains at 2.5 a second scales kicks down (cap 3), the pitch clamped at 0.09 rad, so a crowd under the treads rumbles. td-tab gains it in five
existing lines (the import, the jolt beside bumpLeft, the dip, the hull's rock, the tick).

### The review's fixes (an independent review of round one)

a. Pool exhaustion: no invisible stand-in (above). b. The slow tower's ice: the stand-in's setTint is kept, the body's tint channel (iLife.w) turns the
membrane toward 0x8fd4ff at its own brightness and the pearl's instance colour toward ice. c. Per-frame garbage: coreContactInto / positionInto write in
place, the seam's track options are one object it keeps, toPlaneInto, the follow's lead and leash cached per speed, the free slots a min-heap. d. A
fading pearl (cloak, death) is drawn by a twin mesh that writes no depth. e. The probe: alive counts only bodies standing drawn, alive + pending are
topped up to the target, each step books its dying and pending, the card says pending, refused (and for want of a slot) and the family's last error.

## Round 3 (owner's playtest, 2026-10-13)

The owner: "not bad. there is still some clipping of the Cutis-Pearl through the walls." Round 2 held only the seeking stalks off the rock. Then, as its
own small task, "make the initial wave of white and yellow creatures much slower, a slow controlled threat. then we will make it more hectic later."

### What was crossing (the footprint audit)

`src/fx/cutis-maku/deform.js` is the membrane shader's deform in JS, term for term (rest shape and lumps, stalks with their bow and sideways sweep, the
cup, the transfer's curve, the settle's recoil, the hard core's padded shell, the squash), run over the lowest hull's 249 vertex directions;
`creatures.footprint()` (src/fx/creature-pearl.js `footprint`, through the seam) puts every point of every live and dying body, the pearl's rim and the
contact shadow's visible rim against the board's BLOCKED cells and reports which part, which tier and how deep (seen from the body's centre). Headed
M4, sector 2, before: 504 of 1,896 body-samples across (26.6 %), the worst 0.86 radii in the settle; a second run 284 of 1,140, 2.27 radii (puddles by a
wall), yellow 1.96. By part: the body at its anchor (SETTLE, TRANSFER: a body ~1.2 radii wide settling where its cup was held 0.6 radii from the rock),
the transfer cutting a corner, the stalks' sideways sweep and bow, the body itself after a leash re-placement or a knock, death puddles spreading 1.6x.
The round-two stalk audit read 0 throughout: it looked at the stalks' centre lines only. A synthetic corridor (every tier, targets swinging into the
rock) had 43-89 % of samples across.

### The fix

- **The clearance** (`src/domain/body-reach.js` `query.clearance`, `clearPush`, `clearOf`): the plane metres from a point to the nearest BLOCKED region
  and the way away from it (and the facing wall's), a lower bound from the wedge of each blocked cell's two farthest face half-planes (the board's own
  nearest-centre rule). The board is Stalberg's organic quads, four neighbours a cell, up to six meeting at a corner: a cell touching the point's corner
  can be three steps round it, so the cells are gathered by a walk of up to five rings pruned by distance (the first cut, two rings, let bodies 1-2 m
  into the rock where it missed one), the look capped at 2.2 spacings. clearOf pushes off the near wall, again from where it lands (a corner), centres
  the point in a corridor narrower than the footprint and reports the room, then measures where it ended. Never more than the truth on an irregular
  quad board (node, brute force), 0.2-0.3 m short on average.
- **The plan** (`src/fx/cutis-maku/swarm.js` `clearProbes`, the host's `clearLimit` through the seam's `hubs.clear`): each stalk's tip, the anchor it may
  become, is moved to where BODY_RADII (1.35) radii of open ground is round it and re-aimed; its whole way must be TRANSFER_RADII (1.2) radii clear
  (`clearPath`: both ends' discs bound the segment, sqrt(c^2 - (len/2)^2); the middle is measured and both halves looked at where they do not, four
  levels at most), or SQUEEZE_RADII (0.8) through a passage narrower than the body (the body then squeezed through it); a stalk that is not clear is
  retried short of the first narrow point, then dropped. The body's room (the least round its origin, tips and way, over its footprint) and the room
  square to its axis are measured where the room is under 1; the stalks' sweep and bow are damped to the room beside the tips and along the way.
- **Bodies put down or knocked**: `place` (a new body, a leash re-placement, a squad member) pushes the spot clear; the ram's stagger and the touch's
  recoil push the knocked body clear each frame (it slides along the wall); a dying body is measured where it lies (its puddle squeezed, not moved),
  within its hop's room.
- **The shader** (`MEMBRANE_VERT`): the room, its axis and the sweep's damping ride in the positions' unused `.y` (iOffset.y, iAnchor.y, iHeading.y;
  the positions read flat), the room across the axis in iParams.z: no new vertex attribute (the sixteen are full). Under its footprint, the body (not its
  reaching stalk: squeezed along an axis not square to it, a long stalk's tip would swing sideways) is squeezed across the nearest wall and square to it;
  a puddle and a squash spread only as far as the room; the shadow shrinks with it. deform.js mirrors every term; a node test pins the shader's lines.
- **The leash**: at least one of the body's own hops (`pearlLeash`, PEARL_FOLLOW.leashHops 1). Bodies held back by the rock fell a hop behind and were
  put back mid-stride: 170 leash re-placements a minute on sector 2 against the round-two tree's 16; with the squeeze-through and the leash, 19-39.

After, headed M4: sector 2 0 of 1,129-1,437 body-samples across in every run since, sector 6 (the canyon) 0 of 8,290 (25 audits, 400-570 bodies);
--pearl-story (sector 2, every tier, the far side's hub, `&hold=1` so the longer audit cannot lose the sector under the step): 12 audits over 24 s, 0 of
~2,000 body-samples (~500,000 points), and the stalk audit 0. Node, the synthetic corridors (20 m and 10 m, with a side branch; every tier at r 2.8,
brown at 3.64, the knot at 6.72): 0 points on the rock (the knot, wider than the 10 m corridor and squeezed, 1 sample in 7,200 grazing 0.13 radii in its
transfer; the test allows it 0.2), the bodies covering as much ground as without the clearance. Cost, sector 4 A/B soaks (vsync off, `&hold=1&sentries=6`):
enemies CPU 1.51 -> 2.19 ms at the old pace, 1.13 -> 1.36-1.56 ms at the new, the frame unchanged (GPU bound); ~10k clearance queries a second at 420
bodies, none per frame (plan, place and knock only), no per-frame allocation.

Not covered: the rock prisms are drawn as the board's quad polygons while the game's blocked test (and so the clearance) is the nearest cell centre;
irregular quads differ from that Voronoi boundary by up to a metre or two in places (the 1.35-radii footprint against the ~1.2-radii membrane leaves a
little margin; the shots did not show it). A body re-placed on its leash still pops (fewer). A squad's five bodies in a corridor narrower than the
squad are pushed into its middle and overlap each other.

### The first waves' pace

`PEARL_PACE` (src/content/pearl-enemies.js): white (amoeba, phage) and yellow (ghost, scoutufo) walk at 0.4 of their ENEMY_SPEC speed without the
erratic bursts, applied where PEARL_SPECS is built (src/fx/creature-enemies.js); everything else is the game's own. Their hop reach x0.7, so pearlPace
shortens their cycle and they creep in steady hops rather than sitting through a long cycle and lunging (offline, ten bodies a type for a minute: 0.8-1.3
hops a second of ~3 radii, 1.3-1.5 radii behind, no re-placement). The first step of a ramp: "more hectic later".
