import assert from 'node:assert/strict';
import { LASER_ORBIT, LASER_BEAM, LASER_BURN, LASER_VIEW, LASER_PRESET, LASER_TRAIL, LASER_TRAIL_SMOKE, LASER_CONTACT_RATE, LASER_SMOKE_RATE, LASER_TELEMETRY } from '../src/content/orbital-laser.js';
import { makeLaser, stepLaser, aimLaser, burnLaser, burnContacts, laserProgress, clampToRange } from '../src/domain/orbital-laser.js';
import { len3, dot3, norm3 } from '../src/vec3.js';

/* the owner's first values, pinned so a tuning session has to come through a decision entry */
assert.deepEqual({ ...LASER_ORBIT }, { period: 180, overhead: 20 });
assert.deepEqual({ ...LASER_BEAM }, { energy: 10, radius: 6, slew: 10, accel: 5, range: 320 });
assert.deepEqual({ ...LASER_BURN }, { soft: 0, hard: 1, wall: 0.5, rock: 0.5, tower: 1.5, seal: 1, tank: 1, heart: 3 });
assert.deepEqual({ ...LASER_VIEW }, { altitude: 4, fov: 20, inset: 0.44, groundBack: 120, groundUp: 60 });
assert.deepEqual({ ...LASER_TRAIL }, { every: 0.8, quads: 1000, seconds: 60, hot: 4, restamp: 0.4 });
assert.deepEqual({ ...LASER_TRAIL_SMOKE }, { every: 1.5, rate: 4, life: 7, capacity: 256, opacity: 0.85 });
assert.equal(LASER_CONTACT_RATE, 8);
assert.equal(LASER_SMOKE_RATE, 2);
assert.deepEqual({ ...LASER_TELEMETRY }, { wavelengthUm: 1.064, powerMW: 120, kelvinPerMWm2: 1800, speedHalving: 2, heatSeconds: 0.9, coolSeconds: 2.5 });
assert.equal(LASER_PRESET.burstRate, 0, 'a continuous beam, not a pulse train');
assert.equal(LASER_PRESET.coreWidth, 2);
assert.equal(LASER_PRESET.glowWidth, 10);

/* --- the clock ---------------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.equal(st.phase, 'away');
  assert.equal(st.left, 160);
  assert.equal(st.energy, 10);
  assert.equal(st.burning, false);
  assert.equal(st.contact, null);
  assert.equal(st.contacts.size, 0);
  assert.equal(stepLaser(st, 100, LASER_ORBIT, LASER_BEAM), null);
  assert.equal(st.phase, 'away');
  assert.equal(stepLaser(st, 60, LASER_ORBIT, LASER_BEAM), 'arrive');
  assert.equal(st.phase, 'overhead');
  assert.equal(st.left, 20);
  /* burn it half down, then let the pass close */
  assert.equal(burnLaser(st, true, 4), true);
  assert.equal(st.energy, 6);
  st.contacts.set('x', { seconds: 1, reported: false });
  assert.equal(stepLaser(st, 20, LASER_ORBIT, LASER_BEAM), 'close');
  assert.equal(st.phase, 'away');
  assert.equal(st.left, 160);
  assert.equal(st.energy, 10, 'unused energy is lost and the budget is restored for the next pass');
  assert.equal(st.burning, false);
  assert.equal(st.contact, null);
  assert.equal(st.contacts.size, 0);
}

/* --- the slew ----------------------------------------------------------- */
{
  const R = 753;
  /* the constant-rate chase: accel 0 */
  const FLAT = { ...LASER_BEAM, accel: 0 };
  const st = makeLaser(LASER_ORBIT, FLAT);
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  const a = [0, R, 0];
  aimLaser(st, a, 1 / 60, FLAT);
  assert.deepEqual(st.contact, [0, R, 0], 'the first aim after arrival snaps');
  /* a far target: the contact moves exactly slew * dt metres of arc along the sphere */
  const far = [R * Math.sin(0.4), R * Math.cos(0.4), 0];
  const before = st.contact.slice();
  aimLaser(st, far, 0.1, FLAT);
  assert.ok(Math.abs(len3(st.contact) - R) < 1e-6, 'the contact stays on the sphere');
  const arc = R * Math.acos(Math.max(-1, Math.min(1, dot3(norm3(before), norm3(st.contact)))));
  assert.ok(Math.abs(arc - FLAT.slew * 0.1) < 1e-6, `moved ${arc} m, wanted ${FLAT.slew * 0.1}`);
  /* a near target is reached outright */
  const near = [st.contact[0] + 0.05, st.contact[1], st.contact[2]];
  const scaled = norm3(near).map((c) => c * R);
  aimLaser(st, scaled, 0.5, FLAT);
  assert.ok(Math.abs(st.contact[0] - scaled[0]) < 1e-9 && Math.abs(st.contact[2] - scaled[2]) < 1e-9, 'a near target snaps');
}

