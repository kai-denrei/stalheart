// manual-landing.mjs — the flight model is pure, fixed-step and deterministic
import assert from 'node:assert/strict';
import { LANDING_GAME } from '../src/content/landing-game.js';
import { createLanding, step, seedEntry } from '../src/domain/manual-landing.js';

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
{ // the tilt aims the thrust: forward tilt pushes +z, back tilt -z
  const s = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0.3 }); s.throttle = 1; s.fuel = 10;
  step(s, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(s.vz > 0, 'tilted forward, pushed forward');
  const b = createLanding({ ...entry, sink: 0, drift: 0, tilt: -0.3 }); b.throttle = 1; b.fuel = 10;
  step(b, { throttle: 1, tiltRate: 0, legs: false }, DT, T);
  assert.ok(b.vz < 0, 'tilted back, pushed back');
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
  const f = createLanding({ ...entry, sink: 30, drift: 0, tilt: 0, fuelSeconds: 60 }); f.y = hStop(f, T) + 6; f.throttle = 1; f.set = 1;   // +6: the spool is not instant
  let lowest = f.y; for (let i = 0; i < 2400 && f.vy < 0; i++) { step(f, { throttle: 1, tiltRate: 0, legs: true }, DT, T); lowest = Math.min(lowest, f.y); }
  assert.ok(lowest > 0 && lowest < 12, `stops above the ground and near it (${lowest.toFixed(1)} m)`);
}
{ // the predictor lands where the integrator lands, at the current throttle
  const s = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 });
  const p = predictImpact(s, T);
  const q = createLanding({ ...entry, sink: 20, drift: 6, tilt: 0 }); let t = 0; while (q.y > 0 && t < 60) { step(q, { throttle: 0, tiltRate: 0, legs: false }, DT, T); t += DT; }
  assert.ok(p.reached); assert.ok(Math.abs(p.z - q.z) < 2, `predicted z ${p.z.toFixed(1)} against flown ${q.z.toFixed(1)}`); assert.ok(Math.abs(p.t - t) < 0.3);
  const high = createLanding({ ...entry, sink: 0, drift: 0, tilt: 0 }); high.y = 1e6;
  assert.equal(predictImpact(high, T).reached, false, "beyond the predictor's horizon: not reached");
}
{ // the verdict: the worst axis names the reason; legs up, a slope or off the pad are wrecks whatever the speeds
  const base = { ...createLanding(entry), vy: -1, vx: 0, vz: 0.5, tilt: 0.02, legs: 1, legsDown: true };
  assert.deepEqual(verdict({ ...base }, 0, false, T).grade, 'CLEAN');
  assert.deepEqual([verdict({ ...base, vy: -4 }, 0, false, T).grade, verdict({ ...base, vy: -4 }, 0, false, T).reason], ['HARD', 'sink']);
  assert.deepEqual([verdict({ ...base, vz: 5 }, 0, false, T).grade, verdict({ ...base, vz: 5 }, 0, false, T).reason], ['WRECK', 'drift']);
  assert.deepEqual([verdict({ ...base, tilt: 0.1 }, 0, false, T).grade, verdict({ ...base, tilt: 0.1 }, 0, false, T).reason], ['HARD', 'tilt']);
  assert.deepEqual([verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).grade, verdict({ ...base, legs: 0.4, legsDown: false }, 0, false, T).reason], ['WRECK', 'legs']);
  assert.deepEqual(verdict({ ...base }, 0.2, false, T).reason, 'slope'); assert.deepEqual(verdict({ ...base }, 0, true, T).reason, 'off-pad');
  const v = verdict({ ...base, vy: -3.3, vz: -2.2, tilt: 0.05 }, 0, false, T);
  assert.equal(v.sink, 3.3); assert.equal(v.drift, 2.2); assert.ok(Math.abs(v.tilt - 0.05) < 1e-12, 'the readings are reported as flown');
}
{ // the flare: due below its altitude inside its corridor, never above it or outside; and it settles the rocket to the ground
  const s = { ...createLanding(entry), y: 25, vy: -5, vz: 2, tilt: 0.1 };
  assert.equal(flareDue(s, T), true); assert.equal(flareDue({ ...s, y: 40 }, T), false); assert.equal(flareDue({ ...s, vy: -9 }, T), false); assert.equal(flareDue({ ...s, vz: 6 }, T), false); assert.equal(flareDue({ ...s, tilt: 0.3 }, T), false);
  let f = { ...s }; for (let i = 0; i < 3000 && !touched(f); i++) flareStep(f, DT, T);
  assert.ok(touched(f), 'lands'); assert.ok(Math.abs(f.vy) <= T.flare.sinkFinal + 0.05, `settles at the final sink (${f.vy.toFixed(2)})`);
  assert.ok(Math.abs(f.vz) < 0.2 && Math.abs(f.tilt) < 0.02 && f.legsDown, 'drift and tilt killed, legs down');
  assert.equal(verdict(f, 0, false, T).grade, 'CLEAN', 'the auto-lander never crashes');
}
console.log('manual-landing: rules ok');
