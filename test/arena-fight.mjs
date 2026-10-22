// arena-fight.mjs — THE ARENA'S FIGHT ON THE LAB'S ENGINE (src/fx/boss/arena-fight.js; owner, 2026-10-23, b/c/d/e) against a fake body: the hull is the prey, the
// disc holds the aim, the sinkhole's stand, the 40 mm's wild flight away from the shell, a far shell nothing, the MK-9's stun then the panic, the 25 mm's barrage,
// the temperament over the kit's own base, the speeds, and nothing before the body is made
import assert from 'node:assert/strict';
import { createArenaFight } from '../src/fx/boss/arena-fight.js';
import { surfaceFrame, fromPlane, toPlane } from '../src/domain/surface-projection.js';
import { BOSS_FIGHT } from '../src/content/boss-fight.js';
import { NIH_DAIRIA_PREDATOR } from '../src/content/nih-dairia.js';

const R = 1500, centre = [0, 1, 0], f = surfaceFrame(centre), u = (x, z) => fromPlane(f, x, z, R), loc = (p) => toPlane(f, p, R);
const near = (a, b, tol = 0.5) => Math.hypot(a[0] - b[0], a[1] - b[1]) < tol;
function fake(x = 0, z = 0) {
  const kit = { settings: { ...NIH_DAIRIA_PREDATOR }, motion: { active: true, feeding: { locked: false }, pursuit: { phase: 'pull' }, disturbed: 0, disturb() { this.disturbed++; } } };
  const b = { kit, at: [x, z], get point() { return u(...b.at); }, shape: (toLocal) => ({ centre: toLocal(u(...b.at)), contacts: [toLocal(u(b.at[0] + 15, b.at[1])), toLocal(u(b.at[0] - 15, b.at[1]))], nodes: [] }) };
  return b;
}
const DISC = BOSS_FIGHT.bounds.radius, IN = DISC - BOSS_FIGHT.bounds.creatureMargin, KEEP = BOSS_FIGHT.arenaBoss.keep;

// nothing before the body is made
{ let t = 0; const fight = createArenaFight({ now: () => t });
  assert.equal(fight.step(1 / 60, { body: null, centre, R, hull: u(0, 0) }), null); assert.equal(fight.landed('bofors', u(0, 0)), false); assert.equal(fight.state().led, false); }

// the hull is the prey; a hull beyond the disc: the aim held on its edge less the creature's margin; on the sinkhole she aims at the centre
{ let t = 0; const fight = createArenaFight({ now: () => t }), body = fake(0, 0);
  const step = (hull, o = {}) => { t += 1 / 60; return loc(fight.step(1 / 60, { body, centre, R, hull, radius: DISC, ...o })); };
  assert.ok(near(step(u(40, 30)), [40 * (1 - KEEP / 50), 30 * (1 - KEEP / 50)]), `the hull inside: she hunts its point, ${KEEP} m short of it (she stalks)`);
  assert.ok(KEEP > 0 && KEEP < 50, 'a keep shorter than the lure\'s near band (5 cells)');
  body.at = [10, 0]; assert.ok(near(step(u(20, 0)), [20 - KEEP, 0]), 'nearer than keep: she backs off to it'); body.at = [0, 0];
  assert.ok(near(step(u(300, 0)), [IN, 0]), `the hull outside: the aim on the disc less the margin (${IN} m)`);
  assert.ok(near(step(u(40, 30), { ground: true }), [0, 0]), 'on the sinkhole: the centre'); assert.equal(fight.state().mode, 'ground');
  assert.equal(fight.landed('bofors', u(5, 0)), false, 'no fright while she stands on the sinkhole');
  assert.equal(fight.state().led, true); }

