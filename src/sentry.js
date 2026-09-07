// sentry.js — THE SENTRY RANGE's rules: what a turret can reach, how fast it
// gets there, and when it may shoot. Pure: no DOM, no three.js, Node-tested
// in test/sentry.mjs. sentry-tab.js owns the models, the tracers and the
// muzzle flashes.
//
// The models come from the Sentry Workshop
// (https://jelaludo.github.io/SentryTowers_A6/), and they arrive with a
// contract this module is written against — the same "a part is only
// addressable if it was named a pivot BEFORE the merge" rule this project
// already lives by, honoured by someone else's exporter:
//
//   ROOT → BASE → YAW → PITCH → RECOIL      the articulation, on every family
//   MUZZLE_00 … MUZZLE_nn                   where a round actually leaves
//   Armor / Edge / Dark / Copper / Signal / Identification    material names
//
// SIGNS, ONCE, HERE. The workshop's own viewer applies elevation as
// `PITCH.rotation.x = -degToRad(elev)`, and that is not a quirk: rotating a
// +Z-forward node about +X by a NEGATIVE angle is what lifts its nose. So
// this module speaks in ELEVATION DEGREES, positive up, and the tab does the
// one negation at the point of application. Two places deciding what "up"
// means is how a turret ends up shooting at the floor.

import { makeParams, clampParams, formatKnobs, knobProblems } from './knobs.js';

// The workshop's six families. `fixed` is its own ruling — the Relay is a
// structure, not a gun, and a range that pretends otherwise is a range that
// lies about what it tested.
// EACH FAMILY HAS A VOICE, and the table is where it is decided — the tab
// never names a sound. `fire` is per round; `ready` is the spin-up, which
// only the Rotor has, because only the Rotor has something to spin.
//
// The Quiver is the odd one out and deliberately so: `missile: true` means
// it does not fire a tracer at all. It carries the Javelin — it must LOCK
// before it will shoot, and what leaves the tube then flies its own
// intercept (src/lockon.js). It is the same weapon the sniper lab aims by
// hand, at the other end of the same ladder: manual there, automatic here.
export const SENTRY_FAMILIES = [
  { id: 'needle', label: 'Needle', note: 'single accelerator — one muzzle, long and thin',
    fire: 'tower_sniper' },
  { id: 'rotor', label: 'Rotor', note: 'rotary barrels — six muzzles, fed from drums',
    fire: 'minigun_fire', ready: 'minigun_ready' },
  { id: 'kiln', label: 'Kiln', note: 'twin projectors — recessed throats',
    fire: 'tower_aoe' },
  { id: 'quiver', label: 'Quiver', note: 'missile cells — six capped tubes · locks on, then homes',
    fire: 'tower_homing', missile: true },
  { id: 'lancer', label: 'Lancer', note: 'rail and focusing collars — one aperture',
    fire: 'tower_laser' },
  { id: 'relay', label: 'Relay', note: 'a mast, not a weapon: fixed, no articulation', fixed: true },
  // THE FIVE THE WORKSHOP ADDED. Same contract, same tiers, vendored
  // alongside the first six. The two LOBBERS are the reason this matters
  // beyond the roster: a mortar does not point at what it is shooting, and
  // the range is where that gets looked at.
  { id: 'railgun', label: 'Railgun', note: 'mass driver — induction track, one aperture',
    fire: 'tower_sniper' },
  { id: 'howitzer', label: 'Howitzer', note: 'siege barrel — lobs, and points UP to do it',
    fire: 'tank_main', lob: true, arcCells: 3.4 },
  { id: 'mortar', label: 'Mortar', note: 'tube and baseplate — the steepest arc on the range',
    fire: 'tower_aoe', lob: true, arcCells: 4.6 },
  { id: 'plasma', label: 'Plasma', note: 'perforated nozzle — a thrower, not a gun',
    fire: 'tower_laser' },
  { id: 'heptapod_a6', label: 'Heptapod A6', note: 'six legs, vertical launch cells — walks, fixed turret',
    fire: 'tower_homing', fixed: true },
];
export const SENTRY_TIERS = [1, 2, 3];
export const familyById = (id) => SENTRY_FAMILIES.find((f) => f.id === id) || SENTRY_FAMILIES[0];
export const sentryUrl = (id, tier) => `assets/models/sentries/${id}_t${tier}.glb`;

