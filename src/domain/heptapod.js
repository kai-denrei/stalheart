// heptapod.js — the A6's mind. A tower that walks.
//
// Every other tower on the board is a decision made once, at placement: it
// covers what it covers forever. The A6 is the opposite and that is the
// whole point of having it — you place a PATROL, not a position, and what
// it can reach changes minute to minute. That makes it the first unit on
// the board with a life of its own, so its rules are worth writing down
// somewhere they can be tested rather than leaving them scattered through
// a fifteen-thousand-line tab.
//
// THE LOOP, and it is a loop on purpose:
//
//   patrol  — drift around its berth, looking. It never strays further
//             than `leash`, because a walker with no leash is not a tower
//             any more, it is a second tank you do not control.
//   engage  — close on the nearest thing it can see until the thing is
//             inside the launch envelope.
//   fire    — one rocket every `salvoGap` until the cassette is empty.
//             Six, eight or ten of them by tier — the operator's numbers,
//             and the reason the thing has to go home at all.
//   home    — walk back to the berth. It does NOT shoot on the way; an
//             A6 that fought its way home would never need to reload and
//             the magazine would be decoration.
//   refill  — sit there for `refillSecs`, then patrol again.
//
// The interesting consequence, and the thing to watch on the first play:
// the board's strongest unit is ABSENT for a fixed fraction of every
// cycle, and the player can see when. That is a rhythm rather than a
// stat, and it is the only tower here that has one.
//
// DOM-free, three.js-free, deterministic. Positions are unit vectors on
// the sphere and distances are ARC LENGTH in radians — which on a unit
// sphere is the same number as `cells * cellSide`, so nothing here needs a
// conversion factor and nothing here may use a chord.

export const A6_TUNE = {
  // the cassette, by tier. The operator's "6-8-10 rockets".
  mag: [6, 8, 10],
  salvoGap: 0.55,     // seconds between rockets in a salvo
  refillSecs: 7,      // ...and how long a full reload costs
  walkCells: 1.05,    // cells per second, patrolling
  runCells: 1.6,      // ...and going home, which it does with purpose
  leash: 5.5,         // cells from the berth it will not exceed
  standoff: 0.55,     // it stops this fraction of its range from a target
  patrolCells: 3.2,   // the radius it drifts around inside while idle
  patrolDwell: 2.6,   // seconds before it picks a new place to drift to
};

export const magFor = (tier, tune = A6_TUNE) =>
  tune.mag[Math.max(0, Math.min(tune.mag.length - 1, Math.floor(tier)))];

// --- sphere helpers, local so this module imports nothing ----------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 1]; };

// ARC LENGTH, NEVER A CHORD. On a unit sphere this is radians, which is
// the same number the board's `cells * cellSide` produces — so a range in
// cells compares directly against it with no factor anywhere.
export function arc(a, b) {
  return Math.acos(Math.min(1, Math.max(-1, dot(norm(a), norm(b)))));
}

// Move `from` towards `to` along the great circle joining them, by at most
// `step` radians. Returns a unit vector, and lands EXACTLY on the target
// when the step would overshoot — an approach that only ever gets closer
// is an approach that never arrives.
export function stepToward(from, to, step) {
  const a = norm(from), b = norm(to);
  const d = arc(a, b);
  if (d < 1e-9 || step >= d) return b;
  const axis = cross(a, b);
  if (len(axis) < 1e-12) return b;      // antipodal or identical; nothing to rotate about
  const k = norm(axis);
  const c = Math.cos(step), s = Math.sin(step);
  // Rodrigues, about the great circle's own axis
  return norm(add(add(mul(a, c), mul(cross(k, a), s)), mul(k, dot(k, a) * (1 - c))));
}

// A point `r` radians from `centre`, on the bearing `ang` — used to pick
// somewhere to drift to. Deterministic in its arguments: the caller owns
// the random stream, this owns the geometry.
export function pointNear(centre, r, ang) {
  const n = norm(centre);
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const t1 = norm(cross(n, ref));
  const t2 = cross(n, t1);
  const off = add(mul(t1, Math.cos(ang) * Math.tan(Math.min(r, 1.4))),
    mul(t2, Math.sin(ang) * Math.tan(Math.min(r, 1.4))));
  return norm(add(n, off));
}

export function makeA6(berth, tier = 0, tune = A6_TUNE) {
  return {
    berth: norm(berth).slice(),
    pos: norm(berth).slice(),
    state: 'patrol',
    ammo: magFor(tier, tune),
    mag: magFor(tier, tune),
    tier,
    t: 0,              // seconds in the current state
    gap: 0,            // countdown to the next rocket
    dwell: 0,          // countdown to the next patrol waypoint
    want: norm(berth).slice(),
    target: null,      // the id it is engaging, for the caller to resolve
    leg: 0,            // patrol waypoints taken, so the bearing always turns
    fired: 0,          // rockets away this life, for the HUD and the tests
    trips: 0,          // times it has gone home and reloaded
  };
}

