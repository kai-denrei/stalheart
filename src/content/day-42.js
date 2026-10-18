// DAY 42 (owner, 2026-10-18: "a silly celebration after 42 days. Entirely arbitrary, comic relief. Isao surprises us during a lull with a
// creation he made, a Disco Ball!"): the party's numbers. `seconds` is the track's length less its tail (44.04 s; stopped before the loop
// point), `shot` the reveal cut (live: the world runs under it), `hoist` the arm's rise, `lower` the ball's way down and out, `patience`
// the days after 42 the party waits for a breath before it goes at the next free moment; the diorama's colours (src/domain/disco-celebration.js)
export const DAY_42 = Object.freeze({
  day: 42, patience: 6, seconds: 43.8, loadAhead: 2,
  shot: Object.freeze({ id: 'discoReveal', at: 1.5, seconds: 10, radius: 70, height: 28, easeIn: 1.2 }),
  hoist: 4, lower: 3, loop: 16,
  light: Object.freeze({ intensity: 18, angle: 0.5, distance: 60, penumbra: 0.4 }), laser: Object.freeze({ length: 40, width: 0.18, opacity: 0.55 }),
  music: Object.freeze({ key: 'day_42_music', duck: Object.freeze({ buses: ['towers', 'tank'], depth: 0.6 }) }),
  briefs: Object.freeze({ start: 'day_42', over: 'day_42_over' }), callout: 'ALARM · CONTACT',
  ball: 'assets/models/disco-ball/disco_ball_d0_lod1.glb', landmark: 'stalheart',
});