// THE 40 MM (e: "fears the 40mm, so the gunship fires 40mm between the boss and the auto-moving tank"): within the blast + reach of a contact she goes wild, away from
// the shell, at the flight's speed; one far off does nothing; the flight's speed is written over the kit's own base by the temperament
{ let t = 0; const fight = createArenaFight({ now: () => t }), body = fake(0, 0), hull = u(60, 0);
  const step = () => { t += 1 / 60; return loc(fight.step(1 / 60, { body, centre, R, hull, radius: DISC })); };
  step();
  assert.equal(fight.landed('bofors', u(0, 120)), false, 'a 40 mm 120 m off: nothing');
  assert.equal(fight.landed('bofors', u(30, 0)), true, 'a 40 mm between her and the hull: wild'); assert.equal(fight.state().wild, 1);
  const a = step(); assert.equal(fight.state().mode, 'flee'); assert.ok(a[0] < -BOSS_FIGHT.gunFear.bofors.flee + 1, `she flees away from the shell, from the hull (${a})`);
  for (let k = 0; k < 30; k++) step();
  assert.ok(Math.abs(body.kit.settings.speed - NIH_DAIRIA_PREDATOR.speed * BOSS_FIGHT.gunFear.bofors.speed) < 1e-6, `the flight's speed over her base (${body.kit.settings.speed})`);
  assert.equal(fight.state().temper, 'wild');
  t += BOSS_FIGHT.gunFear.bofors.duration; step(); assert.equal(fight.state().mode, 'hunt', 'the flight over: the hull again');
  assert.ok(near(step(), [60 - KEEP, 0])); }

// THE MK-9 (the clean nuke): within its blast + reach she is stunned BOSS_FIGHT.nuke.stun s (the kit's motion off, the aim her own centre), then the panic's flight
{ let t = 0; const fight = createArenaFight({ now: () => t }), body = fake(10, 0), hull = u(80, 0);
  const step = () => { t += 1 / 60; return loc(fight.step(1 / 60, { body, centre, R, hull, radius: DISC })); };
  step();
  assert.equal(fight.landed('heavy', u(10 + 60, 0)), true, 'the MK-9 at 60 m: within its 55 m blast + 8 of a contact');
  assert.equal(fight.state().stuns, 1); assert.equal(fight.state().panic, 1);
  const a = step(); assert.equal(fight.state().mode, 'stun'); assert.equal(body.kit.motion.active, false, 'her motion held'); assert.ok(near(a, [10, 0]), 'the aim her own centre');
  t += BOSS_FIGHT.nuke.stun; step(); assert.equal(body.kit.motion.active, true, 'the stun over'); assert.equal(fight.state().mode, 'flee', 'the panic runs');
  assert.equal(fight.landed('heavy', u(10 + 200, 0)), false, 'one 200 m off: nothing'); }

// THE 25 MM: each round within reach fills the barrage meter; at 1 a flinch
{ let t = 0; const fight = createArenaFight({ now: () => t }), body = fake(0, 0);
  fight.step(1 / 60, { body, centre, R, hull: u(60, 0), radius: DISC });
  const n = Math.ceil(1 / BOSS_FIGHT.gunFear.rotary.amount); let took = false;
  for (let k = 0; k < n; k++) took = fight.landed('rotary', u(10, 0)) || took;
  assert.equal(took, true); assert.equal(fight.state().flinch, 1, `${n} rounds: one flinch`); }

// THE SPEEDS: hers and the hull's, displacement over the last second
{ let t = 0; const fight = createArenaFight({ now: () => t }), body = fake(-50, 0);
  for (let k = 0; k < 180; k++) { t += 1 / 60; body.at[0] += 8 / 60; fight.step(1 / 60, { body, centre, R, hull: u(60 + 3 * t, 0), radius: DISC }); }
  const s = fight.state(); assert.ok(Math.abs(s.speed - 8) < 0.2 && Math.abs(s.hullSpeed - 3) < 0.2, `8 and 3 m/s (${s.speed}, ${s.hullSpeed})`); assert.ok(s.speedPeak >= s.speed && s.speedMean > 7); }

console.log('Arena fight: the hull the prey, the disc, the sinkhole, the 40 mm\'s wild flight, the MK-9\'s stun then panic, the 25 mm\'s barrage, the temperament over her base, the speeds.');
