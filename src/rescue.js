// rescue.js — THE RESCUE MISSION's rules: who is stranded and where, the
// ferry, the grab, the budget, the wave mix, and the verdict. Pure: no DOM,
// no three.js, Node-tested in test/rescue.mjs. td-tab owns the figures, the
// beacons, the radar chevrons and the sounds.
//
// Design: docs/superpowers/specs/2026-09-05-rescue-mission.md. The operator's
// brief was one paragraph — "a handful of astronauts stranded, requires smart
// use of limited mines and shells to save; lots of rammable enemies and just
// a handful of more difficult one to manage; more tactical" — and the spec
// names every decision taken on top of it. The three that matter most, and
// the reason each is a number here rather than a constant in the board:
//
//   THE STOP CLAUSE. Boarding needs the tank NEAR and SLOW, for a whole
//   second, and resets the moment either stops being true. Without it a
//   pick-up is something that happens while you drive past, which is not a
//   decision; standing still in the open with the horde coming is.
//
//   THE GRAB WINDOW. An enemy reaching a survivor does not kill them, it
//   holds them for grabSecs. Kill it inside that window and they stand up
//   again. A rescue lost in a frame you never saw is a rescue nobody feels
//   they lost fairly — and 1.5 s is exactly one shell, one ram, or one mine
//   you had the sense to lay earlier, which is the sentence the mode is about.
//
//   THE SEATS. Two. A survivor aboard cannot be killed except by losing the
//   hull, and then both go with it. That is what makes carrying a pair a bet
//   rather than an optimisation.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';
import { dot3 } from './vec3.js';

export const RESCUE_TUNE = {
  survivors: 6,
  seats: 2,
  bandMin: 6,          // cells (hops) from the heart: no one strands next door
  bandMax: 14,
  apart: 3,            // cells between two survivors — a field, not a huddle
  boardCells: 1.0,     // how close the hull must be
  boardSecs: 1.0,      // ...and for how long
  boardThrottle: 0.34, // ...with the lever under this. The stop clause, half of it —
  boardSpeed: 0.35,    // ...and the hull actually under this many cells/s, which is
                       // the half that also works on a phone: the shell has no
                       // throttle at all, so read off the lever alone the clause is
                       // unenforceable there and every drive-by would board.
  lockCells: 2.0,      // an enemy this close to a standing survivor peels off
  grabSecs: 1.5,       // the window to kill the grabber
  hulls: 3,
  shells: 8,
  mines: 6,
  // OFF, and the most overrulable number in the file. The beams cost heat,
  // not ammo, so with them on "limited shells" means nothing and the mission
  // is a driving exercise. The rescue hull is a transport with its
  // secondaries stripped.
  lasers: false,
};

export const RESCUE_KNOBS = [
  { key: 'survivors', label: 'stranded', group: 'mission', min: 1, max: 12, step: 1 },
  { key: 'seats', label: 'seats in the hull', group: 'mission', min: 1, max: 4, step: 1 },
  { key: 'bandMin', label: 'nearest (cells)', group: 'mission', min: 2, max: 20, step: 1 },
  { key: 'bandMax', label: 'farthest (cells)', group: 'mission', min: 4, max: 40, step: 1 },
  { key: 'apart', label: 'spacing (cells)', group: 'mission', min: 1, max: 8, step: 1 },
  { key: 'boardCells', label: 'board within (cells)', group: 'ferry', min: 0.4, max: 3, step: 0.1 },
  { key: 'boardSecs', label: 'board time (s)', group: 'ferry', min: 0.2, max: 4, step: 0.1 },
  { key: 'boardThrottle', label: 'board under throttle', group: 'ferry', min: 0.05, max: 1, step: 0.02 },
  { key: 'boardSpeed', label: 'board under (cells/s)', group: 'ferry', min: 0.05, max: 2, step: 0.05 },
  { key: 'lockCells', label: 'lock-on (cells)', group: 'threat', min: 0.5, max: 6, step: 0.5 },
  { key: 'grabSecs', label: 'grab window (s)', group: 'threat', min: 0.3, max: 6, step: 0.1 },
  { key: 'hulls', label: 'hulls', group: 'budget', min: 1, max: 6, step: 1 },
  { key: 'shells', label: 'shells', group: 'budget', min: 0, max: 30, step: 1 },
  { key: 'mines', label: 'mines', group: 'budget', min: 0, max: 30, step: 1 },
  { key: 'lasers', label: 'secondaries fitted', group: 'budget', bool: true },
];