// ONE STEP. `sense(pos)` is the caller's eyes: it returns the nearest
// hostile as `{ id, pos, dist }` or null, and it is a function rather than
// a list so the tab can use its own cell index instead of this module
// walking every enemy on the board.
//
// `emit(target)` is the caller's trigger — it fires one rocket and is
// called exactly once per round, never for a round the cassette does not
// have. Returns the A6, mutated.
// `ready` is the caller's SAFETY. When it is present and returns false the
// A6 holds at the firing point without spending a rocket — which is what a
// lock-on weapon does: it is on target, it is not allowed to shoot yet. The
// state says `lockon` while that lasts, so a HUD can say why a machine that
// is clearly aimed at something is clearly not firing.
export function stepA6(a6, dt, ctx) {
  const { range, minRange = 0, cellSide, sense, emit, ready, rand = () => 0.5, tune = A6_TUNE } = ctx;
  if (dt <= 0) return a6;
  const walk = tune.walkCells * cellSide * dt;
  const run = tune.runCells * cellSide * dt;
  const leash = tune.leash * cellSide;
  a6.t += dt;

  // GOING HOME IS UNCONDITIONAL. Not "unless something walks past" — an A6
  // that could be distracted on the way back would fight forever on one
  // magazine, and the magazine is the whole design.
  if (a6.state === 'home') {
    a6.target = null;
    a6.pos = stepToward(a6.pos, a6.berth, run);
    if (arc(a6.pos, a6.berth) < cellSide * 0.15) {
      a6.state = 'refill'; a6.t = 0;
    }
    return a6;
  }

  if (a6.state === 'refill') {
    a6.target = null;
    if (a6.t >= tune.refillSecs) {
      a6.ammo = a6.mag;
      a6.trips++;
      a6.state = 'patrol'; a6.t = 0; a6.dwell = 0;
    }
    return a6;
  }

  // out of rockets anywhere else means one thing
  if (a6.ammo <= 0) { a6.state = 'home'; a6.t = 0; a6.target = null; return a6; }

  const seen = sense(a6.pos);
  // ...and it will not chase past the leash. The test is on where it WOULD
  // stand, not on where the enemy is: a target beyond the leash is still
  // worth shooting if the A6 can reach a firing position inside it.
  const reachable = seen && arc(a6.berth, seen.pos) <= leash + range;

  if (!seen || !reachable) {
    a6.state = 'patrol';
    a6.target = null;
    a6.dwell -= dt;
    if (a6.dwell <= 0 || arc(a6.pos, a6.want) < cellSide * 0.2) {
      a6.dwell = tune.patrolDwell;
      // THE BEARING TURNS EVEN IF THE STREAM DOES NOT. `rand` is the
      // caller's, and a caller that hands over a constant — a stubbed
      // stream, a paused seed — would otherwise get an A6 that walks to one
      // spot and stands there for the rest of the run, which looks exactly
      // like a broken unit. Adding the clock guarantees the waypoint moves
      // while keeping the whole thing deterministic in its inputs.
      a6.leg = (a6.leg || 0) + 1;
      a6.want = pointNear(a6.berth, tune.patrolCells * cellSide,
        rand() * Math.PI * 2 + a6.leg * 2.399963);   // the golden angle: no short cycle
    }
    a6.pos = stepToward(a6.pos, a6.want, walk);
    return a6;
  }

  a6.target = seen.id;
  const d = arc(a6.pos, seen.pos);
  // CLOSE, THEN SHOOT. The standoff keeps it from walking into the crowd
  // it is bombarding — and keeps the rockets' flight long enough to read.
  const stop = Math.min(range, Math.max(minRange + (range-minRange)*.1, range * tune.standoff));
  if (d > stop + 1e-10) {
    a6.state = 'engage';
    // a step towards the enemy, clamped so the step itself cannot take it
    // past the leash — checked on the RESULT, which is the only honest way
    const next = stepToward(a6.pos, seen.pos, Math.min(walk, d - stop));
    if (arc(a6.berth, next) <= leash) a6.pos = next;
    return a6;
  }

  if (d < minRange - 1e-12 || d > range + 1e-12 || (ready && !ready(seen))) {
    // holding: aimed, in range, and waiting on the seeker. The salvo clock
    // does NOT run down here — a lock that takes two seconds must not also
    // hand you two seconds of free reload.
    a6.state = 'lockon';
    return a6;
  }
  a6.state = 'fire';
  a6.gap -= dt;
  if (a6.gap <= 0 && a6.ammo > 0) {
    a6.gap = tune.salvoGap;
    a6.ammo--;
    a6.fired++;
    if (emit) emit(seen);
    if (a6.ammo <= 0) { a6.state = 'home'; a6.t = 0; }
  }
  return a6;
}

// What the HUD says about it, in one line — kept here so the tab does not
// invent its own vocabulary for a state machine it does not own.
export const a6Line = (a6) => {
  if (a6.state === 'lockon') return `LOCKING · ${a6.ammo}/${a6.mag}`;
  if (a6.state === 'refill') return `RELOADING ${Math.max(0, A6_TUNE.refillSecs - a6.t).toFixed(0)}s`;
  if (a6.state === 'home') return 'RETURNING · dry';
  return `${a6.state.toUpperCase()} · ${a6.ammo}/${a6.mag}`;
};
