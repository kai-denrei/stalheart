// THE DESCENT (owner, 2026-10-15: "/Users/minikai/Dev/stalheart-cave we will bring this mission as the last mission; Isao must go into the Nest to
// set-up a nuke"; spec docs/superpowers/specs/2026-10-15-descent-mission-design.md). The standalone cave game (BELOW, vendored under below/ by
// scripts/import-below.mjs) plays inside the game's page after BOTH WALLS is secured: `page` is opened in an iframe over the paused game
// (src/fx/descent-host.js), the cave posts { below: outcome } back when its ending's button is pressed, and the campaign goes on by the outcome
// (src/domain/descent.js): `rescued` and `sacrifice` to THE ENDING with Isao's decoding joke (`back`, or `last` as his last transmission),
// `lost` keeps the cave open for its TRY AGAIN. `mobileSkip`: the cave is keyboard and mouse; on a phone the descent is skipped with the brief
// and the ending plays. The lines are captions until the owner records them (~/Dev/seiyu_voice section 17).
export const DESCENT = Object.freeze({
  page: 'below/index.html?stalheart=1',
  outcomes: Object.freeze(['rescued', 'sacrifice', 'lost']),
  brief: 'descent_brief', back: 'descent_back', last: 'descent_last',
  mobileSkip: true,
  lookHold: 2.5,   // seconds the camera looks at the arena's hole (the nest's mouth) before the cave opens (2026-10-16)
  printCap: 45,   // game seconds the descent waits at most for a print of Isao's running at its start (round 7, note 8: the print seen to its end; the mech's is 27.6 s)
  briefCap: 22,   // game seconds the cave waits at most for Isao's descent_brief to finish: three lines' dwell (17.6 s by lineDwell) plus a margin; the owner's exposition is read before the cave covers the game (2026-10-18)
  // THE HOLE IS THE DOOR (owner, 2026-10-26, note 7; src/fx/hole-door.js): the camera's look, dive and rise on the arena's hole, in cells and seconds.
  // rimOut/rimUp: the rim view's point past the rim and over it; top: the axis point the dive turns down at; under: the hand-over, below the surface along
  // -normal; fov: the dive's narrowing (of the camera's own); turn: the share of the dive spent reaching the axis; glide: the look's glide to the rim view;
  // rise: the climb back to the rim view; settle: game seconds the hand-over holds under the lip before the cave shows (the camera eases to its goal);
  // hold: how long a shot holds its last pose until the next one replaces it
  // `under` 1.5 -> 1 (2026-11-05, note 10, measured on the real road, --descent-carcass): the arena's hole is 3 cells round and its throat's black floor 1.65 cells
  // down (src/sinkhole-terrain.js, 0.55 of the hole's radius); at 1.5 the camera stood 0.002 world units over it, inside the near plane (0.004), and the game's
  // last frame was the planet's far side seen through its own ground; at 1 (0.0086 over it) the last frame is the throat's black, as the cave's first from that pose
  door: Object.freeze({ rimOut: 0.3, rimUp: 1, top: 2.5, under: 1, fov: 0.55, turn: 0.4, glide: 1.2, rise: 2.5, settle: 0.5, hold: 600 }),
  // THE CAVE LOADS BEHIND A STILL GAME (owner, 2026-11-02, note 10: "just before BELOW the fps drops to 17 in the tank view"): `still` game seconds into
  // the look (the glide to the rim view done, the camera eased to it) the game stands still on its last frame (no sim, no draw; Isao's panel reads on)
  // and the cave's page starts loading; the game runs again for the dive once the cave posts it is ready (`readyCap` real seconds at most) and the
  // brief is read (briefCap, in real seconds while still)
  still: 1.8, readyCap: 25,
  // ONE PLACE (owner, 2026-11-05, round 5 note 10: "entering and leaving feel like loading a different game"): the cave starts where the dive ends and the climb
  // hands its last pose back (src/domain/descent-handoff.js); each cut is covered by the last frame before it fading out over `fade` s, the way in once the cave
  // says its first frame is drawn, or `fadeCap` real seconds after the show at the latest
  fade: 0.6, fadeCap: 3,
  jokeHold: 7,   // seconds Isao's line stays up after the cave closes before the ending begins (a caption needs reading)
});