export const makeRescueParams = (src = RESCUE_TUNE) => makeParams(RESCUE_KNOBS, src);
export const clampRescueParams = (p, src) => clampParams(RESCUE_KNOBS, p, src);
export const formatRescueTune = (p) => formatKnobs('RESCUE_TUNE', RESCUE_KNOBS, p);
export const rescueKnobProblems = () => knobProblems(RESCUE_KNOBS, RESCUE_TUNE);

// ===========================================================================
// RESCUE 2 — the raid. Design: docs/superpowers/specs/2026-09-05-rescue-2.md
//
// Rescue 1 is a defence with a ferry. This is a RAID: the map is static, the
// threat is pre-placed, and every camp is the same small problem — drive in
// (ramming the garrison is free, that is what it is for), get inside shot
// distance so the container opens, then STAND STILL while they walk out to
// you. A walker the moving hull touches is run over, and the splash of red
// stays on the floor for the rest of the run.
//
// The load-bearing inversion from Rescue 1: there, stopping was how you
// PICKED SOMEONE UP. Here, stopping is how you avoid KILLING them. Same
// verb, opposite stake, and the mission is entirely about that beat.
// ===========================================================================

export const RESCUE2_TUNE = {
  camps: 3,
  groupMin: 2, groupMax: 3,
  garrison: 10,        // rammable units ringed around a container
  hard: 1,             // ...and a solid one, from the second camp onward
  garrisonCells: 2.5,  // how far out the ring stands
  wakeCells: 6,        // a camp asleep until the tank is this close
  campApart: 12,       // cells between camps, and from the heart
  heartApart: 10,
  callCells: 4.0,      // SHOT DISTANCE — inside it the container opens
  emergeGap: 0.9,      // seconds between one walking out and the next
  walkSpeed: 1.1,      // cells per second, toward the tank
  boardCells: 0.9,     // ...and this close is aboard
  runoverSpeed: 0.6,   // hull faster than this, and contact kills instead
  grabSecs: 1.5,       // a hostile holding a walker — Rescue 1's window
  // THE BUDGET. A raid leans on the ram — which is free and is what the
  // garrisons are for — so it carries fewer shells than the defence does.
  hulls: 3, shells: 6, mines: 4, lasers: false,
};

export const RESCUE2_KNOBS = [
  { key: 'camps', label: 'camps', group: 'raid', min: 1, max: 8, step: 1 },
  { key: 'groupMin', label: 'group min', group: 'raid', min: 1, max: 5, step: 1 },
  { key: 'groupMax', label: 'group max', group: 'raid', min: 1, max: 6, step: 1 },
  { key: 'garrison', label: 'garrison (soft)', group: 'raid', min: 0, max: 30, step: 1 },
  { key: 'hard', label: 'garrison (solid)', group: 'raid', min: 0, max: 5, step: 1 },
  { key: 'garrisonCells', label: 'ring (cells)', group: 'raid', min: 1, max: 6, step: 0.5 },
  { key: 'wakeCells', label: 'wake (cells)', group: 'raid', min: 2, max: 16, step: 1 },
  { key: 'campApart', label: 'camps apart (cells)', group: 'raid', min: 3, max: 30, step: 1 },
  { key: 'heartApart', label: 'clear of heart (cells)', group: 'raid', min: 2, max: 30, step: 1 },
  { key: 'callCells', label: 'shot distance (cells)', group: 'extract', min: 1, max: 12, step: 0.5 },
  { key: 'emergeGap', label: 'emerge stagger (s)', group: 'extract', min: 0, max: 4, step: 0.1 },
  { key: 'walkSpeed', label: 'walk (cells/s)', group: 'extract', min: 0.2, max: 4, step: 0.1 },
  { key: 'boardCells', label: 'aboard within (cells)', group: 'extract', min: 0.3, max: 3, step: 0.1 },
  { key: 'runoverSpeed', label: 'run-over above (cells/s)', group: 'extract', min: 0.05, max: 3, step: 0.05 },
  { key: 'grabSecs', label: 'grab window (s)', group: 'extract', min: 0.3, max: 6, step: 0.1 },
];

