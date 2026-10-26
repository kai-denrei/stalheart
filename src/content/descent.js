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
  briefCap: 22,   // game seconds the cave waits at most for Isao's descent_brief to finish: three lines' dwell (17.6 s by lineDwell) plus a margin; the owner's exposition is read before the cave covers the game (2026-10-18)
  // THE HOLE IS THE DOOR (owner, 2026-10-26, note 7; src/fx/hole-door.js): the camera's look, dive and rise on the arena's hole, in cells and seconds.
  // rimOut/rimUp: the rim view's point past the rim and over it; top: the axis point the dive turns down at; under: the hand-over, below the surface along
  // -normal; fov: the dive's narrowing (of the camera's own); turn: the share of the dive spent reaching the axis; glide: the look's glide to the rim view;
  // rise: the climb back to the rim view; settle: game seconds the hand-over holds under the lip before the cave shows (the camera eases to its goal);
  // hold: how long a shot holds its last pose until the next one replaces it
  door: Object.freeze({ rimOut: 0.3, rimUp: 1, top: 2.5, under: 1.5, fov: 0.55, turn: 0.4, glide: 1.2, rise: 2.5, settle: 0.5, hold: 600 }),
  jokeHold: 7,   // seconds Isao's line stays up after the cave closes before the ending begins (a caption needs reading)
});
