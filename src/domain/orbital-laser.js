// THE ORBITAL LASER'S RULES. A satellite passes over the base on a fixed period; while it is overhead the player can
// hold a continuous beam whose contact point chases a target along the sphere at a capped rate, so it draws heavy
// lines rather than teleporting. Energy is a per-pass budget spent only while burning, and anything standing in the
// footprint long enough for its kind is destroyed.
//
// Pure. Positions are [x, y, z] metres on a sphere CENTRED ON THE ORIGIN: the caller converts from whatever frame it
// renders in. The clock, the footprint test and the destruction all belong to the caller; this module owns the state.
import { norm3, len3, dot3, cross3, scale3 } from '../vec3.js';

export function makeLaser(orbit, beam) {
  return {
    phase: 'away',
    left: Math.max(0, orbit.period - orbit.overhead),
    energy: beam.energy,
    burning: false,
    contact: null,
    /* id -> { seconds, reported }: how long each thing has been under the beam without a break */
    contacts: new Map(),
    /* the next aim snaps instead of slewing: a fresh pass has no contact to drag from */
    fresh: true,
    /* the contact's speed along the ground (m/s) and the axis it last moved about: the inertia beam.accel gives it */
    speed: 0,
    axis: null,
  };
}

// The clock. Returns 'arrive' the frame the satellite comes overhead, 'close' the frame the pass shuts, else null.
// At most one transition per call; the overshoot is carried into the next phase so a long step does not drift.
export function stepLaser(st, dt, orbit, beam) {
  st.left -= dt;
  if (st.left > 0) return null;
  if (st.phase === 'away') {
    st.phase = 'overhead';
    st.left = Math.max(0, orbit.overhead + st.left);
    st.fresh = true;
    return 'arrive';
  }
  st.phase = 'away';
  st.left = Math.max(0, (orbit.period - orbit.overhead) + st.left);
  st.energy = beam.energy;
  st.burning = false;
  st.contact = null;
  st.contacts.clear();
  st.fresh = true;
  st.speed = 0;
  st.axis = null;
  return 'close';
}

// Moves the contact toward `target` ALONG THE SPHERE. The sphere's radius is the target's own length, so the contact is
// rescaled onto the same surface the caller picked on. The first aim after an arrival snaps: there is nothing to drag
// from yet, and a lay that crawled in from the last pass would be a lie.
//
// Without beam.accel the contact moves at most beam.slew * dt metres a step. With it the contact has INERTIA: its speed
// climbs toward slew at accel m/s², brakes on the curve sqrt(2 * accel * distance) so it arrives without overshooting,
// and a turn bleeds speed off in proportion to how sharp it is (a reversal starts again from rest). That is the slow,
// inexorable drag the owner asked for (2026-09-15).
export function aimLaser(st, target, dt, beam) {
  const R = len3(target) || 1;
  const snap = () => {
    st.contact = [target[0], target[1], target[2]];
    st.speed = 0;
    st.axis = null;
    return st.contact;
  };
  if (!st.contact || st.fresh) {
    st.fresh = false;
    return snap();
  }
  const a = norm3(st.contact), b = norm3(target);
  const cos = Math.max(-1, Math.min(1, dot3(a, b)));
  const full = Math.acos(cos);
  const axis = cross3(a, b);
  /* co-linear (already there, or exactly antipodal): there is no rotation plane to step through */
  if (full < 1e-9 || len3(axis) < 1e-12) return snap();
  const k = norm3(axis);
  let travel = beam.slew * dt;
  if (beam.accel > 0) {
    const brake = Math.sqrt(2 * beam.accel * full * R);
    const turn = st.axis ? Math.max(0, dot3(st.axis, k)) : 1;
    st.speed = Math.min(beam.slew, brake, (st.speed || 0) * turn + beam.accel * dt);
    st.axis = k;
    travel = st.speed * dt;
  }
  const step = Math.min(full, travel / R);
  if (step >= full) {
    st.contact = [target[0], target[1], target[2]];
    return st.contact;
  }
  const c = Math.cos(step), s = Math.sin(step);
  /* Rodrigues about k. k is perpendicular to a, so the (k . a) term is zero and drops out. */
  const kxa = cross3(k, a);
  const rotated = [a[0] * c + kxa[0] * s, a[1] * c + kxa[1] * s, a[2] * c + kxa[2] * s];
  st.contact = scale3(norm3(rotated), R);
  return st.contact;
}

// Burning is held AND overhead AND still funded. Returns whether it burned this frame; drains the budget by dt.
export function burnLaser(st, held, dt) {
  const on = !!held && st.phase === 'overhead' && st.energy > 0;
  st.burning = on;
  if (!on) return false;
  st.energy = Math.max(0, st.energy - dt);
  return true;
}

// `things` are { id, kind, pos } ALREADY filtered to the footprint by the caller. Each id accumulates seconds while
// it stays there; the first call in which an id reaches burn[kind] reports it, once. An id that is not in `things`
// has left the footprint and is forgotten, so a body that ducks out and comes back starts again from zero.
export function burnContacts(st, things, dt, burn) {
  const finished = [], seen = new Set();
  for (const thing of things) {
    seen.add(thing.id);
    let rec = st.contacts.get(thing.id);
    if (!rec) { rec = { seconds: 0, reported: false }; st.contacts.set(thing.id, rec); }
    rec.seconds += dt;
    const need = burn[thing.kind];
    if (need === undefined || rec.reported) continue;
    if (rec.seconds >= need) {
      rec.reported = true;
      finished.push({ thing, kind: thing.kind, done: true });
    }
  }
  for (const id of [...st.contacts.keys()]) if (!seen.has(id)) st.contacts.delete(id);
  return finished;
}

// For the HUD: how much of the CURRENT phase is left, and how much of the pass's budget is left.
export function laserProgress(st, orbit, beam) {
  const span = st.phase === 'overhead' ? orbit.overhead : Math.max(1e-6, orbit.period - orbit.overhead);
  const clamp = (v) => Math.max(0, Math.min(1, v));
  return { pass: clamp(st.left / span), energy: clamp(st.energy / beam.energy) };
}