export const makeRescue2Params = (src = RESCUE2_TUNE) => makeParams(RESCUE2_KNOBS, src);
export const rescue2KnobProblems = () => knobProblems(RESCUE2_KNOBS, RESCUE2_TUNE);

// THE CAMPS. `cands` are clearings — room centres — as { ci, d, pos }, `d`
// being hops from the heart. Same degrade-the-spacing rule Rescue 1 learned
// on an 84-cell board: the camp COUNT is the design, the spread is taste.
export function makeCamps(st, cands, rng, cellSide, tune = RESCUE2_TUNE) {
  const want = Math.round(tune.camps);
  const far = cands.filter((c) => c.d >= tune.heartApart);
  const order = far.map((c) => ({ c, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.c);
  let id = 1;
  for (let apart = tune.campApart; apart >= 0; apart -= 1) {
    st.camps.length = 0;
    st.survivors.length = 0;
    id = 1;
    const gap = apart * cellSide;
    for (const c of order) {
      if (st.camps.length >= want) break;
      if (gap > 0 && st.camps.some((k) => groundDist(k.pos, c.pos) < gap)) continue;
      const n = Math.round(tune.groupMin
        + rng() * Math.max(0, Math.round(tune.groupMax) - Math.round(tune.groupMin)));
      const camp = {
        id: st.camps.length + 1, ci: c.ci, pos: c.pos.slice(),
        open: false, awake: false, emergeT: 0, out: 0, group: [],
      };
      for (let k = 0; k < n; k++) {
        const sv = { id: id++, camp: camp.id, ci: c.ci, pos: c.pos.slice(),
          state: 'inside', boardT: 0, grabT: 0 };
        camp.group.push(sv);
        st.survivors.push(sv);
      }
      st.camps.push(camp);
    }
    st.campApart = apart;
    if (st.camps.length >= want) break;
  }
  st.short = want - st.camps.length;
  return st.camps;
}

// SHOT DISTANCE. Returns 'open' exactly on the frame it opens — the sound and
// the doors fire once, however many frames the tank then sits there.
export function stepCall(camp, tankPos, cellSide, tune = RESCUE2_TUNE) {
  if (!camp || camp.open) return null;
  if (groundDist(camp.pos, tankPos) > tune.callCells * cellSide) return null;
  camp.open = true;
  camp.emergeT = 0;
  return 'open';
}

// A garrison sleeps until the tank is near. A camp you have not reached
// should not be walking across the map at you; that is what makes them camps
// and not a wave. Once up, it stays up.
export function awake(camp, tankPos, cellSide, tune = RESCUE2_TUNE) {
  if (camp.awake) return true;
  camp.awake = groundDist(camp.pos, tankPos) <= tune.wakeCells * cellSide;
  return camp.awake;
}

// One walks out, then the next, on the stagger. Null when the clock has not
// come round or the container is empty.
export function stepEmerge(camp, dt, tune = RESCUE2_TUNE) {
  if (!camp.open) return null;
  camp.emergeT -= dt;
  if (camp.emergeT > 0) return null;
  const next = camp.group.find((s) => s.state === 'inside');
  if (!next) return null;
  camp.emergeT = tune.emergeGap;
  next.state = 'walking';
  camp.out++;
  return next;
}

// THE WALK. Toward the tank's CURRENT position along the great circle, re-
// aimed every frame — a tank that repositions is followed rather than walked
// past, which matters because repositioning is exactly what the player is
// tempted to do. Writes sv.pos and returns 'saved' on arrival.
export function walkStep(sv, tankPos, dt, cellSide, tune = RESCUE2_TUNE) {
  if (!sv || sv.state !== 'walking') return null;
  if (sv.grabT > 0) return null;                 // held: it is not going anywhere
  const d = groundDist(sv.pos, tankPos);
  if (d <= tune.boardCells * cellSide) { sv.state = 'saved'; return 'saved'; }
  const step = Math.min(d, tune.walkSpeed * cellSide * dt);
  // the unit tangent at sv.pos pointing at the tank, then arcPoint along it —
  // arc length, not a chord, the standing rule
  const n = sv.pos;
  const a = dot3(tankPos, n);
  const flat = [tankPos[0] - n[0] * a, tankPos[1] - n[1] * a, tankPos[2] - n[2] * a];
  const l = Math.hypot(flat[0], flat[1], flat[2]);
  if (l < 1e-12) return null;
  const u = [flat[0] / l, flat[1] / l, flat[2] / l];
  const c = Math.cos(step), s2 = Math.sin(step);
  sv.pos = [n[0] * c + u[0] * s2, n[1] * c + u[1] * s2, n[2] * c + u[2] * s2];
  sv.dir = u;                                    // the board points the model with this
  return null;
}

// RUN OVER. The same contact radius that saves them — the ONLY difference is
// whether the hull was moving. That is the mission in one predicate.
export function runOver(sv, tankPos, tankSpeed, cellSide, tune = RESCUE2_TUNE) {
  if (!sv || sv.state !== 'walking') return false;
  if (tankSpeed <= tune.runoverSpeed) return false;
  return groundDist(sv.pos, tankPos) <= tune.boardCells * cellSide;
}

// Great-circle distance between two surface points, in radians — which on a
// unit sphere IS arc length, the standing rule. Same parameterisation as
// mines.js and the beam; a chord here would quietly shrink every radius the
// further out a survivor stranded.
export const groundDist = (a, b) => {
  const c = Math.min(1, Math.max(-1, dot3(a, b) / (Math.hypot(...a) * Math.hypot(...b) || 1)));
  return Math.acos(c);
};

export function makeRescue(tune = RESCUE_TUNE) {
  return {
    survivors: [],   // { id, ci, pos, state, boardT, grabT }
    camps: [],       // RESCUE 2 only: { id, ci, pos, open, awake, emergeT, out, group }
    campApart: 0,    // the camp spacing it actually managed, in cells
    carried: 0,
    saved: 0,
    lost: 0,
    over: false,
    short: 0,        // how many the board could not hold
    apart: 0,        // the spacing it actually managed, in cells
  };
}

export const standing = (st) => st.survivors.filter((s) => s.state === 'standing').length;
// EXPOSED — out in the open and killable. Rescue 1 has one such state
// ('standing'); Rescue 2 adds 'walking', and a survivor still in a container
// is in neither. Every rule about being hurt reads this set rather than a
// literal, so the third mission's state joins by being added here once.
const EXPOSED = new Set(['standing', 'walking']);
export const exposed = (s) => !!s && EXPOSED.has(s.state);
// still to be accounted for: not saved, not dead. 'aboard' counts, which is
// what keeps Rescue 1 running through the drive home.
export const remaining = (st) => st.survivors.filter((s) => s.state !== 'saved' && s.state !== 'lost').length;
export const aboard = (st) => st.survivors.filter((s) => s.state === 'aboard').length;

// WHERE THEY STRAND. `cands` are cells already filtered by the caller to the
// lanes — the flow from the gates to the heart — as { ci, d, pos }, where `d`
// is hops from the heart and `pos` is a unit vector. Deterministic in `rng`,
// in the band, and never within `apart` cells of one another.
//
// Fewer than asked for is a legal answer, and it is REPORTED (`short`) rather
// than silently accepted: a board that can only hold four is a board the
// verdict must score out of four, and a mission that quietly shrinks its own
// objective is a mission nobody can lose.
export function placeSurvivors(st, cands, rng, cellSide, tune = RESCUE_TUNE) {
  const band = cands.filter((c) => c.d >= tune.bandMin && c.d <= tune.bandMax);
  // deterministic shuffle: one draw per candidate, sorted. Fisher-Yates over
  // the same rng would work too, but this is order-stable under a filter
  // change, which matters when the lane set moves between rounds.
  const order = band.map((c) => ({ c, k: rng() })).sort((a, b) => a.k - b.k).map((x) => x.c);
  // THE SPACING DEGRADES BEFORE THE PARTY DOES. Sector 1 is a deliberately
  // tight board — 84 open cells — and at three cells apart it could only hold
  // four of six, which changes the mission's difficulty for a reason that has
  // nothing to do with the mission. So `apart` is a PREFERENCE, tried and
  // relaxed: the party size is the design, the spacing is the taste.
  const want = Math.round(tune.survivors);
  for (let apart = tune.apart; apart >= 0; apart -= 0.5) {
    st.survivors.length = 0;
    const gap = apart * cellSide;
    for (const c of order) {
      if (st.survivors.length >= want) break;
      if (gap > 0 && st.survivors.some((s) => groundDist(s.pos, c.pos) < gap)) continue;
      st.survivors.push({ id: st.survivors.length + 1, ci: c.ci, pos: c.pos.slice(),
        state: 'standing', boardT: 0, grabT: 0 });
    }
    st.apart = apart;
    if (st.survivors.length >= want) break;
  }
  st.short = want - st.survivors.length;
  return st.survivors;
}

// THE STOP CLAUSE. Both conditions, every frame, or the clock goes back to
// zero — an interrupted pick-up is a pick-up not made. A grabbed survivor
// cannot be boarded: kill what is holding them first.
export function stepBoard(st, i, { near, slow }, dt, tune = RESCUE_TUNE) {
  const s = st.survivors[i];
  if (!s || s.state !== 'standing') return null;
  if (s.grabT > 0) { s.boardT = 0; return null; }
  if (!near || !slow) { s.boardT = 0; return null; }
  if (aboard(st) >= Math.round(tune.seats)) { s.boardT = 0; return 'full'; }
  s.boardT += dt;
  if (s.boardT < tune.boardSecs) return 'boarding';
  s.boardT = 0;
  s.state = 'aboard';
  st.carried = aboard(st);
  return 'aboard';
}

// THE GRAB. `held` is the board's answer to "is something in contact with
// this survivor right now". Rising edge announces; the clock runs while it
// stays true; letting go at any point stands them back up.
export function stepGrab(st, i, held, dt, tune = RESCUE_TUNE) {
  const s = st.survivors[i];
  if (!exposed(s)) return null;
  if (!held) {
    if (s.grabT > 0) { s.grabT = 0; return 'freed'; }
    return null;
  }
  const first = s.grabT === 0;
  s.grabT += dt;
  if (s.grabT >= tune.grabSecs) {
    s.state = 'lost';
    s.grabT = 0;
    st.lost++;
    return 'lost';
  }
  return first ? 'grabbed' : null;
}

// 0..1 of the grab window spent — the red ring's fill.
export const grabProgress = (s, tune = RESCUE_TUNE) =>
  Math.max(0, Math.min(1, s.grabT / Math.max(1e-6, tune.grabSecs)));

export function disembark(st) {
  let n = 0;
  for (const s of st.survivors) if (s.state === 'aboard') { s.state = 'saved'; n++; }
  st.saved += n;
  st.carried = 0;
  return n;
}

// The hull is gone, and everyone in it with it. This is the whole reason two
// seats is a bet: it is the only way a survivor who was already safe dies.
export function loseCarried(st) {
  let n = 0;
  for (const s of st.survivors) if (s.state === 'aboard') { s.state = 'lost'; n++; }
  st.lost += n;
  st.carried = 0;
  return n;
}

// Does this enemy peel off the lane for this survivor? A short LOCAL
// override — deliberately not a second BFS field, because the survivors
// stand in the flow the horde is already walking.
export const lockOn = (s, enemyPos, cellSide, tune = RESCUE_TUNE) =>
  exposed(s) && groundDist(s.pos, enemyPos) <= tune.lockCells * cellSide;

// THE MIX. Mostly rammable, with a small growing hard core — the brief's
// "lots of rammable enemies and just a handful of more difficult one".
// A table rather than computeWavePlan: the mission's curve is a design
// statement and it should be readable in one glance.
export function waveMix(w) {
  const n = Math.max(1, Math.round(w));
  const soft = n <= 4 ? [8, 10, 12, 14][n - 1] : 14 + 2 * (n - 4);
  const hard = n === 1 ? 0 : Math.min(5, 1 + Math.floor((n - 2) / 2));
  return { soft, hard };
}

// Over the moment nothing is standing: everyone is saved, aboard-and-lost,
// or dead. Anyone still ABOARD keeps it running — the drive home is the
// mission.
export function missionOver(st) {
  if (st.over) return true;
  st.over = remaining(st) === 0;
  return st.over;
}

// The end card's numbers. `total` is what the board could actually place,
// not what the tune asked for.
export function verdict(st) {
  const total = st.survivors.length;
  return {
    saved: st.saved,
    lost: st.lost,
    total,
    clean: total > 0 && st.saved === total,
    none: st.saved === 0,
    lostIds: st.survivors.filter((s) => s.state === 'lost').map((s) => s.id),
  };
}
