// THE TANK FINISHED UNDER THE STÅLHEART (owner, 2026-11-13: "the tank; we should see it being finished under the Stalheart before we get to
// ride it"): the first hull is not handed over the moment the programme issues it; it stands in its berth as a printed wire for `seconds`
// of the story clock, filling in, and only at 1 does the hand-over run (src/fx/hull-issue.js 'finishing'). Pure.
//   finishProgress(elapsed, seconds) -> 0..1 (seconds <= 0: 1, no print)
//   finishLookDue({ elapsed, look, hold }) -> true while the close-up should still be asked for: inside the first `look` seconds and the
//     close-up gate clear (hold null, src/domain/closeup-gate.js)
export function finishProgress(elapsed, seconds) {
  if (!(seconds > 0)) return 1;
  return Math.max(0, Math.min(1, (elapsed || 0) / seconds));
}

export function finishLookDue({ elapsed = 0, look = 0, hold = null } = {}) {
  return look > 0 && elapsed < look && hold === null;
}
