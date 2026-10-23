# THE ROAD CLEARED WIDE, AND NO BLOB FOR HER (2026-10-23, branch `arena-road` from `overnight-2026-10-23`)

Owner, 2026-10-23 10:40 JST: "2) we clear a path with both SOL firing more aggressively AND the gunship dropping nukes to destroy a large path at
least 2 cells wide for the tank to speed up to full speed without being impeded. 3) there's a giant green blob preceding the large boss, I know
that we use that for the smaller waves of enemies, but it does not work when scaled to a large boss."

Where things are: THE ARENA's drive out is boss-run's `beacon` phase (src/fx/boss-run.js: THE PLANNED ROAD, roadKept/roadRock/roadField in
src/domain/arena.js, the asks to SOL through `c.solRoad(ci)` with the band 6.5-10 cells ahead, ARENA.road knobs in src/content/sectors.js:
`every`, `burn`, `plan`, `clear`, aheadMetres; the cut log and `--arena-drive`'s per-cut table in scripts/browser-test.mjs). The hull drives
the road on the lure directive (src/fx/hull-drive.js, src/domain/lure.js 'arena' mode) and the wall cushion (src/domain/wall-cushion.js) slows
it near rocks. The gunship: src/fx/gunship-rig.js (the automated release: GUNSHIP_AUTO in src/content/gunship.js, nukePile/nukeSafeCells/nukeView;
`launchHeavy`), the strike lands through src/fx/strike-console.js (breakWalls breaches BLOCKED cells within the blast via host.breachWallCell and
rebuildAfterBreach; CHECK whether terrain ROCK cells are BLOCKED for it or only player walls: the terrain nomenclature is FLOOR / ROCK / WALL / GATE,
and SOL's burn takes a rock through its own path; if the MK-9 does not take rocks today, it must, within its blast, through the same breach
path SOL's road burn uses). The arena guns (free MK-9, reload 6) apply in boss-run `guns()` for phases boss|over only. The blob: src/fx/emerge-blob.js,
spawned by src/fx/enemy-step.js EMERGENCE for a record rising at a breach ("a blob at the lip takes the tier's skin"); the boss record is a hunter
record of tier `huge` whose body is the Nih-Dairia kit (src/fx/creature-reed.js) with its own rise (boss-emerge: below > tremor > reach > haul >
release > up). Find where her record (and the arena's wave) gets a blob and what the owner sees as "a giant green blob preceding the large boss".

## Decisions

1. **The corridor (note 2a, SOL).** The road SOL cuts becomes a swath: for every kept road cell, the cell AND its rock neighbours within
   `ARENA.road.width` (new, 1: the neighbours one cell either side of the road, so the corridor is three cells wide, which is "at least 2")
   are road rocks to burn; src/domain/arena.js `roadRock` (or a sibling `roadSwath(path, adj, tags, width)`) returns them in road order, the road
   cell first, its flanks after it; SOL's ask takes the next unburned swath cell in the band exactly as it takes a road cell today. SOL fires
   more aggressively: `ARENA.road.every` 4 -> 2, `burn` 2.5 -> 1.6 (the beam held less per rock; if a rock needs longer to burn, the hold must still
   end on the rock gone), and the band's far edge aheadMetres from 100 to 140 m so the beam works farther down the road. Measure, do not
   assume: `--arena-drive`'s table gives each cut's ask lead and the hull's speed; the acceptance is the hull's MEAN speed over the drive at
   least 80 % of its top speed (the lure's), and every kept road cell with at least one clear side neighbour on arrival (the corridor >= 2).
2. **The nukes (note 2b, the gunship).** During the `beacon` phase the automated gunship drops MK-9s on the road ahead: boss-run exposes the
   road's next rock CLUSTER target (`roadNukeTarget()`: the kept road cell, at least `nukeSafeCells + blastCells + 2` cells ahead of the hull and
   at least that from the base's nearest structure, with the most rock cells within blastCells of it among the next 20 road cells) and the
   rig's automated aim takes it as a release point when no enemy pile wins (GUNSHIP_AUTO: a new `roadWeight` so the road wins over a pile smaller
   than nukePile; keep nukeFacing/nukeView rules: the drop happens where the gunship can see it). The arena guns (free MK-9, reload
   BOSS_FIGHT.arenaGuns.reload) apply in `beacon` too, so the road gets an MK-9 every reload + fall. The strike takes rocks (above). Isao's existing
   MK-9 release line plays as it does. The hull is never inside the blast: nukeSafeCells is the rule and the harness asserts the hull's distance to
   every road MK-9 landing >= blastCells + 1. `--arena-drive` counts the road MK-9s (>= 2 over the drive) and the rocks they took.
3. **No blob for her (note 3).** The boss record (tier `huge`, the arena's boss row) and ONLY it never gets an emerge blob: her entrance is the
   kit's own rise with the sinkhole's quake and dust; add the rubble the drop now has (src/fx/feids-drop.js's rock chunks: lift the chunk burst into
   a small reusable fx `src/fx/rock-chunks.js` if that is cheap, else a second copy is NOT acceptable: reuse) thrown from the lip as she breaks
   the surface (24 chunks, the drop's rule). The waves' blobs stay. Find the actual code path first: if what the owner sees is the arena wave's
   blob and not hers, say so in the report and still take the blob off her. `--arena` keeps its five steps; add a check that no blob exists for
   the boss record (expose `state().boss.blob` false) while `--nest-guards`/the Reed waves still get theirs.

## Out
The lure's drive logic itself, the fight after the arrival (arena-lab-fight is in), the Cutis row, the blob's look for the waves.

## Order
3 (small, measurable) -> 1 (swath + knobs, then measure) -> 2 (the nukes, then measure) -> records (deban entry, STATE paragraph, this spec filed).
Commit each step tested; if 1 alone reaches 80 % mean speed, still build 2: the owner asked for both.
