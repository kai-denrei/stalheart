// camShot: ONE timed camera override, ONE teardown (moved out of src/td-tab.js, 2026-09-30).
// Every timed camera takeover in the tab used to own its own clock, its own skip listeners and its own teardown, and each teardown
// was a fresh chance to get it wrong. One did: endCinematic() guarded on `cineLeft <= 0` while the frame loop had already driven it
// there, so it returned BEFORE removing a capture-phase keydown handler that preventDefaults and stopImmediatePropagations. That
// handler then ate every key in the game, permanently (operator: "I still cannot move after the cinematic").
// So: one shot at a time, one teardown path, and the latch is the shot ITSELF, never a clock somebody else has already advanced past.
//
// A SHOT AND A DEPLOY BOTH OWN THE CAMERA, and both have a KNOWN length, so either one hanging is detectable without knowing why it
// hung (operator, 2026-09-05: "the view is stuck not in 3rd person, nor in top view, something else unplayable"). The view watchdog
// cannot see it: a cinematic is a shot OF the tank and keeps it in frame. So a liveness check on the clock, not on the pose: a shot
// running its own duration plus SHOT_GRACE is hung, whatever hung it, and is ended. `hung(what)` books the deploy's watch too.
//
// SOUND BEFORE SKIP (owner, 2026-09-30: "the landing needs a sound of rocket thrusters landing and gears moving"). The browser
// starts audio on the first gesture, and any gesture skipped a shot, so a shot that opens a page (the arrival) was always silent.
// `unlock: true` spends the first gesture on the sound; the next one skips.
const SHOT_GRACE = 4.0;

// `target`: the element whose taps skip; `snap()`: put the camera on the shot's first pose now; `pass(shot, ev)`: true lets a
// gesture through without skipping (a card's own button)
export function createCameraShots({ target, snap, pass = () => false }) {
  let shot = null, fires = 0, last = '';   // shot: { id, dur, left, poseAt, onEnd, skippable, unlock, age }
  const skip = (ev, key) => {
    if (!shot || !shot.skippable) return;
    if (shot.id === 'breach') { end(); return; }
    if (!key && pass(shot, ev)) return;
    if (key) ev.preventDefault();
    ev.stopImmediatePropagation();
    if (shot.unlock) { shot.unlock = false; return; }   // this gesture started the sound
    end();
  };
  const onKey = (ev) => skip(ev, true), onTap = (ev) => skip(ev, false);
  function start({ id, dur, poseAt, onEnd = null, skippable = true, unlock = false }) {
    end();   // one at a time, and the outgoing one always tears down
    shot = { id, dur: Math.max(1e-3, dur), left: Math.max(1e-3, dur), poseAt, onEnd, skippable, unlock, age: 0 };
    if (skippable) { addEventListener('keydown', onKey, true); target.addEventListener('pointerdown', onTap, true); }
    snap();   // no glide in: the shot owns frame one
  }
  // idempotent; `shot` is cleared before onEnd runs, so a shot whose ending starts another cannot recurse into its own teardown
  function end() {
    if (!shot) return;
    const s = shot; shot = null;
    removeEventListener('keydown', onKey, true); target.removeEventListener('pointerdown', onTap, true);
    if (s.onEnd) s.onEnd();
  }
  function hung(what) { fires++; last = what; }
  function step(dt) {
    if (!shot) return;
    shot.age += dt; shot.left -= dt;
    if (shot.left <= 0) { end(); return; }
    if (shot.age > shot.dur + SHOT_GRACE) {
      const { id, age, dur } = shot;
      console.warn(`SHOTWATCH "${id}" hung: ${age.toFixed(1)}s into a ${dur.toFixed(1)}s shot — ended`);
      hung(`shot "${id}" ${age.toFixed(1)}s/${dur.toFixed(1)}s`); end();
    }
  }
  // the shot's pose at its progress into `out`; false without one
  const pose = (out) => { if (!shot) return false; shot.poseAt(Math.min(1, Math.max(0, 1 - shot.left / shot.dur)), out); return true; };
  return {
    start, end, step, hung, pose,
    get shot() { return shot; }, active: () => shot !== null, id: () => (shot ? shot.id : null),
    drop() { if (shot) { removeEventListener('keydown', onKey, true); target.removeEventListener('pointerdown', onTap, true); } shot = null; },   // a test reset: no onEnd
    watch: () => (fires ? `${fires}x ${last}` : 'none'),
  };
}
