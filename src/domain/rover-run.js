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
export const ROVER_MODES = Object.freeze(['idle', 'out', 'harvest', 'home', 'unload', 'full']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createRoverRun(tune, home, heading = 0) {
  return { tune, home, cell: home, heading, mode: 'idle', cargo: 0, path: null, s: 0, length: 0, turn: null, order: null, queued: null, pile: null,
    skip: new Set(), trips: 0, delivered: 0, harvested: 0, note: '', events: [] };
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
    if (!order) { run.order = null; return run; }
    const path = run.cell === order.cell ? [run.cell] : host.path(run.cell, order.cell);
    if (!path) { run.note = 'NO ROAD'; run.order = null; note(run, now, 'no-road', { flare: order.id }); return run; }
    if (order !== run.order) run.skip.clear();   // the piles it could not reach are remembered per order
    run.order = order; run.note = ''; run.mode = 'out'; setOff(run, path, host); note(run, now, 'out', { flare: order.id, cell: order.cell });
    return run;
  }
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
    const n = host.take(run.pile, Math.min(T.harvestRate * dt, T.capacity - run.cargo));
    run.cargo += n; run.harvested += n;
    if (!(n > 0)) run.pile = null;   // the pile is gone (taken or rotted): the next one
    return run;
  }
  if (run.mode === 'home') {
    if (!run.path && run.cell !== run.home) { goHome(run, now, host, 'retry'); return run; }
    if (roll(run, dt, host)) { run.mode = run.cargo > 0 ? 'unload' : 'idle'; note(run, now, run.cargo > 0 ? 'dock' : 'parked'); }
    return run;
  }
  if (run.mode === 'unload' || run.mode === 'full') {
    const want = Math.min(T.unloadRate * dt, run.cargo), got = Math.max(0, Math.min(want, host.deposit(want)));
    run.cargo -= got; run.delivered += got;
    if (run.cargo <= 1e-6) { run.cargo = 0; run.trips++; run.mode = 'idle'; note(run, now, 'unloaded', { delivered: Math.round(run.delivered) }); return run; }
    const full = got < want - 1e-9;
    if (full && run.mode !== 'full') { run.mode = 'full'; note(run, now, 'storage-full'); }
    else if (!full && run.mode === 'full') { run.mode = 'unload'; note(run, now, 'room'); }
  }
  return run;
}

// what the readouts say: the mode's word and the kg aboard (the hull console's ROVER line)
export function roverWord(run) {
  if (run.mode === 'full') return 'STORAGE FULL';
  if (run.note) return run.note;
  return { idle: 'HOME', out: 'OUT', harvest: 'HARVEST', home: 'RETURNING', unload: 'UNLOADING' }[run.mode] ?? run.mode.toUpperCase();
}
