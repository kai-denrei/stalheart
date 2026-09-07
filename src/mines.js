// mines.js — the claymore mine: supply, arming, the trigger fan, the blast
// arc, and the chain. Pure: no DOM, no three.js, Node-tested in
// test/mines.mjs. td-tab owns the discs, the fan lines, the radar arrowheads
// and the sounds; every number and every refusal lives here.
//
// Design: docs/superpowers/specs/2026-09-04-mines-design.md. The operator's
// rulings, in one line each: B — CLAYMORE, directional, instant on trigger,
// no fuse, an arming period after the drop. Dropped one cell IN FRONT of the
// tank, facing the tank's heading — so laying them while driving backwards
// builds a field between you and what you are retreating from, which is the
// whole dynamic the shape was chosen for. The tank trips its own mines and
// takes the damage: a claymore does not know whose it is.
//
// GEOMETRY. Everything here is a WEDGE IN POLAR COORDINATES on the sphere's
// surface: an angular distance from the mine and a bearing off its axis. The
// distance is ARC LENGTH — the standing rule, and on a unit sphere the arc
// length from a point IS the angle in radians, so `cells * cellSide` converts
// with no factor at all. A chord would under-reach, and at the 2.5-cell reach
// of a mine it would under-reach differently for a target sitting on the
// ground than for one hovering, which is exactly the class of bug that made
// the beam miss bodies it was drawn through.
//
// Nothing behind the mine can be caught, and that falls out of the shape
// rather than being a special case: a point astern is more than 90 degrees
// off the axis, and the arc's half-angle is 60. The test pins it anyway,
// because the obvious wrong implementation (an unsigned distance along the
// axis) fires the claymore backwards and still passes every forward test.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';
import { sub3, scale3, dot3, cross3, norm3, len3 } from './vec3.js';

export const MINE_TUNE = {
  start: 10,        // mines in the rack at the top of a run
  cap: 20,          // the rack holds no more; a case over the cap is lost
  caseSize: 5,      // mines in one case, from the yard or the debrief
  armSecs: 2.0,     // dead after the drop — you can drive off your own mine
  fanDepth: 1.0,    // TRIGGER fan, cells: how close something must come
  arcDeg: 120,      // blast arc, degrees, total (the claymore's spread)
  reach: 2.5,       // blast reach, cells
  damage: 1,        // a shell's worth, to everything in the arc
  yardEvery: 3,     // waves between Terraformer cases (store 2, hull 5)
  price: 200,       // kg for a case on the debrief
};

export const MINE_KNOBS = [
  { key: 'start', label: 'starting mines', group: 'supply', min: 0, max: 20, step: 1 },
  { key: 'cap', label: 'rack cap', group: 'supply', min: 1, max: 40, step: 1 },
  { key: 'caseSize', label: 'case size', group: 'supply', min: 1, max: 10, step: 1 },
  { key: 'yardEvery', label: 'waves per case', group: 'supply', min: 1, max: 8, step: 1 },
  { key: 'price', label: 'case price (kg)', group: 'supply', min: 25, max: 800, step: 25 },
  { key: 'armSecs', label: 'arming time (s)', group: 'blast', min: 0, max: 6, step: 0.25 },
  { key: 'fanDepth', label: 'trigger fan (cells)', group: 'blast', min: 0.2, max: 3, step: 0.1 },
  { key: 'arcDeg', label: 'blast arc (deg)', group: 'blast', min: 20, max: 180, step: 5 },
  { key: 'reach', label: 'blast reach (cells)', group: 'blast', min: 0.5, max: 6, step: 0.1 },
  { key: 'damage', label: 'damage', group: 'blast', min: 0.5, max: 5, step: 0.5 },
];

export const makeMineParams = (src = MINE_TUNE) => makeParams(MINE_KNOBS, src);
export const clampMineParams = (p, src) => clampParams(MINE_KNOBS, p, src);
export const formatMineTune = (p) => formatKnobs('MINE_TUNE', MINE_KNOBS, p);
export const mineKnobProblems = () => knobProblems(MINE_KNOBS, MINE_TUNE);

// --- the field ------------------------------------------------------------

export function makeField(tune = MINE_TUNE) {
  return {
    count: Math.max(0, Math.round(tune.start)),
    mines: [],     // every mine ever laid this run; dead ones stay for the fx
    next: 1,       // id source
    queue: [],     // ids waiting to trip on a following frame — the chain
  };
}

export const liveMines = (field) => field.mines.filter((m) => m.alive);

// A mine standing on this cell, live or still arming. Dead ones do not block.
export const mineAt = (field, ci) => field.mines.find((m) => m.alive && m.ci === ci) || null;

