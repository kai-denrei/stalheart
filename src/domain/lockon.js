// lockon.js — the lock, and what a missile does once it has one.
//
// Every other weapon in the sniper lab asks the same question: where will
// the target BE when the round arrives. The Javelin asks a different one —
// hold it still long enough — and then stops caring, because the round
// solves the rest itself. That is a different verb, and it is the reason
// this is worth building as its own thing rather than as a fifth entry in
// the weapons table with a homing flag.
//
// Two halves, both DOM-free and both testable in Node:
//
//   THE LOCK is a state machine over one number, the meter. It fills while
//   the target sits inside the gate, drains when it does not, and once it
//   is full the seeker holds on through a gate the target has left — up to
//   a point, past which the lock breaks. Filling and holding are the whole
//   mini-game, so they are the part that must not be guessed at.
//
//   THE GUIDANCE is proportional navigation, the actual law: turn at a rate
//   proportional to the rotation of the line of sight. Its one property
//   worth knowing is that a collision course commands NOTHING — the line of
//   sight stops rotating — which is why it intercepts a mover without
//   needing to predict where the mover is going.
//
// No Math.random: a lock that fills differently on two identical approaches
// is not a mechanic, it is a coin.

export const LOCK_TUNE = {
  // half-width of the lock gate, in milliradians on the glass. Generous
  // compared to the plate's own subtense — the difficulty is HOLDING it,
  // not finding it.
  gateMrad: 12,
  lockTime: 1.7,      // seconds of continuous track to acquire
  drain: 1.6,         // meter drained per second when the gate is empty,
                      // relative to lockTime — slower than it fills, so a
                      // wobble costs you but does not reset you
  breakMrad: 34,      // a LOCKED seeker holds this far off before it lets go
  minRange: 40,
  maxRange: 2400,
};

export const MISSILE_TUNE = {
  // A JAVELIN IS SLOW, and that is not a compromise — it is what makes the
  // top attack possible. An earlier tune flew at 314 m/s with 140 m/s² of
  // fin, which is a seven-hundred-metre turn radius: it climbed to ninety
  // metres, sailed over the target and buried itself three hundred metres
  // past. Subsonic and manoeuvrable beats fast and straight for a weapon
  // whose whole job is to come down on something.
  boost: 0.6,         // seconds of motor
  boostAccel: 160,    // m/s² while it burns
  cruise: 0.2,        // thrust after burnout, as a fraction of boostAccel
  gravity: 9.81,
  drag: 0.0016,       // ...which, with the cruise thrust, settles it near
                      // 180 m/s rather than letting it accelerate forever
  N: 4,               // the navigation constant. 3–5 is the real range.
  accelMax: 200,      // what the fins can actually pull, m/s²
  arm: 0.3,           // seconds before it will detonate on anything
  kill: 6,            // warhead radius, m
  topAttack: 0.28,    // the arc: lift as a fraction of the range STILL TO RUN,
                      // so it retires itself as the missile closes rather
                      // than being switched off at some fraction of the way
  launchSpeed: 40,    // how fast it leaves the tube, before the motor
  maxTime: 30,
  step: 0.008,
};

// THE SAME MISSILE, IN A SMALLER WORLD. The sentry range is nine model
// units across where the sniper's is sixteen hundred metres, and a tune
// written in metres and seconds is simply wrong there — a missile with 200
// m/s² of fin would leave the range before it turned. Rather than keep a
// second table of hand-picked numbers that will drift from the first, scale
// the one tune: pick a length ratio `k` and a time ratio `tau`, and every
// quantity follows from its own dimensions.
//
//   length  k        velocity  k/tau      acceleration  k/tau²
//   time    tau      drag      1/k        (drag is a reciprocal length)
//
// The result is the SAME trajectory, drawn smaller and flown faster, which
// is exactly what a demonstration range wants — and if the metre tune is
// retuned the model-unit one follows for free.
export function scaleMissile(tune, k, tau) {
  const a = k / (tau * tau);
  return {
    ...tune,
    boost: tune.boost * tau,
    arm: tune.arm * tau,
    maxTime: tune.maxTime * tau,
    step: tune.step * tau,
    boostAccel: tune.boostAccel * a,
    gravity: tune.gravity * a,
    accelMax: tune.accelMax * a,
    launchSpeed: tune.launchSpeed * (k / tau),
    drag: tune.drag / k,
    kill: tune.kill * k,
  };
}

// --- small vector helpers, kept local so this module imports nothing -----
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 0]; };

// --- the lock ------------------------------------------------------------

export function makeLock() {
  return { id: null, meter: 0, locked: false, since: 0 };
}

// HOW FAR OFF THE CROSS a thing is, in milliradians — the same unit the
// reticle is drawn in, so the gate the player sees is the gate the code
// tests. Angle between the aim direction and the direction to the target,
// which is the honest measure at any magnification; a screen-space box
// would change size with the zoom.
export function offsetMrad(aimDir, from, to) {
  const d = sub(to, from);
  const l = len(d);
  if (l < 1e-9) return 0;
  const a = norm(aimDir);
  const c = Math.min(1, Math.max(-1, dot(a, mul(d, 1 / l))));
  return Math.acos(c) * 1000;
}

