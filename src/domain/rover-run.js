// THE YUSHI ROVER'S RUN (owner, 2026-11-05, round 8 note 7: "the tank drops temporary flares like Isao, which dispatches the Yushi Rover to come
// collect the biomass (it is not automatic anymore), and it brings the biomass back to the Yushi045 biopearl"). A finite state machine in the
// manner of the author's mission.js (kept in the vault as the reference, not vendored: it carries its own field and depot), on the game's lattice:
//   idle     at home on the depot island; a flare's order sends it out (the newest order while idle; one dropped while it works waits as `queued`)
//   out      along a cell path to the flare's cell, after turning on the spot to the path's first bearing (`turn` rad/s)
//   harvest  the piles within `reach` of the flare, nearest first: it drives onto each and takes `harvestRate` kg/s until its `capacity` is
//            aboard or the flare's ground is bare
//   home     back along a cell path to the home cell
//   unload   into the pearls at `unloadRate` kg/s (host.deposit says what fitted)
//   full     STORAGE FULL: the pearls took less than it offered; it waits at home with the rest aboard, offering again every step
// Back to idle with the hold empty. A flare still standing over piles is still an order: the rover goes back out for the rest (the player's
// flare decides the risk; it may lead the rover out of the clearing, where nothing shoots at it this round). Pure: the host hands it
//   path(from, to) -> [cells] | null, length(cells) -> metres, bearing(a, b) -> radians, near(cell, reach) -> [{ cell, kg }] nearest first,
//   take(cell, kg) -> kg taken, deposit(kg) -> kg that fitted, live(order) -> the order's flare still stands
// TOO MANY ENEMIES (owner, 2026-11-10: "it must go back to base if too full, or if they are too many enemies"): host.threat(cell | null) counts
// the live bodies within tune.retreat.cells of a cell, or of the rover itself for null. On its way out or at the rake with tune.retreat.bodies or
// more round it, it turns for home with what it has (RETREATING); at home it holds a standing order (HOLDING · ENEMIES) until the flare's ground is
// down to tune.retreat.clear bodies. No host.threat or no tune.retreat: no such rule (the rover of round 8).
export const ROVER_MODES = Object.freeze(['idle', 'out', 'harvest', 'home', 'unload', 'full']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createRoverRun(tune, home, heading = 0) {
  return { tune, home, cell: home, heading, mode: 'idle', cargo: 0, path: null, s: 0, length: 0, turn: null, order: null, queued: null, pile: null,
    skip: new Set(), trips: 0, delivered: 0, harvested: 0, note: '', events: [], rake: 0, pour: 0 };
}

const note = (run, now, ev, extra = {}) => { run.events.push({ t: +now.toFixed(2), ev, mode: run.mode, cargo: Math.round(run.cargo), ...extra }); if (run.events.length > 64) run.events.shift(); };

// an order: `flare` is { id, cell }. Returns 'now' when the rover was idle (it leaves on the next step) or 'queued'
export function dispatch(run, flare) {
  run.queued = flare;
  return run.mode === 'idle' ? 'now' : 'queued';
}

// set off along a path: the turn on the spot first, then the roll
function setOff(run, path, host) {
  run.path = path; run.s = 0; run.length = host.length(path);
  const to = path.length > 1 ? host.bearing(path[0], path[1]) : run.heading, d = wrap(to - run.heading);
  run.turn = Math.abs(d) > 1e-3 && run.tune.turn > 0 ? { from: run.heading, to: run.heading + d, left: Math.abs(d) / run.tune.turn, total: Math.abs(d) / run.tune.turn } : null;
}
// one step along the path: true on arrival (the rover stands on the path's last cell)
function roll(run, dt, host) {
  if (!run.path) return true;
  if (run.turn) { run.turn.left -= dt; if (run.turn.left > 0) return false; run.heading = run.turn.to; dt = -run.turn.left; run.turn = null; }
  run.s = Math.min(run.length, run.s + run.tune.speed * dt);
  // the heading follows the segment it is on, so the turn at the end starts from where it really points
  const k = Math.min(run.path.length - 2, Math.floor(run.length > 0 ? (run.s / run.length) * (run.path.length - 1) : 0));
  if (k >= 0) run.heading = host.bearing(run.path[k], run.path[k + 1]);
  if (run.s < run.length - 1e-9) return false;
  run.cell = run.path.at(-1); run.path = null;
  return true;
}
// the lattice cell it stands on along its road (run.cell is the road's first cell until it arrives)
function here(run) {
  if (!run.path || run.path.length < 2 || !(run.length > 0)) return run.cell;
  return run.path[Math.min(run.path.length - 1, Math.round((run.s / run.length) * (run.path.length - 1)))];
}
const HOLD = 'HOLDING · ENEMIES', RETREAT = 'RETREATING';
const hot = (run, host, cell, n) => !!run.tune.retreat && typeof host.threat === 'function' && host.threat(cell) >= n;
function retreat(run, now, host) {
  run.cell = here(run); run.path = null; goHome(run, now, host, 'enemies');
  if (run.mode === 'home' && run.path) run.note = RETREAT;
}
function goHome(run, now, host, why) {
  const path = run.cell === run.home ? [run.home] : host.path(run.cell, run.home);
  run.mode = 'home'; run.pile = null;
  if (!path) { run.note = 'NO ROAD HOME'; run.path = null; note(run, now, 'stuck'); return; }
  run.note = ''; setOff(run, path, host); note(run, now, 'home', { why });
}

export function stepRover(run, dt, now, host) {
  const T = run.tune;
  if (!(dt > 0)) return run;
  if (run.mode === 'idle') {
    let order = null;
    if (run.queued && host.live(run.queued)) order = run.queued;
    else if (run.order && host.live(run.order) && host.near(run.order.cell, T.reach).some((p) => !run.skip.has(p.cell))) order = run.order;   // a standing flare over piles it can reach: back for the rest
    run.queued = null;
    if (!order) { run.order = null; if (run.note === HOLD) run.note = ''; return run; }
    if (hot(run, host, order.cell, (T.retreat?.clear ?? 0) + 1)) {   // the flare's ground is not clear yet: the order stands, the rover waits
      if (order !== run.order) run.queued = order;
      if (run.note !== HOLD) { run.note = HOLD; note(run, now, 'hold', { flare: order.id }); }
      return run;
    }
    const path = run.cell === order.cell ? [run.cell] : host.path(run.cell, order.cell);
    if (!path) { run.note = 'NO ROAD'; run.order = null; note(run, now, 'no-road', { flare: order.id }); return run; }
    if (order !== run.order) run.skip.clear();   // the piles it could not reach are remembered per order
    run.order = order; run.note = ''; run.mode = 'out'; setOff(run, path, host); note(run, now, 'out', { flare: order.id, cell: order.cell });
    return run;
  }
  if ((run.mode === 'out' || run.mode === 'harvest') && hot(run, host, null, T.retreat?.bodies)) { retreat(run, now, host); return run; }
  if (run.mode === 'out') {
    if (roll(run, dt, host)) { run.mode = 'harvest'; run.pile = null; note(run, now, 'arrive', { cell: run.cell }); }
    return run;
  }
  if (run.mode === 'harvest') {
    if (run.cargo >= T.capacity - 1e-6) { goHome(run, now, host, 'hold full'); return run; }
    if (run.path) { if (!roll(run, dt, host)) return run; }
    if (run.pile === null) {
      const piles = host.near(run.order?.cell ?? run.cell, T.reach).filter((p) => !run.skip.has(p.cell));
      if (!piles.length) { goHome(run, now, host, run.cargo > 0 ? 'ground bare' : 'nothing there'); return run; }
      const p = piles[0], path = p.cell === run.cell ? null : host.path(run.cell, p.cell);
      if (p.cell !== run.cell && !path) { run.skip.add(p.cell); return run; }
      run.pile = p.cell;
      if (path) { setOff(run, path, host); return run; }
    }
    if (run.cell !== run.pile) return run;
    // WHOLE KILOS (the bank is an integer the HUD prints): the rake and the pour carry their fractions from step to step
    run.rake += T.harvestRate * dt;
    const ask = Math.min(Math.floor(run.rake), T.capacity - run.cargo);
    if (ask < 1) return run;
    const n = host.take(run.pile, ask);
    run.rake -= ask; run.cargo += n; run.harvested += n;
    if (!(n > 0)) run.pile = null;   // the pile is gone (taken or rotted): the next one
    return run;
  }
  if (run.mode === 'home') {
    if (!run.path && run.cell !== run.home) { goHome(run, now, host, 'retry'); return run; }
    if (roll(run, dt, host)) { run.mode = run.cargo > 0 ? 'unload' : 'idle'; if (run.note === RETREAT) run.note = ''; note(run, now, run.cargo > 0 ? 'dock' : 'parked'); }
    return run;
  }
  if (run.mode === 'unload' || run.mode === 'full') {
    run.pour = Math.min(run.pour + T.unloadRate * dt, T.unloadRate);
    const want = Math.min(Math.floor(run.pour), Math.ceil(run.cargo));
    if (want < 1) return run;
    const got = Math.max(0, Math.min(want, host.deposit(want)));
    run.pour -= want;
    run.cargo -= got; run.delivered += got;
    if (run.cargo <= 1e-6) { run.cargo = 0; run.trips++; run.mode = 'idle'; note(run, now, 'unloaded', { delivered: Math.round(run.delivered) }); return run; }
    const full = got < want - 1e-9;
    if (full && run.mode !== 'full') { run.mode = 'full'; note(run, now, 'storage-full'); }
    else if (!full && run.mode === 'full') { run.mode = 'unload'; note(run, now, 'room'); }
  }
  return run;
}

// THE ROVER FINISHES ITS RUN DURING THE BREAK (round 8, 2026-11-06, the coordinator's pacing follow-up on --ledger: sector 1's 137 s on a ~470 m road
// fit no trip, and the debrief and the board pause the game mid-trip, so the board before sector 2 saw 700-1,031 kg against round 6's ~6.3k bar).
// When a sector ends, the work already ordered is banked as if the trip had been completed, in this order and under the cap: (1) the cargo aboard,
// (2) every pile within `reach` of a STANDING flare (flagged, not yet raked), oldest flare first, nearest pile first. Unflagged piles stay on the
// ground and keep rotting: the owner's "it is not automatic anymore" stands, the field must have been flagged. Cargo that does not fit stays aboard
// (the rover waits home, STORAGE FULL); a pile that does not fit stays on the ground. The rover starts the next sector at home, its orders gone
// (the caller clears the flares). host: { flares: [{ id, cell }], near(cell, reach), take(cell, kg), deposit(kg) -> fitted, room() -> kg that still fit }
// -> { cargo, field, kept }: kg banked from the hold, from the flagged piles, and left aboard
export function settleBreak(run, now, host) {
  const T = run.tune, out = { cargo: 0, field: 0, kept: 0 };
  if (run.cargo > 0) { const got = Math.max(0, Math.min(run.cargo, host.deposit(run.cargo))); run.cargo -= got; run.delivered += got; out.cargo = got; }
  const seen = new Set();
  for (const f of host.flares ?? []) for (const p of host.near(f.cell, T.reach)) {
    if (seen.has(p.cell)) continue; seen.add(p.cell);
    const ask = Math.floor(Math.min(p.kg, host.room())); if (ask < 1) continue;
    const n = host.take(p.cell, ask), got = Math.max(0, host.deposit(n));
    run.harvested += n; run.delivered += got; out.field += got;
  }
  if (out.cargo + out.field > 0) run.trips++;
  out.kept = Math.round(run.cargo);
  Object.assign(run, { mode: run.cargo > 0 ? 'full' : 'idle', cell: run.home, path: null, s: 0, length: 0, turn: null, order: null, queued: null, pile: null, rake: 0, pour: 0, note: '' });
  run.skip.clear();
  note(run, now, 'break', { banked: Math.round(out.cargo + out.field), kept: out.kept });
  return out;
}

// what the readouts say: the mode's word and the kg aboard (the hull console's ROVER line)
export function roverWord(run) {
  if (run.mode === 'full') return 'STORAGE FULL';
  if (run.note) return run.note;
  return { idle: 'HOME', out: 'OUT', harvest: 'HARVEST', home: 'RETURNING', unload: 'UNLOADING' }[run.mode] ?? run.mode.toUpperCase();
}
