// DAY 42 (owner, 2026-10-18: "a silly celebration after 42 days. Entirely arbitrary, comic relief. Isao surprises us during a lull with a
// creation he made, a Disco Ball!"): the party's numbers. `seconds` is the track's length less its tail (44.04 s; stopped before the loop
// point), `shot` the reveal cut (live: the world runs under it), `hoist` the arm's rise, `lower` the ball's way down and out, `patience`
// the days after 42 the party waits for a breath before it goes at the next free moment; the diorama's colours (src/domain/disco-celebration.js).
// `music.retry` (final review, 2026-10-18): the track is a lazy sound, so a slow decode is asked again for the party's first seconds (it
// starts late and is cut at `seconds`, the alarm still on the party's clock). `countdown` (owner, 2026-10-18 round 2: "let's record voices for
// Isao to announce the party ... 30 seconds before ... 10 seconds before"): the seconds of Isao's announcement before the party, the sector
// clock already held, `back` the seconds into it of "Come back to the base"; `briefs.soon` and `briefs.back` the two lines; `sayWait` the
// seconds a later line of the party waits for Isao's panel before it is dropped (src/fx/disco-party.js say(); not the over line, which cuts
// the panel at the alarm since round 4, 2026-10-19: the gate's warnings held it past sayWait and it was lost): two of his two-line beats,
// one up and one pending (the --day-42 step, 2026-10-18: a beat with SOL-82's first pass pending behind it outlasted 12 s)
export const DAY_42 = Object.freeze({
  day: 42, patience: 6, countdown: 30, back: 20, sayWait: 20, seconds: 43.8, loadAhead: 2,
  shot: Object.freeze({ id: 'discoReveal', at: 1.5, seconds: 10, radius: 70, height: 28, easeIn: 1.2 }),
  hoist: 4, lower: 3, loop: 16,
  light: Object.freeze({ intensity: 18, angle: 0.5, distance: 60, penumbra: 0.4 }), laser: Object.freeze({ length: 40, width: 0.18, opacity: 0.55 }),
  music: Object.freeze({ key: 'day_42_music', retry: 6, duck: Object.freeze({ buses: ['towers', 'tank'], depth: 0.6 }) }),
  briefs: Object.freeze({ soon: 'day_42_soon', back: 'day_42_back', start: 'day_42', over: 'day_42_over' }), callout: 'ALARM · CONTACT',
  ball: 'assets/models/disco-ball/disco_ball_d0_lod1.glb', landmark: 'stalheart',
  // THE BOARDS' PARTY FACE (owner, 2026-10-18, third round: "the boards with the score could temporarily show : '42 days Survived!' And
  // 'CONGRATS! VENI VIDI KICK ASS!'"): from the party's start to its done the two scoreboards show `title` over `body` (wrapped to `wrap`
  // characters a line, the boards' own uppercase), the lines in the party's colours moving on one every `cycle` seconds
  boards: Object.freeze({ title: '42 DAYS SURVIVED!', body: 'CONGRATS! VENI VIDI KICK ASS!', wrap: 11, cycle: 2 }),
});
