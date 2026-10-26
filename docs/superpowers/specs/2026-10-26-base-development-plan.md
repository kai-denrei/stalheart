# PROPOSAL — user-driven base development (2026-10-26; owner's note 10: "the user chooses what to build in what order and where")

Status: a plan to react to, nothing built. Facts from src/content/base-programme.js, src/content/base-layout.js, src/fx/programme-host.js.

## What the base is today
- 16 programme steps printed by the drone in a fixed order, each gated by phase/sector/idle (gate, Stålheart, landing, foundry, solar, bays, HUGIN,
  radar, assembly, back gate, board, garage, armory, farm, chips, launcher), each with a perk (station, hulls, gunship, uplink, rebuild, ...) and an
  Isao brief. Every structure has a fixed plot: ISLANDS in base-layout.js (x/z/w/d per island, a stage), STRUCTURES placed on them.
- The player places only sentries (build mode: cells, cost, cap, refusals full/far/rock/deep). Structures cost nothing and ask nothing.
- The story depends on some steps: the radar (the reinforcements' call), the HUGIN (the gunship), the bays (hulls), the launcher (sector 6's launch),
  the back gate (the door arc). These are prerequisites, not timers.

## The shape proposed: three phases, each playable alone
1. **Choose the order (what and when).** The programme becomes an offer, not a schedule: at each idle gate Isao offers the steps whose
   prerequisites stand (a small tech tree: solar -> radar/assembly; bays -> garage; assembly -> armory; farm/chips after sector 3/4 as today) and
   the player picks one on the build board (the existing build menu's style: a card per structure, its perk in one line, its cost in biomass from the
   economy plan, PRINT). The drone prints it where it always did. Unpicked offers stay offered; the story's prerequisites are shown as locks
   ("the launch needs the launcher"). Isao's briefs stay the briefs of the step picked. Cost: structures get prices (new content field `cost`),
   paid at the pick; the programme host reads the pick instead of its own order. The harness: `--programme` (exists? check) drives picks.
2. **Choose the plot (where).** Each island becomes a set of allowed plots (2-3 per structure, authored in base-layout.js so the models and
   the roads still fit; the HUGIN and the Stålheart stay where they are), and the pick's second click chooses the plot with the sentry build
   pointer (the same refusals: full/far/rock/deep plus "in the road"). The story's camera looks and the showcase's beats read the structure's
   plot from the layout at runtime (most already do: `story.autoTowers`, the radar's cell).
3. **Move and sell.** A printed structure can be sold (refund 60 % as the economy plan's sentries) and re-printed on another plot; the perk goes
   with it (the gunship stands down while the HUGIN is away). The programme's `rebuild` perk (assembly) makes the reprint free once a sector.

## What stays fixed
The gate and walls, the Stålheart, the landing pad and the foundry (the opening is frozen until the tour); the plots' authored list (no free
placement on arbitrary cells: the models need their roads and the showcase needs its marks).

## Costs and risks
- The programme host, the showcase's beats and the tutorial chapters assume the order (memory: "the opening is frozen until the tour"; skip
  markers reference steps). Phase 1 keeps the opening's four steps fixed and frees the rest, so the tour and the chapters hold.
- td-tab's line ceiling (5,450; 5,324 now): the board is a new fx module with a host literal, not controller lines.
- Phase 2 touches base-layout.js's plots, the far models and the roads: author 2-3 plots per island by hand, with the layout lab (labs.html has
  a base lab? check) to see them.

## Questions for the owner
- Phase 1 first, alone, for a playtest? (It is the cheapest and already changes the feel: a choice with a price.)
- Should structures cost biomass (ties note 9 and 10 together) or a separate currency (parts, the expeditions' cargo)?
- Which structures may move in phase 3, and may the player skip one for good (never build the farm)?