export const SENTRY_TUNE = {
  // ELEVATION STOPS. The workshop's viewer offers -10 to +65, and +65 is
  // kept — but -10 is a SLIDER range for looking at a model on a turntable,
  // not a mount's depression limit, and it is unusable on a range. The
  // trunnion on these families sits about 1.4 units above its own feet, so
  // at -10 a sentry standing on the FLOOR is blind out to 7.9 units — most
  // of the ring — and a wall makes it worse. -35 lets a gun cover its own
  // ground; the knob puts the workshop's number back.
  elevMin: -35, elevMax: 65,
  yawRate: 110,       // degrees per second
  pitchRate: 70,
  tolerance: 2.5,     // degrees of total error that counts as ON TARGET
  cooldown: 0.35,     // seconds between rounds
  recoilKick: 0.15,   // the RECOIL pivot's travel, in model units
  recoilBack: 0.35,   // ...decaying this fast (the workshop's own numbers)
  muzzleVel: 26,      // model units per second — a visible tracer, not a hitscan
  // the range
  targets: 5, popMin: 1.2, popMax: 3.0,   // seconds a target stays up
  gapMin: 0.4, gapMax: 1.8,               // ...and between one dropping and the next
  ringMin: 3.5, ringMax: 9.0,             // how far out they pop, in model units
  targetHi: 3.2,                          // ...and how high one may pop
  hp: 2,
  hitRadius: 0.55,    // how near a round must LAND — see fireLine
  // --- the battery -------------------------------------------------------
  count: 1,           // how many sentries stand on the range
  spread: 3.0,        // ...and how far apart, when there is more than one
  // MOUNTED ON A WALL. The gun's whole envelope is measured from ITS OWN
  // height, so raising it does not just move the model: everything on the
  // ground drops below the horizon, and the model's own -10 degree floor
  // becomes the thing that decides what it can still reach. A wall sentry
  // covers the far ground and is blind at its feet, which is the point of
  // putting one on a wall and the reason this is a knob and not a prop.
  mount: 0,           // units the base stands above the floor
  // --- waves -------------------------------------------------------------
  waveSize: 6,        // enemies in the first wave
  waveGrow: 2,        // ...and this many more each time
  waveGap: 2.5,       // seconds between one cleared and the next
  walkSpeed: 1.6,     // units per second, inward
  reachRadius: 1.2,   // this close to the battery and it has got through
  // --- the Quiver's seeker ------------------------------------------------
  // A sentry locks with its DRIVE, not with a pair of hands: the gate is in
  // degrees of aim error, matched to the tolerance the same gun uses to
  // decide it is on target, and the lock time is what turns a launcher into
  // a slower, more certain weapon than the guns beside it.
  lockGate: 6,        // degrees of aim error that counts as tracking
  lockTime: 1.1,      // seconds of it before the cell will fire
  lockBreak: 18,      // ...and how far off before an acquired lock lets go
};

