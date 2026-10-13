// THE GROUND FEED (owner, 2026-10-13; spec docs/superpowers/specs/2026-10-13-ground-feed-inset-design.md): a sinkhole, the back door's
// rockfall and the campaign board's rock opening shown in the corner box as an orbital video feed instead of a camera cut. The
// schedule and the numbers are src/domain/feed-schedule.js, the box src/fx/ground-feed.js; `&cuts=dive` brings the old dives back.
//
// altitudeCells: the feed camera's height over the point; regionalCells / closeCells: the frame's height in cells before and after the
// zoom, which takes zoomSeconds from the event's preRoll (the dive's own moment); staticOpen / staticClose: the static bursts at the
// open (and at a retarget) and before the close; rollDeg / driftCells: the slow roll and drift through the hold; feedHz: the feed's
// own frame rate (the second render runs at it, not at the game's); gain: the picture's light before the phosphor curve.
// seismic: SEISMIC's magnitude per kind, base + perLog x log10(1 + cells) + up to `jitter` from the point.
export const GROUND_FEED = Object.freeze({
  altitudeCells: 60,
  regionalCells: 25,
  closeCells: 4,
  // the rockfall wants the mouth, the rock round it and the lane in one frame; the rock opening (the campaign board's, ~27 cells
  // across its planet) a whole band
  framing: Object.freeze({ backdoor: Object.freeze({ regionalCells: 30, closeCells: 11 }), reveal: Object.freeze({ regionalCells: 40, closeCells: 28 }) }),
  zoomSeconds: 1.2,
  staticOpen: 0.35,
  staticClose: 0.3,
  feedHz: 30,
  gain: 1.1,
  rollDeg: 6,
  driftCells: 0.5,
  title: 'SAT-3 · ORBITAL FEED',
  labels: Object.freeze({ breach: 'SEISMIC EVENT · SINKHOLE', backdoor: 'SEISMIC ALERT · ROCKFALL', reveal: 'SURVEY · ROCK OPENING' }),
  seismic: Object.freeze({
    breach: Object.freeze({ base: 4.2, perLog: 0.9, jitter: 0.4 }),
    backdoor: Object.freeze({ base: 3.1, perLog: 1.1, jitter: 0.3 }),
    reveal: Object.freeze({ base: 2.2, perLog: 0.5, jitter: 0.2 }),
  }),
});
