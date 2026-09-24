// THE PULL-OUT'S NUMBERS: the campaign board's victory shot, where the camera leaves the hull until the planet is a marble
// against the galaxy and then hands over to the debrief. Its path is src/domain/victory-pull.js, the shot src/fx/victory-pull.js.
export const VICTORY_PULL = Object.freeze({
  seconds: 4.2,   // seconds of camera
  hold: 0.9,      // ...of which the last of it is a held wide
  outR: 5.2,      // where it goes: further out than the reveal shot's 3.3, because this is the whole planet with room around it
  spin: 0.42,     // radians of drift around the pole over the move, so the planet turns under the camera
  minR: 1.05,     // the start radius never sits inside the ground
});
