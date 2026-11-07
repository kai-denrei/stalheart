// manual-landing.mjs — the flight model is pure, fixed-step and deterministic
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.module.js';
import { LANDING_GAME } from '../src/content/landing-game.js';
import { createLanding, step, seedEntry } from '../src/domain/manual-landing.js';
import { flightToIsland, islandToFlight, hullTilt } from '../src/fx/manual-landing.js';

const T = LANDING_GAME, DT = T.sim.dt;
const entry = { altitude: 350, sink: 35, drift: 10, tilt: 0.3, fuelSeconds: 20, wind: 0 };

{ // the throttle follows its set point at the spool rate and burns fuel only when thrusting
  const s = createLanding(entry);
  assert.equal(s.throttle, 0); assert.equal(s.fuel, 20);
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(Math.abs(s.throttle - T.vehicle.spool * DT) < 1e-9, 'one step of spool');
  const fuel0 = s.fuel;
  for (let i = 0; i < 120; i++) step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s.throttle, 1, 'spooled to full within a second');
  assert.ok(s.fuel < fuel0, 'fuel burns'); assert.ok(s.fuel > fuel0 - 1.01, 'a second of full burn costs a second of fuel at most');
  const s2 = createLanding(entry); for (let i = 0; i < 120; i++) step(s2, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s2.fuel, 20, 'no burn, no fuel spent');
}
{ // gravity pulls, thrust along the axis pushes; no fuel, no thrust
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 });
  step(s, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vy < 0, 'falls');
  const f = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0, fuelSeconds: 0 }); f.throttle = 1;
  step(f, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.equal(f.throttle, 0, 'dry: the throttle reads zero'); assert.ok(f.vy < 0, 'dry: falls');
}
{ // the tilt aims the thrust: a + tilt pushes +x, a - tilt -x
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0.3 }); s.throttle = 1; s.fuel = 10;
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vx > 0, 'tilted right, pushed right');
  const b = createLanding({ ...entry, sink: 0, drift: 0, tilt: -0.3 }); b.throttle = 1; b.fuel = 10;
  step(b, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(b.vx < 0, 'tilted left, pushed left');
}
{ // deterministic: one timeline, one outcome; and the seeded entry is a pure function of its seed
  const run = () => { const s = createLanding(entry); for (let i = 0; i < 600; i++) step(s, { throttle: i > 200 ? 1 : 0.3, tiltRate: i % 7 === 0 ? 1 : 0, legs: i > 100 }, DT, T); return JSON.stringify(s); };
  assert.equal(run(), run());
  assert.deepEqual(seedEntry('planet-7', T), seedEntry('planet-7', T));
  const e = seedEntry('planet-7', T);
  assert.ok(e.altitude >= T.entry.altitude[0] && e.altitude <= T.entry.altitude[1]); assert.ok(e.sink >= T.entry.sink[0] && e.sink <= T.entry.sink[1]);
  assert.ok(Math.abs(e.drift) >= T.entry.drift[0] && Math.abs(e.drift) <= T.entry.drift[1]); assert.ok(Math.abs(e.tilt) >= T.entry.tilt[0] && Math.abs(e.tilt) <= T.entry.tilt[1]);
  assert.ok(e.fuelSeconds >= T.entry.fuelSeconds[0] && e.fuelSeconds <= T.entry.fuelSeconds[1]);
  assert.notDeepEqual(seedEntry('planet-7', T), seedEntry('planet-8', T), 'another seed, another problem');
  for (const seed of ['planet-7', 'planet-8', 'lab', 'x']) { const q = seedEntry(seed, T); assert.ok(Math.sign(q.tilt) === -Math.sign(q.drift) && q.tilt !== 0, `${seed}: the tilt leans against the drift`); }
  // the entry each planet had before the sign rule (7a737a81's seedEntry on this tune): altitude, sink, drift, the tilt's size and the
  // fuel are unchanged, only the tilt's sign moved (a discarded draw holds the old sign draw's place)
  const old7 = { altitude: 327.6030795183033, sink: 38.30362973269075, drift: -4.934013163903728, tilt: 0.19141935326624662, fuelSeconds: 20.002271288074553 };
  for (const k of ['altitude', 'sink', 'drift', 'fuelSeconds']) assert.equal(e[k], old7[k], `planet-7 keeps its old ${k}`);
  assert.equal(Math.abs(e.tilt), old7.tilt, 'planet-7 keeps its old tilt size');
}
{ // the legs deploy over legTime once asked, and stay down
  const s = createLanding(entry);
  for (let i = 0; i < 12; i++) step(s, { throttle: 0, tiltRate: 0, legs: true }, DT, T);
  assert.ok(s.legs > 0 && s.legs < 1, 'deploying'); assert.equal(s.legsDown, false);
  for (let i = 0; i < 200; i++) step(s, { throttle: 0, tiltRate: 0, legs: false }, DT, T);
  assert.equal(s.legs, 1); assert.equal(s.legsDown, true, 'down, and a later false does not retract them');
}
console.log('manual-landing: step ok');
import { hStop, predictImpact, verdict, flareDue, flareStep, touched } from '../src/domain/manual-landing.js';
{ // the stopping distance is v² / 2(T - g) at full thrust
  const s = createLanding({ ...entry, sink: 30, drift: 0, tilt: 0 });
  assert.ok(Math.abs(hStop(s, T) - 30 * 30 / (2 * (T.vehicle.thrust - T.sim.gravity))) < 1e-9);
  // and a full burn started at exactly that height stops within a few metres of the ground (the integrator against the formula)
  const f = createLanding({ ...entry, sink: 30, drift: 0, tilt: 0, fuelSeconds: 60 }); f.y = hStop(f, T) + 6; f.throttle = 1; f.set = 1;   // +6: headroom for the integrator's discretisation (the throttle is already at full, so no spool lag)
  let lowest = f.y; for (let i = 0; i < 2400 && f.vy < 0; i++) { step(f, { throttle: 1, tiltRate: 0, legs: true }, DT, T); lowest = Math.min(lowest, f.y); }
  assert.ok(f.vy >= 0, 'the loop ended because the rocket stopped, not on the step cap');
  assert.ok(lowest > 0 && lowest < 12, `stops above the ground and near it (${lowest.toFixed(1)} m)`);
}
{ // the predictor lands where the integrator lands, at the current throttle
  const s = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 });
  const p = predictImpact(s, T);
  const q = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 }); let t = 0; while (q.y > 0 && t < 60) { step(q, { throttle: 0, tiltRate: 0, legs: false }, DT, T); t += DT; }
  assert.ok(p.reached); assert.ok(Math.abs(p.x - q.x) < 2, `predicted x ${p.x.toFixed(1)} against flown ${q.x.toFixed(1)}`); assert.ok(Math.abs(p.t - t) < 0.3);
  const high = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 }); high.y = 1e6;
  assert.equal(predictImpact(high, T).reached, false, "beyond the predictor's horizon: not reached");
}
{ // the predictor holds the set point: with the throttle held at full it lands where a held-throttle flight lands
  const mk = () => { const q = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0.1, fuelSeconds: 1 }); q.throttle = 1; q.set = 1; return q; };
  const p = predictImpact(mk(), T);
  const q = mk(); let t = 0; while (q.y > 0 && t < 60) { step(q, { throttle: null, tiltRate: 0, legs: false }, DT, T); t += DT; }
  assert.ok(p.reached); assert.ok(Math.abs(p.x - q.x) < 2, `held throttle: predicted x ${p.x.toFixed(1)} against flown ${q.x.toFixed(1)}`); assert.ok(Math.abs(p.t - t) < 0.3, `held throttle: predicted t ${p.t.toFixed(2)} against flown ${t.toFixed(2)}`);
  assert.ok(q.x > 6 * t * 0.9, 'the thrust did push the flight (the held throttle is in the trajectory)');
}
{ // touched reads the ground it is given, as predictImpact does (default 0)
  assert.equal(touched({ y: 0 }), true); assert.equal(touched({ y: 0.1 }), false);
  assert.equal(touched({ y: 5 }, 5), true); assert.equal(touched({ y: 5.1 }, 5), false); assert.equal(touched({ y: -2 }, -3), false);
}
{ // the verdict: the worst axis names the reason; legs up, a slope or off the pad are wrecks whatever the speeds
  const base = { ...createLanding(entry), vy: -1, vz: 0, vx: 0.5, tilt: 0.02, legs: 1, legsDown: true };
  assert.deepEqual(verdict({ ...base }, 0, false, T).grade, 'CLEAN');
  assert.deepEqual([verdict({ ...base, vy: -4 }, 0, false, T).grade, verdict({ ...base, vy: -4 }, 0, false, T).reason], ['HARD', 'sink']);
  assert.deepEqual([verdict({ ...base, vx: 5 }, 0, false, T).grade, verdict({ ...base, vx: 5 }, 0, false, T).reason], ['WRECK', 'drift']);
  assert.deepEqual([verdict({ ...base, tilt: 0.1 }, 0, false, T).grade, verdict({ ...base, tilt: 0.1 }, 0, false, T).reason], ['HARD', 'tilt']);
  assert.deepEqual([verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).grade, verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).reason], ['WRECK', 'legs']);
  assert.deepEqual(verdict({ ...base }, 0.2, false, T).reason, 'slope'); assert.deepEqual(verdict({ ...base }, 0, true, T).reason, 'off-pad');
  const v = verdict({ ...base, vy: -3.3, vx: -2.2, tilt: 0.05 }, 0, false, T);
  assert.equal(v.sink, 3.3); assert.equal(v.drift, 2.2); assert.ok(Math.abs(v.tilt - 0.05) < 1e-12, 'the readings are reported as flown');
}
{ // the verdict's tie-break, the limits' strictness and the precedence
  const base = { ...createLanding(entry), vy: -1, vz: 0, vx: 0.5, tilt: 0.02, legs: 1, legsDown: true };
  const g = (o, slope = 0, off = false) => { const v = verdict({ ...base, ...o }, slope, off, T); return [v.grade, v.reason]; };
  // two axes at one grade: the one further over its hard limit (value / hard) names the reason
  assert.deepEqual(g({ vy: -5, vx: 3 }), ['HARD', 'sink'], 'sink 5/6 against drift 3/4');
  assert.deepEqual(g({ vy: -4, vx: 3.5 }), ['HARD', 'drift'], 'sink 4/6 against drift 3.5/4');
  assert.deepEqual(g({ vy: -3, tilt: 0.1 }), ['HARD', 'tilt'], 'sink 3/6 against tilt 0.1/0.192');
  // a worse grade beats a nearer ratio: a WRECK names the reason over a HARD axis, either way round
  assert.deepEqual(g({ vy: -5, vx: 5 }), ['WRECK', 'drift'], 'HARD sink, WRECK drift');
  assert.deepEqual(g({ vy: -7, vx: 3 }), ['WRECK', 'sink'], 'WRECK sink, HARD drift');
  // exactly at a limit is the milder grade (strict >)
  assert.deepEqual(g({ vy: -T.verdict.clean.sink }), ['CLEAN', 'sink'], 'a sink of exactly clean is CLEAN (and a CLEAN verdict still names the nearest axis)');
  assert.deepEqual(g({ vy: -T.verdict.hard.sink }), ['HARD', 'sink'], 'a sink of exactly hard is HARD');
  assert.deepEqual(g({ vy: -(T.verdict.hard.sink + 0.01) }), ['WRECK', 'sink'], 'just over hard is WRECK');
  assert.deepEqual(g({ vx: T.verdict.hard.drift }), ['HARD', 'drift'], 'a drift of exactly hard is HARD');
  // precedence: legs, then slope, then off the pad, over any speeds
  assert.deepEqual(g({ legs: 0.4, legsDown: false }, 0.5, true), ['WRECK', 'legs'], 'legs up, a slope and off the pad: legs');
  assert.deepEqual(g({}, 0.5, true), ['WRECK', 'slope'], 'legs down, a slope and off the pad: slope');
  assert.deepEqual(g({}, 0, true), ['WRECK', 'off-pad'], 'legs down, a flat pad, off it: off-pad');
  assert.deepEqual(g({ vy: -5 }, T.verdict.slope), ['HARD', 'sink'], 'a slope exactly at the limit is not over it');
  // the slope is a magnitude: a downhill foot is as steep as an uphill one
  assert.deepEqual(g({}, -0.2), ['WRECK', 'slope'], 'a negative slope past the limit is a wreck');
}
{ // the flare: due below its altitude inside its corridor, never above it or outside; and it settles the rocket to the ground
  const s = { ...createLanding(entry), y: 25, vy: -5, vx: 2, tilt: 0.1 };
  assert.equal(flareDue(s, T), true); assert.equal(flareDue({ ...s, y: 40 }, T), false); assert.equal(flareDue({ ...s, vy: -9 }, T), false); assert.equal(flareDue({ ...s, vx: 6 }, T), false); assert.equal(flareDue({ ...s, tilt: 0.3 }, T), false);
  let f = { ...s }; for (let i = 0; i < 3000 && !touched(f); i++) flareStep(f, DT, T);
  assert.ok(touched(f), 'lands'); assert.ok(Math.abs(f.vy) <= T.flare.sinkFinal + 0.05, `settles at the final sink (${f.vy.toFixed(2)})`);
  assert.ok(Math.abs(f.vx) < 0.2 && Math.abs(f.tilt) < 0.02 && f.legsDown, 'drift and tilt killed, legs down');
  assert.equal(verdict(f, 0, false, T).grade, 'CLEAN', 'the auto-lander never crashes');
}
console.log('manual-landing: rules ok');
{ // spec 14 B: one axis, the tilt about z toward +x; the drift is on x. A +0.3 tilt at full burn pushes +x along (sin t, cos t, 0), vz untouched
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0.3 }); s.throttle = 1; s.fuel = 10;
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vx > 0, 'a +x tilt pushes +x'); assert.equal(s.vz, 0, 'vz untouched');
  assert.ok(Math.abs(s.vx - Math.sin(0.3) * T.vehicle.thrust * DT) < 1e-9, 'vx along sin tilt');
  assert.ok(Math.abs(s.vy - (Math.cos(0.3) * T.vehicle.thrust - T.sim.gravity) * DT) < 1e-9, 'vy along cos tilt less g');
  const e = createLanding(entry); assert.equal(e.vx, entry.drift, 'the entry drift is on vx'); assert.equal(e.vz, 0, 'and none on vz');
  assert.deepEqual(Object.keys(e), ['x', 'y', 'z', 'vx', 'vy', 'vz', 'tilt', 'tiltRate', 'throttle', 'set', 'fuel', 'legs', 'legsDown', 'wind', 't', 'phase'], 'one rotational axis: the tilt and its rate')
}
{ // the verdict and the flare read the tilt's magnitude
  const s = createLanding({ ...entry, sink: 1, drift: 0, tilt: -0.3 }); s.legs = 1; s.legsDown = true;
  const v = verdict(s, 0, false, T); assert.equal(v.grade, 'WRECK'); assert.equal(v.reason, 'tilt'); assert.ok(Math.abs(v.tilt - 0.3) < 1e-12);
  const f = createLanding({ ...entry, altitude: 20, sink: 2, drift: 0, tilt: -0.3 });
  assert.equal(flareDue(f, T), false, 'a -0.3 tilt is outside the 0.25 corridor'); f.tilt = -0.2; assert.equal(flareDue(f, T), true);
}
console.log('manual-landing: drift on x ok');
{ // the host's pose (spec 14, the frame note): Rz(-tilt) puts the hull's up (0, 1, 0) on the thrust direction (sin tilt, cos tilt, 0)
  for (const tilt of [0.3, -0.25, 0, 0.35]) {
    const v = new THREE.Vector3(0, 1, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ(-tilt));
    const d = [Math.sin(tilt), Math.cos(tilt), 0];
    v.toArray().forEach((x, k) => assert.ok(Math.abs(x - d[k]) < 1e-12, `tilt ${tilt}: component ${k} ${x} vs ${d[k]}`));
  }
}
{ // THE SIDE VIEW's frame (spec 14 A): island = Ry(azimuth) . flight, three.js's makeRotationY sense (a + angle turns +z toward +x). The camera
  // sits on the flight's +z side looking toward -z (its right is then +x: right = forward x up), so the disk lies along the flight's -z:
  // flightToIsland([0, 0, -1], az) is the disk's island direction for az = atan2(-d.x, -d.z)
  const near = (u, v, what) => u.forEach((x, k) => assert.ok(Math.abs(x - v[k]) < 1e-12, `${what}: component ${k} ${x} vs ${v[k]}`));
  for (const p of [[1, 2, 3], [-4, 0.5, 0], [0, 0, 1]]) { near(flightToIsland(p, 0), p, `az 0 is identity (${p})`); near(islandToFlight(p, 0), p, `az 0 back (${p})`); }
  const d = [0.6, -0.62], l = Math.hypot(...d), az = Math.atan2(-d[0], -d[1]);
  near(flightToIsland([0, 0, -1], az), [d[0] / l, 0, d[1] / l], 'the line of sight (flight -z) on the disk\'s azimuth');
  // the screen's right for a camera looking along (dx, 0, dz) with up +y is forward x up = (-dz, 0, dx): the flight's +x
  near(flightToIsland([1, 0, 0], az), [-d[1] / l, 0, d[0] / l], 'the flight\'s +x is the screen\'s right');
  near(flightToIsland([0, 7, 0], az), [0, 7, 0], 'the height untouched');
  for (const p of [[12, -3, 40], [-55, 350, 2]]) for (const a of [az, Math.PI / 2, -2.1]) { near(islandToFlight(flightToIsland(p, a), a), p, `round trip ${p} at ${a}`); near(flightToIsland(islandToFlight(p, a), a), p, `round trip back ${p} at ${a}`); }
  near(flightToIsland([0, 0, 1], Math.PI / 2), [1, 0, 0], 'at a quarter turn the flight\'s +z is island +x');
}
console.log('manual-landing: side frame ok');
{ // the hull's tilt in the holder's (island) frame: Ry(az) . Rz(-tilt) . Ry(-az) puts the hull's up on the flight's thrust direction turned to the island
  for (const az of [0, Math.PI / 2, Math.atan2(0.6, -0.62)]) for (const tilt of [0.3, -0.25, 0]) {
    const v = new THREE.Vector3(0, 1, 0).applyMatrix4(hullTilt(tilt, az, new THREE.Matrix4())), d = flightToIsland([Math.sin(tilt), Math.cos(tilt), 0], az);
    v.toArray().forEach((x, k) => assert.ok(Math.abs(x - d[k]) < 1e-12, `az ${az} tilt ${tilt}: component ${k} ${x} vs ${d[k]}`));
  }
  // the up is blind to the trailing Ry(-az) (it leaves y alone); the flight's +x is not: the conjugate tilts it about the flight's z like the
  // flight-frame Rz(-tilt) does, (1, 0, 0) onto (cos t, -sin t, 0), both turned to the island. (The hull's own island +x is not that axis: it lands
  // on flightToIsland([cos t, -sin t, 0]) only under Ry(az) . Rz(-tilt) with the trailing turn missing, the control below)
  const xAt = (M, az) => new THREE.Vector3(...flightToIsland([1, 0, 0], az)).applyMatrix4(M).toArray();
  for (const az of [Math.PI / 2, 0.7]) for (const tilt of [0.3, -0.25]) {
    const v = xAt(hullTilt(tilt, az, new THREE.Matrix4()), az), d = flightToIsland([Math.cos(tilt), -Math.sin(tilt), 0], az);
    v.forEach((x, k) => assert.ok(Math.abs(x - d[k]) < 1e-12, `az ${az} tilt ${tilt}: the flight's +x, component ${k} ${x} vs ${d[k]}`));
    const bad = xAt(new THREE.Matrix4().makeRotationY(az).multiply(new THREE.Matrix4().makeRotationZ(-tilt)), az);   // the control: no trailing Ry(-az)
    assert.ok(bad.some((x, k) => Math.abs(x - d[k]) > 1e-3), `az ${az} tilt ${tilt}: the check tells a missing trailing Ry(-az) (${bad} vs ${d})`);
  }
}
console.log('manual-landing: pose ok');