/* --- the inertia --------------------------------------------------------- */
{
  const R = 753, beam = { ...LASER_BEAM, slew: 10, accel: 5 };
  const far = [R * Math.sin(0.2), R * Math.cos(0.2), 0];   /* 150 m of arc away */
  const arcTo = (p, q = far) => R * Math.acos(Math.max(-1, Math.min(1, dot3(norm3(p), norm3(q)))));
  const st = makeLaser(LASER_ORBIT, beam);
  stepLaser(st, 160, LASER_ORBIT, beam);
  aimLaser(st, [0, R, 0], 1 / 60, beam);
  const left = arcTo(st.contact);
  aimLaser(st, far, 0.1, beam);
  assert.ok(Math.abs(left - arcTo(st.contact) - 0.05) < 1e-6, 'from rest it moves accel * dt * dt: 0.05 m in the first 0.1 s');
  let top = 0;
  for (let i = 0; i < 400; i++) {
    const before = arcTo(st.contact);
    aimLaser(st, far, 0.1, beam);
    top = Math.max(top, st.speed);
    assert.ok(arcTo(st.contact) <= before + 1e-9, 'it never moves away from the target');
  }
  assert.ok(top <= beam.slew + 1e-9 && top > beam.slew - 1e-6, `it reaches and holds its top speed (${top} m/s)`);
  assert.ok(arcTo(st.contact) < 1e-6, 'it brakes onto the target and arrives');
  /* a reversal bleeds the speed off: dragging back the other way starts again from rest */
  const st2 = makeLaser(LASER_ORBIT, beam);
  stepLaser(st2, 160, LASER_ORBIT, beam);
  aimLaser(st2, [0, R, 0], 1 / 60, beam);
  for (let i = 0; i < 30; i++) aimLaser(st2, far, 0.1, beam);
  const fast = st2.speed;
  aimLaser(st2, [-far[0], far[1], far[2]], 0.1, beam);
  assert.ok(fast > 5 && st2.speed <= beam.accel * 0.1 + 1e-9, `a reversal drops ${fast} m/s to ${st2.speed} m/s`);
  /* the close forgets the speed with the contact */
  stepLaser(st2, 20, LASER_ORBIT, beam);
  assert.equal(st2.speed, 0);
}

/* --- the range ------------------------------------------------------------ */
{
  const R = 753, at = (arc, az) => [R * Math.sin(arc / R) * Math.cos(az), R * Math.cos(arc / R), R * Math.sin(arc / R) * Math.sin(az)];
  const arcOf = (p) => R * Math.acos(Math.max(-1, Math.min(1, p[1] / len3(p))));
  const inside = clampToRange(at(200, 1), 320);
  assert.deepEqual(inside.target, at(200, 1), 'an aim inside the range is left alone');
  assert.ok(Math.abs(inside.arc - 200) < 1e-6);
  const out = clampToRange(at(450, 2), 320);
  assert.ok(Math.abs(out.arc - 450) < 1e-6, 'the unclamped distance is reported');
  assert.ok(Math.abs(arcOf(out.target) - 320) < 1e-6 && Math.abs(len3(out.target) - R) < 1e-6, 'an aim beyond it sits on the limit, on the sphere');
  assert.ok(Math.abs(Math.atan2(out.target[2], out.target[0]) - 2) < 1e-9, 'along the same bearing from the base');
  assert.deepEqual(clampToRange(at(900, 0.5), 0).target, at(900, 0.5), 'range 0 is no limit');
}

