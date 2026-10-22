// THE CONTROL WATCHDOG (moved out of src/td-tab.js, refactor round 4, 2026-10-22, as the controller had it). It watches for the
// symptom as the player describes it — asking the tank to move and the tank not moving — rather than for any one cause, and prints
// the whole gate row when it happens. Always on: the bug is rare and lives on the operator's phone, so a probe that only runs under
// a flag is a probe that will never see it. One line per episode (re-armed only after the tank moves again), so a genuinely wedged
// hull cannot flood the console. The gate row itself (ctlState) stays with the controller's lets; it comes in as `state(tag)`.
// host: { player, keys, cellSide(), cruise(), throttle(), paused(), state(tag) }
export const CTL_DRIVE_KEYS = ['w', 's', 'a', 'd',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

export function createCtlWatch(host) {
  const { player, keys, cellSide, cruise, throttle, paused, state } = host;
  let ctlStillFor = 0, ctlBarked = false;
  const ctlLastPos = [0, 0, 0];
  // RAW INPUT, READ BEFORE ANYTHING CAN SWALLOW IT. The first cut of this
  // watchdog asked `keys.fast || ...`, which is the game's BELIEF about the
  // input — so the one failure mode that matters most, a capture-phase
  // listener eating keydown before the game ever sees it, made the watchdog
  // go quiet instead of loud. Registered at init, so it sits ahead of any
  // listener a cinematic adds later and records the press either way.
  let ctlRawT = -9, ctlRawKey = '';
  addEventListener('keydown', (ev) => {
    const k = (ev.key || '').toLowerCase();
    if (CTL_DRIVE_KEYS.includes(k)) { ctlRawT = performance.now() / 1000; ctlRawKey = k; }
  }, true);
  let ctlSwallowBarked = false;

  function tick(dt) {
    // what the player is asking for, not what the game decided to do with it
    const asking = keys.fast || keys.slow || cruise() || throttle() !== 0;
    const moved = Math.abs(player.pos[0] - ctlLastPos[0])
      + Math.abs(player.pos[1] - ctlLastPos[1])
      + Math.abs(player.pos[2] - ctlLastPos[2]);
    ctlLastPos[0] = player.pos[0]; ctlLastPos[1] = player.pos[1]; ctlLastPos[2] = player.pos[2];
    // a real drive step is orders of magnitude above this; the threshold is
    // here so hover bob and cushion nudges do not read as movement
    if (moved > cellSide() * 1e-4) { ctlStillFor = 0; ctlBarked = false; return; }
    if (!asking || player.won || paused()) { ctlStillFor = 0; return; }
    ctlStillFor += dt;
    // INPUT SWALLOWED: the player is pressing a drive key and the game's
    // key state never sees it. Reported separately because it is a different
    // fault from a latched gate — something is eating the event.
    const rawAge = performance.now() / 1000 - ctlRawT;
    const gameSees = keys.fast || keys.slow || keys.left || keys.right;
    if (rawAge < 0.5 && !gameSees && !ctlSwallowBarked) {
      ctlSwallowBarked = true;
      console.log(`CTL-SWALLOWED raw '${ctlRawKey}' pressed but keys are all`
        + ` false — something is eating keydown. ${state('swallowed')}`);
    }
    if (gameSees) ctlSwallowBarked = false;
    // a second of asking is well past a wall bump or a frozen beat
    if (ctlStillFor > 1.0 && !ctlBarked) {
      ctlBarked = true;
      console.log(`CTL-DEAD asked ${ctlStillFor.toFixed(1)}s, no motion — ${state('dead')}`);
    }
  }
  return { tick, stillFor: () => ctlStillFor, raw: () => ({ key: ctlRawKey, at: ctlRawT }) };
}
