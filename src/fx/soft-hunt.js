// THE SOFT HUNT, WALKED (owner, 2026-10-18, round three, note 2: "the weaker units (white and yellows) need to be faster and more aggressive towards
// a) priority 1 the Tank, they flank and surround and try to attack it although they cannot, or b) the gates, whichever is closer"). The rule is
// src/domain/soft-hunt.js, the knobs SOFT_HUNT (src/content/soft-hunt.js) under the tune panel's `tune.hunt` (src/fx/tune-knobs.js). Called by the
// enemy loop (src/fx/enemy-step.js) for every record of a soft tier, and only them: the gate's walk is the loop's own, unchanged.
// Per record `e.hunt = { goal, bearing, radius, at, ringed, p, dir, phase, onRing, off, offLeft, t0 }`. Each `every` s (staggered by id) the goal is
// chosen by walking distance (the hunters' field from the hull's cell against the walk to the gate); toward the hull the walk is faster
// (SOFT_HUNT.pace); within `enter` cells of it the record leaves the cell lanes for its spot on the ring round the hull (its bearing, then the
// nearest open one: a spot in the rock is not a spot), closes on it round the hull (a flank, never through it), circles slowly and jabs in short of the ram, a tap on the hull at the deepest.
// A ringed record walks free on the unit sphere, one cell's openness checked per step (it does not enter rock or a sealed gate: blocked, it turns
// its circling round, or on its way takes a spot on its own side); `e.cur` follows the cell it stands in, so the field, the heart and the scare keep reading it. When the hull drives off past
// `leave`, dies or the goal turns to the gate, it goes back to the lanes from where it stands, the gap eased out over `settle` s.
// The ring's frame is carried with the hull (parallel transport of one tangent axis), so the bearings do not swing when the hull crosses
// tangentBasis's switch of reference axis.
//   host: { hull() -> the tank ({ pos, cur }) or null (down, dead, not issued), field() -> walking cells from the hull's cell (-1 unreachable) |
//     null, gateDist(ci) -> walking cells from ci to the gate (the heart without a story gate) | -1, graph() -> { adj, centers }, cellSide(),
//     open(ci) a record may stand there, tune() -> the panel's overrides ({ pace x, ring }) | null, tap(e) the hull's light jolt }
//   createSoftHunt(host) -> { soft(e), pace(e, tNow, scared), ringed(e), place(e, pace, dt, tNow), wants(e), state() }
import { SOFT_HUNT } from '../content/soft-hunt.js';
import { PEARL_OF } from '../content/pearl-enemies.js';
import { isSoftHunter, huntGoal, huntPace, firstDecision, huntDue, ringBearing, ringLayer, findRingSpot, ringPoint, jabAt, jabPeaked, stepRound } from '../domain/soft-hunt.js';
import { nearestCellFrom } from '../domain/body-reach.js';
import { sub3, add3, scale3, dot3, cross3, norm3, dist3, tangentBasis } from '../vec3.js';