/* --- the burn accumulator ------------------------------------------------ */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  const body = { id: 'b1', kind: 'soft', pos: [0, 753, 0] };
  const wall = { id: 'w1', kind: 'wall', pos: [1, 753, 0] };
  let done = burnContacts(st, [body, wall], 0.1, LASER_BURN);
  assert.deepEqual(done.map((d) => d.thing.id), ['b1'], 'soft dies on contact');
  assert.equal(done[0].kind, 'soft');
  assert.equal(done[0].done, true);
  done = burnContacts(st, [body, wall], 0.1, LASER_BURN);
  assert.deepEqual(done, [], 'a finished id is reported once');
  for (let i = 0; i < 2; i++) burnContacts(st, [wall], 0.1, LASER_BURN);
  assert.deepEqual(burnContacts(st, [wall], 0.2, LASER_BURN).map((d) => d.thing.id), ['w1'], 'a wall cuts through after 0.5 s');
  assert.equal(st.contacts.has('b1'), false, 'an id that left the footprint is forgotten');
  /* leaving and returning restarts the accumulation */
  const tower = { id: 't1', kind: 'tower', pos: [2, 753, 0] };
  burnContacts(st, [tower], 1.0, LASER_BURN);
  assert.equal(st.contacts.get('t1').seconds, 1);
  burnContacts(st, [], 0.1, LASER_BURN);
  assert.equal(st.contacts.has('t1'), false);
  burnContacts(st, [tower], 1.0, LASER_BURN);
  assert.equal(st.contacts.get('t1').seconds, 1, 'the accumulator restarts, it does not resume');
  /* an unknown kind never finishes ('cloud': rock became a real kind, a planet lattice cell) */
  assert.deepEqual(burnContacts(st, [{ id: 'z', kind: 'cloud', pos: [0, 753, 0] }], 99, LASER_BURN), []);
  /* a rock cell cuts through after LASER_BURN.rock seconds, like a base wall */
  const rock = { id: 'r1', kind: 'rock', pos: [0, 753, 0] };
  assert.deepEqual(burnContacts(st, [rock], LASER_BURN.rock - 0.01, LASER_BURN), []);
  assert.deepEqual(burnContacts(st, [rock], 0.01, LASER_BURN).map((d) => d.kind), ['rock']);
}

/* --- the energy drain ---------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.equal(burnLaser(st, true, 1), false, 'no burning while the satellite is away');
  stepLaser(st, 160, LASER_ORBIT, LASER_BEAM);
  assert.equal(burnLaser(st, false, 1), false);
  assert.equal(st.energy, 10, 'energy drains only while it burns');
  assert.equal(burnLaser(st, true, 6), true);
  assert.equal(st.energy, 4);
  assert.equal(burnLaser(st, true, 9), true);
  assert.equal(st.energy, 0, 'the drain floors at zero');
  assert.equal(burnLaser(st, true, 1), false, 'out of energy while overhead');
  assert.equal(st.burning, false);
}

/* --- the HUD progress ---------------------------------------------------- */
{
  const st = makeLaser(LASER_ORBIT, LASER_BEAM);
  assert.deepEqual(laserProgress(st, LASER_ORBIT, LASER_BEAM), { pass: 1, energy: 1 });
  stepLaser(st, 80, LASER_ORBIT, LASER_BEAM);
  assert.deepEqual(laserProgress(st, LASER_ORBIT, LASER_BEAM), { pass: 0.5, energy: 1 });
  stepLaser(st, 80, LASER_ORBIT, LASER_BEAM);
  burnLaser(st, true, 5);
  const p = laserProgress(st, LASER_ORBIT, LASER_BEAM);
  assert.equal(p.pass, 1);
  assert.equal(p.energy, 0.5);
  stepLaser(st, 15, LASER_ORBIT, LASER_BEAM);
  assert.equal(laserProgress(st, LASER_ORBIT, LASER_BEAM).pass, 0.25);
}

console.log('Orbital laser: the clock arrives and closes, the contact slews at its metres per second, burns accumulate per kind and are reported once, energy drains only while burning.');
