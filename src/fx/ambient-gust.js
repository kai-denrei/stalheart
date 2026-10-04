// THE WIND IN THE QUIET (owner, 2026-10-04: "small ambient sound when there's quiet once in a while", his MuffledSoundGust). When no
// one-shot sound has played for `quiet` seconds (the beds that loop do not count: the engine idles under everything), a gust of the
// planet's wind passes, and the next may only come `gap` seconds later, a little at random so it never reads as a clock.
// sfx: src/audio.js (activeVoices, play); rand for the harness.
export const GUST = Object.freeze({ key: 'ambient_gust', quiet: 9, gap: [40, 75] });

export function createAmbientGust(sfx, { tune = GUST, rand = Math.random } = {}) {
  let still = 0, wait = tune.gap[0] * 0.5, gusts = 0;   // the first may come sooner: the opening's quiet stretches are where it is wanted
  return {
    tick(dt) {
      if (!sfx?.activeVoices) return;
      const busy = sfx.activeVoices.some((v) => !v.loop && v.key !== tune.key);
      still = busy ? 0 : still + dt; wait -= dt;
      if (still >= tune.quiet && wait <= 0) { sfx.play(tune.key); gusts++; still = 0; wait = tune.gap[0] + rand() * (tune.gap[1] - tune.gap[0]); }
    },
    get gusts() { return gusts; },
  };
}