// Lay one. `pos` is the surface point one cell in front of the tank, `dir`
// the tank's heading there (a unit tangent). `blocked` is the board's answer
// for the cell ahead — a wall, the heart's pedestal, off the path. `occupied`
// is anything else standing there the board knows about (a tower); a mine
// already on the cell is our own business and checked here.
export function layMine(field, { pos, dir, cellAhead = -1, blocked = false, occupied = false }, t = 0, tune = MINE_TUNE) {
  if (field.count <= 0) return 'empty';
  if (blocked) return 'blocked';
  if (occupied || (cellAhead >= 0 && mineAt(field, cellAhead))) return 'occupied';
  const n = norm3(pos);
  // the heading is re-projected into the tangent plane at the DROP point, not
  // at the tank: a cell away on a sphere the tank's own tangent is no longer
  // tangent here, and a dir that leans off the surface tilts the whole wedge.
  const d = norm3(sub3(dir, scale3(n, dot3(dir, n))));
  field.mines.push({
    id: field.next++,
    ci: cellAhead,
    pos: n,
    dir: d,
    laidAt: t,
    live: false,
    alive: true,
  });
  field.count--;
  return 'laid';
}

// The arming window closes. Returns the ids that armed on THIS call, so the
// board chimes once per mine rather than once per frame.
export function armMines(field, t, tune = MINE_TUNE) {
  const armed = [];
  for (const m of field.mines) {
    if (!m.alive || m.live) continue;
    if (t - m.laidAt >= tune.armSecs) { m.live = true; armed.push(m.id); }
  }
  return armed;
}

export function restock(field, n, tune = MINE_TUNE) {
  const before = field.count;
  field.count = Math.min(Math.round(tune.cap), field.count + Math.max(0, Math.round(n)));
  return field.count - before;   // what actually fitted; the rest is lost
}

// --- the wedge ------------------------------------------------------------
// Polar coordinates on the surface, centred on the mine: how far along the
// ground, and how far off the axis. Both exact, both cheap.
//
//   dist    great-circle angle from the mine to p, in radians = arc length
//   off     bearing off the mine's axis, radians, absolute (the wedge is
//           symmetric, so a sign would only invite someone to drop it)
export function minePolar(mine, p) {
  const n = mine.pos;
  const a = dot3(p, n);                       // along the normal
  const flat = sub3(p, scale3(n, a));         // the tangential part at the mine
  const l = len3(flat);
  if (l < 1e-12) return { dist: 0, off: 0 };
  const dist = Math.atan2(l, a);              // exact, and stable at both ends
  const u = scale3(flat, 1 / l);
  const side = cross3(n, mine.dir);           // left/right of the axis
  const off = Math.abs(Math.atan2(dot3(u, side), dot3(u, mine.dir)));
  return { dist, off };
}

const halfAngle = (tune) => (tune.arcDeg * Math.PI) / 360;

// Inside the TRIGGER fan: close enough, and in front. The fan is the same
// wedge as the blast, cut short — a mine you walk past outside the fan is a
// mine that stays laid, which is what makes a field worth arranging.
export function inFan(mine, p, cellSide, tune = MINE_TUNE) {
  const { dist, off } = minePolar(mine, p);
  return dist <= tune.fanDepth * cellSide && off <= halfAngle(tune);
}

// Inside the BLAST arc.
export function inArc(mine, p, cellSide, tune = MINE_TUNE) {
  const { dist, off } = minePolar(mine, p);
  return dist <= tune.reach * cellSide && off <= halfAngle(tune);
}

// Trip it. `points` is whatever the board wants tested — enemies, the gates,
// the tank — as an array of positions; the indices come back so the caller
// keeps its own bookkeeping. Other live mines caught in the arc come back as
// `chain`, front to back. A mine that is not yet live does nothing at all.
export function trip(field, mine, points, cellSide, tune = MINE_TUNE) {
  if (!mine || !mine.alive || !mine.live) return { targets: [], chain: [] };
  mine.alive = false;
  mine.live = false;
  const targets = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i] && inArc(mine, points[i], cellSide, tune)) targets.push(i);
  }
  const chain = field.mines
    .filter((m) => m.alive && m.live && m.id !== mine.id && inArc(mine, m.pos, cellSide, tune))
    .map((m) => ({ id: m.id, d: minePolar(mine, m.pos).dist }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.id);
  return { targets, chain };
}

// Queue the chained mines. They go off on FOLLOWING frames, nearest first, so
// a laid row reads as a row going off rather than as one big flash. An id
// already queued is not queued twice — two mines can each catch the third.
export function chain(field, ids) {
  for (const id of ids) if (!field.queue.includes(id)) field.queue.push(id);
  return field.queue.length;
}

// The next mine owed a blast, or null. One per frame, by design.
export function nextChained(field) {
  while (field.queue.length) {
    const id = field.queue.shift();
    const m = field.mines.find((x) => x.id === id);
    if (m && m.alive && m.live) return m;
  }
  return null;
}