export const SENTRY_KNOBS = [
  { key: 'elevMin', label: 'elevation min', group: 'envelope', min: -60, max: 0, step: 1 },
  { key: 'elevMax', label: 'elevation max', group: 'envelope', min: 5, max: 89, step: 1 },
  { key: 'yawRate', label: 'yaw rate (deg/s)', group: 'drive', min: 10, max: 720, step: 5 },
  { key: 'pitchRate', label: 'elevation rate (deg/s)', group: 'drive', min: 5, max: 360, step: 5 },
  { key: 'tolerance', label: 'on target within (deg)', group: 'drive', min: 0.2, max: 15, step: 0.1 },
  { key: 'cooldown', label: 'rate of fire (s)', group: 'gun', min: 0.05, max: 3, step: 0.05 },
  { key: 'recoilKick', label: 'recoil travel', group: 'gun', min: 0, max: 0.6, step: 0.01 },
  { key: 'recoilBack', label: 'recoil recovery', group: 'gun', min: 0.05, max: 2, step: 0.05 },
  { key: 'muzzleVel', label: 'muzzle velocity', group: 'gun', min: 4, max: 120, step: 1 },
  { key: 'targets', label: 'targets up', group: 'range', min: 1, max: 12, step: 1 },
  { key: 'popMin', label: 'up for, min (s)', group: 'range', min: 0.2, max: 8, step: 0.1 },
  { key: 'popMax', label: 'up for, max (s)', group: 'range', min: 0.3, max: 12, step: 0.1 },
  { key: 'gapMin', label: 'gap min (s)', group: 'range', min: 0, max: 6, step: 0.1 },
  { key: 'gapMax', label: 'gap max (s)', group: 'range', min: 0.1, max: 10, step: 0.1 },
  { key: 'ringMin', label: 'nearest (units)', group: 'range', min: 1, max: 20, step: 0.5 },
  { key: 'ringMax', label: 'farthest (units)', group: 'range', min: 2, max: 40, step: 0.5 },
  { key: 'targetHi', label: 'highest pop (units)', group: 'range', min: 0, max: 12, step: 0.1 },
  { key: 'hp', label: 'rounds to kill', group: 'range', min: 1, max: 10, step: 1 },
  { key: 'hitRadius', label: 'hit radius (units)', group: 'gun', min: 0.05, max: 3, step: 0.05 },
  { key: 'count', label: 'sentries', group: 'battery', min: 1, max: 6, step: 1 },
  { key: 'spread', label: 'apart (units)', group: 'battery', min: 0, max: 12, step: 0.5 },
  { key: 'mount', label: 'wall height (units)', group: 'battery', min: 0, max: 8, step: 0.25 },
  { key: 'waveSize', label: 'first wave', group: 'waves', min: 1, max: 30, step: 1 },
  { key: 'waveGrow', label: 'grow by', group: 'waves', min: 0, max: 10, step: 1 },
  { key: 'waveGap', label: 'between waves (s)', group: 'waves', min: 0, max: 15, step: 0.5 },
  { key: 'walkSpeed', label: 'walk (units/s)', group: 'waves', min: 0.1, max: 10, step: 0.1 },
  { key: 'reachRadius', label: 'through at (units)', group: 'waves', min: 0.2, max: 6, step: 0.1 },
  { key: 'lockGate', label: 'lock gate (deg)', group: 'seeker', min: 0.5, max: 30, step: 0.5 },
  { key: 'lockTime', label: 'time to lock (s)', group: 'seeker', min: 0.1, max: 6, step: 0.1 },
  { key: 'lockBreak', label: 'lock breaks at (deg)', group: 'seeker', min: 1, max: 90, step: 1 },
];

export const makeSentryParams = (src = SENTRY_TUNE) => makeParams(SENTRY_KNOBS, src);
export const clampSentryParams = (p, src) => clampParams(SENTRY_KNOBS, p, src);
export const formatSentryTune = (p) => formatKnobs('SENTRY_TUNE', SENTRY_KNOBS, p);
export const sentryKnobProblems = () => knobProblems(SENTRY_KNOBS, SENTRY_TUNE);

// --- angles ---------------------------------------------------------------

