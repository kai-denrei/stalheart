// THE PULL-OUT'S PATH (the campaign board's victory shot: src/fx/victory-pull.js flies it, src/content/victory-pull.js holds
// its numbers). Pure arithmetic: the shot's progress and the radius the camera started at in, the radius and the drift
// angle around the pole out.
//
// FAST THEN SETTLING. A linear pull reads as a lift being operated; the ease-out is what makes it read as being pulled away
// from something. The last stretch is a hold, so the wide shot is a beat the eye can rest on rather than the instant before
// a modal. The slow drift around the pole makes the planet turn under the camera and read as a body rather than a texture.
export function pullOutPath(u, camR, { seconds, hold, outR, spin, minR }) {
  const fromR = Math.max(minR, camR);
  const t = Math.min(1, u / (1 - hold / seconds));
  const e = 1 - Math.pow(1 - t, 3);
  return { r: fromR + (outR - fromR) * e, spin: e * spin };
}
