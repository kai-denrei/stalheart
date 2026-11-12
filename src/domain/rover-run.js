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
// more round it, it turns for home with what it has (RETREATING); at home it holds a standing order (HOLDING · ENEMIES) until the flare's ground and
// the ground it turned round on are down to tune.retreat.clear bodies. No host.threat or no tune.retreat: no such rule (the rover of round 8).
// THE TANK'S GROUND (owner, 2026-11-12: "yushi-rover must have the same collision logic as the tank; walls, rocks, etc."): host.path routes over
// the cells the tank may stand on (src/domain/drive-ground.js); host.path(from, to, within) ends on `to` when it is open, else on the nearest
// open cell within `within` cells of it (tune.reach: a flare or a pile in a sinkhole's pad, on a wall or a rock is raked from its rim; the
// cell it rakes from is `stand`, the path's last cell). Optional host hands, each absent in the rover of round 8:
//   open(cell)         the cell still open: every `tune.recheck` s the road ahead is checked, and a cell gone (a wall, a building, a sinkhole)
//                      sends it round by a new path to the same goal (REROUTE); no path and it holds where it stands (NO ROAD / NO ROAD
//                      HOME on the console), asking again every recheck, never jumping
//   wait(run)          the way ahead is shut for now (a door still opening): it holds its place on the road
//   at(path, s)        the index of the path's cell it stands on at `s` metres (the drawn road is not the cells' own spacing)
// THE ROVER DISABLED (owner, 2026-11-12: "leaning towards the tank doing sorties and protection missions of the yushi-rover collecting biomass"):
// tune.disable = { bites, every, floor, cells, seconds }. Every jab at it counts (bite(), an empty hold too: it is the rover that is attacked);
// the `bites`-th on one trip disables it where it stands (run.disabled, DISABLED on the console): it neither drives, rakes nor retreats; the
// hunters keep biting, one bite in `every` s at most, the hold down to `floor` of its capacity and no lower. It stays until the tank (only the
// tank: host.tank() -> cells from the hull to the rover, null when the hull is down) stands within `cells` of it for `seconds` (RESTARTING, the
// hold's clock running down again as fast while the tank is away); then it goes on with its trip as it was (out, rake or home), the count at 0.
// A new trip starts the count at 0. No tune.disable: the rover of 2026-11-12 (bitten, never disabled).
export const ROVER_MODES = Object.freeze(['idle', 'out', 'harvest', 'home', 'unload', 'full']);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createRoverRun(tune, home, heading = 0) {
  return { tune, home, cell: home, heading, mode: 'idle', cargo: 0, path: null, s: 0, length: 0, turn: null, k: 0, goal: null, stand: null, stuck: false, wait: false, recheck: 0, order: null, queued: null, pile: null, fled: null,
    skip: new Set(), trips: 0, delivered: 0, harvested: 0, bitten: 0, note: '', events: [], rake: 0, pour: 0, jabs: 0, disabled: null, disables: 0 };
}

const note = (run, now, ev, extra = {}) => { run.events.push({ t: +now.toFixed(2), ev, mode: run.mode, cargo: Math.round(run.cargo), ...extra }); if (run.events.length > 64) run.events.shift(); };

// an order: `flare` is { id, cell }. Returns 'now' when the rover was idle (it leaves on the next step) or 'queued'
export function dispatch(run, flare) {
  run.queued = flare;
  return run.mode === 'idle' ? 'now' : 'queued';
}