// Degrees, wrapped into (-180, 180]. Every angle in this module lives here,
// because the one thing a turret must never do is take the long way round.
export function wrapDeg(a) {
  let x = ((a + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
}

// The SHORT way from a to b, signed. This is the whole of the yaw problem:
// slewing from +170 to -170 is twenty degrees, not three hundred and forty,
// and the naive `b - a` is wrong exactly there and nowhere else — so it is
// right in every test anybody writes by accident.
export const deltaDeg = (a, b) => wrapDeg(b - a);

// WHERE TO POINT. `p` is the target in the sentry's own frame: +Y up, +Z
// forward, which is the workshop's stated convention. Returns degrees —
// elevation POSITIVE UP; the tab negates it once, at the PITCH node.
export function aimAt(p) {
  const [x, y, z] = p;
  const flat = Math.hypot(x, z);
  return {
    yaw: wrapDeg((Math.atan2(x, z) * 180) / Math.PI),
    elev: (Math.atan2(y, flat) * 180) / Math.PI,
  };
}

// Can this turret physically point there? The envelope is the model's, and a
// target outside it must be REPORTED rather than shot at with a barrel that
// is visibly aimed somewhere else.
// THE LAUNCH ANGLE FOR A LOB. A lobbed round's barrel is not aimed at the
// target — it is aimed along the LAUNCH of the arc that ends there, and the
// two are nothing like each other. A parabola of height h over a range d
// leaves at atan(4h/d), so the tube and the shell are derived from ONE
// number and cannot drift: raise the arc and the barrel rises with it.
//
// The Sentry Workshop's own viewer is the check on this: it opens a Mortar
// at 68 degrees and refuses to let it below 45.
export const lobAngle = (range, arcHeight) =>
  (Math.atan((4 * arcHeight) / Math.max(1e-6, range)) * 180) / Math.PI;

export const inEnvelope = (aim, tune = SENTRY_TUNE) =>
  aim.elev >= tune.elevMin && aim.elev <= tune.elevMax;

// THE DEAD ZONE a wall buys you. A gun `mount` units up with a depression
// stop of `elevMin` cannot point at the ground nearer than this — inside it,
// everything walks through untouched. At the workshop's own -10 degrees a
// two-unit wall blinds the sentry out to 11.3 units, which is the whole
// range and then some, and that is not a bug in the lab: it is what a
// ten-degree depression stop means. Reported, so the range explains itself
// instead of looking broken.
// `gunHeight` is the trunnion's real height above the ground — the wall PLUS
// the model's own base, which is about 1.4 units on these families and is
// why even a floor-mounted sentry has a dead zone. Passing it in rather than
// reading `mount` is the difference between a number that explains a silent
// gun and one that says zero while the gun sits silent.
export function deadZone(tune = SENTRY_TUNE, gunHeight = tune.mount) {
  const dep = -Math.min(0, tune.elevMin);
  if (gunHeight <= 0) return 0;
  if (dep <= 0) return Infinity;
  return gunHeight / Math.tan((dep * Math.PI) / 180);
}

// --- the turret -----------------------------------------------------------

export function makeSentry(family = 'needle', tier = 1, pos = [0, 0, 0]) {
  return {
    family, tier,
    // WHERE IT STANDS, and the whole reason a wall changes anything: every
    // angle this turret computes is measured from here, not from the origin.
    pos: pos.slice(),
    yaw: 0, elev: 0,          // where it IS, degrees
    wantYaw: 0, wantElev: 0,  // where it wants to be
    recoil: 0,                // 0..kick, the RECOIL pivot's travel
    cool: 0,                  // seconds until it may fire again
    muzzle: 0,                // which MUZZLE_nn is next, round-robin
    rounds: 0, hits: 0, kills: 0,
    // THE TARGET'S ID, never its index. The range's array is filtered and
    // refilled every step, so an index points at a different target from one
    // frame to the next — which silently turned "keep the one you have" into
    // "keep whatever is in slot 1 now", and the turret whipped about while
    // the log insisted it had held its lock.
    target: -1,
  };
}

// Drive the turret toward what it wants, at its rates, by the short way.
// Returns true when it is ON TARGET — which is the fire-control gate, and
// deliberately a total error rather than two separate ones: a barrel that is
// dead on in yaw and ten degrees high is not aimed at anything.
export function slew(st, dt, tune = SENTRY_TUNE) {
  const dy = deltaDeg(st.yaw, st.wantYaw);
  const de = st.wantElev - st.elev;          // elevation does not wrap
  const my = tune.yawRate * dt, me = tune.pitchRate * dt;
  st.yaw = wrapDeg(st.yaw + Math.max(-my, Math.min(my, dy)));
  st.elev = Math.max(tune.elevMin, Math.min(tune.elevMax,
    st.elev + Math.max(-me, Math.min(me, de))));
  return onTarget(st, tune);
}

export const aimError = (st) =>
  Math.hypot(deltaDeg(st.yaw, st.wantYaw), st.wantElev - st.elev);

export const onTarget = (st, tune = SENTRY_TUNE) => aimError(st) <= tune.tolerance;

// Point it at a target in its own frame. Clamps the WANT into the envelope,
// so the barrel tracks as close as it can and the caller can still see, from
// inEnvelope, that the shot is not on.
export function track(st, p, tune = SENTRY_TUNE) {
  const aim = aimAt(p);
  st.wantYaw = aim.yaw;
  st.wantElev = Math.max(tune.elevMin, Math.min(tune.elevMax, aim.elev));
  return aim;
}

export function stepGun(st, dt, tune = SENTRY_TUNE) {
  if (st.cool > 0) st.cool = Math.max(0, st.cool - dt);
  if (st.recoil > 0) st.recoil = Math.max(0, st.recoil - dt * tune.recoilBack);
}

// May it shoot: pointed, cooled, and the target inside the envelope.
export const canFire = (st, inside, tune = SENTRY_TUNE) =>
  !!inside && st.cool <= 0 && onTarget(st, tune);

// Pull the trigger. Returns the muzzle index to fire FROM — round-robin, so
// a six-barrelled Rotor walks its barrels instead of firing all of them from
// the first one. `muzzles` is how many the loaded model actually has.
export function fire(st, muzzles = 1, tune = SENTRY_TUNE) {
  const m = muzzles > 0 ? st.muzzle % muzzles : 0;
  st.muzzle = (st.muzzle + 1) % Math.max(1, muzzles);
  st.cool = tune.cooldown;
  st.recoil = tune.recoilKick;
  st.rounds++;
  return m;
}

// LEAD. A round is not instant, and a walker does not wait for it: at the
// default muzzle velocity a target nine units out is hit 0.35 s after the
// trigger, by which time it has moved 0.56 units — which is just past the
// hit radius, so a sentry that aims where the target IS misses every single
// moving target and hits every stationary one. That is the exact shape of
// "it tracks beautifully and never kills anything".
//
// Solved by iteration rather than by the quadratic: two passes are already
// accurate to well under the hit radius at these speeds, and the closed form
// has a branch for "no solution" that a lab does not want and a barrel
// cannot express anyway.
export function leadPoint(p, vel, from, speed, iters = 2) {
  if (!vel || !(speed > 0)) return p.slice();
  let t = 0;
  for (let i = 0; i < iters; i++) {
    const x = p[0] + vel[0] * t, y = p[1] + vel[1] * t, z = p[2] + vel[2] * t;
    t = Math.hypot(x - from[0], y - from[1], z - from[2]) / speed;
  }
  return [p[0] + vel[0] * t, p[1] + vel[1] * t, p[2] + vel[2] * t];
}

// --- the range ------------------------------------------------------------
// Targets POP UP, stand for a while, and drop. A popper rather than a walker,
// because what this lab is testing is the TRACKING: a target that arrives at
// a new bearing every few seconds exercises the slew, the envelope and the
// wrap far harder than one crossing the field in a straight line.

export function makeRange() {
  return { targets: [], next: 1, t: 0, wave: 0, gap: 0, leaked: 0, cleared: 0 };
}

// --- WAVES ----------------------------------------------------------------
// Enemies that walk in and CAN DIE, as against the popper's fixed marks.
// A moving target is a far harder test of the drive: the turret has to keep
// the lock while the bearing changes under it, and it is the only way the
// yaw RATE means anything at all.

export function spawnWave(range, rng, tune = SENTRY_TUNE) {
  range.wave++;
  const n = Math.max(1, Math.round(tune.waveSize + tune.waveGrow * (range.wave - 1)));
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    // a ring's worth of bearing, and a little scatter in range so a wave
    // arrives as a crowd rather than as a perfect circle closing in
    const r = tune.ringMax * (0.92 + rng() * 0.16);
    range.targets.push({
      id: range.next++,
      pos: [Math.sin(a) * r, 0, Math.cos(a) * r],
      up: true, hp: Math.round(tune.hp), walker: true,
      speed: tune.walkSpeed * (0.85 + rng() * 0.3),
      vel: [0, 0, 0],   // filled by stepWalkers — the lead reads it
    });
  }
  return n;
}

// Walk them in. Anything reaching `reachRadius` of the battery's centre has
// GOT THROUGH — it is removed and counted, because a range where the enemy
// walks over the guns and keeps going is a range that measures nothing.
export function stepWalkers(range, dt, tune = SENTRY_TUNE) {
  const through = [];
  for (const t of range.targets) {
    if (!t.up || !t.walker) continue;
    let d = Math.hypot(t.pos[0], t.pos[2]);
    // MOVE FIRST, THEN TEST. Testing before the step counts an arrival one
    // frame late, which at a walk is invisible and at speed is a whole
    // enemy standing on the guns for a tick before anyone notices.
    const step = Math.min(Math.max(0, d - tune.reachRadius), t.speed * dt);
    // the velocity is published, not inferred: a fire-control system that
    // has to differentiate a position to find a speed is one that lags by a
    // frame, and this one knows exactly where the thing is going
    t.vel = d > 1e-9 ? [-(t.pos[0] / d) * t.speed, 0, -(t.pos[2] / d) * t.speed] : [0, 0, 0];
    if (d > 1e-9 && step > 0) {
      t.pos[0] -= (t.pos[0] / d) * step;
      t.pos[2] -= (t.pos[2] / d) * step;
      d -= step;
    }
    if (d <= tune.reachRadius + 1e-9) { t.up = false; range.leaked++; through.push(t.id); }
  }
  range.targets = range.targets.filter((t) => t.up);
  return through;
}

// The wave clock: when the field is clear, wait the gap and send the next,
// bigger one. Returns the size sent, or 0.
export function stepWaves(range, dt, rng, tune = SENTRY_TUNE) {
  range.t += dt;
  if (range.targets.some((t) => t.up)) return 0;
  if (range.wave > 0 && range.gap <= 0) { range.gap = tune.waveGap; range.cleared++; }
  range.gap -= dt;
  if (range.gap > 0) return 0;
  range.gap = 0;
  return spawnWave(range, rng, tune);
}

// One target, somewhere on the ring. `rng` is a seeded stream: a replayed
// range must present the same problem twice or a tuning session is guesswork.
export function popTarget(range, rng, tune = SENTRY_TUNE) {
  const a = rng() * Math.PI * 2;
  const r = tune.ringMin + rng() * Math.max(0, tune.ringMax - tune.ringMin);
  const t = {
    id: range.next++,
    pos: [Math.sin(a) * r, rng() * tune.targetHi, Math.cos(a) * r],
    up: true, hp: Math.round(tune.hp),
    until: range.t + tune.popMin + rng() * Math.max(0, tune.popMax - tune.popMin),
  };
  range.targets.push(t);
  return t;
}

// Advance the range: drop what has stood too long, and bring the count back
// up after a gap. Returns the ids that dropped this step, so the tab can take
// their meshes down without a second pass.
export function stepRange(range, dt, rng, tune = SENTRY_TUNE) {
  range.t += dt;
  const dropped = [];
  for (const t of range.targets) {
    if (t.up && range.t >= t.until) { t.up = false; dropped.push(t.id); }
  }
  range.targets = range.targets.filter((t) => t.up);
  while (range.targets.length < Math.round(tune.targets)) {
    const t = popTarget(range, rng, tune);
    // stagger the refill so a whole wave does not appear on one frame
    t.until += rng() * Math.max(0, tune.gapMax - tune.gapMin) + tune.gapMin;
  }
  return dropped;
}

// A point in this sentry's own frame. One line, but it is the line that
// makes a battery possible and a wall mean something: two turrets standing
// three units apart do not agree about a single bearing on the range, and a
// turret on a wall does not agree with itself on the ground.
export const relTo = (st, p) => [p[0] - st.pos[0], p[1] - st.pos[1], p[2] - st.pos[2]];

// WHERE THE BATTERY STANDS. One at the origin; more than one on a ring, so
// they cover each other's blind bearings rather than queueing behind one
// another. `mount` lifts every one of them onto its wall.
export function placeBattery(tune = SENTRY_TUNE) {
  const n = Math.max(1, Math.round(tune.count));
  const out = [];
  for (let i = 0; i < n; i++) {
    if (n === 1) { out.push([0, tune.mount, 0]); continue; }
    const a = (i / n) * Math.PI * 2;
    out.push([Math.sin(a) * tune.spread, tune.mount, Math.cos(a) * tune.spread]);
  }
  return out;
}

// The one the turret should be pointed at: the nearest it can actually
// REACH. A sentry that locks onto something outside its elevation envelope
// and then never fires reads as broken, and is the first thing a range like
// this should refuse to do.
//
// AND IT KEEPS THE ONE IT HAS. `keepId` is the target it is already on: it
// stays on it while that target is up, alive and reachable, even if
// something nearer pops. Re-picking the nearest every frame made the barrel
// whip between two targets and settle on neither — which looks like a broken
// drive and is really a broken decision. A sentry commits.
export function pickTarget(range, tune = SENTRY_TUNE, keepId = -1, st = null) {
  const rel = (t) => (st ? relTo(st, t.pos) : t.pos);
  const engageable = (t) => t && t.up && t.hp > 0 && inEnvelope(aimAt(rel(t)), tune);
  if (keepId >= 0) {
    const i = range.targets.findIndex((t) => t.id === keepId);
    if (i !== -1 && engageable(range.targets[i])) return i;
  }
  let best = -1, bd = Infinity;
  for (let i = 0; i < range.targets.length; i++) {
    const t = range.targets[i];
    if (!engageable(t)) continue;
    const r = rel(t);
    const d = Math.hypot(r[0], r[1], r[2]);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// DID THAT ROUND ACTUALLY LAND ON IT? A tracer leaves along the BARREL, and
// the barrel is only as close to the target as the drive has managed to get
// it — so a round that left mid-slew arrives somewhere else. Without this the
// tolerance knob is decoration: every shot would hit however far off the gun
// was pointing, and the lab would be measuring nothing.
export const landedOn = (end, target, tune = SENTRY_TUNE) =>
  !!target && Math.hypot(end[0] - target.pos[0], end[1] - target.pos[1], end[2] - target.pos[2])
    <= tune.hitRadius;

// A round lands. Returns 'kill' | 'hit' | null.
export function hitTarget(st, range, id) {
  const t = range.targets.find((x) => x.id === id);
  if (!t || !t.up || t.hp <= 0) return null;
  st.hits++;
  t.hp--;
  if (t.hp > 0) return 'hit';
  t.up = false;
  st.kills++;
  return 'kill';
}
