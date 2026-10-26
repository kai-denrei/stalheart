# ROUND 3 B — the reinforcements' timer and lines, the streak's lore, the ending that is not skipped by mistake (2026-10-26, branch `round-3-b` from `overnight-2026-10-23` 0df35698)

Owner, 2026-10-26: "3) the unlock that makes the mech drop should be a timer from when we unlock the radar. a) 'radar is built! We can ask for
reinforcements!' ... after a few in-game days it arrives: 'hmm these mechs were all they could send as support'. 5) to explain 'streaks' yielding
more biomass, the lore is that when they die closer to each other, the dying cells of various organisms bound in a way that preserves more
mass, otherwise it seeps into the ground. 8) when we see the final score after the cave, it is too easy to skip by mistake. a) we re-do a brief
animation of the 42 days celebration, while the scoreboard also displays. If the user skips, we ask to confirm: 'Skip End Game Celebration?'"

## Decisions

1. **The timer (note 3).** The call is already booked when the radar prints (src/fx/reinforcements-host.js `called`, `story.reinforcements = {
   calledDay, due }`, REINFORCEMENTS.days 3) and the drop waits for the first LULL after `due` (src/domain/reinforcements.js dropReady). The owner
   wants a timer: the drop goes AT `due` (the day counter crossing it), waiting only for a manned seat, a brief on the panel or a running shot to
   clear (the existing `cond` fields), never for a lull; THE ARENA-first rule stays. Isao's lines become the owner's: `reinforcements_called`
   = ["Radar's up! We can ask the colony for reinforcements.", "I've sent the call. They'll take a few days to fall."] (two lines; the first is
   the owner's "radar is built! We can ask for reinforcements!"); `reinforcements_landed` = ["Hmm. These mechs were all they could send as
   support.", "Two hold the arena, one walks home, one hunts."]; `reinforcements_inbound` unchanged. Captions (no recording). A node test on
   dropReady's new rule (due crossed -> ready without a lull; a seat/brief/shot holds it) and `--reinforcements-lull` renamed or re-aimed
   (`--reinforcements-timer`: the drop within 2 game s of `due` with no seat up, holds while a brief is on the panel).
2. **The streak's lore (note 5).** Where the player meets streaks: the STREAK callout (src/td-tab.js 2117 `co-streak`), the campaign debrief's
   'longest streak' tile (src/fx/campaign-debrief.js 109) and the bestiary terminal if it has a scoring page (src/fx/bestiary*.js: check). Add
   ONE Isao brief `streak_lore` (src/isaobriefs.js, once, face 'thinking' or the nearest the set has, title COMMS · ISAO) said the first time the
   streak multiplier reaches 1.5: ["When they die close together, their cells bind as they go. More of the mass holds.", "Alone, it just seeps into
   the ground. Keep the kills tight."] — and the debrief tile's caption gets a one-line version ("kills close together hold more mass"). The
   sentences are the owner's lore in Isao's register; keep them short. Test: the brief exists and is said once at 1.5x in the node test of the
   eco/callout path if one exists (test/eco*.mjs, test/callouts*.mjs: check), else a harness check in an existing story step where a streak
   forms (--pearl-story or --defense: pick the one that is green on the base).
3. **The ending (note 8).** Map the sequence after the cave first (src/fx/descent-host.js -> src/fx/ending-host.js -> playDiorama
   (finale-diorama) -> the orbital finale (src/fx/orbital-finale.js, its own canvas, 'ANY KEY · SKIP') -> the scoreboard (src/fx/scoreboard.js,
   src/fx/campaign-debrief.js)) and write it in the entry. Then: (a) a skip of the orbital finale or the scoreboard's reveal asks first: the first
   key or tap replaces the 'ANY KEY · SKIP' line with "SKIP END GAME CELEBRATION? · SPACE YES · ANY OTHER KEY NO" (the finale's own .of-skip
   element and style; no emoji), Space or a second tap within 4 s confirms, any other key or 4 s of nothing dismisses the question and the
   celebration goes on; (b) the DAY 42 celebration replays briefly with the scoreboard: when the scoreboard shows (the board in the scene), the
   disco party's scene (src/fx/disco-party.js: the ball at the tip, the lights, the laser ring, the track) runs a short form of ~20 s (new
   `createDiscoParty` option or a `replay(seconds)` entry: no countdown, no "we survived" line, the ball already up, the klaxon at the end, the
   ball lowered and shrunk away) over the base while the board is read; the party's music on its bus as DAY 42 does; if the ending's camera is
   not over the base when the board shows (check where it is), the replay runs where the board is and the ball hangs over the board. A harness
   check in `--finale` (memory: "--finale plays the ending without reaching it"): a keydown during the finale shows the question and does not
   skip, Space then skips; with no key the party's replay state is seen during the scoreboard (expose `state().ending.party`).

## Out
The finale's content, the scoreboard's numbers, voice recordings.
## Order
1 -> 2 -> 3 (map first, then (a), then (b)) -> records (deban entry, STATE paragraph).
