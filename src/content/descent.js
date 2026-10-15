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
  jokeHold: 7,   // seconds Isao's line stays up after the cave closes before the ending begins (a caption needs reading)
});