// ONE STEP OF THE MINI-GAME. `cand` is what is under the cross right now:
// `{ id, off, range }`, or null for nothing. Returns the same lock object,
// mutated, so a caller can hold one per shooter.
//
// The rules, in the order they matter:
//   - a LOCKED seeker keeps its target until the target goes past
//     `breakMrad`. Losing it inside the gate would make the lock useless,
//     since the whole point is that it survives your hands moving.
//   - the meter only fills for the SAME target it has been filling for.
//     Sweeping across three enemies is not a lock on the third.
//   - out of range is not a candidate at all, near or far.
export function stepLock(lock, dt, cand, tune = LOCK_TUNE) {
  const ok = cand && cand.range >= tune.minRange && cand.range <= tune.maxRange;

  if (lock.locked) {
    const same = ok && cand.id === lock.id;
    if (!same || cand.off > tune.breakMrad) {
      lock.locked = false; lock.meter = 0; lock.id = null; lock.since = 0;
      lock.broke = true;
    } else {
      lock.since += dt;
      lock.broke = false;
    }
    return lock;
  }

  lock.broke = false;
  if (ok && cand.off <= tune.gateMrad) {
    if (cand.id !== lock.id) { lock.id = cand.id; lock.meter = 0; }
    lock.meter = Math.min(1, lock.meter + dt / tune.lockTime);
    if (lock.meter >= 1) { lock.locked = true; lock.since = 0; }
  } else {
    lock.meter = Math.max(0, lock.meter - (dt * tune.drain) / tune.lockTime);
    if (lock.meter === 0) lock.id = null;
  }
  return lock;
}

// --- the missile ---------------------------------------------------------

export function launchMissile(pos, dir, speed = 40, t = 0) {
  return { p: pos.slice(), v: mul(norm(dir), speed), t: 0, born: t, spent: false };
}

// PROPORTIONAL NAVIGATION: accelerate perpendicular to the line of sight,
// at N times the rate that line is rotating. `a = N · ω × v`, where ω is
// the LOS rotation rate — the classic form, and the reason it works is that
// it drives ω to zero, and a line of sight that is not rotating is a
// collision.
export function guide(m, tp, tv = [0, 0, 0], tune = MISSILE_TUNE) {
  const r = sub(tp, m.p);
  const rr = dot(r, r);
  if (rr < 1e-9) return [0, 0, 0];
  const vr = sub(tv, m.v);
  const om = mul(cross(r, vr), 1 / rr);
  let a = mul(cross(om, m.v), tune.N);
  const mag = len(a);
  if (mag > tune.accelMax) a = mul(a, tune.accelMax / mag);
  return a;
}

// WHERE THE SEEKER IS ACTUALLY POINTED. A Javelin does not fly at the
// target, it flies OVER it and comes down — so for the first part of the
// flight the aim point is lifted, and the lift is retired as it closes.
// Purely a bias on the point PN is fed: the law itself is untouched, which
// keeps the one thing worth trusting about it trustworthy.
export function attackPoint(m, tp, launchRange, tune = MISSILE_TUNE) {
  const r = len(sub(tp, m.p));
  const f = launchRange > 1e-6 ? 1 - r / launchRange : 1;   // 0 at launch → 1 at the target
  // scaled by the range STILL TO RUN, not the range flown: the lift then
  // goes to nothing on its own as the missile closes. An earlier version
  // switched it off at a fixed fraction of the way, which moved the aim
  // point two hundred metres in one step and left the missile with more
  // altitude than its fins could shed — a 146 m miss on a stationary target.
  const lift = tune.topAttack * r * Math.sin(Math.PI * Math.min(1, Math.max(0, f)));
  return [tp[0], tp[1] + lift, tp[2]];
}

// One fixed step of the flight. Same shape as the ballistics integrator —
// fixed h, caller carries the remainder — so a missile's path does not
// depend on the frame rate any more than a shell's does.
export function stepMissile(m, h, tp, tv, launchRange, tune = MISSILE_TUNE, wind = [0, 0, 0]) {
  const aim = attackPoint(m, tp, launchRange, tune);
  const cmd = guide(m, aim, tv, tune);
  // thrust along the body axis: hard while the motor burns, a trickle after,
  // which is what makes the boost phase feel like a launch
  const along = m.t < tune.boost ? tune.boostAccel : tune.boostAccel * tune.cruise;
  const axis = norm(m.v);
  const rel = sub(m.v, wind);
  const sp = len(rel);
  const dragA = mul(rel, -tune.drag * sp);
  // GRAVITY BIAS. Proportional navigation says nothing on a collision
  // course — that is its whole virtue — so on a level shot it commands
  // nothing at all and the missile simply falls out of the sky. A real
  // seeker adds gravity back in as a bias, outside the law, so that the
  // law is steering a body that is not being dragged off course.
  const acc = add(add(mul(axis, along), cmd), dragA);
  m.v = add(m.v, mul(acc, h));
  m.p = add(m.p, mul(m.v, h));
  m.t += h;
  return m;
}

// Did it arrive? A warhead does not need to touch the thing.
export const warheadHits = (miss, tune = MISSILE_TUNE) => miss <= tune.kill;

// A whole engagement, for the tests and for anything that wants to know
// whether a shot is worth taking: fly it and report the closest approach.
export function flyMissile(from, dir, tp, tv = [0, 0, 0], tune = MISSILE_TUNE) {
  const m = launchMissile(from, dir, tune.launchSpeed, 0);
  const launchRange = len(sub(tp, from));
  let best = launchRange, target = tp.slice(), at = 0;
  const h = tune.step;
  while (m.t < tune.maxTime) {
    stepMissile(m, h, target, tv, launchRange, tune);
    target = add(target, mul(tv, h));
    const d = len(sub(target, m.p));
    if (d < best) { best = d; at = m.t; }
    if (m.p[1] < 0) break;
    // it has gone past and is opening again: no point flying it out
    if (d > best + 30 * (tune.kill / MISSILE_TUNE.kill) && m.t > tune.arm) break;
  }
  return { miss: best, time: at, hit: warheadHits(best, tune) };
}