const PHI = 0.6180339887498949;
export function createSoftHunt(host) {
  let T = SOFT_HUNT, from = null, taps = 0;
  const knobs = () => {
    const o = host.tune?.() ?? null;
    if (o !== from) { from = o; T = o ? { ...SOFT_HUNT, ring: o.ring ?? SOFT_HUNT.ring, pace: Object.fromEntries(Object.entries(SOFT_HUNT.pace).map(([k, v]) => [k, v * (o.pace ?? 1)])) } : SOFT_HUNT; }
    return T;
  };
  // the ring's frame at the hull, carried along with it
  let fu = null;
  function frame(h) {
    const n = norm3(h.pos);
    if (!fu || Math.abs(dot3(fu, n)) > 0.9) fu = tangentBasis(n)[0];
    else fu = norm3(sub3(fu, scale3(n, dot3(fu, n))));
    return [fu, cross3(n, fu)];
  }
  const toWorld = (h, u, v, xy, cs) => norm3(add3(h.pos, add3(scale3(u, xy[0] * cs), scale3(v, xy[1] * cs))));
  const openAt = (h, u, v, xy, cs) => { const g = host.graph(); return host.open(nearestCellFrom(g.adj, g.centers, h.cur, toWorld(h, u, v, xy, cs))); };

  const soft = (e) => !e.guard && !e.hunter && isSoftHunter(PEARL_OF[e.type], knobs());

  function aim(e, h) {
    const t = knobs(), cs = host.cellSide(), [u, v] = frame(h), hs = e.hunt;
    const spot = findRingSpot({ bearing: hs.bearing, radius: ringLayer(e.id, t.slots, t), open: (xy) => openAt(h, u, v, xy, cs), tune: t });
    hs.radius = spot ? spot.radius : null; if (spot) hs.bearing = spot.bearing;
  }
  function release(e) {
    const hs = e.hunt; if (!hs.ringed) return;
    hs.ringed = false; hs.onRing = false;
    const c = host.graph().centers[e.cur];
    // back to the lanes from where it stands: its cell's walk picks the next exit at once (prog 1), the gap to the cell's centre eased out
    e.next = e.cur; e.prog = 1; hs.off = sub3(hs.p, c); hs.offLeft = knobs().settle;
  }

  // the goal, decided each `every` s, and the walk's multiplier; enters or leaves the ring
  function pace(e, tNow, scared = false) {
    if (!soft(e)) return 1;
    const t = knobs(), h = host.hull(), field = h ? host.field() : null;
    const hs = (e.hunt ??= { goal: 'gate', bearing: ringBearing(e.id, t.slots), radius: null, at: firstDecision(e.id, tNow, t.every), ringed: false, p: null, dir: 1, phase: (e.id * PHI * 7) % 1, onRing: false, off: null, offLeft: 0, t0: tNow });
    const hd = field && e.cur >= 0 ? field[e.cur] : -1;
    if (huntDue(hs, tNow)) {
      hs.at = tNow + t.every;
      hs.goal = huntGoal({ hullDist: hd, gateDist: host.gateDist(e.cur) }, t);
      if (hs.ringed && h) aim(e, h);
    }
    if (!h || scared || hs.goal !== 'hull') release(e);
    else if (!hs.ringed) {
      if (!e.emergeOff && hd >= 0 && hd <= t.enter && dist3(e.pos, h.pos) <= (t.enter + t.ring) * host.cellSide()) { hs.ringed = true; hs.p = e.pos.slice(); hs.off = null; hs.t0 = tNow; aim(e, h); }
    } else if (hd < 0 || hd > t.leave || dist3(hs.p, h.pos) > (t.leave + t.ring) * host.cellSide()) release(e);
    return huntPace(PEARL_OF[e.type], t, hs.goal);
  }

  // after the lane's walk has set e.pos: a ringed record's own step (it returns true: e.pos, e.dir and e.walkPace are its), or the gap from
  // the ring eased out on the lane
  function place(e, walk, dt, tNow) {
    const hs = e.hunt; if (!hs) return false;
    if (!hs.ringed) {
      if (hs.off) { hs.offLeft -= dt; if (hs.offLeft <= 0) hs.off = null; else e.pos = norm3(add3(e.pos, scale3(hs.off, hs.offLeft / knobs().settle))); }
      return false;
    }
    const h = host.hull(); if (!h) { release(e); return false; }
    const t = knobs(), cs = host.cellSide(), [u, v] = frame(h), g = host.graph();
    const d = sub3(hs.p, h.pos), at = [dot3(d, u) / cs, dot3(d, v) / cs];
    let to = at, max = walk * dt;
    if (hs.radius != null) {
      const spot = ringPoint(hs.bearing, hs.radius);
      hs.onRing = Math.hypot(at[0] - spot[0], at[1] - spot[1]) < t.atRing + (hs.onRing ? Math.max(0, hs.radius - t.jab.depth) : 0);   // once on it, a jab's lunge keeps it there
      if (hs.onRing) {
        // on the ring: circling slowly, and the jab in and out (faster than the walk, short of the ram), a tap at its deepest
        hs.bearing += t.orbit * hs.dir * dt;
        const j = jabAt(tNow, hs.phase, hs.radius, t.jab);
        to = ringPoint(hs.bearing, j.radius);
        max = Math.max(max, ((Math.PI * Math.max(0, hs.radius - t.jab.depth)) / t.jab.seconds) * 1.15 * dt);
        if (walk > 0 && jabPeaked(hs.t0, tNow, hs.phase, t.jab)) { taps++; host.tap?.(e); }
      } else to = spot;
    }
    hs.t0 = tNow;
    const next = stepRound(at, to, max), moved = Math.hypot(next[0] - at[0], next[1] - at[1]);
    if (moved > 1e-9) {
      const p = toWorld(h, u, v, next, cs), ci = nearestCellFrom(g.adj, g.centers, e.cur, p);
      if (host.open(ci)) { const step = sub3(p, hs.p); hs.p = p; e.cur = e.next = ci; e.dir = norm3(sub3(step, scale3(p, dot3(step, p)))); }
      else if (hs.onRing) hs.dir = -hs.dir;   // rock or a shut gate on its circle: it turns round
      else { hs.bearing = Math.atan2(at[1], at[0]); aim(e, h); }   // in its way to its spot: a spot on its own side of the hull instead
    }
    e.prog = 0; e.next = e.cur;
    if (!(moved > 1e-9)) { const f = sub3(h.pos, hs.p), fl = sub3(f, scale3(hs.p, dot3(f, hs.p))); if (Math.hypot(...fl) > 1e-9) e.dir = norm3(fl); }   // standing: it faces the hull
    e.walkPace = dt > 0 ? moved / dt : 0;
    e.pos = hs.p.slice();
    return true;
  }

  function state() {
    let hunting = 0, atHull = 0, ringed = 0, atGate = 0;
    for (const e of host.enemies?.() ?? []) {
      if (!e.alive || !e.hunt || !soft(e)) continue;
      if (e.hunt.goal === 'hull') hunting++; else atGate++;
      if (e.hunt.ringed) { ringed++; if (e.hunt.onRing) atHull++; }
    }
    return { hunting, atHull, ringed, atGate, taps };
  }
  return { soft, pace, ringed: (e) => !!e.hunt?.ringed, place, wants: (e) => e.hunt?.goal === 'hull', state };
}