// set off along a path: the turn on the spot first, then the roll
function setOff(run, path, host, goal = path.at(-1)) {
  run.path = path; run.s = 0; run.k = 0; run.goal = goal; run.within = run.tune.reach; run.stuck = false; run.wait = false; run.length = host.length(path);
  const to = path.length > 1 ? host.bearing(path[0], path[1]) : run.heading, d = wrap(to - run.heading);
  run.turn = Math.abs(d) > 1e-3 && run.tune.turn > 0 ? { from: run.heading, to: run.heading + d, left: Math.abs(d) / run.tune.turn, total: Math.abs(d) / run.tune.turn } : null;
}
// one step along the path: true on arrival (the rover stands on the path's last cell)
function roll(run, dt, host) {
  if (!run.path) return !run.stuck;
  if (run.turn) { run.turn.left -= dt; if (run.turn.left > 0) return false; run.heading = run.turn.to; dt = -run.turn.left; run.turn = null; }
  run.wait = !!host.wait?.(run); if (run.wait) return false;   // a door ahead still opening: it holds its place
  run.s = Math.min(run.length, run.s + run.tune.speed * dt);
  run.k = Math.min(run.path.length - 1, Math.max(0, host.at ? host.at(run.path, run.s) : Math.round(run.length > 0 ? (run.s / run.length) * (run.path.length - 1) : 0)));
  // the heading follows the segment it is on, so the turn at the end starts from where it really points
  const k = Math.min(run.path.length - 2, run.k);
  if (k >= 0) run.heading = host.bearing(run.path[k], run.path[k + 1]);
  if (run.s < run.length - 1e-9) return false;
  run.cell = run.path.at(-1); run.path = null;
  return true;
}
// the lattice cell it stands on along its road (run.cell is the road's first cell until it arrives)
function here(run) {
  if (!run.path || run.path.length < 2 || !(run.length > 0)) return run.cell;
  return run.path[Math.min(run.path.length - 1, run.k)];
}
// THE ROAD AHEAD CUT (2026-11-12): a new path from where it stands to the same goal, or a hold where it stands (no jump)
const NO_ROAD = new Set(['NO ROAD', 'NO ROAD HOME']);
function reroute(run, now, host) {
  const from = here(run), goal = run.goal ?? from;
  run.cell = from; run.path = null; run.turn = null; run.s = 0; run.length = 0;
  const path = from === goal ? [from] : host.path(from, goal, run.within ?? run.tune.reach);
  if (!path) {
    if (!run.stuck) { run.stuck = true; run.note = run.mode === 'home' ? 'NO ROAD HOME' : 'NO ROAD'; note(run, now, 'stuck', { goal }); }
    return false;
  }
  const was = run.stuck; setOff(run, path, host, goal);
  if (run.mode === 'harvest' && run.pile !== null) run.stand = path.at(-1);
  if (NO_ROAD.has(run.note)) run.note = '';
  note(run, now, was ? 'road' : 'reroute', { goal, cells: path.length });
  return true;
}
const HOLD = 'HOLDING · ENEMIES', RETREAT = 'RETREATING';
const hot = (run, host, cell, n) => !!run.tune.retreat && typeof host.threat === 'function' && host.threat(cell) >= n;
function retreat(run, now, host) {
  run.cell = here(run); run.path = null; run.fled = run.cell; goHome(run, now, host, 'enemies');   // `fled`: where it turned round; that ground must clear too before it goes back out (no yo-yo on a held road)
  if (run.mode === 'home' && run.path) run.note = RETREAT;
}
function goHome(run, now, host, why) {
  const path = run.cell === run.home ? [run.home] : host.path(run.cell, run.home);
  run.mode = 'home'; run.pile = null; run.stand = null;
  if (!path) { run.note = 'NO ROAD HOME'; run.path = null; run.goal = run.home; run.stuck = true; run.recheck = run.tune.recheck ?? 1; note(run, now, 'stuck', { goal: run.home }); return; }
  run.note = ''; setOff(run, path, host); note(run, now, 'home', { why, m: +run.length.toFixed(1) });
}

