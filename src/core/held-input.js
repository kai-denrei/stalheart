// WHAT HAPPENS TO A HELD KEY WHEN THE PAGE STOPS LISTENING.
//
// A trigger is held between a press and its release, and the release is an
// EVENT — so anything that takes the events away between the two leaves the
// game holding a key nobody is pressing. Taking a screenshot does exactly
// that (owner, 2026-09-16: "it gets stuck on auto-fire and makes an annoying
// repeated clicking sound"): the shot's own modifier chord moves focus off
// the document, the keyup lands somewhere else, and the weapon goes on
// firing — or, when it cannot fire, goes on SAYING it cannot, once a frame.
//
// The rule is the same for every seat: when the page loses the input, drop
// everything that is held. Which events count is the only judgement here, so
// it is a pure predicate rather than four copies of an inline condition.
//
//   blur              the window is no longer the keyboard's destination
//   visibilitychange  only when the page went HIDDEN; coming back holds nothing
//   pointerlockchange only when a lock we HAD is now gone; taking one is fine
//   mouseleave        the pointer left the canvas, so a mouse trigger is over
//
// No DOM here: the caller reads its own document and passes what it saw.

export const RELEASE_EVENTS = Object.freeze(['blur', 'visibilitychange', 'pointerlockchange', 'mouseleave']);

// `hidden` is document.visibilityState === 'hidden'; `locked` whether a
// pointer lock is held NOW; `wasLocked` whether one was held a moment ago.
export function releasesHeld(type, { hidden = false, locked = false, wasLocked = false } = {}) {
  if (type === 'blur' || type === 'mouseleave') return true;
  if (type === 'visibilitychange') return hidden;
  if (type === 'pointerlockchange') return wasLocked && !locked;
  return false;
}

// Drop every named flag on a held-input record, and report how many were
// actually down — the callers use the count to decide whether anything more
// (a stopped loop, a cleared auto-repeat) needs doing.
export function releaseHeld(state, names) {
  let released = 0;
  for (const name of names) {
    if (state[name]) released++;
    state[name] = false;
  }
  return released;
}