// disabled: the tank's hold on it, the restart when it has held long enough (true: it goes on this step)
function restart(run, dt, now, host) {
  const D = run.tune.disable, d = run.disabled, near = host.tank?.(run);
  d.hold = near != null && near <= D.cells ? d.hold + dt : Math.max(0, d.hold - dt);
  if (d.hold < D.seconds) return false;
  run.disabled = null; run.jabs = 0; run.note = ''; run.recheck = 0; note(run, now, 'restarted', { after: +(now - d.at).toFixed(1) });
  return true;
}
export function stepRover(run, dt, now, host) {
  const T = run.tune;
  if (!(dt > 0)) return run;
  if (run.disabled && !restart(run, dt, now, host)) return run;
  if (run.mode === 'idle') {
    let order = null;
    if (run.queued && host.live(run.queued)) order = run.queued;
    else if (run.order && host.live(run.order) && host.near(run.order.cell, T.reach).some((p) => !run.skip.has(p.cell))) order = run.order;   // a standing flare over piles it can reach: back for the rest
    run.queued = null;
    if (!order) { run.order = null; run.fled = null; if (run.note === HOLD) run.note = ''; return run; }
    if (hot(run, host, order.cell, (T.retreat?.clear ?? 0) + 1) || (run.fled != null && hot(run, host, run.fled, (T.retreat?.clear ?? 0) + 1))) {   // the flare's ground is not clear yet: the order stands, the rover waits
      if (order !== run.order) run.queued = order;
      if (run.note !== HOLD) { run.note = HOLD; note(run, now, 'hold', { flare: order.id }); }
      return run;
    }
    const path = run.cell === order.cell ? [run.cell] : host.path(run.cell, order.cell, T.reach);
    if (!path) { run.note = 'NO ROAD'; run.order = null; note(run, now, 'no-road', { flare: order.id }); return run; }
    if (order !== run.order) run.skip.clear();   // the piles it could not reach are remembered per order
    run.order = order; run.note = ''; run.fled = null; run.mode = 'out'; run.jabs = 0; setOff(run, path, host); note(run, now, 'out', { flare: order.id, cell: order.cell, m: +run.length.toFixed(1) });
    return run;
  }
  if ((run.mode === 'out' || run.mode === 'harvest') && hot(run, host, null, T.retreat?.bodies)) { retreat(run, now, host); return run; }
  // the road ahead checked every recheck s (a wall, a building, a sinkhole across it: round by a new path); held without one, asked again
  if ((run.path || run.stuck) && ['out', 'home', 'harvest'].includes(run.mode) && typeof host.open === 'function' && (run.recheck -= dt) <= 0) {
    run.recheck = T.recheck ?? 1;
    if (run.stuck || run.path.slice(run.k + 1).some((c) => !host.open(c))) reroute(run, now, host);
  }
  if (run.mode === 'out') {
    if (run.stuck) { if (!host.live(run.order)) goHome(run, now, host, 'flare out'); return run; }   // no road to a flare that burnt out: home
    if (roll(run, dt, host)) { run.mode = 'harvest'; run.pile = null; run.stand = null; note(run, now, 'arrive', { cell: run.cell }); }
    return run;
  }
  if (run.mode === 'harvest') {
    if (run.cargo >= T.capacity - 1e-6) { goHome(run, now, host, 'hold full'); return run; }
    if (run.stuck && run.pile !== null) { run.skip.add(run.pile); run.pile = null; run.stand = null; run.stuck = false; run.note = ''; }   // cut off from that pile: the next
    if (run.path) { if (!roll(run, dt, host)) return run; }
    if (run.stuck) return run;
    if (run.pile === null) {
      const piles = host.near(run.order?.cell ?? run.cell, T.reach).filter((p) => !run.skip.has(p.cell));
      if (!piles.length) { goHome(run, now, host, run.cargo > 0 ? 'ground bare' : 'nothing there'); return run; }
      const p = piles[0], path = p.cell === run.cell ? null : host.path(run.cell, p.cell, T.reach);
      if (p.cell !== run.cell && !path) { run.skip.add(p.cell); return run; }
      run.pile = p.cell; run.stand = path ? path.at(-1) : run.cell;   // the open cell it rakes from: the pile's own, or the one beside it
      if (path) { setOff(run, path, host, p.cell); return run; }
    }
    if (run.cell !== run.stand) return run;
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
    if (!run.path && run.cell !== run.home) { if (!run.stuck) goHome(run, now, host, 'retry'); return run; }   // held: the recheck asks again
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
// HALF THE FLAGGED GROUND (the economy design 2.6, 2026-11-12: "banking it all for free made the trip, and the escort, pointless at every sector's
// end"): a flagged pile banks tune.breakShare of its kg (1 when unset, the rule of round 8); the rest stays on the ground, still seeping
// -> { cargo, field, kept }: kg banked from the hold, from the flagged piles, and left aboard
export function settleBreak(run, now, host) {
  const T = run.tune, out = { cargo: 0, field: 0, kept: 0 };
  if (run.cargo > 0) { const got = Math.max(0, Math.min(run.cargo, host.deposit(run.cargo))); run.cargo -= got; run.delivered += got; out.cargo = got; }
  const seen = new Set();
  for (const f of host.flares ?? []) for (const p of host.near(f.cell, T.reach)) {
    if (seen.has(p.cell)) continue; seen.add(p.cell);
    const ask = Math.floor(Math.min(p.kg * (T.breakShare ?? 1), host.room())); if (ask < 1) continue;
    const n = host.take(p.cell, ask), got = Math.max(0, host.deposit(n));
    run.harvested += n; run.delivered += got; out.field += got;
  }
  if (out.cargo + out.field > 0) run.trips++;
  out.kept = Math.round(run.cargo);
  Object.assign(run, { disabled: null, jabs: 0, mode: run.cargo > 0 ? 'full' : 'idle', cell: run.home, path: null, s: 0, length: 0, turn: null, k: 0, goal: null, stand: null, stuck: false, wait: false, order: null, queued: null, pile: null, rake: 0, pour: 0, note: '' });
  run.skip.clear();
  note(run, now, 'break', { banked: Math.round(out.cargo + out.field), kept: out.kept });
  return out;
}

// THE ROVER BITTEN (the economy design 2.6, 2026-11-12: "each jab's peak eats 100 kg from its hold (lost) ... No hit points; it cannot be destroyed"):
// up to `kg` off the cargo, returned; run.bitten counts what was lost. With tune.disable (above): the jab counted, the `bites`-th of the trip
// disables it; disabled, one bite in disable.every s at most, never below disable.floor of the capacity
export function bite(run, kg, now = 0) {
  const D = run.tune.disable;
  if (D && run.disabled) {
    if (now - run.disabled.bitAt < D.every) return 0;
    const n = Math.max(0, Math.min(run.cargo - D.floor * run.tune.capacity, kg));
    if (!(n > 0)) return 0;
    run.disabled.bitAt = now; run.cargo -= n; run.bitten = (run.bitten ?? 0) + n; note(run, now, 'bitten', { kg: Math.round(n), disabled: true });
    return n;
  }
  const n = Math.max(0, Math.min(run.cargo, kg));
  if (n > 0) { run.cargo -= n; run.bitten = (run.bitten ?? 0) + n; note(run, now, 'bitten', { kg: Math.round(n) }); }
  if (D && ['out', 'harvest', 'home'].includes(run.mode) && ++run.jabs >= D.bites) {
    run.disabled = { at: now, hold: 0, bitAt: now }; run.disables = (run.disables ?? 0) + 1; run.note = ''; note(run, now, 'disabled', { jabs: run.jabs });
  }
  return n;
}
// the restart's progress 0..1 while disabled (the ring round it, the console's RESTARTING n %), else null
export const restartShare = (run) => (run.disabled && run.tune.disable ? Math.min(1, run.disabled.hold / run.tune.disable.seconds) : null);
// the lattice cell it stands on, on its road or at a pile (the hunters' goal cell)
export const roverCell = (run) => here(run);
// what the readouts say: the mode's word and the kg aboard (the hull console's ROVER line)
export function roverWord(run) {
  if (run.disabled) { const W = run.tune.disable?.words ?? {}, k = restartShare(run); return k > 0 ? `${W.restarting ?? 'RESTARTING'} ${Math.floor(k * 100)} %` : W.disabled ?? 'DISABLED'; }
  if (run.mode === 'full') return 'STORAGE FULL';
  if (run.note) return run.note;
  return { idle: 'HOME', out: 'OUT', harvest: 'HARVEST', home: 'RETURNING', unload: 'UNLOADING' }[run.mode] ?? run.mode.toUpperCase();
}
